import React from 'react';

const toastTheme = (type) => {
  if (type === 'task') return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100';
  if (type === 'success') return 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100';
  if (type === 'message') return 'border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-100';
  return 'border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
};

export default function Toast({ toasts, removeToast }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed top-4 right-4 z-[999] flex w-[min(92vw,360px)] flex-col gap-2">
      {toasts.map(t => (
        <button
          key={t.id}
          type="button"
          className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-semibold shadow-xl backdrop-blur animate-slide-in-right ${toastTheme(t.type)}`}
          onClick={() => removeToast(t.id)}
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white/70 text-indigo-600 shadow-sm dark:bg-slate-950/60 dark:text-indigo-300">
              <i className={`fa-solid ${t.type === 'task' ? 'fa-list-check' : t.type === 'success' ? 'fa-check' : 'fa-bell'} text-xs`}></i>
            </span>
            <span className="leading-relaxed">{t.message}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
