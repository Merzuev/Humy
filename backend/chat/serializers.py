from rest_framework import serializers
from .models import Folder, Chat, Label
from .models import Message

class LabelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Label
        fields = ['id', 'name', 'color']

class ChatSerializer(serializers.ModelSerializer):
    folders = serializers.PrimaryKeyRelatedField(many=True, queryset=Folder.objects.all())
    labels = LabelSerializer(many=True, read_only=True)

    class Meta:
        model = Chat
        fields = ['id', 'name', 'folders', 'labels', 'is_protected', 'created_at']

# ЛЁГКИЙ сериализатор для списка папок (без рекурсии и без чатов)
class FolderListSerializer(serializers.ModelSerializer):
    parent = serializers.PrimaryKeyRelatedField(read_only=True)
    labels = LabelSerializer(many=True, read_only=True)

    class Meta:
        model = Folder
        fields = ['id', 'name', 'parent', 'created_at', 'labels']

# ПОЛНЫЙ сериализатор для detail (включает детей и чаты)
class FolderSerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()
    chats = serializers.SerializerMethodField()
    labels = LabelSerializer(many=True, read_only=True)
    parent = serializers.PrimaryKeyRelatedField(queryset=Folder.objects.all(), allow_null=True, required=False)

    class Meta:
        model = Folder
        fields = ['id', 'name', 'parent', 'created_at', 'labels', 'children', 'chats']

    def get_children(self, obj):
        # В children отдаём ЛЁГКИЕ записи (без рекурсий)
        return FolderListSerializer(obj.children.all(), many=True).data

    def get_chats(self, obj):
        return ChatSerializer(obj.chats.all(), many=True).data

#/////////////////Massage///////////////////////

class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = [
            'id', 'room', 'author', 'display_name', 'content',
            'reply_to', 'created_at', 'edited_at', 'deleted_at', 'meta'
        ]
        read_only_fields = ['id', 'author', 'created_at', 'edited_at', 'deleted_at']