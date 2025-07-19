from django.db import models
from django.conf import settings


class Country(models.Model):
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        verbose_name = "Страна"
        verbose_name_plural = "Страны"

    def __str__(self):
        return self.name


class Region(models.Model):
    name = models.CharField(max_length=100)
    country = models.ForeignKey(Country, related_name='regions', on_delete=models.CASCADE)

    class Meta:
        verbose_name = "Регион"
        verbose_name_plural = "Регионы"
        unique_together = ('name', 'country')

    def __str__(self):
        return f"{self.name} ({self.country.name})"


class City(models.Model):
    name = models.CharField(max_length=100)
    region = models.ForeignKey(Region, related_name='cities', on_delete=models.CASCADE)

    class Meta:
        verbose_name = "Город"
        verbose_name_plural = "Города"
        unique_together = ('name', 'region')

    def __str__(self):
        return f"{self.name} ({self.region.name})"


class ChatRoom(models.Model):
    name = models.CharField(max_length=100)
    cities = models.ManyToManyField('City', related_name='chatrooms')
    description = models.TextField(blank=True)
    is_private = models.BooleanField(default=False)
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_chatrooms',
        verbose_name="Создатель комнаты"
    )

    class Meta:
        verbose_name = "Чат"
        verbose_name_plural = "Чаты"
        unique_together = ('name',)

    def __str__(self):
        # Чтобы видеть, в каких городах чат — выводим только название
        return self.name

class Message(models.Model):
    chat = models.ForeignKey(ChatRoom, related_name='messages', on_delete=models.CASCADE)
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='messages', on_delete=models.CASCADE)
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    edited = models.BooleanField(default=False)
    deleted = models.BooleanField(default=False)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"[{self.chat.name}] {self.sender.email}: {self.text[:30]}"