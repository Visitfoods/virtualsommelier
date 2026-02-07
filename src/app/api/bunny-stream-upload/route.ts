import { NextRequest, NextResponse } from 'next/server';
import { getBunnyStreamConfig, createBunnyStreamVideo, getBunnyStreamApiUrl, getBunnyStreamVideoUrl } from '@/lib/bunnyStream';

/**
 * API para criar vídeo no Bunny Stream e obter URL de upload direto
 * 
 * UPLOAD DIRETO - O ficheiro NÃO passa pelo servidor Vercel
 * 
 * Fluxo:
 * 1. Frontend chama esta API com título do vídeo
 * 2. Backend cria um novo vídeo vazio na biblioteca Bunny Stream
 * 3. Backend retorna uploadUrl para o frontend
 * 4. Frontend faz upload DIRETO do browser para o Bunny Stream
 */
export async function POST(req: NextRequest) {
  try {
    console.log('🎥 API Bunny Stream: Criando vídeo...');
    
    const config = getBunnyStreamConfig();
    console.log('✅ Configuração Bunny Stream carregada:', {
      libraryId: config.libraryId,
      hasApiKey: !!config.apiKey,
      apiKeyLength: config.apiKey.length
    });
    
    const body = await req.json();
    
    const { title } = body;
    
    if (!title) {
      return NextResponse.json(
        { error: 'Título não fornecido' },
        { status: 400 }
      );
    }
    
    console.log(`📝 Título: ${title}`);
    
    // Criar vídeo vazio na biblioteca do Bunny Stream
    console.log('🎬 Criando vídeo na biblioteca Bunny Stream...');
    const { videoId } = await createBunnyStreamVideo(title);
    console.log(`✅ Vídeo criado com ID: ${videoId}`);
    
    // Gerar URL de upload direto
    const uploadUrl = `${getBunnyStreamApiUrl(config.libraryId, videoId)}`;
    
    // Gerar URL pública do vídeo (iframe player)
    const publicUrl = getBunnyStreamVideoUrl(videoId, config.libraryId);
    
    console.log(`🌐 URL pública: ${publicUrl}`);
    console.log(`📤 URL de upload: ${uploadUrl}`);
    
    return NextResponse.json({ 
      success: true,
      videoId,
      libraryId: config.libraryId,
      uploadUrl,  // Frontend usa isto para upload direto
      publicUrl,  // URL final para guardar no Firebase
      apiKey: config.apiKey  // Necessário para autenticação do upload
    });
    
  } catch (error) {
    console.error('❌ Erro ao criar vídeo Bunny Stream:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao criar vídeo no Bunny Stream',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}
