// src/components/messages/PersonalMessages.tsx
// Обновлено: надёжный старт приватного диалога + автообновление списка
// + устранение дублей сообщений (склейка по tempId/temp_id и мягкая дедупликация)

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
  Play,
  Pause,
  X,
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
  id: number; // ВАЖНО: здесь — id диалога (conversation), не userId
  name: string;
  avatar?: string | null;
  lastMessage?: string | null;
  lastMessageTime?: string | null;
  lastMessageIsOwn?: boolean;
  lastMessageAttachmentKind?: "image" | "video" | "audio" | "file" | null;
  unreadCount?: number;
  isOnline?: boolean;
};

type AttachmentKind = "image" | "video" | "audio" | "file" | "";

type MessageApi = {
  id: number | string;
  room: number | string;
  author: number | string | null;
  author_id?: number | string | null;
  user?: number | string | null;
  user_id?: number | string | null;
  sender?: number | string | null;
  sender_id?: number | string | null;
  from_user?: number | string | null;
  from_user_id?: number | string | null;

  display_name?: string | null;
  username?: string | null;

  content: string;

  attachment?: string | null;
  attachment_url?: string | null;
  attachment_type?: "image" | "file" | "" | null;
  attachment_name?: string | null;

  created_at: string;

  meta?: {
    mime?: string;
    [k: string]: any;
  } | null;
};

type UIMessage = {
  id: string;
  authorId: string | null;
  username: string;
  content: string;
  createdAt: string;
  isOwn: boolean;

  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentKind?: AttachmentKind | null;
};

type FriendRequestItem = any;

type TabKey = "messages" | "friends";

/* ===================== Хелперы ===================== */

function getWsToken(): string {
  const anyHeaders: any = (apiClient as any).defaults?.headers;
  const authHeader: string | undefined =
    anyHeaders?.common?.Authorization || anyHeaders?.Authorization;
  if (authHeader) {
    const low = authHeader.toLowerCase();
    if (low.startsWith("bearer ") || low.startsWith("jwt ")) {
      return authHeader.split(" ", 2)[1].trim();
    }
  }
  const keys = [
    "humy:access",
    "authTokens",
    "access",
    "access_token",
    "jwt",
    "token",
    "jwt_access",
    "auth_token",
  ];
  for (const k of keys) {
    const v = localStorage.getItem(k) || sessionStorage.getItem(k);
    if (v) {
      try {
        const parsed = JSON.parse(v);
        if (parsed?.access) return String(parsed.access);
      } catch {
        return String(v).replace(/^"|"$/g, "");
      }
    }
  }
  const m = document.cookie.match(
    /(?:^|;\s*)(access|access_token|jwt|token)=([^;]+)/,
  );
  if (m) return decodeURIComponent(m[2]);
  return "";
}

const getUserIdFromJwt = (): string | null => {
  const token = getWsToken();
  if (!token || token.split(".").length < 2) return null;
  try {
    const payloadRaw = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(payloadRaw));
    if (json && (json.user_id !== undefined && json.user_id !== null)) {
      return String(json.user_id);
    }
  } catch {}
  return null;
};

const pickAuthorId = (msg: any): string | null => {
  const v =
    msg.author_id ??
    (typeof msg.author === "object" && msg.author ? msg.author.id : msg.author) ??
    msg.user_id ??
    msg.user ??
    msg.sender_id ??
    (typeof msg.sender === "object" && msg.sender ? msg.sender.id : msg.sender) ??
    msg.from_user_id ??
    (typeof msg.from_user === "object" && msg.from_user ? msg.from_user.id : msg.from_user) ??
    null;

  if (v === null || v === undefined) return null;
  try {
    return String(v);
  } catch {
    return null;
  }
};

const guessAttachmentKind = (
  attachmentUrl?: string | null,
  attachmentName?: string | null,
  mime?: string | null,
): AttachmentKind => {
  if (mime) {
    const m = mime.toLowerCase();
    if (m.startsWith("audio/")) return "audio";
    if (m.startsWith("video/")) return "video";
    if (m.startsWith("image/")) return "image";
  }
  const src = (attachmentUrl || attachmentName || "").toLowerCase();
  if (/\.(png|jpg|jpeg|webp|gif|bmp|avif)$/.test(src)) return "image";
  if (/\.(mp4|webm|mov|m4v|ogv)$/.test(src)) return "video";
  if (/\.(mp3|m4a|aac|ogg|opus|wav|webm)$/.test(src)) return "audio";
  return attachmentUrl ? "file" : "";
};

function mapApiToUi(m: MessageApi, currentUserId: string | null): UIMessage {
  const authorId = pickAuthorId(m);
  const username = m.display_name || m.username || "User";
  const isOwn =
    currentUserId !== null &&
    authorId !== null &&
    authorId === String(currentUserId);

  const mime = (m.meta as any)?.mime || null;
  const kind = guessAttachmentKind(m.attachment_url, m.attachment_name || "", mime);

  return {
    id: String(m.id),
    authorId,
    username,
    content: m.content || "",
    createdAt: m.created_at || new Date().toISOString(),
    isOwn,
    attachmentUrl: m.attachment_url || null,
    attachmentName: m.attachment_name || null,
    attachmentKind: kind,
  };
}

/* ====================== Лайтбокс ====================== */

type LightboxItem = { url: string; type: "image" | "video" };

const AttachmentLightbox: React.FC<{
  open: boolean;
  items: LightboxItem[];
  index: number;
  onClose: () => void;
}> = ({ open, items, index, onClose }) => {
  const [i, setI] = useState(index);
  useEffect(() => {
    if (open) setI(index);
  }, [open, index]);
  if (!open) return null;
  const curr = items[i];

  const prev = () => setI((n) => (n - 1 + items.length) % items.length);
  const next = () => setI((n) => (n + 1) % items.length);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center">
      <button
        aria-label="Закрыть"
        onClick={onClose}
        className="absolute top-3 right-3 text-white/80 hover:text-white text-2xl"
      >
        ×
      </button>

      {items.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-3xl"
            aria-label="Назад"
          >
            ‹
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white text-3xl"
            aria-label="Вперёд"
          >
            ›
          </button>
        </>
      )}

      {curr?.type === "image" ? (
        <img
          src={curr.url}
          className="max-w-[100vw] max-h-[100vh] object-contain"
        />
      ) : (
        <video
          src={curr.url}
          className="max-w-[100vw] max-h-[100vh]"
          controls
          autoPlay
          playsInline
        />
      )}
    </div>
  );
};

/* ===================== Аудио-компонент (с дорожкой) ===================== */

const formatMs = (sec: number) => {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(1, "0")}:${String(s).padStart(2, "0")}`;
};

const AudioMessage: React.FC<{
  id: string;           // id сообщения (чтобы останавливать другие)
  src: string;          // ссылка на аудио
  own: boolean;         // моё сообщение? — для подбора цвета
  label?: string;       // текст под дорожкой (опц.)
}> = ({ id, src, own, label }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [curr, setCurr] = useState(0);
  const [dur, setDur] = useState(0);

  // Останавливаем другие аудио при старте этого
  useEffect(() => {
    const onForeignPlay = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || detail.id !== id) {
        try {
          audioRef.current?.pause();
          setPlaying(false);
        } catch {}
      }
    };
    window.addEventListener("humy:audio-playing", onForeignPlay as any);
    return () =>
      window.removeEventListener("humy:audio-playing", onForeignPlay as any);
  }, [id]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (!playing) {
      try {
        // сообщаем всем остальным плеерам, что это аудио стартует
        window.dispatchEvent(
          new CustomEvent("humy:audio-playing", { detail: { id } }),
        );
      } catch {}
      a.play().catch(() => {});
    } else {
      a.pause();
    }
  };

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onLoaded = () => {
      setReady(true);
      setDur(a.duration || 0);
    };
    const onTime = () => setCurr(a.currentTime || 0);
    const onEnd = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    a.addEventListener("loadedmetadata", onLoaded);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    return () => {
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
    };
  }, []);

  const seek = (value: number) => {
    const a = audioRef.current;
    if (!a || !isFinite(value)) return;
    a.currentTime = value;
    setCurr(value);
  };

  const accent = own ? "#ffffff" : "#a78bfa"; // белый для своих, сиреневый для чужих
  const secondary = own ? "text-indigo-100/80" : "text-white/70";

  return (
    <div className="w-full max-w-[70vw]">
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          className={`inline-flex items-center justify-center w-9 h-9 rounded-full ${
            own ? "bg-white/20 hover:bg-white/25" : "bg-white/15 hover:bg-white/20"
          } transition`}
          title={playing ? "Пауза" : "Воспроизвести"}
        >
          {playing ? (
            <Pause className="w-5 h-5 text-white" />
          ) : (
            <Play className="w-5 h-5 text-white" />
          )}
        </button>

        {/* Дорожка */}
        <input
          type="range"
          min={0}
          max={isFinite(dur) && dur > 0 ? dur : 0}
          step={0.01}
          value={isFinite(curr) ? curr : 0}
          onChange={(e) => seek(Number(e.target.value))}
          style={{ accentColor: accent }}
          className="flex-1 h-2 rounded-full bg-white/20 outline-none"
        />

        {/* Время */}
        <div className={`ml-1 text-xs ${secondary} tabular-nums`}>
          {formatMs(curr)} / {formatMs(dur)}
        </div>
      </div>

      {label ? <div className="mt-1 text-sm">{label}</div> : null}

      <audio ref={audioRef} src={src} preload="metadata" />
    </div>
  );
};

/* ====================== Компонент пузыря ====================== */

const MessageBubble: React.FC<{
  msg: UIMessage;
  onOpenMedia: (items: LightboxItem[], index: number) => void;
}> = memo(({ msg, onOpenMedia }) => {
  const mine = msg.isOwn;
  const openLightboxSingle = () => {
    if (!msg.attachmentUrl) return;
    if (msg.attachmentKind === "image") {
      onOpenMedia([{ url: msg.attachmentUrl, type: "image" }], 0);
    } else if (msg.attachmentKind === "video") {
      onOpenMedia([{ url: msg.attachmentUrl, type: "video" }], 0);
    }
  };

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"} mb-2`}>
      <div className="max-w-[85%] sm:max-w-[70%] lg:max-w-[60%]">
        <div
          className={`px-3 sm:px-4 py-2 sm:py-3 rounded-2xl overflow-hidden whitespace-pre-wrap break-words relative ${
            mine
              ? "bg-indigo-600 text-white rounded-br-md shadow-lg"
              : "bg-white/10 text-white rounded-bl-md border border-white/20"
          }`}
          style={{ overflowWrap: "anywhere" }}
        >
          {/* Медиа: image/video */}
          {msg.attachmentUrl &&
            (msg.attachmentKind === "image" ||
              msg.attachmentKind === "video") && (
              <button
                type="button"
                onClick={openLightboxSingle}
                className="mt-1 block w-full max-w-[70vw] overflow-hidden rounded-2xl border border-white/10"
                title="Открыть на весь экран"
              >
                {msg.attachmentKind === "image" ? (
                  <img
                    src={msg.attachmentUrl}
                    alt={msg.attachmentName || "image"}
                    className="block w-full h-56 object-cover"
                  />
                ) : (
                  <video
                    src={msg.attachmentUrl}
                    className="block w-full h-56 object-cover"
                    muted
                    playsInline
                    controls
                  />
                )}
              </button>
            )}

          {/* Аудио — новый плеер с дорожкой */}
          {msg.attachmentUrl && msg.attachmentKind === "audio" && (
            <div className="mt-1">
              <AudioMessage
                id={msg.id}
                src={msg.attachmentUrl}
                own={mine}
                label={msg.content || undefined}
              />
            </div>
          )}

          {/* Файл */}
          {msg.attachmentUrl &&
            msg.attachmentKind === "file" && (
              <a
                href={msg.attachmentUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 flex items-center gap-2 px-3 py-2 bg-black/20 rounded-xl max-w-[70vw]"
              >
                <FileIcon className="w-4 h-4 opacity-80" />
                <span className="truncate">{msg.attachmentName || "Файл"}</span>
              </a>
            )}

          {/* Текст (если не аудио; у аудио текст уже ниже дорожки) */}
          {!msg.attachmentUrl && msg.content ? <div>{msg.content}</div> : null}

          <p
            className={`text-[10px] mt-1 text-right ${
              mine ? "text-indigo-200" : "text-gray-300"
            }`}
          >
            {new Date(msg.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>
    </div>
  );
});
MessageBubble.displayName = "MessageBubble";

/* =======================================================================
   ЭКСПОРТИРУЕМЫЙ КОМПОНЕНТ ЧАТА (его импортирует MainDashboard)
   ======================================================================= */
export const PersonalChatInterface: React.FC<{
  contact: Contact;
  onBack?: () => void;
}> = ({ contact, onBack }) => {
  const { user } = useUser() as any;

  const currentUserId: string | null = useMemo(() => {
    if (user?.id != null) return String(user.id);
    return getUserIdFromJwt();
  }, [user?.id]);

  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [input, setInput] = useState<string>("");

  const wsRef = useRef<WebSocket | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const lastRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Защита от повторной вставки server-id
  const seenIdsRef = useRef<Set<string>>(new Set());

  const [lbOpen, setLbOpen] = useState(false);
  const [lbItems, setLbItems] = useState<LightboxItem[]>([]);
  const [lbIndex, setLbIndex] = useState(0);

  const openLightbox = useCallback((items: LightboxItem[], index: number) => {
    setLbItems(items);
    setLbIndex(index);
    setLbOpen(true);
  }, []);
  const closeLightbox = useCallback(() => setLbOpen(false), []);

  const scrollToBottom = (behavior: ScrollBehavior = "auto") =>
    requestAnimationFrame(() =>
      lastRef.current?.scrollIntoView({ behavior }),
    );

  /* ---------- начальная загрузка ---------- */
  const loadInitial = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get("/api/messages/", {
        params: { room: contact.id, page_size: 30 },
      });
      const data: MessageApi[] = res.data?.results ?? res.data ?? [];
      const ui = data.map((m) => mapApiToUi(m, currentUserId));
      setMessages(ui.reverse());
    } catch {
      setMessages([]);
    } finally {
      setIsLoading(false);
      scrollToBottom("auto");
    }
  }, [contact.id, currentUserId]);

  useEffect(() => {
    setMessages([]);
    seenIdsRef.current.clear();
    loadInitial();
  }, [contact.id, loadInitial]);

  /* ---------- WebSocket ---------- */
  useEffect(() => {
    try {
      wsRef.current?.close();
    } catch {}
    wsRef.current = null;

    const base = (apiClient.defaults.baseURL || "http://127.0.0.1:8000/api/")
      .toString()
      .replace(/\/+$/, "");
    const baseURL = new URL(base, window.location.origin);
    const wsProto = baseURL.protocol === "https:" ? "wss" : "ws";
    const hostname =
      baseURL.hostname === "localhost" ? "127.0.0.1" : baseURL.hostname;
    const authority = baseURL.port ? `${hostname}:${baseURL.port}` : hostname;
    const token = getWsToken();

    const wsUrl = `${wsProto}://${authority}/ws/chat/${contact.id}/?token=${encodeURIComponent(
      token || "",
    )}`;

    let closedByClient = false;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      try {
        ws.send(JSON.stringify({ type: "ping" }));
        const joinPayloads = [
          { type: "subscribe", room: contact.id },
          { type: "join", room: contact.id },
          { type: "room:join", room: contact.id },
        ];
        for (const p of joinPayloads) ws.send(JSON.stringify(p));
      } catch {}
    };

    ws.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        const raw = payload?.data ?? payload;
        const type = (payload?.type ?? raw?.type ?? "").toString();

        const looksLikeChatMessage =
          /(^(chat\.)?message$|private\.message|room\.message)/i.test(type) ||
          (raw && raw.id != null && (raw.content != null || raw.attachment_url));

        if (type === "message" || looksLikeChatMessage) {
          const msgApi: MessageApi = raw as any;
          const ui = mapApiToUi(msgApi, currentUserId);

          const serverId = String(ui.id ?? "");
          if (serverId && seenIdsRef.current.has(serverId)) return;

          // возможные ключи эха временного id
          const tempEcho =
            (raw as any)?.tempId ||
            (raw as any)?.temp_id ||
            (raw as any)?.client_id ||
            (raw as any)?.clientId ||
            (raw as any)?.echo_id;

          setMessages((prev) => {
            // 1) Если пришёл tempEcho — заменить оптимистичное сообщение
            if (tempEcho) {
              const idx = prev.findIndex((m) => m.id === String(tempEcho));
              if (idx >= 0) {
                const copy = prev.slice();
                copy[idx] = ui;
                if (serverId) seenIdsRef.current.add(serverId);
                return copy;
              }
            }

            // 2) Если такое server-id уже есть — не добавлять
            if (serverId && prev.some((m) => m.id === serverId)) {
              seenIdsRef.current.add(serverId);
              return prev;
            }

            // 3) Мягкая дедупликация: моё сообщение, такой же текст и время близко (±10с)
            if (ui.isOwn && ui.content) {
              const now = new Date(ui.createdAt || Date.now()).getTime();
              const idxNear = prev.findIndex((m) =>
                m.isOwn &&
                !/^\d+$/.test(m.id) && // временное (не числовой id)
                (m.content || "").trim() === (ui.content || "").trim() &&
                Math.abs(new Date(m.createdAt).getTime() - now) < 10000
              );
              if (idxNear >= 0) {
                const copy = prev.slice();
                copy[idxNear] = ui;
                if (serverId) seenIdsRef.current.add(serverId);
                return copy;
              }
            }

            // 4) Обычная вставка
            if (serverId) seenIdsRef.current.add(serverId);
            return [...prev, ui];
          });

          // Сообщим левому списку о новом сообщении
          try {
            window.dispatchEvent(new CustomEvent("humy:new-message", {
              detail: {
                conversationId: contact.id,
                text: ui.content,
                created_at: ui.createdAt,
              }
            }));
          } catch {}

          const el = listRef.current;
          if (el) {
            const nearBottom =
              el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            if (nearBottom) scrollToBottom("smooth");
          }
        }
      } catch {}
    };

    ws.onclose = () => {
      wsRef.current = null;
      if (closedByClient) return;
      setTimeout(() => {
        if (!closedByClient) {
          try {
            const again = new WebSocket(wsUrl);
            wsRef.current = again;
          } catch {}
        }
      }, 1200);
    };

    ws.onerror = () => {
      try {
        ws.close();
      } catch {}
    };

    return () => {
      closedByClient = true;
      try {
        ws.close();
      } catch {}
    };
  }, [contact.id, currentUserId]);

  useEffect(() => {
    lastRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  /* ---------- отправка текста (WS + fallback HTTP) ---------- */

  const sendViaWS = useCallback((text: string, tempId: string): boolean => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    try {
      // отправляем два ключа эха — tempId и temp_id (совместимость)
      ws.send(JSON.stringify({ type: "message", content: text, tempId, temp_id: tempId }));
      return true;
    } catch {
      return false;
    }
  }, []);

  const postViaHTTP = useCallback(
    async (text: string) => {
      const res = await apiClient.post("/api/messages/", {
        room: contact.id,
        content: text,
      });
      const ui = mapApiToUi(res.data as MessageApi, currentUserId);
      setMessages((prev) => [...prev, ui]);

      try {
        window.dispatchEvent(new CustomEvent("humy:new-message", {
          detail: { conversationId: contact.id, text: ui.content, created_at: ui.createdAt }
        }));
      } catch {}

      scrollToBottom("smooth");
    },
    [contact.id, currentUserId],
  );

  const handleSend = useCallback(async () => {
    const text = (input || "").trim();
    if (!text) return;

    const tempId = `tmp-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const optimistic: UIMessage = {
      id: tempId,
      authorId: currentUserId,
      username:
        (user as any)?.nickname ||
        (user as any)?.display_name ||
        (user as any)?.username ||
        (user as any)?.email ||
        "User",
      content: text,
      createdAt: new Date().toISOString(),
      isOwn: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");

    const ok = sendViaWS(text, tempId);
    if (!ok) {
      try {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        await postViaHTTP(text);
      } catch {
        // можно показать toast
      }
    }
  }, [input, currentUserId, user, sendViaWS, postViaHTTP]);

  /* ---------- вложения ---------- */

  const onClickAttach = () => fileRef.current?.click();

  const uploadOneFile = async (file: File) => {
    const fd = new FormData();
    fd.append("room", String(contact.id));
    fd.append("content", "");
    fd.append("attachment", file);

    const res = await apiClient.post("/api/messages/", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    const ui = mapApiToUi(res.data as MessageApi, currentUserId);
    setMessages((prev) => [...prev, ui]);

    try {
      window.dispatchEvent(new CustomEvent("humy:new-message", {
        detail: { conversationId: contact.id, text: ui.content || "📎 Вложение", created_at: ui.createdAt }
      }));
    } catch {}

    scrollToBottom("smooth");
  };

  const onChangeFile: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    try {
      for (const f of files) await uploadOneFile(f);
    } catch {
      // toast
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  /* ---------- голосовые ---------- */

  const [isRecording, setIsRecording] = useState(false);
  const [recTime, setRecTime] = useState(0);
  const recTimerRef = useRef<number | null>(null);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);

  const stopTimer = () => {
    if (recTimerRef.current != null) {
      window.clearInterval(recTimerRef.current);
      recTimerRef.current = null;
    }
  };
  useEffect(
    () => () => {
      stopTimer();
      try {
        mediaRecRef.current?.stream?.getTracks().forEach((t) => t.stop());
      } catch {}
    },
    [],
  );

  const startRecording = async () => {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      mediaRecRef.current = rec;
      mediaChunksRef.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data && ev.data.size) mediaChunksRef.current.push(ev.data);
      };
      rec.onstop = async () => {
        try {
          const mime = rec.mimeType || "audio/webm";
          const blob = new Blob(mediaChunksRef.current, { type: mime });
          const file = new File([blob], `voice-${Date.now()}.webm`, {
            type: mime,
          });
          await uploadOneFile(file);
        } finally {
          try {
            stream.getTracks().forEach((t) => t.stop());
          } catch {}
        }
      };
      rec.start(100);
      setRecTime(0);
      setIsRecording(true);
      stopTimer();
      recTimerRef.current = window.setInterval(
        () => setRecTime((s) => s + 1),
        1000,
      );
    } catch {}
  };
  const stopRecording = () => {
    if (!isRecording) return;
    stopTimer();
    setIsRecording(false);
    try {
      mediaRecRef.current?.stop();
    } catch {}
  };

  /* =================== Рендер =================== */

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:p-4 bg-gradient-to-r from-indigo-600/50 to-purple-600/50 backdrop-blur-xl border-b border-white/20">
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          <button
            onClick={() =>
              onBack
                ? onBack()
                : window.dispatchEvent(new CustomEvent("humy:close-chat"))
            }
            className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
            aria-label="Назад"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
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
          <div className="min-w-0 flex-1">
            <h3 className="text-base sm:text-lg font-semibold text-white truncate">
              {contact.name}
            </h3>
            <p className="text-xs sm:text-sm text-gray-200 truncate">
              {contact.isOnline ? "Онлайн" : "Оффлайн"}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={listRef}
        className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 bg-gradient-to-b from-[#3b0b7a] to-[#16022b]"
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin mr-3" />
            <span className="text-gray-300">Загрузка…</span>
          </div>
        ) : messages.length > 0 ? (
          <>
            {messages.map((m) => (
              <MessageBubble key={m.id} msg={m} onOpenMedia={openLightbox} />
            ))}
          </>
        ) : (
          <div className="flex items-center justify-center py-8">
            <div className="text-center text-white/70">
              <MessageCircle className="w-12 h-12 mx-auto mb-4 text-white/30" />
              <p className="text-lg font-medium">Пока нет сообщений</p>
              <p className="text-sm">Начните переписку с {contact.name}</p>
            </div>
          </div>
        )}
        <div ref={lastRef} />
      </div>

      {/* Input */}
      <div className="p-3 sm:p-4 border-t border-white/10 bg-white/5 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <button
            onClick={onClickAttach}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Прикрепить файл"
          >
            <Paperclip className="w-5 h-5 text-white/80" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*,audio/*,.pdf,.zip,.rar,.7z,.doc,.docx,.xls,.xlsx,.txt"
            className="hidden"
            multiple
            onChange={onChangeFile}
          />

          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Введите сообщение…"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSend();
              }
            }}
            className="flex-1 bg-white/10 border-white/20 text-white placeholder:text白/60 focus:ring-white/30"
          />

          {input.trim().length === 0 ? (
            <>
              {!isRecording ? (
                <Button
                  onClick={startRecording}
                  className="px-4 bg-white/10 text-white"
                  title="Записать голосовое"
                >
                  <Mic className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  onClick={stopRecording}
                  className="px-4 bg-rose-600 hover:bg-rose-500 text-white"
                  title={`Остановить (${recTime}s)`}
                >
                  <Square className="w-4 h-4" />
                </Button>
              )}
            </>
          ) : (
            <Button
              onClick={handleSend}
              className="px-4 bg-indigo-600 hover:bg-indigo-500 text-white"
              title="Отправить"
            >
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>

        {isRecording && (
          <div className="mt-2 flex items-center gap-2 text-white/80 text-sm">
            <span className="text-green-400">●</span> Запись… {recTime}s
            <button
              onClick={() => {
                setInput("");
                setIsRecording(false);
              }}
              className="ml-auto inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-white/10 hover:bg-white/15"
            >
              <X className="w-3 h-3" />
              Отмена
            </button>
          </div>
        )}
      </div>

      {/* Лайтбокс */}
      <AttachmentLightbox
        open={lbOpen}
        items={lbItems}
        index={lbIndex}
        onClose={closeLightbox}
      />
    </div>
  );
};

/* =======================================================================
   Родитель «Личные сообщения»: список слева + чат справа
   ======================================================================= */

type PersonalMessagesProps = {
  selectedContact?: Contact | null;
  onSelectContact?: (c: Contact | null) => void;
};

const PersonalMessages: React.FC<PersonalMessagesProps> = memo(
  ({ selectedContact: externalSelected = null, onSelectContact }) => {
    const { user } = useUser();
    const userId = useMemo(
      () => (user?.id != null ? Number(user.id) : Number(getUserIdFromJwt())),
      [user?.id],
    );

    const [activeTab, setActiveTab] = useState<TabKey>("messages");

    // поиск
    const [searchQuery, setSearchQuery] = useState("");

    // диалоги
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [isLoadingContacts, setIsLoadingContacts] = useState(true);
    const [contactsError, setContactsError] = useState<string | null>(null);

    // друзья
    const [friends, setFriends] = useState<Contact[]>([]);
    const [isLoadingFriends, setIsLoadingFriends] = useState(false);
    const [friendsError, setFriendsError] = useState<string | null>(null);

    // заявки/модалки
    const [showRequestsModal, setShowRequestsModal] = useState(false);
    const [requests, setRequests] = useState<FriendRequestItem[]>([]);
    const [isLoadingRequests, setIsLoadingRequests] = useState(false);
    const [incomingCount, setIncomingCount] = useState(0);

    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [showAddFriendModal, setShowAddFriendModal] = useState(false);

    // выбранный диалог
    const [selectedContactLocal, setSelectedContactLocal] =
      useState<Contact | null>(externalSelected);
    useEffect(() => {
      if (externalSelected !== undefined) setSelectedContactLocal(externalSelected);
    }, [externalSelected]);
    const selectedContact = onSelectContact ? externalSelected : selectedContactLocal;

    const onBack = useCallback(() => {
      if (onSelectContact) onSelectContact(null);
      else setSelectedContactLocal(null);
    }, [onSelectContact]);

    useEffect(() => {
      const handler = () => onBack();
      window.addEventListener("humy:close-chat", handler);
      return () => window.removeEventListener("humy:close-chat", handler);
    }, [onBack]);

    /* ===== Загрузка диалогов (список) ===== */
    const loadContacts = useCallback(async () => {
      try {
        setIsLoadingContacts(true);
        setContactsError(null);
        const resp = await apiClient.get("api/conversations/");
        const list = Array.isArray(resp.data) ? resp.data : resp.data?.results || [];
        const transformed: Contact[] = list.map((conv: any) => {
          const cid = Number(conv.id ?? conv.conversation_id ?? conv.room_id ?? conv.room ?? conv.chat_id);
          const other = conv.other_user || conv.partner || conv.user;
          return {
            id: cid,
            name:
              other?.nickname || other?.username || conv.name || "Пользователь",
            avatar: other?.avatar || null,
            lastMessage:
              conv.last_message_text ?? conv.last_message ?? conv.last_text ?? null,
            lastMessageTime:
              conv.last_message_created_at ?? conv.updated_at ?? null,
            lastMessageIsOwn: undefined,
            lastMessageAttachmentKind: null,
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
    }, []);
    useEffect(() => {
      loadContacts();
    }, [loadContacts]);

    // обновление превью при событии из чата
    useEffect(() => {
      const handler = (e: any) => {
        const d = e?.detail || {};
        const id = Number(d.conversationId);
        if (!id) return;
        setContacts((prev) => {
          const idx = prev.findIndex((c) => c.id === id);
          if (idx === -1) return prev;
          const copy = prev.slice();
          copy[idx] = {
            ...copy[idx],
            lastMessage: d.text || copy[idx].lastMessage,
            lastMessageTime: d.created_at || new Date().toISOString(),
          };
          // Поднимаем диалог вверх
          const item = copy[idx];
          copy.splice(idx, 1);
          return [item, ...copy];
        });
      };
      window.addEventListener("humy:new-message", handler as any);
      return () => window.removeEventListener("humy:new-message", handler as any);
    }, []);

    /* ===== Друзья ===== */
    const loadFriends = useCallback(async () => {
      try {
        setFriendsError(null);
        setIsLoadingFriends(true);
        const resp = await apiClient.get("api/friends/");
        const arr = Array.isArray(resp.data) ? resp.data : resp.data?.results || [];
        const mapped: Contact[] = arr.map((u: any) => ({
          id: Number(u.id), // ВАЖНО: здесь id — это userId друга, не диалог!
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

    /* ===== Заявки в друзья ===== */
    const loadFriendRequests = useCallback(async () => {
      try {
        setIsLoadingRequests(true);
        const endpoints = [
          "api/friends/requests/",
          "api/friend-requests/",
        ];
        let data: any[] = [];
        for (const ep of endpoints) {
          try {
            const r = await apiClient.get(ep);
            const arr = Array.isArray(r.data) ? r.data : r.data?.results || [];
            if (arr.length) { data = arr; break; }
            data = arr;
          } catch {}
        }
        setRequests(data);
        const inCnt = data.filter((r: any) => (r.status ?? "pending") === "pending" && (r.to_user?.id === userId)).length;
        setIncomingCount(inCnt);
      } catch {
        setRequests([]);
        setIncomingCount(0);
      } finally {
        setIsLoadingRequests(false);
      }
    }, [userId]);

    const acceptRequest = useCallback(async (id: number) => {
      const tries = [
        () => apiClient.post(`api/friends/requests/${id}/accept/`, {}),
        () => apiClient.post(`api/friend-requests/${id}/accept/`, {}),
        () => apiClient.patch(`api/friends/requests/${id}/`, { status: "accepted" }),
      ];
      for (const fn of tries) {
        try { await fn(); await loadFriendRequests(); await loadFriends(); return; } catch {}
      }
      // ignore fail
    }, [loadFriendRequests, loadFriends]);

    const rejectRequest = useCallback(async (id: number) => {
      const tries = [
        () => apiClient.post(`api/friends/requests/${id}/reject/`, {}),
        () => apiClient.post(`api/friend-requests/${id}/reject/`, {}),
        () => apiClient.patch(`api/friends/requests/${id}/`, { status: "rejected" }),
      ];
      for (const fn of tries) {
        try { await fn(); await loadFriendRequests(); return; } catch {}
      }
    }, [loadFriendRequests]);

    useEffect(() => {
      if (showRequestsModal) loadFriendRequests();
    }, [showRequestsModal, loadFriendRequests]);

    /* ===== Фильтры ===== */
    const filteredContacts = useMemo(
      () =>
        contacts.filter((c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()),
        ),
      [contacts, searchQuery],
    );
    const filteredFriends = useMemo(
      () =>
        friends.filter((c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()),
        ),
      [friends, searchQuery],
    );

    /* ======= ВАЖНО: гарантированное открытие/создание приватного диалога ======= */

    // пробуем разные эндпоинты/поля, чтобы получить (или создать) диалог и вернуть его id
    const ensureConversationWithUser = useCallback(async (otherUserId: number): Promise<number> => {
      // 1) сначала пытаемся найти уже существующий
      const findTries: Array<() => Promise<any>> = [
        () => apiClient.get(`api/conversations/with/${otherUserId}/`),
        () => apiClient.get(`api/conversations/`, { params: { user_id: otherUserId } }),
        () => apiClient.get(`api/conversations/`, { params: { user: otherUserId } }),
        () => apiClient.get(`api/private-chats/`, { params: { user_id: otherUserId } }),
        () => apiClient.get(`api/dialogs/`, { params: { user_id: otherUserId } }),
      ];

      const extractId = (data: any): number | null => {
        if (!data) return null;
        const item = Array.isArray(data?.results) ? data.results[0] : (Array.isArray(data) ? data[0] : data);
        if (!item) return null;
        const id = item.id ?? item.conversation_id ?? item.room_id ?? item.room ?? item.chat_id;
        return id != null ? Number(id) : null;
      };

      for (const call of findTries) {
        try {
          const r = await call();
          const id = extractId(r.data);
          if (id) return id;
        } catch {}
      }

      // 2) если не нашли — создаём
      const bodies = [
        { user_id: otherUserId },
        { user: otherUserId },
        { participant_id: otherUserId },
        { to_user_id: otherUserId },
        { friend_id: otherUserId },
      ];
      const createEndpoints = [
        "api/conversations/",
        "api/conversations/start/",
        "api/private-chats/",
        "api/dialogs/",
      ];

      for (const ep of createEndpoints) {
        for (const body of bodies) {
          try {
            const r = await apiClient.post(ep, body);
            const id = extractId(r.data);
            if (id) return id;
          } catch {}
        }
      }

      throw new Error("Не удалось открыть или создать приватный диалог");
    }, []);

    const openChatWithFriend = useCallback(
      async (friend: Contact) => {
        try {
          // Здесь friend.id — это userId друга!
          const conversationId = await ensureConversationWithUser(friend.id);
          const selected: Contact = {
            id: conversationId, // ВАЖНО: устанавливаем id диалога
            name: friend.name,
            avatar: friend.avatar,
            isOnline: friend.isOnline,
          };
          if (onSelectContact) onSelectContact(selected);
          else setSelectedContactLocal(selected);
        } catch (e) {
          // Покажем ошибку в шапке списка
          setContactsError("Не удалось открыть чат. Попробуйте ещё раз.");
        }
      },
      [ensureConversationWithUser, onSelectContact],
    );

    /* ===== Модалка "Добавить в друзья" ===== */
    const AddFriendModal: React.FC<{
      open: boolean;
      onClose: () => void;
    }> = ({ open, onClose }) => {
      const [q, setQ] = useState("");
      const [loading, setLoading] = useState(false);
      const [items, setItems] = useState<any[]>([]);
      const [error, setError] = useState<string | null>(null);

      const doSearch = async () => {
        if (!q.trim()) return;
        setLoading(true); setError(null);
        const endpoints = [
          (qq: string) => apiClient.get("api/users/search/", { params: { q: qq } }),
          (qq: string) => apiClient.get("api/users/", { params: { search: qq, q: qq } }),
          (qq: string) => apiClient.get("api/search/users/", { params: { q: qq } }),
          (qq: string) => apiClient.get("api/friends/search_users/", { params: { q: qq } }),
        ];
        for (const call of endpoints) {
          try {
            const r = await call(q.trim());
            const arr = Array.isArray(r.data) ? r.data : r.data?.results || [];
            const norm = arr.map((u: any) => ({
              id: Number(u.id ?? u.user_id ?? u.pk),
              nickname: u.nickname || u.username || u.display_name || `ID ${u.id ?? u.user_id ?? u.pk}`,
              avatar: u.avatar || null,
            }));
            setItems(norm);
            setLoading(false);
            return;
          } catch {}
        }
        setItems([]);
        setError("Не удалось найти пользователей");
        setLoading(false);
      };

      const sendFriendRequest = async (uid: number) => {
        const tries = [
          () => apiClient.post("api/friends/requests/", { to_user_id: uid }),
          () => apiClient.post("api/friends/requests/", { to_user: uid }),
          () => apiClient.post("api/friends/request/", { to_user_id: uid }),
          () => apiClient.post("api/friends/add/", { user_id: uid }),
          () => apiClient.post("api/friends/add/", { friend_id: uid }),
        ];
        for (const fn of tries) {
          try { await fn(); onClose(); return; } catch (e: any) {
            const st = e?.response?.status;
            const data = e?.response?.data;
            if (st === 409 || (st === 400 && /already|exists|уже|duplicate/i.test(JSON.stringify(data || "")))) {
              onClose(); return;
            }
          }
        }
        // ignore
      };

      if (!open) return null;
      return (
        <div className="fixed inset-0 z-[200000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-white/10 text-white">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Добавить в друзья</h3>
              <Button variant="ghost" size="sm" onClick={onClose}>
                Закрыть
              </Button>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex gap-2">
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Никнейм…"
                  className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:ring-white/30"
                  leftIcon={<Search />}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); doSearch(); } }}
                />
                <Button onClick={doSearch} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                  Найти
                </Button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="ml-2 text-white/80">Поиск…</span>
                </div>
              ) : error ? (
                <div className="text-white/70">{error}</div>
              ) : items.length === 0 ? (
                <div className="text-white/60">Введите никнейм и нажмите «Найти»</div>
              ) : (
                <ul className="space-y-2">
                  {items.map((u) => (
                    <li key={u.id} className="flex items-center justify-between rounded-xl border border-white/10 p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 flex items-center justify-center">
                          {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover" /> : <User className="w-5 h-5" />}
                        </div>
                        <div className="font-medium">{u.nickname}</div>
                      </div>
                      <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white" onClick={() => sendFriendRequest(u.id)}>
                        <UserPlus className="w-4 h-4 mr-1" /> Добавить
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className="flex h-full rounded-2xl overflow-hidden">
        {/* Список слева */}
        <div
          className={`w-full md:w-80 border-r flex flex-col backdrop-blur ${
            selectedContact ? "hidden md:flex" : "flex"
          } bg-white/5 border-white/10`}
        >
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="inline-flex p-1 rounded-xl bg-white/10">
                <button
                  className={`px-3 py-1.5 rounded-lg text-sm transition ${
                    activeTab === "messages"
                      ? "bg-white text-black"
                      : "text-white/80 hover:bg白/10"
                  }`}
                  onClick={() => setActiveTab("messages")}
                >
                  Сообщения
                </button>
                <button
                  className={`px-3 py-1.5 rounded-lg text-sm transition ${
                    activeTab === "friends"
                      ? "bg-white text-black"
                      : "text-white/80 hover:bg白/10"
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
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-[11px] font-semibold text-white flex items-center justify-center">
                        {incomingCount > 99 ? "99+" : incomingCount}
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
                onSelect={(c) =>
                  onSelectContact ? onSelectContact(c) : setSelectedContactLocal(c)
                }
                formatTime={(ts) =>
                  ts ? new Date(ts).toLocaleDateString() : ""
                }
              />
            ) : (
              <FriendsList
                friends={filteredFriends}
                loading={isLoadingFriends}
                error={friendsError}
                onRetry={loadFriends}
                onOpenChat={openChatWithFriend}
                onRemove={() => {}}
                onBlock={() => {}}
              />
            )}
          </div>
        </div>

        {/* Правая часть — чат */}
        <div
          className={`flex-1 ${
            selectedContact ? "flex" : "hidden md:flex"
          } flex-col bg-white/5 border-l border-white/10 backdrop-blur`}
        >
          {selectedContact ? (
            <PersonalChatInterface contact={selectedContact} onBack={onBack} />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-white/70">
                <MessageCircle className="w-16 h-16 mx-auto mb-4 text_white/30" />
                <h3 className="text-lg font-medium">Выберите диалог</h3>
                <p className="text-sm">
                  Выберите контакт слева, чтобы открыть переписку
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Модалка заявок */}
        {showRequestsModal && (
          <FriendRequestsModal
            tab={"incoming" as any}
            setTab={() => {}}
            requests={requests}
            loading={isLoadingRequests}
            onAccept={acceptRequest}
            onReject={rejectRequest}
            onClose={() => setShowRequestsModal(false)}
          />
        )}

        {/* Модалка «Добавить в друзья» */}
        <AddFriendModal open={showNewChatModal /* не удаляем, если использовалось */ ? false : false} onClose={() => {}} />
        <AddFriendModal open={showAddFriendModal} onClose={() => setShowAddFriendModal(false)} />
      </div>
    );
  },
);
PersonalMessages.displayName = "PersonalMessages";

export default PersonalMessages;
