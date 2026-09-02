import { ArrowLeft, Moon, Sun, Monitor, User, Mail, Sparkles, FileText, Pencil, LogOut, Check, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../components/layout/MainLayout';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Avatar from '../components/common/Avatar';
import Button from '../components/common/Button';

function Settings() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, themeMode, setThemeMode } = useTheme();

  const themeOptions = [
    {
      id: 'light',
      label: 'Light',
      description: 'Clean bright workspace',
      icon: Sun,
    },
    {
      id: 'dark',
      label: 'Dark',
      description: 'Easy on the eyes',
      icon: Moon,
    },
    {
      id: 'system',
      label: 'System',
      description: 'Syncs with device mode',
      icon: Monitor,
    },
  ];

  return (
    <MainLayout>
      <div className="flex h-full w-full flex-col bg-[#EDECEC] dark:bg-slate-950 overflow-y-auto p-4 sm:p-8 lg:p-10 transition-colors">
        <div className="max-w-2xl mx-auto w-full space-y-6 pb-12 animate-[fadeIn_150ms_ease-out]">
          {/* Header */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/home')}
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-sm border border-slate-200/80 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              aria-label="Back to chat"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Settings</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage your account profile and application appearance.
              </p>
            </div>
          </div>

          {/* Profile Overview Card */}
          <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200/80 dark:border-slate-800 transition-colors">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Profile Information
              </h2>
              <button
                onClick={() => navigate('/profile')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                <Pencil size={13} />
                Edit Profile
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
              <Avatar
                name={user?.username || 'User'}
                src={user?.avatar}
                size="2xl"
                isOnline={true}
                showStatus={true}
                className="shadow-sm ring-2 ring-slate-100 dark:ring-slate-800"
              />

              <div className="flex-1 min-w-0 text-center sm:text-left space-y-1.5">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                    {user?.username || 'User'}
                  </h3>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Available
                  </span>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {user?.email || 'Account email registered'}
                </p>

                {user?.status_message && (
                  <p className="inline-block rounded-xl bg-slate-100 dark:bg-slate-800/70 px-3 py-1 text-xs text-slate-700 dark:text-slate-300 font-medium">
                    ✨ {user.status_message}
                  </p>
                )}

                {user?.bio && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 pt-1">
                    {user.bio}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80">
              <Button
                variant="secondary"
                onClick={() => navigate('/profile')}
                className="w-full flex items-center justify-between rounded-2xl py-2.5 px-4 text-xs font-semibold bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200/80 dark:border-slate-700/80"
              >
                <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <User size={15} className="text-slate-400" />
                  Customize Display Name, Avatar & Bio
                </span>
                <ChevronRight size={15} className="text-slate-400" />
              </Button>
            </div>
          </div>

          {/* Appearance Section */}
          <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-4 transition-colors">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Appearance
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Choose how ChatApp looks on your device.
              </p>
            </div>

            {/* Theme Selector Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {themeOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = themeMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setThemeMode(opt.id)}
                    className={`relative flex flex-col items-start p-4 rounded-2xl border text-left transition duration-150 ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 text-blue-950 dark:text-blue-100 shadow-sm ring-2 ring-blue-500/20'
                        : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <Icon size={18} />
                      </div>
                      {isSelected && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white">
                          <Check size={12} strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-bold">{opt.label}</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {opt.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Account & Session Actions */}
          <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-4 transition-colors">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Account & Session
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Manage your active workspace session.
              </p>
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-rose-800 dark:text-rose-300">Sign Out</p>
                <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80">
                  End your current session on this device
                </p>
              </div>
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 text-xs font-semibold shadow-sm transition"
              >
                <LogOut size={14} />
                Log out
              </button>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

export default Settings;
