from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Profile
from .serializers import ProfileSerializer, UpdateProfileSerializer, UserListSerializer

User = get_user_model()


class ProfileView(generics.GenericAPIView):
    """Retrieve or update the authenticated user's profile."""

    permission_classes = [IsAuthenticated]
    serializer_class = ProfileSerializer

    def get_object(self):
        profile, _ = Profile.objects.get_or_create(user=self.request.user)
        return profile

    def get(self, request, *args, **kwargs):
        profile = self.get_object()
        serializer = ProfileSerializer(profile)
        return self._success_response('Profile fetched successfully', serializer.data, status.HTTP_200_OK)

    def put(self, request, *args, **kwargs):
        profile = self.get_object()
        serializer = UpdateProfileSerializer(profile, data=request.data, partial=True)
        if not serializer.is_valid():
            return self._error_response('Profile update failed', serializer.errors, status.HTTP_400_BAD_REQUEST)

        serializer.save()
        profile_data = ProfileSerializer(profile, context={'request': request}).data

        # Broadcast update to all active conversation channels so other online users see it in real-time
        try:
            import json
            from asgiref.sync import async_to_sync
            from channels.layers import get_channel_layer
            from apps.chats.models import ConversationMember

            channel_layer = get_channel_layer()
            if channel_layer:
                conversation_ids = list(
                    ConversationMember.objects.filter(user=request.user, is_active=True)
                    .values_list('conversation_id', flat=True)
                    .distinct()
                )
                payload = json.dumps({
                    'type': 'user_updated',
                    'user_id': request.user.id,
                    'username': request.user.username,
                    'avatar': profile_data.get('avatar'),
                    'status_message': profile_data.get('status_message', ''),
                    'bio': profile_data.get('bio', ''),
                })
                for cid in conversation_ids:
                    async_to_sync(channel_layer.group_send)(
                        f'chat_{cid}',
                        {
                            'type': 'chat.message',
                            'payload': payload,
                        }
                    )
        except Exception:
            pass

        return self._success_response('Profile updated successfully', profile_data, status.HTTP_200_OK)

    def patch(self, request, *args, **kwargs):
        return self.put(request, *args, **kwargs)

    def _success_response(self, message, data=None, status_code=status.HTTP_200_OK):
        payload = {'success': True, 'message': message}
        if data is not None:
            payload['data'] = data
        return Response(payload, status=status_code)

    def _error_response(self, message, errors=None, status_code=status.HTTP_400_BAD_REQUEST):
        payload = {'success': False, 'message': message, 'errors': errors or {}}
        return Response(payload, status=status_code)


class UserListView(generics.ListAPIView):
    """Return all users except the authenticated user, with optional search support."""

    permission_classes = [IsAuthenticated]
    serializer_class = UserListSerializer

    def get_queryset(self):
        queryset = User.objects.exclude(pk=self.request.user.pk)

        # ?exclude_existing=true → exclude users who already have an active
        # private conversation with the current user (used by "Start Chat" modal
        if self.request.query_params.get('exclude_existing', '').lower() == 'true':
            from apps.chats.models import Conversation, ConversationMember

            # Find IDs of all private conversations the current user is in
            existing_partner_ids = (
                User.objects
                .filter(
                    conversation_memberships__conversation__conversation_type='PRIVATE',
                    conversation_memberships__is_active=True,
                    conversation_memberships__conversation__memberships__user=self.request.user,
                    conversation_memberships__conversation__memberships__is_active=True,
                )
                .exclude(pk=self.request.user.pk)
                .values_list('id', flat=True)
                .distinct()
            )
            queryset = queryset.exclude(pk__in=existing_partner_ids)

        search = self.request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(Q(username__icontains=search))
        return queryset.order_by('username')

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return self._success_response('Users fetched successfully', serializer.data, status.HTTP_200_OK)

    def _success_response(self, message, data=None, status_code=status.HTTP_200_OK):
        payload = {'success': True, 'message': message}
        if data is not None:
            payload['data'] = data
        return Response(payload, status=status_code)
