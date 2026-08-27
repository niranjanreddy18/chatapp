/**
 * useUsers.js — On-demand user list hook for Nexus Chat.
 *
 * Changed from auto-fetch-on-mount to explicit fetchUsers() to avoid
 * an unnecessary API call every time the sidebar renders. Callers
 * invoke fetchUsers() only when the New Chat modal opens.
 *
 * fetchUsers() is safe to call multiple times — it will not fire a
 * second request while one is already in flight.
 */
import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';

export function useUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inFlight = useRef(false);

  /**
   * Fetch all users from GET /api/users/ and cache them in state.
   * Subsequent calls while a request is in-flight are no-ops.
   */
  const fetchUsers = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);

    try {
      // exclude_existing=true → backend filters out users who already have
      // an active private conversation with the current user so the modal
      // only shows people you haven't chatted with yet.
      const response = await api.get('/users/?exclude_existing=true');
      setUsers(response?.data?.data || []);
    } catch {
      setError('Unable to load users.');
      toast.error('Unable to load users.');
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  };

  /**
   * Reset state so the next modal open re-fetches a fresh list.
   * Call this when the modal closes.
   */
  const resetUsers = () => {
    setUsers([]);
    setError(null);
    setLoading(false);
    inFlight.current = false;
  };

  return { users, loading, error, fetchUsers, resetUsers };
}
