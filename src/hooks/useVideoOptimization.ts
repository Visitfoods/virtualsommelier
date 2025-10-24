import { useEffect, useState, useCallback } from 'react';

interface VideoOptimizationConfig {
  isMobile: boolean;
  isLowEndDevice: boolean;
  connectionType: string;
  supportsPiP: boolean;
  recommendedPreload: string;
  recommendedVolume: number;
}

export const useVideoOptimization = (): VideoOptimizationConfig => {
  const [config, setConfig] = useState<VideoOptimizationConfig>({
    isMobile: false,
    isLowEndDevice: false,
    connectionType: 'unknown',
    supportsPiP: false,
    recommendedPreload: 'auto',
    recommendedVolume: 1.0
  });

  const detectDeviceCapabilities = useCallback(() => {
    // Detectar se é mobile
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Detectar performance do dispositivo
    const isLowEndDevice = navigator.hardwareConcurrency <= 2;
    
    // Detectar tipo de conexão
    let connectionType = 'unknown';
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      connectionType = connection.effectiveType || connection.type || 'unknown';
    }
    
    // Detectar suporte a PiP
    const supportsPiP = document.pictureInPictureEnabled || 'pictureInPictureEnabled' in document;
    
    // Determinar preload recomendado
    let recommendedPreload = 'auto';
    if (isMobile && connectionType === 'slow-2g') {
      recommendedPreload = 'metadata';
    } else if (isLowEndDevice) {
      recommendedPreload = 'metadata';
    }
    
    // Determinar volume recomendado
    let recommendedVolume = 1.0;
    if (connectionType === 'slow-2g' || connectionType === '2g') {
      recommendedVolume = 0.7; // Reduzir volume para economizar
    }
    
    setConfig({
      isMobile,
      isLowEndDevice,
      connectionType,
      supportsPiP,
      recommendedPreload,
      recommendedVolume
    });

         // Configuração de otimização detectada
  }, []);

  useEffect(() => {
    detectDeviceCapabilities();
    
    // Re-detecta quando a conexão muda
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
             const handleConnectionChange = () => {
         detectDeviceCapabilities();
       };
      
      connection.addEventListener('change', handleConnectionChange);
      return () => connection.removeEventListener('change', handleConnectionChange);
    }
  }, [detectDeviceCapabilities]);

  return config;
};

// Hook específico para otimizações de PiP
export const usePiPOptimization = () => {
  const { isMobile, isLowEndDevice, connectionType, supportsPiP } = useVideoOptimization();
  
  const getPiPOptimizations = useCallback(() => {
    const optimizations = {
      preload: 'metadata' as string,
      volume: 1.0 as number,
      playbackRate: 1.0 as number,
      bufferSize: 10 as number // segundos
    };

    if (isMobile) {
      if (isLowEndDevice) {
        optimizations.volume = 0.8;
        optimizations.bufferSize = 5;
      }
      
      if (connectionType === 'slow-2g' || connectionType === '2g') {
        optimizations.volume = 0.6;
        optimizations.bufferSize = 3;
      }
    }

         return optimizations;
  }, [isMobile, isLowEndDevice, connectionType]);

  return {
    supportsPiP,
    getPiPOptimizations,
    isMobile,
    isLowEndDevice,
    connectionType
  };
};
