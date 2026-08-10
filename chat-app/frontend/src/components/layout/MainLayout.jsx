import { Menu } from 'lucide-react';
import { useState } from 'react';
import Header from './Header';
import ConversationSidebar from '../chat/ConversationSidebar';

function MainLayout({ children }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.12),_transparent_35%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(2,6,23,1))] text-slate-900 dark:text-slate-100">
      <aside className="hidden w-[360px] border-r border-slate-200/70 bg-slate-950/90 shadow-[24px_0_80px_-40px_rgba(2,6,23,0.9)] lg:block">
        <ConversationSidebar />
      </aside>

      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden" onClick={() => setMobileSidebarOpen(false)} />
      )}

      <div className={`fixed inset-y-0 left-0 z-50 w-[320px] transform border-r border-slate-800 bg-slate-950/95 shadow-2xl transition duration-300 lg:hidden ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <ConversationSidebar />
      </div>

      <div className="flex min-h-screen flex-1 flex-col">
        <Header />
        <div className="flex items-center gap-2 border-b border-slate-200/70 bg-white/70 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/70 lg:hidden">
          <button onClick={() => setMobileSidebarOpen(true)} className="rounded-2xl border border-slate-300 p-2.5 transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800" aria-label="Open conversations">
            <Menu size={18} />
          </button>
          <span className="text-sm font-medium">Menu</span>
        </div>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

export default MainLayout;
