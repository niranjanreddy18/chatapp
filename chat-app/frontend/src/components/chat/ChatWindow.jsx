import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  SendHorizonal, Paperclip, ImagePlus, Reply, Pencil, Trash2,
  Download, MoreVertical, Wifi, WifiOff, LoaderCircle, Sparkles,
  X, RefreshCw, Eraser, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useConversation } from '../../context/ConversationContext';
import { useMessage } from '../../context/MessageContext';
import Avatar from '../common/Avatar';
import Button from '../common/Button';
import Input from '../common/Input';
import EmptyState from '../common/EmptyState';
import Modal from '../common/Modal';

function ChatWindow() {
  const { selectedConversation, presenceMap, deleteConversation } = useConversation();
  const {
    messages, loading, replyMessage, setReplyMessage, editingMessage,
    setEditingMessage, sendMessage, sendMessageRest, editMessage, deleteMessage,
    uploadAttachment, retryAttachment, scrollTargetRef, loadMessages, hasMore,
    page, typingUsers, connectionStatus, startTyping, stopTyping,
    markMessageRead, clearChat,
  } = useMessage();

  const [draft, setDraft] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);

  // ---------- menu + confirmation state ----------
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  // -----------------------------------------------

  const textareaRef = useRef(null);
  const endRef = useRef(null);
  const typingStopTimerRef = useRef(null);

  console.log('[CHAT WINDOW CONVERSATION]', selectedConversation);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, selectedConversation?.id]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '0px';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 144)}px`;
    }
  }, [draft]);

  useEffect(() => () => {
    window.clearTimeout(typingStopTimerRef.current);
  }, []);

  // Close the dropdown menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const { user } = useAuth();
  const currentUserId = user?.id;

  // ---------- Clear Chat handler ----------
  const handleClearChat = async () => {
    if (isClearing || !selectedConversation?.id) return;
    setIsClearing(true);
    try {
      await clearChat(selectedConversation.id);
      setShowClearConfirm(false);
    } catch {
      // error already toasted inside clearChat
    } finally {
      setIsClearing(false);
    }
  };

  // ---------- Delete Conversation handler ----------
  const handleDeleteConversation = async () => {
    if (isDeleting || !selectedConversation?.id) return;
    setIsDeleting(true);
    try {
      await deleteConversation(selectedConversation.id);
      setShowDeleteConfirm(false);
      // selectedConversation is cleared inside deleteConversation — nothing else needed
    } catch {
      // error already toasted inside deleteConversation
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSend = async () => {
    if (!draft.trim() && !pendingFile) return;
    const content = draft.trim() || pendingFile?.file.name;
    if (pendingFile) {
      setIsUploading(true);
      const tempClientId = `temp-${Date.now()}`;
      const uploadId = crypto.randomUUID();
      const optimisticAttachment = {
        id: tempClientId,
        file_url: pendingFile.previewUrl,
        file_name: pendingFile.file.name,
        file_size: pendingFile.file.size,
        file_type: pendingFile.file.type,
        uploading: true,
        _localFile: pendingFile.file,
        _previewUrl: pendingFile.previewUrl,
        _uploadId: uploadId,
      };
      const capturedFile = pendingFile.file;
      const capturedPreviewUrl = pendingFile.previewUrl;
      setPendingFile(null);
      let uploadSucceeded = false;
      try {
        const created = await sendMessageRest({
          content,
          replyTo: replyMessage?.id || null,
          optimisticAttachment,
          tempClientId,
        });
        if (created?.id) {
          await uploadAttachment({
            messageId: created.id,
            file: capturedFile,
            tempAttachmentId: tempClientId,
            uploadId,
          });
          uploadSucceeded = true;
        }
      } catch {
        // Errors toasted inside sendMessageRest / uploadAttachment.
      } finally {
        if (uploadSucceeded) {
          URL.revokeObjectURL(capturedPreviewUrl);
        }
        setIsUploading(false);
      }
    } else {
      await sendMessage({ content, replyTo: replyMessage?.id || null });
    }
    window.clearTimeout(typingStopTimerRef.current);
    stopTyping();
    setDraft('');
  };

  const handleRetry = async ({ messageId, attachment }) => {
    if (!attachment._localFile) {
      toast.error('Original file is no longer available. Please send the image again.');
      return;
    }
    const succeeded = await retryAttachment({ messageId, attachment });
    if (succeeded && attachment._previewUrl) {
      URL.revokeObjectURL(attachment._previewUrl);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleTyping = (event) => {
    setDraft(event.target.value);
    window.clearTimeout(typingStopTimerRef.current);
    if (event.target.value.trim()) {
      console.log('[TYPING HANDLE] calling startTyping', { draft: event.target.value });
      startTyping();
      typingStopTimerRef.current = window.setTimeout(() => {
        console.log('[TYPING HANDLE] 30s timeout fired — calling stopTyping');
        stopTyping();
      }, 30000);
      return;
    }
    console.log('[TYPING HANDLE] empty field — calling stopTyping immediately');
    stopTyping();
  };

  const handleEdit = async (messageId) => {
    const content = draft.trim();
    if (!content) return;
    await editMessage(messageId, content);
    setDraft('');
    setEditingMessage(null);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !editingMessage) return;
    setIsUploading(true);
    try {
      await uploadAttachment({ messageId: editingMessage.id, file });
      setDraft('');
      setEditingMessage(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleNormalFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setPendingFile({ file, previewUrl });
    event.target.value = '';
  };

  const otherParticipant = useMemo(() => {
    if (!selectedConversation || selectedConversation.conversation_type === 'GROUP') return null;
    return selectedConversation.members?.find((m) => m.user_id !== currentUserId) ?? null;
  }, [selectedConversation, currentUserId]);

  const getPresenceLabel = (userId) => {
    const presence = presenceMap[userId];
    if (!presence) return 'Offline';
    return presence.is_online ? 'Online' : `Last seen ${new Date(presence.last_seen).toLocaleString()}`;
  };

  const conversationName = selectedConversation.conversation_type === 'GROUP'
    ? selectedConversation.name || 'Group'
    : otherParticipant?.username || selectedConversation.name || 'Conversation';

  const renderMediaOverlay = (attachment, messageId) => {
    if (attachment.uploading) {
      return (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/30">
          <LoaderCircle size={20} className="animate-spin text-white" />
        </div>
      );
    }
    if (attachment.upload_failed) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-black/50 px-3 py-2">
          <span className="text-[11px] font-medium text-white">Upload failed</span>
          <button
            onClick={() => handleRetry({ messageId, attachment })}
            className="flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-sm hover:bg-white/30 transition"
          >
            <RefreshCw size={10} />
            Retry
          </button>
        </div>
      );
    }
    return null;
  };

  const renderAttachment = (attachment, messageId) => {
    if (attachment.file_type?.startsWith('image/')) {
      return (
        <div className="relative mt-2 inline-block">
          <img
            src={attachment.file_url}
            alt={attachment.file_name}
            className={`max-h-48 rounded-xl object-cover${attachment.uploading ? ' opacity-60' : ''}`}
          />
          {renderMediaOverlay(attachment, messageId)}
        </div>
      );
    }

    if (attachment.file_type?.startsWith('video/')) {
      return (
        <div className="relative mt-2 inline-block">
          <video
            src={attachment.file_url}
            controls={!attachment.uploading && !attachment.upload_failed}
            className={`max-h-48 rounded-xl${attachment.uploading ? ' opacity-60' : ''}`}
          />
          {renderMediaOverlay(attachment, messageId)}
        </div>
      );
    }

    return (
      <a href={attachment.file_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
        <Download size={14} /> {attachment.file_name}
      </a>
    );
  };

  if (!selectedConversation) {
    return <div className="flex h-full items-center justify-center rounded-[32px] border border-slate-200/70 bg-white/80 p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900/70"><EmptyState title="No conversation selected" description="Pick a thread from the sidebar to view the chat experience." icon={<Sparkles size={18} />} /></div>;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[32px] border border-slate-200/70 bg-white/90 shadow-[0_20px_70px_-35px_rgba(2,6,23,0.5)] dark:border-slate-800 dark:bg-slate-900/90">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between border-b border-slate-200/70 px-4 py-4 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar name={conversationName} size="md" />
            {selectedConversation.conversation_type !== 'GROUP' && presenceMap[otherParticipant?.user_id]?.is_online && (
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />
            )}
          </div>
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">{conversationName}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{selectedConversation.conversation_type === 'GROUP' ? `${selectedConversation.member_count || 0} members` : getPresenceLabel(otherParticipant?.user_id)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {connectionStatus === 'connected' ? <Wifi size={14} className="text-emerald-500" /> : connectionStatus === 'connecting' || connectionStatus === 'reconnecting' ? <LoaderCircle size={14} className="animate-spin text-amber-500" /> : <WifiOff size={14} className="text-slate-500" />}
            {connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'connecting' ? 'Connecting...' : connectionStatus === 'reconnecting' ? 'Reconnecting...' : 'Disconnected'}
          </div>

          {/* ── ⋮ Actions menu ──────────────────────────────────────────── */}
          <div className="relative" ref={menuRef}>
            <button
              id="chat-menu-btn"
              onClick={() => setMenuOpen((prev) => !prev)}
              className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="More options"
              aria-haspopup="true"
              aria-expanded={menuOpen}
            >
              <MoreVertical size={16} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full z-20 mt-1 min-w-[180px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                {/* Clear Chat */}
                <button
                  id="clear-chat-menu-item"
                  onClick={() => { setMenuOpen(false); setShowClearConfirm(true); }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Eraser size={15} className="text-amber-500" />
                  Clear Chat
                </button>

                {/* Divider */}
                <div className="mx-3 border-t border-slate-100 dark:border-slate-800" />

                {/* Delete Conversation */}
                <button
                  id="delete-conversation-menu-item"
                  onClick={() => { setMenuOpen(false); setShowDeleteConfirm(true); }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                >
                  <Trash2 size={15} />
                  Delete Conversation
                </button>
              </div>
            )}
          </div>
          {/* ──────────────────────────────────────────────────────────── */}
        </div>
      </header>

      {/* ── Message area ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {hasMore && (
          <div className="mb-4 flex justify-center">
            <Button variant="secondary" onClick={() => loadMessages(page + 1, true)}>Load Older Messages</Button>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="flex animate-pulse items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-800" />
                <div className="flex-1 space-y-2 rounded-[24px] bg-slate-100 p-4 dark:bg-slate-800">
                  <div className="h-3 w-24 rounded-full bg-slate-200 dark:bg-slate-700" />
                  <div className="h-3 w-40 rounded-full bg-slate-200 dark:bg-slate-700" />
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <EmptyState title="Start the conversation" description="Send the first message to begin this thread." icon={<Sparkles size={18} />} />
            {typingUsers.length > 0 && (
              <div className="flex rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {typingUsers.map((typingUser) => typingUser.username).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => {
              const isMine = message.sender_id === currentUserId;
              const showName = selectedConversation.conversation_type === 'GROUP' && !isMine;
              const isMediaUploading = message.mediaStatus === 'uploading';
              const isMediaFailed   = message.mediaStatus === 'failed';
              return (
                <div key={message.id} className={`flex animate-[fadeIn_180ms_ease-out] ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-[24px] px-4 py-3 shadow-sm transition ${isMine ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'}`}>
                    {showName && <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{message.sender_username}</p>}
                    {message.reply_to && (
                      <div className={`mb-3 rounded-xl border px-3 py-2 text-sm ${isMine ? 'border-sky-400/60 bg-sky-500/20' : 'border-slate-300 bg-white/60 dark:border-slate-700 dark:bg-slate-900/60'}`}>
                        <p className="text-[11px] uppercase tracking-wide opacity-70">Reply</p>
                        <p>{message.reply_to.content || 'This message was deleted.'}</p>
                      </div>
                    )}
                    {message.is_deleted ? (
                      <p className="italic text-slate-500">This message was deleted.</p>
                    ) : (
                      <>
                        <p className="whitespace-pre-wrap">{message.content}</p>
                        {message.attachments?.length > 0 && message.attachments.map((attachment) => (
                          <div key={attachment.id}>{renderAttachment(attachment, message.id)}</div>
                        ))}
                      </>
                    )}
                    <div className={`mt-2 flex items-center gap-2 text-[11px] ${isMine ? 'text-sky-100' : 'text-slate-500 dark:text-slate-400'}`}>
                      <span>{new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                      {message.is_edited && <span>• edited</span>}
                      {isMine && (
                        <>
                          {isMediaUploading && (
                            <span className="flex items-center gap-1">
                              <LoaderCircle size={10} className="animate-spin" />
                              Uploading…
                            </span>
                          )}
                          {isMediaFailed && (
                            <span className="text-red-300">Upload failed</span>
                          )}
                          {!isMediaUploading && !isMediaFailed && (
                            <span>{message.read_by?.length ? 'Seen' : 'Sent'}</span>
                          )}
                          <div className="flex items-center gap-2">
                            <button onClick={() => { setEditingMessage(message); setDraft(message.content); }}><Pencil size={12} /></button>
                            <button onClick={() => deleteMessage(message.id)}><Trash2 size={12} /></button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {typingUsers.length > 0 && (
              <div className="mt-3 flex rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {typingUsers.map((typingUser) => typingUser.username).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
              </div>
            )}
            <div ref={scrollTargetRef} />
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* ── Compose bar ───────────────────────────────────────────────── */}
      <div className="border-t border-slate-200/70 p-4 dark:border-slate-800">
        {replyMessage && (
          <div className="mb-3 flex items-start justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
            <div>
              <p className="font-medium">Replying to {replyMessage.sender_username || 'message'}</p>
              <p className="text-slate-500">{replyMessage.content}</p>
            </div>
            <button onClick={() => setReplyMessage(null)} className="text-slate-500">✕</button>
          </div>
        )}

        {editingMessage && (
          <div className="mb-3 rounded-2xl border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-sm">
            <div className="flex items-center justify-between">
              <p className="font-medium text-sky-700 dark:text-sky-400">Editing message</p>
              <button onClick={() => { setEditingMessage(null); setDraft(''); }} className="text-slate-500">✕</button>
            </div>
            <Input value={draft} onChange={(event) => setDraft(event.target.value)} className="mt-2" />
            <div className="mt-2 flex gap-2">
              <Button onClick={() => handleEdit(editingMessage.id)}>{isUploading ? 'Uploading...' : 'Save'}</Button>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-300">
                <Paperclip size={14} /> Upload
                <input type="file" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          </div>
        )}

        {!editingMessage && (
          <div className="flex flex-col gap-2">
            {pendingFile && (
              <div className="flex items-center gap-2 rounded-2xl border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-sm">
                <Paperclip size={14} className="shrink-0 text-sky-600 dark:text-sky-400" />
                <span className="min-w-0 flex-1 truncate text-sky-700 dark:text-sky-300">{pendingFile.file.name}</span>
                <button
                  onClick={() => {
                    URL.revokeObjectURL(pendingFile.previewUrl);
                    setPendingFile(null);
                  }}
                  className="shrink-0 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  aria-label="Remove attachment"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <div className="flex items-end gap-2 rounded-[24px] border border-slate-200 bg-slate-50 p-2 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <button className="rounded-full p-2 text-slate-500 transition hover:bg-slate-200 dark:hover:bg-slate-700" onClick={() => setReplyMessage(messages[messages.length - 1])} aria-label="Reply to last message">
                <Reply size={16} />
              </button>
              <label className="rounded-full p-2 text-slate-500 transition hover:bg-slate-200 dark:hover:bg-slate-700" aria-label="Upload attachment">
                <ImagePlus size={16} />
                <input type="file" className="hidden" onChange={handleNormalFileSelect} />
              </label>
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={handleTyping}
                onKeyDown={handleKeyDown}
                onBlur={() => { console.log('[TYPING HANDLE] textarea onBlur — calling stopTyping'); stopTyping(); }}
                placeholder={pendingFile ? 'Add a message or just send the file…' : 'Message'}
                rows={1}
                className="max-h-36 min-h-[40px] flex-1 resize-none overflow-hidden border-0 bg-transparent px-2 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
              />
              <Button onClick={handleSend} className="rounded-full px-3 py-2" disabled={isUploading} aria-label="Send message">
                {isUploading ? <LoaderCircle size={16} className="animate-spin" /> : <SendHorizonal size={16} />}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Clear Chat Confirmation Modal ─────────────────────────────── */}
      <Modal
        open={showClearConfirm}
        title="Clear Chat"
        onClose={() => !isClearing && setShowClearConfirm(false)}
      >
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/60 dark:bg-amber-950/30">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              All messages in <strong>{conversationName}</strong> will be deleted for everyone.
              This cannot be undone.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              id="confirm-clear-btn"
              className="flex-1 gap-2 bg-amber-500 hover:bg-amber-600 focus:ring-amber-500"
              disabled={isClearing}
              onClick={handleClearChat}
            >
              {isClearing ? (
                <><LoaderCircle size={15} className="animate-spin" /> Clearing…</>
              ) : (
                <><Eraser size={15} /> Clear Chat</>
              )}
            </Button>
            <Button
              variant="secondary"
              disabled={isClearing}
              onClick={() => setShowClearConfirm(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Delete Conversation Confirmation Modal ────────────────────── */}
      <Modal
        open={showDeleteConfirm}
        title="Delete Conversation"
        onClose={() => !isDeleting && setShowDeleteConfirm(false)}
      >
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-800/60 dark:bg-rose-950/30">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-rose-500" />
            <p className="text-sm text-rose-800 dark:text-rose-300">
              You will be removed from <strong>{conversationName}</strong>.
              {selectedConversation.conversation_type === 'PRIVATE'
                ? ' The other person will keep their message history.'
                : ' Other group members will keep their access.'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              id="confirm-delete-btn"
              className="flex-1 gap-2 bg-rose-600 hover:bg-rose-700 focus:ring-rose-500"
              disabled={isDeleting}
              onClick={handleDeleteConversation}
            >
              {isDeleting ? (
                <><LoaderCircle size={15} className="animate-spin" /> Removing…</>
              ) : (
                <><Trash2 size={15} /> Delete Conversation</>
              )}
            </Button>
            <Button
              variant="secondary"
              disabled={isDeleting}
              onClick={() => setShowDeleteConfirm(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default ChatWindow;
