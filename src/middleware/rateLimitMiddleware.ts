import { NextRequest, NextResponse } from 'next/server';
import { LRUCache } from 'lru-cache';

// Configurações padrão de rate limiting
const DEFAULT_RATE_LIMIT_CONFIG = {
  // Número máximo de requisições por janela de tempo
  tokensPerInterval: 50,
  
  // Intervalo de tempo em segundos
  interval: 60, // 60 segundos = 1 minuto
  
  // Tempo de bloqueio em segundos após exceder o limite
  blockDuration: 60, // 60 segundos = 1 minuto
};

// Interface para configuração de rate limiting
interface RateLimitConfig {
  tokensPerInterval: number;
  interval: number;
  blockDuration: number;
}

// Interface para armazenar informações de rate limiting por IP
interface RateLimitInfo {
  tokens: number;
  lastRefill: number;
  blockedUntil?: number;
}

// Cache para armazenar informações de rate limiting
const rateLimitCache = new LRUCache<string, RateLimitInfo>({
  max: 10000, // Máximo de 10000 IPs diferentes
  ttl: 1000 * 60 * 60, // Tempo de vida de 1 hora
});

// Função para obter o IP real do cliente
function getClientIp(request: NextRequest): string {
  // Tentar obter o IP real do cliente a partir dos headers
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // O header pode conter múltiplos IPs separados por vírgula
    return forwardedFor.split(',')[0].trim();
  }
  
  // Se não houver x-forwarded-for, usar o IP remoto
  const ip = request.ip || '127.0.0.1';
  return ip;
}

// Middleware de rate limiting baseado em token bucket
export function rateLimit(config: Partial<RateLimitConfig> = {}) {
  // Mesclar configurações padrão com as fornecidas
  const rateLimitConfig: RateLimitConfig = {
    ...DEFAULT_RATE_LIMIT_CONFIG,
    ...config
  };
  
  return async (request: NextRequest): Promise<NextResponse | null> => {
    // Obter o IP do cliente
    const clientIp = getClientIp(request);
    
    // Obter o caminho da requisição para limitar por rota
    const path = request.nextUrl.pathname;
    
    // Chave única para este IP e rota
    const key = `${clientIp}:${path}`;
    
    // Obter informações de rate limiting para este IP e rota
    let rateLimitInfo = rateLimitCache.get(key);
    if (!rateLimitInfo) {
      // Se não houver informações, criar uma nova entrada
      rateLimitInfo = {
        tokens: rateLimitConfig.tokensPerInterval,
        lastRefill: Date.now()
      };
      rateLimitCache.set(key, rateLimitInfo);
    }
    
    // Verificar se o IP está bloqueado
    if (rateLimitInfo.blockedUntil && rateLimitInfo.blockedUntil > Date.now()) {
      // Calcular tempo restante de bloqueio
      const remainingSeconds = Math.ceil((rateLimitInfo.blockedUntil - Date.now()) / 1000);
      
      return NextResponse.json(
        { 
          error: 'Muitas requisições. Tente novamente mais tarde.',
          retryAfter: remainingSeconds
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(remainingSeconds),
            'X-RateLimit-Limit': String(rateLimitConfig.tokensPerInterval),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(rateLimitInfo.blockedUntil / 1000))
          }
        }
      );
    }
    
    // Calcular o tempo decorrido desde o último reabastecimento
    const now = Date.now();
    const elapsedSeconds = (now - rateLimitInfo.lastRefill) / 1000;
    
    // Reabastecer tokens com base no tempo decorrido
    if (elapsedSeconds > 0) {
      // Calcular quantos tokens adicionar
      const tokensToAdd = Math.floor(elapsedSeconds * (rateLimitConfig.tokensPerInterval / rateLimitConfig.interval));
      
      if (tokensToAdd > 0) {
        // Atualizar tokens e timestamp de reabastecimento
        rateLimitInfo.tokens = Math.min(rateLimitConfig.tokensPerInterval, rateLimitInfo.tokens + tokensToAdd);
        rateLimitInfo.lastRefill = now;
      }
    }
    
    // Verificar se há tokens disponíveis
    if (rateLimitInfo.tokens <= 0) {
      // Sem tokens disponíveis, bloquear o IP
      rateLimitInfo.blockedUntil = now + (rateLimitConfig.blockDuration * 1000);
      rateLimitCache.set(key, rateLimitInfo);
      
      return NextResponse.json(
        { 
          error: 'Muitas requisições. Tente novamente mais tarde.',
          retryAfter: rateLimitConfig.blockDuration
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(rateLimitConfig.blockDuration),
            'X-RateLimit-Limit': String(rateLimitConfig.tokensPerInterval),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil((now + (rateLimitConfig.blockDuration * 1000)) / 1000))
          }
        }
      );
    }
    
    // Consumir um token
    rateLimitInfo.tokens -= 1;
    rateLimitCache.set(key, rateLimitInfo);
    
    // Adicionar headers de rate limiting
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', String(rateLimitConfig.tokensPerInterval));
    response.headers.set('X-RateLimit-Remaining', String(rateLimitInfo.tokens));
    response.headers.set('X-RateLimit-Reset', String(Math.ceil((now + (rateLimitConfig.interval * 1000)) / 1000)));
    
    return null; // Continuar com o request
  };
}

// Funções de conveniência para diferentes níveis de rate limiting
export const standardRateLimit = () => rateLimit();
export const strictRateLimit = () => rateLimit({ tokensPerInterval: 20, interval: 60, blockDuration: 120 });
export const lenientRateLimit = () => rateLimit({ tokensPerInterval: 100, interval: 60, blockDuration: 30 });
export const customRateLimit = (config: Partial<RateLimitConfig>) => rateLimit(config);
