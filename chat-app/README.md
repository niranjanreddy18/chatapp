# Nexus Chat

Nexus Chat is a full-stack real-time messaging application built with a **React 19 + Vite** frontend and a **Django 5 + Django REST Framework + Django Channels** backend. It supports 1-on-1 and group conversations, live messaging, typing indicators, read receipts, online presence, and multimedia attachments.

---

## Features

- **Authentication & Session Management**: User registration, case-insensitive username/email login, JWT access/refresh token rotation, and server-side refresh token blacklisting on logout.
- **1-on-1 & Group Conversations**: Direct messaging with automatic conversation reuse/reactivation and multi-member group chats.
- **Real-Time Messaging & Presence**: Instant message delivery, live typing indicators, online/last-seen presence, and per-message read receipts via WebSockets.
- **Full Message Lifecycle**: Reply-to message threading, message editing (`is_edited` tracking), soft deletion (masking content while preserving thread history), permanent removal, and per-conversation chat clearing.
- **Media & Voice Attachments**: Image, video, document, and in-browser voice recording uploads backed by Cloudinary storage with client-side optimistic previews and idempotent retry keys (`upload_id`).
- **User Profiles & Customization**: Customizable avatar, display username, bio, status message, starred conversations, and light/dark/system themes.

---

## Tech Stack

| Layer | Technologies |
| --- | --- |
| **Frontend** | React 19, Vite 8, React Router v7, Axios, Tailwind CSS v4, Lucide React, `react-hot-toast` |
| **Backend** | Python 3.12, Django 5.2, Django REST Framework, SimpleJWT, Django Channels, Daphne ASGI |
| **Database & Storage** | PostgreSQL (production) / SQLite (local dev), Cloudinary (`django-cloudinary-storage`), WhiteNoise |

---

## Architecture

The repository is structured as a clean monorepo separating the REST/ASGI backend from the SPA frontend:

```text
chat-app/
├── backend/
│   ├── apps/
│   │   ├── accounts/       # Registration, login, logout, JWT refresh, /auth/me
│   │   ├── chats/          # Conversations, memberships, ASGI WebSocket consumer
│   │   ├── common/         # Centralized API response envelope & exception handler
│   │   ├── messages/       # Messages, attachments, read receipts, service layer
│   │   └── users/          # User profiles, avatar uploads, user directory
│   ├── config/             # Django settings, URLs, ASGI/WebSocket routing
│   └── manage.py
├── frontend/
│   └── src/
│       ├── components/     # ChatWindow, ConversationSidebar, layout & UI primitives
│       ├── context/        # AuthContext, ConversationContext, MessageContext, ThemeContext
│       ├── hooks/          # Custom hooks (useUsers, useChat, useSocket)
│       ├── pages/          # Login, Register, Home, Profile, Settings
│       └── services/       # Axios API client (with JWT refresh interceptor) & WebSocket manager
└── docs/                   # Detailed API, database, WebSocket, and architecture docs
```

- **Thin Views & Service Layer**: REST views validate input via serializers and delegate multi-step database writes to atomic service functions in `apps/messages/services.py`.
- **Standardized API Envelope**: All responses and handled exceptions pass through `apps/common/responses.py` and `apps/common/exceptions.py`, returning `{ "success": bool, "message": str, "data" | "errors": ... }`.

---

## Authentication

1. **Login / Registration**: `POST /api/auth/login/` validates credentials (supporting case-insensitive username or email lookup) and returns a short-lived `access` JWT and a longer-lived `refresh` JWT.
2. **Automatic Token Refresh**: The Axios response interceptor in `frontend/src/services/api.js` catches `401 Unauthorized` responses, queues concurrent requests, refreshes the access token via `POST /api/auth/refresh/`, and transparently retries the original requests.
3. **Logout Blacklisting**: `POST /api/auth/logout/` blacklists the refresh token using `rest_framework_simplejwt.token_blacklist` so it cannot be reused.

---

## WebSocket Flow

1. **Connection & Authorization**: The client connects to `ws://<host>/ws/chat/<conversation_id>/?token=<access_jwt>`. `ChatConsumer.connect` authenticates the JWT and verifies that the user is an active member of `<conversation_id>` before accepting the connection.
2. **Channel Groups**: Each connected socket subscribes to:
   - `chat_<conversation_id>` — room-scoped events (`typing_start`, `typing_stop`, `message_read`, `chat_cleared`).
   - `user_<user_id>` — user-scoped events (`new_message`, `message_edited`, `message_deleted`, `message_removed`, `conversation_created`, `conversation_deleted`), ensuring background conversations update their unread badges in real time.
3. **Reconnection**: `frontend/src/services/websocket.js` automatically reconnects with exponential backoff on unexpected disconnects.

---

## Database Relationships

- **`User` ↔ `Profile` (`OneToOne`)**: Automatically provisioned via a `post_save` signal on `User`; stores `avatar`, `bio`, `status_message`, `is_online`, and `last_seen`.
- **`Conversation` ↔ `ConversationMember` (`OneToMany`)**: Join table linking `User` and `Conversation` with a unique constraint on `(conversation, user)` and an `is_active` flag for per-user soft deletion.
- **`Conversation` ↔ `Message` (`OneToMany`)**: Stores `sender`, `content`, `message_type`, self-referential `reply_to` (`SET_NULL`), `is_edited`, `is_deleted`, and `is_cleared`, indexed by `(conversation, created_at)`.
- **`Message` ↔ `Attachment` (`OneToMany`)**: Stores file metadata, Cloudinary reference, and an optional unique `upload_id` UUID for idempotent upload retries.
- **`Message` ↔ `MessageRead` (`OneToMany`)**: Tracks per-user read receipts with a unique constraint on `(message, user)`.

---

## Important Technical Decisions

- **Soft-Delete & Membership Reactivation**: Deleting a conversation (`DELETE /api/conversations/<id>/delete/`) sets `ConversationMember.is_active = False` for the requesting user rather than deleting the shared `Conversation` row, preserving chat history for other participants. Starting a 1-on-1 chat again reactivates the membership instead of creating duplicate private conversations.
- **Optimistic UI with Idempotent Media Retries**: Selecting and sending an attachment renders an immediate local `blob:` preview and generates a client UUID (`upload_id`). If the upload request times out and is retried, the backend deduplicates on `upload_id` to prevent duplicate database rows and Cloudinary uploads.
- **Single-Delivery Broadcasts**: Message mutations broadcast to active members' `user_<id>` groups so each connected client receives the event once, whether viewing the active room or another conversation.

---

## Performance Considerations

- **Eliminating N+1 Queries**: Conversation and message endpoints use `select_related('created_by', 'sender', 'sender__profile', 'reply_to', 'reply_to__sender')` and `prefetch_related('memberships__user__profile', 'attachments', 'read_receipts')`, plus database-level `Count` annotations for `member_count` and `unread_count`.
- **Paginated Message History**: `GET /api/messages/<conversation_id>/` paginates messages (20 per page) and merges older pages into client state without discarding real-time or optimistic messages.
- **On-Demand User Directory**: `useUsers` fetches user lists only when the New Chat or New Group modal is opened rather than on initial sidebar mount.

---

## Setup Instructions

### 1. Backend

```bash
cd chat-app/backend
python -m venv .venv
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# macOS / Linux:
# source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py runserver
```

### 2. Frontend

```bash
cd chat-app/frontend
npm install
cp .env.example .env
npm run dev
```

### 3. Running Checks & Tests

```bash
# Backend checks & test suite (from chat-app/backend)
python manage.py check
python manage.py test

# Frontend lint & build (from chat-app/frontend)
npm run lint
npm run build
```

---

## Future Improvements

- **Redis Channel Layer (`channels-redis`)**: Replace `InMemoryChannelLayer` with `RedisChannelLayer` when scaling horizontally across multiple ASGI worker processes.
- **Cursor-Based Pagination**: Migrate message history pagination from page-number offset to cursor pagination (`created_at` / `id`) for very large conversation histories.
- **Full-Text Message Search**: Add PostgreSQL `SearchVector` indexing for server-side search across historical messages.
