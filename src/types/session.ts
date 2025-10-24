// Interfaces para o sistema de sessões
export interface UserSession {
  id?: string;
  userId: string;
  username: string;
  role: 'user' | 'admin';
  guideSlug?: string; // Para utilizadores que são guias específicos
  isActive: boolean;
  createdAt: any; // Firestore Timestamp
  lastActivity: any; // Firestore Timestamp
  expiresAt: any; // Firestore Timestamp
  ipAddress?: string;
  userAgent?: string;
  tokenHash: string; // Hash do token de sessão
}

export interface SessionToken {
  sessionId: string;
  userId: string;
  username: string;
  role: 'user' | 'admin';
  guideSlug?: string;
  expiresAt: number; // Unix timestamp
  issuedAt: number; // Unix timestamp
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  session?: UserSession;
  token?: string;
  error?: string;
  user?: {
    id: string;
    username: string;
    role: 'user' | 'admin';
    guideSlug?: string;
  };
}

export interface LogoutResponse {
  success: boolean;
  message: string;
}

// Estados de autenticação
export type AuthState = 'authenticated' | 'unauthenticated' | 'loading' | 'error';

// Tipos de middleware
export type MiddlewareFunction = (req: Request, res: Response, next: () => void) => void;
export type AuthMiddleware = (requiredRole?: 'user' | 'admin') => MiddlewareFunction;

export interface SessionData {
  userId: string;
  username: string;
  role: string;
  guideId?: string;
  guideName?: string;
  startTime: Date;
  lastActivity: Date;
  isActive: boolean;
  metadata?: Record<string, unknown>;
}

export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  totalDuration: number;
  averageDuration: number;
  sessionsByGuide: Record<string, number>;
  sessionsByUser: Record<string, number>;
}

export interface SessionFilters {
  userId?: string;
  guideId?: string;
  isActive?: boolean;
  startDate?: Date;
  endDate?: Date;
  role?: string;
}

export interface SessionSearchParams {
  userId?: string;
  guideId?: string;
  isActive?: boolean;
  startDate?: string;
  endDate?: string;
  role?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

