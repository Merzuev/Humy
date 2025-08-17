from __future__ import annotations
from rest_framework.permissions import BasePermission


class IsAuthenticated(BasePermission):
    def has_permission(self, request, view) -> bool:
        return bool(request.user and request.user.is_authenticated)


class IsChatParticipant(BasePermission):
    """
    Доступ только участникам указанного приватного чата.
    Ожидает, что во view есть метод get_chat() -> Chat.
    """
    def has_permission(self, request, view) -> bool:
        chat = getattr(view, "get_chat", None)
        if not callable(chat):
            return False
        chat_obj = view.get_chat()
        return chat_obj.participants.filter(pk=request.user.pk).exists()
