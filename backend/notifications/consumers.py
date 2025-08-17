# notifications/consumers.py
from __future__ import annotations

import asyncio
from typing import Optional

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth import get_user_model

from notifications.utils import notify_user, notify_friends_ids

User = get_user_model()


class NotificationsConsumer(AsyncJsonWebsocketConsumer):
    """
    Индивидуальные уведомления пользователю:
      - friend:request  (пришла заявка в друзья)
      - friend:accept   (заявку приняли)
      - dm:badge        (новое ЛС — обновить карточку + бейдж)
      - dm:read         (собеседник прочитал)
      - presence        (изменение онлайн-статуса друга)
    """
    # задержка оффлайна — чтобы не «мигало» при кратких разрывах
    OFFLINE_DELAY_SEC = 20

    async def connect(self):
        user = self.scope.get("user")
        if not user or not user.is_authenticated:
            await self.close()
            return

        self.user_id: int = int(user.id)
        self.user_group = f"user_{self.user_id}"
        self._offline_task: Optional[asyncio.Task] = None

        # подписываемся на личную группу
        await self.channel_layer.group_add(self.user_group, self.channel_name)
        await self.accept()

        # помечаем онлайн и оповещаем друзей
        await self._set_presence(True)

    async def disconnect(self, code):
        # отписываемся от своей группы
        try:
            await self.channel_layer.group_discard(self.user_group, self.channel_name)
        except Exception:
            pass

        # откладываем уход в оффлайн (анти-флаппер)
        if getattr(self, "user_id", None):
            self._offline_task = asyncio.create_task(self._delayed_offline())

    # ===== group handlers (они вызываются через group_send(type=...)) =====

    async def friend_request(self, event):
        await self.send_json({"type": "friend:request", **{k: v for k, v in event.items() if k != "type"}})

    async def friend_accept(self, event):
        await self.send_json({"type": "friend:accept", **{k: v for k, v in event.items() if k != "type"}})

    async def dm_badge(self, event):
        await self.send_json({"type": "dm:badge", **{k: v for k, v in event.items() if k != "type"}})

    async def dm_read(self, event):
        await self.send_json({"type": "dm:read", **{k: v for k, v in event.items() if k != "type"}})

    async def presence(self, event):
        # если друга отметили онлайн/оффлайн (через notify_friends_ids)
        await self.send_json({"type": "presence", **{k: v for k, v in event.items() if k != "type"}})

    # ===== internal =====

    async def _delayed_offline(self):
        await asyncio.sleep(self.OFFLINE_DELAY_SEC)
        await self._set_presence(False)

    async def _set_presence(self, online: bool):
        """
        Ставит флаг онлайн в базе (если поле есть) и оповещает друзей
        через их user_<id> группы (type="presence").
        """
        user_id = self.user_id

        # если уже запланирован уход в оффлайн и пользователь снова коннектится — отменяем задачу
        if online and self._offline_task and not self._offline_task.done():
            self._offline_task.cancel()

        # обновим last_seen/is_online (если поля есть в модели)
        await _update_user_presence(user_id, online)

        # разошлём друзьям событие
        friend_ids = await _get_friend_ids(user_id)
        await notify_friends_ids(
            friend_ids,
            type="presence",
            user_id=user_id,
            online=online,
        )


# ===== DB helpers (безопасно вызывать из async) =====

@sync_to_async
def _update_user_presence(user_id: int, online: bool):
    try:
        u = User.objects.only("id").get(pk=user_id)
    except User.DoesNotExist:
        return
    # Если в кастомной модели есть поля — обновим.
    update_fields = []
    from django.utils import timezone
    if hasattr(u, "is_online"):
        u.is_online = online
        update_fields.append("is_online")
    if hasattr(u, "last_seen"):
        u.last_seen = timezone.now()
        update_fields.append("last_seen")
    if update_fields:
        User.objects.filter(pk=user_id).update(**{f: getattr(u, f) for f in update_fields})


@sync_to_async
def _get_friend_ids(user_id: int) -> list[int]:
    """
    Возвращает id всех друзей пользователя. Подстрой под свою модель дружбы.
    Ожидается модель Friendship(user1, user2).
    """
    try:
        from chat.models import Friendship
    except Exception:
        return []
    qs = Friendship.objects.filter(user1_id=user_id).values_list("user2_id", flat=True)
    qs2 = Friendship.objects.filter(user2_id=user_id).values_list("user1_id", flat=True)
    return list(qs) + list(qs2)
