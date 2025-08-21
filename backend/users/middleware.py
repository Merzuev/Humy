# users/middleware.py
from __future__ import annotations

from urllib.parse import parse_qs

# --- Для WS (Channels) ---
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from rest_framework_simplejwt.tokens import AccessToken

from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser

# --- Для HTTP (Django) ---
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone


User = get_user_model()

# ===============================
#   WS: JWT через query-string
#   Пример URL: ws://.../ws/notifications/?token=<JWT>
# ===============================

@database_sync_to_async
def _get_user_by_token(token: str):
    try:
        access = AccessToken(token)
        user_id = access["user_id"]
        return User.objects.get(id=user_id)
    except Exception:
        return None


class JWTAuthMiddleware(BaseMiddleware):
    """
    Channels middleware: достаёт пользователя из ?token=JWT.
    Используется ТОЛЬКО в ASGI для WebSocket.
    """

    async def __call__(self, scope, receive, send):
        try:
            raw_qs = (scope.get("query_string") or b"").decode()
            qs = parse_qs(raw_qs)
            token = (qs.get("token") or [None])[0]
        except Exception:
            token = None

        user = await _get_user_by_token(token) if token else None
        scope["user"] = user or AnonymousUser()
        return await super().__call__(scope, receive, send)


# ===============================
#   HTTP: отметка активности
#   Безопасно и с троттлингом
# ===============================

UPDATE_INTERVAL = getattr(settings, "LAST_ACTIVITY_UPDATE_INTERVAL", 30)  # сек


class LastActivityMiddleware:
    """
    Обновляет поле user.last_activity не чаще, чем раз в UPDATE_INTERVAL секунд.
    ДОЛЖЕН стоять ПОСЛЕ AuthenticationMiddleware в settings.MIDDLEWARE.
    Работает безопасно: если у модели пользователя нет поля last_activity — ничего не делает.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        self._maybe_touch_last_activity(request)
        return self.get_response(request)

    def _maybe_touch_last_activity(self, request):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return

        # Троттлим обращение к БД через кэш (чтобы не писать на каждый запрос)
        cache_key = f"last_activity_update:{user.pk}"
        if cache.get(cache_key):
            return

        # Проверяем наличие поля у модели
        UserModel = type(user)
        try:
            UserModel._meta.get_field("last_activity")
        except Exception:
            # Поля нет — тихо выходим
            return

        try:
            # Обновляем атомарно без загрузки всей модели
            UserModel.objects.filter(pk=user.pk).update(last_activity=timezone.now())
            cache.set(cache_key, True, UPDATE_INTERVAL)
        except Exception:
            # Никогда не роняем запрос из-за технических ошибок
            return
