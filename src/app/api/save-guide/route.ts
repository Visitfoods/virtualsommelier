import { NextRequest, NextResponse } from 'next/server';
import { uploadBufferToAmen } from '@/lib/amenFtp';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { app as unifiedApp } from '@/firebase/config';
import { requireApiKeyAdmin } from '@/middleware/apiKeyMiddleware';
import { strictRateLimit } from '@/middleware/rateLimitMiddleware';
import { ApiKeyRequest } from '@/middleware/apiKeyMiddleware';

export const runtime = 'nodejs';

// Configuração do projeto virtualchat-b0e17 via variáveis de ambiente
const TARGET_FIREBASE_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_TARGET_FIREBASE_API_KEY as string,
  authDomain: process.env.NEXT_PUBLIC_TARGET_FIREBASE_AUTH_DOMAIN as string,
  projectId: process.env.NEXT_PUBLIC_TARGET_FIREBASE_PROJECT_ID as string,
  storageBucket: process.env.NEXT_PUBLIC_TARGET_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: process.env.NEXT_PUBLIC_TARGET_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: process.env.NEXT_PUBLIC_TARGET_FIREBASE_APP_ID as string,
  measurementId: process.env.NEXT_PUBLIC_TARGET_FIREBASE_MEASUREMENT_ID || ''
} as const;

// Usar app unificada (virtualchat)
const getTargetDb = () => getFirestore(unifiedApp);

export async function POST(request: NextRequest) {
  try {
    // Aplicar rate limiting rigoroso para operações de escrita
    const rateLimitResult = await strictRateLimit()(request);
    if (rateLimitResult) {
      return rateLimitResult;
    }
    
    // Verificar autenticação via API Key (apenas admin)
    const authResult = await requireApiKeyAdmin()(request);
    if (authResult) {
      return authResult;
    }
    
    // Obter informações da API Key autenticada
    const apiKeyRequest = request as ApiKeyRequest;
    const apiKey = apiKeyRequest.apiKey;

    const body = await request.json();
    const { guideData, isEditMode } = body as {
      guideData: Record<string, unknown> & { slug: string };
      isEditMode?: boolean;
    };
    
    if (!guideData) {
      return NextResponse.json(
        { error: 'Dados insuficientes para salvar o guia' },
        { status: 400 }
      );
    }

    const targetDb = getTargetDb();

    // Usar informações da API Key para registrar quem fez a atualização
    const userId = apiKey?.id || 'unknown';
    const userRole = apiKey?.role || 'user';

    // Preparar dados do guia
    const guideDoc = {
      ...guideData,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
      updatedByRole: userRole,
      ...(isEditMode ? {} : { 
        createdAt: serverTimestamp(), 
        createdBy: userId,
        createdByRole: userRole
      })
    };

    // Salvar o guia
    await setDoc(
      doc(targetDb, 'guides', guideData.slug),
      guideDoc,
      { merge: true }
    );

    // Disparar scraping imediato para preencher cache (se houver websiteUrl)
    try {
      const websiteUrl = String((guideDoc as any)?.websiteUrl || '').trim();
      if (websiteUrl) {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const apiKey = process.env.SIMPLE_API_KEY || process.env.NEXT_PUBLIC_API_KEY;
        await fetch(`${baseUrl}/api/website-scraper`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(apiKey ? { 'x-api-key': apiKey } : {}) },
          body: JSON.stringify({ websiteUrl, maxPages: 30, maxDepth: 2, maxConcurrency: 12, timeoutMs: 6000, maxHtmlBytes: 180000 })
        }).then(async (resp) => {
          if (!resp.ok) return;
          const data = await resp.json();
          const pages = Array.isArray(data?.pages) ? data.pages : [];
          try {
            const { ScrapingStorageService } = await import('@/services/scrapingStorageService');
            await ScrapingStorageService.save(String(guideData.slug), websiteUrl, pages, { maxPages: 30, maxDepth: 2 });
          } catch (e) {}
        }).catch(() => {});
      }
    } catch (e) {
      console.warn('Aviso: falha ao disparar scraping imediato:', e);
    }

    // Exportar JSON do guia para FTP (virtualsommelier/<slug>/guide.json)
    try {
      const jsonBuffer = Buffer.from(JSON.stringify(guideDoc, null, 2));
      const remotePath = `virtualsommelier/${guideData.slug}/guide.json`;
      await uploadBufferToAmen(remotePath, jsonBuffer);
    } catch (e) {
      // Não falhar a operação principal se FTP falhar
      console.warn('Aviso: falha ao exportar guide.json para FTP:', e);
    }

    return NextResponse.json({
      success: true,
      message: `Guia "${guideData.slug}" ${isEditMode ? 'atualizado' : 'criado'} com sucesso`
    });

  } catch (error: unknown) {
    console.error('Erro ao salvar guia:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor ao salvar guia' },
      { status: 500 }
    );
  }
}
