import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Globe, 
  MessageCircle, 
  User, 
  Settings, 
  ChevronRight,
  Users,
  Sparkles,
  Menu,
  X
} from 'lucide-react';
import { Select } from '../ui';
import { ChatHierarchy } from '../chat/ChatHierarchy';
import { ChatInterface } from '../chat/ChatInterface';
import PersonalMessages, { PersonalChatInterface } from '../messages/PersonalMessages';
import { UserProfile } from '../profile/UserProfile';
import { AppSettings } from '../settings/AppSettings';
import { NetworkStatus } from '../common/NetworkStatus';
import { logger } from '../../utils/logger';
import { errorHandler, handleAsync } from '../../utils/errorHandler';
import apiClient from '../../api/instance';
import { useUser } from '../../contexts/UserContext';

interface ChatRoom {
  id: string;
  country: string;
  region?: string;
  city: string;
  interests: string[];
  participantCount: number;
  countryCode: string;
}

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

const LANGUAGE_OPTIONS = [
  { value: 'en', label: '🇺🇸 EN' },
  { value: 'ru', label: '🇷🇺 RU' },
  { value: 'es', label: '🇪🇸 ES' },
  { value: 'fr', label: '🇫🇷 FR' },
  { value: 'de', label: '🇩🇪 DE' },
  { value: 'it', label: '🇮🇹 IT' },
  { value: 'pt', label: '🇵🇹 PT' },
  { value: 'ja', label: '🇯🇵 JA' },
  { value: 'ko', label: '🇰🇷 KO' },
  { value: 'zh', label: '🇨🇳 ZH' },
  { value: 'ar', label: '🇸🇦 AR' },
  { value: 'hi', label: '🇮🇳 HI' },
];

type ViewMode = 'dashboard' | 'hierarchy' | 'chat' | 'personal-messages' | 'profile' | 'settings';

export function MainDashboard() {
  const { t, i18n } = useTranslation();
  const { user } = useUser(); 
  const [activeTab, setActiveTab] = useState<'countries' | 'chats' | 'profile' | 'settings'>('countries');
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [currentRoom, setCurrentRoom] = useState<RoomInfo | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [personalMessages, setPersonalMessages] = useState<{ [contactId: string]: Message[] }>({});
  const [worldChatMessages, setWorldChatMessages] = useState<{ [roomKey: string]: any[] }>({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Load chat rooms from API
  useEffect(() => {
    logger.userAction('Dashboard loaded');
    loadChatRooms();
  }, []);

  const loadChatRooms = async () => {
    setIsLoadingRooms(true);
    setError(null);
    
    const { data, error: apiError } = await handleAsync(
      () => apiClient.get('/api/chats/'),
      'loadChatRooms'
    );
    
    if (apiError) {
      const userMessage = errorHandler.getUserMessage(apiError);
      setError(userMessage);
      setChatRooms([]);
    } else if (data) {
      const rooms = data.data.results || data.data || [];
      
      // Transform API data to match our interface
      const transformedRooms: ChatRoom[] = rooms.map((room: any) => ({
        id: room.id,
        country: room.name || room.country,
        city: room.city || room.name || 'Unknown City',
        interests: room.interests || ['General'],
        participantCount: room.participant_count || 0,
        countryCode: room.country_code || room.code || room.name?.substring(0, 2).toUpperCase() || 'XX'
      }));
      
      setChatRooms(transformedRooms);
      logger.info('Chat rooms loaded successfully', { count: transformedRooms.length });
    }
    setIsLoadingRooms(false);
  };

  const formatParticipantCount = (count: number) => {
    if (count >= 1000) {
      return `${Math.floor(count / 1000)}K ${t('dashboard.participants')}`;
    }
    return `${count} ${t('dashboard.participants')}`;
  };

  const handleRoomClick = (room: ChatRoom) => {
    logger.userAction('Room clicked', { roomId: room.id, country: room.country });
    setSelectedCountry(room.country);
    setViewMode('hierarchy');
    // НЕ закрываем сайдбар здесь - пользователь должен видеть иерархию
  };

  const handleSelectChat = (roomInfo: RoomInfo) => {
    logger.userAction('Chat selected', { roomId: roomInfo.id, interest: roomInfo.interest });
    setCurrentRoom(roomInfo);
    setIsSidebarOpen(false); // Закрываем только когда выбран конкретный чат
  };

  const handleBackToDashboard = () => {
    setViewMode('dashboard');
    setCurrentRoom(null);
    setSelectedCountry('');
    setSelectedContact(null);
    setIsSidebarOpen(false);
  };

  const handleBackToHierarchy = () => {
    setCurrentRoom(null);
    // НЕ закрываем сайдбар - возвращаемся к иерархии
  };

  const handlePersonalMessagesClick = () => {
    logger.userAction('Personal messages opened');
    setActiveTab('chats');
    setViewMode('personal-messages');
    setSelectedContact(null);
    setIsSidebarOpen(false);
  };

  const handleBackFromPersonalMessages = () => {
    setActiveTab('countries');
    setViewMode('dashboard');
    setSelectedContact(null);
  };

  const handleProfileClick = () => {
    logger.userAction('Profile opened');
    setActiveTab('profile');
    setViewMode('profile');
    setSelectedContact(null);
    setCurrentRoom(null);
    setSelectedCountry('');
    setIsSidebarOpen(false);
  };

  const handleSettingsClick = () => {
    logger.userAction('Settings opened');
    setActiveTab('settings');
    setViewMode('settings');
    setSelectedContact(null);
    setCurrentRoom(null);
    setSelectedCountry('');
    setIsSidebarOpen(false);
  };

  const generateMessagesForContact = (contact: Contact): Message[] => {
    const messageTemplates = [
      { content: 'Hey! How are you doing?', isOwn: false },
      { content: 'Hi! I\'m doing great, thanks for asking. How about you?', isOwn: true },
      { content: 'I\'m good too! Just finished work. Any plans for the weekend?', isOwn: false },
      { content: 'Not much planned yet. Maybe we could grab coffee sometime?', isOwn: true },
      { content: 'That sounds great! I know a nice place downtown.', isOwn: false },
      { content: 'Perfect! When would be a good time for you?', isOwn: true },
      { content: 'How about Saturday afternoon around 3 PM?', isOwn: false },
      { content: 'Saturday at 3 PM works perfectly for me!', isOwn: true },
      { content: 'Awesome! I\'ll send you the address.', isOwn: false },
      { content: 'Looking forward to it! See you then.', isOwn: true }
    ];

    const numMessages = Math.min(Math.floor(Math.random() * 8) + 3, messageTemplates.length);
    const selectedMessages = messageTemplates.slice(0, numMessages);
    
    return selectedMessages.map((template, index) => ({
      id: `${contact.id}-${index}`,
      senderId: template.isOwn ? 'current' : contact.id,
      content: template.content,
      timestamp: new Date(Date.now() - (numMessages - index) * 300000),
      isOwn: template.isOwn,
      status: template.isOwn ? (index === numMessages - 1 ? 'delivered' : 'read') : 'read'
    }));
  };

  const handleSelectContact = (contact: Contact | null) => {
    setSelectedContact(contact);
    setIsSidebarOpen(false); // Закрываем только когда выбран контакт
    
    if (contact) {
      if (!personalMessages[contact.id]) {
        const newMessages = generateMessagesForContact(contact);
        setPersonalMessages(prev => ({
          ...prev,
          [contact.id]: newMessages
        }));
      }
    }
  };

  const handleSendPersonalMessage = (messageContent: string) => {
    if (selectedContact) {
      const newMessage: Message = {
        id: `${selectedContact.id}-${Date.now()}`,
        senderId: 'current',
        content: messageContent,
        timestamp: new Date(),
        isOwn: true,
        status: 'sent'
      };
      
      setPersonalMessages(prev => ({
        ...prev,
        [selectedContact.id]: [...(prev[selectedContact.id] || []), newMessage]
      }));
    }
  };

  const getCurrentMessages = (): Message[] => {
    if (!selectedContact) return [];
    return personalMessages[selectedContact.id] || [];
  };

  if (viewMode === 'profile') {
    return <UserProfile onBack={handleBackToDashboard} />;
  }

  if (viewMode === 'settings') {
    return <AppSettings onBack={handleBackToDashboard} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%239C92AC%22%20fill-opacity%3D%220.1%22%3E%3Cpath%20d%3D%22m36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20"></div>
      
      {/* Network Status */}
      <NetworkStatus />
      
      <div className="relative z-10 flex flex-col h-screen">
        {/* Header */}
        <header className="flex items-center justify-between p-3 sm:p-6 bg-white/10 backdrop-blur-xl border-b border-white/20 flex-shrink-0">
          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Mobile menu button */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              {isSidebarOpen ? (
                <X className="w-5 h-5 text-white" />
              ) : (
                <Menu className="w-5 h-5 text-white" />
              )}
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

        {/* Main Content */}
        <div className="flex-1 flex min-h-0 relative">
          {/* Mobile Sidebar Overlay */}
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
            ) : viewMode === 'hierarchy' ? (
              <ChatHierarchy 
                onSelectChat={handleSelectChat}
                onBack={handleBackToDashboard}
                selectedCountry={selectedCountry}
              />
            ) : (
              <div className="p-4 sm:p-6 flex-1 flex flex-col min-h-0">
                <div className="flex items-center space-x-3 mb-4 sm:mb-6">
                  <Globe className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-400" />
                  <h2 className="text-lg sm:text-xl font-semibold text-white">
                    {t('dashboard.worldChat', 'МИРОВОЙ ЧАТ')}
                  </h2>
                </div>
                
                <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar">
                  {isLoadingRooms ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mr-3"></div>
                      <span className="text-gray-300">{t('common.loading', 'Loading...')}</span>
                    </div>
                  ) : chatRooms.length > 0 ? (
                    chatRooms.map((room) => (
                    <button
                      key={room.id}
                      onClick={() => handleRoomClick(room)}
                      className="w-full p-3 sm:p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 hover:border-white/20 transition-all duration-300 text-left group hover:scale-[1.02] hover:shadow-lg hover:shadow-indigo-500/10"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-6 sm:w-12 sm:h-8 bg-gradient-to-br from-gray-700 to-gray-800 rounded flex items-center justify-center text-sm sm:text-lg font-bold text-white shadow-md group-hover:shadow-lg transition-all duration-300">
                            {room.countryCode}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <h3 className="font-semibold text-white text-sm truncate group-hover:text-indigo-200 transition-colors duration-200">
                                {room.country}
                              </h3>
                              {room.region && (
                                <span className="text-gray-400 text-xs">
                                  {room.region}
                                </span>
                              )}
                            </div>
                            <p className="text-gray-400 text-xs mt-1 group-hover:text-gray-300 transition-colors duration-200">
                              {room.city}
                            </p>
                            <p className="text-gray-500 text-xs mt-1 group-hover:text-gray-400 transition-colors duration-200">
                              {formatParticipantCount(room.participantCount)}
                            </p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {room.interests.slice(0, 2).map((interest, index) => (
                                <span
                                  key={index}
                                  className="px-2 py-0.5 bg-indigo-600/30 text-indigo-300 text-xs rounded-full group-hover:bg-indigo-500/40 group-hover:text-indigo-200 transition-all duration-200"
                                >
                                  {interest}
                                </span>
                              ))}
                              {room.interests.length > 2 && (
                                <span className="px-2 py-0.5 bg-gray-600/30 text-gray-400 text-xs rounded-full group-hover:bg-gray-500/40 group-hover:text-gray-300 transition-all duration-200">
                                  +{room.interests.length - 2}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-white group-hover:translate-x-1 transition-all duration-200" />
                      </div>
                    </button>
                    ))
                  ) : error ? (
                    <div className="text-center py-8">
                      <p className="text-red-400 mb-4">{error}</p>
                      <button
                        onClick={loadChatRooms}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
                      >
                        {t('common.retry', 'Retry')}
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-400 mb-4">{t('chat.noRooms', 'No chat rooms available')}</p>
                      <button
                        onClick={loadChatRooms}
                        className="text-indigo-400 hover:text-indigo-300 text-sm"
                      >
                        {t('common.refresh', 'Refresh')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Main Chat Area */}
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
            ) : (
              <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
                <div className="text-center max-w-md">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl sm:rounded-3xl flex items-center justify-center shadow-2xl mx-auto mb-4 sm:mb-6">
                    <MessageCircle className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 sm:mb-4">
                    {viewMode === 'personal-messages' 
                      ? t('dashboard.personalChats', 'Личные сообщения')
                      : t('dashboard.welcome', 'Добро пожаловать!')
                    }
                  </h2>
                  <p className="text-gray-300 text-base sm:text-lg leading-relaxed">
                    {viewMode === 'personal-messages' 
                      ? t('messages.startConversation', 'Выберите контакт слева, чтобы начать переписку.')
                      : viewMode === 'hierarchy' 
                        ? t('dashboard.navigateMessage', 'Выберите интерес для входа в чат.')
                        : t('dashboard.welcomeMessage', 'Выберите страну или регион слева, чтобы присоединиться к беседе и познакомиться с людьми со всего мира.')
                    }
                  </p>
                  {viewMode === 'dashboard' && (
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
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Navigation */}
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
                activeTab === 'countries' 
                  ? 'text-indigo-400 bg-indigo-500/20' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Globe className="w-5 h-5 sm:w-6 sm:h-6" />
              <span className="text-xs font-medium">
                {t('dashboard.worldChat', 'Мировой чат')}
              </span>
            </button>
            
            <button
              onClick={handlePersonalMessagesClick}
              className={`flex flex-col items-center space-y-1 p-2 rounded-lg transition-colors ${
                activeTab === 'chats' 
                  ? 'text-indigo-400 bg-indigo-500/20' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6" />
              <span className="text-xs font-medium">
                {t('dashboard.personalChats', 'Личные сообщения')}
              </span>
            </button>
            
            <button
              onClick={handleProfileClick}
              className={`flex flex-col items-center space-y-1 p-2 rounded-lg transition-colors ${
                activeTab === 'profile' 
                  ? 'text-indigo-400 bg-indigo-500/20' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {user?.avatar ? (
                <img
                  src={user.avatar.startsWith('http') ? user.avatar : `http://localhost:8000${user.avatar}`}
                  alt="avatar"
                  className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover border border-white/20"
                />
              ) : (
                <User className="w-5 h-5 sm:w-6 sm:h-6" />
              )}

              <span className="text-xs font-medium">
                {t('dashboard.profile', 'Профиль')}
              </span>
            </button>
            
            <button
              onClick={handleSettingsClick}
              className={`flex flex-col items-center space-y-1 p-2 rounded-lg transition-colors ${
                activeTab === 'settings' 
                  ? 'text-indigo-400 bg-indigo-500/20' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Settings className="w-5 h-5 sm:w-6 sm:h-6" />
              <span className="text-xs font-medium">
                {t('dashboard.settings', 'Настройки')}
              </span>
            </button>
          </div>
        </nav>
      </div>

      <style>{`
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