from django.apps import AppConfig


class NotificationsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "notifications"

    def ready(self):
        # Подключаем интеграции (без падений, если модели не найдены)
        try:
            from . import integrations  # noqa
            integrations.connect_signals()
        except Exception:
            # Ничего не делаем — интеграция опциональна и не должна ломать запуск
            pass
