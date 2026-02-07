import { collection, getDocs, getDoc, query, where, doc } from 'firebase/firestore';
import { mainDb } from '../firebase/mainConfig';
import { MemoryScrapingStorage, ScrapedPage } from './memoryScrapingStorage';

export type ScheduledRunStats = {
  startedAt: number;
  finishedAt?: number;
  totalGuides: number;
  scraped: number;
  skipped: number;
  errors: number;
  details: Array<{ slug: string; websiteUrl?: string; pages?: number; error?: string }>;
};

export class ScheduledScrapingService {
  private static intervalId: NodeJS.Timeout | null = null;
  private static readonly FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
  private static lastStats: ScheduledRunStats | null = null;
  private static running = false;

  static start(): void {
    if (this.intervalId) return;
    this.run().catch(() => {});
    this.intervalId = setInterval(() => this.run().catch(() => {}), this.FOUR_HOURS_MS);
  }

  static stop(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
  }

  static getStats(): ScheduledRunStats | null {
    return this.lastStats;
  }

  static isRunning(): boolean {
    return this.running;
  }

  static async runForGuide(slug: string, websiteUrl?: string): Promise<{ slug: string; websiteUrl: string; pages: number }> {
    const targetSlug = String(slug || '').trim();
    if (!targetSlug) throw new Error('slug em falta');

    let site = websiteUrl;
    if (!site) {
      const ref = doc(mainDb, 'guides', targetSlug);
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error('guia não encontrado');
      const data = snap.data() as any;
      site = String(data?.websiteUrl || '').trim();
    }
    if (!site || !/^https?:\/\//i.test(site)) throw new Error('websiteUrl inválido');

    const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const apiKey = process.env.SIMPLE_API_KEY || process.env.NEXT_PUBLIC_API_KEY || '';
    const url = new URL('/api/website-scraper', base);
    if (apiKey) {
      try { url.searchParams.set('apiKey', apiKey); } catch {}
    }

    const resp = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(apiKey ? { 'x-api-key': apiKey } : {}) },
      body: JSON.stringify({ websiteUrl: site, maxPages: 30, maxDepth: 1, maxConcurrency: 6, timeoutMs: 5000, maxHtmlBytes: 140000 })
    });
    if (!resp.ok) {
      const bodyText = await resp.text().catch(() => '');
      throw new Error(`Scraper HTTP ${resp.status} ${bodyText?.slice(0,180)}`);
    }
    const data = await resp.json();
    const pages = Array.isArray(data?.pages) ? (data.pages as ScrapedPage[]) : [];
    await MemoryScrapingStorage.save(targetSlug, site, pages);
    return { slug: targetSlug, websiteUrl: site, pages: pages.length };
  }

  static async run(): Promise<ScheduledRunStats> {
    if (this.running) return this.lastStats || { startedAt: Date.now(), totalGuides: 0, scraped: 0, skipped: 0, errors: 0, details: [] };
    this.running = true;
    const stats: ScheduledRunStats = { startedAt: Date.now(), totalGuides: 0, scraped: 0, skipped: 0, errors: 0, details: [] };
    try {
      const guidesSnap = await getDocs(query(collection(mainDb, 'guides'), where('isActive', '==', true)));
      const guides: Array<{ slug: string; websiteUrl?: string | null }> = [];
      guidesSnap.forEach(d => {
        const data = d.data() as any;
        guides.push({ slug: String(data?.slug || d.id), websiteUrl: data?.websiteUrl || null });
      });
      stats.totalGuides = guides.length;

      const maxConcurrency = 8;
      let idx = 0;
      const workers = Array.from({ length: maxConcurrency }).map(async () => {
        while (idx < guides.length) {
          const i = idx++;
          const g = guides[i];
          if (!g.websiteUrl || !/^https?:\/\//i.test(g.websiteUrl)) {
            stats.skipped++;
            stats.details.push({ slug: g.slug, websiteUrl: g.websiteUrl || undefined, error: 'No websiteUrl' });
            continue;
          }
          try {
            // Chama o scraper interno via API local para reutilizar lógica existente
            const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
            const apiKey = process.env.SIMPLE_API_KEY || process.env.NEXT_PUBLIC_API_KEY || '';
            const url = new URL('/api/website-scraper', base);
            if (apiKey) {
              try { url.searchParams.set('apiKey', apiKey); } catch {}
            }
            const resp = await fetch(url.toString(), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...(apiKey ? { 'x-api-key': apiKey } : {}) },
              body: JSON.stringify({ websiteUrl: g.websiteUrl, maxPages: 40, maxDepth: 2, maxConcurrency: 12, timeoutMs: 6000, maxHtmlBytes: 180000 })
            });
            if (!resp.ok) {
              const bodyText = await resp.text().catch(() => '');
              throw new Error(`Scraper HTTP ${resp.status} ${bodyText?.slice(0,180)}`);
            }
            const data = await resp.json();
            const pages = Array.isArray(data?.pages) ? (data.pages as ScrapedPage[]) : [];
            await MemoryScrapingStorage.save(g.slug, g.websiteUrl, pages);
            stats.scraped++;
            stats.details.push({ slug: g.slug, websiteUrl: g.websiteUrl, pages: pages.length });
          } catch (e: any) {
            stats.errors++;
            stats.details.push({ slug: g.slug, websiteUrl: g.websiteUrl, error: e?.message || 'unknown' });
          }
        }
      });
      await Promise.all(workers);

      this.lastStats = { ...stats, finishedAt: Date.now() };
      return this.lastStats;
    } finally {
      this.running = false;
    }
  }
}


