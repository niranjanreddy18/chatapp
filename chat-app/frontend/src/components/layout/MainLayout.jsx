import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import NavRail from './NavRail';
import ConversationSidebar from '../chat/ConversationSidebar';
import { useConversation } from '../../context/ConversationContext';

function MainLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedConversation, setSelectedConversation } = useConversation();

  // Determine active nav tab from route or local state
  const [activeTab, setActiveTab] = useState(() => {
    if (location.pathname === '/settings') return 'settings';
    if (location.pathname === '/profile') return 'profile';
    return 'chats';
  });

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    if (tabId === 'settings') {
      navigate('/settings');
    } else if (tabId === 'profile') {
      navigate('/profile');
    } else if (tabId === 'chats' || tabId === 'contacts' || tabId === 'groups') {
      if (location.pathname !== '/home' && location.pathname !== '/chat') {
        navigate('/home');
      }
      if (tabId === 'contacts') {
        window.dispatchEvent(new CustomEvent('chatapp:open-new-chat'));
      } else if (tabId === 'groups') {
        window.dispatchEvent(new CustomEvent('chatapp:open-new-group'));
      }
    }
  };

  const handleBackMobile = () => {
    setSelectedConversation(null);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#EDECEC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased select-none">
      {/* ── 1. Left Vertical Navigation Rail (70px) ───────────────────────── */}
      <div className="hidden md:flex h-full w-[70px] shrink-0">
        <NavRail activeTab={activeTab} onSelectTab={handleSelectTab} />
      </div>

      {/* ── 2. Chat Sidebar (380px) ────────────────────────────────────────── */}
      <div
        className={`h-full w-full md:w-[360px] lg:w-[380px] shrink-0 ${
          selectedConversation ? 'hidden md:flex' : 'flex'
        }`}
      >
        <ConversationSidebar onSelectChatMobile={() => {}} />
      </div>

      {/* ── 3. Main Chat / Content Area (Remaining Space) ─────────────────── */}
      <main
        className={`h-full flex-1 min-w-0 overflow-hidden ${
          !selectedConversation ? 'hidden md:flex' : 'flex'
        } flex-col`}
      >
        {children}
      </main>
    </div>
  );
}

export default MainLayout;
