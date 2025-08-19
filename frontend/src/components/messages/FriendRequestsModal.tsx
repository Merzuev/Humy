// src/components/messages/FriendRequestsModal.tsx
import React from "react";
import { Button } from "../ui/Button";
import { Loader2, Check, X } from "lucide-react";

type AppUser = {
  id: number;
  username?: string;
  nickname?: string;
  email?: string;
  avatar?: string | null;
};

export type FriendRequestItem = {
  id: number;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  from_user: AppUser;
  to_user: AppUser;
};

type RequestsTab = "incoming" | "outgoing" | "all";

type Props = {
  tab: RequestsTab;
  setTab: (t: RequestsTab) => void;
  requests: FriendRequestItem[];
  loading: boolean;
  onAccept: (id: number) => void;
  onReject: (id: number) => void;
  onClose: () => void;
};

const FriendRequestsModal: React.FC<Props> = ({
  tab,
  setTab,
  requests,
  loading,
  onAccept,
  onReject,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-white/10 text-white">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Заявки в друзья</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Закрыть
          </Button>
        </div>

        <div className="p-4">
          <div className="inline-flex p-1 rounded-xl bg-white/10 mb-4">
            {(["incoming", "outgoing", "all"] as RequestsTab[]).map((t) => (
              <button
                key={t}
                className={`px-3 py-1.5 rounded-lg text-sm transition ${
                  tab === t ? "bg-white text-black" : "text-white/80 hover:bg-white/10"
                }`}
                onClick={() => setTab(t)}
              >
                {t === "incoming" ? "Входящие" : t === "outgoing" ? "Исходящие" : "Все"}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="ml-2 text-white/80">Загрузка…</span>
            </div>
          ) : requests.length === 0 ? (
            <p className="text-white/70">Нет заявок.</p>
          ) : (
            <ul className="space-y-3">
              {requests.map((r) => {
                const other = r.from_user || r.to_user;
                return (
                  <li key={r.id} className="flex items-center justify-between rounded-xl border border-white/10 p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 flex items-center justify-center">
                        {other?.avatar ? (
                          <img src={other.avatar} alt={other.nickname || other.username || "user"} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-white/20" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium">{other?.nickname || other?.username || `ID ${other?.id}`}</div>
                        <div className="text-xs text-white/60">
                          {new Date(r.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    {r.status === "pending" ? (
                      <div className="flex gap-2">
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white" onClick={() => onAccept(r.id)}>
                          <Check className="w-4 h-4 mr-1" /> Принять
                        </Button>
                        <Button size="sm" variant="outline" className="border-white/20 text-white hover:bg-white/10" onClick={() => onReject(r.id)}>
                          <X className="w-4 h-4 mr-1" /> Отклонить
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-white/60">
                        {r.status === "accepted" ? "Принята" : "Отклонена"}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default FriendRequestsModal;
