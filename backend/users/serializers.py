from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
import json

User = get_user_model()


# Функция валидации изображения
def validate_image_extension(image):
    valid_mime_types = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if image.content_type not in valid_mime_types:
        raise ValidationError('Неподдерживаемый формат изображения. Разрешены: JPG, PNG, WEBP, GIF.')
    return image


class RegisterSerializer(serializers.ModelSerializer):
    nickname = serializers.CharField(required=True)
    country = serializers.CharField(required=True)
    city = serializers.CharField(required=True)
    avatar = serializers.ImageField(required=False, allow_null=True, validators=[validate_image_extension])
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


class ProfileSerializer(serializers.ModelSerializer):
    avatar = serializers.ImageField(required=False, allow_null=True, use_url=True, validators=[validate_image_extension])

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

    def to_internal_value(self, data):
        data = data.copy()

        for field in ['languages', 'interests']:
            value = data.get(field)
            if isinstance(value, str):
                try:
                    data[field] = json.loads(value)
                except json.JSONDecodeError:
                    raise serializers.ValidationError({
                        field: 'Неверный формат. Ожидался список (array).'
                    })

        return super().to_internal_value(data)

    def update(self, instance, validated_data):
        for field in ['languages', 'interests']:
            value = validated_data.get(field)
            if isinstance(value, str):
                try:
                    validated_data[field] = json.loads(value)
                except json.JSONDecodeError:
                    validated_data[field] = []

        # Если аватар отсутствует (удаление), не заменяем None, просто пропускаем
        avatar = validated_data.get('avatar', None)
        if avatar is None and 'avatar' in validated_data:
            validated_data.pop('avatar', None)

        return super().update(instance, validated_data)
