import MainLayout from '../components/layout/MainLayout';
import EmptyState from '../components/common/EmptyState';

function Profile() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Profile</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Profile settings and account details will live here.</p>
        </div>
        <EmptyState title="Profile shell ready" description="This placeholder keeps the layout consistent while the real profile experience is added." />
      </div>
    </MainLayout>
  );
}

export default Profile;
