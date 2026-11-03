from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken


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

    def test_case_insensitive_username_and_email_uniqueness(self):
        User.objects.create_user(
            username='UniqueUser',
            email='unique@example.com',
            password='A7!giraffe-breeze',
        )
        res_username = self.client.post(reverse('accounts:register'), {
            'username': 'uniqueuser',
            'email': 'other@example.com',
            'password': 'A7!giraffe-breeze',
            'confirm_password': 'A7!giraffe-breeze',
        }, format='json')
        self.assertEqual(res_username.status_code, 400)
        self.assertIn('username', res_username.data['errors'])

        res_email = self.client.post(reverse('accounts:register'), {
            'username': 'anotheruser',
            'email': 'UNIQUE@EXAMPLE.COM',
            'password': 'A7!giraffe-breeze',
            'confirm_password': 'A7!giraffe-breeze',
        }, format='json')
        self.assertEqual(res_email.status_code, 400)
        self.assertIn('email', res_email.data['errors'])

    def test_logout_blacklists_refresh_token(self):
        user = User.objects.create_user(
            username='logoutuser',
            email='logout@example.com',
            password='A7!giraffe-breeze',
        )
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')

        response = self.client.post(
            reverse('accounts:logout'),
            {'refresh': str(refresh)},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['success'])

        # Using the same refresh token again must fail with 400
        second_response = self.client.post(
            reverse('accounts:logout'),
            {'refresh': str(refresh)},
            format='json',
        )
        self.assertEqual(second_response.status_code, 400)
        self.assertFalse(second_response.data['success'])

    def test_unauthenticated_me_returns_standard_error_envelope(self):
        response = self.client.get(reverse('accounts:me'))
        self.assertEqual(response.status_code, 401)
        self.assertFalse(response.data['success'])
        self.assertIn('message', response.data)
        self.assertIn('errors', response.data)
