# backend/chat/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FolderViewSet, ChatViewSet, MessageViewSet  # теперь класс уже есть

app_name = 'chat'

router = DefaultRouter()
router.register(r'folders', FolderViewSet, basename='folder')
router.register(r'chats',   ChatViewSet,   basename='chat')
router.register(r'messages', MessageViewSet, basename='message')

urlpatterns = [
    path('', include(router.urls)),
]
