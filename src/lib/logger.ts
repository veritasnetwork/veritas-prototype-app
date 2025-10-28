/**
 * Production-Safe Logging Utility
 *
 * Provides environment-aware logging that:
 * - Respects NODE_ENV to reduce production noise
 * - Provides consistent log formatting
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.debug('Detailed debug info');  // Only in dev
 *   logger.info('General info');          // Always logged
 *   logger.warn('Warning message');       // Always logged
 *   logger.error('Error occurred', err);  // Always logged
 */

const isDevelopment = process.env.NODE_ENV !== 'production';
const isTest = process.env.NODE_ENV === 'test';

/**
 * Format log messages with timestamp and context
 */
function formatMessage(level: string, ...args: any[]): any[] {
  const timestamp = new Date().toISOString();
  return [`[${timestamp}] [${level}]`, ...args];
}

export const logger = {
  /**
   * Debug logging - only in development
   * Use for detailed debugging information
   */
  debug: (...args: any[]) => {
    if (isDevelopment && !isTest) {
    }
  },

  /**
   * Info logging - always logged
   * Use for general informational messages
   */
  info: (...args: any[]) => {
    if (!isTest) {
    }
  },

  /**
   * Warning logging - always logged
   * Use for warning messages that don't halt execution
   */
  warn: (...args: any[]) => {
    if (!isTest) {
      console.warn(...formatMessage('WARN', ...args));
    }
  },

  /**
   * Error logging - always logged
   * Use for errors and exceptions
   */
  error: (...args: any[]) => {
    if (!isTest) {
      console.error(...formatMessage('ERROR', ...args));
    }
  },

  /**
   * Log only in development (deprecated - use debug instead)
   * @deprecated Use logger.debug() instead
   */
  dev: (...args: any[]) => {
    if (isDevelopment && !isTest) {
    }
  },
};

/**
 * Create a namespaced logger for specific modules
 *
 * @param namespace - Module or component name
 * @returns Logger with namespace prefix
 *
 * @example
 * const log = createLogger('AuthService');
 * log.info('User logged in'); // [2025-01-25T...] [INFO] [AuthService] User logged in
 */
export function createLogger(namespace: string) {
  return {
    debug: (...args: any[]) => logger.debug(`[${namespace}]`, ...args),
    info: (...args: any[]) => logger.info(`[${namespace}]`, ...args),
    warn: (...args: any[]) => logger.warn(`[${namespace}]`, ...args),
    error: (...args: any[]) => logger.error(`[${namespace}]`, ...args),
  };
}

/**
 * Performance timing utility
 * Logs execution time of operations
 *
 * @example
 * const timer = startTimer('Database query');
 * await db.query(...);
 * timer.end(); // Logs: Database query took 245ms
 */
export function startTimer(label: string) {
  const start = performance.now();

  return {
    end: () => {
      const duration = performance.now() - start;
      logger.debug(`⏱️  ${label} took ${duration.toFixed(2)}ms`);
    },
  };
}
