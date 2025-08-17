import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  memo,
} from 'react';
import {
  ArrowLeft,
  Send,
  Smile,
  Paperclip,
  MoreVertical,
  Loader2,
  Info,
  File as FileIcon,
  Mic,
  Trash2,
  EyeOff,
  X,
  CheckCircle2,
} from 'lucide-react';
import apiClient from '../../api/instance';
import { useUser } from '../../contexts/UserContext';

/* ====================== Типы ====================== */

type MessageApi = {
  id: number | string;
  room: number | string;
  author: number | string | null;
  author_id?: number | string | null;
  user?: number | string | null;
  user_id?: number | string | null;
  display_name?: string | null;
  username?: string | null;

  content: string;

  attachment?: string | null;
  attachment_url?: string | null;
  attachment_type?: 'image' | 'file' | '' | null;
  attachment_name?: string | null;

  created_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;

  // ДОБАВЛЕНО: meta (приходит из бэкенда, где мы кладём mime)
  meta?: {
    mime?: string;
    [k: string]: any;
  } | null;
};

type AttachmentKind = 'image' | 'video' | 'audio' | 'file' | '';

type UIMessage = {
  id: string;
  room: string;
  authorId: string | null;
  username: string;
  content: string;

  attachmentUrl?: string | null;
  attachmentType?: 'image' | 'file' | '' | null;
  attachmentKind?: AttachmentKind;
  attachmentName?: string | null;

  createdAt: string;
  isOwn: boolean;
};

type RoomInfo = {
  id: string | number;
  country: string;
  region?: string;
  city: string;
  interest: string;
  participantCount: number;
};

type Props = {
  roomInfo: RoomInfo;
  onBack: () => void;
};

/* ====================== Helpers ====================== */

const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

const extractCursor = (url?: string | null): string | null => {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.searchParams.get('cursor');
  } catch {
    const m = url.match(/[?&]cursor=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }
};

function getWsToken(): string {
  const anyHeaders: any = (apiClient as any).defaults?.headers;
  const authHeader: string | undefined =
    anyHeaders?.common?.Authorization || anyHeaders?.Authorization;
  if (authHeader) {
    const low = authHeader.toLowerCase();
    if (low.startsWith('bearer ') || low.startsWith('jwt ')) {
      return authHeader.split(' ', 2)[1].trim();
    }
  }
  const keys = [
    'authTokens',
    'access',
    'access_token',
    'jwt',
    'token',
    'jwt_access',
    'auth_token',
  ];
  for (const k of keys) {
    const v =
      localStorage.getItem(k) ||
      sessionStorage.getItem(k);
    if (v) {
      try {
        const parsed = JSON.parse(v);
        if (parsed?.access) return String(parsed.access);
      } catch {
        return v.replace(/^"|"$/g, '');
      }
    }
  }
  const m = document.cookie.match(
    /(?:^|;\s*)(access|access_token|jwt|token)=([^;]+)/,
  );
  if (m) return decodeURIComponent(m[2]);
  return '';
}

const getUserIdFromJwt = (): string | null => {
  const token = getWsToken();
  if (!token || token.split('.').length < 2) return null;
  try {
    const payloadRaw = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(atob(payloadRaw));
    if (json && (json.user_id !== undefined && json.user_id !== null)) {
      return String(json.user_id);
    }
  } catch {
    // ignore
  }
  return null;
};

const pickAuthorId = (msg: any): string | null => {
  const v =
    msg.author_id ??
    (typeof msg.author === 'object' && msg.author ? msg.author.id : msg.author) ??
    msg.user_id ??
    msg.user ??
    null;

  if (v === null || v === undefined) return null;
  try {
    return String(v);
  } catch {
    return null;
  }
};

// !!! ИЗМЕНЕНО: теперь учитываем meta.mime (audio/*|video/*|image/*) прежде, чем смотреть на расширение.
const guessAttachmentKind = (
  attachmentUrl?: string | null,
  attachmentType?: string | null,
  attachmentName?: string | null,
  mime?: string | null,
): AttachmentKind => {
  const url = (attachmentUrl || '').toLowerCase();
  const name = (attachmentName || '').toLowerCase();
  const src = url || name;

  // 1) Если сервер прислал MIME — верим ему.
  if (mime) {
    const m = mime.toLowerCase();
    if (m.startsWith('audio/')) return 'audio';
    if (m.startsWith('video/')) return 'video';
    if (m.startsWith('image/')) return 'image';
  }

  // 2) Явная метка image от сервера.
  if (attachmentType === 'image') return 'image';

  // 3) Эвристика по расширению (fallback для старых сообщений без meta.mime).
  const isImg =
    src.endsWith('.png') ||
    src.endsWith('.jpg') ||
    src.endsWith('.jpeg') ||
    src.endsWith('.webp') ||
    src.endsWith('.gif') ||
    src.endsWith('.bmp') ||
    src.endsWith('.avif');
  if (isImg) return 'image';

  // Важно: .webm может быть и аудио, и видео.
  // Без MIME лучше предпочесть «видео», но мы хотим, чтобы новые голосовые (webm/opus) отображались как аудио.
  // Для новых сообщений у нас уже есть meta.mime, поэтому ниже — обычный порядок:
  const isAud =
    src.endsWith('.mp3') ||
    src.endsWith('.m4a') ||
    src.endsWith('.aac') ||
    src.endsWith('.ogg') ||
    src.endsWith('.opus') ||
    src.endsWith('.wav') ||
    src.endsWith('.webm'); // если нет mime — допустим аудио
  if (isAud) return 'audio';

  const isVid =
    src.endsWith('.mp4') ||
    src.endsWith('.webm') ||
    src.endsWith('.mov') ||
    src.endsWith('.m4v') ||
    src.endsWith('.ogv');
  if (isVid) return 'video';

  // 4) Если есть URL, но тип не распознан — считаем файлом.
  if (attachmentUrl) return 'file';
  return '';
};

function mapApiToUi(m: MessageApi, currentUserId: string | null): UIMessage {
  const authorId = pickAuthorId(m);
  const username =
    m.display_name || m.username || 'User';

  const isOwn =
    currentUserId !== null &&
    authorId !== null &&
    authorId === String(currentUserId);

  const mime = (m.meta as any)?.mime || null;
  const kind = guessAttachmentKind(
    m.attachment_url,
    m.attachment_type || '',
    m.attachment_name || '',
    mime,
  );

  return {
    id: String(m.id),
    room: String(m.room),
    authorId,
    username,
    content: m.content || '',
    attachmentUrl: m.attachment_url || null,
    attachmentType: (m.attachment_type as any) || '',
    attachmentKind: kind,
    attachmentName: m.attachment_name || '',
    createdAt: m.created_at || new Date().toISOString(),
    isOwn,
  };
}

/* ====================== Лайтбокс ====================== */

type LightboxItem = { url: string; type: 'image' | 'video' };

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

      {curr?.type === 'image' ? (
        <img src={curr.url} className="max-w-[100vw] max-h-[100vh] object-contain" />
      ) : (
        <video src={curr.url} className="max-w-[100vw] max-h-[100vh]" controls autoPlay playsInline />
      )}
    </div>
  );
};

/* ====================== Пузырь сообщения (с выбором) ====================== */

type BubbleProps = {
  msg: UIMessage;
  selectionMode: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onRequestSelectStart: (id: string) => void;
  onOpenMedia: (items: LightboxItem[], index: number) => void;
};

const MessageBubble: React.FC<BubbleProps> = memo(
  ({ msg, selectionMode, selected, onToggleSelect, onRequestSelectStart, onOpenMedia }) => {
    const mine = msg.isOwn;

    const previewContainerCls =
      'mt-2 block w-full max-w-[70vw] overflow-hidden rounded-2xl border border-white/10';
    const previewMediaCls = 'block w-full h-56 object-cover';

    const openLightboxSingle = () => {
      if (!msg.attachmentUrl || selectionMode) return;
      if (msg.attachmentKind === 'image') {
        onOpenMedia([{ url: msg.attachmentUrl, type: 'image' }], 0);
      } else if (msg.attachmentKind === 'video') {
        onOpenMedia([{ url: msg.attachmentUrl, type: 'video' }], 0);
      }
    };

    // Лонг-тап / правый клик для входа в режим выбора
    const pressTimer = useRef<number | null>(null);

    const startPress = () => {
      if (selectionMode) return;
      pressTimer.current = window.setTimeout(() => {
        onRequestSelectStart(msg.id);
      }, 400);
    };
    const cancelPress = () => {
      if (pressTimer.current) {
        window.clearTimeout(pressTimer.current);
        pressTimer.current = null;
      }
    };

    return (
      <div
        className={`flex ${mine ? 'justify-end' : 'justify-start'} mb-2`}
        onContextMenu={(e) => {
          e.preventDefault();
          onRequestSelectStart(msg.id);
        }}
        onMouseDown={startPress}
        onMouseUp={cancelPress}
        onMouseLeave={cancelPress}
        onTouchStart={startPress}
        onTouchEnd={cancelPress}
        onTouchMove={cancelPress}
      >
        <div className="max-w-[85%] sm:max-w-[70%] lg:max-w-[60%] relative">
          {!mine && (
            <div className="flex items-center space-x-2 mb-1">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                {getInitials(msg.username)}
              </div>
              <span className="text-xs sm:text-sm text-gray-300 font-medium truncate">
                {msg.username}
              </span>
            </div>
          )}

          <div
            className={`px-3 sm:px-4 py-2 sm:py-3 rounded-2xl overflow-hidden whitespace-pre-wrap break-words break-all relative ${
              mine
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-md shadow-lg hover:shadow-xl transition-shadow duration-200'
                : 'bg-white/10 backdrop-blur-sm text-white rounded-bl-md border border-white/20 hover:bg-white/15 transition-all duration-200'
            } ${selected ? 'ring-2 ring-indigo-400' : ''}`}
            style={{ overflowWrap: 'anywhere' }}
            onClick={() => {
              if (selectionMode) {
                onToggleSelect(msg.id);
              }
            }}
          >
            {/* Галочка выбора */}
            {selectionMode && (
              <div className="absolute -top-2 -right-2">
                <span
                  className={`inline-flex items-center justify-center rounded-full ${
                    selected ? 'text-indigo-400' : 'text-white/40'
                  }`}
                >
                  <CheckCircle2 className="w-5 h-5" />
                </span>
              </div>
            )}

            {/* Медиа: изображение/видео */}
            {msg.attachmentUrl &&
              (msg.attachmentKind === 'image' || msg.attachmentKind === 'video') && (
                <button
                  type="button"
                  onClick={openLightboxSingle}
                  className={previewContainerCls}
                  title="Открыть на весь экран"
                >
                  {msg.attachmentKind === 'image' ? (
                    <img
                      src={msg.attachmentUrl}
                      alt={msg.attachmentName || 'image'}
                      className={previewMediaCls}
                    />
                  ) : (
                    <video
                      src={msg.attachmentUrl}
                      className={previewMediaCls}
                      muted
                      playsInline
                      controls
                    />
                  )}
                </button>
              )}

            {/* Аудио: теперь всегда <audio controls> */}
            {msg.attachmentUrl && msg.attachmentKind === 'audio' && (
              <div className="mt-2 w-full max-w-[70vw]">
                <audio src={msg.attachmentUrl} controls preload="metadata" className="w-full" />
                {msg.content ? <div className="mt-1">{msg.content}</div> : null}
              </div>
            )}

            {/* Файлы */}
            {msg.attachmentUrl && msg.attachmentKind === 'file' && (
              <a
                href={msg.attachmentUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 flex items-center gap-2 px-3 py-2 bg-black/20 rounded-xl max-w-[70vw]"
                onClick={(e) => {
                  if (selectionMode) {
                    e.preventDefault();
                    onToggleSelect(msg.id);
                  }
                }}
              >
                <FileIcon className="w-4 h-4 opacity-80" />
                <span className="truncate">{msg.attachmentName || 'Файл'}</span>
              </a>
            )}

            {/* Текст */}
            {!msg.attachmentUrl && msg.content ? (
              <div>{msg.content}</div>
            ) : msg.attachmentUrl && msg.content && msg.attachmentKind !== 'audio' ? (
              <div className="mt-2">{msg.content}</div>
            ) : null}

            <p
              className={`text-[10px] mt-1 text-right ${
                mine ? 'text-indigo-200' : 'text-gray-400'
              }`}
            >
              {new Date(msg.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        </div>
      </div>
    );
  },
);
MessageBubble.displayName = 'MessageBubble';

/* ====================== Основной компонент ====================== */

const ChatInterface: React.FC<Props> = ({ roomInfo, onBack }) => {
  const { user } = useUser() as any;

  const currentUserId: string | null = useMemo(() => {
    if (user?.id != null) return String(user.id);
    return getUserIdFromJwt();
  }, [user?.id]);

  const myDisplayName: string = useMemo(() => {
    const name =
      user?.nickname ||
      user?.display_name ||
      user?.username ||
      user?.email ||
      'User';
    return String(name).slice(0, 64);
  }, [user]);

  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState<boolean>(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [hint, setHint] = useState<string | null>(null);

  const [input, setInput] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);

  const [wsReady, setWsReady] = useState<boolean>(false);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [participantCount, setParticipantCount] = useState<number>(
    Number(roomInfo.participantCount || 0),
  );

  // режим выбора и набор выбранных сообщений
  const [selectionMode, setSelectionMode] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const lastRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const typingTimeout = useRef<number | null>(null);

  const [lbOpen, setLbOpen] = useState(false);
  const [lbItems, setLbItems] = useState<LightboxItem[]>([]);
  const [lbIndex, setLbIndex] = useState(0);

  const openLightbox = useCallback((items: LightboxItem[], index: number) => {
    setLbItems(items);
    setLbIndex(index);
    setLbOpen(true);
  }, []);
  const closeLightbox = useCallback(() => setLbOpen(false), []);

  /* ---------- начальная загрузка ---------- */
  const loadInitial = useCallback(async () => {
    setIsLoading(true);
    setHint(null);
    try {
      const res = await apiClient.get('/api/messages/', {
        params: { room: roomInfo.id, page_size: 30 },
      });
      const data: MessageApi[] = res.data?.results ?? res.data ?? [];
      const ui = data.map((m) => mapApiToUi(m, currentUserId));
      setMessages(ui.reverse());
      setCursor(extractCursor(res.data?.next));
      setHasMore(Boolean(res.data?.next));
    } catch {
      setHint('Не удалось загрузить сообщения');
    } finally {
      setIsLoading(false);
      requestAnimationFrame(() => lastRef.current?.scrollIntoView({ behavior: 'auto' }));
    }
  }, [roomInfo.id, currentUserId]);

  useEffect(() => {
    setMessages([]);
    setCursor(null);
    setHasMore(true);
    setIsLoading(true);
    setSelectionMode(false);
    setSelectedIds([]);
    loadInitial();
  }, [roomInfo.id, loadInitial]);

  /* ---------- пагинация вверх ---------- */
  const loadOlder = useCallback(async () => {
    if (!cursor || isLoadingOlder) return;
    const el = listRef.current;
    const prevScrollTop = el?.scrollTop ?? 0;
    const prevScrollHeight = el?.scrollHeight ?? 0;
    try {
      setIsLoadingOlder(true);
      const res = await apiClient.get(
        `/api/messages/?room=${roomInfo.id}&cursor=${encodeURIComponent(cursor)}`,
      );
      const data: MessageApi[] = res.data?.results ?? res.data ?? [];
      const olderAsc = data.map((m) => mapApiToUi(m, currentUserId)).reverse();

      setMessages((prev) => [...olderAsc, ...prev]);

      const nextCur = extractCursor(res.data?.next);
      setCursor(nextCur);
      setHasMore(Boolean(nextCur));

      requestAnimationFrame(() => {
        const el2 = listRef.current;
        if (!el2) return;
        const newHeight = el2.scrollHeight;
        el2.scrollTop = newHeight - prevScrollHeight + prevScrollTop;
      });
    } catch {
      // ignore
    } finally {
      setIsLoadingOlder(false);
    }
  }, [cursor, isLoadingOlder, roomInfo.id, currentUserId]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollTop < 60 && hasMore && !isLoadingOlder) {
        loadOlder();
      }
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [hasMore, isLoadingOlder, loadOlder]);

  /* ---------- WebSocket ---------- */
  useEffect(() => {
    setWsReady(false);
    try {
      wsRef.current?.close();
    } catch {}
    wsRef.current = null;

    const base = (apiClient.defaults.baseURL || 'http://127.0.0.1:8000/api/')
      .toString()
      .replace(/\/+$/, '');
    const baseURL = new URL(base, window.location.origin);
    const wsProto = baseURL.protocol === 'https:' ? 'wss' : 'ws';
    const hostname =
      baseURL.hostname === 'localhost' ? '127.0.0.1' : baseURL.hostname;
    const authority = baseURL.port ? `${hostname}:${baseURL.port}` : hostname;
    const token = getWsToken();

    const wsUrl = `${wsProto}://${authority}/ws/chat/${roomInfo.id}/?token=${encodeURIComponent(
      token || '',
    )}`;

    let closedByClient = false;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsReady(true);
      setHint(null);
      try {
        ws.send(JSON.stringify({ type: 'ping' }));
      } catch {}
    };

    ws.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (!payload) return;

        const raw = payload.data ?? payload;
        const type = payload.type ?? raw?.type;

        if (type === 'message') {
          const msgApi: MessageApi = raw as any;
          const ui = mapApiToUi(msgApi, currentUserId);

          const tempId = (raw as any)?.tempId;
          setMessages((prev) => {
            if (tempId) {
              const idx = prev.findIndex((m) => m.id === String(tempId));
              if (idx >= 0) {
                const copy = prev.slice();
                copy[idx] = ui;
                return copy;
              }
            }
            if (prev.some((m) => m.id === ui.id)) return prev;
            return [...prev, ui];
          });

          const el = listRef.current;
          if (el) {
            const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            if (nearBottom) {
              requestAnimationFrame(() => {
                el.scrollTop = el.scrollHeight;
              });
            }
          }
        } else if (type === 'typing') {
          setIsTyping(Boolean((raw as any)?.isTyping));
          setTimeout(() => setIsTyping(false), 1200);
        } else if (type === 'presence') {
          const count = Number((raw as any)?.count ?? 0);
          setParticipantCount(count);
        } else if (type === 'delete') {
          const idToRemove = String((raw as any)?.id ?? '');
          if (idToRemove) {
            setMessages((prev) => prev.filter((m) => m.id !== idToRemove));
            setSelectedIds((prev) => prev.filter((id) => id !== idToRemove));
          }
        }
      } catch {
        // ignore
      }
    };

    ws.onclose = (e) => {
      setWsReady(false);
      wsRef.current = null;
      if (closedByClient) return;
      if (e.code === 4401) {
        setHint('Требуется авторизация для подключения к чату.');
        return;
      }
      setHint('Соединение потеряно. Переподключаем…');
      setTimeout(() => {
        if (!closedByClient) {
          const again = new WebSocket(wsUrl);
          wsRef.current = again;
        }
      }, 1500);
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
  }, [roomInfo.id, currentUserId]);

  useEffect(() => {
    setMessages((prev) =>
      prev.map((m) => ({
        ...m,
        isOwn:
          currentUserId !== null &&
          m.authorId !== null &&
          m.authorId === String(currentUserId),
      })),
    );
  }, [currentUserId]);

  useEffect(() => {
    lastRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  /* ---------- отправка текста ---------- */

  const sendViaWS = useCallback(
    (text: string, tempId: string): boolean => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return false;
      try {
        ws.send(
          JSON.stringify({
            type: 'message',
            content: text,
            tempId,
          }),
        );
        return true;
      } catch {
        return false;
      }
    },
    [],
  );

  const postViaHTTP = useCallback(
    async (text: string) => {
      const res = await apiClient.post('/api/messages/', {
        room: roomInfo.id,
        content: text,
      });
      const ui = mapApiToUi(res.data as MessageApi, currentUserId);
      setMessages((prev) => [...prev, ui]);
      requestAnimationFrame(() => lastRef.current?.scrollIntoView({ behavior: 'smooth' }));
    },
    [roomInfo.id, currentUserId],
  );

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    setSending(true);

    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: UIMessage = {
      id: tempId,
      room: String(roomInfo.id),
      authorId: currentUserId,
      username: myDisplayName,
      content: text,
      createdAt: new Date().toISOString(),
      isOwn: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput('');

    const ok = sendViaWS(text, tempId);
    if (!ok) {
      try {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        await postViaHTTP(text);
      } catch {
        setHint('Не удалось отправить сообщение');
      }
    }
    setSending(false);
  }, [input, roomInfo.id, currentUserId, myDisplayName, sendViaWS, postViaHTTP]);

  /* ---------- typing ---------- */

  const onChangeInput: React.ChangeEventHandler<HTMLTextAreaElement> = (e) => {
    const val = e.target.value;
    setInput(val);
    if (!wsReady) return;
    try {
      wsRef.current?.send(JSON.stringify({ type: 'typing', isTyping: true }));
      if (typingTimeout.current) window.clearTimeout(typingTimeout.current);
      typingTimeout.current = window.setTimeout(() => {
        wsRef.current?.send(JSON.stringify({ type: 'typing', isTyping: false }));
      }, 1000);
    } catch {}
  };

  /* ---------- вложения (мультизагрузка) ---------- */

  const onClickAttach = () => fileRef.current?.click();

  const uploadOneFile = async (file: File) => {
    const fd = new FormData();
    fd.append('room', String(roomInfo.id));
    fd.append('content', '');
    fd.append('attachment', file);

    const res = await apiClient.post('/api/messages/', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const ui = mapApiToUi(res.data as MessageApi, currentUserId);
    setMessages((prev) => [...prev, ui]);
    requestAnimationFrame(() => lastRef.current?.scrollIntoView({ behavior: 'smooth' }));
  };

  const onChangeFile: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setSending(true);
    try {
      for (const file of files) {
        await uploadOneFile(file);
      }
    } catch {
      setHint('Не удалось загрузить файл(ы)');
    } finally {
      setSending(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  /* ---------- выбор сообщений ---------- */

  const enterSelectionWith = (id: string) => {
    setSelectionMode(true);
    setSelectedIds([id]);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const clearSelection = () => {
    setSelectionMode(false);
    setSelectedIds([]);
  };

  const selectedOwnOnly = useMemo(() => {
    if (!selectedIds.length) return false;
    const byId = new Map(messages.map((m) => [m.id, m]));
    return selectedIds.every((id) => byId.get(id)?.isOwn);
  }, [selectedIds, messages]);

  /* ---------- удаление сообщений ---------- */

  const hideForMe = async (ids: string[]) => {
    const okIds: string[] = [];
    for (const id of ids) {
      try {
        await apiClient.post(`/api/messages/${id}/hide/`);
        okIds.push(id);
      } catch (e) {}
    }
    if (okIds.length) {
      setMessages((prev) => prev.filter((m) => !okIds.includes(m.id)));
      setSelectedIds((prev) => prev.filter((id) => !okIds.includes(id)));
    }
    if (okIds.length !== ids.length) {
      setHint('Не все сообщения удалось скрыть у себя');
    }
  };

  const deleteForAll = async (ids: string[]) => {
    const okIds: string[] = [];
    for (const id of ids) {
      try {
        await apiClient.delete(`/api/messages/${id}/`, {
          params: { for_all: true },
        });
        okIds.push(id);
      } catch (e) {}
    }
    if (okIds.length) {
      setMessages((prev) => prev.filter((m) => !okIds.includes(m.id)));
      setSelectedIds((prev) => prev.filter((id) => !okIds.includes(id)));
    }
    if (okIds.length !== ids.length) {
      setHint('Часть сообщений не удалось удалить у всех (нет прав или ошибка сети).');
    }
  };

  const onDeleteForMeClick = async () => {
    if (!selectedIds.length) return;
    const ok = window.confirm(
      selectedIds.length === 1
        ? 'Скрыть это сообщение только у вас?'
        : `Скрыть ${selectedIds.length} сообщений только у вас?`,
    );
    if (!ok) return;
    await hideForMe(selectedIds.slice());
    clearSelection();
  };

  const onDeleteForAllClick = async () => {
    if (!selectedIds.length) return;
    if (!selectedOwnOnly) {
      setHint('Удалить у всех можно только свои сообщения.');
      return;
    }
    const ok = window.confirm(
      selectedIds.length === 1
        ? 'Удалить это сообщение у всех? Действие необратимо.'
        : `Удалить у всех ${selectedIds.length} сообщений? Действие необратимо.`,
    );
    if (!ok) return;
    await deleteForAll(selectedIds.slice());
    clearSelection();
  };

  /* ---------- Голосовые сообщения (как WhatsApp) ---------- */

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [recordCanceled, setRecordCanceled] = useState(false);
  const startXRef = useRef<number | null>(null);

  const pickMimeType = (): { mime: string; ext: string } => {
    const candidates = [
      { mime: 'audio/webm;codecs=opus', ext: 'webm' },
      { mime: 'audio/webm', ext: 'webm' },
      { mime: 'audio/ogg;codecs=opus', ext: 'ogg' },
      { mime: 'audio/mp4', ext: 'm4a' },
      { mime: 'audio/aac', ext: 'aac' },
      { mime: 'audio/wav', ext: 'wav' },
    ];
    for (const c of candidates) {
      // @ts-ignore
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(c.mime)) {
        return c;
      }
    }
    return { mime: 'audio/webm', ext: 'webm' };
  };

  const stopStream = () => {
    const st = mediaStreamRef.current;
    if (st) {
      st.getTracks().forEach((t) => {
        try { t.stop(); } catch {}
      });
    }
    mediaStreamRef.current = null;
  };

  const cleanupRecorder = () => {
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    mediaRecorderRef.current = null;
    stopStream();
    chunksRef.current = [];
    startXRef.current = null;
  };

  const startRecording = async () => {
    if (isRecording || selectionMode || !wsReady) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const { mime } = pickMimeType();
      // @ts-ignore
      const rec = new MediaRecorder(stream, { mimeType: mime });
      mediaRecorderRef.current = rec;
      chunksRef.current = [];
      setRecordCanceled(false);
      setRecordSecs(0);
      setIsRecording(true);

      rec.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      rec.onstop = async () => {
        const canceled = recordCanceled;
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || mime });
        cleanupRecorder();
        setIsRecording(false);

        if (canceled) {
          return; // просто отмена
        }
        if (blob.size < 500) {
          setHint('Запись слишком короткая');
          return;
        }

        const ext = (rec.mimeType || mime).includes('ogg') ? 'ogg'
          : (rec.mimeType || mime).includes('mp4') ? 'm4a'
          : (rec.mimeType || mime).includes('wav') ? 'wav'
          : 'webm';

        const file = new File([blob], `voice_${Date.now()}.${ext}`, { type: rec.mimeType || mime });
        try {
          setSending(true);
          await uploadOneFile(file);
        } catch {
          setHint('Не удалось отправить голосовое');
        } finally {
          setSending(false);
        }
      };

      rec.start(10);

      // таймер записи
      recordTimerRef.current = window.setInterval(() => {
        setRecordSecs((s) => s + 1);
      }, 1000);
    } catch (e) {
      setHint('Нет доступа к микрофону. Разрешите доступ в настройках браузера.');
    }
  };

  const finishRecording = (cancel: boolean) => {
    setRecordCanceled(cancel);
    try {
      mediaRecorderRef.current?.stop();
    } catch {}
    // stream останавливаем в onstop через cleanupRecorder
  };

  const onMicMouseDown = (e: React.MouseEvent) => {
    if (!wsReady || selectionMode) return;
    startXRef.current = e.clientX;
    startRecording();
    // слушаем движение/подъём на всём окне, чтобы отслеживать свайп влево
    const onMove = (ev: MouseEvent) => {
      if (!isRecording || startXRef.current == null) return;
      const dx = ev.clientX - startXRef.current;
      if (dx < -60) {
        // явная отмена
        setRecordCanceled(true);
      } else {
        setRecordCanceled(false);
      }
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      finishRecording(recordCanceled);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const onMicTouchStart = (e: React.TouchEvent) => {
    if (!wsReady || selectionMode) return;
    const t = e.touches[0];
    startXRef.current = t.clientX;
    startRecording();

    const onMove = (ev: TouchEvent) => {
      if (!isRecording || startXRef.current == null) return;
      const tt = ev.touches[0];
      if (!tt) return;
      const dx = tt.clientX - startXRef.current;
      if (dx < -60) setRecordCanceled(true);
      else setRecordCanceled(false);
    };
    const onEnd = () => {
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
      finishRecording(recordCanceled);
    };
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
  };

  /* ====================== Рендер ====================== */

  return (
    <div className="flex flex-col h-full">
      {/* HEADER */}
      {selectionMode ? (
        <div className="flex items-center justify-between p-3 sm:p-4 bg-gradient-to-r from-indigo-700/60 to-purple-700/60 backdrop-blur-xl border-b border-white/20">
          <div className="flex items-center gap-3">
            <button
              onClick={clearSelection}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Выйти из режима выбора"
              title="Отмена"
            >
              <X className="w-5 h-5 text-white" />
            </button>
            <span className="text-white font-medium">
              Выбрано: {selectedIds.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onDeleteForMeClick}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white flex items-center gap-2"
              title="Удалить у себя"
            >
              <EyeOff className="w-4 h-4" />
              <span className="hidden sm:inline">У себя</span>
            </button>
            <button
              onClick={onDeleteForAllClick}
              disabled={!selectedOwnOnly}
              className={`px-3 py-2 rounded-xl text-white flex items-center gap-2 ${
                selectedOwnOnly
                  ? 'bg-red-600/90 hover:bg-red-600'
                  : 'bg-white/10 cursor-not-allowed'
              }`}
              title="Удалить у всех"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">У всех</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between p-3 sm:p-4 bg-gradient-to-r from-indigo-600/50 to-purple-600/50 backdrop-blur-xl border-b border-white/20">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <button
              onClick={onBack}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
              aria-label="Назад"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-semibold text-white truncate">
                {roomInfo.country} — {roomInfo.city}
              </h2>
              <p className="text-xs sm:text-sm text-gray-200 truncate">
                {roomInfo.interest} • {participantCount} участников
                {!wsReady && (
                  <span className="ml-2 text-[11px] text-indigo-200">Подключение…</span>
                )}
                {isTyping && (
                  <span className="ml-2 text-[11px] text-indigo-200">Печатает…</span>
                )}
              </p>
            </div>
          </div>
          <button
            className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
            aria-label="Меню"
          >
            <MoreVertical className="w-5 h-5 text-white" />
          </button>
        </div>
      )}

      {/* MESSAGES */}
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
            {isLoadingOlder && (
              <div className="text-center text-xs text-gray-400 py-1">
                Загрузка истории…
              </div>
            )}
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                msg={m}
                selectionMode={selectionMode}
                selected={selectedIds.includes(m.id)}
                onToggleSelect={toggleSelect}
                onRequestSelectStart={enterSelectionWith}
                onOpenMedia={openLightbox}
              />
            ))}
          </>
        ) : (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <p className="text-gray-300 mb-2">Пока сообщений нет</p>
              <p className="text-gray-400 text-sm">Напишите первое сообщение!</p>
            </div>
          </div>
        )}
        <div ref={lastRef} />
      </div>

      {/* HINT / ERROR */}
      {hint && (
        <div className="px-3 sm:px-4 py-2 bg-red-500/10 text-red-300 text-xs flex items-center space-x-2 border-t border-red-500/20">
          <Info className="w-4 h-4" />
          <span className="truncate">{hint}</span>
          <button
            className="ml-auto text-indigo-300 hover:text-indigo-200 text-xs underline"
            onClick={() => setHint(null)}
          >
            Понятно
          </button>
        </div>
      )}

      {/* INPUT */}
      <div className="p-3 sm:p-4 border-t border-white/10 bg-white/5 backdrop-blur-xl">
        <div className={`flex items-end gap-2 ${isRecording ? 'pointer-events-none opacity-80' : ''}`}>
          <button
            className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-40"
            title="Эмодзи"
            disabled={!wsReady || selectionMode || isRecording}
          >
            <Smile className="w-5 h-5 text-white/80" />
          </button>

          <button
            onClick={onClickAttach}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-40"
            title="Прикрепить файл"
            disabled={!wsReady || selectionMode || isRecording}
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

          {!isRecording && (
            <>
              <textarea
                rows={1}
                value={input}
                onChange={onChangeInput}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={wsReady ? 'Введите сообщение…' : 'Подключение…'}
                className={`flex-1 w-full resize-none text-white placeholder-gray-300/70 rounded-2xl p-3 outline-none focus:ring-2 ${
                  wsReady ? 'bg-white/10 focus:ring-indigo-500/50' : 'bg-white/5 focus:ring-transparent'
                } ${selectionMode ? 'opacity-50 pointer-events-none' : ''}`}
                style={{ overflowWrap: 'anywhere' }}
                disabled={!wsReady || selectionMode}
              />

              {input.trim().length === 0 ? (
                <button
                  onMouseDown={onMicMouseDown}
                  onTouchStart={onMicTouchStart}
                  disabled={!wsReady || sending || selectionMode}
                  className={`p-3 rounded-2xl text-white flex items-center justify-center transition-colors ${
                    wsReady && !selectionMode ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-white/10 cursor-not-allowed'
                  }`}
                  aria-label="Удерживайте для записи"
                  title={!wsReady ? 'Подключение…' : 'Удерживайте для записи'}
                >
                  <Mic className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={sending || !input.trim() || selectionMode}
                  className={`p-3 rounded-2xl text-white flex items-center justify-center transition-colors ${
                    input.trim() && !selectionMode
                      ? 'bg-indigo-600 hover:bg-indigo-700'
                      : 'bg-white/10 cursor-not-allowed'
                  }`}
                  aria-label="Отправить"
                  title={!wsReady ? 'Подключение…' : 'Отправить'}
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>

        {/* Панель записи */}
        {isRecording && (
          <div className="mt-2 flex items-center gap-3 bg-white/10 border border-white/20 rounded-2xl px-3 py-2">
            <div className={`text-sm ${recordCanceled ? 'text-red-400' : 'text-green-400'}`}>
              ●
            </div>
            <div className="text-white/90 font-medium">
              {String(Math.floor(recordSecs / 60)).padStart(2, '0')}:
              {String(recordSecs % 60).padStart(2, '0')}
            </div>
            <div className="text-white/70 text-xs ml-2">
              {recordCanceled ? 'Отпустите — отмена' : 'Свайп влево для отмены, отпустите — отправка'}
            </div>
            <div className="ml-auto">
              <button
                onClick={() => finishRecording(true)}
                className="px-2 py-1 text-xs rounded-lg bg-red-600/80 hover:bg-red-600 text-white"
              >
                Отменить
              </button>
              <button
                onClick={() => finishRecording(false)}
                className="ml-2 px-2 py-1 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Отправить
              </button>
            </div>
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

export default ChatInterface;
export { ChatInterface };
