from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase


User = get_user_model()


class AuthAPITests(APITestCase):
    def test_register_user_creates_account(self):
        response = self.client.post(
            reverse('accounts:register'),
            {
                'username': 'tester',
                'email': 'tester@example.com',
                'password': 'strongpassword',
                'confirm_password': 'strongpassword',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data['success'])
        self.assertTrue(User.objects.filter(username='tester').exists())

    def test_login_returns_tokens_for_valid_credentials(self):
        User.objects.create_user(
            username='loginer',
            email='loginer@example.com',
            password='strongpassword',
        )

        response = self.client.post(
            reverse('accounts:login'),
            {
                'username_or_email': 'loginer',
                'password': 'strongpassword',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['success'])
        self.assertIn('access', response.data['data'])
        self.assertIn('refresh', response.data['data'])
