# backend/chat/admin.py
from __future__ import annotations

from django.contrib import admin
from django.utils.html import format_html
from mptt.admin import MPTTModelAdmin

from .models import Folder, Chat, Label, Message


@admin.register(Label)
class LabelAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "color_preview")
    search_fields = ("name",)

    @admin.display(description="Color")
    def color_preview(self, obj: Label):
        return format_html(
            '<span style="display:inline-block;width:16px;height:16px;'
            'border-radius:4px;background:{};border:1px solid #ccc"></span> {}',
            obj.color,
            obj.color,
        )


@admin.register(Folder)
class FolderAdmin(MPTTModelAdmin):
    list_display = ("id", "name", "parent", "created_at", "updated_at")
    search_fields = ("name",)
    list_filter = ("created_at",)


@admin.register(Chat)
class ChatAdmin(admin.ModelAdmin):
    """
    ВАЖНО: в модели Chat поля creator нет.
    Мы оставляем колонку "creator" в админке, но реализуем метод ниже,
    чтобы избежать admin.E108 и всё равно показать "создателя" (хоть и эвристически).
    """
    list_display = ("id", "name", "creator", "is_protected", "created_at")
    search_fields = ("name",)
    list_filter = ("is_protected", "created_at")

    @admin.display(description="Creator")
    def creator(self, obj: Chat):
        """
        1) Если когда-нибудь добавите поле Chat.creator (FK на user) — оно будет использовано.
        2) Иначе берём автора самого раннего сообщения чата (если есть).
        3) Если ничего нет — '-'.
        """
        # Вариант 1: реальное поле на модели (если появится в будущем).
        possible_creator = getattr(obj, "creator", None)
        if possible_creator:
            username = getattr(possible_creator, "username", "") or getattr(possible_creator, "email", "")
            return username or str(possible_creator)

        # Вариант 2: автор первого сообщения (эвристика).
        first_msg = obj.messages.order_by("created_at").first()
        if first_msg and first_msg.author:
            username = getattr(first_msg.author, "username", "") or getattr(first_msg.author, "email", "")
            return username or str(first_msg.author)

        return "-"


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "room",
        "author_display",
        "short_content",
        "attachment_type",
        "created_at",
    )
    search_fields = ("content", "display_name", "attachment_name")
    list_filter = ("attachment_type", "created_at", "deleted_at")
    autocomplete_fields = ("room",)

    @admin.display(description="Author")
    def author_display(self, obj: Message):
        # показываем username/email, если автор есть; иначе display_name
        if obj.author:
            username = getattr(obj.author, "username", "") or getattr(obj.author, "email", "")
            return username or str(obj.author)
        return obj.display_name or "-"

    @admin.display(description="Content")
    def short_content(self, obj: Message):
        text = obj.content or ""
        if not text and obj.attachment_name:
            text = f"[{obj.attachment_type or 'file'}] {obj.attachment_name}"
        return (text[:60] + "…") if len(text) > 60 else text
