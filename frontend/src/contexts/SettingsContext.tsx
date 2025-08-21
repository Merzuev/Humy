import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import apiClient from '../api/instance';

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
  sessionTimeout: number;        // минуты
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

function toClient(server: any): SettingsState {
  return {
    language: server?.language ?? DEFAULTS.language,
    theme: server?.theme ?? DEFAULTS.theme,
    fontSize: server?.font_size ?? DEFAULTS.fontSize,
    pushNotifications: server?.push_notifications ?? DEFAULTS.pushNotifications,
    soundNotifications: server?.sound_notifications ?? DEFAULTS.soundNotifications,
    emailNotifications: server?.email_notifications ?? DEFAULTS.emailNotifications,
    messageNotifications: server?.message_notifications ?? DEFAULTS.messageNotifications,
    groupNotifications: server?.group_notifications ?? DEFAULTS.groupNotifications,
    profileVisibility: server?.profile_visibility ?? DEFAULTS.profileVisibility,
    onlineStatus: server?.online_status ?? DEFAULTS.onlineStatus,
    readReceipts: server?.read_receipts ?? DEFAULTS.readReceipts,
    lastSeen: server?.last_seen ?? DEFAULTS.lastSeen,
    autoDownloadImages: server?.auto_download_images ?? DEFAULTS.autoDownloadImages,
    autoDownloadVideos: server?.auto_download_videos ?? DEFAULTS.autoDownloadVideos,
    autoDownloadDocuments: server?.auto_download_documents ?? DEFAULTS.autoDownloadDocuments,
    enterToSend: server?.enter_to_send ?? DEFAULTS.enterToSend,
    cameraPermission: server?.camera_permission ?? DEFAULTS.cameraPermission,
    microphonePermission: server?.microphone_permission ?? DEFAULTS.microphonePermission,
    autoplayVideos: server?.autoplay_videos ?? DEFAULTS.autoplayVideos,
    twoFactorAuth: server?.two_factor_auth ?? DEFAULTS.twoFactorAuth,
    sessionTimeout: server?.session_timeout ?? DEFAULTS.sessionTimeout,
    autoConnect: server?.auto_connect ?? DEFAULTS.autoConnect,
    dataUsage: server?.data_usage ?? DEFAULTS.dataUsage,
  };
}

function toServer(client: Partial<SettingsState>) {
  const body: any = {};
  if ('language' in client) body.language = client.language;
  if ('theme' in client) body.theme = client.theme;
  if ('fontSize' in client) body.font_size = client.fontSize;
  if ('pushNotifications' in client) body.push_notifications = client.pushNotifications;
  if ('soundNotifications' in client) body.sound_notifications = client.soundNotifications;
  if ('emailNotifications' in client) body.email_notifications = client.emailNotifications;
  if ('messageNotifications' in client) body.message_notifications = client.messageNotifications;
  if ('groupNotifications' in client) body.group_notifications = client.groupNotifications;
  if ('profileVisibility' in client) body.profile_visibility = client.profileVisibility;
  if ('onlineStatus' in client) body.online_status = client.onlineStatus;
  if ('readReceipts' in client) body.read_receipts = client.readReceipts;
  if ('lastSeen' in client) body.last_seen = client.lastSeen;
  if ('autoDownloadImages' in client) body.auto_download_images = client.autoDownloadImages;
  if ('autoDownloadVideos' in client) body.auto_download_videos = client.autoDownloadVideos;
  if ('autoDownloadDocuments' in client) body.auto_download_documents = client.autoDownloadDocuments;
  if ('enterToSend' in client) body.enter_to_send = client.enterToSend;
  if ('cameraPermission' in client) body.camera_permission = client.cameraPermission;
  if ('microphonePermission' in client) body.microphone_permission = client.microphonePermission;
  if ('autoplayVideos' in client) body.autoplay_videos = client.autoplayVideos;
  if ('twoFactorAuth' in client) body.two_factor_auth = client.twoFactorAuth;
  if ('sessionTimeout' in client) body.session_timeout = client.sessionTimeout;
  if ('autoConnect' in client) body.auto_connect = client.autoConnect;
  if ('dataUsage' in client) body.data_usage = client.dataUsage;
  return body;
}

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SettingsState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get('users/settings/'); // baseURL должен включать /api/
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
    } catch {
      await reload(); // откат при ошибке
    }
  }, [settings, reload]);

  useEffect(() => { reload(); }, [reload]);

  return (
    <SettingsContext.Provider value={{ settings, reload, update, isLoading }}>
      {children}
    </SettingsContext.Provider>
  );
};
