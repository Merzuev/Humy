// frontend/src/api/dm.ts
import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api",
  withCredentials: false,
});

// Если хранишь JWT в localStorage:
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export type DMUser = {
  id: number | null;
  nickname: string;
  avatar?: string | null;
};

export type Conversation = {
  id: number;
  type: "private" | "group";
  is_secret: boolean;
  self_destruct_timer: number | null;
  other_user: DMUser | null;
  last_message_text: string | null;
  last_message_created_at: string | null;
  unread_count: number;
};

export type DMMessage = {
  id: string; // UUID
  content: string;
  attachment?: string | null;
  attachment_name?: string | null;
  attachment_type?: string | null;
  created_at: string;
  expires_at?: string | null;
  author: DMUser;
  is_own: boolean;
};

export async function listConversations() {
  const { data } = await API.get<Conversation[]>("/conversations/");
  return data;
}

export async function createConversation(otherUserId: number) {
  const { data } = await API.post<Conversation>("/conversations/", {
    other_user_id: otherUserId,
  });
  return data;
}

export async function listMessages(conversationId: number, cursor?: string) {
  const url = cursor
    ? `/conversations/${conversationId}/messages/?cursor=${encodeURIComponent(cursor)}`
    : `/conversations/${conversationId}/messages/`;
  const { data } = await API.get(url);
  // DRF CursorPagination формат: { results, next, previous }
  return {
    results: data.results as DMMessage[],
    next: data.next as string | null,
    previous: data.previous as string | null,
  };
}

export async function sendMessage(conversationId: number, payload: { content?: string; file?: File | null }) {
  const form = new FormData();
  if (payload.content) form.append("content", payload.content);
  if (payload.file) form.append("attachment", payload.file);
  const { data } = await API.post<DMMessage>(`/conversations/${conversationId}/messages/`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}
