import { NextRequest, NextResponse } from 'next/server';
import { SessionService } from '@/services/sessionService';

export async function POST(request: NextRequest) {
  try {
    let sessionId: string | undefined;
    let token: string | undefined;

    try {
      const body = await request.json();
      sessionId = body?.sessionId;
      token = body?.token;
    } catch {
      // ignorar erro de JSON – pode vir via cookie apenas
    }

    // Fallback: tentar extrair do cookie 'sessionData'
    if (!sessionId || !token) {
      const cookie = request.cookies.get('sessionData');
      if (cookie?.value) {
        try {
          const parsed = JSON.parse(decodeURIComponent(cookie.value));
          sessionId = sessionId || parsed?.sessionId;
          token = token || parsed?.token;
        } catch {}
      }
    }

    // Se tivermos um sessionId válido, tentar encerrar a sessão no servidor
    if (sessionId) {
      try {
        // Validar primeiro quando possível; se não for válido, prosseguir com cleanup
        if (!token || (await SessionService.validateSession(sessionId, token))) {
          await SessionService.logoutSession(sessionId);
        }
      } catch {
        // Mesmo que falhe, vamos limpar o cookie do lado do cliente
      }
    }

    const res = NextResponse.json({ success: true });
    // Limpar cookie no servidor
    try {
      res.cookies.set('sessionData', '', { expires: new Date(0), path: '/', sameSite: 'lax' });
    } catch {}
    return res;
  } catch (error) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}


