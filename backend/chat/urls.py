from django.urls import path
from .views import (
    # География
    CountryListView,
    RegionListByCountryView,
    CityListByRegionView,

    # Комнаты чатов
    ChatRoomListByCityView,
    ChatRoomListAllView,     # ✅ Все чаты
    ChatRoomDetailView,
    ChatRoomCreateView,

    # Сообщения
    MessageListView,
    MessageCreateView,
    MessageUpdateView,
    MessageDeleteView,
)

urlpatterns = [
    # 🌍 География
    path('countries/', CountryListView.as_view(), name='country-list'),
    path('countries/<int:country_id>/regions/', RegionListByCountryView.as_view(), name='region-list-by-country'),
    path('regions/<int:region_id>/cities/', CityListByRegionView.as_view(), name='city-list-by-region'),

    # 💬 Комнаты чатов
    path('chats/', ChatRoomListAllView.as_view(), name='chat-list-all'),                  # Все комнаты (для dashboard)
    path('cities/<int:city_id>/chats/', ChatRoomListByCityView.as_view(), name='chat-list-by-city'),
    path('chats/create/', ChatRoomCreateView.as_view(), name='chat-create'),
    path('chats/<int:pk>/', ChatRoomDetailView.as_view(), name='chat-detail'),

    # 📩 Сообщения
    path('chats/<int:chat_id>/messages/', MessageListView.as_view(), name='message-list'),
    path('messages/send/', MessageCreateView.as_view(), name='message-send'),
    path('messages/<int:pk>/edit/', MessageUpdateView.as_view(), name='message-edit'),
    path('messages/<int:pk>/delete/', MessageDeleteView.as_view(), name='message-delete'),
]
