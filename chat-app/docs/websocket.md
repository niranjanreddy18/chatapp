# Nexus Chat WebSocket Documentation

## Connection flow

1. Frontend connects to the backend WebSocket endpoint:
   - `ws://<host>/ws/chat/<conversation_id>/?token=<jwt>`
2. Backend extracts the `token` query parameter.
3. JWT authentication is performed using `rest_framework_simplejwt`.
4. If authentication passes and the user is an active conversation member, the socket is accepted.
5. The connection joins the conversation group.

## Authentication

- The WebSocket transport authenticates via JWT in the query string.
- The token must be valid and unexpired.
- Unauthorized connections close with a WebSocket error code.

## Supported events

### Frontend-to-server events

- `send_message`
  - payload:
    ```json
    {
      "type": "send_message",
      "conversation_id": 123,
      "content": "Hello",
      "reply_to": null
    }
    ```

- `typing_start`
  - payload: `{ "type": "typing_start" }`

- `typing_stop`
  - payload: `{ "type": "typing_stop" }`

- `read_message`
  - payload:
    ```json
    {
      "type": "read_message",
      "message_id": 456
    }
    ```

### Server-to-client events

- `new_message`
  - payload includes serialized `message` data.

- `typing_start`
  - payload includes `user_id` and `username`.

- `typing_stop`
  - payload includes `user_id`.

- `message_read`
  - payload includes `message_id`, `user_id`, and `read_at`.

- `user_status`
  - payload includes `user_id`, `is_online`, and `last_seen`.

- `error`
  - payload includes `message` describing the failure.

## Message format

All WebSocket messages are JSON objects with a `type` field.

Example server event:

```json
{
  "type": "new_message",
  "message": {
    "id": 123,
    "sender_id": 5,
    "sender_username": "alice",
    "content": "Hello",
    "message_type": "TEXT",
    "reply_to": null,
    "attachments": [],
    "is_edited": false,
    "is_deleted": false,
    "created_at": "2026-08-02T12:34:56Z"
  }
}
```

## Typing

- `typing_start` indicates the current user has begun typing.
- `typing_stop` indicates the current user has stopped typing.
- All members in the conversation receive these events.

## Presence

- Presence updates are emitted when a user connects or disconnects.
- The event type is `user_status`.
- Clients can render online/offline status and last seen metadata.

## Read receipts

- Clients send `read_message` when a message is seen.
- The server marks the message read in the database.
- A `message_read` event is broadcast to the conversation group.

## Reconnect strategy

- The frontend reconnects with exponential backoff when the socket closes unexpectedly.
- It preserves the active conversation ID and JWT token.
- Reconnection retries are capped to prevent infinite loops.

## Failure cases

- Missing token: connection closes with a client-side error.
- Invalid token: connection closes with authentication error code.
- Non-member user: connection closes with forbidden error.
- Malformed payload: server replies with an `error` event.
