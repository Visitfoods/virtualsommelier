import { NextResponse } from 'next/server';
import { deleteDirectoryRecursive } from '@/lib/amenFtp';
import { standardRateLimit } from '@/middleware/rateLimitMiddleware';
import { simpleApiKeyAuth } from '@/middleware/simpleApiKeyMiddleware';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    // Rate limit e autenticação
    const req = request as any;
    const rl = await (standardRateLimit() as any)(req);
    if (rl) return rl as any;
    const auth = await (simpleApiKeyAuth() as any)(req);
    if (auth) return auth as any;

    const { slug } = await request.json();

    if (!slug) {
      return NextResponse.json(
        { error: 'Slug é obrigatório' },
        { status: 400 }
      );
    }

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
      { error: 'Erro interno do servidor ao limpar assets' },
      { status: 500 }
    );
  }
}