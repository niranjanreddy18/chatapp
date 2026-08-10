function EmptyState({ title, description, icon }) {
  return (
    <div className="rounded-[24px] border border-dashed border-slate-300/80 bg-white/70 p-8 text-center text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
      {icon && <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-500">{icon}</div>}
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{description}</p>
    </div>
  );
}

export default EmptyState;
