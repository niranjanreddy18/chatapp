/**
 * ConversationSidebar.jsx
 *
 * Key fixes in this revision:
 *
 * 1. New Chat modal — user rows now show avatar (real image if available,
 *    initials fallback), username, and online status dot. The old `user.email`
 *    reference is removed — UserListSerializer does not return email.
 *
 * 2. User search — local filter by username substring, no extra API calls.
 *
 * 3. On-demand user fetch — fetchUsers() is called only when the modal opens,
 *    not on every sidebar mount. resetUsers() is called on modal close so the
 *    next open always fetches fresh data.
 *
 * 4. Loading skeleton — 4 skeleton rows while users are loading.
 *
 * 5. Error state — friendly message if /users/ fails.
 *
 * 6. Creating state — "Start Chat" button is disabled and shows a spinner
 *    while the POST /api/conversations/private/ request is in-flight.
 *    Prevents double-click duplicate requests.
 *
 * 7. Private conversation display name — private DMs have name=null in the
 *    DB. The sidebar now resolves the name from the other participant's
 *    username in members[]. Falls back to "Conversation" if members are not
 *    yet populated.
 *
 * 8. Online indicator — uses presenceMap[member.user_id].is_online for the
 *    green dot on private conversation rows.
 *
 * 9. Empty-state CTA — listens for the custom event 'nexus:open-new-chat'
 *    so ConversationEmptyState can trigger the same modal without prop
 *    drilling or context changes.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageCirclePlus,
  Users,
  Search,
  Settings,
  LogOut,
  Sparkles,
  Plus,
  CircleDot,
  MessageSquareText,
  Check,
  LoaderCircle,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useConversation } from '../../context/ConversationContext';
import { useUsers } from '../../hooks/useUsers';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import Avatar from '../common/Avatar';
import EmptyState from '../common/EmptyState';
import Skeleton from '../ui/Skeleton';

// ---------------------------------------------------------------------------
// Helper — resolve the display name for a conversation.
// Private DMs have name=null; we find the other member's username instead.
// ---------------------------------------------------------------------------
function resolveConversationName(conversation, currentUserId) {
  if (conversation.conversation_type === 'GROUP') {
    return conversation.name || 'Group';
  }
  // Private: find the member that is NOT the current user
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
function ConversationSidebar() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const currentUserId = user?.id;

  const {
    conversations,
    selectedConversation,
    setSelectedConversation,
    loading,
    error,
    createConversation,
    createGroup,
    presenceMap,
  } = useConversation();

  const { users, loading: usersLoading, error: usersError, fetchUsers, resetUsers } = useUsers();

  // Sidebar conversation search
  const [search, setSearch] = useState('');

  // New Chat modal state
  const [showNewChat, setShowNewChat] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [creating, setCreating] = useState(false);

  // New Group modal state
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupMemberIds, setGroupMemberIds] = useState([]);

  // Search input ref for auto-focus
  const searchRef = useRef(null);

  // -------------------------------------------------------------------------
  // Listen for the custom event dispatched by ConversationEmptyState's CTA
  // so it can open this modal without prop-drilling.
  // -------------------------------------------------------------------------
  useEffect(() => {
    const handler = () => openNewChatModal();
    window.addEventListener('nexus:open-new-chat', handler);
    return () => window.removeEventListener('nexus:open-new-chat', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------------------------------------
  // Modal open / close helpers
  // -------------------------------------------------------------------------
  const openNewChatModal = () => {
    setShowNewChat(true);
    setUserSearch('');
    setSelectedUserId(null);
    fetchUsers();
    // Auto-focus search after paint
    setTimeout(() => searchRef.current?.focus(), 80);
  };

  const closeNewChatModal = () => {
    setShowNewChat(false);
    setUserSearch('');
    setSelectedUserId(null);
    resetUsers();
  };

  // -------------------------------------------------------------------------
  // Conversation sidebar search (filters by resolved display name)
  // -------------------------------------------------------------------------
  const filteredConversations = useMemo(() => {
    if (!search.trim()) return conversations;
    const query = search.toLowerCase();
    return conversations.filter((conv) => {
      const name = resolveConversationName(conv, currentUserId).toLowerCase();
      return name.includes(query);
    });
  }, [conversations, search, currentUserId]);

  // -------------------------------------------------------------------------
  // User list — local filter by username
  // -------------------------------------------------------------------------
  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users;
    const query = userSearch.toLowerCase();
    return users.filter((u) => u.username.toLowerCase().includes(query));
  }, [users, userSearch]);

  // -------------------------------------------------------------------------
  // Create private conversation
  // -------------------------------------------------------------------------
  const handleCreatePrivate = async () => {
    if (!selectedUserId || creating) return;
    setCreating(true);
    try {
      await createConversation(selectedUserId);
      closeNewChatModal();
    } catch {
      // createConversation already toasts the error
    } finally {
      setCreating(false);
    }
  };

  // -------------------------------------------------------------------------
  // Create group conversation
  // -------------------------------------------------------------------------
  const handleCreateGroup = async () => {
    if (!groupName.trim() || groupMemberIds.length < 1) return;
    try {
      await createGroup({ name: groupName, memberIds: groupMemberIds });
      setShowNewGroup(false);
      setGroupName('');
      setGroupMemberIds([]);
      resetUsers();
    } catch {
      // createGroup already toasts the error
    }
  };

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  const formatTime = (value) => {
    if (!value) return '';
    const date = new Date(value);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="flex h-full flex-col bg-slate-950/95 text-slate-100">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-800/80 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-400 shadow-inner">
            <Sparkles size={18} />
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-50">Nexus Chat</p>
            <p className="text-sm text-slate-400">Workspace inbox</p>
          </div>
        </div>
      </div>

      {/* ── Search + action buttons ────────────────────────────────────────── */}
      <div className="space-y-3 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations"
            className="pl-9 rounded-2xl border-slate-800 bg-slate-900/80 text-slate-100 placeholder:text-slate-500 focus:border-sky-500"
          />
        </div>

        <div className="flex gap-2">
          <Button id="new-chat-btn" className="flex-1 gap-2 rounded-2xl" onClick={openNewChatModal}>
            <MessageCirclePlus size={16} /> New Chat
          </Button>
          <Button
            variant="secondary"
            className="gap-2 rounded-2xl"
            onClick={() => { setShowNewGroup(true); fetchUsers(); }}
          >
            <Users size={16} /> New Group
          </Button>
        </div>
      </div>

      {/* ── Conversation list ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-2 pb-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-800">
        {loading ? (
          <div className="space-y-2 p-2">
            {[0, 1, 2].map((item) => (
              <div key={item} className="rounded-[20px] border border-slate-800/70 p-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-2">
            <EmptyState
              title="Unable to load conversations"
              description="Please refresh and try again."
              icon={<MessageSquareText size={18} />}
            />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-2">
            <EmptyState
              title="No conversations yet"
              description="Start a new chat or group to get rolling."
              icon={<CircleDot size={18} />}
            />
          </div>
        ) : (
          <div className="space-y-2">
            {filteredConversations.map((conversation) => {
              const active = selectedConversation?.id === conversation.id;
              const displayName = resolveConversationName(conversation, currentUserId);
              const otherUserId = getOtherParticipantId(conversation, currentUserId);
              const isOnline = otherUserId
                ? (presenceMap[otherUserId]?.is_online ?? false)
                : false;

              return (
                <button
                  key={conversation.id}
                  id={`conv-${conversation.id}`}
                  onClick={() => setSelectedConversation(conversation)}
                  className={`group flex w-full items-center gap-3 rounded-[20px] border px-3 py-3 text-left transition-all duration-200 ${
                    active
                      ? 'border-sky-500/60 bg-slate-900/95 shadow-[0_10px_30px_-18px_rgba(14,165,233,0.6)]'
                      : 'border-transparent bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div className="relative shrink-0">
                    <Avatar name={displayName} size="md" />
                    {conversation.conversation_type !== 'GROUP' && (
                      <span
                        className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-slate-950 ${
                          isOnline ? 'bg-emerald-500' : 'bg-slate-600'
                        }`}
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-medium text-slate-100">{displayName}</p>
                      <span className="shrink-0 text-[11px] text-slate-400">{formatTime(conversation.updated_at)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="truncate text-xs text-slate-400">
                        {conversation.conversation_type === 'GROUP'
                          ? `Group${conversation.member_count ? ` • ${conversation.member_count}` : ''}`
                          : 'Direct message'}
                      </p>
                      {conversation.unread_count > 0 && (
                        <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] font-medium text-sky-400">
                          {conversation.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Current user footer ────────────────────────────────────────────── */}
      <div className="border-t border-slate-800/80 p-4">
        <div className="mb-3 flex items-center gap-3 rounded-[20px] border border-slate-800/70 bg-slate-900/70 px-3 py-3">
          <Avatar name={user?.username || 'User'} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-100">{user?.username || 'User'}</p>
            <p className="truncate text-xs text-slate-400">{user?.email || ''}</p>
          </div>
        </div>
        <div className="space-y-2">
          <button
            onClick={() => navigate('/settings')}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-900"
          >
            <Settings size={16} /> Settings
          </button>
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-900"
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>

      {/* ── New Chat Modal ─────────────────────────────────────────────────── */}
      <Modal open={showNewChat} title="Start a new chat" onClose={closeNewChatModal}>
        <div className="space-y-4">

          {/* Search input */}
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
              size={15}
            />
            <input
              ref={searchRef}
              id="new-chat-search"
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search by username…"
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          {/* User list */}
          <div className="max-h-72 overflow-y-auto rounded-2xl border border-slate-200/70 dark:border-slate-800">
            {usersLoading ? (
              /* Loading skeleton */
              <div className="space-y-0 divide-y divide-slate-100 dark:divide-slate-800">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-2.5 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : usersError ? (
              /* Error state */
              <div className="flex flex-col items-center gap-2 p-6 text-center">
                <AlertCircle size={20} className="text-rose-400" />
                <p className="text-sm text-slate-600 dark:text-slate-400">Unable to load users.</p>
                <button
                  onClick={fetchUsers}
                  className="text-sm font-medium text-sky-500 hover:underline"
                >
                  Retry
                </button>
              </div>
            ) : filteredUsers.length === 0 ? (
              /* Empty — no users or no search match */
              <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                {users.length === 0
                  ? 'No other users are registered yet.'
                  : 'No users match your search.'}
              </div>
            ) : (
              /* User rows */
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredUsers.map((u) => {
                  const isSelected = selectedUserId === u.id;
                  return (
                    <button
                      key={u.id}
                      id={`user-row-${u.id}`}
                      onClick={() => setSelectedUserId(isSelected ? null : u.id)}
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                        isSelected
                          ? 'bg-sky-50 dark:bg-sky-900/20'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      {/* Avatar with online dot */}
                      <div className="relative shrink-0">
                        {u.avatar ? (
                          <img
                            src={u.avatar}
                            alt={u.username}
                            className="h-9 w-9 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-600 text-sm font-semibold text-white">
                            {u.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span
                          className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-slate-900 ${
                            u.is_online ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                          }`}
                        />
                      </div>

                      {/* Username + status */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                          {u.username}
                        </p>
                        <p className={`text-xs ${u.is_online ? 'text-emerald-500' : 'text-slate-400'}`}>
                          {u.is_online ? 'Online' : 'Offline'}
                        </p>
                      </div>

                      {/* Selected checkmark */}
                      {isSelected && (
                        <Check size={16} className="shrink-0 text-sky-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              id="start-chat-btn"
              className="flex-1 gap-2"
              disabled={!selectedUserId || creating}
              onClick={handleCreatePrivate}
            >
              {creating ? (
                <>
                  <LoaderCircle size={15} className="animate-spin" />
                  Starting…
                </>
              ) : (
                'Start Chat'
              )}
            </Button>
            <Button variant="secondary" onClick={closeNewChatModal}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── New Group Modal ────────────────────────────────────────────────── */}
      <Modal open={showNewGroup} title="Create a group" onClose={() => { setShowNewGroup(false); setGroupName(''); setGroupMemberIds([]); resetUsers(); }}>
        <div className="space-y-4">
          <Input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Group name"
          />
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {users.length === 0 && !usersLoading && (
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                No users available.
              </p>
            )}
            {users.map((u) => {
              const active = groupMemberIds.includes(u.id);
              return (
                <button
                  key={u.id}
                  onClick={() =>
                    setGroupMemberIds((current) =>
                      active ? current.filter((item) => item !== u.id) : [...current, u.id]
                    )
                  }
                  className={`flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-left transition ${
                    active
                      ? 'border-sky-500 bg-slate-100 dark:bg-slate-800'
                      : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={u.username} size="sm" />
                    <p className="text-sm font-medium">{u.username}</p>
                  </div>
                  {active ? <Plus className="rotate-45" size={16} /> : <Plus size={16} />}
                </button>
              );
            })}
          </div>
          <Button className="w-full" onClick={handleCreateGroup}>
            Create group
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default ConversationSidebar;
