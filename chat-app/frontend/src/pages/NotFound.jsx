import { Link } from 'react-router-dom';
import Button from '../components/common/Button';

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12 dark:bg-slate-950">
      <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600">404</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900 dark:text-slate-100">Page not found</h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">The route you requested doesn’t exist yet in this prototype.</p>
        <div className="mt-6 flex justify-center">
          <Link to="/home">
            <Button>Back home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default NotFound;
