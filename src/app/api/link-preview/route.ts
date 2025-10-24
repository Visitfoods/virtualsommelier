import { NextRequest } from 'next/server';
import { LRUCache } from 'lru-cache';

type PreviewData = {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
};

const cache = new LRUCache<string, PreviewData>({
  max: 200,
  ttl: 1000 * 60 * 60, // 1h
});

function toAbsoluteUrl(possibleUrl: string, baseUrl: string): string | undefined {
  try {
    const absolute = new URL(possibleUrl, baseUrl);
    return absolute.href;
  } catch {
    return undefined;
  }
}

function extractMeta(html: string, pageUrl: string): PreviewData {
  const getMeta = (regex: RegExp) => {
    const match = html.match(regex);
    return match?.[1]?.trim();
  };

  // Decodifica entidades HTML comuns, incluindo numéricas (decimais e hexadecimais)
  function decodeHtmlEntities(input?: string): string | undefined {
    if (!input) return input;
    try {
      let s = input;
      // Numéricas hex: &#xE1;
      s = s.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
        const cp = parseInt(hex, 16);
        if (Number.isNaN(cp)) return _;
        try { return String.fromCodePoint(cp); } catch { return _; }
      });
      // Numéricas decimais: &#225;
      s = s.replace(/&#(\d+);/g, (_, dec) => {
        const cp = parseInt(dec, 10);
        if (Number.isNaN(cp)) return _;
        try { return String.fromCodePoint(cp); } catch { return _; }
      });
      // Nomeadas comuns
      s = s
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
      // Normalizar espaços
      s = s.replace(/[\s\u00A0]+/g, ' ').trim();
      return s;
    } catch {
      return input;
    }
  }

  const ogTitle = getMeta(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i)
    || getMeta(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:title["'][^>]*>/i);
  const ogDesc = getMeta(/<meta[^>]+property=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/i)
    || getMeta(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:description["'][^>]*>/i);
  const ogImage = getMeta(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i)
    || getMeta(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["'][^>]*>/i);
  const ogSite = getMeta(/<meta[^>]+property=["']og:site_name["'][^>]*content=["']([^"']+)["'][^>]*>/i);

  const stdDesc = getMeta(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i)
    || getMeta(/<meta[^>]+content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/i);
  const titleTag = getMeta(/<title[^>]*>([^<]+)<\/title>/i);

  let imageAbs = ogImage ? toAbsoluteUrl(ogImage, pageUrl) : undefined;
  if (!imageAbs) {
    const firstImg = getMeta(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
    if (firstImg) imageAbs = toAbsoluteUrl(firstImg, pageUrl);
  }
  
  // Verificar se a imagem é do domínio correto (não virtualguide)
  if (imageAbs) {
    try {
      const imageUrl = new URL(imageAbs);
      const pageUrlObj = new URL(pageUrl);
      // Se a imagem é do virtualguide mas a página não é, usar fallback
      if (imageUrl.hostname.includes('virtualguide') && !pageUrlObj.hostname.includes('virtualguide')) {
        imageAbs = undefined; // Forçar fallback para Google
      }
    } catch {
      // Se não conseguir fazer parse, manter como está
    }
  }
  
  // Se não encontrou imagem, tentar usar Google Images como fallback
  if (!imageAbs) {
    try {
      const hostname = new URL(pageUrl).hostname;
      imageAbs = `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
    } catch {
      // Ignorar se não conseguir extrair hostname
    }
  }

  return {
    url: pageUrl,
    title: decodeHtmlEntities(ogTitle || titleTag),
    description: decodeHtmlEntities(ogDesc || stdDesc),
    image: imageAbs,
    siteName: decodeHtmlEntities(ogSite),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const target = searchParams.get('url');
  const includeText = searchParams.get('includeText') === '1' || searchParams.get('include_text') === '1';
  if (!target) {
    return new Response(JSON.stringify({ error: 'Missing url param' }), { status: 400 });
  }

  try {
    const urlObject = new URL(target);
    const normalized = urlObject.href;

    const cached = cache.get(normalized);
    if (cached) {
      return new Response(JSON.stringify(cached), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
      });
    }

    const res = await fetch(normalized, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VirtualGuideBot/1.0; +https://virtualguide.info)'
      },
      cache: 'no-store',
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      const minimal: PreviewData = { url: normalized, title: urlObject.hostname };
      cache.set(normalized, minimal);
      return new Response(JSON.stringify(minimal), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    const html = await res.text();
    const data = extractMeta(html, normalized) as any;

    if (includeText) {
      const text = extractReadableText(html);
      // Limitar para evitar payloads gigantes
      data.text = text.length > 6000 ? text.slice(0, 6000) : text;
    }

    cache.set(normalized, data);
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
    });
  } catch (e) {
    const fallback: any = { url: target, title: undefined, description: undefined, image: undefined };
    if (includeText) fallback.text = '';
    return new Response(JSON.stringify(fallback), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
}

// Extrai texto legível básico do HTML (sem dependências externas)
function extractReadableText(html: string): string {
  try {
    let s = html || '';
    // Remover scripts, styles, noscript e comentários
    s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ');
    s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ');
    s = s.replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
    s = s.replace(/<!--([\s\S]*?)-->/g, ' ');
    // Substituir quebras de bloco por nova linha
    s = s.replace(/<(?:p|br|div|section|article|li|h[1-6])\b[^>]*>/gi, '\n');
    // Remover todas as restantes tags
    s = s.replace(/<[^>]+>/g, ' ');
    // Decodificar entidades HTML básicas
    s = s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    // Normalizar espaços e linhas
    s = s.replace(/\r\n|\r/g, '\n');
    s = s.replace(/\n{3,}/g, '\n\n');
    s = s.replace(/[\t ]{2,}/g, ' ');
    return s.trim();
  } catch {
    return '';
  }
}


