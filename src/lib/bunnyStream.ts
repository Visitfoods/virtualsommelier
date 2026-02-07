// Bunny Stream - Configuração e funções auxiliares

interface BunnyStreamConfig {
  apiKey: string;
  libraryId: string;
  region?: string;
  cdnUrl?: string;
}

/**
 * Obtém a configuração do Bunny Stream a partir das variáveis de ambiente
 */
export function getBunnyStreamConfig(): BunnyStreamConfig {
  const apiKey = process.env.BUNNY_STREAM_API_KEY || '';
  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID || '';
  const region = process.env.BUNNY_STREAM_REGION || '';
  const cdnUrl = process.env.BUNNY_STREAM_CDN_URL || '';
  
  if (!apiKey || !libraryId) {
    throw new Error('Bunny Stream: Configuração incompleta. Verifique BUNNY_STREAM_API_KEY e BUNNY_STREAM_LIBRARY_ID nas variáveis de ambiente.');
  }
  
  return {
    apiKey,
    libraryId,
    region,
    cdnUrl
  };
}

/**
 * Verifica se a configuração do Bunny Stream está completa
 */
export function isBunnyStreamConfigured(): boolean {
  try {
    getBunnyStreamConfig();
    return true;
  } catch {
    return false;
  }
}

/**
 * Constrói o URL da API do Bunny Stream para upload
 * https://docs.bunny.net/reference/video_createvideo
 */
export function getBunnyStreamApiUrl(libraryId: string, videoId?: string): string {
  const baseUrl = 'https://video.bunnycdn.com/library';
  
  if (videoId) {
    return `${baseUrl}/${libraryId}/videos/${videoId}`;
  }
  
  return `${baseUrl}/${libraryId}/videos`;
}

/**
 * Cria os headers para autenticação na API do Bunny Stream
 */
export function getBunnyStreamHeaders(apiKey: string): Record<string, string> {
  return {
    'AccessKey': apiKey,
    'Accept': 'application/json'
  };
}

/**
 * Cria um novo vídeo na biblioteca do Bunny Stream
 * Retorna o videoId e o URL para upload direto
 */
export async function createBunnyStreamVideo(
  title: string,
  collectionId?: string
): Promise<{ videoId: string; uploadUrl: string }> {
  const config = getBunnyStreamConfig();
  const apiUrl = getBunnyStreamApiUrl(config.libraryId);
  
  const body: Record<string, any> = {
    title
  };
  
  if (collectionId) {
    body.collectionId = collectionId;
  }
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      ...getBunnyStreamHeaders(config.apiKey),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Bunny Stream: Falha ao criar vídeo (${response.status}): ${errorText.slice(0, 200)}`);
  }
  
  const data = await response.json();
  
  if (!data.guid) {
    throw new Error('Bunny Stream: Resposta não contém videoId (guid)');
  }
  
  // Construir URL de upload direto
  // https://docs.bunny.net/reference/video_uploadvideo
  const uploadUrl = `${getBunnyStreamApiUrl(config.libraryId, data.guid)}`;
  
  return {
    videoId: data.guid,
    uploadUrl
  };
}

/**
 * Obtém informações sobre um vídeo do Bunny Stream
 */
export async function getBunnyStreamVideoInfo(videoId: string) {
  const config = getBunnyStreamConfig();
  const apiUrl = getBunnyStreamApiUrl(config.libraryId, videoId);
  
  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: getBunnyStreamHeaders(config.apiKey)
  });
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Bunny Stream: Falha ao obter info do vídeo (${response.status}): ${errorText.slice(0, 200)}`);
  }
  
  return await response.json();
}

/**
 * Verifica se um vídeo está pronto para reprodução
 * Status possíveis: 0=Created, 1=Uploaded, 2=Processing, 3=Transcoding, 4=Finished
 */
export async function isVideoReady(videoId: string): Promise<boolean> {
  try {
    const info = await getBunnyStreamVideoInfo(videoId);
    // Status 4 = Finished (pronto para reprodução)
    return info.status === 4;
  } catch {
    return false;
  }
}

/**
 * Constrói a URL pública do vídeo para reprodução
 */
export function getBunnyStreamVideoUrl(videoId: string, libraryId?: string): string {
  const lib = libraryId || getBunnyStreamConfig().libraryId;
  
  // URL do player Bunny Stream com parâmetros para evitar bloqueios
  // SEMPRE usar /embed/ para iframes, NUNCA /play/
  return `https://iframe.mediadelivery.net/embed/${lib}/${videoId}?autoplay=false&preload=true`;
}

/**
 * Constrói a URL direta do vídeo (playlist HLS)
 * NOTA: Substitui o hostname CDN pelo correto da tua biblioteca Bunny Stream
 */
export function getBunnyStreamDirectVideoUrl(videoId: string, libraryId?: string): string {
  // CDN hostname da biblioteca Bunny Stream
  const cdnHostname = 'vz-42532543-0c8.b-cdn.net';
  return `https://${cdnHostname}/${videoId}/playlist.m3u8`;
}

/**
 * Deteta a qualidade da conexão do utilizador
 * Retorna uma resolução adequada baseada na velocidade/tipo de conexão
 */
export function getOptimalResolutionForConnection(): 240 | 360 | 480 | 720 | 1080 {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 480; // Default para SSR
  }

  try {
    // 1. Network Information API (Chrome, Edge, Opera)
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    
    if (connection) {
      const effectiveType = connection.effectiveType; // '4g', '3g', '2g', 'slow-2g'
      const downlink = connection.downlink; // Mbps estimado
      const saveData = connection.saveData; // User ativou modo economizar dados

      // Modo economizar dados: usar resolução mais baixa
      if (saveData) {
        return 360;
      }

      // Baseado no tipo de conexão
      if (effectiveType === '4g' && (!downlink || downlink > 5)) {
        return 720; // Boa conexão 4G
      } else if (effectiveType === '4g' || (downlink && downlink > 2)) {
        return 480; // 4G mais lento ou 3G rápido
      } else if (effectiveType === '3g' || (downlink && downlink > 0.5)) {
        return 360; // 3G
      } else {
        return 240; // 2G ou muito lento
      }
    }

    // 2. Fallback: verificar se está em modo offline
    if (!navigator.onLine) {
      return 240;
    }

    // 3. Fallback padrão: resolução média para compatibilidade
    return 480;
  } catch (error) {
    console.warn('Erro ao detectar qualidade de conexão:', error);
    return 480; // Fallback seguro
  }
}

/**
 * Constrói a URL MP4 direta para usar com <video> HTML5
 * Requer ter o MP4 fallback ativo na biblioteca Bunny Stream.
 * NOTA: Substitui o hostname CDN pelo correto da tua biblioteca
 */
export function getBunnyStreamMp4Url(
  videoId: string,
  libraryId?: string,
  height: 240 | 360 | 480 | 720 | 1080 = 720
): string {
  // CDN hostname da biblioteca Bunny Stream
  const cdnHostname = 'vz-42532543-0c8.b-cdn.net';
  return `https://${cdnHostname}/${videoId}/play_${height}p.mp4`;
}

/**
 * Versão "inteligente" que escolhe automaticamente a melhor resolução
 * baseada na qualidade da conexão do utilizador
 */
export function getBunnyStreamMp4UrlSmart(
  videoId: string,
  libraryId?: string
): string {
  const optimalResolution = getOptimalResolutionForConnection();
  return getBunnyStreamMp4Url(videoId, libraryId, optimalResolution);
}

/**
 * Detecta a melhor resolução disponível para um vídeo
 * Tenta obter informações do vídeo e retorna a resolução mais alta disponível
 */
export async function getBestAvailableResolution(videoId: string): Promise<240 | 360 | 480 | 720 | 1080> {
  try {
    const videoInfo = await getBunnyStreamVideoInfo(videoId);
    const cdnHostname = 'vz-42532543-0c8.b-cdn.net';
    const orderedResolutions: Array<240 | 360 | 480 | 720 | 1080> = [1080, 720, 480, 360, 240];

    // Helper para testar se o MP4 daquela resolução existe mesmo
    const hasMp4For = async (res: 240 | 360 | 480 | 720 | 1080): Promise<boolean> => {
      const testUrl = `https://${cdnHostname}/${videoId}/play_${res}p.mp4`;
      try {
        const response = await fetch(testUrl, { method: 'HEAD' });
        return response.ok;
      } catch {
        return false;
      }
    };

    // 1) Tentar usar availableResolutions como pista, mas sempre validando o MP4 com HEAD
    if (videoInfo.availableResolutions) {
      const parsed = (videoInfo.availableResolutions as string)
        .split(',')
        .map((r: string) => {
        const match = r.match(/(\d+)p/);
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter((r: number) => orderedResolutions.includes(r as any)) as Array<240 | 360 | 480 | 720 | 1080>;

      // Ordenar por resolução descrescente e testar MP4
      const unique = Array.from(new Set(parsed)).sort((a, b) => b - a) as Array<240 | 360 | 480 | 720 | 1080>;
      for (const res of unique) {
        if (await hasMp4For(res)) {
          return res;
        }
      }
    }
    
    // 2) Se tiver height, usar isso como ponto de partida, mas também validando MP4
    if (videoInfo.height) {
      const height = parseInt(videoInfo.height, 10);
      let candidate: 240 | 360 | 480 | 720 | 1080 = 240;
      if (height >= 1080) candidate = 1080;
      else if (height >= 720) candidate = 720;
      else if (height >= 480) candidate = 480;
      else if (height >= 360) candidate = 360;

      // Tentar a partir da resolução candidata e ir descendo
      const startIndex = Math.max(0, orderedResolutions.indexOf(candidate));
      for (let i = startIndex; i < orderedResolutions.length; i++) {
        const res = orderedResolutions[i];
        if (await hasMp4For(res)) {
          return res;
        }
      }
    }

    // 3) Fallback geral: tentar a lista completa por ordem decrescente
    for (const res of orderedResolutions) {
      if (await hasMp4For(res)) {
        return res;
      }
    }
    
    // 4) Se nada funcionar, voltar a 720p por convenção
    return 720;
  } catch (error) {
    console.error('Erro ao detectar resolução:', error);
    // Default: 720p
    return 720;
  }
}

/**
 * Obtém a URL MP4 com a melhor resolução disponível
 */
export async function getBunnyStreamMp4UrlAuto(videoId: string, libraryId?: string): Promise<string> {
  const resolution = await getBestAvailableResolution(videoId);
  return getBunnyStreamMp4Url(videoId, libraryId, resolution);
}

/**
 * Constrói a URL de reprodução simples (player HTML da Bunny)
 * Útil se quisermos abrir o player completo em nova aba.
 */
export function getBunnyStreamPlayUrl(videoId: string, libraryId?: string): string {
  const lib = libraryId || getBunnyStreamConfig().libraryId;
  return `https://video.bunnycdn.com/play/${lib}/${videoId}`;
}
