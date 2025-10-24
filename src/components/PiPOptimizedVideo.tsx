'use client';

import { useEffect, useRef, forwardRef, useState } from 'react';
import MobileOptimizedVideo from './MobileOptimizedVideo';

interface PiPOptimizedVideoProps {
  src: string;
  className?: string;
  muted?: boolean;
  loop?: boolean;
  preload?: string;
  playsInline?: boolean;
  crossOrigin?: string;
  onError?: (e: any) => void;
  onLoadedMetadata?: () => void;
  onCanPlayThrough?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  autoPlay?: boolean;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

const PiPOptimizedVideo = forwardRef<HTMLVideoElement, PiPOptimizedVideoProps>(
  (props, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPiPReady, setIsPiPReady] = useState(false);

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

             // 1. Otimizações específicas para PiP
       const optimizeForPiP = () => {
         // Carregar metadados primeiro para start rápido
         video.preload = 'metadata';
         
         // Configurar para melhor performance em PiP
         video.playsInline = true;
         
         // Detectar se o dispositivo suporta PiP
         if (document.pictureInPictureEnabled || 'pictureInPictureEnabled' in document) {
           // Preparar PiP com antecedência
           video.addEventListener('loadedmetadata', () => {
             setIsPiPReady(true);
             
             // Carregar mais dados para PiP suave
             video.preload = 'auto';
           }, { once: true });
         }
       };

             // 2. Otimizações para mobile
       const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
       
       if (isMobile) {
         // Reduzir qualidade em dispositivos de baixo desempenho
         const isLowEndDevice = navigator.hardwareConcurrency <= 2;
         if (isLowEndDevice) {
           // Manter configurações básicas para estabilidade
         }
         
         // Otimizar para conexões móveis
         if ('connection' in navigator) {
           const connection = (navigator as any).connection;
           if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
             video.preload = 'metadata'; // Carregar só metadados primeiro
           }
         }
       }

      optimizeForPiP();

             // 3. Event listeners específicos para PiP
       const handleCanPlay = () => {
         // PiP - vídeo pronto para tocar
       };

       const handlePlay = () => {
         // PiP - iniciando reprodução
       };

       const handlePause = () => {
         // PiP - pausado
       };

      // Delegar tratamento de erros ao MobileOptimizedVideo para evitar logs duplicados

      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);

      return () => {
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
      };
    }, []);

    return (
      <MobileOptimizedVideo
        ref={(node) => {
          videoRef.current = node;
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        {...props}
      />
    );
  }
);

PiPOptimizedVideo.displayName = 'PiPOptimizedVideo';

export default PiPOptimizedVideo;
