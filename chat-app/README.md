# Nexus Chat

## Overview

Nexus Chat is a full-stack chat prototype with a React + Vite frontend and a Django backend using Django REST Framework and Django Channels.

This repository contains a frontend app in `frontend/` and a backend app in `backend/`.

## Deployment Targets

- Frontend: Vercel
- Backend: Render
- Database: PostgreSQL
- Redis: Redis Cloud

## Environment Setup

### Frontend

1. Copy environment example:
   ```bash
   cp frontend/.env.example frontend/.env
   ```
2. Update the values:
   - `VITE_API_BASE_URL` to the backend API base URL
   - `VITE_WS_BASE_URL` to the backend websocket URL
3. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```
4. Run locally:
   ```bash
   npm run dev
   ```

### Backend

1. Create a `.env` file in `backend/`:
   ```bash
   cp backend/.env.example backend/.env
   ```
2. Update environment variables:
   - `SECRET_KEY`
   - `DEBUG=False`
   - `ALLOWED_HOSTS`
   - `CORS_ALLOWED_ORIGINS`
   - `CSRF_TRUSTED_ORIGINS`
   - `DATABASE_URL`
   - `REDIS_URL`
3. Install dependencies:
   ```bash
   cd backend
   python -m venv .venv
   .\.venv\Scripts\activate
   pip install -r requirements.txt
   ```
4. Apply database migrations:
   ```bash
   python manage.py migrate
   ```
5. Run locally:
   ```bash
   python manage.py runserver
   ```

## Docker Setup

### Build and run containers

```bash
docker compose up --build
```

### Services

- `backend`: Django + Daphne
- `frontend`: Vite preview server
- `db`: PostgreSQL
- `redis`: Redis

## Render Backend Deployment

### Build Command

```bash
cd backend && pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate
```

### Start Command

```bash
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

### Required Environment Variables

- `SECRET_KEY`
- `DEBUG=False`
- `ALLOWED_HOSTS`
- `CORS_ALLOWED_ORIGINS`
- `CSRF_TRUSTED_ORIGINS`
- `DATABASE_URL`
- `REDIS_URL`
- `SECURE_SSL_REDIRECT=True`
- `SECURE_HSTS_SECONDS=31536000`

## Vercel Frontend Deployment

### Build Command

```bash
npm install && npm run build
```

### Output Directory

`dist`

### Required Environment Variables

- `VITE_API_BASE_URL`
- `VITE_WS_BASE_URL`

## Production Notes

- The backend uses `whitenoise` for static file serving.
- PostgreSQL is configured through `DATABASE_URL`.
- Redis is configured through `REDIS_URL`.
- `DEBUG` is disabled in production.
- Error handling uses a React error boundary for a user-friendly fallback.
