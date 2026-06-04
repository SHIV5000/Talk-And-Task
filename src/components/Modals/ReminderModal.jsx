import React from 'react';

export default function ReminderModal({ setActiveModal, reminderDateTime, setReminderDateTime, setReminder }) {
  return (
    <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px] z-[70] flex items-center justify-center p-4" onClick={() => setActiveModal(null)}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-8 shadow-2xl border border-slate-100 dark:border-slate-700 animate-in zoom-in-95 transform-gpu" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-6 border-b border-slate-100 dark:border-slate-700 pb-4">
          <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 rounded-xl flex items-center justify-center shadow-inner"><i className="fa-regular fa-clock text-xl"></i></div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Set Reminder</h3>
        </div>
        <div className="space-y-6">
          <div className="relative">
            <label className="text-[10px] text-indigo-600 dark:text-indigo-300 font-bold uppercase tracking-widest absolute -top-2.5 left-3 bg-white dark:bg-slate-900 px-1">Alert Time</label>
            <input type="datetime-local" value={reminderDateTime} onChange={(e) => setReminderDateTime(e.target.value)} className="modern-date-input dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700" />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setActiveModal(null)} className="flex-1 text-slate-500 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 py-3 rounded-xl transition-colors">Cancel</button>
            <button onClick={setReminder} className="flex-1 bg-indigo-600 dark:bg-indigo-500 text-white py-3 rounded-xl font-bold shadow-[0_4px_15px_rgba(79,70,229,0.3)] hover:bg-indigo-700 dark:hover:bg-indigo-400 transition-all">Save Alert</button>
          </div>
        </div>
      </div>
    </div>
  );
}
