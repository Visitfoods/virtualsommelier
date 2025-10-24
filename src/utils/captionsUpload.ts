import { fetchWithAuth } from '@/services/apiKeyService';

// Envia o ficheiro para a API do Next que faz upload por FTP
export async function copyCaptionsToPublic(
  file: File,
  slug: string,
  variant: 'desktop' | 'tablet' | 'mobile',
  language: 'pt' | 'en' | 'es' | 'fr' = 'pt'
): Promise<string> {
  const timestamp = Date.now();
  const fileName = `captions_${language}_${variant}_${timestamp}.vtt`;
  const path = `virtualsommelier/${slug}/${fileName}`;

  try {
    const form = new FormData();
    form.append('file', file);
    form.append('guideSlug', slug);
    form.append('captionType', variant);
    form.append('language', language);
    const res = await fetchWithAuth('/api/upload-captions', { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok || !data?.path) {
      throw new Error(data?.error || 'Falha no upload das legendas');
    }
    return data.path as string;
  } catch (error) {
    console.error(`❌ Erro ao processar legendas (${variant}):`, error);
    throw new Error(`Falha ao processar legendas (${variant}): ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}



