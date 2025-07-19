import { logger } from './logger';

export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  userId?: string;
}

export enum ErrorCode {
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  
  // Authentication errors
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  AUTH_EXPIRED = 'AUTH_EXPIRED',
  AUTH_INVALID = 'AUTH_INVALID',
  
  // Permission errors
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  
  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  
  // API errors
  API_ERROR = 'API_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  
  // Application errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  COMPONENT_ERROR = 'COMPONENT_ERROR'
}

class ErrorHandler {
  private errorQueue: AppError[] = [];
  private maxErrors = 100;

  createError(code: ErrorCode, message: string, details?: any): AppError {
    return {
      code,
      message,
      details,
      timestamp: new Date(),
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

  handleError(error: any, context?: string): AppError {
    let appError: AppError;

    if (error.response) {
      // HTTP error response
      appError = this.handleHttpError(error, context);
    } else if (error.request) {
      // Network error
      appError = this.createError(
        ErrorCode.NETWORK_ERROR,
        'Network error occurred',
        { context, originalError: error.message }
      );
    } else if (error instanceof Error) {
      // JavaScript error
      appError = this.createError(
        ErrorCode.UNKNOWN_ERROR,
        error.message,
        { context, stack: error.stack }
      );
    } else {
      // Unknown error
      appError = this.createError(
        ErrorCode.UNKNOWN_ERROR,
        'An unknown error occurred',
        { context, error }
      );
    }

    this.logError(appError);
    this.addToQueue(appError);
    
    return appError;
  }

  private handleHttpError(error: any, context?: string): AppError {
    const status = error.response.status;
    const data = error.response.data;

    switch (status) {
      case 400:
        return this.createError(
          ErrorCode.VALIDATION_ERROR,
          data.message || 'Invalid request data',
          { context, status, data }
        );
      
      case 401:
        return this.createError(
          ErrorCode.AUTH_REQUIRED,
          'Authentication required',
          { context, status, data }
        );
      
      case 403:
        return this.createError(
          ErrorCode.PERMISSION_DENIED,
          'Permission denied',
          { context, status, data }
        );
      
      case 404:
        return this.createError(
          ErrorCode.RESOURCE_NOT_FOUND,
          'Resource not found',
          { context, status, data }
        );
      
      case 429:
        return this.createError(
          ErrorCode.RATE_LIMITED,
          'Too many requests',
          { context, status, data }
        );
      
      case 500:
      case 502:
      case 503:
      case 504:
        return this.createError(
          ErrorCode.SERVER_ERROR,
          'Server error occurred',
          { context, status, data }
        );
      
      default:
        return this.createError(
          ErrorCode.API_ERROR,
          `HTTP ${status} error`,
          { context, status, data }
        );
    }
  }

  private logError(error: AppError): void {
    // Only log detailed errors in development
    if (process.env.NODE_ENV === 'development') {
      logger.error(`[${error.code}] ${error.message}`, error.details);
    } else {
      // In production, log only essential info
      logger.error(`Error: ${error.code}`, { message: error.message });
    }
  }

  private addToQueue(error: AppError): void {
    this.errorQueue.push(error);
    
    if (this.errorQueue.length > this.maxErrors) {
      this.errorQueue = this.errorQueue.slice(-this.maxErrors);
    }
  }

  // Get user-friendly error message
  getUserMessage(error: AppError): string {
    switch (error.code) {
      case ErrorCode.NETWORK_ERROR:
        return 'Проблема с подключением к интернету. Проверьте соединение и попробуйте снова.';
      
      case ErrorCode.AUTH_REQUIRED:
      case ErrorCode.AUTH_EXPIRED:
        return 'Необходимо войти в систему заново.';
      
      case ErrorCode.PERMISSION_DENIED:
        return 'У вас нет прав для выполнения этого действия.';
      
      case ErrorCode.RESOURCE_NOT_FOUND:
        return 'Запрашиваемый ресурс не найден.';
      
      case ErrorCode.RATE_LIMITED:
        return 'Слишком много запросов. Подождите немного и попробуйте снова.';
      
      case ErrorCode.SERVER_ERROR:
        return 'Проблема на сервере. Мы уже работаем над её решением.';
      
      case ErrorCode.VALIDATION_ERROR:
        return error.details?.message || 'Проверьте правильность введённых данных.';
      
      default:
        return 'Произошла неожиданная ошибка. Попробуйте обновить страницу.';
    }
  }

  // Check if error should trigger logout
  shouldLogout(error: AppError): boolean {
    return [ErrorCode.AUTH_REQUIRED, ErrorCode.AUTH_EXPIRED, ErrorCode.AUTH_INVALID].includes(error.code as ErrorCode);
  }

  // Check if error should be retried
  canRetry(error: AppError): boolean {
    return [
      ErrorCode.NETWORK_ERROR,
      ErrorCode.TIMEOUT_ERROR,
      ErrorCode.SERVER_ERROR
    ].includes(error.code as ErrorCode);
  }

  // Get recent errors for debugging
  getRecentErrors(limit = 10): AppError[] {
    return this.errorQueue.slice(-limit);
  }

  // Clear error queue
  clearErrors(): void {
    this.errorQueue = [];
  }
}

// Create singleton instance
export const errorHandler = new ErrorHandler();

// Utility function for handling async operations
export async function handleAsync<T>(
  operation: () => Promise<T>,
  context?: string
): Promise<{ data?: T; error?: AppError }> {
  try {
    const data = await operation();
    return { data };
  } catch (error) {
    const appError = errorHandler.handleError(error, context);
    return { error: appError };
  }
}

// React hook for error handling
export function useErrorHandler() {
  const handleError = (error: any, context?: string) => {
    return errorHandler.handleError(error, context);
  };

  const getUserMessage = (error: AppError) => {
    return errorHandler.getUserMessage(error);
  };

  const shouldLogout = (error: AppError) => {
    return errorHandler.shouldLogout(error);
  };

  const canRetry = (error: AppError) => {
    return errorHandler.canRetry(error);
  };

  return {
    handleError,
    getUserMessage,
    shouldLogout,
    canRetry
  };
}