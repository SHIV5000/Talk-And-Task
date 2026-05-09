import React, { useState } from 'react';

export default function TaskConvertModal({
  setActiveModal,
  taskAssignees,
  setTaskAssignees,
  taskDeadline,
  setTaskDeadline,
  taskPriority,               // new prop
  setTaskPriority,            // new prop
  convertToTask,
  activeGroup,
  dbUsers,
}) {
  const priorityOptions = [
    { value: 'High',   label: '🔴 High',   color: 'text-red-600' },
    { value: 'Medium', label: '🟡 Medium', color: 'text-amber-600' },
    { value: 'Low',    label: '🟢 Low',    color: 'text-green-600' },
  ];

  return (
    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-[70] flex items-center justify-center p-4"
         onClick={() => setActiveModal(null)}>
      <div className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center"><i className="fa-regular fa-square-check text-xl"></i></div>
          <h3 className="text-xl font-bold text-slate-800">Convert to Task</h3>
        </div>

        <div className="space-y-5">
          {/* Priority selection */}
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase mb-2">Priority</div>
            <div className="flex gap-2">
              {priorityOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setTaskPriority(opt.value)}
                  className={`flex-1 py-2.5 px-2 text-xs font-semibold rounded-xl border transition-all ${
                    taskPriority === opt.value
                      ? 'bg-indigo-50 border-primary text-primary shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Assignees */}
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase mb-2">Select Assignees</div>
            <div className="h-40 overflow-y-auto space-y-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl shadow-inner custom-checkbox">
              {(activeGroup?.id === 'demo' ? dbUsers : dbUsers.filter(u => activeGroup?.members?.includes(u.email))).map(u => (
                <label key={u.uid} className="flex items-center gap-3 cursor-pointer p-2.5 hover:bg-white rounded-lg transition-colors">
                  <input type="checkbox" checked={taskAssignees.includes(u.email)}
                    onChange={(e) => { if (e.target.checked) setTaskAssignees([...taskAssignees, u.email]); else setTaskAssignees(taskAssignees.filter(email => email !== u.email)); }}
                    className="absolute opacity-0 w-0 h-0" />
                  <div className="w-5 h-5 rounded border-2 border-slate-300 flex items-center justify-center"><i className="fa-solid fa-check text-white text-[10px] opacity-0 transition-opacity"></i></div>
                  <span className="text-[14px] font-semibold text-slate-700">{u.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Deadline */}
          <div className="relative mt-2">
            <label className="text-[10px] text-blue-600 font-bold uppercase absolute -top-2.5 left-3 bg-white px-1">Set Deadline</label>
            <input type="datetime-local" value={taskDeadline} onChange={(e) => setTaskDeadline(e.target.value)}
              className="w-full p-4 pt-5 border border-slate-300 rounded-2xl text-[14px] font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setActiveModal(null)} className="flex-1 text-slate-500 font-bold hover:bg-slate-100 py-3 rounded-xl">Cancel</button>
            <button onClick={convertToTask} className="flex-1 bg-primary text-white py-3 rounded-xl font-bold shadow-lg hover:bg-primary-hover transition-all">Assign Task</button>
          </div>
        </div>
      </div>
    </div>
  );
}
