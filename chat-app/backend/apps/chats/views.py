from django.db import transaction
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


class ConversationPermissionMixin:
    def get_queryset(self):
        return Conversation.objects.filter(memberships__user=self.request.user, memberships__is_active=True).distinct()


class PrivateConversationCreateView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ConversationCreateSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request, 'conversation_type': 'private'})
        serializer.is_valid(raise_exception=True)

        existing = Conversation.objects.filter(
            conversation_type=Conversation.ConversationType.PRIVATE,
            memberships__user=request.user,
            memberships__is_active=True,
        ).filter(memberships__user_id=serializer.validated_data['user_id']).first()
        if existing:
            return self._success_response('Private conversation already exists', ConversationSerializer(existing).data, status.HTTP_200_OK)

        with transaction.atomic():
            conversation = serializer.create_private_conversation(request.user, serializer.validated_data['user_id'])

        return self._success_response('Private conversation created successfully', ConversationSerializer(conversation).data, status.HTTP_201_CREATED)

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
