"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { SessionService } from '../services/sessionService';
import { UserSession, LoginCredentials, LoginResponse } from '../types/session';

interface AuthContextType {
  user: Record<string, unknown> | null;
  session: UserSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<LoginResponse>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [session, setSession] = useState<UserSession | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkExistingSession();
  }, []);

  const checkExistingSession = async () => {
    try {
      setIsLoading(true);
      // Tentar recuperar sessão do localStorage
      const raw = typeof window !== 'undefined' ? localStorage.getItem('sessionData') : null;
      const rawUser = typeof window !== 'undefined' ? localStorage.getItem('userData') : null;
      if (!raw) {
        setIsAuthenticated(false);
        setUser(null);
        setSession(null);
        return;
      }

      let parsed: { sessionId?: string; token?: string } | null = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }

      if (!parsed?.sessionId || !parsed?.token) {
        setIsAuthenticated(false);
        setUser(null);
        setSession(null);
        return;
      }

      // Em vez de validar no Firestore (bloqueado por regras sem auth), confiar no armazenamento local
      // e no middleware para proteger rotas. Recuperar user do localStorage.
      let cachedUser: { id?: string; username?: string; role?: string; guideSlug?: string } | null = null;
      try {
        cachedUser = rawUser ? JSON.parse(rawUser) : null;
      } catch {
        cachedUser = null;
      }

      setSession({
        id: parsed.sessionId,
        userId: cachedUser?.id || '',
        username: cachedUser?.username || '',
        role: (cachedUser?.role as any) || 'user',
        isActive: true,
        createdAt: undefined as unknown as any,
        lastActivity: undefined as unknown as any,
        expiresAt: undefined as unknown as any,
        tokenHash: ''
      } as unknown as UserSession);
      setUser({ id: cachedUser?.id || '', username: cachedUser?.username || '', role: cachedUser?.role || 'user', guideSlug: cachedUser?.guideSlug } as Record<string, unknown>);
      setIsAuthenticated(true);
      return;
    } catch (error: unknown) {
      console.error('Erro ao verificar sessão:', error);
      clearSessionData();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (credentials: LoginCredentials): Promise<LoginResponse> => {
    try {
      setIsLoading(true);
      const response: LoginResponse = await SessionService.login(credentials);
      
      if (response.success && response.session && response.user) {
        setUser(response.user as Record<string, unknown>);
        setSession(response.session);
        setIsAuthenticated(true);
        
        if (response.session.id && response.token) {
          saveSessionData(response.session.id, response.token);
        }
        // Guardar também os dados do utilizador para restauro imediato
        try {
          const userData = {
            id: (response.user as any).id,
            username: (response.user as any).username,
            role: (response.user as any).role,
            guideSlug: (response.user as any).guideSlug
          };
          localStorage.setItem('userData', JSON.stringify(userData));
        } catch (e) {
          console.error('Erro ao guardar userData:', e);
        }
        return response;
      } else {
        setError(response.error || 'Erro no login');
        return response;
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      setIsLoading(true);

      // Obter dados da sessão local para informar o backend
      let sessionId: string | undefined;
      let token: string | undefined;
      try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem('sessionData') : null;
        if (raw) {
          const parsed = JSON.parse(raw) as { sessionId?: string; token?: string };
          sessionId = parsed?.sessionId;
          token = parsed?.token;
        }
      } catch {}

      // Chamar a rota de logout no servidor para encerrar active_sessions
      try {
        await fetch('/api/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, token })
        });
      } catch {
        // Ignorar erros do backend, continuar com cleanup local
      }

      // Limpeza local e atualização de estado
      setUser(null);
      setSession(null);
      setIsAuthenticated(false);
      clearSessionData();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshSession = async (): Promise<void> => {
    try {
      setIsLoading(true);
      // Implementar refresh de sessão aqui
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setError(errorMessage);
      clearSessionData();
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  const saveSessionData = (sessionId: string, token: string) => {
    try {
      const sessionData = {
        sessionId,
        token,
        timestamp: Date.now()
      };
      localStorage.setItem('sessionData', JSON.stringify(sessionData));
      // Também persistir em cookie para o middleware
      try {
        const expires = new Date(Date.now() + 25 * 60 * 60 * 1000); // 25h conforme middleware tolerância
        const cookieValue = encodeURIComponent(JSON.stringify(sessionData));
        document.cookie = `sessionData=${cookieValue};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
      } catch (cookieError) {
        console.error('Erro ao definir cookie da sessão:', cookieError);
      }
    } catch (error) {
      console.error('Erro ao guardar dados da sessão:', error);
    }
  };

  const clearSessionData = () => {
    try {
      localStorage.removeItem('sessionData');
      try { localStorage.removeItem('userData'); } catch {}
      // Limpar cookie usado pelo middleware
      try {
        document.cookie = 'sessionData=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax';
      } catch (cookieError) {
        console.error('Erro ao limpar cookie da sessão:', cookieError);
      }
    } catch (error) {
      console.error('Erro ao limpar dados da sessão:', error);
    }
  };

  const contextValue = {
    user,
    session,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    refreshSession,
    clearError
  };

  return React.createElement(
    AuthContext.Provider,
    { value: contextValue },
    children
  );
};