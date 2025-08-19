import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Globe, 
  MessageCircle, 
  User, 
  Settings, 
  Users,
  Sparkles,
  Menu,
  X
} from 'lucide-react';
import { ChatHierarchy } from '../chat/ChatHierarchy';
import { ChatInterface } from '../chat/ChatInterface';
import PersonalMessages, { PersonalChatInterface } from '../messages/PersonalMessages';
import { UserProfile } from '../profile/UserProfile';
import { AppSettings } from '../settings/AppSettings';
import { NetworkStatus } from '../common/NetworkStatus';
import { logger } from '../../utils/logger';
import { useUser } from '../../contexts/UserContext';
import apiClient from '../../api/instance';

type ViewMode = 'dashboard' | 'hierarchy' | 'chat' | 'personal-messages' | 'profile' | 'settings';

interface RoomInfo {
  id: string;
  country: string;
  region?: string;
  city: string;
  interest: string;
  participantCount: number;
}

interface Contact {
  id: string;
  name: string;
  avatar?: string;
  lastMessage: string;
  timestamp: Date;
  unreadCount: number;
  isOnline: boolean;
  lastSeen?: Date;
}

interface Message {
  id: string;
  senderId: string;
  content: string;
  timestamp: Date;
  isOwn: boolean;
  status: 'sent' | 'delivered' | 'read';
}

export function MainDashboard() {
  const { t } = useTranslation();
  const { user } = useUser(); 
  const [activeTab, setActiveTab] = useState<'countries' | 'chats' | 'profile' | 'settings'>('countries');
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [currentRoom, setCurrentRoom] = useState<RoomInfo | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [personalMessages, setPersonalMessages] = useState<{ [contactId: string]: Message[] }>({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleSelectChat = (roomInfo: RoomInfo) => {
    logger.userAction('Chat selected', { roomId: roomInfo.id, interest: roomInfo.interest });
    setCurrentRoom(roomInfo);
    setViewMode('chat');
    setIsSidebarOpen(false);
  };

  const handleBackToDashboard = () => {
    setViewMode('dashboard');
    setCurrentRoom(null);
    setSelectedCountry('');
    setSelectedContact(null);
    setIsSidebarOpen(false);
  };

  // назад из Мирового чата — к списку комнат
  const handleBackToHierarchy = () => {
    setCurrentRoom(null);
    setViewMode('hierarchy');
    setIsSidebarOpen(true);
  };

  const handlePersonalMessagesClick = () => {
    setActiveTab('chats');
    setViewMode('personal-messages');
    setSelectedContact(null);    // показываем список диалогов
    setIsSidebarOpen(false);
  };

  const handleBackFromPersonalMessages = () => {
    setActiveTab('countries');
    setViewMode('dashboard');
    setSelectedContact(null);
  };

  const handleProfileClick = () => {
    setActiveTab('profile');
    setViewMode('profile');
    setSelectedContact(null);
    setCurrentRoom(null);
    setSelectedCountry('');
    setIsSidebarOpen(false);
  };

  const handleSettingsClick = () => {
    setActiveTab('settings');
    setViewMode('settings');
    setSelectedContact(null);
    setCurrentRoom(null);
    setSelectedCountry('');
    setIsSidebarOpen(false);
  };

  // Выбор контакта: грузим РЕАЛЬНЫЕ сообщения с API
  const handleSelectContact = async (contact: Contact | null) => {
    setSelectedContact(contact);
    setIsSidebarOpen(false);
    if (contact && !personalMessages[contact.id]) {
      try {
        const resp = await apiClient.get(`api/conversations/${contact.id}/messages/`);
        const arr = Array.isArray(resp.data) ? resp.data : (resp.data?.results || []);
        const transformed: Message[] = arr.map((m: any) => {
          const isOwn = Boolean(
            m.is_own ?? (m.author?.id && user?.id && Number(m.author.id) === Number(user.id))
          );
          return {
            id: String(m.id ?? m.message_id ?? Math.random()),
            senderId: isOwn ? 'current' : String(contact.id),
            content: m.content || m.text || '',
            timestamp: new Date(m.created_at || m.timestamp || Date.now()),
            isOwn,
            status: 'read',
          };
        });
        setPersonalMessages(prev => ({ ...prev, [contact.id]: transformed }));
      } catch (e) {
        console.error('Не удалось загрузить сообщения диалога', e);
        setPersonalMessages(prev => ({ ...prev, [contact.id]: [] }));
      }
    }
  };

  const handleSendPersonalMessage = (text: string) => {
    if (!selectedContact) return;
    const newMessage: Message = {
      id: `${selectedContact.id}-${Date.now()}`,
      senderId: 'current',
      content: text,
      timestamp: new Date(),
      isOwn: true,
      status: 'sent'
    };
    setPersonalMessages(prev => ({
      ...prev,
      [selectedContact.id]: [...(prev[selectedContact.id] || []), newMessage]
    }));
  };

  const getCurrentMessages = (): Message[] =>
    selectedContact ? (personalMessages[selectedContact.id] || []) : [];

  // скрываем верхнюю шапку в экранах с контентом
  const renderHeader = () => {
    const hideHeader =
      (viewMode === 'chat' && currentRoom) ||
      (viewMode === 'personal-messages' && selectedContact);

    if (hideHeader || viewMode === 'profile' || viewMode === 'settings') return null;

    return (
      <header className="flex items-center justify-between p-3 sm:p-6 bg-white/10 backdrop-blur-xl border-b border-white/20 flex-shrink-0">
        <div className="flex items-center space-x-3 sm:space-x-4">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="lg:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            {isSidebarOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
          </button>
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg">
            <Sparkles className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
          </div>
          <h1 className="text-lg sm:text-2xl font-bold text-white">
            {t('dashboard.appName', 'Хьюми')}
          </h1>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-4">
          <span className="text-gray-300 text-xs sm:text-sm hidden md:block">
            {t('dashboard.subtitle', 'Соединяйтесь с миром')}
          </span>
        </div>
      </header>
    );
  };

  const shouldShowBottomNav =
    !currentRoom && !(viewMode === 'personal-messages' && !!selectedContact);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      <NetworkStatus />
      <div className="relative z-10 flex flex-col h-screen">
        {renderHeader()}

        {/* Контент */}
        <div className="flex-1 flex min-h-0 relative">
          {/* затемнение под сайдбар на мобиле */}
          {isSidebarOpen && (
            <div 
              className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}

          {/* Sidebar */}
          <div className={`
            w-80 bg-white/5 backdrop-blur-xl border-r border-white/20 flex flex-col
            lg:relative lg:translate-x-0 lg:z-auto
            fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}>
            {viewMode === 'personal-messages' ? (
              <div className="p-4 sm:p-6 flex-1 flex flex-col min-h-0">
                <PersonalMessages 
                  onBack={handleBackFromPersonalMessages}
                  selectedContact={selectedContact}
                  onSelectContact={handleSelectContact}
                />
              </div>
            ) : (
              <ChatHierarchy 
                onSelectChat={handleSelectChat}
                onBack={handleBackToDashboard}
                selectedCountry={selectedCountry}
              />
            )}
          </div>

          {/* Main area */}
          <div className="flex-1 flex flex-col min-h-0">
            {viewMode === 'personal-messages' && selectedContact ? (
              <PersonalChatInterface
                key={selectedContact.id}
                contact={selectedContact}
                messages={getCurrentMessages()}
                onSendMessage={handleSendPersonalMessage}
                onBack={() => setSelectedContact(null)}
              />
            ) : currentRoom ? (
              <ChatInterface 
                key={currentRoom.id}
                roomInfo={currentRoom} 
                onBack={handleBackToHierarchy}
              />
            ) : viewMode === 'profile' ? (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <UserProfile />
              </div>
            ) : viewMode === 'settings' ? (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <AppSettings />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
                <div className="text-center max-w-md">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl sm:rounded-3xl flex items-center justify-center shadow-2xl mx-auto mb-4 sm:mb-6">
                    <MessageCircle className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 sm:mb-4">
                    {t('dashboard.welcome', 'Добро пожаловать!')}
                  </h2>
                  <p className="text-gray-300 text-base sm:text-lg leading-relaxed">
                    {t('dashboard.welcomeMessage', 'Выберите страну или регион слева, чтобы присоединиться к беседе.')}
                  </p>
                  <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-center space-y-3 sm:space-y-0 sm:space-x-6 text-sm text-gray-400">
                    <div className="flex items-center space-x-2">
                      <Users className="w-4 h-4" />
                      <span>{t('dashboard.totalUsers', '150K+ пользователей')}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Globe className="w-4 h-4" />
                      <span>{t('dashboard.countriesCount', '50+ стран')}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Нижняя навигация — скрываем ТОЛЬКО когда открыт чат (мировой или личный) */}
        {shouldShowBottomNav && (
          <nav className="bg-white/10 backdrop-blur-xl border-t border-white/20 p-2 sm:p-4 flex-shrink-0">
            <div className="flex items-center justify-around max-w-md mx-auto">
              <button
                onClick={() => {
                  setActiveTab('countries');
                  setViewMode('dashboard');
                  setSelectedContact(null);
                  setCurrentRoom(null);
                  setSelectedCountry('');
                  setIsSidebarOpen(false);
                }}
                className={`flex flex-col items-center space-y-1 p-2 rounded-lg transition-colors ${
                  activeTab === 'countries' ? 'text-indigo-400 bg-indigo-500/20' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Globe className="w-5 h-5 sm:w-6 sm:h-6" />
                <span className="text-xs font-medium">{t('dashboard.worldChat', 'Мировой чат')}</span>
              </button>

              <button
                onClick={handlePersonalMessagesClick}
                className={`flex flex-col items-center space-y-1 p-2 rounded-lg transition-colors ${
                  activeTab === 'chats' ? 'text-indigo-400 bg-indigo-500/20' : 'text-gray-400 hover:text-white'
                }`}
              >
                <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                <span className="text-xs font-medium">{t('dashboard.personalChats', 'Личные сообщения')}</span>
              </button>

              <button
                onClick={handleProfileClick}
                className={`flex flex-col items-center space-y-1 p-2 rounded-lg transition-colors ${
                  activeTab === 'profile' ? 'text-indigo-400 bg-indigo-500/20' : 'text-gray-400 hover:text-white'
                }`}
              >
                <User className="w-5 h-5 sm:w-6 sm:h-6" />
                <span className="text-xs font-medium">{t('dashboard.profile', 'Профиль')}</span>
              </button>

              <button
                onClick={handleSettingsClick}
                className={`flex flex-col items-center space-y-1 p-2 rounded-lg transition-colors ${
                  activeTab === 'settings' ? 'text-indigo-400 bg-indigo-500/20' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Settings className="w-5 h-5 sm:w-6 sm:h-6" />
                <span className="text-xs font-medium">{t('dashboard.settings', 'Настройки')}</span>
              </button>
            </div>
          </nav>
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(255,255,255,0.2);
          border-radius: 8px;
        }
      `}</style>
    </div>
  );
}

export default MainDashboard;
