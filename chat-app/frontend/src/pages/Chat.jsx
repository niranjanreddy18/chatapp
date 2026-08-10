import MainLayout from '../components/layout/MainLayout';
import EmptyState from '../components/common/EmptyState';

function Chat() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Chat Workspace</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">The chat experience will be introduced here in a later step.</p>
        </div>
        <EmptyState title="Chat area is reserved" description="This page is intentionally left as a placeholder for future interaction features." />
      </div>
    </MainLayout>
  );
}

export default Chat;
