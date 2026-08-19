"""
ASGI config for config project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.0/howto/deployment/asgi/
"""

import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Bootstrap Django apps/settings before importing anything that needs them.
from django.core.asgi import get_asgi_application  # noqa: E402
get_asgi_application()

# Import the Channels ProtocolTypeRouter that handles both HTTP and WebSocket.
# This must come *after* the Django setup above.
from config.routing import application  # noqa: E402, F401
