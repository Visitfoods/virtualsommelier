/**
 * Logger utility que desativa logs em produção
 * Use este logger em vez de console.log diretamente
 */

const isProduction = process.env.NODE_ENV === 'production';

export const logger = {
  log: (...args: any[]) => {
    if (!isProduction) {
      console.log(...args);
    }
  },
  
  warn: (...args: any[]) => {
    if (!isProduction) {
      console.warn(...args);
    }
  },
  
  info: (...args: any[]) => {
    if (!isProduction) {
      console.info(...args);
    }
  },
  
  debug: (...args: any[]) => {
    if (!isProduction) {
      console.debug(...args);
    }
  },
  
  // Errors should always be logged even in production
  error: (...args: any[]) => {
    console.error(...args);
  }
};

// Para compatibilidade, exportar também como default
export default logger;
