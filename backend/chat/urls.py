from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    FolderViewSet,
    ChatViewSet,
    MessageViewSet,
    ConversationsViewSet,
    ConversationMessagesView,
    # — друзья / блок —
    FriendRequestViewSet, FriendsViewSet, BlockViewSet,
    # — поиск пользователей —
    UserSearchView,
)

app_name = 'chat'

router = DefaultRouter()
router.register(r'folders', FolderViewSet, basename='folder')
router.register(r'chats', ChatViewSet, basename='chat')
router.register(r'messages', MessageViewSet, basename='message')
router.register(r'conversations', ConversationsViewSet, basename='conversations')
router.register(r'friends/requests', FriendRequestViewSet, basename='friend-requests')
router.register(r'friends', FriendsViewSet, basename='friends')
router.register(r'block', BlockViewSet, basename='block')

urlpatterns = [
    path('', include(router.urls)),
    path('conversations/<int:pk>/messages/', ConversationMessagesView.as_view(), name='conversation-messages'),
    path('users/search/', UserSearchView.as_view(), name='user-search'),
]
