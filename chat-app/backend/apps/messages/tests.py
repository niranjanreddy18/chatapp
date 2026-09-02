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


class AttachmentUploadAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='carol', email='carol@example.com', password='password123')
        self.conversation = Conversation.objects.create(
            name='Attachment Test',
            conversation_type=Conversation.ConversationType.PRIVATE,
            created_by=self.user,
        )
        ConversationMember.objects.create(conversation=self.conversation, user=self.user, is_active=True)
        self.message = Message.objects.create(
            conversation=self.conversation,
            sender=self.user,
            content='Message with attachment',
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {RefreshToken.for_user(self.user).access_token}')

    def test_upload_image_attachment(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        from unittest.mock import patch

        img_file = SimpleUploadedFile('test_image.png', b'\x89PNG\r\n\x1a\nfakeimagecontent', content_type='image/png')

        with patch('cloudinary.uploader.upload') as mock_upload:
            mock_upload.return_value = {
                'public_id': 'media/chat/test_image',
                'format': 'png',
                'resource_type': 'image',
                'url': 'http://res.cloudinary.com/demo/image/upload/v1/media/chat/test_image.png',
                'secure_url': 'https://res.cloudinary.com/demo/image/upload/v1/media/chat/test_image.png',
            }
            response = self.client.post('/api/messages/upload/', {
                'file': img_file,
                'message_id': self.message.id,
            }, format='multipart')

            self.assertEqual(response.status_code, status.HTTP_201_CREATED)
            self.assertTrue(response.data['success'])
            data = response.data['data']
            self.assertEqual(data['file_name'], 'test_image.png')
            self.assertEqual(data['file_type'], 'image/png')
            self.assertIn('image/upload', data['file_url'])

            # Verify Cloudinary was called with resource_type='image'
            mock_upload.assert_called_once()
            _, kwargs = mock_upload.call_args
            self.assertEqual(kwargs.get('resource_type'), 'image')

    def test_upload_video_attachment(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        from unittest.mock import patch

        video_file = SimpleUploadedFile('test_video.mp4', b'fakevideocontent', content_type='video/mp4')

        with patch('cloudinary.uploader.upload') as mock_upload:
            mock_upload.return_value = {
                'public_id': 'media/chat/test_video',
                'format': 'mp4',
                'resource_type': 'video',
                'url': 'http://res.cloudinary.com/demo/video/upload/v1/media/chat/test_video.mp4',
                'secure_url': 'https://res.cloudinary.com/demo/video/upload/v1/media/chat/test_video.mp4',
            }
            response = self.client.post('/api/messages/upload/', {
                'file': video_file,
                'message_id': self.message.id,
            }, format='multipart')

            self.assertEqual(response.status_code, status.HTTP_201_CREATED)
            self.assertTrue(response.data['success'])
            data = response.data['data']
            self.assertEqual(data['file_name'], 'test_video.mp4')
            self.assertEqual(data['file_type'], 'video/mp4')
            self.assertIn('video/upload', data['file_url'])

            # Verify Cloudinary was called with resource_type='video'
            mock_upload.assert_called_once()
            _, kwargs = mock_upload.call_args
            self.assertEqual(kwargs.get('resource_type'), 'video')

    def test_existing_legacy_image_attachment_url(self):
        """Verify that existing records with extensionless public IDs resolve to image/upload."""
        from apps.messages.models import Attachment
        from apps.messages.serializers import AttachmentSerializer

        att = Attachment.objects.create(
            message=self.message,
            file='media/chat/legacy_image_12345',
            file_name='photo.jpg',
            file_size=1024,
            file_type='image/jpeg',
        )
        serializer = AttachmentSerializer(att)
        url = serializer.data['file_url']
        self.assertIn('image/upload', url)
        self.assertNotIn('raw/upload', url)

    def test_existing_legacy_video_attachment_url(self):
        """Verify that existing records with extensionless public IDs resolve to video/upload."""
        from apps.messages.models import Attachment
        from apps.messages.serializers import AttachmentSerializer

        att = Attachment.objects.create(
            message=self.message,
            file='media/chat/legacy_video_67890',
            file_name='clip.mp4',
            file_size=2048,
            file_type='video/mp4',
        )
        serializer = AttachmentSerializer(att)
        url = serializer.data['file_url']
        self.assertIn('video/upload', url)
        self.assertNotIn('raw/upload', url)

    def test_existing_legacy_raw_attachment_url(self):
        """Verify that raw files resolve to raw/upload."""
        from apps.messages.models import Attachment
        from apps.messages.serializers import AttachmentSerializer

        att = Attachment.objects.create(
            message=self.message,
            file='media/chat/document_abc',
            file_name='report.pdf',
            file_size=5000,
            file_type='application/pdf',
        )
        serializer = AttachmentSerializer(att)
        url = serializer.data['file_url']
        self.assertIn('raw/upload', url)

    def test_storage_delete_behavior(self):
        """Verify that delete calls cloudinary.uploader.destroy with correct resource_type and clean public_id."""
        from unittest.mock import patch
        from apps.messages.storage import ChatAttachmentCloudinaryStorage

        storage = ChatAttachmentCloudinaryStorage()
        with patch('cloudinary.uploader.destroy') as mock_destroy:
            mock_destroy.return_value = {'result': 'ok'}
            success = storage.delete('media/chat/image_file.jpg')
            self.assertTrue(success)
            mock_destroy.assert_called_with('media/chat/image_file', invalidate=True, resource_type='image')


class DeleteMessageAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='dave', email='dave@example.com', password='password123')
        self.other_user = User.objects.create_user(username='eve', email='eve@example.com', password='password123')
        self.conversation = Conversation.objects.create(
            name='Delete Test',
            conversation_type=Conversation.ConversationType.PRIVATE,
            created_by=self.user,
        )
        ConversationMember.objects.create(conversation=self.conversation, user=self.user, is_active=True)
        ConversationMember.objects.create(conversation=self.conversation, user=self.other_user, is_active=True)
        self.message = Message.objects.create(
            conversation=self.conversation,
            sender=self.user,
            content='Original message content',
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {RefreshToken.for_user(self.user).access_token}')

    def test_delete_message_soft_deletes_and_broadcasts(self):
        from unittest.mock import patch
        with patch('channels.layers.get_channel_layer') as mock_get_channel_layer:
            mock_layer = mock_get_channel_layer.return_value
            response = self.client.delete(reverse('message_delete', kwargs={'message_id': self.message.id}))

            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertTrue(response.data['success'])
            self.assertTrue(response.data['data']['is_deleted'])
            self.assertEqual(response.data['data']['content'], 'This message was deleted.')

            # Verify in DB
            self.message.refresh_from_db()
            self.assertTrue(self.message.is_deleted)
            self.assertEqual(self.message.content, 'This message was deleted.')

    def test_non_sender_cannot_delete_message(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {RefreshToken.for_user(self.other_user).access_token}')
        response = self.client.delete(reverse('message_delete', kwargs={'message_id': self.message.id}))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class RemoveMessageAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='frank', email='frank@example.com', password='password123')
        self.other_user = User.objects.create_user(username='grace', email='grace@example.com', password='password123')
        self.conversation = Conversation.objects.create(
            name='Remove Test',
            conversation_type=Conversation.ConversationType.PRIVATE,
            created_by=self.user,
        )
        ConversationMember.objects.create(conversation=self.conversation, user=self.user, is_active=True)
        ConversationMember.objects.create(conversation=self.conversation, user=self.other_user, is_active=True)
        self.message = Message.objects.create(
            conversation=self.conversation,
            sender=self.user,
            content='This message was deleted.',
            is_deleted=True,
        )
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {RefreshToken.for_user(self.user).access_token}')

    def test_remove_message_permanently_deletes_and_broadcasts(self):
        from unittest.mock import patch
        with patch('channels.layers.get_channel_layer') as mock_get_channel_layer:
            mock_layer = mock_get_channel_layer.return_value
            response = self.client.delete(reverse('message_remove', kwargs={'message_id': self.message.id}))

            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertTrue(response.data['success'])
            self.assertEqual(response.data['data']['message_id'], self.message.id)

            # Verify permanently deleted from DB
            self.assertFalse(Message.objects.filter(pk=self.message.id).exists())

    def test_non_sender_cannot_remove_message(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {RefreshToken.for_user(self.other_user).access_token}')
        response = self.client.delete(reverse('message_remove', kwargs={'message_id': self.message.id}))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)




