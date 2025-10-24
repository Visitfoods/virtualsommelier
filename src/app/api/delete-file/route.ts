import { NextResponse } from 'next/server';
import { deleteFileFromFtp } from '@/lib/amenFtp';
import { standardRateLimit } from '@/middleware/rateLimitMiddleware';
import { simpleApiKeyAuth } from '@/middleware/simpleApiKeyMiddleware';

export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    // Rate limit e autenticação
    const req = request as any;
    const rl = await (standardRateLimit() as any)(req);
    if (rl) return rl as any;
    const auth = await (simpleApiKeyAuth() as any)(req);
    if (auth) return auth as any;

    const { guideSlug, fileName } = await request.json();

    if (!guideSlug || !fileName) {
      return NextResponse.json(
        { error: 'guideSlug e fileName são obrigatórios' },
        { status: 400 }
      );
    }

    // Caminho completo para o ficheiro (alinha com uploads em virtualsommelier/<slug>/)
    const filePath = `virtualsommelier/${guideSlug}/${fileName}`;
    
    // Apagar o ficheiro específico
    const deleted = await deleteFileFromFtp(filePath);
    
    if (deleted) {
      return NextResponse.json({
        success: true,
        message: `Ficheiro apagado com sucesso: ${fileName}`,
        path: filePath
      });
    } else {
      return NextResponse.json({
        success: false,
        message: `Não foi possível apagar o ficheiro: ${fileName}`,
        path: filePath
      });
    }

  } catch (error) {
    console.error('Erro ao apagar ficheiro:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor ao apagar ficheiro' },
      { status: 500 }
    );
  }
}
