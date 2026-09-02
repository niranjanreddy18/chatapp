/**
 * profile.js — Service for user profile endpoints.
 */

import api from './api';

/**
 * Fetch the current authenticated user's profile.
 * Returns { success, message, data: { id, username, email, avatar, bio, status_message, is_online, last_seen } }
 */
export async function getProfile() {
  const response = await api.get('/profile/');
  return response.data;
}

/**
 * Update the current authenticated user's profile.
 * Supports FormData (for avatar file uploads or avatar clearing) or JSON object.
 * Returns { success, message, data: { ...updatedProfile } }
 */
export async function updateProfile(data) {
  const isFormData = data instanceof FormData;
  const config = isFormData
    ? { headers: { 'Content-Type': 'multipart/form-data' } }
    : {};
  const response = await api.put('/profile/', data, config);
  return response.data;
}
