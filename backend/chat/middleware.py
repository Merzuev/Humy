# chat/middleware.py
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError


@database_sync_to_async
def get_user_from_token(token_key: str):
    try:
        access = AccessToken(token_key)
        user_id = access.get("user_id")
        if not user_id:
            return AnonymousUser()

        # Ленивая загрузка модели пользователя (после django.setup())
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            return User.objects.get(id=user_id)
        except User.DoesNotExist:
            return AnonymousUser()
    except (InvalidToken, TokenError) as e:
        print(f"[WS][JWT] invalid token: {e}")
        return AnonymousUser()
    except Exception as e:
        print(f"[WS][JWT] unexpected error: {e}")
        return AnonymousUser()


class JwtAuthMiddleware:
    """
    Достаёт ?token=<JWT> из query string, валидирует и добавляет пользователя в scope['user'].
    Если токена нет/невалиден — AnonymousUser.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        raw_qs = scope.get("query_string", b"").decode("utf-8")
        params = parse_qs(raw_qs)
        token = (params.get("token") or [None])[0]

        # Диагностика — видно, пришёл ли токен и какой длины
        print(f"[WS][MW] path={scope.get('path')} qs='{raw_qs}' token_len={len(token) if token else 0}")

        if token:
            scope["user"] = await get_user_from_token(token)
        else:
            scope["user"] = AnonymousUser()

        return await self.app(scope, receive, send)
