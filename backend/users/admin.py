from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Профиль", {"fields": (
            "first_name", "last_name", "nickname", "birth_date",
            "country", "city", "avatar", "languages", "interests",
            "theme", "interface_language"
        )}),
        ("Права", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Даты", {"fields": ("last_login",)}),
    )
    list_display = ("email", "nickname", "country", "city")
    search_fields = ("email", "nickname", "country", "city")
    ordering = ("email",)  # ✅ здесь была ошибка: было 'username'
