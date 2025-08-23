"""
Автоподключаемые интеграции уведомлений:
- Мировой чат (групповые сообщения) -> нотификации подписчикам комнаты
- Личные сообщения -> бейдж адресату
- Заявки в друзья -> адресату заявки

Ничего не импортируем жёстко: имена моделей берём из settings, чтобы не привязываться к структуре проекта.
Если какая-то модель не указана или не найдена — тихо пропускаем, ничего не ломаем.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

from django.apps import apps
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from .utils import notify_room_subscribers, create_and_notify

log = logging.getLogger(__name__)


@dataclass
class ModelSpec:
    app_label: str
    model_name: str

    @classmethod
    def parse(cls, dotted: str) -> Optional["ModelSpec"]:
        """'app.Model' -> ModelSpec"""
        if not dotted or "." not in dotted:
            return None
        app_label, model_name = dotted.split(".", 1)
        return cls(app_label=app_label, model_name=model_name)


def _resolve_model(dotted: Optional[str]):
    """
    Возвращает Django-модель по 'app.Model', либо None.
    """
    try:
        spec = ModelSpec.parse(dotted or "")
        if not spec:
            return None
        return apps.get_model(spec.app_label, spec.model_name)
    except Exception:
        return None


def _get_attr(obj, names: list[str], default=None):
    for n in names:
        if hasattr(obj, n):
            return getattr(obj, n)
    return default


def connect_signals() -> None:
    """
    Подключаем все имеющиеся интеграции, исходя из настроек:
    - HUMY_GROUP_MESSAGE_MODEL = 'app.Model'
    - HUMY_DM_MESSAGE_MODEL = 'app.Model'
    - HUMY_FRIEND_REQUEST_MODEL = 'app.Model'
    """
    # Групповой чат
    group_model_path = getattr(settings, "HUMY_GROUP_MESSAGE_MODEL", None)
    GroupMsg = _resolve_model(group_model_path)
    if GroupMsg is not None:
        try:
            post_save.connect(_on_group_message_created, sender=GroupMsg, dispatch_uid="notifications.group_message")
            log.info("Notifications: connected GroupMessage integration to %s", group_model_path)
        except Exception as e:
            log.warning("Notifications: cannot connect GroupMessage integration: %s", e)
    else:
        log.info("Notifications: HUMY_GROUP_MESSAGE_MODEL is not set or not found")

    # Личные сообщения
    dm_model_path = getattr(settings, "HUMY_DM_MESSAGE_MODEL", None)
    DMMsg = _resolve_model(dm_model_path)
    if DMMsg is not None:
        try:
            post_save.connect(_on_dm_message_created, sender=DMMsg, dispatch_uid="notifications.dm_message")
            log.info("Notifications: connected DM integration to %s", dm_model_path)
        except Exception as e:
            log.warning("Notifications: cannot connect DM integration: %s", e)
    else:
        log.info("Notifications: HUMY_DM_MESSAGE_MODEL is not set or not found")

    # Заявки в друзья
    fr_model_path = getattr(settings, "HUMY_FRIEND_REQUEST_MODEL", None)
    FriendReq = _resolve_model(fr_model_path)
    if FriendReq is not None:
        try:
            post_save.connect(_on_friend_request_created, sender=FriendReq, dispatch_uid="notifications.friend_request")
            log.info("Notifications: connected FriendRequest integration to %s", fr_model_path)
        except Exception as e:
            log.warning("Notifications: cannot connect FriendRequest integration: %s", e)
    else:
        log.info("Notifications: HUMY_FRIEND_REQUEST_MODEL is not set or not found")


# ===================== handlers =====================

def _extract_room_id(instance) -> Optional[int]:
    """
    Пытаемся получить room_id из разных распространённых полей.
    - room_id
    - room.id
    - chat_id / chat.id
    - group_id / group.id
    """
    room_id = _get_attr(instance, ["room_id", "chat_id", "group_id"])
    if room_id:
        try:
            return int(room_id)
        except Exception:
            return None
    room = _get_attr(instance, ["room", "chat", "group"])
    if room is not None:
        rid = _get_attr(room, ["id", "pk"])
        try:
            return int(rid)
        except Exception:
            return None
    return None


def _extract_author_id(instance) -> Optional[int]:
    """
    Универсально достаём автора:
    - author_id, user_id, sender_id
    - author.id / user.id / sender.id
    """
    author_id = _get_attr(instance, ["author_id", "user_id", "sender_id"])
    if author_id:
        try:
            return int(author_id)
        except Exception:
            return None
    author = _get_attr(instance, ["author", "user", "sender"])
    if author is not None:
        aid = _get_attr(author, ["id", "pk"])
        try:
            return int(aid)
        except Exception:
            return None
    return None


@receiver(post_save, dispatch_uid="notifications.group_message")
def _on_group_message_created(sender, instance, created, **kwargs):
    if not created:
        return
    room_id = _extract_room_id(instance)
    author_id = _extract_author_id(instance)
    if room_id is None:
        return  # без комнаты некуда слать
    # Готовим мини-пейлоад (превью + room_id + author)
    content = _get_attr(instance, ["content", "text", "body"], "") or ""
    preview = (content or "").strip()
    if len(preview) > 80:
        preview = preview[:77] + "…"

    try:
        notify_room_subscribers(
            room_id=room_id,
            type="group.new",
            payload={"room_id": room_id, "preview": preview, "by": author_id},
            exclude_user_id=author_id,
            kind="group",
            persist=True,
        )
    except Exception as e:
        log.warning("Notifications: group notify failed: %s", e)


def _extract_dm_recipient_id(instance, author_id: Optional[int]) -> Optional[int]:
    """
    Универсально находим адресата для ЛС.
    Варианты:
    - recipient_id / receiver_id / to_user_id
    - recipient / receiver / to_user (obj)
    - thread/dialog/conversation с полями user1/user2 (берём того, кто не автор)
    """
    rid = _get_attr(instance, ["recipient_id", "receiver_id", "to_user_id", "to_id"])
    if rid:
        try:
            return int(rid)
        except Exception:
            return None

    rec = _get_attr(instance, ["recipient", "receiver", "to_user", "to"])
    if rec is not None:
        rid = _get_attr(rec, ["id", "pk"])
        try:
            return int(rid)
        except Exception:
            return None

    # Попробуем разговор/диалог
    thread = _get_attr(instance, ["thread", "dialog", "conversation", "chat"])
    if thread is not None:
        u1 = _get_attr(thread, ["user1_id", "user_a_id", "first_user_id"])
        u2 = _get_attr(thread, ["user2_id", "user_b_id", "second_user_id"])
        if u1 and u2:
            try:
                u1 = int(u1); u2 = int(u2)
                if author_id is None:
                    return u1  # наугад
                return u2 if author_id == u1 else u1
            except Exception:
                return None
        # объекты
        u1o = _get_attr(thread, ["user1", "user_a", "first_user"])
        u2o = _get_attr(thread, ["user2", "user_b", "second_user"])
        if u1o is not None and u2o is not None:
            u1 = _get_attr(u1o, ["id", "pk"])
            u2 = _get_attr(u2o, ["id", "pk"])
            try:
                u1 = int(u1); u2 = int(u2)
                if author_id is None:
                    return u1
                return u2 if author_id == u1 else u1
            except Exception:
                return None

    return None


@receiver(post_save, dispatch_uid="notifications.dm_message")
def _on_dm_message_created(sender, instance, created, **kwargs):
    if not created:
        return
    author_id = _extract_author_id(instance)
    recipient_id = _extract_dm_recipient_id(instance, author_id)
    if recipient_id is None:
        return
    content = _get_attr(instance, ["content", "text", "body"], "") or ""
    preview = (content or "").strip()
    if len(preview) > 80:
        preview = preview[:77] + "…"

    try:
        create_and_notify(
            user_id=recipient_id,
            type="dm.badge",
            payload={"preview": preview, "by": author_id},
            kind="message",
            persist=True,
        )
    except Exception as e:
        log.warning("Notifications: dm notify failed: %s", e)


@receiver(post_save, dispatch_uid="notifications.friend_request")
def _on_friend_request_created(sender, instance, created, **kwargs):
    if not created:
        return
    # Ищем адресата заявки в разных полях
    to_id = _get_attr(instance, ["to_user_id", "receiver_id", "recipient_id", "to_id"])
    if not to_id:
        to = _get_attr(instance, ["to_user", "receiver", "recipient", "to"])
        to_id = _get_attr(to, ["id", "pk"]) if to is not None else None
    if not to_id:
        return
    from_id = _get_attr(instance, ["from_user_id", "sender_id", "author_id", "user_id"])
    try:
        to_id = int(to_id)
    except Exception:
        return
    try:
        create_and_notify(
            user_id=to_id,
            type="friend.request",
            payload={"by": from_id},
            kind="generic",
            persist=True,
        )
    except Exception as e:
        log.warning("Notifications: friend request notify failed: %s", e)
