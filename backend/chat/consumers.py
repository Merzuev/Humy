print(f"[WS][IMPORT] chat.consumers loaded from {__file__}")

from typing import Dict, Any

from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from django.contrib.auth import get_user_model

from chat.models import Chat, Message

User = get_user_model()

# Простейший in-memory счётчик (DEV). В проде заменим на Redis.
ROOM_CONNECTIONS: Dict[str, int] = {}  # room_group_name -> count


class ChatConsumer(AsyncJsonWebsocketConsumer):
    """
    WebSocket чат с JWT-авторизацией.
    События: message, typing, presence, ping/pong.
    Формат исходящих сообщений под фронт: {"type": "<event>", "data": {...}}.
    """

    async def connect(self):
        user = self.scope.get("user")
        path = self.scope.get("path")
        self.room_id = self.scope.get("url_route", {}).get("kwargs", {}).get("room_id")
        self.room_group_name = f"chat_{self.room_id}"

        print(
            f"[WS][CONNECT] path={path} user_id={getattr(user,'id',None)} "
            f"auth={getattr(user,'is_authenticated',False)} room_id={self.room_id}"
        )

        try:
            # Примем сразу, чтобы исключить 1006, а затем проверим доступ
            await self.accept()
            print("[WS][STEP] accepted")

            # Авторизация
            if not (user and getattr(user, "is_authenticated", False)):
                await self.send_json({"type": "error", "data": {"code": 4401, "message": "Unauthorized"}})
                await self.close(code=4401)
                print("[WS][CLOSE] 4401 Unauthorized")
                return

            # Проверка channel layer
            if not getattr(self, "channel_layer", None):
                await self.send_json({"type": "error", "data": {"code": 1011, "message": "No channel layer configured"}})
                await self.close(code=1011)
                print("[WS][CLOSE] 1011 No channel layer")
                return
            print("[WS][STEP] channel layer OK")

            # Проверка комнаты
            exists = await self._room_exists(self.room_id)
            print(f"[WS][STEP] room_exists={exists}")
            if not exists:
                await self.send_json({"type": "error", "data": {"code": 4403, "message": "Room not found"}})
                await self.close(code=4403)
                print("[WS][CLOSE] 4403 Room not found")
                return

            # Вступаем в группу
            await self.channel_layer.group_add(self.room_group_name, self.channel_name)
            print(f"[WS][STEP] group_add -> {self.room_group_name}")

            # Presence: join
            ROOM_CONNECTIONS[self.room_group_name] = ROOM_CONNECTIONS.get(self.room_group_name, 0) + 1
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "presence_event",
                    "event": "join",
                    "user_id": user.id,
                    "count": ROOM_CONNECTIONS[self.room_group_name],
                    "timestamp": timezone.now().isoformat(),
                },
            )
            print(f"[WS][STEP] presence join -> count={ROOM_CONNECTIONS[self.room_group_name]}")

        except Exception as e:
            print(f"[WS][FATAL] connect(): {e}")
            try:
                await self.send_json({"type": "error", "data": {"code": 1011, "message": str(e)}})
            except Exception:
                pass
            await self.close(code=1011)

    async def disconnect(self, code):
        try:
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
            print(f"[WS][STEP] group_discard {self.room_group_name}")
        except Exception as e:
            print(f"[WS][WARN] disconnect.group_discard: {e}")

        if hasattr(self, "room_group_name"):
            ROOM_CONNECTIONS[self.room_group_name] = max(0, ROOM_CONNECTIONS.get(self.room_group_name, 1) - 1)
            user = self.scope.get("user")
            if user and getattr(user, "is_authenticated", False):
                try:
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            "type": "presence_event",
                            "event": "leave",
                            "user_id": user.id,
                            "count": ROOM_CONNECTIONS[self.room_group_name],
                            "timestamp": timezone.now().isoformat(),
                        },
                    )
                    print(f"[WS][STEP] presence leave -> count={ROOM_CONNECTIONS[self.room_group_name]}")
                except Exception as e:
                    print(f"[WS][WARN] disconnect.presence_send: {e}")

    async def receive_json(self, content: Any, **kwargs):
        user = self.scope.get("user")
        print(f"[WS][RECV] from user={getattr(user,'id',None)} payload={content}")

        if not (user and getattr(user, "is_authenticated", False)):
            await self.send_json({"type": "error", "data": {"code": 4401, "message": "Unauthorized"}})
            await self.close(code=4401)
            print("[WS][RECV] closed: 4401 Unauthorized")
            return

        msg_type = content.get("type")

        # ping/pong — быстрый тест канала
        if msg_type == "ping":
            await self.send_json({"type": "pong", "data": {"ts": timezone.now().isoformat()}})
            print("[WS][RECV] pong sent")
            return

        if msg_type == "typing":
            is_typing = bool(content.get("isTyping"))
            try:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {"type": "typing_event", "user_id": user.id, "is_typing": is_typing},
                )
            except Exception as e:
                print(f"[WS][ERROR] typing group_send: {e}")
            return

        if msg_type == "message":
            text = (content.get("content") or "").strip()
            if not text:
                print("[WS][RECV] empty message ignored")
                return

            display_name = (
                content.get("displayName")
                or getattr(user, "nickname", None)
                or getattr(user, "email", None)
                or "User"
            )

            try:
                msg = await self._save_message(
                    room_id=self.room_id,
                    author_id=user.id,
                    content=text,
                    display_name=display_name,
                )
                print(f"[WS][MSG] saved id={msg['id']} content='{msg['content'][:50]}'")
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        "type": "chat_message",
                        "id": msg["id"],
                        "content": msg["content"],
                        "author": msg["author_id"],
                        "display_name": msg["display_name"],
                        "created_at": msg["created_at"],
                    },
                )
                print("[WS][MSG] broadcasted")
            except Exception as e:
                print(f"[WS][ERROR] save/broadcast message: {e}")
                await self.send_json({"type": "error", "data": {"code": 1011, "message": "Message failed"}})
            return

        # Неподдерживаемый тип
        await self.send_json({"type": "error", "data": {"code": 4000, "message": f"Unknown type: {msg_type}"}})
        print(f"[WS][RECV] unknown type: {msg_type}")

    # ====== Исходящие события для группы ======

    async def chat_message(self, event):
        await self.send_json({
            "type": "message",
            "data": {
                "id": event["id"],
                "content": event["content"],
                "author": event.get("author"),
                "display_name": event["display_name"],
                "created_at": event["created_at"],
            }
        })

    async def typing_event(self, event):
        await self.send_json({
            "type": "typing",
            "data": {
                "user_id": event["user_id"],
                "isTyping": event["is_typing"],
            }
        })

    async def presence_event(self, event):
        await self.send_json({
            "type": "presence",
            "data": {
                "event": event["event"],        # "join" | "leave"
                "user_id": event["user_id"],
                "count": event["count"],
                "timestamp": event["timestamp"],
            }
        })

    # ====== БД ======

    @database_sync_to_async
    def _room_exists(self, room_id: str) -> bool:
        return Chat.objects.filter(id=room_id).exists()

    @database_sync_to_async
    def _save_message(self, room_id: str, author_id: int, content: str, display_name: str) -> dict:
        msg = Message.objects.create(
            room_id=room_id,
            author_id=author_id,
            content=content,
            display_name=display_name,
        )
        return {
            "id": str(msg.id),
            "author_id": author_id,
            "content": msg.content,
            "display_name": display_name,
            "created_at": msg.created_at.isoformat(),
        }
