import { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Users,
  UsersRound,
  Bell,
  Settings,
  Sun,
  Moon,
  LogOut,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useConversation } from '../../context/ConversationContext';
import Avatar from '../common/Avatar';

function NavRail({ activeTab = 'chats', onSelectTab }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { conversations } = useConversation();

  // Profile menu popover
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);

  // Notifications toggle status
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [showNotificationsToast, setShowNotificationsToast] = useState(false);

  // Total unread count across all conversations
  const totalUnreadCount = conversations.reduce(
    (acc, conv) => acc + (conv.unread_count || 0),
    0
  );

  // Close profile menu when clicking outside
  useEffect(() => {
    if (!profileMenuOpen) return;
    const handleClickOutside = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileMenuOpen]);

  const handleTabClick = (tabId) => {
    if (tabId === 'notifications') {
      setNotificationsEnabled((prev) => !prev);
      setShowNotificationsToast(true);
      setTimeout(() => setShowNotificationsToast(false), 2500);
      return;
    }
    if (onSelectTab) {
      onSelectTab(tabId);
    }
  };

  const navItems = [
    {
      id: 'chats',
      label: 'Chats',
      icon: MessageSquare,
      badge: totalUnreadCount > 0 ? (totalUnreadCount > 99 ? '99+' : totalUnreadCount) : null,
    },
    {
      id: 'contacts',
      label: 'Contacts',
      icon: Users,
    },
    {
      id: 'groups',
      label: 'Groups',
      icon: UsersRound,
    },
    {
      id: 'notifications',
      label: notificationsEnabled ? 'Notifications On' : 'Notifications Muted',
      icon: Bell,
      activeDot: !notificationsEnabled,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
    },
  ];

  return (
    <>
      <aside
        aria-label="Sidebar Navigation"
        className="flex h-full w-[70px] flex-col items-center justify-between border-r border-slate-800/80 bg-slate-950 py-3.5 text-slate-400 select-none shrink-0 z-30"
      >
        {/* ── Top Brand Icon ──────────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={() => handleTabClick('chats')}
            className="group relative flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/30 transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none"
            title="ChatApp"
          >
            <div className="relative">
              <MessageSquare size={22} className="fill-white/20 stroke-[2.2]" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-300 opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-200" />
              </span>
            </div>
          </button>

          {/* ── Main Nav Icons ────────────────────────────────────────────── */}
          <nav className="mt-1 flex flex-col items-center gap-1.5" role="navigation">
            {navItems.map(({ id, label, icon: Icon, badge, activeDot }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  id={`nav-rail-${id}`}
                  onClick={() => handleTabClick(id)}
                  title={label}
                  className={`group relative flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-150 focus:outline-none ${
                    isActive
                      ? 'bg-slate-800/90 text-white shadow-inner'
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'
                  }`}
                  aria-label={label}
                >
                  <Icon
                    size={20}
                    className={`transition-transform duration-150 ${
                      isActive ? 'stroke-[2.2] text-blue-400' : 'group-hover:scale-105'
                    }`}
                  />

                  {/* Active left indicator bar */}
                  {isActive && (
                    <span className="absolute -left-3.5 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-blue-500" />
                  )}

                  {/* Badge */}
                  {badge && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-slate-950">
                      {badge}
                    </span>
                  )}

                  {/* Mute/Alert dot */}
                  {activeDot && (
                    <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-slate-950" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* ── Bottom Section (Theme + Profile) ────────────────────────────── */}
        <div className="relative flex flex-col items-center gap-2" ref={profileMenuRef}>
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-slate-200 focus:outline-none"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Profile Avatar Button */}
          <button
            id="nav-profile-btn"
            onClick={() => setProfileMenuOpen((prev) => !prev)}
            className="group relative flex h-10 w-10 items-center justify-center rounded-full ring-2 ring-transparent transition-all duration-150 hover:ring-blue-500/70 focus:outline-none"
            aria-label="User profile menu"
            aria-expanded={profileMenuOpen}
          >
            <Avatar name={user?.username || 'User'} src={user?.avatar} size="md" isOnline={true} showStatus={true} />
          </button>

          {/* Profile Popover Menu */}
          {profileMenuOpen && (
            <div className="absolute bottom-2 left-16 z-50 w-64 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/95 p-2 text-slate-100 shadow-2xl backdrop-blur-md animate-[fadeIn_150ms_ease-out]">
              <div className="border-b border-slate-800/80 p-3">
                <div className="flex items-center gap-3">
                  <Avatar name={user?.username || 'User'} src={user?.avatar} size="lg" isOnline={true} showStatus={true} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{user?.username || 'User'}</p>
                    <p className="truncate text-xs text-slate-400">{user?.email || 'Active now'}</p>
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Available
                    </span>
                  </div>
                </div>
              </div>

              <div className="py-1">
                <button
                  onClick={() => {
                    setProfileMenuOpen(false);
                    if (onSelectTab) onSelectTab('settings');
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                >
                  <Settings size={15} /> Account Settings
                </button>
                <div className="my-1 border-t border-slate-800/80" />
                <button
                  onClick={logout}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-rose-400 transition-colors hover:bg-rose-950/30 hover:text-rose-300"
                >
                  <LogOut size={15} /> Log out
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ── Toast for Notifications Toggle ─────────────────────────────────── */}
      {showNotificationsToast && (
        <div className="fixed bottom-6 left-20 z-50 flex items-center gap-2 rounded-xl bg-slate-900/95 px-4 py-2.5 text-xs font-medium text-white shadow-xl border border-slate-800 animate-[fadeIn_150ms_ease-out]">
          <CheckCircle2 size={16} className="text-blue-400" />
          <span>{notificationsEnabled ? 'Notifications enabled' : 'Notifications muted'}</span>
        </div>
      )}
    </>
  );
}

export default NavRail;

