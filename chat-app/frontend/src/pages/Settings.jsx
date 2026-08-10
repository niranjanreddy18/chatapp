import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../components/layout/MainLayout';
import EmptyState from '../components/common/EmptyState';
import Button from '../components/common/Button';

function Settings() {
  const navigate = useNavigate();

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4">
            <Button
              variant="secondary"
              className="gap-2 rounded-2xl"
              onClick={() => navigate('/home')}
            >
              <ArrowLeft size={16} />
              Back to chat
            </Button>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Settings</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Application preferences and experience settings will be managed here.</p>
        </div>
        <EmptyState title="Settings scaffold ready" description="Theme controls and future preferences can be added directly into this page." />
      </div>
    </MainLayout>
  );
}

export default Settings;
