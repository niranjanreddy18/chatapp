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

        self.authenticate(self.other_user)
        reverse_response = self.client.post(reverse('private_conversation'), {'user_id': self.user.id})
        self.assertEqual(reverse_response.status_code, status.HTTP_200_OK)
        self.assertEqual(reverse_response.data['data']['id'], first_response.data['data']['id'])

    def test_private_conversation_is_listed_for_both_members(self):
        self.authenticate(self.user)
        created = self.client.post(reverse('private_conversation'), {'user_id': self.other_user.id})

        self.authenticate(self.other_user)
        response = self.client.get(reverse('conversations'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn(created.data['data']['id'], [item['id'] for item in response.data['data']])

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
        self.other_user = User.objects.create_user(username='erin', email='erin@example.com', password='password123')
        self.conversation = Conversation.objects.create(
            name='Test Chat',
            conversation_type=Conversation.ConversationType.PRIVATE,
            created_by=self.user,
        )
        ConversationMember.objects.create(conversation=self.conversation, user=self.user)
        ConversationMember.objects.create(conversation=self.conversation, user=self.other_user)
        self.token = str(RefreshToken.for_user(self.user).access_token)
        self.other_token = str(RefreshToken.for_user(self.other_user).access_token)

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

    def test_message_and_typing_events_reach_another_member(self):
        async def receive_event(communicator, expected_type):
            # Connections emit presence updates first; consume those until the
            # event under test arrives.
            for _ in range(6):
                payload = json.loads(await communicator.receive_from())
                if payload['type'] == expected_type:
                    return payload
            self.fail(f'Expected {expected_type} WebSocket event')

        async def run_test():
            sender = WebsocketCommunicator(application, f'/ws/chat/{self.conversation.id}/?token={self.token}')
            recipient = WebsocketCommunicator(application, f'/ws/chat/{self.conversation.id}/?token={self.other_token}')
            self.assertTrue((await sender.connect())[0])
            self.assertTrue((await recipient.connect())[0])

            await sender.send_to(text_data=json.dumps({
                'type': 'send_message',
                'conversation_id': self.conversation.id,
                'content': 'visible to the recipient',
            }))
            message_event = await receive_event(recipient, 'new_message')
            self.assertEqual(message_event['message']['conversation'], self.conversation.id)
            self.assertEqual(message_event['message']['content'], 'visible to the recipient')

            await sender.send_to(text_data=json.dumps({'type': 'typing_start'}))
            typing_start = await receive_event(recipient, 'typing_start')
            self.assertEqual(typing_start['conversation_id'], self.conversation.id)
            self.assertEqual(typing_start['user_id'], self.user.id)

            await sender.send_to(text_data=json.dumps({'type': 'typing_stop'}))
            typing_stop = await receive_event(recipient, 'typing_stop')
            self.assertEqual(typing_stop['conversation_id'], self.conversation.id)
            self.assertEqual(typing_stop['user_id'], self.user.id)

            await sender.disconnect()
            await recipient.disconnect()

        async_to_sync(run_test)()
