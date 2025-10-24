'use client';

import { useEffect } from 'react';

export default function HomePage() {
  useEffect(() => {
    // Redireciona automaticamente para o site da InovPartner
    window.location.href = 'http://inovpartner.com/';
  }, []);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      fontFamily: 'Arial, sans-serif'
    }}>
      <p>A redirecionar para a InovPartner...</p>
    </div>
  );
}


