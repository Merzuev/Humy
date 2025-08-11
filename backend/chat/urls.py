from rest_framework.routers import DefaultRouter
from .views import FolderViewSet, ChatViewSet

router = DefaultRouter()
router.register(r'folders', FolderViewSet, basename='folder')
router.register(r'chats', ChatViewSet, basename='chat')

urlpatterns = router.urls
