import React from 'react';

export default function ScheduleSendModal({ setActiveModal, scheduleDateTime, setScheduleDateTime, pendingScheduledText, handleScheduleMessage }) {
  return (
    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[70] flex items-center justify-center p-4 animate-in fade-in" onClick={() => setActiveModal(null)}>
      <div className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 transform-gpu flex flex-col" onClick={e => e.stopPropagation()}>
        
        <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shadow-inner"><i className="fa-regular fa-clock text-xl"></i></div>
          <h3 className="text-xl font-bold text-slate-800">Schedule Delivery</h3>
        </div>
        
        <div className="space-y-6">
          <div className="relative bg-slate-800 p-4 rounded-2xl shadow-inner border-[3px] border-slate-700">
            <label className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest block mb-2 text-center">Set Digital Timer</label>
            {/* Slot-Machine Digital Dashboard Aesthetic */}
            <input 
               type="datetime-local" 
               value={scheduleDateTime} 
               onChange={(e) => setScheduleDateTime(e.target.value)} 
               className="w-full bg-transparent text-emerald-400 text-center font-mono text-lg font-bold outline-none cursor-pointer tracking-wider" 
            />
          </div>
          
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm">
             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Payload</p>
             <p className="text-sm font-semibold text-slate-700 italic break-words line-clamp-3">"{pendingScheduledText}"</p>
          </div>
          
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setActiveModal(null)} className="flex-1 text-slate-500 font-bold hover:bg-slate-100 py-3 rounded-xl transition-colors">Cancel</button>
            <button onClick={() => handleScheduleMessage(false)} className="flex-1 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-[0_4px_15px_rgba(79,70,229,0.3)] hover:bg-indigo-700 hover:-translate-y-0.5 transition-all">Schedule</button>
          </div>
        </div>
      </div>
    </div>
  );
}
