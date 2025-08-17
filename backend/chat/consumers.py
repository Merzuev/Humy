# chat/consumers.py
from __future__ import annotations

import json
import logging
from typing import Optional

from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.shortcuts import get_object_or_404
from django.utils import timezone

from .models import Chat, Message, ChatType

logger = logging.getLogger(__name__)
User = get_user_model()

# Простая "присутствовалка" на деве: группа -> множество channel_name
# (В проде используйте Redis + отдельный сервис присутствия)
ROOM_PRESENCE: dict[str, set[str]] = {}


# ---------- helpers (sync/async) ----------
@database_sync_to_async
def user_can_join_room(chat_id: int, user: Optional[User]) -> bool:
    """
    Пускаем:
      - в приватный чат — только участника,
      - в публичные/групповые — всех (как и было).
    """
    try:
        chat = Chat.objects.prefetch_related("participants").get(id=chat_id)
    except Chat.DoesNotExist:
        return False

    if chat.type == ChatType.PRIVATE:
        if not user or isinstance(user, AnonymousUser) or not user.is_authenticated:
            return False
        return chat.participants.filter(pk=user.id).exists()
    # Публичные/прочие — без ограничений
    return True


@database_sync_to_async
def create_message(room_id: int, user_id: int, content: str) -> Message:
    """
    Фоллбэк на случай, если клиент отправляет сообщения через WS.
    Основной поток сообщений идёт через REST.
    """
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


# ---------- Consumer ----------
class ChatConsumer(AsyncJsonWebsocketConsumer):
    """
    Единый WebSocket-консюмер для публичных И приватных чатов.
    Путь: /ws/chat/<room_id>/

    - Для приватных (PRIVATE) — только участники.
    - Для публичных — как раньше, без ограничений.
    - Группа: 'chat_<room_id>' (совместимо с group_send() во вьюхах).
    - История сообщений идёт через REST; WS — для realtime (message/typing/presence/delete).

    Серверные события (из backend):
      - chat_message -> {"type": "message:new", "payload": {...serialized message...}}
      - chat_delete  -> {"type": "message:delete", "payload": {"id": "<message_id>"}}
    """

    async def connect(self):
        user = self.scope.get("user")
        url_kwargs = self.scope.get("url_route", {}).get("kwargs", {})
        self.room_id = _safe_int(
            url_kwargs.get("room_id") or url_kwargs.get("room") or url_kwargs.get("chat_id")
        )
        self.group_name = f"chat_{self.room_id}" if self.room_id else None

        # авторизация обязательна для DM; для публичных — допустим и аноним
        if not self.room_id:
            await self.close(code=4404)  # Not Found
            return

        if not await user_can_join_room(self.room_id, user):
            await self.close(code=4403)  # Forbidden
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
            self.scope.get("path"),
            self.user_id,
            bool(self.user),
            self.room_id,
        )

        # Присоединяемся к группе
        await self.channel_layer.group_add(self.group_name, self.channel_name)

        # Обновляем локальную карту присутствия (dev)
        present = ROOM_PRESENCE.setdefault(self.group_name, set())
        present.add(self.channel_name)
        count = len(present)

        # Оповещение о входе
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

    # ------ входящие от клиента ------
    async def receive_json(self, content, **kwargs):
        """
        Ожидаем от клиента:
        - {"type": "ping"}
        - {"type": "typing", "isTyping": true|false}
        - {"type": "message", "content": "...", "tempId": "tmp-..."}  # фоллбэк, если кто-то всё ещё шлёт через WS
        """
        msg_type = (content or {}).get("type")
        if not msg_type:
            return

        if msg_type == "ping":
            return

        if msg_type == "typing":
            is_typing = bool(content.get("isTyping"))
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "typing_event",
                    "data": {
                        "type": "typing",
                        "isTyping": is_typing,
                        "user_id": self.user_id,
                        "display_name": self.user_display_name,
                        "timestamp": timezone.now().isoformat(),
                    },
                    "sender_channel": self.channel_name,  # чтобы не эхоить отправителю
                },
            )
            return

        # Фоллбэк "отправка через WS": основная логика — через REST
        if msg_type == "message":
            if not self.user_id:
                # Для отправки через WS требуем авторизацию
                return
            text = (content.get("content") or "").strip()
            temp_id = content.get("tempId")
            if not text:
                return

            msg = await create_message(self.room_id, self.user_id, text)

            payload = {
                "id": str(msg.id),
                "room": self.room_id,
                "author": {
                    "id": self.user_id,
                    "nickname": self.user_display_name,
                    "avatar": None,
                },
                "content": msg.content,
                "created_at": (
                    msg.created_at.isoformat()
                    if hasattr(msg, "created_at") and msg.created_at
                    else timezone.now().isoformat()
                ),
                "is_own": False,  # у получателей false; фронт отправителя и так покажет «синим»
                "tempId": temp_id,
            }

            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "chat_message",
                    "message": payload,  # приводим к новому формату
                },
            )
            return

    # ------ обработчики событий группы ------
    async def presence_event(self, event):
        try:
            await self.send_json(event)
        except Exception as e:
            logger.warning("presence_event send error: %s", e)

    async def typing_event(self, event):
        # не эхоим отправителю
        if event.get("sender_channel") == self.channel_name:
            return
        try:
            await self.send_json({"type": "typing", "data": event.get("data", {})})
        except Exception as e:
            logger.warning("typing_event send error: %s", e)

    async def chat_message(self, event):
        """
        Поддерживаем два формата:
          - новый: event = {"type":"chat_message","message":{...}}
          - старый: event = {"type":"chat_message","data":{...}}
        """
        try:
            if "message" in event:
                await self.send_json({"type": "message:new", "payload": event["message"]})
            elif "data" in event:
                await self.send_json({"type": "message:new", "payload": event["data"]})
        except Exception as e:
            logger.warning("chat_message send error: %s", e)

    async def chat_delete(self, event):
        """
        Событие удаления у всех:
          event = {"type": "chat_delete", "id": "<message_id>"}
        """
        msg_id = event.get("id")
        if not msg_id:
            return
        try:
            await self.send_json({"type": "message:delete", "payload": {"id": str(msg_id)}})
        except Exception as e:
            logger.warning("chat_delete send error: %s", e)
