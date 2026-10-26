# Nexus Chat

Nexus Chat is a full-stack real-time messaging application built with a React + Vite frontend and a Django backend. The project focuses on secure authentication, private and group conversations, message lifecycle management, and live updates through WebSockets.

The application is organized as a monorepo with a separate frontend and backend, each designed to be deployed independently while sharing the same domain model and API contract.

## Overview

This project includes:

- User registration, login, logout, and JWT-based authentication
- Profile management with avatar, bio, and status information
- User listing and search
- Private and group conversation creation
- Real-time chat using Django Channels
- Message send, edit, delete, reply, and read-receipt tracking
- File attachment uploads with Cloudinary storage
- Conversation deletion and full chat clearing
- Responsive user interface for chat, profile, and settings pages

## Tech Stack

### Frontend
- React 19
- Vite
- React Router
- Axios for REST requests
- TanStack React Query
- Tailwind-style component UI
- WebSocket client for live updates

### Backend
- Django 5
- Django REST Framework
- Django Channels
- JWT authentication via Simple JWT
- PostgreSQL-ready configuration
- Cloudinary media storage
- Whitenoise for static files

## Project Structure

```text
chat-app/
├── backend/
│   ├── apps/
│   │   ├── accounts/
│   │   ├── chats/
│   │   ├── messages/
│   │   ├── notifications/
│   │   ├── users/
│   │   └── common/
│   ├── config/
│   ├── manage.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   ├── package.json
│   ├── vite.config.js
│   ├── Dockerfile
│   └── .env.example
├── docs/
│   ├── api.md
│   ├── architecture.md
│   ├── database.md
│   └── ...
├── docker-compose.yml
├── README.md
└── .gitignore
```

## Key Features

### Authentication and user accounts
- Registration with username, email, and password validation
- Login via username or email with JWT issuance
- Refresh token rotation and logout token blacklist support
- Current-user endpoint and authenticated access control

### Profile management
- One-to-one user profile model with avatar, bio, and status message
- Online/offline presence tracking
- Last seen timestamps

### Conversation system
- Private conversation creation between two users
- Group conversation creation with multiple members
- Active membership checks and conversation-level access control
- Conversation deletion that deactivates only the current user membership
- Chat-clearing support that hides prior messages without deleting the conversation

### Messaging features
- Text messages with reply-to support
- Message editing and soft-delete behavior
- Read receipts per message and per-user status
- Typing indicators in live chat
- Attachment uploads for images, documents, audio, and video
- Ordered conversation history and paginated message loading

### Real-time communication
- WebSocket connection per conversation
- Broadcasts for message creation, edits, deletes, read events, and presence updates
- Django Channels in-memory channel layer for WebSocket event delivery

## Local Development

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL (recommended for production parity)
- Docker Desktop (for the optional full-stack Compose setup)

### Backend setup

From the `backend/` directory:

```bash
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

The backend uses environment variables such as:

```bash
SECRET_KEY=your-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
CSRF_TRUSTED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
DATABASE_URL=postgresql://postgres@localhost:5432/nexus_chat_db
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

If `DATABASE_URL` is omitted, the app falls back to a local SQLite database. WebSocket events use Django Channels' in-memory layer. This supports the current single-process setup; events are not shared across multiple backend processes.

### Frontend setup

From the `frontend/` directory:

```bash
npm install
npm run dev
```

Set the frontend variables in a `.env` file:

```bash
VITE_API_BASE_URL=http://localhost:8000/api
VITE_WS_BASE_URL=ws://localhost:8000
```

The example file is available at `frontend/.env.example`.

## Docker Setup

The repository includes a Docker Compose configuration for the full stack:

```bash
docker compose up --build
```

This starts:

- `backend`: Django + Daphne ASGI server
- `frontend`: Vite preview container
- `db`: PostgreSQL

## Deployment Notes

The project is organized for deployment to:

- Frontend: Vercel
- Backend: Render
- Database: PostgreSQL

The Django configuration includes static file serving via Whitenoise and environment-based HTTP security settings. The current in-memory channel layer is intended for a single backend process and does not provide cross-process WebSocket coordination.

## Documentation

Additional project documentation is available in the `docs/` directory:

- `docs/api.md` — API contract and endpoints
- `docs/architecture.md` — system design and component structure
- `docs/database.md` — relational schema and entity relationships
- `docs/deployment.md` — deployment guidance
- `docs/websocket.md` — live messaging flow

## Notes

This repository is a working chat application prototype with a real backend/frontend split, production-oriented configuration, and live message delivery. It is designed to be extended for additional features such as notifications, richer user presence, stronger moderation controls, and broader media handling.
