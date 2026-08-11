#!/bin/sh
set -e

# Move to app directory (Dockerfile uses WORKDIR /app)
cd /app || exit 1

# Use Render's PORT if provided, otherwise default to 8000
PORT=${PORT:-8000}

echo "[entrypoint] Running database migrations..."
python manage.py migrate --noinput

# Collect static files only if not already present to avoid double-run
if [ -d "staticfiles" ]; then
  if [ "$(ls -A staticfiles)" ]; then
    echo "[entrypoint] staticfiles directory is not empty — skipping collectstatic"
  else
    echo "[entrypoint] staticfiles is empty — running collectstatic"
    python manage.py collectstatic --noinput
  fi
else
  echo "[entrypoint] staticfiles directory missing — creating and running collectstatic"
  mkdir -p staticfiles
  python manage.py collectstatic --noinput
fi

echo "[entrypoint] Starting Daphne on 0.0.0.0:${PORT}"
exec daphne -b 0.0.0.0 -p "$PORT" config.asgi:application
