import { createPortal } from 'react-dom';

function Modal({ open, title, children, onClose }) {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-slate-200/70 bg-white/95 p-6 shadow-[0_24px_90px_-24px_rgba(2,6,23,0.65)] dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          <button className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200" onClick={onClose} aria-label="Close modal">✕</button>
        </div>
        <div>{children}</div>
      </div>
    </div>,
    document.body
  );
}

export default Modal;
