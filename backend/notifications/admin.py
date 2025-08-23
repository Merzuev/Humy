from django.contrib import admin
from .models import Notification, GroupChatSubscription


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "type", "is_read", "created_at")
    list_filter = ("type", "is_read", "created_at")
    search_fields = ("user__email", "user__username")
    date_hierarchy = "created_at"


@admin.register(GroupChatSubscription)
class GroupChatSubscriptionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "room_id", "muted", "created_at")
    list_filter = ("muted", "created_at")
    search_fields = ("user__email", "user__username", "room_id")
    autocomplete_fields = ("user",)
    date_hierarchy = "created_at"
