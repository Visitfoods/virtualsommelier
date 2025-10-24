import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  doc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  orderBy,
  limit as firestoreLimit,
  Timestamp
} from 'firebase/firestore';
import { mainDb } from '../firebase/mainConfig';
import { UserSession, LoginCredentials, LoginResponse, LogoutResponse } from '../types/session';
import bcrypt from 'bcryptjs';
import { listUsers, User } from '../firebase/userServices';

// Configurações de sessão RIGOROSAS
  const SESSION_CONFIG = {
    EXPIRY_HOURS: 24,
    CLEANUP_INTERVAL: 1000 * 60 * 2, // 2 minutos
    MAX_SESSIONS_PER_USER: 7, // LIMITE RIGOROSO
    ENFORCE_STRICT: true
  };

// Gerar token de sessão único usando criptografia segura
const generateSessionToken = (): string => {
  try {
    // Usar crypto.randomBytes para gerar tokens criptograficamente seguros
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  } catch (error) {
    console.error('Erro ao gerar token seguro:', error);
    // Fallback apenas em caso de erro (não deve acontecer em ambiente Node.js moderno)
    const secureRandom = new Uint8Array(32);
    crypto.getRandomValues(secureRandom);
    return Array.from(secureRandom)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
};

// Calcular data de expiração
const calculateExpiryDate = (): Timestamp => {
  const expiryDate = new Date();
  expiryDate.setHours(expiryDate.getHours() + SESSION_CONFIG.EXPIRY_HOURS);
  return Timestamp.fromDate(expiryDate);
};

// Hash do token para armazenamento seguro
const hashToken = async (token: string): Promise<string> => {
  return await bcrypt.hash(token, 10);
};

// Verificar se o token é válido
const verifyToken = async (token: string, hash: string): Promise<boolean> => {
  return await bcrypt.compare(token, hash);
};

// Serviço de sessões com LIMPEZA AUTOMÁTICA
export class SessionService {
  
  // VERIFICAÇÃO E LIMPEZA AUTOMÁTICA DE SESSÕES
  static async enforceStrictSessionLimit(userId: string): Promise<boolean> {
    try {
      // Verificar se há sessões ativas
      const activeSessions = await this.getActiveSessionsByUser(userId);
      
      // Se atingiu o limite, eliminar a sessão mais antiga
      if (activeSessions.length >= SESSION_CONFIG.MAX_SESSIONS_PER_USER) {
        // Ordenar por data de criação (mais antiga primeiro)
        const sortedSessions = activeSessions.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(0);
          const dateB = b.createdAt?.toDate?.() || new Date(0);
          return dateA.getTime() - dateB.getTime();
        });
        
        // Eliminar a sessão mais antiga
        const oldestSession = sortedSessions[0];
        if (!oldestSession.id) {
          return false;
        }
        
        try {
          await deleteDoc(doc(mainDb, 'active_sessions', oldestSession.id));
        } catch (deleteError) {
          return false;
        }
        
        return true;
      }
      
      return true;
      
    } catch (error) {
      return false;
    }
  }
  
  // LOGIN
  static async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      // 1. Verificar credenciais
      const users = await listUsers();
      
      const user = users.find(u => 
        u.username === credentials.username && 
        u.active === true
      );

      if (!user) {
        return {
          success: false,
          error: 'Utilizador não encontrado ou inativo'
        };
      }

      // 2. Verificar password
      const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
      if (!isPasswordValid) {
        return {
          success: false,
          error: 'Password incorreta'
        };
      }

      // 3. VERIFICAÇÃO E LIMPEZA AUTOMÁTICA DE SESSÕES
      const canLogin = await this.enforceStrictSessionLimit(user.id || '');
      
      if (!canLogin) {
        return {
          success: false,
          error: 'Erro ao processar sessões. Tente novamente.'
        };
      }

      // 4. Criar nova sessão
      const sessionToken = generateSessionToken();
      const tokenHash = await hashToken(sessionToken);
      
      // Criar objeto de sessão sem campos undefined
      const sessionData: Record<string, unknown> = {
        userId: user.id || '',
        username: user.username,
        role: user.role,
        isActive: true,
        createdAt: serverTimestamp(),
        lastActivity: serverTimestamp(),
        expiresAt: calculateExpiryDate(),
        ipAddress: this.getClientIP(),
        userAgent: this.getUserAgent(),
        tokenHash
      };

      // Adicionar guideSlug apenas se existir
      if (user.role === 'user' && (user as unknown as Record<string, unknown>).guideSlug) {
        sessionData.guideSlug = (user as unknown as Record<string, unknown>).guideSlug;
      }

      const sessionRef = await addDoc(collection(mainDb, 'active_sessions'), sessionData);
      
      const response: LoginResponse = {
        success: true,
        session: { ...sessionData, id: sessionRef.id } as UserSession,
        token: sessionToken,
        user: {
          id: user.id || '',
          username: user.username,
          role: user.role,
          guideSlug: user.role === 'user' && (user as unknown as Record<string, unknown>).guideSlug ? String((user as unknown as Record<string, unknown>).guideSlug) : undefined
        }
      };
      
      return response;

    } catch (error) {
      console.error('❌ Erro no login rigoroso:', error);
      return {
        success: false,
        error: 'Erro interno do servidor'
      };
    }
  }

  // Verificar se uma sessão é válida
  static async validateSession(sessionId: string, token: string): Promise<UserSession | null> {
    try {
      const sessionDoc = await getDoc(doc(mainDb, 'active_sessions', sessionId));
      
      if (!sessionDoc.exists()) {
        return null;
      }

      const session = sessionDoc.data() as UserSession;
      
      if (!session.isActive) {
        return null;
      }

      if (session.expiresAt.toDate() < new Date()) {
        await this.logoutSession(sessionId);
        return null;
      }

      const isTokenValid = await verifyToken(token, session.tokenHash);
      if (!isTokenValid) {
        return null;
      }

      await updateDoc(doc(mainDb, 'active_sessions', sessionId), {
        lastActivity: serverTimestamp()
      });

      return { ...session, id: sessionId };

    } catch (error) {
      return null;
    }
  }

  // Fazer logout de uma sessão específica
  static async logoutSession(sessionId: string): Promise<LogoutResponse> {
    try {
      await deleteDoc(doc(mainDb, 'active_sessions', sessionId));
      
      return {
        success: true,
        message: 'Sessão terminada com sucesso'
      };

    } catch (error) {
      return {
        success: false,
        message: 'Erro ao terminar sessão'
      };
    }
  }

  // Fazer logout de todas as sessões de um utilizador
  static async logoutAllUserSessions(userId: string): Promise<LogoutResponse> {
    try {
      const sessions = await this.getActiveSessionsByUser(userId);
      
      const deletePromises = sessions.map(session => 
        session.id ? this.logoutSession(session.id) : Promise.resolve()
      );
      
      await Promise.all(deletePromises);
      
      return {
        success: true,
        message: `Todas as sessões terminadas (${sessions.length})`
      };

    } catch (error) {
      return {
        success: false,
        message: 'Erro ao terminar sessões'
      };
    }
  }

  // Obter sessões ativas de um utilizador
  static async getActiveSessionsByUser(userId: string): Promise<UserSession[]> {
    try {
      // Query para buscar sessões ativas do utilizador
      const q = query(
        collection(mainDb, 'active_sessions'),
        where('userId', '==', userId),
        where('isActive', '==', true)
      );
      
      const querySnapshot = await getDocs(q);
      
      const sessions: UserSession[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        // Verificar se a sessão não expirou
        if (data.expiresAt && data.expiresAt.toDate && data.expiresAt.toDate() > new Date()) {
          sessions.push({
            ...data,
            id: doc.id
          } as UserSession);
        }
      });
      
      return sessions;

    } catch (error) {
      return [];
    }
  }

  // Forçar limpeza de todas as sessões antigas
  static async forceCleanupAllSessions(): Promise<void> {
    try {
      // Buscar todas as sessões
      const querySnapshot = await getDocs(collection(mainDb, 'active_sessions'));
      
      if (querySnapshot.docs.length > 0) {
        const deletePromises = querySnapshot.docs.map(doc => {
          return deleteDoc(doc.ref);
        });
        
        await Promise.all(deletePromises);
      }

    } catch (error) {
      // Erro silencioso
    }
  }

  // Limpar sessões expiradas
  static async cleanupExpiredSessions(): Promise<void> {
    try {
      const now = Timestamp.now();
      
      // Buscar todas as sessões expiradas
      const q = query(
        collection(mainDb, 'active_sessions'),
        where('expiresAt', '<', now)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.docs.length > 0) {
        const deletePromises = querySnapshot.docs.map(doc => {
          return deleteDoc(doc.ref);
        });
        
        await Promise.all(deletePromises);
      }

    } catch (error) {
      // Erro silencioso
    }
  }

  // Fechar todas as sessões de um utilizador específico
  static async closeAllUserSessions(userId: string): Promise<{ success: boolean; closedCount: number; error?: string }> {
    try {
      // Obter sessões ativas do utilizador
      const activeSessions = await this.getActiveSessionsByUser(userId);
      
      if (activeSessions.length === 0) {
        return { success: true, closedCount: 0 };
      }
      
      // Fechar todas as sessões (marcar como inativas)
      const closePromises = activeSessions.map(async (session) => {
        if (!session.id) return;
        
        try {
          await updateDoc(doc(mainDb, 'active_sessions', session.id), {
            isActive: false,
            closedAt: serverTimestamp(),
            closedBy: 'admin'
          });
          return true;
        } catch (error) {
          return false;
        }
      });
      
      const results = await Promise.all(closePromises);
      const closedCount = results.filter(Boolean).length;
      
      return { 
        success: true, 
        closedCount 
      };
      
    } catch (error) {
      return { 
        success: false, 
        closedCount: 0, 
        error: 'Erro ao fechar sessões' 
      };
    }
  }

  // Obter IP do cliente (simulado para desenvolvimento)
  private static getClientIP(): string {
    return '127.0.0.1';
  }

  // Obter User Agent (simulado para desenvolvimento)
  private static getUserAgent(): string {
    return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  }

  // Iniciar limpeza automática de sessões
  static startCleanupScheduler(): void {
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, SESSION_CONFIG.CLEANUP_INTERVAL);
  }
}

// Iniciar limpeza automática
SessionService.startCleanupScheduler();
