# backend/chat/ws_auth.py
from urllib.parse import parse_qs
from asgiref.sync import sync_to_async
from django.contrib.auth.models import AnonymousUser
from django.utils.functional import LazyObject

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken

class _LazyUser(LazyObject):
    def _setup(self):
        self._wrapped = AnonymousUser()

async def _get_user_from_token(token: str):
    """
    Валидируем JWT и возвращаем пользователя. Если токен битый — AnonymousUser.
    """
    try:
        jwt_auth = JWTAuthentication()
        validated = jwt_auth.get_validated_token(token)
        user = await sync_to_async(jwt_auth.get_user)(validated)
        return user
    except InvalidToken:
        return AnonymousUser()
    except Exception:
        return AnonymousUser()

class JWTAuthMiddleware:
    """
    Достаёт JWT из:
      - заголовка Authorization: Bearer <token>
      - либо из query-параметра ?token=<token>
    Кладёт пользователя в scope['user'].
    """
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        user = _LazyUser()
        try:
            headers = dict(scope.get("headers") or [])
            token = None

            # 1) Authorization: Bearer <token>
            auth = headers.get(b"authorization")
            if auth:
                try:
                    auth_str = auth.decode()
                    if auth_str.lower().startswith("bearer "):
                        token = auth_str.split(" ", 1)[1].strip()
                except Exception:
                    token = None

            # 2) query ?token=<token>
            if not token:
                raw_qs = scope.get("query_string", b"").decode()
                qs = parse_qs(raw_qs)
                if "token" in qs and len(qs["token"]) > 0:
                    token = qs["token"][0]

            if token:
                user = await _get_user_from_token(token)
        finally:
            scope["user"] = user

        return await self.inner(scope, receive, send)

# Обёртка-стек: сначала JWT, затем стандартная session/cookie аутентификация
from channels.auth import AuthMiddlewareStack

def JWTAuthMiddlewareStack(inner):
    return JWTAuthMiddleware(AuthMiddlewareStack(inner))
