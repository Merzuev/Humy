from rest_framework import viewsets, mixins
from .models import Folder, Chat
from .serializers import FolderSerializer, FolderListSerializer, ChatSerializer

from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from .models import Message
from .serializers import MessageSerializer
from rest_framework.pagination import CursorPagination


class FolderViewSet(viewsets.ModelViewSet):
    queryset = (
        Folder.objects
        .all()
        .select_related('parent')
        .prefetch_related('children', 'labels', 'chats')
    )
    serializer_class = FolderListSerializer  # по умолчанию — лёгкий

    def get_queryset(self):
        qs = super().get_queryset()
        parent = self.request.query_params.get('parent')
        root = self.request.query_params.get('root')

        # /api/folders/?parent=null  или  /api/folders/?root=true  -> корень
        if (parent is not None and parent == 'null') or (root and root.lower() in ('1', 'true', 'yes')):
            return qs.filter(parent__isnull=True)

        # /api/folders/?parent=<id> -> только прямые дети
        if parent is not None:
            return qs.filter(parent_id=parent)

        # без параметров — всё (например, для админки)
        return qs

    def get_serializer_class(self):
        # detail (retrieve/create/update) — полный сериализатор с children/chats
        if self.action in ['retrieve', 'create', 'update', 'partial_update']:
            return FolderSerializer
        return FolderListSerializer

class ChatViewSet(viewsets.ModelViewSet):
    queryset = Chat.objects.all().prefetch_related('folders', 'labels')
    serializer_class = ChatSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        folder = self.request.query_params.get('folder') or self.request.query_params.get('folders')
        if folder:
            qs = qs.filter(folders__id=folder)
        return qs.distinct()

#////////////////////Message/////////////////////////////

class MessagePagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200

class MessageViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = MessageSerializer
    pagination_class = MessagePagination
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        qs = Message.objects.select_related('author', 'room').filter(deleted_at__isnull=True)
        room = self.request.query_params.get('room')
        if room:
            qs = qs.filter(room_id=room)
        return qs
    
class MessageCursorPagination(CursorPagination):
    page_size = 30                     # сколько сообщений на страницу
    ordering = '-created_at'           # новейшие сначала (cursor умеет работать так корректно)

class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    pagination_class = MessageCursorPagination
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        qs = Message.objects.select_related('room', 'author')
        room_id = self.request.query_params.get('room')
        if room_id:
            qs = qs.filter(room_id=room_id)
        # ordering отдаёт новейшие, cursor построит next/previous
        return qs.order_by('-created_at')