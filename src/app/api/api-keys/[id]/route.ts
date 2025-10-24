import { NextRequest, NextResponse } from 'next/server';
import { apiKeyService } from '@/services/apiKeyService';
import { requireApiKeyAdmin } from '@/middleware/apiKeyMiddleware';
import { strictRateLimit } from '@/middleware/rateLimitMiddleware';
import { ApiKeyRequest } from '@/middleware/apiKeyMiddleware';

// Obter uma API Key específica
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    
    const id = params.id;
    
    // Obter a API Key
    const apiKey = apiKeyService.getApiKeyById(id);
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API Key não encontrada' },
        { status: 404 }
      );
    }
    
    // Remover o hash da chave para não expor
    const { key: _, ...safeKey } = apiKey;
    
    return NextResponse.json({ 
      success: true, 
      apiKey: safeKey 
    });
    
  } catch (error) {
    console.error('Erro ao obter API Key:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// Atualizar uma API Key
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    
    const id = params.id;
    
    // Verificar se a API Key existe
    const existingApiKey = apiKeyService.getApiKeyById(id);
    if (!existingApiKey) {
      return NextResponse.json(
        { error: 'API Key não encontrada' },
        { status: 404 }
      );
    }
    
    // Obter dados da requisição
    const body = await request.json();
    const { name, role, expiresAt, enabled, scopes, metadata, guideSlug } = body;
    
    // Atualizar a API Key
    const updatedApiKey = apiKeyService.updateApiKey(id, {
      name,
      role,
      expiresAt,
      enabled,
      scopes,
      metadata: {
        ...metadata,
        updatedByApiKeyId: adminApiKey?.id || 'unknown',
        updatedAt: Date.now()
      },
      guideSlug
    });
    
    if (!updatedApiKey) {
      return NextResponse.json(
        { error: 'Erro ao atualizar API Key' },
        { status: 500 }
      );
    }
    
    // Remover o hash da chave para não expor
    const { key: _, ...safeKey } = updatedApiKey;
    
    return NextResponse.json({
      success: true,
      message: 'API Key atualizada com sucesso',
      apiKey: safeKey
    });
    
  } catch (error) {
    console.error('Erro ao atualizar API Key:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// Revogar uma API Key
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    
    const id = params.id;
    
    // Verificar se a API Key existe
    const existingApiKey = apiKeyService.getApiKeyById(id);
    if (!existingApiKey) {
      return NextResponse.json(
        { error: 'API Key não encontrada' },
        { status: 404 }
      );
    }
    
    // Revogar a API Key
    const revoked = apiKeyService.revokeApiKey(id);
    
    if (!revoked) {
      return NextResponse.json(
        { error: 'Erro ao revogar API Key' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'API Key revogada com sucesso'
    });
    
  } catch (error) {
    console.error('Erro ao revogar API Key:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
