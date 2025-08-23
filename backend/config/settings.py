# config/settings.py
import os
from pathlib import Path
from datetime import timedelta
import environ
from corsheaders.defaults import default_headers

# ---------------- Base & env ----------------
env = environ.Env()
BASE_DIR = Path(__file__).resolve().parent.parent
environ.Env.read_env(BASE_DIR / ".env")  # .env в корне backend/ (рядом с config/)

# ---------------- Core Django ----------------
SECRET_KEY = env("SECRET_KEY")
DEBUG = env.bool("DEBUG", default=True)

ALLOWED_HOSTS = [
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
]

# ---------------- Installed apps ----------------
INSTALLED_APPS = [
    # Django
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Third-party
    "corsheaders",
    "channels",
    "rest_framework",
    "rest_framework.authtoken",
    "djoser",
    "rest_framework_simplejwt.token_blacklist",
    "mptt",

    # Local apps
    "users",
    "chat",
    # важно: используем AppConfig, чтобы сработал ready() и подключились интеграции
    "notifications.apps.NotificationsConfig",
]

# ---------------- Middleware ----------------
# ВАЖНО: CorsMiddleware должен быть выше CommonMiddleware
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",          # ← здесь
    "django.middleware.common.CommonMiddleware",      # ← после CORS
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    # Обновляем last_activity при HTTP-запросах
    "users.middleware.LastActivityMiddleware",
]

# ---------------- CORS/CSRF (dev) ----------------
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = list(default_headers) + [
    "authorization",
    "content-type",
]

CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# HTTP обслуживает WSGI (админка/скрипты), WebSocket — ASGI/Channels
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# ---------------- Database ----------------
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("DB_NAME"),
        "USER": env("DB_USER"),
        "PASSWORD": env("DB_PASSWORD"),
        "HOST": env("DB_HOST"),
        "PORT": env("DB_PORT"),
    }
}

# ---------------- Auth ----------------
AUTH_USER_MODEL = "users.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ---------------- i18n/time ----------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# ---------------- Static & Media ----------------
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------- DRF & JWT ----------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    # "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# ---------------- Channels (Redis + фолбэк InMemory) ----------------
REDIS_URL = env("REDIS_URL", default="").strip()

if REDIS_URL:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {
                "hosts": [REDIS_URL],  # пример: redis://127.0.0.1:6379/0
            },
        }
    }
else:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer",
        }
    }

# ---------------- Notifications integrations ----------------
# Эти значения можно переопределить в .env; если пусто/не найдено — интеграция тихо пропускается.
# Для твоего проекта я ставлю безопасные дефолты:
#  - групповые сообщения: вероятно модель в app "chat" называется "Message" (используется /api/messages/)
#  - ЛС и заявки в друзья можно выставить позже, когда уточним реальные модели
HUMY_GROUP_MESSAGE_MODEL = env("HUMY_GROUP_MESSAGE_MODEL", default="chat.Message")
HUMY_DM_MESSAGE_MODEL = env("HUMY_DM_MESSAGE_MODEL", default="")              # пример: "chat.DirectMessage"
HUMY_FRIEND_REQUEST_MODEL = env("HUMY_FRIEND_REQUEST_MODEL", default="")      # пример: "users.FriendRequest"

# ---------------- Logging (диагностика) ----------------
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "django": {"handlers": ["console"], "level": "INFO"},
        "channels": {"handlers": ["console"], "level": "INFO"},
        "daphne": {"handlers": ["console"], "level": "INFO"},
        # лог уведомлений/интеграций
        "notifications": {"handlers": ["console"], "level": "INFO"},
    },
}
