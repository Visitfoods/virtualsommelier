'use client';

import React from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '../backoffice.module.css';
import ScrapeClient from './ScrapeClient';

export default function ScrapingDashboard() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [cache, setCache] = React.useState<Array<{ slug: string; websiteUrl: string; pages: number; timestamp: number; expiresAt: number }>>([]);

  React.useEffect(() => {
    // Fetch cache data from API
    fetch('/api/scraping-list')
      .then(res => res.json())
      .then(data => setCache(Array.isArray(data) ? data : []))
      .catch(() => setCache([]));
  }, []);

  return (
    <div className={styles.backofficeHome}>
      <nav className={styles.topNav}>
        <div className={styles.navContainer}>
          <div className={styles.navLeft}></div>
          <div className={styles.navRight}>
            <Link href="/backoffice" className={styles.navLink}>Administração</Link>
            <Link href="/backoffice/select" className={styles.navLink}>Sommeliers</Link>
            <Link href="/backoffice/conversations" className={styles.navLink}>Conversas & Contactos</Link>
            <Link href="/backoffice/followers" className={styles.navLink}>Seguidores</Link>
            <Link href="/backoffice/users" className={styles.navLink}>Utilizadores</Link>
            <Link href="/backoffice/scraping" className={styles.navLink}>Scraping</Link>
            <div className={styles.userInfo}>
              <span className={styles.userIcon}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5zm0 2c-3.866 0-7 2.239-7 5v2h14v-2c0-2.761-3.134-5-7-5z"/>
                </svg>
              </span>
              <span className={styles.userName}>{user?.username ? String(user.username) : 'Admin'}</span>
            </div>
            <button
              onClick={async () => {
                try {
                  await logout();
                  router.push('/backoffice/login');
                } catch (error) {
                  console.error('Erro ao fazer logout:', error);
                  localStorage.removeItem('sessionData');
                  localStorage.removeItem('userData');
                  document.cookie = 'sessionData=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax';
                  router.push('/backoffice/login');
                }
              }}
              className={styles.logoutButton}
            >
              <svg className={styles.logoutIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sair
            </button>
          </div>
        </div>
      </nav>
      <div className={styles.mainContent}>
        <h1>Scraping por Guia</h1>
        <p>Verifique a última execução e acione scraping manualmente.</p>
        <ScrapeClient rows={cache} />
      </div>
    </div>
  );
}
