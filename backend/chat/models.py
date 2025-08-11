from django.db import models
from users.models import User
from mptt.models import MPTTModel, TreeForeignKey

class Label(models.Model):
    name = models.CharField(max_length=50, unique=True)
    color = models.CharField(max_length=7, default="#2196F3")  # Можно добавить цвет для красоты

    def __str__(self):
        return self.name

class Folder(MPTTModel):
    name = models.CharField(max_length=100)
    parent = TreeForeignKey(
        'self', on_delete=models.CASCADE, null=True, blank=True,
        related_name='children'
    )
    labels = models.ManyToManyField(Label, blank=True, related_name='folders')  # <-- добавили метки
    created_at = models.DateTimeField(auto_now_add=True)

    class MPTTMeta:
        order_insertion_by = ['name']

    def __str__(self):
        return self.name

class Chat(models.Model):
    name = models.CharField(max_length=100)
    folders = models.ManyToManyField(Folder, related_name='chats')
    labels = models.ManyToManyField(Label, blank=True, related_name='chats')  # <-- метки для чата
    is_protected = models.BooleanField(default=False, help_text="Требует пароль для входа")
    password_hash = models.CharField(max_length=256, blank=True, null=True, help_text="Хэш пароля, если чат защищён")
    creator = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_chats')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name
