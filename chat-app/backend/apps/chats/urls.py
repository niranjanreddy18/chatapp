from django.urls import path

from .views import (
    ConversationDetailView,
    ConversationListView,
    GroupConversationCreateView,
    PrivateConversationCreateView,
)

urlpatterns = [
    path('conversations/private/', PrivateConversationCreateView.as_view(), name='private_conversation'),
    path('conversations/group/', GroupConversationCreateView.as_view(), name='group_conversation'),
    path('conversations/', ConversationListView.as_view(), name='conversations'),
    path('conversations/<int:pk>/', ConversationDetailView.as_view(), name='conversation_detail'),
]
