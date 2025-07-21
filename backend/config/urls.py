from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),

    # Аутентификация (Djoser + JWT)
    path('auth/', include('djoser.urls')),
    path('auth/', include('djoser.urls.jwt')),

    # API
    path('api/', include('users.urls')),  # Пользователи
    path('api/', include('chat.urls')),   # Чаты и сообщения
]

# Медиафайлы (аватары и т.п.)
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
