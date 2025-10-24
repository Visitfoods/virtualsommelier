import { NextRequest, NextResponse } from 'next/server';
import { standardRateLimit } from '@/middleware/rateLimitMiddleware';
import { requireApiKeyAuth } from '@/middleware/apiKeyMiddleware';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { app as unifiedApp } from '@/firebase/config';

const nodemailer = require('nodemailer');

export const runtime = 'nodejs';

const CENTRAL_NOTIFICATIONS_EMAIL = 'notificacoes@inovpartner.com';

const createTransporter = () => {
  const portFromEnv = parseInt(process.env.SMTP_PORT || '587');
  const secureFromEnv = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true' || portFromEnv === 465;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: portFromEnv,
    secure: secureFromEnv,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    tls: { rejectUnauthorized: false }
  });
};

export async function POST(request: NextRequest) {
  try {
    const rl = await standardRateLimit()(request);
    if (rl) return rl;

    const auth = await requireApiKeyAuth()(request);
    if (auth) return auth;

    const { guideSlug, conversationId, user } = (await request.json()) as {
      guideSlug: string;
      conversationId?: string;
      user?: { name?: string; contact?: string };
    };

    if (!guideSlug) {
      return NextResponse.json({ error: 'guideSlug é obrigatório' }, { status: 400 });
    }

    const db = getFirestore(unifiedApp);
    const guideRef = doc(db, 'guides', guideSlug);
    const guideSnap = await getDoc(guideRef);
    if (!guideSnap.exists()) {
      return NextResponse.json({ error: 'Guia não encontrado' }, { status: 404 });
    }
    const data = guideSnap.data() as any;
    const guideName = data?.name || guideSlug;
    const forwardEmail = String(data?.humanChatNotificationEmail || '').trim();

    // Se SMTP não estiver configurado, registar no log e responder OK para não bloquear fluxo
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('SMTP não configurado. Simulando envio de notificação.');
      console.log('Notificação simulada:', {
        to: [CENTRAL_NOTIFICATIONS_EMAIL, forwardEmail].filter(Boolean),
        guideSlug,
        guideName,
        conversationId,
        user
      });
      return NextResponse.json({ ok: true, simulated: true });
    }

    const transporter = createTransporter();
    try {
      await transporter.verify();
    } catch (e) {
      // continuar mesmo que verify falhe, alguns servidores não suportam
    }

    const recipients = [CENTRAL_NOTIFICATIONS_EMAIL].concat(forwardEmail ? [forwardEmail] : []);
    const subject = `Novo chat humano iniciado - ${guideName}`;
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
        <h2>Novo chat humano iniciado</h2>
        <p><strong>Guia:</strong> ${guideName} (${guideSlug})</p>
        ${conversationId ? `<p><strong>ID da Conversa:</strong> ${conversationId}</p>` : ''}
        ${user?.name || user?.contact ? `<p><strong>Utilizador:</strong> ${user?.name || ''} ${user?.contact ? `&lt;${user.contact}&gt;` : ''}</p>` : ''}
        <p>Recebeu esta notificação no email central e foi reencaminhada para o email configurado no guia.</p>
      </div>
    `;

    await transporter.sendMail({
      from: { name: 'Virtual Chat', address: process.env.SMTP_USER },
      to: CENTRAL_NOTIFICATIONS_EMAIL,
      cc: forwardEmail || undefined,
      subject,
      html,
      text: `Novo chat humano iniciado\nGuia: ${guideName} (${guideSlug})\n${conversationId ? `Conversa: ${conversationId}\n` : ''}${user?.name || user?.contact ? `Utilizador: ${user?.name || ''} ${user?.contact || ''}` : ''}`
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error('Erro ao enviar notificação de chat humano:', error);
    return NextResponse.json({ error: 'Erro interno ao enviar notificação' }, { status: 500 });
  }
}


