export const runtime = "nodejs";
import { NextRequest, NextResponse } from 'next/server';
import { closeGuideConversation, sendGuideMessage } from '../../../firebase/guideServices';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, conversationId, message, action } = body || {};

    if (!projectId || !conversationId) {
      return NextResponse.json({ error: 'projectId e conversationId são obrigatórios' }, { status: 400 });
    }

    if (action === 'close_session') {
      // Mensagem opcional de despedida
      if (message) {
        await sendGuideMessage(projectId, conversationId, {
          from: 'guide',
          text: message,
          metadata: { guideResponse: true }
        });
      }

      // Encerrar conversa
      await closeGuideConversation(projectId, conversationId, 'user', 'Fechada via beacon', 'pt');

      return NextResponse.json({ success: true, conversationId });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    console.error('Erro ao encerrar sessão do guia:', error);
    return NextResponse.json({ error: 'Falha ao encerrar sessão do guia' }, { status: 500 });
  }
}


