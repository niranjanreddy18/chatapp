import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SquarePen,
  MoreVertical,
  Search,
  Users,
  MessageSquare,
  Sparkles,
  Check,
  CheckCheck,
  LoaderCircle,
  AlertCircle,
  Plus,
  X,
  Pin,
  Star,
  BellOff,
  UserPlus,
  Settings,
  LogOut,
  FolderPlus,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useConversation } from '../../context/ConversationContext';
import { useUsers } from '../../hooks/useUsers';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Avatar from '../common/Avatar';
import Skeleton from '../ui/Skeleton';

// ---------------------------------------------------------------------------
// Helper — resolve the display name for a conversation.
// ---------------------------------------------------------------------------
function resolveConversationName(conversation, currentUserId) {
  if (conversation.conversation_type === 'GROUP') {
    return conversation.name || 'Group';
  }
  const other = conversation.members?.find((m) => m.user_id !== currentUserId);
  return other?.username || conversation.name || 'Conversation';
}

// ---------------------------------------------------------------------------
// Helper — get other participant's user_id for presence lookup
// ---------------------------------------------------------------------------
function getOtherParticipantId(conversation, currentUserId) {
  if (!conversation || conversation.conversation_type === 'GROUP') return null;
  const other = conversation.members?.find((m) => m.user_id !== currentUserId);
  return other?.user_id ?? null;
}

function ConversationSidebar({ onSelectChatMobile }) {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const currentUserId = user?.id;

  const {
    conversations,
    selectedConversation,
    setSelectedConversation,
    loading,
    error,
    refreshConversations,
    createConversation,
    createGroup,
    deleteConversation,
    presenceMap,
    favoriteIds = [],
    toggleFavorite,
  } = useConversation();

  const { users, loading: usersLoading, error: usersError, fetchUsers, resetUsers } = useUsers();

  // Search in conversation list
  const [search, setSearch] = useState('');

  // Filter tabs: 'all' | 'unread' | 'favorites' | 'groups'
  const [activeFilter, setActiveFilter] = useState('all');

  // More options dropdown
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef(null);

  // New Chat modal state
  const [showNewChat, setShowNewChat] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [creating, setCreating] = useState(false);

  // New Group modal state
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupMemberIds, setGroupMemberIds] = useState([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  const searchInputRef = useRef(null);
  const newChatSearchRef = useRef(null);

  // Close more menu on outside click
  useEffect(() => {
    if (!moreMenuOpen) return;
    const handleClickOutside = (e) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [moreMenuOpen]);

  // Listen for custom event 'chatapp:open-new-chat' from empty states
  useEffect(() => {
    const handleOpenNewChat = () => openNewChatModal();
    const handleOpenNewGroup = () => {
      setShowNewGroup(true);
      fetchUsers();
    };
    window.addEventListener('chatapp:open-new-chat', handleOpenNewChat);
    window.addEventListener('nexus:open-new-chat', handleOpenNewChat);
    window.addEventListener('chatapp:open-new-group', handleOpenNewGroup);
    return () => {
      window.removeEventListener('chatapp:open-new-chat', handleOpenNewChat);
      window.removeEventListener('nexus:open-new-chat', handleOpenNewChat);
      window.removeEventListener('chatapp:open-new-group', handleOpenNewGroup);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openNewChatModal = () => {
    setShowNewChat(true);
    setUserSearch('');
    setSelectedUserId(null);
    fetchUsers();
    setTimeout(() => newChatSearchRef.current?.focus(), 80);
  };

  const closeNewChatModal = () => {
    setShowNewChat(false);
    setUserSearch('');
    setSelectedUserId(null);
    resetUsers();
  };

  // -------------------------------------------------------------------------
  // Filtered & Derived conversations
  // -------------------------------------------------------------------------
  const filteredConversations = useMemo(() => {
    let result = conversations;

    // Search query filter
    if (search.trim()) {
      const query = search.toLowerCase();
      result = result.filter((conv) => {
        const name = resolveConversationName(conv, currentUserId).toLowerCase();
        return name.includes(query);
      });
    }

    // Filter pill tabs
    if (activeFilter === 'unread') {
      result = result.filter((conv) => (conv.unread_count ?? 0) > 0);
    } else if (activeFilter === 'groups') {
      result = result.filter((conv) => conv.conversation_type === 'GROUP');
    } else if (activeFilter === 'favorites') {
      result = result.filter((conv) => favoriteIds.includes(conv.id));
    }

    return result;
  }, [conversations, search, currentUserId, activeFilter, favoriteIds]);

  const unreadConversationsCount = useMemo(
    () => conversations.filter((conv) => (conv.unread_count ?? 0) > 0).length,
    [conversations]
  );

  const groupsCount = useMemo(
    () => conversations.filter((conv) => conv.conversation_type === 'GROUP').length,
    [conversations]
  );

  const favoritesCount = useMemo(
    () => conversations.filter((conv) => favoriteIds.includes(conv.id)).length,
    [conversations, favoriteIds]
  );

  // Filtered users for New Chat modal
  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users;
    const query = userSearch.toLowerCase();
    return users.filter((u) => u.username.toLowerCase().includes(query));
  }, [users, userSearch]);

  // Create private conversation
  const handleCreatePrivate = async () => {
    if (!selectedUserId || creating) return;
    setCreating(true);
    try {
      const created = await createConversation(selectedUserId);
      closeNewChatModal();
      if (onSelectChatMobile) onSelectChatMobile();
    } catch {
      // Error toasted in service
    } finally {
      setCreating(false);
    }
  };

  // Create group conversation
  const handleCreateGroup = async () => {
    if (!groupName.trim() || groupMemberIds.length < 1 || creatingGroup) return;
    setCreatingGroup(true);
    try {
      await createGroup({ name: groupName, memberIds: groupMemberIds });
      setShowNewGroup(false);
      setGroupName('');
      setGroupMemberIds([]);
      resetUsers();
      if (onSelectChatMobile) onSelectChatMobile();
    } catch {
      // Error toasted in service
    } finally {
      setCreatingGroup(false);
    }
  };

  const formatTimestamp = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isYesterday) {
      return 'Yesterday';
    }

    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex h-full w-full flex-col bg-[#F5F4F2] dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 select-none">
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <h1 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-slate-50">
            ChatApp
          </h1>
        </div>

        <div className="flex items-center gap-1">
          {/* New Chat Button */}
          <button
            id="new-chat-btn"
            onClick={openNewChatModal}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors focus:outline-none"
            title="New Chat"
            aria-label="New Chat"
          >
            <SquarePen size={18} />
          </button>

          {/* More Options Menu */}
          <div className="relative" ref={moreMenuRef}>
            <button
              id="sidebar-more-menu-btn"
              onClick={() => setMoreMenuOpen((prev) => !prev)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors focus:outline-none"
              title="More options"
              aria-label="More options"
              aria-expanded={moreMenuOpen}
            >
              <MoreVertical size={18} />
            </button>

            {moreMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 z-40 w-52 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900 animate-[fadeIn_120ms_ease-out]">
                <button
                  onClick={() => {
                    setMoreMenuOpen(false);
                    setShowNewGroup(true);
                    fetchUsers();
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition"
                >
                  <FolderPlus size={15} className="text-blue-600 dark:text-blue-400" /> New Group
                </button>
                <button
                  onClick={() => {
                    setMoreMenuOpen(false);
                    openNewChatModal();
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition"
                >
                  <UserPlus size={15} className="text-emerald-600 dark:text-emerald-400" /> Start Direct Chat
                </button>
                <button
                  onClick={() => {
                    setMoreMenuOpen(false);
                    setActiveFilter('favorites');
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition"
                >
                  <Star size={15} className="text-amber-500" /> Starred Conversations
                </button>
                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                <button
                  onClick={() => {
                    setMoreMenuOpen(false);
                    navigate('/settings');
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition"
                >
                  <Settings size={15} /> Settings
                </button>
                <button
                  onClick={logout}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30 transition"
                >
                  <LogOut size={15} /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Search Bar ──────────────────────────────────────────────────────── */}
      <div className="px-4 pb-2.5">
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-3.5 text-slate-400 dark:text-slate-500" size={16} />
          <input
            ref={searchInputRef}
            id="search-conversations-input"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search or start a new chat"
            className="w-full rounded-xl border border-transparent bg-white dark:bg-slate-800/90 py-2 pl-9 pr-8 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-sm focus:border-blue-500/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
          {search && (
            <button
              onClick={() => {
                setSearch('');
                searchInputRef.current?.focus();
              }}
              className="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── Filter Pills ────────────────────────────────────────────────────── */}
      <div
        role="tablist"
        aria-label="Conversation filters"
        className="flex items-center gap-1.5 overflow-x-auto px-4 pb-3 scrollbar-none"
      >
        {[
          { id: 'all', label: 'All' },
          { id: 'unread', label: 'Unread', count: unreadConversationsCount },
          { id: 'favorites', label: 'Favorites', count: favoritesCount },
          { id: 'groups', label: 'Groups', count: groupsCount },
        ].map(({ id, label, count }) => {
          const isActive = activeFilter === id;
          return (
            <button
              key={id}
              id={`filter-pill-${id}`}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveFilter(id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-medium transition-all duration-150 focus:outline-none ${
                isActive
                  ? 'bg-slate-900 text-white dark:bg-blue-600 dark:text-white shadow-sm'
                  : 'bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-slate-700/50'
              }`}
            >
              {label}
              {typeof count === 'number' && count > 0 && (
                <span
                  className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-blue-600 text-white'
                  }`}
                >
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Conversation List ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-2.5 pb-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
        {loading ? (
          <div className="space-y-1.5 p-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl bg-white/60 dark:bg-slate-800/40 p-3">
                <Skeleton className="h-11 w-11 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500">
            <AlertCircle size={28} className="mb-2 text-rose-400" />
            <p className="text-sm font-medium">Unable to load conversations</p>
            <p className="text-xs text-slate-400 mt-1">Please check your connection.</p>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-200/70 dark:bg-slate-800 text-slate-400 mb-3">
              <MessageSquare size={24} />
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {activeFilter === 'unread'
                ? 'No unread messages'
                : activeFilter === 'favorites'
                ? 'No starred chats'
                : activeFilter === 'groups'
                ? 'No group chats yet'
                : search
                ? 'No conversations found'
                : 'No conversations yet'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-[220px]">
              {activeFilter === 'unread'
                ? 'You are caught up with all messages.'
                : search
                ? `No match for "${search}".`
                : 'Start a new chat to connect with your team.'}
            </p>
            {!search && activeFilter === 'all' && (
              <button
                onClick={openNewChatModal}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
              >
                <SquarePen size={13} /> Start Chat
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredConversations.map((conversation) => {
              const active = selectedConversation?.id === conversation.id;
              const displayName = resolveConversationName(conversation, currentUserId);
              const otherMember = conversation.members?.find((m) => m.user_id !== currentUserId);
              const avatarSrc = conversation.conversation_type === 'GROUP'
                ? conversation.avatar
                : (otherMember?.avatar || conversation.avatar || null);
              const otherUserId = getOtherParticipantId(conversation, currentUserId);
              const isOnline = otherUserId
                ? (presenceMap[otherUserId]?.is_online ?? false)
                : false;
              const isFav = favoriteIds.includes(conversation.id);

              return (
                <div
                  key={conversation.id}
                  id={`conv-${conversation.id}`}
                  onClick={() => {
                    setSelectedConversation(conversation);
                    if (onSelectChatMobile) onSelectChatMobile();
                  }}
                  className={`group relative flex w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all duration-150 ${
                    active
                      ? 'bg-white dark:bg-slate-800 shadow-md shadow-slate-200/50 dark:shadow-none border border-slate-200/60 dark:border-slate-700/60'
                      : 'hover:bg-white/70 dark:hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  {/* Left active highlight accent */}
                  {active && (
                    <span className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-blue-600" />
                  )}

                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <Avatar
                      name={displayName}
                      src={avatarSrc}
                      size="lg"
                      isOnline={isOnline}
                      showStatus={conversation.conversation_type !== 'GROUP'}
                    />
                  </div>

                  {/* Body */}
                  <div className="min-w-0 flex-1">
                    {/* Top Row: Name + Time */}
                    <div className="flex items-center justify-between gap-1.5">
                      <p
                        className={`truncate text-sm font-semibold ${
                          active
                            ? 'text-slate-900 dark:text-white'
                            : 'text-slate-800 dark:text-slate-100'
                        }`}
                      >
                        {displayName}
                      </p>
                      <span
                        className={`shrink-0 text-[11px] tabular-nums ${
                          (conversation.unread_count ?? 0) > 0
                            ? 'font-bold text-blue-600 dark:text-blue-400'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {formatTimestamp(conversation.updated_at)}
                      </span>
                    </div>

                    {/* Bottom Row: Last message preview + Unread badge / Icons */}
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {conversation.conversation_type === 'GROUP'
                          ? `Group${conversation.member_count ? ` • ${conversation.member_count} members` : ''}`
                          : 'Direct message'}
                      </p>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Star toggle button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(conversation.id);
                          }}
                          className={`p-1 rounded-md transition ${
                            isFav
                              ? 'text-amber-400 opacity-100 hover:text-amber-500'
                              : 'text-slate-400 opacity-0 group-hover:opacity-100 hover:text-amber-400 dark:hover:text-amber-300'
                          }`}
                          title={isFav ? 'Remove from starred' : 'Add to starred'}
                          aria-label={isFav ? 'Remove from starred' : 'Add to starred'}
                        >
                          <Star size={13} className={isFav ? 'fill-amber-400' : ''} />
                        </button>

                        {/* Unread badge */}
                        {(conversation.unread_count ?? 0) > 0 && (
                          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-bold text-white shadow-sm">
                            {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── New Chat Modal ─────────────────────────────────────────────────── */}
      <Modal open={showNewChat} title="New Direct Chat" onClose={closeNewChatModal}>
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              ref={newChatSearchRef}
              id="new-chat-search-input"
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search people by username…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200/80 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
            {usersLoading ? (
              <div className="space-y-0 divide-y divide-slate-100 dark:divide-slate-800">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-3.5 py-2.5">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-2.5 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : usersError ? (
              <div className="p-6 text-center text-sm text-slate-500">
                <AlertCircle size={20} className="mx-auto mb-2 text-rose-400" />
                <p>Failed to load users.</p>
                <button onClick={fetchUsers} className="mt-2 text-xs font-semibold text-blue-600 hover:underline">
                  Retry
                </button>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                {userSearch.trim()
                  ? `No user found matching "${userSearch}".`
                  : 'No new users available to chat.'}
              </div>
            ) : (
              filteredUsers.map((u) => {
                const isSelected = selectedUserId === u.id;
                return (
                  <button
                    key={u.id}
                    id={`user-select-row-${u.id}`}
                    onClick={() => setSelectedUserId(isSelected ? null : u.id)}
                    className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors ${
                      isSelected
                        ? 'bg-blue-50/80 dark:bg-blue-900/20'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <Avatar name={u.username} src={u.avatar} size="md" isOnline={u.is_online} showStatus={true} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {u.username}
                      </p>
                      <p className={`text-xs ${u.is_online ? 'text-emerald-500 font-medium' : 'text-slate-400'}`}>
                        {u.is_online ? 'Online' : 'Offline'}
                      </p>
                    </div>
                    {isSelected && <Check size={18} className="text-blue-600" />}
                  </button>
                );
              })
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              id="start-chat-btn"
              className="flex-1 gap-2 bg-blue-600 hover:bg-blue-700"
              disabled={!selectedUserId || creating}
              onClick={handleCreatePrivate}
            >
              {creating ? <LoaderCircle size={15} className="animate-spin" /> : 'Start Chat'}
            </Button>
            <Button variant="secondary" onClick={closeNewChatModal}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── New Group Modal ────────────────────────────────────────────────── */}
      <Modal
        open={showNewGroup}
        title="Create a New Group"
        onClose={() => {
          setShowNewGroup(false);
          setGroupName('');
          setGroupMemberIds([]);
          resetUsers();
        }}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Group Name
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Design Team, Project Alpha"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Select Members ({groupMemberIds.length})
              </label>
            </div>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-slate-200/80 dark:border-slate-800 p-1.5">
              {users.length === 0 && !usersLoading && (
                <p className="text-sm text-slate-400 text-center py-4">No users available.</p>
              )}
              {users.map((u) => {
                const selected = groupMemberIds.includes(u.id);
                return (
                  <button
                    key={u.id}
                    onClick={() =>
                      setGroupMemberIds((prev) =>
                        selected ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                      )
                    }
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition ${
                      selected
                        ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                        : 'hover:bg-slate-100/70 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar name={u.username} src={u.avatar} size="sm" isOnline={u.is_online} showStatus={true} />
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{u.username}</p>
                    </div>
                    {selected ? (
                      <Check size={16} className="text-blue-600 font-bold" />
                    ) : (
                      <Plus size={16} className="text-slate-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <Button
            className="w-full bg-blue-600 hover:bg-blue-700"
            disabled={!groupName.trim() || groupMemberIds.length < 1 || creatingGroup}
            onClick={handleCreateGroup}
          >
            {creatingGroup ? (
              <LoaderCircle size={15} className="animate-spin" />
            ) : (
              'Create Group'
            )}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default ConversationSidebar;
