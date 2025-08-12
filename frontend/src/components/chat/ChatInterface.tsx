import React, { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Send, Smile, Paperclip, MoreVertical, Loader2, Info } from 'lucide-react';
import apiClient from '../../api/instance';
import { useUser } from '../../contexts/UserContext';

/* ================= типы ================= */

interface Message {
  id: string;
  user_id: string | null;
  username: string;
  avatar?: string;
  content: string;
  timestamp: string; // ISO
  is_own: boolean;
}

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

/* ================= helpers ================= */

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

/** Достаём JWT откуда угодно и приводим к «чистому» токену */
function getWsToken(): string {
  // a) из заголовка axios (Authorization: Bearer <token> / JWT <token>)
  const headersAny: any = (apiClient as any).defaults?.headers;
  const authHeader: string | undefined = headersAny?.common?.Authorization || headersAny?.Authorization;
  if (authHeader) {
    const low = authHeader.toLowerCase();
    if (low.startsWith('bearer ') || low.startsWith('jwt ')) {
      return authHeader.split(' ', 2)[1].trim();
    }
  }

  // b) из local/sessionStorage по популярным ключам
  const keys = ['access', 'access_token', 'jwt', 'token', 'jwt_access', 'auth_token'];
  for (const k of keys) {
    const v = localStorage.getItem(k) || sessionStorage.getItem(k);
    if (v) return v.replace(/^"|"$/g, ''); // уберём кавычки, если лежит строкой
  }

  // c) из cookies
  const m = document.cookie.match(/(?:^|;\s*)(access|access_token|jwt|token)=([^;]+)/);
  if (m) return decodeURIComponent(m[2]);

  return '';
}

/** Нормализуем полезную нагрузку WS (поддержка snake/camel + обёртка data) */
function normalizeWsPayload(raw: any) {
  const d = raw?.data ?? raw ?? {};
  const type = raw?.type ?? d?.type;

  const id = String(d.id ?? d.messageId ?? '');
  const displayName = d.display_name ?? d.displayName ?? d.username ?? 'User';
  const content = d.content ?? '';
  const createdAt = d.created_at ?? d.createdAt ?? new Date().toISOString();

  const authorId = d.author ?? d.authorId ?? d.author_id ?? null;

  const count = d.count ?? raw?.count;
  const isTyping = d.isTyping ?? raw?.isTyping;

  return { type, id, displayName, content, createdAt, authorId, count, isTyping };
}

/* ================= сообщение ================= */

const MessageItem = memo(({ m, formatTime }: { m: Message; formatTime: (ts: string) => string }) => (
  <div className={`flex ${m.is_own ? 'justify-end' : 'justify-start'} mb-2`}>
    <div className="max-w-[85%] sm:max-w-xs lg:max-w-md">
      {!m.is_own && (
        <div className="flex items-center space-x-2 mb-1">
          <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
            {getInitials(m.username)}
          </div>
          <span className="text-xs sm:text-sm text-gray-300 font-medium truncate">{m.username}</span>
        </div>
      )}
      <div
        className={`px-3 sm:px-4 py-2 sm:py-3 rounded-2xl ${
          m.is_own
            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-md shadow-lg hover:shadow-xl transition-shadow duration-200'
            : 'bg-white/10 backdrop-blur-sm text-white rounded-bl-md border border-white/20 hover:bg-white/15 transition-all duration-200'
        }`}
      >
        <p className="text-xs sm:text-sm leading-relaxed break-words">{m.content}</p>
        <p className={`text-[10px] mt-1 text-right ${m.is_own ? 'text-indigo-200' : 'text-gray-400'}`}>
          {formatTime(m.timestamp)}
        </p>
      </div>
    </div>
  </div>
));
MessageItem.displayName = 'MessageItem';

/* ================= основной компонент ================= */

export const ChatInterface = memo(({ roomInfo, onBack }: ChatInterfaceProps) => {
  const { t } = useTranslation();
  const { user } = useUser();

  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ошибки/подсказки
  const [loadError, setLoadError] = useState<string | null>(null); // ошибка первичной загрузки
  const [hint, setHint] = useState<string | null>(null); // мягкие подсказки

  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [participantCount, setParticipantCount] = useState<number>(roomInfo.participantCount ?? 0);

  // пагинация
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState<boolean>(false);

  // WebSocket
  const [wsReady, setWsReady] = useState<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const myDisplayName = useMemo(
    () => (user?.nickname || (user as any)?.display_name || user?.username || user?.email || 'Humy').toString().slice(0, 32),
    [user]
  );

  const formatTime = useCallback((timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }, []);

  const transform = useCallback(
    (arr: any[]): Message[] => {
      const meId = user?.id ? String(user.id) : null;
      const list: Message[] = arr.map((msg: any) => ({
        id: String(msg.id),
        user_id:
          msg.author !== undefined && msg.author !== null
            ? String(msg.author)
            : msg.author_id !== undefined && msg.author_id !== null
            ? String(msg.author_id)
            : null,
        username: msg.display_name || msg.displayName || 'User',
        content: msg.content || '',
        timestamp: msg.created_at || msg.createdAt || new Date().toISOString(),
        is_own:
          meId !== null &&
          (String(msg.author) === meId || String(msg.author_id) === meId || msg.display_name === myDisplayName),
      }));
      return list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    },
    [user?.id, myDisplayName]
  );

  /* -------- Первичная загрузка -------- */
  const loadInitial = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const res = await apiClient.get(`/api/messages/?room=${roomInfo.id}&page_size=30`);
      const data = res.data?.results ?? res.data ?? [];
      const items = transform(data);
      setMessages(items);
      setCursor(extractCursor(res.data?.next));
      setHasMore(!!res.data?.next);
    } catch {
      setLoadError(t('chat.loadMessagesFailed', 'Не удалось загрузить сообщения'));
    } finally {
      setIsLoading(false);
      requestAnimationFrame(() => lastRef.current?.scrollIntoView({ behavior: 'auto' }));
    }
  }, [roomInfo.id, t, transform]);

  useEffect(() => {
    setMessages([]);
    setCursor(null);
    setHasMore(true);
    setIsLoading(true);
    setLoadError(null);
    setHint(null);
    loadInitial();
  }, [roomInfo.id, loadInitial]);

  /* -------- Догрузка вверх -------- */
  const loadOlder = useCallback(async () => {
    if (!cursor || isLoadingOlder) return;
    const el = listRef.current;
    const prevScrollTop = el?.scrollTop ?? 0;
    const prevScrollHeight = el?.scrollHeight ?? 0;

    try {
      setIsLoadingOlder(true);
      const res = await apiClient.get(`/api/messages/?room=${roomInfo.id}&cursor=${encodeURIComponent(cursor)}`);
      const data = res.data?.results ?? res.data ?? [];
      const olderAsc = transform(data);
      setMessages((prev) => [...olderAsc, ...prev]);

      const nextCur = extractCursor(res.data?.next);
      setCursor(nextCur);
      setHasMore(!!nextCur);

      requestAnimationFrame(() => {
        const newHeight = el?.scrollHeight ?? 0;
        if (el) el.scrollTop = (newHeight - prevScrollHeight) + prevScrollTop;
      });
    } catch {
      // можно вывести мягкий hint
    } finally {
      setIsLoadingOlder(false);
    }
  }, [cursor, isLoadingOlder, roomInfo.id, transform]);

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

  /* -------- WebSocket -------- */
  useEffect(() => {
    setWsReady(false);

    // Жёстко зададим базу WS (или возьмём из .env: VITE_WS_BASE_URL=ws://127.0.0.1:8000)
    const WS_BASE: string =
      // @ts-ignore
      (import.meta as any).env?.VITE_WS_BASE_URL || `ws://${window.location.hostname}:8000`;

    const token = getWsToken();
    const wsUrl = `${WS_BASE}/ws/chat/${roomInfo.id}/?token=${encodeURIComponent(token || '')}`;

    console.debug('[CHAT] WS URL:', wsUrl);
    let retry = 0;
    let closedByClient = false;

    const connect = () => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        retry = 0;
        setWsReady(true);
        setHint(null);
        console.debug('[CHAT] WS open');

        // ⚡️ Ping — быстро убеждаемся, что receive работает
        try { ws.send(JSON.stringify({ type: 'ping' })); } catch {}
      };

      ws.onmessage = (e) => {
        console.debug('[CHAT] WS message raw:', e.data); // лог всего входящего
        try {
          const raw = JSON.parse(e.data);
          const norm = normalizeWsPayload(raw);

          if (norm.type === 'message') {
            const meId = user?.id ? String(user.id) : null;
            const item: Message = {
              id: String(norm.id || `ws-${Date.now()}`),
              user_id:
                norm.authorId !== undefined && norm.authorId !== null ? String(norm.authorId) : null,
              username: norm.displayName || 'User',
              content: norm.content || '',
              timestamp: norm.createdAt || new Date().toISOString(),
              is_own:
                (meId !== null && norm.authorId !== undefined && String(norm.authorId) === meId) ||
                (norm.displayName && norm.displayName === myDisplayName),
            };
            setMessages((prev) => [...prev, item]);
          } else if (norm.type === 'typing') {
            setIsTyping(Boolean(norm.isTyping));
            setTimeout(() => setIsTyping(false), 1500);
          } else if (norm.type === 'presence' && norm.count !== undefined) {
            setParticipantCount(Number(norm.count) || 0);
          } else if (norm.type === 'pong') {
            // ok
          } else if (norm.type === 'error') {
            setHint('Ошибка подключения: требуется авторизация или доступ запрещён.');
          }
        } catch {
          // ignore parse
        }
      };

      ws.onclose = (e) => {
        setWsReady(false);
        wsRef.current = null;
        console.warn(`[CHAT] WS close code=${e.code} reason='${e.reason}' wasClean=${e.wasClean}`);

        // Не ретраим, если нет токена или неавторизован
        if (!closedByClient) {
          if (e.code === 4401 || !token) {
            setHint('Требуется авторизация для подключения к чату.');
            return;
          }
          // Экспоненциальный бэк-офф
          retry += 1;
          const timeout = Math.min(15000, 500 * Math.pow(2, retry));
          setTimeout(connect, timeout);
        }
      };

      ws.onerror = (err) => {
        console.error('[CHAT] WS error', err);
        ws.close();
      };
    };

    connect();
    return () => {
      closedByClient = true;
      wsRef.current?.close();
    };
  }, [roomInfo.id, myDisplayName, user?.id]);

  /* -------- Отправка -------- */
  const handleSend = useCallback(() => {
    const text = message.trim();

    console.debug('[CHAT] try send:', {
      readyState: wsRef.current?.readyState,
      hasSocket: !!wsRef.current,
      textLen: text.length,
    });

    if (!text) return;

    if (!wsRef.current) {
      setHint('Нет подключения к сокету. Перезайдите в чат.');
      return;
    }
    if (wsRef.current.readyState !== WebSocket.OPEN) {
      setHint('Соединение устанавливается, попробуйте ещё раз…');
      return;
    }

    setIsSending(true);

    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      user_id: user?.id ? String(user.id) : null,
      username: myDisplayName,
      content: text,
      timestamp: new Date().toISOString(),
      is_own: true,
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const payload = { type: 'message', content: text, displayName: myDisplayName };
      wsRef.current.send(JSON.stringify(payload));
      console.debug('[CHAT] sent payload:', payload);

      setMessage('');
      requestAnimationFrame(() => inputRef.current?.focus());
      requestAnimationFrame(() => lastRef.current?.scrollIntoView({ behavior: 'smooth' }));
      setHint(null);
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setHint('Не удалось отправить сообщение');
    } finally {
      setIsSending(false);
    }
  }, [message, myDisplayName, user?.id]);

  /* -------- Typing -------- */
  const typingTimeout = useRef<number | null>(null);
  const handleTyping = (val: string) => {
    setMessage(val);
    if (!wsReady) return;
    try {
      wsRef.current?.send(JSON.stringify({ type: 'typing', user: myDisplayName, isTyping: true }));
      if (typingTimeout.current) window.clearTimeout(typingTimeout.current);
      typingTimeout.current = window.setTimeout(() => {
        wsRef.current?.send(JSON.stringify({ type: 'typing', user: myDisplayName, isTyping: false }));
      }, 1000);
    } catch {}
  };

  /* автоскролл вниз при новом сообщении */
  useEffect(() => {
    lastRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  /* ================= UI ================= */

  if (loadError && messages.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-3 sm:p-4 bg-gradient-to-r from-indigo-600/50 to-purple-600/50 backdrop-blur-xl border-b border-white/20">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-semibold text-white truncate">
                {roomInfo.country} - {roomInfo.city}
              </h2>
              <p className="text-xs sm:text-sm text-gray-300 truncate">{roomInfo.interest}</p>
            </div>
          </div>
          <button className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0">
            <MoreVertical className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-red-400 mb-4">{loadError}</p>
            <button
              onClick={loadInitial}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Повторить
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:p-4 bg-gradient-to-r from-indigo-600/50 to-purple-600/50 backdrop-blur-xl border-b border-white/20">
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0" aria-label="Назад">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-lg font-semibold text-white truncate">
              {roomInfo.country} - {roomInfo.city}
            </h2>
            <p className="text-xs sm:text-sm text-gray-200 truncate">
              {roomInfo.interest} • {participantCount} участников
              {!wsReady && <span className="ml-2 text-[11px] text-indigo-200">Подключение…</span>}
              {isTyping && <span className="ml-2 text-[11px] text-indigo-200">Печатает…</span>}
            </p>
          </div>
        </div>
        <button className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0" aria-label="Меню">
          <MoreVertical className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 custom-scrollbar">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin mr-3" />
            <span className="text-gray-300">Загрузка...</span>
          </div>
        ) : messages.length > 0 ? (
          <>
            {isLoadingOlder && <div className="text-center text-xs text-gray-400 py-1">Загрузка...</div>}
            {messages.map((m) => (
              <MessageItem key={m.id} m={m} formatTime={formatTime} />
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

      {/* Hint bar */}
      {hint && (
        <div className="px-3 sm:px-4 py-2 bg-red-500/10 text-red-300 text-xs flex items-center space-x-2 border-t border-red-500/20">
          <Info className="w-4 h-4" />
          <span className="truncate">{hint}</span>
          <button className="ml-auto text-indigo-300 hover:text-indigo-200 text-xs underline" onClick={() => setHint(null)}>
            Понятно
          </button>
        </div>
      )}

      {/* Composer */}
      <div className="p-3 sm:p-4 border-t border-white/10 bg-white/5 backdrop-blur-xl flex items-end space-x-2">
        <button className="p-2 hover:bg-white/10 rounded-lg transition-colors" title="Эмодзи" disabled={!wsReady}>
          <Smile className={`w-5 h-5 ${wsReady ? 'text-white/80' : 'text-white/30'}`} />
        </button>
        <button className="p-2 hover:bg-white/10 rounded-lg transition-colors" title="Прикрепить" disabled={!wsReady}>
          <Paperclip className={`w-5 h-5 ${wsReady ? 'text-white/80' : 'text-white/30'}`} />
        </button>

        <div className="flex-1">
          <textarea
            ref={inputRef}
            rows={1}
            value={message}
            onChange={(e) => handleTyping(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={wsReady ? 'Введите сообщение...' : 'Подключение…'}
            className={`w-full resize-none text-white placeholder-gray-400 rounded-xl p-3 focus:outline-none focus:ring-2 ${
              wsReady ? 'bg-white/10 focus:ring-indigo-500/50' : 'bg-white/5 cursor-not-allowed focus:ring-transparent'
            }`}
            disabled={!wsReady}
          />
        </div>

        <button
          onClick={handleSend}
          disabled={isSending || !message.trim() || !wsReady}
          className={`text-white rounded-xl px-3 py-2 transition-colors ${
            isSending || !message.trim() || !wsReady ? 'bg-indigo-500/40 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
          }`}
          aria-label="Отправить"
          title={!wsReady ? 'Подключение…' : 'Отправить'}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

export default ChatInterface;
