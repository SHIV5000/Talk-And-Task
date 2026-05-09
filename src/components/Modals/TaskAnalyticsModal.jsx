import React from 'react';

export default function TaskAnalyticsModal({ setActiveModal, analyticsData }) {
  return (
    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-[60] flex items-center justify-center p-4"
         onClick={() => setActiveModal(null)}>
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl animate-in zoom-in-95 overflow-hidden max-h-[90vh] flex flex-col"
           onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-[#008069] to-teal-500 text-white px-6 py-5 flex items-center gap-4 shrink-0">
          <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-white/20 rounded-full"><i className="fa-solid fa-arrow-left"></i></button>
          <div><h3 className="font-bold text-lg">Task Analytics</h3><p className="text-sm opacity-90">Real‑time dashboard</p></div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[{label:'Total',value:analyticsData.total,color:'bg-blue-500'},{label:'Completed',value:analyticsData.completed,color:'bg-green-500'},{label:'In Progress',value:analyticsData.inProgress,color:'bg-amber-500'},{label:'Pending',value:analyticsData.pending,color:'bg-purple-500'},{label:'Overdue',value:analyticsData.overdue,color:'bg-red-500'}].map(item=>(
              <div key={item.label} className="bg-slate-50 rounded-xl p-4 border">
                <div className={`${item.color} w-3 h-3 rounded-full mb-2`}></div>
                <p className="text-2xl font-extrabold">{item.value}</p>
                <p className="text-[11px] font-bold text-slate-400 uppercase">{item.label}</p>
              </div>
            ))}
          </div>
          <div className="bg-slate-50 rounded-xl p-5 border">
            <p className="text-sm font-bold text-slate-600">Completion Rate</p>
            <div className="w-full bg-slate-200 rounded-full h-4"><div className="bg-green-500 h-4 rounded-full" style={{width:`${analyticsData.completionRate}%`}}></div></div>
            <p className="text-right text-xs font-bold text-green-600 mt-1">{analyticsData.completionRate}%</p>
          </div>
        </div>
      </div>
    </div>
  );
}
