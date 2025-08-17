# chat/routing.py
# При импорте покажем, откуда грузится роутинг и какие паттерны
print(f"[WS][IMPORT] chat.routing loaded from {__file__}")

from django.urls import re_path
from .consumers import ChatConsumer
from notifications.consumers import NotificationsConsumer  # <-- новый канал уведомлений

websocket_urlpatterns = [
    # Публичные/групповые/приватные комнаты (как было)
    re_path(r"^ws/chat/(?P<room_id>\d+)/$", ChatConsumer.as_asgi()),

    # Личные уведомления пользователю (друзья/бейджи ЛС/прочтения)
    re_path(r"^ws/notifications/$", NotificationsConsumer.as_asgi()),
]

print(f"[WS][ROUTING] websocket_urlpatterns count={len(websocket_urlpatterns)}")
