import os

# 1) Настраиваем Django до любых импортов из django.*
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django
django.setup()

from urllib.parse import parse_qs

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from channels.auth import AuthMiddlewareStack
from channels.db import database_sync_to_async
from django.core.asgi import get_asgi_application
from django.contrib.auth.models import AnonymousUser
from django.urls import path

# === Консьюмеры WebSocket ===
from notifications.consumers import NotificationsConsumer

# Пытаемся подключить чат мягко, чтобы не ломать проект, если chat ещё не готов
try:
    from chat.consumers import ChatConsumer  # ws://.../ws/chat/<room_id>/
except Exception:
    ChatConsumer = None  # чат будет пропущен в маршрутах

# SimpleJWT для валидации токена
from rest_framework_simplejwt.authentication import JWTAuthentication


# ===== JWT через query-string для WebSocket =====
class QueryStringJWTAuthMiddleware:
    """
    Достаём ?token=<JWT> из query-string и аутентифицируем пользователя для WS.
    Если токена нет/невалиден — оставляем AnonymousUser.
    """

    def __init__(self, inner):
        self.inner = inner
        self.jwt_auth = JWTAuthentication()

    async def __call__(self, scope, receive, send):
        # Если уже есть user (например, сессия) — оставим, иначе попробуем по token
        user = scope.get("user", AnonymousUser())
        if not getattr(user, "is_authenticated", False):
            token = None
            try:
                qs = parse_qs((scope.get("query_string") or b"").decode())
                token = (qs.get("token") or [None])[0]
            except Exception:
                token = None
            user = await self._get_user_from_token(token)

        scope["user"] = user or AnonymousUser()
        return await self.inner(scope, receive, send)

    @database_sync_to_async
    def _get_user_from_token(self, token_str):
        if not token_str:
            return AnonymousUser()
        try:
            validated = self.jwt_auth.get_validated_token(token_str)
            return self.jwt_auth.get_user(validated)
        except Exception:
            return AnonymousUser()


def JWTAuthMiddlewareStack(inner):
    # Сочетаем стандартный AuthMiddlewareStack (сессия/cookies)
    # и наш QueryStringJWTAuthMiddleware (JWT через ?token)
    return QueryStringJWTAuthMiddleware(AuthMiddlewareStack(inner))


# ===== WS-маршруты =====
websocket_urlpatterns = [
    # Уведомления: ws://<host>/ws/notifications/?token=...
    path("ws/notifications/", NotificationsConsumer.as_asgi()),
]

# Добавим чат, только если он доступен (чтобы ничего не падало)
if ChatConsumer is not None:
    # ЧАТ: ws://<host>/ws/chat/<room_id>/?token=...
    websocket_urlpatterns.append(
        path("ws/chat/<int:room_id>/", ChatConsumer.as_asgi())
    )

# ===== ASGI-приложение =====
application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AllowedHostsOriginValidator(
        JWTAuthMiddlewareStack(
            URLRouter(websocket_urlpatterns)
        )
    ),
})
