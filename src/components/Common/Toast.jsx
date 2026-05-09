import React, { useEffect } from 'react';

export default function Toast({ toasts, removeToast }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed top-4 right-4 z-[999] flex flex-col gap-2">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium animate-slide-in-right ${
            t.type === 'task' ? 'bg-indigo-500' :
            t.type === 'message' ? 'bg-primary' :
            'bg-amber-500'
          }`}
          onClick={() => removeToast(t.id)}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
