import { LogOut, Moon, Sun, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import Avatar from '../common/Avatar';
import Button from '../common/Button';

function Header() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="flex items-center justify-between border-b border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/70">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-500">
          <Sparkles size={18} />
        </div>
        <div>
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">Nexus Chat</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Workspace overview</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" className="rounded-full p-2.5" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </Button>

        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100/90 px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-800/90">
          <Avatar name={user?.username || 'User'} size="sm" />
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{user?.username || 'Demo User'}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Online • Available</p>
          </div>
        </div>

        <Button variant="secondary" className="gap-2 rounded-2xl" onClick={logout}>
          <LogOut size={16} /> <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>
    </header>
  );
}

export default Header;
