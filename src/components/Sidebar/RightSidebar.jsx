import React, { useState, useMemo, useEffect } from 'react';
import MemoizedAvatar from '../Common/MemoizedAvatar.jsx';

const DATE_FMT = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
const formatDDMMMYY = (value) => {
  if (!value) return 'N/A';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return DATE_FMT.format(d).replace(/ /g, '-');
};

export default function RightSidebar({
  showRightSidebar, setShowRightSidebar, tasksAssignedToMe, tasksAssignedByMe,
  archivedTasks, groups, dbUsers, navigateToMessageFromNotification,
  sidebarWidth,
}) {
  const [filter, setFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [hiddenTaskIds, setHiddenTaskIds] = useState([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('rightSidebarHiddenTasks_v1') || '[]');
      if (Array.isArray(saved)) setHiddenTaskIds(saved);
    } catch (e) {}
  }, []);

  const updateHidden = (next) => {
    setHiddenTaskIds(next);
    try { localStorage.setItem('rightSidebarHiddenTasks_v1', JSON.stringify(next)); } catch (e) {}
  };

  const allTasks = useMemo(() => {
    const map = new Map();
    tasksAssignedToMe.forEach(t => map.set(t.id, t));
    tasksAssignedByMe.forEach(t => map.set(t.id, t));
    archivedTasks.forEach(t => map.set(t.id, t));
    return Array.from(map.values());
  }, [tasksAssignedToMe, tasksAssignedByMe, archivedTasks]);


  const filteredTasks = useMemo(() => {
    let res = [];
    if (filter === 'Archived') res = allTasks.filter(t => hiddenTaskIds.includes(t.id));
    else if (filter === 'Assigned To Me') res = tasksAssignedToMe.filter(t => !hiddenTaskIds.includes(t.id));
    else if (filter === 'Created By Me') res = tasksAssignedByMe.filter(t => !hiddenTaskIds.includes(t.id));
    else {
      res = allTasks.filter(t => !t.taskData.isArchived && !hiddenTaskIds.includes(t.id));
      if (filter === 'Pending') res = res.filter(t => t.taskData.status !== 'Completed');
      if (filter === 'Completed') res = res.filter(t => t.taskData.status === 'Completed');
    }
    if (startDate) res = res.filter(t => new Date(t.taskData.deadline) >= new Date(startDate));
    if (endDate) res = res.filter(t => new Date(t.taskData.deadline) <= new Date(endDate));
    return res.sort((a,b) => new Date(a.taskData.deadline).getTime() - new Date(b.taskData.deadline).getTime());
  }, [filter, allTasks, tasksAssignedToMe, tasksAssignedByMe, hiddenTaskIds, startDate, endDate]);

  const filterCounts = {
    All: allTasks.filter(t => !t.taskData.isArchived && !hiddenTaskIds.includes(t.id)).length,
    Pending: allTasks.filter(t => !t.taskData.isArchived && !hiddenTaskIds.includes(t.id) && t.taskData.status !== 'Completed').length,
    Completed: allTasks.filter(t => !t.taskData.isArchived && !hiddenTaskIds.includes(t.id) && t.taskData.status === 'Completed').length,
    'Assigned To Me': tasksAssignedToMe.filter(t => !hiddenTaskIds.includes(t.id)).length,
    'Created By Me': tasksAssignedByMe.filter(t => !hiddenTaskIds.includes(t.id)).length,
    Archived: hiddenTaskIds.length,
  };

  return (
    <div className="w-full shrink-0 bg-slate-50 shadow-[-5px_0_25px_rgba(0,0,0,0.05)] border-l border-slate-200 flex flex-col h-full absolute md:relative right-0 z-40 animate-in slide-in-from-right-2" style={{ width: `${sidebarWidth || 380}px` }}>
      <div className="h-[59px] flex items-center justify-between px-4 border-b border-slate-200 bg-white shrink-0 shadow-sm">
        <h2 className="text-[15px] font-bold text-slate-800 flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-indigo-50 flex items-center justify-center text-indigo-600"><i className="fa-solid fa-layer-group text-sm"></i></div>
          Task Hub
        </h2>
        <button onClick={() => setShowRightSidebar(false)} className="text-slate-400 hover:text-rose-500 w-8 h-8 rounded-full hover:bg-rose-50 flex items-center justify-center transition-colors">
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>
      </div>

      <div className="p-4 bg-white border-b border-slate-200 shrink-0 space-y-3">
         <div className="grid grid-cols-2 gap-2">
            {['All', 'Pending', 'Completed', 'Assigned To Me', 'Created By Me', 'Archived'].map(f => (
                <button key={f} onClick={()=>setFilter(f)} className={`px-3 py-2 rounded-xl text-[11px] font-bold transition-all border ${filter === f ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  <span className="block truncate">{f}</span>
                  <span className={`text-[10px] ${filter === f ? 'text-indigo-100' : 'text-slate-400'}`}>{filterCounts[f] || 0}</span>
                </button>
            ))}
         </div>

         <div className="grid grid-cols-2 gap-2">
             <div>
               <label className="text-[10px] font-semibold text-slate-500 mb-1 block">From</label>
               <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="modern-date-input" title="Start Date" />
             </div>
             <div>
               <label className="text-[10px] font-semibold text-slate-500 mb-1 block">To</label>
               <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="modern-date-input" title="End Date" />
             </div>
         </div>
         {(startDate || endDate) && <button onClick={()=>{setStartDate(''); setEndDate('');}} className="w-full text-xs font-semibold text-rose-600 hover:text-rose-700 py-1.5 rounded-lg bg-rose-50 border border-rose-100">Clear date range</button>}
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-sidebar-scroll space-y-3 bg-slate-50">
         {filteredTasks.length === 0 ? <div className="text-sm text-slate-400 italic text-center py-8 bg-white border border-slate-100 rounded-xl shadow-sm">No tasks match criteria.</div> : filteredTasks.map(task => {
            const group = groups.find(g => g.id === task.groupId);
            const isDone = task.taskData.status === 'Completed';
            const isHidden = hiddenTaskIds.includes(task.id);
            return (
              <div key={task.id} onClick={() => navigateToMessageFromNotification?.(task.id, task.groupId)} className={`bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer group/task relative overflow-hidden ${isDone || isHidden ? 'border-slate-200 opacity-80 bg-slate-50/60' : 'border-slate-200 hover:border-indigo-300'}`}>
                <div className="flex justify-between items-start mb-2.5">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${isDone ? 'bg-teal-50 text-teal-600' : 'bg-slate-100 text-slate-500'}`}>{isHidden ? 'Archived' : task.taskData.status}</span>
                  <span className="text-[10px] font-bold text-slate-500"><i className="fa-regular fa-calendar mr-1"></i>{formatDDMMMYY(task.taskData.deadline)}</span>
                </div>
                <div className={`text-[13.5px] font-semibold leading-snug line-clamp-2 mb-3 ${isDone ? 'text-slate-500' : 'text-slate-800'}`}><span className={isDone ? 'line-through decoration-2' : ''}>{task.text}</span></div>
                <div className="flex justify-between items-center pt-3 mt-1 border-t border-slate-100">
                  <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-1 rounded-md truncate max-w-[120px] shadow-sm">{group?.name || 'Direct Task'}</span>
                  <div className="flex items-center gap-2">
                    {!isHidden && <button onClick={(e)=>{e.stopPropagation(); updateHidden([...new Set([...hiddenTaskIds, task.id])]);}} className="text-[10px] font-bold text-rose-500 hover:text-rose-700">Archive</button>}
                    {isHidden && <button onClick={(e)=>{e.stopPropagation(); updateHidden(hiddenTaskIds.filter(id=>id!==task.id));}} className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700">Unarchive</button>}
                    <div className="flex -space-x-1.5">
                      {(task.taskData.assignees || []).slice(0, 3).map(email => {
                        const assignee = dbUsers.find(u => u.email === email);
                        return <MemoizedAvatar key={email} uid={assignee?.uid || email} url={assignee?.profilePicUrl} name={assignee?.name || email.split('@')[0]} sizeClass="w-6 h-6" extraClasses="border-2 border-white shadow-sm" imageLoading="eager" />;
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )})}
      </div>
    </div>
  );
}
