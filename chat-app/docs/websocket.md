# Nexus Chat WebSocket Documentation

## Connection Flow

1. Frontend connects to the backend WebSocket endpoint:
   - `ws://<host>/ws/chat/<conversation_id>/?token=<access_jwt>`
2. Backend extracts the `token` query parameter.
3. JWT authentication is performed using `rest_framework_simplejwt`.
4. If authentication succeeds and the user is an active member of `<conversation_id>`, the connection is accepted.
5. The consumer subscribes the socket to two channel groups:
   - `chat_<conversation_id>` — room-scoped events (typing, read receipts, chat cleared)
   - `user_<user_id>` — user-scoped events (new/edited/deleted/removed messages, new conversations, profile updates)

## Authentication & Close Codes

- **`4001`**: Missing, expired, or invalid JWT access token.
- **`4002`**: Non-text (binary) WebSocket frame received.
- **`4003`**: Authenticated user is not an active member of the requested conversation.

## Supported Events

### Client-to-Server Events

- **`send_message`**
  ```json
  {
    "type": "send_message",
    "conversation_id": 123,
    "content": "Hello",
    "reply_to": null
  }
  ```
- **`typing_start`**: `{ "type": "typing_start", "conversation_id": 123 }`
- **`typing_stop`**: `{ "type": "typing_stop", "conversation_id": 123 }`
- **`read_message`**: `{ "type": "read_message", "conversation_id": 123, "message_id": 456 }`
- **`read_conversation`**: `{ "type": "read_conversation", "conversation_id": 123 }`

### Server-to-Client Events

- **`new_message`**: `{ "type": "new_message", "message": { ... } }`
- **`message_edited`**: `{ "type": "message_edited", "message_id": 123, "conversation_id": 45, "message": { ... } }`
- **`message_deleted`**: `{ "type": "message_deleted", "message_id": 123, "conversation_id": 45, "message": { ... } }`
- **`message_removed`**: `{ "type": "message_removed", "message_id": 123, "conversation_id": 45 }`
- **`typing_start`**: `{ "type": "typing_start", "conversation_id": 45, "user_id": 5, "username": "alice" }`
- **`typing_stop`**: `{ "type": "typing_stop", "conversation_id": 45, "user_id": 5, "username": "alice" }`
- **`message_read`**: `{ "type": "message_read", "message_id": 123, "user_id": 5, "username": "alice", "read_at": "..." }`
- **`user_status`**: `{ "type": "user_status", "user_id": 5, "username": "alice", "is_online": true, "last_seen": "..." }`
- **`user_updated`**: `{ "type": "user_updated", "user_id": 5, "username": "alice", "avatar": "...", "bio": "...", "status_message": "..." }`
- **`conversation_created`**: `{ "type": "conversation_created", "conversation": { ... } }`
- **`conversation_deleted`**: `{ "type": "conversation_deleted", "conversation_id": 45, "deleted_by": 5 }`
- **`chat_cleared`**: `{ "type": "chat_cleared", "conversation_id": 45, "cleared_by": 5 }`
- **`error`**: `{ "type": "error", "message": "...", "errors": { ... } }`

## Example `new_message` Event

```json
{
  "type": "new_message",
  "message": {
    "conversation": 45,
    "id": 123,
    "sender_id": 5,
    "sender_username": "alice",
    "sender_avatar": null,
    "content": "Hello",
    "message_type": "text",
    "reply_to": null,
    "attachments": [],
    "read_by": [],
    "is_edited": false,
    "edited_at": null,
    "is_deleted": false,
    "created_at": "2026-08-02T12:34:56Z"
  }
}
```

## Reconnection Strategy

- `frontend/src/services/websocket.js` reconnects automatically using exponential backoff (`1s`, `2s`, `4s`, `8s`, capped at 5 attempts) when a socket closes unexpectedly.
- Intentional disconnects (switching conversations or logging out) suppress auto-reconnect.
