import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { connect as connectSocket, disconnect as disconnectSocket, registerListener, removeListener } from '../services/websocket';
import { useAuth } from './AuthContext';

const ConversationContext = createContext(null);

export function ConversationProvider({ children }) {
  const { user, isAuthenticated, token } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [presenceMap, setPresenceMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [favoriteIds, setFavoriteIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('chatapp_favorites') || '[]');
    } catch {
      return [];
    }
  });

  const toggleFavorite = useCallback((conversationId) => {
    if (!conversationId) return;
    setFavoriteIds((prev) => {
      const exists = prev.includes(conversationId);
      const next = exists
        ? prev.filter((id) => id !== conversationId)
        : [...prev, conversationId];
      try {
        localStorage.setItem('chatapp_favorites', JSON.stringify(next));
      } catch {
        // Ignore storage write errors
      }
      if (exists) {
        toast.success('Removed from starred');
      } else {
        toast.success('Added to starred');
      }
      return next;
    });
  }, []);

  const isFavorite = useCallback((conversationId) => {
    return Boolean(conversationId && favoriteIds.includes(conversationId));
  }, [favoriteIds]);

  const userRef = useRef(user);
  userRef.current = user;

  const selectedConversationRef = useRef(null);
  selectedConversationRef.current = selectedConversation;

  const loadConversations = useCallback(async () => {
    if (!isAuthenticated || !token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/conversations/');
      const items = response?.data?.data || [];
      setConversations(items);
      setSelectedConversation((current) => current || (items.length ? items[0] : null));
    } catch {
      setError('Unable to load conversations right now.');
      toast.error('Failed to load conversations.');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, token]);

  const refreshConversations = useCallback(() => loadConversations(), [loadConversations]);

  const markConversationAsRead = useCallback(async (conversationId) => {
    if (!conversationId) return;
    setConversations((current) =>
      current.map((conv) =>
        conv.id === conversationId
          ? { ...conv, unread_count: 0 }
          : conv,
      ),
    );

    try {
      await api.post(`/conversations/${conversationId}/read/`);
    } catch {
      // Non-blocking
    }
  }, []);

  const createConversation = useCallback(async (userId) => {
    try {
      const response = await api.post('/conversations/private/', { user_id: userId });
      const created = response?.data?.data;
      if (created) {
        setConversations((current) => [created, ...current.filter((item) => item.id !== created.id)]);
        setSelectedConversation(created);
        toast.success('Conversation created.');
      }
      return created;
    } catch (err) {
      const message = err?.response?.data?.message || 'Unable to create conversation.';
      toast.error(message);
      throw err;
    }
  }, []);

  const createGroup = useCallback(async ({ name, memberIds }) => {
    try {
      const response = await api.post('/conversations/group/', { name, member_ids: memberIds });
      const created = response?.data?.data;
      if (created) {
        setConversations((current) => [created, ...current.filter((item) => item.id !== created.id)]);
        setSelectedConversation(created);
        toast.success('Group created.');
      }
      return created;
    } catch (err) {
      const message = err?.response?.data?.message || 'Unable to create group.';
      toast.error(message);
      throw err;
    }
  }, []);

  const deleteConversation = useCallback(async (conversationId) => {
    try {
      await api.delete(`/conversations/${conversationId}/delete/`);
      setConversations((current) => current.filter((item) => item.id !== conversationId));
      setSelectedConversation((current) => (current?.id === conversationId ? null : current));
      toast.success('Conversation removed.');
    } catch (err) {
      const message = err?.response?.data?.message || 'Unable to delete conversation.';
      toast.error(message);
      throw err;
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setConversations([]);
      setSelectedConversation(null);
      setLoading(false);
      setError(null);
      disconnectSocket(true);
      return;
    }

    loadConversations();
  }, [isAuthenticated, token, loadConversations]);

  // Presence updates (user_status events)
  useEffect(() => {
    const handlePresence = (payload) => {
      if (!payload || payload.type !== 'user_status') return;
      setPresenceMap((current) => ({
        ...current,
        [payload.user_id]: {
          is_online: payload.is_online,
          last_seen: payload.last_seen,
        },
      }));
    };

    registerListener('message', handlePresence);
    return () => removeListener('message', handlePresence);
  }, []);

  // New conversation created by remote peer (via user_<id> WS group)
  useEffect(() => {
    const handleConversationCreated = (payload) => {
      if (payload?.type !== 'conversation_created' || !payload.conversation) return;
      setConversations((current) => [
        payload.conversation,
        ...current.filter((item) => item.id !== payload.conversation.id),
      ]);
    };

    registerListener('message', handleConversationCreated);
    return () => removeListener('message', handleConversationCreated);
  }, []);

  // Real-time user profile update (user_updated event)
  useEffect(() => {
    const handleUserUpdated = (payload) => {
      if (payload?.type !== 'user_updated' || !payload.user_id) return;
      const updatedUserId = Number(payload.user_id);
      const currentAuthUserId = Number(userRef.current?.id ?? null);

      setConversations((current) =>
        current.map((conv) => {
          const hasMember = conv.members?.some((m) => m.user_id === updatedUserId);
          if (!hasMember) return conv;

          const updatedMembers = conv.members.map((m) =>
            m.user_id === updatedUserId
              ? {
                  ...m,
                  username: payload.username || m.username,
                  avatar: payload.avatar !== undefined ? payload.avatar : m.avatar,
                }
              : m,
          );

          const isPrivateWithUpdatedUser =
            conv.conversation_type === 'PRIVATE' &&
            conv.members?.some((m) => m.user_id === updatedUserId && m.user_id !== currentAuthUserId);

          return {
            ...conv,
            members: updatedMembers,
            avatar: isPrivateWithUpdatedUser
              ? (payload.avatar !== undefined ? payload.avatar : conv.avatar)
              : conv.avatar,
          };
        }),
      );

      setSelectedConversation((current) => {
        if (!current) return current;
        const hasMember = current.members?.some((m) => m.user_id === updatedUserId);
        if (!hasMember) return current;

        const updatedMembers = current.members.map((m) =>
          m.user_id === updatedUserId
            ? {
                ...m,
                username: payload.username || m.username,
                avatar: payload.avatar !== undefined ? payload.avatar : m.avatar,
              }
            : m,
        );

        const isPrivateWithUpdatedUser =
          current.conversation_type === 'PRIVATE' &&
          current.members?.some((m) => m.user_id === updatedUserId && m.user_id !== currentAuthUserId);

        return {
          ...current,
          members: updatedMembers,
          avatar: isPrivateWithUpdatedUser
            ? (payload.avatar !== undefined ? payload.avatar : current.avatar)
            : current.avatar,
        };
      });
    };

    registerListener('message', handleUserUpdated);
    return () => removeListener('message', handleUserUpdated);
  }, []);

  // Real-time unread_count sync
  useEffect(() => {
    const handleNewMessageUnread = (payload) => {
      if (payload?.type !== 'new_message' || !payload.message) return;
      const incomingConversationId = Number(payload.message.conversation);
      const activeConversationId = Number(selectedConversationRef.current?.id ?? null);
      const currentUserId = Number(userRef.current?.id ?? null);
      const senderId = Number(payload.message.sender_id);

      if (Number.isFinite(currentUserId) && senderId === currentUserId) return;
      if (incomingConversationId === activeConversationId) return;

      setConversations((current) => {
        const exists = current.some((conv) => conv.id === incomingConversationId);
        if (!exists) {
          loadConversations();
          return current;
        }
        return current.map((conv) =>
          conv.id === incomingConversationId
            ? {
                ...conv,
                unread_count: (conv.unread_count ?? 0) + 1,
                updated_at: payload.message.created_at || new Date().toISOString(),
              }
            : conv,
        );
      });
    };

    registerListener('message', handleNewMessageUnread);
    return () => removeListener('message', handleNewMessageUnread);
  }, [loadConversations]);

  // conversation_deleted — remove conversation only when deleted by the current user
  useEffect(() => {
    const handleConversationDeleted = (payload) => {
      if (payload?.type !== 'conversation_deleted' || !payload.conversation_id) return;
      if (payload.deleted_by !== undefined && Number(payload.deleted_by) !== Number(userRef.current?.id)) {
        return;
      }
      const deletedId = Number(payload.conversation_id);
      setConversations((current) => current.filter((item) => item.id !== deletedId));
      setSelectedConversation((current) => (current?.id === deletedId ? null : current));
    };

    registerListener('message', handleConversationDeleted);
    return () => removeListener('message', handleConversationDeleted);
  }, []);

  // Mark conversation as read when selected
  useEffect(() => {
    if (!selectedConversation?.id) return;
    markConversationAsRead(selectedConversation.id);
  }, [selectedConversation?.id, markConversationAsRead]);

  // Connect/disconnect WebSocket when the selected conversation changes
  useEffect(() => {
    if (!selectedConversation?.id || !isAuthenticated || !token) {
      disconnectSocket(true);
      return;
    }

    connectSocket({ conversationId: selectedConversation.id, token });
  }, [selectedConversation?.id, isAuthenticated, token]);

  const value = useMemo(() => ({
    conversations,
    selectedConversation,
    setSelectedConversation,
    loading,
    error,
    refreshConversations,
    markConversationAsRead,
    createConversation,
    createGroup,
    deleteConversation,
    presenceMap,
    setPresenceMap,
    favoriteIds,
    toggleFavorite,
    isFavorite,
  }), [
    conversations,
    selectedConversation,
    loading,
    error,
    refreshConversations,
    markConversationAsRead,
    createConversation,
    createGroup,
    deleteConversation,
    presenceMap,
    favoriteIds,
    toggleFavorite,
    isFavorite,
  ]);

  return <ConversationContext.Provider value={value}>{children}</ConversationContext.Provider>;
}

export function useConversation() {
  const context = useContext(ConversationContext);
  if (!context) {
    throw new Error('useConversation must be used within a ConversationProvider');
  }
  return context;
}
