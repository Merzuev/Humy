# notifications/utils.py
from __future__ import annotations

import asyncio
from typing import List, Optional

from asgiref.sync import async_to_sync, sync_to_async
from channels.layers import get_channel_layer


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
