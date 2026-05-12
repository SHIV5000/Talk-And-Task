import React, { useState, useMemo } from 'react';
import MemoizedAvatar from '../Common/MemoizedAvatar.jsx';

export default function RightSidebar({
  showRightSidebar, setShowRightSidebar, tasksAssignedToMe, tasksAssignedByMe,
  archivedTasks, groups, dbUsers, navigateToMessageFromNotification
}) {
  const [filter, setFilter] = useState('All'); 
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const allTasks = useMemo(() => {
    const map = new Map();
    tasksAssignedToMe.forEach(t => map.set(t.id, t));
    tasksAssignedByMe.forEach(t => map.set(t.id, t));
    archivedTasks.forEach(t => map.set(t.id, t));
    return Array.from(map.values());
  }, [tasksAssignedToMe, tasksAssignedByMe, archivedTasks]);

  const stats = {
    total: tasksAssignedToMe.length + tasksAssignedByMe.length, 
    completed: allTasks.filter(t => t.taskData.status === 'Completed' && !t.taskData.isArchived).length,
    pending: allTasks.filter(t => t.taskData.status !== 'Completed' && !t.taskData.isArchived).length,
  };

  const filteredTasks = useMemo(() => {
    let res = [];
    if (filter === 'Archived') res = archivedTasks;
    else if (filter === 'Assigned To Me') res = tasksAssignedToMe;
    else if (filter === 'Created By Me') res = tasksAssignedByMe;
    else {
        res = allTasks.filter(t => !t.taskData.isArchived); 
        if (filter === 'Pending') res = res.filter(t => t.taskData.status !== 'Completed');
        if (filter === 'Completed') res = res.filter(t => t.taskData.status === 'Completed');
    }

    // Apply Date Range Filter
    if (startDate) {
        res = res.filter(t => new Date(t.taskData.deadline) >= new Date(startDate));
    }
    if (endDate) {
        res = res.filter(t => new Date(t.taskData.deadline) <= new Date(endDate));
    }

    // Sort: Closer deadlines first
    return res.sort((a,b) => new Date(a.taskData.deadline).getTime() - new Date(b.taskData.deadline).getTime());
  }, [filter, allTasks, tasksAssignedToMe, tasksAssignedByMe, archivedTasks, startDate, endDate]);

  return (
    <div className="w-full md:w-[350px] lg:w-[400px] shrink-0 bg-slate-50 border-l border-slate-200 flex flex-col h-full absolute md:relative right-0 z-40 animate-in slide-in-from-right-2">
      
      <div className="h-[59px] flex items-center justify-between px-4 border-b border-slate-200 bg-white shrink-0 shadow-sm">
        <h2 className="text-[15px] font-bold text-slate-800 flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-primary/10 flex items-center justify-center text-primary"><i className="fa-solid fa-layer-group text-sm"></i></div>
          Workspace Hub
        </h2>
        <button onClick={() => setShowRightSidebar(false)} className="text-slate-400 hover:text-rose-500 w-8 h-8 rounded-full hover:bg-rose-50 flex items-center justify-center transition-colors">
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>
      </div>

      <div className="p-4 bg-white border-b border-slate-200 shrink-0">
         <div className="flex gap-2 mb-4">
            <div className="flex-1 bg-slate-50 border border-slate-100 rounded-xl p-2 text-center shadow-sm">
                <div className="text-lg font-black text-slate-700">{stats.total}</div>
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">Active</div>
            </div>
            <div className="flex-1 bg-amber-50 border border-amber-100 rounded-xl p-2 text-center shadow-sm">
                <div className="text-lg font-black text-amber-700">{stats.pending}</div>
                <div className="text-[9px] font-bold text-amber-500 uppercase tracking-wider mt-1">Pending</div>
            </div>
            <div className="flex-1 bg-teal-50 border border-teal-100 rounded-xl p-2 text-center shadow-sm">
                <div className="text-lg font-black text-teal-700">{stats.completed}</div>
                <div className="text-[9px] font-bold text-teal-500 uppercase tracking-wider mt-1">Done</div>
            </div>
         </div>
         
         <div className="flex flex-wrap gap-2 mb-4">
            {['All', 'Pending', 'Completed', 'Assigned To Me', 'Created By Me', 'Archived'].map(f => (
                <button key={f} onClick={()=>setFilter(f)} className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all shadow-sm ${filter === f ? 'bg-primary text-white border-primary' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 border'}`}>
                  {f}
                </button>
            ))}
         </div>

         {/* Date Range Filter */}
         <div className="flex gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-100 shadow-inner">
             <i className="fa-solid fa-calendar-day text-slate-400 text-sm ml-1"></i>
             <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="flex-1 text-[10px] uppercase font-bold text-slate-600 bg-transparent outline-none cursor-pointer" title="Start Date" />
             <span className="text-slate-300">-</span>
             <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="flex-1 text-[10px] uppercase font-bold text-slate-600 bg-transparent outline-none cursor-pointer" title="End Date" />
             {(startDate || endDate) && (
                 <button onClick={()=>{setStartDate(''); setEndDate('');}} className="text-rose-500 hover:text-rose-700 p-1"><i className="fa-solid fa-times"></i></button>
             )}
         </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-sidebar-scroll space-y-3 bg-slate-50">
         {filteredTasks.length === 0 ? (
             <div className="text-sm text-slate-400 italic text-center py-8 bg-white border border-slate-100 rounded-xl shadow-sm">No tasks match criteria.</div>
         ) : (
             filteredTasks.map(task => {
                 const group = groups.find(g => g.id === task.groupId);
                 const isDone = task.taskData.status === 'Completed';
                 const isArchived = task.taskData.isArchived;

                 return (
                     <div 
                        key={task.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (navigateToMessageFromNotification) navigateToMessageFromNotification(task.id, task.groupId);
                        }}
                        className={`bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer group/task relative overflow-hidden ${isDone || isArchived ? 'border-slate-200 opacity-70 bg-slate-50/50' : 'border-slate-200 hover:border-primary/40'}`}
                     >
                        {!isArchived && !isDone && (
                           <div className={`absolute top-0 left-0 w-1.5 h-full ${task.taskData.priority==='High'?'bg-red-500':task.taskData.priority==='Medium'?'bg-amber-500':'bg-emerald-500'}`}></div>
                        )}

                        <div className="flex justify-between items-start mb-2.5 pl-1.5">
                            <div className="flex gap-1.5 items-center">
                                {isArchived ? (
                                    <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                                      <i className="fa-solid fa-box-archive"></i> Archived
                                    </span>
                                ) : (
                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${isDone ? 'bg-teal-50 text-teal-600' : 'bg-slate-100 text-slate-500'}`}>
                                      {task.taskData.status}
                                    </span>
                                )}
                            </div>
                            <span className={`text-[10px] font-bold flex items-center gap-1 ${isDone ? 'text-teal-600' : 'text-slate-400'}`}>
                                <i className="fa-regular fa-calendar"></i> {new Date(task.taskData.deadline).toLocaleDateString()}
                            </span>
                        </div>
                        
                        <div className={`text-[13.5px] font-semibold leading-snug line-clamp-2 mb-3 pl-1.5 ${isDone || isArchived ? 'text-slate-500 line-through' : 'text-slate-800 group-hover/task:text-primary transition-colors'}`}>
                            {task.text}
                        </div>
                        
                        <div className="flex justify-between items-center pt-3 mt-1 border-t border-slate-100 pl-1.5">
                            <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-1 rounded-md truncate max-w-[120px] shadow-sm">
                                {group?.name || 'Direct Task'}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-primary opacity-0 group-hover/task:opacity-100 transition-opacity mr-1 flex items-center gap-1">
                                View Original <i className="fa-solid fa-arrow-right"></i>
                              </span>
                              <div className="flex -space-x-1.5">
                                  {(task.taskData.assignees || []).slice(0, 3).map(email => {
                                      const assignee = dbUsers.find(u => u.email === email);
                                      return <MemoizedAvatar key={email} uid={assignee?.uid || email} url={assignee?.profilePicUrl} name={assignee?.name || email.split('@')[0]} sizeClass="w-6 h-6" extraClasses="border-2 border-white shadow-sm" />;
                                  })}
                              </div>
                            </div>
                        </div>
                     </div>
                 )
             })
         )}
      </div>
    </div>
  );
}
