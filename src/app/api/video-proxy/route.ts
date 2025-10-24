import { NextRequest } from 'next/server';
import { lenientRateLimit } from '@/middleware/rateLimitMiddleware';
import { simpleApiKeyAuth } from '@/middleware/simpleApiKeyMiddleware';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Lista de hosts permitidos para proxy
const ALLOWED_HOSTS = new Set(['visitfoods.pt', 'www.visitfoods.pt']);

// Lista de origens permitidas para CORS
const ALLOWED_ORIGINS = new Set([
  'https://virtualguide.info',
  'https://www.virtualguide.info',
  'https://visitfoods.pt',
  'https://www.visitfoods.pt'
]);

// Limite de taxa de requisições (em bytes por segundo)
const RATE_LIMIT = 5 * 1024 * 1024; // 5MB/s

export async function GET(req: NextRequest) {
  try {
    // Aplicar rate limiting mais permissivo para streaming de vídeo
    const rateLimitResult = await lenientRateLimit()(req);
    if (rateLimitResult) {
      return rateLimitResult;
    }
    
    // Verificar autenticação via API Key simples
    const authResult = await simpleApiKeyAuth()(req);
    if (authResult) {
      return authResult;
    }

    const urlParam = req.nextUrl.searchParams.get('url');
    if (!urlParam) {
      return new Response(JSON.stringify({ error: 'Parâmetro url é obrigatório' }), { status: 400 });
    }

    // Validar URL
    let target: URL;
    try {
      target = new URL(urlParam);
    } catch (e) {
      return new Response(JSON.stringify({ error: 'URL inválido' }), { status: 400 });
    }

    // Verificar se o host é permitido
    if (!ALLOWED_HOSTS.has(target.hostname)) {
      return new Response(JSON.stringify({ error: 'Host não permitido' }), { status: 403 });
    }

    // Verificar origem para CORS
    const origin = req.headers.get('origin') || '';
    const isAllowedOrigin = ALLOWED_ORIGINS.has(origin);

    // Propagar Range para suportar streaming
    const range = req.headers.get('range') ?? undefined;

    const upstream = await fetch(target.toString(), {
      headers: range ? { Range: range } : undefined,
      // Evita problemas de cache/proxy intermédio
      cache: 'no-store',
    });

    if (!upstream.ok && upstream.status !== 206) {
      const text = await upstream.text().catch(() => '');
      return new Response(JSON.stringify({ error: 'Falha ao obter vídeo', status: upstream.status, body: text.slice(0, 200) }), { status: 502 });
    }

    // Copiar headers importantes
    const headers = new Headers();
    const contentType = upstream.headers.get('content-type') || 'video/mp4';
    const contentLength = upstream.headers.get('content-length');
    const acceptRanges = upstream.headers.get('accept-ranges') || 'bytes';
    const contentRange = upstream.headers.get('content-range');

    headers.set('Content-Type', contentType);
    if (contentLength) headers.set('Content-Length', contentLength);
    if (acceptRanges) headers.set('Accept-Ranges', acceptRanges);
    if (contentRange) headers.set('Content-Range', contentRange);
    
    // Configurações de cache e segurança
    headers.set('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    headers.set('X-Content-Type-Options', 'nosniff');
    
    // CORS restrito a origens permitidas
    if (isAllowedOrigin) {
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
      headers.set('Access-Control-Max-Age', '86400');
    } else {
      // Se não for uma origem permitida, não adicionar cabeçalhos CORS
      console.warn(`Origem CORS não permitida: ${origin}`);
    }

    const status = upstream.status; // 200 ou 206

    return new Response(upstream.body, { status, headers });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: 'Erro no proxy de vídeo', message: error?.message }), { status: 500 });
  }
}
