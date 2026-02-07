'use client';

export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import BackofficeAuthGuard from '../../components/BackofficeAuthGuard';
import { useAuth } from '../../hooks/useAuth';
import { doc, getDoc, collection, getDocs, query, orderBy, limit, getFirestore } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import styles from './backoffice.module.css';

interface GuideData {
  id: string;
  name: string;
  company?: string;
  chatIconURL?: string;
  createdAt?: any;
  isActive?: boolean;
}

export default function BackofficeRedirect() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [recentGuides, setRecentGuides] = useState<GuideData[]>([]);
  const [selectedProject, setSelectedProject] = useState('virtualsommelier');
  const [isBackingUp, setIsBackingUp] = useState(false);

  // Opções de projetos Firebase disponíveis para backup
  const projectOptions = [
    {
      id: 'virtualsommelier',
      name: 'Virtual Sommelier',
      description: 'Base de dados Virtual Sommelier - Guias, utilizadores, sessões e contactos',
      collections: [
        'guides',
        'users',
        'conversations',
        'contact_requests',
        'contactoschatreal',
        'active_sessions',
        'followers'
      ]
    },
    {
      id: 'virtualchat-b0e17',
      name: 'VirtualChat B0E17',
      description: 'Base de dados principal - Sommeliers, conversas, contactos',
      collections: ['contactoschatreal', 'conversations', 'followers', 'guides', 'orcamentos', 'users']
    }
  ];

  // Configuração do Firebase para o projeto virtualchat-b0e17 via env (fallback para NEXT_PUBLIC_ ou TARGET_)
  const TARGET_FIREBASE_CONFIG = {
    apiKey: (process.env.NEXT_PUBLIC_TARGET_FIREBASE_API_KEY || process.env.TARGET_FIREBASE_API_KEY) as string,
    authDomain: (process.env.NEXT_PUBLIC_TARGET_FIREBASE_AUTH_DOMAIN || process.env.TARGET_FIREBASE_AUTH_DOMAIN) as string,
    projectId: (process.env.NEXT_PUBLIC_TARGET_FIREBASE_PROJECT_ID || process.env.TARGET_FIREBASE_PROJECT_ID) as string,
    storageBucket: (process.env.NEXT_PUBLIC_TARGET_FIREBASE_STORAGE_BUCKET || process.env.TARGET_FIREBASE_STORAGE_BUCKET) as string,
    messagingSenderId: (process.env.NEXT_PUBLIC_TARGET_FIREBASE_MESSAGING_SENDER_ID || process.env.TARGET_FIREBASE_MESSAGING_SENDER_ID) as string,
    appId: (process.env.NEXT_PUBLIC_TARGET_FIREBASE_APP_ID || process.env.TARGET_FIREBASE_APP_ID) as string,
    measurementId: (process.env.NEXT_PUBLIC_TARGET_FIREBASE_MEASUREMENT_ID || process.env.TARGET_FIREBASE_MEASUREMENT_ID || '') as string
  } as const;

  // Inicializar Firebase para o projeto virtualchat-b0e17
  const targetApp = (() => {
    const appName = 'vg-virtualchat-b0e17-backoffice';
    const existing = getApps().find(a => a.name === appName);
    if (existing) return existing;
    return initializeApp(TARGET_FIREBASE_CONFIG, appName);
  })();
  
  const targetDb = getFirestore(targetApp);

  useEffect(() => {
    // Se não estiver autenticado, redirecionar para login
    if (!authLoading && !isAuthenticated) {
      
      router.push('/backoffice/login');
      return;
    }
    
    // Se estiver autenticado, carregar dados
    if (isAuthenticated && user) {

      setIsLoading(false);
    }
  }, [authLoading, isAuthenticated, user, router]);

  // Buscar os últimos guias criados diretamente do projeto virtualchat-b0e17
  useEffect(() => {
    const fetchRecentGuides = async () => {
      try {
        
        
        // Buscar diretamente do projeto virtualchat-b0e17
        const guidesRef = collection(targetDb, 'guides');
        const q = query(guidesRef, orderBy('createdAt', 'desc'), limit(12));
        const querySnapshot = await getDocs(q);
        const guides = querySnapshot.docs.map((snap: any) => {
          const data = snap.data() as any;
          
          return {
            id: snap.id,
            name: data?.name || snap.id,
            company: data?.company || '',
            chatIconURL: data?.chatIconURL,
            createdAt: data?.createdAt,
            isActive: data?.isActive !== false,
          } as GuideData;
        });

        
        setRecentGuides(guides.slice(0, 4));
      } catch (error) {
        console.error('❌ Erro ao buscar guias do projeto virtualchat-b0e17:', error);
        setRecentGuides([]);
      }
    };



    if (isAuthenticated) {
      fetchRecentGuides();
    }
  }, [isAuthenticated, targetDb]);

  // Função para executar backup do projeto selecionado
  const handleBackup = async () => {
    try {
      setIsBackingUp(true);
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || '';
      if (!apiKey) {
        alert('Configure NEXT_PUBLIC_API_KEY no ambiente para executar o backup com segurança.');
        return;
      }
      
      const res = await fetch('/api/backup-firestore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },
        body: JSON.stringify({ project: selectedProject })
      });
      
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || 'Falha no backup');
      }
      
      const projectName = projectOptions.find(p => p.id === selectedProject)?.name || selectedProject;
      const jsonUrl: string = data.jsonUrl;
      const markdownUrl: string = data.markdownUrl;
      
      const message = `Backup do projeto "${projectName}" concluído com sucesso!\n\n` +
        `📄 Dados JSON: ${jsonUrl}\n` +
        `📋 Informações: ${markdownUrl}\n\n` +
        `Tamanho: ${(data.bytes / 1024).toFixed(2)} KB`;
      
      alert(message);
      
      // Abrir ambos os ficheiros
      window.open(jsonUrl, '_blank');
      setTimeout(() => window.open(markdownUrl, '_blank'), 500);
    } catch (err: any) {
      console.error('Erro ao executar backup:', err);
      alert(`Erro ao executar backup: ${err?.message || err}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      // Se não for superadmin, redirecionar automaticamente
      if (user?.role !== 'admin') {
        router.push('/backoffice/conversations');
      }
    } else if (!isLoading && !isAuthenticated) {
      // Se não estiver autenticado, redirecionar para login
      router.push('/backoffice/login');
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <p>A carregar...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Será redirecionado
  }

  if (user?.role !== 'admin') {
    return null; // Será redirecionado
  }

  // Mostrar opções para superadmin
  return (
    <BackofficeAuthGuard requiredRole="admin">
      <div className={styles.backofficeHome}>
        {/* Barra de navegação pequena no topo */}
      <nav className={styles.topNav}>
        <div className={styles.navContainer}>
          <div className={styles.navLeft}></div>
          <div className={styles.navRight}>
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
                    // Mesmo com erro, limpar dados locais e redirecionar
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
        <div className={styles.welcomeSection}>
          <h1>Backoffice Virtual Sommelier</h1>
          <p>Sistema de Gestão Virtual Sommelier</p>
        </div>
        
        <div className={styles.backofficeActions}>
          <Link href="/backoffice/select" className={styles.backofficeActionButton}>
            <span className={styles.actionIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
              </svg>
            </span>
            <div className={styles.actionContent}>
              <h3>Criar/Editar Sommeliers</h3>
              <p>Gerir guias virtuais, FAQs e informações de contacto</p>
            </div>
          </Link>

          {/* Seletor de Backup Firestore -> FTP (apenas admin) */}
          <div className={styles.backupSection}>
            <div className={styles.backupHeader}>
              <span className={styles.actionIcon}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 21H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4l2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2zm-7-4v-3H9l3-4 3 4h-3v3h-2z"/>
                </svg>
              </span>
              <div className={styles.actionContent}>
                <h3>Backup Firestore → FTP</h3>
                <p>Exporta dados (read‑only) e guarda JSON nos backups</p>
              </div>
            </div>
            
            <div className={styles.backupControls}>
              <div className={styles.projectSelector}>
                <label htmlFor="project-select" className={styles.selectorLabel}>
                  Projeto Firebase:
                </label>
                <select
                  id="project-select"
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className={styles.projectSelect}
                  disabled={isBackingUp}
                >
                  {projectOptions.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name} - {project.description}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className={styles.collectionsInfo}>
                <strong>Coleções a fazer backup:</strong>
                <div className={styles.collectionsList}>
                  {projectOptions.find(p => p.id === selectedProject)?.collections.map((col, index) => (
                    <span key={index} className={styles.collectionTag}>
                      {col}
                    </span>
                  ))}
                </div>
              </div>
              
              <button
                onClick={handleBackup}
                disabled={isBackingUp}
                className={`${styles.backupButton} ${isBackingUp ? styles.backupButtonDisabled : ''}`}
              >
                {isBackingUp ? (
                  <>
                    <svg className={styles.spinner} width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z"/>
                    </svg>
                    A fazer backup...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 21H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4l2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2zm-7-4v-3H9l3-4 3 4h-3v3h-2z"/>
                    </svg>
                    Executar Backup
                  </>
                )}
              </button>
            </div>
          </div>
          
          <Link href="/backoffice/conversations" className={styles.backofficeActionButton}>
            <span className={styles.actionIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20,2H4A2,2 0 0,0 2,4V22L6,18H20A2,2 0 0,0 22,16V4A2,2 0 0,0 20,2M6,9H18V11H6M14,14H6V12H14M18,8H6V6H18"/>
              </svg>
            </span>
            <div className={styles.actionContent}>
              <h3>Conversas e Contactos</h3>
              <p>Gerir conversas de chat e pedidos de contacto dos guias</p>
            </div>
          </Link>
        </div>

        {/* Grid dos últimos guias criados */}
        <div className={styles.recentGuidesSection}>
          <h2 className={styles.sectionTitle}>Últimos Sommeliers Criados</h2>
          <div className={styles.guidesGrid}>
            {recentGuides.map((guide) => {
              // Função auxiliar para obter o título do guia
              const getGuideTitle = () => {
                if (guide.company && guide.company.trim()) {
                  return guide.company;
                }
                return guide.name;
              };
              
              const guideTitle = getGuideTitle();
              
              return (
              <div key={guide.id} className={styles.guideCard}>
                                <div className={styles.cardHeader}>
                  <div className={styles.statusIndicator}>
                    <span className={`${styles.statusDot} ${guide.isActive ? styles.active : styles.inactive}`}></span>
                  </div>
                </div>
                
                <div className={styles.guideAvatar}>
                  {guide.chatIconURL ? (
                    <Image
                      src={guide.chatIconURL}
                      alt={guideTitle}
                      width={80}
                      height={80}
                      className={styles.avatarImage}
                    />
                  ) : (
                    <div className={styles.avatarPlaceholder}>
                      {guideTitle.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                  )}
                </div>
                
                <div className={styles.guideInfo}>
                  <h3 className={styles.guideName}>{guideTitle}</h3>
                  {guide.company && guide.company.trim() && guide.company !== guide.name && (
                    <p className={styles.guideSlug} style={{ color: '#888', fontSize: '0.8rem', margin: '2px 0' }}>
                      {guide.name}
                    </p>
                  )}
                  <p className={styles.guideType}>Guia Virtual</p>
                </div>
                
                <div className={styles.guideDetails}>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Criado:</span>
                    <span className={styles.detailValue}>
                      {guide.createdAt ? new Date(guide.createdAt.toDate()).toLocaleDateString('pt-PT') : 'N/A'}
                    </span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Status:</span>
                    <span className={`${styles.detailValue} ${guide.isActive ? styles.statusActive : styles.statusInactive}`}>
                      {guide.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </div>
                
                <Link href={`/backoffice/select?guide=${guide.id}`} className={styles.viewDetailsButton}>
                  VER DETALHES
                </Link>
              </div>
            );
            })}
          </div>
        </div>
      </div>
    </div>
    </BackofficeAuthGuard>
  );
} 