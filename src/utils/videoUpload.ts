// Interface para o progresso do upload
import { getAuthHeaders } from '@/services/apiKeyService';

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

/**
 * Faz upload direto de um vídeo para o servidor
 * @param file O arquivo de vídeo a ser enviado
 * @param guideSlug O slug do guia
 * @param fileType O tipo do arquivo ('background' ou 'welcome')
 * @param onProgress Callback para atualizar o progresso do upload
 * @returns Uma promessa com a URL do vídeo no servidor
 */
export async function uploadVideoDirect(
  file: File,
  guideSlug: string,
  fileType: 'background' | 'welcome' | 'mobileTabletBackground',
  onProgress?: (progress: UploadProgress) => void
): Promise<string> {
  // Novo fluxo: 1) pedir URL de direct upload ao nosso endpoint, 2) enviar o ficheiro diretamente para a Cloudflare
  const CREATE_ENDPOINT = '/api/cloudflare-direct-upload';
  const uploadMeta = {
    fileName: `${fileType}_${Date.now()}_${file.name || 'video'}`,
    mimeType: file.type,
    requireSignedURLs: false,
    allowedOrigins: [],
    metadata: { guideSlug, fileType },
  };

  const authHeaders = getAuthHeaders();

  const createRes = await fetch(CREATE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify(uploadMeta),
  });
  if (!createRes.ok) {
    const text = await createRes.text().catch(() => '');
    throw new Error(`Falha a criar direct upload (${createRes.status}): ${text.slice(0, 200)}`);
  }
  const createJson = await createRes.json();
  const uploadURL = createJson?.uploadURL as string | undefined;
  const uid = createJson?.uid as string | undefined;
  if (!uploadURL || !uid) throw new Error('Servidor não devolveu uploadURL/uid');

  // 2) enviar o ficheiro diretamente para o uploadURL (Cloudflare)
  await new Promise<void>((resolve, reject) => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', uploadURL, true);
      // Não adicionar cabeçalhos custom; Cloudflare espera multipart simples

      xhr.upload.onprogress = (evt) => {
        if (!onProgress) return;
        const total = evt.lengthComputable ? evt.total : file.size;
        const loaded = evt.loaded;
        const percentage = Math.min(100, Math.round((loaded / total) * 100));
        onProgress({ loaded, total, percentage });
      };

      xhr.onerror = () => reject(new Error('Erro de rede durante o upload para a Cloudflare'));

      xhr.onreadystatechange = () => {
        if (xhr.readyState !== XMLHttpRequest.DONE) return;
        const status = xhr.status;
        if (status >= 200 && status < 300) {
          if (onProgress) onProgress({ loaded: file.size, total: file.size, percentage: 100 });
          resolve();
        } else {
          const text = xhr.responseText || '';
          reject(new Error(`Upload para Cloudflare falhou: HTTP ${status} ${text.slice(0, 200)}`));
        }
      };

      const formData = new FormData();
      formData.append('file', file);
      xhr.send(formData);
    } catch (err) {
      reject(err instanceof Error ? err : new Error('Erro desconhecido'));
    }
  });

  // Reutilizar iframe link como "path" compatível
  return `https://iframe.videodelivery.net/${uid}`;
}

/**
 * Função de upload de vídeo compatível com a API original
 * Esta função usa o método de upload direto
 */
export async function uploadVideo(
  file: File,
  guideSlug: string,
  fileType: 'background' | 'welcome' | 'mobileTabletBackground',
  onProgress?: (progress: UploadProgress) => void
): Promise<{ path: string; fileName: string }> {
  try {
    // Usar o método de upload direto
    const path = await uploadVideoDirect(file, guideSlug, fileType, onProgress);
    
    // Extrair o nome do arquivo da URL
    const fileName = path.split('/').pop() || '';
    
    return { path, fileName };
  } catch (error) {
    console.error('Erro no upload de vídeo:', error);
    throw error;
  }
}

/**
 * Upload de vídeo com seleção de provider (Cloudflare ou Bunny Stream)
 * @param file O arquivo de vídeo a ser enviado
 * @param guideSlug O slug do guia
 * @param fileType O tipo do arquivo ('background', 'welcome' ou 'mobileTabletBackground')
 * @param provider O provider de vídeo ('cloudflare' ou 'bunny')
 * @param onProgress Callback para atualizar o progresso do upload
 * @returns Uma promessa com o caminho e nome do arquivo
 */
export async function uploadVideoWithProvider(
  file: File,
  guideSlug: string,
  fileType: 'background' | 'welcome' | 'mobileTabletBackground',
  provider: 'cloudflare' | 'bunny',
  onProgress?: (progress: UploadProgress) => void
): Promise<{ path: string; fileName: string }> {
  try {
    let path: string;
    let fileName: string;
    
    if (provider === 'bunny') {
      // Importar dinamicamente a função do Bunny Stream
      const { uploadVideoToBunnyStreamDirect } = await import('./bunnyStreamVideoUpload');
      
      // Upload para Bunny Stream
      path = await uploadVideoToBunnyStreamDirect(file, guideSlug, {
        onProgress: onProgress ? (progress) => {
          onProgress({
            loaded: progress.loaded,
            total: progress.total,
            percentage: progress.percentage
          });
        } : undefined
      });
      
      // Para Bunny Stream, extrair o videoId da URL
      // Dois formatos possíveis:
      // 1. CDN: https://vz-42532543-0c8.b-cdn.net/{videoId}/play_720p.mp4 (ou playlist.m3u8)
      // 2. Embed (fallback): https://iframe.mediadelivery.net/embed/{libraryId}/{videoId}?autoplay=...
      
      if (path.includes('iframe.mediadelivery.net/embed/')) {
        // Formato embed: extrair videoId do último segmento (remover query string)
        const urlParts = path.split('?')[0].split('/'); // Remover query primeiro
        fileName = urlParts[urlParts.length - 1] || '';
        console.log('🆔 [UPLOAD] videoId extraído de URL embed:', fileName);
      } else if (path.includes('b-cdn.net')) {
        // Formato CDN: videoId é o segmento antes de /play_ ou /playlist
        const urlParts = path.split('/');
        // Procurar o segmento que vem antes de play_ ou playlist
        const playIndex = urlParts.findIndex(part => part.startsWith('play_') || part.startsWith('playlist'));
        if (playIndex > 0) {
          fileName = urlParts[playIndex - 1] || '';
        } else {
          // Fallback: penúltimo elemento
          fileName = urlParts[urlParts.length - 2] || '';
        }
        console.log('🆔 [UPLOAD] videoId extraído de URL CDN:', fileName);
      } else {
        // Formato desconhecido, tentar extrair penúltimo elemento
        const urlParts = path.split('/');
        fileName = urlParts[urlParts.length - 2] || '';
        console.warn('⚠️ [UPLOAD] Formato de URL desconhecido, usando fallback:', fileName);
      }
      
      console.log('🔗 [UPLOAD] path completo:', path);
      console.log('✅ [UPLOAD] fileName final para Firebase:', fileName);
    } else {
      // Upload para Cloudflare Stream (padrão)
      path = await uploadVideoDirect(file, guideSlug, fileType, onProgress);
      // Para Cloudflare, extrair o uid da URL
      fileName = path.split('/').pop() || '';
    }
    
    return { path, fileName };
  } catch (error) {
    console.error(`Erro no upload de vídeo para ${provider}:`, error);
    throw error;
  }
}