from django.conf import settings
from django.db import models
from cloudinary_storage.storage import MediaCloudinaryStorage


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

    # Soft delete
    is_deleted = models.BooleanField(default=False)

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
        storage=MediaCloudinaryStorage(),  # uploads go to Cloudinary, not local /media/
    )
    file_name   = models.CharField(max_length=255)
    file_size   = models.PositiveBigIntegerField(help_text='File size in bytes')
    file_type   = models.CharField(max_length=100, help_text='MIME type, e.g. image/jpeg')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'chat_messages'
        ordering  = ('uploaded_at',)

    def __str__(self):
        return f'{self.file_name} → message #{self.message_id}'
