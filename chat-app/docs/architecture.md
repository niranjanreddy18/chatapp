# Nexus Chat Architecture

## Overall architecture

Nexus Chat is a full-stack portfolio prototype built with a React + Vite frontend and a Django backend.

- Frontend: Vite + React + Tailwind-style UI components.
- Backend: Django, Django REST Framework, Django Channels.
- Database: PostgreSQL.
- Real-time messaging: WebSockets via Django Channels.
- Caching / realtime coordination: Redis.
- Deployment targets: Vercel for frontend, Render for backend.

## Architecture goals

- Separate UI and API layers.
- Keep backend API thin and service-driven.
- Support real-time chat through a dedicated WebSocket consumer.
- Use environment-driven configuration for production readiness.

## Frontend architecture

The frontend follows a component-driven React architecture:

- `src/pages/`: page-level route components.
- `src/components/`: reusable UI building blocks and chat layout.
- `src/context/`: shared application state via React Context.
- `src/services/`: API and WebSocket adapters.
- `src/routes/`: route definitions and protected route handling.

### Key layers

- `AuthContext`: manages JWT token, login/logout state, and local storage.
- `ConversationContext`: loads and selects conversations, tracks presence.
- `MessageContext`: handles message pagination, send/edit/delete, typing, and read receipts.
- `ThemeContext`: theme mode state.
- `api.js`: central Axios client for authenticated REST requests.
- `websocket.js`: WebSocket connection management, reconnection, event dispatch.

## Backend architecture

The backend is organized by Django apps:

- `apps.accounts`: authentication, registration, JWT refresh, current user.
- `apps.users`: user profile management and user list search.
- `apps.chats`: conversation creation and membership.
- `apps.messages`: message lifecycle, attachments, read receipts.
- `apps.notifications`: reserved for notification features.

### API layer

- Uses DRF `GenericAPIView`, `ListAPIView`, and custom serializer validation.
- Returns structured JSON envelopes:
  - `success`: boolean
  - `message`: status text
  - `data`: payload

### Business logic

- Message business rules are centralized in `apps/messages/services.py`.
- Conversation creation and membership rules are handled in `apps/chats/serializers.py`.
- Permissions are enforced via custom checks and DRF permission classes.

## REST flow

1. React sends an authenticated request to `/api/...`.
2. DRF view validates input with a serializer.
3. Service layer executes business logic and database mutations.
4. View returns a JSON response with `success`, `message`, and `data`.

### Example flow

- User clicks send.
- Frontend posts to `POST /api/messages/`.
- Backend validates conversation membership.
- Backend creates a `Message` record.
- Response returns serialized message metadata.

## WebSocket flow

1. Client opens `ws://.../ws/chat/<conversation_id>/?token=<jwt>`.
2. Backend authenticates the JWT token.
3. Connection is accepted only if the user is an active conversation member.
4. Real-time events are broadcast to the conversation group.

### WebSocket event handling

- `send_message`: create a new message.
- `typing_start`: broadcast typing status.
- `typing_stop`: broadcast typing stopped.
- `read_message`: record read receipt, broadcast receipt.
- `new_message`: delivered to all conversation participants.
- `message_read`: read receipt event.
- `user_status`: presence updates.

## Deployment architecture

- Frontend builds a static site and deploys to Vercel.
- Backend runs on Render behind a managed PostgreSQL and Redis Cloud.
- Backend serves API and WebSocket traffic through `config.asgi:application`.
- Static assets are served through `whitenoise` in backend production.

## ASCII diagrams

Frontend <--> REST API <--> Backend
                 |
                 | WebSockets
                 v
                 Redis

User Browser
  ├─ React UI
  ├─ Axios REST calls
  └─ WebSocket channel

Backend Services
  ├─ Django REST Framework
  ├─ Django Channels
  ├─ PostgreSQL
  └─ Redis
