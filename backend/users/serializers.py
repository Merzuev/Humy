from rest_framework import serializers
from django.contrib.auth import get_user_model
import json

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['email', 'password', 'password2', 'interface_language']
        extra_kwargs = {
            'password': {'write_only': True},
            'password2': {'write_only': True},
        }

    def validate(self, data):
        if data['password'] != data['password2']:
            raise serializers.ValidationError("Пароли не совпадают.")
        return data

    def create(self, validated_data):
        validated_data.pop('password2')
        password = validated_data.pop('password')
        user = User.objects.create(**validated_data)
        user.set_password(password)
        user.save()
        return user




class ProfileSerializer(serializers.ModelSerializer):
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
