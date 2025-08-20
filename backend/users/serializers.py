from rest_framework import serializers
from django.contrib.auth import get_user_model
from PIL import Image, UnidentifiedImageError
from io import BytesIO
import json
from django.core.files.uploadedfile import InMemoryUploadedFile

# Поддержка HEIC (iPhone)
from pillow_heif import register_heif_opener
register_heif_opener()

User = get_user_model()

from .models import UserSettings  # <-- добавили импорт


# ✅ Регистрация пользователя
class RegisterSerializer(serializers.ModelSerializer):
    nickname = serializers.CharField(required=True)
    country = serializers.CharField(required=True)
    city = serializers.CharField(required=True)
    avatar = serializers.ImageField(required=False, allow_null=True)
    interests = serializers.JSONField(required=False)
    languages = serializers.JSONField(required=False)
    phone = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)
    birth_date = serializers.DateField(required=False)

    class Meta:
        model = User
        fields = [
            'email',
            'phone',
            'password',
            'interface_language',
            'nickname',
            'country',
            'city',
            'avatar',
            'interests',
            'languages',
            'birth_date',
        ]
        extra_kwargs = {
            'password': {'write_only': True}
        }

    def validate(self, attrs):
        email = attrs.get('email')
        phone = attrs.get('phone')

        if not email and not phone:
            raise serializers.ValidationError("Нужно указать email или номер телефона.")

        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')

        for field in ['interests', 'languages']:
            value = validated_data.get(field)
            if isinstance(value, str):
                try:
                    validated_data[field] = json.loads(value)
                except json.JSONDecodeError:
                    validated_data[field] = []

        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


# ✅ Профиль пользователя
class ProfileSerializer(serializers.ModelSerializer):
    avatar = serializers.ImageField(
        required=False,
        allow_null=True,
        use_url=True
    )

    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'first_name',
            'last_name',
            'nickname',
            'birth_date',
            'country',
            'city',
            'interests',
            'languages',
            'avatar',
            'theme',
            'interface_language',
        ]
        read_only_fields = ['email']

    def validate_avatar(self, avatar):
        if not avatar:
            return avatar

        try:
            image = Image.open(avatar)

            if image.mode != 'RGB':
                image = image.convert('RGB')

            buffer = BytesIO()
            image.save(buffer, format='JPEG', quality=85)
            buffer.seek(0)

            new_name = avatar.name.rsplit('.', 1)[0] + '.jpg'

            return InMemoryUploadedFile(
                file=buffer,
                field_name='avatar',
                name=new_name,
                content_type='image/jpeg',
                size=buffer.getbuffer().nbytes,
                charset=None
            )

        except UnidentifiedImageError:
            raise serializers.ValidationError(
                'Не удалось распознать файл как изображение. '
                'Пожалуйста, используйте форматы: JPG, PNG, GIF, HEIC.'
            )
        except Exception as e:
            raise serializers.ValidationError(f'Ошибка при обработке изображения: {str(e)}')

    def update(self, instance, validated_data):
        """Обновляет данные профиля, корректно обрабатывая удаление аватара."""
        if 'avatar' in validated_data and validated_data['avatar'] is None:
            if instance.avatar:
                instance.avatar.delete(save=False)
        return super().update(instance, validated_data)


# ✅ Сериализатор настроек пользователя (для /api/users/settings/)
class UserSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserSettings
        fields = (
            # General
            'language', 'theme', 'font_size',
            # Notifications
            'push_notifications', 'sound_notifications', 'email_notifications',
            'message_notifications', 'group_notifications',
            # Privacy
            'profile_visibility', 'online_status', 'read_receipts', 'last_seen',
            # Chat
            'auto_download_images', 'auto_download_videos',
            'auto_download_documents', 'enter_to_send',
            # Media
            'camera_permission', 'microphone_permission', 'autoplay_videos',
            # Security
            'two_factor_auth', 'session_timeout',
            # Network
            'auto_connect', 'data_usage',
        )

    def validate_session_timeout(self, value):
        # Безопасные пределы: 1..1440 минут (сутки)
        if value < 1 or value > 1440:
            raise serializers.ValidationError("Session timeout must be between 1 and 1440 minutes.")
        return value
