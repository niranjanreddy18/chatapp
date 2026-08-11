# Nexus Chat Database

## Data model overview

Nexus Chat uses a relational schema built around conversations, messages, memberships, profiles, and attachments.

## Tables

### `auth_user`
- Source: Django built-in user model.
- Primary key: `id`.
- Fields: `username`, `email`, `password`, etc.

### `apps_users_profile`
- Primary key: `id`.
- Foreign key: `user_id -> auth_user.id`.
- Fields: `avatar`, `bio`, `status_message`, `is_online`, `last_seen`, `created_at`, `updated_at`.
- Relationship: one-to-one with `auth_user`.

### `apps_chats_conversation`
- Primary key: `id`.
- Fields: `name`, `conversation_type`, `avatar`, `created_by_id`, `created_at`, `updated_at`.
- Relationship: created by a user.

### `apps_chats_conversationmember`
- Primary key: `id`.
- Foreign keys:
  - `conversation_id -> apps_chats_conversation.id`
  - `user_id -> auth_user.id`
- Fields: `joined_at`, `is_admin`, `is_active`.
- Constraints: unique `(conversation_id, user_id)`.

### `apps_messages_message`
- Primary key: `id`.
- Foreign keys:
  - `conversation_id -> apps_chats_conversation.id`
  - `sender_id -> auth_user.id`
  - `reply_to_id -> apps_messages_message.id` (nullable self-reference)
- Fields: `content`, `message_type`, `is_edited`, `edited_at`, `is_deleted`, `created_at`, `updated_at`.
- Indexes:
  - `created_at`
  - `(conversation_id, created_at)`
- Notes: messages are soft-deleted by masking content.

### `apps_messages_messageread`
- Primary key: `id`.
- Foreign keys:
  - `message_id -> apps_messages_message.id`
  - `user_id -> auth_user.id`
- Fields: `read_at`.
- Constraints: unique `(message_id, user_id)`.

### `apps_messages_attachment`
- Primary key: `id`.
- Foreign key: `message_id -> apps_messages_message.id`
- Fields: `file`, `file_name`, `file_size`, `file_type`, `uploaded_at`.

## Relationships

- `auth_user` 1--1 `apps_users_profile`
- `auth_user` 1--* `apps_messages_message`
- `auth_user` 1--* `apps_chats_conversationmember`
- `apps_chats_conversation` 1--* `apps_chats_conversationmember`
- `apps_chats_conversation` 1--* `apps_messages_message`
- `apps_messages_message` 1--* `apps_messages_attachment`
- `apps_messages_message` 1--* `apps_messages_messageread`
- `apps_messages_message` 0..1--1 `apps_messages_message` via `reply_to`

## Normalization

The schema is normalized to third normal form:

- Single purpose tables for conversations, members, messages, attachments, and read receipts.
- Redundant state is minimized.
- Soft delete is implemented at the message row level, not through physical deletion.

## ER diagram (ASCII)

```
          auth_user
             │
     ┌───────┼─────────────────────┐
     │       │                     │
     │       │                     │
profile  conversationmember    message
     │       │                     │
     │       │                     │
     │       │                     │
     │       └────── conversation ──┘
     │                             │
     │                             │
     │                             ├── attachment
     │                             │
     │                             └── messageread
```

## Indexes and constraints

- `Message`: index on `conversation_id` and `created_at` to support paginated history queries.
- `MessageRead`: unique constraint on `(message_id, user_id)` to prevent duplicate read receipts.
- `ConversationMember`: unique constraint on `(conversation_id, user_id)`.
- `Profile`: one-to-one relationship ensures one profile record per user.

## Notes

- The design supports private and group conversations.
- Messages carry sender data with optional `reply_to` references.
- Read receipts are stored as separate rows to support per-user read tracking.
