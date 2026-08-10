/**
 * ConversationEmptyState.jsx
 *
 * Two modes controlled by the `hasConversations` prop:
 *
 * 1. hasConversations=false (new user, zero conversations)
 *    → "No conversations yet." heading
 *    → "Start your first conversation" subtext
 *    → "New Chat" button that dispatches the nexus:open-new-chat custom event,
 *      which ConversationSidebar listens for and uses to open its modal.
 *
 * 2. hasConversations=true (conversations exist but none is selected yet)
 *    → "Select a conversation" heading (original behaviour)
 *
 * The custom-event approach keeps state ownership inside ConversationSidebar
 * without requiring prop-drilling or a new context value.
 */

import { MessageCirclePlus } from 'lucide-react';

function ConversationEmptyState({ hasConversations = true }) {
  const openNewChat = () => {
    window.dispatchEvent(new CustomEvent('nexus:open-new-chat'));
  };

  if (!hasConversations) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-[32px] border border-slate-200/70 bg-white/80 p-8 text-center shadow-[0_20px_70px_-35px_rgba(2,6,23,0.5)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
        <div className="max-w-sm">
          {/* Icon */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-500">
            <MessageCirclePlus size={28} />
          </div>

          {/* Heading */}
          <h2 className="mt-6 text-2xl font-semibold text-slate-900 dark:text-slate-100">
            No conversations yet
          </h2>

          {/* Body */}
          <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Start a private chat with any registered user to begin your experience.
          </p>

          {/* CTA */}
          <button
            id="empty-state-new-chat-btn"
            onClick={openNewChat}
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-5 py-2.5 text-sm font-medium text-white shadow-[0_10px_30px_-12px_rgba(14,165,233,0.6)] transition-all duration-200 hover:bg-sky-500 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-sky-500/40"
          >
            <MessageCirclePlus size={16} />
            New Chat
          </button>
        </div>
      </div>
    );
  }

  // Default: conversations exist but none selected
  return (
    <div className="flex min-h-[420px] items-center justify-center rounded-[32px] border border-slate-200/70 bg-white/80 p-8 text-center shadow-[0_20px_70px_-35px_rgba(2,6,23,0.5)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
      <div className="max-w-md">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-500">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5m-7 4h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" />
          </svg>
        </div>
        <h2 className="mt-5 text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Select a conversation to start chatting.
        </h2>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          Choose an existing thread or create a new conversation from the sidebar to begin your experience.
        </p>
      </div>
    </div>
  );
}

export default ConversationEmptyState;
