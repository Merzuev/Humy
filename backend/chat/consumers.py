# backend/chat/consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
from django.utils import timezone

from .models import Chat, Message

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_id = self.scope["url_route"]["kwargs"]["room_id"]
        self.group_name = f"chat_{self.room_id}"

        # подключаемся всегда (анонимам тоже можно в DEV)
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # простое присутствие
        await self.channel_layer.group_send(self.group_name, {
            "type": "presence",
            "count": 0,  # можно посчитать реальное кол-во, если нужно
        })

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        try:
            payload = json.loads(text_data or "{}")
        except Exception:
            return

        msg_type = payload.get("type")

        if msg_type == "typing":
            await self.channel_layer.group_send(self.group_name, {
                "type": "typing",
                "user": payload.get("user"),
                "isTyping": bool(payload.get("isTyping")),
            })
            return

        if msg_type == "message":
            content = (payload.get("content") or "").strip()
            display_name = payload.get("displayName") or (self.scope.get("user").username if self.scope.get("user").is_authenticated else "User")
            if not content:
                return

            # сохраняем в БД
            msg = await self._save_message(self.room_id, self.scope.get("user"), content, display_name)

            data = {
                "id": msg.id,
                "content": msg.content,
                "display_name": display_name,
                "created_at": msg.created_at.isoformat(),
            }
            await self.channel_layer.group_send(self.group_name, {
                "type": "chat_message",
                "data": data,
            })

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({"type": "message", "data": event.get("data")}))

    async def typing(self, event):
        await self.send(text_data=json.dumps({"type": "typing", "data": {"user": event.get("user"), "isTyping": event.get("isTyping")}}))

    async def presence(self, event):
        await self.send(text_data=json.dumps({"type": "presence", "data": {"count": event.get("count", 0)}}))

    @sync_to_async
    def _save_message(self, room_id, user, content, display_name):
        room = Chat.objects.get(id=room_id)
        return Message.objects.create(
            room=room,
            author=user if getattr(user, "is_authenticated", False) else None,
            content=content,
            display_name=display_name,
            created_at=timezone.now(),
        )
