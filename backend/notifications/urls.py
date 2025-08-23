from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    NotificationViewSet,
    group_chat_subscription_status,
    group_chat_subscribe,
    group_chat_unsubscribe,
    group_chat_mute,
)

router = DefaultRouter()
router.register("notifications", NotificationViewSet, basename="notifications")

urlpatterns = [
    path("api/", include(router.urls)),

    # Group chat subscription endpoints:
    path("api/group-chats/<int:room_id>/status/", group_chat_subscription_status),
    path("api/group-chats/<int:room_id>/subscribe/", group_chat_subscribe),
    path("api/group-chats/<int:room_id>/unsubscribe/", group_chat_unsubscribe),
    path("api/group-chats/<int:room_id>/mute/", group_chat_mute),
]
