from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db import models

class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email обязателен')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save()
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [
        ('admin', 'Администратор'),
        ('moderator', 'Модератор'),
        ('vip', 'VIP'),
        ('user', 'Пользователь'),
    ]
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=30, blank=True)
    last_name = models.CharField(max_length=30, blank=True)
    nickname = models.CharField(max_length=50, blank=True)  # ✅ новое поле
    birth_date = models.DateField(null=True, blank=True)
    country = models.CharField(max_length=100, blank=True)
    city = models.CharField(max_length=100, blank=True)
    interests = models.JSONField(default=list, blank=True)
    languages = models.JSONField(default=list, blank=True)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    theme = models.CharField(max_length=50, default='Светлая')
    interface_language = models.CharField(max_length=50, default='en')
    role = models.CharField(
        max_length=16,
        choices=ROLE_CHOICES,
        default='user',
        verbose_name="Роль пользователя"
    )

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    objects = UserManager()

    def __str__(self):
        return self.email

    def can_create_room(self):
        """Проверяет, может ли пользователь создать ещё одну комнату (с учётом роли и лимита)"""
        from chat.models import ChatRoom
        if self.role == 'admin':
            return True
        if self.role == 'moderator':
            return ChatRoom.objects.filter(creator=self).count() < 3
        if self.role == 'vip':
            return ChatRoom.objects.filter(creator=self).count() < 2
        return False
