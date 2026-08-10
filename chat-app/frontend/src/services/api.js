/**
 * api.js — Authenticated Axios instance for Nexus Chat.
 *
 * Responsibilities:
 *   1. Attach the current access token to every request as a Bearer header.
 *   2. On 401: attempt a single token refresh, replay the original request.
 *   3. If refresh fails: clear all tokens, dispatch auth:expired, bail out.
 *   4. Never refresh if the failing request IS the refresh endpoint (prevents loops).
 *
 * All token storage is delegated to services/auth.js so the keys stay in
 * one place and can later be migrated to httpOnly cookies with minimal effort.
 */

import axios from 'axios';
import {
  clearTokens,
  getStoredAccessToken,
  getStoredRefreshToken,
  tryRefreshTokens,
} from './auth';

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  timeout: 10000,
});

// ---------------------------------------------------------------------------
// Request interceptor — attach access token
// ---------------------------------------------------------------------------

api.interceptors.request.use((config) => {
  const token = getStoredAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---------------------------------------------------------------------------
// Response interceptor — refresh token on 401
// ---------------------------------------------------------------------------

/** Track whether a refresh is already in-flight to prevent parallel loops. */
let isRefreshing = false;

/**
 * Queue of { resolve, reject } callbacks for requests that arrived while a
 * refresh was already in flight.  On refresh success they are replayed; on
 * failure they are rejected.
 */
let pendingQueue = [];

function processPendingQueue(error, newAccessToken = null) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(newAccessToken);
    }
  });
  pendingQueue = [];
}

api.interceptors.response.use(
  // Pass successful responses straight through
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    const is401 = error.response?.status === 401;
    const isRefreshEndpoint = originalRequest?.url?.includes('/auth/refresh/');
    const alreadyRetried = originalRequest?._retried;

    // Only attempt refresh for 401s on non-refresh endpoints that haven't been retried
    if (!is401 || isRefreshEndpoint || alreadyRetried) {
      return Promise.reject(error);
    }

    // If no refresh token is available, dispatch expiry immediately
    if (!getStoredRefreshToken()) {
      _dispatchAuthExpired();
      return Promise.reject(error);
    }

    // If a refresh is already in-flight, queue this request to replay later
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      }).then((newToken) => {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        originalRequest._retried = true;
        return api(originalRequest);
      });
    }

    // Start the refresh flow
    isRefreshing = true;
    originalRequest._retried = true;

    try {
      const newAccessToken = await tryRefreshTokens();

      if (!newAccessToken) {
        throw new Error('Refresh returned no access token');
      }

      // Update the Authorization header for the retried request
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

      // Replay all queued requests with the new token
      processPendingQueue(null, newAccessToken);

      return api(originalRequest);
    } catch (refreshError) {
      processPendingQueue(refreshError, null);
      clearTokens();
      _dispatchAuthExpired();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _dispatchAuthExpired() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('auth:expired'));
  }
}

export default api;
