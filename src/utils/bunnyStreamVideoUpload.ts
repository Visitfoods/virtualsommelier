export interface VideoUploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface VideoUploadOptions {
  onProgress?: (progress: VideoUploadProgress) => void;
  onComplete?: (publicUrl: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Upload de vídeo DIRETO do browser para Bunny Stream
 * O ficheiro NÃO passa pelo servidor Vercel - evita erro 413
 * 
 * Fluxo:
 * 1. Chamar API para criar vídeo e obter URL de upload
 * 2. Fazer upload DIRETO do browser para Bunny Stream
 * 3. Retornar URL público do vídeo
 */
export async function uploadVideoToBunnyStreamDirect(
  file: File,
  guideSlug: string,
  options: VideoUploadOptions = {}
): Promise<string> {
  const { onProgress, onComplete, onError } = options;
  
  try {
    console.log(`📤 Iniciando upload para Bunny Stream: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    
    // Validar ficheiro
    const validation = isValidVideoFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    
    // Gerar título para o vídeo
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const title = `${guideSlug}_${timestamp}_${safeName}`;
    
    console.log(`📝 Título: ${title}`);
    
    // PASSO 1: Chamar API para criar vídeo e obter URL de upload
    console.log('🎬 Criando vídeo no Bunny Stream...');
    const apiKey = localStorage.getItem('virtualsommelier_api_key');
    
    const createResponse = await fetch('/api/bunny-stream-upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'X-API-Key': apiKey } : {})
      },
      body: JSON.stringify({ title })
    });
    
    if (!createResponse.ok) {
      const errorData = await createResponse.json().catch(() => ({}));
      throw new Error(errorData.details || `Erro ao criar vídeo: ${createResponse.status}`);
    }
    
    const { uploadUrl, publicUrl, apiKey: bunnyApiKey, videoId, libraryId } = await createResponse.json();
    console.log(`✅ Vídeo criado. Iniciando upload direto...`);
    
    // PASSO 2: Upload DIRETO do browser para Bunny Stream (NÃO passa pelo Vercel)
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      // Monitorar progresso
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const progress: VideoUploadProgress = {
            loaded: event.loaded,
            total: event.total,
            percentage: Math.round((event.loaded / event.total) * 100)
          };
          onProgress(progress);
          console.log(`📊 Progresso: ${progress.percentage}%`);
        }
      });
      
      // Upload completo
      xhr.addEventListener('load', async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          console.log('✅ Upload direto concluído!');
          
          try {
            // Depois do upload, pedir ao backend a melhor resolução MP4 realmente disponível
            console.log('🔍 A obter resolução MP4 correta via /api/bunny-video-info ...');
            const apiKeyHeader = localStorage.getItem('virtualsommelier_api_key');
            const infoResponse = await fetch('/api/bunny-video-info', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(apiKeyHeader ? { 'X-API-Key': apiKeyHeader } : {})
              },
              body: JSON.stringify({ videoId, libraryId })
            });
            
            if (infoResponse.ok) {
              const { mp4Url, resolution } = await infoResponse.json();
              const finalUrl = typeof mp4Url === 'string' && mp4Url.length > 0 ? mp4Url : publicUrl;
              console.log(`🎬 URL MP4 selecionada (${resolution}p): ${finalUrl}`);
              if (onComplete) {
                onComplete(finalUrl);
              }
              resolve(finalUrl);
              return;
            }

            console.warn('⚠️ /api/bunny-video-info falhou, a usar URL pública padrão', infoResponse.status);
              if (onComplete) {
                onComplete(publicUrl);
              }
              resolve(publicUrl);
          } catch (err) {
            console.error('❌ Erro ao obter URL MP4 após upload:', err);
            if (onComplete) {
              onComplete(publicUrl);
            }
            resolve(publicUrl);
          }
        } else {
          let errorMessage = `Upload falhou: ${xhr.status}`;
          try {
            const errorResponse = JSON.parse(xhr.responseText);
            if (errorResponse.Message) {
              errorMessage = errorResponse.Message;
            }
          } catch {
            // Ignorar erro de parsing
          }
          const error = new Error(errorMessage);
          console.error('❌ Erro no upload:', error);
          if (onError) {
            onError(error);
          }
          reject(error);
        }
      });
      
      // Erro de rede
      xhr.addEventListener('error', (event) => {
        console.error('❌ Erro de rede - Detalhes:', {
          event,
          xhr: {
            status: xhr.status,
            statusText: xhr.statusText,
            responseText: xhr.responseText,
            readyState: xhr.readyState
          },
          uploadUrl,
          fileSize: file.size,
          fileType: file.type
        });
        
        let errorMessage = 'Erro de rede durante o upload';
        
        // Verificar se é um erro CORS
        if (xhr.status === 0) {
          errorMessage = 'Erro de CORS: Verifica se o domínio está permitido no Bunny Stream (Stream → Security → Allowed Referrers)';
        }
        
        const error = new Error(errorMessage);
        console.error('❌ Erro de rede:', error);
        if (onError) {
          onError(error);
        }
        reject(error);
      });
      
      // Upload cancelado
      xhr.addEventListener('abort', () => {
        const error = new Error('Upload cancelado');
        console.warn('⚠️ Upload cancelado');
        if (onError) {
          onError(error);
        }
        reject(error);
      });
      
      // Configurar e enviar request DIRETO para Bunny Stream
      console.log(`📤 Enviando ${(file.size / 1024 / 1024).toFixed(2)} MB para Bunny Stream...`);
      console.log('🔗 Upload URL:', uploadUrl);
      console.log('🔑 API Key (primeiros 10 chars):', bunnyApiKey.substring(0, 10) + '...');
      console.log('📦 Library ID:', libraryId);
      console.log('🎬 Video ID:', videoId);
      
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('AccessKey', bunnyApiKey);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.send(file);  // Enviar ficheiro DIRETO para Bunny Stream
    });
    
  } catch (error) {
    console.error('❌ Erro no processo de upload:', error);
    if (onError && error instanceof Error) {
      onError(error);
    }
    throw error instanceof Error ? error : new Error('Erro desconhecido no upload');
  }
}

/**
 * Validar se o ficheiro é um vídeo válido
 */
export function isValidVideoFile(file: File): { valid: boolean; error?: string } {
  // Validar tipo
  if (!file.type.startsWith('video/')) {
    return { valid: false, error: 'Apenas ficheiros de vídeo são permitidos' };
  }
  
  // Validar tamanho (200MB máximo - Bunny Stream suporta até 5GB, mas mantemos limite razoável)
  const MAX_SIZE = 200 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return { 
      valid: false, 
      error: `Ficheiro demasiado grande. Máximo: ${MAX_SIZE / 1024 / 1024}MB. Tamanho atual: ${(file.size / 1024 / 1024).toFixed(2)}MB` 
    };
  }
  
  // Validar extensão
  const validExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.flv', '.wmv'];
  const fileExtension = file.name.toLowerCase().match(/\.[^.]*$/)?.[0];
  if (!fileExtension || !validExtensions.includes(fileExtension)) {
    return { 
      valid: false, 
      error: `Extensão não suportada. Extensões válidas: ${validExtensions.join(', ')}` 
    };
  }
  
  return { valid: true };
}

/**
 * Formatar tamanho de ficheiro para exibição
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  } else if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  } else {
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }
}
