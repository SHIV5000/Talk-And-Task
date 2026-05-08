import React from 'react';

export default function ReminderModal({
  setActiveModal,
  reminderDateTime,
  setReminderDateTime,
  setReminder
}) {
  return (
    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-[70] flex items-center justify-center p-4" onClick={() => setActiveModal(null)}>
      <div className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 transform-gpu" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
          <div className="w-10 h-10 bg-yellow-50 text-yellow-600 rounded-xl flex items-center justify-center shadow-inner">
            <i className="fa-regular fa-clock text-xl"></i>
          </div>
          <h3 className="text-xl font-bold text-slate-800">Set Reminder</h3>
        </div>
        <div className="space-y-6">
          <div className="relative">
            <label className="text-[10px] text-yellow-600 font-bold uppercase tracking-widest absolute -top-2.5 left-3 bg-white px-1">
              Alert Time
            </label>
            <input
              type="datetime-local"
              value={reminderDateTime}
              onChange={(e) => setReminderDateTime(e.target.value)}
              className="w-full p-4 pt-5 border border-slate-300 rounded-2xl text-[14px] font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 transition-all"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setActiveModal(null)} className="flex-1 text-slate-500 font-bold hover:bg-slate-100 py-3 rounded-xl transition-colors">
              Cancel
            </button>
            <button onClick={setReminder} className="flex-1 bg-yellow-500 text-white py-3 rounded-xl font-bold shadow-[0_4px_15px_rgba(234,179,8,0.3)] hover:bg-yellow-600 transition-all">
              Save Alert
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
