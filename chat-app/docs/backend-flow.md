# Backend Architecture and Request Flow

This document explains the backend of the chat application as a standalone system. It focuses on architecture, responsibilities, and request paths rather than implementation details or source edits.

## 1. System overview

The backend is a Django project with three major execution modes:

- HTTP API layer for authentication, profiles, conversations, and messages.
- WebSocket layer for real-time chat events such as sending messages, typing indicators, and read receipts.
- Database layer for persistence of users, profiles, conversations, memberships, messages, and attachments.

The stack is built around:

- Django as the core framework.
- Django REST Framework for API endpoints.
- SimpleJWT for access and refresh tokens.
- Channels for asynchronous WebSocket support.
- SQLite by default, with optional Redis-backed channel layers for production-like deployments.

## 2. High-level architecture

The backend follows a layered pattern:

1. URL routing receives the request.
2. Middleware and authentication validate the incoming request.
3. A view handles the request and delegates business logic.
4. Serializers validate input and shape responses.
5. Services contain the core business rules and database mutations.
6. Models persist state in the database.
7. Responses return in a consistent envelope: success, message, and data.

This separation keeps views thin and makes the backend easier to extend.

## 3. Project structure

The Django project lives under the backend folder and is organized by feature app:

- apps/accounts
  - Authentication endpoints: register, login, logout, refresh, and current user.
- apps/users
  - User profiles and user listing.
- apps/chats
  - Conversation and conversation-member models plus chat WebSocket consumer.
- apps/messages
  - Message, attachments, read receipts, message pagination, and message-related services.
- apps/notifications
  - Prepared for future notification events.
- apps/common
  - Shared infrastructure and support utilities.
- config
  - Project-level settings, routing, ASGI entry point, and URL configuration.

## 4. Runtime entry points

### HTTP API entry point

HTTP requests enter through the Django URL config in config/urls.py. The top-level routes include:

- /api/auth/ for authentication endpoints.
- /api/ for user/profile and chat endpoints.
- /api/messages/ for message actions.

### WebSocket entry point

The ASGI application in config/routing.py routes WebSocket traffic to the chat consumer. The route is:

- /ws/chat/<conversation_id>/

This enables real-time communication per conversation room.

## 5. Core models and domain boundaries

### User and profile

Django's built-in user model is extended through a one-to-one Profile model.

- Profile stores avatar, bio, online status, and last seen.
- A signal creates the profile automatically when a new user is created.

This means the backend treats a user as a base identity with optional profile metadata.

### Conversation

A Conversation represents a private chat or a group chat.

- Private conversations are one-to-one rooms.
- Group conversations can have multiple members.
- ConversationMember joins users to a conversation and tracks membership state.

### Message

A Message belongs to exactly one conversation and is authored by one user.

The model supports:

- text, image, file, and system message types.
- reply-to threading.
- edit tracking.
- soft delete.
- attachment support.

### MessageRead

MessageRead tracks whether each user has read a message. This powers read-receipt behavior and real-time updates.

## 6. Authentication architecture

Authentication is JWT-based.

### Login and registration

The accounts app exposes:

- RegisterView for creating a new user.
- LoginView for authenticating a user and issuing JWTs.
- LogoutView for blacklisting refresh tokens.
- CurrentUserView for fetching the currently authenticated account.

On successful login:

1. The user is verified using username or email plus password.
2. A refresh token and an access token are generated.
3. The response returns the tokens and the user object.

### Token handling

The API uses SimpleJWT with:

- access token lifetime of 30 minutes.
- refresh token lifetime of 7 days.
- refresh rotation enabled.
- blacklist support for invalidation after rotation.

### Auth enforcement

DRF authentication is enforced globally by the REST framework settings. Requests that require login rely on JWTAuthentication.

## 7. Request lifecycle in the REST API

A typical API request follows this path:

1. The request hits the URL configuration.
2. Django resolves the route to a view.
3. The view uses permissions to check whether the requester is allowed.
4. The view creates or uses a serializer to validate input.
5. The view delegates business logic to a service function.
6. The service performs the required database operation.
7. The view serializes the resulting model instance into JSON.
8. The response is returned in the project’s standard envelope.

Example: sending a message

- URL: /api/messages/
- View: SendMessageView
- Serializer: SendMessageSerializer
- Service: send_message
- Model: Message
- Response: message payload plus success metadata

## 8. Conversation flow

### Creating a private conversation

A private conversation is created when a user selects another user.

Flow:

1. The client posts to the private conversation endpoint.
2. The serializer validates that the request has the correct input and the requester is authenticated.
3. The view checks whether a private conversation between the two users already exists.
4. If it does not exist, a transaction creates:
   - a Conversation row.
   - a ConversationMember row for the requester.
   - a ConversationMember row for the target user.
5. The conversation is returned to the client.

### Creating a group conversation

Group conversation creation requires:

- a group name.
- a list of member IDs.

The backend validates the list and creates the conversation plus membership rows inside a transaction.

### Listing and retrieving conversations

Conversation endpoints are protected and filtered to only the conversations that the current user belongs to.

This ensures that users never see conversations they are not part of.

## 9. Message flow

### Sending a message

The send-message path is intentionally separated into view, serializer, and service layers.

Flow:

1. The request enters SendMessageView.
2. SendMessageSerializer validates content and conversation ID.
3. The service checks whether the sender is an active member of the conversation.
4. The message is created in the database.
5. The view serializes the message and returns it to the client.

### Editing a message

Edit requests are routed to EditMessageView, which relies on an object-level permission to ensure that only the sender can edit the message.

The service updates:

- the content.
- the edited flag.
- the edited timestamp.

### Soft delete

Deletion is not a hard delete. The backend marks the message as deleted and replaces its content with a standard deleted placeholder.

This preserves message history, reply references, and auditability.

### Listing messages

Message listing is paginated and ordered by creation time.

The view uses:

- permission checks for conversation membership.
- a pagination class.
- optimized queryset selection to reduce database overhead.

### Read receipts

When a user marks a message as read, the backend creates a MessageRead row. This supports read-state tracking for the front end and for later UI enhancements.

### File attachments

Attachment upload is handled separately from message creation.

Flow:

1. The client uploads multipart form data.
2. The view validates that a file and message ID were provided.
3. The backend ensures the file is attached to the sender’s own message.
4. The service validates the MIME type and stores the file.
5. An Attachment record is created in the database.

## 10. WebSocket flow

The real-time chat layer is handled by the ChatConsumer.

### Connection lifecycle

When a client connects to /ws/chat/<conversation_id>/:

1. The consumer reads the conversation ID from the URL.
2. It extracts the JWT from the query string.
3. It authenticates the user.
4. It verifies that the user is an active conversation member.
5. It joins the conversation room group.
6. It accepts the connection.

If any of these checks fail, the socket closes with an error code.

### Event handling

The consumer handles several event types:

- send_message: creates a new message and broadcasts it to the conversation room.
- typing_start and typing_stop: broadcast typing indicators.
- read_message: records read state and broadcasts a read receipt.

### Broadcasting

The consumer uses Django Channels group messaging to deliver updates to every connected client in the same conversation room.

This gives the app a lightweight fan-out model for chat events without requiring a separate pub/sub system for the current scope.

## 11. Serializers, views, and services

The backend uses a clear separation of concerns:

- Views: coordinate request handling and response shaping.
- Serializers: validate input and transform data.
- Services: contain the actual business rules and database operations.

This separation keeps the codebase readable and makes the architecture easier to explain in interviews or design reviews.

## 12. Permissions and access control

Access control is enforced in two places:

- Permission classes for route-level restrictions.
- Service-layer checks for context-specific rules.

Examples:

- Only authenticated users can access protected APIs.
- Only active conversation members can read/write chat data.
- Only message senders can edit or delete their own messages.

This layered access control reduces the chance of accidental authorization gaps.

## 13. End-to-end examples

### Example A: Login flow

1. Client calls /api/auth/login/.
2. LoginView validates credentials.
3. JWTs are issued.
4. The client stores the access token and refresh token.
5. Later requests attach the access token to the Authorization header.

### Example B: Open a conversation

1. Client requests the conversation list.
2. The backend returns only conversations for the authenticated user.
3. The client opens one conversation.
4. The UI connects to the WebSocket for that conversation.
5. Messages and read-state events arrive in real time.

### Example C: Send a message in real time

1. The client sends a WebSocket event over the chat room.
2. The consumer validates the payload.
3. The service creates the database record.
4. The backend broadcasts the message to all subscribers in that room.
5. Every connected client receives the update.

## 14. Architectural strengths

The backend is intentionally simple and modular:

- Feature apps align with business domains.
- Views stay thin and focused on request handling.
- Services centralize most business logic.
- Models are explicit and relational.
- WebSocket behavior is isolated to the chat consumer.

These choices make the system easy to understand and extend.

## 15. Design tradeoffs and future direction

The current architecture is solid for a small-to-medium chat application, but it has clear scaling boundaries:

- SQLite is fine for development and small deployments but will not be the best fit for high concurrency.
- The current WebSocket implementation is effective for a single server deployment but should be paired with a production-grade channel backend for larger traffic.
- Notification logic is currently scaffolded and can be expanded into a dedicated event-driven subsystem.

## 16. Interview-ready summary

If you need to explain the backend in one minute, use this version:

The backend is a Django-based chat application with a REST API for authentication, profiles, conversations, and messages, plus a WebSocket layer for real-time updates. Requests follow a clean layered flow: URL routing → view → serializer → service → model → response. Authentication uses JWTs, conversations are membership-based, messages support editing and soft delete, and chat events are broadcast through Channels groups for live collaboration.
