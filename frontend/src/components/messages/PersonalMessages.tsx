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
  AlertCircle,
  UserPlus,
  Inbox,
  Check,
  X,
  Trash2,
  Ban,
  Paperclip,
  Mic,
  Square,
  Image as ImageIcon,
  File as FileIcon,
  Volume2,
  Play,
  ExternalLink,
} from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { useUser } from "../../contexts/UserContext";
import apiClient from "../../api/instance";

/* ===================== Типы ===================== */

export type Contact = {
  id: number; // id диалога (conversation)
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

/* ===================== Карточка контакта ===================== */

const ContactItem = memo(
  ({
    contact,
    isSelected,
    onClick,
    formatTime,
    showLastLine = true,
  }: {
    contact: Contact;
    isSelected: boolean;
    onClick: () => void;
    formatTime: (timestamp: string) => string;
    showLastLine?: boolean;
  }) => {
    const time =
      contact.lastMessageTime && showLastLine
        ? formatTime(contact.lastMessageTime)
        : "";

    const LastLine = () => {
      if (!showLastLine) return null;

      const prefix = contact.lastMessageIsOwn ? "Вы: " : "";
      const kind = contact.lastMessageAttachmentKind;

      const attach =
        kind === "image" ? (
          <>
            <ImageIcon className="inline h-4 w-4 mr-1 align-text-bottom" />
            Фото
          </>
        ) : kind === "audio" ? (
          <>
            <Volume2 className="inline h-4 w-4 mr-1 align-text-bottom" />
            Аудио
          </>
        ) : kind === "video" ? (
          <>
            <Play className="inline h-4 w-4 mr-1 align-text-bottom" />
            Видео
          </>
        ) : kind === "file" ? (
          <>
            <FileIcon className="inline h-4 w-4 mr-1 align-text-bottom" />
            Файл
          </>
        ) : null;

      if (attach && !contact.lastMessage) {
        return (
          <div
            className={`truncate text-sm ${
              contact.unreadCount ? "text-white" : "text-white/60"
            }`}
          >
            {attach}
          </div>
        );
      }

      return (
        <div
          className={`truncate text-sm ${
            contact.unreadCount ? "text-white" : "text-white/60"
          }`}
        >
          {attach && (
            <>
              {attach}
              {" · "}
            </>
          )}
          {prefix}
          {contact.lastMessage ?? ""}
        </div>
      );
    };

    return (
      <button
        onClick={onClick}
        className={`w-full text-left px-3 py-2 border-b transition ${
          isSelected ? "bg-white/10 border-white/20" : "border-white/10 hover:bg-white/5"
        }`}
      >
        <div className="flex items-center gap-3 text-white">
          <div className="relative">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500/40 to-purple-500/40 flex items-center justify-center">
              {contact.avatar ? (
                <img
                  src={contact.avatar}
                  alt={contact.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-6 h-6 opacity-70" />
              )}
            </div>

            {/* онлайн-статус */}
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ring-2 ring-background ${
                contact.isOnline ? "bg-emerald-400" : "bg-zinc-500/50"
              }`}
              title={contact.isOnline ? "Онлайн" : "Оффлайн"}
            />

            {/* бейдж непрочитанных */}
            {contact.unreadCount ? (
              <span className="absolute -top-1 -left-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-[11px] font-semibold text-white flex items-center justify-center">
                {contact.unreadCount > 99 ? "99+" : contact.unreadCount}
              </span>
            ) : null}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3
                className={`truncate ${
                  contact.unreadCount ? "font-semibold" : "font-medium"
                }`}
              >
                {contact.name}
              </h3>
              {time && (
                <span className="ml-auto text-xs text-white/50 shrink-0">
                  {time}
                </span>
              )}
            </div>

            <LastLine />
          </div>
        </div>
      </button>
    );
  }
);
ContactItem.displayName = "ContactItem";

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
    const [error, setError] = useState<string | null>(null);

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
      if (externalSelected !== undefined) {
        setSelectedContactLocal(externalSelected);
      }
    }, [externalSelected]);

    const selectedContact = onSelectContact
      ? externalSelected
      : selectedContactLocal;

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

    // поиск/модалки
    const [searchQuery, setSearchQuery] = useState("");
    const [showNewChatModal, setShowNewChatModal] = useState(false);

    const [showAddFriendModal, setShowAddFriendModal] = useState(false);
    const [friendQuery, setFriendQuery] = useState("");
    const [friendResults, setFriendResults] = useState<AppUser[]>([]);
    const [isSearchingFriends, setIsSearchingFriends] = useState(false);
    const [justSentRequestTo, setJustSentRequestTo] = useState<number | null>(
      null
    );

    // WS
    const wsRef = useRef<WebSocket | null>(null);
    const notifWsRef = useRef<WebSocket | null>(null);
    const wsBase = import.meta.env.VITE_WS_BASE_URL || "ws://localhost:8000";
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
        setError(null);
        const resp = await apiClient.get("api/conversations/");
        const list = Array.isArray(resp.data)
          ? resp.data
          : resp.data?.results || [];
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
              conv.last_message_text ??
              conv.last_message ??
              conv.last_text ??
              null,
            lastMessageTime:
              conv.last_message_created_at ?? conv.updated_at ?? null,
            lastMessageIsOwn:
              userId !== undefined ? lastAuthorId === userId : undefined,
            lastMessageAttachmentKind: lastAttachKind,
            unreadCount: conv.unread_count ?? 0,
            isOnline: Boolean(other?.is_online),
          };
        });
        setContacts(transformed);
      } catch {
        setError("Не удалось загрузить диалоги");
        setContacts([]);
      } finally {
        setIsLoadingContacts(false);
      }
    }, [userId]);

    useEffect(() => {
      loadContacts();
    }, [loadContacts]);

    /* ===== Друзья ===== */
    const loadFriends = useCallback(async () => {
      try {
        setFriendsError(null);
        setIsLoadingFriends(true);
        const resp = await apiClient.get("api/friends/");
        const arr = Array.isArray(resp.data)
          ? resp.data
          : resp.data?.results || [];
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
          const arr = Array.isArray(resp.data)
            ? resp.data
            : resp.data?.results || [];
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
              is_own: Boolean(
                m.is_own ??
                  (m.author?.id && userId && Number(m.author.id) === userId)
              ),
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
      if (!onSelectContact && selectedContact) {
        loadMessages(selectedContact.id);
      }
    }, [selectedContact, onSelectContact, loadMessages]);

    /* ===== WS чата (локальный режим) ===== */
    useEffect(() => {
      if (onSelectContact) return;
      if (!selectedContact) return;

      const url = `${wsBase}/ws/chat/${selectedContact.id}/`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          const t = data?.type;
          const p = data?.payload ?? data?.data;

          if (t === "message:new" && p) {
            setMessages((prev) => {
              if (prev.find((x) => x.id === String(p.id))) return prev;
              const m: Msg = {
                id: String(p.id),
                content: p.content || "",
                timestamp: p.created_at || new Date().toISOString(),
                is_own: Boolean(
                  p.is_own ??
                    (p.author?.id && userId && Number(p.author.id) === userId)
                ),
                sender_name: p.author?.nickname,
                attachmentUrl:
                  p.attachment_url ||
                  (typeof p.attachment === "string"
                    ? p.attachment
                    : p.attachment?.url) ||
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

            // обновить карточку активного диалога
            setContacts((prev) =>
              prev.map((c) =>
                c.id === selectedContact.id
                  ? {
                      ...c,
                      lastMessage: p.content || p.attachment_name || "Вложение",
                      lastMessageTime:
                        p.created_at || new Date().toISOString(),
                      lastMessageIsOwn: Boolean(
                        p.author?.id && userId && Number(p.author.id) === userId
                      ),
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
        } catch {
          /* ignore */
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
      };
      return () => {
        ws.close();
      };
    }, [selectedContact, wsBase, onSelectContact, userId]);

    /* ===== WS уведомлений ===== */
    useEffect(() => {
      if (!notificationsEnabled) return;
      try {
        const ws = new WebSocket(`${wsBase}/ws/notifications/`);
        notifWsRef.current = ws;

        ws.onerror = () => {
          try {
            ws.close();
          } catch {}
        };

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
                    c.lastMessage =
                      msg.last_message || msg.attachment_name || "Вложение";
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
                  prev.map((c) =>
                    c.id === id ? { ...c, unreadCount: 0 } : c
                  )
                );
                break;
              }
            }
          } catch {
            /* ignore */
          }
        };

        ws.onclose = () => {
          notifWsRef.current = null;
        };
        return () => ws.close();
      } catch {
        /* ignore */
      }
    }, [wsBase, loadContacts, loadFriends, notificationsEnabled]);

    /* ===== Создать диалог ===== */
    const createNewChat = useCallback(
      async (targetUserId: number) => {
        try {
          const resp = await apiClient.post("api/conversations/", {
            other_user_id: Number(targetUserId),
          });
          const conv = resp.data;
          const newContact: Contact = {
            id: Number(conv.id ?? conv.conversation_id),
            name:
              conv.other_user?.nickname ||
              conv.other_user?.username ||
              "Неизвестный",
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
          if (onSelectContact) {
            onSelectContact(newContact);
          } else {
            setSelectedContactLocal(newContact);
          }
          setActiveTab("messages");
          setShowNewChatModal(false);
        } catch {
          // тост по желанию
        }
      },
      [onSelectContact]
    );

    const openFriendChat = useCallback(
      (friend: Contact) => {
        createNewChat(friend.id);
      },
      [createNewChat]
    );

    /* ===== Действия над друзьями ===== */
    const removeFriend = useCallback(async (userIdToRemove: number) => {
      try {
        await apiClient.delete(`api/friends/${userIdToRemove}/`);
        setFriends((prev) => prev.filter((f) => f.id !== userIdToRemove));
      } catch {}
    }, []);

    const blockUser = useCallback(
      async (userIdToBlock: number) => {
        try {
          await apiClient.post("/block/", { user_id: userIdToBlock });
          setFriends((prev) => prev.filter((f) => f.id !== userIdToBlock));
          setContacts((prev) => prev.filter((c) => c.id !== userIdToBlock));
        } catch {}
      },
      [setContacts]
    );

    /* ===== Отправка текста (всегда разрешена) ===== */
    const sendMessage = useCallback(async () => {
      if (!selectedContact || isSendingMessage) return;

      const text = (newMessage ?? "").trim();
      if (!text) return;

      // оптимистично в интерфейс
      const optimistic: Msg = {
        id: `tmp_${Date.now()}`,
        content: text,
        timestamp: new Date().toISOString(),
        is_own: true,
      };
      setMessages((prev) => [...prev, optimistic]);
      setNewMessage("");

      try {
        setIsSendingMessage(true);
        const resp = await apiClient.post(
          `api/conversations/${selectedContact.id}/messages/`,
          { content: text }
        );
        const m = resp.data;
        // заменить tmp-id на реальный id/время
        setMessages((prev) =>
          prev.map((mm) =>
            mm.id === optimistic.id
              ? {
                  ...mm,
                  id: String(m?.id ?? mm.id),
                  timestamp: m?.created_at || mm.timestamp,
                }
              : mm
          )
        );
        // обновить карточку диалога
        setContacts((prev) =>
          prev.map((c) =>
            c.id === selectedContact.id
              ? {
                  ...c,
                  lastMessage: text,
                  lastMessageTime: m?.created_at || optimistic.timestamp,
                  lastMessageIsOwn: true,
                  lastMessageAttachmentKind: null,
                  unreadCount: 0,
                }
              : c
          )
        );
      } catch {
        // при ошибке — вернём текст в инпут
        setNewMessage(text);
      } finally {
        setIsSendingMessage(false);
      }
    }, [newMessage, selectedContact, isSendingMessage, setMessages]);

    /* ===== Отправка файлов (всегда разрешена) ===== */
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const uploadOneFile = useCallback(
      async (file: File) => {
        if (!selectedContact) return;

        // оптимистичный каркас сообщения (с превью)
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
        setMessages((prev) => [...prev, tmp]);

        const fd = new FormData();
        fd.append("attachment", file);
        try {
          setIsSendingMessage(true);
          const resp = await apiClient.post(
            `api/conversations/${selectedContact.id}/messages/`,
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

          // заменить оптимистичное сообщение на реальное
          setMessages((prev) =>
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

          // обновить карточку диалога
          setContacts((prev) =>
            prev.map((c) =>
              c.id === selectedContact.id
                ? {
                    ...c,
                    lastMessage: m.attachment_name || file.name || "Вложение",
                    lastMessageTime: m?.created_at || tmp.timestamp,
                    lastMessageIsOwn: true,
                    lastMessageAttachmentKind: kind || "file",
                    unreadCount: 0,
                  }
                : c
            )
          );
        } finally {
          setIsSendingMessage(false);
        }
      },
      [selectedContact]
    );

    const onPickFiles = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        const arr = Array.from(files);
        arr.forEach((f) => uploadOneFile(f));
        e.target.value = "";
      },
      [uploadOneFile]
    );

    /* ===== Голосовые сообщения (всегда разрешены) ===== */

    const startRecording = useCallback(async () => {
      if (!selectedContact || isRecording) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType =
          MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
            ? "audio/webm;codecs=opus"
            : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
            ? "audio/ogg;codecs=opus"
            : "audio/webm";
        const rec = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = rec;
        chunksRef.current = [];
        rec.ondataavailable = (evt) => {
          if (evt.data && evt.data.size > 0) chunksRef.current.push(evt.data);
        };
        rec.onstop = async () => {
          setIsRecording(false);
          if (recTimer.current) {
            window.clearInterval(recTimer.current);
            recTimer.current = null;
          }
          setRecTime(0);
          const blob = new Blob(chunksRef.current, { type: mimeType });
          chunksRef.current = [];
          const duration = Date.now() - recordStartRef.current;
          if (duration < 500) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          const filename = `voice_${Date.now()}.${
            mimeType.includes("ogg") ? "ogg" : "webm"
          }`;
          const file = new File([blob], filename, { type: mimeType });
          await uploadOneFile(file);
          stream.getTracks().forEach((t) => t.stop());
        };
        rec.start();
        recordStartRef.current = Date.now();
        setIsRecording(true);
        setRecTime(0);
        recTimer.current = window.setInterval(() => {
          setRecTime((s) => s + 1);
        }, 1000);
      } catch {
        setIsRecording(false);
      }
    }, [selectedContact, isRecording, uploadOneFile]);

    const stopRecording = useCallback(() => {
      const rec = mediaRecorderRef.current;
      if (rec && rec.state !== "inactive") {
        rec.stop();
      }
    }, []);

    /* ===== Поиск пользователей для друзей ===== */
    useEffect(() => {
      const q = friendQuery.trim();
      if (q.length < 4) {
        setFriendResults([]);
        return;
      }
      const t = setTimeout(async () => {
        try {
          setIsSearchingFriends(true);
          const resp = await apiClient.get(
            `api/users/search/?q=${encodeURIComponent(q)}`
          );
          const arr = Array.isArray(resp.data)
            ? resp.data
            : resp.data?.results || [];
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
        await apiClient.post("api/friends/requests/", { to_user_id: toUserId });
        setJustSentRequestTo(toUserId);
      } catch {
        setJustSentRequestTo(null);
      }
    }, []);

    /* ===== Заявки: загрузка/действия ===== */
    const loadRequests = useCallback(async (tab: RequestsTab) => {
      try {
        setIsLoadingRequests(true);
        const resp = await apiClient.get(`api/friends/requests/?type=${tab}`);
        const arr: FriendRequestItem[] = Array.isArray(resp.data)
          ? resp.data
          : resp.data?.results || [];
        setRequests(arr);
        if (tab === "incoming") {
          const cnt = arr.filter((r) => r.status === "pending").length;
          setIncomingCount(cnt);
        }
      } catch {
        setRequests([]);
      } finally {
        setIsLoadingRequests(false);
      }
    }, []);

    const acceptRequest = useCallback(
      async (id: number) => {
        try {
          await apiClient.post(`api/friends/requests/${id}/accept/`);
          await loadRequests(requestsTab);
          await loadFriends();
        } catch {}
      },
      [loadFriends, loadRequests, requestsTab]
    );

    const rejectRequest = useCallback(
      async (id: number) => {
        try {
          await apiClient.post(`api/friends/requests/${id}/reject/`);
          await loadRequests(requestsTab);
        } catch {}
      },
      [loadRequests, requestsTab]
    );

    useEffect(() => {
      if (showRequestsModal) loadRequests(requestsTab);
    }, [showRequestsModal, requestsTab, loadRequests]);

    /* ===== Фильтры ===== */
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

    // Автоскролл при входе/получении новых сообщений
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
                  {activeTab === "friends" ? (
                    <UserPlus className="w-4 h-4" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Поиск: фикс лупы/плейсхолдера */}
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
              isLoadingContacts ? (
                <div className="flex items-center justify-center py-8 text-white">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="ml-2 text-white/80">Загрузка диалогов…</span>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                  <AlertCircle className="w-8 h-8 text-rose-400 mb-2" />
                  <p className="text-rose-300 mb-4">{error}</p>
                  <Button
                    onClick={loadContacts}
                    variant="outline"
                    size="sm"
                    className="border-white/20 text-white hover:bg-white/10"
                  >
                    Повторить
                  </Button>
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-white/70">
                  <MessageCircle className="w-12 h-12 mb-4 text-white/30" />
                  <p className="text-lg font-medium">Никаких разговоров</p>
                  <p className="text-sm text-center">
                    Начните новый диалог, чтобы перейти к обмену сообщениями
                  </p>
                </div>
              ) : (
                filteredContacts.map((contact) => (
                  <ContactItem
                    key={contact.id}
                    contact={contact}
                    isSelected={selectedContact?.id === contact.id}
                    onClick={() => handleSelect(contact)}
                    formatTime={formatTime}
                  />
                ))
              )
            ) : isLoadingFriends ? (
              <div className="flex items-center justify-center py-8 text-white">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="ml-2 text-white/80">Загрузка друзей…</span>
              </div>
            ) : friendsError ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <AlertCircle className="w-8 h-8 text-rose-400 mb-2" />
                <p className="text-rose-300 mb-4">{friendsError}</p>
                <Button
                  onClick={loadFriends}
                  variant="outline"
                  size="sm"
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  Повторить
                </Button>
              </div>
            ) : filteredFriends.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-white/70">
                <User className="w-12 h-12 mb-4 text-white/30" />
                <p className="text-lg font-medium">Друзей нет</p>
                <p className="text-sm text-center">
                  Добавьте друзей и начните общение
                </p>
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
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="bg-indigo-600 hover:bg-indigo-500 text-white"
                        onClick={() => openFriendChat(friend)}
                      >
                        <MessageCircle className="w-4 h-4 mr-1" /> Чат
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-white/20 text-white hover:bg-white/10"
                        onClick={() => removeFriend(friend.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" /> Удалить
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-white/20 text-white hover:bg-white/10"
                        onClick={() => blockUser(friend.id)}
                      >
                        <Ban className="w-4 h-4 mr-1" /> Блок
                      </Button>
                    </div>
                  </div>
                </div>
              ))
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
                startRecording={startRecording}
                stopRecording={stopRecording}
                isRecording={isRecording}
                recTime={recTime}
                fileInputRef={fileInputRef}
                onPickFiles={onPickFiles}
                messages={messages}
                setMessages={setMessages}
                newMessage={newMessage}
                setNewMessage={setNewMessage}
                sendMessage={sendMessage}
                isSendingMessage={isSendingMessage}
                scrollRef={scrollRef}
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

        {/* Модалки */}
        {showNewChatModal && (
          <NewChatModal
            onClose={() => setShowNewChatModal(false)}
            onSelectUser={(uid) => createNewChat(uid)}
          />
        )}

        {showAddFriendModal && (
          <AddFriendModal
            friendQuery={friendQuery}
            setFriendQuery={setFriendQuery}
            friendResults={friendResults}
            isSearchingFriends={isSearchingFriends}
            justSentRequestTo={justSentRequestTo}
            onClose={() => {
              setShowAddFriendModal(false);
              setFriendQuery("");
              setFriendResults([]);
              setJustSentRequestTo(null);
            }}
            onSendRequest={(uid) => sendFriendRequest(uid)}
          />
        )}

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
  }
);
PersonalMessages.displayName = "PersonalMessages";

/* ===================== Правая панель чата ===================== */
/* ВАЖНО: все пропсы — опциональные. Если какой-то не передан,
   компонент использует внутреннее состояние и не падает. */

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
  const wsBase = import.meta.env.VITE_WS_BASE_URL || "ws://localhost:8000";
  const { user } = useUser();
  const userId = user?.id ? Number(user.id) : undefined;

  /* ===== Fallback состояния, если родитель не передал ===== */
  const [localMessages, setLocalMessages] = useState<Msg[]>([]);
  const [localNewMessage, setLocalNewMessage] = useState("");
  const [localIsSending, setLocalIsSending] = useState(false);

  // универсальный setter сообщений (поддерживает и функцию, и значение)
  const setMsgs = useCallback(
    (updater: any) => {
      if (typeof setMessages === "function") {
        if (typeof updater === "function") {
          setMessages((prev: Msg[]) => updater(prev));
        } else {
          setMessages(updater);
        }
      } else {
        if (typeof updater === "function") {
          setLocalMessages((prev) => updater(prev));
        } else {
          setLocalMessages(updater);
        }
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

  /* ===== Локальные отправители на случай отсутствия пропсов ===== */
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
      if (typeof setLocalIsSending === "function" && setMessages === undefined)
        setLocalIsSending(true);
      const resp = await apiClient.post(
        `api/conversations/${contact.id}/messages/`,
        { content: text }
      );
      const m = resp.data || {};
      setMsgs((prev: Msg[]) =>
        prev.map((mm) =>
          mm.id === optimistic.id
            ? {
                ...mm,
                id: String(m.id ?? mm.id),
                timestamp: m.created_at || mm.timestamp,
              }
            : mm
        )
      );
    } finally {
      if (setMessages === undefined) setLocalIsSending(false);
    }
  }, [contact.id, msgValue, sending, setMsgs, setMessages]);

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

  /* ===== История + WS для конкретного чата ===== */
  const [localLoad, setLocalLoad] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLocalLoad(true);
        const resp = await apiClient.get(
          `api/conversations/${contact.id}/messages/`
        );
        const arr = Array.isArray(resp.data)
          ? resp.data
          : resp.data?.results || [];
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
            is_own: Boolean(
              m.is_own ??
                (m.author?.id && userId && Number(m.author.id) === userId)
            ),
            sender_name: m.author?.nickname || m.user?.username || "",
            attachmentUrl: attUrl,
            attachmentKind: kind,
            attachmentName: m.attachment_name || null,
          };
        });
        setMsgs(
          (prev: Msg[]) =>
            mapped.sort(
              (a, b) =>
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            ) // полностью заменяем историю
        );
      } finally {
        setLocalLoad(false);
      }
    })();
  }, [contact.id, setMsgs, userId]);

  useEffect(() => {
    const ws = new WebSocket(`${wsBase}/ws/chat/${contact.id}/`);
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
            is_own: Boolean(
              p.is_own ??
                (p.author?.id && userId && Number(p.author.id) === userId)
            ),
            sender_name: p.author?.nickname,
            attachmentUrl: attUrl,
            attachmentKind: kind,
            attachmentName: p.attachment_name || null,
          };
          setMsgs((prev: Msg[]) => [...prev, msg]);
        }
      } catch {}
    };
    ws.onclose = () => {};
    return () => {
      try {
        ws.close();
      } catch {}
    };
  }, [contact.id, setMsgs, wsBase, userId]);

  /* ===== Локальная запись голоса (если не передали методы) ===== */
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recOn, setRecOn] = useState(false);
  const [recSec, setRecSec] = useState(0);
  const recTimer = useRef<number | null>(null);
  const recordStartRef = useRef<number>(0);

  const startRecLocal = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType =
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
          ? "audio/ogg;codecs=opus"
          : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (evt) => {
        if (evt.data && evt.data.size > 0) chunksRef.current.push(evt.data);
      };
      rec.onstop = async () => {
        setRecOn(false);
        if (recTimer.current) {
          window.clearInterval(recTimer.current);
          recTimer.current = null;
        }
        setRecSec(0);
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        const duration = Date.now() - recordStartRef.current;
        if (duration < 500) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const filename = `voice_${Date.now()}.${
          mimeType.includes("ogg") ? "ogg" : "webm"
        }`;
        const file = new File([blob], filename, { type: mimeType });
        await localUploadOneFile(file);
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      recordStartRef.current = Date.now();
      setRecOn(true);
      setRecSec(0);
      recTimer.current = window.setInterval(() => {
        setRecSec((s) => s + 1);
      }, 1000);
    } catch {
      setRecOn(false);
    }
  }, [localUploadOneFile]);

  const stopRecLocal = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop();
    }
  }, []);

  const fmt = useCallback((ts: string) => {
    try {
      const d = new Date(ts);
      const now = new Date();
      const same =
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();
      return same
        ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : d.toLocaleDateString();
    } catch {
      return "";
    }
  }, []);

  const safeNew = (msgValue ?? "");
  const canSend =
    typeof safeNew === "string" && safeNew.trim().length > 0 && !sending;

  const useStartRec = startRecording ?? startRecLocal;
  const useStopRec = stopRecording ?? stopRecLocal;
  const recActive = isRecording ?? recOn;
  const recTimeShow = recTime ?? recSec;

  const handleSend = sendMessage ?? localSendText;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center p-4 border-b border-white/10 text-white">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => history.back()}
          className="mr-3 md:hidden text-white hover:bg-white/10"
        >
            <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-full flex items-center justify-center text-white overflow-hidden">
            {contact.avatar ? (
              <img
                src={contact.avatar}
                alt={contact.name}
                className="w-full h-full object-cover"
              />
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
        {localLoad ? (
          <div className="flex items-center justify-center py-8 text-white">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="ml-2 text-white/80">Загрузка сообщений…</span>
          </div>
        ) : msgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-white/70">
            <MessageCircle className="w-12 h-12 mb-4 text-white/30" />
            <p className="text-lg font-medium">Пока нет сообщений</p>
            <p className="text-sm">Начните переписку с {contact.name}</p>
          </div>
        ) : (
          msgs.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.is_own ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-3 py-2 rounded-2xl ${
                  message.is_own
                    ? "bg-indigo-600 text-white"
                    : "bg-white/10 text-white border border-white/10"
                }`}
              >
                {/* Текст */}
                {message.content && (
                  <p className="text-sm break-words whitespace-pre-wrap">
                    {message.content}
                  </p>
                )}

                {/* Медиа */}
                {!!message.attachmentUrl && (
                  <div className={`${message.content ? "mt-2" : ""}`}>
                    {message.attachmentKind === "image" ? (
                      <a
                        href={message.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block group"
                        title="Открыть изображение"
                      >
                        <div className="relative overflow-hidden rounded-xl">
                          {/* Фиксированный размер превью */}
                          <img
                            src={message.attachmentUrl}
                            alt={message.attachmentName || "image"}
                            className="w-64 max-w-full h-64 object-cover"
                          />
                          <div className="absolute bottom-1 right-1 bg-black/40 rounded px-1.5 py-0.5 text-[10px] opacity-0 group-hover:opacity-100 transition">
                            <ExternalLink className="w-3 h-3 inline-block mr-1" />
                            Открыть
                          </div>
                        </div>
                      </a>
                    ) : message.attachmentKind === "video" ? (
                      <div className="rounded-xl overflow-hidden">
                        <video
                          src={message.attachmentUrl}
                          controls
                          playsInline
                          className="w-64 max-w-full h-64 object-cover bg-black/30"
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

                <p
                  className={`text-[11px] mt-1 ${
                    message.is_own ? "text-indigo-100/80" : "text-white/60"
                  }`}
                >
                  {fmt(message.timestamp)}
                </p>
              </div>
            </div>
          ))
        )}
        {/* якорь для автоскролла */}
        <div ref={scrollRef ?? null} />
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-2">
          {/* Прикрепить файл */}
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
            onChange={onPickFilesSafe}
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.7z"
            className="hidden"
          />

          {/* Поле ввода */}
          <Input
            value={safeNew}
            onChange={(e) => setMsgValue(e.target.value)}
            placeholder="Введите сообщение…"
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSend) (handleSend as () => void)();
            }}
            disabled={sending}
            className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:ring-white/30"
          />

          {/* Кнопки: Отправка / Микрофон */}
          {safeNew.trim().length > 0 ? (
            <Button
              onClick={handleSend}
              disabled={!canSend}
              className="px-4 bg-indigo-600 hover:bg-indigo-500 text-white"
              title="Отправить"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          ) : (
            <Button
              onClick={recActive ? useStopRec : useStartRec}
              onMouseDown={useStartRec}
              onMouseUp={useStopRec}
              onMouseLeave={() => recActive && useStopRec()}
              onTouchStart={useStartRec}
              onTouchEnd={useStopRec}
              className={`px-4 ${
                recActive
                  ? "bg-rose-600 hover:bg-rose-600"
                  : "bg-indigo-600 hover:bg-indigo-500"
              } text-white relative`}
              title={
                recActive
                  ? "Нажмите, чтобы остановить запись"
                  : "Нажмите/удерживайте для записи"
              }
            >
              {recActive ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              {recActive && (
                <span className="absolute -top-2 -right-2 text-[10px] bg-black/60 px-1 rounded">
                  {Math.floor(recTimeShow / 60)
                    .toString()
                    .padStart(2, "0")}
                  :
                  {(recTimeShow % 60).toString().padStart(2, "0")}
                </span>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PersonalMessages;
