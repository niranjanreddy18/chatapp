# Nexus Chat API Documentation

## Base URL

- Local development: `http://localhost:8000/api`
- Production: configured through `VITE_API_BASE_URL`.

## Authentication

Most endpoints require a Bearer JWT token in the `Authorization` header:

```http
Authorization: Bearer <access_token>
```

Successful responses follow this structure:

```json
{
  "success": true,
  "message": "...",
  "data": { ... }
}
```

Error responses follow this structure:

```json
{
  "success": false,
  "message": "...",
  "errors": { ... }
}
```

## Endpoints

### 1. Register

- Method: `POST`
- URL: `/api/auth/register/`
- Authentication: None
- Request body:
  - `username` (string)
  - `email` (string)
  - `password` (string)
  - `confirm_password` (string)
- Success response:
  - `user`: registered user data

### 2. Login

- Method: `POST`
- URL: `/api/auth/login/`
- Authentication: None
- Request body:
  - `username_or_email` (string)
  - `password` (string)
- Success response:
  - `access`: JWT access token
  - `refresh`: JWT refresh token
  - `user`: user details

### 3. Logout

- Method: `POST`
- URL: `/api/auth/logout/`
- Authentication: Bearer JWT
- Request body:
  - `refresh` (string)
- Success response: confirmation message

### 4. Refresh token

- Method: `POST`
- URL: `/api/auth/refresh/`
- Authentication: None
- Request body:
  - `refresh` (string)
- Success response:
  - `access`: new access token

### 5. Current user

- Method: `GET`
- URL: `/api/auth/me/`
- Authentication: Bearer JWT
- Response data: current user details

### 6. User profile

- Method: `GET`
- URL: `/api/profile/`
- Authentication: Bearer JWT
- Response data: profile fields

- Method: `PUT`
- URL: `/api/profile/`
- Authentication: Bearer JWT
- Request body (partial update):
  - `avatar` (file)
  - `bio` (string)
  - `status_message` (string)

### 7. User list

- Method: `GET`
- URL: `/api/users/`
- Authentication: Bearer JWT
- Query params:
  - `search` (optional)
- Response data: list of users excluding current user

### 8. Create private conversation

- Method: `POST`
- URL: `/api/conversations/private/`
- Authentication: Bearer JWT
- Request body:
  - `user_id` (integer)
- Success response: conversation object

### 9. Create group conversation

- Method: `POST`
- URL: `/api/conversations/group/`
- Authentication: Bearer JWT
- Request body:
  - `name` (string)
  - `member_ids` (list of integers)
- Success response: conversation object

### 10. Conversation list

- Method: `GET`
- URL: `/api/conversations/`
- Authentication: Bearer JWT
- Response data: conversation summaries with member counts

### 11. Conversation detail

- Method: `GET`
- URL: `/api/conversations/<id>/`
- Authentication: Bearer JWT
- Response data: conversation details with memberships

### 12. Send message

- Method: `POST`
- URL: `/api/messages/`
- Authentication: Bearer JWT
- Request body:
  - `conversation_id` (integer)
  - `content` (string)
  - `reply_to` (integer, optional)
  - `message_type` (string, optional)
- Success response: serialized message

### 13. List messages

- Method: `GET`
- URL: `/api/messages/<conversation_id>/`
- Authentication: Bearer JWT
- Response: paginated messages oldest first

### 14. Edit message

- Method: `PUT`
- URL: `/api/messages/<message_id>/edit/`
- Authentication: Bearer JWT
- Request body:
  - `content` (string)
- Success response: updated message

### 15. Delete message

- Method: `DELETE`
- URL: `/api/messages/<message_id>/delete/`
- Authentication: Bearer JWT
- Success response: soft-deleted message

### 16. Read status

- Method: `GET`
- URL: `/api/messages/<message_id>/read-status/`
- Authentication: Bearer JWT
- Response data: list of users who have read the message

### 17. Upload attachment

- Method: `POST`
- URL: `/api/messages/upload/`
- Authentication: Bearer JWT
- Content type: `multipart/form-data`
- Request fields:
  - `file`
  - `message_id` (integer)
- Success response: attachment object

## Error handling

Typical error responses include:

- `400 Bad Request` for validation failures.
- `401 Unauthorized` for missing or invalid JWTs.
- `403 Forbidden` for permission violations.
- `404 Not Found` for missing resources.

Example payload:

```json
{
  "success": false,
  "message": "Invalid credentials",
  "errors": {}
}
```
