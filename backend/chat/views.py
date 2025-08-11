from rest_framework import viewsets
from .models import Folder, Chat
from .serializers import FolderSerializer, ChatSerializer

class FolderViewSet(viewsets.ModelViewSet):
    queryset = Folder.objects.all()
    serializer_class = FolderSerializer

class ChatViewSet(viewsets.ModelViewSet):
    queryset = Chat.objects.all()
    serializer_class = ChatSerializer
