import { NextRequest, NextResponse } from 'next/server';
import { SessionService } from '../services/sessionService';
import { UserSession } from '../types/session';

// Interface para request com dados de autenticação
export interface AuthenticatedRequest extends NextRequest {
  user?: UserSession;
  isAuthenticated: boolean;
}

// Middleware de autenticação
export class AuthMiddleware {
  
  // Verificar se o utilizador está autenticado
  static async authenticate(request: NextRequest): Promise<AuthenticatedRequest> {
    const authRequest = request as AuthenticatedRequest;
    
    try {
      // 1. Extrair token do header Authorization
      const authHeader = request.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        authRequest.isAuthenticated = false;
        return authRequest;
      }

      const token = authHeader.substring(7); // Remover "Bearer "
      
      // 2. Extrair sessionId do header X-Session-ID
      const sessionId = request.headers.get('x-session-id');
      if (!sessionId) {
        authRequest.isAuthenticated = false;
        return authRequest;
      }

      // 3. Validar sessão
      const session = await SessionService.validateSession(sessionId, token);
      if (!session) {
        authRequest.isAuthenticated = false;
        return authRequest;
      }

      // 4. Sessão válida
      authRequest.user = session;
      authRequest.isAuthenticated = true;
      
      return authRequest;

    } catch (error) {
      console.error('Erro na autenticação:', error);
      authRequest.isAuthenticated = false;
      return authRequest;
    }
  }

  // Middleware para verificar autenticação obrigatória
  static requireAuth() {
    return async (request: NextRequest): Promise<NextResponse | null> => {
      const authRequest = await this.authenticate(request);
      
      if (!authRequest.isAuthenticated) {
        return NextResponse.json(
          { error: 'Autenticação obrigatória' },
          { status: 401 }
        );
      }

      return null; // Continuar com o request
    };
  }

  // Middleware para verificar role específico
  static requireRole(requiredRole: 'user' | 'admin') {
    return async (request: NextRequest): Promise<NextResponse | null> => {
      const authRequest = await this.authenticate(request);
      
      if (!authRequest.isAuthenticated) {
        return NextResponse.json(
          { error: 'Autenticação obrigatória' },
          { status: 401 }
        );
      }

      if (authRequest.user && authRequest.user.role !== requiredRole && authRequest.user.role !== 'admin') {
        return NextResponse.json(
          { error: 'Permissões insuficientes' },
          { status: 403 }
        );
      }

      return null; // Continuar com o request
    };
  }

  // Middleware para verificar se é admin
  static requireAdmin() {
    return this.requireRole('admin');
  }

  // Middleware para verificar se é utilizador normal
  static requireUser() {
    return this.requireRole('user');
  }

  // Middleware para verificar se tem acesso a um guia específico
  static requireGuideAccess(guideSlug: string) {
    return async (request: NextRequest): Promise<NextResponse | null> => {
      const authRequest = await this.authenticate(request);
      
      if (!authRequest.isAuthenticated) {
        return NextResponse.json(
          { error: 'Autenticação obrigatória' },
          { status: 401 }
        );
      }

      if (authRequest.user) {
        // Admins têm acesso a todos os guias
        if (authRequest.user.role === 'admin') {
          return null;
        }

        // Utilizadores normais só têm acesso ao seu guia
        if (authRequest.user.role === 'user' && authRequest.user.guideSlug === guideSlug) {
          return null;
        }
      }

      return NextResponse.json(
        { error: 'Acesso negado a este guia' },
        { status: 403 }
      );
    };
  }

  // Middleware para verificar se é o próprio utilizador ou admin
  static requireOwnershipOrAdmin(userId: string) {
    return async (request: NextRequest): Promise<NextResponse | null> => {
      const authRequest = await this.authenticate(request);
      
      if (!authRequest.isAuthenticated) {
        return NextResponse.json(
          { error: 'Autenticação obrigatória' },
          { status: 401 }
        );
      }

      if (authRequest.user) {
        // Admins têm acesso a tudo
        if (authRequest.user.role === 'admin') {
          return null;
        }

        // Utilizadores só têm acesso aos seus próprios dados
        if (authRequest.user.userId === userId) {
          return null;
        }
      }

      return NextResponse.json(
        { error: 'Acesso negado a estes dados' },
        { status: 403 }
      );
    };
  }

  // Middleware para verificar se a sessão não expirou
  static checkSessionExpiry() {
    return async (request: NextRequest): Promise<NextResponse | null> => {
      const authRequest = await this.authenticate(request);
      
      if (authRequest.isAuthenticated && authRequest.user) {
        const now = new Date();
        const expiryDate = authRequest.user.expiresAt.toDate();
        
        if (now >= expiryDate) {
          // Sessão expirada, fazer logout automático
          if (authRequest.user.id) {
            await SessionService.logoutSession(authRequest.user.id);
          }
          
          return NextResponse.json(
            { error: 'Sessão expirada', code: 'SESSION_EXPIRED' },
            { status: 401 }
          );
        }
      }

      return null; // Continuar com o request
    };
  }

  // Middleware para logging de acesso
  static logAccess() {
    return async (request: NextRequest): Promise<NextResponse | null> => {
      const authRequest = await this.authenticate(request);
      
      // Log do acesso (em produção, isto iria para um sistema de logging)
      
      
      return null; // Continuar com o request
    };
  }

  // Middleware combinado para rotas protegidas
  static protectedRoute(requiredRole?: 'user' | 'admin') {
    return async (request: NextRequest): Promise<NextResponse | null> => {
      // Aplicar todos os middlewares necessários
      const middlewares = [
        this.authenticate,
        this.checkSessionExpiry,
        this.logAccess
      ];

      // Adicionar middleware de role se especificado
      if (requiredRole) {
        middlewares.push(requiredRole === 'admin' ? this.requireAdmin : this.requireUser);
      } else {
        middlewares.push(this.requireAuth);
      }

      // Executar middlewares em sequência
      for (const middleware of middlewares) {
        const result = await middleware(request);
        if (result) {
          return result; // Middleware bloqueou o request
        }
      }

      return null; // Todos os middlewares passaram
    };
  }
}

// Funções de conveniência para uso direto
export const requireAuth = () => AuthMiddleware.requireAuth();
export const requireAdmin = () => AuthMiddleware.requireAdmin();
export const requireUser = () => AuthMiddleware.requireUser();
export const requireGuideAccess = (guideSlug: string) => AuthMiddleware.requireGuideAccess(guideSlug);
export const requireOwnershipOrAdmin = (userId: string) => AuthMiddleware.requireOwnershipOrAdmin(userId);
export const protectedRoute = (requiredRole?: 'user' | 'admin') => AuthMiddleware.protectedRoute(requiredRole);

