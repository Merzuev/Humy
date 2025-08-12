# При импорте покажем, откуда грузится роутинг и какие паттерны
print(f"[WS][IMPORT] chat.routing loaded from {__file__}")

from django.urls import re_path
from .consumers import ChatConsumer

websocket_urlpatterns = [
    re_path(r"^ws/chat/(?P<room_id>\d+)/$", ChatConsumer.as_asgi()),
]

print(f"[WS][ROUTING] websocket_urlpatterns count={len(websocket_urlpatterns)}")
