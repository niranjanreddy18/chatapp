from django.urls import path

from .views import (
    ClearChatView,
    ConversationDetailView,
    ConversationListView,
    DeleteConversationView,
    GroupConversationCreateView,
    MarkConversationReadView,
    PrivateConversationCreateView,
)

urlpatterns = [
    path('conversations/private/', PrivateConversationCreateView.as_view(), name='private_conversation'),
    path('conversations/group/', GroupConversationCreateView.as_view(), name='group_conversation'),
    path('conversations/', ConversationListView.as_view(), name='conversations'),
    path('conversations/<int:pk>/', ConversationDetailView.as_view(), name='conversation_detail'),
    path('conversations/<int:pk>/read/', MarkConversationReadView.as_view(), name='conversation_read'),
    # NEW: Delete conversation (soft-removes requesting user's membership)
    path('conversations/<int:pk>/delete/', DeleteConversationView.as_view(), name='conversation_delete'),
    # NEW: Clear all messages in a conversation (bulk soft-delete)
    path('conversations/<int:pk>/clear/', ClearChatView.as_view(), name='conversation_clear'),
]
