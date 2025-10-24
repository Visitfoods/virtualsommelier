import { NextResponse } from 'next/server';
import { deleteDirectoryRecursive } from '@/lib/amenFtp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    // Obter o slug do guia a apagar dos parâmetros da URL
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug') || 'teste-video-grande';

    

    // Caminho para a pasta do guia
    const guidePath = `virtualsommelier/${slug}`;
    
    // Apagar a pasta do guia e todo o seu conteúdo
    const deleted = await deleteDirectoryRecursive(guidePath);
    
    if (deleted) {
      
      return NextResponse.json({
        success: true,
        message: `Pasta do guia apagada com sucesso: ${guidePath}`,
        path: guidePath
      });
    } else {
      
      return NextResponse.json({
        success: false,
        message: `Não foi possível apagar a pasta do guia: ${guidePath}`,
        path: guidePath
      });
    }

  } catch (error) {
    console.error('Erro ao limpar assets:', error);
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor ao limpar assets',
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}
