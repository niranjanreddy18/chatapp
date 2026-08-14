"""
ASGI config for config project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.0/howto/deployment/asgi/
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

application = get_asgi_application()

from config.routing import application as channels_application

async def application(scope, receive, send):
    print(
        "🔥 ASGI BOUNDARY REACHED:",
        "type=", scope.get("type"),
        "path=", scope.get("path"),
    )

    await channels_application(scope, receive, send)
