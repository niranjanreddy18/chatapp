FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Ensure entrypoint is executable in the image (also set executable bit in git)
RUN chmod +x /app/entrypoint.sh || true

EXPOSE 8000

# Use the entrypoint to run migrations, collectstatic, and start Daphne
ENTRYPOINT ["/app/entrypoint.sh"]
