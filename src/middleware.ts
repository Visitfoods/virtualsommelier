import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Verificar se é uma rota de backoffice
  if (request.nextUrl.pathname.startsWith('/backoffice')) {
    // Verificar se o utilizador está autenticado
    const sessionCookie = request.cookies.get('sessionData');
    
    // Se não houver cookie de sessão, redirecionar para o login
    if (!sessionCookie || !sessionCookie.value) {
      // Redirecionar para o login se não estiver na página de login
      if (!request.nextUrl.pathname.startsWith('/backoffice/login')) {
        return NextResponse.redirect(new URL('/backoffice/login', request.url));
      }
      return NextResponse.next();
    }
    
    try {
      // Verificar se o cookie de sessão tem estrutura válida
      const sessionData = JSON.parse(decodeURIComponent(sessionCookie.value));

      if (!sessionData || !sessionData.sessionId || !sessionData.token) {
        if (!request.nextUrl.pathname.startsWith('/backoffice/login')) {
          const res = NextResponse.redirect(new URL('/backoffice/login', request.url));
          try { res.cookies.set('sessionData', '', { expires: new Date(0), path: '/', sameSite: 'lax' }); } catch {}
          return res;
        }
        return NextResponse.next();
      }

      // Validação servidor-side: a sessão pode ter sido encerrada por admin
      const validateUrl = new URL('/api/session/validate', request.url);
      const validateRes = await fetch(validateUrl, {
        method: 'GET',
        headers: { cookie: `sessionData=${sessionCookie.value}` }
      });
      const { valid } = await validateRes.json().catch(() => ({ valid: false }));

      if (!valid) {
        if (!request.nextUrl.pathname.startsWith('/backoffice/login')) {
          const res = NextResponse.redirect(new URL('/backoffice/login', request.url));
          try { res.cookies.set('sessionData', '', { expires: new Date(0), path: '/', sameSite: 'lax' }); } catch {}
          return res;
        }
        // na página de login, permitir continuar
        const next = NextResponse.next();
        try { next.cookies.set('sessionData', '', { expires: new Date(0), path: '/', sameSite: 'lax' }); } catch {}
        return next;
      }

      // Se estiver na página de login e já estiver com sessão válida, redirecionar para o backoffice
      if (request.nextUrl.pathname === '/backoffice/login') {
        return NextResponse.redirect(new URL('/backoffice', request.url));
      }

      return NextResponse.next();
    } catch (error) {
      // Em caso de erro ao processar o cookie, redirecionar para o login
      if (!request.nextUrl.pathname.startsWith('/backoffice/login')) {
        const res = NextResponse.redirect(new URL('/backoffice/login', request.url));
        try { res.cookies.set('sessionData', '', { expires: new Date(0), path: '/', sameSite: 'lax' }); } catch {}
        return res;
      }
      return NextResponse.next();
    }
  }
  
  // Para todas as outras rotas, continuar normalmente
  return NextResponse.next();
}

export const config = {
  matcher: ['/backoffice/:path*'],
}
