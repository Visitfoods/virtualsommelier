import { NextResponse } from 'next/server';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { app as unifiedApp } from '@/firebase/config';

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

export async function POST(request: Request) {
  try {
    const { slug, newActive, userId, userRole } = await request.json() as {
      slug: string;
      newActive: boolean;
      userId: string;
      userRole: string;
    };
    
    if (!slug || typeof newActive !== 'boolean' || !userId || !userRole) {
      return NextResponse.json(
        { error: 'Dados insuficientes para alterar o estado do guia' },
        { status: 400 }
      );
    }

    // Verificar se o utilizador tem permissões (apenas admin)
    if (userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Permissões insuficientes para alterar estado de guias' },
        { status: 403 }
      );
    }

    const targetDb = getTargetDb();

    // Atualizar o estado do guia
    await setDoc(
      doc(targetDb, 'guides', slug),
      { isActive: newActive, updatedAt: serverTimestamp() },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      message: `Estado do guia "${slug}" alterado para: ${newActive ? 'ativo' : 'inativo'}`
    });

  } catch (error) {
    console.error('Erro ao alterar estado do guia:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor ao alterar estado do guia' },
      { status: 500 }
    );
  }
}