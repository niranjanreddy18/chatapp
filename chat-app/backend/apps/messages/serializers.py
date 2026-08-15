"""
serializers.py — Message Module
================================

Five serializers, each with a single, focused responsibility:

1. AttachmentSerializer       — read-only; nested inside message responses
2. MessageSerializer          — full read output with flattened sender fields
3. SendMessageSerializer      — write-only input for POST /api/messages/
4. UpdateMessageSerializer    — write-only input for PUT /api/messages/<id>/edit/
5. ConversationMessageSerializer — lightweight list serializer for paginated views
"""

from rest_framework import serializers

from .models import Attachment, Message, MessageRead


# ---------------------------------------------------------------------------
# 1. AttachmentSerializer
# ---------------------------------------------------------------------------

class MessageReadSerializer(serializers.ModelSerializer):
    """Serialize a single read receipt entry."""

    user_id = serializers.IntegerField(source='user.id', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = MessageRead
        fields = ('user_id', 'username', 'read_at')


class AttachmentSerializer(serializers.ModelSerializer):
    """
    Read-only serializer for the Attachment model.

    Returned as a nested list inside MessageSerializer so the frontend gets
    all file metadata in a single response — no extra round-trip needed.
    """

    file_url = serializers.SerializerMethodField()

    class Meta:
        model  = Attachment
        fields = (
            'id',
            'file_url',
            'file_name',
            'file_size',
            'file_type',
            'uploaded_at',
        )

    def get_file_url(self, obj: Attachment) -> str | None:
        """Return an absolute URL for the file so the frontend can download it."""
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url if obj.file else None


# ---------------------------------------------------------------------------
# 2. MessageSerializer  (full read output)
# ---------------------------------------------------------------------------

class MessageSerializer(serializers.ModelSerializer):
    """
    Full read-only serializer returned by SendMessageView, EditMessageView,
    and DeleteMessageView after each mutation.

    Flattens sender identity (id + username + avatar) directly onto the
    message object so the frontend doesn't need to join a separate user
    lookup. reply_to is a shallow nested representation (not recursive) to
    avoid deep nesting in the response.
    """

    sender_id       = serializers.IntegerField(source='sender.id', read_only=True)
    conversation     = serializers.IntegerField(source='conversation_id', read_only=True)
    sender_username = serializers.CharField(source='sender.username', read_only=True)
    sender_avatar   = serializers.SerializerMethodField()
    attachments     = AttachmentSerializer(many=True, read_only=True)
    reply_to        = serializers.SerializerMethodField()

    class Meta:
        model  = Message
        fields = (
            'conversation',
            'id',
            'sender_id',
            'sender_username',
            'sender_avatar',
            'content',
            'message_type',
            'reply_to',
            'attachments',
            'is_edited',
            'edited_at',
            'is_deleted',
            'created_at',
        )

    def get_sender_avatar(self, obj: Message) -> str | None:
        """
        Return an absolute URL for the sender's profile avatar, if present.
        Relies on the Profile OneToOne relation created by apps.users.
        """
        request = self.context.get('request')
        try:
            avatar = obj.sender.profile.avatar
            if avatar and request:
                return request.build_absolute_uri(avatar.url)
            return avatar.url if avatar else None
        except Exception:
            return None

    def get_reply_to(self, obj: Message) -> dict | None:
        """
        Return a minimal representation of the parent message so the frontend
        can render a reply preview. Using a dict instead of a nested serializer
        prevents infinite recursion on multi-level threads.
        """
        parent = obj.reply_to
        if parent is None:
            return None
        return {
            'id':              parent.id,
            'sender_id':       parent.sender_id,
            'sender_username': parent.sender.username,
            'content':         parent.content,
            'is_deleted':      parent.is_deleted,
        }


# ---------------------------------------------------------------------------
# 3. SendMessageSerializer  (write-only input)
# ---------------------------------------------------------------------------

class SendMessageSerializer(serializers.Serializer):
    """
    Validates the body of POST /api/messages/.

    Not a ModelSerializer — keeps input validation clean and separate from
    the read representation. Business logic lives in services.send_message().
    """

    conversation_id = serializers.IntegerField(required=True)
    content         = serializers.CharField(required=True, allow_blank=False)
    reply_to        = serializers.IntegerField(required=False, allow_null=True, default=None)
    message_type    = serializers.ChoiceField(
        choices=Message.MessageType.choices,
        default=Message.MessageType.TEXT,
        required=False,
    )

    def validate_content(self, value: str) -> str:
        """Reject blank or oversized messages."""
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Message content cannot be empty.')
        if len(value) > 5000:
            raise serializers.ValidationError(
                f'Message content exceeds the 5000-character limit (got {len(value)}).'
            )
        return value


# ---------------------------------------------------------------------------
# 4. UpdateMessageSerializer  (write-only input)
# ---------------------------------------------------------------------------

class UpdateMessageSerializer(serializers.Serializer):
    """
    Validates the body of PUT /api/messages/<id>/edit/.

    Only `content` may be changed; message_type and other fields are
    immutable after creation by design.
    """

    content = serializers.CharField(required=True, allow_blank=False)

    def validate_content(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Updated content cannot be empty.')
        if len(value) > 5000:
            raise serializers.ValidationError(
                f'Message content exceeds the 5000-character limit (got {len(value)}).'
            )
        return value


# ---------------------------------------------------------------------------
# 5. ConversationMessageSerializer  (paginated list output)
# ---------------------------------------------------------------------------

class ConversationMessageSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer used exclusively in the paginated conversation
    message list (GET /api/messages/<conversation_id>/).

    Identical fields to MessageSerializer but defined separately so it can
    evolve independently — e.g. a future cursor-pagination variant might
    strip edited_at to reduce payload size.
    """

    sender_id       = serializers.IntegerField(source='sender.id', read_only=True)
    conversation     = serializers.IntegerField(source='conversation_id', read_only=True)
    sender_username = serializers.CharField(source='sender.username', read_only=True)
    sender_avatar   = serializers.SerializerMethodField()
    attachments     = AttachmentSerializer(many=True, read_only=True)
    reply_to        = serializers.SerializerMethodField()

    class Meta:
        model  = Message
        fields = (
            'conversation',
            'id',
            'sender_id',
            'sender_username',
            'sender_avatar',
            'content',
            'message_type',
            'reply_to',
            'attachments',
            'is_edited',
            'edited_at',
            'is_deleted',
            'created_at',
        )

    def get_sender_avatar(self, obj: Message) -> str | None:
        request = self.context.get('request')
        try:
            avatar = obj.sender.profile.avatar
            if avatar and request:
                return request.build_absolute_uri(avatar.url)
            return avatar.url if avatar else None
        except Exception:
            return None

    def get_reply_to(self, obj: Message) -> dict | None:
        parent = obj.reply_to
        if parent is None:
            return None
        return {
            'id':              parent.id,
            'sender_id':       parent.sender_id,
            'sender_username': parent.sender.username,
            'content':         parent.content,
            'is_deleted':      parent.is_deleted,
        }
