import { NextRequest, NextResponse } from 'next/server';
import { closeConversation, sendMessage } from '../../../firebase/services';
import { requireApiKeyAuth } from '@/middleware/apiKeyMiddleware';
import { standardRateLimit } from '@/middleware/rateLimitMiddleware';

export async function POST(request: NextRequest) {
  try {
    // Aplicar rate limiting
    const rateLimitResult = await standardRateLimit()(request);
    if (rateLimitResult) {
      return rateLimitResult;
    }
    
    // Verificar autenticação via API Key
    const authResult = await requireApiKeyAuth()(request);
    if (authResult) {
      return authResult;
    }

    const body = await request.json();
    const { conversationId, message, action } = body;

    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
    }

    if (action === 'close_session') {
      // Enviar mensagem de despedida
      if (message) {
        await sendMessage(conversationId, {
          from: 'agent',
          text: message,
          read: true
        });
      }

      // Encerrar a conversa
      await closeConversation(conversationId);


      
      return NextResponse.json({ 
        success: true, 
        message: 'Session closed successfully',
        conversationId 
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Erro ao encerrar sessão:', error);
    return NextResponse.json({ 
      error: 'Failed to close session' 
    }, { status: 500 });
  }
} 