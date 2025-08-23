# chat/consumers.py
from __future__ import annotations

import logging
from typing import Optional

from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.utils import timezone

from .models import Chat, Message, ChatType

logger = logging.getLogger(__name__)
User = get_user_model()

# На деве храним "присутствие" в памяти
ROOM_PRESENCE: dict[str, set[str]] = {}


@database_sync_to_async
def user_can_join_room(chat_id: int, user: Optional[User]) -> bool:
    try:
        chat = Chat.objects.prefetch_related("participants").get(id=chat_id)
    except Chat.DoesNotExist:
        return False

    if chat.type == ChatType.PRIVATE:
        if not user or isinstance(user, AnonymousUser) or not user.is_authenticated:
            return False
        return chat.participants.filter(pk=user.id).exists()
    return True


@database_sync_to_async
def create_message(room_id: int, user_id: int, content: str) -> Message:
    return Message.objects.create(room_id=room_id, author_id=user_id, content=content)


@database_sync_to_async
def get_user_display_name(user_id: int) -> str:
    try:
        u = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return "User"
    for field in ("nickname", "display_name", "username", "email", "first_name"):
        if hasattr(u, field):
            val = getattr(u, field)
            if val:
                return str(val)
    return "User"


def _safe_int(value, default=None) -> Optional[int]:
    try:
        return int(value)
    except Exception:
        return default


class ChatConsumer(AsyncJsonWebsocketConsumer):
    """
    /ws/chat/<room_id>/
    - PRIVATE: только участники
    - GROUP/публичные: без ограничений
    События группы:
      - chat_message -> {"type": "message:new", "payload": {...}}
      - chat_delete  -> {"type": "message:delete", "payload": {"id": "..."}}
      - presence_event -> {"type":"presence", "event":"join|leave", ...}
    """

    async def connect(self):
        user = self.scope.get("user")
        url_kwargs = self.scope.get("url_route", {}).get("kwargs", {})
        self.room_id = _safe_int(url_kwargs.get("room_id"))
        self.group_name = f"chat_{self.room_id}" if self.room_id else None

        if not self.room_id:
            await self.close(code=4404)
            return

        if not await user_can_join_room(self.room_id, user):
            await self.close(code=4403)
            return

        self.user = user if user and getattr(user, "is_authenticated", False) else None
        self.user_id = int(getattr(self.user, "id", 0) or 0) or None
        self.user_display_name = (
            await get_user_display_name(self.user_id)
            if self.user_id else "Guest"
        )

        await self.accept()
        logger.info(
            "[WS][CONNECT] path=%s user_id=%s auth=%s room_id=%s",
            self.scope.get("path"), self.user_id, bool(self.user), self.room_id,
        )

        await self.channel_layer.group_add(self.group_name, self.channel_name)

        present = ROOM_PRESENCE.setdefault(self.group_name, set())
        present.add(self.channel_name)
        count = len(present)

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "presence_event",
                "data": {
                    "type": "presence",
                    "event": "join",
                    "user_id": self.user_id,
                    "display_name": self.user_display_name,
                    "count": count,
                    "timestamp": timezone.now().isoformat(),
                },
            },
        )

    async def disconnect(self, code):
        try:
            if getattr(self, "group_name", None):
                await self.channel_layer.group_discard(self.group_name, self.channel_name)

                present = ROOM_PRESENCE.get(self.group_name)
                if present and self.channel_name in present:
                    present.remove(self.channel_name)
                count = len(present) if present else 0

                await self.channel_layer.group_send(
                    self.group_name,
                    {
                        "type": "presence_event",
                        "data": {
                            "type": "presence",
                            "event": "leave",
                            "user_id": getattr(self, "user_id", None),
                            "display_name": getattr(self, "user_display_name", None),
                            "count": count,
                            "timestamp": timezone.now().isoformat(),
                        },
                    },
                )
        except Exception as e:
            logger.warning("Disconnect cleanup error: %s", e)
        finally:
            await super().disconnect(code)

    async def receive_json(self, content, **kwargs):
        """
        Принимаем от клиента:
          - {"type":"ping"}
          - {"type":"typing", "value": true|false}
          - {"type":"message", "content":"..."} — фоллбэк на отправку через WS (основной поток через REST)
        """
        t = (content.get("type") or "").lower()
        if t == "ping":
            await self.send_json({"type": "pong", "ts": timezone.now().isoformat()})
            return

        if t == "typing":
            await self.channel_layer.group_send(
                self.group_name,
                {"type": "typing_event",
                 "data": {"type": "typing", "user_id": self.user_id, "value": bool(content.get("value"))}}
            )
            return

        if t == "message":
            if not self.user_id:
                return
            text = str(content.get("content") or "")[:5000]
            msg = await create_message(self.room_id, self.user_id, text)
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "chat_message",
                    "data": {
                        "id": str(msg.id),
                        "room": self.room_id,
                        "author_id": self.user_id,
                        "display_name": self.user_display_name,
                        "content": msg.content,
                        "attachment_url": None,
                        "attachment_name": "",
                        "attachment_type": "",
                        "created_at": msg.created_at.isoformat() if getattr(msg, "created_at", None) else timezone.now().isoformat(),
                        "meta": {},
                    },
                },
            )

    # ---- события группы -> клиент ----
    async def chat_message(self, event):
        await self.send_json(event.get("data") or event)

    async def chat_delete(self, event):
        await self.send_json({"type": "message:delete", "payload": {"id": event.get("id")}})

    async def presence_event(self, event):
        await self.send_json(event.get("data") or event)

    async def typing_event(self, event):
        await self.send_json(event.get("data") or event)
