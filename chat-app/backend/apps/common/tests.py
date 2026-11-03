from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase


class HealthCheckAPITests(APITestCase):
    def test_health_check_returns_200_without_authentication(self):
        """
        Verify that GET /api/health/ is publicly reachable without credentials,
        returns HTTP 200, responds with application/json, and returns {'status': 'ok'}.
        """
        url = reverse('health_check')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('application/json', response['Content-Type'])
        self.assertEqual(response.json(), {'status': 'ok'})
        self.assertEqual(response.data, {'status': 'ok'})

    def test_health_check_via_direct_path(self):
        """
        Verify that the exact path /api/health/ works as expected.
        """
        response = self.client.get('/api/health/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), {'status': 'ok'})
