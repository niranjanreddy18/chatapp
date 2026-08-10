import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ArrowRight, AlertCircle, Lock, Loader2, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/layout/AuthLayout';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import { useAuth } from '../context/AuthContext';

/**
 * Extracts a human-readable error message from an Axios error response.
 * The Django backend returns errors in the shape:
 *   { success: false, message: "...", errors: { field: ["msg"] } }
 */
function parseApiError(err) {
  const data = err?.response?.data;
  if (!data) return 'Network error — please check your connection.';

  // Field-level errors (e.g. non_field_errors from DRF)
  if (data.errors && typeof data.errors === 'object') {
    const messages = Object.values(data.errors)
      .flat()
      .filter(Boolean);
    if (messages.length) return messages.join(' ');
  }

  // Top-level message from the backend
  if (data.message) return data.message;

  return 'Something went wrong. Please try again.';
}

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ mode: 'onBlur' });

  const onSubmit = async (values) => {
    setServerError('');
    setIsSubmitting(true);

    try {
      await login(values.username, values.password);
      navigate('/home', { replace: true });
    } catch (err) {
      setServerError(parseApiError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600">Nexus Chat</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-slate-100">Welcome back</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Sign in to continue your workspace.</p>
        </div>

        {/* Server-level error banner */}
        {serverError && (
          <div
            id="login-error-banner"
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        <form id="login-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* Username / email */}
          <div className="space-y-2">
            <label htmlFor="login-username" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Username or email
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <Input
                id="login-username"
                {...register('username', { required: 'Username or email is required.' })}
                className="pl-10"
                placeholder="Enter username or email"
                autoComplete="username"
                aria-invalid={!!errors.username}
              />
            </div>
            {errors.username && (
              <p className="text-xs text-red-600 dark:text-red-400">{errors.username.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label htmlFor="login-password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <Input
                id="login-password"
                {...register('password', { required: 'Password is required.' })}
                type="password"
                className="pl-10"
                placeholder="Enter password"
                autoComplete="current-password"
                aria-invalid={!!errors.password}
              />
            </div>
            {errors.password && (
              <p className="text-xs text-red-600 dark:text-red-400">{errors.password.message}</p>
            )}
          </div>

          <Button
            id="login-submit"
            type="submit"
            className="w-full gap-2"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Signing in…
              </>
            ) : (
              <>
                Continue <ArrowRight size={16} />
              </>
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          New here?{' '}
          <Link to="/register" className="font-medium text-sky-600">
            Create an account
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}

export default Login;
