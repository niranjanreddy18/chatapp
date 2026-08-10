import { useEffect, useMemo, useRef, useState } from 'react';
import { SendHorizonal, Paperclip, ImagePlus, Reply, Pencil, Trash2, Download, MoreVertical, Wifi, WifiOff, LoaderCircle, Sparkles, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useConversation } from '../../context/ConversationContext';
import { useMessage } from '../../context/MessageContext';
import Avatar from '../common/Avatar';
import Button from '../common/Button';
import Input from '../common/Input';
import EmptyState from '../common/EmptyState';

function ChatWindow() {
  const { selectedConversation, presenceMap } = useConversation();
  const { messages, loading, replyMessage, setReplyMessage, editingMessage, setEditingMessage, sendMessage, sendMessageRest, editMessage, deleteMessage, uploadAttachment, scrollTargetRef, loadMessages, hasMore, page, typingUsers, connectionStatus, startTyping, stopTyping, markMessageRead } = useMessage();
  const [draft, setDraft] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);  // file selected for normal compose upload
  const textareaRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, selectedConversation?.id]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '0px';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 144)}px`;
    }
  }, [draft]);

  const { user } = useAuth();
  const currentUserId = user?.id;

  const handleSend = async () => {
    if (!draft.trim() && !pendingFile) return;
    const content = draft.trim() || pendingFile?.name;
    if (pendingFile) {
      // With a file: send via REST to get a real message ID, then upload.
      setIsUploading(true);
      try {
        const created = await sendMessageRest({ content, replyTo: replyMessage?.id || null });
        if (created?.id) {
          await uploadAttachment({ messageId: created.id, file: pendingFile });
        }
      } catch {
        // errors are already toasted inside sendMessageRest / uploadAttachment
      } finally {
        setIsUploading(false);
        setPendingFile(null);
      }
    } else {
      await sendMessage({ content, replyTo: replyMessage?.id || null });
    }
    setDraft('');
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleTyping = (event) => {
    setDraft(event.target.value);
    if (event.target.value.trim()) {
      startTyping();
      return;
    }
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
  // Stores the file in pendingFile state; it is uploaded when the message is sent.
  const handleNormalFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
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

  const renderAttachment = (attachment) => {
    if (attachment.file_type?.startsWith('image/')) {
      return <img src={attachment.file_url} alt={attachment.file_name} className="mt-2 max-h-48 rounded-xl object-cover" />;
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
            <Avatar name={selectedConversation.name || 'Conversation'} size="md" />
            {selectedConversation.conversation_type !== 'GROUP' && presenceMap[otherParticipant?.user_id]?.is_online && (
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />
            )}
          </div>
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">{selectedConversation.name || 'Conversation'}</h2>
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
          <div className="flex h-full items-center justify-center"><EmptyState title="Start the conversation" description="Send the first message to begin this thread." icon={<Sparkles size={18} />} /></div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => {
              const isMine = message.sender_id === currentUserId;
              const showName = selectedConversation.conversation_type === 'GROUP' && !isMine;
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
                        {message.attachments?.length > 0 && message.attachments.map((attachment) => <div key={attachment.id}>{renderAttachment(attachment)}</div>)}
                      </>
                    )}
                    <div className={`mt-2 flex items-center gap-2 text-[11px] ${isMine ? 'text-sky-100' : 'text-slate-500 dark:text-slate-400'}`}>
                      <span>{new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                      {message.is_edited && <span>• edited</span>}
                      {isMine && <span>{message.read_by?.length ? 'Seen' : 'Sent'}</span>}
                      {isMine && (
                        <div className="flex items-center gap-2">
                          <button onClick={() => { setEditingMessage(message); setDraft(message.content); }}><Pencil size={12} /></button>
                          <button onClick={() => deleteMessage(message.id)}><Trash2 size={12} /></button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {typingUsers.length > 0 && (
              <div className="mt-3 inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
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
                <span className="min-w-0 flex-1 truncate text-sky-700 dark:text-sky-300">{pendingFile.name}</span>
                <button
                  onClick={() => setPendingFile(null)}
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
                onBlur={stopTyping}
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
