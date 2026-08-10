/**
 * Home.jsx — Main chat workspace page.
 *
 * Layout:
 *  - Sidebar (ConversationSidebar) is rendered by MainLayout.
 *  - Main area shows ConversationEmptyState or ChatWindow depending on state.
 *
 * Empty state logic:
 *  - No conversations at all        → hasConversations=false → "No conversations yet" + New Chat CTA
 *  - Conversations exist, none open → hasConversations=true  → "Select a conversation"
 *  - A conversation is selected     → ChatWindow
 */

import MainLayout from '../components/layout/MainLayout';
import ConversationEmptyState from '../components/chat/ConversationEmptyState';
import ChatWindow from '../components/chat/ChatWindow';
import { useConversation } from '../context/ConversationContext';

function Home() {
  const { selectedConversation, conversations, loading } = useConversation();

  // While conversations are loading we don't yet know if the list is empty,
  // so we defer the empty-state decision until loading completes.
  const hasConversations = loading || conversations.length > 0;

  return (
    <MainLayout>
      <div className="h-[calc(100vh-8rem)] rounded-[32px] border border-slate-200/70 bg-white/80 p-4 shadow-[0_20px_60px_-35px_rgba(2,6,23,0.55)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/70 sm:p-6">
        {selectedConversation ? (
          <ChatWindow />
        ) : (
          <ConversationEmptyState hasConversations={hasConversations} />
        )}
      </div>
    </MainLayout>
  );
}

export default Home;
