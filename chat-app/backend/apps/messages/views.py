"""
views.py — Message Module
==========================

Five thin view classes. Each view:
  1. Enforces authentication + permission.
  2. Validates input via a serializer.
  3. Delegates all business logic to services.py.
  4. Returns a consistent response envelope.

No database queries or business rules live here.
"""

from rest_framework import generics, status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from django.db import IntegrityError

from . import services
from .models import Attachment, Message
from .pagination import MessagePagination
from .permissions import IsConversationMember, IsSender
from .serializers import (
    AttachmentSerializer,
    ConversationMessageSerializer,
    MessageReadSerializer,
    MessageSerializer,
    SendMessageSerializer,
    UpdateMessageSerializer,
)
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
import json



# ---------------------------------------------------------------------------
# Response helpers (matches project-wide convention)
# ---------------------------------------------------------------------------

def _ok(message: str, data=None, status_code=status.HTTP_200_OK) -> Response:
    payload = {'success': True, 'message': message}
    if data is not None:
        payload['data'] = data
    return Response(payload, status=status_code)


def _err(message: str, errors=None, status_code=status.HTTP_400_BAD_REQUEST) -> Response:
    return Response(
        {'success': False, 'message': message, 'errors': errors or {}},
        status=status_code,
    )


# ---------------------------------------------------------------------------
# 1. POST /api/messages/  — Send a message
# ---------------------------------------------------------------------------

class SendMessageView(generics.GenericAPIView):
    """
    Send a new message to a conversation.

    Permissions:
        - Must be authenticated.
        - Must be an active member of the target conversation
          (enforced inside services.send_message via assert_is_member).

    The membership check happens inside the service rather than in a URL-kwarg
    permission because the conversation_id arrives in the request body here.
    """

    permission_classes = [IsAuthenticated]
    serializer_class   = SendMessageSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return _err('Failed to send message.', serializer.errors, status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        message = services.send_message(
            user=request.user,
            conversation_id=data['conversation_id'],
            content=data['content'],
            reply_to_id=data.get('reply_to'),
            message_type=data.get('message_type', Message.MessageType.TEXT),
        )

        out = MessageSerializer(message, context={'request': request})
        try:
            channel_layer = get_channel_layer()
            if channel_layer is not None:
                payload = json.dumps({
                    'type': 'new_message',
                    'message': out.data,
                })
                from apps.chats.models import ConversationMember
                member_ids = list(
                    ConversationMember.objects.filter(conversation_id=message.conversation_id, is_active=True)
                    .values_list('user_id', flat=True)
                )
                for member_id in member_ids:
                    async_to_sync(channel_layer.group_send)(
                        f'user_{member_id}',
                        {'type': 'chat.message', 'payload': payload},
                    )
        except Exception:
            pass

        return _ok('Message sent successfully.', out.data, status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# 2. GET /api/messages/<conversation_id>/  — List messages (paginated)
# ---------------------------------------------------------------------------

class ConversationMessagesView(generics.GenericAPIView):
    """
    Return all messages for a conversation, oldest first, paginated 20/page.

    Permissions:
        - Must be authenticated.
        - Must be an active conversation member (IsConversationMember checks
          the `conversation_id` URL kwarg).

    Query optimisation:
        - select_related: sender, sender__profile, reply_to, reply_to__sender
          → eliminates N+1 on user/profile lookups.
        - prefetch_related: attachments, read_receipts
          → single IN query for all attachment rows and read receipts.
    """

    permission_classes = [IsAuthenticated, IsConversationMember]
    serializer_class   = ConversationMessageSerializer
    pagination_class   = MessagePagination

    def get_queryset(self, conversation_id: int):
        return (
            Message.objects
            .filter(conversation_id=conversation_id, is_cleared=False)
            .select_related(
                'sender',
                'sender__profile',
                'reply_to',
                'reply_to__sender',
            )
            .prefetch_related('attachments', 'read_receipts')
            .order_by('created_at')
        )

    def get(self, request, conversation_id: int, *args, **kwargs):
        try:
            services.mark_conversation_read(user=request.user, conversation_id=conversation_id)
        except Exception:
            pass

        queryset   = self.get_queryset(conversation_id)
        paginator  = self.pagination_class()
        page       = paginator.paginate_queryset(queryset, request, view=self)
        serializer = self.get_serializer(page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)


# ---------------------------------------------------------------------------
# 3. PUT /api/messages/<message_id>/edit/  — Edit a message
# ---------------------------------------------------------------------------

class EditMessageView(generics.GenericAPIView):
    """
    Edit the content of an existing message.

    Permissions:
        - Must be authenticated.
        - Must be the original sender (IsSender object-level check).

    Rules enforced in services.edit_message():
        - Cannot edit a deleted message.
        - Sets is_edited=True and stamps edited_at.
    """

    permission_classes = [IsAuthenticated, IsSender]
    serializer_class   = UpdateMessageSerializer

    def get_object(self, message_id: int) -> Message:
        try:
            message = (
                Message.objects
                .select_related('sender', 'sender__profile', 'reply_to', 'reply_to__sender')
                .prefetch_related('attachments')
                .get(pk=message_id)
            )
        except Message.DoesNotExist:
            from rest_framework.exceptions import NotFound
            raise NotFound('Message not found.')

        # Runs IsSender.has_object_permission()
        self.check_object_permissions(self.request, message)
        return message

    def put(self, request, message_id: int, *args, **kwargs):
        message    = self.get_object(message_id)
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return _err('Failed to edit message.', serializer.errors, status.HTTP_400_BAD_REQUEST)

        updated = services.edit_message(
            message=message,
            content=serializer.validated_data['content'],
        )

        out = MessageSerializer(updated, context={'request': request})
        try:
            channel_layer = get_channel_layer()
            if channel_layer is not None:
                payload = json.dumps({
                    'type': 'message_edited',
                    'message_id': message.id,
                    'conversation_id': message.conversation_id,
                    'message': out.data,
                })
                async_to_sync(channel_layer.group_send)(
                    f'chat_{message.conversation_id}',
                    {'type': 'chat.message', 'payload': payload},
                )
                from apps.chats.models import ConversationMember
                member_ids = list(
                    ConversationMember.objects.filter(conversation_id=message.conversation_id, is_active=True)
                    .values_list('user_id', flat=True)
                )
                for member_id in member_ids:
                    async_to_sync(channel_layer.group_send)(
                        f'user_{member_id}',
                        {'type': 'chat.message', 'payload': payload},
                    )
        except Exception:
            pass
        return _ok('Message edited successfully.', out.data, status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# 4. DELETE /api/messages/<message_id>/delete/  — Soft-delete a message
# ---------------------------------------------------------------------------

class DeleteMessageView(generics.GenericAPIView):
    """
    Soft-delete a message.

    The row is never removed. Instead:
        - is_deleted  → True
        - content     → 'This message was deleted.'

    Permissions:
        - Must be authenticated.
        - Must be the original sender (IsSender).
    """

    permission_classes = [IsAuthenticated, IsSender]

    def get_object(self, message_id: int) -> Message:
        try:
            message = Message.objects.select_related('sender').get(pk=message_id)
        except Message.DoesNotExist:
            from rest_framework.exceptions import NotFound
            raise NotFound('Message not found.')

        self.check_object_permissions(self.request, message)
        return message

    def delete(self, request, message_id: int, *args, **kwargs):
        message = self.get_object(message_id)
        deleted = services.soft_delete_message(message=message)
        out     = MessageSerializer(deleted, context={'request': request})
        try:
            channel_layer = get_channel_layer()
            if channel_layer is not None:
                payload = json.dumps({
                    'type': 'message_deleted',
                    'message_id': message.id,
                    'conversation_id': message.conversation_id,
                    'message': out.data,
                })
                async_to_sync(channel_layer.group_send)(
                    f'chat_{message.conversation_id}',
                    {'type': 'chat.message', 'payload': payload},
                )
                from apps.chats.models import ConversationMember
                member_ids = list(
                    ConversationMember.objects.filter(conversation_id=message.conversation_id, is_active=True)
                    .values_list('user_id', flat=True)
                )
                for member_id in member_ids:
                    async_to_sync(channel_layer.group_send)(
                        f'user_{member_id}',
                        {'type': 'chat.message', 'payload': payload},
                    )
        except Exception:
            pass
        return _ok('Message deleted successfully.', out.data, status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# 4b. DELETE /api/messages/<message_id>/remove/  — Permanently remove a message
# ---------------------------------------------------------------------------

class RemoveMessageView(generics.GenericAPIView):
    """
    Permanently remove / hard-delete a message (or deleted message bubble) from the database.

    Permissions:
        - Must be authenticated.
        - Must be the original sender (IsSender).
    """

    permission_classes = [IsAuthenticated, IsSender]

    def get_object(self, message_id: int) -> Message:
        try:
            message = Message.objects.select_related('sender').get(pk=message_id)
        except Message.DoesNotExist:
            from rest_framework.exceptions import NotFound
            raise NotFound('Message not found.')

        self.check_object_permissions(self.request, message)
        return message

    def delete(self, request, message_id: int, *args, **kwargs):
        message = self.get_object(message_id)
        conversation_id = message.conversation_id
        msg_id = message.id
        services.remove_message(message=message)

        try:
            channel_layer = get_channel_layer()
            if channel_layer is not None:
                payload = json.dumps({
                    'type': 'message_removed',
                    'message_id': msg_id,
                    'conversation_id': conversation_id,
                })
                async_to_sync(channel_layer.group_send)(
                    f'chat_{conversation_id}',
                    {'type': 'chat.message', 'payload': payload},
                )
                from apps.chats.models import ConversationMember
                member_ids = list(
                    ConversationMember.objects.filter(conversation_id=conversation_id, is_active=True)
                    .values_list('user_id', flat=True)
                )
                for member_id in member_ids:
                    async_to_sync(channel_layer.group_send)(
                        f'user_{member_id}',
                        {'type': 'chat.message', 'payload': payload},
                    )
        except Exception:
            pass
        return _ok('Message removed successfully.', {'message_id': msg_id}, status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# 5. POST /api/messages/upload/  — Upload a file attachment
# ---------------------------------------------------------------------------

class ReadStatusView(generics.GenericAPIView):
    """Return the read status for a message to conversation members."""

    permission_classes = [IsAuthenticated, IsConversationMember]

    def get(self, request, message_id: int, *args, **kwargs):
        try:
            message = (
                Message.objects
                .select_related('conversation', 'sender')
                .prefetch_related('read_receipts__user')
                .get(pk=message_id)
            )
        except Message.DoesNotExist:
            return _err('Message not found.', {}, status.HTTP_404_NOT_FOUND)

        if not message.conversation.memberships.filter(user=request.user, is_active=True).exists():
            return _err('You are not a member of this conversation.', {}, status.HTTP_403_FORBIDDEN)

        data = MessageReadSerializer(message.read_receipts.all(), many=True, context={'request': request}).data
        return _ok('Read status fetched successfully.', {'message_id': message_id, 'users': data}, status.HTTP_200_OK)


class UploadAttachmentView(generics.GenericAPIView):
    """
    Upload a file and associate it with an existing message.

    Accepts multipart/form-data with:
        - file       : the binary file
        - message_id : the ID of the parent message

    The requesting user must be the sender of that message (prevents
    attaching files to other people's messages).

    Validation (in services.upload_attachment):
        - MIME type must be in the ALLOWED_MIME_TYPES whitelist.
        - File is stored in media/chat/.
    """

    permission_classes = [IsAuthenticated]
    parser_classes     = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        file       = request.FILES.get('file')
        message_id = request.data.get('message_id')
        # Client-generated idempotency key.  Present for all compose-bar uploads
        # (first attempt and every retry use the SAME UUID).  Absent for the
        # edit-message upload path, which does not need idempotency.
        upload_id  = request.data.get('upload_id') or None

        if not file:
            return _err('No file provided.', {}, status.HTTP_400_BAD_REQUEST)
        if not message_id:
            return _err('message_id is required.', {}, status.HTTP_400_BAD_REQUEST)

        # Fetch message and confirm ownership
        try:
            message = Message.objects.select_related('sender').get(pk=message_id)
        except Message.DoesNotExist:
            return _err('Message not found.', {}, status.HTTP_404_NOT_FOUND)

        if message.sender != request.user:
            return _err('You can only attach files to your own messages.', {}, status.HTTP_403_FORBIDDEN)

        if message.is_deleted:
            return _err('Cannot attach files to a deleted message.', {}, status.HTTP_400_BAD_REQUEST)

        try:
            attachment = services.upload_attachment(
                message=message,
                file=file,
                upload_id=upload_id,
            )
        except IntegrityError:
            # Two concurrent retries with the same upload_id both passed the
            # initial get() check inside the service and raced to INSERT.  The
            # losing INSERT raised a unique-constraint IntegrityError.  Fetch
            # the already-committed row and return it so both callers succeed.
            if upload_id:
                attachment = Attachment.objects.get(upload_id=upload_id)
            else:
                raise   # unexpected — re-raise for visibility

        out = AttachmentSerializer(attachment, context={'request': request})
        # Broadcast updated message to the conversation room and member channels so all
        # participants receive the new attachment in real-time.
        try:
            # Refresh message from DB to ensure all relations and attachments are current
            message.refresh_from_db()
            serialized_message = MessageSerializer(message, context={'request': request}).data
            payload = json.dumps({
                'type': 'new_message',
                'message': serialized_message,
            })
            channel_layer = get_channel_layer()
            if channel_layer is not None:
                # 1. Broadcast to active chat room
                async_to_sync(channel_layer.group_send)(
                    f'chat_{message.conversation_id}',
                    {'type': 'chat.message', 'payload': payload},
                )
                # 2. Broadcast to each member's private channel
                from apps.chats.models import ConversationMember
                member_ids = list(
                    ConversationMember.objects.filter(conversation_id=message.conversation_id, is_active=True)
                    .values_list('user_id', flat=True)
                )
                for member_id in member_ids:
                    async_to_sync(channel_layer.group_send)(
                        f'user_{member_id}',
                        {'type': 'chat.message', 'payload': payload},
                    )
        except Exception:
            pass

        return _ok('File uploaded successfully.', out.data, status.HTTP_201_CREATED)

