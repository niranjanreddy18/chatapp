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

    username = serializers.CharField(required=False, max_length=150)
    avatar = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = Profile
        fields = ('avatar', 'bio', 'status_message', 'username')

    def validate_bio(self, value):
        if value and len(value) > 300:
            raise serializers.ValidationError('Bio must be 300 characters or fewer.')
        return value or ''

    def validate_status_message(self, value):
        if value and len(value) > 100:
            raise serializers.ValidationError('Status message must be 100 characters or fewer.')
        return value or ''

    def validate_username(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError('Username cannot be empty.')
        value = value.strip()
        user = self.instance.user if self.instance else None
        user_pk = user.pk if user else None
        if User.objects.filter(username__iexact=value).exclude(pk=user_pk).exists():
            raise serializers.ValidationError('This username is already taken.')
        return value

    def validate_avatar(self, value):
        if not value:
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

    def update(self, instance, validated_data):
        username = validated_data.pop('username', None)
        if username and username != instance.user.username:
            instance.user.username = username
            instance.user.save(update_fields=['username'])

        if 'avatar' in validated_data and validated_data['avatar'] is None:
            if instance.avatar:
                instance.avatar.delete(save=False)
            instance.avatar = None

        return super().update(instance, validated_data)


class CurrentUserProfileSerializer(ProfileSerializer):
    """Alias serializer for the authenticated user's profile response."""

    pass


class UserListSerializer(serializers.ModelSerializer):
    """Serializer for listing users except the current user."""

    avatar = serializers.ImageField(read_only=True)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'avatar', 'is_online', 'bio', 'status_message')

    def to_representation(self, instance):
        profile = getattr(instance, 'profile', None)
        data = {
            'id': instance.id,
            'username': instance.username,
            'email': instance.email,
            'avatar': profile.avatar.url if profile and profile.avatar else None,
            'is_online': profile.is_online if profile else False,
            'bio': profile.bio if profile else '',
            'status_message': profile.status_message if profile else '',
        }
        return data
