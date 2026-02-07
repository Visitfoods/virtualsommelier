import fs from 'fs/promises';
import path from 'path';

export type ScrapedPage = {
  url: string;
  title?: string;
  description?: string;
  text?: string;
  kind?: 'product' | 'page' | 'blog' | 'faq';
};

type StoredDoc = {
  guideSlug: string;
  websiteUrl: string;
  domain: string;
  pages: ScrapedPage[];
  timestamp: number;
  expiresAt: number;
  status: 'active' | 'expired';
};

export class MemoryScrapingStorage {
  private static cache = new Map<string, StoredDoc>();
  private static readonly CACHE_DIR = path.join(process.cwd(), '.next', 'scraping-cache');
  static readonly TTL_HOURS = 4;

  private static keyByGuide(guideSlug: string): string {
    return `guide:${guideSlug}`;
  }

  private static keyByDomain(domain: string): string {
    return `domain:${domain}`;
  }

  private static async ensureDir(): Promise<void> {
    await fs.mkdir(this.CACHE_DIR, { recursive: true });
  }

  static async save(guideSlug: string, websiteUrl: string, pages: ScrapedPage[]): Promise<void> {
    const now = Date.now();
    const expiresAt = now + this.TTL_HOURS * 60 * 60 * 1000;
    const domain = (() => { try { return new URL(websiteUrl).hostname; } catch { return ''; } })();
    const doc: StoredDoc = { guideSlug, websiteUrl, domain, pages, timestamp: now, expiresAt, status: 'active' };

    this.cache.set(this.keyByGuide(guideSlug), doc);
    if (domain) this.cache.set(this.keyByDomain(domain), doc);

    await this.ensureDir();
    const filePath = path.join(this.CACHE_DIR, `${guideSlug}.json`);
    await fs.writeFile(filePath, JSON.stringify(doc, null, 2), 'utf8');
  }

  private static isValid(doc: StoredDoc | undefined | null): doc is StoredDoc {
    return !!doc && doc.status === 'active' && doc.expiresAt > Date.now() && Array.isArray(doc.pages) && doc.pages.length > 0;
  }

  static async getValidByGuide(guideSlug: string): Promise<ScrapedPage[] | null> {
    const mem = this.cache.get(this.keyByGuide(guideSlug));
    if (this.isValid(mem)) return mem.pages;

    try {
      const filePath = path.join(this.CACHE_DIR, `${guideSlug}.json`);
      const data = JSON.parse(await fs.readFile(filePath, 'utf8')) as StoredDoc;
      if (this.isValid(data)) {
        this.cache.set(this.keyByGuide(guideSlug), data);
        if (data.domain) this.cache.set(this.keyByDomain(data.domain), data);
        return data.pages;
      }
    } catch {}
    return null;
  }

  static async getValidByDomain(domain: string): Promise<ScrapedPage[] | null> {
    const mem = this.cache.get(this.keyByDomain(domain));
    if (this.isValid(mem)) return mem.pages;
    // Procurar nos ficheiros (scan simples por segurança; cacheará no primeiro acerto)
    try {
      await this.ensureDir();
      const entries = await fs.readdir(this.CACHE_DIR);
      for (const name of entries) {
        if (!name.endsWith('.json')) continue;
        const data = JSON.parse(await fs.readFile(path.join(this.CACHE_DIR, name), 'utf8')) as StoredDoc;
        if (data.domain === domain && this.isValid(data)) {
          this.cache.set(this.keyByGuide(data.guideSlug), data);
          if (data.domain) this.cache.set(this.keyByDomain(data.domain), data);
          return data.pages;
        }
      }
    } catch {}
    return null;
  }

  static async cleanupExpired(): Promise<void> {
    try {
      await this.ensureDir();
      const entries = await fs.readdir(this.CACHE_DIR);
      const now = Date.now();
      for (const name of entries) {
        if (!name.endsWith('.json')) continue;
        const filePath = path.join(this.CACHE_DIR, name);
        try {
          const data = JSON.parse(await fs.readFile(filePath, 'utf8')) as StoredDoc;
          if (data.expiresAt <= now) {
            await fs.unlink(filePath).catch(() => {});
            this.cache.delete(this.keyByGuide(data.guideSlug));
            if (data.domain) this.cache.delete(this.keyByDomain(data.domain));
          }
        } catch {}
      }
    } catch {}
  }
}





