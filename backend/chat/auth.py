from urllib.parse import parse_qs

from asgiref.sync import sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken

class JWTAuthMiddleware:
    """
    Разбирает ?token=... из query string и кладёт user в scope['user'].
    Если токена нет/он невалидный — пускаем как AnonymousUser (для DEV).
    """
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        # по умолчанию — аноним
        scope['user'] = AnonymousUser()

        try:
            raw_qs = scope.get('query_string', b'').decode()
            query = parse_qs(raw_qs)
            token = (query.get('token') or [None])[0]
            if token:
                access = AccessToken(token)
                user_id = access.get('user_id')
                if user_id:
                    from users.models import User
                    user = await sync_to_async(User.objects.get)(id=user_id)
                    scope['user'] = user
        except Exception:
            # ничего не падаем, просто оставляем анонима
            pass

        return await self.app(scope, receive, send)
