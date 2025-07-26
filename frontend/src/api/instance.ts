import axios from 'axios';
import { apiCache, cacheKeys } from '../utils/apiCache';
import { logger, loggedApiCall } from '../utils/logger';
import { errorHandler, ErrorCode } from '../utils/errorHandler';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for caching
apiClient.interceptors.request.use(
  (config) => {
    // Only cache GET requests
    if (config.method === 'get') {
      const cacheKey = `${config.method}-${config.url}-${JSON.stringify(config.params || {})}`;
      const cachedData = apiCache.get(cacheKey);
      
      if (cachedData) {
        // Return cached data by modifying the config
        config.adapter = () => Promise.resolve({
          data: cachedData,
          status: 200,
          statusText: 'OK',
          headers: {},
          config
        });
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    // Log API request
    if (process.env.NODE_ENV === 'development') {
      logger.apiCall(config.method?.toUpperCase() || 'GET', config.url || '');
    }
    
    const token = localStorage.getItem('access');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    // Log successful response
    if (process.env.NODE_ENV === 'development') {
      logger.apiResponse(
        response.config.method?.toUpperCase() || 'GET',
        response.config.url || '',
        response.status
      );
    }
    
    // Cache successful GET responses
    if (response.config.method === 'get' && response.status === 200) {
      const cacheKey = `${response.config.method}-${response.config.url}-${JSON.stringify(response.config.params || {})}`;
      
      // Different TTL for different endpoints
      let ttl = 5 * 60 * 1000; // 5 minutes default
      
      if (response.config.url?.includes('/conversations/')) {
        ttl = 2 * 60 * 1000; // 2 minutes for conversations
      } else if (response.config.url?.includes('/messages')) {
        ttl = 30 * 1000; // 30 seconds for messages
      } else if (response.config.url?.includes('/settings')) {
        ttl = 10 * 60 * 1000; // 10 minutes for settings
      }
      
      apiCache.set(cacheKey, response.data, ttl);
    }
    
    return response;
  },
  (error) => {
    // Log error response
    const method = error.config?.method?.toUpperCase() || 'GET';
    const url = error.config?.url || '';
    const status = error.response?.status || 0;
    
    if (process.env.NODE_ENV === 'development') {
      logger.apiResponse(method, url, status, error.response?.data);
    }
    
    // Handle specific error cases
    const appError = errorHandler.handleError(error, `API ${method} ${url}`);
    
    if (error.response?.status === 401) {
      if (process.env.NODE_ENV === 'development') {
        logger.warn('Authentication expired, redirecting to login');
      }
      localStorage.removeItem('access');
      localStorage.removeItem('refresh');
      window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);

// Helper function to invalidate cache
export const invalidateCache = (pattern?: string) => {
  if (pattern) {
    const stats = apiCache.getStats();
    stats.keys.forEach(key => {
      if (key.includes(pattern)) {
        apiCache.delete(key);
      }
    });
  } else {
    apiCache.clear();
  }
};

export default apiClient;