import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Settings,
  User,
  Bell,
  Shield,
  Globe,
  Moon,
  Sun,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Smartphone,
  Monitor,
  Palette,
  Download,
  Upload,
  Trash2,
  LogOut,
  HelpCircle,
  Info,
  ArrowLeft,
  Sparkles,
  Lock,
  Key,
  Database,
  Wifi,
  WifiOff,
  MessageSquare,
  Camera,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Zap,
  RotateCcw,
  AlertTriangle,
  Check,
  X,
  Type
} from 'lucide-react';
import { Button, Select } from '../ui';
import apiClient from '../../api/instance';
import { useUser } from '../../contexts/UserContext';

interface AppSettingsProps {
  onBack?: () => void;
}

interface SettingsState {
  // Общие настройки
  language: string;
  theme: 'light' | 'dark' | 'auto';
  fontSize: 'small' | 'medium' | 'large';
  
  // Уведомления
  pushNotifications: boolean;
  soundNotifications: boolean;
  emailNotifications: boolean;
  messageNotifications: boolean;
  groupNotifications: boolean;
  
  // Приватность
  profileVisibility: 'public' | 'friends' | 'private';
  onlineStatus: boolean;
  readReceipts: boolean;
  lastSeen: boolean;
  
  // Чат настройки
  autoDownloadImages: boolean;
  autoDownloadVideos: boolean;
  autoDownloadDocuments: boolean;
  enterToSend: boolean;
  
  // Медиа настройки
  cameraPermission: boolean;
  microphonePermission: boolean;
  autoplayVideos: boolean;
  
  // Безопасность
  twoFactorAuth: boolean;
  sessionTimeout: number;
  
  // Сеть
  autoConnect: boolean;
  dataUsage: 'low' | 'medium' | 'high';
}

const LANGUAGE_OPTIONS = [
  { value: 'en', label: '🇺🇸 English' },
  { value: 'ru', label: '🇷🇺 Русский' },
  { value: 'es', label: '🇪🇸 Español' },
  { value: 'fr', label: '🇫🇷 Français' },
  { value: 'de', label: '🇩🇪 Deutsch' },
  { value: 'it', label: '🇮🇹 Italiano' },
  { value: 'pt', label: '🇵🇹 Português' },
  { value: 'ja', label: '🇯🇵 日本語' },
  { value: 'ko', label: '🇰🇷 한국어' },
  { value: 'zh', label: '🇨🇳 中文' },
  { value: 'ar', label: '🇸🇦 العربية' },
  { value: 'hi', label: '🇮🇳 हिन्दी' },
];

export function AppSettings({ onBack }: AppSettingsProps) {
  const { t, i18n } = useTranslation();
  const { user, setUser, logout, deleteAccount } = useUser();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [settings, setSettings] = useState<SettingsState>({
    // Общие настройки
    language: i18n.language,
    theme: 'dark',
    fontSize: 'medium',
    
    // Уведомления
    pushNotifications: true,
    soundNotifications: true,
    emailNotifications: false,
    messageNotifications: true,
    groupNotifications: true,
    
    // Приватность
    profileVisibility: 'public',
    onlineStatus: true,
    readReceipts: true,
    lastSeen: true,
    
    // Чат настройки
    autoDownloadImages: true,
    autoDownloadVideos: false,
    autoDownloadDocuments: false,
    enterToSend: true,
    
    // Медиа настройки
    cameraPermission: true,
    microphonePermission: true,
    autoplayVideos: false,
    
    // Безопасность
    twoFactorAuth: false,
    sessionTimeout: 30,
    
    // Сеть
    autoConnect: true,
    dataUsage: 'medium'
  });

  // Load settings from API on component mount
  useEffect(() => {
    loadSettings();
  }, []);

  // Auto-save settings when they change (with debounce)
  useEffect(() => {
    if (!isLoading) {
      const timeoutId = setTimeout(() => {
        saveSettings();
      }, 1000); // 1 second debounce

      return () => clearTimeout(timeoutId);
    }
  }, [settings, isLoading]);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiClient.get('api/users/settings/');
      const serverSettings = response.data;
      
      // Transform server settings to match our interface
      const transformedSettings: SettingsState = {
        // General settings
        language: serverSettings.language || i18n.language,
        theme: serverSettings.theme || 'dark',
        fontSize: serverSettings.font_size || 'medium',
        
        // Notifications
        pushNotifications: serverSettings.push_notifications ?? true,
        soundNotifications: serverSettings.sound_notifications ?? true,
        emailNotifications: serverSettings.email_notifications ?? false,
        messageNotifications: serverSettings.message_notifications ?? true,
        groupNotifications: serverSettings.group_notifications ?? true,
        
        // Privacy
        profileVisibility: serverSettings.profile_visibility || 'public',
        onlineStatus: serverSettings.online_status ?? true,
        readReceipts: serverSettings.read_receipts ?? true,
        lastSeen: serverSettings.last_seen ?? true,
        
        // Chat settings
        autoDownloadImages: serverSettings.auto_download_images ?? true,
        autoDownloadVideos: serverSettings.auto_download_videos ?? false,
        autoDownloadDocuments: serverSettings.auto_download_documents ?? false,
        enterToSend: serverSettings.enter_to_send ?? true,
        
        // Media settings
        cameraPermission: serverSettings.camera_permission ?? true,
        microphonePermission: serverSettings.microphone_permission ?? true,
        autoplayVideos: serverSettings.autoplay_videos ?? false,
        
        // Security
        twoFactorAuth: serverSettings.two_factor_auth ?? false,
        sessionTimeout: serverSettings.session_timeout || 30,
        
        // Network
        autoConnect: serverSettings.auto_connect ?? true,
        dataUsage: serverSettings.data_usage || 'medium'
      };
      
      setSettings(transformedSettings);
      
      // Apply language change immediately if different
      if (transformedSettings.language !== i18n.language) {
        i18n.changeLanguage(transformedSettings.language);
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        // Settings not found, use defaults
      } else {
        setError(t('settings.loadFailed', 'Failed to load settings'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSaveSuccess(false);
      
      // Transform settings to server format
      const serverSettings = {
        language: settings.language,
        theme: settings.theme,
        font_size: settings.fontSize,
        push_notifications: settings.pushNotifications,
        sound_notifications: settings.soundNotifications,
        email_notifications: settings.emailNotifications,
        message_notifications: settings.messageNotifications,
        group_notifications: settings.groupNotifications,
        profile_visibility: settings.profileVisibility,
        online_status: settings.onlineStatus,
        read_receipts: settings.readReceipts,
        last_seen: settings.lastSeen,
        auto_download_images: settings.autoDownloadImages,
        auto_download_videos: settings.autoDownloadVideos,
        auto_download_documents: settings.autoDownloadDocuments,
        enter_to_send: settings.enterToSend,
        camera_permission: settings.cameraPermission,
        microphone_permission: settings.microphonePermission,
        autoplay_videos: settings.autoplayVideos,
        two_factor_auth: settings.twoFactorAuth,
        session_timeout: settings.sessionTimeout,
        auto_connect: settings.autoConnect,
        data_usage: settings.dataUsage
      };
      
      await apiClient.put('/users/settings/', serverSettings);
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000); // Hide success message after 2 seconds
    } catch (err: any) {
      if (err.response?.status === 400) {
        setError(t('settings.invalidSettings', 'Invalid settings data'));
      } else if (err.response?.status === 403) {
        setError(t('settings.saveForbidden', 'Not allowed to save settings'));
      } else {
        setError(t('settings.saveFailed', 'Failed to save settings'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const updateSetting = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    
    // Apply language change immediately
    if (key === 'language') {
      i18n.changeLanguage(value as string);
    }
    
    // Clear any previous errors
    setError(null);
  };

  const handleReset = () => {
    const defaultSettings: SettingsState = {
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
      dataUsage: 'medium'
    };
    
    setSettings(defaultSettings);
    setShowResetConfirm(false);
    
    // Save reset settings to server
    saveSettings();
  };

  const handleLogout = () => {
    logout();
    setShowLogoutConfirm(false);
  };

  const handleDeleteAccount = async () => {
    await deleteAccount();
    setShowDeleteConfirm(false);
  };

  const ToggleSwitch = ({ 
    enabled, 
    onChange, 
    label, 
    description 
  }: { 
    enabled: boolean; 
    onChange: (value: boolean) => void; 
    label: string;
    description?: string;
  }) => (
    <div className="flex items-center justify-between p-3 sm:p-4 bg-white/5 rounded-lg sm:rounded-xl border border-white/20 hover:bg-white/10 transition-all duration-200">
      <div className="flex-1 min-w-0 mr-3">
        <h4 className="text-white font-medium text-sm sm:text-base">{label}</h4>
        {description && (
          <p className="text-gray-400 text-xs sm:text-sm mt-1">{description}</p>
        )}
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-5 w-9 sm:h-6 sm:w-11 items-center rounded-full transition-colors duration-200 flex-shrink-0 ${
          enabled ? 'bg-gradient-to-r from-indigo-600 to-purple-600' : 'bg-gray-600'
        }`}
      >
        <span
          className={`inline-block h-3 w-3 sm:h-4 sm:w-4 transform rounded-full bg-white transition-transform duration-200 ${
            enabled ? 'translate-x-5 sm:translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );

  const LoadingOverlay = () => (
    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 rounded-2xl sm:rounded-3xl">
      <div className="bg-white/10 backdrop-blur-xl rounded-xl p-4 sm:p-6 flex items-center space-x-3">
        <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-white font-medium">{t('common.loading', 'Loading...')}</span>
      </div>
    </div>
  );

  const SaveIndicator = () => {
    if (isSaving) {
      return (
        <div className="flex items-center space-x-2 text-yellow-400">
          <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm">{t('settings.saving', 'Saving...')}</span>
        </div>
      );
    }
    
    if (saveSuccess) {
      return (
        <div className="flex items-center space-x-2 text-green-400">
          <Check className="w-4 h-4" />
          <span className="text-sm">{t('settings.saved', 'Saved')}</span>
        </div>
      );
    }
    
    return null;
  };

  const ConfirmModal = ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title, 
    message, 
    confirmText, 
    confirmVariant = 'primary',
    icon 
  }: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText: string;
    confirmVariant?: 'primary' | 'outline';
    icon: React.ReactNode;
  }) => {
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <div className="relative bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-4 sm:p-6 w-full max-w-sm sm:max-w-md shadow-2xl">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-red-500 to-pink-600 rounded-full flex items-center justify-center flex-shrink-0">
              {icon}
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-white">{title}</h3>
          </div>
          
          <p className="text-gray-300 mb-4 sm:mb-6 text-sm sm:text-base">{message}</p>
          
          <div className="flex space-x-3">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 bg-white/5 border-white/20 hover:bg-white/10 text-sm sm:text-base"
            >
              {t('profile.cancel', 'Отмена')}
            </Button>
            <Button
              onClick={onConfirm}
              variant={confirmVariant}
              className="flex-1 text-sm sm:text-base"
            >
              {confirmText}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%239C92AC%22%20fill-opacity%3D%220.1%22%3E%3Cpath%20d%3D%22m36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20"></div>
      
      <div className="relative z-10 flex flex-col h-screen">
        {/* Header */}
        <header className="flex items-center justify-between p-3 sm:p-6 bg-white/10 backdrop-blur-xl border-b border-white/20 flex-shrink-0">
          <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
                disabled={isSaving}
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </button>
            )}
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
              <Settings className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
            </div>
            <h1 className="text-lg sm:text-2xl font-bold text-white truncate">
              {t('dashboard.settings', 'Настройки')}
            </h1>
          </div>
          
          <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
            <SaveIndicator />
            <Button
              onClick={() => setShowResetConfirm(true)}
              variant="outline"
              className="bg-white/5 border-white/20 hover:bg-white/10 text-xs sm:text-sm px-2 sm:px-4 py-1 sm:py-2"
              disabled={isSaving}
            >
              <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">{t('settings.reset', 'Сброс')}</span>
            </Button>
          </div>
        </header>

        {/* Settings Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 custom-scrollbar">
          <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
            
            {/* Error Banner */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
                <div className="flex items-center space-x-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <p className="text-red-400 text-sm">{error}</p>
                  <button
                    onClick={() => setError(null)}
                    className="ml-auto p-1 hover:bg-red-500/20 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
            )}
            
            {/* Общие настройки */}
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-white/20 p-4 sm:p-8 relative">
              {isLoading && <LoadingOverlay />}
              <div className="absolute -top-4 -right-4 sm:-top-6 sm:-right-6 w-8 h-8 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-400 to-indigo-400 rounded-full blur-xl opacity-60"></div>
              
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6 flex items-center">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center mr-2 sm:mr-3">
                  <Settings className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
                {t('settings.general', 'Общие настройки')}
              </h2>
              
              <div className="space-y-3 sm:space-y-4">
                {/* Язык */}
                <div className="p-3 sm:p-4 bg-white/5 rounded-lg sm:rounded-xl border border-white/20">
                  <label className="block text-white font-medium mb-3 flex items-center text-sm sm:text-base">
                    <Globe className="w-3 h-3 sm:w-4 sm:h-4 mr-2 text-indigo-400" />
                    {t('settings.language', 'Язык интерфейса')}
                  </label>
                  <Select
                    value={settings.language}
                    onChange={(value) => updateSetting('language', value)}
                    options={LANGUAGE_OPTIONS}
                    className="w-full"
                    disabled={isSaving}
                  />
                </div>

                {/* Тема */}
                <div className="p-3 sm:p-4 bg-white/5 rounded-lg sm:rounded-xl border border-white/20">
                  <label className="block text-white font-medium mb-3 flex items-center text-sm sm:text-base">
                    <Palette className="w-3 h-3 sm:w-4 sm:h-4 mr-2 text-purple-400" />
                    {t('settings.theme', 'Тема оформления')}
                  </label>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {[
                      { value: 'light', label: t('settings.light', 'Светлая'), icon: <Sun className="w-3 h-3 sm:w-4 sm:h-4" /> },
                      { value: 'dark', label: t('settings.dark', 'Тёмная'), icon: <Moon className="w-3 h-3 sm:w-4 sm:h-4" /> },
                      { value: 'auto', label: t('settings.auto', 'Авто'), icon: <Monitor className="w-3 h-3 sm:w-4 sm:h-4" /> }
                    ].map((theme) => (
                      <button
                        key={theme.value}
                        onClick={() => updateSetting('theme', theme.value as any)}
                        className={`p-2 sm:p-3 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 border flex items-center justify-center space-x-1 sm:space-x-2 ${
                          settings.theme === theme.value
                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-indigo-500/50'
                            : 'bg-white/10 text-gray-300 hover:bg-white/20 border-white/20'
                        }`}
                        disabled={isSaving}
                      >
                        {theme.icon}
                        <span>{theme.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Размер шрифта */}
                <div className="p-3 sm:p-4 bg-white/5 rounded-lg sm:rounded-xl border border-white/20">
                  <label className="block text-white font-medium mb-3 flex items-center text-sm sm:text-base">
                    <Type className="w-3 h-3 sm:w-4 sm:h-4 mr-2 text-green-400" />
                    {t('settings.fontSize', 'Размер шрифта')}
                  </label>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {[
                      { value: 'small', label: t('settings.small', 'Маленький') },
                      { value: 'medium', label: t('settings.medium', 'Средний') },
                      { value: 'large', label: t('settings.large', 'Большой') }
                    ].map((size) => (
                      <button
                        key={size.value}
                        onClick={() => updateSetting('fontSize', size.value as any)}
                        className={`p-2 sm:p-3 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 border ${
                          settings.fontSize === size.value
                            ? 'bg-gradient-to-r from-green-600 to-teal-600 text-white border-green-500/50'
                            : 'bg-white/10 text-gray-300 hover:bg-white/20 border-white/20'
                        }`}
                        disabled={isSaving}
                      >
                        {size.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Уведомления */}
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-white/20 p-4 sm:p-8 relative">
              {isLoading && <LoadingOverlay />}
              <div className="absolute -top-4 -right-4 sm:-top-6 sm:-right-6 w-8 h-8 sm:w-12 sm:h-12 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-full blur-xl opacity-60"></div>
              
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6 flex items-center">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-yellow-500 to-orange-600 rounded-lg flex items-center justify-center mr-2 sm:mr-3">
                  <Bell className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
                {t('settings.notifications', 'Уведомления')}
              </h2>
              
              <div className="space-y-3 sm:space-y-4">
                <ToggleSwitch
                  enabled={settings.pushNotifications}
                  onChange={(value) => updateSetting('pushNotifications', value)}
                  label={t('settings.pushNotifications', 'Push-уведомления')}
                  description={t('settings.pushNotificationsDesc', 'Получать уведомления на устройство')}
                />
                
                <ToggleSwitch
                  enabled={settings.soundNotifications}
                  onChange={(value) => updateSetting('soundNotifications', value)}
                  label={t('settings.soundNotifications', 'Звуковые уведомления')}
                  description={t('settings.soundNotificationsDesc', 'Воспроизводить звуки при получении сообщений')}
                />
                
                <ToggleSwitch
                  enabled={settings.emailNotifications}
                  onChange={(value) => updateSetting('emailNotifications', value)}
                  label={t('settings.emailNotifications', 'Email уведомления')}
                  description={t('settings.emailNotificationsDesc', 'Получать уведомления на почту')}
                />
                
                <ToggleSwitch
                  enabled={settings.messageNotifications}
                  onChange={(value) => updateSetting('messageNotifications', value)}
                  label={t('settings.messageNotifications', 'Уведомления о сообщениях')}
                  description={t('settings.messageNotificationsDesc', 'Уведомления о новых личных сообщениях')}
                />
                
                <ToggleSwitch
                  enabled={settings.groupNotifications}
                  onChange={(value) => updateSetting('groupNotifications', value)}
                  label={t('settings.groupNotifications', 'Уведомления групп')}
                  description={t('settings.groupNotificationsDesc', 'Уведомления о сообщениях в групповых чатах')}
                />
              </div>
            </div>

            {/* Приватность и безопасность */}
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-white/20 p-4 sm:p-8 relative">
              {isLoading && <LoadingOverlay />}
              <div className="absolute -top-4 -right-4 sm:-top-6 sm:-right-6 w-8 h-8 sm:w-12 sm:h-12 bg-gradient-to-br from-red-400 to-pink-400 rounded-full blur-xl opacity-60"></div>
              
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6 flex items-center">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-red-500 to-pink-600 rounded-lg flex items-center justify-center mr-2 sm:mr-3">
                  <Shield className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
                {t('settings.privacy', 'Приватность и безопасность')}
              </h2>
              
              <div className="space-y-3 sm:space-y-4">
                {/* Видимость профиля */}
                <div className="p-3 sm:p-4 bg-white/5 rounded-lg sm:rounded-xl border border-white/20">
                  <label className="block text-white font-medium mb-3 flex items-center text-sm sm:text-base">
                    <Eye className="w-3 h-3 sm:w-4 sm:h-4 mr-2 text-blue-400" />
                    {t('settings.profileVisibility', 'Видимость профиля')}
                  </label>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {[
                      { value: 'public', label: t('settings.public', 'Публичный') },
                      { value: 'friends', label: t('settings.friends', 'Друзья') },
                      { value: 'private', label: t('settings.private', 'Приватный') }
                    ].map((visibility) => (
                      <button
                        key={visibility.value}
                        onClick={() => updateSetting('profileVisibility', visibility.value as any)}
                        className={`p-2 sm:p-3 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 border ${
                          settings.profileVisibility === visibility.value
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-500/50'
                            : 'bg-white/10 text-gray-300 hover:bg-white/20 border-white/20'
                        }`}
                        disabled={isSaving}
                      >
                        {visibility.label}
                      </button>
                    ))}
                  </div>
                </div>

                <ToggleSwitch
                  enabled={settings.onlineStatus}
                  onChange={(value) => updateSetting('onlineStatus', value)}
                  label={t('settings.onlineStatus', 'Показывать статус онлайн')}
                  description={t('settings.onlineStatusDesc', 'Другие пользователи смогут видеть, когда вы в сети')}
                />
                
                <ToggleSwitch
                  enabled={settings.readReceipts}
                  onChange={(value) => updateSetting('readReceipts', value)}
                  label={t('settings.readReceipts', 'Уведомления о прочтении')}
                  description={t('settings.readReceiptsDesc', 'Отправлять подтверждения о прочтении сообщений')}
                />
                
                <ToggleSwitch
                  enabled={settings.lastSeen}
                  onChange={(value) => updateSetting('lastSeen', value)}
                  label={t('settings.lastSeen', 'Время последнего посещения')}
                  description={t('settings.lastSeenDesc', 'Показывать время последней активности')}
                />
                
                <ToggleSwitch
                  enabled={settings.twoFactorAuth}
                  onChange={(value) => updateSetting('twoFactorAuth', value)}
                  label={t('settings.twoFactorAuth', 'Двухфакторная аутентификация')}
                  description={t('settings.twoFactorAuthDesc', 'Дополнительная защита аккаунта')}
                />
              </div>
            </div>

            {/* Чат и медиа */}
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-white/20 p-4 sm:p-8 relative">
              {isLoading && <LoadingOverlay />}
              <div className="absolute -top-4 -right-4 sm:-top-6 sm:-right-6 w-8 h-8 sm:w-12 sm:h-12 bg-gradient-to-br from-green-400 to-teal-400 rounded-full blur-xl opacity-60"></div>
              
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6 flex items-center">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-green-500 to-teal-600 rounded-lg flex items-center justify-center mr-2 sm:mr-3">
                  <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
                {t('settings.chatMedia', 'Чат и медиа')}
              </h2>
              
              <div className="space-y-3 sm:space-y-4">
                <ToggleSwitch
                  enabled={settings.autoDownloadImages}
                  onChange={(value) => updateSetting('autoDownloadImages', value)}
                  label={t('settings.autoDownloadImages', 'Автозагрузка изображений')}
                  description={t('settings.autoDownloadImagesDesc', 'Автоматически загружать изображения в чатах')}
                />
                
                <ToggleSwitch
                  enabled={settings.autoDownloadVideos}
                  onChange={(value) => updateSetting('autoDownloadVideos', value)}
                  label={t('settings.autoDownloadVideos', 'Автозагрузка видео')}
                  description={t('settings.autoDownloadVideosDesc', 'Автоматически загружать видеофайлы')}
                />
                
                <ToggleSwitch
                  enabled={settings.autoDownloadDocuments}
                  onChange={(value) => updateSetting('autoDownloadDocuments', value)}
                  label={t('settings.autoDownloadDocuments', 'Автозагрузка документов')}
                  description={t('settings.autoDownloadDocumentsDesc', 'Автоматически загружать документы и файлы')}
                />
                
                <ToggleSwitch
                  enabled={settings.enterToSend}
                  onChange={(value) => updateSetting('enterToSend', value)}
                  label={t('settings.enterToSend', 'Enter для отправки')}
                  description={t('settings.enterToSendDesc', 'Отправлять сообщения по нажатию Enter')}
                />
                
                <ToggleSwitch
                  enabled={settings.cameraPermission}
                  onChange={(value) => updateSetting('cameraPermission', value)}
                  label={t('settings.cameraPermission', 'Доступ к камере')}
                  description={t('settings.cameraPermissionDesc', 'Разрешить использование камеры для видеозвонков')}
                />
                
                <ToggleSwitch
                  enabled={settings.microphonePermission}
                  onChange={(value) => updateSetting('microphonePermission', value)}
                  label={t('settings.microphonePermission', 'Доступ к микрофону')}
                  description={t('settings.microphonePermissionDesc', 'Разрешить использование микрофона для звонков')}
                />
                
                <ToggleSwitch
                  enabled={settings.autoplayVideos}
                  onChange={(value) => updateSetting('autoplayVideos', value)}
                  label={t('settings.autoplayVideos', 'Автовоспроизведение видео')}
                  description={t('settings.autoplayVideosDesc', 'Автоматически воспроизводить видео в чатах')}
                />
              </div>
            </div>

            {/* Данные и хранилище */}
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-white/20 p-4 sm:p-8 relative">
              {isLoading && <LoadingOverlay />}
              <div className="absolute -top-4 -right-4 sm:-top-6 sm:-right-6 w-8 h-8 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-400 to-indigo-400 rounded-full blur-xl opacity-60"></div>
              
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6 flex items-center">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center mr-2 sm:mr-3">
                  <Database className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
                {t('settings.dataStorage', 'Данные и хранилище')}
              </h2>
              
              <div className="space-y-3 sm:space-y-4">
                {/* Использование данных */}
                <div className="p-3 sm:p-4 bg-white/5 rounded-lg sm:rounded-xl border border-white/20">
                  <label className="block text-white font-medium mb-3 flex items-center text-sm sm:text-base">
                    <Zap className="w-3 h-3 sm:w-4 sm:h-4 mr-2 text-yellow-400" />
                    {t('settings.dataUsage', 'Использование данных')}
                  </label>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {[
                      { value: 'low', label: t('settings.low', 'Низкое') },
                      { value: 'medium', label: t('settings.medium', 'Среднее') },
                      { value: 'high', label: t('settings.high', 'Высокое') }
                    ].map((usage) => (
                      <button
                        key={usage.value}
                        onClick={() => updateSetting('dataUsage', usage.value as any)}
                        className={`p-2 sm:p-3 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 border ${
                          settings.dataUsage === usage.value
                            ? 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white border-yellow-500/50'
                            : 'bg-white/10 text-gray-300 hover:bg-white/20 border-white/20'
                        }`}
                        disabled={isSaving}
                      >
                        {usage.label}
                      </button>
                    ))}
                  </div>
                </div>

                <ToggleSwitch
                  enabled={settings.autoConnect}
                  onChange={(value) => updateSetting('autoConnect', value)}
                  label={t('settings.autoConnect', 'Автоподключение')}
                  description={t('settings.autoConnectDesc', 'Автоматически подключаться при запуске приложения')}
                />

                {/* Управление данными */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  <button className="p-3 sm:p-4 bg-white/5 rounded-lg sm:rounded-xl border border-white/20 hover:bg-white/10 transition-all duration-200 text-left">
                    <div className="flex items-center space-x-3">
                      <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Download className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-white font-medium text-sm sm:text-base">{t('settings.exportData', 'Экспорт данных')}</h4>
                        <p className="text-gray-400 text-xs sm:text-sm">{t('settings.exportDataDesc', 'Скачать копию ваших данных')}</p>
                      </div>
                    </div>
                  </button>

                  <button className="p-3 sm:p-4 bg-white/5 rounded-lg sm:rounded-xl border border-white/20 hover:bg-white/10 transition-all duration-200 text-left">
                    <div className="flex items-center space-x-3">
                      <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-green-500 to-teal-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Upload className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-white font-medium text-sm sm:text-base">{t('settings.importData', 'Импорт данных')}</h4>
                        <p className="text-gray-400 text-xs sm:text-sm">{t('settings.importDataDesc', 'Восстановить данные из резервной копии')}</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Справка и поддержка */}
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-white/20 p-4 sm:p-8 relative">
              {isLoading && <LoadingOverlay />}
              <div className="absolute -top-4 -right-4 sm:-top-6 sm:-right-6 w-8 h-8 sm:w-12 sm:h-12 bg-gradient-to-br from-cyan-400 to-blue-400 rounded-full blur-xl opacity-60"></div>
              
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6 flex items-center">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center mr-2 sm:mr-3">
                  <HelpCircle className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
                {t('settings.helpSupport', 'Справка и поддержка')}
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <button className="p-3 sm:p-4 bg-white/5 rounded-lg sm:rounded-xl border border-white/20 hover:bg-white/10 transition-all duration-200 text-left">
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <HelpCircle className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-white font-medium text-sm sm:text-base">{t('settings.help', 'Справка')}</h4>
                      <p className="text-gray-400 text-xs sm:text-sm">{t('settings.helpDesc', 'Часто задаваемые вопросы')}</p>
                    </div>
                  </div>
                </button>

                <button className="p-3 sm:p-4 bg-white/5 rounded-lg sm:rounded-xl border border-white/20 hover:bg-white/10 transition-all duration-200 text-left">
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-green-500 to-teal-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-white font-medium text-sm sm:text-base">{t('settings.support', 'Поддержка')}</h4>
                      <p className="text-gray-400 text-xs sm:text-sm">{t('settings.supportDesc', 'Связаться с поддержкой')}</p>
                    </div>
                  </div>
                </button>

                <button className="p-3 sm:p-4 bg-white/5 rounded-lg sm:rounded-xl border border-white/20 hover:bg-white/10 transition-all duration-200 text-left">
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Info className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-white font-medium text-sm sm:text-base">{t('settings.about', 'О приложении')}</h4>
                      <p className="text-gray-400 text-xs sm:text-sm">{t('settings.aboutDesc', 'Информация о версии')}</p>
                    </div>
                  </div>
                </button>

                <button className="p-3 sm:p-4 bg-white/5 rounded-lg sm:rounded-xl border border-white/20 hover:bg-white/10 transition-all duration-200 text-left">
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-yellow-500 to-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-white font-medium text-sm sm:text-base">{t('settings.feedback', 'Обратная связь')}</h4>
                      <p className="text-gray-400 text-xs sm:text-sm">{t('settings.feedbackDesc', 'Оставить отзыв')}</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Опасная зона */}
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-red-500/30 p-4 sm:p-8 relative">
              {isLoading && <LoadingOverlay />}
              <div className="absolute -top-4 -right-4 sm:-top-6 sm:-right-6 w-8 h-8 sm:w-12 sm:h-12 bg-gradient-to-br from-red-400 to-pink-400 rounded-full blur-xl opacity-60"></div>
              
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6 flex items-center">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r from-red-500 to-pink-600 rounded-lg flex items-center justify-center mr-2 sm:mr-3">
                  <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
                {t('settings.dangerZone', 'Опасная зона')}
              </h2>
              
              <div className="space-y-3 sm:space-y-4">
                <button
                  onClick={() => setShowLogoutConfirm(true)}
                  className="w-full p-3 sm:p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg sm:rounded-xl hover:bg-orange-500/20 transition-all duration-200 text-left"
                  disabled={isSaving}
                >
                  <div className="flex items-center space-x-3">
                    <LogOut className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <h4 className="text-white font-medium text-sm sm:text-base">{t('settings.logout', 'Выйти из аккаунта')}</h4>
                      <p className="text-gray-400 text-xs sm:text-sm">{t('settings.logoutDesc', 'Завершить текущую сессию')}</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full p-3 sm:p-4 bg-red-500/10 border border-red-500/30 rounded-lg sm:rounded-xl hover:bg-red-500/20 transition-all duration-200 text-left"
                  disabled={isSaving}
                >
                  <div className="flex items-center space-x-3">
                    <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 text-red-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <h4 className="text-white font-medium text-sm sm:text-base">{t('settings.deleteAccount', 'Удалить аккаунт')}</h4>
                      <p className="text-gray-400 text-xs sm:text-sm">{t('settings.deleteAccountDesc', 'Безвозвратно удалить все данные')}</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modals */}
      <ConfirmModal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={handleReset}
        title={t('settings.resetConfirm', 'Сбросить настройки?')}
        message={t('settings.resetConfirmDesc', 'Все настройки будут возвращены к значениям по умолчанию. Это действие нельзя отменить.')}
        confirmText={t('settings.reset', 'Сбросить')}
        confirmVariant="outline"
        icon={<RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 text-white" />}
      />

      <ConfirmModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        title={t('settings.logoutConfirm', 'Выйти из аккаунта?')}
        message={t('settings.logoutConfirmDesc', 'Вы будете перенаправлены на страницу входа.')}
        confirmText={t('settings.logout', 'Выйти')}
        confirmVariant="outline"
        icon={<LogOut className="w-4 h-4 sm:w-5 sm:h-5 text-white" />}
      />

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteAccount}
        title={t('settings.deleteAccountConfirm', 'Удалить аккаунт?')}
        message={t('settings.deleteAccountConfirmDesc', 'Это действие нельзя отменить. Все ваши данные, сообщения и контакты будут безвозвратно удалены.')}
        confirmText={t('settings.deleteAccount', 'Удалить')}
        confirmVariant="primary"
        icon={<Trash2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />}
      />

      {/* Custom Scrollbar Styles */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.3);
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.5);
        }
      `}</style>
    </div>
  );
}