import React, { useState, useMemo } from 'react';
import MemoizedAvatar from '../Common/MemoizedAvatar.jsx';

export default function RightSidebar({
  showRightSidebar, setShowRightSidebar, tasksAssignedToMe, tasksAssignedByMe,
  groups, dbUsers, user, setActiveGroup, jumpToPrivateSource
}) {
  const [filter, setFilter] = useState('All'); // 'All', 'Pending', 'Completed', 'Assigned To Me', 'Created By Me'

  // Combine and deduplicate tasks
  const allTasks = useMemo(() => {
    const map = new Map();
    tasksAssignedToMe.forEach(t => map.set(t.id, t));
    tasksAssignedByMe.forEach(t => map.set(t.id, t));
    return Array.from(map.values()).sort((a,b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
  }, [tasksAssignedToMe, tasksAssignedByMe]);

  // Calculate Summary Stats
  const stats = {
    total: allTasks.length,
    completed: allTasks.filter(t => t.taskData.status === 'Completed').length,
    pending: allTasks.filter(t => t.taskData.status !== 'Completed').length,
  };

  // Apply Selected Filter
  const filteredTasks = useMemo(() => {
    let res = allTasks;
    if (filter === 'Pending') res = res.filter(t => t.taskData.status !== 'Completed');
    if (filter === 'Completed') res = res.filter(t => t.taskData.status === 'Completed');
    if (filter === 'Assigned To Me') res = tasksAssignedToMe;
    if (filter === 'Created By Me') res = tasksAssignedByMe;
    return res;
  }, [filter, allTasks, tasksAssignedToMe, tasksAssignedByMe]);

  return (
    <div className="w-full md:w-[350px] lg:w-[400px] shrink-0 bg-slate-50 shadow-[-5px_0_25px_rgba(0,0,0,0.05)] border-l border-slate-200 flex flex-col h-full absolute md:relative right-0 z-40 animate-in slide-in-from-right-2">
      
      {/* Sidebar Header */}
      <div className="h-[59px] flex items-center justify-between px-4 border-b border-slate-200 bg-white shrink-0">
        <h2 className="text-[15px] font-bold text-slate-800 flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-indigo-100 flex items-center justify-center text-indigo-600"><i className="fa-solid fa-layer-group text-sm"></i></div>
          Workspace Hub
        </h2>
        <button onClick={() => setShowRightSidebar(false)} className="text-slate-400 hover:text-danger w-8 h-8 rounded-full hover:bg-red-50 flex items-center justify-center transition-colors">
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>
      </div>

      {/* Summary Dashboard */}
      <div className="p-4 bg-white border-b border-slate-200 shrink-0">
         <div className="flex gap-2 mb-4">
            <div className="flex-1 bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-center shadow-sm">
                <div className="text-xl font-black text-slate-700">{stats.total}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Total</div>
            </div>
            <div className="flex-1 bg-amber-50 border border-amber-100 rounded-xl p-2.5 text-center shadow-sm">
                <div className="text-xl font-black text-amber-700">{stats.pending}</div>
                <div className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mt-1">Pending</div>
            </div>
            <div className="flex-1 bg-teal-50 border border-teal-100 rounded-xl p-2.5 text-center shadow-sm">
                <div className="text-xl font-black text-teal-700">{stats.completed}</div>
                <div className="text-[10px] font-bold text-teal-500 uppercase tracking-wider mt-1">Done</div>
            </div>
         </div>
         
         {/* Filter Chips */}
         <div className="flex overflow-x-auto gap-2 custom-sidebar-scroll pb-2">
            {['All', 'Pending', 'Completed', 'Assigned To Me', 'Created By Me'].map(f => (
                <button 
                  key={f} 
                  onClick={()=>setFilter(f)} 
                  className={`shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${filter === f ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 border'}`}
                >
                  {f}
                </button>
            ))}
         </div>
      </div>

      {/* Jira-Style Task List */}
      <div className="flex-1 overflow-y-auto p-4 custom-sidebar-scroll space-y-3 bg-slate-50/50">
         {filteredTasks.length === 0 ? (
             <div className="text-sm text-slate-400 italic text-center py-8 bg-white border border-slate-100 rounded-xl">No tasks found for "{filter}"</div>
         ) : (
             filteredTasks.map(task => {
                 const group = groups.find(g => g.id === task.groupId);
                 const isDone = task.taskData.status === 'Completed';
                 return (
                     <div 
                        key={task.id}
                        onClick={() => {
                            if (jumpToPrivateSource) jumpToPrivateSource(task.id, task.groupId);
                        }}
                        className={`bg-white border rounded-xl p-3.5 shadow-sm hover:shadow-md transition-all cursor-pointer group/task ${isDone ? 'border-slate-200 opacity-70 bg-slate-50/50' : 'border-slate-200 hover:border-indigo-300'}`}
                     >
                        <div className="flex justify-between items-start mb-2.5">
                            <div className="flex gap-1.5 items-center">
                                <div className={`w-2 h-2 rounded-full ${task.taskData.priority==='High'?'bg-red-500':task.taskData.priority==='Medium'?'bg-amber-500':'bg-green-500'}`}></div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{task.taskData.status}</span>
                            </div>
                            <span className={`text-[10px] font-bold flex items-center gap-1 ${isDone ? 'text-teal-600' : 'text-slate-400'}`}>
                                <i className="fa-regular fa-clock"></i> {new Date(task.taskData.deadline).toLocaleDateString()}
                            </span>
                        </div>
                        
                        <div className={`text-[13px] font-semibold leading-snug line-clamp-2 mb-3 ${isDone ? 'text-slate-500 line-through' : 'text-slate-800 group-hover/task:text-indigo-600 transition-colors'}`}>
                            {task.text}
                        </div>
                        
                        <div className="flex justify-between items-center pt-2.5 border-t border-slate-100">
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md truncate max-w-[120px]">
                                {group?.name || 'Group'}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-indigo-500 opacity-0 group-hover/task:opacity-100 transition-opacity flex items-center gap-1 mr-1">
                                Jump <i className="fa-solid fa-arrow-right"></i>
                              </span>
                              <div className="flex -space-x-1.5">
                                  {(task.taskData.assignees || []).slice(0, 3).map(email => {
                                      const assignee = dbUsers.find(u => u.email === email);
                                      return <MemoizedAvatar key={email} uid={assignee?.uid || email} url={assignee?.profilePicUrl} name={assignee?.name || email.split('@')[0]} sizeClass="w-5 h-5" extraClasses="border border-white" />;
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
