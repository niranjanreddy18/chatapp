import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { connect as connectSocket, disconnect as disconnectSocket, registerListener, removeListener } from '../services/websocket';
import { useAuth } from './AuthContext';

const ConversationContext = createContext(null);

export function ConversationProvider({ children }) {
  const { isAuthenticated, token } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [presenceMap, setPresenceMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadConversations = async () => {
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
      if (!selectedConversation && items.length) {
        setSelectedConversation(items[0]);
      }
    } catch (err) {
      setError('Unable to load conversations right now.');
      toast.error('Failed to load conversations.');
    } finally {
      setLoading(false);
    }
  };

  const refreshConversations = () => loadConversations();

  const createConversation = async (userId) => {
    try {
      const response = await api.post('/conversations/private/', { user_id: userId });
      const created = response?.data?.data;
      if (created) {
        const nextConversations = [created, ...conversations.filter((item) => item.id !== created.id)];
        setConversations(nextConversations);
        setSelectedConversation(created);
        toast.success('Conversation created.');
      }
      return created;
    } catch (err) {
      const message = err?.response?.data?.message || 'Unable to create conversation.';
      toast.error(message);
      throw err;
    }
  };

  const createGroup = async ({ name, memberIds }) => {
    try {
      const response = await api.post('/conversations/group/', { name, member_ids: memberIds });
      const created = response?.data?.data;
      if (created) {
        const nextConversations = [created, ...conversations.filter((item) => item.id !== created.id)];
        setConversations(nextConversations);
        setSelectedConversation(created);
        toast.success('Group created.');
      }
      return created;
    } catch (err) {
      const message = err?.response?.data?.message || 'Unable to create group.';
      toast.error(message);
      throw err;
    }
  };

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
  }, [isAuthenticated, token]);

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
    createConversation,
    createGroup,
    presenceMap,
    setPresenceMap,
  }), [conversations, selectedConversation, loading, error, presenceMap]);

  return <ConversationContext.Provider value={value}>{children}</ConversationContext.Provider>;
}

export function useConversation() {
  const context = useContext(ConversationContext);
  if (!context) {
    throw new Error('useConversation must be used within a ConversationProvider');
  }
  return context;
}
