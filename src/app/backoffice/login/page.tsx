'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import styles from './login.module.css';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error, clearError } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!username.trim() || !password.trim()) {
      return;
    }

    try {
      const success = await login({ username, password });

      if (success && success.success) {
        const role = (success.user && (success.user as any).role) ? String((success.user as any).role) : 'user';
        const destination = role === 'admin' ? '/backoffice' : '/backoffice/conversations';

        try {
          router.push(destination);

          setTimeout(() => {
            window.location.href = destination;
          }, 500);

        } catch (redirectError) {
          window.location.href = destination;
        }
      }
    } catch (err) {
      console.error('Erro no login:', err);
    }
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginBox}>
        <div className={styles.loginHeader}>
          <h1>Backoffice VirtualChat</h1>
          <p>Aceda ao seu painel de administração</p>
        </div>
        
        <form onSubmit={handleSubmit} className={styles.loginForm}>
          <div className={styles.formGroup}>
            <label htmlFor="username">
              Nome de Utilizador
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Digite o nome de utilizador"
              required
            />
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="password">
              Palavra-passe
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite a palavra-passe"
              required
            />
          </div>
          
          {error && (
            <div className={styles.errorMessage}>
              {error}
            </div>
          )}
          
          <button 
            type="submit" 
            className={styles.loginButton}
            disabled={isLoading}
          >
            {isLoading ? 'A entrar...' : 'Entrar'}
          </button>
        </form>
        
        <div className={styles.loginFooter}>
          <p>Sistema de Gestão VirtualChat</p>
        </div>
      </div>
    </div>
  );
}
