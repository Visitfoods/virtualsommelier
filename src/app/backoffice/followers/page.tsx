'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BackofficeAuthGuard from '../../../components/BackofficeAuthGuard';
import { getFollowers, getFollowersCount, listGuideSlugsWithFollowers } from '../../../firebase/followerServices';
import { useAuth } from '../../../hooks/useAuth';
import type { Follower, FollowerFilters } from '../../../types/follower';
import styles from '../backoffice.module.css';

export default function FollowersPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FollowerFilters>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [guideOptions, setGuideOptions] = useState<string[]>([]);
  
  const pageSize = 20;
  const isAdmin = user?.role === 'admin';
  const userGuideSlug = user?.guideSlug as string;

  const loadFollowers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await getFollowers(filters, pageSize, currentPage > 1 ? lastDoc : undefined);
      
      if (currentPage === 1) {
        setFollowers(result.followers);
      } else {
        setFollowers(prev => [...prev, ...result.followers]);
      }
      
      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
      
      // Carregar contagem total
      const count = await getFollowersCount(filters.guideId);
      setTotalCount(count);
      
    } catch (err) {
      console.error('Erro ao carregar seguidores:', err);
      setError('Erro ao carregar seguidores');
    } finally {
      setLoading(false);
    }
  }, [filters, pageSize, currentPage, lastDoc]);

  useEffect(() => {
    // Verificar autenticação
    if (!authLoading && !isAuthenticated) {
      router.push('/backoffice/login');
      return;
    }
    
    // Se não for admin, filtrar apenas pelo guia do utilizador
    if (isAuthenticated && !isAdmin && userGuideSlug) {
      setFilters(prev => ({ ...prev, guideId: userGuideSlug }));
    }
    
    if (isAuthenticated) {
      // Carregar guias com seguidores para o seletor
      listGuideSlugsWithFollowers().then(setGuideOptions).catch(() => setGuideOptions([]));
    }
  }, [authLoading, isAuthenticated, userGuideSlug, isAdmin]);

  // useEffect separado para carregar seguidores quando filters ou currentPage mudarem
  useEffect(() => {
    if (isAuthenticated) {
      loadFollowers();
    }
  }, [loadFollowers, isAuthenticated]);


  const handleFilterChange = (key: keyof FollowerFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined
    }));
    setCurrentPage(1);
    setLastDoc(null);
  };

  const loadMore = () => {
    if (hasMore && !loading) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('pt-PT', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const exportToCSV = () => {
    const headers = ['Nome', 'Email', 'Guia', 'Data', 'Origem'];
    const csvContent = [
      headers.join(','),
      ...followers.map(f => [
        `"${f.name}"`,
        `"${f.email}"`,
        `"${f.guideSlug}"`,
        `"${formatDate(f.createdAt)}"`,
        `"${f.source}"`
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `seguidores_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Mostrar loading enquanto verifica autenticação
  if (authLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>A verificar autenticação...</div>
      </div>
    );
  }

  // Se não estiver autenticado, não mostrar nada (será redirecionado)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <BackofficeAuthGuard>
      <div className={styles.backofficeHome}>
        <nav className={styles.topNav}>
          <div className={styles.navContainer}>
            <div className={styles.navLeft}></div>
            <div className={styles.navRight}>
              {isAdmin ? (
                <>
                  <Link href="/backoffice" className={styles.navLink}>Administração</Link>
                  <Link href="/backoffice/select" className={styles.navLink}>Sommeliers</Link>
                  <Link href="/backoffice/conversations" className={styles.navLink}>Conversas & Contactos</Link>
                  <Link href="/backoffice/scraping" className={styles.navLink}>Scraping</Link>
                  <Link href="/backoffice/followers" className={styles.navLink}>Seguidores</Link>
                  <Link href="/backoffice/users" className={styles.navLink}>Utilizadores</Link>
                  <button 
                    className={styles.navLink}
                    onClick={() => router.push('/backoffice/select?create=1')}
                    style={{ 
                      background: 'linear-gradient(135deg, #4ecdc4, #45b7aa)',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'white',
                      fontWeight: '600'
                    }}
                  >
                    Adicionar Sommeliers
                  </button>
                </>
              ) : (
                <>
                  <button 
                    className={styles.navLink}
                    onClick={() => router.push('/backoffice/conversations')}
                    style={{ 
                      background: 'rgba(255,255,255,0.14)',
                      border: '1px solid rgba(255,255,255,0.22)',
                      cursor: 'pointer',
                      color: '#f3f4f6'
                    }}
                  >
                    Conversas & Contactos
                  </button>
                  <button 
                    className={styles.navLink}
                    onClick={() => router.push('/backoffice/followers')}
                    style={{ 
                      background: 'rgba(255,255,255,0.14)',
                      border: '1px solid rgba(255,255,255,0.22)',
                      cursor: 'pointer',
                      color: '#f3f4f6'
                    }}
                  >
                    Seguidores
                  </button>
                </>
              )}
              {!isAdmin && (
                <></>
              )}
              <div className={styles.userInfo}>
                <span className={styles.userIcon}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5zm0 2c-3.866 0-7 2.239-7 5v2h14v-2c0-2.761-3.134-5-7-5z"/>
                  </svg>
                </span>
                <span className={styles.userName}>{user?.username ? String(user.username) : 'Admin'}</span>
              </div>
              <button 
                className={styles.logoutButton}
                onClick={async () => {
                  try {
                    await logout();
                    router.push('/backoffice/login');
                  } catch (error) {
                    console.error('Erro ao fazer logout:', error);
                    // Mesmo com erro, limpar dados locais e redirecionar
                    localStorage.removeItem('sessionData');
                    localStorage.removeItem('userData');
                    document.cookie = 'sessionData=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax';
                    router.push('/backoffice/login');
                  }
                }}
              >
                <span className={styles.logoutIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                  </svg>
                </span>
                <span>Sair</span>
              </button>
            </div>
          </div>
        </nav>

        <div className={styles.mainContent}>
          <div className={styles.secondaryToolbar}>
            <div className={styles.toolbarLeft}>
              {isAdmin && (
                <div className={styles.dropdownGroup}>
                  <span className={styles.dropdownLabel}>Guia</span>
                  <select
                    className={styles.dropdownSelect}
                    value={filters.guideId || ''}
                    onChange={(e) => handleFilterChange('guideId', e.target.value)}
                  >
                    <option value="">Todos</option>
                    {guideOptions.map((slug) => (
                      <option key={slug} value={slug}>{slug}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className={styles.toolbarRight}>
              <div className={styles.dropdownGroup}>
                <span className={styles.dropdownLabel}>De</span>
                <input
                  type="date"
                  className={styles.dropdownSelect}
                  value={filters.dateFrom || ''}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                />
              </div>
              <div className={styles.dropdownGroup}>
                <span className={styles.dropdownLabel}>Até</span>
                <input
                  type="date"
                  className={styles.dropdownSelect}
                  value={filters.dateTo || ''}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                />
              </div>
              <button 
                onClick={exportToCSV}
                className={styles.primaryButton}
                disabled={followers.length === 0}
              >
                Exportar CSV
              </button>
            </div>
          </div>

          {/* Removido: cartões de estatísticas */}

          <div className={styles.tableContainer}>
            {loading && followers.length === 0 ? (
              <div className={styles.loading}>A carregar seguidores...</div>
            ) : error ? (
              <div className={styles.error}>{error}</div>
            ) : followers.length === 0 ? (
              <div className={styles.noConversationsBox}>Nenhum seguidor encontrado.</div>
            ) : (
              <>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Email</th>
                      <th>Guia</th>
                      <th>Data</th>
                      <th>Origem</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {followers.map((follower) => (
                      <tr key={follower.id}>
                        <td>{follower.name}</td>
                        <td>{follower.email}</td>
                        <td>{follower.guideSlug}</td>
                        <td>{formatDate(follower.createdAt)}</td>
                        <td>
                          <span className={`${styles.badge} ${styles[`badge-${follower.source}`]}`}>
                            {follower.source === 'follow_form' ? 'Formulário' : 'Manual'}
                          </span>
                        </td>
                        <td>
                          <button 
                            onClick={() => window.open(`mailto:${follower.email}`)}
                            className={styles.actionButton}
                            title="Enviar email"
                          >
                            📧
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {hasMore && (
                  <div className={styles.loadMoreContainer}>
                    <button 
                      onClick={loadMore}
                      disabled={loading}
                      className={styles.loadMoreButton}
                    >
                      {loading ? 'A carregar...' : 'Carregar mais'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </BackofficeAuthGuard>
  );
}
