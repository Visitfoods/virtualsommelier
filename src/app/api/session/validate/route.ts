import { NextRequest, NextResponse } from 'next/server';
import { SessionService } from '@/services/sessionService';

export async function GET(request: NextRequest) {
  try {
    const cookie = request.cookies.get('sessionData');
    if (!cookie?.value) {
      return NextResponse.json({ valid: false }, { status: 200 });
    }
    let sessionId: string | undefined;
    let token: string | undefined;
    try {
      const parsed = JSON.parse(decodeURIComponent(cookie.value));
      sessionId = parsed?.sessionId;
      token = parsed?.token;
    } catch {
      return NextResponse.json({ valid: false }, { status: 200 });
    }
    if (!sessionId || !token) {
      return NextResponse.json({ valid: false }, { status: 200 });
    }
    const session = await SessionService.validateSession(sessionId, token);
    if (!session) {
      // opcional: limpar cookie inválido
      const res = NextResponse.json({ valid: false }, { status: 200 });
      try { res.cookies.set('sessionData', '', { expires: new Date(0), path: '/', sameSite: 'lax' }); } catch {}
      return res;
    }
    return NextResponse.json({ valid: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ valid: false }, { status: 200 });
  }
}


