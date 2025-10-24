import { NextRequest, NextResponse } from 'next/server';
import { standardRateLimit } from '@/middleware/rateLimitMiddleware';

export const runtime = 'nodejs';

type SearchResult = { url: string; title?: string; score: number; verified?: boolean; confidence?: number };

function normalizeBase(raw: string): URL | null {
  try {
    const u = new URL(raw);
    if (!/^https?:$/i.test(u.protocol)) return null;
    return u;
  } catch {
    return null;
  }
}

function tokenize(q: string): string[] {
  return (q || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .slice(0, 8);
}

function textScore(hay: string, tokens: string[]): number {
  const s = hay.toLowerCase();
  let score = 0;
  for (const t of tokens) {
    if (!t) continue;
    const count = (s.match(new RegExp(t.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g')) || []).length;
    score += count * 3;
    if (s.includes('/' + t) || s.endsWith('/' + t) || s.includes('-' + t + '-') || s.includes('_' + t + '_')) score += 2;
  }
  return score;
}

async function fetchText(url: string, timeoutMs = 8000): Promise<string> {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal, headers: { 'User-Agent': 'VirtualGuideBot/1.0' }, cache: 'no-store' });
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('text/')) return '';
    return await res.text();
  } catch {
    return '';
  } finally {
    clearTimeout(to);
  }
}

async function fetchHtml(url: string, timeoutMs = 8000): Promise<string> {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal, headers: { 'User-Agent': 'VirtualGuideBot/1.0' }, cache: 'no-store' });
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('text/html')) return '';
    return await res.text();
  } catch {
    return '';
  } finally {
    clearTimeout(to);
  }
}

async function checkUrlOk(url: string, timeoutMs = 6000): Promise<boolean> {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const head = await fetch(url, { method: 'HEAD', signal: controller.signal, cache: 'no-store' });
    if (head.ok) {
      const ct = head.headers.get('content-type') || '';
      if (ct.includes('text/html')) return true;
    }
  } catch {}
  finally { clearTimeout(to); }
  // Fallback: GET HTML curto
  try {
    const html = await fetchHtml(url, Math.max(3000, Math.floor(timeoutMs / 2)));
    const lower = html.toLowerCase();
    // filtrar 404 custom/sem resultados
    const looks404 = /\b404\b/.test(lower) || /p[áa]gina n[ãa]o encontrada/.test(lower) || /page not found/.test(lower) || /p[áa]gina inexistente/.test(lower);
    const looksNoResults = /(sem\s+resultados|nenhum\s+resultado|nenhum\s+produto|no\s+products\s+found|no\s+results)/i.test(lower);
    const hasNoindex = /<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(lower) || /x-robots-tag\s*:\s*noindex/i.test(lower);
    return html.length > 0 && !looks404 && !looksNoResults && !hasNoindex; // já garante text/html
  } catch { return false; }
}

function extractLinks(base: URL, html: string): string[] {
  try {
    const re = /href\s*=\s*"([^"]+)"/gi;
    const out: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      try {
        const u = new URL(m[1], base);
        if (u.hostname === base.hostname && /^https?:$/i.test(u.protocol)) out.push(u.href);
      } catch {}
    }
    return Array.from(new Set(out));
  } catch { return []; }
}

function extractTitle(html: string): string | undefined {
  try {
    const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (m && m[1]) return m[1].replace(/\s+/g, ' ').trim();
  } catch {}
  return undefined;
}

function extractSitemapUrls(xml: string, base: URL): string[] {
  try {
    const urlMatches = Array.from(xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)).map(m => m[1]);
    const valid = urlMatches
      .map(u => { try { return new URL(u, base).href; } catch { return null; } })
      .filter((u): u is string => !!u)
      .filter(u => new URL(u).hostname === base.hostname)
      .filter(u => !/sitemap/i.test(u))
      .filter(u => !/\.(xml|xsl|gz|pdf)$/i.test(u));
    return Array.from(new Set(valid));
  } catch { return []; }
}

export async function GET(req: NextRequest) {
  // Rate limit
  const rl = await standardRateLimit()(req);
  if (rl) return rl as any;

  const { searchParams } = new URL(req.url);
  const baseRaw = String(searchParams.get('base') || '');
  const q = String(searchParams.get('q') || '');
  const base = normalizeBase(baseRaw);
  if (!base) return NextResponse.json({ error: 'Base URL inválida' }, { status: 400 });
  const tokens = tokenize(q);

  const candidates: Array<{ url: string; title?: string; score: number; verified?: boolean; confidence?: number }> = [];

  // 1) Tentar sitemaps
  const sitemapUrls = [`${base.origin}/sitemap.xml`, `${base.origin}/sitemap_index.xml`];
  for (const sm of sitemapUrls) {
    try {
      const xml = await fetchText(sm, 6000);
      if (!xml) continue;
      const urls = extractSitemapUrls(xml, base).slice(0, 300);
      for (const u of urls) {
        const pathScore = textScore(u, tokens);
        if (pathScore > 0 || tokens.length === 0) {
          // opcional: olhar para títulos apenas dos melhores candidatos para poupar pedidos
          candidates.push({ url: u, score: pathScore });
        }
      }
      if (candidates.length > 0) break;
    } catch {}
  }

  // 2) Fallback: homepage + links
  if (candidates.length === 0) {
    try {
      const homeHtml = await fetchHtml(base.origin, 6000);
      const links = extractLinks(base, homeHtml)
        .filter(u => !/sitemap/i.test(u))
        .filter(u => !/\.(xml|xsl|gz|pdf)$/i.test(u))
        .slice(0, 200);
      for (const u of links) {
        const sc = textScore(u, tokens);
        if (sc > 0) candidates.push({ url: u, score: sc });
      }
    } catch {}
  }

  // Heurística: priorizar páginas de produto/loja
  function productBoost(u: string): number {
    try {
      const url = new URL(u);
      const p = `${url.pathname}`.toLowerCase();
      let boost = 0;
      if (/(produto|produtos|product|products|loja|shop|categoria|categories|collection|collections|item|artigo)/i.test(p)) boost += 20;
      if (/\/produtos?\//i.test(p) || /\/product(s)?\//i.test(p)) boost += 15;
      if (/\bsku\b|\bid\b/.test(p)) boost += 5;
      // penalizar listagens genéricas
      if (/sitemap|\/page\//i.test(p)) boost -= 50;
      if (/\.(xml|xsl|gz)$/i.test(p)) boost -= 100;
      return boost;
    } catch { return 0; }
  }

  // 3) Enriquecer com títulos (apenas top por URL)
  candidates.sort((a, b) => b.score - a.score);
  const top = candidates.slice(0, 15);
  await Promise.all(top.map(async (c) => {
    try {
      const html = await fetchHtml(c.url, 5000);
      const title = extractTitle(html);
      if (title) c.title = title;
      // melhorar score com título
      c.score += title ? textScore(title, tokens) * 2 : 0;
      c.score += productBoost(c.url);
      // scoring semântico leve: frase exata, proximidade e título/path
      try {
        const body = (html || '').toLowerCase().slice(0, 25000);
        const urlPath = (() => { try { return new URL(c.url).pathname.toLowerCase(); } catch { return ''; } })();
        const qLower = q.toLowerCase();
        let semScore = 0;
        // frase exata
        if (qLower.length >= 3) {
          const safe = qLower.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          const re = new RegExp(safe, 'i');
          if (title && re.test(title.toLowerCase())) semScore += 40;
          if (re.test(urlPath)) semScore += 25;
          if (re.test(body)) semScore += 20;
        }
        // proximidade dos termos
        if (tokens.length >= 2) {
          const idxs: number[] = [];
          for (const tok of tokens) {
            const m = body.indexOf(tok);
            if (m >= 0) idxs.push(m);
          }
          if (idxs.length >= 2) {
            idxs.sort((a, b) => a - b);
            let minGap = Infinity;
            for (let i = 1; i < idxs.length; i++) minGap = Math.min(minGap, idxs[i] - idxs[i - 1]);
            if (minGap < 50) semScore += 20; else if (minGap < 120) semScore += 10;
          }
        }
        // presença no título/path
        for (const tok of tokens) {
          const re = new RegExp(tok.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
          if (title && re.test(title.toLowerCase())) semScore += 12;
          if (re.test(urlPath)) semScore += 8;
        }
        c.score += semScore;
      } catch {}
      // verificação efetiva (HEAD/GET)
      c.verified = await checkUrlOk(c.url, 5000);
      // confiança: proporção de tokens presentes no título+url+primeiros caracteres do body
      const unique = Array.from(new Set(tokens));
      const body = (html || '').toLowerCase().slice(0, 20000);
      const urlPath = (() => { try { return new URL(c.url).pathname.toLowerCase(); } catch { return ''; } })();
      let present = 0;
      for (const t of unique) {
        const safe = t.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const re = new RegExp(safe, 'i');
        if ((title && re.test(title)) || re.test(urlPath) || re.test(body)) present += 1;
      }
      c.confidence = unique.length > 0 ? present / unique.length : 1;
    } catch {}
  }));

  top.sort((a, b) => b.score - a.score);
  const uniqueByUrl = Array.from(new Map(top.map(t => [t.url, t])).values());
  // Filtrar por confiança mínima quando há termos (reduz falsos positivos)
  const MIN_CONFIDENCE = tokens.length > 0 ? 0.6 : 0;
  const filtered = uniqueByUrl.filter(r => (r.confidence ?? 0) >= MIN_CONFIDENCE);
  const results: SearchResult[] = (filtered.length > 0 ? filtered : uniqueByUrl)
    .slice(0, 5)
    .map(r => ({ url: r.url, title: r.title, score: r.score, verified: r.verified, confidence: r.confidence }));

  return NextResponse.json({ base: base.origin, q, results });
}


