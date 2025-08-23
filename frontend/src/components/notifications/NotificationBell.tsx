// frontend/src/components/notifications/NotificationBell.tsx
import React, { useEffect, useMemo, useState } from "react";
import { notificationsClient } from "@/ws/notificationsClient";
import { notificationsStore, UIToast } from "@/notifications/notificationsStore";
import { notificationsApi } from "@/notifications/notificationsApi";

function useNotificationsState() {
  const [, force] = useState(0);
  useEffect(() => notificationsStore.subscribe(() => force((n) => n + 1)), []);
  return {
    unreadCount: notificationsStore.unreadCount,
    items: notificationsStore.items,
  };
}

function typeToText(t?: string, payload?: any): { title: string; text?: string } {
  switch (t) {
    case "friend.request":
    case "friend:request":
      return { title: "Заявка в друзья", text: payload?.from_name ? `От ${payload.from_name}` : undefined };
    case "friend.accept":
    case "friend:accept":
      return { title: "Заявка принята", text: payload?.by_name ? `${payload.by_name} теперь в друзьях` : undefined };
    case "dm.badge":
    case "dm:badge":
      return { title: "Новое сообщение", text: payload?.from_name ? `От ${payload.from_name}` : undefined };
    case "dm.read":
    case "dm:read":
      return { title: "Сообщение прочитано", text: payload?.by_name ? `${payload.by_name} прочитал(а)` : undefined };
    case "presence":
      return { title: "Статус", text: payload?.online ? "Друг онлайн" : "Друг офлайн" };
    default:
      return { title: payload?.title || "Уведомление", text: payload?.text };
  }
}

export const NotificationBell: React.FC = () => {
  const { unreadCount, items } = useNotificationsState();
  const [open, setOpen] = useState(false);
  const topItems = useMemo(() => items.slice(0, 10), [items]);

  useEffect(() => {
    // Подписка на WS-сообщения
    const unsub = notificationsClient.subscribe((msg) => {
      if (msg.kind === "meta:init") {
        notificationsStore.setUnreadCount(msg.unread_count);
        return;
      }
      if (msg.kind === "notification") {
        if (typeof msg.unread_count === "number") {
          notificationsStore.setUnreadCount(msg.unread_count);
        } else {
          // Если сервер не прислал unread_count, увеличим бейдж на 1 (чтобы не терять)
          notificationsStore.setUnreadCount(notificationsStore.unreadCount + 1);
        }
        const { title, text } = typeToText(msg.type, msg.payload);
        const toast: UIToast = {
          id: String(Date.now()) + Math.random().toString(16).slice(2),
          type: msg.type,
          title,
          text,
          payload: msg.payload,
          createdAt: Date.now(),
        };
        notificationsStore.prepend(toast);
        return;
      }
      // Старый формат: просто {type: "...", ...}
      if (typeof (msg as any)?.type === "string") {
        const m = msg as any;
        const { title, text } = typeToText(m.type, m);
        const toast: UIToast = {
          id: String(Date.now()) + Math.random().toString(16).slice(2),
          type: m.type,
          title,
          text,
          payload: m,
          createdAt: Date.now(),
        };
        notificationsStore.setUnreadCount(notificationsStore.unreadCount + 1);
        notificationsStore.prepend(toast);
      }
    });

    // Запускаем клиент при монтировании шапки
    notificationsClient.start();
    return () => {
      unsub();
      // Не останавливаем клиент на размонтировании колокольчика, чтобы он жил на всём приложении
    };
  }, []);

  const handleMarkAll = async () => {
    try {
      await notificationsApi.markAllRead();
      notificationsStore.markAllRead();
    } catch (e: any) {
      console.error(e);
      alert("Не удалось пометить прочитанными.");
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex items-center justify-center rounded-full p-2 hover:opacity-80 transition"
        aria-label="Уведомления"
        title="Уведомления"
      >
        {/* Иконка колокольчика (простая, без сторонних пакетов) */}
        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
          <path d="M12 24a2.4 2.4 0 0 0 2.4-2.4h-4.8A2.4 2.4 0 0 0 12 24Zm8.4-6v-6a8.4 8.4 0 1 0-16.8 0v6L1.2 20.4v1.2h21.6v-1.2L20.4 18Z" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full text-xs flex items-center justify-center px-1 bg-red-600 text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-auto rounded-xl shadow-xl border border-neutral-700 bg-neutral-900 text-white p-2 z-50">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold">Уведомления</div>
            <button
              onClick={handleMarkAll}
              className="text-xs px-2 py-1 rounded-md border border-neutral-600 hover:bg-neutral-800"
            >
              Отметить всё прочитанным
            </button>
          </div>

          {topItems.length === 0 ? (
            <div className="text-sm opacity-70 p-3">Пока нет уведомлений</div>
          ) : (
            <ul className="space-y-2">
              {topItems.map((n) => (
                <li key={n.id} className="p-2 rounded-lg bg-neutral-800/60">
                  <div className="text-sm font-medium">
                    {n.title || n.type || "Уведомление"}
                  </div>
                  {n.text && <div className="text-xs opacity-80 mt-0.5">{n.text}</div>}
                  <div className="text-[10px] opacity-60 mt-1">
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
