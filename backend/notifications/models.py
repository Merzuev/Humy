from django.conf import settings
from django.db import models


class Notification(models.Model):
    """
    Персистентная запись уведомления.
    """

    class Types:
        FRIEND_REQUEST = "friend.request"
        FRIEND_ACCEPT = "friend.accept"
        DM_BADGE = "dm.badge"
        DM_READ = "dm.read"
        PRESENCE = "presence"
        SYSTEM = "system"

        CHOICES = [
            (FRIEND_REQUEST, "Friend Request"),
            (FRIEND_ACCEPT, "Friend Accept"),
            (DM_BADGE, "DM Badge"),
            (DM_READ, "DM Read"),
            (PRESENCE, "Presence"),
            (SYSTEM, "System"),
        ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    type = models.CharField(max_length=32, choices=Types.CHOICES)
    payload = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "is_read", "created_at"]),
            models.Index(fields=["user", "created_at"]),
        ]

    def __str__(self):
        return f"Notification(id={self.id}, user={self.user_id}, type={self.type}, read={self.is_read})"


class GroupChatSubscription(models.Model):
    """
    Подписка пользователя на мировой чат (групповой чат).
    FK на Room не делаем, чтобы не зависеть от названия/расположения модели Rooms.
    Храним числовой room_id (как на фронтенде/WS).
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="group_chat_subscriptions",
    )
    room_id = models.PositiveBigIntegerField()
    muted = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = (("user", "room_id"),)
        indexes = [
            models.Index(fields=["room_id"]),
            models.Index(fields=["room_id", "muted"]),
            models.Index(fields=["user", "room_id"]),
        ]

    def __str__(self):
        return f"GroupChatSubscription(user={self.user_id}, room_id={self.room_id}, muted={self.muted})"
