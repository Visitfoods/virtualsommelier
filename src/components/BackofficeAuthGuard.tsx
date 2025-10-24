'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';

interface BackofficeAuthGuardProps {
  children: React.ReactNode;
  requiredRole?: 'user' | 'admin';
}

export default function BackofficeAuthGuard({ children, requiredRole }: BackofficeAuthGuardProps) {
  const { isAuthenticated, user, isLoading } = useAuth();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Se já estiver autenticado e tiver user, parar de verificar
    if (isAuthenticated && user) {
      // Verificar role se especificado
      if (requiredRole && user.role !== requiredRole && user.role !== 'admin') {
        router.replace('/backoffice/login');
        return;
      }
      
      // Sessão válida, continuar
      setIsChecking(false);
      return;
    }

    // Se não estiver carregando e não estiver autenticado, redirecionar
    if (!isLoading && !isAuthenticated) {
      router.replace('/backoffice/login');
      return;
    }

    // Removido timeout agressivo de redirecionamento automático
    const timeout = setTimeout(() => {
      setIsChecking(false);
    }, 1500);

    return () => clearTimeout(timeout);
  }, [isAuthenticated, user, isLoading, requiredRole, router]);

  // Mostrar loading enquanto verifica autenticação
  if (isLoading || isChecking) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px',
        color: '#666',
        gap: '20px'
      }}>
        <div>A verificar autenticação...</div>
        <div style={{ fontSize: '14px', color: '#999' }}>
          Se demorar mais de 3 segundos, será redirecionado automaticamente
        </div>
        <div style={{ fontSize: '12px', color: '#ccc' }}>
          Debug: isLoading={isLoading.toString()}, isChecking={isChecking.toString()}
        </div>
        <button 
          onClick={() => router.push('/backoffice/login')}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Ir para Login
        </button>
      </div>
    );
  }

  // Se não estiver autenticado, redirecionar IMEDIATAMENTE
  if (!isAuthenticated || !user) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px',
        color: '#ff6b6b'
      }}>
        Redirecionando para login...
      </div>
    );
  }

  // Se não tiver o role necessário, redirecionar para uma área permitida (conversations)
  if (requiredRole && user.role !== requiredRole && user.role !== 'admin') {
    if (typeof window !== 'undefined') {
      router.replace('/backoffice/conversations');
    }
    return null;
  }

  // Renderizar conteúdo protegido
  return <>{children}</>;
}
