from rest_framework.permissions import BasePermission

from apps.chats.models import ConversationMember


class IsConversationMember(BasePermission):
    """
    Grants access only when the requesting user is an active member of the
    conversation identified by `conversation_id` in the URL kwargs.

    Used on every message endpoint so that outsiders cannot read or write
    messages in conversations they don't belong to.
    """

    message = 'You are not a member of this conversation.'

    def has_permission(self, request, view):
        conversation_id = view.kwargs.get('conversation_id')
        if not conversation_id:
            # For endpoints where conversation_id comes from request body
            # (e.g. SendMessageView), the view validates membership itself.
            return request.user and request.user.is_authenticated

        return ConversationMember.objects.filter(
            conversation_id=conversation_id,
            user=request.user,
            is_active=True,
        ).exists()


class IsSender(BasePermission):
    """
    Object-level permission — allows access only if the requesting user is
    the original sender of the message.

    Used on PUT (edit) and DELETE (soft-delete) endpoints.
    """

    message = 'You can only modify your own messages.'

    def has_object_permission(self, request, view, obj):
        return obj.sender == request.user
