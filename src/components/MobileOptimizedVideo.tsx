'use client';

import { useEffect, useRef, forwardRef } from 'react';
import { useState } from 'react';

interface MobileOptimizedVideoProps {
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
  // Tempo alvo para retomar reprodução sem recomeçar do zero
  resumeTime?: number;
}

const MobileOptimizedVideo = forwardRef<HTMLVideoElement, MobileOptimizedVideoProps>(
  ({ src, className, muted = false, loop = false, preload = "auto", playsInline = true, crossOrigin = "anonymous", onError, onLoadedMetadata, onCanPlayThrough, onPlay, onPause, autoPlay, style, children, resumeTime, ...props }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const desiredMutedRef = useRef<boolean>(muted);
    // Manter estado de som desejado atualizado a partir das props
    useEffect(() => { desiredMutedRef.current = muted; }, [muted]);

    // Normalizar URLs da Cloudflare (iframe/HLS/DASH) para manifest HLS
    const toCloudflareHls = (value: string): string => {
      try {
        if (!value) return value;
        if (value.includes('iframe.videodelivery.net/')) {
          const m = value.match(/iframe\.videodelivery\.net\/([a-zA-Z0-9_-]{10,})/);
          if (m && m[1]) return `https://videodelivery.net/${m[1]}/manifest/video.m3u8`;
        }
        if (value.includes('videodelivery.net/')) {
          if (value.includes('/manifest/video.m3u8')) return value;
          const m = value.match(/videodelivery\.net\/([a-zA-Z0-9_-]{10,})/);
          if (m && m[1]) return `https://videodelivery.net/${m[1]}/manifest/video.m3u8`;
        }
      } catch {}
      return value;
    };

    const normalizedSrc = toCloudflareHls(src);

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      // Reforçar inline playback no iOS (além do playsInline do JSX)
      try {
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
      } catch {}

      // HLS helper (carrega hls.js quando necessário)
      let hlsInstance: any = null;
      const isHlsSrcGlobal = typeof normalizedSrc === 'string' && normalizedSrc.endsWith('.m3u8');
      // Fallback de loop manual para Android/HLS onde loop nativo pode falhar
      const isAndroid = /Android/i.test(navigator.userAgent);
      // Temporizador para atrasar propagação de erro enquanto tentamos recuperar
      let errorDelayTimer: any = null;
      let restartOnEnd: (() => void) | null = null;
      const attachManualLoop = () => {
        if (!loop) return; // só aplicar quando loop é pretendido
        // Aplicar apenas em Android ou quando a fonte é HLS (onde há mais incidência de falhas de loop)
        const isHlsSrc = typeof normalizedSrc === 'string' && normalizedSrc.endsWith('.m3u8');
        if (!(isAndroid || isHlsSrc)) return;
        // Evitar conflito com loop nativo
        try { video.loop = false; } catch {}
        let retries = 0;
        const maxRetries = 3;
        const backoffBaseMs = 200;
        restartOnEnd = () => {
          try {
            // Reiniciar do início (usar valor pequeno para evitar seek ao exato 0 em alguns players)
            video.currentTime = 0.001;
          } catch {}
          const tryPlay = () => {
            try {
              const p = video.play();
              if (p && typeof p.then === 'function') {
                p.then(() => {
                  retries = 0;
                  // Restaurar estado de som pretendido após o autoplay em mute
                  try {
                    const targetMuted = desiredMutedRef.current === true;
                    video.muted = targetMuted;
                    video.volume = targetMuted ? 0 : 1;
                  } catch {}
                }).catch(() => {
                  if (retries < maxRetries) {
                    const delay = backoffBaseMs * Math.pow(2, retries);
                    retries += 1;
                    setTimeout(tryPlay, delay);
                  }
                });
              }
            } catch {
              if (retries < maxRetries) {
                const delay = backoffBaseMs * Math.pow(2, retries);
                retries += 1;
                setTimeout(tryPlay, delay);
              }
            }
          };
          // Em mobile, garantir mute para autoplay se necessário
          try {
            if (video.muted !== true) {
              video.muted = true;
              video.volume = 0;
            }
          } catch {}
          tryPlay();
        };
        try { video.addEventListener('ended', restartOnEnd); } catch {}
      };
      const detachManualLoop = () => {
        if (restartOnEnd) {
          try { video.removeEventListener('ended', restartOnEnd); } catch {}
          restartOnEnd = null;
        }
      };
      const applyResumeTime = () => {
        try {
          const t = typeof resumeTime === 'number' ? resumeTime : undefined;
          if (typeof t === 'number' && t > 0) {
            const diff = Math.abs(((video.currentTime || 0) - t));
            if (diff > 0.2) {
              video.currentTime = t;
            }
          }
        } catch {}
      };
      const attachHls = async () => {
        try {
          const isHls = typeof normalizedSrc === 'string' && normalizedSrc.endsWith('.m3u8');
          if (!isHls) return;
          const canNative = video.canPlayType('application/vnd.apple.mpegurl');
          if (canNative) {
            // iOS (HLS nativo): não reatribuir src; apenas aplicar tempo
            applyResumeTime();
            // Em HLS nativo, ainda anexar loop manual em Android
            attachManualLoop();
            return;
          }
          const ensureHls = async () => {
            const w = window as any;
            if (w.Hls) return w.Hls;
            await new Promise<void>((resolve, reject) => {
              const s = document.createElement('script');
              s.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.4.12/dist/hls.min.js';
              s.onload = () => resolve();
              s.onerror = () => reject(new Error('Falha ao carregar hls.js'));
              document.head.appendChild(s);
            });
            return (window as any).Hls;
          };
          const HlsLib = await ensureHls();
          if (HlsLib && HlsLib.isSupported()) {
            const startPos = typeof resumeTime === 'number' && resumeTime > 0 ? resumeTime : -1;
            hlsInstance = new HlsLib({
              startPosition: startPos,
              autoStartLoad: true,
              lowLatencyMode: false,
              capLevelToPlayerSize: true,
              enableWorker: true,
              // Otimizações para manifest com segmentos longos (4s)
              maxBufferLength: 6,
              maxMaxBufferLength: 8,
              backBufferLength: 0,
              liveSyncDurationCount: 1,
              liveMaxLatencyDurationCount: 2,
              maxLoadingDelay: 1,
              maxBufferHole: 0.1
            });
            hlsInstance.loadSource(normalizedSrc);
            hlsInstance.attachMedia(video);
            try { applyResumeTime(); } catch {}
            // Anexar loop manual após HLS estar ligado
            attachManualLoop();
            try {
              hlsInstance.on?.(HlsLib.Events.MANIFEST_PARSED, () => {
                applyResumeTime();
              });
              hlsInstance.on?.(HlsLib.Events.LEVEL_LOADED, () => {
                applyResumeTime();
              });
            } catch {}
          } else {
            (video as any).src = normalizedSrc;
            applyResumeTime();
            attachManualLoop();
          }
        } catch {
          try { (video as any).src = normalizedSrc; } catch {}
          attachManualLoop();
        }
      };

      // Detectar se é mobile
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
             if (isMobile) {
         // 1. Otimizar carregamento - metadados primeiro
         video.preload = 'metadata';
         
         // 2. Detectar qualidade da conexão
         if ('connection' in navigator) {
           const connection = (navigator as any).connection;
           
           if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
             video.volume = 0.7; // Reduz volume para economizar
           }
         }
         
         // 3. Detectar performance do dispositivo
         const isLowEndDevice = navigator.hardwareConcurrency <= 2;
         if (isLowEndDevice) {
           video.playbackRate = 1.0; // Manter velocidade normal
         }
        
                 // 4. Event listeners otimizados
        const handleLoadedMetadata = () => {
           setIsLoaded(true);
           video.preload = 'auto'; // Agora carregar tudo
          applyResumeTime();
          try {
            // Forçar legendas a ficarem visíveis quando disponíveis (iOS e casos nativos)
            const tracks = video.textTracks;
            if (tracks && tracks.length > 0) {
              for (let i = 0; i < tracks.length; i++) {
                tracks[i].mode = 'showing';
              }
            }
          } catch {}
           onLoadedMetadata?.();
         };

        const handleCanPlay = () => {
          if (errorDelayTimer) { try { clearTimeout(errorDelayTimer); } catch {} errorDelayTimer = null; }
          applyResumeTime();
        };

        const handleCanPlayThrough = () => {
          applyResumeTime();
          onCanPlayThrough?.();
        };

        const handlePlay = () => {
          if (errorDelayTimer) { try { clearTimeout(errorDelayTimer); } catch {} errorDelayTimer = null; }
           onPlay?.();
          try {
            const tracks = video.textTracks;
            if (tracks && tracks.length > 0) {
              for (let i = 0; i < tracks.length; i++) {
                tracks[i].mode = 'showing';
              }
            }
          } catch {}
         };

        const handlePause = () => {
           onPause?.();
         };

        const handleError = (e: any) => {
          // Tentar recuperação automática no Android/HLS após fim/loop
          try {
            if (isAndroid || isHlsSrcGlobal || hlsInstance) {
              try { hlsInstance?.recoverMediaError?.(); } catch {}
              try {
                if (video.readyState < 2) {
                  video.load();
                }
              } catch {}
              try {
                // Garantir mute para não bloquear autoplay
                if (video.muted !== true) {
                  video.muted = true;
                  video.volume = 0;
                }
              } catch {}
              try {
                const p = video.play();
                if (p && typeof p.then === 'function') {
                  p.then(() => {
                    // Restaurar estado de som pretendido após recuperar
                    try {
                      const targetMuted = desiredMutedRef.current === true;
                      video.muted = targetMuted;
                      video.volume = targetMuted ? 0 : 1;
                    } catch {}
                  }).catch(() => {});
                }
              } catch {}
            }
          } catch {}
          // Adiar propagação do erro; cancelar se o vídeo recuperar
          if (errorDelayTimer) { try { clearTimeout(errorDelayTimer); } catch {} }
          errorDelayTimer = setTimeout(() => {
            errorDelayTimer = null;
            try { onError?.(e); } catch {}
          }, 1200);
        };

        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('canplay', handleCanPlay);
        video.addEventListener('canplaythrough', handleCanPlayThrough);
        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('error', handleError);
        // Em mobile, anexar fallback de loop manual (caso não seja HLS ou attachHls não o faça)
        attachManualLoop();

        // Ativar HLS para mobile
        attachHls();

        return () => {
          video.removeEventListener('loadedmetadata', handleLoadedMetadata);
          video.removeEventListener('canplay', handleCanPlay);
          video.removeEventListener('canplaythrough', handleCanPlayThrough);
          video.removeEventListener('play', handlePlay);
          video.removeEventListener('pause', handlePause);
          video.removeEventListener('error', handleError);
          detachManualLoop();
          try { if (hlsInstance) { hlsInstance.destroy?.(); } } catch {}
          if (errorDelayTimer) { try { clearTimeout(errorDelayTimer); } catch {} }
        };
             } else {
         // Desktop - otimizações básicas
         video.preload = preload;
         // Ativar HLS para desktop
         attachHls();
        const onLoadedMeta = () => {
          applyResumeTime();
          try {
            // Garantir que as legendas ficam visíveis também em desktop
            const tracks = video.textTracks;
            if (tracks && tracks.length > 0) {
              for (let i = 0; i < tracks.length; i++) {
                tracks[i].mode = 'showing';
              }
            }
          } catch {}
        };
        const onCanPlay = () => {
          applyResumeTime();
          try {
            const tracks = video.textTracks;
            if (tracks && tracks.length > 0) {
              for (let i = 0; i < tracks.length; i++) {
                tracks[i].mode = 'showing';
              }
            }
          } catch {}
        };
        const onPlayDesktop = () => {
          try {
            const tracks = video.textTracks;
            if (tracks && tracks.length > 0) {
              for (let i = 0; i < tracks.length; i++) {
                tracks[i].mode = 'showing';
              }
            }
          } catch {}
        };
         video.addEventListener('loadedmetadata', onLoadedMeta);
         video.addEventListener('canplay', onCanPlay);
        video.addEventListener('play', onPlayDesktop);
        // Em desktop Android/Chromium com HLS via MSE também pode falhar loop
        attachManualLoop();
         return () => {
           video.removeEventListener('loadedmetadata', onLoadedMeta);
           video.removeEventListener('canplay', onCanPlay);
          video.removeEventListener('play', onPlayDesktop);
          detachManualLoop();
           try { if (hlsInstance) { hlsInstance.destroy?.(); } } catch {}
         };
       }
      // Melhorar o priming para garantir que o vídeo está pronto para reprodução
      try {
        (video as any).primeForPlay = async () => {
          try {
            // Se já está pronto, retornar
            if (video.readyState >= 3) return true;
            
            // Esperar até que o vídeo esteja pronto
            await new Promise<void>((resolve) => {
              if (video.readyState >= 3) {
                resolve();
                return;
              }
              
              const handleCanPlay = () => {
                video.removeEventListener('canplay', handleCanPlay);
                resolve();
              };
              
              video.addEventListener('canplay', handleCanPlay);
            });

            // Tentar play/pause rápido para garantir que o browser está pronto
            const wasMuted = video.muted;
            video.muted = true;
            
            try {
              await video.play();
              video.pause();
              video.muted = wasMuted;
              return true;
            } catch (error) {
              video.muted = wasMuted;
              return false;
            }
          } catch {
            return false;
          }
        };
      } catch {}
    }, [normalizedSrc]);

    // Aplicar resumeTime sem reanexar HLS nem reatribuir src (evita resets no iOS)
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      try {
        const t = typeof resumeTime === 'number' ? resumeTime : undefined;
        if (typeof t === 'number' && t > 0) {
          const diff = Math.abs(((video.currentTime || 0) - t));
          if (diff > 0.2) {
            video.currentTime = t;
          }
        }
      } catch {}
    }, [resumeTime, normalizedSrc]);

    // Combinar refs
    const combinedRef = (node: HTMLVideoElement) => {
      videoRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };

    return (
      <video
        ref={combinedRef}
        className={className}
        src={normalizedSrc}
        muted={muted}
        loop={loop}
        preload={preload}
        playsInline={playsInline}
        // Evitar CORS quando reproduzindo HLS externo
        crossOrigin={normalizedSrc.includes('videodelivery.net/') ? undefined : crossOrigin}
        autoPlay={autoPlay}
        style={style}
        {...props}
      >
        {children}
      </video>
    );
  }
);

MobileOptimizedVideo.displayName = 'MobileOptimizedVideo';

export default MobileOptimizedVideo;
