from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from django.contrib.auth import get_user_model
from django.contrib.auth import authenticate

from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import RegisterSerializer, ProfileSerializer

User = get_user_model()


class RegisterView(APIView):
    """
    Регистрация пользователя по email или телефону.
    Возвращает access и refresh токены.
    """
    def post(self, request):
        data = request.data
        identifier = data.get("email") or data.get("phone")
        password = data.get("password")
        language = data.get("language")

        if not identifier or not password:
            return Response({"detail": "Email/Phone и пароль обязательны"}, status=400)

        # Проверка существующего пользователя
        if "@" in identifier:
            if User.objects.filter(email=identifier).exists():
                return Response({"detail": "Пользователь с таким email уже существует"}, status=400)
            user = User(email=identifier, language=language)
        else:
            if User.objects.filter(phone=identifier).exists():
                return Response({"detail": "Пользователь с таким номером уже существует"}, status=400)
            user = User(phone=identifier, language=language)

        user.set_password(password)
        user.save()

        refresh = RefreshToken.for_user(user)
        return Response({
            "access_token": str(refresh.access_token),
            "refresh_token": str(refresh),
        }, status=201)


class LoginView(APIView):
    """
    Авторизация по email или телефону + пароль.
    Возвращает JWT access и refresh токены.
    """
    def post(self, request):
        identifier = request.data.get("email") or request.data.get("phone")
        password = request.data.get("password")

        if not identifier or not password:
            return Response({"detail": "Email/Phone и пароль обязательны"}, status=400)

        try:
            if "@" in identifier:
                user = User.objects.get(email=identifier)
            else:
                user = User.objects.get(phone=identifier)
        except User.DoesNotExist:
            return Response({"detail": "Пользователь не найден"}, status=401)

        if not user.check_password(password):
            return Response({"detail": "Неверный пароль"}, status=401)

        refresh = RefreshToken.for_user(user)
        return Response({
            "access_token": str(refresh.access_token),
            "refresh_token": str(refresh),
        })


class ProfileView(APIView):
    """
    Получение и обновление профиля.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = ProfileSerializer(request.user)
        return Response(serializer.data)

    def put(self, request):
        serializer = ProfileSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
