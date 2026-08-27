import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { SendHorizonal, Paperclip, ImagePlus, Reply, Pencil, Trash2, Download, MoreVertical, Wifi, WifiOff, LoaderCircle, Sparkles, X, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useConversation } from '../../context/ConversationContext';
import { useMessage } from '../../context/MessageContext';
import Avatar from '../common/Avatar';
import Button from '../common/Button';
import Input from '../common/Input';
import EmptyState from '../common/EmptyState';

function ChatWindow() {
  const { selectedConversation, presenceMap } = useConversation();
  const { messages, loading, replyMessage, setReplyMessage, editingMessage, setEditingMessage, sendMessage, sendMessageRest, editMessage, deleteMessage, uploadAttachment, retryAttachment, scrollTargetRef, loadMessages, hasMore, page, typingUsers, connectionStatus, startTyping, stopTyping, markMessageRead } = useMessage();
  const [draft, setDraft] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);  // { file: File, previewUrl: string }
  const textareaRef = useRef(null);
  const endRef = useRef(null);
  const typingStopTimerRef = useRef(null);

 console.log('[CHAT WINDOW TYPING USERS]', typingUsers);

console.log(
  '[TYPING RENDER CHECK]',
  typingUsers.length,
  typingUsers.map(user => user.username)
);

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

  const { user } = useAuth();
  const currentUserId = user?.id;

  const handleSend = async () => {
    if (!draft.trim() && !pendingFile) return;
    const content = draft.trim() || pendingFile?.file.name;
    if (pendingFile) {
      // With a file: immediately add an optimistic message with a blob-URL
      // preview so the sender sees the image/video before Cloudinary responds.
      setIsUploading(true);
      const tempClientId = `temp-${Date.now()}`;
      // Generate one idempotency key for this logical upload.  The same UUID is
      // used for the first attempt AND every subsequent retry so the backend can
      // return the already-committed Attachment instead of creating a new one.
      const uploadId = crypto.randomUUID();
      const optimisticAttachment = {
        id: tempClientId,
        file_url: pendingFile.previewUrl,
        file_name: pendingFile.file.name,
        file_size: pendingFile.file.size,
        file_type: pendingFile.file.type,
        uploading: true,
        // Keep the original File object on the attachment so the Retry button
        // can pass it directly to uploadAttachment() without re-selecting.
        // _localFile is a client-only field; it is never sent to the backend.
        _localFile: pendingFile.file,
        // Keep the preview URL so we can revoke it at the right time.
        _previewUrl: pendingFile.previewUrl,
        // Idempotency key — reused verbatim on every retry; never regenerated.
        _uploadId: uploadId,
      };
      // Capture before clearing so values are available in the async closure.
      const capturedFile = pendingFile.file;
      const capturedPreviewUrl = pendingFile.previewUrl;
      // Clear the compose-bar chip immediately so the user can start typing.
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
        // Errors are already toasted inside sendMessageRest / uploadAttachment.
        // If sendMessageRest threw, the optimistic message was removed from
        // state, so we can safely revoke the preview URL now.
        // If uploadAttachment threw, the attachment is marked upload_failed and
        // _localFile is still live on the attachment for retry — do NOT revoke.
      } finally {
        // Revoke the blob URL only when it is no longer needed:
        //   (a) upload succeeded → Cloudinary URL now in state
        //   (b) sendMessageRest failed → optimistic message removed from state
        // When uploadAttachment fails we do NOT revoke: the image is still
        // rendered (the browser keeps the decoded pixels) and the Retry button
        // will re-use capturedFile, not the blob URL.  The URL on the
        // attachment (_previewUrl) will be revoked in handleRetry on success.
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

  // handleRetry — called by the Retry button rendered inside a failed attachment.
  // Delegates to retryAttachment() in context which:
  //   (1) flips the attachment back to uploading state (keeps _localFile/_previewUrl)
  //   (2) calls POST /messages/upload/ — never POST /messages/
  //   (3) returns true on success / false on failure
  // Only blob URL revocation is handled here because _previewUrl is client-only.
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
      // NOTE: extended to 30s temporarily to rule out premature stop during debugging.
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

  // handleFileUpload — ONLY for the edit-message "Upload" button.
  // It requires editingMessage to be set (i.e. a persisted message with a real ID).
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

  // handleNormalFileSelect — for the compose-bar attachment button.
  // Stores { file, previewUrl } in pendingFile state so a local blob URL is
  // ready the instant the user clicks Send — no Cloudinary round-trip needed.
  const handleNormalFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    // Create a local blob URL for the immediate optimistic preview.
    const previewUrl = URL.createObjectURL(file);
    setPendingFile({ file, previewUrl });
    // Reset the input so selecting the same file again triggers onChange.
    event.target.value = '';
  };

  // For a private conversation, find the other participant's user_id so we
  // can look them up in the presenceMap that the WebSocket keeps updated.
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

  // ---------------------------------------------------------------------------
  // renderMediaOverlay — shared overlay for images and videos during upload /
  // after failure.  Renders:
  //   • a spinner + dim when uploading: true
  //   • an "Upload failed" label + Retry button when upload_failed: true
  // The Retry button calls handleRetry() which reuses the existing messageId
  // and the original File stored on attachment._localFile.
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // renderAttachment — renders one attachment for a given message.
  // Images and videos receive the uploading/failed overlay.
  // Generic file links are unchanged.
  // messageId is threaded through so handleRetry knows which message to target.
  // ---------------------------------------------------------------------------
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
          <Button variant="ghost" className="rounded-full p-2">
            <MoreVertical size={16} />
          </Button>
        </div>
      </header>

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
            {/* DEBUG — remove after trace */}
            <div style={{ fontSize: '11px', color: 'red', padding: '4px', background: 'rgba(255,0,0,0.05)', border: '1px dashed red' }}>
              DEBUG typingUsers: {JSON.stringify(typingUsers)}
            </div>
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
              // For media messages, 'Sent' must not appear until the Cloudinary
              // upload succeeds.  Text messages have no mediaStatus field so the
              // existing read_by → 'Seen' / 'Sent' logic is unchanged.
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
                          {/* Show status label: uploading media → suppress 'Sent';
                              failed media → suppress 'Sent' (Retry in the image);
                              text messages or successfully uploaded media → Seen/Sent */}
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
            {/* DEBUG — remove after trace */}
            <div style={{ fontSize: '11px', color: 'red', padding: '4px', background: 'rgba(255,0,0,0.05)', border: '1px dashed red', marginTop: '8px' }}>
              DEBUG typingUsers: {JSON.stringify(typingUsers)}
            </div>
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
            {/* Pending-file chip: shown when user has selected a file but not yet sent */}
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
    </div>
  );
}

export default ChatWindow;
