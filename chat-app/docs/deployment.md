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

- `backend`: Django + Daphne ASGI / WebSockets.
- `frontend`: Vite preview server.
- `db`: PostgreSQL.

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
daphne -b 0.0.0.0 -p $PORT config.asgi:application
```

### Required environment variables

- `SECRET_KEY`
- `DEBUG=False`
- `ALLOWED_HOSTS` (e.g. `your-app.onrender.com`)
- `CORS_ALLOWED_ORIGINS` (e.g. `https://your-frontend.vercel.app`)
- `CSRF_TRUSTED_ORIGINS` (e.g. `https://your-frontend.vercel.app`)
- `DATABASE_URL` (PostgreSQL connection string)
- `SECURE_SSL_REDIRECT=True`
- `SECURE_HSTS_SECONDS=31536000`
- `SESSION_COOKIE_SECURE=True`
- `CSRF_COOKIE_SECURE=True`

---

## Render Cold-Start Mitigation

### Problem
Render's free web services spin down (sleep) after **15 minutes of inactivity**. When a user subsequently visits the application, the web service must cold-start from disk, introducing a 30–60 second latency spike on the initial request.

### Architecture: External Pinging
To keep the backend warm without introducing complex internal schedulers, infinite threading loops, or worker infrastructure, periodic requests are handled **externally**:

```text
External Uptime Scheduler (e.g. cron-job.org / UptimeRobot)
        |
        | GET https://<backend-domain>/api/health/ (every 10–14 mins)
        v
Render Django Web Service
        |
        v
HTTP 200 {"status": "ok"} (sub-millisecond, zero database overhead)
```

### Endpoint Details
- **URL**: `https://<backend-domain>/api/health/`
- **Method**: `GET`
- **Authentication**: None (publicly accessible)
- **Response**: `{"status": "ok"}`
- **Overhead**: Pure JSON, zero database queries, zero external network calls.

### Recommended Configuration
Configure a free external uptime monitor or cron service such as:
1. **[cron-job.org](https://cron-job.org)** (Recommended, 100% free):
   - **Target URL**: `https://<backend-domain>/api/health/`
   - **Method**: `GET`
   - **Schedule**: Every `12` minutes (or every `10` to `14` minutes).
   - **Active Window** (Optional): Limit to business/daytime hours (e.g., 08:00–22:00 UTC) to conserve monthly free hours.
2. **[UptimeRobot](https://uptimerobot.com)**:
   - **Monitor Type**: HTTP(s)
   - **Target URL**: `https://<backend-domain>/api/health/`
   - **Monitoring Interval**: 10–15 minutes.

### Platform Limitations & Considerations
> [!NOTE]
> - **Monthly Free Hours Cap**: Render accounts receive 750 free instance hours per month across all free services. Keeping a single service running 24/7 utilizes ~720–744 hours per month. If multiple free services run under the same account, consider scheduling the pinger only during daytime/demo hours to avoid exhausting monthly free hours.
> - **Not a 100% Zero Cold-Start Guarantee**: While periodic external traffic mitigates inactivity-based sleep, hosting platforms periodically restart, deploy, and relocate free containers regardless of incoming traffic. Occasional brief cold starts may still occur after platform updates.

---

## Vercel frontend deployment

### Build command

```bash
npm install && npm run build
```

### Output directory

- `dist`

### Environment variables

- `VITE_API_BASE_URL`: `https://<backend-domain>/api`
- `VITE_WS_BASE_URL`: `wss://<backend-domain>`

## PostgreSQL

- The backend uses `DATABASE_URL` for database configuration.
- Example connection string:
  - `postgres://postgres:postgres@db:5432/nexus_chat_db`
- Production PostgreSQL should be provisioned as a managed database.

## Production configuration

- Debug disabled (`DEBUG=False`).
- Static files served via `whitenoise`.
- Support for ASGI/WebSocket traffic via Daphne.
- Strong security headers enabled.
- PostgreSQL configured through `DATABASE_URL`.
- WebSocket events use the in-memory Django Channels layer and are limited to a single backend process.
