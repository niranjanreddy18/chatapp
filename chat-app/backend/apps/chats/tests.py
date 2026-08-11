import json

from asgiref.sync import async_to_sync
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.chats.models import Conversation, ConversationMember
from config.asgi import application

User = get_user_model()


class ConversationAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='alice', email='alice@example.com', password='password123')
        self.other_user = User.objects.create_user(username='bob', email='bob@example.com', password='password123')
        self.third_user = User.objects.create_user(username='carol', email='carol@example.com', password='password123')

    def authenticate(self, user):
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')

    def test_private_conversation_is_created_and_reused(self):
        self.authenticate(self.user)
        first_response = self.client.post(reverse('private_conversation'), {'user_id': self.other_user.id})
        second_response = self.client.post(reverse('private_conversation'), {'user_id': self.other_user.id})

        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second_response.status_code, status.HTTP_200_OK)
        self.assertEqual(first_response.data['data']['conversation_type'], 'PRIVATE')

    def test_group_conversation_is_created_with_members(self):
        self.authenticate(self.user)
        response = self.client.post(
            reverse('group_conversation'),
            {'name': 'Backend Team', 'member_ids': [self.other_user.id, self.third_user.id]},
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['data']['conversation_type'], 'GROUP')
        self.assertEqual(response.data['data']['name'], 'Backend Team')

    def test_conversation_list_is_scoped_to_member(self):
        self.authenticate(self.user)
        self.client.post(reverse('private_conversation'), {'user_id': self.other_user.id})
        response = self.client.get(reverse('conversations'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(len(response.data['data']) >= 1)


class ChatConsumerTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='dana', email='dana@example.com', password='password123')
        self.conversation = Conversation.objects.create(
            name='Test Chat',
            conversation_type=Conversation.ConversationType.PRIVATE,
            created_by=self.user,
        )
        ConversationMember.objects.create(conversation=self.conversation, user=self.user)
        self.token = str(RefreshToken.for_user(self.user).access_token)

    def test_member_can_connect_to_conversation_socket(self):
        async def run_test():
            communicator = WebsocketCommunicator(application, f'/ws/chat/{self.conversation.id}/?token={self.token}')
            connected, _ = await communicator.connect()
            self.assertTrue(connected)
            await communicator.disconnect()

        async_to_sync(run_test)()

    def test_member_can_send_message_via_socket(self):
        async def run_test():
            communicator = WebsocketCommunicator(application, f'/ws/chat/{self.conversation.id}/?token={self.token}')
            connected, _ = await communicator.connect()
            self.assertTrue(connected)

            await communicator.send_to(text_data=json.dumps({
                'type': 'send_message',
                'conversation_id': self.conversation.id,
                'content': 'hello from websocket',
            }))

            first_response = await communicator.receive_from()
            first_payload = json.loads(first_response)
            if first_payload['type'] == 'user_status':
                first_response = await communicator.receive_from()
                first_payload = json.loads(first_response)

            self.assertEqual(first_payload['type'], 'new_message')
            self.assertEqual(first_payload['message']['content'], 'hello from websocket')

            await communicator.disconnect()

        async_to_sync(run_test)()
