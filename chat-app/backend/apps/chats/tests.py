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

    def test_unread_count_increases_when_other_user_sends_messages(self):
        from apps.messages.models import Message
        self.authenticate(self.user)
        create_res = self.client.post(reverse('private_conversation'), {'user_id': self.other_user.id})
        conv_id = create_res.data['data']['id']

        # Bob (other_user) sends 2 messages
        Message.objects.create(conversation_id=conv_id, sender=self.other_user, content='Msg 1')
        Message.objects.create(conversation_id=conv_id, sender=self.other_user, content='Msg 2')

        # Alice checks conversation list
        response = self.client.get(reverse('conversations'))
        conv_data = next(c for c in response.data['data'] if c['id'] == conv_id)
        self.assertEqual(conv_data['unread_count'], 2)

        # Bob checks conversation list — own messages must have unread_count 0
        self.authenticate(self.other_user)
        bob_response = self.client.get(reverse('conversations'))
        bob_conv_data = next(c for c in bob_response.data['data'] if c['id'] == conv_id)
        self.assertEqual(bob_conv_data['unread_count'], 0)

    def test_mark_conversation_read_resets_unread_count_and_persists(self):
        from apps.messages.models import Message
        self.authenticate(self.user)
        create_res = self.client.post(reverse('private_conversation'), {'user_id': self.other_user.id})
        conv_id = create_res.data['data']['id']

        Message.objects.create(conversation_id=conv_id, sender=self.other_user, content='Hello')

        # Alice verifies unread is 1
        res1 = self.client.get(reverse('conversations'))
        self.assertEqual(next(c for c in res1.data['data'] if c['id'] == conv_id)['unread_count'], 1)

        # Alice marks conversation as read
        read_res = self.client.post(reverse('conversation_read', kwargs={'pk': conv_id}))
        self.assertEqual(read_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(read_res.data['data']['read_message_ids']), 1)

        # Re-fetch conversations: unread_count must be 0 and persist
        res2 = self.client.get(reverse('conversations'))
        self.assertEqual(next(c for c in res2.data['data'] if c['id'] == conv_id)['unread_count'], 0)

    def test_fetching_messages_marks_conversation_as_read(self):
        from apps.messages.models import Message
        self.authenticate(self.user)
        create_res = self.client.post(reverse('private_conversation'), {'user_id': self.other_user.id})
        conv_id = create_res.data['data']['id']

        Message.objects.create(conversation_id=conv_id, sender=self.other_user, content='Hello 1')

        # Alice loads messages for the conversation
        msg_res = self.client.get(reverse('message_list', kwargs={'conversation_id': conv_id}))
        self.assertEqual(msg_res.status_code, status.HTTP_200_OK)

        # Re-fetch conversations: unread_count is now 0
        res = self.client.get(reverse('conversations'))
        self.assertEqual(next(c for c in res.data['data'] if c['id'] == conv_id)['unread_count'], 0)

    def test_reading_conversation_a_does_not_affect_conversation_b(self):
        from apps.messages.models import Message
        self.authenticate(self.user)
        conv1_id = self.client.post(reverse('private_conversation'), {'user_id': self.other_user.id}).data['data']['id']
        conv2_id = self.client.post(reverse('private_conversation'), {'user_id': self.third_user.id}).data['data']['id']

        Message.objects.create(conversation_id=conv1_id, sender=self.other_user, content='From Bob')
        Message.objects.create(conversation_id=conv2_id, sender=self.third_user, content='From Carol')

        # Mark only Conv 1 as read
        self.client.post(reverse('conversation_read', kwargs={'pk': conv1_id}))

        # Verify Conv 1 is read, Conv 2 is still unread
        res = self.client.get(reverse('conversations'))
        c1 = next(c for c in res.data['data'] if c['id'] == conv1_id)
        c2 = next(c for c in res.data['data'] if c['id'] == conv2_id)
        self.assertEqual(c1['unread_count'], 0)
        self.assertEqual(c2['unread_count'], 1)

    def test_group_chat_independent_unread_counts(self):
        from apps.messages.models import Message
        self.authenticate(self.user)
        group_res = self.client.post(
            reverse('group_conversation'),
            {'name': 'Team Group', 'member_ids': [self.other_user.id, self.third_user.id]},
        )
        group_id = group_res.data['data']['id']

        # Bob posts in group
        Message.objects.create(conversation_id=group_id, sender=self.other_user, content='Group Msg')

        # Alice reads group
        self.client.post(reverse('conversation_read', kwargs={'pk': group_id}))

        # Alice unread is 0
        alice_res = self.client.get(reverse('conversations'))
        self.assertEqual(next(c for c in alice_res.data['data'] if c['id'] == group_id)['unread_count'], 0)

        # Carol (third_user) unread is still 1
        self.authenticate(self.third_user)
        carol_res = self.client.get(reverse('conversations'))
        self.assertEqual(next(c for c in carol_res.data['data'] if c['id'] == group_id)['unread_count'], 1)


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
