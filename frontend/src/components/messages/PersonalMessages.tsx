import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import {
  Search, Plus, Send, ArrowLeft, User, MessageCircle, Loader2, AlertCircle, UserPlus,
  Inbox, Check, X, Trash2, Ban
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useUser } from '../../contexts/UserContext';
import apiClient from '../../api/instance';

type Contact = {
  id: number;
  name: string;
  avatar?: string | null;
  lastMessage?: string | null;
  lastMessageTime?: string | null;
  unreadCount?: number;
};

type Msg = {
  id: string;
  content: string;
  timestamp: string;
  is_own: boolean;
  sender_name?: string;
};

type AppUser = {
  id: number;
  username?: string;
  nickname?: string;
  email?: string;
  avatar?: string | null;
};

type FriendRequestItem = {
  id: number;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  from_user: AppUser;
  to_user: AppUser;
};

type TabKey = 'messages' | 'friends';
type RequestsTab = 'incoming' | 'outgoing' | 'all';

const ContactItem = memo(({ contact, isSelected, onClick, formatTime, showLastLine = true }: {
  contact: Contact;
  isSelected: boolean;
  onClick: () => void;
  formatTime: (timestamp: string) => string;
  showLastLine?: boolean;
}) => (
  <div
    onClick={onClick}
    className={`p-4 border-b cursor-pointer transition-colors
      ${isSelected ? 'bg-white/10 border-white/20' : 'border-white/10 hover:bg-white/5'}
      text-white`}
  >
    <div className="flex items-center space-x-3">
      <div className="relative">
        <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-full flex items-center justify-center text-white">
          {contact.avatar ? (
            <img src={contact.avatar} alt={contact.name} className="w-full h-full rounded-full object-cover" />
          ) : (
            <User className="w-6 h-6" />
          )}
        </div>
        {contact.unreadCount && contact.unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 bg-rose-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {contact.unreadCount}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <h3 className="font-medium truncate">{contact.name}</h3>
          {contact.lastMessageTime && showLastLine && (
            <span className="text-xs text-white/60">{formatTime(contact.lastMessageTime)}</span>
          )}
        </div>
        {showLastLine && contact.lastMessage && (
          <p className="text-sm text-white/70 truncate mt-1">{contact.lastMessage}</p>
        )}
      </div>
    </div>
  </div>
));
ContactItem.displayName = 'ContactItem';

const PersonalMessages: React.FC = memo(() => {
  const { user } = useUser();

  const [activeTab, setActiveTab] = useState<TabKey>('messages');

  // диалоги
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // друзья
  const [friends, setFriends] = useState<Contact[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [friendsError, setFriendsError] = useState<string | null>(null);

  // заявки
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [requestsTab, setRequestsTab] = useState<RequestsTab>('incoming');
  const [requests, setRequests] = useState<FriendRequestItem[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [incomingCount, setIncomingCount] = useState(0);

  // выбранный диалог
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  // сообщения
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [newMessage, setNewMessage] = useState('');

  // поиск/модалки
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);

  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [friendQuery, setFriendQuery] = useState('');
  const [friendResults, setFriendResults] = useState<AppUser[]>([]);
  const [isSearchingFriends, setIsSearchingFriends] = useState(false);
  const [justSentRequestTo, setJustSentRequestTo] = useState<number | null>(null);

  // WS
  const wsRef = useRef<WebSocket | null>(null);
  const wsBase = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000';

  const formatTime = useCallback((timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
      if (diffInHours < 24) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return date.toLocaleDateString();
    } catch {
      return '';
    }
  }, []);

  // ===== диалоги =====
  const loadContacts = useCallback(async () => {
    try {
      setIsLoadingContacts(true);
      setError(null);
      const resp = await apiClient.get('api/conversations/');
      const list = Array.isArray(resp.data) ? resp.data : resp.data?.results || [];
      const transformed: Contact[] = list.map((conv: any) => ({
        id: Number(conv.id ?? conv.conversation_id),
        name: conv.other_user?.nickname || conv.other_user?.username || conv.name || 'Неизвестный',
        avatar: conv.other_user?.avatar || null,
        lastMessage: conv.last_message_text ?? conv.last_message ?? null,
        lastMessageTime: conv.last_message_created_at ?? conv.updated_at ?? null,
        unreadCount: conv.unread_count ?? 0,
      }));
      setContacts(transformed);
    } catch {
      setError('Не удалось загрузить диалоги');
      setContacts([]);
    } finally {
      setIsLoadingContacts(false);
    }
  }, []);
  useEffect(() => { loadContacts(); }, [loadContacts]);

  // ===== друзья =====
  const loadFriends = useCallback(async () => {
    try {
      setFriendsError(null);
      setIsLoadingFriends(true);
      const resp = await apiClient.get('api/friends/');
      const arr = Array.isArray(resp.data) ? resp.data : resp.data?.results || [];
      const mapped: Contact[] = arr.map((u: any) => ({
        id: Number(u.id),
        name: u.nickname || u.username || 'Пользователь',
        avatar: u.avatar || null,
      }));
      setFriends(mapped);
    } catch {
      setFriends([]);
      setFriendsError('Не удалось загрузить друзей');
    } finally {
      setIsLoadingFriends(false);
    }
  }, []);
  useEffect(() => {
    if (activeTab === 'friends' && friends.length === 0 && !isLoadingFriends) {
      loadFriends();
    }
  }, [activeTab, friends.length, isLoadingFriends, loadFriends]);

  // ===== сообщения диалога =====
  const loadMessages = useCallback(async (conversationId: number) => {
    try {
      setIsLoadingMessages(true);
      const resp = await apiClient.get(`api/conversations/${conversationId}/messages/`);
      const arr = Array.isArray(resp.data) ? resp.data : resp.data?.results || [];
      const transformed: Msg[] = arr.map((m: any) => ({
        id: String(m.id ?? m.message_id ?? Math.random()),
        content: m.content || m.text || '',
        timestamp: m.created_at || m.timestamp || new Date().toISOString(),
        is_own: Boolean(m.is_own ?? (m.author?.id && user?.id && Number(m.author.id) === Number(user.id))),
        sender_name: m.author?.nickname || m.user?.username || '',
      }));
      setMessages(transformed.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
    } catch {
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [user?.id]);
  useEffect(() => { if (selectedContact) loadMessages(selectedContact.id); }, [selectedContact, loadMessages]);

  // ===== WS =====
  useEffect(() => {
    if (!selectedContact) return;
    const url = `${wsBase}/ws/chat/${selectedContact.id}/`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        const t = data?.type;
        const p = data?.payload ?? data?.data;

        if (t === 'message:new' && p) {
          setMessages((prev) => {
            if (prev.find((x) => x.id === String(p.id))) return prev;
            const m: Msg = {
              id: String(p.id),
              content: p.content || p.attachment_name || '',
              timestamp: p.created_at || new Date().toISOString(),
              is_own: Boolean(p.is_own ?? (p.author?.id && user?.id && Number(p.author.id) === Number(user.id))),
              sender_name: p.author?.nickname,
            };
            return [...prev, m];
          });
          setContacts((prev) =>
            prev.map((c) =>
              c.id === selectedContact.id
                ? { ...c, lastMessage: p.content || p.attachment_name || 'Вложение', lastMessageTime: p.created_at || new Date().toISOString(), unreadCount: 0 }
                : c
            )
          );
        }

        if ((t === 'message:delete' || t === 'delete') && p?.id) {
          const id = String(p.id);
          setMessages((prev) => prev.filter((m) => m.id !== id));
        }
      } catch { /* ignore */ }
    };

    ws.onclose = () => { wsRef.current = null; };
    return () => { ws.close(); };
  }, [selectedContact, wsBase, user?.id]);

  // ===== создать диалог =====
  const createNewChat = useCallback(async (userId: number) => {
    try {
      const resp = await apiClient.post('api/conversations/', { other_user_id: Number(userId) });
      const conv = resp.data;
      const newContact: Contact = {
        id: Number(conv.id ?? conv.conversation_id),
        name: conv.other_user?.nickname || conv.other_user?.username || 'Неизвестный',
        avatar: conv.other_user?.avatar || null,
        lastMessage: null,
        lastMessageTime: new Date().toISOString(),
        unreadCount: 0,
      };
      setContacts((prev) => {
        const exists = prev.find((c) => c.id === newContact.id);
        return exists ? prev : [newContact, ...prev];
      });
      setSelectedContact(newContact);
      setActiveTab('messages');
      setShowNewChatModal(false);
    } catch {
      // показать тост — по желанию
    }
  }, []);

  const openFriendChat = useCallback((friend: Contact) => {
    createNewChat(friend.id);
  }, [createNewChat]);

  // ===== действия над друзьями =====
  const removeFriend = useCallback(async (userId: number) => {
    try {
      await apiClient.delete(`api/friends/${userId}/`);
      setFriends((prev) => prev.filter((f) => f.id !== userId));
    } catch (e) {
      // тост
    }
  }, []);

  const blockUser = useCallback(async (userId: number) => {
    try {
      await apiClient.post('/block/', { user_id: userId });
      setFriends((prev) => prev.filter((f) => f.id !== userId));
      // можно также удалить активный чат с этим пользователем из списка контактов
      setContacts((prev) => prev.filter((c) => c.id !== userId));
    } catch (e) {
      // тост
    }
  }, [setContacts]);

  // ===== отправка сообщения =====
  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !selectedContact || isSendingMessage) return;
    const text = newMessage.trim();
    setNewMessage('');
    try {
      setIsSendingMessage(true);
      const resp = await apiClient.post(`api/conversations/${selectedContact.id}/messages/`, { content: text });
      const m = resp.data;
      const sent: Msg = {
        id: String(m?.id ?? Math.random()),
        content: text,
        timestamp: m?.created_at || new Date().toISOString(),
        is_own: true,
        sender_name: (user as any)?.username || 'Вы',
      };
      setMessages((prev) => [...prev, sent]);
      setContacts((prev) =>
        prev.map((c) =>
          c.id === selectedContact.id
            ? { ...c, lastMessage: sent.content, lastMessageTime: sent.timestamp, unreadCount: 0 }
            : c
        )
      );
    } catch {
      setNewMessage(text);
    } finally {
      setIsSendingMessage(false);
    }
  }, [newMessage, selectedContact, isSendingMessage, user]);

  // ===== поиск пользователей для добавления в друзья =====
  useEffect(() => {
    const q = friendQuery.trim();
    if (q.length < 4) { setFriendResults([]); return; }
    const t = setTimeout(async () => {
      try {
        setIsSearchingFriends(true);
        const resp = await apiClient.get(`api/users/search/?q=${encodeURIComponent(q)}`);
        const arr = Array.isArray(resp.data) ? resp.data : resp.data?.results || [];
        setFriendResults(arr);
      } catch {
        setFriendResults([]);
      } finally {
        setIsSearchingFriends(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [friendQuery]);

  const sendFriendRequest = useCallback(async (toUserId: number) => {
    try {
      await apiClient.post('api/friends/requests/', { to_user_id: toUserId });
      setJustSentRequestTo(toUserId);
      // обновим счётчик входящих (он не меняется сразу, но при открытии модалки перезагрузим)
    } catch {
      setJustSentRequestTo(null);
    }
  }, []);

  // ===== заявки: загрузка/действия =====
  const loadRequests = useCallback(async (tab: RequestsTab) => {
    try {
      setIsLoadingRequests(true);
      const resp = await apiClient.get(`api/friends/requests/?type=${tab}`);
      const arr: FriendRequestItem[] = Array.isArray(resp.data) ? resp.data : resp.data?.results || [];
      setRequests(arr);
      if (tab === 'incoming') {
        const cnt = arr.filter((r) => r.status === 'pending').length;
        setIncomingCount(cnt);
      }
    } catch {
      setRequests([]);
    } finally {
      setIsLoadingRequests(false);
    }
  }, []);

  const acceptRequest = useCallback(async (id: number) => {
    try {
      await apiClient.post(`api/friends/requests/${id}/accept/`);
      // обновим списки
      await loadRequests(requestsTab);
      await loadFriends();
    } catch {}
  }, [loadFriends, loadRequests, requestsTab]);

  const rejectRequest = useCallback(async (id: number) => {
    try {
      await apiClient.post(`api/friends/requests/${id}/reject/`);
      await loadRequests(requestsTab);
    } catch {}
  }, [loadRequests, requestsTab]);

  // открытие модалки заявок — сразу грузим текущую вкладку
  useEffect(() => {
    if (showRequestsModal) loadRequests(requestsTab);
  }, [showRequestsModal, requestsTab, loadRequests]);

  // ===== фильтры =====
  const filteredContacts = useMemo(
    () => contacts.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [contacts, searchQuery]
  );
  const filteredFriends = useMemo(
    () => friends.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [friends, searchQuery]
  );

  return (
    <div className="flex h-full rounded-2xl overflow-hidden">
      {/* Список слева */}
      <div className={`w-full md:w-80 border-r flex flex-col backdrop-blur
        ${selectedContact ? 'hidden md:flex' : 'flex'}
        bg-white/5 border-white/10`}>

        {/* Шапка + вкладки */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div className="inline-flex p-1 rounded-xl bg-white/10">
              <button
                className={`px-3 py-1.5 rounded-lg text-sm transition ${
                  activeTab === 'messages' ? 'bg-white text-black' : 'text-white/80 hover:bg-white/10'
                }`}
                onClick={() => setActiveTab('messages')}
              >
                Сообщения
              </button>
              <button
                className={`px-3 py-1.5 rounded-lg text-sm transition ${
                  activeTab === 'friends' ? 'bg-white text-black' : 'text-white/80 hover:bg-white/10'
                }`}
                onClick={() => setActiveTab('friends')}
              >
                Друзья
              </button>
            </div>

            <div className="flex items-center gap-1">
              {activeTab === 'friends' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRequestsModal(true)}
                  className="relative text-white hover:bg-white/10"
                  title="Заявки в друзья"
                >
                  <Inbox className="w-4 h-4" />
                  {incomingCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-semibold rounded-full w-4 h-4 flex items-center justify-center">
                      {incomingCount}
                    </span>
                  )}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => (activeTab === 'friends' ? setShowAddFriendModal(true) : setShowNewChatModal(true))}
                className="text-white hover:bg-white/10"
                title={activeTab === 'friends' ? 'Добавить в друзья' : 'Новый диалог'}
              >
                {activeTab === 'friends' ? <UserPlus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/60 w-4 h-4" />
            <Input
              placeholder={activeTab === 'messages' ? 'Ищите разговоры…' : 'Ищите друзей…'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:ring-white/30"
            />
          </div>
        </div>

        {/* Контент списка */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'messages' ? (
            isLoadingContacts ? (
              <div className="flex items-center justify-center py-8 text-white">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="ml-2 text-white/80">Загрузка диалогов…</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <AlertCircle className="w-8 h-8 text-rose-400 mb-2" />
                <p className="text-rose-300 mb-4">{error}</p>
                <Button onClick={loadContacts} variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10">Повторить</Button>
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-white/70">
                <MessageCircle className="w-12 h-12 mb-4 text-white/30" />
                <p className="text-lg font-medium">Никаких разговоров</p>
                <p className="text-sm text-center">Начните новый диалог, чтобы перейти к обмену сообщениями</p>
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
            )
          ) : (
            // FRIENDS TAB
            isLoadingFriends ? (
              <div className="flex items-center justify-center py-8 text-white">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="ml-2 text-white/80">Загрузка друзей…</span>
              </div>
            ) : friendsError ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <AlertCircle className="w-8 h-8 text-rose-400 mb-2" />
                <p className="text-rose-300 mb-4">{friendsError}</p>
                <Button onClick={loadFriends} variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10">Повторить</Button>
              </div>
            ) : filteredFriends.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-white/70">
                <User className="w-12 h-12 mb-4 text-white/30" />
                <p className="text-lg font-medium">Друзей нет</p>
                <p className="text-sm text-center">Добавьте друзей и начните общение</p>
              </div>
            ) : (
              filteredFriends.map((friend) => (
                <div key={friend.id} className="border-b border-white/10">
                  <ContactItem
                    contact={friend}
                    isSelected={false}
                    onClick={() => openFriendChat(friend)}
                    formatTime={formatTime}
                    showLastLine={false}
                  />
                  <div className="px-4 pb-3 -mt-2">
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white" onClick={() => openFriendChat(friend)}>
                        <MessageCircle className="w-4 h-4 mr-1" /> Чат
                      </Button>
                      <Button size="sm" variant="outline" className="border-white/20 text-white hover:bg-white/10" onClick={() => removeFriend(friend.id)}>
                        <Trash2 className="w-4 h-4 mr-1" /> Удалить
                      </Button>
                      <Button size="sm" variant="outline" className="border-white/20 text-white hover:bg-white/10" onClick={() => blockUser(friend.id)}>
                        <Ban className="w-4 h-4 mr-1" /> Блок
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )
          )}
        </div>
      </div>

      {/* Правая часть — чат */}
      <div className={`flex-1 ${selectedContact ? 'flex' : 'hidden md:flex'} flex-col bg-white/5 border-l border-white/10 backdrop-blur`}>
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
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-white/70">
              <MessageCircle className="w-16 h-16 mx-auto mb-4 text-white/30" />
              <h3 className="text-lg font-medium">Выберите диалог</h3>
              <p className="text-sm">Выберите контакт слева, чтобы открыть переписку</p>
            </div>
          </div>
        )}
      </div>

      {/* Модалка "Новый диалог" */}
      {showNewChatModal && (
        <NewChatModal
          onClose={() => setShowNewChatModal(false)}
          onSelectUser={(uid) => createNewChat(uid)}
        />
      )}

      {/* Модалка "Добавить в друзья" */}
      {showAddFriendModal && (
        <AddFriendModal
          friendQuery={friendQuery}
          setFriendQuery={setFriendQuery}
          friendResults={friendResults}
          isSearchingFriends={isSearchingFriends}
          justSentRequestTo={justSentRequestTo}
          onClose={() => { setShowAddFriendModal(false); setFriendQuery(''); setFriendResults([]); setJustSentRequestTo(null); }}
          onSendRequest={(uid) => sendFriendRequest(uid)}
        />
      )}

      {/* Модалка "Заявки в друзья" */}
      {showRequestsModal && (
        <FriendRequestsModal
          tab={requestsTab}
          setTab={(t) => setRequestsTab(t)}
          requests={requests}
          loading={isLoadingRequests}
          onAccept={acceptRequest}
          onReject={rejectRequest}
          onClose={() => setShowRequestsModal(false)}
        />
      )}
    </div>
  );
});
PersonalMessages.displayName = 'PersonalMessages';

/* ---------- ВСПОМОГАТЕЛЬНЫЕ МОДАЛКИ ---------- */

const NewChatModal: React.FC<{ onClose: () => void; onSelectUser: (uid: number) => void; }> = ({ onClose, onSelectUser }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 4) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        setLoading(true);
        const resp = await apiClient.get(`api/users/search/?q=${encodeURIComponent(q)}`);
        const arr = Array.isArray(resp.data) ? resp.data : resp.data?.results || [];
        setResults(arr);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl w-full max-w-md text-white">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Новый диалог</h3>
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/60 w-4 h-4" />
            <Input
              placeholder="Введите минимум 4 символа никнейма…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-12 bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:ring-white/30"
            />
          </div>

          <div className="max-h-60 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-4 text-white">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="ml-2 text-white/80">Поиск…</span>
              </div>
            ) : results.length === 0 ? (
              <p className="text-white/70 text-center py-4">Никого не найдено</p>
            ) : (
              results.map((u) => {
                const name = u.nickname || u.username || u.email || `user:${u.id}`;
                return (
                  <div key={u.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/10">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-violet-600 rounded-full overflow-hidden flex items-center justify-center text-white">
                        {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover" /> : <User className="w-4 h-4" />}
                      </div>
                      <div className="text-sm">{name}</div>
                    </div>
                    <Button size="sm" className="ml-3 bg-indigo-600 hover:bg-indigo-500 text-white" onClick={() => onSelectUser(Number(u.id))}>
                      Открыть
                    </Button>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <Button variant="outline" className="border-white/20 text-white hover:bg-white/10" onClick={onClose}>
              Закрыть
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const AddFriendModal: React.FC<{
  friendQuery: string;
  setFriendQuery: (s: string) => void;
  friendResults: AppUser[];
  isSearchingFriends: boolean;
  justSentRequestTo: number | null;
  onSendRequest: (id: number) => void;
  onClose: () => void;
}> = ({ friendQuery, setFriendQuery, friendResults, isSearchingFriends, justSentRequestTo, onSendRequest, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl w-full max-w-md text-white">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Добавить в друзья</h3>

          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/60 w-4 h-4" />
            <Input
              placeholder="Введите минимум 4 символа никнейма…"
              value={friendQuery}
              onChange={(e) => setFriendQuery(e.target.value)}
              className="pl-12 bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:ring-white/30"
            />
          </div>

          {friendQuery.trim().length < 4 ? (
            <p className="text-sm text-white/60">Подсказка: начните ввод от 4 символов.</p>
          ) : isSearchingFriends ? (
            <div className="flex items-center justify-center py-4 text-white">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="ml-2 text-white/80">Поиск…</span>
            </div>
          ) : friendResults.length === 0 ? (
            <p className="text-white/70 py-3">Никого не найдено</p>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-2 mt-2">
              {friendResults.map((u) => {
                const name = u.nickname || u.username || u.email || `user:${u.id}`;
                const isSent = justSentRequestTo === u.id;
                return (
                  <div key={u.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/10">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-violet-600 rounded-full overflow-hidden flex items-center justify-center text-white">
                        {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover" /> : <User className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="text-sm">{name}</div>
                        {u.email && <div className="text-xs text-white/60">{u.email}</div>}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className={`ml-3 ${isSent ? 'bg-green-600 hover:bg-green-600' : 'bg-indigo-600 hover:bg-indigo-500'} text-white`}
                      onClick={() => onSendRequest(Number(u.id))}
                      disabled={isSent}
                    >
                      {isSent ? 'Отправлено' : 'Добавить'}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end space-x-3 mt-6">
            <Button
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
              onClick={onClose}
            >
              Закрыть
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const FriendRequestsModal: React.FC<{
  tab: RequestsTab;
  setTab: (t: RequestsTab) => void;
  requests: FriendRequestItem[];
  loading: boolean;
  onAccept: (id: number) => void;
  onReject: (id: number) => void;
  onClose: () => void;
}> = ({ tab, setTab, requests, loading, onAccept, onReject, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl w-full max-w-xl text-white">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Заявки в друзья</h3>
            <Button variant="outline" className="border-white/20 text-white hover:bg-white/10" onClick={onClose}>Закрыть</Button>
          </div>

          <div className="inline-flex p-1 rounded-xl bg-white/10 mb-4">
            {(['incoming','outgoing','all'] as RequestsTab[]).map((k) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`px-3 py-1.5 rounded-lg text-sm transition capitalize ${
                  tab === k ? 'bg-white text-black' : 'text-white/80 hover:bg-white/10'
                }`}
              >
                {k === 'incoming' ? 'Входящие' : k === 'outgoing' ? 'Исходящие' : 'Все'}
              </button>
            ))}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-6 text-white">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="ml-2 text-white/80">Загрузка…</span>
              </div>
            ) : requests.length === 0 ? (
              <p className="text-white/70">Список пуст</p>
            ) : (
              requests.map((r) => {
                const other = tab === 'outgoing' ? r.to_user : r.from_user?.id === undefined || r.to_user?.id === undefined
                  ? (r.from_user || r.to_user)
                  : (r.from_user.id !== undefined && r.from_user.id !== null ? (r.from_user) : r.to_user);

                const name = other?.nickname || other?.username || other?.email || `user:${other?.id}`;
                const isIncoming = r.to_user?.id ? true : (tab === 'incoming'); // безопасно
                const pending = r.status === 'pending';

                return (
                  <div key={r.id} className="flex items-center justify-between p-2 border-b border-white/10">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-violet-600 rounded-full overflow-hidden flex items-center justify-center text-white">
                        {other?.avatar ? <img src={other.avatar} className="w-full h-full object-cover" /> : <User className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="text-sm">{name}</div>
                        <div className="text-xs text-white/60">{new Date(r.created_at).toLocaleString()}</div>
                      </div>
                    </div>

                    {pending && tab !== 'outgoing' ? (
                      <div className="flex gap-2">
                        <Button size="sm" className="bg-green-600 hover:bg-green-500 text-white" onClick={() => onAccept(r.id)}>
                          <Check className="w-4 h-4 mr-1" /> Принять
                        </Button>
                        <Button size="sm" variant="outline" className="border-white/20 text-white hover:bg-white/10" onClick={() => onReject(r.id)}>
                          <X className="w-4 h-4 mr-1" /> Отклонить
                        </Button>
                      </div>
                    ) : (
                      <span className={`text-xs px-2 py-1 rounded ${
                        r.status === 'accepted' ? 'bg-green-600/30 text-green-100' :
                        r.status === 'rejected' ? 'bg-rose-600/30 text-rose-100' :
                        'bg-white/10 text-white/80'
                      }`}>
                        {r.status === 'accepted' ? 'Принята' : r.status === 'rejected' ? 'Отклонена' : 'Ожидает'}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------- ПРАВАЯ ПАНЕЛЬ ЧАТА ---------- */

export const PersonalChatInterface: React.FC<{
  contact: Contact;
  messages: Msg[];
  newMessage: string;
  setNewMessage: (message: string) => void;
  sendMessage: () => void;
  isLoadingMessages: boolean;
  isSendingMessage: boolean;
  formatTime: (timestamp: string) => string;
  setSelectedContact: (contact: Contact | null) => void;
}> = ({ contact, messages, newMessage, setNewMessage, sendMessage, isLoadingMessages, isSendingMessage, formatTime, setSelectedContact }) => (
  <div className="flex flex-col h-full">
    {/* Header */}
    <div className="flex items-center p-4 border-b border-white/10 text-white">
      <Button variant="ghost" size="sm" onClick={() => setSelectedContact(null)} className="mr-3 md:hidden text-white hover:bg-white/10">
        <ArrowLeft className="w-4 h-4" />
      </Button>
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-full flex items-center justify-center text-white">
          {contact.avatar ? (
            <img src={contact.avatar} alt={contact.name} className="w-full h-full rounded-full object-cover" />
          ) : (
            <User className="w-5 h-5" />
          )}
        </div>
        <div>
          <h3 className="font-semibold">{contact.name}</h3>
          <p className="text-sm text-white/60">Онлайн</p>
        </div>
      </div>
    </div>

    {/* Messages */}
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {isLoadingMessages ? (
        <div className="flex items-center justify-center py-8 text-white">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="ml-2 text-white/80">Загрузка сообщений…</span>
        </div>
      ) : messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-white/70">
          <MessageCircle className="w-12 h-12 mb-4 text-white/30" />
          <p className="text-lg font-medium">Пока нет сообщений</p>
          <p className="text-sm">Начните переписку с {contact.name}</p>
        </div>
      ) : (
        messages.map((message) => (
          <div key={message.id} className={`flex ${message.is_own ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl
              ${message.is_own ? 'bg-indigo-600 text-white' : 'bg-white/10 text-white border border-white/10'}`}>
              <p className="text-sm break-words whitespace-pre-wrap">{message.content}</p>
              <p className={`text-xs mt-1 ${message.is_own ? 'text-indigo-100' : 'text-white/60'}`}>
                {formatTime(message.timestamp)}
              </p>
            </div>
          </div>
        ))
      )}
    </div>

    {/* Message Input */}
    <div className="p-4 border-t border-white/10">
      <div className="flex space-x-2">
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Введите сообщение…"
          onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }}
          disabled={isSendingMessage}
          className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:ring-white/30"
        />
        <Button onClick={sendMessage} disabled={!newMessage.trim() || isSendingMessage} className="px-4 bg-indigo-600 hover:bg-indigo-500 text-white">
          {isSendingMessage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  </div>
);

export default PersonalMessages;
