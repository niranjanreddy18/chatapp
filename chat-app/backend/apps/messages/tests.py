from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.chats.models import Conversation, ConversationMember
from apps.messages.models import Message, MessageRead

User = get_user_model()


class ReadReceiptAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='alice', email='alice@example.com', password='password123')
        self.other_user = User.objects.create_user(username='bob', email='bob@example.com', password='password123')
        self.conversation = Conversation.objects.create(
            name='Read Receipt Test',
            conversation_type=Conversation.ConversationType.PRIVATE,
            created_by=self.user,
        )
        ConversationMember.objects.create(conversation=self.conversation, user=self.user, is_active=True)
        ConversationMember.objects.create(conversation=self.conversation, user=self.other_user, is_active=True)
        self.message = Message.objects.create(
            conversation=self.conversation,
            sender=self.user,
            content='hello from read receipt test',
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {RefreshToken.for_user(self.user).access_token}')

    def test_read_status_endpoint_returns_message_read_receipts(self):
        MessageRead.objects.create(message=self.message, user=self.other_user)

        response = self.client.get(reverse('message_read_status', kwargs={'message_id': self.message.id}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['data']['message_id'], self.message.id)
        self.assertEqual(len(response.data['data']['users']), 1)
        self.assertEqual(response.data['data']['users'][0]['user_id'], self.other_user.id)
        self.assertEqual(response.data['data']['users'][0]['username'], self.other_user.username)
