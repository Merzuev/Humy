// frontend/src/notifications/notificationsStore.ts
// Простой store с подписками: без сторонних библиотек.

export type UIToastLevel = "info" | "success" | "warning" | "error";

export type UIToast = {
  id: string;
  title?: string;
  text?: string;
  type?: string;       // системный тип из backend (dm.badge / presence / friend.request)
  level?: UIToastLevel;
  createdAt: number;
  payload?: any;
};

type Listener = () => void;

class NotificationsStore {
  private _unreadCount = 0;
  private _items: UIToast[] = [];
  private listeners = new Set<Listener>();

  get unreadCount() {
    return this._unreadCount;
  }
  get items() {
    return this._items;
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  setUnreadCount(n: number) {
    this._unreadCount = Math.max(0, Number(n) || 0);
    this.emit();
  }

  prepend(item: UIToast) {
    this._items = [item, ...this._items].slice(0, 50); // держим последние 50
    this.emit();
  }

  markAllRead() {
    this._unreadCount = 0;
    this.emit();
  }
}

export const notificationsStore = new NotificationsStore();
