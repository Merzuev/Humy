from django.contrib import admin
from .models import Folder, Chat, Label
from mptt.admin import DraggableMPTTAdmin

@admin.register(Label)
class LabelAdmin(admin.ModelAdmin):
    list_display = ('name', 'color')
    search_fields = ('name',)

class FolderAdmin(DraggableMPTTAdmin):
    list_display = ('tree_actions', 'indented_title', 'id', 'parent', 'created_at')
    search_fields = ('name',)
    filter_horizontal = ('labels',)  # Выбор нескольких меток
    list_filter = ('labels',)

class ChatAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'get_folders', 'get_labels', 'creator', 'is_protected', 'created_at')
    list_filter = ('is_protected', 'folders', 'labels')
    search_fields = ('name',)
    ordering = ('name',)
    readonly_fields = ('created_at',)
    filter_horizontal = ('folders', 'labels')

    def get_folders(self, obj):
        return ", ".join([folder.name for folder in obj.folders.all()])
    get_folders.short_description = "Папки"

    def get_labels(self, obj):
        return ", ".join([label.name for label in obj.labels.all()])
    get_labels.short_description = "Метки"



admin.site.register(Folder, FolderAdmin)
admin.site.register(Chat, ChatAdmin)
