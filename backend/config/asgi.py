import os
import django
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

print(f"[WS][IMPORT] config.asgi loaded")

from chat.middleware import JwtAuthMiddleware  # noqa: E402
import chat.routing  # noqa: E402

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": JwtAuthMiddleware(URLRouter(chat.routing.websocket_urlpatterns)),
})
