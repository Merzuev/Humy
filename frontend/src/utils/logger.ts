// Centralized logging utility
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  data?: any;
  userId?: string;
  sessionId?: string;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private currentLevel = process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO;
  private sessionId = this.generateSessionId();

  private generateSessionId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.currentLevel;
  }

  private createLogEntry(level: LogLevel, message: string, data?: any): LogEntry {
    return {
      level,
      message,
      timestamp: new Date(),
      data,
      sessionId: this.sessionId,
      userId: this.getCurrentUserId()
    };
  }

  private getCurrentUserId(): string | undefined {
    try {
      const token = localStorage.getItem('accessToken');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.user_id || payload.sub;
      }
    } catch (error) {
      // Ignore token parsing errors
    }
    return undefined;
  }

  private addLog(entry: LogEntry): void {
    this.logs.push(entry);
    
    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Send to external logging service in production
    if (process.env.NODE_ENV === 'production' && entry.level >= LogLevel.ERROR) {
      this.sendToExternalService(entry);
    }
  }

  private sendToExternalService(entry: LogEntry): void {
    // Send to external logging service (e.g., LogRocket, Sentry, etc.)
    try {
      // Example: Send to your logging endpoint
      fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      }).catch(() => {
        // Ignore logging errors to prevent infinite loops
      });
    } catch (error) {
      // Ignore logging errors
    }
  }

  debug(message: string, data?: any): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    
    const entry = this.createLogEntry(LogLevel.DEBUG, message, data);
    this.addLog(entry);
    console.debug(`[DEBUG] ${message}`, data);
  }

  info(message: string, data?: any): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    
    const entry = this.createLogEntry(LogLevel.INFO, message, data);
    this.addLog(entry);
    console.info(`[INFO] ${message}`, data);
  }

  warn(message: string, data?: any): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    
    const entry = this.createLogEntry(LogLevel.WARN, message, data);
    this.addLog(entry);
    console.warn(`[WARN] ${message}`, data);
  }

  error(message: string, error?: Error | any): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    
    const entry = this.createLogEntry(LogLevel.ERROR, message, {
      error: error?.message || error,
      stack: error?.stack,
      name: error?.name
    });
    this.addLog(entry);
    
    // Only log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`[ERROR] ${message}`, error);
    }
  }

  // API call logging
  apiCall(method: string, url: string, data?: any): void {
    if (process.env.NODE_ENV === 'development') {
      this.debug(`API ${method.toUpperCase()} ${url}`, data);
    }
  }

  apiResponse(method: string, url: string, status: number, data?: any): void {
    const message = `API ${method.toUpperCase()} ${url} - ${status}`;
    if (status >= 400) {
      this.error(message, data);
    } else {
      if (process.env.NODE_ENV === 'development') {
        this.debug(message, data);
      }
    }
  }

  // User action logging
  userAction(action: string, data?: any): void {
    this.info(`User action: ${action}`, data);
  }

  // Performance logging
  performance(operation: string, duration: number, data?: any): void {
    this.info(`Performance: ${operation} took ${duration}ms`, data);
  }

  // Get logs for debugging
  getLogs(level?: LogLevel): LogEntry[] {
    if (level !== undefined) {
      return this.logs.filter(log => log.level >= level);
    }
    return [...this.logs];
  }

  // Clear logs
  clearLogs(): void {
    this.logs = [];
  }

  // Export logs for support
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

// Create singleton instance
export const logger = new Logger();

// Performance measurement utility
export function measurePerformance<T>(
  operation: string,
  fn: () => T | Promise<T>
): T | Promise<T> {
  const start = performance.now();
  
  try {
    const result = fn();
    
    if (result instanceof Promise) {
      return result.finally(() => {
        const duration = performance.now() - start;
        logger.performance(operation, duration);
      });
    } else {
      const duration = performance.now() - start;
      logger.performance(operation, duration);
      return result;
    }
  } catch (error) {
    const duration = performance.now() - start;
    logger.error(`Performance measurement failed for ${operation}`, error);
    logger.performance(operation, duration, { error: true });
    throw error;
  }
}

// API call wrapper with logging
export function loggedApiCall<T>(
  method: string,
  url: string,
  apiCall: () => Promise<T>
): Promise<T> {
  logger.apiCall(method, url);
  const start = performance.now();
  
  return apiCall()
    .then(response => {
      const duration = performance.now() - start;
      logger.apiResponse(method, url, 200);
      logger.performance(`API ${method.toUpperCase()} ${url}`, duration);
      return response;
    })
    .catch(error => {
      const duration = performance.now() - start;
      const status = error.response?.status || 0;
      logger.apiResponse(method, url, status, error.response?.data);
      logger.performance(`API ${method.toUpperCase()} ${url}`, duration, { error: true });
      throw error;
    });
}