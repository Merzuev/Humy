// frontend/src/notifications/notificationsApi.ts

function getApiBase(): string {
  const env = (import.meta as any).env || {};
  return (env.VITE_API_BASE_URL as string) || "/api";
}

function getAccessToken(): string | null {
  return (
    localStorage.getItem("accessToken") ||
    localStorage.getItem("access") ||
    localStorage.getItem("jwt")
  );
}

async function apiFetch(path: string, init?: RequestInit) {
  const base = getApiBase().replace(/\/+$/, "");
  const url = `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  const token = getAccessToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as any),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.json().catch(() => null);
}

export const notificationsApi = {
  async listUnread(page: number = 1, pageSize: number = 20) {
    return apiFetch(`/notifications/?is_read=false&page=${page}&page_size=${pageSize}`);
  },
  async markAllRead() {
    return apiFetch(`/notifications/mark-read/`, {
      method: "POST",
      body: JSON.stringify({ all: true }),
    });
  },
  async markRead(ids: number[]) {
    return apiFetch(`/notifications/mark-read/`, {
      method: "POST",
      body: JSON.stringify({ ids }),
    });
  },
};
