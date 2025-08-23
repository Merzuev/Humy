# notifications/consumers.py
from __future__ import annotations

import asyncio
from typing import Optional

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth import get_user_model
from django.utils import timezone

from notifications.utils import a_notify_friends_ids

User = get_user_model()


class NotificationsConsumer(AsyncJsonWebsocketConsumer):
    """
    Индивидуальные уведомления пользователю:
      - friend:request, friend:accept
      - dm:badge, dm:read
      - presence
    """
    OFFLINE_DELAY_SEC = 20

    async def connect(self):
        user = self.scope.get("user")
        if not user or not user.is_authenticated:
            await self.close(code=4401)
            return

        self.user_id: int = int(user.id)
        self.user_group = f"user_{self.user_id}"
        self._offline_task: Optional[asyncio.Task] = None

        try:
            if self.channel_layer:
                await self.channel_layer.group_add(self.user_group, self.channel_name)
            await self.accept()

            # начальная мета-информация
            unread_count = await _get_unread_count(self.user_id)
            await self.send_json({"kind": "meta:init", "unread_count": unread_count})

            await self._safe_set_presence(True)
        except Exception:
            try:
                await self.close(code=1011)
            finally:
                return

    async def disconnect(self, code):
        try:
            if getattr(self, "user_group", None) and self.channel_layer:
                await self.channel_layer.group_discard(self.user_group, self.channel_name)
        except Exception:
            pass

        if getattr(self, "user_id", None):
            self._offline_task = asyncio.create_task(self._delayed_offline_safe())

    # ===== group handlers (все приводим к единому формату) =====

    async def friend_request(self, event):
        await self._send_event("friend.request", event)

    async def friend_accept(self, event):
        await self._send_event("friend.accept", event)

    async def dm_badge(self, event):
        await self._send_event("dm.badge", event)

    async def dm_read(self, event):
        await self._send_event("dm.read", event)

    async def presence(self, event):
        await self._send_event("presence", event)

    async def _send_event(self, event_type: str, event: dict):
        payload = {k: v for k, v in event.items() if k != "type"}
        unread_count = await _get_unread_count(self.user_id)
        message = {
            "kind": "notification",
            "type": event_type,
            "unread_count": unread_count,
            "payload": payload,
        }
        await self.send_json(message)

    # ===== internal safe wrappers =====

    async def _delayed_offline_safe(self):
        try:
            await asyncio.sleep(self.OFFLINE_DELAY_SEC)
            await self._safe_set_presence(False)
        except asyncio.CancelledError:
            return
        except Exception:
            return

    async def _safe_set_presence(self, online: bool):
        try:
            await self._set_presence(online)
        except Exception:
            return

    async def _set_presence(self, online: bool):
        user_id = self.user_id

        if online and self._offline_task and not self._offline_task.done():
            self._offline_task.cancel()

        await _update_user_activity(user_id)

        can_broadcast = await _can_broadcast_presence(user_id)
        if can_broadcast:
            friend_ids = await _get_friend_ids(user_id)
            if friend_ids:
                await a_notify_friends_ids(
                    friend_ids,
                    type="presence",
                    user_id=user_id,
                    online=online,
                )


# ===== DB helpers =====

@sync_to_async
def _update_user_activity(user_id: int):
    try:
        u = User.objects.only("id").get(pk=user_id)
    except User.DoesNotExist:
        return

    update = {}
    if hasattr(u, "last_activity"):
        update["last_activity"] = timezone.now()
    if update:
        User.objects.filter(pk=user_id).update(**update)


@sync_to_async
def _can_broadcast_presence(user_id: int) -> bool:
    try:
        from users.models import UserSettings
        s = UserSettings.objects.only("online_status").get(user_id=user_id)
        return bool(s.online_status)
    except Exception:
        return True


@sync_to_async
def _get_friend_ids(user_id: int) -> list[int]:
    try:
        from chat.models import Friendship
    except Exception:
        return []
    qs = Friendship.objects.filter(user1_id=user_id).values_list("user2_id", flat=True)
    qs2 = Friendship.objects.filter(user2_id=user_id).values_list("user1_id", flat=True)
    return list(qs) + list(qs2)


@sync_to_async
def _get_unread_count(user_id: int) -> int:
    try:
        from notifications.models import Notification
        return Notification.objects.filter(user_id=user_id, is_read=False).count()
    except Exception:
        return 0
