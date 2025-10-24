import { ApiKey } from '../types/apiKey';

// Obtém a chave API das variáveis de ambiente
export const getApiKey = (): string | undefined => {
  const fromEnv = process.env.NEXT_PUBLIC_API_KEY;
  if (fromEnv && fromEnv.trim() !== '') return fromEnv;
  // Fallback apenas em desenvolvimento
  if (process.env.NODE_ENV !== 'production') return 'dev-local-api-key';
  return undefined;
};

// Headers padrão para todas as requisições que precisam de autenticação
export const getAuthHeaders = (): Record<string, string> => {
  const apiKey = getApiKey();
  return apiKey ? { 'x-api-key': apiKey } : {};
};

// Função auxiliar para adicionar headers de autenticação ao fetch
export const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const headers = {
    ...options.headers,
  };

  // Só adicionar headers de autenticação se for para o nosso servidor
  if (url.startsWith('/api/') || url.includes('virtualguide.info')) {
    const authHeaders = getAuthHeaders();
    Object.assign(headers, authHeaders);
  }

  return fetch(url, { ...options, headers });
};

// Classe de serviço para API Keys
export class ApiKeyService {
  // Validação simples de API Key (em produção, usar base de dados)
  static validateApiKey(apiKey: string): { valid: boolean; apiKey?: ApiKey } {
    // Para desenvolvimento, aceitar qualquer API key não vazia
    if (!apiKey || apiKey.trim() === '') {
      return { valid: false };
    }

    // Em produção, validar contra base de dados
    // Por agora, aceitar qualquer string não vazia
    const mockApiKey: ApiKey = {
      id: 'dev-key',
      key: apiKey,
      name: 'Development Key',
      prefix: 'dev',
      role: 'admin',
      createdAt: Date.now(),
      expiresAt: undefined,
      lastUsed: undefined,
      enabled: true,
      scopes: ['*'],
      metadata: {},
      createdBy: 'system',
      guideSlug: undefined
    };

    return { valid: true, apiKey: mockApiKey };
  }

  // Verificar se API Key tem escopo específico
  static hasScope(apiKey: ApiKey, scope: string): boolean {
    return apiKey.scopes.includes('*') || apiKey.scopes.includes(scope);
  }

  // Verificar se API Key tem role específico
  static hasRole(apiKey: ApiKey, role: string): boolean {
    return apiKey.role === 'admin' || apiKey.role === role;
  }
}

// Exportar instância do serviço
export const apiKeyService = ApiKeyService;