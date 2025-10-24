import Link from 'next/link';

export const metadata = {
  title: 'Página não encontrada | Virtual Sommelier',
};

export default function NotFoundPage() {
  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f7f8fb',
      padding: '40px',
      position: 'relative',
      zIndex: 99999,
    }}>
      <div
        style={{
          maxWidth: 560,
          width: '100%',
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
          padding: '32px 28px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            lineHeight: 1,
            background: 'linear-gradient(90deg, #cb3c58 0%, #51aecd 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          404
        </div>
        <h1 style={{ margin: '6px 0 12px', fontSize: 24, color: '#1f2937' }}>Página não encontrada</h1>
        <p style={{ margin: '0 0 24px', color: '#6b7280' }}>
          O endereço que procurou não existe ou foi removido.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Link
            href="/"
            style={{
              padding: '10px 16px',
              background: 'linear-gradient(90deg, #cb3c58 0%, #51aecd 100%)',
              color: '#fff',
              borderRadius: 8,
              textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(80, 30, 80, 0.15)'
            }}
          >
            Ir para o início
          </Link>
        </div>
      </div>
      
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


