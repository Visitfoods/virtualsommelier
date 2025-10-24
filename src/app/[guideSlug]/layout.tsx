import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { mainDb } from '../../firebase/mainConfig';
import { getFirestore, doc, getDoc, query, collection, getDocs, where } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(
  { params }: { params: Promise<{ guideSlug: string }> }
): Promise<Metadata> {
  const { guideSlug } = await params;

  // Defaults
  let title = 'Virtual Sommelier - Guia Virtual Inteligente';
  let description = 'Sistema de guia virtual inteligente com IA';
  let image: string | undefined = undefined;
  const baseUrl = 'https://virtualguide.info';

  const virtualguideTesteGuides = ['virtualchat', 'portugaldospequenitos', 'seguranca', 'seguranca45', 'seguranca76', 'teste23', 'teste24', 'teste270'];

  try {
    // 1) Selecionar DB inicial
    let db = mainDb;

    // 2) Se o slug está na lista especial, ler diretamente do projeto de teste
    if (virtualguideTesteGuides.includes(guideSlug)) {
      const TESTE_FIREBASE_CONFIG = {
        apiKey: (process.env.NEXT_PUBLIC_TARGET_FIREBASE_API_KEY || process.env.TARGET_FIREBASE_API_KEY) as string,
        authDomain: (process.env.NEXT_PUBLIC_TARGET_FIREBASE_AUTH_DOMAIN || process.env.TARGET_FIREBASE_AUTH_DOMAIN) as string,
        projectId: (process.env.NEXT_PUBLIC_TARGET_FIREBASE_PROJECT_ID || process.env.TARGET_FIREBASE_PROJECT_ID) as string,
        storageBucket: (process.env.NEXT_PUBLIC_TARGET_FIREBASE_STORAGE_BUCKET || process.env.TARGET_FIREBASE_STORAGE_BUCKET) as string,
        messagingSenderId: (process.env.NEXT_PUBLIC_TARGET_FIREBASE_MESSAGING_SENDER_ID || process.env.TARGET_FIREBASE_MESSAGING_SENDER_ID) as string,
        appId: (process.env.NEXT_PUBLIC_TARGET_FIREBASE_APP_ID || process.env.TARGET_FIREBASE_APP_ID) as string,
        measurementId: (process.env.NEXT_PUBLIC_TARGET_FIREBASE_MEASUREMENT_ID || process.env.TARGET_FIREBASE_MEASUREMENT_ID || '') as string
      } as const;
      const appName = `vg-virtualchat-b0e17-${guideSlug}`;
      const existing = getApps().find(a => a.name === appName);
      const app = existing || initializeApp(TESTE_FIREBASE_CONFIG, appName);
      db = getFirestore(app);
    }

    // 3) Tentar ler doc por ID
    let data: any | null = null;
    try {
      const ref = doc(db, 'guides', guideSlug);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        data = snap.data();
      }
    } catch {}

    // 4) Se ainda não temos dados e NÃO é um slug da lista, tentar fallback no projeto de teste
    if (!data && !virtualguideTesteGuides.includes(guideSlug)) {
      try {
        const TESTE_FIREBASE_CONFIG = {
          apiKey: (process.env.NEXT_PUBLIC_TARGET_FIREBASE_API_KEY || process.env.TARGET_FIREBASE_API_KEY) as string,
          authDomain: (process.env.NEXT_PUBLIC_TARGET_FIREBASE_AUTH_DOMAIN || process.env.TARGET_FIREBASE_AUTH_DOMAIN) as string,
          projectId: (process.env.NEXT_PUBLIC_TARGET_FIREBASE_PROJECT_ID || process.env.TARGET_FIREBASE_PROJECT_ID) as string,
          storageBucket: (process.env.NEXT_PUBLIC_TARGET_FIREBASE_STORAGE_BUCKET || process.env.TARGET_FIREBASE_STORAGE_BUCKET) as string,
          messagingSenderId: (process.env.NEXT_PUBLIC_TARGET_FIREBASE_MESSAGING_SENDER_ID || process.env.TARGET_FIREBASE_MESSAGING_SENDER_ID) as string,
          appId: (process.env.NEXT_PUBLIC_TARGET_FIREBASE_APP_ID || process.env.TARGET_FIREBASE_APP_ID) as string,
          measurementId: (process.env.NEXT_PUBLIC_TARGET_FIREBASE_MEASUREMENT_ID || process.env.TARGET_FIREBASE_MEASUREMENT_ID || '') as string
        } as const;
        const appName = 'vg-virtualchat-b0e17-dynamic';
        const existing = getApps().find(a => a.name === appName);
        const app = existing || initializeApp(TESTE_FIREBASE_CONFIG, appName);
        const testeDb = getFirestore(app);

        let snap = await getDoc(doc(testeDb, 'guides', guideSlug));
        if (snap.exists()) {
          data = snap.data();
        } else {
          const q = query(collection(testeDb, 'guides'), where('slug', '==', guideSlug));
          const qs = await getDocs(q);
          if (!qs.empty) {
            data = qs.docs[0].data();
          }
        }
      } catch {}
    }

    if (data) {
      title = data?.metaTitle || data?.name || title;
      description = data?.metaDescription || description;
      image = data?.chatIconURL || undefined;
    }
  } catch {
    // Ignorar e ficar com defaults
  }

  const absoluteImage = image
    ? (image.startsWith('http') ? image : `${baseUrl}${image.startsWith('/') ? '' : '/'}${image}`)
    : `${baseUrl}/favicon.jpg`;

  return {
    title,
    description,
    icons: {
      icon: '/faviconvirtualsommelier.jpg',
    },
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${baseUrl}/${guideSlug}`,
      siteName: 'Virtual Sommelier',
      images: [absoluteImage],
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: [absoluteImage],
    },
    alternates: {
      canonical: `${baseUrl}/${guideSlug}`,
    },
  };
}

export default function GuideSegmentLayout({ children }: { children: ReactNode }) {
  return children as any;
}


