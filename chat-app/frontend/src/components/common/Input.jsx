import { forwardRef } from 'react';

const Input = forwardRef(function Input({ className = '', ...props }, ref) {
  return (
    <input
      ref={ref}
      className={`w-full rounded-2xl border border-slate-300 bg-white/90 px-3 py-2.5 text-sm text-slate-900 outline-none ring-0 transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 ${className}`}
      {...props}
    />
  );
});

export default Input;
