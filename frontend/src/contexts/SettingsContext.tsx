import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import apiClient from '../api/instance';

// Тип должен совпадать с тем, что в AppSettings.tsx (ключи/типы)
export type SettingsState = {
  language: string;
  theme: 'light' | 'dark' | 'auto';
  fontSize: 'small' | 'medium' | 'large';
  pushNotifications: boolean;
  soundNotifications: boolean;
  emailNotifications: boolean;
  messageNotifications: boolean;
  groupNotifications: boolean;
  profileVisibility: 'public' | 'friends' | 'private';
  onlineStatus: boolean;
  readReceipts: boolean;
  lastSeen: boolean;
  autoDownloadImages: boolean;
  autoDownloadVideos: boolean;
  autoDownloadDocuments: boolean;
  enterToSend: boolean;
  cameraPermission: boolean;
  microphonePermission: boolean;
  autoplayVideos: boolean;
  twoFactorAuth: boolean;
  sessionTimeout: number;
  autoConnect: boolean;
  dataUsage: 'low' | 'medium' | 'high';
};

type SettingsContextValue = {
  settings: SettingsState | null;
  reload: () => Promise<void>;
  update: (partial: Partial<SettingsState>) => Promise<void>;
  isLoading: boolean;
};

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
};

const DEFAULTS: SettingsState = {
  language: 'en',
  theme: 'dark',
  fontSize: 'medium',
  pushNotifications: true,
  soundNotifications: true,
  emailNotifications: false,
  messageNotifications: true,
  groupNotifications: true,
  profileVisibility: 'public',
  onlineStatus: true,
  readReceipts: true,
  lastSeen: true,
  autoDownloadImages: true,
  autoDownloadVideos: false,
  autoDownloadDocuments: false,
  enterToSend: true,
  cameraPermission: true,
  microphonePermission: true,
  autoplayVideos: false,
  twoFactorAuth: false,
  sessionTimeout: 30,
  autoConnect: true,
  dataUsage: 'medium',
};

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SettingsState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const toClient = (server: any): SettingsState => ({
    language: server.language ?? DEFAULTS.language,
    theme: server.theme ?? DEFAULTS.theme,
    fontSize: server.font_size ?? DEFAULTS.fontSize,
    pushNotifications: server.push_notifications ?? DEFAULTS.pushNotifications,
    soundNotifications: server.sound_notifications ?? DEFAULTS.soundNotifications,
    emailNotifications: server.email_notifications ?? DEFAULTS.emailNotifications,
    messageNotifications: server.message_notifications ?? DEFAULTS.messageNotifications,
    groupNotifications: server.group_notifications ?? DEFAULTS.groupNotifications,
    profileVisibility: server.profile_visibility ?? DEFAULTS.profileVisibility,
    onlineStatus: server.online_status ?? DEFAULTS.onlineStatus,
    readReceipts: server.read_receipts ?? DEFAULTS.readReceipts,
    lastSeen: server.last_seen ?? DEFAULTS.lastSeen,
    autoDownloadImages: server.auto_download_images ?? DEFAULTS.autoDownloadImages,
    autoDownloadVideos: server.auto_download_videos ?? DEFAULTS.autoDownloadVideos,
    autoDownloadDocuments: server.auto_download_documents ?? DEFAULTS.autoDownloadDocuments,
    enterToSend: server.enter_to_send ?? DEFAULTS.enterToSend,
    cameraPermission: server.camera_permission ?? DEFAULTS.cameraPermission,
    microphonePermission: server.microphone_permission ?? DEFAULTS.microphonePermission,
    autoplayVideos: server.autoplay_videos ?? DEFAULTS.autoplayVideos,
    twoFactorAuth: server.two_factor_auth ?? DEFAULTS.twoFactorAuth,
    sessionTimeout: server.session_timeout ?? DEFAULTS.sessionTimeout,
    autoConnect: server.auto_connect ?? DEFAULTS.autoConnect,
    dataUsage: server.data_usage ?? DEFAULTS.dataUsage,
  });

  const toServer = (client: Partial<SettingsState>) => ({
    ...(client.language !== undefined ? { language: client.language } : {}),
    ...(client.theme !== undefined ? { theme: client.theme } : {}),
    ...(client.fontSize !== undefined ? { font_size: client.fontSize } : {}),
    ...(client.pushNotifications !== undefined ? { push_notifications: client.pushNotifications } : {}),
    ...(client.soundNotifications !== undefined ? { sound_notifications: client.soundNotifications } : {}),
    ...(client.emailNotifications !== undefined ? { email_notifications: client.emailNotifications } : {}),
    ...(client.messageNotifications !== undefined ? { message_notifications: client.messageNotifications } : {}),
    ...(client.groupNotifications !== undefined ? { group_notifications: client.groupNotifications } : {}),
    ...(client.profileVisibility !== undefined ? { profile_visibility: client.profileVisibility } : {}),
    ...(client.onlineStatus !== undefined ? { online_status: client.onlineStatus } : {}),
    ...(client.readReceipts !== undefined ? { read_receipts: client.readReceipts } : {}),
    ...(client.lastSeen !== undefined ? { last_seen: client.lastSeen } : {}),
    ...(client.autoDownloadImages !== undefined ? { auto_download_images: client.autoDownloadImages } : {}),
    ...(client.autoDownloadVideos !== undefined ? { auto_download_videos: client.autoDownloadVideos } : {}),
    ...(client.autoDownloadDocuments !== undefined ? { auto_download_documents: client.autoDownloadDocuments } : {}),
    ...(client.enterToSend !== undefined ? { enter_to_send: client.enterToSend } : {}),
    ...(client.cameraPermission !== undefined ? { camera_permission: client.cameraPermission } : {}),
    ...(client.microphonePermission !== undefined ? { microphone_permission: client.microphonePermission } : {}),
    ...(client.autoplayVideos !== undefined ? { autoplay_videos: client.autoplayVideos } : {}),
    ...(client.twoFactorAuth !== undefined ? { two_factor_auth: client.twoFactorAuth } : {}),
    ...(client.sessionTimeout !== undefined ? { session_timeout: client.sessionTimeout } : {}),
    ...(client.autoConnect !== undefined ? { auto_connect: client.autoConnect } : {}),
    ...(client.dataUsage !== undefined ? { data_usage: client.dataUsage } : {}),
  });

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get('users/settings/');
      setSettings(toClient(res.data || {}));
    } catch {
      setSettings(DEFAULTS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const update = useCallback(async (partial: Partial<SettingsState>) => {
    if (!settings) return;
    const optimistic = { ...settings, ...partial };
    setSettings(optimistic);
    try {
      await apiClient.put('users/settings/', toServer(optimistic));
    } catch (e) {
      // откат, если не сохранилось
      await reload();
    }
  }, [settings, reload]);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <SettingsContext.Provider value={{ settings, reload, update, isLoading }}>
      {children}
    </SettingsContext.Provider>
  );
};
