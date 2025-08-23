// src/components/world/ChatInterface.tsx
// (полный актуальный файл)

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  memo,
} from 'react';
import { createPortal } from 'react-dom';
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
  Play,
  Pause,
  Bell,
  BellOff,
  UserPlus,
  Ban,
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

  meta?: { mime?: string; [k: string]: any } | null;
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
    const v = localStorage.getItem(k) || sessionStorage.getItem(k);
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

// распознаём «не никнейм»: e-mail/телефон
const looksLikeEmail = (s: string) => /@/.test(s);
const looksLikePhone = (s: string) => /^[+\d][\d\s().-]{6,}$/.test(s);

const chooseNickname = (m: MessageApi): string => {
  const candidates = [
    (m.username || '').trim(),
    (m.display_name || '').trim(),
  ].filter(Boolean);

  for (const c of candidates) {
    if (!looksLikeEmail(c) && !looksLikePhone(c)) {
      return c;
    }
  }
  // если всё похоже на e-mail/телефон или пусто — нейтральный ник
  return 'User';
};

// Учитываем meta.mime прежде, чем смотреть на расширение
const guessAttachmentKind = (
  attachmentUrl?: string | null,
  attachmentType?: string | null,
  attachmentName?: string | null,
  mime?: string | null,
): AttachmentKind => {
  const url = (attachmentUrl || '').toLowerCase();
  const name = (attachmentName || '').toLowerCase();
  const src = url || name;

  if (mime) {
    const m = mime.toLowerCase();
    if (m.startsWith('audio/')) return 'audio';
    if (m.startsWith('video/')) return 'video';
    if (m.startsWith('image/')) return 'image';
  }

  if (attachmentType === 'image') return 'image';

  const isImg = /\.(png|jpg|jpeg|webp|gif|bmp|avif)$/.test(src);
  if (isImg) return 'image';

  const isAud = /\.(mp3|m4a|aac|ogg|opus|wav|webm)$/.test(src);
  if (isAud) return 'audio';

  const isVid = /\.(mp4|webm|mov|m4v|ogv)$/.test(src);
  if (isVid) return 'video';

  if (attachmentUrl) return 'file';
  return '';
};

function mapApiToUi(m: MessageApi, currentUserId: string | null): UIMessage {
  const authorId = pickAuthorId(m);
  const username = chooseNickname(m);

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

/* ====================== Аудио-плеер ====================== */

const formatMs = (sec: number) => {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(1, '0')}:${String(s).padStart(2, '0')}`;
};

const AudioMessage: React.FC<{
  id: string;
  src: string;
  own: boolean;
  label?: string;
}> = ({ id, src, own, label }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [curr, setCurr] = useState(0);
  const [dur, setDur] = useState(0);

  useEffect(() => {
    const onForeign = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || detail.id !== id) {
        try { audioRef.current?.pause(); setPlaying(false); } catch {}
      }
    };
    window.addEventListener('humy:audio-playing', onForeign as any);
    return () => window.removeEventListener('humy:audio-playing', onForeign as any);
  }, [id]);

  const toggle = () => {
    const a = audioRef.current; if (!a) return;
    if (!playing) {
      try { window.dispatchEvent(new CustomEvent('humy:audio-playing', { detail: { id } })); } catch {}
      a.play().catch(()=>{});
    } else { a.pause(); }
  };

  useEffect(() => {
    const a = audioRef.current; if (!a) return;
    const onLoaded = () => setDur(a.duration || 0);
    const onTime = () => setCurr(a.currentTime || 0);
    const onEnd = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    a.addEventListener('loadedmetadata', onLoaded);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('ended', onEnd);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    return () => {
      a.removeEventListener('loadedmetadata', onLoaded);
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('ended', onEnd);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
    };
  }, []);

  const seek = (value: number) => {
    const a = audioRef.current; if (!a || !isFinite(value)) return;
    a.currentTime = value; setCurr(value);
  };

  const accent = own ? '#ffffff' : '#a78bfa';
  const secondary = own ? 'text-indigo-100/80' : 'text-white/70';

  return (
    <div className="w-full max-w-[70vw]">
      <div className="flex items-center gap-3">
        <button onClick={toggle} className={`inline-flex items-center justify-center w-9 h-9 rounded-full ${own ? 'bg-white/20 hover:bg-white/25' : 'bg-white/15 hover:bg-white/20'}`} title={playing ? 'Пауза' : 'Воспроизвести'}>
          {playing ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white" />}
        </button>
        <input type="range" min={0} max={isFinite(dur) && dur > 0 ? dur : 0} step={0.01} value={isFinite(curr) ? curr : 0}
          onChange={(e) => seek(Number(e.target.value))} style={{ accentColor: accent }}
          className="flex-1 h-2 rounded-full bg-white/20 outline-none" />
        <div className={`ml-1 text-xs ${secondary} tabular-nums`}>{formatMs(curr)} / {formatMs(dur)}</div>
      </div>
      {label ? <div className="mt-1 text_sm">{label}</div> : null}
      <audio ref={audioRef} src={src} preload="metadata" />
    </div>
  );
};

/* ====================== Пузырь сообщения ====================== */

type BubbleProps = {
  msg: UIMessage;
  selectionMode: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onRequestSelectStart: (id: string) => void;
  onOpenMedia: (items: LightboxItem[], index: number) => void;
  onUserClick: (e: React.MouseEvent, msg: UIMessage) => void;
};

const MessageBubble: React.FC<BubbleProps> = memo(
  ({ msg, selectionMode, selected, onToggleSelect, onRequestSelectStart, onOpenMedia, onUserClick }) => {
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

    // Лонг-тап / ПКМ для выбора
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
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify_center text-white text-xs font-semibold">
                {getInitials(msg.username)}
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onUserClick(e, msg); }}
                className="text-left text-xs sm:text-sm text-gray-300 font-medium truncate hover:underline"
                title={msg.username}
              >
                {msg.username}
              </button>
            </div>
          )}

          <div
            className={`px-3 sm:px-4 py-2 sm:py-3 rounded-2xl overflow-hidden whitespace-pre-wrap break-words break-all relative ${
              mine
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-md shadow-lg hover:shadow-xl transition-shadow duration-200'
                : 'bg-white/10 backdrop-blur-sm text-white rounded-bl-md border border-white/20 hover:bg-white/15 transition-all duration-200'
            } ${selected ? 'ring-2 ring-indigo-400' : ''}`}
            style={{ overflowWrap: 'anywhere' }}
            onClick={() => { if (selectionMode) onToggleSelect(msg.id); }}
          >
            {/* Галочка выбора */}
            {selectionMode && (
              <div className="absolute -top-2 -right-2">
                <span className={`inline-flex items-center justify-center rounded-full ${selected ? 'text-indigo-400' : 'text-white/40'}`}>
                  <CheckCircle2 className="w-5 h-5" />
                </span>
              </div>
            )}

            {/* Медиа: изображение/видео */}
            {msg.attachmentUrl && (msg.attachmentKind === 'image' || msg.attachmentKind === 'video') && (
              <button type="button" onClick={openLightboxSingle} className={previewContainerCls} title="Открыть на весь экран">
                {msg.attachmentKind === 'image'
                  ? <img src={msg.attachmentUrl} alt={msg.attachmentName || 'image'} className={previewMediaCls} />
                  : <video src={msg.attachmentUrl} className={previewMediaCls} muted playsInline controls />}
              </button>
            )}

            {/* Аудио */}
            {msg.attachmentUrl && msg.attachmentKind === 'audio' && (
              <div className="mt-2 w-full max-w-[70vw]">
                <AudioMessage id={msg.id} src={msg.attachmentUrl} own={mine} label={msg.content || undefined} />
              </div>
            )}

            {/* Файлы */}
            {msg.attachmentUrl && msg.attachmentKind === 'file' && (
              <a href={msg.attachmentUrl} target="_blank" rel="noreferrer"
                 className="mt-2 flex items-center gap-2 px-3 py-2 bg-black/20 rounded-xl max-w-[70vw]"
                 onClick={(e) => { if (selectionMode) { e.preventDefault(); onToggleSelect(msg.id); } }}>
                <FileIcon className="w-4 h-4 opacity-80" />
                <span className="truncate">{msg.attachmentName || 'Файл'}</span>
              </a>
            )}

            {/* Текст */}
            {!msg.attachmentUrl && msg.content ? <div>{msg.content}</div>
              : msg.attachmentUrl && msg.content && msg.attachmentKind !== 'audio' ? <div className="mt-2">{msg.content}</div> : null}

            <p className={`text-[10px] mt-1 text-right ${mine ? 'text-indigo-200' : 'text-gray-400'}`}>
              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      </div>
    );
  }
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
    // не показываем email/телефон даже у себя
    if (looksLikeEmail(name) || looksLikePhone(name)) return 'User';
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

  // режим выбора
  const [selectionMode, setSelectionMode] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // меню 3-точек (подписка/мьют)
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const menuBtnRef = useRef<HTMLButtonElement | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const menuPopoverRef = useRef<HTMLDivElement | null>(null);

  const storageKeySub = `humy:sub:room:${roomInfo.id}`;
  const storageKeyMute = `humy:mute:room:${roomInfo.id}`;
  const [isSubscribed, setIsSubscribed] = useState<boolean>(() => {
    return localStorage.getItem(storageKeySub) === '1';
  });
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    return localStorage.getItem(storageKeyMute) === '1';
  });
  const [menuBusy, setMenuBusy] = useState(false);

  // мини-меню по клику на ник
  const [userMenu, setUserMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    authorId: string | null;
    username: string;
  }>({ open: false, x: 0, y: 0, authorId: null, username: '' });

  const wsRef = useRef<WebSocket | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const lastRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const typingTimeout = useRef<number | null>(null);

  // ➜ Set уже полученных server-id для защиты от двойной вставки
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

  /* ---------- Закрытие попапов по клику вне/ESC ---------- */
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      const insideHeader = headerRef.current?.contains(t);
      const insideMenu = menuPopoverRef.current?.contains(t);
      if (!(insideHeader || insideMenu)) {
        setMenuOpen(false);
      }
      if (userMenu.open) {
        setUserMenu((s) => ({ ...s, open: false }));
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setUserMenu((s) => ({ ...s, open: false }));
      }
    };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [userMenu.open]);

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
      // сброс кеша id при смене комнаты
      seenIdsRef.current.clear();
      ui.forEach((m) => {
        if (/^\d+$/.test(m.id)) seenIdsRef.current.add(String(m.id));
      });
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
    try { wsRef.current?.close(); } catch {}
    wsRef.current = null;

    const base = (apiClient.defaults.baseURL || 'http://127.0.0.1:8000/api/')
      .toString()
      .replace(/\/+$/, '');
    const baseURL = new URL(base, window.location.origin);
    const wsProto = baseURL.protocol === 'https:' ? 'wss' : 'ws';
    const hostname = baseURL.hostname === 'localhost' ? '127.0.0.1' : baseURL.hostname;
    const authority = baseURL.port ? `${hostname}:${baseURL.port}` : hostname;
    const token = getWsToken();

    const wsUrl = `${wsProto}://${authority}/ws/chat/${roomInfo.id}/?token=${encodeURIComponent(token || '')}`;

    let closedByClient = false;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsReady(true);
      setHint(null);
      // Универсальный хендшейк подписки/вступления
      try {
        ws.send(JSON.stringify({ type: 'ping' }));
        const joinPayloads = [
          { type: 'subscribe', room: roomInfo.id },
          { type: 'join', room: roomInfo.id },
          { type: 'room:join', room: roomInfo.id },
        ];
        for (const p of joinPayloads) ws.send(JSON.stringify(p));
      } catch {}
    };

    ws.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (!payload) return;
        const raw = payload.data ?? payload;
        const type = (payload.type ?? raw?.type ?? '').toString();

        const looksLikeChatMessage =
          /(^(chat\.)?message$|group\.message|room\.message)/i.test(type) ||
          (raw && raw.id != null && raw.room != null && (raw.content != null || raw.attachment_url));

        if (type === 'message' || looksLikeChatMessage) {
          const msgApi: MessageApi = raw as any;
          const ui = mapApiToUi(msgApi, currentUserId);

          // --- защита от повторной вставки одного и того же server-id
          const serverId = String(ui.id ?? '');
          if (serverId && seenIdsRef.current.has(serverId)) return;

          // --- все возможные ключи "эха" временного id
          const tempEcho =
            (raw as any)?.tempId ||
            (raw as any)?.temp_id ||
            (raw as any)?.client_id ||
            (raw as any)?.clientId ||
            (raw as any)?.echo_id;

          setMessages((prev) => {
            // 1) пришёл tempEcho — заменяем оптимистичное сообщение
            if (tempEcho) {
              const idx = prev.findIndex((m) => m.id === String(tempEcho));
              if (idx >= 0) {
                const copy = prev.slice();
                copy[idx] = ui;
                if (serverId) seenIdsRef.current.add(serverId);
                return copy;
              }
            }

            // 2) если server-id уже есть — не добавляем
            if (serverId && prev.some((m) => m.id === serverId)) {
              seenIdsRef.current.add(serverId);
              return prev;
            }

            // 3) мягкая дедупликация: моё оптимистичное с тем же текстом и ~10с
            if (ui.isOwn && ui.content) {
              const now = new Date(ui.createdAt || Date.now()).getTime();
              const idxNear = prev.findIndex((m) =>
                m.isOwn &&
                !/^\d+$/.test(m.id) &&
                (m.content || '').trim() === (ui.content || '').trim() &&
                Math.abs(new Date(m.createdAt).getTime() - now) < 10000
              );
              if (idxNear >= 0) {
                const copy = prev.slice();
                copy[idxNear] = ui;
                if (serverId) seenIdsRef.current.add(serverId);
                return copy;
              }
            }

            // 4) обычная вставка
            if (serverId) seenIdsRef.current.add(serverId);
            return [...prev, ui];
          });

          const el = listRef.current;
          if (el) {
            const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            if (nearBottom) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
          }
          return;
        }

        if (type === 'typing') {
          setIsTyping(Boolean((raw as any)?.isTyping));
          setTimeout(() => setIsTyping(false), 1200);
          return;
        }

        if (/^presence|room\.presence$/i.test(type)) {
          const count = Number((raw as any)?.count ?? 0);
          setParticipantCount(count);
          return;
        }

        if (/^delete|message\.delete$/i.test(type)) {
          const idToRemove = String((raw as any)?.id ?? '');
          if (idToRemove) {
            setMessages((prev) => prev.filter((m) => m.id !== idToRemove));
            setSelectedIds((prev) => prev.filter((id) => id !== idToRemove));
          }
          return;
        }
      } catch { /* ignore */ }
    };

    ws.onclose = (e) => {
      setWsReady(false); wsRef.current = null;
      if (closedByClient) return;
      if (e.code === 4401) { setHint('Требуется авторизация для подключения к чату.'); return; }
      setHint('Соединение потеряно. Переподключаем…');
      setTimeout(() => {
        if (!closedByClient) {
          try { const again = new WebSocket(wsUrl); wsRef.current = again; } catch {}
        }
      }, 1500);
    };

    ws.onerror = () => { try { ws.close(); } catch {} };

    return () => { closedByClient = true; try { ws.close(); } catch {} };
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

  const sendViaWS = useCallback((text: string, tempId: string): boolean => {
    const ws = wsRef.current; if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    try {
      // шлём оба ключа для надёжного эха
      ws.send(JSON.stringify({ type: 'message', content: text, tempId, temp_id: tempId }));
      return true;
    } catch { return false; }
  }, []);

  const postViaHTTP = useCallback(async (text: string) => {
    const res = await apiClient.post('/api/messages/', { room: roomInfo.id, content: text });
    const ui = mapApiToUi(res.data as MessageApi, currentUserId);
    setMessages((prev) => [...prev, ui]);
    requestAnimationFrame(() => lastRef.current?.scrollIntoView({ behavior: 'smooth' }));
  }, [roomInfo.id, currentUserId]);

  const handleSend = useCallback(async () => {
    const text = input.trim(); if (!text) return;
    setSending(true);
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: UIMessage = {
      id: tempId, room: String(roomInfo.id), authorId: currentUserId, username: myDisplayName,
      content: text, createdAt: new Date().toISOString(), isOwn: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput('');

    const ok = sendViaWS(text, tempId);
    if (!ok) {
      try { setMessages((prev) => prev.filter((m) => m.id !== tempId)); await postViaHTTP(text); }
      catch { setHint('Не удалось отправить сообщение'); }
    }
    setSending(false);
  }, [input, roomInfo.id, currentUserId, myDisplayName, sendViaWS, postViaHTTP]);

  /* ---------- typing ---------- */

  const onChangeInput: React.ChangeEventHandler<HTMLTextAreaElement> = (e) => {
    const val = e.target.value; setInput(val);
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
    const res = await apiClient.post('/api/messages/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    const ui = mapApiToUi(res.data as MessageApi, currentUserId);
    setMessages((prev) => [...prev, ui]);
    requestAnimationFrame(() => lastRef.current?.scrollIntoView({ behavior: 'smooth' }));
  };

  const onChangeFile: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const files = Array.from(e.target.files || []); if (!files.length) return;
    setSending(true);
    try { for (const f of files) await uploadOneFile(f); }
    catch { setHint('Не удалось загрузить файл(ы)'); }
    finally { setSending(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  /* ---------- выбор/удаление ---------- */

  const enterSelectionWith = (id: string) => { setSelectionMode(true); setSelectedIds([id]); };
  const toggleSelect = (id: string) => setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const clearSelection = () => { setSelectionMode(false); setSelectedIds([]); };

  const selectedOwnOnly = useMemo(() => {
    if (!selectedIds.length) return false;
    const byId = new Map(messages.map((m) => [m.id, m]));
    return selectedIds.every((id) => byId.get(id)?.isOwn);
  }, [selectedIds, messages]);

  const hideForMe = async (ids: string[]) => {
    const okIds: string[] = [];
    for (const id of ids) {
      try { await apiClient.post(`/api/messages/${id}/hide/`); okIds.push(id); } catch {}
    }
    if (okIds.length) {
      setMessages((prev) => prev.filter((m) => !okIds.includes(m.id)));
      setSelectedIds((prev) => prev.filter((id) => !okIds.includes(id)));
    }
    if (okIds.length !== ids.length) setHint('Не все сообщения удалось скрыть у себя');
  };

  const deleteForAll = async (ids: string[]) => {
    const okIds: string[] = [];
    for (const id of ids) {
      try { await apiClient.delete(`/api/messages/${id}/`, { params: { for_all: true } }); okIds.push(id); } catch {}
    }
    if (okIds.length) {
      setMessages((prev) => prev.filter((m) => !okIds.includes(m.id)));
      setSelectedIds((prev) => prev.filter((id) => !okIds.includes(id)));
    }
    if (okIds.length !== ids.length) setHint('Часть сообщений не удалось удалить у всех');
  };

  /* ---------- Меню 3 точки: Подписка/Мьют ---------- */

  const subscribeApi = async (subscribe: boolean) => {
    try {
      if (subscribe) {
        await apiClient.post(`/api/group-chats/${roomInfo.id}/subscribe/`).catch(() => {});
      } else {
        await apiClient.post(`/api/group-chats/${roomInfo.id}/unsubscribe/`).catch(() => {});
      }
    } catch { /* ignore */ }
  };
  const muteApi = async (muted: boolean) => {
    try {
      await apiClient.post(`/api/group-chats/${roomInfo.id}/mute/`, { muted }).catch(() => {});
    } catch { /* ignore */ }
  };

  const handleSubscribeToggle = async () => {
    if (menuBusy) return;
    setMenuBusy(true);
    try {
      if (!isSubscribed) {
        await subscribeApi(true);
        setIsSubscribed(true);
        localStorage.setItem(storageKeySub, '1');
      } else {
        await subscribeApi(false);
        setIsSubscribed(false);
        localStorage.removeItem(storageKeySub);
      }
    } catch {
      setHint('Не удалось изменить подписку на чат');
    } finally {
      setMenuBusy(false);
      setMenuOpen(false);
    }
  };

  const handleMuteToggle = async () => {
    if (menuBusy) return;
    setMenuBusy(true);
    try {
      const next = !isMuted;
      await muteApi(next);
      setIsMuted(next);
      if (next) localStorage.setItem(storageKeyMute, '1');
      else localStorage.removeItem(storageKeyMute);
    } catch {
      setHint('Не удалось изменить настройку уведомлений чата');
    } finally {
      setMenuBusy(false);
      setMenuOpen(false);
    }
  };

  /* ---------- Меню по клику на ник ---------- */
  const onUserClick = (e: React.MouseEvent, msg: UIMessage) => {
    if (!msg.authorId || msg.isOwn) return;
    setUserMenu({
      open: true,
      x: e.clientX,
      y: e.clientY,
      authorId: msg.authorId,
      username: msg.username,
    });
  };

  // «Умная» отправка заявки с разными полями и числовым ID
  const addFriend = async (userId: string | null) => {
    if (!userId) return;
    try {
      const id = Number(userId);
      const endpoints = [
        { url: '/api/friends/requests/', bodies: [{ to_user_id: id }, { to_user: id }, { user_id: id }, { receiver_id: id }] },
        { url: '/api/friends/request/',  bodies: [{ to_user_id: id }, { to_user: id }, { user_id: id }, { receiver_id: id }] },
        { url: '/api/friends/add/',      bodies: [{ user_id: id }, { friend_id: id }, { to_user_id: id }] },
      ];
      let lastErr: any = null;
      for (const ep of endpoints) {
        for (const body of ep.bodies) {
          try {
            const r = await apiClient.post(ep.url, body);
            if (r.status === 200 || r.status === 201) {
              setHint('Заявка в друзья отправлена');
              setUserMenu((s) => ({ ...s, open: false }));
              return;
            }
          } catch (e: any) {
            lastErr = e;
            const st = e?.response?.status;
            const data = e?.response?.data;
            if (st === 409 || (st === 400 && /already|exists|уже|duplicate/i.test(JSON.stringify(data || '')))) {
              setHint('Заявка уже отправлена');
              setUserMenu((s) => ({ ...s, open: false }));
              return;
            }
            if (st && st >= 400 && st < 500) continue;
            if (st && st >= 500) break;
          }
        }
      }
      const msg = lastErr?.response?.data
        ? (typeof lastErr.response.data === 'string' ? lastErr.response.data : JSON.stringify(lastErr.response.data))
        : 'Неизвестная ошибка';
      setHint('Не удалось отправить заявку: ' + msg);
    } catch {
      setHint('Не удалось отправить заявку');
    } finally {
      setUserMenu((s) => ({ ...s, open: false }));
    }
  };

  const blockUser = async (userId: string | null) => {
    if (!userId) return;
    const ok = window.confirm('Заблокировать пользователя? Он не сможет писать вам в ЛС.');
    if (!ok) return;
    try {
      await apiClient.post('/api/blocks/', { user_id: Number(userId) }).catch(() => {});
      setHint('Пользователь заблокирован');
    } catch {
      setHint('Не удалось заблокировать пользователя');
    } finally {
      setUserMenu((s) => ({ ...s, open: false }));
    }
  };

  /* =================== Рендер =================== */

  // Поповер «⋮» через портал (над всеми контекстами)
  const ThreeDotsMenu = menuOpen
    ? createPortal(
        <div
          ref={menuPopoverRef}
          className="fixed z-[200000] w-60 rounded-2xl border bg-gradient-to-b from-indigo-700/95 to-purple-900/95 border-white/10 text-white shadow-2xl backdrop-blur-xl p-1"
          style={{ top: menuPos.y, left: menuPos.x }}
          role="menu"
          aria-label="Меню чата"
        >
          {!isSubscribed ? (
            <button onClick={handleSubscribeToggle} disabled={menuBusy}
                    className="w-full flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-white/10">
              <Bell className="w-4 h-4" />
              <span>Подписаться на чат</span>
            </button>
          ) : (
            <>
              <button onClick={handleSubscribeToggle} disabled={menuBusy}
                      className="w_full flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-white/10">
                <X className="w-4 h-4" />
                <span>Отписаться</span>
              </button>
              <button onClick={handleMuteToggle} disabled={menuBusy}
                      className="w-full flex items-center gap-2 px-4 py-2 rounded-xl hover:bg_white/10">
                {isMuted ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                <span>{isMuted ? 'Включить уведомления' : 'Отключить уведомления'}</span>
              </button>
            </>
          )}
        </div>,
        document.body
      )
    : null;

  // Контекстное меню по нику — тоже через портал
  const UserContextMenu = userMenu.open
    ? createPortal(
        <div
          className="fixed z-[200000]"
          style={{ top: userMenu.y + 8, left: Math.min(userMenu.x + 8, window.innerWidth - 240) }}
        >
          <div className="w-60 rounded-2xl border bg-gradient-to-b from-indigo-700/95 to-purple-900/95 border-white/10 text-white shadow-2xl backdrop-blur-xl p-1">
            <div className="px-4 py-2 text-xs text-white/80">
              Пользователь: <span className="text-white font-medium">{userMenu.username}</span>
            </div>
            <button onClick={() => addFriend(userMenu.authorId)}
                    className="w-full flex items-center gap-2 px-4 py-2 rounded-xl hover:bg_white/10">
              <UserPlus className="w-4 h-4" />
              <span>Добавить в друзья</span>
            </button>
            <button onClick={() => blockUser(userMenu.authorId)}
                    className="w-full flex items-center gap-2 px-4 py-2 rounded-xl hover:bg_white/10">
              <Ban className="w-4 h-4" />
              <span>Заблокировать</span>
            </button>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* HEADER */}
      {selectionMode ? (
        <div className="flex items-center justify-between p-3 sm:p-4 bg-gradient-to-r from-indigo-700/60 to-purple-700/60 backdrop-blur-xl border-b border-white/20">
          <div className="flex items-center gap-3">
            <button onClick={clearSelection} className="p-2 hover:bg-white/10 rounded-lg transition-colors" aria-label="Выйти из режима выбора" title="Отмена">
              <X className="w-5 h-5 text-white" />
            </button>
            <span className="text-white font-medium">Выбрано: {selectedIds.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => hideForMe(selectedIds.slice())}
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white flex items-center gap-2"
                    title="Удалить у себя">
              <EyeOff className="w-4 h-4" /><span className="hidden sm:inline">У себя</span>
            </button>
            <button onClick={() => {
                      if (!selectedOwnOnly) { setHint('Удалить у всех можно только свои сообщения.'); return; }
                      const ok = window.confirm(selectedIds.length===1 ? 'Удалить это сообщение у всех?' : `Удалить у всех ${selectedIds.length} сообщений?`);
                      if (ok) deleteForAll(selectedIds.slice());
                    }}
                    className={`px-3 py-2 rounded-xl text-white flex items-center gap-2 ${selectedOwnOnly ? 'bg-red-600/90 hover:bg-red-600' : 'bg-white/10 cursor-not-allowed'}`}
                    title="Удалить у всех">
              <Trash2 className="w-4 h-4" /><span className="hidden sm:inline">У всех</span>
            </button>
          </div>
        </div>
      ) : (
        <div ref={headerRef} className="relative flex items-center justify-between p-3 sm:p-4 bg-gradient-to-r from-indigo-600/50 to-purple-600/50 backdrop-blur-xl border-b border-white/20">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0" aria-label="Назад">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-semibold text-white truncate">
                {roomInfo.country} — {roomInfo.city}
              </h2>
              <p className="text-xs sm:text-sm text-gray-200 truncate">
                {roomInfo.interest} • {participantCount} участников
                {!wsReady && (<span className="ml-2 text-[11px] text-indigo-200">Подключение…</span>)}
                {isTyping && (<span className="ml-2 text-[11px] text-indigo-200">Печатает…</span>)}
              </p>
            </div>
          </div>
          <button
            ref={menuBtnRef}
            onClick={(e) => {
              e.stopPropagation();
              const rect = menuBtnRef.current?.getBoundingClientRect();
              if (rect) {
                const top = rect.bottom + 8;
                const popWidth = 240; // w-60
                const left = Math.min(Math.max(8, rect.left), window.innerWidth - popWidth - 8);
                setMenuPos({ x: left, y: top });
              }
              setMenuOpen((o) => !o);
            }}
            className="relative p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
            aria-label="Меню"
          >
            <MoreVertical className="w-5 h-5 text-white" />
          </button>
        </div>
      )}

      {/* вставляем портальные поповеры рядом с root */}
      {ThreeDotsMenu}
      {UserContextMenu}

      {/* MESSAGES */}
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 bg-gradient-to-b from-[#3b0b7a] to-[#16022b]">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin mr-3" />
            <span className="text-gray-300">Загрузка…</span>
          </div>
        ) : messages.length > 0 ? (
          <>
            {isLoadingOlder && (<div className="text-center text-xs text-gray-400 py-1">Загрузка истории…</div>)}
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                msg={m}
                selectionMode={selectionMode}
                selected={selectedIds.includes(m.id)}
                onToggleSelect={toggleSelect}
                onRequestSelectStart={enterSelectionWith}
                onOpenMedia={openLightbox}
                onUserClick={onUserClick}
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
          <button className="ml-auto text-indigo-300 hover:text-indigo-200 text-xs underline" onClick={() => setHint(null)}>Понятно</button>
        </div>
      )}

      {/* INPUT */}
      <div className="p-3 sm:p-4 border-t border-white/10 bg-white/5 backdrop-blur-xl">
        <div className={`flex items-end gap-2`}>
          <button className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-40" title="Эмодзи" disabled={!wsReady || selectionMode}>
            <Smile className="w-5 h-5 text-white/80" />
          </button>

          <button onClick={onClickAttach} className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-40" title="Прикрепить файл" disabled={!wsReady || selectionMode}>
            <Paperclip className="w-5 h-5 text-white/80" />
          </button>
          <input ref={fileRef} type="file"
                 accept="image/*,video/*,audio/*,.pdf,.zip,.rar,.7z,.doc,.docx,.xls,.xlsx,.txt"
                 className="hidden" multiple onChange={onChangeFile} />

          <textarea rows={1} value={input} onChange={onChangeInput}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={wsReady ? 'Введите сообщение…' : 'Подключение…'}
            className={`flex-1 w/full resize-none text-white placeholder-gray-300/70 rounded-2xl p-3 outline-none focus:ring-2 ${
              wsReady ? 'bg-white/10 focus:ring-indigo-500/50' : 'bg-white/5 focus:ring-transparent'
            } ${selectionMode ? 'opacity-50 pointer-events-none' : ''}`}
            style={{ overflowWrap: 'anywhere' }} disabled={!wsReady || selectionMode} />

          <button onClick={handleSend} disabled={sending || !input.trim() || selectionMode}
            className={`p-3 rounded-2xl text-white flex items-center justify-center transition-colors ${
              input.trim() && !selectionMode ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-white/10 cursor-not-allowed'
            }`} aria-label="Отправить" title={!wsReady ? 'Подключение…' : 'Отправить'}>
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Лайтбокс */}
      <AttachmentLightbox open={lbOpen} items={lbItems} index={lbIndex} onClose={closeLightbox} />
    </div>
  );
};

export default ChatInterface;
export { ChatInterface };
