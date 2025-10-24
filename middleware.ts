import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Verificar se é uma rota do backoffice
  if (request.nextUrl.pathname.startsWith('/backoffice')) {
    // Permitir acesso à página de login
    if (request.nextUrl.pathname === '/backoffice/login') {
      return NextResponse.next();
    }

    // Verificar se o utilizador está autenticado
    const rawCookie = request.cookies.get('sessionData')?.value;
    
    if (!rawCookie) {
      // Redirecionar para login se não houver sessão
      return NextResponse.redirect(new URL('/backoffice/login', request.url));
    }

    try {
      // Verificar se a sessão é válida
      // O cookie pode estar codificado (encodeURIComponent)
      let decoded = rawCookie;
      try { 
        decoded = decodeURIComponent(rawCookie);
      } catch {}
      const session = JSON.parse(decoded);
      const now = Date.now();
      
                   // Verificar se a sessão expirou (24 horas) - com margem de tolerância
             if (session.timestamp && (now - session.timestamp) > 25 * 60 * 60 * 1000) {
               // Sessão expirada, redirecionar para login
               return NextResponse.redirect(new URL('/backoffice/login', request.url));
             }
      
      // Verificar se tem sessionId e token
      if (!session.sessionId || !session.token) {
        return NextResponse.redirect(new URL('/backoffice/login', request.url));
      }
      
      // Sessão válida, continuar
      return NextResponse.next();
    } catch (error) {
      // Erro ao processar sessão, redirecionar para login
      return NextResponse.redirect(new URL('/backoffice/login', request.url));
    }
  }

  // Para outras rotas, continuar normalmente
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
