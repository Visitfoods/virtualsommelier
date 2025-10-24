'use client';

import { useState, useEffect } from 'react';
import styles from './OrientationWarning.module.css';

export default function OrientationWarning() {
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    const checkKeyboardOpen = () => {
      try {
        const currentHeight = window.innerHeight;
        const screenHeight = window.screen.height;
        const ua = navigator.userAgent.toLowerCase();
        const isIOS = ua.includes('iphone') || ua.includes('ipad');
        const isFirefoxIOS = ua.includes('firefox') && isIOS;

        // 1) Apenas considerar teclado se houver foco num campo de edição
        const active = document.activeElement as (HTMLElement | null);
        const isEditable = Boolean(
          active && (
            active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            active.isContentEditable === true
          )
        );
        if (!isEditable) return false;

        // 2) Tentar visualViewport (Safari/Chrome iOS)
        const vv = (window as any).visualViewport;
        if (vv) {
          const heightDiff = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
          if (heightDiff > 80) return true;
        }

        // 3) Fallback por ratio de altura
        const heightRatio = currentHeight / screenHeight;
        const ratioThreshold = isFirefoxIOS ? 0.82 : (isIOS ? 0.85 : 0.80);
        return heightRatio < ratioThreshold;
      } catch {
        return false;
      }
    };

    const checkOrientation = () => {
      // Reativar detecção de teclado com limites ajustados
      const keyboardOpen = checkKeyboardOpen();
      
      if (keyboardOpen) {
        setShowWarning(false);
        return;
      }

      // Verificar se é tablet, smartphone ou tablet em modo PC
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isLandscape = height < width;
      
      // Detectar se é tablet em modo PC (Android com hover e touch)
      const isAndroidPcMode = () => {
        try {
          const ua = navigator.userAgent.toLowerCase();
          const isAndroid = /android/.test(ua);
          const isMobileUA = /mobile/.test(ua);
          const hasTouch = (navigator as any).maxTouchPoints > 0;
          const hoverFine = window.matchMedia?.('(hover: hover)').matches && window.matchMedia?.('(pointer: fine)').matches;
          const looksTablet = width >= 768 && width <= 1297;
          return isAndroid && !isMobileUA && hasTouch && hoverFine && looksTablet;
        } catch {
          return false;
        }
      };
      
      // Mostrar aviso se:
      // 1. É mobile/tablet normal (largura <= 1024px) E está em landscape
      // 2. É tablet em modo PC E está em landscape
      const isMobileOrTablet = width <= 1297;
      const isTabletPcMode = isAndroidPcMode();
      
      if ((isMobileOrTablet || isTabletPcMode) && isLandscape) {
        setShowWarning(true);
      } else {
        setShowWarning(false);
      }
    };

    // Verificar na montagem
    checkOrientation();

    // Verificar quando a orientação muda
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    
    // Verificar quando elementos ganham/perdem foco (teclado abre/fecha)
    window.addEventListener('focusin', checkOrientation);
    window.addEventListener('focusout', checkOrientation);
    
    // Verificar mudanças no visualViewport (Safari/Chrome iOS)
    const vv = (window as any).visualViewport;
    if (vv) {
      vv.addEventListener('resize', checkOrientation);
      vv.addEventListener('scroll', checkOrientation);
    }

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
      window.removeEventListener('focusin', checkOrientation);
      window.removeEventListener('focusout', checkOrientation);
      
      if (vv) {
        vv.removeEventListener('resize', checkOrientation);
        vv.removeEventListener('scroll', checkOrientation);
      }
    };
  }, []);

  if (!showWarning) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.container}>
        <div className={styles.icon}>
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 3H15C16.1046 3 17 3.89543 17 5V19C17 20.1046 16.1046 21 15 21H9C7.89543 21 7 20.1046 7 19V5C7 3.89543 7.89543 3 9 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 17V17.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 7V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 className={styles.title}>Gire o seu dispositivo</h1>
        <p className={styles.message}>
          Para uma melhor experiência, visualize o website na orientação vertical
        </p>
        <div className={styles.arrow}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 5V19M12 19L19 12M12 19L5 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    </div>
  );
}
