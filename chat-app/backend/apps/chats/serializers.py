from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Conversation, ConversationMember

User = get_user_model()


class ConversationMemberSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    user_id = serializers.IntegerField(source='user.id', read_only=True)

    class Meta:
        model = ConversationMember
        fields = ('id', 'user_id', 'username', 'is_admin', 'is_active', 'joined_at')


class ConversationSerializer(serializers.ModelSerializer):
    members = ConversationMemberSerializer(source='memberships', many=True, read_only=True)
    creator_id = serializers.IntegerField(source='created_by.id', read_only=True)
    creator_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = Conversation
        fields = ('id', 'name', 'conversation_type', 'avatar', 'creator_id', 'creator_username', 'created_at', 'updated_at', 'members')


class ConversationListSerializer(serializers.ModelSerializer):
    member_count = serializers.SerializerMethodField()
    members = ConversationMemberSerializer(source='memberships', many=True, read_only=True)

    class Meta:
        model = Conversation
        fields = ('id', 'name', 'conversation_type', 'avatar', 'member_count', 'members', 'created_at', 'updated_at')

    def get_member_count(self, obj):
        # Use the pre-annotated value from the queryset when available to avoid
        # an extra COUNT query per conversation.
        return getattr(obj, 'member_count', obj.memberships.count())


class ConversationCreateSerializer(serializers.Serializer):
    user_id = serializers.IntegerField(required=False, write_only=True)
    name = serializers.CharField(required=False, allow_blank=False, write_only=True)
    member_ids = serializers.ListField(child=serializers.IntegerField(), required=False, write_only=True)

    def validate(self, attrs):
        request = self.context.get('request')
        user = request.user if request else None
        if not user:
            raise serializers.ValidationError({'detail': 'Authentication required.'})

        conversation_type = self.context.get('conversation_type')
        if conversation_type == 'private':
            target_user_id = attrs.get('user_id')
            if not target_user_id:
                raise serializers.ValidationError({'user_id': 'A user_id is required for private conversations.'})
            if target_user_id == user.id:
                raise serializers.ValidationError({'user_id': 'You cannot create a private conversation with yourself.'})
            return attrs

        if conversation_type == 'group':
            name = attrs.get('name')
            if not name:
                raise serializers.ValidationError({'name': 'Group name is required.'})
            member_ids = attrs.get('member_ids') or []
            unique_member_ids = list(dict.fromkeys(member_ids))
            if len(unique_member_ids) < 2:
                raise serializers.ValidationError({'member_ids': 'At least 2 members are required besides the creator.'})
            attrs['member_ids'] = unique_member_ids
            return attrs

        raise serializers.ValidationError({'detail': 'Invalid conversation type.'})

    def create_private_conversation(self, user, target_user_id):
        target_user = User.objects.get(pk=target_user_id)
        conversation = Conversation.objects.create(
            conversation_type=Conversation.ConversationType.PRIVATE,
            created_by=user,
        )
        ConversationMember.objects.create(conversation=conversation, user=user, is_admin=True)
        ConversationMember.objects.create(conversation=conversation, user=target_user, is_admin=False)
        return conversation

    def create_group_conversation(self, user, name, member_ids):
        conversation = Conversation.objects.create(
            name=name,
            conversation_type=Conversation.ConversationType.GROUP,
            created_by=user,
        )
        ConversationMember.objects.create(conversation=conversation, user=user, is_admin=True)
        for member_id in member_ids:
            if member_id == user.id:
                continue
            ConversationMember.objects.create(conversation=conversation, user_id=member_id, is_admin=False)
        return conversation
