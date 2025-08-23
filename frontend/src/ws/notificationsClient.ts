// frontend/src/ws/notificationsClient.ts
// Клиент WS с автопереподключением, heartbeat и универсальным разбором сообщений.

type NotificationMessage =
  | { kind: "meta:init"; unread_count: number }
  | { kind: "notification"; type: string; unread_count?: number; payload?: any }
  // Совместимость со старым форматом (твой текущий consumer шлёт просто {type: "...", ...})
  | { type: string; [k: string]: any };

type Listener = (msg: NotificationMessage) => void;

function getAccessToken(): string | null {
  // ⚠️ ПРИ НЕОБХОДИМОСТИ поменяй ключи: ниже перебор популярных вариантов.
  return (
    localStorage.getItem("accessToken") ||
    localStorage.getItem("access") ||
    localStorage.getItem("jwt") ||
    (() => {
      try {
        const obj = JSON.parse(localStorage.getItem("auth") || "null");
        return obj?.accessToken || obj?.access || null;
      } catch {
        return null;
      }
    })()
  );
}

function getWsAuthority(): string {
  // 1) если задан VITE_WS_BASE (например, 127.0.0.1:8000), используем его
  const env = (import.meta as any).env || {};
  const base = env.VITE_WS_BASE as string | undefined;
  if (base) return base.replace(/^ws(s)?:\/\//, "").replace(/^http(s)?:\/\//, "");
  // 2) иначе берём хост из текущей страницы
  return window.location.host;
}

function getWsProtocol(): "ws" | "wss" {
  return window.location.protocol === "https:" ? "wss" : "ws";
}

export class NotificationsClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private connecting = false;
  private stopped = false;

  private reconnectAttempt = 0;
  private heartbeatTimer: any = null;
  private reconnectTimer: any = null;

  start() {
    this.stopped = false;
    this.connect();
  }

  stop() {
    this.stopped = true;
    this.clearHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(msg: NotificationMessage) {
    this.listeners.forEach((fn) => {
      try {
        fn(msg);
      } catch (e) {
        console.error("notificationsClient listener error", e);
      }
    });
  }

  private connect() {
    if (this.connecting || this.ws || this.stopped) return;
    this.connecting = true;

    const token = getAccessToken();
    const proto = getWsProtocol();
    const authority = getWsAuthority(); // напр. 127.0.0.1:8000
    // твой бекэнд слушает по пути /ws/notifications/ (см. notifications/routing.py)
    const url = `${proto}://${authority}/ws/notifications/${token ? `?token=${encodeURIComponent(token)}` : ""}`;

    try {
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => {
        this.connecting = false;
        this.reconnectAttempt = 0;
        this.startHeartbeat();
        // Можно отправить легкий ping-объект, consumer его просто проигнорирует
        this.safeSend({ type: "ping", ts: Date.now() });
      };

      ws.onmessage = (ev) => {
        let data: any;
        try {
          data = JSON.parse(ev.data);
        } catch {
          // Не JSON — проигнорируем
          return;
        }

        // Приведём к унифицированному виду (совместимость со старым форматом)
        if (data?.kind === "meta:init") {
          this.emit({ kind: "meta:init", unread_count: Number(data.unread_count || 0) });
          return;
        }
        if (data?.kind === "notification") {
          this.emit({
            kind: "notification",
            type: String(data.type || ""),
            unread_count: typeof data.unread_count === "number" ? data.unread_count : undefined,
            payload: data.payload,
          });
          return;
        }
        if (typeof data?.type === "string") {
          // Старый формат: { type: "presence" | "dm:badge" | "friend:request", ... }
          this.emit(data as NotificationMessage);
        }
      };

      ws.onerror = () => {
        // Ошибки WS — пробуем переподключиться
        this.scheduleReconnect();
      };

      ws.onclose = () => {
        this.clearHeartbeat();
        this.ws = null;
        if (!this.stopped) this.scheduleReconnect();
      };
    } catch (e) {
      console.error("WS connect error", e);
      this.connecting = false;
      this.scheduleReconnect();
    }
  }

  private safeSend(obj: any) {
    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(obj));
      }
    } catch {}
  }

  private startHeartbeat() {
    this.clearHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.safeSend({ type: "ping", ts: Date.now() });
    }, 25_000); // 25 сек
  }

  private clearHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.stopped) return;
    if (this.reconnectTimer) return;
    this.connecting = false;

    const delay = Math.min(30_000, 1_000 * Math.pow(2, this.reconnectAttempt)); // 1s, 2s, 4s... до 30s
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}

// Синглтон
export const notificationsClient = new NotificationsClient();
