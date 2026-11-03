from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken

from apps.common.responses import APIResponseMixin
from .serializers import LoginSerializer, RegisterSerializer, UserSerializer

User = get_user_model()


class RegisterView(APIResponseMixin, generics.GenericAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return self._error_response('Registration failed', serializer.errors, status.HTTP_400_BAD_REQUEST)

        user = serializer.save()
        return self._success_response(
            'Registration successful',
            {'user': UserSerializer(user).data},
            status.HTTP_201_CREATED,
        )


class LoginView(APIResponseMixin, generics.GenericAPIView):
    serializer_class = LoginSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return self._error_response('Invalid credentials', serializer.errors, status.HTTP_400_BAD_REQUEST)

        username_or_email = serializer.validated_data['username_or_email'].strip()
        password = serializer.validated_data['password']

        user = self._authenticate_user(username_or_email, password)
        if user is None:
            return self._error_response('Invalid credentials', {}, status.HTTP_401_UNAUTHORIZED)

        refresh = RefreshToken.for_user(user)
        return self._success_response(
            'Login successful',
            {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': UserSerializer(user).data,
            },
            status.HTTP_200_OK,
        )

    def _authenticate_user(self, username_or_email, password):
        user = (
            User.objects.select_related('profile')
            .filter(Q(username__iexact=username_or_email) | Q(email__iexact=username_or_email))
            .first()
        )
        if user is None or not user.is_active:
            return None

        if user.check_password(password):
            return user
        return None


class LogoutView(APIResponseMixin, generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        try:
            refresh_token = request.data.get('refresh')
            if not refresh_token:
                return self._error_response('Refresh token is required', {}, status.HTTP_400_BAD_REQUEST)

            token = RefreshToken(refresh_token)
            token.blacklist()
            return self._success_response('Logout successful', {}, status.HTTP_200_OK)
        except Exception:
            return self._error_response('Invalid refresh token', {}, status.HTTP_400_BAD_REQUEST)


class CurrentUserView(APIResponseMixin, generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer

    def get(self, request, *args, **kwargs):
        serializer = self.get_serializer(request.user)
        return self._success_response('User fetched successfully', serializer.data, status.HTTP_200_OK)
