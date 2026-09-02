import { MessageSquarePlus, UserPlus, UsersRound, ShieldCheck, Sparkles } from 'lucide-react';

function ConversationEmptyState({ hasConversations = true }) {
  const openNewChat = () => {
    window.dispatchEvent(new CustomEvent('chatapp:open-new-chat'));
  };

  const openNewGroup = () => {
    window.dispatchEvent(new CustomEvent('chatapp:open-new-group'));
  };

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-[#EDECEC] dark:bg-slate-950 p-8 text-center select-none overflow-y-auto">
      <div className="flex max-w-md flex-col items-center animate-[fadeIn_200ms_ease-out]">
        {/* ── Modern Abstract Communication Graphic ────────────────────────── */}
        <div className="relative mb-8 flex h-36 w-36 items-center justify-center">
          {/* Subtle ambient rings */}
          <div className="absolute inset-0 rounded-full bg-blue-500/10 dark:bg-blue-500/15 animate-pulse" />
          <div className="absolute inset-3 rounded-full bg-blue-600/10 dark:bg-blue-600/20" />

          {/* Central graphic composition */}
          <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-600/25">
            <svg
              viewBox="0 0 48 48"
              fill="none"
              className="h-12 w-12 text-white"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Primary Chat Bubble */}
              <path d="M14 36v-6H10a6 6 0 0 1-6-6V12a6 6 0 0 1 6-6h24a6 6 0 0 1 6 6v12a6 6 0 0 1-6 6H22l-8 6z" fill="currentColor" fillOpacity="0.15" />
              {/* Secondary overlapping Chat Bubble */}
              <path d="M34 18h4a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4h-4v4l-6-4h-8" />
              {/* Conversation dots */}
              <circle cx="15" cy="18" r="1.5" fill="currentColor" />
              <circle cx="22" cy="18" r="1.5" fill="currentColor" />
              <circle cx="29" cy="18" r="1.5" fill="currentColor" />
            </svg>
          </div>

          {/* Floating decorative elements */}
          <div className="absolute -top-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-white dark:bg-slate-800 text-emerald-500 shadow-md ring-2 ring-[#EDECEC] dark:ring-slate-950">
            <span className="h-3 w-3 rounded-full bg-emerald-500 animate-ping opacity-75" />
            <span className="absolute h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </div>

          <div className="absolute -bottom-2 -left-2 flex h-7 w-7 items-center justify-center rounded-full bg-white dark:bg-slate-800 text-blue-500 shadow-md ring-2 ring-[#EDECEC] dark:ring-slate-950">
            <Sparkles size={14} className="text-blue-500" />
          </div>
        </div>

        {/* ── Title & Subtitle ─────────────────────────────────────────────── */}
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Stay connected with your conversations
        </h2>

        <p className="mt-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          Select a conversation from the sidebar to start chatting, share files, and collaborate in real time.
        </p>

        {/* ── Quick Action Buttons ────────────────────────────────────────── */}
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <button
            id="empty-state-new-chat-btn"
            onClick={openNewChat}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-blue-600/25 transition-all duration-150 hover:bg-blue-700 active:scale-95 focus:outline-none"
          >
            <MessageSquarePlus size={15} />
            New Chat
          </button>

          <button
            id="empty-state-new-group-btn"
            onClick={openNewGroup}
            className="inline-flex items-center gap-2 rounded-xl bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-sm border border-slate-200 dark:border-slate-700 transition-all duration-150 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 focus:outline-none"
          >
            <UsersRound size={15} />
            Create Group
          </button>

          <button
            onClick={openNewChat}
            className="inline-flex items-center gap-2 rounded-xl bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-sm border border-slate-200 dark:border-slate-700 transition-all duration-150 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 focus:outline-none"
          >
            <UserPlus size={15} />
            Add Contact
          </button>
        </div>

        {/* ── Security / Encryption Badge ─────────────────────────────────── */}
        <div className="mt-12 flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-slate-500">
          <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400" />
          <span>End-to-end encrypted workspace</span>
        </div>
      </div>
    </div>
  );
}

export default ConversationEmptyState;
