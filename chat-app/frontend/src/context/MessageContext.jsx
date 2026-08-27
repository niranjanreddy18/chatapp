import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { registerListener, removeListener, send as sendSocket, getConnectionStatus } from '../services/websocket';
import { useAuth } from './AuthContext';
import { useConversation } from './ConversationContext';

const MessageContext = createContext(null);

export function MessageProvider({ children }) {
  const { selectedConversation } = useConversation();
  const { user, isAuthenticated, token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [replyMessage, setReplyMessage] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [typingUsers, setTypingUsers] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const scrollTargetRef = useRef(null);
  const selectedConversationIdRef = useRef(null);

  // Keep async REST responses tied to the conversation that requested them.
  // A request from a previously selected conversation must never replace the
  // messages for the conversation currently displayed.
  selectedConversationIdRef.current = selectedConversation?.id ?? null;

  const loadMessages = async (nextPage = 1, _append = false) => {
    if (!selectedConversation?.id || !isAuthenticated || !token) return;
    const requestedConversationId = selectedConversation.id;
    try {
      setLoading(true);
      const response = await api.get(`/messages/${requestedConversationId}/?page=${nextPage}`);
      // Pagination envelope: { success, message, data: { count, next, previous, results } }
      const pageData = response?.data?.data || {};
      const payload = pageData.results || [];
      if (Number(selectedConversationIdRef.current) !== Number(requestedConversationId)) return;

      setMessages((current) => {
        // A new_message event can arrive while this REST request is in flight.
        // Merge rather than replace so the newer socket message is retained.
        const byId = new Map(current.map((message) => [message.id, message]));
        payload.forEach((message) => byId.set(message.id, message));
        return [...byId.values()].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      });
      setPage(nextPage);
      setHasMore(Boolean(pageData.next));
    } catch (err) {
      toast.error('Unable to load messages.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedConversation?.id || !isAuthenticated || !token) {
      setMessages([]);
      setPage(1);
      setHasMore(true);
      setReplyMessage(null);
      setEditingMessage(null);
      setTypingUsers([]);
      return;
    }

    setMessages([]);
    setPage(1);
    setHasMore(true);
    setReplyMessage(null);
    setEditingMessage(null);
    setTypingUsers([]);
    loadMessages(1, false);
  }, [selectedConversation?.id, isAuthenticated, token]);

  const sendMessage = async ({ content, replyTo, attachments = [] }) => {
    if (!selectedConversation?.id) return null;
    const optimisticMessage = {
      id: `temp-${Date.now()}`,
      tempClientId: `temp-${Date.now()}`,
      conversation: selectedConversation.id,
      content,
      sender_id: user?.id || 1,
      sender_username: user?.username || 'You',
      created_at: new Date().toISOString(),
      is_edited: false,
      is_deleted: false,
      attachments,
      reply_to: replyTo || null,
    };

    setMessages((current) => [...current, optimisticMessage]);
    setReplyMessage(null);
    setEditingMessage(null);
    setTimeout(() => {
      scrollTargetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 50);

    const sent = sendSocket({
      type: 'send_message',
      conversation_id: selectedConversation.id,
      content,
      reply_to: replyTo || null,
    });

    if (sent) {
      stopTyping();
    }

    if (!sent) {
      toast.error('Unable to send message. Connection is offline.');
    }

    return optimisticMessage;
  };

  // sendMessageRest — used when composing a new message that includes a file
  // attachment. The WebSocket path does not return the persisted message ID,
  // but the REST POST /api/messages/ does. We need that ID to call
  // POST /api/messages/upload/ immediately after.
  const sendMessageRest = async ({ content, replyTo }) => {
    if (!selectedConversation?.id) return null;
    try {
      const response = await api.post('/messages/', {
        conversation_id: selectedConversation.id,
        content,
        reply_to: replyTo || null,
      });
      const created = response?.data?.data;
      if (created) {
        // Replace any in-flight optimistic copy or just append the real message.
        setMessages((current) => {
          const exists = current.some((m) => m.id === created.id);
          if (exists) return current;
          return [...current, created];
        });
        setReplyMessage(null);
        setTimeout(() => {
          scrollTargetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }, 50);
        stopTyping();
      }
      return created;
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Unable to send message.');
      throw err;
    }
  };

  const editMessage = async (messageId, content) => {
    try {
      const response = await api.put(`/messages/${messageId}/edit/`, { content });
      const updated = response?.data?.data;
      if (updated) {
        setMessages((current) => current.map((message) => (message.id === messageId ? updated : message)));
        setEditingMessage(null);
      }
      return updated;
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Unable to edit message.');
      throw err;
    }
  };

  const deleteMessage = async (messageId) => {
    try {
      await api.delete(`/messages/${messageId}/delete/`);
      setMessages((current) => current.map((message) => message.id === messageId ? { ...message, is_deleted: true, content: 'This message was deleted.' } : message));
      toast.success('Message deleted.');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Unable to delete message.');
      throw err;
    }
  };

  const uploadAttachment = async ({ messageId, file }) => {
    const formData = new FormData();
    formData.append('message_id', messageId);
    formData.append('file', file);
    try {
      const response = await api.post('/messages/upload/', formData);
      const attachment = response?.data?.data;
      if (attachment) {
        // Merge the returned attachment into the parent message in state
        setMessages((current) => current.map((message) => {
          if (message.id === messageId) {
            const existing = message.attachments || [];
            // Avoid duplicates
            const exists = existing.some((a) => a.id === attachment.id);
            return exists ? message : { ...message, attachments: [...existing, attachment] };
          }
          return message;
        }));
      }
      return attachment;
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Upload failed.');
      throw err;
    }
  };

  useEffect(() => {
    const handleStatus = (status) => setConnectionStatus(status);
    const handleMessage = (payload) => {
      if (!payload || typeof payload !== 'object') return;
      console.log('[MESSAGE CONTEXT EVENT]', payload);
      console.log('[MESSAGE CONTEXT TYPE]', payload.type);

      if (payload.type === 'new_message') {
        const incoming = payload.message;
        const incomingConversationId = Number(incoming?.conversation);
        const activeConversationId = Number(selectedConversation?.id);
        if (!incoming || !Number.isFinite(incomingConversationId) || incomingConversationId !== activeConversationId) return;
        setMessages((current) => {
          const optimisticMatch = current.find((item) => (
            item.tempClientId
            && Number(item.conversation) === incomingConversationId
            && item.sender_id === incoming.sender_id
            && item.content === incoming.content
          ));
          const exists = current.some((item) => item.id === incoming.id);
          if (exists) {
            return current.map((item) => item.id === incoming.id ? incoming : item);
          }
          if (optimisticMatch) {
            return current.map((item) => item.tempClientId === optimisticMatch.tempClientId ? incoming : item);
          }
          return [...current, incoming];
        });

        if (incoming.sender_id !== (user?.id || 1)) {
          markMessageRead(incoming.id);
        }
        return;
      }

      if (payload.type === 'typing_start') {
        // Ignore our own typing events — the backend broadcasts to the whole
        // group including the sender, so we must filter them on the frontend.
        // We compare by user_id (not username) because user_id is guaranteed
        // unique across all members, including in group conversations.
        const eventConversationId = Number(payload.conversation_id);
        const eventUserId = Number(payload.user_id);
        console.log('[TYPING HANDLER ENTERED]', payload);
        console.log('[TYPING CONVERSATION CHECK]', {
          eventConversationId: payload.conversation_id,
          currentConversationId: selectedConversation?.id,
          eventConversationType: typeof payload.conversation_id,
          currentConversationType: typeof selectedConversation?.id,
        });
        if (
          eventConversationId !== Number(selectedConversation?.id)
          || !Number.isFinite(eventUserId)
          || eventUserId === Number(user?.id)
        ) return;
        setTypingUsers((current) => {
          const nextTypingUsers = current.some((typingUser) => typingUser.id === eventUserId)
            ? current
            : [...current, { id: eventUserId, username: payload.username }];
          console.log('[TYPING BEFORE STATE UPDATE]', current);
          console.log('[TYPING NEW STATE]', nextTypingUsers);
           
          return nextTypingUsers;
        });
        return;
      }

      if (payload.type === 'typing_stop') {
        // Mirror the guard above: ignore stop events from ourselves so we
        // don't accidentally clear another user's indicator.
        const eventConversationId = Number(payload.conversation_id);
        const eventUserId = Number(payload.user_id);
        console.log('[TYPING STOP HANDLER ENTERED]', payload);
        if (
          eventConversationId !== Number(selectedConversation?.id)
          || !Number.isFinite(eventUserId)
          || eventUserId === Number(user?.id)
        ) return;
        setTypingUsers((current) => {
          const nextTypingUsers = current.filter((typingUser) => typingUser.id !== eventUserId);
          console.log('[TYPING BEFORE STATE UPDATE]', current);
          console.log('[TYPING NEW STATE]', nextTypingUsers);
          return nextTypingUsers;
        });
        return;
      }

      if (payload.type === 'message_read') {
        setMessages((current) => current.map((message) => message.id === payload.message_id ? { ...message, read_by: [...(message.read_by || []), payload.user_id] } : message));
        return;
      }

      if (payload.type === 'user_status') {
        return;
      }
    };

    registerListener('status', handleStatus);
    registerListener('message', handleMessage);
    setConnectionStatus(getConnectionStatus());

    return () => {
      removeListener('status', handleStatus);
      removeListener('message', handleMessage);
    };
  }, [selectedConversation?.id, user]);

  const startTyping = () => {
    if (!selectedConversation?.id) return;
    sendSocket({ type: 'typing_start', conversation_id: selectedConversation.id });
  };

  const stopTyping = () => {
    if (!selectedConversation?.id) return;
    sendSocket({ type: 'typing_stop', conversation_id: selectedConversation.id });
  };

  const markMessageRead = (messageId) => {
    if (!selectedConversation?.id) return;
    sendSocket({ type: 'read_message', conversation_id: selectedConversation.id, message_id: messageId });
  };

  const value = useMemo(() => ({
    messages,
    loading,
    replyMessage,
    setReplyMessage,
    editingMessage,
    setEditingMessage,
    page,
    hasMore,
    typingUsers,
    connectionStatus,
    loadMessages,
    sendMessage,
    sendMessageRest,
    editMessage,
    deleteMessage,
    uploadAttachment,
    scrollTargetRef,
    startTyping,
    stopTyping,
    markMessageRead,
  }), [messages, loading, replyMessage, editingMessage, page, hasMore, typingUsers, connectionStatus]);

  return <MessageContext.Provider value={value}>{children}</MessageContext.Provider>;
}

export function useMessage() {
  const context = useContext(MessageContext);
  if (!context) {
    throw new Error('useMessage must be used within a MessageProvider');
  }
  return context;
}
