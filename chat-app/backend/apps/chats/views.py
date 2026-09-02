import json
from django.db import transaction
from django.utils import timezone
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.contrib.auth import get_user_model
from django.db.models import Count, Q, OuterRef, Subquery, IntegerField, Value
from django.db.models.functions import Coalesce
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

# Message is imported lazily inside get_queryset to avoid a circular
# import at module load time (apps.messages depends on apps.chats).

from .models import Conversation, ConversationMember
from .serializers import (
    ConversationCreateSerializer,
    ConversationListSerializer,
    ConversationSerializer,
)

User = get_user_model()


class ConversationPermissionMixin:
    def get_queryset(self):
        return Conversation.objects.filter(memberships__user=self.request.user, memberships__is_active=True).distinct()

    def _success_response(self, message, data=None, status_code=status.HTTP_200_OK):
        payload = {'success': True, 'message': message}
        if data is not None:
            payload['data'] = data
        return Response(payload, status=status_code)

    def _err(self, message, status_code=status.HTTP_400_BAD_REQUEST):
        return Response({'success': False, 'message': message}, status=status_code)



class PrivateConversationCreateView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ConversationCreateSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request, 'conversation_type': 'private'})
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            target_user_id = serializer.validated_data['user_id']
            # Lock both users in a stable order. This makes simultaneous A→B
            # and B→A requests serialize without adding a second data model.
            list(User.objects.select_for_update().filter(id__in=sorted((request.user.id, target_user_id))).order_by('id'))
            conversation = self._find_private_conversation(request.user.id, target_user_id)
            created = conversation is None
            if created:
                conversation = serializer.create_private_conversation(request.user, target_user_id)

        conversation = self._with_members(conversation)
        payload = ConversationSerializer(conversation).data
        if not created:
            return self._success_response('Private conversation already exists', payload, status.HTTP_200_OK)

        self._notify_participant(target_user_id, payload)
        return self._success_response('Private conversation created successfully', payload, status.HTTP_201_CREATED)

    def _find_private_conversation(self, user_id, target_user_id):
        return (
            Conversation.objects.filter(
                conversation_type=Conversation.ConversationType.PRIVATE,
            )
            .annotate(
                member_count=Count('memberships'),
                requested_member_count=Count(
                    'memberships',
                    filter=Q(memberships__user_id__in=(user_id, target_user_id), memberships__is_active=True),
                ),
            )
            .filter(member_count=2, requested_member_count=2)
            .first()
        )

    def _with_members(self, conversation):
        return (
            Conversation.objects.select_related('created_by')
            .prefetch_related('memberships__user')
            .annotate(member_count=Count('memberships'))
            .get(pk=conversation.pk)
        )

    def _notify_participant(self, user_id, conversation):
        channel_layer = get_channel_layer()
        if channel_layer is None:
            return
        async_to_sync(channel_layer.group_send)(
            f'user_{user_id}',
            {'type': 'conversation.created', 'conversation': conversation},
        )

    def _success_response(self, message, data=None, status_code=status.HTTP_200_OK):
        payload = {'success': True, 'message': message}
        if data is not None:
            payload['data'] = data
        return Response(payload, status=status_code)


class GroupConversationCreateView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ConversationCreateSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request, 'conversation_type': 'group'})
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            conversation = serializer.create_group_conversation(request.user, serializer.validated_data['name'], serializer.validated_data['member_ids'])

        return self._success_response('Group conversation created successfully', ConversationSerializer(conversation).data, status.HTTP_201_CREATED)

    def _success_response(self, message, data=None, status_code=status.HTTP_200_OK):
        payload = {'success': True, 'message': message}
        if data is not None:
            payload['data'] = data
        return Response(payload, status=status_code)


class ConversationListView(ConversationPermissionMixin, generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ConversationListSerializer

    def get_queryset(self):
        user = self.request.user
        from apps.messages.models import Message

        # Subquery to accurately count unread messages for this user in each conversation.
        # Avoids JOIN multiplication and accurately counts messages not read by user.
        unread_subquery = (
            Message.objects.filter(
                conversation_id=OuterRef('pk'),
                is_cleared=False,
                is_deleted=False,
            )
            .exclude(sender=user)
            .exclude(read_receipts__user=user)
            .values('conversation_id')
            .annotate(c=Count('id'))
            .values('c')
        )

        queryset = (
            super().get_queryset()
            .prefetch_related('memberships__user')
            .select_related('created_by')
            .annotate(
                member_count=Count('memberships', distinct=True),
                unread_count=Coalesce(Subquery(unread_subquery, output_field=IntegerField()), Value(0)),
            )
            .order_by('-updated_at', '-created_at')
        )
        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return self._success_response('Conversations fetched successfully', serializer.data, status.HTTP_200_OK)


class MarkConversationReadView(ConversationPermissionMixin, generics.GenericAPIView):
    """
    POST /api/conversations/<pk>/read/

    Marks all unread messages in the conversation as read for the requesting user.
    Broadcasts message_read events to the room and senders so read receipts update in real-time.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk, *args, **kwargs):
        conversation = self.get_queryset().filter(pk=pk).first()
        if not conversation:
            return self._err('Conversation not found or you are not a member.', status.HTTP_404_NOT_FOUND)

        from apps.messages.services import mark_conversation_read
        marked_ids = mark_conversation_read(user=request.user, conversation_id=pk)

        if marked_ids:
            channel_layer = get_channel_layer()
            if channel_layer is not None:
                for mid in marked_ids:
                    payload = json.dumps({
                        'type': 'message_read',
                        'message_id': mid,
                        'user_id': request.user.id,
                        'read_at': timezone.now().isoformat(),
                    })
                    try:
                        async_to_sync(channel_layer.group_send)(
                            f'chat_{pk}',
                            {'type': 'chat.message', 'payload': payload},
                        )
                    except Exception:
                        pass

        return self._success_response('Conversation marked as read.', {'read_message_ids': marked_ids}, status.HTTP_200_OK)

    def _err(self, message, status_code=status.HTTP_400_BAD_REQUEST):
        return Response({'success': False, 'message': message}, status=status_code)

    def _success_response(self, message, data=None, status_code=status.HTTP_200_OK):
        payload = {'success': True, 'message': message}
        if data is not None:
            payload['data'] = data
        return Response(payload, status=status_code)


class ConversationDetailView(ConversationPermissionMixin, generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ConversationSerializer

    def get_queryset(self):
        return (
            super().get_queryset()
            .select_related('created_by')
            .prefetch_related('memberships__user')
        )

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return self._success_response('Conversation fetched successfully', serializer.data, status.HTTP_200_OK)

    def _success_response(self, message, data=None, status_code=status.HTTP_200_OK):
        payload = {'success': True, 'message': message}
        if data is not None:
            payload['data'] = data
        return Response(payload, status=status_code)


# ---------------------------------------------------------------------------
# NEW: Delete Conversation
# ---------------------------------------------------------------------------

class DeleteConversationView(ConversationPermissionMixin, generics.GenericAPIView):
    """
    DELETE /api/conversations/<pk>/

    Soft-removes the requesting user from the conversation by setting their
    ConversationMember.is_active to False.  The Conversation row and all
    messages are preserved so that other members keep their history.

    After the DB commit a `conversation_deleted` WebSocket event is broadcast
    to every client in `chat_<pk>` so their UIs update in real-time.

    Permissions
    -----------
    - Must be authenticated.
    - Must currently be an active member (ConversationPermissionMixin).
    """

    permission_classes = [IsAuthenticated]

    def delete(self, request, pk, *args, **kwargs):
        conversation = self.get_queryset().filter(pk=pk).first()
        if not conversation:
            return self._err(
                'Conversation not found or you are not a member.',
                status.HTTP_404_NOT_FOUND,
            )

        with transaction.atomic():
            updated = ConversationMember.objects.filter(
                conversation=conversation,
                user=request.user,
                is_active=True,
            ).update(is_active=False)

        # Broadcast regardless of whether 'updated' is 0 (idempotent response).
        if updated:
            self._notify_deleted(pk, request.user.id)

        return self._success_response(
            'You have been removed from the conversation.',
            status_code=status.HTTP_200_OK,
        )

    def _notify_deleted(self, conversation_id, user_id):
        channel_layer = get_channel_layer()
        if channel_layer is None:
            return
        try:
            async_to_sync(channel_layer.group_send)(
                f'chat_{conversation_id}',
                {
                    'type': 'conversation.deleted',
                    'conversation_id': conversation_id,
                    'deleted_by': user_id,
                },
            )
        except Exception:
            # WebSocket failure must never roll back the DB operation.
            pass

    def _success_response(self, message, data=None, status_code=status.HTTP_200_OK):
        payload = {'success': True, 'message': message}
        if data is not None:
            payload['data'] = data
        return Response(payload, status=status_code)

    def _err(self, message, status_code=status.HTTP_400_BAD_REQUEST):
        return Response({'success': False, 'message': message}, status=status_code)


# ---------------------------------------------------------------------------
# NEW: Clear Chat
# ---------------------------------------------------------------------------

class ClearChatView(ConversationPermissionMixin, generics.GenericAPIView):
    """
    POST /api/conversations/<pk>/clear/

    Bulk soft-deletes all non-deleted messages in the conversation:
        is_deleted = True
        content    = DELETED_CONTENT  (same sentinel as soft_delete_message())

    The conversation itself and all memberships are left untouched.

    After the DB commit a `chat_cleared` WebSocket event is broadcast to
    every client in `chat_<pk>` so their message lists clear in real-time.

    Permissions
    -----------
    - Must be authenticated.
    - Must currently be an active member.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, pk, *args, **kwargs):
        conversation = self.get_queryset().filter(pk=pk).first()
        if not conversation:
            return self._err(
                'Conversation not found or you are not a member.',
                status.HTTP_404_NOT_FOUND,
            )

        with transaction.atomic():
            from apps.messages.models import Message
            cleared_count = Message.objects.filter(
                conversation=conversation,
                is_cleared=False,
            ).update(
                is_cleared=True,
                updated_at=timezone.now(),
            )

        self._notify_cleared(pk, request.user.id)

        return self._success_response(
            'Chat cleared successfully.',
            data={'cleared_count': cleared_count},
            status_code=status.HTTP_200_OK,
        )

    def _notify_cleared(self, conversation_id, user_id):
        channel_layer = get_channel_layer()
        if channel_layer is None:
            return
        try:
            async_to_sync(channel_layer.group_send)(
                f'chat_{conversation_id}',
                {
                    'type': 'chat.cleared',
                    'conversation_id': conversation_id,
                    'cleared_by': user_id,
                },
            )
        except Exception:
            pass

    def _success_response(self, message, data=None, status_code=status.HTTP_200_OK):
        payload = {'success': True, 'message': message}
        if data is not None:
            payload['data'] = data
        return Response(payload, status=status_code)

    def _err(self, message, status_code=status.HTTP_400_BAD_REQUEST):
        return Response({'success': False, 'message': message}, status=status_code)
