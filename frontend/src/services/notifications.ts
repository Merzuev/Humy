// src/services/notifications.ts
import apiClient from '../api/instance';
import { SettingsState } from '../contexts/SettingsContext';

// Веб-уведомления (браузерные, не FCM). Работают сходу, без бэкенда.
export async function ensureNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission !== 'denied') {
    const p = await Notification.requestPermission();
    return p;
  }
  return 'denied';
}

export function showBrowserNotification(title: string, body: string, clickUrl?: string) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  const n = new Notification(title, { body });
  if (clickUrl) {
    n.onclick = () => window.open(clickUrl, '_blank');
  }
}

// Звук уведомлений — один глобальный аудио-объект
let audio: HTMLAudioElement | null = null;
export function playNotifySound() {
  try {
    if (!audio) {
      // Положи файл в public/notify.mp3 или поменяй путь
      audio = new Audio('/notify.mp3');
    }
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch {}
}

// Регистрация device токена на сервере (если используешь FCM/WebPush)
// Тут заглушка — ты можешь подставить получение токена из FCM.
export async function registerDeviceToken(platform: 'web'|'android'|'ios', token: string) {
  try {
    await apiClient.post('devices/', { platform, token });
  } catch (e) {
    // игнорируем дубликаты/ошибки сети
  }
}

// Входная точка для новых сообщений — вызывай при получении эвента через WS/SSE
export function handleIncomingMessage(
  settings: SettingsState | null,
  msg: { type: 'direct'|'group'; title: string; body: string; clickUrl?: string },
) {
  if (!settings) return;

  // Фильтрация по типу сообщения
  if (msg.type === 'direct' && !settings.messageNotifications) return;
  if (msg.type === 'group' && !settings.groupNotifications) return;

  // Push (браузерные уведомления)
  if (settings.pushNotifications) {
    showBrowserNotification(msg.title, msg.body, msg.clickUrl);
  }

  // Звук
  if (settings.soundNotifications) {
    playNotifySound();
  }
}