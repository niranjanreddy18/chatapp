# Nexus Chat Deployment Guide

## Overview

This guide describes how to deploy Nexus Chat locally with Docker and to production using Render and Vercel.

## Docker

### Requirements

- Docker Desktop
- Docker Compose

### Local development

From the repository root:

```bash
docker compose up --build
```

### Services

- `backend`: Django + Gunicorn + Daphne for ASGI/WebSockets.
- `frontend`: Vite preview server.
- `db`: PostgreSQL.
- `redis`: Redis.

### Notes

- The backend service mounts `backend/media` and `backend/staticfiles` for persistence.
- The frontend service uses local environment values for API and WebSocket URLs.

## Render backend deployment

### Build Command

```bash
cd backend && pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate
```

### Start Command

```bash
gunicorn config.asgi:application -k uvicorn.workers.UvicornWorker -b 0.0.0.0:$PORT --workers 2 --log-level info
```

### Required environment variables

- `SECRET_KEY`
- `DEBUG=False`
- `ALLOWED_HOSTS`
- `CORS_ALLOWED_ORIGINS`
- `CSRF_TRUSTED_ORIGINS`
- `DATABASE_URL`
- `REDIS_URL`
- `SECURE_SSL_REDIRECT=True`
- `SECURE_HSTS_SECONDS=31536000`
- `SESSION_COOKIE_SECURE=True`
- `CSRF_COOKIE_SECURE=True`

## Vercel frontend deployment

### Build command

```bash
npm install && npm run build
```

### Output directory

- `dist`

### Environment variables

- `VITE_API_BASE_URL`
- `VITE_WS_BASE_URL`

## Redis Cloud

- Use `REDIS_URL` to configure the connection string.
- The backend uses Redis for Django Channels when `REDIS_URL` is set.
- For local Docker, Redis is available at `redis://redis:6379/0`.

## PostgreSQL

- The backend uses `DATABASE_URL` for database configuration.
- Example connection string:
  - `postgres://postgres:postgres@db:5432/nexus_chat_db`
- Production PostgreSQL should be provisioned as a managed database.

## Environment variables

### Frontend

- `VITE_API_BASE_URL`: backend REST API base URL
- `VITE_WS_BASE_URL`: backend WebSocket base URL

### Backend

- `SECRET_KEY`
- `DEBUG`
- `ALLOWED_HOSTS`
- `CORS_ALLOWED_ORIGINS`
- `CSRF_TRUSTED_ORIGINS`
- `DATABASE_URL`
- `REDIS_URL`
- `SECURE_SSL_REDIRECT`
- `SECURE_HSTS_SECONDS`
- `SESSION_COOKIE_SECURE`
- `CSRF_COOKIE_SECURE`

## Production configuration

- Debug disabled (`DEBUG=False`).
- Static files served via `whitenoise`.
- Support for ASGI/WebSocket traffic.
- Strong security headers enabled.
- PostgreSQL and Redis production connections configured through environment variables.
