import { NextRequest } from 'next/server';
import { requestCloudflareMp4Download } from '@/lib/cloudflareStream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Hosts permitidos para evitar uso abusivo do proxy
const ALLOWED_HOSTS = new Set(['visitfoods.pt', 'www.visitfoods.pt', 'videodelivery.net']);

function extractCloudflareUid(u: URL): string | null {
  // Matches both /{uid}/downloads/default.mp4 and /{uid}/manifest/video.m3u8
  const m1 = u.pathname.match(/^\/([a-zA-Z0-9_-]{10,})\//);
  return m1 && m1[1] ? m1[1] : null;
}

export async function GET(req: NextRequest) {
  try {
    const urlParam = req.nextUrl.searchParams.get('url');
    if (!urlParam) {
      return new Response(JSON.stringify({ error: 'Parâmetro url é obrigatório' }), { status: 400 });
    }

    const target = new URL(urlParam);
    if (!ALLOWED_HOSTS.has(target.hostname)) {
      return new Response(JSON.stringify({ error: 'Host não permitido' }), { status: 400 });
    }

    // Se for Cloudflare, tentar garantir que o MP4 está disponível
    if (target.hostname === 'videodelivery.net') {
      const uid = extractCloudflareUid(target);
      if (uid) {
        // Best-effort: pedir geração do MP4 se ainda não existir
        try { 
          console.log(`🎬 Tentando gerar MP4 para UID: ${uid}`);
          await requestCloudflareMp4Download(uid); 
          console.log(`✅ MP4 gerado para UID: ${uid}`);
        } catch (error) {
          console.warn(`⚠️ Falha ao gerar MP4 para UID ${uid}:`, error);
        }
      }
    }

    // Obter o ficheiro remoto
    console.log(`🎬 Tentando obter vídeo de: ${target.toString()}`);
    const upstream = await fetch(target.toString(), { cache: 'no-store' });
    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      console.error(`❌ Falha ao obter vídeo: ${upstream.status} - ${text.slice(0, 200)}`);
      return new Response(JSON.stringify({ 
        error: 'Falha ao obter vídeo', 
        status: upstream.status, 
        body: text.slice(0, 200),
        url: target.toString()
      }), { status: 502 });
    }
    console.log(`✅ Vídeo obtido com sucesso: ${upstream.status}`);

    // Preparar headers para forçar download
    const headers = new Headers();
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const contentLength = upstream.headers.get('content-length');

    headers.set('Content-Type', contentType);
    if (contentLength) headers.set('Content-Length', contentLength);
    headers.set('Cache-Control', 'no-store');
    headers.set('Access-Control-Allow-Origin', '*');

    // Gerar um nome de ficheiro
    const fileNameFromUrl = decodeURIComponent(target.pathname.split('/').pop() || 'video.mp4');
    headers.set('Content-Disposition', `attachment; filename="${fileNameFromUrl}"`);

    return new Response(upstream.body, { status: 200, headers });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: 'Erro no download de vídeo', message: error?.message }), { status: 500 });
  }
}


