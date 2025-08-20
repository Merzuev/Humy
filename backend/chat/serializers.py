from __future__ import annotations

from typing import Any, Optional
from mimetypes import guess_type

from django.utils import timezone
from rest_framework import serializers

from .models import Folder, Chat, Label, Message, ChatParticipant
from .models import FriendRequest, FriendRequestStatus, Friendship, Block


# ===== Labels =====

class LabelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Label
        fields = ["id", "name", "color"]


# ===== Chats / Folders =====

class ChatSerializer(serializers.ModelSerializer):
    folders = serializers.PrimaryKeyRelatedField(many=True, queryset=Folder.objects.all())
    labels = LabelSerializer(many=True, read_only=True)

    class Meta:
        model = Chat
        fields = ["id", "name", "folders", "labels", "is_protected", "created_at"]


class FolderListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Folder
        fields = ["id", "name", "parent"]


class FolderSerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()
    chats = serializers.SerializerMethodField()
    labels = LabelSerializer(many=True, read_only=True)

    class Meta:
        model = Folder
        fields = [
            "id",
            "name",
            "parent",
            "labels",
            "children",
            "chats",
            "created_at",
            "updated_at",
        ]

    def get_children(self, obj: Folder) -> list[dict[str, Any]]:
        return FolderListSerializer(obj.children.all(), many=True).data

    def get_chats(self, obj: Folder) -> list[dict[str, Any]]:
        return ChatSerializer(obj.chats.all(), many=True).data


# ===== Users (mini) =====

class UserMiniSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    nickname = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()

    def get_nickname(self, obj) -> str:
        return (
            getattr(obj, "nickname", None)
            or getattr(obj, "username", None)
            or getattr(obj, "email", "")
            or f"user:{obj.pk}"
        )

    def get_avatar(self, obj) -> Optional[str]:
        avatar = getattr(obj, "avatar", None)
        request = self.context.get("request")
        if avatar and hasattr(avatar, "url"):
            return request.build_absolute_uri(avatar.url) if request else avatar.url
        return None


# ===== Messages =====

class MessageSerializer(serializers.ModelSerializer):
    # Информация об авторе
    author_username = serializers.CharField(
        source="author.username", allow_null=True, read_only=True
    )
    author = serializers.SerializerMethodField()
    # ВАЖНО: без source='author_id', иначе DRF кидает AssertionError
    author_id = serializers.SerializerMethodField()

    # Вложение
    attachment_url = serializers.SerializerMethodField()
    is_image = serializers.SerializerMethodField()
    # meta гарантированно содержит хотя бы mime
    meta = serializers.SerializerMethodField()

    # Удобный флаг для фронта
    is_own = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            "id",
            "room",                 # для публичных чатов — int PK
            "author",               # mini {id, nickname, avatar}
            "author_id",
            "author_username",
            "display_name",
            "content",
            "attachment",
            "attachment_url",
            "attachment_type",
            "attachment_name",
            "is_image",
            "reply_to",
            "expires_at",
            "created_at",
            "edited_at",
            "deleted_at",
            "meta",
            "is_own",
        ]
        read_only_fields = [
            "id",
            "author",
            "author_id",
            "author_username",
            "created_at",
            "edited_at",
            "deleted_at",
            "attachment_url",
            "is_image",
            "is_own",
            "meta",
        ]
        # В ЛС room может выставляться сервером — не требуем на входе
        extra_kwargs = {
            "room": {"required": False, "allow_null": True},
        }

    # ----- getters -----

    def get_author(self, obj) -> dict:
        user = obj.author
        if not user:
            return {"id": None, "nickname": obj.display_name or "Unknown", "avatar": None}
        return UserMiniSerializer(user, context=self.context).data

    def get_author_id(self, obj) -> Optional[int]:
        try:
            return int(obj.author_id) if obj.author_id is not None else None
        except Exception:
            return None

    def get_is_own(self, obj) -> bool:
        request = self.context.get("request")
        return bool(request and getattr(request, "user", None) and obj.author_id == request.user.id)

    def get_attachment_url(self, obj: Message) -> Optional[str]:
        req = self.context.get("request")
        if obj.attachment and hasattr(obj.attachment, "url"):
            return req.build_absolute_uri(obj.attachment.url) if req else obj.attachment.url
        return None

    def _guess_mime(self, obj: Message) -> Optional[str]:
        # пробуем взять из obj.meta, иначе по URL/имени файла
        current = getattr(obj, "meta", {}) or {}
        mime = current.get("mime")
        if mime:
            return mime
        name = (getattr(obj, "attachment_name", None) or "").lower()
        url = ""
        att = getattr(obj, "attachment", None)
        try:
            url = (att.url or "").lower() if att and hasattr(att, "url") else ""
        except Exception:
            url = ""
        src = url or name
        return guess_type(src)[0]

    def get_meta(self, obj: Message) -> dict[str, Any]:
        meta = dict(getattr(obj, "meta", {}) or {})
        mime = self._guess_mime(obj)
        if mime and not meta.get("mime"):
            meta["mime"] = mime
        return meta

    def get_is_image(self, obj: Message) -> bool:
        # 1) если модель даёт точный флаг — используем
        if hasattr(obj, "is_image"):
            try:
                return bool(obj.is_image)
            except Exception:
                pass
        # 2) иначе определяем по mime/расширению
        mime = self._guess_mime(obj) or ""
        if mime.startswith("image/"):
            return True
        name = (getattr(obj, "attachment_name", None) or "").lower()
        url = ""
        att = getattr(obj, "attachment", None)
        try:
            url = (att.url or "").lower() if att and hasattr(att, "url") else ""
        except Exception:
            url = ""
        src = url or name
        return src.endswith((".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".avif"))

    # ----- validation -----

    def validate(self, attrs):
        content = (attrs.get("content") or "").strip()
        attachment = attrs.get("attachment")
        if not content and not attachment:
            raise serializers.ValidationError("Нужно отправить текст или вложение.")
        return attrs


# ===== Conversations (Личные сообщения) =====

class ConversationSerializer(serializers.ModelSerializer):
    other_user = serializers.SerializerMethodField()
    last_message_text = serializers.SerializerMethodField()
    last_message_created_at = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Chat
        fields = [
            "id",
            "type",
            "is_secret",
            "self_destruct_timer",
            "other_user",
            "last_message_text",
            "last_message_created_at",
            "unread_count",
        ]

    def get_other_user(self, obj) -> Optional[dict]:
        request_user = self.context["request"].user
        other = obj.participants.exclude(pk=request_user.pk).first()
        return UserMiniSerializer(other, context=self.context).data if other else None

    def get_last_message_text(self, obj) -> Optional[str]:
        lm = obj.last_message
        if not lm:
            return None
        if lm.content:
            return lm.content[:1000]
        return lm.attachment_name or "Вложение"

    def get_last_message_created_at(self, obj):
        return obj.last_message.created_at if obj.last_message else None

    def get_unread_count(self, obj) -> int:
        request_user = self.context["request"].user
        link = ChatParticipant.objects.filter(chat=obj, user=request_user).only("unread_count").first()
        return link.unread_count if link else 0


class ConversationCreateSerializer(serializers.Serializer):
    other_user_id = serializers.IntegerField()

    def validate(self, attrs):
        request = self.context["request"]
        other_user_id = attrs["other_user_id"]
        if request.user.id == other_user_id:
            raise serializers.ValidationError("Нельзя создать диалог с самим собой.")
        return attrs


# ===== Друзья / Блок =====

class FriendRequestSerializer(serializers.ModelSerializer):
    from_user = UserMiniSerializer(read_only=True)
    to_user = UserMiniSerializer(read_only=True)

    class Meta:
        model = FriendRequest
        fields = ["id", "from_user", "to_user", "status", "created_at", "responded_at"]


class FriendRequestCreateSerializer(serializers.Serializer):
    to_user_id = serializers.IntegerField()

    def validate(self, attrs):
        req = self.context["request"]
        to_id = attrs["to_user_id"]
        if req.user.id == to_id:
            raise serializers.ValidationError("Нельзя отправить заявку самому себе.")
        return attrs


class FriendshipSerializer(serializers.Serializer):
    user = UserMiniSerializer()


class BlockSerializer(serializers.ModelSerializer):
    blocked = UserMiniSerializer(read_only=True)

    class Meta:
        model = Block
        fields = ["id", "blocked", "created_at"]
