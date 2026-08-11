from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


class ProfileAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='alice', email='alice@example.com', password='password123')
        self.other_user = User.objects.create_user(username='bob', email='bob@example.com', password='password123')

    def authenticate(self, user):
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')

    def test_profile_is_created_for_new_user(self):
        self.assertTrue(hasattr(self.user, 'profile'))
        self.assertEqual(self.user.profile.user, self.user)

    def test_current_user_profile_endpoint_returns_profile(self):
        self.authenticate(self.user)
        response = self.client.get(reverse('profile'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['data']['username'], 'alice')
        self.assertEqual(response.data['data']['email'], 'alice@example.com')

    def test_profile_update_and_user_search_work(self):
        self.authenticate(self.user)
        response = self.client.put(
            reverse('profile'),
            {'bio': 'Hello from Django', 'status_message': 'Building cool apps'},
            format='multipart'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['data']['bio'], 'Hello from Django')
        self.assertEqual(response.data['data']['status_message'], 'Building cool apps')

        search_response = self.client.get(reverse('users'), {'search': 'bo'})
        self.assertEqual(search_response.status_code, status.HTTP_200_OK)
        self.assertEqual(search_response.data['data'][0]['username'], 'bob')
