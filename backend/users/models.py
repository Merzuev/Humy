from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db import models
from django.db.models import JSONField
from django.db.models.signals import post_save
from django.dispatch import receiver


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
    email = models.EmailField(unique=True, null=True, blank=True)
    phone = models.CharField(max_length=20, unique=True, null=True, blank=True)
    first_name = models.CharField(max_length=30, blank=True)
    last_name = models.CharField(max_length=30, blank=True)
    nickname = models.CharField(max_length=50, blank=True)
    birth_date = models.DateField(null=True, blank=True)
    country = models.CharField(max_length=100, blank=True)
    city = models.CharField(max_length=100, blank=True)
    languages = JSONField(default=list, blank=True)
    interests = JSONField(default=list, blank=True)
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


# ===== Настройки пользователя для раздела "Настройки" =====

class UserSettings(models.Model):
    """Персональные настройки пользователя (1:1 с User)."""
    VISIBILITY_PUBLIC = 'public'
    VISIBILITY_FRIENDS = 'friends'
    VISIBILITY_PRIVATE = 'private'
    VISIBILITY_CHOICES = [
        (VISIBILITY_PUBLIC, 'Public'),
        (VISIBILITY_FRIENDS, 'Friends'),
        (VISIBILITY_PRIVATE, 'Private'),
    ]

    DATA_USAGE_LOW = 'low'
    DATA_USAGE_MEDIUM = 'medium'
    DATA_USAGE_HIGH = 'high'
    DATA_USAGE_CHOICES = [
        (DATA_USAGE_LOW, 'Low'),
        (DATA_USAGE_MEDIUM, 'Medium'),
        (DATA_USAGE_HIGH, 'High'),
    ]

    THEME_LIGHT = 'light'
    THEME_DARK = 'dark'
    THEME_AUTO = 'auto'
    THEME_CHOICES = [
        (THEME_LIGHT, 'Light'),
        (THEME_DARK, 'Dark'),
        (THEME_AUTO, 'Auto'),
    ]

    FONT_SMALL = 'small'
    FONT_MEDIUM = 'medium'
    FONT_LARGE = 'large'
    FONT_CHOICES = [
        (FONT_SMALL, 'Small'),
        (FONT_MEDIUM, 'Medium'),
        (FONT_LARGE, 'Large'),
    ]

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='settings',
        primary_key=True,
    )

    # Общие
    language = models.CharField(max_length=10, default='en')
    theme = models.CharField(max_length=10, choices=THEME_CHOICES, default=THEME_DARK)
    font_size = models.CharField(max_length=10, choices=FONT_CHOICES, default=FONT_MEDIUM)

    # Уведомления
    push_notifications = models.BooleanField(default=True)
    sound_notifications = models.BooleanField(default=True)
    email_notifications = models.BooleanField(default=False)
    message_notifications = models.BooleanField(default=True)
    group_notifications = models.BooleanField(default=True)

    # Приватность
    profile_visibility = models.CharField(max_length=10, choices=VISIBILITY_CHOICES, default=VISIBILITY_PUBLIC)
    online_status = models.BooleanField(default=True)
    read_receipts = models.BooleanField(default=True)
    last_seen = models.BooleanField(default=True)

    # Чат
    auto_download_images = models.BooleanField(default=True)
    auto_download_videos = models.BooleanField(default=False)
    auto_download_documents = models.BooleanField(default=False)
    enter_to_send = models.BooleanField(default=True)

    # Медиа
    camera_permission = models.BooleanField(default=True)
    microphone_permission = models.BooleanField(default=True)
    autoplay_videos = models.BooleanField(default=False)

    # Безопасность
    two_factor_auth = models.BooleanField(default=False)
    session_timeout = models.PositiveIntegerField(default=30)  # минуты

    # Сеть
    auto_connect = models.BooleanField(default=True)
    data_usage = models.CharField(max_length=10, choices=DATA_USAGE_CHOICES, default=DATA_USAGE_MEDIUM)

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Settings<{self.user_id}>"


@receiver(post_save, sender=User)
def create_user_settings(sender, instance, created, **kwargs):
    """Автосоздание записи настроек при создании пользователя."""
    if created:
        UserSettings.objects.create(user=instance)
