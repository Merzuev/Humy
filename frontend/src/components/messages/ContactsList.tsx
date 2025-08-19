// src/components/messages/ContactsList.tsx
import React, { memo } from "react";
import { AlertCircle, Loader2, MessageCircle, User, Image as ImageIcon, Volume2, Play, File as FileIcon } from "lucide-react";
import { Button } from "../ui/Button";
import type { Contact } from "./PersonalMessages";

type Props = {
  contacts: Contact[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  selectedId?: number;
  onSelect: (c: Contact) => void;
  formatTime: (ts: string) => string;
};

const ContactsList: React.FC<Props> = ({
  contacts,
  loading,
  error,
  onRetry,
  selectedId,
  onSelect,
  formatTime,
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-white">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="ml-2 text-white/80">Загрузка диалогов…</span>
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
  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-white/70">
        <MessageCircle className="w-12 h-12 mb-4 text-white/30" />
        <p className="text-lg font-medium">Никаких разговоров</p>
        <p className="text-sm text-center">Начните новый диалог, чтобы перейти к обмену сообщениями</p>
      </div>
    );
  }

  return (
    <>
      {contacts.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c)}
          className={`w-full text-left px-3 py-2 border-b transition ${
            selectedId === c.id ? "bg-white/10 border-white/20" : "border-white/10 hover:bg-white/5"
          }`}
        >
          <div className="flex items-center gap-3 text-white">
            <div className="relative">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500/40 to-purple-500/40 flex items-center justify-center">
                {c.avatar ? <img src={c.avatar} alt={c.name} className="w-full h-full object-cover" /> : <User className="w-6 h-6 opacity-70" />}
              </div>
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ring-2 ring-background ${
                  c.isOnline ? "bg-emerald-400" : "bg-zinc-500/50"
                }`}
                title={c.isOnline ? "Онлайн" : "Оффлайн"}
              />
              {c.unreadCount ? (
                <span className="absolute -top-1 -left-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-[11px] font-semibold text-white flex items-center justify-center">
                  {c.unreadCount > 99 ? "99+" : c.unreadCount}
                </span>
              ) : null}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className={`truncate ${c.unreadCount ? "font-semibold" : "font-medium"}`}>{c.name}</h3>
                {c.lastMessageTime && (
                  <span className="ml-auto text-xs text-white/50 shrink-0">{formatTime(c.lastMessageTime)}</span>
                )}
              </div>

              {/* последняя строка */}
              <div className={`truncate text-sm ${c.unreadCount ? "text-white" : "text-white/60"}`}>
                {/* значок вложения */}
                {c.lastMessageAttachmentKind === "image" ? (
                  <>
                    <ImageIcon className="inline h-4 w-4 mr-1 align-text-bottom" /> Фото{" · "}
                  </>
                ) : c.lastMessageAttachmentKind === "audio" ? (
                  <>
                    <Volume2 className="inline h-4 w-4 mr-1 align-text-bottom" /> Аудио{" · "}
                  </>
                ) : c.lastMessageAttachmentKind === "video" ? (
                  <>
                    <Play className="inline h-4 w-4 mr-1 align-text-bottom" /> Видео{" · "}
                  </>
                ) : c.lastMessageAttachmentKind === "file" ? (
                  <>
                    <FileIcon className="inline h-4 w-4 mr-1 align-text-bottom" /> Файл{" · "}
                  </>
                ) : null}
                {c.lastMessageIsOwn ? "Вы: " : ""}
                {c.lastMessage ?? ""}
              </div>
            </div>
          </div>
        </button>
      ))}
    </>
  );
};

export default memo(ContactsList);
