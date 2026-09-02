import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  SendHorizonal,
  Paperclip,
  Image,
  FileText,
  Reply,
  Pencil,
  Trash2,
  Download,
  MoreVertical,
  LoaderCircle,
  Sparkles,
  X,
  RefreshCw,
  Eraser,
  AlertTriangle,
  Video,
  Search,
  Smile,
  Mic,
  MicOff,
  VideoOff,
  Check,
  CheckCheck,
  ArrowLeft,
  Info,
  PhoneOff,
  Plus,
  Play,
  ImageOff,
  User,
  Mail,
  Shield,
  Pause,
  Star,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useConversation } from '../../context/ConversationContext';
import { useMessage } from '../../context/MessageContext';
import Avatar, { resolveAvatarUrl } from '../common/Avatar';
import Button from '../common/Button';
import EmptyState from '../common/EmptyState';
import Modal from '../common/Modal';

const QUICK_EMOJIS = ['😊', '👍', '❤️', '😂', '🔥', '🎉', '🚀', '👏', '🙌', '💯'];

function ImageLightbox({ media, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!media) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black/95 backdrop-blur-md p-4 animate-[fadeIn_150ms_ease-out]"
      onClick={onClose}
    >
      {/* Top Header Bar */}
      <div
        className="flex w-full items-center justify-between px-2 sm:px-6 py-2 text-white z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{media.file_name || 'Photo'}</p>
          {media.sender_username && (
            <p className="text-xs text-white/70">Sent by {media.sender_username}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <a
            href={media.file_url}
            download={media.file_name}
            target="_blank"
            rel="noreferrer"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
            title="Download full size"
          >
            <Download size={18} />
          </a>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main Image Container */}
      <div
        className="flex flex-1 items-center justify-center w-full max-h-[85vh] p-2"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={media.file_url}
          alt={media.file_name || 'Media'}
          className="max-h-full max-w-full rounded-lg object-contain shadow-2xl select-none"
        />
      </div>

      {/* Bottom spacer */}
      <div className="h-6" />
    </div>
  );
}

function ImageAttachmentItem({
  attachment,
  messageId,
  onOpenLightbox,
  onRetry,
  hasCaption,
  statusElement,
}) {
  const [hasError, setHasError] = useState(false);

  return (
    <div className="relative overflow-hidden rounded-[14px] bg-slate-200/50 dark:bg-slate-900/50 max-w-full sm:max-w-[340px] max-h-[380px] flex items-center justify-center group/img">
      {/* Error Fallback */}
      {hasError ? (
        <div className="flex h-36 w-60 flex-col items-center justify-center gap-1.5 p-4 text-slate-400 text-xs rounded-[14px] bg-slate-100 dark:bg-slate-800">
          <ImageOff size={24} className="text-slate-400" />
          <span>Image unavailable</span>
        </div>
      ) : (
        <img
          src={attachment.file_url}
          alt={attachment.file_name}
          onError={() => setHasError(true)}
          onClick={() =>
            !attachment.uploading && !attachment.upload_failed && onOpenLightbox(attachment)
          }
          className={`max-h-[380px] w-full rounded-[14px] object-cover cursor-pointer transition duration-150 group-hover/img:brightness-[0.97] ${
            attachment.uploading ? 'opacity-60' : ''
          }`}
        />
      )}

      {/* Floating WhatsApp-style timestamp overlay when message has no caption */}
      {!hasCaption && !hasError && !attachment.uploading && !attachment.upload_failed && (
        <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/50 backdrop-blur-sm px-2 py-0.5 text-[10px] text-white shadow-sm tabular-nums pointer-events-none select-none">
          {statusElement}
        </div>
      )}

      {/* Uploading Overlay */}
      {attachment.uploading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-[14px] bg-black/40">
          <LoaderCircle size={22} className="animate-spin text-white" />
        </div>
      )}

      {/* Upload Failed Overlay */}
      {attachment.upload_failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-[14px] bg-black/60 px-3 py-2">
          <span className="text-[11px] font-medium text-white">Upload failed</span>
          <button
            onClick={() => onRetry({ messageId, attachment })}
            className="flex items-center gap-1 rounded-full bg-white/25 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/35 transition"
          >
            <RefreshCw size={10} /> Retry
          </button>
        </div>
      )}
    </div>
  );
}

function VideoAttachmentItem({
  attachment,
  messageId,
  onRetry,
  hasCaption,
  statusElement,
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef(null);

  const handleStartPlay = () => {
    setIsPlaying(true);
    setTimeout(() => {
      videoRef.current?.play();
    }, 50);
  };

  return (
    <div className="relative overflow-hidden rounded-[14px] bg-black/90 max-w-full sm:max-w-[340px] max-h-[380px] flex items-center justify-center group/video">
      <video
        ref={videoRef}
        src={attachment.file_url}
        controls={isPlaying && !attachment.uploading && !attachment.upload_failed}
        playsInline
        preload="metadata"
        className={`max-h-[380px] w-full rounded-[14px] object-cover ${
          attachment.uploading ? 'opacity-60' : ''
        }`}
        onPause={() => !videoRef.current?.seeking && setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />

      {/* WhatsApp-style Center Play Button before playback */}
      {!isPlaying && !attachment.uploading && !attachment.upload_failed && (
        <button
          type="button"
          onClick={handleStartPlay}
          className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition group-hover/video:scale-105"
          title="Play video"
          aria-label="Play video"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm shadow-lg border border-white/20 hover:bg-black/80 transition">
            <Play size={22} className="ml-0.5 fill-white text-white" />
          </div>
        </button>
      )}

      {/* Floating WhatsApp-style timestamp overlay when message has no caption */}
      {!hasCaption && !isPlaying && !attachment.uploading && !attachment.upload_failed && (
        <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/50 backdrop-blur-sm px-2 py-0.5 text-[10px] text-white shadow-sm tabular-nums pointer-events-none select-none">
          {statusElement}
        </div>
      )}

      {/* Uploading Overlay */}
      {attachment.uploading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-[14px] bg-black/40">
          <LoaderCircle size={22} className="animate-spin text-white" />
        </div>
      )}

      {/* Upload Failed Overlay */}
      {attachment.upload_failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-[14px] bg-black/60 px-3 py-2">
          <span className="text-[11px] font-medium text-white">Upload failed</span>
          <button
            onClick={() => onRetry({ messageId, attachment })}
            className="flex items-center gap-1 rounded-full bg-white/25 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/35 transition"
          >
            <RefreshCw size={10} /> Retry
          </button>
        </div>
      )}
    </div>
  );
}

function DocumentAttachmentItem({ attachment }) {
  return (
    <a
      href={attachment.file_url}
      target="_blank"
      rel="noreferrer"
      className="mt-1 inline-flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white/90 px-3.5 py-2 text-xs font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 max-w-full"
    >
      <FileText size={16} className="text-blue-600 shrink-0" />
      <span className="truncate max-w-[180px]">{attachment.file_name}</span>
      <Download size={13} className="text-slate-400 shrink-0" />
    </a>
  );
}

function AudioAttachmentItem({ attachment, isMine, statusElement }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioRef = useRef(null);

  const rawUrl = attachment.file_url || attachment._previewUrl;
  const fileUrl = resolveAvatarUrl(rawUrl);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('durationchange', updateDuration);
    audio.addEventListener('loadeddata', updateDuration);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('durationchange', updateDuration);
      audio.removeEventListener('loadeddata', updateDuration);
      audio.removeEventListener('ended', onEnded);
    };
  }, [fileUrl]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.error('Audio playback error:', err);
          setIsPlaying(false);
        });
    }
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pos * duration;
    setCurrentTime(audio.currentTime);
  };

  const togglePlaybackRate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    audio.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  const formatAudioTime = (seconds) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bars = [40, 65, 30, 80, 55, 90, 45, 70, 35, 85, 60, 100, 50, 75, 40, 95, 60, 40, 70, 50, 30, 80, 60, 45];

  return (
    <div className={`flex flex-col gap-1.5 p-2 rounded-2xl min-w-[220px] sm:min-w-[270px] ${
      isMine ? 'text-white' : 'text-slate-800 dark:text-slate-100'
    }`}>
      <audio ref={audioRef} src={fileUrl} preload="metadata" />

      <div className="flex items-center gap-3">
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition shadow-sm cursor-pointer ${
            isMine
              ? 'bg-white text-blue-600 hover:bg-white/90 active:scale-95'
              : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
          }`}
          title={isPlaying ? 'Pause' : 'Play voice message'}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause size={18} className="fill-current" /> : <Play size={18} className="fill-current ml-0.5" />}
        </button>

        {/* Waveform / Scrub bar */}
        <div className="flex-1 flex flex-col justify-center gap-1">
          <div
            onClick={handleSeek}
            className="group relative flex items-center gap-[2.5px] h-7 cursor-pointer py-1"
            title="Seek audio"
          >
            {bars.map((height, i) => {
              const barProgress = (i / bars.length) * 100;
              const isPassed = progressPercent >= barProgress;
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-full transition-all duration-100 ${
                    isPassed
                      ? isMine
                        ? 'bg-white'
                        : 'bg-blue-600 dark:bg-blue-400'
                      : isMine
                      ? 'bg-white/35 group-hover:bg-white/50'
                      : 'bg-slate-300 dark:bg-slate-600 group-hover:bg-slate-400'
                  }`}
                  style={{
                    height: `${height}%`,
                    minHeight: '4px',
                  }}
                />
              );
            })}
          </div>

          {/* Time & Speed Controls */}
          <div className="flex items-center justify-between text-[11px] tabular-nums opacity-90 font-medium">
            <span>{formatAudioTime(currentTime || duration)}</span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlaybackRate}
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold transition cursor-pointer ${
                  isMine
                    ? 'bg-white/20 hover:bg-white/30 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200'
                }`}
                title="Playback speed"
              >
                {playbackRate}x
              </button>

              <a
                href={fileUrl}
                download={attachment.file_name || 'voice-message.webm'}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={`p-0.5 rounded transition ${
                  isMine ? 'hover:text-white/80' : 'hover:text-blue-600'
                }`}
                title="Download audio"
              >
                <Download size={13} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatWindow({ onBackMobile }) {
  const {
    selectedConversation,
    presenceMap,
    deleteConversation,
    toggleFavorite,
    isFavorite,
  } = useConversation();
  const {
    messages,
    loading,
    replyMessage,
    setReplyMessage,
    editingMessage,
    setEditingMessage,
    sendMessage,
    sendMessageRest,
    editMessage,
    deleteMessage,
    removeMessage,
    uploadAttachment,
    retryAttachment,
    scrollTargetRef,
    loadMessages,
    hasMore,
    page,
    typingUsers,
    connectionStatus,
    startTyping,
    stopTyping,
    clearChat,
  } = useMessage();

  const [draft, setDraft] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);

  // Search inside chat
  const [showSearchInChat, setShowSearchInChat] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');

  // Dropdown menu state
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Attachment popover state
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const attachmentMenuRef = useRef(null);

  // Emoji picker popover state
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const emojiPickerRef = useRef(null);

  // Lightbox preview modal state
  const [lightboxMedia, setLightboxMedia] = useState(null);

  // Active call modal state
  const [activeCall, setActiveCall] = useState(null); // { type: 'voice' | 'video', isMuted: false, isVideoOff: false }
  const [callDuration, setCallDuration] = useState(0);

  // Contact Info modal
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [viewingMemberProfile, setViewingMemberProfile] = useState(null);

  // Clear & Delete confirmation modals
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const textareaRef = useRef(null);
  const endRef = useRef(null);
  const fileInputRef = useRef(null);
  const docInputRef = useRef(null);
  const typingStopTimerRef = useRef(null);
  const callTimerRef = useRef(null);

  // Voice recording state & refs
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  const startVoiceRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error('Voice recording is not supported in this browser.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
        ? 'audio/ogg;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start(100);
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Mic access error:', err);
      toast.error('Microphone access denied or unavailable.');
    }
  };

  const cancelVoiceRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    setIsRecording(false);
    setRecordingDuration(0);
    audioChunksRef.current = [];
    toast('Recording discarded', { icon: '🗑️' });
  };

  const stopAndSendVoiceRecording = () => {
    if (recordingDuration < 1) {
      toast.error('Voice message too short');
      cancelVoiceRecording();
      return;
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }

    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    recorder.onstop = async () => {
      try {
        const mimeType = recorder.mimeType || 'audio/webm';
        const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'm4a' : 'webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const audioFile = new File([audioBlob], `voice-message-${Date.now()}.${ext}`, {
          type: mimeType,
        });

        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((track) => track.stop());
        }
        setIsRecording(false);
        setRecordingDuration(0);
        audioChunksRef.current = [];

        if (selectedConversation?.id) {
          const tempClientId = `temp-voice-${Date.now()}`;
          const uploadId = crypto.randomUUID();
          const localPreviewUrl = URL.createObjectURL(audioFile);

          const optimisticAttachment = {
            id: tempClientId,
            file_url: localPreviewUrl,
            file_name: audioFile.name,
            file_size: audioFile.size,
            file_type: audioFile.type || mimeType,
            uploading: true,
            _localFile: audioFile,
            _previewUrl: localPreviewUrl,
            _uploadId: uploadId,
          };

          setIsUploading(true);
          try {
            const created = await sendMessageRest({
              content: 'Voice message',
              replyTo: replyMessage?.id || null,
              optimisticAttachment,
              tempClientId,
            });

            if (created?.id) {
              await uploadAttachment({
                messageId: created.id,
                file: audioFile,
                tempAttachmentId: tempClientId,
                uploadId,
              });
            }
            setReplyMessage(null);
            toast.success('Voice message sent');
          } catch (uploadErr) {
            console.error('Failed to upload voice message:', uploadErr);
          } finally {
            setIsUploading(false);
          }
        }
      } catch (err) {
        console.error('Failed to process voice message:', err);
        toast.error('Failed to process voice message');
      }
    };

    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
  };

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const { user } = useAuth();
  const currentUserId = user?.id;

  // Auto scroll to bottom when messages update
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, selectedConversation?.id]);

  // Adjust textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '0px';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [draft]);

  // Call timer effect
  useEffect(() => {
    if (activeCall) {
      setCallDuration(0);
      callTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(callTimerRef.current);
    }
    return () => clearInterval(callTimerRef.current);
  }, [activeCall]);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
      if (attachmentMenuOpen && attachmentMenuRef.current && !attachmentMenuRef.current.contains(e.target)) {
        setAttachmentMenuOpen(false);
      }
      if (emojiPickerOpen && emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setEmojiPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen, attachmentMenuOpen, emojiPickerOpen]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleClearChat = async () => {
    if (isClearing || !selectedConversation?.id) return;
    setIsClearing(true);
    try {
      await clearChat(selectedConversation.id);
      setShowClearConfirm(false);
    } finally {
      setIsClearing(false);
    }
  };

  const handleDeleteConversation = async () => {
    if (isDeleting || !selectedConversation?.id) return;
    setIsDeleting(true);
    try {
      await deleteConversation(selectedConversation.id);
      setShowDeleteConfirm(false);
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
    setReplyMessage(null);
  };

  const handleRetry = async ({ messageId, attachment }) => {
    if (!attachment._localFile) {
      toast.error('Original file is no longer available.');
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
      startTyping();
      typingStopTimerRef.current = window.setTimeout(() => {
        stopTyping();
      }, 30000);
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

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setPendingFile({ file, previewUrl });
    event.target.value = '';
    setAttachmentMenuOpen(false);
  };

  const insertEmoji = (emoji) => {
    setDraft((prev) => prev + emoji);
    setEmojiPickerOpen(false);
    textareaRef.current?.focus();
  };

  // ---------------------------------------------------------------------------
  // Derived Data
  // ---------------------------------------------------------------------------
  const otherParticipant = useMemo(() => {
    if (!selectedConversation || selectedConversation.conversation_type === 'GROUP') return null;
    return selectedConversation.members?.find((m) => m.user_id !== currentUserId) ?? null;
  }, [selectedConversation, currentUserId]);

  const conversationName = useMemo(() => {
    if (!selectedConversation) return '';
    if (selectedConversation.conversation_type === 'GROUP') {
      return selectedConversation.name || 'Group';
    }
    return otherParticipant?.username || selectedConversation.name || 'Conversation';
  }, [selectedConversation, otherParticipant]);

  const conversationAvatar = useMemo(() => {
    if (!selectedConversation) return null;
    if (selectedConversation.conversation_type === 'GROUP') {
      return selectedConversation.avatar;
    }
    return otherParticipant?.avatar || selectedConversation.avatar || null;
  }, [selectedConversation, otherParticipant]);

  const presenceInfo = useMemo(() => {
    if (!otherParticipant) return null;
    return presenceMap[otherParticipant.user_id] ?? null;
  }, [presenceMap, otherParticipant]);

  const statusSubtitle = useMemo(() => {
    if (!selectedConversation) return '';
    if (selectedConversation.conversation_type === 'GROUP') {
      return `${selectedConversation.member_count || selectedConversation.members?.length || 0} members`;
    }
    if (presenceInfo?.is_online) {
      return 'Online';
    }
    if (presenceInfo?.last_seen) {
      const lastSeen = new Date(presenceInfo.last_seen);
      return `Last seen ${lastSeen.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    }
    return 'Offline';
  }, [selectedConversation, presenceInfo]);

  // Filtered messages for in-chat search
  const displayedMessages = useMemo(() => {
    if (!chatSearchQuery.trim()) return messages;
    const q = chatSearchQuery.toLowerCase();
    return messages.filter(
      (m) =>
        m.content?.toLowerCase().includes(q) ||
        m.sender_username?.toLowerCase().includes(q)
    );
  }, [messages, chatSearchQuery]);

  const formatCallTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!selectedConversation) {
    return (
      <div className="flex h-full items-center justify-center bg-[#EDECEC] dark:bg-slate-950 p-8 text-center">
        <EmptyState
          title="No conversation selected"
          description="Select a conversation from the sidebar to begin messaging."
          icon={<Sparkles size={20} />}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-[#EDECEC] dark:bg-slate-950 select-none overflow-hidden relative">
      {/* ── Chat Header ─────────────────────────────────────────────────────── */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 dark:border-slate-800 bg-[#F5F4F2] dark:bg-slate-900 px-4 shadow-sm z-10">
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile Back Button */}
          {onBackMobile && (
            <button
              onClick={onBackMobile}
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 transition lg:hidden"
              aria-label="Back to conversations"
            >
              <ArrowLeft size={18} />
            </button>
          )}

          {/* Avatar with presence */}
          <div
            className="cursor-pointer"
            onClick={() => setShowContactInfo(true)}
            title="View contact info"
          >
            <Avatar
              name={conversationName}
              src={conversationAvatar}
              size="md"
              isOnline={presenceInfo?.is_online}
              showStatus={selectedConversation.conversation_type !== 'GROUP'}
            />
          </div>

          {/* Name & Status */}
          <div
            className="min-w-0 cursor-pointer"
            onClick={() => setShowContactInfo(true)}
          >
            <h2 className="truncate text-[15px] font-semibold text-slate-900 dark:text-slate-50 leading-tight">
              {conversationName}
            </h2>
            <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              {presenceInfo?.is_online && selectedConversation.conversation_type !== 'GROUP' && (
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
              )}
              <span>{statusSubtitle}</span>
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-1">
          {/* Star / Unstar conversation button */}
          <button
            type="button"
            onClick={() => toggleFavorite(selectedConversation.id)}
            className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors cursor-pointer ${
              isFavorite(selectedConversation.id)
                ? 'text-amber-400 hover:bg-amber-500/10'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
            }`}
            title={isFavorite(selectedConversation.id) ? 'Remove from starred' : 'Add to starred'}
            aria-label={isFavorite(selectedConversation.id) ? 'Remove from starred' : 'Add to starred'}
          >
            <Star size={17} className={isFavorite(selectedConversation.id) ? 'fill-amber-400' : ''} />
          </button>

          {/* Search in chat */}
          <button
            onClick={() => {
              setShowSearchInChat((prev) => !prev);
              setChatSearchQuery('');
            }}
            className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
              showSearchInChat
                ? 'bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
            }`}
            title="Search in conversation"
            aria-label="Search in conversation"
          >
            <Search size={17} />
          </button>

          {/* More Options Dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              id="chat-menu-btn"
              onClick={() => setMenuOpen((prev) => !prev)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors"
              aria-label="More options"
              aria-expanded={menuOpen}
            >
              <MoreVertical size={17} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1.5 z-40 w-52 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900 animate-[fadeIn_120ms_ease-out]">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setShowContactInfo(true);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition"
                >
                  <Info size={15} /> Contact info
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    toggleFavorite(selectedConversation.id);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition"
                >
                  <Star size={15} className={isFavorite(selectedConversation.id) ? 'fill-amber-400 text-amber-400' : ''} />
                  {isFavorite(selectedConversation.id) ? 'Remove from starred' : 'Star conversation'}
                </button>
                <button
                  id="clear-chat-menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    setShowClearConfirm(true);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30 transition"
                >
                  <Eraser size={15} /> Clear messages
                </button>
                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                <button
                  id="delete-conversation-menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    setShowDeleteConfirm(true);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30 transition"
                >
                  <Trash2 size={15} /> Delete conversation
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── In-Chat Search Bar (Collapsible) ─────────────────────────────────── */}
      {showSearchInChat && (
        <div className="flex items-center gap-2 border-b border-slate-200 bg-white/90 px-4 py-2 dark:border-slate-800 dark:bg-slate-900/90 shadow-sm animate-[fadeIn_120ms_ease-out] z-10">
          <Search size={15} className="text-slate-400" />
          <input
            type="text"
            value={chatSearchQuery}
            onChange={(e) => setChatSearchQuery(e.target.value)}
            placeholder="Search messages in this chat…"
            className="flex-1 bg-transparent text-xs text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
            autoFocus
          />
          {chatSearchQuery && (
            <span className="text-[11px] font-medium text-slate-400">
              {displayedMessages.length} found
            </span>
          )}
          <button
            onClick={() => {
              setShowSearchInChat(false);
              setChatSearchQuery('');
            }}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* ── Scrollable Message Area ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-5 space-y-3.5 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
        {hasMore && (
          <div className="flex justify-center pb-2">
            <button
              onClick={() => loadMessages(page + 1, true)}
              className="rounded-full bg-white/80 dark:bg-slate-800/80 px-3.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-white transition"
            >
              Load Older Messages
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}
              >
                <div className="h-12 w-48 animate-pulse rounded-2xl bg-white/70 dark:bg-slate-800/70" />
              </div>
            ))}
          </div>
        ) : displayedMessages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center py-16">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 dark:bg-slate-800 shadow-sm text-blue-600 mb-3">
              <Sparkles size={20} />
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {chatSearchQuery ? `No messages matching "${chatSearchQuery}"` : 'No messages yet'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
              {chatSearchQuery
                ? 'Try a different keyword or clear the search query.'
                : 'Send a message below to start the conversation.'}
            </p>
          </div>
        ) : (
          displayedMessages.map((message) => {
            const isMine = message.sender_id === currentUserId;
            const showSenderName = selectedConversation.conversation_type === 'GROUP' && !isMine;
            const isMediaUploading = message.mediaStatus === 'uploading';
            const isMediaFailed = message.mediaStatus === 'failed';
            const isSeen = (message.read_by?.length ?? 0) > 0;
            const hasAttachments = Boolean(message.attachments?.length);
            const hasMedia = message.attachments?.some(
              (a) => a.file_type?.startsWith('image/') || a.file_type?.startsWith('video/'),
            );
            // Caption is true if message has content that is not just the fallback file_name
            const hasCaption = Boolean(
              message.content && !message.attachments?.some((a) => a.file_name === message.content),
            );

            const statusElement = (
              <>
                <span>
                  {new Date(message.created_at).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>

                {message.is_edited && <span>• edited</span>}

                {isMine && (
                  <span className="flex items-center gap-0.5 ml-0.5">
                    {isMediaUploading ? (
                      <LoaderCircle size={11} className="animate-spin text-white" />
                    ) : isMediaFailed ? (
                      <span className="text-rose-200 font-bold">!</span>
                    ) : isSeen ? (
                      <CheckCheck size={14} className="text-sky-200 stroke-[2.5]" title="Seen" />
                    ) : (
                      <Check size={14} className="text-blue-200" title="Sent" />
                    )}
                  </span>
                )}
              </>
            );

            return (
              <div
                key={message.id}
                id={`msg-${message.id}`}
                className={`group flex items-end gap-2 animate-[fadeIn_150ms_ease-out] ${
                  isMine ? 'justify-end' : 'justify-start'
                }`}
              >
                {/* Incoming Message Avatar for groups */}
                {showSenderName && (
                  <button
                    type="button"
                    onClick={() => {
                      const memberObj = selectedConversation.members?.find(
                        (m) => m.user_id === message.sender_id,
                      );
                      setViewingMemberProfile(
                        memberObj || {
                          user_id: message.sender_id,
                          username: message.sender_username,
                          avatar: message.sender_avatar,
                        },
                      );
                    }}
                    className="mb-1 hidden sm:block cursor-pointer hover:opacity-80 transition"
                    title={`View ${message.sender_username}'s profile`}
                  >
                    <Avatar name={message.sender_username} src={message.sender_avatar} size="xs" />
                  </button>
                )}

                <div
                  className={`relative max-w-[85%] sm:max-w-[70%] shadow-sm transition-all duration-150 ${
                    hasMedia
                      ? 'p-1 sm:p-1.5'
                      : 'px-4 py-2.5'
                  } ${
                    isMine
                      ? 'bg-blue-600 text-white rounded-[20px] rounded-br-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-[20px] rounded-bl-sm border border-slate-200/50 dark:border-slate-700/50'
                  }`}
                >
                  {/* Group Sender Name */}
                  {showSenderName && (
                    <p className={`text-[11px] font-bold text-blue-600 dark:text-blue-400 ${hasMedia ? 'px-2 pt-1 pb-0.5' : 'mb-1'}`}>
                      {message.sender_username}
                    </p>
                  )}

                  {/* Reply Quote Preview */}
                  {message.reply_to && (
                    <div
                      className={`rounded-xl border-l-4 px-3 py-1.5 text-xs ${
                        hasMedia ? 'mx-1 mb-1.5' : 'mb-2'
                      } ${
                        isMine
                          ? 'border-white/80 bg-white/15 text-white/90'
                          : 'border-blue-600 bg-slate-100/90 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                        {message.reply_to.sender_username || 'Reply'}
                      </p>
                      <p className="truncate text-xs">
                        {message.reply_to.is_deleted ? 'This message was deleted.' : (message.reply_to.content || 'Attachment')}
                      </p>
                    </div>
                  )}

                  {/* Message Body */}
                  {message.is_deleted ? (
                    <div className="flex items-center justify-between gap-3 px-1 py-0.5">
                      <p className="italic opacity-60 text-xs">This message was deleted.</p>
                      {isMine && (
                        <button
                          onClick={() => removeMessage(message.id)}
                          className="opacity-60 hover:opacity-100 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition p-0.5 rounded cursor-pointer"
                          title="Remove from chat"
                          aria-label="Remove from chat"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Attachments */}
                      {hasAttachments && (
                        <div className="space-y-1.5">
                          {message.attachments.map((att) => {
                            if (att.file_type?.startsWith('image/')) {
                              return (
                                <ImageAttachmentItem
                                  key={att.id}
                                  attachment={att}
                                  messageId={message.id}
                                  onOpenLightbox={(media) =>
                                    setLightboxMedia({
                                      ...media,
                                      sender_username: message.sender_username,
                                      created_at: message.created_at,
                                    })
                                  }
                                  onRetry={handleRetry}
                                  hasCaption={hasCaption}
                                  statusElement={statusElement}
                                />
                              );
                            }
                            if (att.file_type?.startsWith('video/')) {
                              return (
                                <VideoAttachmentItem
                                  key={att.id}
                                  attachment={att}
                                  messageId={message.id}
                                  onRetry={handleRetry}
                                  hasCaption={hasCaption}
                                  statusElement={statusElement}
                                />
                              );
                            }
                            if (
                              att.file_type?.startsWith('audio/') ||
                              /\.(mp3|wav|ogg|m4a|aac|webm|flac)$/i.test(att.file_name || '')
                            ) {
                              return (
                                <AudioAttachmentItem
                                  key={att.id}
                                  attachment={att}
                                  isMine={isMine}
                                  statusElement={statusElement}
                                />
                              );
                            }
                            return <DocumentAttachmentItem key={att.id} attachment={att} />;
                          })}
                        </div>
                      )}

                      {/* Text content / caption */}
                      {(!hasMedia || hasCaption) && message.content && (
                        <p
                          className={`whitespace-pre-wrap leading-relaxed select-text font-normal text-sm ${
                            hasMedia ? 'px-2.5 pt-1.5 pb-0.5' : ''
                          }`}
                        >
                          {message.content}
                        </p>
                      )}

                      {/* Bottom Footer for text messages or media with caption */}
                      {(!hasMedia || hasCaption || !message.attachments?.every((a) => a.file_type?.startsWith('image/') || a.file_type?.startsWith('video/'))) && (
                        <div
                          className={`flex items-center justify-end gap-1.5 text-[10px] tabular-nums select-none ${
                            hasMedia ? 'px-2.5 pb-0.5 pt-0.5' : 'mt-1'
                          } ${
                            isMine ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {statusElement}
                        </div>
                      )}
                    </>
                  )}

                  {/* Hover Quick Action Buttons for active messages */}
                  {!message.is_deleted && (
                    <div
                      className={`absolute top-1.5 hidden group-hover:flex items-center gap-1 rounded-full bg-white/90 dark:bg-slate-900/90 p-1 shadow-md border border-slate-200 dark:border-slate-700 z-10 ${
                        isMine ? '-left-16' : '-right-16'
                      }`}
                    >
                      <button
                        onClick={() => setReplyMessage(message)}
                        className="rounded-full p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 transition"
                        title="Reply"
                      >
                        <Reply size={13} />
                      </button>
                      {isMine && (
                        <>
                          <button
                            onClick={() => {
                              setEditingMessage(message);
                              setDraft(message.content);
                            }}
                            className="rounded-full p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 transition"
                            title="Edit"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => deleteMessage(message.id)}
                            className="rounded-full p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-rose-600 transition"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {/* Hover Quick Action for Deleted Messages (Permanently Remove from UI) */}
                  {message.is_deleted && isMine && (
                    <div
                      className={`absolute top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1 rounded-full bg-white/90 dark:bg-slate-900/90 p-1 shadow-md border border-slate-200 dark:border-slate-700 z-10 ${
                        isMine ? '-left-8' : '-right-8'
                      }`}
                    >
                      <button
                        onClick={() => removeMessage(message.id)}
                        className="rounded-full p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-rose-600 transition"
                        title="Remove deleted message"
                        aria-label="Remove deleted message"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 animate-[fadeIn_150ms_ease-out]">
            <div className="flex items-center gap-1.5 rounded-full bg-white/90 dark:bg-slate-800/90 px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 shadow-sm border border-slate-200/60 dark:border-slate-700/60">
              <span className="flex gap-1 items-center">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-bounce" />
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-bounce [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-bounce [animation-delay:300ms]" />
              </span>
              <span className="font-medium">
                {typingUsers.map((u) => u.username).join(', ')}{' '}
                {typingUsers.length === 1 ? 'is' : 'are'} typing…
              </span>
            </div>
          </div>
        )}

        <div ref={scrollTargetRef} />
        <div ref={endRef} />
      </div>

      {/* ── Reply / Edit Banner (if active) ─────────────────────────────────── */}
      {replyMessage && (
        <div className="mx-4 sm:mx-8 mb-1 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/90 px-3.5 py-2 text-xs dark:border-blue-800/60 dark:bg-blue-950/40 shadow-sm animate-[fadeIn_100ms_ease-out]">
          <div className="flex items-center gap-2 min-w-0">
            <Reply size={14} className="text-blue-600 shrink-0" />
            <div className="min-w-0">
              <span className="font-semibold text-blue-900 dark:text-blue-300">
                Replying to {replyMessage.sender_username || 'message'}:
              </span>{' '}
              <span className="truncate text-slate-600 dark:text-slate-400">
                {replyMessage.content}
              </span>
            </div>
          </div>
          <button
            onClick={() => setReplyMessage(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {editingMessage && (
        <div className="mx-4 sm:mx-8 mb-1 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/90 px-3.5 py-2 text-xs dark:border-amber-800/60 dark:bg-amber-950/40 shadow-sm animate-[fadeIn_100ms_ease-out]">
          <div className="flex items-center gap-2 min-w-0">
            <Pencil size={14} className="text-amber-600 shrink-0" />
            <span className="font-semibold text-amber-900 dark:text-amber-300">
              Editing message
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleEdit(editingMessage.id)}
              className="font-bold text-amber-700 hover:underline dark:text-amber-400"
            >
              Save
            </button>
            <button
              onClick={() => {
                setEditingMessage(null);
                setDraft('');
              }}
              className="text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {pendingFile && (
        <div className="mx-4 sm:mx-8 mb-1 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/90 px-3.5 py-2 text-xs dark:border-blue-800/60 dark:bg-blue-950/40 shadow-sm animate-[fadeIn_100ms_ease-out]">
          <div className="flex items-center gap-2 min-w-0">
            <Paperclip size={14} className="text-blue-600 shrink-0" />
            <span className="truncate font-medium text-slate-800 dark:text-slate-200">
              {pendingFile.file.name} ({(pendingFile.file.size / 1024).toFixed(0)} KB)
            </span>
          </div>
          <button
            onClick={() => {
              URL.revokeObjectURL(pendingFile.previewUrl);
              setPendingFile(null);
            }}
            className="text-slate-400 hover:text-slate-600"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Fixed Message Composer ─────────────────────────────────────────── */}
      <div className="shrink-0 p-3 sm:px-8 sm:pb-4 pt-1 bg-[#EDECEC] dark:bg-slate-950">
        <div className="relative flex items-end gap-1.5 rounded-2xl bg-white dark:bg-slate-900 px-3 py-2 shadow-md border border-slate-200/80 dark:border-slate-800">
          {/* Live Voice Recording Console */}
          {isRecording ? (
            <div className="flex flex-1 items-center justify-between gap-3 py-1 px-1 animate-[fadeIn_150ms_ease-out]">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
                </span>
                <span className="text-xs font-bold tabular-nums text-rose-600 dark:text-rose-400">
                  {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                </span>
                <span className="text-xs text-slate-400 hidden sm:inline">Recording voice message…</span>
              </div>

              {/* Animated Waveform Bars */}
              <div className="hidden sm:flex items-center gap-1 h-5">
                <div className="w-1 bg-rose-500 rounded-full animate-[pulse_600ms_ease-in-out_infinite] h-4" />
                <div className="w-1 bg-rose-500 rounded-full animate-[pulse_800ms_ease-in-out_infinite] h-6" />
                <div className="w-1 bg-rose-500 rounded-full animate-[pulse_500ms_ease-in-out_infinite] h-3" />
                <div className="w-1 bg-rose-500 rounded-full animate-[pulse_700ms_ease-in-out_infinite] h-5" />
                <div className="w-1 bg-rose-500 rounded-full animate-[pulse_900ms_ease-in-out_infinite] h-2" />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={cancelVoiceRecording}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                  title="Discard voice recording"
                  aria-label="Discard recording"
                >
                  <Trash2 size={16} />
                </button>

                <button
                  type="button"
                  onClick={stopAndSendVoiceRecording}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white shadow-md shadow-blue-500/30 hover:bg-blue-700 transition active:scale-95 cursor-pointer"
                  title="Send voice message"
                  aria-label="Send voice message"
                >
                  <SendHorizonal size={18} />
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Attachment Button & Popover */}
              <div className="relative" ref={attachmentMenuRef}>
                <button
                  type="button"
                  onClick={() => setAttachmentMenuOpen((prev) => !prev)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-blue-600 dark:text-slate-400 dark:hover:bg-slate-800 transition focus:outline-none cursor-pointer"
                  title="Attach media or files"
                  aria-label="Attach media or files"
                >
                  <Plus size={20} />
                </button>

                {attachmentMenuOpen && (
                  <div className="absolute bottom-full left-0 mb-2 w-48 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900 animate-[fadeIn_120ms_ease-out] z-30">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition"
                    >
                      <Image size={16} className="text-blue-600" />
                      Photos & Videos
                    </button>
                    <button
                      type="button"
                      onClick={() => docInputRef.current?.click()}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition"
                    >
                      <FileText size={16} className="text-emerald-600" />
                      Documents
                    </button>
                  </div>
                )}

                {/* Hidden File Inputs */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,audio/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <input
                  ref={docInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>

              {/* Emoji Button & Quick Emoji Popover */}
              <div className="relative" ref={emojiPickerRef}>
                <button
                  type="button"
                  onClick={() => setEmojiPickerOpen((prev) => !prev)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-amber-500 dark:text-slate-400 dark:hover:bg-slate-800 transition focus:outline-none cursor-pointer"
                  title="Add emoji"
                  aria-label="Add emoji"
                >
                  <Smile size={20} />
                </button>

                {emojiPickerOpen && (
                  <div className="absolute bottom-full left-0 mb-2 flex gap-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900 animate-[fadeIn_120ms_ease-out] z-30">
                    {QUICK_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => insertEmoji(emoji)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-base hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                id="chat-message-input"
                value={draft}
                onChange={handleTyping}
                onKeyDown={handleKeyDown}
                onBlur={() => stopTyping()}
                placeholder={
                  pendingFile ? 'Add a caption…' : 'Type a message…'
                }
                rows={1}
                className="max-h-28 min-h-[38px] flex-1 resize-none bg-transparent py-2 px-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none dark:text-slate-100 scrollbar-none"
              />

              {/* Voice / Mic Button (when draft is empty) */}
              {!draft.trim() && !pendingFile ? (
                <button
                  type="button"
                  onClick={startVoiceRecording}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-blue-50 hover:text-blue-600 dark:text-slate-400 dark:hover:bg-slate-800 transition focus:outline-none cursor-pointer"
                  title="Record voice message"
                  aria-label="Record voice message"
                >
                  <Mic size={19} />
                </button>
              ) : (
                <button
                  id="send-message-btn"
                  type="button"
                  onClick={handleSend}
                  disabled={isUploading}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white shadow-md shadow-blue-600/30 transition hover:bg-blue-700 active:scale-95 disabled:opacity-50 focus:outline-none cursor-pointer"
                  title="Send message"
                  aria-label="Send message"
                >
                  {isUploading ? (
                    <LoaderCircle size={16} className="animate-spin" />
                  ) : (
                    <SendHorizonal size={16} />
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Active Call Modal ────────────────────────────────────────────────── */}
      {activeCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md animate-[fadeIn_150ms_ease-out]">
          <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900 p-6 text-center text-white shadow-2xl">
            <div className="relative mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-800 ring-4 ring-blue-500/30">
              <Avatar name={conversationName} src={conversationAvatar} size="xl" />
              {activeCall.type === 'video' && !activeCall.isVideoOff && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500" />
                </span>
              )}
            </div>

            <h3 className="text-lg font-bold">{conversationName}</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeCall.type === 'video' ? 'Encrypted Video Call' : 'Encrypted Voice Call'}
            </p>
            <p className="mt-2 text-sm font-semibold text-blue-400 tabular-nums">
              {formatCallTime(callDuration)}
            </p>

            <div className="mt-8 flex items-center justify-center gap-4">
              {/* Mute Button */}
              <button
                onClick={() =>
                  setActiveCall((prev) => ({ ...prev, isMuted: !prev.isMuted }))
                }
                className={`flex h-12 w-12 items-center justify-center rounded-full transition ${
                  activeCall.isMuted
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
                title={activeCall.isMuted ? 'Unmute' : 'Mute'}
              >
                {activeCall.isMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>

              {/* Video Toggle Button (for video calls) */}
              {activeCall.type === 'video' && (
                <button
                  onClick={() =>
                    setActiveCall((prev) => ({ ...prev, isVideoOff: !prev.isVideoOff }))
                  }
                  className={`flex h-12 w-12 items-center justify-center rounded-full transition ${
                    activeCall.isVideoOff
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                  title={activeCall.isVideoOff ? 'Turn video on' : 'Turn video off'}
                >
                  {activeCall.isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
                </button>
              )}

              {/* End Call Button */}
              <button
                onClick={() => setActiveCall(null)}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg shadow-rose-600/40 hover:bg-rose-700 transition active:scale-95"
                title="End call"
              >
                <PhoneOff size={20} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── User Profile / Contact Info Modal ───────────────────────────────────────────────── */}
      <Modal
        open={showContactInfo || Boolean(viewingMemberProfile)}
        title={
          viewingMemberProfile
            ? 'User Profile'
            : selectedConversation.conversation_type === 'GROUP'
            ? 'Group Details'
            : 'User Profile'
        }
        onClose={() => {
          setShowContactInfo(false);
          setViewingMemberProfile(null);
        }}
      >
        {viewingMemberProfile ? (
          /* Viewing specific member from group */
          <div className="space-y-4 text-center">
            <div className="mx-auto flex justify-center">
              <Avatar
                name={viewingMemberProfile.username}
                src={viewingMemberProfile.avatar}
                size="3xl"
                isOnline={presenceMap[viewingMemberProfile.user_id]?.is_online}
                showStatus={true}
                className="shadow-sm ring-4 ring-slate-100 dark:ring-slate-800"
              />
            </div>

            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {viewingMemberProfile.username}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                @{viewingMemberProfile.username}
              </p>
            </div>

            {/* Status Message */}
            {viewingMemberProfile.status_message ? (
              <div className="rounded-2xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 p-3.5 text-left">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 dark:text-blue-400 mb-1">
                  <Sparkles size={13} />
                  <span>Status Message</span>
                </div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {viewingMemberProfile.status_message}
                </p>
              </div>
            ) : (
              <div className="rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 p-3 text-left">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 mb-0.5">
                  <Sparkles size={13} />
                  <span>Status Message</span>
                </div>
                <p className="text-xs text-slate-400 italic">No status message set.</p>
              </div>
            )}

            {/* Bio / About */}
            {viewingMemberProfile.bio ? (
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 p-3.5 text-left space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  <FileText size={13} />
                  <span>About / Bio</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {viewingMemberProfile.bio}
                </p>
              </div>
            ) : (
              <div className="rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 p-3 text-left">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 mb-0.5">
                  <FileText size={13} />
                  <span>About / Bio</span>
                </div>
                <p className="text-xs text-slate-400 italic">No bio provided.</p>
              </div>
            )}

            {/* Email & Presence Card */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3.5 text-left space-y-2.5 bg-slate-50/60 dark:bg-slate-800/40">
              {viewingMemberProfile.email && (
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <Mail size={13} /> Email
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                    {viewingMemberProfile.email}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <Shield size={13} /> Status
                </span>
                <span className={`font-semibold ${presenceMap[viewingMemberProfile.user_id]?.is_online ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
                  {presenceMap[viewingMemberProfile.user_id]?.is_online ? 'Online now' : 'Offline'}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setViewingMemberProfile(null)}
              >
                Back to Group
              </Button>
            </div>
          </div>
        ) : selectedConversation.conversation_type === 'GROUP' ? (
          /* Group details & member list */
          <div className="space-y-4 text-center">
            <div className="mx-auto flex justify-center">
              <Avatar
                name={conversationName}
                src={conversationAvatar}
                size="2xl"
              />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {conversationName}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Group • {selectedConversation.members?.length || 0} members
              </p>
            </div>

            {/* Member list */}
            <div className="space-y-2 text-left pt-1">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Group Members ({selectedConversation.members?.length || 0})
              </h4>
              <div className="max-h-60 overflow-y-auto space-y-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-2 bg-slate-50/50 dark:bg-slate-800/30">
                {selectedConversation.members?.map((member) => (
                  <button
                    key={member.id || member.user_id}
                    type="button"
                    onClick={() => setViewingMemberProfile(member)}
                    className="flex w-full items-center justify-between rounded-xl p-2 text-left hover:bg-white dark:hover:bg-slate-800 transition shadow-xs cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar
                        name={member.username}
                        src={member.avatar}
                        size="md"
                        isOnline={presenceMap[member.user_id]?.is_online}
                        showStatus={true}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {member.username} {member.user_id === currentUserId && '(You)'}
                        </p>
                        {member.status_message ? (
                          <p className="truncate text-[11px] text-blue-600 dark:text-blue-400">
                            ✨ {member.status_message}
                          </p>
                        ) : member.bio ? (
                          <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                            {member.bio}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    {member.is_admin && (
                      <span className="rounded-full bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                        Admin
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <Button
              variant="secondary"
              className="w-full mt-2"
              onClick={() => setShowContactInfo(false)}
            >
              Close
            </Button>
          </div>
        ) : (
          /* Direct 1-on-1 participant profile */
          <div className="space-y-4 text-center">
            <div className="mx-auto flex justify-center">
              <Avatar
                name={conversationName}
                src={conversationAvatar}
                size="3xl"
                isOnline={presenceInfo?.is_online}
                showStatus={true}
                className="shadow-sm ring-4 ring-slate-100 dark:ring-slate-800"
              />
            </div>

            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {conversationName}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                @{otherParticipant?.username || conversationName}
              </p>
            </div>

            {/* Status Message */}
            {otherParticipant?.status_message ? (
              <div className="rounded-2xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 p-3.5 text-left">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 dark:text-blue-400 mb-1">
                  <Sparkles size={13} />
                  <span>Status Message</span>
                </div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {otherParticipant.status_message}
                </p>
              </div>
            ) : (
              <div className="rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 p-3 text-left">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 mb-0.5">
                  <Sparkles size={13} />
                  <span>Status Message</span>
                </div>
                <p className="text-xs text-slate-400 italic">No status message set.</p>
              </div>
            )}

            {/* Bio / About */}
            {otherParticipant?.bio ? (
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 p-3.5 text-left space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  <FileText size={13} />
                  <span>About / Bio</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {otherParticipant.bio}
                </p>
              </div>
            ) : (
              <div className="rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 p-3 text-left">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 mb-0.5">
                  <FileText size={13} />
                  <span>About / Bio</span>
                </div>
                <p className="text-xs text-slate-400 italic">No bio provided.</p>
              </div>
            )}

            {/* Email & Presence Card */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3.5 text-left space-y-2.5 bg-slate-50/60 dark:bg-slate-800/40">
              {otherParticipant?.email && (
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <Mail size={13} /> Email
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                    {otherParticipant.email}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                  <Shield size={13} /> Status
                </span>
                <span className={`font-semibold ${presenceInfo?.is_online ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
                  {presenceInfo?.is_online ? 'Online now' : 'Offline'}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Encryption</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  End-to-End Encrypted
                </span>
              </div>
            </div>

            <Button
              variant="secondary"
              className="w-full mt-2"
              onClick={() => setShowContactInfo(false)}
            >
              Close
            </Button>
          </div>
        )}
      </Modal>

      {/* ── Clear Chat Confirmation Modal ───────────────────────────────────── */}
      <Modal
        open={showClearConfirm}
        title="Clear Messages"
        onClose={() => !isClearing && setShowClearConfirm(false)}
      >
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/60 dark:bg-amber-950/30">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              All messages in <strong>{conversationName}</strong> will be cleared for everyone.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              id="confirm-clear-btn"
              className="flex-1 gap-2 bg-amber-500 hover:bg-amber-600"
              disabled={isClearing}
              onClick={handleClearChat}
            >
              {isClearing ? <LoaderCircle size={15} className="animate-spin" /> : <Eraser size={15} />}
              Clear Messages
            </Button>
            <Button variant="secondary" disabled={isClearing} onClick={() => setShowClearConfirm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Delete Conversation Confirmation Modal ──────────────────────────── */}
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
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              id="confirm-delete-btn"
              className="flex-1 gap-2 bg-rose-600 hover:bg-rose-700"
              disabled={isDeleting}
              onClick={handleDeleteConversation}
            >
              {isDeleting ? <LoaderCircle size={15} className="animate-spin" /> : <Trash2 size={15} />}
              Delete Conversation
            </Button>
            <Button variant="secondary" disabled={isDeleting} onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Image Lightbox Fullscreen Modal ─────────────────────────────────── */}
      {lightboxMedia && (
        <ImageLightbox
          media={lightboxMedia}
          onClose={() => setLightboxMedia(null)}
        />
      )}
    </div>
  );
}

export default ChatWindow;
