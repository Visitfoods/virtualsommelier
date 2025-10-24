'use client';

import Image from 'next/image';
import styles from './coming-soon.module.css';
import { useState, useEffect } from 'react';

// Traduções para diferentes línguas
const translationsData = {
  england: {
    title: 'Coming Soon',
    subtitle: 'We are working to make this version available soon.',
    backButton: 'Back'
  },
  spain: {
    title: 'Próximamente',
    subtitle: 'Estamos trabajando para hacer esta versión disponible pronto.',
    backButton: 'Volver'
  },
  france: {
    title: 'Bientôt Disponible',
    subtitle: 'Nous travaillons pour rendre cette version disponible bientôt.',
    backButton: 'Retour'
  },
  portugal: {
    title: 'Disponível Brevemente',
    subtitle: 'Estamos a trabalhar para disponibilizar esta versão em breve.',
    backButton: 'Voltar'
  }
};

export default function ComingSoon() {
  const [, setCurrentLanguage] = useState('portugal');
  const [translations, setTranslations] = useState(translationsData.portugal);

  useEffect(() => {
    // Obter a língua selecionada do localStorage
    const selectedLanguage = localStorage.getItem('selectedLanguage');
    
    if (selectedLanguage && translationsData[selectedLanguage as keyof typeof translationsData]) {
      setCurrentLanguage(selectedLanguage);
      setTranslations(translationsData[selectedLanguage as keyof typeof translationsData]);
    }
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.logoContainer}>
          <Image 
            src="/favicon.jpg" 
            alt="Logo" 
            className={styles.logo}
            width={150}
            height={150}
          />
        </div>
        <h1 className={styles.title}>{translations.title}</h1>
        <p className={styles.subtitle}>
          {translations.subtitle}
        </p>
        <div className={styles.backButton}>
          <button onClick={() => window.history.back()}>
            {translations.backButton}
          </button>
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
    </div>
  );
} 