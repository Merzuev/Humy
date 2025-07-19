import React, { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  ArrowLeft, 
  Send, 
  Smile, 
  Paperclip, 
  MoreVertical,
  Reply,
  User,
  UserPlus,
  Shield,
  Flag,
  X,
  Loader2
} from 'lucide-react';
import { Button } from '../ui';
import apiClient from '../../api/instance';

interface Message {
  id: string;
  user_id: string;
  username: string;
  avatar?: string;
  content: string;
  timestamp: string;
  is_own: boolean;
}

interface UserAction {
  messageId: string;
  userId: string;
  username: string;
  position: { x: number; y: number };
}

// Memoized message component
const MessageItem = memo(({ 
  message, 
  showDate, 
  dateLabel, 
  formatTime, 
  getInitials, 
  onUserClick 
}: {
  message: Message;
  showDate: boolean;
  dateLabel: string;
  formatTime: (timestamp: string) => string;
  getInitials: (name: string) => string;
  onUserClick: (event: React.MouseEvent, msg: Message) => void;
}) => (
  <div>
    {showDate && (
      <div className="flex justify-center mb-3 sm:mb-4">
        <span className="px-3 py-1 bg-white/10 rounded-full text-xs text-gray-300">
          {dateLabel}
        </span>
      </div>
    )}
    
    <div className={`flex ${message.is_own ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className={`max-w-[85%] sm:max-w-xs lg:max-w-md ${message.is_own ? 'order-2' : 'order-1'}`}>
        {!message.is_own && (
          <div className="flex items-center space-x-2 mb-1">
            <button
              onClick={(e) => onUserClick(e, message)}
              className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-semibold hover:scale-105 transition-transform"
            >
              {message.avatar ? (
                <img src={message.avatar} alt={message.username} className="w-full h-full rounded-full object-cover" />
              ) : (
                getInitials(message.username)
              )}
            </button>
            <span className="text-xs sm:text-sm text-gray-300 font-medium truncate">{message.username}</span>
          </div>
        )}
        
        <div
          className={`px-3 sm:px-4 py-2 sm:py-3 rounded-2xl ${
            message.is_own
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-md shadow-lg hover:shadow-xl transition-shadow duration-200'
              : 'bg-white/10 backdrop-blur-sm text-white rounded-bl-md border border-white/20 hover:bg-white/15 transition-all duration-200'
          }`}
        >
          <p className="text-xs sm:text-sm leading-relaxed break-words">{message.content}</p>
          <p className={`text-xs mt-1 ${message.is_own ? 'text-indigo-200' : 'text-gray-400'}`}>
            {formatTime(message.timestamp)}
          </p>
        </div>
      </div>
    </div>
  </div>
));

MessageItem.displayName = 'MessageItem';

interface ChatInterfaceProps {
  roomInfo: {
    id: string;
    country: string;
    region?: string;
    city: string;
    interest: string;
    participantCount: number;
  };
  onBack: () => void;
}

export const ChatInterface = memo(({ roomInfo, onBack }: ChatInterfaceProps) => {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [userActionModal, setUserActionModal] = useState<UserAction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Memoized utility functions
  const formatTime = useCallback((timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }, []);

  const formatDate = useCallback((timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (date.toDateString() === today.toDateString()) {
        return t('chat.today', 'Today');
      } else if (date.toDateString() === yesterday.toDateString()) {
        return t('chat.yesterday', 'Yesterday');
      } else {
        return date.toLocaleDateString();
      }
    } catch {
      return '';
    }
  }, [t]);

  const getInitials = useCallback((name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  }, []);

  // Load messages when component mounts or room changes
  useEffect(() => {
    loadMessages();
  }, [roomInfo.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiClient.get(`/chats/rooms/${roomInfo.id}/messages/`);
      const messagesData = response.data.results || response.data || [];
      
      // Transform API data to match our interface
      const transformedMessages: Message[] = messagesData.map((msg: any) => ({
        id: msg.id || msg.message_id || Math.random().toString(),
        user_id: msg.user_id || msg.userId,
        username: msg.username || msg.user?.username || 'Unknown User',
        avatar: msg.avatar || msg.user?.avatar,
        content: msg.content || msg.message,
        timestamp: msg.timestamp || msg.created_at || new Date().toISOString(),
        is_own: msg.is_own || msg.isOwn || false
      }));
      
      // Sort messages by timestamp
      transformedMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      setMessages(transformedMessages);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError(t('chat.accessDenied', 'Access denied to this chat'));
      } else if (err.response?.status === 404) {
        setError(t('chat.roomNotFound', 'Chat room not found'));
      } else {
        setError(t('chat.loadMessagesFailed', 'Failed to load messages'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [roomInfo.id, t]);

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setUserActionModal(null);
      }
    };

    if (userActionModal) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [userActionModal]);

  const handleSendMessage = useCallback(async () => {
    if (!message.trim() || isSending) return;

    try {
      setIsSending(true);
      setError(null);
      
      const response = await apiClient.post(`/chats/rooms/${roomInfo.id}/messages/`, {
        content: message.trim()
      });
      
      // Add the sent message to the list
      const newMessage: Message = {
        id: response.data.id || Date.now().toString(),
        user_id: response.data.user_id || 'current',
        username: response.data.username || 'You',
        avatar: response.data.avatar,
        content: message.trim(),
        timestamp: response.data.timestamp || new Date().toISOString(),
        is_own: true
      };
      
      setMessages(prev => [...prev, newMessage]);
      setMessage('');
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError(t('chat.sendNotAllowed', 'You are not allowed to send messages'));
      } else if (err.response?.status === 429) {
        setError(t('chat.rateLimited', 'Too many messages. Please wait.'));
      } else {
        setError(t('chat.sendMessageFailed', 'Failed to send message'));
      }
    } finally {
      setIsSending(false);
    }
  }, [message, isSending, roomInfo.id, t]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const handleUserClick = useCallback((event: React.MouseEvent, msg: Message) => {
    if (!msg.is_own) {
      const rect = (event.target as HTMLElement).getBoundingClientRect();
      setUserActionModal({
        messageId: msg.id,
        userId: msg.user_id,
        username: msg.username,
        position: {
          x: rect.left,
          y: rect.top
        }
      });
    }
  }, []);

  const handleUserAction = useCallback((action: string) => {
    setUserActionModal(null);
    // TODO: Implement actual actions
  }, [userActionModal?.username]);

  const handleRetry = useCallback(() => {
    loadMessages();
  }, [loadMessages]);

  // Memoized messages with date labels
  const messagesWithDates = useMemo(() => {
    return messages.map((msg, index) => ({
      ...msg,
      showDate: index === 0 || formatDate(messages[index - 1].timestamp) !== formatDate(msg.timestamp),
      dateLabel: formatDate(msg.timestamp)
    }));
  }, [messages, formatDate]);

  if (error && messages.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-3 sm:p-4 bg-white/10 backdrop-blur-xl border-b border-white/20 flex-shrink-0">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <button
              onClick={onBack}
              className="lg:hidden p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-semibold text-white truncate">
                {roomInfo.country} - {roomInfo.city}
              </h2>
              <p className="text-xs sm:text-sm text-gray-300 truncate">
                {roomInfo.interest}
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              {t('common.retry', 'Retry')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-3 sm:p-4 bg-white/10 backdrop-blur-xl border-b border-white/20 flex-shrink-0">
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          <button
            onClick={onBack}
            className="lg:hidden p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-lg font-semibold text-white truncate">
              {roomInfo.country} - {roomInfo.city}
            </h2>
            <p className="text-xs sm:text-sm text-gray-300 truncate">
              {roomInfo.interest} • {roomInfo.participantCount} {t('dashboard.participants', 'participants')}
            </p>
          </div>
        </div>
        <button className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0">
          <MoreVertical className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Messages Area - Scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 custom-scrollbar">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin mr-3" />
            <span className="text-gray-300">{t('common.loading', 'Loading...')}</span>
          </div>
        ) : messages.length > 0 ? (
          messagesWithDates.map((msg) => (
            <MessageItem
              key={msg.id}
              message={msg}
              showDate={msg.showDate}
              dateLabel={msg.dateLabel}
              formatTime={formatTime}
              getInitials={getInitials}
              onUserClick={handleUserClick}
            />
          ))
        ) : (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <p className="text-gray-400 mb-2">{t('chat.noMessages', 'No messages yet')}</p>
              <p className="text-gray-500 text-sm">{t('chat.startConversation', 'Start the conversation!')}</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error banner */}
      {error && messages.length > 0 && (
        <div className="px-3 sm:px-4 py-2 bg-red-500/10 border-t border-red-500/20">
          <p className="text-red-400 text-xs sm:text-sm text-center">{error}</p>
        </div>
      )}

      {/* Message Input - Fixed */}
      <div className="p-3 sm:p-4 bg-white/10 backdrop-blur-xl border-t border-white/20 flex-shrink-0">
        <div className="flex items-end space-x-2 sm:space-x-3">
          <button className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0">
            <Paperclip className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
          </button>
          
          <div className="flex-1 relative min-w-0">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={t('chat.typeMessage', 'Type a message...')}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-white/10 border border-white/20 rounded-xl sm:rounded-2xl text-white placeholder-gray-400 resize-none focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all duration-200 backdrop-blur-sm text-sm sm:text-base"
              rows={1}
              style={{ minHeight: '40px', maxHeight: '120px' }}
              disabled={isSending}
            />
            <button className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-white/10 rounded-lg transition-colors">
              <Smile className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
            </button>
          </div>
          
          <Button
            onClick={handleSendMessage}
            disabled={!message.trim() || isSending}
            loading={isSending}
            className="p-2 sm:p-3 rounded-full min-w-0 flex-shrink-0"
          >
            <Send className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
        </div>
      </div>

      {/* User Action Modal */}
      {userActionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            ref={modalRef}
            className="relative bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-4 sm:p-6 w-full max-w-xs sm:max-w-sm shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-white truncate">{userActionModal.username}</h3>
              <button
                onClick={() => setUserActionModal(null)}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            
            <div className="space-y-2">
              <button
                onClick={() => handleUserAction('reply')}
                className="w-full flex items-center space-x-3 p-3 hover:bg-white/10 rounded-lg transition-colors text-left"
              >
                <Reply className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400 flex-shrink-0" />
                <span className="text-white text-sm sm:text-base">{t('chat.replyToMessage', 'Reply to message')}</span>
              </button>
              
              <button
                onClick={() => handleUserAction('profile')}
                className="w-full flex items-center space-x-3 p-3 hover:bg-white/10 rounded-lg transition-colors text-left"
              >
                <User className="w-4 h-4 sm:w-5 sm:h-5 text-green-400 flex-shrink-0" />
                <span className="text-white text-sm sm:text-base">{t('chat.viewProfile', 'View profile')}</span>
              </button>
              
              <button
                onClick={() => handleUserAction('addFriend')}
                className="w-full flex items-center space-x-3 p-3 hover:bg-white/10 rounded-lg transition-colors text-left"
              >
                <UserPlus className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400 flex-shrink-0" />
                <span className="text-white text-sm sm:text-base">{t('chat.addFriend', 'Add friend')}</span>
              </button>
              
              <button
                onClick={() => handleUserAction('block')}
                className="w-full flex items-center space-x-3 p-3 hover:bg-white/10 rounded-lg transition-colors text-left"
              >
                <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400 flex-shrink-0" />
                <span className="text-white text-sm sm:text-base">{t('chat.blockUser', 'Block user')}</span>
              </button>
              
              <button
                onClick={() => handleUserAction('report')}
                className="w-full flex items-center space-x-3 p-3 hover:bg-white/10 rounded-lg transition-colors text-left"
              >
                <Flag className="w-4 h-4 sm:w-5 sm:h-5 text-red-400 flex-shrink-0" />
                <span className="text-white text-sm sm:text-base">{t('chat.reportUser', 'Report user')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
});