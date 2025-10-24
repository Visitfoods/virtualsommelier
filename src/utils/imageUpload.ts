import { fetchWithAuth } from '@/services/apiKeyService';

// Envia o ficheiro para a API do Next que faz upload por FTP
export async function copyImageToPublic(
  file: File,
  slug: string,
  type: 'chatIcon' | 'companyIcon' | 'faqImage' | 'quickAreaImage' | 'quickAreaImageTablet' | 'quickAreaImageMobile'
): Promise<string> {
  const timestamp = Date.now();
  const safe = (file.name || 'image').replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileName = `${type}_${timestamp}_${safe}`;
  const path = `virtualsommelier/${slug}/${fileName}`;

  try {
    const form = new FormData();
    form.append('file', file);
    form.append('guideSlug', slug);
    form.append('fileType', type);
    const res = await fetchWithAuth('/api/upload-image', { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok || !data?.path) {
      throw new Error(data?.error || 'Falha no upload da imagem');
    }
    return data.path as string;
  } catch (error) {
    console.error(`❌ Erro ao processar imagem ${type}:`, error);
    throw new Error(`Falha ao processar imagem ${type}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}


