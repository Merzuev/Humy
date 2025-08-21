// src/hooks/useNotificationsBridge.tsx
import { useEffect } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { ensureNotificationPermission, handleIncomingMessage } from '../services/notifications';

/**
 * Подключи этот хук один раз на верхнем уровне (например, в App.tsx).
 * Он:
 *  - запрашивает разрешение на уведомления при включенном push
 *  - слушает "глобальные" события о новых сообщениях и прокидывает в notifications.ts
 *
 * Как отправлять событие:
 *  window.dispatchEvent(new CustomEvent('humy:new-message', {
 *    detail: { type: 'direct'|'group', title: '...', body: '...', clickUrl: '...' }
 *  }))
 */
export default function useNotificationsBridge() {
  const { settings } = useSettings();

  useEffect(() => {
    if (settings?.pushNotifications) {
      ensureNotificationPermission();
    }
  }, [settings?.pushNotifications]);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent;
      handleIncomingMessage(settings, ce.detail);
    };
    window.addEventListener('humy:new-message', handler as EventListener);
    return () => window.removeEventListener('humy:new-message', handler as EventListener);
  }, [settings]);
}
