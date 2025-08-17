// frontend/src/hooks/useChatSocket.ts
import { useEffect, useRef } from "react";

type MessageHandler = (event: { type: string; payload: any }) => void;

export function useChatSocket(chatId: number | null, onEvent: MessageHandler) {
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!chatId) return;

    // Если у тебя отдельная переменная для WS_BASE — используй её
    const wsUrlBase = import.meta.env.VITE_WS_BASE_URL || "ws://localhost:8000";
    const url = `${wsUrlBase}/ws/chat/${chatId}/`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      // console.log("WS connected", chatId);
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data?.type && "payload" in data) {
          onEvent({ type: data.type, payload: data.payload });
        }
      } catch {
        // ignore
      }
    };

    ws.onerror = () => {
      // console.warn("WS error", chatId);
    };

    ws.onclose = () => {
      wsRef.current = null;
    };

    return () => {
      ws.close();
    };
  }, [chatId, onEvent]);
}
