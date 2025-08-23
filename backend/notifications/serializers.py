from rest_framework import serializers
from .models import Notification, GroupChatSubscription


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ("id", "type", "payload", "is_read", "created_at")


class GroupChatSubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = GroupChatSubscription
        fields = ("id", "room_id", "muted", "created_at", "updated_at")
