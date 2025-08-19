// src/components/messages/FriendsList.tsx
import React from "react";
import { AlertCircle, Loader2, MessageCircle, Trash2, Ban, User } from "lucide-react";
import { Button } from "../ui/Button";
import type { Contact } from "./PersonalMessages";

type Props = {
  friends: Contact[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenChat: (friend: Contact) => void;
  onRemove: (userId: number) => void;
  onBlock: (userId: number) => void;
};

const FriendsList: React.FC<Props> = ({
  friends,
  loading,
  error,
  onRetry,
  onOpenChat,
  onRemove,
  onBlock,
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-white">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="ml-2 text-white/80">Загрузка друзей…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        <AlertCircle className="w-8 h-8 text-rose-400 mb-2" />
        <p className="text-rose-300 mb-4">{error}</p>
        <Button onClick={onRetry} variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10">
          Повторить
        </Button>
      </div>
    );
  }
  if (friends.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-white/70">
        <User className="w-12 h-12 mb-4 text-white/30" />
        <p className="text-lg font-medium">Друзей нет</p>
        <p className="text-sm text-center">Добавьте друзей и начните общение</p>
      </div>
    );
  }

  return (
    <>
      {friends.map((friend) => (
        <div key={friend.id} className="border-b border-white/10">
          <button
            className="w-full text-left px-3 py-2 transition hover:bg-white/5"
            onClick={() => onOpenChat(friend)}
          >
            <div className="flex items-center gap-3 text-white">
              <div className="relative">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500/40 to-purple-500/40 flex items-center justify-center">
                  {friend.avatar ? (
                    <img src={friend.avatar} alt={friend.name} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-6 h-6 opacity-70" />
                  )}
                </div>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ring-2 ring-background ${
                    friend.isOnline ? "bg-emerald-400" : "bg-zinc-500/50"
                  }`}
                  title={friend.isOnline ? "Онлайн" : "Оффлайн"}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-medium">{friend.name}</h3>
                </div>
              </div>
            </div>
          </button>

          <div className="px-4 pb-3 -mt-2">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-500 text-white"
                onClick={() => onOpenChat(friend)}
              >
                <MessageCircle className="w-4 h-4 mr-1" /> Чат
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
                onClick={() => onRemove(friend.id)}
              >
                <Trash2 className="w-4 h-4 mr-1" /> Удалить
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
                onClick={() => onBlock(friend.id)}
              >
                <Ban className="w-4 h-4 mr-1" /> Блок
              </Button>
            </div>
          </div>
        </div>
      ))}
    </>
  );
};

export default FriendsList;
