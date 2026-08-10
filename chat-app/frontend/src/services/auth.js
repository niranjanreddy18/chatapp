/**
 * auth.js — Centralized authentication API service for Nexus Chat.
 *
 * Uses a dedicated axios instance that does NOT carry the request/response
 * interceptors from api.js.  This prevents circular refresh loops: the
 * refresh, login, register, and logout calls never trigger another refresh.
 *
 * Token storage keys (isolated so they can later be moved to httpOnly cookies):
 *   localStorage['nexus_access_token']   – short-lived JWT access token
 *   localStorage['nexus_refresh_token']  – long-lived JWT refresh token
 */

import axios from 'axios';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

export const TOKEN_KEYS = Object.freeze({
  access: 'nexus_access_token',
  refresh: 'nexus_refresh_token',
});

// ---------------------------------------------------------------------------
// Bare axios instance — no interceptors attached here
// ---------------------------------------------------------------------------

const authAxios = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

export function getStoredAccessToken() {
  try {
    return localStorage.getItem(TOKEN_KEYS.access);
  } catch {
    return null;
  }
}

export function getStoredRefreshToken() {
  try {
    return localStorage.getItem(TOKEN_KEYS.refresh);
  } catch {
    return null;
  }
}

export function storeTokens({ access, refresh }) {
  try {
    if (access) localStorage.setItem(TOKEN_KEYS.access, access);
    if (refresh) localStorage.setItem(TOKEN_KEYS.refresh, refresh);
  } catch {
    // localStorage may be unavailable in some environments — fail silently
  }
}

export function clearTokens() {
  try {
    localStorage.removeItem(TOKEN_KEYS.access);
    localStorage.removeItem(TOKEN_KEYS.refresh);
  } catch {
    // fail silently
  }
}

// ---------------------------------------------------------------------------
// Auth API calls
// ---------------------------------------------------------------------------

/**
 * POST /api/auth/login/
 * Returns { success, message, data: { access, refresh, user } }
 */
export async function authLogin(usernameOrEmail, password) {
  const response = await authAxios.post('/auth/login/', {
    username_or_email: usernameOrEmail,
    password,
  });
  return response.data;
}

/**
 * POST /api/auth/register/
 * Returns { success, message, data: { user } }
 */
export async function authRegister(username, email, password, password2) {
  const response = await authAxios.post('/auth/register/', {
    username,
    email,
    password,
    confirm_password: password2,
  });
  return response.data;
}

/**
 * POST /api/auth/logout/
 * Blacklists the refresh token server-side.
 * Requires the access token in the Authorization header.
 */
export async function authLogout(accessToken, refreshToken) {
  const response = await authAxios.post(
    '/auth/logout/',
    { refresh: refreshToken },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return response.data;
}

/**
 * POST /api/auth/refresh/
 * Returns { access, refresh } (rotation is enabled on the backend).
 */
export async function authRefresh(refreshToken) {
  const response = await authAxios.post('/auth/refresh/', {
    refresh: refreshToken,
  });
  return response.data;
}

/**
 * GET /api/auth/me/
 * Returns { success, message, data: { id, username, email } }
 * Requires a valid access token.
 */
export async function authMe(accessToken) {
  const response = await authAxios.get('/auth/me/', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.data;
}

/**
 * Attempt a token refresh and persist the new token pair.
 * Returns the new access token string, or null on failure.
 */
export async function tryRefreshTokens() {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return null;

  try {
    const data = await authRefresh(refreshToken);
    // Simple JWT with ROTATE_REFRESH_TOKENS=True returns both tokens
    storeTokens({ access: data.access, refresh: data.refresh ?? refreshToken });
    return data.access;
  } catch {
    clearTokens();
    return null;
  }
}
