from rest_framework import serializers
from .models import Folder, Chat, Label

class LabelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Label
        fields = ['id', 'name', 'color']

class ChatSerializer(serializers.ModelSerializer):
    folders = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Folder.objects.all()
    )
    labels = LabelSerializer(many=True, read_only=True)

    class Meta:
        model = Chat
        fields = ['id', 'name', 'folders', 'labels', 'is_protected', 'created_at']

class FolderSerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()
    chats = serializers.SerializerMethodField()
    labels = LabelSerializer(many=True, read_only=True)
    parent = serializers.PrimaryKeyRelatedField(
        queryset=Folder.objects.all(), allow_null=True, required=False
    )

    class Meta:
        model = Folder
        fields = ['id', 'name', 'parent', 'created_at', 'labels', 'children', 'chats']

    def get_children(self, obj):
        return FolderSerializer(obj.children.all(), many=True).data

    def get_chats(self, obj):
        return ChatSerializer(obj.chats.all(), many=True).data
