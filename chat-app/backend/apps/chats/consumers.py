import json
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.utils import timezone
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed, InvalidToken

from apps.chats.models import ConversationMember
from apps.messages import services as message_services
from apps.messages.models import Message
from apps.messages.serializers import MessageSerializer, SendMessageSerializer
from apps.messages.services import mark_message_read
from apps.users.models import Profile


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        conversation_id = self.scope['url_route']['kwargs']['conversation_id']
        token = self._get_token_from_query()

        if not token:
            await self.close(code=4001)
            return

        user = await self._authenticate_user(token)
        if not user or not user.is_authenticated:
            await self.close(code=4001)
            return

        if not await self._is_active_member(user, conversation_id):
            await self.close(code=4003)
            return

        self.user = user
        self.conversation_id = conversation_id
        self.room_group_name = f'chat_{conversation_id}'
        self.is_typing = False

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()
        await self.update_presence(is_online=True)

    async def disconnect(self, close_code):
        if getattr(self, 'room_group_name', None):
            if getattr(self, 'is_typing', False):
                await self.typing_stop()
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
        if getattr(self, 'user', None) is not None:
            await self.update_presence(is_online=False)

    async def receive(self, text_data=None, bytes_data=None):
        if text_data is None:
            await self.close(code=4002)
            return

        try:
            payload = json.loads(text_data)
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Malformed JSON.',
            }))
            return

        if not isinstance(payload, dict):
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Payload must be a JSON object.',
            }))
            return

        event_type = payload.get('type')
        if event_type == 'send_message':
            serializer = SendMessageSerializer(data=payload)
        elif event_type == 'typing_start':
            await self.handle_typing_start()
            return
        elif event_type == 'typing_stop':
            await self.handle_typing_stop()
            return
        elif event_type == 'read_message':
            await self.handle_read_message(payload)
            return
        else:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Unknown event type.',
            }))
            return

        if not serializer.is_valid():
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': serializer.errors,
            }))
            return

        validated = serializer.validated_data
        try:
            message = await self._create_message(
                conversation_id=validated['conversation_id'],
                content=validated['content'],
            )
        except DRFValidationError as exc:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': str(exc.detail),
            }))
            return
        except PermissionError:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'You are not a member of this conversation.',
            }))
            return

        serialized_message = await self._serialize_message(message)
        payload = {
            'type': 'new_message',
            'message': serialized_message,
        }
        await self.channel_layer.group_send(self.room_group_name, {
            'type': 'chat.message',
            'payload': json.dumps(payload),
        })

    async def chat_message(self, event):
        await self.send(text_data=event['payload'])

    async def handle_typing_start(self):
        if getattr(self, 'is_typing', False):
            return
        self.is_typing = True
        await self.typing_start()

    async def handle_typing_stop(self):
        if not getattr(self, 'is_typing', False):
            return
        self.is_typing = False
        await self.typing_stop()

    async def typing_start(self):
        payload = json.dumps({
            'type': 'typing_start',
            'user_id': self.user.id,
            'username': self.user.username,
        })
        await self.channel_layer.group_send(self.room_group_name, {
            'type': 'chat.message',
            'payload': payload,
        })

    async def typing_stop(self):
        payload = json.dumps({
            'type': 'typing_stop',
            'user_id': self.user.id,
            'username': self.user.username,  # must match typing_start so frontend filter works
        })
        await self.channel_layer.group_send(self.room_group_name, {
            'type': 'chat.message',
            'payload': payload,
        })

    async def handle_read_message(self, payload):
        message_id = payload.get('message_id')
        if not isinstance(message_id, int):
            await self.send(text_data=json.dumps({'type': 'error', 'message': 'message_id must be an integer.'}))
            return

        try:
            read_receipt = await self._mark_message_read(message_id)
        except Message.DoesNotExist:
            await self.send(text_data=json.dumps({'type': 'error', 'message': 'Message not found.'}))
            return
        except PermissionError:
            await self.send(text_data=json.dumps({'type': 'error', 'message': 'You are not allowed to read this message.'}))
            return

        await self.channel_layer.group_send(self.room_group_name, {
            'type': 'chat.message',
            'payload': json.dumps({
                'type': 'message_read',
                'message_id': read_receipt.message_id,
                'user_id': self.user.id,
                'read_at': read_receipt.read_at.isoformat(),
            }),
        })

    async def update_presence(self, *, is_online: bool):
        if getattr(self, 'user', None) is None:
            return

        profile = await self._get_profile()
        if profile is None:
            return

        should_update = profile.is_online != is_online
        if is_online is False:
            should_update = should_update or profile.last_seen is None or profile.last_seen < timezone.now() - timezone.timedelta(minutes=1)

        if not should_update:
            return

        profile.is_online = is_online
        if not is_online:
            profile.last_seen = timezone.now()

        await self._save_profile(profile)
        await self.broadcast_presence(profile)

    async def broadcast_presence(self, profile: Profile):
        if self.channel_layer is None:
            return

        conversation_ids = await self._get_conversation_ids_for_user(self.user.id)
        for conversation_id in conversation_ids:
            group_name = f'chat_{conversation_id}'
            payload = json.dumps({
                'type': 'user_status',
                'user_id': self.user.id,
                'is_online': profile.is_online,
                'last_seen': profile.last_seen.isoformat() if not profile.is_online else None,
            })
            await self.channel_layer.group_send(group_name, {
                'type': 'chat.message',
                'payload': payload,
            })

    def _get_token_from_query(self):
        query_string = self.scope.get('query_string', b'').decode()
        params = parse_qs(query_string)
        return params.get('token', [None])[0]

    async def _authenticate_user(self, token):
        auth = JWTAuthentication()
        try:
            validated_token = await database_sync_to_async(auth.get_validated_token)(token)
            user = await database_sync_to_async(auth.get_user)(validated_token)
        except (AuthenticationFailed, InvalidToken):
            return None
        return user

    async def _is_active_member(self, user, conversation_id):
        return await database_sync_to_async(
            lambda: ConversationMember.objects.filter(
                conversation_id=conversation_id,
                user=user,
                is_active=True,
            ).exists()
        )()

    async def _get_profile(self) -> Profile | None:
        return await database_sync_to_async(self._get_profile_sync)()

    def _get_profile_sync(self) -> Profile | None:
        try:
            return Profile.objects.get(user=self.user)
        except Profile.DoesNotExist:
            return None

    async def _save_profile(self, profile: Profile):
        await database_sync_to_async(profile.save)()

    async def _get_conversation_ids_for_user(self, user_id: int):
        return await database_sync_to_async(self._get_conversation_ids_for_user_sync)(user_id)

    def _get_conversation_ids_for_user_sync(self, user_id: int):
        return list(
            ConversationMember.objects.filter(user_id=user_id, is_active=True)
            .values_list('conversation_id', flat=True)
            .distinct()
        )

    async def _mark_message_read(self, message_id: int):
        return await database_sync_to_async(self._mark_message_read_sync)(message_id)

    def _mark_message_read_sync(self, message_id: int):
        try:
            message = Message.objects.select_related('conversation').get(pk=message_id)
        except Message.DoesNotExist as exc:
            raise Message.DoesNotExist from exc

        if not ConversationMember.objects.filter(
            conversation_id=message.conversation_id,
            user=self.user,
            is_active=True,
        ).exists():
            raise PermissionError('You are not allowed to read this message.')

        return mark_message_read(user=self.user, message_id=message_id)

    async def _create_message(self, *, conversation_id: int, content: str) -> Message:
        return await database_sync_to_async(self._create_message_sync)(conversation_id=conversation_id, content=content)

    async def _serialize_message(self, message: Message):
        return await database_sync_to_async(self._serialize_message_sync)(message)

    def _serialize_message_sync(self, message: Message):
        serializer = MessageSerializer(message, context={'request': None})
        return serializer.data

    def _create_message_sync(self, *, conversation_id: int, content: str) -> Message:
        try:
            return message_services.send_message(
                user=self.user,
                conversation_id=conversation_id,
                content=content,
            )
        except DRFValidationError:
            raise
        except Exception as exc:
            if 'member' in str(exc).lower() or 'not a member' in str(exc).lower():
                raise PermissionError(str(exc)) from exc
            raise
