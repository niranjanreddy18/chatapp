import json
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, IntegerField, OuterRef, Q, Subquery, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated

from apps.common.responses import APIResponseMixin
from .models import Conversation, ConversationMember
from .serializers import (
    ConversationCreateSerializer,
    ConversationListSerializer,
    ConversationSerializer,
)

User = get_user_model()


class ConversationPermissionMixin(APIResponseMixin):
    def get_queryset(self):
        return Conversation.objects.filter(
            memberships__user=self.request.user,
            memberships__is_active=True,
        ).distinct()

    def _with_members(self, conversation):
        return (
            Conversation.objects.select_related('created_by')
            .prefetch_related('memberships__user__profile')
            .annotate(member_count=Count('memberships', distinct=True))
            .get(pk=conversation.pk)
        )


class PrivateConversationCreateView(ConversationPermissionMixin, generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ConversationCreateSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data,
            context={'request': request, 'conversation_type': 'private'},
        )
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            target_user_id = serializer.validated_data['user_id']
            # Lock both users in a stable order to serialize concurrent A→B and B→A requests.
            list(
                User.objects.select_for_update()
                .filter(id__in=sorted((request.user.id, target_user_id)))
                .order_by('id')
            )
            conversation, reactivated = self._find_or_reactivate_private_conversation(
                request.user.id,
                target_user_id,
            )
            created = conversation is None
            if created:
                conversation = serializer.create_private_conversation(request.user, target_user_id)

        conversation = self._with_members(conversation)
        payload = ConversationSerializer(conversation, context={'request': request}).data
        if not created and not reactivated:
            return self._success_response('Private conversation already exists', payload, status.HTTP_200_OK)

        self._notify_participant(target_user_id, payload)
        status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        msg = 'Private conversation created successfully' if created else 'Private conversation restored'
        return self._success_response(msg, payload, status_code)

    def _find_or_reactivate_private_conversation(self, user_id, target_user_id):
        conversation = (
            Conversation.objects.filter(
                conversation_type=Conversation.ConversationType.PRIVATE,
            )
            .annotate(
                member_count=Count('memberships'),
                requested_member_count=Count(
                    'memberships',
                    filter=Q(memberships__user_id__in=(user_id, target_user_id)),
                ),
            )
            .filter(member_count=2, requested_member_count=2)
            .first()
        )
        if conversation is None:
            return None, False

        reactivated = (
            ConversationMember.objects.filter(
                conversation=conversation,
                user_id__in=(user_id, target_user_id),
                is_active=False,
            ).update(is_active=True)
            > 0
        )
        return conversation, reactivated

    def _notify_participant(self, user_id, conversation):
        channel_layer = get_channel_layer()
        if channel_layer is None:
            return
        try:
            async_to_sync(channel_layer.group_send)(
                f'user_{user_id}',
                {'type': 'conversation.created', 'conversation': conversation},
            )
        except Exception:
            pass


class GroupConversationCreateView(ConversationPermissionMixin, generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ConversationCreateSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data,
            context={'request': request, 'conversation_type': 'group'},
        )
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            conversation = serializer.create_group_conversation(
                request.user,
                serializer.validated_data['name'],
                serializer.validated_data['member_ids'],
            )

        conversation = self._with_members(conversation)
        payload = ConversationSerializer(conversation, context={'request': request}).data
        return self._success_response(
            'Group conversation created successfully',
            payload,
            status.HTTP_201_CREATED,
        )


class ConversationListView(ConversationPermissionMixin, generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ConversationListSerializer

    def get_queryset(self):
        user = self.request.user
        from apps.messages.models import Message

        # Subquery to accurately count unread messages for this user in each conversation.
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
            super()
            .get_queryset()
            .prefetch_related('memberships__user__profile')
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
    Broadcasts message_read events to the room so read receipts update in real-time.
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
                read_at_iso = timezone.now().isoformat()
                for mid in marked_ids:
                    payload = json.dumps({
                        'type': 'message_read',
                        'message_id': mid,
                        'user_id': request.user.id,
                        'read_at': read_at_iso,
                    })
                    try:
                        async_to_sync(channel_layer.group_send)(
                            f'chat_{pk}',
                            {'type': 'chat.message', 'payload': payload},
                        )
                    except Exception:
                        pass

        return self._success_response(
            'Conversation marked as read.',
            {'read_message_ids': marked_ids},
            status.HTTP_200_OK,
        )


class ConversationDetailView(ConversationPermissionMixin, generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ConversationSerializer

    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .select_related('created_by')
            .prefetch_related('memberships__user__profile')
            .annotate(member_count=Count('memberships', distinct=True))
        )

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return self._success_response('Conversation fetched successfully', serializer.data, status.HTTP_200_OK)


class DeleteConversationView(ConversationPermissionMixin, generics.GenericAPIView):
    """
    DELETE /api/conversations/<pk>/delete/

    Soft-removes the requesting user from the conversation by setting their
    ConversationMember.is_active to False. The Conversation row and all
    messages are preserved so that other members keep their history.
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
                f'user_{user_id}',
                {
                    'type': 'conversation.deleted',
                    'conversation_id': conversation_id,
                    'deleted_by': user_id,
                },
            )
        except Exception:
            pass


class ClearChatView(ConversationPermissionMixin, generics.GenericAPIView):
    """
    POST /api/conversations/<pk>/clear/

    Bulk clears all non-cleared messages in the conversation by setting
    is_cleared=True. The conversation itself and all memberships are untouched.
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
