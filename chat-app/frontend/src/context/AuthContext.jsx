/**
 * AuthContext.jsx — Real JWT authentication context for Nexus Chat.
 *
 * Replaces the previous dummy/DEMO_USER implementation with actual Django
 * REST Framework calls.
 *
 * Session restore flow on mount:
 *   1. Read stored access + refresh tokens from localStorage.
 *   2. Call GET /api/auth/me/ with the stored access token.
 *   3. If that succeeds → authenticated. Done.
 *   4. If it fails with 401 and a refresh token exists → call /api/auth/refresh/.
 *   5. If refresh succeeds → store new tokens, call me/ again, authenticated.
 *   6. If all fail → clear tokens, unauthenticated.
 *   7. Set authReady = true once the flow finishes (regardless of outcome).
 *
 * Context value:
 *   user           – { id, username, email } from the backend, or null
 *   token          – accessToken alias (kept for ConversationContext / MessageContext compat)
 *   accessToken    – current JWT access token string
 *   refreshToken   – current JWT refresh token string
 *   authReady      – true once the initial session restore attempt has finished
 *   isAuthenticated
 *   login(usernameOrEmail, password)  → Promise<user>
 *   register(username, email, password, password2) → Promise<user>
 *   logout()
 *   refreshAuthState() → Promise<void>
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { disconnect as disconnectSocket } from '../services/websocket';
import {
  authLogin,
  authLogout,
  authMe,
  authRegister,
  clearTokens,
  getStoredAccessToken,
  getStoredRefreshToken,
  storeTokens,
  tryRefreshTokens,
} from '../services/auth';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser]               = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [authReady, setAuthReady]     = useState(false);

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /** Persist tokens to state + localStorage. */
  const _applyTokens = useCallback(({ access, refresh }) => {
    storeTokens({ access, refresh });
    setAccessToken(access);
    if (refresh) setRefreshToken(refresh);
  }, []);

  /** Wipe all auth state and tokens. */
  const _clearAll = useCallback(() => {
    clearTokens();
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
  }, []);

  // -------------------------------------------------------------------------
  // Session restore on mount
  // -------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const storedAccess  = getStoredAccessToken();
      const storedRefresh = getStoredRefreshToken();

      // No tokens at all → unauthenticated immediately
      if (!storedAccess && !storedRefresh) {
        setAuthReady(true);
        return;
      }

      // Try the stored access token first
      if (storedAccess) {
        try {
          const meResponse = await authMe(storedAccess);
          if (!cancelled) {
            setAccessToken(storedAccess);
            setRefreshToken(storedRefresh);
            setUser(meResponse.data);
            setAuthReady(true);
            return;
          }
        } catch (err) {
          // Access token expired or invalid — fall through to refresh
          if (err?.response?.status !== 401) {
            // Non-401 error (network, server error) — abort cleanly
            if (!cancelled) {
              _clearAll();
              setAuthReady(true);
            }
            return;
          }
        }
      }

      // Access token is gone/expired — try refreshing
      if (storedRefresh) {
        const newAccessToken = await tryRefreshTokens();
        if (newAccessToken && !cancelled) {
          try {
            const meResponse = await authMe(newAccessToken);
            if (!cancelled) {
              setAccessToken(newAccessToken);
              setRefreshToken(getStoredRefreshToken()); // updated by tryRefreshTokens
              setUser(meResponse.data);
              setAuthReady(true);
              return;
            }
          } catch {
            // me/ failed even after a fresh token — clear everything
          }
        }
      }

      // All recovery failed
      if (!cancelled) {
        _clearAll();
        setAuthReady(true);
      }
    }

    restoreSession();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------------------------------------
  // Global auth event listeners (dispatched by api.js on refresh failure)
  // -------------------------------------------------------------------------

  useEffect(() => {
    const handleAuthEvent = () => {
      disconnectSocket(true);
      _clearAll();
    };

    window.addEventListener('auth:logout', handleAuthEvent);
    window.addEventListener('auth:expired', handleAuthEvent);

    return () => {
      window.removeEventListener('auth:logout', handleAuthEvent);
      window.removeEventListener('auth:expired', handleAuthEvent);
    };
  }, [_clearAll]);

  // -------------------------------------------------------------------------
  // Route protection — redirect unauthenticated users once authReady
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!authReady) return;

    const isPublicRoute =
      location.pathname === '/login' || location.pathname === '/register';

    if (!accessToken && !isPublicRoute) {
      navigate('/login', { replace: true });
    }
  }, [authReady, accessToken, location.pathname, navigate]);

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * login(usernameOrEmail, password)
   * Calls the backend, stores tokens, sets the real user.
   * Returns the user object so the Login page can navigate after success.
   * Throws an error with a descriptive message on failure.
   */
  const login = useCallback(async (usernameOrEmail, password) => {
    const response = await authLogin(usernameOrEmail, password);
    const { access, refresh, user: backendUser } = response.data;

    _applyTokens({ access, refresh });
    setUser(backendUser);
    return backendUser;
  }, [_applyTokens]);

  /**
   * register(username, email, password, password2)
   * Registers the user then automatically logs them in so they arrive
   * authenticated — consistent with the UX of the existing app.
   * Returns the user object on success.
   * Throws an error with a descriptive message on failure.
   */
  const register = useCallback(async (username, email, password, password2) => {
    // Create the account first
    await authRegister(username, email, password, password2);

    // Auto-login with the same credentials
    const loginResponse = await authLogin(username, password);
    const { access, refresh, user: backendUser } = loginResponse.data;

    _applyTokens({ access, refresh });
    setUser(backendUser);
    return backendUser;
  }, [_applyTokens]);

  /**
   * logout()
   * Blacklists the refresh token server-side (best-effort), clears local
   * state, disconnects the WebSocket, and navigates to /login.
   */
  const logout = useCallback(async () => {
    const currentAccess  = getStoredAccessToken();
    const currentRefresh = getStoredRefreshToken();

    // Disconnect WebSocket before clearing tokens
    disconnectSocket(true);

    // Best-effort server-side blacklist — don't await or block navigation
    if (currentAccess && currentRefresh) {
      authLogout(currentAccess, currentRefresh).catch(() => {
        // Ignore — tokens are cleared locally regardless
      });
    }

    _clearAll();

    if (location.pathname !== '/login' && location.pathname !== '/register') {
      navigate('/login', { replace: true });
    }
  }, [_clearAll, location.pathname, navigate]);

  /**
   * refreshAuthState()
   * Re-fetches the current user from /api/auth/me/ and updates the context.
   * Useful after profile updates.
   */
  const refreshAuthState = useCallback(async () => {
    const token = getStoredAccessToken();
    if (!token) return;

    try {
      const response = await authMe(token);
      setUser(response.data);
    } catch {
      // If me/ fails, let the existing refresh interceptor handle it
    }
  }, []);

  // -------------------------------------------------------------------------
  // Context value
  // -------------------------------------------------------------------------

  const isAuthenticated = Boolean(accessToken && user);

  const value = useMemo(() => ({
    user,
    // 'token' is kept as an alias for backward-compat with ConversationContext
    // and MessageContext which destructure { token } from useAuth().
    token: accessToken,
    accessToken,
    refreshToken,
    authReady,
    isAuthenticated,
    login,
    register,
    logout,
    refreshAuthState,
  }), [
    user,
    accessToken,
    refreshToken,
    authReady,
    isAuthenticated,
    login,
    register,
    logout,
    refreshAuthState,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
