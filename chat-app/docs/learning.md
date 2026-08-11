# Nexus Chat Learning Summary

## Concepts learned

- Full-stack architecture with separate frontend and backend layers.
- Building a REST API with Django REST Framework.
- Real-time communication with Django Channels and WebSockets.
- JWT authentication and token refresh flows.
- Environment-driven configuration for production.
- Static asset serving using `whitenoise`.
- Docker Compose orchestration for development.

## Architectural decisions

- **React + Vite**: chosen for fast development builds and modern frontend patterns.
- **Django REST Framework**: used for clean API serialization and validation.
- **Django Channels**: added real-time chat support without changing the main backend.
- **PostgreSQL**: selected as the production-grade relational database.
- **Redis**: used for WebSocket channel layer and presence coordination.

## Why these decisions were chosen

- Separate frontend and backend enable clear API contracts and easier deployment.
- DRF provides serializer-driven validation and reusable API patterns.
- WebSockets are required for typing indicators and live message broadcasts.
- PostgreSQL is more reliable than SQLite for concurrent production use.
- Redis is the standard channel layer backend for Django Channels.

## Alternative approaches

- Use Next.js for server-side rendering instead of Vite.
- Use socket.io or a managed real-time service instead of Django Channels.
- Store auth tokens in secure cookies instead of `localStorage`.
- Implement GraphQL instead of REST for more flexible client queries.

## Lessons learned

- Keeping business logic in services simplifies views and improves testability.
- Clear API response envelopes make frontend error handling predictable.
- Environment examples are essential for a deployable repo.
- Real-time messaging requires both connection auth and membership validation.
- Deployment configuration is as important as application features for portfolio readiness.
