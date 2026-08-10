import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ArrowRight, AlertCircle, Mail, Lock, Loader2, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/layout/AuthLayout';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import { useAuth } from '../context/AuthContext';

/**
 * Extracts a human-readable error message from an Axios error response.
 * Handles both top-level messages and field-level validation errors from DRF.
 */
function parseApiError(err) {
  const data = err?.response?.data;
  if (!data) return 'Network error — please check your connection.';

  // Field-level errors (flatten all field messages)
  if (data.errors && typeof data.errors === 'object') {
    const messages = Object.values(data.errors)
      .flat()
      .filter(Boolean);
    if (messages.length) return messages.join(' ');
  }

  // Top-level backend message
  if (data.message) return data.message;

  return 'Something went wrong. Please try again.';
}

/**
 * Returns a field-specific error string for a given field name from a DRF
 * error response, so we can show errors next to the correct input.
 */
function getFieldError(err, fieldName) {
  const errors = err?.response?.data?.errors;
  if (!errors) return null;
  const messages = errors[fieldName];
  if (Array.isArray(messages) && messages.length) return messages[0];
  return null;
}

function Register() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({ mode: 'onBlur' });

  const password = watch('password', '');

  const onSubmit = async (values) => {
    setServerError('');
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      await registerUser(values.username, values.email, values.password, values.confirmPassword);
      navigate('/home', { replace: true });
    } catch (err) {
      // Try to extract per-field errors first (e.g. "Username is already taken.")
      const newFieldErrors = {};
      ['username', 'email', 'password', 'confirm_password'].forEach((field) => {
        const msg = getFieldError(err, field);
        if (msg) newFieldErrors[field] = msg;
      });

      if (Object.keys(newFieldErrors).length) {
        setFieldErrors(newFieldErrors);
      } else {
        setServerError(parseApiError(err));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600">Nexus Chat</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-slate-100">Create your account</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Join Nexus Chat and start messaging.</p>
        </div>

        {/* Server-level error banner */}
        {serverError && (
          <div
            id="register-error-banner"
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        <form id="register-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* Username */}
          <div className="space-y-2">
            <label htmlFor="register-username" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Username
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <Input
                id="register-username"
                {...register('username', {
                  required: 'Username is required.',
                  minLength: { value: 3, message: 'Username must be at least 3 characters.' },
                  pattern: {
                    value: /^[a-zA-Z0-9_]+$/,
                    message: 'Username may only contain letters, numbers, and underscores.',
                  },
                })}
                className="pl-10"
                placeholder="Choose a username"
                autoComplete="username"
                aria-invalid={!!(errors.username || fieldErrors.username)}
              />
            </div>
            {(errors.username || fieldErrors.username) && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {errors.username?.message || fieldErrors.username}
              </p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <label htmlFor="register-email" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <Input
                id="register-email"
                {...register('email', {
                  required: 'Email is required.',
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Enter a valid email address.',
                  },
                })}
                type="email"
                className="pl-10"
                placeholder="name@example.com"
                autoComplete="email"
                aria-invalid={!!(errors.email || fieldErrors.email)}
              />
            </div>
            {(errors.email || fieldErrors.email) && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {errors.email?.message || fieldErrors.email}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label htmlFor="register-password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <Input
                id="register-password"
                {...register('password', {
                  required: 'Password is required.',
                  minLength: { value: 8, message: 'Password must be at least 8 characters.' },
                })}
                type="password"
                className="pl-10"
                placeholder="Create a password (min. 8 characters)"
                autoComplete="new-password"
                aria-invalid={!!(errors.password || fieldErrors.password)}
              />
            </div>
            {(errors.password || fieldErrors.password) && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {errors.password?.message || fieldErrors.password}
              </p>
            )}
          </div>

          {/* Confirm password */}
          <div className="space-y-2">
            <label htmlFor="register-confirm-password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Confirm password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <Input
                id="register-confirm-password"
                {...register('confirmPassword', {
                  required: 'Please confirm your password.',
                  validate: (value) =>
                    value === password || 'Passwords do not match.',
                })}
                type="password"
                className="pl-10"
                placeholder="Repeat your password"
                autoComplete="new-password"
                aria-invalid={!!(errors.confirmPassword || fieldErrors.confirm_password)}
              />
            </div>
            {(errors.confirmPassword || fieldErrors.confirm_password) && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {errors.confirmPassword?.message || fieldErrors.confirm_password}
              </p>
            )}
          </div>

          <Button
            id="register-submit"
            type="submit"
            className="w-full gap-2"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Creating account…
              </>
            ) : (
              <>
                Create account <ArrowRight size={16} />
              </>
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-sky-600">
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}

export default Register;
