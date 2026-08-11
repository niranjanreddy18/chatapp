from django.conf import settings
from django.db import models
from django.utils import timezone


class Conversation(models.Model):
    """Represents a private or group conversation."""

    class ConversationType(models.TextChoices):
        PRIVATE = 'PRIVATE', 'Private'
        GROUP = 'GROUP', 'Group'

    name = models.CharField(max_length=255, blank=True, null=True)
    conversation_type = models.CharField(max_length=20, choices=ConversationType.choices, default=ConversationType.PRIVATE)
    avatar = models.ImageField(upload_to='conversation_avatars/', blank=True, null=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_conversations')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-updated_at', '-created_at')

    def __str__(self):
        return self.name or f'{self.conversation_type.lower()} conversation'


class ConversationMember(models.Model):
    """Joins a user to a conversation and tracks membership state."""

    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='conversation_memberships')
    joined_at = models.DateTimeField(default=timezone.now)
    is_admin = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['conversation', 'user'], name='unique_conversation_member')
        ]
        ordering = ('joined_at',)

    def __str__(self):
        return f'{self.user.username} -> {self.conversation}'
