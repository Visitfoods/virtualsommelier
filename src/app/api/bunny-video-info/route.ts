import { NextRequest, NextResponse } from 'next/server';
import {
  getBunnyStreamVideoInfo,
  getBestAvailableResolution,
  getBunnyStreamMp4Url,
  getBunnyStreamDirectVideoUrl,
} from '@/lib/bunnyStream';

/**
 * API para obter informações do vídeo e URL com resolução correta
 * 
 * Chamada após o upload para obter a URL MP4 com a resolução real disponível
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { videoId, libraryId } = body;
    
    if (!videoId) {
      return NextResponse.json(
        { error: 'videoId não fornecido' },
        { status: 400 }
      );
    }
    
    console.log(`🔍 A obter informações do vídeo: ${videoId}`);
    
    // Obter informações do vídeo
    const videoInfo = await getBunnyStreamVideoInfo(videoId);
    console.log(`📊 Status do vídeo no Bunny:`, {
      videoId,
      status: videoInfo.status,
      statusText: videoInfo.status === 0 ? 'Created' : 
                  videoInfo.status === 1 ? 'Uploaded' : 
                  videoInfo.status === 2 ? 'Processing' : 
                  videoInfo.status === 3 ? 'Transcoding' : 
                  videoInfo.status === 4 ? 'Finished' : 'Unknown',
      availableResolutions: videoInfo.availableResolutions,
      hasMP4Fallback: videoInfo.hasMP4Fallback,
      encodeProgress: videoInfo.encodeProgress
    });
    
    // Detectar melhor resolução disponível (para MP4)
    const resolution = await getBestAvailableResolution(videoId);
    
    // Construir URL MP4 com a resolução correta
    let mp4Url = getBunnyStreamMp4Url(videoId, libraryId, resolution);
    
    // Validar no servidor se o MP4 está realmente acessível.
    // Se não estiver (403/404/etc), fazer fallback para playlist HLS (.m3u8),
    // que é a forma oficialmente suportada pelo Bunny para streaming adaptativo.
    try {
      const headResponse = await fetch(mp4Url, { method: 'HEAD' });
      if (!headResponse.ok) {
        console.warn(
          `⚠️ MP4 ${resolution}p não acessível (${headResponse.status}). ` +
          `A fazer fallback para playlist HLS (playlist.m3u8).`,
        );
        mp4Url = getBunnyStreamDirectVideoUrl(videoId, libraryId);
      }
    } catch (err) {
      console.error('❌ Erro ao validar MP4 direto, a fazer fallback para HLS:', err);
      mp4Url = getBunnyStreamDirectVideoUrl(videoId, libraryId);
    }
    
    console.log(`✅ Vídeo info obtida. Resolução alvo: ${resolution}p`);
    console.log(`🎬 URL selecionada para frontoffice: ${mp4Url}`);
    
    return NextResponse.json({ 
      success: true,
      videoInfo,
      resolution,
      mp4Url,
      videoId,
      libraryId
    });
    
  } catch (error) {
    console.error('❌ Erro ao obter informações do vídeo:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao obter informações do vídeo',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}
