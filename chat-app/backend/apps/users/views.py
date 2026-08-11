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
        return self._success_response('Profile updated successfully', ProfileSerializer(profile).data, status.HTTP_200_OK)

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
