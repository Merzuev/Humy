from django.urls import path
from .views import RegisterView, LoginView, ProfileView
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    # Авторизация и токены
    path('login/', LoginView.as_view(), name='login'),                     # наша кастомная логика по email или телефону
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/login/', LoginView.as_view(), name='auth-login'),

    # Регистрация
    path('register/', RegisterView.as_view(), name='register'),

    # Профиль
    path('profile/', ProfileView.as_view(), name='profile'),
]
