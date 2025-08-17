# notifications/utils.py
from __future__ import annotations

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def notify_user(user_id: int, *, type: str, **payload):
    """
    Универсальная отправка уведомления КОНКРЕТНОМУ пользователю (его личная группа user_<id>).
    Пример:
        notify_user(42, type="dm_badge", chat_id=1, last_message="...", ...)
    """
    layer = get_channel_layer()
    if not layer:
        return
    async_to_sync(layer.group_send)(
        f"user_{int(user_id)}",
        {"type": type, **payload},
    )


def notify_friends_ids(friend_ids: list[int], *, type: str, **payload):
    """
    Разослать событие всем друзьям (список id уже готов).
    Пример:
        notify_friends_ids([2,5,9], type="presence", user_id=42, online=True)
    """
    layer = get_channel_layer()
    if not layer or not friend_ids:
        return
    for fid in friend_ids:
        async_to_sync(layer.group_send)(
            f"user_{int(fid)}",
            {"type": type, **payload},
        )
