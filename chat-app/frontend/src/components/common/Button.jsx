import { forwardRef } from 'react';

const variants = {
  primary: 'bg-sky-600 text-white shadow-[0_10px_30px_-12px_rgba(14,165,233,0.6)] hover:bg-sky-500 active:scale-[0.98]',
  secondary: 'bg-slate-200/90 text-slate-900 shadow-sm hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
  ghost: 'bg-transparent text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800',
};

const Button = forwardRef(function Button({ children, className = '', variant = 'primary', ...props }, ref) {
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center rounded-2xl px-4 py-2.5 font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-sky-500/40 ${variants[variant] || variants.primary} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});

export default Button;
