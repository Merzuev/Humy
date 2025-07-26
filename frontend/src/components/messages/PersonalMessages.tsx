import React, { useState, useEffect, useContext, useCallback, useMemo, memo } from 'react';
import { Search, Plus, Send, ArrowLeft, User, MessageCircle, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { UserContext, useUser } from '../../contexts/UserContext';
import apiClient from '../../api/instance';


interface Contact {
  id: string;
  name: string;
  avatar?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
}

interface Message {
  id: string;
  content: string;
  timestamp: string;
  is_own: boolean;
  sender_name?: string;
}

interface User {
  id: string;
  username: string;
  first_name?: string;
  last_name?: string;
  avatar?: string;
}

// Memoized contact item component
const ContactItem = memo(({ 
  contact, 
  isSelected, 
  onClick, 
  formatTime 
}: {
  contact: Contact;
  isSelected: boolean;
  onClick: () => void;
  formatTime: (timestamp: string) => string;
}) => (
  <div
    onClick={onClick}
    className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
      isSelected ? 'bg-blue-50 border-blue-200' : ''
    }`}
  >
    <div className="flex items-center space-x-3">
      <div className="relative">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
          {contact.avatar ? (
            <img src={contact.avatar} alt={contact.name} className="w-full h-full rounded-full object-cover" />
          ) : (
            <User className="w-6 h-6" />
          )}
        </div>
        {contact.unreadCount && contact.unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {contact.unreadCount}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900 truncate">{contact.name}</h3>
          {contact.lastMessageTime && (
            <span className="text-xs text-gray-500">
              {formatTime(contact.lastMessageTime)}
            </span>
          )}
        </div>
        {contact.lastMessage && (
          <p className="text-sm text-gray-600 truncate mt-1">{contact.lastMessage}</p>
        )}
      </div>
    </div>
  </div>
));

ContactItem.displayName = 'ContactItem';

// Memoized search result item
const SearchResultItem = memo(({ 
  user, 
  onClick 
}: {
  user: User;
  onClick: () => void;
}) => (
  <div
    onClick={onClick}
    className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer"
  >
    <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
      {user.avatar ? (
        <img src={user.avatar} alt={user.username} className="w-full h-full rounded-full object-cover" />
      ) : (
        <User className="w-5 h-5" />
      )}
    </div>
    <div>
      <p className="font-medium text-gray-900">{user.username}</p>
      {(user.first_name || user.last_name) && (
        <p className="text-sm text-gray-500">
          {user.first_name} {user.last_name}
        </p>
      )}
    </div>
  </div>
));

SearchResultItem.displayName = 'SearchResultItem';

const PersonalMessages: React.FC = memo(() => {
  const { user } = useUser();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Memoized format time function
  const formatTime = useCallback((timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

      if (diffInHours < 24) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else {
        return date.toLocaleDateString();
      }
    } catch {
      return '';
    }
  }, []);

  // Загрузка контактов
  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = useCallback(async () => {
    try {
      setIsLoadingContacts(true);
      setError(null);
      const response = await apiClient.get('/conversations/');
      
      const contactsData = Array.isArray(response.data) ? response.data : response.data?.results || [];
      
      const transformedContacts: Contact[] = contactsData.map((conv: any) => ({
        id: conv.id || conv.conversation_id,
        name: conv.other_user?.username || conv.other_user?.first_name || conv.name || 'Unknown User',
        avatar: conv.other_user?.avatar || conv.avatar,
        lastMessage: conv.last_message?.content || conv.last_message,
        lastMessageTime: conv.last_message?.timestamp || conv.updated_at,
        unreadCount: conv.unread_count || 0
      }));

      setContacts(transformedContacts);
    } catch (error) {
      setError('Failed to load conversations');
      setContacts([]);
    } finally {
      setIsLoadingContacts(false);
    }
  }, []);

  // Поиск пользователей с дебаунсом
  useEffect(() => {
    if (!userSearchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        setIsLoadingSearch(true);
        const response = await apiClient.get(`/users/?search=${encodeURIComponent(userSearchQuery)}`);
        
        const users = Array.isArray(response.data) ? response.data : response.data?.results || [];
        setSearchResults(users);
      } catch (error) {
        setSearchResults([]);
      } finally {
        setIsLoadingSearch(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [userSearchQuery]);

  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      setIsLoadingMessages(true);
      const response = await apiClient.get(`/conversations/${conversationId}/messages`);
      
      const messagesData = Array.isArray(response.data) ? response.data : response.data?.results || [];
      
      const transformedMessages: Message[] = messagesData.map((msg: any) => ({
        id: msg.id || msg.message_id || Math.random().toString(),
        content: msg.content || msg.text || '',
        timestamp: msg.timestamp || msg.created_at || new Date().toISOString(),
        is_own: msg.is_own || msg.sender_id === user?.id || msg.sender === user?.username,
        sender_name: msg.sender_name || msg.sender || msg.user?.username
      }));

      setMessages(transformedMessages);
    } catch (error) {
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [user?.id, user?.username]);

  // Загрузка сообщений для выбранного контакта
  useEffect(() => {
    if (selectedContact) {
      loadMessages(selectedContact.id);
    }
  }, [selectedContact, loadMessages]);

  const createNewChat = useCallback(async (userId: string) => {
    try {
      const response = await apiClient.post('/conversations/', {
        user_id: userId,
        other_user_id: userId
      });

      const newConversation = response.data;
      const newContact: Contact = {
        id: newConversation.id || newConversation.conversation_id,
        name: newConversation.other_user?.username || newConversation.other_user?.first_name || 'Unknown User',
        avatar: newConversation.other_user?.avatar,
        lastMessage: '',
        lastMessageTime: new Date().toISOString(),
        unreadCount: 0
      };

      setContacts(prev => [newContact, ...prev]);
      setSelectedContact(newContact);
      setShowNewChatModal(false);
      setUserSearchQuery('');
      setSearchResults([]);
    } catch (error) {
    }
  }, []);

  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !selectedContact || isSendingMessage) return;

    const messageContent = newMessage.trim();
    setNewMessage('');

    try {
      setIsSendingMessage(true);
      
      const response = await apiClient.post(`/conversations/${selectedContact.id}/messages`, {
        content: messageContent,
        text: messageContent
      });

      const sentMessage: Message = {
        id: response.data.id || Math.random().toString(),
        content: messageContent,
        timestamp: new Date().toISOString(),
        is_own: true,
        sender_name: user?.username || 'You'
      };

      setMessages(prev => [...prev, sentMessage]);

      // Обновляем последнее сообщение в контакте
      setContacts(prev => prev.map(contact => 
        contact.id === selectedContact.id 
          ? { ...contact, lastMessage: messageContent, lastMessageTime: sentMessage.timestamp }
          : contact
      ));
    } catch (error) {
      setNewMessage(messageContent); // Восстанавливаем сообщение при ошибке
    } finally {
      setIsSendingMessage(false);
    }
  }, [newMessage, selectedContact, isSendingMessage, user?.username]);

  const filteredContacts = useMemo(() => contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase())
  ), [contacts, searchQuery]);

  return (
    <div className="flex h-full bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Contacts List */}
      <div className={`w-full md:w-80 border-r border-gray-200 flex flex-col ${selectedContact ? 'hidden md:flex' : 'flex'}`}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Messages</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowNewChatModal(true)}
              className="text-blue-600 hover:text-blue-700"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Contacts */}
        <div className="flex-1 overflow-y-auto">
          {isLoadingContacts ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Loading conversations...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 px-4">
              <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
              <p className="text-red-600 text-center mb-4">{error}</p>
              <Button onClick={loadContacts} variant="outline" size="sm">
                Try Again
              </Button>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-gray-500">
              <MessageCircle className="w-12 h-12 mb-4 text-gray-300" />
              <p className="text-lg font-medium">No conversations</p>
              <p className="text-sm text-center">Start a new conversation to begin messaging</p>
            </div>
          ) : (
            filteredContacts.map((contact) => (
              <ContactItem
                key={contact.id}
                contact={contact}
                isSelected={selectedContact?.id === contact.id}
                onClick={() => setSelectedContact(contact)}
                formatTime={formatTime}
              />
            ))
          )}
        </div>
      </div>

      {/* Chat Interface */}
      <div className={`flex-1 ${selectedContact ? 'flex' : 'hidden md:flex'} flex-col`}>
        {selectedContact ? (
          <PersonalChatInterface 
            contact={selectedContact} 
            messages={messages}
            newMessage={newMessage}
            setNewMessage={setNewMessage}
            sendMessage={sendMessage}
            isLoadingMessages={isLoadingMessages}
            isSendingMessage={isSendingMessage}
            formatTime={formatTime}
            setSelectedContact={setSelectedContact}
            user={user}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center text-gray-500">
              <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">Select a conversation</h3>
              <p className="text-sm">Choose a conversation from the list to start messaging</p>
            </div>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Start New Conversation</h3>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search users..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="max-h-60 overflow-y-auto">
                {isLoadingSearch ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                    <span className="ml-2 text-gray-600">Searching...</span>
                  </div>
                ) : searchResults.length === 0 && userSearchQuery ? (
                  <p className="text-gray-500 text-center py-4">No users found</p>
                ) : (
                  searchResults.map((user) => (
                    <SearchResultItem
                      key={user.id}
                      user={user}
                      onClick={() => createNewChat(user.id)}
                    />
                  ))
                )}
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowNewChatModal(false);
                    setUserSearchQuery('');
                    setSearchResults([]);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

PersonalMessages.displayName = 'PersonalMessages';

export const PersonalChatInterface: React.FC<{
  contact: Contact;
  messages: Message[];
  newMessage: string;
  setNewMessage: (message: string) => void;
  sendMessage: () => void;
  isLoadingMessages: boolean;
  isSendingMessage: boolean;
  formatTime: (timestamp: string) => string;
  setSelectedContact: (contact: Contact | null) => void;
  user: any;
}> = ({ 
  contact, 
  messages, 
  newMessage, 
  setNewMessage, 
  sendMessage, 
  isLoadingMessages, 
  isSendingMessage, 
  formatTime, 
  setSelectedContact, 
  user 
}) => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center p-4 border-b border-gray-200 bg-white">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedContact(null)}
          className="mr-3 md:hidden"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
            {contact.avatar ? (
              <img src={contact.avatar} alt={contact.name} className="w-full h-full rounded-full object-cover" />
            ) : (
              <User className="w-5 h-5" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{contact.name}</h3>
            <p className="text-sm text-gray-500">Online</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {isLoadingMessages ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Loading messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <MessageCircle className="w-12 h-12 mb-4 text-gray-300" />
            <p className="text-lg font-medium">No messages yet</p>
            <p className="text-sm">Start a conversation with {contact.name}</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.is_own ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.is_own
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-900 border border-gray-200'
                }`}
              >
                <p className="text-sm">{message.content}</p>
                <p className={`text-xs mt-1 ${message.is_own ? 'text-blue-100' : 'text-gray-500'}`}>
                  {formatTime(message.timestamp)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-gray-200 bg-white">
        <div className="flex space-x-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            disabled={isSendingMessage}
            className="flex-1"
          />
          <Button 
            onClick={sendMessage} 
            disabled={!newMessage.trim() || isSendingMessage}
            className="px-4"
          >
            {isSendingMessage ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );

export default PersonalMessages;