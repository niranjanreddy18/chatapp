# Nexus Chat API Documentation

## Base URL

- Local development: `http://localhost:8000/api`
- Production: configured through `VITE_API_BASE_URL`.

## Authentication & Response Envelope

Protected endpoints require a Bearer JWT token in the `Authorization` header:

```http
Authorization: Bearer <access_token>
```

All API responses use a consistent JSON envelope.

**Success response:**
```json
{
  "success": true,
  "message": "...",
  "data": { ... }
}
```

**Error response:**
```json
{
  "success": false,
  "message": "...",
  "errors": { ... }
}
```

---

## Endpoints

### Authentication (`/api/auth/`)

#### 1. Register
- **Method:** `POST`
- **URL:** `/api/auth/register/`
- **Authentication:** None
- **Request body:**
  - `username` (string, required)
  - `email` (string, required)
  - `password` (string, required)
  - `confirm_password` (string, required)
- **Success response (`201 Created`):**
  - `user`: registered user object

#### 2. Login
- **Method:** `POST`
- **URL:** `/api/auth/login/`
- **Authentication:** None
- **Request body:**
  - `username_or_email` (string, required)
  - `password` (string, required)
- **Success response (`200 OK`):**
  - `access`: JWT access token
  - `refresh`: JWT refresh token
  - `user`: authenticated user details (including profile fields)

#### 3. Logout
- **Method:** `POST`
- **URL:** `/api/auth/logout/`
- **Authentication:** Bearer JWT
- **Request body:**
  - `refresh` (string, required) — refresh token to blacklist
- **Success response (`200 OK`):** confirmation message

#### 4. Refresh Token
- **Method:** `POST`
- **URL:** `/api/auth/refresh/`
- **Authentication:** None
- **Request body:**
  - `refresh` (string, required)
- **Success response (`200 OK`):**
  - `access`: new JWT access token
  - `refresh`: rotated JWT refresh token (when rotation is enabled)

#### 5. Current User
- **Method:** `GET`
- **URL:** `/api/auth/me/`
- **Authentication:** Bearer JWT
- **Success response (`200 OK`):** current user details (`id`, `username`, `email`, `avatar`, `bio`, `status_message`, `is_online`, `last_seen`, `date_joined`)

---

### Users & Profile (`/api/profile/`, `/api/users/`)

#### 6. Get / Update User Profile
- **Method:** `GET` | `PUT`
- **URL:** `/api/profile/`
- **Authentication:** Bearer JWT
- **Request body (`PUT`, `multipart/form-data` or `application/json`):**
  - `username` (string, optional, max 150 chars)
  - `avatar` (image file up to 5 MB, or `""` to clear avatar)
  - `bio` (string, optional, max 300 chars)
  - `status_message` (string, optional, max 100 chars)
- **Success response (`200 OK`):** updated profile object

#### 7. User Directory
- **Method:** `GET`
- **URL:** `/api/users/`
- **Authentication:** Bearer JWT
- **Query parameters:**
  - `search` (string, optional) — case-insensitive username filter
  - `exclude_existing` (`true` | `false`, optional) — when `true`, excludes users who already share an active private conversation with the requester
- **Success response (`200 OK`):** list of users

---

### Conversations (`/api/conversations/`)

#### 8. List Conversations
- **Method:** `GET`
- **URL:** `/api/conversations/`
- **Authentication:** Bearer JWT
- **Success response (`200 OK`):** list of active conversations for the current user, ordered by `updated_at` descending, including `member_count`, `unread_count`, and `members`

#### 9. Create or Get Private Conversation
- **Method:** `POST`
- **URL:** `/api/conversations/private/`
- **Authentication:** Bearer JWT
- **Request body:**
  - `user_id` (integer, required)
- **Success response (`201 Created` or `200 OK`):** private conversation object (reactivates membership if previously soft-deleted)

#### 10. Create Group Conversation
- **Method:** `POST`
- **URL:** `/api/conversations/group/`
- **Authentication:** Bearer JWT
- **Request body:**
  - `name` (string, required)
  - `member_ids` (array of integers, required, at least 2 distinct members)
- **Success response (`201 Created`):** group conversation object

#### 11. Conversation Detail
- **Method:** `GET`
- **URL:** `/api/conversations/<id>/`
- **Authentication:** Bearer JWT (must be an active member)
- **Success response (`200 OK`):** conversation details with memberships

#### 12. Mark Conversation as Read
- **Method:** `POST`
- **URL:** `/api/conversations/<id>/read/`
- **Authentication:** Bearer JWT (must be an active member)
- **Success response (`200 OK`):** `{ "conversation_id": <id>, "read_message_ids": [...] }`

#### 13. Delete Conversation (Soft Delete Membership)
- **Method:** `DELETE`
- **URL:** `/api/conversations/<id>/delete/`
- **Authentication:** Bearer JWT (must be an active member)
- **Success response (`200 OK`):** deactivates the requesting user's membership while preserving the conversation for other participants

#### 14. Clear Conversation Messages
- **Method:** `POST`
- **URL:** `/api/conversations/<id>/clear/`
- **Authentication:** Bearer JWT (must be an active member)
- **Success response (`200 OK`):** `{ "cleared_count": <int> }`

---

### Messages (`/api/messages/`)

#### 15. Send Message
- **Method:** `POST`
- **URL:** `/api/messages/`
- **Authentication:** Bearer JWT (must be an active conversation member)
- **Request body:**
  - `conversation_id` (integer, required)
  - `content` (string, required, 1–5000 chars)
  - `reply_to` (integer, optional)
  - `message_type` (`text` | `image` | `file` | `system`, optional, default `text`)
- **Success response (`201 Created`):** serialized message object

#### 16. List Conversation Messages (Paginated)
- **Method:** `GET`
- **URL:** `/api/messages/<conversation_id>/?page=<n>`
- **Authentication:** Bearer JWT (must be an active conversation member)
- **Success response (`200 OK`):** paginated message list (`count`, `next`, `previous`, `results`) ordered oldest first (20 per page)

#### 17. Edit Message
- **Method:** `PUT`
- **URL:** `/api/messages/<message_id>/edit/`
- **Authentication:** Bearer JWT (must be original sender)
- **Request body:**
  - `content` (string, required, 1–5000 chars)
- **Success response (`200 OK`):** updated message object (`is_edited: true`)

#### 18. Soft-Delete Message
- **Method:** `DELETE`
- **URL:** `/api/messages/<message_id>/delete/`
- **Authentication:** Bearer JWT (must be original sender)
- **Success response (`200 OK`):** soft-deleted message (`is_deleted: true`, `content: "This message was deleted."`)

#### 19. Permanently Remove Message
- **Method:** `DELETE`
- **URL:** `/api/messages/<message_id>/remove/`
- **Authentication:** Bearer JWT (must be original sender)
- **Success response (`200 OK`):** `{ "message_id": <id> }`

#### 20. Message Read Receipts
- **Method:** `GET`
- **URL:** `/api/messages/<message_id>/reads/`
- **Authentication:** Bearer JWT (must be an active conversation member)
- **Success response (`200 OK`):** `{ "message_id": <id>, "users": [{ "user_id": ..., "username": ..., "read_at": ... }] }`

#### 21. Upload Attachment
- **Method:** `POST`
- **URL:** `/api/messages/upload/`
- **Authentication:** Bearer JWT (must be original sender of `message_id`)
- **Content type:** `multipart/form-data`
- **Request fields:**
  - `file` (binary file, required, max 25 MB, must match allowed MIME types)
  - `message_id` (integer, required)
  - `upload_id` (UUID string, optional — client idempotency key for safe retries)
- **Success response (`201 Created`):** serialized attachment object

---

### System & Health (`/api/health/`)

#### 22. Health Check
- **Method:** `GET`
- **URL:** `/api/health/`
- **Authentication:** None (public)
- **Success response (`200 OK`):**
  ```json
  {
    "status": "ok"
  }
  ```
  A lightweight, zero-database health check endpoint intended for uptime monitors, load balancers, and external schedulers (e.g. cron-job.org, UptimeRobot) to mitigate cold starts on platforms with inactivity timeouts like Render.
