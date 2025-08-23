# chat/routing.py
print(f"[WS][IMPORT] chat.routing loaded from {__file__}")

from django.urls import re_path
from .consumers import ChatConsumer
from notifications.consumers import NotificationsConsumer  # если у вас есть канал уведомлений

websocket_urlpatterns = [
    re_path(r"^ws/chat/(?P<room_id>\d+)/$", ChatConsumer.as_asgi()),
    re_path(r"^ws/notifications/$", NotificationsConsumer.as_asgi()),
]

print(f"[WS][ROUTING] websocket_urlpatterns count={len(websocket_urlpatterns)}")
