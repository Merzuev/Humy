# config/asgi.py
import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

django_asgi_app = get_asgi_application()

# ===== JWT-аутентификация для WebSocket =====
# Каналы по умолчанию аутентифицируют по cookie-сессии (AuthMiddlewareStack),
# а у тебя фронт подключается с JWT (?token=...). Добавляем middleware,
# который достаёт токен из query string и подставляет scope['user'].

from urllib.parse import parse_qs
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from channels.db import database_sync_to_async
from rest_framework_simplejwt.tokens import AccessToken

class JWTAuthMiddleware:
    """
    Middleware для Django Channels:
    - ищет JWT в ?token=... или ?authorization=Bearer <token>
    - валидирует его через DRF SimpleJWT
    - пишет пользователя в scope['user']
    """
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        if scope.get("type") != "websocket":
            return await self.inner(scope, receive, send)

        scope["user"] = await self._get_user(scope)
        return await self.inner(scope, receive, send)

    @database_sync_to_async
    def _get_user(self, scope):
        try:
            raw_qs = (scope.get("query_string") or b"").decode()
            qs = parse_qs(raw_qs)

            token = None
            if "token" in qs and qs["token"]:
                token = qs["token"][0]
            elif "authorization" in qs and qs["authorization"]:
                auth = qs["authorization"][0]
                if auth.lower().startswith("bearer "):
                    token = auth.split(" ", 1)[1].strip()

            if not token:
                return AnonymousUser()

            access = AccessToken(token)
            user_id = access.get("user_id") or access.get("id")
            if not user_id:
                return AnonymousUser()

            User = get_user_model()
            try:
                return User.objects.get(pk=user_id)
            except User.DoesNotExist:
                return AnonymousUser()
        except Exception:
            return AnonymousUser()

# Роуты WS
import chat.routing  # noqa: E402

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    # Важно: используем JWTAuthMiddleware, а не AuthMiddlewareStack
    "websocket": JWTAuthMiddleware(
        URLRouter(chat.routing.websocket_urlpatterns)
    ),
})
