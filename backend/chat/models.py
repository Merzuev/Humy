from __future__ import annotations

import os
from uuid import uuid4
from typing import Optional

from django.conf import settings
from django.db import models
from mptt.models import MPTTModel, TreeForeignKey
from django.db.models import Q, TextChoices

def _message_upload_to(instance: "Message", filename: str) -> str:
    """
    Путь хранения вложений: media/messages/<room_id>/<uuid>/<original_name>
    Важно: у Message.id тип UUID, default=uuid4 — он уже доступен на момент вычисления upload_to.
    """
    base = os.path.basename(filename)
    mid = instance.id or uuid4()
    return f"messages/{instance.room_id}/{mid}/{base}"


# -----------------------------
# Вспомогательные сущности
# -----------------------------

class Label(models.Model):
    name = models.CharField(max_length=64)
    color = models.CharField(max_length=7, default="#7C3AED")  # #RRGGBB

    def __str__(self) -> str:
        return self.name


class Folder(MPTTModel):
    name = models.CharField(max_length=120)
    parent = TreeForeignKey(
        "self",
        null=True,
        blank=True,
        related_name="children",
        on_delete=models.CASCADE,
    )
    labels = models.ManyToManyField(Label, related_name="folders", blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class MPTTMeta:
        order_insertion_by = ["name"]

    class Meta:
        verbose_name = "Folder"
        verbose_name_plural = "Folders"

    def __str__(self) -> str:
        return self.name


# -----------------------------
# Чаты и личные сообщения
# -----------------------------

class ChatType(models.TextChoices):
    GROUP = "group", "Групповой"
    PRIVATE = "private", "Личный"


class Chat(models.Model):
    # Общие поля
    name = models.CharField(max_length=255)
    folders = models.ManyToManyField(Folder, related_name="chats", blank=True)
    labels = models.ManyToManyField(Label, related_name="chats", blank=True)
    is_protected = models.BooleanField(default=False)

    # Тип чата: групповой или личный (для ЛС)
    type = models.CharField(
        max_length=10,
        choices=ChatType.choices,
        default=ChatType.GROUP,
        db_index=True,
    )

    # Участники чата (для приватных — всегда 2). Через промежуточную модель с метаданными.
    participants = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        through="ChatParticipant",
        related_name="chats",
        blank=True,
    )

    # Секретные чаты (каркас)
    is_secret = models.BooleanField(default=False)
    # Таймер автоудаления сообщений (в секундах), если чат секретный
    self_destruct_timer = models.PositiveIntegerField(null=True, blank=True)

    # Быстрый доступ к последнему сообщению (ускоряет список диалогов)
    last_message = models.ForeignKey(
        "Message",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    # Уникальный ключ пары участников для приватных чатов (чтобы не плодить дубликаты).
    # Формат рекомендуется "minUserId:maxUserId". Заполняется в бизнес-логике при создании ЛС.
    private_key = models.CharField(
        max_length=64,
        null=True,
        blank=True,
        unique=True,
        help_text="Уникальная пара участников для приватного чата",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["type", "-created_at"]),
        ]

    def __str__(self) -> str:
        base = self.name or (f"Chat #{self.pk}")
        return f"{base} ({self.type})"


class ChatParticipant(models.Model):
    """
    Промежуточная модель связи участника с чатом.
    Храним счетчики и настройки на уровне пользователя.
    """
    chat = models.ForeignKey("Chat", on_delete=models.CASCADE, related_name="member_links")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="chat_links")

    # Метка последнего чтения сообщений в данном чате
    last_read_at = models.DateTimeField(null=True, blank=True)

    # Кол-во непрочитанных сообщений у пользователя в этом чате
    unread_count = models.PositiveIntegerField(default=0)

    # Отключение уведомлений по конкретному чату
    is_muted = models.BooleanField(default=False)

    class Meta:
        unique_together = ("chat", "user")
        indexes = [
            models.Index(fields=["user", "chat"]),
            models.Index(fields=["chat", "user"]),
        ]

    def __str__(self) -> str:
        return f"user={self.user_id} in chat={self.chat_id}"


# -----------------------------
# Сообщения в чате
# -----------------------------

class Message(models.Model):
    """
    Сообщение в чате, поддержка текста + вложений.
    ВАЖНО: первичный ключ — UUID (совместимо с текущей схемой БД).
    """
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)

    ATTACHMENT_TYPE_IMAGE = "image"
    ATTACHMENT_TYPE_FILE = "file"
    ATTACHMENT_TYPES = (
        (ATTACHMENT_TYPE_IMAGE, "Image"),
        (ATTACHMENT_TYPE_FILE, "File"),
    )

    room = models.ForeignKey(
        Chat, related_name="messages", on_delete=models.CASCADE, db_index=True
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="messages",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    display_name = models.CharField(
        max_length=150, blank=True, help_text="Показываемое имя отправителя"
    )

    content = models.TextField(blank=True, default="")

    # Вложение (любого типа)
    attachment = models.FileField(upload_to=_message_upload_to, blank=True, null=True)
    attachment_type = models.CharField(
        max_length=16, blank=True, default="", choices=ATTACHMENT_TYPES
    )
    attachment_name = models.CharField(max_length=255, blank=True, default="")

    reply_to = models.ForeignKey(
        "self", related_name="replies", on_delete=models.SET_NULL, null=True, blank=True
    )

    # Срок жизни сообщения (для секретных/исчезающих сообщений)
    # Когда наступит expires_at — сообщение нужно скрыть/удалить (см. фоновые задачи).
    expires_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    edited_at = models.DateTimeField(null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    meta = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["room", "created_at"]),
            models.Index(fields=["room", "-created_at"]),
        ]

    def __str__(self) -> str:
        author_name = (
            (self.author.username if self.author and hasattr(self.author, "username") else None)
            or (self.author.email if self.author and hasattr(self.author, "email") else None)
            or self.display_name
            or "Unknown"
        )
        text = self.content[:30] if self.content else (self.attachment_name or "…")
        return f"[{self.room_id}] {author_name}: {text}"

    @property
    def is_image(self) -> bool:
        t = (self.attachment_type or "").lower()
        if t:
            return t == self.ATTACHMENT_TYPE_IMAGE
        # Фолбэк по расширению
        if self.attachment and self.attachment.name:
            ext = os.path.splitext(self.attachment.name)[1].lower()
            return ext in {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}
        return False

    # Удобные методы для удаления
    def soft_delete(self):
        from django.utils import timezone
        if not self.deleted_at:
            self.deleted_at = timezone.now()
            self.save(update_fields=["deleted_at"])

    def hard_delete(self):
        super().delete()


class HiddenMessage(models.Model):
    """
    Персистентное скрытие сообщения для конкретного пользователя (аналог «Удалить у себя»).
    Сообщение остаётся в БД и видимо другим участникам.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="hidden_messages"
    )
    message = models.ForeignKey(
        Message, on_delete=models.CASCADE, related_name="hidden_for_users"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "message")

    def __str__(self) -> str:
        return f"HiddenMessage user={self.user_id} message={self.message_id}"



# ===== ДРУЗЬЯ / БЛОК =====


class FriendRequestStatus(TextChoices):
    PENDING = "pending", "В ожидании"
    ACCEPTED = "accepted", "Принята"
    REJECTED = "rejected", "Отклонена"


class FriendRequest(models.Model):
    from_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="friend_requests_sent")
    to_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="friend_requests_received")
    status = models.CharField(max_length=16, choices=FriendRequestStatus.choices, default=FriendRequestStatus.PENDING, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("from_user", "to_user")
        indexes = [
            models.Index(fields=["to_user", "status"]),
            models.Index(fields=["from_user", "status"]),
        ]

    def __str__(self):
        return f"{self.from_user_id} -> {self.to_user_id} [{self.status}]"


class Friendship(models.Model):
    """
    Симметричная дружба как одна запись (user1_id < user2_id).
    """
    user1 = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="friendships_low")
    user2 = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="friendships_high")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user1", "user2")
        indexes = [
            models.Index(fields=["user1"]),
            models.Index(fields=["user2"]),
        ]

    def save(self, *args, **kwargs):
        # нормализуем порядок чтобы не было дублей
        if self.user1_id and self.user2_id and self.user1_id > self.user2_id:
            self.user1_id, self.user2_id = self.user2_id, self.user1_id
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user1_id} <-> {self.user2_id}"


class Block(models.Model):
    blocker = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="blocks_set")
    blocked = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="blocked_by")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("blocker", "blocked")
        indexes = [
            models.Index(fields=["blocker"]),
            models.Index(fields=["blocked"]),
        ]

    def __str__(self):
        return f"{self.blocker_id} X {self.blocked_id}"
