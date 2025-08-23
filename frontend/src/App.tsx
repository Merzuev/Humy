import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UserProvider } from './contexts/UserContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { logger } from './utils/logger';
import './i18n';

// ✅ Контекст настроек (единый источник правды) — монтируем ТОЛЬКО внутри защищённой зоны
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
// ✅ Базовый клиент (для вычисления базы бэкенда)
import apiClient from './api/instance';

// ================== Ленивые страницы ==================
const LoginForm = lazy(() =>
  import('./components/auth/LoginForm').then((m) => ({ default: m.LoginForm })),
);
const RegisterForm = lazy(() =>
  import('./components/auth/RegisterForm').then((m) => ({ default: m.RegisterForm })),
);
const ProfileSetupForm = lazy(() =>
  import('./components/profile/ProfileSetupForm').then((m) => ({ default: m.ProfileSetupForm })),
);
const MainDashboard = lazy(() =>
  import('./components/dashboard/MainDashboard').then((m) => ({ default: m.MainDashboard })),
);

// ================== Спиннер ==================
const LoadingSpinner = () => (
  <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
    <div className="text-center">
      <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-white">Loading...</p>
    </div>
  </div>
);

// ================== Утилиты уведомлений ==================
function ensureNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return Promise.resolve('denied');
  if (Notification.permission === 'granted') return Promise.resolve('granted');
  if (Notification.permission !== 'denied') return Notification.requestPermission();
  return Promise.resolve('denied');
}

let notifyAudio: HTMLAudioElement | null = null;
function playNotifySound() {
  try {
    if (!notifyAudio) notifyAudio = new Audio('/notify.mp3'); // ⚠️ положи файл в public/
    notifyAudio.currentTime = 0;
    notifyAudio.play().catch(() => {});
  } catch {}
}

function showBrowserNotification(title: string, body: string, clickUrl?: string) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  const n = new Notification(title, { body });
  if (clickUrl) n.onclick = () => window.open(clickUrl, '_blank');
}

// ================== Построение корректного WS-URL на бек ==================
function getBackendWsUrl(path = '/ws/notifications/'): string {
  const raw =
    (import.meta as any).env?.VITE_API_BASE_URL ||
    (apiClient.defaults.baseURL as string) ||
    'http://127.0.0.1:8000';
  const u = new URL(raw);
  const wsProto = u.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProto}//${u.host}${path}`;
}

// ================== Мост уведомлений ==================
function NotificationsBridge() {
  const { settings } = useSettings();

  // Актуальные настройки в ref, чтобы не пересоздавать сокет при каждом изменении settings
  const settingsRef = React.useRef(settings);
  React.useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // 1) Разрешение на браузерные нотификации
  React.useEffect(() => {
    if (settings?.pushNotifications) {
      ensureNotificationPermission().then((p) => {
        logger.info('Notification permission', { permission: p });
      });
    }
  }, [settings?.pushNotifications]);

  // 2) Подписка на внутренние события приложения
  React.useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent;
      const detail = ce.detail as {
        type: 'direct' | 'group' | 'info';
        title: string;
        body: string;
        clickUrl?: string;
      };

      const s = settingsRef.current;
      if (!s) return;
      if (detail.type === 'direct' && !s.messageNotifications) return;
      if (detail.type === 'group' && !s.groupNotifications) return;

      if (s.pushNotifications) showBrowserNotification(detail.title, detail.body, detail.clickUrl);
      if (s.soundNotifications) playNotifySound();
    };

    window.addEventListener('humy:new-message', handler as EventListener);
    return () => window.removeEventListener('humy:new-message', handler as EventListener);
  }, []);

  // 3) WebSocket: создаём ОДИН раз при монтировании защищённой зоны
  //    (избегаем реконнектов при любом изменении настроек/StrictMode)
  React.useEffect(() => {
    const token =
      localStorage.getItem('access') ||
      localStorage.getItem('access_token') ||
      localStorage.getItem('accessToken') ||
      localStorage.getItem('jwt') ||
      '';

    // Без токена — не подключаемся (иначе будут ошибки 1006/permission denied)
    if (!token) return;

    const wsUrl = `${getBackendWsUrl('/ws/notifications/')}${
      token ? `?token=${encodeURIComponent(token)}` : ''
    }`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => logger.info('WS notifications connected', { wsUrl });

    ws.onclose = (e) => {
      // 1000 — нормальное закрытие (например, при переходе на /login или hot-reload)
      if (e.code === 1000) {
        logger.warn('WS notifications closed', { code: e.code, reason: e.reason });
        return;
      }
      // 1011 — серверное исключение в consumer. Логируем, но без автопереподключения (чтобы не сыпать).
      logger.warn('WS notifications closed', { code: e.code, reason: e.reason });
    };

    ws.onerror = (e) => logger.error('WS notifications error', { e });

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data || '{}');
        const type = data?.type as string;
        const s = settingsRef.current;
        if (!s) return;

        if (type === 'presence') {
          window.dispatchEvent(
            new CustomEvent('humy:presence', {
              detail: { user_id: data.user_id, online: data.online },
            }),
          );
          return;
        }

        if (type === 'dm:badge') {
          if (!s.messageNotifications) return;
          if (s.pushNotifications) {
            showBrowserNotification(
              data.title || 'Новое сообщение',
              data.body || 'У вас новое личное сообщение',
              data.clickUrl || '/dashboard',
            );
          }
          if (s.soundNotifications) playNotifySound();
          return;
        }

        if (type === 'friend:request') {
          if (s.pushNotifications) {
            showBrowserNotification(
              data.title || 'Новая заявка в друзья',
              data.body || 'Проверьте входящие заявки',
              '/dashboard',
            );
          }
          if (s.soundNotifications) playNotifySound();
          return;
        }
      } catch (e) {
        logger.error('WS message parse error', { e });
      }
    };

    return () => {
      try {
        ws.close(1000, 'component unmount');
      } catch {}
    };
  }, []); // ← монтируем один раз

  return null;
}

// ================== Макет защищённой зоны ==================
function ProtectedArea({ children }: { children: React.ReactNode }) {
  return (
    <SettingsProvider>
      <NotificationsBridge />
      {children}
    </SettingsProvider>
  );
}

// ==== Вынесенные роуты с ключом по location (стабилизирует reconciliation) ====
function AppRoutes() {
  const location = useLocation();
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes location={location} key={location.pathname}>
        {/* Публичные без SettingsProvider */}
        <Route
          path="/login"
          element={
            <ErrorBoundary>
              <LoginForm />
            </ErrorBoundary>
          }
        />
        <Route
          path="/register"
          element={
            <ErrorBoundary>
              <RegisterForm />
            </ErrorBoundary>
          }
        />
        <Route
          path="/setup-profile"
          element={
            <ErrorBoundary>
              <ProfileSetupForm />
            </ErrorBoundary>
          }
        />

        {/* Защищённая зона */}
        <Route
          path="/dashboard"
          element={
            <ErrorBoundary>
              <ProtectedRoute>
                <ProtectedArea>
                  <MainDashboard />
                </ProtectedArea>
              </ProtectedRoute>
            </ErrorBoundary>
          }
        />

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  const { i18n } = useTranslation();

  // Логирование запуска
  React.useEffect(() => {
    logger.info('App initialized', {
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString(),
    });
  }, []);

  // Установка языка из localStorage
  React.useEffect(() => {
    const lang = localStorage.getItem('i18nextLng') || 'en';
    i18n.changeLanguage(lang);
  }, []);

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        logger.error('App-level error caught by ErrorBoundary', {
          error: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
        });
      }}
    >
      <UserProvider>
        <Router>
          <AppRoutes />
        </Router>
      </UserProvider>
    </ErrorBoundary>
  );
}

export default App;
