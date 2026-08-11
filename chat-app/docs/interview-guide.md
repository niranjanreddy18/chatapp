# Nexus Chat Interview Guide

## Overview

This guide contains interview questions and model answers that relate to Nexus Chat.
It is designed for technical interview preparation and for explaining the project to recruiters.

## Architecture

1. What are the main layers of Nexus Chat?
   - Answer: Frontend (React + Vite), backend (Django + DRF + Channels), database (PostgreSQL), and Redis.

2. Why separate frontend and backend?
   - Answer: It decouples UI from API, enables independent deployment, and makes the architecture more scalable.

3. How does the project support real-time chat?
   - Answer: Using Django Channels WebSockets with a `ChatConsumer` that joins conversation groups.

4. How are static assets served in production?
   - Answer: With `whitenoise` serving `staticfiles` for Django and Vercel serving the frontend bundle.

5. What environment patterns are used?
   - Answer: `.env` files for backend and Vite `VITE_` env variables for frontend.

## JWT

6. Why use JWT for authentication?
   - Answer: JWT enables stateless bearer authentication across REST and WebSocket transports.

7. How is token refresh handled?
   - Answer: With DRF SimpleJWT `refresh` endpoint and `access` token rotation.

8. How does the frontend store JWTs?
   - Answer: In `localStorage` for the prototype and uses it to set the `Authorization` header.

9. What are the security concerns with storing JWTs in localStorage?
   - Answer: LocalStorage is vulnerable to XSS; production should use secure HttpOnly cookies if possible.

10. What does token blacklisting achieve?
    - Answer: It invalidates refresh tokens after logout or rotation.

## REST

11. How do you design a REST endpoint for sending messages?
    - Answer: Use `POST /api/messages/` with a request body containing `conversation_id` and `content`.

12. Why use serializers in DRF?
    - Answer: Serializers validate input and shape output consistently.

13. How are error responses structured?
    - Answer: `{ success: false, message: ..., errors: ... }`.

14. What pattern is used for thin views?
    - Answer: Views delegate business logic to service modules.

15. How do you handle pagination?
    - Answer: The messages endpoint uses a paginated view with oldest-first ordering.

## WebSockets

16. How does the WebSocket consumer authenticate users?
    - Answer: It extracts `token` from the query string and validates it with SimpleJWT.

17. What event types does the chat consumer support?
    - Answer: `send_message`, `typing_start`, `typing_stop`, `read_message`, plus broadcast events.

18. Why use `group_send` for chat?
    - Answer: It broadcasts messages and presence updates to all conversation members.

19. How are typing indicators implemented?
    - Answer: With `typing_start` and `typing_stop` events broadcast to the group.

20. How is read receipt handled?
    - Answer: The client sends `read_message`, and the server saves a `MessageRead` row.

## Redis

21. Why use Redis with Django Channels?
    - Answer: Redis provides channel layer support for multi-process WebSocket coordination.

22. What does `CHANNEL_LAYERS` configure?
    - Answer: The backend transport used for inter-process messaging.

23. Is Redis required for local development?
    - Answer: Not strictly, but it is required for a production-like Channels setup.

24. What command configures Redis Cloud in production?
    - Answer: Use `REDIS_URL` environment variable.

25. How does Redis improve performance?
    - Answer: It enables real-time events and decouples message dispatch from HTTP request handling.

## Django

26. Why use Django REST Framework?
    - Answer: It simplifies API development with serializers and generic views.

27. What is `GenericAPIView`?
    - Answer: A base DRF view that provides serializer and request handling utilities.

28. What is `whitenoise` used for?
    - Answer: Serving static files from Django in production.

29. Why use `dj_database_url`?
    - Answer: It parses `DATABASE_URL` into Django database config.

30. How are permissions enforced?
    - Answer: With DRF permission classes and service-layer membership checks.

## React

31. What role does `AuthContext` play?
    - Answer: It manages auth state, token persistence, and login/logout actions.

32. Why use React Context for conversations and messages?
    - Answer: To share state and handlers across components without prop drilling.

33. How is the protected route implemented?
    - Answer: `ProtectedRoute` checks auth state and redirects unauthenticated users.

34. What is the purpose of `ErrorBoundary`?
    - Answer: To catch rendering errors and show a fallback UI.

35. How do you prevent infinite typing events?
    - Answer: The frontend only sends typing events when the user enters text and stops when cleared.

## Database

36. Why use PostgreSQL instead of SQLite in production?
    - Answer: PostgreSQL is more robust, supports concurrency, and is production-ready.

37. How do message read receipts relate to normalization?
    - Answer: `MessageRead` is separate to avoid repeated user fields in the message row.

38. What is the purpose of `ConversationMember`?
    - Answer: It models many-to-many membership plus user roles in conversations.

39. Why does `Message` use a `reply_to` self-reference?
    - Answer: It models threading and reply relationships without duplicating the message.

40. What are the advantages of soft-deleting messages?
    - Answer: It preserves history and thread integrity while hiding deleted content.

## Deployment

41. Why choose Vercel for the frontend?
    - Answer: Vercel is optimized for static frontend deployment with zero-config builds.

42. What makes Render suitable for the backend?
    - Answer: Render supports Python services and WebSockets in a managed environment.

43. How do you configure environment variables for production?
    - Answer: Use separate Vercel and Render environment variable settings, never commit secrets.

44. What is the build command for Render?
    - Answer: `pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate`

45. How does Docker help with deployment?
    - Answer: It standardizes the local environment and supports Compose orchestration.

## Performance

46. How is query performance optimized?
    - Answer: The message list uses `select_related` and `prefetch_related`.

47. Why is `CompressedManifestStaticFilesStorage` useful?
    - Answer: It compresses assets and caches file names for better browser performance.

48. How can the app scale WebSocket traffic?
    - Answer: Redis channel layer and multiple ASGI workers support scaling.

49. What is the tradeoff of strong security headers?
    - Answer: They may require careful CORS and proxy configuration but improve protection.

50. How would you measure production performance?
    - Answer: Monitor API latency, WebSocket throughput, DB query time, and frontend bundle size.
