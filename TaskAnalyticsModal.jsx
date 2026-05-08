import React from 'react';

export default function TaskAnalyticsModal({ setActiveModal, analyticsData }) {
  return (
    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-[60] flex items-center justify-center p-4 animate-in fade-in" onClick={() => setActiveModal(null)}>
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl animate-in zoom-in-95 overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="bg-gradient-to-r from-[#008069] to-teal-500 text-white px-6 py-5 flex items-center gap-4 shrink-0">
          <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-white/20 rounded-full transition-colors"><i className="fa-solid fa-arrow-left"></i></button>
          <div><h3 className="font-bold text-lg tracking-wide">Task Analytics</h3><p className="text-sm opacity-90">Real‑time performance dashboard</p></div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Total', value: analyticsData.total, color: 'bg-blue-500' },
              { label: 'Completed', value: analyticsData.completed, color: 'bg-green-500' },
              { label: 'In Progress', value: analyticsData.inProgress, color: 'bg-amber-500' },
              { label: 'Pending', value: analyticsData.pending, color: 'bg-purple-500' },
              { label: 'Overdue', value: analyticsData.overdue, color: 'bg-red-500' },
            ].map(item => (
              <div key={item.label} className="bg-slate-50 rounded-xl p-4 border border-slate-200 hover:shadow-md transition-shadow">
                <div className={`${item.color} w-3 h-3 rounded-full mb-2`}></div>
                <p className="text-2xl font-extrabold text-slate-800">{item.value}</p>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{item.label}</p>
              </div>
            ))}
          </div>

          {/* Completion Rate Bar */}
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
            <p className="text-sm font-bold text-slate-600 mb-2">Completion Rate</p>
            <div className="w-full bg-slate-200 rounded-full h-4">
              <div className="bg-green-500 h-4 rounded-full" style={{ width: `${analyticsData.completionRate}%` }}></div>
            </div>
            <p className="text-right text-xs font-bold text-green-600 mt-1">{analyticsData.completionRate}% completed</p>
          </div>

          {/* Weekly Trend (simple CSS bars) */}
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
            <p className="text-sm font-bold text-slate-600 mb-2">Weekly Trend (Last 7 Days)</p>
            <div className="flex items-end gap-2 h-40">
              {analyticsData.trend.map((day, idx) => {
                const maxCreated = Math.max(...analyticsData.trend.map(d => d.created), 1);
                const heightPercent = (day.created / maxCreated) * 80;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex flex-col items-center gap-1" style={{ height: '100%' }} title={`${day.label}: ${day.created} tasks`}>
                      <div className="w-5 bg-blue-400 rounded-t" style={{ height: `${heightPercent}%` }}></div>
                      <p className="text-[10px] font-bold text-slate-500">{day.created}</p>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-600 mt-1">{day.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Staff Breakdown */}
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
            <p className="text-sm font-bold text-slate-600 mb-3">Staff Performance</p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {Object.entries(analyticsData.staffMap).map(([email, stats]) => (
                <div key={email} className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-100">
                  <span className="text-sm font-semibold text-slate-700">{(email || '').split('@')[0]}</span>
                  <div className="flex gap-3 text-xs font-bold">
                    <span className="text-slate-500">🗂 {stats.assigned}</span>
                    <span className="text-green-600">✓ {stats.completed}</span>
                    <span className="text-red-500">⚠ {stats.overdue}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Group Breakdown */}
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
            <p className="text-sm font-bold text-slate-600 mb-3">By Department</p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {Object.entries(analyticsData.groupMap).map(([group, stats]) => (
                <div key={group} className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-100">
                  <span className="text-sm font-semibold text-[#800020]">{group}</span>
                  <div className="flex gap-3 text-xs font-bold">
                    <span className="text-slate-500">🗂 {stats.total}</span>
                    <span className="text-green-600">✓ {stats.completed}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Overdue List */}
          {analyticsData.overdueList?.length > 0 && (
            <div className="bg-red-50 rounded-xl p-5 border border-red-200">
              <p className="text-sm font-bold text-red-600 mb-2">⚠ Overdue Tasks</p>
              {analyticsData.overdueList.map(task => (
                <div key={task.id} className="text-sm text-slate-700 truncate">🔹 {task.text}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
