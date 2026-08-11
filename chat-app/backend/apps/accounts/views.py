from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import LoginSerializer, RegisterSerializer, UserSerializer

User = get_user_model()


class RegisterView(generics.GenericAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return self._error_response('Registration failed', serializer.errors, status.HTTP_400_BAD_REQUEST)

        user = serializer.save()
        return self._success_response('Registration successful', {'user': UserSerializer(user).data}, status.HTTP_201_CREATED)

    def _success_response(self, message, data=None, status_code=status.HTTP_200_OK):
        payload = {'success': True, 'message': message}
        if data is not None:
            payload['data'] = data
        return Response(payload, status=status_code)

    def _error_response(self, message, errors=None, status_code=status.HTTP_400_BAD_REQUEST):
        payload = {'success': False, 'message': message, 'errors': errors or {}}
        return Response(payload, status=status_code)


class LoginView(generics.GenericAPIView):
    serializer_class = LoginSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return self._error_response('Invalid credentials', serializer.errors, status.HTTP_400_BAD_REQUEST)

        username_or_email = serializer.validated_data['username_or_email']
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
        user = User.objects.filter(Q(username=username_or_email) | Q(email=username_or_email)).first()
        if user is None:
            return None

        if user.check_password(password):
            return user
        return None

    def _success_response(self, message, data=None, status_code=status.HTTP_200_OK):
        payload = {'success': True, 'message': message}
        if data is not None:
            payload['data'] = data
        return Response(payload, status=status_code)

    def _error_response(self, message, errors=None, status_code=status.HTTP_400_BAD_REQUEST):
        payload = {'success': False, 'message': message, 'errors': errors or {}}
        return Response(payload, status=status_code)


class LogoutView(generics.GenericAPIView):
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

    def _success_response(self, message, data=None, status_code=status.HTTP_200_OK):
        payload = {'success': True, 'message': message}
        if data is not None:
            payload['data'] = data
        return Response(payload, status=status_code)

    def _error_response(self, message, errors=None, status_code=status.HTTP_400_BAD_REQUEST):
        payload = {'success': False, 'message': message, 'errors': errors or {}}
        return Response(payload, status=status_code)


class CurrentUserView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer

    def get(self, request, *args, **kwargs):
        serializer = self.get_serializer(request.user)
        return self._success_response('User fetched successfully', serializer.data, status.HTTP_200_OK)

    def _success_response(self, message, data=None, status_code=status.HTTP_200_OK):
        payload = {'success': True, 'message': message}
        if data is not None:
            payload['data'] = data
        return Response(payload, status=status_code)
