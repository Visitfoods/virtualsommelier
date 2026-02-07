"use client";

import { useEffect, useState, use as usePromise } from 'react';
import { useRouter } from 'next/navigation';
import GuideView from './__pp_copy/page';
import { mainDb } from '../../firebase/mainConfig';
import { doc, getDoc, getFirestore, query, collection, getDocs, where } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';

type PageProps = { params: Promise<{ guideSlug: string }> };

interface ChatConfig {
  welcomeTitle?: string | null;
  button1Text?: string | null;
  button1Function?: string | null;
  button2Text?: string | null;
  button2Function?: string | null;
  button3Text?: string | null;
  button3Function?: string | null;
  downloadVideoEnabled?: boolean | null;
}

interface HelpPoints {
  point1?: string | null;
  point2?: string | null;
  point3?: string | null;
  point4?: string | null;
  point5?: string | null;
}

interface FaqCategory {
  name: string;
  questions: {
    question: string;
    answer: string;
    images?: string[];
  }[];
}


interface GuideVideos {
  backgroundVideoURL: string | null;
  mobileTabletBackgroundVideoURL: string | null;
  welcomeVideoURL: string | null;
  videoProvider?: 'cloudflare' | 'bunny' | null;
  systemPrompt: string | null;
  websiteUrl?: string | null;
  chatConfig?: ChatConfig | null;
  helpPoints?: HelpPoints | null;
  faq?: FaqCategory[] | null;
  faqByLang?: {
    pt?: FaqCategory[] | null;
    en?: FaqCategory[] | null;
    es?: FaqCategory[] | null;
    fr?: FaqCategory[] | null;
  } | null;
  humanChatEnabled?: boolean | null;
  chatIconURL?: string | null;
  companyIconURL?: string | null;
  quickButtonsDisabled?: boolean | null;
  quickAreaImageURL?: string | null;
  quickAreaImageLink?: string | null;
  quickAreaImageTabletURL?: string | null;
  quickAreaImageMobileURL?: string | null;
  captions?: { desktop?: string | null; tablet?: string | null; mobile?: string | null } | null;
  captionsByLang?: {
    pt?: { desktop?: string | null; tablet?: string | null; mobile?: string | null } | null;
    en?: { desktop?: string | null; tablet?: string | null; mobile?: string | null } | null;
    es?: { desktop?: string | null; tablet?: string | null; mobile?: string | null } | null;
    fr?: { desktop?: string | null; tablet?: string | null; mobile?: string | null } | null;
  } | null;
  chatConfigByLang?: {
    pt?: ChatConfig | null;
    en?: ChatConfig | null;
    es?: ChatConfig | null;
    fr?: ChatConfig | null;
  } | null;
}

interface GuideData {
  name?: string;
  backgroundVideoURL?: string;
  mobileTabletBackgroundVideoURL?: string;
  welcomeVideoURL?: string;
  systemPrompt?: string;
  websiteUrl?: string;
  isActive?: boolean;
  chatConfig?: ChatConfig | null;
  helpPoints?: HelpPoints | null;
  faq?: FaqCategory[] | null;
  faqByLang?: {
    pt?: FaqCategory[] | null;
    en?: FaqCategory[] | null;
    es?: FaqCategory[] | null;
    fr?: FaqCategory[] | null;
  } | null;
  humanChatEnabled?: boolean | null;
  chatIconURL?: string | null;
  companyIconURL?: string | null;
  captions?: { desktop?: string | null; tablet?: string | null; mobile?: string | null } | null;
  captionsByLang?: {
    pt?: { desktop?: string | null; tablet?: string | null; mobile?: string | null } | null;
    en?: { desktop?: string | null; tablet?: string | null; mobile?: string | null } | null;
    es?: { desktop?: string | null; tablet?: string | null; mobile?: string | null } | null;
    fr?: { desktop?: string | null; tablet?: string | null; mobile?: string | null } | null;
  } | null;
  chatConfigByLang?: {
    pt?: ChatConfig | null;
    en?: ChatConfig | null;
    es?: ChatConfig | null;
    fr?: ChatConfig | null;
  } | null;
  metaTitle?: string;
  metaDescription?: string;
  targetProject?: {
    projectId: string;
    apiKey: string;
    authDomain: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    measurementId?: string;
  };
}

export default function GuideWrapper({ params }: PageProps) {
  const { guideSlug } = usePromise(params);
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [guideVideos, setGuideVideos] = useState<GuideVideos>({
    backgroundVideoURL: null,
    mobileTabletBackgroundVideoURL: null,
    welcomeVideoURL: null,
    systemPrompt: null,
    chatConfig: null,
    helpPoints: null,
    faq: null,
    humanChatEnabled: null,
    chatIconURL: null,
    captions: null
  });

  useEffect(() => {
    let aborted = false;
    async function loadPrompt() {
      try {
        
        
        // 1) Para guias conhecidos do virtualchat-b0e17, sempre usar esse projeto
        let targetDb = mainDb;
        let data: GuideData | null = null;
        
        // Lista de guias que sabemos que estão no virtualchat-b0e17
        const virtualguideTesteGuides = ['virtualchat', 'portugaldospequenitos', 'seguranca', 'seguranca45', 'seguranca76', 'teste23', 'teste24', 'teste270'];
        
        if (virtualguideTesteGuides.includes(guideSlug)) {
          
          try {
            const TESTE_FIREBASE_CONFIG = {
              apiKey: process.env.NEXT_PUBLIC_TARGET_FIREBASE_API_KEY as string,
              authDomain: process.env.NEXT_PUBLIC_TARGET_FIREBASE_AUTH_DOMAIN as string,
              projectId: process.env.NEXT_PUBLIC_TARGET_FIREBASE_PROJECT_ID as string,
              storageBucket: process.env.NEXT_PUBLIC_TARGET_FIREBASE_STORAGE_BUCKET as string,
              messagingSenderId: process.env.NEXT_PUBLIC_TARGET_FIREBASE_MESSAGING_SENDER_ID as string,
              appId: process.env.NEXT_PUBLIC_TARGET_FIREBASE_APP_ID as string,
              measurementId: (process.env.NEXT_PUBLIC_TARGET_FIREBASE_MEASUREMENT_ID || '') as string
            } as const;
            
            const appName = `vg-virtualchat-b0e17-${guideSlug}`;
            const existing = getApps().find(a => a.name === appName);
            
            
            const app = existing || initializeApp(TESTE_FIREBASE_CONFIG, appName);
            
            targetDb = getFirestore(app);
            
            // Buscar diretamente no virtualchat-b0e17
            const testeRef = doc(targetDb, 'guides', guideSlug);
            
            const testeSnap = await getDoc(testeRef);
            if (testeSnap.exists()) {
              data = testeSnap.data() as GuideData;
              
            } else {
              
              // Tentar buscar por slug
              const q = query(collection(targetDb, 'guides'), where('slug', '==', guideSlug));
              const querySnapshot = await getDocs(q);
              if (!querySnapshot.empty) {
                data = querySnapshot.docs[0].data() as GuideData;
                
              } else {
              
              }
            }
          } catch (error) {
            console.error(`Erro ao carregar guia ${guideSlug}:`, error);
          }
        } else {
          // Para outros guias, usar lógica original (projeto principal)
          try {
            const ref = doc(mainDb, 'guides', guideSlug);
            const snap = await getDoc(ref);
            data = snap.exists() ? (snap.data() as GuideData) : null;
            
            if (data && data.targetProject) {
              // Se existir targetProject, usar esse projeto
              const target = data.targetProject;
              const appName = `vg-${target.projectId}`;
              const existing = getApps().find(a => a.name === appName);
              const app = existing || initializeApp({
                apiKey: target.apiKey || '',
                authDomain: target.authDomain || '',
                projectId: target.projectId,
                storageBucket: target.storageBucket || '',
                messagingSenderId: target.messagingSenderId || '',
                appId: target.appId || '',
                ...(target.measurementId ? { measurementId: target.measurementId } : {}),
              }, appName);
              targetDb = getFirestore(app);
            }
          } catch (error) {
            
          }
        }

        // 2) Para outros guias que não estão na lista, se não encontrou no projeto principal, tentar no virtualchat-b0e17
        if (!data && !virtualguideTesteGuides.includes(guideSlug)) {
          try {
          
            const TESTE_FIREBASE_CONFIG = {
              apiKey: process.env.NEXT_PUBLIC_TARGET_FIREBASE_API_KEY as string,
              authDomain: process.env.NEXT_PUBLIC_TARGET_FIREBASE_AUTH_DOMAIN as string,
              projectId: process.env.NEXT_PUBLIC_TARGET_FIREBASE_PROJECT_ID as string,
              storageBucket: process.env.NEXT_PUBLIC_TARGET_FIREBASE_STORAGE_BUCKET as string,
              messagingSenderId: process.env.NEXT_PUBLIC_TARGET_FIREBASE_MESSAGING_SENDER_ID as string,
              appId: process.env.NEXT_PUBLIC_TARGET_FIREBASE_APP_ID as string,
              measurementId: (process.env.NEXT_PUBLIC_TARGET_FIREBASE_MEASUREMENT_ID || '') as string
            } as const;
            
            const appName = 'vg-virtualchat-b0e17-dynamic';
            const existing = getApps().find(a => a.name === appName);
            
            
            const app = existing || initializeApp(TESTE_FIREBASE_CONFIG, appName);
            
            targetDb = getFirestore(app);
            
            // Verificar se o guia existe no virtualchat-b0e17
            const testeRef = doc(targetDb, 'guides', guideSlug);
            
            const testeSnap = await getDoc(testeRef);
            if (testeSnap.exists()) {
              data = testeSnap.data() as GuideData;
              
            } else {
              
              
              // Tentar buscar por slug
              const q = query(collection(targetDb, 'guides'), where('slug', '==', guideSlug));
              const querySnapshot = await getDocs(q);
              if (!querySnapshot.empty) {
                data = querySnapshot.docs[0].data() as GuideData;
                
              } else {
                
              }
            }
          } catch (error) {
            console.error('Erro ao tentar ler do projeto virtualchat-b0e17:', error);
          }
        }

        // 3) Se não encontrou em nenhum lugar, mostrar 404
        if (!data) {
          
          if (!aborted) {
            setNotFound(true);
          }
          return;
        }

        // 4) Bloquear se o guia estiver inativo
        if (data.isActive === false) {
          
          if (!aborted) {
            setNotFound(true);
          }
          return;
        }
        
        

        // 3) Extrair dados do guia encontrado
        const prompt = data?.systemPrompt || '';
        const videos = {
          backgroundVideoURL: data?.backgroundVideoURL || null,
          mobileTabletBackgroundVideoURL: data?.mobileTabletBackgroundVideoURL || null,
          welcomeVideoURL: data?.welcomeVideoURL || null,
          videoProvider: (data as any)?.videoProvider || null
        };
        const chatConfig: ChatConfig | null = data?.chatConfig || null;
        const helpPoints: HelpPoints | null = data?.helpPoints || null;
        const humanChatEnabled: boolean | null = typeof data?.humanChatEnabled === 'boolean' ? data.humanChatEnabled : null;
        const faq: FaqCategory[] | null = (data?.faq && Array.isArray(data.faq)) ? data.faq as FaqCategory[] : null;
        const chatIconURL: string | null = data?.chatIconURL || null;
        const companyIconURL: string | null = (data as any)?.companyIconURL || null;
        const quickButtonsDisabled: boolean | null = (data as any)?.quickButtonsDisabled ?? null;
        const quickAreaImageURL: string | null = (data as any)?.quickAreaImageURL || null;
        const quickAreaImageLink: string | null = (data as any)?.quickAreaImageLink || null;
        const quickAreaImageTabletURL: string | null = (data as any)?.quickAreaImageTabletURL || null;
        const quickAreaImageMobileURL: string | null = (data as any)?.quickAreaImageMobileURL || null;
        const websiteUrl: string | null = (data as any)?.websiteUrl || null;
        const captions: { desktop?: string | null; tablet?: string | null; mobile?: string | null } | null = data?.captions || null;
        const captionsByLang: GuideVideos['captionsByLang'] = (data as any)?.captionsByLang || null;
        const chatConfigByLang: GuideVideos['chatConfigByLang'] = (data as any)?.chatConfigByLang || null;
        const faqByLang: GuideVideos['faqByLang'] = (data as any)?.faqByLang || null;

        // 3.1) Atualizar título e meta description do documento (SEO)
        try {
          const metaTitle: string = data?.metaTitle || data?.name || 'Guia Virtual';
          const metaDescription: string = data?.metaDescription || 'Guia Virtual';
          if (typeof document !== 'undefined') {
            document.title = metaTitle;
            let descEl: HTMLMetaElement | null = document.querySelector('meta[name="description"]');
            if (!descEl) {
              descEl = document.createElement('meta');
              descEl.setAttribute('name', 'description');
              document.head.appendChild(descEl);
            }
            descEl.setAttribute('content', metaDescription);

            // Open Graph e Twitter dinâmicos
            const ensureTag = (selector: string, attr: 'content' | 'href', value: string) => {
              let el = document.querySelector(selector) as HTMLMetaElement | HTMLLinkElement | null;
              if (!el) {
                const isLink = selector.startsWith('link');
                const created = document.createElement(isLink ? 'link' : 'meta');
                const attrName = selector.includes('property=') ? 'property' : selector.includes('name=') ? 'name' : 'rel';
                const match = selector.match(/(?:property|name|rel)="([^"]+)"/);
                created.setAttribute(attrName, match?.[1] || '');
                document.head.appendChild(created);
                el = created as any;
              }
              (el as any).setAttribute(attr, value);
            };

            const pageUrl = window.location.href;
            const imageCandidate = (data?.chatIconURL || 'https://virtualguide.info/favicon.jpg') as string;
            const absoluteImage = imageCandidate.startsWith('http')
              ? imageCandidate
              : `${window.location.origin}${imageCandidate.startsWith('/') ? '' : '/'}${imageCandidate}`;

            ensureTag('meta[property="og:title"]', 'content', metaTitle);
            ensureTag('meta[property="og:description"]', 'content', metaDescription);
            ensureTag('meta[property="og:type"]', 'content', 'website');
            ensureTag('meta[property="og:url"]', 'content', pageUrl);
            ensureTag('meta[property="og:site_name"]', 'content', 'Virtual Sommelier');
            ensureTag('meta[property="og:image"]', 'content', absoluteImage);

            ensureTag('meta[name="twitter:card"]', 'content', 'summary');
            ensureTag('meta[name="twitter:title"]', 'content', metaTitle);
            ensureTag('meta[name="twitter:description"]', 'content', metaDescription);
            ensureTag('meta[name="twitter:image"]', 'content', absoluteImage);

            ensureTag('link[rel="canonical"]', 'href', pageUrl);
          }
        } catch {
          // Ignorar erros silenciosamente para não bloquear render
        }

        if (!aborted) {
          console.log('📥 Dados do guia carregados:', {
            backgroundVideoURL: videos.backgroundVideoURL,
            welcomeVideoURL: videos.welcomeVideoURL,
            videoProvider: videos.videoProvider
          });
          
          setGuideVideos({
            backgroundVideoURL: videos.backgroundVideoURL,
            mobileTabletBackgroundVideoURL: videos.mobileTabletBackgroundVideoURL,
            welcomeVideoURL: videos.welcomeVideoURL,
            videoProvider: videos.videoProvider,
            systemPrompt: prompt,
            websiteUrl: websiteUrl,
            chatConfig,
            helpPoints,
            faq,
            faqByLang,
            humanChatEnabled,
            chatIconURL,
            companyIconURL,
            quickButtonsDisabled,
            quickAreaImageURL,
            quickAreaImageLink,
            quickAreaImageTabletURL,
            quickAreaImageMobileURL,
            captions,
            captionsByLang,
            chatConfigByLang
          });
          // Aplicar gradiente como CSS variables
          try {
            const start = (data as any)?.gradientStartColor || '#ff6b6b';
            const end = (data as any)?.gradientEndColor || '#4ecdc4';
            if (typeof document !== 'undefined') {
              document.documentElement.style.setProperty('--vg-gradient-start', start);
              document.documentElement.style.setProperty('--vg-gradient-end', end);
            }
          } catch {}
        }
      } catch (e) {
        console.error('Erro ao carregar systemPrompt, vídeos e chat config do guia', e);
        setNotFound(true);
      } finally {
        if (!aborted) setReady(true);
      }
    }
    loadPrompt();
    return () => { aborted = true; };
  }, [guideSlug]);

  // Redirecionar quando não existir o guia
  useEffect(() => {
    if (notFound && ready) {
      router.replace('/404');
    }
  }, [notFound, ready, router]);

  if (!ready) {
    return null;
  }

  if (notFound) {
    return null;
  }

  
  
  return <GuideView guideVideos={guideVideos as any} guideSlug={guideSlug} />;
}

