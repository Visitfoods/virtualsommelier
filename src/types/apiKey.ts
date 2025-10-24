/**
 * Tipos para o sistema de API Keys
 */

/**
 * Representa uma API Key no sistema
 */
export interface ApiKey {
  id: string;         // Identificador único da chave (UUID)
  key: string;        // A chave em si (hash)
  name: string;       // Nome descritivo da chave
  prefix: string;     // Prefixo da chave (visível, para identificação)
  role: 'user' | 'admin'; // Papel associado à chave
  createdAt: number;  // Data de criação (timestamp)
  expiresAt?: number; // Data de expiração (timestamp, opcional)
  lastUsed?: number;  // Último uso (timestamp)
  enabled: boolean;   // Se a chave está ativa
  scopes: string[];   // Permissões específicas da chave
  metadata?: Record<string, any>; // Metadados adicionais
  createdBy?: string; // Quem criou a chave
  guideSlug?: string; // Para chaves específicas de um guia
}

/**
 * Representa uma API Key com a chave completa (apenas usada durante a criação)
 */
export interface ApiKeyWithSecret {
  apiKey: ApiKey;
  secretKey: string; // A chave completa (mostrada apenas uma vez)
}

/**
 * Opções para criar uma nova API Key
 */
export interface CreateApiKeyOptions {
  name: string;
  role: 'user' | 'admin';
  expiresIn?: number; // Tempo de expiração em segundos
  scopes?: string[];
  metadata?: Record<string, any>;
  createdBy?: string;
  guideSlug?: string;
}

/**
 * Opções para validar uma API Key
 */
export interface ValidateApiKeyOptions {
  requiredRole?: 'user' | 'admin';
  requiredScopes?: string[];
}

/**
 * Resultado da validação de uma API Key
 */
export interface ApiKeyValidationResult {
  valid: boolean;
  apiKey?: ApiKey;
  error?: string;
}
