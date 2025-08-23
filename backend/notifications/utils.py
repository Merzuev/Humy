# notifications/utils.py
from __future__ import annotations

import asyncio
from typing import List, Optional

from asgiref.sync import async_to_sync, sync_to_async
from channels.layers import get_channel_layer
from .models import Notification, GroupChatSubscription

# =========================
#  SYNC-helpers (для views, Celery и т.п.)
# =========================

def notify_user(user_id: int, *, type: str, **payload) -> None:
    """
    СИНХРОННО: отправить событие одному пользователю (его группа user_<id>).
    Использовать в синхронном коде (HTTP-views, Celery без asyncio).
    """
    layer = get_channel_layer()
    if not layer:
        return
    async_to_sync(layer.group_send)(
        f"user_{int(user_id)}",
        {"type": type, **payload},
    )


def notify_friends_ids(friend_ids: List[int], *, type: str, **payload) -> None:
    """
    СИНХРОННО: разослать событие друзьям. Использовать в синхронном коде.
    """
    layer = get_channel_layer()
    if not layer or not friend_ids:
        return
    for fid in friend_ids:
        async_to_sync(layer.group_send)(
            f"user_{int(fid)}",
            {"type": type, **payload},
        )


def notify_user_if_allowed(user_id: int, *, kind: str, type: str, **payload) -> None:
    """
    СИНХРОННО: отправить событие с учётом пользовательских настроек
    kind: 'message' | 'group' | 'generic'
    """
    if not _is_push_allowed_sync(user_id, kind=kind):
        return
    notify_user(user_id, type=type, **payload)


def _is_push_allowed_sync(user_id: int, *, kind: str) -> bool:
    """
    Проверка пользовательских настроек (push, message_notifications, group_notifications).
    При отсутствии настроек — разрешаем.
    """
    try:
        from users.models import UserSettings
        s = UserSettings.objects.only(
            "push_notifications", "message_notifications", "group_notifications"
        ).get(user_id=user_id)
        if not s.push_notifications:
            return False
        if kind == "message" and not s.message_notifications:
            return False
        if kind == "group" and not s.group_notifications:
            return False
        return True
    except Exception:
        # если настроек нет — по умолчанию разрешаем
        return True


# =========================
#  ASYNC-helpers (для consumers, async задач)
# =========================

async def a_notify_user(user_id: int, *, type: str, **payload) -> None:
    """
    АСИНХРОННО: отправить событие одному пользователю (его группа user_<id>).
    Использовать ТОЛЬКО внутри async-кода (Channels consumers).
    """
    layer = get_channel_layer()
    if not layer:
        return
    await layer.group_send(
        f"user_{int(user_id)}",
        {"type": type, **payload},
    )


async def a_notify_friends_ids(friend_ids: List[int], *, type: str, **payload) -> None:
    """
    АСИНХРОННО: разослать событие друзьям. Использовать в async-коде.
    """
    layer = get_channel_layer()
    if not layer or not friend_ids:
        return
    # Параллельно и эффективно отправим всем
    await asyncio.gather(*[
        layer.group_send(f"user_{int(fid)}", {"type": type, **payload})
        for fid in friend_ids
    ])


async def a_notify_user_if_allowed(user_id: int, *, kind: str, type: str, **payload) -> None:
    """
    АСИНХРОННО: отправить событие с учётом пользовательских настроек
    kind: 'message' | 'group' | 'generic'
    """
    allowed = await _a_is_push_allowed(user_id, kind=kind)
    if not allowed:
        return
    await a_notify_user(user_id, type=type, **payload)


@sync_to_async
def _a_is_push_allowed(user_id: int, *, kind: str) -> bool:
    # Реиспользуем синхронную проверку в отдельном треде
    return _is_push_allowed_sync(user_id, kind=kind)


# === Персистентное уведомление + отправка в WS одному пользователю ===

def create_and_notify(
    user_id: int, *, type: str, payload: Optional[dict] = None,
    kind: str = "generic", persist: bool = True
) -> Optional[int]:
    """
    SYNС: учитывает настройки пользователя (push/типы).
    Если разрешено:
      - создаёт запись Notification (если persist=True)
      - отправляет событие по WS в группу user_<id>
    Возвращает id созданного уведомления (или None).
    """
    payload = payload or {}

    if not _is_push_allowed_sync(user_id, kind=kind):
        return None

    notif_id = None
    if persist:
        n = Notification.objects.create(user_id=int(user_id), type=type, payload=payload)
        notif_id = n.id

    notify_user(user_id, type=_map_type_to_handler(type), id=notif_id, **(payload or {}))
    return notif_id


def _map_type_to_handler(t: str) -> str:
    """
    Сопоставляем тип БД ('friend.request') -> имени хендлера в consumer ('friend_request').
    """
    return t.replace(".", "_")


# === Подписки мировых чатов ===

def is_user_subscribed_to_room(user_id: int, room_id: int) -> bool:
    return GroupChatSubscription.objects.filter(user_id=int(user_id), room_id=int(room_id)).exists()


def get_room_subscriber_ids(room_id: int, *, only_not_muted: bool = True, exclude_user_id: Optional[int] = None) -> List[int]:
    qs = GroupChatSubscription.objects.filter(room_id=int(room_id))
    if only_not_muted:
        qs = qs.filter(muted=False)
    if exclude_user_id is not None:
        qs = qs.exclude(user_id=int(exclude_user_id))
    return list(qs.values_list("user_id", flat=True))


def notify_room_subscribers(
    room_id: int, *, type: str, payload: Optional[dict] = None,
    exclude_user_id: Optional[int] = None, kind: str = "group", persist: bool = True
) -> int:
    """
    Разослать уведомление всем подписанным на комнату (кроме exclude_user_id).
    Возвращает количество пользователей, кому отправлено.
    """
    payload = payload or {}
    user_ids = get_room_subscriber_ids(room_id, only_not_muted=True, exclude_user_id=exclude_user_id)

    sent = 0
    for uid in user_ids:
        if not _is_push_allowed_sync(uid, kind=kind):
            continue
        if persist:
            Notification.objects.create(user_id=int(uid), type=type, payload=payload)
        notify_user(uid, type=_map_type_to_handler(type), **payload)
        sent += 1
    return sent
