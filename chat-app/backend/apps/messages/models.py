from django.conf import settings
from django.db import models
from .storage import ChatAttachmentCloudinaryStorage


class Message(models.Model):
    """
    Represents a single message inside a conversation.

    Relationships
    -------------
    - conversation  → Conversation (many messages belong to one conversation)
    - sender        → User (the author of the message)
    - reply_to      → Message (optional self-referential FK for threaded replies)
    """

    class MessageType(models.TextChoices):
        TEXT   = 'TEXT',   'Text'
        IMAGE  = 'IMAGE',  'Image'
        FILE   = 'FILE',   'File'
        SYSTEM = 'SYSTEM', 'System'

    conversation = models.ForeignKey(
        'chats.Conversation',
        on_delete=models.CASCADE,
        related_name='messages',
        db_index=True,
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_messages',
    )
    content = models.TextField()
    message_type = models.CharField(
        max_length=10,
        choices=MessageType.choices,
        default=MessageType.TEXT,
    )
    reply_to = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='replies',
    )

    # Edit tracking
    is_edited  = models.BooleanField(default=False)
    edited_at  = models.DateTimeField(null=True, blank=True)

    # Soft delete — individual message deletion. Row is kept; content is masked.
    # The frontend displays "Message deleted" for these rows.
    is_deleted = models.BooleanField(default=False)

    # Bulk clear — set by Clear Chat. Row is kept but excluded from all
    # message-list queries so it never appears in the UI again.
    # Unlike is_deleted, cleared messages produce NO placeholder — they are
    # invisible to the API as if they never existed.
    is_cleared = models.BooleanField(default=False, db_index=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label  = 'chat_messages'
        ordering   = ('created_at',)          # oldest → newest (API reverses if needed)
        indexes    = [
            models.Index(fields=['conversation', 'created_at']),
        ]

    def __str__(self):
        return f'[{self.message_type}] {self.sender.username}: {self.content[:50]}'


class MessageRead(models.Model):
    """Tracks per-user read receipts for a message."""

    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name='read_receipts')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='message_reads')
    read_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'chat_messages'
        constraints = [
            models.UniqueConstraint(fields=['message', 'user'], name='unique_message_user_read')
        ]
        ordering = ('read_at',)

    def __str__(self):
        return f'{self.user.username} read message #{self.message_id}'


class Attachment(models.Model):
    """
    A file attached to a Message.

    Stored separately so that:
    - A message can have zero or many attachments.
    - Message metadata remains lightweight.
    - Files can be managed or purged independently.
    """

    message     = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        related_name='attachments',
    )
    file        = models.FileField(
        upload_to='chat/',
        storage=ChatAttachmentCloudinaryStorage(),  # dynamically handles image, video, and raw files
    )
    file_name   = models.CharField(max_length=255)
    file_size   = models.PositiveBigIntegerField(help_text='File size in bytes')
    file_type   = models.CharField(max_length=100, help_text='MIME type, e.g. image/jpeg')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    upload_id   = models.UUIDField(
        unique=True,
        null=True,
        blank=True,
        db_index=True,
        help_text=(
            'Client-generated idempotency key (UUID v4). '
            'When present, a retry with the same upload_id returns the existing '
            'Attachment without creating a duplicate or re-uploading to Cloudinary.'
        ),
    )

    class Meta:
        app_label = 'chat_messages'
        ordering  = ('uploaded_at',)

    @property
    def resource_type(self) -> str:
        """
        Dynamically determine the Cloudinary resource_type ('image', 'video', or 'raw')
        from MIME file_type, file_name, or stored file path.
        """
        if self.file_type:
            ft = self.file_type.lower()
            if ft.startswith('image/'):
                return 'image'
            if ft.startswith(('video/', 'audio/')):
                return 'video'
        if self.file_name:
            import os
            ext = os.path.splitext(self.file_name)[1].lstrip('.').lower()
            if ext in ChatAttachmentCloudinaryStorage.IMAGE_EXTENSIONS:
                return 'image'
            if ext in ChatAttachmentCloudinaryStorage.VIDEO_EXTENSIONS or ext in ChatAttachmentCloudinaryStorage.AUDIO_EXTENSIONS:
                return 'video'
        return 'raw'

    def __str__(self):
        return f'{self.file_name} → message #{self.message_id}'
