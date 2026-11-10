"""
views.py — Common / Shared Application Views
=============================================

Lightweight utility views shared across the application, including the
service health check endpoint used by external uptime monitors, load balancers,
and deployment orchestrators.
"""

from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthCheckView(APIView):
    """
    Lightweight, unauthenticated health-check endpoint.

    GET /api/health/

    Characteristics:
    - Returns HTTP 200 with {"status": "ok"}.
    - Requires no authentication or session.
    - Performs zero database queries or external API calls.
    - Exposes no environment variables, settings, or internal stack traces.
    - Uses JSONRenderer directly for sub-millisecond serialization.
    - Used by external pingers (e.g. cron-job.org, UptimeRobot) to mitigate
      cold starts on platforms with inactivity timeouts like Render.
    """

    authentication_classes = ()
    permission_classes = (AllowAny,)
    renderer_classes = (JSONRenderer,)

    def get(self, request, *args, **kwargs):
        print("✅ Health check successful")
        return Response({'status': 'ok'}, status=status.HTTP_200_OK)
