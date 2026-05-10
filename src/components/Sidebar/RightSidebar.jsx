import React from 'react';
import MemoizedAvatar from '../Common/MemoizedAvatar.jsx';

export default function RightSidebar({
  showRightSidebar, setShowRightSidebar, tasksAssignedToMe, tasksAssignedByMe,
  groups, dbUsers, user, setActiveGroup, setSelectedMessage, setIsEditingTaskTitle,
  setActiveModal, jumpToPrivateSource // 👈 Passed down from ChatApp -> ChatView
}) {
  return (
    <div className={`fixed inset-y-0 right-0 z-40 w-[350px] bg-white shadow-[-5px_0_25px_rgba(0,0,0,0.05)] border-l border-slate-200 transform transition-transform duration-300 ease-in-out flex flex-col ${showRightSidebar ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="h-[59px] flex items-center justify-between px-4 border-b border-slate-200 bg-slate-50 shrink-0">
        <h2 className="text-[15px] font-bold text-slate-800 flex items-center gap-2">
          <i className="fa-solid fa-list-check text-primary"></i> My Task Hub
        </h2>
        <button onClick={() => setShowRightSidebar(false)} className="text-slate-400 hover:text-danger w-8 h-8 rounded-full hover:bg-red-50 flex items-center justify-center transition-colors">
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-sidebar-scroll bg-slate-50/50">
        <div className="mb-6">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Assigned to Me ({tasksAssignedToMe.length})</h3>
          <div className="space-y-3">
            {tasksAssignedToMe.length === 0 ? (
              <div className="text-sm text-slate-400 italic text-center py-4 bg-white rounded-xl border border-slate-100">No pending tasks</div>
            ) : (
              tasksAssignedToMe.map(task => {
                const group = groups.find(g => g.id === task.groupId);
                return (
                  <div 
                    key={task.id} 
                    // 👇 FIX: The Jump Logic is executed here!
                    onClick={() => {
                      if (jumpToPrivateSource) {
                        jumpToPrivateSource(task.id, task.groupId);
                      } else {
                        // Fallback fallback if jumpToPrivateSource isn't passed directly
                        const targetGroup = groups.find(g => g.id === task.groupId);
                        if (targetGroup) {
                          setActiveGroup(targetGroup);
                          setShowRightSidebar(false);
                          setTimeout(() => {
                            const el = document.getElementById(`msg-${task.id}`);
                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }, 500);
                        }
                      }
                    }}
                    className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group/task"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${task.taskData.priority === 'High' ? 'bg-red-50 text-red-700 border-red-200' : task.taskData.priority === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                        {task.taskData.priority}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400">{new Date(task.taskData.deadline).toLocaleDateString()}</span>
                    </div>
                    <div className="text-[13px] font-medium text-slate-700 leading-snug line-clamp-2 mb-2 group-hover/task:text-primary transition-colors">
                      {task.text}
                    </div>
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md truncate max-w-[120px]">
                        {group?.name || 'Unknown Group'}
                      </span>
                      <span className="text-[10px] font-bold text-indigo-500 flex items-center gap-1 opacity-0 group-hover/task:opacity-100 transition-opacity">
                         Go to Task <i className="fa-solid fa-arrow-right"></i>
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Created by Me ({tasksAssignedByMe.length})</h3>
          <div className="space-y-3">
             {/* Repeat same jump logic for Created By Me tasks */}
             {tasksAssignedByMe.length === 0 ? (
              <div className="text-sm text-slate-400 italic text-center py-4 bg-white rounded-xl border border-slate-100">No delegated tasks</div>
            ) : (
              tasksAssignedByMe.map(task => {
                const group = groups.find(g => g.id === task.groupId);
                return (
                  <div 
                    key={task.id} 
                    onClick={() => {
                      if (jumpToPrivateSource) {
                        jumpToPrivateSource(task.id, task.groupId);
                      } else {
                        const targetGroup = groups.find(g => g.id === task.groupId);
                        if (targetGroup) {
                          setActiveGroup(targetGroup);
                          setShowRightSidebar(false);
                          setTimeout(() => {
                            const el = document.getElementById(`msg-${task.id}`);
                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }, 500);
                        }
                      }
                    }}
                    className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group/task"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${task.taskData.priority === 'High' ? 'bg-red-50 text-red-700 border-red-200' : task.taskData.priority === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                        {task.taskData.priority}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400">{new Date(task.taskData.deadline).toLocaleDateString()}</span>
                    </div>
                    <div className="text-[13px] font-medium text-slate-700 leading-snug line-clamp-2 mb-2 group-hover/task:text-primary transition-colors">
                      {task.text}
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                      <div className="flex -space-x-1.5">
                        {(task.taskData.assignees || []).slice(0, 3).map(email => {
                          const assignee = dbUsers.find(u => u.email === email);
                          return <MemoizedAvatar key={email} uid={assignee?.uid || email} url={assignee?.profilePicUrl} name={assignee?.name || email.split('@')[0]} sizeClass="w-5 h-5" extraClasses="border border-white" />;
                        })}
                      </div>
                      <span className="text-[10px] font-bold text-indigo-500 flex items-center gap-1 opacity-0 group-hover/task:opacity-100 transition-opacity">
                         Go to Task <i className="fa-solid fa-arrow-right"></i>
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
