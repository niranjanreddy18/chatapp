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
        // Exclude optimistic messages (tempClientId) from the merge map so they
        // are not accidentally overwritten by a stale page load.
        const byId = new Map(
          current
            .filter((m) => m.tempClientId)                         // keep all optimistic rows
            .map((m) => [m.id, m]),
        );
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

  // ---------------------------------------------------------------------------
  // sendMessage — text messages via WebSocket (existing, unchanged)
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // sendMessageRest — used for file/image uploads.
  //
  // FIX: now accepts `optimisticAttachment` and `tempClientId`.
  //
  // When these are present the function:
  //   1. Immediately adds a temporary message containing the local blob-URL
  //      attachment to state → image appears on screen BEFORE the API call.
  //   2. Calls POST /api/messages/ to create the real message.
  //   3. Swaps the temporary message (keyed by tempClientId) for the real one,
  //      while KEEPING the optimisticAttachment (still uploading: true) so the
  //      loading overlay stays visible until uploadAttachment completes.
  //   4. On API failure: removes the temporary message from state.
  //
  // When called without optimisticAttachment (e.g. edit-message attach) it
  // behaves exactly as before.
  // ---------------------------------------------------------------------------
  const sendMessageRest = async ({
    content,
    replyTo,
    optimisticAttachment = null,
    tempClientId = null,
  }) => {
    if (!selectedConversation?.id) return null;

    // ── Step 1: add temporary optimistic message immediately ─────────────────
    if (optimisticAttachment && tempClientId) {
      const optimisticMessage = {
        // Use tempClientId as the message ID so we can find it by ID later
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
        // mediaStatus drives the "Uploading…" / "Upload failed" text in the
        // message footer (read by ChatWindow.jsx lines isMine section).
        mediaStatus: 'uploading',
      };
      setMessages((current) => [...current, optimisticMessage]);
      setReplyMessage(null);
      setTimeout(() => {
        scrollTargetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 50);
    }

    // ── Step 2: create the message on the server ──────────────────────────────
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
            // Has the WebSocket already delivered the real message?
            const realAlreadyExists = current.some((m) => m.id === created.id);
            if (realAlreadyExists) {
              // WS beat the HTTP response — discard temp row and ensure the real message retains the optimistic attachment if upload is still pending.
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
            // Normal path: replace tempClientId row with the real message,
            // but keep the optimistic attachment so the upload overlay stays
            // visible while uploadAttachment() is still running.
            return current.map((m) => {
              if (m.id === tempClientId) {
                return {
                  ...created,
                  attachments: [optimisticAttachment], // still uploading: true
                  mediaStatus: 'uploading',
                };
              }
              return m;
            });
          }

          // Non-optimistic path (e.g. edit-message attach): append if absent.
          const exists = current.some((m) => m.id === created.id);
          if (exists) return current;
          return [...current, created];
        });

        if (!tempClientId) {
          // Optimistic path already cleared replyMessage and scrolled above.
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
        // Message creation failed — remove the optimistic preview completely.
        // ChatWindow.jsx will NOT revoke the blob URL here (see finally block),
        // the URL will be cleaned up when the component unmounts.
        setMessages((current) => current.filter((m) => m.id !== tempClientId));
      }
      toast.error(err?.response?.data?.message || 'Unable to send message.');
      throw err;
    }
  };

  const editMessage = async (messageId, content) => {
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
  };

  const deleteMessage = async (messageId) => {
    const targetId = Number(messageId);
    // Optimistically update local message state immediately
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
      // Re-fetch or reload to restore accurate state on failure
      loadMessages(page, false);
      toast.error(err?.response?.data?.message || 'Unable to delete message.');
      throw err;
    }
  };

  const removeMessage = async (messageId) => {
    const targetId = Number(messageId);
    // Optimistically remove the message completely from local state
    setMessages((current) => current.filter((message) => Number(message.id) !== targetId));

    setEditingMessage((prev) => (prev && Number(prev.id) === targetId ? null : prev));
    setReplyMessage((prev) => (prev && Number(prev.id) === targetId ? null : prev));

    try {
      await api.delete(`/messages/${messageId}/remove/`);
      toast.success('Message removed.');
    } catch (err) {
      // Re-fetch or reload to restore accurate state on failure
      loadMessages(page, false);
      toast.error(err?.response?.data?.message || 'Unable to remove message.');
      throw err;
    }
  };

  // ---------------------------------------------------------------------------
  // uploadAttachment — sends the file to POST /api/messages/upload/.
  //
  // FIX: now accepts `tempAttachmentId` and `uploadId`.
  //
  // tempAttachmentId: the temporary attachment id (== tempClientId) used to
  //   find and replace the optimistic attachment in state.
  //
  // uploadId: a client-generated UUID passed to the backend for idempotency.
  //   The backend stores it on the Attachment row with a UNIQUE constraint so
  //   that concurrent retries produce exactly one DB row.
  //
  // On success: the backend also broadcasts `new_message` via WebSocket (see
  //   UploadAttachmentView), so the WebSocket handler may replace the message
  //   first. The state update here is a fallback for disconnected WS.
  //
  // On failure: marks the attachment as `upload_failed: true` so ChatWindow
  //   renders the retry overlay.
  // ---------------------------------------------------------------------------
  const uploadAttachment = async ({
    messageId,
    file,
    tempAttachmentId = null,
    uploadId = null,
  }) => {
    const formData = new FormData();
    formData.append('message_id', messageId);
    formData.append('file', file);
    if (uploadId) {
      // Idempotency key — the backend deduplicates retries using this value.
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
            // Remove the temporary attachment, add the real one (unless WS
            // already delivered it and removed the temp copy).
            const withoutTemp = existing.filter((a) => a.id !== tempAttachmentId);
            const alreadyHasReal = withoutTemp.some((a) => a.id === attachment.id);
            return {
              ...message,
              attachments: alreadyHasReal ? withoutTemp : [...withoutTemp, attachment],
              mediaStatus: 'done',
            };
          }

          // Non-optimistic path: just append, avoiding duplicates.
          const alreadyHasReal = existing.some((a) => a.id === attachment.id);
          return alreadyHasReal ? message : { ...message, attachments: [...existing, attachment] };
        }));
      }

      return attachment;
    } catch (err) {
      // Mark the temporary attachment as failed so the retry overlay shows.
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
  };

  // ---------------------------------------------------------------------------
  // retryAttachment — called from ChatWindow when the user clicks "Retry" on
  // a failed upload overlay.
  //
  // Resets the attachment back to `uploading: true` then calls uploadAttachment
  // with the same uploadId so the backend's UNIQUE constraint prevents
  // duplicate Attachment rows across attempts.
  //
  // Returns true on success (so ChatWindow can revoke the blob URL), false
  // on failure (blob URL must stay alive for another potential retry).
  // ---------------------------------------------------------------------------
  const retryAttachment = async ({ messageId, attachment }) => {
    // Flip failed → uploading in local state immediately.
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
        uploadId: attachment._uploadId,  // same UUID → backend deduplicates
      });
      return true;
    } catch {
      // uploadAttachment already set upload_failed: true in state and toasted.
      return false;
    }
  };

  // ---------------------------------------------------------------------------
  // clearChat — bulk soft-deletes all messages (existing, unchanged)
  // ---------------------------------------------------------------------------
  const clearChat = async (conversationId) => {
    try {
      await api.post(`/conversations/${conversationId}/clear/`);
      setMessages([]);
      toast.success('Chat cleared.');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Unable to clear chat.');
      throw err;
    }
  };

  // ---------------------------------------------------------------------------
  // WebSocket message handler
  // ---------------------------------------------------------------------------
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
          // ── Case 1: real message already in state (by real ID) ─────────────
          // If the incoming message has server attachments, replace the local copy
          // (removing the blob preview and upload overlay).
          // If the incoming message has no attachments (e.g. initial placeholder broadcast from SendMessageView)
          // and the local message has an in-flight uploading attachment, PRESERVE the local preview!
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

          // ── Case 2: optimistic message pending WS confirmation ────────
          // Find a temporary message whose (conversation, sender_id, content)
          // all match the incoming WS message.
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

          // ── Case 3: new message from another user ───────────────────────────
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

      // -----------------------------------------------------------------------
      // message_deleted — a message in this conversation was soft-deleted
      // -----------------------------------------------------------------------
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

      // -----------------------------------------------------------------------
      // message_removed — a message in this conversation was permanently removed
      // -----------------------------------------------------------------------
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

      // -----------------------------------------------------------------------
      // message_edited — a message in this conversation was edited
      // -----------------------------------------------------------------------
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

      // -----------------------------------------------------------------------
      // chat_cleared — another user (or the same user in another tab) cleared
      // all messages in this conversation.
      // -----------------------------------------------------------------------
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
    removeMessage,
    clearChat,
    uploadAttachment,
    retryAttachment,
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
