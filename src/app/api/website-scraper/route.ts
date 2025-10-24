import { NextRequest, NextResponse } from 'next/server';
import { Agent, setGlobalDispatcher } from 'undici';
import { LRUCache } from 'lru-cache';
import { standardRateLimit } from '@/middleware/rateLimitMiddleware';
import { simpleApiKeyAuth } from '@/middleware/simpleApiKeyMiddleware';

export const runtime = 'nodejs';

// Reutilizar ligações HTTP (Keep-Alive) para reduzir latência entre pedidos
try {
  const agent = new Agent({ keepAliveTimeout: 10_000, keepAliveMaxTimeout: 15_000, pipelining: 1 });
  setGlobalDispatcher(agent);
} catch {}

type ScrapedPage = {
  url: string;
  title?: string;
  description?: string;
  text?: string;
  kind?: 'product' | 'page' | 'blog' | 'faq';
};

type ScrapeRequest = {
  websiteUrl: string;
  maxPages?: number;
  maxDepth?: number;
  includePatterns?: string[];
  excludePatterns?: string[];
  respectRobotsTxt?: boolean;
};

const cache = new LRUCache<string, { pages: ScrapedPage[]; ts: number }>({ max: 50, ttl: 1000 * 60 * 10 });

function normalizeBase(url: string): URL | null {
  try {
    const u = new URL(url);
    if (!/^https?:$/i.test(u.protocol)) return null;
    return u;
  } catch { return null; }
}

async function fetchText(url: string, timeoutMs: number): Promise<string> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VirtualGuideBot/1.0; +https://virtualguide.info)' },
      cache: 'no-store',
      signal: ctrl.signal
    });
    if (!res.ok) return '';
    return await res.text();
  } catch { return ''; } finally { clearTimeout(id); }
}

async function fetchHtml(url: string, timeoutMs: number, maxBytes: number): Promise<string> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 
        'User-Agent': 'Mozilla/5.0 (compatible; VirtualGuideBot/1.1; +https://virtualguide.info)',
        'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br'
      },
      cache: 'no-store',
      signal: ctrl.signal
    });
    const ct = res.headers.get('content-type') || '';
    if (!/text\/html/i.test(ct)) return '';
    // Ler apenas os primeiros N bytes para reduzir latência em páginas grandes
    let html = '';
    try {
      const reader = (res as any).body?.getReader?.();
      if (reader) {
        const decoder = new TextDecoder('utf-8');
        let total = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value?.byteLength || 0;
          html += decoder.decode(value, { stream: true });
          if (total >= maxBytes) break;
        }
        html += decoder.decode();
      } else {
        const full = await res.text();
        html = full.slice(0, maxBytes);
      }
    } catch {
      try { html = await res.text(); html = html.slice(0, maxBytes); } catch { html = ''; }
    }
    // Alguns sites devolvem páginas 404 com status 200; filtrar por heurísticas
    const lower = html.toLowerCase();
    const looks404 = (
      !res.ok ||
      /\b404\b/.test(lower) ||
      /p[áa]gina n[ãa]o encontrada/.test(lower) ||
      /page not found/.test(lower) ||
      /not found/.test(lower) ||
      /p[áa]gina inexistente/.test(lower)
    );
    // meta robots noindex
    const hasNoindex = /<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(lower) || /x-robots-tag\s*:\s*noindex/i.test(lower);
    // páginas com listagens sem resultados
    const looksNoResults = /(sem\s+resultados|nenhum\s+resultado|nenhum\s+produto|no\s+products\s+found|no\s+results)/i.test(lower);
    if (looks404 || hasNoindex || looksNoResults) return '';
    return html;
  } catch { return ''; } finally { clearTimeout(id); }
}

function extractLinks(base: URL, html: string): string[] {
  const urls: string[] = [];
  const re = /href=["']([^"'#]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const raw = m[1];
    try {
      const abs = new URL(raw, base);
      if (abs.hostname === base.hostname && /^https?:$/i.test(abs.protocol)) {
        // remover fragmento e parâmetros de tracking comuns
        abs.hash = '';
        abs.searchParams.delete('utm_source');
        abs.searchParams.delete('utm_medium');
        abs.searchParams.delete('utm_campaign');
        abs.searchParams.delete('utm_term');
        abs.searchParams.delete('utm_content');
        abs.searchParams.delete('gclid');
        abs.searchParams.delete('fbclid');
        // ignorar links com rel="nofollow"
        const before = html.slice(Math.max(0, re.lastIndex - 200), re.lastIndex + 200);
        if (/rel\s*=\s*"[^"']*nofollow/i.test(before)) {
          continue;
        }
        const href = abs.href;
        urls.push(href);
      }
    } catch { continue; }
  }
  return Array.from(new Set(urls));
}

function extractMeta(html: string): { title?: string; description?: string } {
  const getMeta = (regex: RegExp) => html.match(regex)?.[1]?.trim();
  const title = getMeta(/<title[^>]*>([^<]+)<\/title>/i);
  const desc = getMeta(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i)
    || getMeta(/<meta[^>]+content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/i);
  return { title, description: desc };
}

function extractReadableText(html: string): string {
  try {
    let s = html || '';
    s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ');
    s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ');
    s = s.replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
    s = s.replace(/<!--([\s\S]*?)-->/g, ' ');
    s = s.replace(/<(?:p|br|div|section|article|li|h[1-6])\b[^>]*>/gi, '\n');
    s = s.replace(/<[^>]+>/g, ' ');
    s = s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    s = s.replace(/\r\n|\r/g, '\n');
    s = s.replace(/\n{3,}/g, '\n\n');
    s = s.replace(/[\t ]{2,}/g, ' ');
    return s.trim();
  } catch { return ''; }
}

function looksThinContent(text: string): boolean {
  try {
    if (!text) return true;
    const len = text.replace(/\s+/g, ' ').trim().length;
    return len < 200; // conteúdo demasiado curto
  } catch { return true; }
}

function isLikelyCategory(url: string, title?: string): boolean {
  const u = url.toLowerCase();
  const t = (title || '').toLowerCase();
  return /(categoria|categories|category|catalogo|catalog|colec(c|ç)ao|collection|produtos|products)/i.test(u) || /(categoria|catálogo|colec(c|ç)ão|produtos)/i.test(t);
}

function isLikelyBlog(url: string, title?: string): boolean {
  const u = url.toLowerCase();
  const t = (title || '').toLowerCase();
  return /(blog|noticias|news|artigos|articles|post)/i.test(u) || /(blog|notícias|artigos|news)/i.test(t);
}

function isLikelyFaq(url: string, title?: string): boolean {
  const u = url.toLowerCase();
  const t = (title || '').toLowerCase();
  return /(faq|perguntas\-?frequentes|ajuda|suporte)/i.test(u) || /(faq|perguntas\s+frequentes|ajuda)/i.test(t);
}

function classifyKind(url: string, title?: string): 'product' | 'page' | 'blog' | 'faq' {
  if (isLikelyProduct(url, title)) return 'product';
  if (isLikelyFaq(url, title)) return 'faq';
  if (isLikelyBlog(url, title)) return 'blog';
  return 'page';
}

function computeLinkPriority(u: string): number {
  try {
    const p = new URL(u).pathname.toLowerCase();
    let w = 0;
    if (/(produto|product|loja|shop|item|sku)/i.test(p)) w += 30;
    if (/(categoria|category|catalogo|catalog|collection|produtos|products)/i.test(p)) w += 20;
    if (/(faq|perguntas|ajuda|suporte)/i.test(p)) w += 8;
    if (/sitemap|\/page\//i.test(p)) w -= 50;
    if (/\.(xml|xsl|gz|pdf|zip|json)$/i.test(p)) w -= 100;
    return w;
  } catch { return 0; }
}

function extractSitemapUrls(xml: string, base: URL): string[] {
  try {
    const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
    const urls: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml))) {
      try {
        const abs = new URL(m[1], base);
        if (abs.hostname === base.hostname && /^https?:$/i.test(abs.protocol)) {
          const href = abs.href.split('#')[0];
          // filtrar tipos indesejados
          if (!/\.(xml|xsl|gz|pdf|zip|json)$/i.test(href)) urls.push(href);
        }
      } catch { continue; }
    }
    return Array.from(new Set(urls));
  } catch { return []; }
}

async function readRobots(base: URL): Promise<{ disallowAll: boolean }> {
  try {
    const txt = await fetchText(`${base.origin}/robots.txt`, 4000);
    if (!txt) return { disallowAll: false };
    const uaStar = /User-agent:\s*\*([\s\S]*?)(?=\n\s*User-agent:|$)/i.exec(txt)?.[1] || '';
    const disallowAll = /\bDisallow:\s*\/(\s|$)/i.test(uaStar) && !/\bAllow:\s*\//i.test(uaStar);
    return { disallowAll };
  } catch { return { disallowAll: false }; }
}

function isLikelyProduct(url: string, title?: string, html?: string): boolean {
  const u = url.toLowerCase();
  const t = (title || '').toLowerCase();
  const pathSignal = /(product|produto|shop|loja|buy|comprar|cart|sku|item)/i.test(u) || /(produto|comprar|preço|preco|tamanho|cor)/i.test(t);
  let jsonLdSignal = false;
  try {
    const blocks = html?.match(/<script[^>]+type=\"application\/ld\+json\"[^>]*>[\s\S]*?<\/script>/gi) || [];
    for (const b of blocks) {
      const json = b.replace(/^[\s\S]*?>/, '').replace(/<\/script>[\s\S]*$/, '');
      const data = JSON.parse(json);
      const arr = Array.isArray(data) ? data : [data];
      if (arr.some((obj: any) => String(obj['@type'] || '').toLowerCase().includes('product'))) { jsonLdSignal = true; break; }
    }
  } catch {}
  return pathSignal || jsonLdSignal;
}

export async function POST(req: NextRequest) {
  // Rate limit
  const rl = await standardRateLimit()(req);
  if (rl) return rl as any;
  const auth = await simpleApiKeyAuth()(req);
  if (auth) return auth as any;

  let body: ScrapeRequest;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const base = normalizeBase(String(body?.websiteUrl || ''));
  if (!base) return NextResponse.json({ error: 'websiteUrl inválido' }, { status: 400 });

  const maxPages = Math.max(1, Math.min(200, Number(body?.maxPages) || 40));
  const maxDepth = Math.max(0, Math.min(5, Number(body?.maxDepth) || 2));
  const maxConcurrency = Math.max(1, Math.min(16, Number((body as any)?.maxConcurrency) || 8));
  const requestTimeoutMs = Math.max(2000, Math.min(15000, Number((body as any)?.timeoutMs) || 8000));
  const maxHtmlBytes = Math.max(64_000, Math.min(600_000, Number((body as any)?.maxHtmlBytes) || 250_000));
  const includePatterns = Array.isArray(body?.includePatterns) ? body.includePatterns : [];
  const excludePatterns = Array.isArray(body?.excludePatterns) ? body.excludePatterns : [];
  const respectRobots = body?.respectRobotsTxt !== false;

  const cacheKey = `${base.origin}|${maxPages}|${maxDepth}|${includePatterns.join(',')}|${excludePatterns.join(',')}`;
  const cached = cache.get(cacheKey);
  if (cached) return NextResponse.json({ base: base.origin, pages: cached.pages, cached: true });

  if (respectRobots) {
    const robots = await readRobots(base);
    if (robots.disallowAll) {
      return NextResponse.json({ base: base.origin, pages: [], warning: 'robots.txt proíbe crawling' }, { status: 200 });
    }
  }

  const pages: ScrapedPage[] = [];
  const seen = new Set<string>();
  const queue: Array<{ url: string; depth: number }> = [];
  const concurrency = maxConcurrency; // paralelismo controlado

  // seed via sitemap
  try {
    const smSet = new Set<string>([`${base.origin}/sitemap.xml`, `${base.origin}/sitemap_index.xml`]);
    // tentar descobrir sitemaps a partir de robots.txt
    try {
      const robotsTxt = await fetchText(`${base.origin}/robots.txt`, 5000);
      if (robotsTxt) {
        const sitemapRe = /^sitemap:\s*(\S+)/gim;
        let mm: RegExpExecArray | null;
        while ((mm = sitemapRe.exec(robotsTxt))) {
          try {
            const smUrl = new URL(mm[1], base).href;
            if (new URL(smUrl).hostname === base.hostname) smSet.add(smUrl);
          } catch {}
        }
      }
    } catch {}
    for (const sm of Array.from(smSet)) {
      const xml = await fetchText(sm, 6000);
      if (!xml) continue;
      const urls = extractSitemapUrls(xml, base);
      for (const u of urls.slice(0, maxPages * 3)) {
        if (!seen.has(u)) { seen.add(u); queue.push({ url: u, depth: 0 }); }
      }
      if (queue.length > 0) break;
    }
  } catch {}

  // fallback seed: homepage
  if (queue.length === 0) {
    queue.push({ url: base.origin, depth: 0 });
    seen.add(base.origin);
  }

  function passesFilters(u: string): boolean {
    if (/\.(xml|xsl|gz|pdf|zip|json|csv|xlsx?)$/i.test(u)) return false;
    if (excludePatterns.some(p => new RegExp(p, 'i').test(u))) return false;
    if (includePatterns.length > 0 && !includePatterns.some(p => new RegExp(p, 'i').test(u))) return false;
    return true;
  }

  async function worker() {
    while (pages.length < maxPages) {
      const item = queue.shift();
      if (!item) break;
      const { url, depth } = item;
      try {
        const html = await fetchHtml(url, requestTimeoutMs, maxHtmlBytes);
        if (!html) continue;
        const { title, description } = extractMeta(html);
        const textRaw = extractReadableText(html);
        if (looksThinContent(textRaw)) continue;
        const text = textRaw.length > 12000 ? textRaw.slice(0, 12000) : textRaw;
        pages.push({ url, title, description, text, kind: classifyKind(url, title, html) });

        if (depth < maxDepth) {
          const links = extractLinks(base, html);
          const ordered = links
            .filter(next => !seen.has(next) && passesFilters(next))
            .map(next => ({ next, prio: computeLinkPriority(next) }))
            .sort((a, b) => b.prio - a.prio);
          for (const { next } of ordered) {
            if (seen.has(next)) continue;
            if (!passesFilters(next)) continue;
            seen.add(next);
            const nextItem = { url: next, depth: depth + 1 } as { url: string; depth: number };
            if (computeLinkPriority(next) >= 20) {
              queue.unshift(nextItem);
            } else {
              queue.push(nextItem);
            }
          }
        }
      } catch {}
    }
  }

  // Executar vários workers em paralelo
  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  cache.set(cacheKey, { pages, ts: Date.now() });
  return NextResponse.json({ base: base.origin, total: pages.length, pages });
}


