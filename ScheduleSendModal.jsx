import React from 'react';

export default function ScheduleSendModal({
  setActiveModal,
  scheduleDateTime,
  setScheduleDateTime,
  pendingScheduledText,
  handleScheduleMessage,
}) {
  return (
    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-[70] flex items-center justify-center p-4" onClick={() => setActiveModal(null)}>
      <div className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 transform-gpu" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
          <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shadow-inner">
            <i className="fa-regular fa-clock text-xl"></i>
          </div>
          <h3 className="text-xl font-bold text-slate-800">Schedule Message</h3>
        </div>

        <div className="space-y-6">
          <div className="relative">
            <label className="text-[10px] text-amber-600 font-bold uppercase tracking-widest absolute -top-2.5 left-3 bg-white px-1">Pick Date & Time</label>
            <input
              type="datetime-local"
              value={scheduleDateTime}
              onChange={(e) => setScheduleDateTime(e.target.value)}
              className="w-full p-4 pt-5 border border-slate-300 rounded-2xl text-[14px] font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
            />
          </div>
          <p className="text-sm text-slate-500">Message: <span className="font-medium text-slate-700">"{pendingScheduledText}"</span></p>
          <div className="flex justify-end gap-6">
            <button onClick={() => setActiveModal(null)} className="text-slate-600 font-semibold">Cancel</button>
            <button onClick={() => handleScheduleMessage(false)} className="bg-amber-500 text-white px-6 py-2 rounded-xl font-bold shadow-md hover:bg-amber-600">Schedule</button>
          </div>
        </div>
      </div>
    </div>
  );
}
