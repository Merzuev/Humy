from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    interface_language = serializers.CharField()  # 👈 используем правильное имя

    class Meta:
        model = User
        fields = ['email', 'password', 'interface_language']

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user



class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'email',
            'first_name',
            'last_name',
            'nickname',              # ✅ новое поле
            'birth_date',
            'country',
            'city',
            'interests',
            'languages',
            'avatar',                # ✅ поле для изображения
            'theme',
        ]
        read_only_fields = ['email']
