import { MessageSquareMore, MessageCirclePlus, Settings, UserRound } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const links = [
  { to: '/chat', label: 'Chat', icon: MessageSquareMore },
  { to: '/profile', label: 'Profile', icon: UserRound },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function Sidebar() {
  const location = useLocation();

  return (
    <aside className="flex h-full w-full flex-col border-r border-slate-200 bg-white/80 p-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/70">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white">
          <MessageCirclePlus size={20} />
        </div>
        <div>
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">Nexus Chat</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Portfolio Prototype</p>
        </div>
      </div>

      <button className="mb-6 flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-sky-500">
        <MessageCirclePlus size={16} /> New Chat
      </button>

      <div className="mb-4 text-sm font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Conversations</div>
      <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
        {["Design Review", "Product Sync", "Roadmap"].map((item) => (
          <div key={item} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
            {item}
          </div>
        ))}
      </div>

      <div className="mt-auto space-y-2">
        {links.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${active ? 'bg-sky-600 text-white' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'}`}
            >
              <Icon size={16} /> {label}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}

export default Sidebar;
