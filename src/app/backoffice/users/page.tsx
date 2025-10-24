'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BackofficeAuthGuard from '../../../components/BackofficeAuthGuard';
import { useAuth } from '../../../hooks/useAuth';
import { 
  listUsers, 
  updateUser, 
  toggleUserActive, 
  changeUserPassword, 
  deleteUser,
  type User,
  createUserRegistration
} from '../../../firebase/userServices';
import { listGuidesWithHumanChatEnabled } from '../../../firebase/guideServices';
import { SessionService } from '../../../services/sessionService';
import styles from '../backoffice.module.css';

export default function UserManagement() {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Estado de autenticação agora gerido pelo BackofficeAuthGuard
  const router = useRouter();
  // substituto de useSearchParams para evitar erro de prerender
  const getCreateParam = () => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('create');
  };

  
  // Estados para modais
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Estados para criar utilizador
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    description: '',
    role: 'user' as 'user' | 'admin',
    guideSlug: '' as string
  });
  const [availableGuides, setAvailableGuides] = useState<{ slug: string; name: string; company?: string }[]>([]);
  const [guidesLoading, setGuidesLoading] = useState(false);
  const [confirmCreatePassword, setConfirmCreatePassword] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [userSessions, setUserSessions] = useState<{ [userId: string]: number }>({});
  const [closingSessions, setClosingSessions] = useState<string | null>(null);
  
  // Função para validar password segura
  const validateSecurePassword = (password: string): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('A password deve ter pelo menos 8 caracteres');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('A password deve conter pelo menos uma letra maiúscula');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('A password deve conter pelo menos uma letra minúscula');
    }
    
    if (!/[0-9]/.test(password)) {
      errors.push('A password deve conter pelo menos um número');
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('A password deve conter pelo menos um caractere especial');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  };
  
  // Abrir modal automaticamente se vier com ?create=1
  useEffect(() => {
    const value = getCreateParam();
    if (value === '1') {
      openCreateModal();
    }
  }, []);



  // Verificação de autenticação agora feita pelo BackofficeAuthGuard
  
  // Carregar utilizadores quando o componente montar (apenas se estiver autenticado)
  useEffect(() => {
    if (user && user.role === 'admin') {
      loadUsers();
    }
  }, [user]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const usersList = await listUsers();
      setUsers(usersList);
      setError(null);
      
      // Carregar número de sessões ativas para cada utilizador
      await loadUserSessions(usersList);
    } catch (err) {
      console.error('Erro ao carregar utilizadores:', err);
      setError('Erro ao carregar utilizadores');
    } finally {
      setLoading(false);
    }
  };

  const loadUserSessions = async (usersList: User[]) => {
    try {
      // Verificar se o utilizador atual tem permissões
      if (!user || user.role !== 'admin') {
        
        return;
      }
      
      const sessionsData: { [userId: string]: number } = {};
      
      for (const userItem of usersList) {
        if (userItem.id) {
          const sessions = await SessionService.getActiveSessionsByUser(userItem.id);
          sessionsData[userItem.id] = sessions.length;
        }
      }
      
      setUserSessions(sessionsData);
    } catch (error) {
      console.error('Erro ao carregar sessões dos utilizadores:', error);
    }
  };

  const closeUserSessions = async (userId: string) => {
    if (!userId) return;
    
    // Verificar se o utilizador atual tem permissões
    if (!user || user.role !== 'admin') {
      
      return;
    }
    
    try {
      setClosingSessions(userId);
      
      const result = await SessionService.closeAllUserSessions(userId);
      
      if (result.success) {
        // Atualizar o estado local
        setUserSessions(prev => ({
          ...prev,
          [userId]: 0
        }));
        
        // Recarregar utilizadores para atualizar dados
        await loadUsers();
        
        
      } else {
        console.error('❌ Erro ao fechar sessões:', result.error);
        setError(`Erro ao fechar sessões: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ Erro ao fechar sessões:', error);
      setError('Erro ao fechar sessões');
    } finally {
      setClosingSessions(null);
    }
  };

  // Carregar guias ao abrir modal (apenas se estiver autenticado)
  useEffect(() => {
    const loadGuides = async () => {
      try {
        // Verificar se o utilizador atual tem permissões
        if (!user || user.role !== 'admin') {
          
          return;
        }
        
        setGuidesLoading(true);
        const guides = await listGuidesWithHumanChatEnabled('virtualchat-b0e17');
        setAvailableGuides(guides);
      } catch (err) {
        console.error('Erro ao carregar guias disponíveis:', err);
        setAvailableGuides([]);
      } finally {
        setGuidesLoading(false);
      }
    };
    if (showCreateModal && user && user.role === 'admin') {
      loadGuides();
    }
  }, [showCreateModal, user]);

  const handleToggleActive = async (userToToggle: User) => {
    if (!userToToggle.id) return;
    
    // Verificar se o utilizador atual tem permissões de admin
    if (!user || user.role !== 'admin') {
      
      return;
    }
    
    try {
      await toggleUserActive(userToToggle.id);
      await loadUsers(); // Recarregar lista
    } catch (err) {
      console.error('Erro ao alterar estado:', err);
      setError('Erro ao alterar estado do utilizador');
    }
  };

  const handlePasswordChange = async () => {
    if (!selectedUser?.id || !newPassword) return;
    
    // Verificar se o utilizador atual tem permissões
    if (!user || user.role !== 'admin') {
      
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError('As passwords não coincidem');
      return;
    }
    
    // Validar password segura
    const passwordValidation = validateSecurePassword(newPassword);
    if (!passwordValidation.isValid) {
      setError(passwordValidation.errors.join('\n'));
      return;
    }
    
    try {
      await changeUserPassword(selectedUser.id, newPassword);
      setShowPasswordModal(false);
      setSelectedUser(null);
      setNewPassword('');
      setConfirmPassword('');
      setError(null);
      alert('Password alterada com sucesso!');
    } catch (err) {
      console.error('Erro ao alterar password:', err);
      setError('Erro ao alterar password');
    }
  };

  const handleUsernameChange = async () => {
    if (!selectedUser?.id || !newUsername) return;
    
    // Verificar se o utilizador atual tem permissões
    if (!user || user.role !== 'admin') {
      
      return;
    }
    
    if (newUsername.length < 3) {
      setError('O nome de utilizador deve ter pelo menos 3 caracteres');
      return;
    }
    
    try {
      await updateUser(selectedUser.id, { username: newUsername });
      setShowUsernameModal(false);
      setSelectedUser(null);
      setNewUsername('');
      setError(null);
      await loadUsers();
      alert('Nome de utilizador alterado com sucesso!');
    } catch (err) {
      console.error('Erro ao alterar nome de utilizador:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro ao alterar nome de utilizador';
      
      // Verificar se é erro de utilizador duplicado
      if (errorMessage.includes('Nome de utilizador já existe')) {
        alert('❌ Erro: Este nome de utilizador já existe!\n\nPor favor, escolha um nome de utilizador diferente.');
      } else if (errorMessage.includes('Email já existe')) {
        alert('❌ Erro: Este email já existe!\n\nPor favor, escolha um email diferente.');
      } else {
        setError(errorMessage);
      }
    }
  };

  const handleCreateUser = async () => {
    // Verificar se o utilizador atual tem permissões
    if (!user || user.role !== 'admin') {
      
      return;
    }
    
    if (!newUser.username || !newUser.email || !newUser.password || !newUser.description) {
      setError('Preencha username, email, password e descrição');
      return;
    }
    
    // Validar password segura
    const passwordValidation = validateSecurePassword(newUser.password);
    if (!passwordValidation.isValid) {
      setError(passwordValidation.errors.join('\n'));
      return;
    }
    
    if (newUser.password !== confirmCreatePassword) {
      setError('As passwords não coincidem');
      return;
    }
    if (newUser.role === 'user' && !newUser.guideSlug) {
      setError('Selecione o guia a associar');
      return;
    }
    try {
      await createUserRegistration({
        username: newUser.username,
        email: newUser.email,
        password: newUser.password,
        description: newUser.description,
        role: newUser.role,
        guideSlug: newUser.role === 'user' ? newUser.guideSlug : undefined
      });
      setShowCreateModal(false);
      setNewUser({ username: '', email: '', password: '', description: '', role: 'user', guideSlug: '' });
      setConfirmCreatePassword('');
      setError(null);
      await loadUsers();
      alert('Utilizador registado com sucesso!');
    } catch (err) {
      console.error('Erro ao registar utilizador:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro ao registar utilizador';
      
      // Verificar se é erro de utilizador duplicado
      if (errorMessage.includes('Nome de utilizador já existe')) {
        alert('❌ Erro: Este nome de utilizador já existe!\n\nPor favor, escolha um nome de utilizador diferente.');
      } else if (errorMessage.includes('Email já existe')) {
        alert('❌ Erro: Este email já existe!\n\nPor favor, escolha um email diferente.');
      } else {
        setError(errorMessage);
      }
    }
  };

  const openPasswordModal = (user: User) => {
    setSelectedUser(user);
    setNewPassword('');
    setConfirmPassword('');
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setShowPasswordModal(true);
    setError(null);
  };

  const openCreateModal = () => {
    
    setNewUser({
      username: '',
      email: '',
      password: '',
      description: '',
      role: 'user',
      guideSlug: ''
    });
    setConfirmCreatePassword('');
    setShowCreateModal(true);
    setError(null);
    
  };

  const handleDeleteUser = async () => {
    if (!userToDelete?.id) return;
    
    try {
      await deleteUser(userToDelete.id);
      setShowDeleteModal(false);
      setUserToDelete(null);
      setError(null);
      await loadUsers();
      alert('Utilizador eliminado com sucesso!');
    } catch (err) {
      console.error('Erro ao eliminar utilizador:', err);
      setError(err instanceof Error ? err.message : 'Erro ao eliminar utilizador');
    }
  };

  const openDeleteModal = (userToDelete: User) => {
    // Verificar se o utilizador atual tem permissões de admin
    if (!user || user.role !== 'admin') {
      
      return;
    }
    
    // Bloquear eliminação do último admin
    if (userToDelete.role === 'admin') {
      const adminCount = users.filter(u => u.role === 'admin').length;
      if (adminCount <= 1) {
        setError('Não é possível eliminar o último utilizador admin.');
        return;
      }
    }

    setUserToDelete(userToDelete);
    setShowDeleteModal(true);
    setError(null);
  };

  const openInfoModal = (userInfo: User) => {
    setSelectedUser(userInfo);
    setShowInfoModal(true);
    setError(null);
  };

  // Verificação de autenticação agora feita pelo BackofficeAuthGuard

  return (
    <Suspense fallback={null}>
    <BackofficeAuthGuard requiredRole="admin">
      <div className={styles.backofficeHome}>
        {/* Top nav reutilizada */}
      <nav className={styles.topNav}>
        <div className={styles.navContainer}>
          <div className={styles.navLeft}></div>
          <div className={styles.navRight}>
            <Link href="/backoffice" className={styles.navLink}>Administração</Link>
            <Link href="/backoffice/select" className={styles.navLink}>Guias</Link>
            <Link href="/backoffice/conversations" className={styles.navLink}>Conversas & Contactos</Link>
            <Link href="/backoffice/followers" className={styles.navLink}>Seguidores</Link>
            <Link href="/backoffice/users" className={styles.navLink}>Utilizadores</Link>
            <button 
              className={styles.navLink}
              onClick={() => {
                
                // Se já estiver na página users, abrir modal diretamente
                if (window.location.pathname === '/backoffice/users') {
                  
                  openCreateModal();
                } else {
                  
                  // Se estiver noutra página, navegar para users com create=1
                  router.push('/backoffice/users?create=1');
                }
              }}
              style={{ 
                background: 'linear-gradient(135deg, #ff6b6b, #4ecdc4)',
                border: 'none',
                cursor: 'pointer',
                color: 'white',
                fontWeight: '600'
              }}
            >
              Adicionar Utilizador
              </button>
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
              Adicionar Guias
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

      {error && <div className={styles.errorMessage}>{error}</div>}

        <div className={styles.backofficeContent}>
          <div className={styles.mainContent}>
            <div className={styles.mainContentArea}>
              <div className={styles.dataCard} style={{ flex: 1, width: '100%' }}>
            {loading ? (
              <div className={styles.loading}>A carregar utilizadores...</div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <h2>Utilizadores Registados</h2>
                    <small style={{ color: '#666', fontSize: '12px' }}>
                      {users.length} utilizador{users.length !== 1 ? 'es' : ''} encontrado{users.length !== 1 ? 's' : ''}
                    </small>
                  </div>
                  <div>
                    <button 
                      className={styles.refreshButton}
                      onClick={loadUsers}
                      disabled={loading}
                      style={{ marginRight: 8 }}
                    >
                      {loading ? 'A carregar...' : 'Atualizar'}
                    </button>
                    <button 
                      className={styles.filterButton}
                      onClick={openCreateModal}
                      style={{ marginRight: 8 }}
                    >
                      Novo Utilizador
                    </button>
                    <button 
                      className={styles.refreshButton}
                      onClick={async () => {
                        setLoading(true);
                        await loadUsers();
                      }}
                      disabled={loading}
                      title="Recarregar utilizadores e sessões"
                    >
                      {loading ? 'A carregar...' : 'Recarregar Sessões'}
                    </button>
                  </div>
                </div>
                <div className={styles.tableWrap}>
                  {users.length > 5 && (
                    <div style={{ 
                      padding: '8px 12px', 
                      backgroundColor: 'rgba(78, 205, 196, 0.1)', 
                      borderBottom: '1px solid rgba(78, 205, 196, 0.2)',
                      fontSize: '12px',
                      color: '#4ecdc4'
                    }}>
                      💡 Use o scroll horizontal e vertical para ver todos os utilizadores
                    </div>
                  )}
                  <table className={styles.dataTable}>
                                      <thead>
                      <tr style={{ borderBottom: '2px solid #333' }}>
                      <th>Username</th>
                      <th>Tipo</th>
                      <th>Descrição</th>
                      <th style={{ textAlign: 'center' }}>Estado</th>
                      <th style={{ textAlign: 'center' }}>Sessões</th>
                      <th style={{ textAlign: 'center' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((userItem) => (
                      <tr key={userItem.id}>
                        <td style={{ fontWeight: 600 }}>{userItem.username}</td>
                        <td>
                          <span className={`${styles.badge} ${userItem.role === 'admin' ? styles.badgeAdmin : styles.badgeUser}`}>
                            {userItem.role === 'admin' ? 'Super Admin' : 'Utilizador'}
                          </span>
                        </td>
                        <td>{userItem.description}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`${styles.badge} ${userItem.active ? styles.badgeActive : styles.badgeInactive}`}>
                            {userItem.active ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <span className={styles.badge} style={{ 
                              backgroundColor: userSessions[userItem.id || ''] > 0 ? '#4ecdc4' : '#666',
                              color: 'white',
                              fontSize: '12px',
                              padding: '4px 8px'
                            }}>
                              {userSessions[userItem.id || ''] || 0} sessões
                            </span>
                            {userSessions[userItem.id || ''] > 0 && (
                              <button 
                                className={styles.filterButton}
                                style={{ 
                                  fontSize: '11px', 
                                  padding: '4px 8px',
                                  backgroundColor: '#ff6b6b',
                                  color: 'white',
                                  border: 'none',
                                  cursor: closingSessions === userItem.id ? 'not-allowed' : 'pointer',
                                  opacity: closingSessions === userItem.id ? 0.6 : 1
                                }}
                                onClick={() => closeUserSessions(userItem.id || '')}
                                disabled={closingSessions === userItem.id}
                                title="Fechar todas as sessões"
                              >
                                {closingSessions === userItem.id ? 'A fechar...' : 'Fechar Sessões'}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className={styles.actionsCell}>
                          <button 
                            className={`${styles.filterButton} ${styles.actionBtn}`}
                            onClick={() => openInfoModal(userItem)}
                            title="Ver informações detalhadas"
                            style={{ backgroundColor: '#4ecdc4', color: 'white', marginRight: '4px' }}
                          >
                            ℹ️ Info
                          </button>
                          <button 
                            className={`${styles.filterButton} ${styles.actionBtn}`}
                            onClick={() => handleToggleActive(userItem)}
                            disabled={userItem.role === 'admin' && userItem.active && users.filter(u => u.role === 'admin' && u.active).length <= 1}
                            title={(userItem.role === 'admin' && userItem.active && users.filter(u => u.role === 'admin' && u.active).length <= 1) ? 'Não é possível desativar o último admin' : (userItem.active ? 'Desativar' : 'Ativar')}
                            style={(userItem.role === 'admin' && userItem.active && users.filter(u => u.role === 'admin' && u.active).length <= 1) ? { opacity: 0.6, cursor: 'not-allowed' } as React.CSSProperties : undefined}
                          >
                            {userItem.active ? 'Desativar' : 'Ativar'}
                          </button>
                          <button 
                            className={`${styles.filterButton} ${styles.actionBtn}`}
                            onClick={() => { setSelectedUser(userItem); setNewUsername(userItem.username); setShowUsernameModal(true); setError(null);} }
                          >
                            Alterar Username
                          </button>
                          <button 
                            className={`${styles.refreshButton} ${styles.actionBtn}`}
                            onClick={() => openPasswordModal(userItem)}
                          >
                            Alterar Password
                          </button>
                          <button 
                            className={`${styles.deleteAllButton} ${styles.actionBtn}`}
                            onClick={() => openDeleteModal(userItem)}
                            disabled={userItem.role === 'admin' && users.filter(u => u.role === 'admin').length <= 1}
                            title={(userItem.role === 'admin' && users.filter(u => u.role === 'admin').length <= 1) ? 'Não é possível eliminar o último admin' : 'Eliminar'}
                            style={(userItem.role === 'admin' && users.filter(u => u.role === 'admin').length <= 1) ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}
          </div>
          </div>
        </div>
      </div>

      {/* Modal para alterar password */}
      {showPasswordModal && selectedUser && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>Alterar Password - {selectedUser.username}</h2>
              <button 
                className={styles.closeModalButton}
                onClick={() => setShowPasswordModal(false)}
              >
                ×
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formStep}>
                <div className={styles.formGroup}>
                  <label>Nova Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className={styles.formInput}
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Password segura (8+ chars, maiúscula, minúscula, número, símbolo)"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      style={{
                        position: 'absolute',
                        right: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 16,
                        color: '#666'
                      }}
                    >
                      {showNewPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                  {/* Requisitos de password segura */}
                  <div style={{ 
                    marginTop: '8px', 
                    fontSize: '12px', 
                    color: '#666',
                    backgroundColor: '#f8f9fa',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid #e9ecef'
                  }}>
                    <strong>Requisitos de password segura:</strong>
                    <ul style={{ margin: '4px 0', paddingLeft: '16px' }}>
                      <li>Mínimo 8 caracteres</li>
                      <li>Pelo menos uma letra maiúscula (A-Z)</li>
                      <li>Pelo menos uma letra minúscula (a-z)</li>
                      <li>Pelo menos um número (0-9)</li>
                      <li>Pelo menos um caractere especial (!@#$%^&*()_+-=[]{}|;:,.&lt;&gt;?)</li>
                    </ul>
                  </div>
                  {/* Validação em tempo real */}
                  {newPassword && (
                    <div style={{ marginTop: '8px' }}>
                      {validateSecurePassword(newPassword).errors.map((error, index) => (
                        <div key={index} style={{ 
                          color: '#dc3545', 
                          fontSize: '11px', 
                          marginBottom: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <span style={{ color: '#dc3545' }}>❌</span> {error}
                        </div>
                      ))}
                      {validateSecurePassword(newPassword).isValid && (
                        <div style={{ 
                          color: '#28a745', 
                          fontSize: '11px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <span style={{ color: '#28a745' }}>✅</span> Password válida!
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className={styles.formGroup}>
                  <label>Confirmar Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className={styles.formInput}
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repetir password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={{
                        position: 'absolute',
                        right: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 16,
                        color: '#666'
                      }}
                    >
                      {showConfirmPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button 
                className={styles.secondaryButton}
                onClick={() => setShowPasswordModal(false)}
              >
                Cancelar
              </button>
              <button 
                className={styles.primaryButton}
                onClick={handlePasswordChange}
                disabled={!newPassword || !confirmPassword || !validateSecurePassword(newPassword).isValid}
              >
                Alterar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para alterar username */}
      {showUsernameModal && selectedUser && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>Alterar Nome de Utilizador - {selectedUser.username}</h2>
              <button 
                className={styles.closeModalButton}
                onClick={() => setShowUsernameModal(false)}
              >
                ×
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formStep}>
                <div className={styles.formGroup}>
                  <label>Novo Username</label>
                  <input
                    className={styles.formInput}
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Novo nome de utilizador"
                  />
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button 
                className={styles.secondaryButton}
                onClick={() => setShowUsernameModal(false)}
              >
                Cancelar
              </button>
              <button 
                className={styles.primaryButton}
                onClick={handleUsernameChange}
                disabled={!newUsername}
              >
                Alterar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para criar utilizador - design idêntico ao de criação de guias */}
      {showCreateModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>Criar Novo Utilizador</h2>
              <button 
                className={styles.closeModalButton}
                onClick={() => setShowCreateModal(false)}
              >
                ×
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formStep}>
                <div className={styles.formGroup}>
                  <label>Username</label>
                  <input
                    className={styles.formInput}
                    type="text"
                    placeholder="Nome de utilizador único"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Email</label>
                  <input
                    className={styles.formInput}
                    type="email"
                    placeholder="email@exemplo.com"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Password</label>
                  <input
                    className={styles.formInput}
                    type="password"
                    placeholder="Password segura (8+ chars, maiúscula, minúscula, número, símbolo)"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  />
                  {/* Requisitos de password segura */}
                  <div style={{ 
                    marginTop: '8px', 
                    fontSize: '12px', 
                    color: '#666',
                    backgroundColor: '#f8f9fa',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid #e9ecef'
                  }}>
                    <strong>Requisitos de password segura:</strong>
                    <ul style={{ margin: '4px 0', paddingLeft: '16px' }}>
                      <li>Mínimo 8 caracteres</li>
                      <li>Pelo menos uma letra maiúscula (A-Z)</li>
                      <li>Pelo menos uma letra minúscula (a-z)</li>
                      <li>Pelo menos um número (0-9)</li>
                      <li>Pelo menos um caractere especial (!@#$%^&*()_+-=[]{}|;:,.&lt;&gt;?)</li>
                    </ul>
                  </div>
                  {/* Validação em tempo real */}
                  {newUser.password && (
                    <div style={{ marginTop: '8px' }}>
                      {validateSecurePassword(newUser.password).errors.map((error, index) => (
                        <div key={index} style={{ 
                          color: '#dc3545', 
                          fontSize: '11px', 
                          marginBottom: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <span style={{ color: '#dc3545' }}>❌</span> {error}
                        </div>
                      ))}
                      {validateSecurePassword(newUser.password).isValid && (
                        <div style={{ 
                          color: '#28a745', 
                          fontSize: '11px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <span style={{ color: '#28a745' }}>✅</span> Password válida!
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className={styles.formGroup}>
                  <label>Confirmar Password</label>
                  <input
                    className={styles.formInput}
                    type="password"
                    placeholder="Repita a password"
                    value={confirmCreatePassword}
                    onChange={(e) => setConfirmCreatePassword(e.target.value)}
                  />
                  {confirmCreatePassword && newUser.password !== confirmCreatePassword && (
                    <span className={styles.fieldError}>As passwords não coincidem</span>
                  )}
                </div>
                <div className={styles.formGroup}>
                  <label>Tipo de Utilizador</label>
                  <select
                    className={styles.formInput}
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as 'user' | 'admin' })}
                  >
                    <option value="user">Utilizador</option>
                    <option value="admin">Admin</option>
                  </select>
                  <span className={styles.formHelp}>Admins têm acesso completo ao backoffice.</span>
                </div>
                <div className={styles.formGroup}>
                  <label>Descrição</label>
                  <input
                    className={styles.formInput}
                    type="text"
                    placeholder="Ex: Conta do Hotel XYZ"
                    value={newUser.description}
                    onChange={(e) => setNewUser({ ...newUser, description: e.target.value })}
                  />
                </div>
                {newUser.role === 'user' && (
                  <div className={styles.formGroup}>
                    <label>Associar a Guia</label>
                    {guidesLoading ? (
                      <input className={styles.formInput} disabled value="A carregar guias..." />
                    ) : (
                      <select
                        className={styles.formInput}
                        value={newUser.guideSlug}
                        onChange={(e) => setNewUser({ ...newUser, guideSlug: e.target.value })}
                      >
                        <option value="">Selecione um guia</option>
                        {availableGuides.map((g) => (
                          <option key={g.slug} value={g.slug}>
                            {g.company ? `${g.company} — ${g.name}` : g.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <span className={styles.formHelp}>Obrigatório para contas do tipo "Utilizador".</span>
                  </div>
                )}
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button 
                className={styles.secondaryButton}
                onClick={() => setShowCreateModal(false)}
              >
                Cancelar
              </button>
              <button 
                className={styles.primaryButton}
                onClick={handleCreateUser}
                disabled={!newUser.username || !newUser.email || !newUser.password || (newUser.password !== confirmCreatePassword) || !newUser.description || (newUser.role === 'user' && !newUser.guideSlug) || !validateSecurePassword(newUser.password).isValid}
              >
                Criar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para eliminar utilizador */}
      {showDeleteModal && userToDelete && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: 30,
            borderRadius: 8,
            width: 450,
            maxWidth: '90vw'
          }}>
            <h3 style={{ color: '#d9534f', marginTop: 0 }}>⚠️ Eliminar Utilizador</h3>
            
            <p style={{ marginBottom: 20, lineHeight: 1.6 }}>
              Tem a certeza que pretende eliminar o utilizador <strong>&quot;{userToDelete.username}&quot;</strong>?
              <br/><br/>
              <strong style={{ color: '#d9534f' }}>Esta ação é irreversível!</strong> 
              <br/>
              Todos os dados do utilizador serão permanentemente removidos da base de dados.
            </p>

            <div style={{ 
              backgroundColor: '#fff3cd', 
              border: '1px solid #ffeaa7',
              padding: 15,
              borderRadius: 4,
              marginBottom: 20
            }}>
              <strong>Dados que serão eliminados:</strong>
              <ul style={{ margin: '10px 0', paddingLeft: 20 }}>
                <li>Username: {userToDelete.username}</li>
                <li>Tipo: {userToDelete.role === 'admin' ? 'Super Admin' : 'Utilizador'}</li>
                <li>Descrição: {userToDelete.description}</li>
                <li>Password encriptada</li>
                <li>Todas as definições da conta</li>
              </ul>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button 
                className={styles.filterButton}
                onClick={() => setShowDeleteModal(false)}
              >
                Cancelar
              </button>
              <button 
                className={styles.deleteAllButton}
                onClick={handleDeleteUser}
                style={{ 
                  backgroundColor: '#d9534f',
                  border: '1px solid #d43f3a'
                }}
              >
                🗑️ Eliminar Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para informações do utilizador */}
      {showInfoModal && selectedUser && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '700px',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
          }}>
            {/* Header */}
            <div style={{
              padding: '25px 30px 20px 30px',
              borderBottom: '2px solid #e9ecef',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f8f9fa'
            }}>
              <h2 style={{ 
                margin: 0, 
                color: '#2c3e50', 
                fontSize: '24px',
                fontWeight: '600'
              }}>
                ℹ️ Informações do Utilizador
              </h2>
              <button 
                onClick={() => setShowInfoModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '28px',
                  color: '#6c757d',
                  cursor: 'pointer',
                  padding: '5px',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#e9ecef';
                  e.currentTarget.style.color = '#dc3545';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#6c757d';
                }}
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '30px' }}>
              {/* Dados Pessoais */}
              <div style={{ marginBottom: '30px' }}>
                <h3 style={{ 
                  margin: '0 0 15px 0', 
                  color: '#2c3e50', 
                  fontSize: '18px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  👤 Dados Pessoais
                </h3>
                <div style={{ 
                  backgroundColor: '#ffffff', 
                  border: '2px solid #e9ecef',
                  padding: '20px', 
                  borderRadius: '10px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ marginBottom: '12px' }}>
                    <span style={{ 
                      fontWeight: '600', 
                      color: '#495057',
                      fontSize: '14px',
                      display: 'inline-block',
                      width: '100px'
                    }}>Username:</span>
                    <span style={{ 
                      color: '#2c3e50',
                      fontSize: '16px',
                      fontWeight: '500'
                    }}>{selectedUser.username}</span>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <span style={{ 
                      fontWeight: '600', 
                      color: '#495057',
                      fontSize: '14px',
                      display: 'inline-block',
                      width: '100px'
                    }}>Email:</span>
                    <span style={{ 
                      color: '#2c3e50',
                      fontSize: '16px',
                      fontWeight: '500'
                    }}>{selectedUser.email}</span>
                  </div>
                  <div>
                    <span style={{ 
                      fontWeight: '600', 
                      color: '#495057',
                      fontSize: '14px',
                      display: 'inline-block',
                      width: '100px'
                    }}>Descrição:</span>
                    <span style={{ 
                      color: '#2c3e50',
                      fontSize: '16px',
                      fontWeight: '500'
                    }}>{selectedUser.description}</span>
                  </div>
                </div>
              </div>

              {/* Permissões */}
              <div style={{ marginBottom: '30px' }}>
                <h3 style={{ 
                  margin: '0 0 15px 0', 
                  color: '#2c3e50', 
                  fontSize: '18px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  🔐 Permissões
                </h3>
                <div style={{ 
                  backgroundColor: '#ffffff', 
                  border: '2px solid #e9ecef',
                  padding: '20px', 
                  borderRadius: '10px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ marginBottom: '12px' }}>
                    <span style={{ 
                      fontWeight: '600', 
                      color: '#495057',
                      fontSize: '14px',
                      display: 'inline-block',
                      width: '100px'
                    }}>Tipo:</span>
                    <span style={{ 
                      backgroundColor: selectedUser.role === 'admin' ? '#dc3545' : '#4ecdc4', 
                      color: 'white', 
                      padding: '4px 12px', 
                      borderRadius: '6px', 
                      fontSize: '14px',
                      fontWeight: '600'
                    }}>
                      {selectedUser.role === 'admin' ? 'Super Admin' : 'Utilizador'}
                    </span>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <span style={{ 
                      fontWeight: '600', 
                      color: '#495057',
                      fontSize: '14px',
                      display: 'inline-block',
                      width: '100px'
                    }}>Estado:</span>
                    <span style={{ 
                      backgroundColor: selectedUser.active ? '#28a745' : '#6c757d', 
                      color: 'white', 
                      padding: '4px 12px', 
                      borderRadius: '6px', 
                      fontSize: '14px',
                      fontWeight: '600'
                    }}>
                      {selectedUser.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  {selectedUser.guideSlug && (
                    <div>
                      <span style={{ 
                        fontWeight: '600', 
                        color: '#495057',
                        fontSize: '14px',
                        display: 'inline-block',
                        width: '100px'
                      }}>Guia:</span>
                      <span style={{ 
                        color: '#2c3e50',
                        fontSize: '16px',
                        fontWeight: '500'
                      }}>{selectedUser.guideSlug}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Estatísticas */}
              <div style={{ marginBottom: '30px' }}>
                <h3 style={{ 
                  margin: '0 0 15px 0', 
                  color: '#2c3e50', 
                  fontSize: '18px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  📊 Estatísticas
                </h3>
                <div style={{ 
                  backgroundColor: '#ffffff', 
                  border: '2px solid #e9ecef',
                  padding: '20px', 
                  borderRadius: '10px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ marginBottom: '12px' }}>
                    <span style={{ 
                      fontWeight: '600', 
                      color: '#495057',
                      fontSize: '14px',
                      display: 'inline-block',
                      width: '120px'
                    }}>Sessões Ativas:</span>
                    <span style={{ 
                      color: '#2c3e50',
                      fontSize: '16px',
                      fontWeight: '500'
                    }}>{userSessions[selectedUser.id || ''] || 0}</span>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <span style={{ 
                      fontWeight: '600', 
                      color: '#495057',
                      fontSize: '14px',
                      display: 'inline-block',
                      width: '120px'
                    }}>Criado em:</span>
                    <span style={{ 
                      color: '#2c3e50',
                      fontSize: '16px',
                      fontWeight: '500'
                    }}>{new Date(selectedUser.createdAt).toLocaleString('pt-PT')}</span>
                  </div>
                  <div>
                    <span style={{ 
                      fontWeight: '600', 
                      color: '#495057',
                      fontSize: '14px',
                      display: 'inline-block',
                      width: '120px'
                    }}>Última Atualização:</span>
                    <span style={{ 
                      color: '#2c3e50',
                      fontSize: '16px',
                      fontWeight: '500'
                    }}>{new Date(selectedUser.updatedAt).toLocaleString('pt-PT')}</span>
                  </div>
                </div>
              </div>

              {/* Aviso de Sessões Ativas */}
              {userSessions[selectedUser.id || ''] > 0 && (
                <div style={{ 
                  backgroundColor: '#fff3cd', 
                  border: '2px solid #ffeaa7',
                  padding: '20px',
                  borderRadius: '10px',
                  marginBottom: '20px'
                }}>
                  <h4 style={{ 
                    margin: '0 0 10px 0', 
                    color: '#856404',
                    fontSize: '16px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>⚠️ Aviso</h4>
                  <p style={{ 
                    margin: '0', 
                    color: '#856404',
                    fontSize: '14px',
                    lineHeight: '1.5'
                  }}>
                    Este utilizador tem <strong>{userSessions[selectedUser.id || '']}</strong> sessão(ões) ativa(s). 
                    Pode fechar todas as sessões usando o botão "Fechar Sessões" na grelha.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: '20px 30px',
              borderTop: '2px solid #e9ecef',
              backgroundColor: '#f8f9fa',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <button 
                onClick={() => setShowInfoModal(false)}
                style={{
                  backgroundColor: '#4ecdc4',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(78, 205, 196, 0.3)'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#45b7aa';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(78, 205, 196, 0.4)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#4ecdc4';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(78, 205, 196, 0.3)';
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </BackofficeAuthGuard>
    </Suspense>
  );
}