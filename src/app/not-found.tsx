'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <h1 style={{ fontSize: 28, margin: 0 }}>Página não encontrada</h1>
      <p style={{ opacity: 0.8, margin: 0 }}>A página que procurou não existe.</p>
      <Link href="/virtualguide" style={{ marginTop: 12, textDecoration: 'underline' }}>
        Ir para o VirtualGuide
      </Link>
      
      {/* Footer com copyright */}
      <footer style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'rgba(0, 0, 0, 0.95)',
        padding: '16px 0',
        textAlign: 'center',
        fontSize: '14px',
        color: '#666',
        zIndex: 2002,
        borderTop: '1px solid rgba(0,0,0,0.08)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', flexWrap: 'wrap', marginBottom: '8px' }}>
          <a
            href="https://www.livroreclamacoes.pt/Inicio/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'white', textDecoration: 'none' }}
          >
            Livro de Reclamações
          </a>
          <span style={{ color: '#666' }}>|</span>
          <a
            href="/politica-privacidade"
            style={{ color: 'white', textDecoration: 'none' }}
          >
            Política de Privacidade
          </a>
        </div>
        <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
          © {new Date().getFullYear()} Inov Partner Todos os direitos reservados.
        </div>
      </footer>
    </main>
  );
}



