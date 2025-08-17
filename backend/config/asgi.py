# config/asgi.py
import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack  # авторизация по сессии (cookies)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

django_asgi_app = get_asgi_application()

# Импорт роутинга после инициализации Django
import chat.routing  # noqa: E402

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AuthMiddlewareStack(
        # Все WS-маршруты собираем в chat.routing.websocket_urlpatterns
        URLRouter(chat.routing.websocket_urlpatterns)
    ),
})
