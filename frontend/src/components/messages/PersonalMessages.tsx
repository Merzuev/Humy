// src/components/messages/PersonalMessages.tsx
import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  memo,
  useRef,
} from "react";
import {
  Search,
  Plus,
  Send,
  ArrowLeft,
  User,
  MessageCircle,
  Loader2,
  UserPlus,
  Inbox,
  Paperclip,
  Mic,
  Square,
  File as FileIcon,
} from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { useUser } from "../../contexts/UserContext";
import apiClient from "../../api/instance";

import ContactsList from "./ContactsList";
import FriendsList from "./FriendsList";
import FriendRequestsModal from "./FriendRequestsModal";

/* ===================== Типы ===================== */

export type Contact = {
  id: number;
  name: string;
  avatar?: string | null;
  lastMessage?: string | null;
  lastMessageTime?: string | null;
  lastMessageIsOwn?: boolean;
  lastMessageAttachmentKind?: "image" | "video" | "audio" | "file" | null;
  unreadCount?: number;
  isOnline?: boolean;
};

type Msg = {
  id: string;
  content: string;
  timestamp: string;
  is_own: boolean;
  sender_name?: string;
  attachmentUrl?: string | null;
  attachmentKind?: "image" | "video" | "audio" | "file" | null;
  attachmentName?: string | null;
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
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  from_user: AppUser;
  to_user: AppUser;
};

type TabKey = "messages" | "friends";
type RequestsTab = "incoming" | "outgoing" | "all";

/* ===================== Утилиты ===================== */

function guessKindFromMime(mime?: string | null): Msg["attachmentKind"] {
  if (!mime) return null;
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "file";
}
function guessKindFromName(name?: string | null): Msg["attachmentKind"] {
  if (!name) return null;
  const lower = name.toLowerCase();
  if (/\.(png|jpg|jpeg|webp|gif|bmp|heic|avif)$/.test(lower)) return "image";
  if (/\.(mp4|mov|webm|mkv|avi)$/.test(lower)) return "video";
  if (/\.(mp3|wav|ogg|m4a|opus|oga|webm)$/.test(lower)) return "audio";
  return "file";
}

// Определяем, моё ли сообщение, устойчиво к разным полям бэка
function isOwnByUser(msg: any, userId?: number): boolean {
  if (!userId) return Boolean(msg.is_own);
  const authorId = Number(
    msg.author_id ?? msg.user_id ?? msg.author?.id ?? msg.user?.id
  );
  if (Number.isFinite(authorId)) return authorId === userId;
  return Boolean(msg.is_own);
}

// Конструктор WS-URL: учитывает wss/ws, текущий хост, VITE_WS_BASE_URL
function makeWsUrl(path: string) {
  const base = (import.meta as any).env?.VITE_WS_BASE_URL as string | undefined;
  if (base) return base.replace(/\/+$/, "") + path;
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}${path}`;
}

/* ===================== Компонент ===================== */

type PersonalMessagesProps = {
  selectedContact?: Contact | null;
  onSelectContact?: (c: Contact) => void;
};

const PersonalMessages: React.FC<PersonalMessagesProps> = memo(
  ({ selectedContact: externalSelected = null, onSelectContact }) => {
    const { user } = useUser();
    const userId = user?.id ? Number(user.id) : undefined;

    const [activeTab, setActiveTab] = useState<TabKey>("messages");

    // диалоги
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [isLoadingContacts, setIsLoadingContacts] = useState(true);
    const [contactsError, setContactsError] = useState<string | null>(null);

    // друзья
    const [friends, setFriends] = useState<Contact[]>([]);
    const [isLoadingFriends, setIsLoadingFriends] = useState(false);
    const [friendsError, setFriendsError] = useState<string | null>(null);

    // заявки
    const [showRequestsModal, setShowRequestsModal] = useState(false);
    const [requestsTab, setRequestsTab] = useState<RequestsTab>("incoming");
    const [requests, setRequests] = useState<FriendRequestItem[]>([]);
    const [isLoadingRequests, setIsLoadingRequests] = useState(false);
    const [incomingCount, setIncomingCount] = useState(0);

    // выбранный диалог (локально, если нет внешнего)
    const [selectedContactLocal, setSelectedContactLocal] =
      useState<Contact | null>(externalSelected);
    useEffect(() => {
      if (externalSelected !== undefined) setSelectedContactLocal(externalSelected);
    }, [externalSelected]);
    const selectedContact = onSelectContact ? externalSelected : selectedContactLocal;

    // «Назад» из правой панели — просто снимаем выбор диалога
    useEffect(() => {
      const handler = () => setSelectedContactLocal(null);
      window.addEventListener("humy:close-chat", handler);
      return () => window.removeEventListener("humy:close-chat", handler);
    }, []);

    // сообщения (только для локального режима)
    const [messages, setMessages] = useState<Msg[]>([]);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [isSendingMessage, setIsSendingMessage] = useState(false);
    const [newMessage, setNewMessage] = useState("");

    // запись голоса
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [recTime, setRecTime] = useState(0);
    const recTimer = useRef<number | null>(null);
    const recordStartRef = useRef<number>(0);

    // поиск + модалки
    const [searchQuery, setSearchQuery] = useState("");
    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [showAddFriendModal, setShowAddFriendModal] = useState(false);

    // WS уведомлений включены?
    const notificationsEnabled =
      String(import.meta.env.VITE_WS_NOTIFICATIONS_ENABLED || "0") === "1";

    const formatTime = useCallback((timestamp: string) => {
      try {
        const date = new Date(timestamp);
        const now = new Date();
        const diffInHours = (now.getTime() - date.getTime()) / 36e5;
        if (diffInHours < 24)
          return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        return date.toLocaleDateString();
      } catch {
        return "";
      }
    }, []);

    /* ===== Загрузка диалогов ===== */
    const loadContacts = useCallback(async () => {
      try {
        setIsLoadingContacts(true);
        setContactsError(null);
        const resp = await apiClient.get("api/conversations/");
        const list = Array.isArray(resp.data) ? resp.data : resp.data?.results || [];
        const transformed: Contact[] = list.map((conv: any) => {
          const cid = Number(conv.id ?? conv.conversation_id);
          const other = conv.other_user || conv.partner || conv.user;
          const lastAuthorId =
            Number(
              conv.last_message_author_id ??
                conv.last_message_author?.id ??
                conv.last_author_id
            ) || undefined;
          const lastAttachKind =
            conv.last_message_attachment_type ||
            conv.last_attachment_type ||
            guessKindFromMime(conv.last_message_attachment_mime) ||
            guessKindFromName(conv.last_message_attachment_name) ||
            null;
          return {
            id: cid,
            name:
              other?.nickname || other?.username || conv.name || "Неизвестный",
            avatar: other?.avatar || null,
            lastMessage:
              conv.last_message_text ?? conv.last_message ?? conv.last_text ?? null,
            lastMessageTime: conv.last_message_created_at ?? conv.updated_at ?? null,
            lastMessageIsOwn: userId !== undefined ? lastAuthorId === userId : undefined,
            lastMessageAttachmentKind: lastAttachKind,
            unreadCount: conv.unread_count ?? 0,
            isOnline: Boolean(other?.is_online),
          };
        });
        setContacts(transformed);
      } catch {
        setContactsError("Не удалось загрузить диалоги");
        setContacts([]);
      } finally {
        setIsLoadingContacts(false);
      }
    }, [userId]);
    useEffect(() => { loadContacts(); }, [loadContacts]);

    /* ===== Друзья ===== */
    const loadFriends = useCallback(async () => {
      try {
        setFriendsError(null);
        setIsLoadingFriends(true);
        const resp = await apiClient.get("api/friends/");
        const arr = Array.isArray(resp.data) ? resp.data : resp.data?.results || [];
        const mapped: Contact[] = arr.map((u: any) => ({
          id: Number(u.id),
          name: u.nickname || u.username || "Пользователь",
          avatar: u.avatar || null,
          isOnline: Boolean(u.is_online),
        }));
        setFriends(mapped);
      } catch {
        setFriends([]);
        setFriendsError("Не удалось загрузить друзей");
      } finally {
        setIsLoadingFriends(false);
      }
    }, []);
    useEffect(() => {
      if (activeTab === "friends" && friends.length === 0 && !isLoadingFriends) {
        loadFriends();
      }
    }, [activeTab, friends.length, isLoadingFriends, loadFriends]);

    /* ===== Сообщения диалога (локальный режим) ===== */
    const loadMessages = useCallback(
      async (conversationId: number) => {
        try {
          setIsLoadingMessages(true);
          const resp = await apiClient.get(
            `api/conversations/${conversationId}/messages/`
          );
          const arr = Array.isArray(resp.data) ? resp.data : resp.data?.results || [];
          const transformed: Msg[] = arr.map((m: any) => {
            const attUrl =
              m.attachment_url ||
              (typeof m.attachment === "string" ? m.attachment : m.attachment?.url) ||
              null;
            const kind =
              m.attachment_type ||
              guessKindFromMime(m.attachment_mime) ||
              guessKindFromName(m.attachment_name) ||
              null;
            return {
              id: String(m.id ?? m.message_id ?? Math.random()),
              content: m.content || m.text || "",
              timestamp: m.created_at || m.timestamp || new Date().toISOString(),
              is_own: isOwnByUser(m, userId),
              sender_name: m.author?.nickname || m.user?.username || "",
              attachmentUrl: attUrl,
              attachmentKind: kind,
              attachmentName: m.attachment_name || null,
            };
          });
          setMessages(
            transformed.sort(
              (a, b) =>
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            )
          );
        } catch {
          setMessages([]);
        } finally {
          setIsLoadingMessages(false);
        }
      },
      [userId]
    );
    useEffect(() => {
      if (!onSelectContact && selectedContact) loadMessages(selectedContact.id);
    }, [selectedContact, onSelectContact, loadMessages]);

    /* ===== WS чата (локальный режим) ===== */
    const wsRef = useRef<WebSocket | null>(null);
    useEffect(() => {
      if (onSelectContact || !selectedContact) return;
      const token =
        localStorage.getItem("humy:access") || localStorage.getItem("access") || "";
      const url =
        makeWsUrl(`/ws/chat/${selectedContact.id}/`) +
        (token ? `?token=${encodeURIComponent(token)}` : "");
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          const p = data?.payload ?? data?.data;
          if (data?.type === "message:new" && p) {
            setMessages((prev) => {
              if (prev.find((x) => x.id === String(p.id))) return prev;
              const m: Msg = {
                id: String(p.id),
                content: p.content || "",
                timestamp: p.created_at || new Date().toISOString(),
                is_own: isOwnByUser(p, userId),
                sender_name: p.author?.nickname,
                attachmentUrl:
                  p.attachment_url ||
                  (typeof p.attachment === "string" ? p.attachment : p.attachment?.url) ||
                  null,
                attachmentKind:
                  p.attachment_type ||
                  guessKindFromMime(p.attachment_mime) ||
                  guessKindFromName(p.attachment_name) ||
                  null,
                attachmentName: p.attachment_name || null,
              };
              return [...prev, m];
            });
            setContacts((prev) =>
              prev.map((c) =>
                c.id === selectedContact.id
                  ? {
                      ...c,
                      lastMessage: p.content || p.attachment_name || "Вложение",
                      lastMessageTime: p.created_at || new Date().toISOString(),
                      lastMessageIsOwn: isOwnByUser(p, userId),
                      lastMessageAttachmentKind:
                        p.attachment_type ||
                        guessKindFromMime(p.attachment_mime) ||
                        guessKindFromName(p.attachment_name) ||
                        null,
                      unreadCount: 0,
                    }
                  : c
              )
            );
          }
        } catch {}
      };
      ws.onclose = () => { wsRef.current = null; };
      return () => ws.close();
    }, [selectedContact, onSelectContact, userId]);

    /* ===== WS уведомлений ===== */
    const notifWsRef = useRef<WebSocket | null>(null);
    useEffect(() => {
      if (!notificationsEnabled) return;
      const token =
        localStorage.getItem("humy:access") || localStorage.getItem("access") || "";
      const ws = new WebSocket(
        makeWsUrl(`/ws/notifications/`) +
          (token ? `?token=${encodeURIComponent(token)}` : "")
      );
      notifWsRef.current = ws;
      ws.onerror = () => { try { ws.close(); } catch {} };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          switch (msg.type) {
            case "friend:accept":
              loadFriends();
              break;
            case "friend:request":
              setIncomingCount((x) => (x || 0) + 1);
              break;
            case "dm:badge": {
              const id = Number(msg.chat_id);
              setContacts((prev) => {
                const copy = [...prev];
                const i = copy.findIndex((c) => c.id === id);
                const kind =
                  msg.attachment_kind ||
                  guessKindFromMime(msg.attachment_mime) ||
                  guessKindFromName(msg.attachment_name) ||
                  null;
                if (i >= 0) {
                  const c = { ...copy[i] };
                  c.lastMessage = msg.last_message || msg.attachment_name || "Вложение";
                  c.lastMessageTime = msg.last_message_created_at;
                  c.lastMessageIsOwn = false;
                  c.lastMessageAttachmentKind = kind;
                  c.unreadCount = (c.unreadCount || 0) + 1;
                  copy.splice(i, 1);
                  copy.unshift(c);
                } else {
                  loadContacts();
                }
                return copy;
              });
              break;
            }
            case "dm:read": {
              const id = Number(msg.chat_id);
              setContacts((prev) =>
                prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
              );
              break;
            }
          }
        } catch {}
      };
      ws.onclose = () => { notifWsRef.current = null; };
      return () => { try { ws.close(); } catch {} };
    }, [loadContacts, loadFriends, notificationsEnabled]);

    /* ===== Создать диалог / открыть чат с другом ===== */
    const createNewChat = useCallback(async (targetUserId: number) => {
      try {
        const resp = await apiClient.post("api/conversations/", {
          other_user_id: Number(targetUserId),
        });
        const conv = resp.data;
        const newContact: Contact = {
          id: Number(conv.id ?? conv.conversation_id),
          name:
            conv.other_user?.nickname || conv.other_user?.username || "Неизвестный",
          avatar: conv.other_user?.avatar || null,
          lastMessage: null,
          lastMessageTime: new Date().toISOString(),
          unreadCount: 0,
          isOnline: Boolean(conv.other_user?.is_online),
        };
        setContacts((prev) => {
          const exists = prev.find((c) => c.id === newContact.id);
          return exists ? prev : [newContact, ...prev];
        });
        if (onSelectContact) onSelectContact(newContact);
        else setSelectedContactLocal(newContact);
        setActiveTab("messages");
        setShowNewChatModal(false);
      } catch {}
    }, [onSelectContact]);

    const openFriendChat = useCallback(
      (friend: Contact) => { createNewChat(friend.id); },
      [createNewChat]
    );

    /* ===== Фильтры поиска ===== */
    const filteredContacts = useMemo(
      () =>
        contacts.filter((c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      [contacts, searchQuery]
    );
    const filteredFriends = useMemo(
      () =>
        friends.filter((c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      [friends, searchQuery]
    );

    /* ===== Рендер ===== */
    const handleSelect = (c: Contact) => {
      if (onSelectContact) onSelectContact(c);
      else setSelectedContactLocal(c);
    };
    const showRightChatPanel = !onSelectContact;

    // автоскролл
    const scrollRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
      scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, [messages.length, selectedContact?.id]);

    return (
      <div className="flex h-full rounded-2xl overflow-hidden">
        {/* Список слева */}
        <div
          className={`w-full md:w-80 border-r flex flex-col backdrop-blur ${
            selectedContact && showRightChatPanel ? "hidden md:flex" : "flex"
          } bg-white/5 border-white/10`}
        >
          {/* Шапка + вкладки */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="inline-flex p-1 rounded-xl bg-white/10">
                <button
                  className={`px-3 py-1.5 rounded-lg text-sm transition ${
                    activeTab === "messages"
                      ? "bg-white text-black"
                      : "text-white/80 hover:bg-white/10"
                  }`}
                  onClick={() => setActiveTab("messages")}
                >
                  Сообщения
                </button>
                <button
                  className={`px-3 py-1.5 rounded-lg text-sm transition ${
                    activeTab === "friends"
                      ? "bg-white text-black"
                      : "text-white/80 hover:bg-white/10"
                  }`}
                  onClick={() => setActiveTab("friends")}
                >
                  Друзья
                </button>
              </div>

              <div className="flex items-center gap-1">
                {activeTab === "friends" && (
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
                  onClick={() =>
                    activeTab === "friends"
                      ? setShowAddFriendModal(true)
                      : setShowNewChatModal(true)
                  }
                  className="text-white hover:bg-white/10"
                  title={
                    activeTab === "friends" ? "Добавить в друзья" : "Новый диалог"
                  }
                >
                  {activeTab === "friends" ? <UserPlus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Поиск */}
            <Input
              placeholder={
                activeTab === "messages" ? "Ищите разговоры…" : "Ищите друзей…"
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search />}
              className="bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:ring-white/30"
            />
          </div>

          {/* Контент списка */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === "messages" ? (
              <ContactsList
                contacts={filteredContacts}
                loading={isLoadingContacts}
                error={contactsError}
                onRetry={loadContacts}
                selectedId={selectedContact?.id}
                onSelect={handleSelect}
                formatTime={formatTime}
              />
            ) : (
              <FriendsList
                friends={filteredFriends}
                loading={isLoadingFriends}
                error={friendsError}
                onRetry={loadFriends}
                onOpenChat={openFriendChat}
                onRemove={() => {}}
                onBlock={() => {}}
              />
            )}
          </div>
        </div>

        {/* Правая часть — чат (автономный режим) */}
        {!onSelectContact && (
          <div
            className={`flex-1 ${
              selectedContact ? "flex" : "hidden md:flex"
            } flex-col bg-white/5 border-l border-white/10 backdrop-blur`}
          >
            {selectedContact ? (
              <PersonalChatInterface
                key={selectedContact.id}
                contact={selectedContact}
                // запись
                startRecording={() => startRecording()}
                stopRecording={() => stopRecording()}
                isRecording={isRecording}
                recTime={recTime}
                // файлы
                fileInputRef={undefined}
                onPickFiles={undefined}
                // сообщения
                messages={messages}
                setMessages={setMessages}
                newMessage={newMessage}
                setNewMessage={setNewMessage}
                sendMessage={undefined}
                isSendingMessage={isSendingMessage}
                scrollRef={undefined}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-white/70">
                  <MessageCircle className="w-16 h-16 mx-auto mb-4 text-white/30" />
                  <h3 className="text-lg font-medium">Выберите диалог</h3>
                  <p className="text-sm">
                    Выберите контакт слева, чтобы открыть переписку
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Модалка заявок в друзья */}
        {showRequestsModal && (
          <FriendRequestsModal
            tab={requestsTab}
            setTab={(t) => setRequestsTab(t)}
            requests={requests}
            loading={isLoadingRequests}
            onAccept={() => {}}
            onReject={() => {}}
            onClose={() => setShowRequestsModal(false)}
          />
        )}
      </div>
    );
  }
);
PersonalMessages.displayName = "PersonalMessages";

/* ===================== Правая панель чата ===================== */

export const PersonalChatInterface: React.FC<{
  contact: Contact;
  startRecording?: () => void;
  stopRecording?: () => void;
  isRecording?: boolean;
  recTime?: number;
  fileInputRef?: React.MutableRefObject<HTMLInputElement | null>;
  onPickFiles?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  messages?: Msg[];
  setMessages?: React.Dispatch<React.SetStateAction<Msg[]>>;
  newMessage?: string;
  setNewMessage?: (s: string) => void;
  sendMessage?: () => void;
  isSendingMessage?: boolean;
  scrollRef?: React.MutableRefObject<HTMLDivElement | null>;
}> = ({
  contact,
  startRecording,
  stopRecording,
  isRecording,
  recTime,
  fileInputRef,
  onPickFiles,
  messages,
  setMessages,
  newMessage,
  setNewMessage,
  sendMessage,
  isSendingMessage,
  scrollRef,
}) => {
  const { user } = useUser();
  const userId = user?.id ? Number(user.id) : undefined;

  const [localMessages, setLocalMessages] = useState<Msg[]>([]);
  const [localNewMessage, setLocalNewMessage] = useState("");
  const [localIsSending, setLocalIsSending] = useState(false);
  const [preview, setPreview] = useState<{ url: string; kind: "image" | "video" } | null>(null);

  const setMsgs = useCallback(
    (updater: any) => {
      if (typeof setMessages === "function") {
        if (typeof updater === "function") setMessages((prev: Msg[]) => updater(prev));
        else setMessages(updater);
      } else {
        if (typeof updater === "function") setLocalMessages((prev) => updater(prev));
        else setLocalMessages(updater);
      }
    },
    [setMessages]
  );

  const msgs = Array.isArray(messages) ? messages : localMessages;
  const msgValue = typeof newMessage === "string" ? newMessage : localNewMessage;
  const setMsgValue = (v: string) =>
    typeof setNewMessage === "function" ? setNewMessage(v) : setLocalNewMessage(v);
  const sending =
    typeof isSendingMessage === "boolean" ? isSendingMessage : localIsSending;

  const localFileInputRef = useRef<HTMLInputElement | null>(null);
  const fileRef = fileInputRef ?? localFileInputRef;

  // локальная отправка текста
  const localSendText = useCallback(async () => {
    const text = (msgValue ?? "").trim();
    if (!text || sending) return;
    const optimistic: Msg = {
      id: `tmp_${Date.now()}`,
      content: text,
      timestamp: new Date().toISOString(),
      is_own: true,
    };
    setMsgs((prev: Msg[]) => [...prev, optimistic]);
    setMsgValue("");
    try {
      if (setMessages === undefined) setLocalIsSending(true);
      const resp = await apiClient.post(
        `api/conversations/${contact.id}/messages/`,
        { content: text }
      );
      const m = resp.data || {};
      setMsgs((prev: Msg[]) =>
        prev.map((mm) =>
          mm.id === optimistic.id
            ? { ...mm, id: String(m.id ?? mm.id), timestamp: m.created_at || mm.timestamp }
            : mm
        )
      );
    } finally {
      if (setMessages === undefined) setLocalIsSending(false);
    }
  }, [contact.id, msgValue, sending, setMsgs, setMessages]);

  // локальная загрузка файла
  const localUploadOneFile = useCallback(
    async (file: File) => {
      const tmp: Msg = {
        id: `tmp_${Date.now()}_${file.name}`,
        content: "",
        timestamp: new Date().toISOString(),
        is_own: true,
        attachmentUrl: URL.createObjectURL(file),
        attachmentKind:
          guessKindFromName(file.name) || guessKindFromMime(file.type) || "file",
        attachmentName: file.name,
      };
      setMsgs((prev: Msg[]) => [...prev, tmp]);

      const fd = new FormData();
      fd.append("attachment", file);
      try {
        if (setMessages === undefined) setLocalIsSending(true);
        const resp = await apiClient.post(
          `api/conversations/${contact.id}/messages/`,
          fd,
          { headers: { "Content-Type": "multipart/form-data" } }
        );
        const m = resp.data || {};
        const attUrl =
          m.attachment_url ||
          (typeof m.attachment === "string" ? m.attachment : m.attachment?.url) ||
          null;
        const kind =
          m.attachment_type ||
          guessKindFromMime(m.attachment_mime) ||
          guessKindFromName(m.attachment_name || file.name) ||
          guessKindFromName(file.name) ||
          null;

        setMsgs((prev: Msg[]) =>
          prev.map((msg) =>
            msg.id === tmp.id
              ? {
                  ...msg,
                  id: String(m?.id ?? msg.id),
                  attachmentUrl: attUrl || msg.attachmentUrl,
                  attachmentKind: kind || msg.attachmentKind,
                  attachmentName: m.attachment_name || msg.attachmentName,
                  timestamp: m?.created_at || msg.timestamp,
                }
              : msg
          )
        );
      } finally {
        if (setMessages === undefined) setLocalIsSending(false);
      }
    },
    [contact.id, setMsgs, setMessages]
  );

  const onPickFilesSafe = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (typeof onPickFiles === "function") return onPickFiles(e);
      const files = e.target.files;
      if (!files) return;
      Array.from(files).forEach((f) => localUploadOneFile(f));
      e.target.value = "";
    },
    [onPickFiles, localUploadOneFile]
  );

  // история
  useEffect(() => {
    (async () => {
      try {
        const resp = await apiClient.get(
          `api/conversations/${contact.id}/messages/`
        );
        const arr = Array.isArray(resp.data) ? resp.data : resp.data?.results || [];
        const mapped: Msg[] = arr.map((m: any) => {
          const attUrl =
            m.attachment_url ||
            (typeof m.attachment === "string" ? m.attachment : m.attachment?.url) ||
            null;
          const kind =
            m.attachment_type ||
            guessKindFromMime(m.attachment_mime) ||
            guessKindFromName(m.attachment_name) ||
            null;
          return {
            id: String(m.id ?? m.message_id ?? Math.random()),
            content: m.content || m.text || "",
            timestamp: m.created_at || m.timestamp || new Date().toISOString(),
            is_own: isOwnByUser(m, userId),
            sender_name: m.author?.nickname || m.user?.username || "",
            attachmentUrl: attUrl,
            attachmentKind: kind,
            attachmentName: m.attachment_name || null,
          };
        });
        setMsgs(
          mapped.sort(
            (a, b) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          )
        );
      } catch {
        setMsgs([]);
      }
    })();
  }, [contact.id, setMsgs, userId]);

  // WS диалога
  useEffect(() => {
    const token =
      localStorage.getItem("humy:access") || localStorage.getItem("access") || "";
    const ws = new WebSocket(
      makeWsUrl(`/ws/chat/${contact.id}/`) +
        (token ? `?token=${encodeURIComponent(token)}` : "")
    );
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data?.type === "message:new") {
          const p = data.payload ?? data.data;
          const attUrl =
            p.attachment_url ||
            (typeof p.attachment === "string" ? p.attachment : p.attachment?.url) ||
            null;
          const kind =
            p.attachment_type ||
            guessKindFromMime(p.attachment_mime) ||
            guessKindFromName(p.attachment_name) ||
            null;
          const msg: Msg = {
            id: String(p.id ?? Math.random()),
            content: p.content || "",
            timestamp: p.created_at || new Date().toISOString(),
            is_own: isOwnByUser(p, userId),
            sender_name: p.author?.nickname,
            attachmentUrl: attUrl,
            attachmentKind: kind,
            attachmentName: p.attachment_name || null,
          };
          setMsgs((prev: Msg[]) => [...prev, msg]);
        }
      } catch {}
    };
    return () => { try { ws.close(); } catch {} };
  }, [contact.id, setMsgs, userId]);

  // формат времени
  const fmt = useCallback((ts: string) => {
    try {
      const d = new Date(ts); const now = new Date();
      const same = d.toDateString() === now.toDateString();
      return same
        ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : d.toLocaleDateString();
    } catch { return ""; }
  }, []);

  const safeNew = (msgValue ?? "");
  const canSend =
    typeof safeNew === "string" && safeNew.trim().length > 0 && !sending;

  const useStartRec = startRecording ?? (() => {});
  const useStopRec = stopRecording ?? (() => {});
  const recActive = isRecording ?? false;
  const recTimeShow = recTime ?? 0;
  const handleSend = sendMessage ?? localSendText;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center p-4 border-b border-white/10 text-white">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const ev = new CustomEvent("humy:close-chat");
            window.dispatchEvent(ev);
          }}
          className="mr-3 md:hidden text-white hover:bg-white/10"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-full flex items-center justify-center text-white overflow-hidden">
            {contact.avatar ? (
              <img src={contact.avatar} alt={contact.name} className="w-full h-full object-cover" />
            ) : (
              <User className="w-5 h-5" />
            )}
          </div>
          <div>
            <h3 className="font-semibold">{contact.name}</h3>
            <p className="text-sm text-white/60">
              {contact.isOnline ? "Онлайн" : "Оффлайн"}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {msgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-white/70">
            <MessageCircle className="w-12 h-12 mb-4 text-white/30" />
            <p className="text-lg font-medium">Пока нет сообщений</p>
            <p className="text-sm">Начните переписку с {contact.name}</p>
          </div>
        ) : (
          msgs.map((message) => (
            <div key={message.id} className={`flex ${message.is_own ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-xs lg:max-w-md px-3 py-2 rounded-2xl ${
                message.is_own ? "bg-indigo-600 text-white" : "bg-white/10 text-white border border-white/10"
              }`}>
                {message.content && (
                  <p className="text-sm break-words whitespace-pre-wrap">{message.content}</p>
                )}

                {!!message.attachmentUrl && (
                  <div className={`${message.content ? "mt-2" : ""}`}>
                    {message.attachmentKind === "image" ? (
                      <button
                        type="button"
                        onClick={() => setPreview({ url: message.attachmentUrl!, kind: "image" })}
                        className="block group"
                        title="Открыть изображение"
                      >
                        <div className="relative overflow-hidden rounded-xl">
                          <img
                            src={message.attachmentUrl!}
                            alt={message.attachmentName || "image"}
                            className="w-[256px] h-[256px] object-cover"
                            loading="lazy"
                          />
                        </div>
                      </button>
                    ) : message.attachmentKind === "video" ? (
                      <div className="rounded-xl overflow-hidden">
                        <video
                          src={message.attachmentUrl!}
                          className="w-[256px] h-[256px] object-cover bg-black/30"
                          muted
                          controls
                          playsInline
                          onClick={() => setPreview({ url: message.attachmentUrl!, kind: "video" })}
                        />
                      </div>
                    ) : message.attachmentKind === "audio" ? (
                      <div className="rounded-xl overflow-hidden bg-black/20 p-2">
                        <audio controls src={message.attachmentUrl} className="w-56" />
                      </div>
                    ) : (
                      <a
                        href={message.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 underline hover:no-underline"
                      >
                        <FileIcon className="w-4 h-4" />
                        {message.attachmentName || "Файл"}
                      </a>
                    )}
                  </div>
                )}

                <p className={`text-[11px] mt-1 ${message.is_own ? "text-indigo-100/80" : "text-white/60"}`}>
                  {fmt(message.timestamp)}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={scrollRef ?? null} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10"
            onClick={() => (fileRef.current as any)?.click()}
            title="Прикрепить файл"
            disabled={sending}
          >
            <Paperclip className="w-4 h-4" />
          </Button>
          <input
            type="file"
            ref={fileRef}
            multiple
            onChange={onPickFiles ?? onPickFilesSafe}
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.7z"
            className="hidden"
          />

          <Input
            value={msgValue}
            onChange={(e) => setMsgValue(e.target.value)}
            placeholder="Введите сообщение…"
            onKeyDown={(e) => { if (e.key === "Enter" && canSend) (handleSend as () => void)(); }}
            disabled={sending}
            className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:ring-white/30"
          />

          {msgValue.trim().length > 0 ? (
            <Button
              onClick={handleSend}
              disabled={!canSend}
              className="px-4 bg-indigo-600 hover:bg-indigo-500 text-white"
              title="Отправить"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          ) : (
            <Button
              onClick={recActive ? useStopRec : useStartRec}
              onMouseDown={useStartRec}
              onMouseUp={useStopRec}
              onMouseLeave={() => recActive && useStopRec()}
              onTouchStart={useStartRec}
              onTouchEnd={useStopRec}
              className={`px-4 ${recActive ? "bg-rose-600 hover:bg-rose-600" : "bg-indigo-600 hover:bg-indigo-500"} text-white relative`}
              title={recActive ? "Нажмите, чтобы остановить запись" : "Нажмите/удерживайте для записи"}
            >
              {recActive ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              {recActive && (
                <span className="absolute -top-2 -right-2 text-[10px] bg-black/60 px-1 rounded">
                  {Math.floor((recTimeShow ?? 0) / 60).toString().padStart(2, "0")}:
                  {((recTimeShow ?? 0) % 60).toString().padStart(2, "0")}
                </span>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Лайтбокс предпросмотра */}
      {preview && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          {preview.kind === "image" ? (
            <img
              src={preview.url}
              alt="preview"
              className="max-w-full max-h-full rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <video
              src={preview.url}
              controls
              autoPlay
              className="max-w-full max-h-full rounded-2xl bg-black"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default PersonalMessages;
