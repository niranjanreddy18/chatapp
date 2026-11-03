import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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

  selectedConversationIdRef.current = selectedConversation?.id ?? null;

  const startTyping = useCallback(() => {
    if (!selectedConversation?.id) return;
    sendSocket({ type: 'typing_start', conversation_id: selectedConversation.id });
  }, [selectedConversation?.id]);

  const stopTyping = useCallback(() => {
    if (!selectedConversation?.id) return;
    sendSocket({ type: 'typing_stop', conversation_id: selectedConversation.id });
  }, [selectedConversation?.id]);

  const markMessageRead = useCallback((messageId) => {
    if (!selectedConversation?.id) return;
    sendSocket({ type: 'read_message', conversation_id: selectedConversation.id, message_id: messageId });
  }, [selectedConversation?.id]);

  const loadMessages = useCallback(async (nextPage = 1, append = false) => {
    if (!selectedConversation?.id || !isAuthenticated || !token) return;
    const requestedConversationId = selectedConversation.id;
    try {
      setLoading(true);
      const response = await api.get(`/messages/${requestedConversationId}/?page=${nextPage}`);
      const pageData = response?.data?.data || {};
      const payload = pageData.results || [];
      if (Number(selectedConversationIdRef.current) !== Number(requestedConversationId)) return;

      setMessages((current) => {
        // When appending subsequent pages, keep all previously loaded messages;
        // when loading page 1, keep optimistic/in-flight messages that arrived via WS.
        const initialEntries = append
          ? current
          : current.filter((m) => m.tempClientId || Number(m.conversation) === Number(requestedConversationId));

        const byId = new Map(initialEntries.map((m) => [m.id, m]));
        payload.forEach((message) => {
          const local = current.find((m) => m.id === message.id);
          const hasLocalUploading = local?.attachments?.some((a) => a.uploading || a.upload_failed);
          if (hasLocalUploading && (!message.attachments || message.attachments.length === 0)) {
            byId.set(message.id, {
              ...message,
              attachments: local.attachments,
              mediaStatus: local.mediaStatus,
            });
          } else {
            byId.set(message.id, message);
          }
        });
        return [...byId.values()].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      });
      setPage(nextPage);
      setHasMore(Boolean(pageData.next));
    } catch {
      toast.error('Unable to load messages.');
    } finally {
      setLoading(false);
    }
  }, [selectedConversation?.id, isAuthenticated, token]);

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
  }, [selectedConversation?.id, isAuthenticated, token, loadMessages]);

  const sendMessage = useCallback(async ({ content, replyTo, attachments = [] }) => {
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
    } else {
      toast.error('Unable to send message. Connection is offline.');
    }

    return optimisticMessage;
  }, [selectedConversation?.id, user?.id, user?.username, stopTyping]);

  const sendMessageRest = useCallback(async ({
    content,
    replyTo,
    optimisticAttachment = null,
    tempClientId = null,
  }) => {
    if (!selectedConversation?.id) return null;

    if (optimisticAttachment && tempClientId) {
      const optimisticMessage = {
        id: tempClientId,
        tempClientId,
        conversation: selectedConversation.id,
        content,
        sender_id: user?.id,
        sender_username: user?.username || 'You',
        created_at: new Date().toISOString(),
        is_edited: false,
        is_deleted: false,
        attachments: [optimisticAttachment],
        reply_to: replyTo ? { id: replyTo } : null,
        mediaStatus: 'uploading',
      };
      setMessages((current) => [...current, optimisticMessage]);
      setReplyMessage(null);
      setTimeout(() => {
        scrollTargetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 50);
    }

    try {
      const response = await api.post('/messages/', {
        conversation_id: selectedConversation.id,
        content,
        reply_to: replyTo || null,
      });
      const created = response?.data?.data;

      if (created) {
        setMessages((current) => {
          if (tempClientId && optimisticAttachment) {
            const realAlreadyExists = current.some((m) => m.id === created.id);
            if (realAlreadyExists) {
              return current
                .filter((m) => m.id !== tempClientId)
                .map((m) => {
                  if (m.id === created.id) {
                    const hasRealAttachment = m.attachments?.some((a) => !a.uploading && !a.upload_failed);
                    if (hasRealAttachment) return m;
                    return {
                      ...m,
                      attachments: [optimisticAttachment],
                      mediaStatus: 'uploading',
                    };
                  }
                  return m;
                });
            }
            return current.map((m) => {
              if (m.id === tempClientId) {
                return {
                  ...created,
                  attachments: [optimisticAttachment],
                  mediaStatus: 'uploading',
                };
              }
              return m;
            });
          }

          const exists = current.some((m) => m.id === created.id);
          if (exists) return current;
          return [...current, created];
        });

        if (!tempClientId) {
          setReplyMessage(null);
          setTimeout(() => {
            scrollTargetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
          }, 50);
        }
        stopTyping();
      }

      return created;
    } catch (err) {
      if (tempClientId) {
        setMessages((current) => current.filter((m) => m.id !== tempClientId));
      }
      toast.error(err?.response?.data?.message || 'Unable to send message.');
      throw err;
    }
  }, [selectedConversation?.id, user?.id, user?.username, stopTyping]);

  const editMessage = useCallback(async (messageId, content) => {
    try {
      const response = await api.put(`/messages/${messageId}/edit/`, { content });
      const updated = response?.data?.data;
      if (updated) {
        setMessages((current) => current.map((message) => (Number(message.id) === Number(messageId) ? updated : message)));
        setEditingMessage(null);
      }
      return updated;
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Unable to edit message.');
      throw err;
    }
  }, []);

  const deleteMessage = useCallback(async (messageId) => {
    const targetId = Number(messageId);
    setMessages((current) =>
      current.map((message) =>
        Number(message.id) === targetId
          ? {
              ...message,
              is_deleted: true,
              content: 'This message was deleted.',
              attachments: [],
            }
          : message,
      ),
    );

    setEditingMessage((prev) => (prev && Number(prev.id) === targetId ? null : prev));
    setReplyMessage((prev) => (prev && Number(prev.id) === targetId ? null : prev));

    try {
      const response = await api.delete(`/messages/${messageId}/delete/`);
      const deletedData = response?.data?.data;
      if (deletedData) {
        setMessages((current) =>
          current.map((message) =>
            Number(message.id) === targetId ? deletedData : message,
          ),
        );
      }
      toast.success('Message deleted.');
    } catch (err) {
      loadMessages(page, false);
      toast.error(err?.response?.data?.message || 'Unable to delete message.');
      throw err;
    }
  }, [loadMessages, page]);

  const removeMessage = useCallback(async (messageId) => {
    const targetId = Number(messageId);
    setMessages((current) => current.filter((message) => Number(message.id) !== targetId));

    setEditingMessage((prev) => (prev && Number(prev.id) === targetId ? null : prev));
    setReplyMessage((prev) => (prev && Number(prev.id) === targetId ? null : prev));

    try {
      await api.delete(`/messages/${messageId}/remove/`);
      toast.success('Message removed.');
    } catch (err) {
      loadMessages(page, false);
      toast.error(err?.response?.data?.message || 'Unable to remove message.');
      throw err;
    }
  }, [loadMessages, page]);

  const uploadAttachment = useCallback(async ({
    messageId,
    file,
    tempAttachmentId = null,
    uploadId = null,
  }) => {
    const formData = new FormData();
    formData.append('message_id', messageId);
    formData.append('file', file);
    if (uploadId) {
      formData.append('upload_id', uploadId);
    }

    try {
      const response = await api.post('/messages/upload/', formData);
      const attachment = response?.data?.data;

      if (attachment) {
        setMessages((current) => current.map((message) => {
          if (message.id !== messageId) return message;

          const existing = message.attachments || [];

          if (tempAttachmentId) {
            const withoutTemp = existing.filter((a) => a.id !== tempAttachmentId);
            const alreadyHasReal = withoutTemp.some((a) => a.id === attachment.id);
            return {
              ...message,
              attachments: alreadyHasReal ? withoutTemp : [...withoutTemp, attachment],
              mediaStatus: 'done',
            };
          }

          const alreadyHasReal = existing.some((a) => a.id === attachment.id);
          return alreadyHasReal ? message : { ...message, attachments: [...existing, attachment] };
        }));
      }

      return attachment;
    } catch (err) {
      if (tempAttachmentId) {
        setMessages((current) => current.map((message) => {
          if (message.id !== messageId) return message;
          return {
            ...message,
            mediaStatus: 'failed',
            attachments: (message.attachments || []).map((a) =>
              (a.id === tempAttachmentId || a.uploading)
                ? { ...a, uploading: false, upload_failed: true }
                : a,
            ),
          };
        }));
      }
      toast.error(err?.response?.data?.message || 'Upload failed.');
      throw err;
    }
  }, []);

  const retryAttachment = useCallback(async ({ messageId, attachment }) => {
    setMessages((current) => current.map((message) => {
      if (message.id !== messageId) return message;
      return {
        ...message,
        mediaStatus: 'uploading',
        attachments: (message.attachments || []).map((a) =>
          a.id === attachment.id
            ? { ...a, uploading: true, upload_failed: false }
            : a,
        ),
      };
    }));

    try {
      await uploadAttachment({
        messageId,
        file: attachment._localFile,
        tempAttachmentId: attachment.id,
        uploadId: attachment._uploadId,
      });
      return true;
    } catch {
      return false;
    }
  }, [uploadAttachment]);

  const clearChat = useCallback(async (conversationId) => {
    try {
      await api.post(`/conversations/${conversationId}/clear/`);
      setMessages([]);
      toast.success('Chat cleared.');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Unable to clear chat.');
      throw err;
    }
  }, []);

  useEffect(() => {
    const handleStatus = (status) => setConnectionStatus(status);
    const handleMessage = (payload) => {
      if (!payload || typeof payload !== 'object') return;

      if (payload.type === 'new_message') {
        const incoming = payload.message;
        const incomingConversationId = Number(incoming?.conversation);
        const activeConversationId = Number(selectedConversation?.id);
        if (!incoming || !Number.isFinite(incomingConversationId) || incomingConversationId !== activeConversationId) return;

        setMessages((current) => {
          const exists = current.some((item) => item.id === incoming.id);
          if (exists) {
            return current.map((item) => {
              if (item.id === incoming.id) {
                const hasLocalUploading = item.attachments?.some((a) => a.uploading || a.upload_failed);
                if (hasLocalUploading && (!incoming.attachments || incoming.attachments.length === 0)) {
                  return {
                    ...incoming,
                    attachments: item.attachments,
                    mediaStatus: item.mediaStatus,
                  };
                }
                return incoming;
              }
              return item;
            });
          }

          const optimisticMatch = current.find((item) => (
            item.tempClientId
            && Number(item.conversation) === incomingConversationId
            && item.sender_id === incoming.sender_id
            && item.content === incoming.content
          ));
          if (optimisticMatch) {
            const hasOptimisticUploading = optimisticMatch.attachments?.some((a) => a.uploading || a.upload_failed);
            const preservedAttachments = (hasOptimisticUploading && (!incoming.attachments || incoming.attachments.length === 0))
              ? optimisticMatch.attachments
              : incoming.attachments;
            const preservedMediaStatus = (hasOptimisticUploading && (!incoming.attachments || incoming.attachments.length === 0))
              ? optimisticMatch.mediaStatus
              : (incoming.attachments?.length ? 'done' : undefined);

            return current.map((item) =>
              item.tempClientId === optimisticMatch.tempClientId
                ? {
                    ...incoming,
                    attachments: preservedAttachments,
                    mediaStatus: preservedMediaStatus,
                  }
                : item,
            );
          }

          return [...current, incoming];
        });

        if (incoming.sender_id !== (user?.id || 1)) {
          markMessageRead(incoming.id);
        }
        return;
      }

      if (payload.type === 'typing_start') {
        const eventConversationId = Number(payload.conversation_id);
        const eventUserId = Number(payload.user_id);
        if (
          eventConversationId !== Number(selectedConversation?.id)
          || !Number.isFinite(eventUserId)
          || eventUserId === Number(user?.id)
        ) return;
        setTypingUsers((current) =>
          current.some((typingUser) => typingUser.id === eventUserId)
            ? current
            : [...current, { id: eventUserId, username: payload.username }],
        );
        return;
      }

      if (payload.type === 'typing_stop') {
        const eventConversationId = Number(payload.conversation_id);
        const eventUserId = Number(payload.user_id);
        if (
          eventConversationId !== Number(selectedConversation?.id)
          || !Number.isFinite(eventUserId)
          || eventUserId === Number(user?.id)
        ) return;
        setTypingUsers((current) => current.filter((typingUser) => typingUser.id !== eventUserId));
        return;
      }

      if (payload.type === 'message_read') {
        setMessages((current) =>
          current.map((message) => {
            if (message.id !== payload.message_id) return message;
            const existingReadBy = message.read_by || [];
            if (existingReadBy.includes(payload.user_id)) return message;
            return { ...message, read_by: [...existingReadBy, payload.user_id] };
          }),
        );
        return;
      }

      if (payload.type === 'user_status') {
        return;
      }

      if (payload.type === 'user_updated') {
        const updatedUserId = Number(payload.user_id);
        setMessages((current) =>
          current.map((msg) => {
            if (Number(msg.sender_id) === updatedUserId) {
              return {
                ...msg,
                sender_username: payload.username || msg.sender_username,
                sender_avatar: payload.avatar !== undefined ? payload.avatar : msg.sender_avatar,
              };
            }
            return msg;
          }),
        );
        return;
      }

      if (payload.type === 'message_deleted') {
        const deletedId = Number(payload.message_id || payload.message?.id);
        const incomingConversationId = Number(payload.conversation_id || payload.message?.conversation);
        const activeConversationId = Number(selectedConversation?.id);
        if (Number.isFinite(incomingConversationId) && incomingConversationId !== activeConversationId) return;

        setMessages((current) =>
          current.map((message) => {
            if (Number(message.id) === deletedId) {
              if (payload.message) {
                return payload.message;
              }
              return {
                ...message,
                is_deleted: true,
                content: 'This message was deleted.',
                attachments: [],
              };
            }
            return message;
          }),
        );
        return;
      }

      if (payload.type === 'message_removed') {
        const removedId = Number(payload.message_id);
        const incomingConversationId = Number(payload.conversation_id);
        const activeConversationId = Number(selectedConversation?.id);
        if (Number.isFinite(incomingConversationId) && incomingConversationId !== activeConversationId) return;

        setMessages((current) =>
          current.filter((message) => Number(message.id) !== removedId),
        );
        return;
      }

      if (payload.type === 'message_edited') {
        const editedId = Number(payload.message_id || payload.message?.id);
        const incomingConversationId = Number(payload.conversation_id || payload.message?.conversation);
        const activeConversationId = Number(selectedConversation?.id);
        if (Number.isFinite(incomingConversationId) && incomingConversationId !== activeConversationId) return;

        setMessages((current) =>
          current.map((message) => {
            if (Number(message.id) === editedId) {
              if (payload.message) {
                return payload.message;
              }
              return {
                ...message,
                content: payload.content || message.content,
                is_edited: true,
              };
            }
            return message;
          }),
        );
        return;
      }

      if (payload.type === 'chat_cleared') {
        const eventConversationId = Number(payload.conversation_id);
        if (eventConversationId !== Number(selectedConversation?.id)) return;
        setMessages([]);
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
  }, [selectedConversation?.id, user, markMessageRead]);

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
    removeMessage,
    clearChat,
    uploadAttachment,
    retryAttachment,
    scrollTargetRef,
    startTyping,
    stopTyping,
    markMessageRead,
  }), [
    messages,
    loading,
    replyMessage,
    editingMessage,
    page,
    hasMore,
    typingUsers,
    connectionStatus,
    loadMessages,
    sendMessage,
    sendMessageRest,
    editMessage,
    deleteMessage,
    removeMessage,
    clearChat,
    uploadAttachment,
    retryAttachment,
    startTyping,
    stopTyping,
    markMessageRead,
  ]);

  return <MessageContext.Provider value={value}>{children}</MessageContext.Provider>;
}

export function useMessage() {
  const context = useContext(MessageContext);
  if (!context) {
    throw new Error('useMessage must be used within a MessageProvider');
  }
  return context;
}
