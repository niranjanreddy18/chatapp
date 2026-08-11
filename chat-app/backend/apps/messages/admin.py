from django.contrib import admin

from .models import Attachment, Message


class AttachmentInline(admin.TabularInline):
    """Show attachments inline on the Message admin page."""
    model  = Attachment
    extra  = 0
    fields = ('file', 'file_name', 'file_size', 'file_type', 'uploaded_at')
    readonly_fields = ('uploaded_at',)


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display   = ('id', 'sender', 'conversation', 'message_type', 'is_deleted', 'is_edited', 'created_at')
    list_filter    = ('message_type', 'is_deleted', 'is_edited', 'created_at')
    search_fields  = ('sender__username', 'content')
    readonly_fields = ('created_at', 'updated_at', 'edited_at')
    raw_id_fields  = ('sender', 'conversation', 'reply_to')
    inlines        = [AttachmentInline]
    ordering       = ('-created_at',)


@admin.register(Attachment)
class AttachmentAdmin(admin.ModelAdmin):
    list_display  = ('id', 'file_name', 'file_type', 'file_size', 'message', 'uploaded_at')
    list_filter   = ('file_type', 'uploaded_at')
    search_fields = ('file_name', 'message__sender__username')
    readonly_fields = ('uploaded_at',)
    raw_id_fields   = ('message',)
