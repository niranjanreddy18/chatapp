from django.db import transaction
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.contrib.auth import get_user_model
from django.db.models import Count, Q
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

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
        queryset = super().get_queryset().prefetch_related('memberships__user').select_related('created_by')
        return queryset.annotate(member_count=Count('memberships')).order_by('-updated_at', '-created_at')

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return self._success_response('Conversations fetched successfully', serializer.data, status.HTTP_200_OK)

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
