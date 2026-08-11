"""
services.py — Message Module Business Logic
============================================

All database mutations live here so that views remain thin (validate →
delegate → respond). Using db.transaction.atomic() where multiple writes
must succeed or fail together.
"""

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.chats.models import ConversationMember

from .models import Attachment, Message, MessageRead

# ---------------------------------------------------------------------------
# Allowed MIME types for file uploads
# ---------------------------------------------------------------------------

ALLOWED_MIME_TYPES: frozenset = frozenset({
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'video/mp4',
    'audio/mpeg',
})

DELETED_CONTENT = 'This message was deleted.'


# ---------------------------------------------------------------------------
# Membership helpers
# ---------------------------------------------------------------------------

def assert_is_member(user, conversation_id: int) -> None:
    """
    Raise PermissionDenied if the user is not an active conversation member.
    Called from views that receive conversation_id in the request body rather
    than the URL (e.g. SendMessageView).
    """
    if not ConversationMember.objects.filter(
        conversation_id=conversation_id,
        user=user,
        is_active=True,
    ).exists():
        raise PermissionDenied('You are not a member of this conversation.')


def get_conversation_or_404(conversation_id: int):
    """Return the Conversation or raise NotFound."""
    from apps.chats.models import Conversation
    try:
        return Conversation.objects.get(pk=conversation_id)
    except Conversation.DoesNotExist:
        raise NotFound('Conversation not found.')


# ---------------------------------------------------------------------------
# Message services
# ---------------------------------------------------------------------------

@transaction.atomic
def send_message(
    *,
    user,
    conversation_id: int,
    content: str,
    reply_to_id: int | None = None,
    message_type: str = Message.MessageType.TEXT,
) -> Message:
    """
    Create and persist a new Message.

    Validates:
    - The user is an active conversation member.
    - reply_to (if provided) belongs to the same conversation.
    """
    assert_is_member(user, conversation_id)
    conversation = get_conversation_or_404(conversation_id)

    reply_to = None
    if reply_to_id is not None:
        try:
            reply_to = Message.objects.get(pk=reply_to_id, conversation_id=conversation_id)
        except Message.DoesNotExist:
            raise ValidationError({'reply_to': 'The message you are replying to does not exist in this conversation.'})

    message = Message.objects.create(
        conversation=conversation,
        sender=user,
        content=content.strip(),
        message_type=message_type,
        reply_to=reply_to,
    )
    return message


@transaction.atomic
def mark_message_read(*, user, message_id: int) -> MessageRead:
    """Create a MessageRead row for the user if one does not exist already."""
    message = Message.objects.select_related('conversation').get(pk=message_id)
    assert_is_member(user, message.conversation_id)

    read_receipt, created = MessageRead.objects.get_or_create(message=message, user=user)
    return read_receipt


@transaction.atomic
def edit_message(*, message: Message, content: str) -> Message:
    """
    Update a message's content and stamp the edit metadata.

    Caller must have already verified sender identity via IsSender permission.
    Raises ValidationError if the message is deleted.
    """
    if message.is_deleted:
        raise ValidationError({'detail': 'Cannot edit a deleted message.'})

    message.content   = content.strip()
    message.is_edited = True
    message.edited_at = timezone.now()
    message.save(update_fields=['content', 'is_edited', 'edited_at', 'updated_at'])
    return message


@transaction.atomic
def soft_delete_message(*, message: Message) -> Message:
    """
    Soft-delete a message: set is_deleted=True and mask the content.

    The row is never removed from the database so that reply threads,
    audit trails, and conversation history remain intact.
    """
    message.content    = DELETED_CONTENT
    message.is_deleted = True
    message.save(update_fields=['content', 'is_deleted', 'updated_at'])
    return message


# ---------------------------------------------------------------------------
# Attachment service
# ---------------------------------------------------------------------------

@transaction.atomic
def upload_attachment(*, message: Message, file) -> Attachment:
    """
    Validate the uploaded file's MIME type and create an Attachment record.

    The physical file is saved to media/chat/ via Django's FileField.
    """
    content_type = getattr(file, 'content_type', '')
    if content_type not in ALLOWED_MIME_TYPES:
        raise ValidationError({
            'file': (
                f'Unsupported file type "{content_type}". '
                f'Allowed types: {", ".join(sorted(ALLOWED_MIME_TYPES))}'
            )
        })

    attachment = Attachment.objects.create(
        message=message,
        file=file,
        file_name=file.name,
        file_size=file.size,
        file_type=content_type,
    )
    return attachment
