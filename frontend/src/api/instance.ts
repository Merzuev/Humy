import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { apiCache } from '../utils/apiCache';
import { logger } from '../utils/logger';
import { errorHandler } from '../utils/errorHandler';

// === База бэкенда ===
// Пример .env: VITE_API_BASE_URL=http://127.0.0.1:8000  (можно и http://127.0.0.1:8000/api)
const RAW_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
const BASE = String(RAW_BASE).replace(/\/+$/, '');
const BASE_HAS_API_PREFIX = /\/api$/i.test(BASE);

const apiClient = axios.create({
  baseURL: BASE,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// ---------- Нормализация путей ----------
function normalizeUrl(url?: string): string | undefined {
  if (!url) return url;

  // Абсолютные URL не трогаем
  if (/^https?:\/\//i.test(url)) return url;

  // Гарантируем ведущий слэш
  let u = url.startsWith('/') ? url : `/${url}`;

  // Не трогаем WebSocket-paths
  if (u.startsWith('/ws/')) return u;

  // Не трогаем auth-эндпоинты (у тебя они на корне /auth/ без /api)
  if (u.startsWith('/auth/')) return u;

  // Не трогаем, если уже /api
  if (u === '/api' || u.startsWith('/api/')) return u;

  // Если base уже заканчивается на /api — второй /api не добавляем
  if (BASE_HAS_API_PREFIX) return u;

  // Иначе префиксуем /api
  return `/api${u}`;
}

// ---------- JWT Refresh (антипетля) ----------
let isRefreshing = false;
let refreshSubscribers: Array<(token: string | null) => void> = [];

function onRefreshed(token: string | null) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(cb: (token: string | null) => void) {
  refreshSubscribers.push(cb);
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = localStorage.getItem('refresh');
  if (!refresh) return null;
  try {
    // Djoser + SimpleJWT:
    // POST /auth/jwt/refresh/  { refresh }
    const resp = await apiClient.post('/auth/jwt/refresh/', { refresh });
    const newAccess = resp.data?.access;
    if (newAccess) {
      localStorage.setItem('access', newAccess);
      return newAccess;
    }
    return null;
  } catch {
    return null;
  }
}

function isAuthUrl(url: string | undefined): boolean {
  if (!url) return false;
  // Разрешаем любые djoser/jwt/user-роуты как "auth"
  return /\/auth\/jwt\/(create|refresh|verify)\/?$|\/auth\/users\/.*/.test(url) || /\/users\/login\/?$/.test(url);
}

function isOnAuthPage(): boolean {
  const p = window.location.pathname;
  return /^\/(login|register|forgot-password)\/?$/.test(p);
}

// ---------- Request: лог + токен + нормализация ----------
apiClient.interceptors.request.use(
  (config: AxiosRequestConfig) => {
    if (process.env.NODE_ENV === 'development') {
      logger.apiCall((config.method || 'get').toUpperCase(), config.url || '');
    }

    // JWT из localStorage
    const token = localStorage.getItem('access');
    if (token) {
      config.headers = config.headers || {};
      (config.headers as any).Authorization = `Bearer ${token}`;
    }

    // Нормализация относительных путей
    if (config.url) config.url = normalizeUrl(config.url);

    return config;
  },
  (error) => Promise.reject(error)
);

// ---------- Request: кэширование GET ----------
apiClient.interceptors.request.use(
  (config) => {
    if (config.method === 'get') {
      const cacheKey = `${config.method}-${config.url}-${JSON.stringify(config.params || {})}`;
      const cachedData = apiCache.get(cacheKey);
      if (cachedData) {
        config.adapter = () =>
          Promise.resolve({
            data: cachedData,
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
          } as AxiosResponse);
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ---------- Response: лог + кэш + централизованный 401 (refresh) ----------
apiClient.interceptors.response.use(
  (response) => {
    if (process.env.NODE_ENV === 'development') {
      logger.apiResponse(
        (response.config.method || 'get').toUpperCase(),
        response.config.url || '',
        response.status
      );
    }

    // Кэш успешных GET
    if (response.config.method === 'get' && response.status === 200) {
      const cacheKey = `${response.config.method}-${response.config.url}-${JSON.stringify(response.config.params || {})}`;
      let ttl = 5 * 60 * 1000;
      const url = response.config.url || '';
      if (url.includes('/conversations/')) ttl = 2 * 60 * 1000;
      else if (url.includes('/messages')) ttl = 30 * 1000;
      else if (url.includes('/settings')) ttl = 10 * 60 * 1000;
      apiCache.set(cacheKey, response.data, ttl);
    }

    return response;
  },
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };
    const method = originalRequest?.method?.toUpperCase() || 'GET';
    const url = originalRequest?.url || '';
    const status = error.response?.status || 0;

    if (process.env.NODE_ENV === 'development') {
      logger.apiResponse(method, url, status, error.response?.data);
    }

    // Централизованная обработка
    errorHandler.handleError(error, `API ${method} ${url}`);

    // ----- Обработка 401 с попыткой refresh -----
    if (status === 401) {
      // Не рефрешим для самих auth-эндпоинтов и если уже пробовали
      if (originalRequest._retry || isAuthUrl(url)) {
        if (!isOnAuthPage()) {
          localStorage.removeItem('access');
          localStorage.removeItem('refresh');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          addRefreshSubscriber((newToken) => {
            if (!newToken) {
              if (!isOnAuthPage()) {
                localStorage.removeItem('access');
                localStorage.removeItem('refresh');
                window.location.href = '/login';
              }
              reject(error);
              return;
            }
            originalRequest.headers = originalRequest.headers || {};
            (originalRequest.headers as any).Authorization = `Bearer ${newToken}`;
            resolve(apiClient(originalRequest));
          });
        });
      }

      isRefreshing = true;
      const newToken = await refreshAccessToken().catch(() => null);
      isRefreshing = false;
      onRefreshed(newToken);

      if (newToken) {
        originalRequest.headers = originalRequest.headers || {};
        (originalRequest.headers as any).Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      }

      if (!isOnAuthPage()) {
        localStorage.removeItem('access');
        localStorage.removeItem('refresh');
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

// ---------- Инвалидатор кэша ----------
export const invalidateCache = (pattern?: string) => {
  if (pattern) {
    const stats = apiCache.getStats();
    stats.keys.forEach((key) => {
      if (key.includes(pattern)) apiCache.delete(key);
    });
  } else {
    apiCache.clear();
  }
};

export default apiClient;
