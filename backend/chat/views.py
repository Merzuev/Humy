from rest_framework import generics, permissions, status
from rest_framework.response import Response
from .models import Country, Region, City, ChatRoom
from .serializers import (
    CountrySerializer, RegionSerializer, CitySerializer, ChatRoomSerializer, ChatRoomCreateSerializer
)
from .models import Message
from .serializers import MessageSerializer
from rest_framework import permissions
from rest_framework.pagination import PageNumberPagination
from .serializers import MessageSerializer, MessageUpdateSerializer

# Список стран
class CountryListView(generics.ListAPIView):
    queryset = Country.objects.all()
    serializer_class = CountrySerializer

# Список регионов по стране
class RegionListByCountryView(generics.ListAPIView):
    serializer_class = RegionSerializer
    def get_queryset(self):
        country_id = self.kwargs['country_id']
        return Region.objects.filter(country_id=country_id)

# Список городов по региону
class CityListByRegionView(generics.ListAPIView):
    serializer_class = CitySerializer
    def get_queryset(self):
        region_id = self.kwargs['region_id']
        return City.objects.filter(region_id=region_id)

# Список чатов по городу
class ChatRoomListByCityView(generics.ListAPIView):
    serializer_class = ChatRoomSerializer
    def get_queryset(self):
        city_id = self.kwargs['city_id']
        return ChatRoom.objects.filter(cities__id=city_id).distinct()

# Детали чата
class ChatRoomDetailView(generics.RetrieveAPIView):
    queryset = ChatRoom.objects.all()
    serializer_class = ChatRoomSerializer

# Создание чата с учётом ролей, лимитов и назначения создателя
class ChatRoomCreateView(generics.CreateAPIView):
    queryset = ChatRoom.objects.all()
    serializer_class = ChatRoomCreateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        user = request.user
        if not user.can_create_room():
            return Response(
                {"detail": "Превышен лимит на создание комнат для вашей роли."},
                status=status.HTTP_403_FORBIDDEN
            )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        chat = serializer.save(creator=user)
        read_serializer = ChatRoomSerializer(chat, context={'request': request})
        return Response(read_serializer.data, status=status.HTTP_201_CREATED)


#/////Message///////


# Получить все сообщения в чате (история чата)

class MessagePagination(PageNumberPagination):
    page_size = 50  # по умолчанию отдавать 50 сообщений
    page_size_query_param = 'page_size'
    max_page_size = 200

class MessageListView(generics.ListAPIView):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = MessagePagination

    def get_queryset(self):
        chat_id = self.kwargs['chat_id']
        return Message.objects.filter(chat_id=chat_id, deleted=False).order_by('-created_at')
# Отправить сообщение в чат
class MessageCreateView(generics.CreateAPIView):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(sender=self.request.user)

class MessageUpdateView(generics.UpdateAPIView):
    queryset = Message.objects.all()
    serializer_class = MessageUpdateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, *args, **kwargs):
        message = self.get_object()
        user = request.user
        if message.sender != user and user.role not in ('admin', 'moderator'):
            return Response({'detail': 'Нет прав на редактирование!'}, status=403)
        serializer = self.get_serializer(message, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(edited=True)
        return Response(MessageSerializer(message).data)

class MessageDeleteView(generics.DestroyAPIView):
    queryset = Message.objects.all()
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, *args, **kwargs):
        message = self.get_object()
        user = request.user
        if message.sender != user and user.role not in ('admin', 'moderator'):
            return Response({'detail': 'Нет прав на удаление!'}, status=403)
        message.deleted = True
        message.save()
        return Response({'detail': 'Сообщение удалено.'})