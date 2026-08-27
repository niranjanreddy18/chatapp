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
                'password': 'A7!giraffe-breeze',
                'confirm_password': 'A7!giraffe-breeze',
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
            password='A7!giraffe-breeze',
        )

        response = self.client.post(
            reverse('accounts:login'),
            {
                'username_or_email': 'loginer',
                'password': 'A7!giraffe-breeze',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['success'])
        self.assertIn('access', response.data['data'])
        self.assertIn('refresh', response.data['data'])

    def test_register_rejects_django_invalid_passwords(self):
        base = {'username': 'alex', 'email': 'alex@example.com', 'confirm_password': 'alex12345'}
        for password in ('short', 'password', 'alex12345'):
            payload = {**base, 'password': password, 'confirm_password': password}
            response = self.client.post(reverse('accounts:register'), payload, format='json')
            self.assertEqual(response.status_code, 400)

    def test_register_rejects_mismatched_confirmation(self):
        response = self.client.post(reverse('accounts:register'), {
            'username': 'different', 'email': 'different@example.com',
            'password': 'Correct-Horse-9', 'confirm_password': 'not-the-same',
        }, format='json')
        self.assertEqual(response.status_code, 400)
