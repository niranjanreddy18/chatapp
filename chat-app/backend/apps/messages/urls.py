from django.urls import path

from .views import (
    ConversationMessagesView,
    DeleteMessageView,
    EditMessageView,
    ReadStatusView,
    SendMessageView,
    UploadAttachmentView,
)

urlpatterns = [
    # Send a new message
    path('messages/', SendMessageView.as_view(), name='message_send'),

    # List all messages in a conversation (paginated, oldest first)
    path('messages/<int:conversation_id>/', ConversationMessagesView.as_view(), name='message_list'),

    # Edit a message (sender only)
    path('messages/<int:message_id>/edit/', EditMessageView.as_view(), name='message_edit'),

    # Soft-delete a message (sender only)
    path('messages/<int:message_id>/delete/', DeleteMessageView.as_view(), name='message_delete'),

    # Fetch read receipts for a message
    path('messages/<int:message_id>/read-status/', ReadStatusView.as_view(), name='message_read_status'),

    # Upload a file attachment and associate it with a message
    path('messages/upload/', UploadAttachmentView.as_view(), name='message_upload'),
]
