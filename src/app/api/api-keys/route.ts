import { NextRequest, NextResponse } from 'next/server';
import { apiKeyService } from '@/services/apiKeyService';
import { requireApiKeyAdmin } from '@/middleware/apiKeyMiddleware';
import { strictRateLimit } from '@/middleware/rateLimitMiddleware';
import { ApiKeyRequest } from '@/middleware/apiKeyMiddleware';
import { CreateApiKeyOptions } from '@/types/apiKey';

// Listar todas as API Keys
export async function GET(request: NextRequest) {
  try {
    // Aplicar rate limiting
    const rateLimitResult = await strictRateLimit()(request);
    if (rateLimitResult) {
      return rateLimitResult;
    }
    
    // Verificar autenticação (apenas admin)
    const authResult = await requireApiKeyAdmin()(request);
    if (authResult) {
      return authResult;
    }
    
    // Obter todas as API Keys (sem as chaves secretas)
    const apiKeys = apiKeyService.getAllApiKeys().map(key => {
      // Remover o hash da chave para não expor
      const { key: _, ...safeKey } = key;
      return safeKey;
    });
    
    return NextResponse.json({ 
      success: true, 
      apiKeys 
    });
    
  } catch (error) {
    console.error('Erro ao listar API Keys:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// Criar nova API Key
export async function POST(request: NextRequest) {
  try {
    // Aplicar rate limiting
    const rateLimitResult = await strictRateLimit()(request);
    if (rateLimitResult) {
      return rateLimitResult;
    }
    
    // Verificar autenticação (apenas admin)
    const authResult = await requireApiKeyAdmin()(request);
    if (authResult) {
      return authResult;
    }
    
    // Obter informações da API Key autenticada
    const apiKeyRequest = request as ApiKeyRequest;
    const adminApiKey = apiKeyRequest.apiKey;
    
    // Obter dados da requisição
    const body = await request.json();
    const { name, role, expiresIn, scopes, metadata, guideSlug } = body as CreateApiKeyOptions;
    
    if (!name || !role) {
      return NextResponse.json(
        { error: 'Nome e papel são obrigatórios' },
        { status: 400 }
      );
    }
    
    // Validar papel
    if (role !== 'user' && role !== 'admin') {
      return NextResponse.json(
        { error: 'Papel inválido. Deve ser "user" ou "admin"' },
        { status: 400 }
      );
    }
    
    // Criar a API Key
    const options: CreateApiKeyOptions = {
      name,
      role,
      expiresIn,
      scopes: scopes || [],
      metadata: {
        ...metadata,
        createdByApiKeyId: adminApiKey?.id || 'unknown'
      },
      createdBy: adminApiKey?.name || 'unknown',
      guideSlug
    };
    
    const result = apiKeyService.createApiKey(options);
    
    // Retornar a API Key completa (só será mostrada uma vez)
    return NextResponse.json({
      success: true,
      message: 'API Key criada com sucesso',
      apiKey: {
        id: result.apiKey.id,
        name: result.apiKey.name,
        prefix: result.apiKey.prefix,
        role: result.apiKey.role,
        createdAt: result.apiKey.createdAt,
        expiresAt: result.apiKey.expiresAt,
        enabled: result.apiKey.enabled,
        scopes: result.apiKey.scopes,
        guideSlug: result.apiKey.guideSlug
      },
      secretKey: result.secretKey,
      warning: 'IMPORTANTE: Guarde esta chave! Ela não será mostrada novamente.'
    });
    
  } catch (error) {
    console.error('Erro ao criar API Key:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
