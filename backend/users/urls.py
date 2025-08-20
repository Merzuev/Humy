from django.urls import path
from .views import RegisterView, LoginView, ProfileView, UserSettingsView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='auth-login'),
    path('profile/', ProfileView.as_view(), name='profile'),
    path('users/settings/', UserSettingsView.as_view(), name='user-settings'),  # <-- добавлен эндпоинт
]
