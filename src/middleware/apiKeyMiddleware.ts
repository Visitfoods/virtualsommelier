import { NextRequest, NextResponse } from 'next/server';
import { ApiKey } from '../types/apiKey';
import { apiKeyService } from '../services/apiKeyService';

// Interface para request com dados de API Key
export interface ApiKeyRequest extends NextRequest {
  apiKey?: ApiKey;
  isAuthenticated: boolean;
}

// Middleware de autenticação por API Key
export class ApiKeyMiddleware {
  
  // Verificar se a requisição tem uma API Key válida
  static async authenticate(request: NextRequest): Promise<ApiKeyRequest> {
    const apiKeyRequest = request as ApiKeyRequest;
    
    try {
      // 1. Extrair API Key do header Authorization
      const apiKeyHeader = request.headers.get('x-api-key') || request.headers.get('authorization');
      if (!apiKeyHeader) {
        apiKeyRequest.isAuthenticated = false;
        return apiKeyRequest;
      }

      // Remover prefixo "Bearer " se existir
      const apiKey = apiKeyHeader.startsWith('Bearer ') 
        ? apiKeyHeader.substring(7) 
        : apiKeyHeader;
      
      // 2. Validar a API Key
      const validationResult = apiKeyService.validateApiKey(apiKey);
      
      if (!validationResult.valid || !validationResult.apiKey) {
        apiKeyRequest.isAuthenticated = false;
        return apiKeyRequest;
      }

      // 3. API Key válida
      apiKeyRequest.apiKey = validationResult.apiKey;
      apiKeyRequest.isAuthenticated = true;
      
      return apiKeyRequest;

    } catch (error) {
      console.error('Erro na autenticação por API Key:', error);
      apiKeyRequest.isAuthenticated = false;
      return apiKeyRequest;
    }
  }

  // Middleware para verificar autenticação obrigatória
  static requireAuth() {
    return async (request: NextRequest): Promise<NextResponse | null> => {
      const apiKeyRequest = await this.authenticate(request);
      
      if (!apiKeyRequest.isAuthenticated) {
        return NextResponse.json(
          { error: 'API Key inválida ou não fornecida' },
          { status: 401 }
        );
      }

      return null; // Continuar com o request
    };
  }

  // Middleware para verificar role específico
  static requireRole(requiredRole: 'user' | 'admin') {
    return async (request: NextRequest): Promise<NextResponse | null> => {
      const apiKeyRequest = await this.authenticate(request);
      
      if (!apiKeyRequest.isAuthenticated) {
        return NextResponse.json(
          { error: 'API Key inválida ou não fornecida' },
          { status: 401 }
        );
      }

      if (apiKeyRequest.apiKey && apiKeyRequest.apiKey.role !== requiredRole && apiKeyRequest.apiKey.role !== 'admin') {
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
      const apiKeyRequest = await this.authenticate(request);
      
      if (!apiKeyRequest.isAuthenticated) {
        return NextResponse.json(
          { error: 'API Key inválida ou não fornecida' },
          { status: 401 }
        );
      }

      if (apiKeyRequest.apiKey) {
        // Admins têm acesso a todos os guias
        if (apiKeyRequest.apiKey.role === 'admin') {
          return null;
        }

        // Utilizadores normais só têm acesso ao seu guia
        if (apiKeyRequest.apiKey.role === 'user' && apiKeyRequest.apiKey.guideSlug === guideSlug) {
          return null;
        }
      }

      return NextResponse.json(
        { error: 'Acesso negado a este guia' },
        { status: 403 }
      );
    };
  }

  // Middleware para verificar escopos específicos
  static requireScopes(scopes: string[]) {
    return async (request: NextRequest): Promise<NextResponse | null> => {
      const apiKeyRequest = await this.authenticate(request);
      
      if (!apiKeyRequest.isAuthenticated) {
        return NextResponse.json(
          { error: 'API Key inválida ou não fornecida' },
          { status: 401 }
        );
      }

      if (apiKeyRequest.apiKey) {
        // Verificar se a API Key tem todos os escopos necessários
        const hasAllScopes = scopes.every(scope => 
          apiKeyRequest.apiKey?.scopes.includes(scope) || apiKeyRequest.apiKey?.scopes.includes('*')
        );

        if (!hasAllScopes) {
          return NextResponse.json(
            { error: 'Escopos insuficientes' },
            { status: 403 }
          );
        }
      }

      return null; // Continuar com o request
    };
  }

  // Middleware para logging de acesso
  static logAccess() {
    return async (request: NextRequest): Promise<NextResponse | null> => {
      const apiKeyRequest = await this.authenticate(request);
      
      // Log do acesso (em produção, isto iria para um sistema de logging)
      
      
      return null; // Continuar com o request
    };
  }
}

// Funções de conveniência para uso direto
export const requireApiKeyAuth = () => ApiKeyMiddleware.requireAuth();
export const requireApiKeyAdmin = () => ApiKeyMiddleware.requireAdmin();
export const requireApiKeyUser = () => ApiKeyMiddleware.requireUser();
export const requireApiKeyGuideAccess = (guideSlug: string) => ApiKeyMiddleware.requireGuideAccess(guideSlug);
export const requireApiKeyScopes = (scopes: string[]) => ApiKeyMiddleware.requireScopes(scopes);
