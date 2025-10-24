import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/middleware/authMiddleware';
import { getFirestore, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { app as unifiedApp } from '@/firebase/config';
import { deleteCloudflareVideo } from '@/lib/cloudflareStream';
import { deleteDirectoryRecursive } from '@/lib/amenFtp';

// Garantir ambiente Node.js (necessário para FTP)
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
    // Autenticação forte: requer Bearer token + X-Session-ID válidos com role admin
    const guard = await requireAdmin()(request);
    if (guard) return guard;

    const { slug } = await request.json() as {
      slug: string;
    };
    
    if (!slug) {
      return NextResponse.json(
        { error: 'Parâmetros inválidos: slug em falta' },
        { status: 400 }
      );
    }

    const targetDb = getTargetDb();

    // Buscar documento do guia para encontrar UIDs de vídeos Cloudflare
    const guideRef = doc(targetDb, 'guides', slug);
    const guideSnap = await getDoc(guideRef);

    // Extrair possíveis URLs/UIDs
    const extractUid = (url?: string | null): string | null => {
      if (!url) return null;
      try {
        const u = new URL(url);
        // Suporta:
        // - https://videodelivery.net/{uid}/manifest/video.m3u8
        // - https://videodelivery.net/{uid}/downloads/default.mp4
        // - https://iframe.videodelivery.net/{uid}
        const m = u.pathname.match(/^\/([a-zA-Z0-9_-]{10,})(?:\/|$)/);
        return m && m[1] ? m[1] : null;
      } catch {
        // Pode já ser apenas um UID
        return /^[a-zA-Z0-9_-]{10,}$/.test(url) ? url : null;
      }
    };

    if (guideSnap.exists()) {
      const data = guideSnap.data() as any;
      const candidates: Array<string | null | undefined> = [
        data?.backgroundVideoURL,
        data?.mobileTabletBackgroundVideoURL,
        data?.welcomeVideoURL,
      ];
      const uids = candidates.map(c => extractUid(String(c || ''))).filter(Boolean) as string[];

      // Tentar apagar todos os vídeos associados (best-effort)
      for (const uid of uids) {
        try { await deleteCloudflareVideo(uid); } catch (e) { console.warn('Falha ao apagar vídeo Cloudflare', uid, e); }
      }
    }

    // Best-effort: apagar pasta FTP associada ao guia
    try {
      const remoteGuideFolder = `virtualsommelier/${slug}`;
      const removed = await deleteDirectoryRecursive(remoteGuideFolder);
      if (!removed) {
        console.warn('Pasta FTP não removida (pode não existir ou credenciais em falta):', remoteGuideFolder);
      }
    } catch (ftpError) {
      console.warn('Falha ao apagar pasta no FTP:', ftpError);
    }

    // Finalmente, apagar o documento do guia
    await deleteDoc(guideRef);

    return NextResponse.json({
      success: true,
      message: `Guia "${slug}" eliminado com sucesso`
    });

  } catch (error) {
    console.error('Erro ao eliminar guia:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor ao eliminar guia' },
      { status: 500 }
    );
  }
}