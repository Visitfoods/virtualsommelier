import { NextRequest } from "next/server";
import { ask } from "@/lib/ai";
import { standardRateLimit } from "@/middleware/rateLimitMiddleware";
import { simpleApiKeyAuth } from "@/middleware/simpleApiKeyMiddleware";

export const runtime = "nodejs";

function normalizeTextForMatch(value: string): string {
  try {
    return String(value || "")
      .toLowerCase()
      .replace(/<[^>]+>/g, " ")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return String(value || "").toLowerCase();
  }
}

function isLikelyAnsweredInSystem(systemText?: string, question?: string): boolean {
  try {
    const sys = normalizeTextForMatch(systemText || "");
    const qn = normalizeTextForMatch(question || "");
    if (!sys || !qn) return false;
    if (qn.length >= 12 && sys.includes(qn)) return true; // correspondência exata longa

    const stop = new Set([
      "o","a","os","as","de","da","do","das","dos","um","uma","e","ou","em","para","por","no","na","nos","nas","com","que","qual","quais","como","quando","onde","porque","porquê","quanto","quanta","quantos","quantas"
    ]);
    const qTokens = qn.split(/\s+/).filter(t => t && !stop.has(t));
    const sTokens = new Set(sys.split(/\s+/).filter(Boolean));
    if (qTokens.length === 0) return false;
    const hits = qTokens.reduce((acc, t) => acc + (sTokens.has(t) ? 1 : 0), 0);
    const coverage = hits / qTokens.length;
    return coverage >= 0.6; // cobertura suficiente
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    // Rate limit
    const rl = await standardRateLimit()(req);
    if (rl) return rl as any;

    // Auth via API Key simples (server-side)
    const auth = await simpleApiKeyAuth()(req);
    if (auth) return auth as any;

    const { q, opts, website } = await req.json();
    // sanitizar/limitar histórico para evitar payloads gigantes
    const cleanOpts = { ...opts } as typeof opts & { history?: Array<{ role: string; content: string }> };
    if (Array.isArray(cleanOpts?.history)) {
      const MAX_ITEMS = 10;
      const MAX_CHARS = 1200;
      cleanOpts.history = cleanOpts.history.slice(-MAX_ITEMS).map((m: any) => ({
        role: m.role,
        content: String(m.content || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_CHARS),
      }));
    }
    // Enriquecer contexto com link de produto quando aplicável
    let enrichedSystem = cleanOpts?.system as string | undefined;
    const websiteUrl: string | undefined = typeof website === 'string' ? website : undefined;
    let allowedUrls: string[] = [];
    const userText = String(q || '').toLowerCase();
    const looksLikeProductIntent = /comprar|preço|preco|quanto custa|onde comprar|produto|encomendar|adquirir|buy|price|order/.test(userText);
    if (websiteUrl && looksLikeProductIntent) {
      try {
        const searchUrl = new URL(req.url);
        searchUrl.pathname = '/api/site-search';
        searchUrl.search = `base=${encodeURIComponent(websiteUrl)}&q=${encodeURIComponent(String(q || ''))}`;
        const resp = await fetch(searchUrl.toString(), { cache: 'no-store' });
        if (resp.ok) {
          const data = await resp.json();
          const pick = Array.isArray(data?.results)
            ? data.results.find((r: any) => r?.verified && (typeof r?.confidence === 'number' ? r.confidence >= 0.6 : true))
              || data.results.find((r: any) => (typeof r?.confidence === 'number' ? r.confidence >= 0.6 : false))
              || null
            : null;
          if (pick?.url) {
            const hint = `\n\nFonte recomendada para este produto: ${pick.url}`;
            const rule = `\n- Instrução: começa SEMPRE a resposta com essa URL exata numa linha isolada (sem texto antes), seguida da explicação em português de Portugal.`;
            enrichedSystem = (enrichedSystem || '').concat(hint).concat(rule);
          }
        }
      } catch {}
    }

    // Se houver websiteUrl mas sem intenção de produto, tenta enriquecer com excertos do scraper
    // MAS apenas se não parecer que a resposta já está presente no system prompt
    const systemHasAnswer = isLikelyAnsweredInSystem(String(cleanOpts?.system || enrichedSystem || ''), String(q || ''));
    const forceScrape = Boolean((opts as any)?.forceScrape === true);
    if (websiteUrl && !looksLikeProductIntent && !systemHasAnswer && !forceScrape) {
      try {
        const scrapeUrl = new URL(req.url);
        scrapeUrl.pathname = '/api/website-scraper';
        // Enviar API key (header + fallback query) para passar no simpleApiKeyAuth
        const apiKey = process.env.SIMPLE_API_KEY || process.env.NEXT_PUBLIC_API_KEY;
        if (apiKey) {
          try { scrapeUrl.searchParams.set('apiKey', apiKey); } catch {}
        }
        const resp = await fetch(scrapeUrl.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { 'x-api-key': apiKey } : {})
          },
          cache: 'no-store',
          body: JSON.stringify({ websiteUrl, maxPages: 30, maxDepth: 2 })
        });
        if (resp.ok) {
          const data = await resp.json();
          const pages: Array<{ url: string; title?: string; text?: string; kind?: string }> = Array.isArray(data?.pages) ? data.pages : [];
          // whitelist de URLs permitidas (inclui home)
          try {
            const base = new URL(websiteUrl);
            const baseOrigin = base.origin;
            const list = new Set<string>([baseOrigin]);
            for (const p of pages) {
              try { const u = new URL(p.url); if (u.origin === baseOrigin) list.add(u.href.split('#')[0]); } catch {}
            }
            // limitar tamanho para não poluir o prompt
            allowedUrls = Array.from(list).slice(0, 60);
            const allowListForPrompt = allowedUrls.slice(0, 40).join('\n');
            const guardrails = `\n\nREGRAS DE LINKS (OBRIGATÓRIO):\n- Não inventes links.\n- Só podes incluir URLs do domínio ${baseOrigin}.\n- Preferencialmente usa apenas estas URLs (whitelist):\n${allowListForPrompt}\n- Se não tiveres um URL exatamente aplicável, responde sem link.`;
            enrichedSystem = (enrichedSystem || '').concat(guardrails);
          } catch {}
          // selecionar páginas mais relevantes para a query do utilizador (scoring semântico leve)
          const qLower = String(q || '').toLowerCase();
          const tokens = qLower.split(/\s+/).filter(Boolean);
          const scored = pages.map(p => {
            const title = (p.title || '').toLowerCase();
            const body = (p.text || '').toLowerCase();
            let score = 0;
            // frase exata
            if (qLower.length >= 3 && (title.includes(qLower) || body.includes(qLower))) score += 20;
            // proximidade aproximada (usar primeiras ocorrências)
            if (tokens.length >= 2) {
              const idxs: number[] = [];
              for (const tok of tokens) { const i = body.indexOf(tok); if (i >= 0) idxs.push(i); }
              if (idxs.length >= 2) { idxs.sort((a,b)=>a-b); const minGap = idxs.slice(1).reduce((m, v, i)=>Math.min(m, v-idxs[i]), Infinity); if (minGap < 50) score += 10; else if (minGap < 120) score += 5; }
            }
            // presença no título
            for (const tok of tokens) if (title.includes(tok)) score += 4;
            // bónus se classificado como produto
            if (p.kind === 'product') score += 3;
            return { p, score };
          }).sort((a, b) => b.score - a.score).slice(0, 5);
          if (scored.length > 0) {
            const snippet = scored.map(({ p }) => `- ${p.title || p.url}\n${(p.text || '').slice(0, 600)}`).join('\n\n');
            const scrapeCtx = `\n\nContexto do website (excertos):\n${snippet}`;
            enrichedSystem = (enrichedSystem || '').concat(scrapeCtx);
          }
        }
      } catch {}
    }

    const r = await ask(String(q || ""), { ...cleanOpts, system: enrichedSystem });

    // Verificar rapidamente se uma URL responde 200 e é HTML
    async function isUrlReachableHtml(u: string): Promise<boolean> {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 3500);
        try {
          const resHead = await fetch(u, { method: 'HEAD', cache: 'no-store', redirect: 'follow', signal: ctrl.signal });
          const ctHead = resHead.headers.get('content-type') || '';
          if (resHead.ok && /text\/html/i.test(ctHead)) { clearTimeout(t); return true; }
        } catch {}
        const res = await fetch(u, { method: 'GET', cache: 'no-store', redirect: 'follow', signal: ctrl.signal });
        const ct = res.headers.get('content-type') || '';
        const html = /text\/html/i.test(ct) ? await res.text() : '';
        const lower = html.toLowerCase();
        const looks404 = (!res.ok) || /\b404\b/.test(lower) || /p[áa]gina n[ãa]o encontrada/.test(lower) || /page not found/.test(lower) || /not found/.test(lower) || /p[áa]gina inexistente/.test(lower);
        clearTimeout(t);
        return res.ok && /text\/html/i.test(ct) && !looks404;
      } catch { return false; }
    }

    // Pós-processamento: remover links que não pertençam ao domínio permitido
    async function sanitizeLinks(text: string, base?: string, whitelist?: string[]): Promise<string> {
      try {
        if (!text) return text;
        const urls = (text.match(/https?:\/\/[^\s<>")']+/gim) || []).map(u => u.trim());
        if (urls.length === 0) return text;
        const baseHost = (() => { try { return base ? new URL(base).host : undefined; } catch { return undefined; } })();
        const allow = new Set<string>((whitelist || []).map(u => u.split('#')[0]));
        // Permitir domínios externos seguros e comuns (ex.: Google Maps)
        const allowedExternalHosts = [
          'google.com', 'www.google.com', 'maps.google.com', 'maps.app.goo.gl', 'goo.gl',
          'youtu.be', 'www.youtube.com', 'youtube.com',
          'wa.me', 'api.whatsapp.com'
        ];
        let out = text;
        // verificar URLs em paralelo com limite simples
        const checks = await Promise.all(urls.map(async (u) => {
          try {
            const parsed = new URL(u);
            const sameDomain = baseHost ? (parsed.host === baseHost) : false;
            const host = parsed.host.toLowerCase();
            const isAllowedExternal = allowedExternalHosts.some(h => host === h || host.endsWith('.' + h));
            const inWhitelist = allow.size > 0 ? allow.has(parsed.href.split('#')[0]) : (sameDomain || isAllowedExternal);
            if (!inWhitelist) {
              const reachable = await isUrlReachableHtml(u);
              return { u, keep: reachable && (sameDomain || isAllowedExternal) };
            }
            return { u, keep: true };
          } catch { return { u, keep: false }; }
        }));
        for (const { u, keep } of checks) {
          if (!keep) {
            const re = new RegExp(u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            out = out.replace(re, '').replace(/\s{2,}/g, ' ').trim();
          }
        }
        return out;
      } catch { return text; }
    }

    const safeText = await sanitizeLinks(String((r as any).text || ''), websiteUrl, allowedUrls);
    const safeResponse = { ...r, text: safeText } as typeof r;
    // incluir responseId quando disponível no futuro (SDK streaming); por agora devolvemos o texto e modelo
    return Response.json(safeResponse);
  } catch (err) {
    console.error("/api/ask error:", err);
    const message = err instanceof Error ? err.message : "Erro interno";
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}


