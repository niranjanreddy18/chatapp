from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Profile

User = get_user_model()


class ProfileSerializer(serializers.ModelSerializer):
    """Serializer for returning a profile with user identity details."""

    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    avatar = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = Profile
        fields = ('id', 'username', 'email', 'avatar', 'bio', 'status_message', 'is_online', 'last_seen')

    def validate_bio(self, value):
        if len(value) > 300:
            raise serializers.ValidationError('Bio must be 300 characters or fewer.')
        return value

    def validate_status_message(self, value):
        if len(value) > 100:
            raise serializers.ValidationError('Status message must be 100 characters or fewer.')
        return value


class UpdateProfileSerializer(serializers.ModelSerializer):
    """Serializer for updating profile fields that are user-editable."""

    class Meta:
        model = Profile
        fields = ('avatar', 'bio', 'status_message')

    def validate_bio(self, value):
        if len(value) > 300:
            raise serializers.ValidationError('Bio must be 300 characters or fewer.')
        return value

    def validate_status_message(self, value):
        if len(value) > 100:
            raise serializers.ValidationError('Status message must be 100 characters or fewer.')
        return value

    def validate_avatar(self, value):
        if value is None:
            return value

        allowed_formats = {'JPEG', 'JPG', 'PNG', 'WEBP'}
        content_type = getattr(value, 'content_type', '')
        name = getattr(value, 'name', '').lower()
        if content_type:
            extension = content_type.split('/')[-1].upper()
        else:
            extension = name.split('.')[-1].upper() if '.' in name else ''

        if extension not in allowed_formats:
            raise serializers.ValidationError('Unsupported image format. Use JPG, PNG, or WEBP.')
        return value


class CurrentUserProfileSerializer(ProfileSerializer):
    """Alias serializer for the authenticated user's profile response."""

    pass


class UserListSerializer(serializers.ModelSerializer):
    """Serializer for listing users except the current user."""

    avatar = serializers.ImageField(read_only=True)

    class Meta:
        model = User
        fields = ('id', 'username', 'avatar', 'is_online')

    def to_representation(self, instance):
        profile = getattr(instance, 'profile', None)
        data = {
            'id': instance.id,
            'username': instance.username,
            'avatar': profile.avatar.url if profile and profile.avatar else None,
            'is_online': profile.is_online if profile else False,
        }
        return data
