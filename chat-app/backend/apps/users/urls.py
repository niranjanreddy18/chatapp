from django.urls import path

from .views import ProfileView, UserListView

urlpatterns = [
    path('profile/', ProfileView.as_view(), name='profile'),
    path('users/', UserListView.as_view(), name='users'),
]
