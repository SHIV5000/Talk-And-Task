import React, { useState, useMemo, useEffect } from 'react';
import MemoizedAvatar from '../Common/MemoizedAvatar.jsx';
import InlineSvgIcon from '../Common/InlineSvgIcon.jsx';

const DATE_FMT = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
const formatDDMMMYY = (value) => {
  if (!value) return 'N/A';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return DATE_FMT.format(d).replace(/ /g, '-');
};

export default function RightSidebar({
  width,
  showRightSidebar,
  setShowRightSidebar,
  tasksAssignedToMe,
  tasksAssignedByMe,
  groups,
  dbUsers,
  user,
  setActiveGroup,
  setSelectedMessage,
  setIsEditingTaskTitle,
  setActiveModal,
}) {
  if (!showRightSidebar) return null;

  return (
    // Replaced w-80 with dynamic inline width to allow resizing
    <div style={{ width: width || 320 }} className="absolute right-0 md:relative h-full bg-[#f8fafc] border-l border-slate-200 flex flex-col shrink-0 z-40 animate-in slide-in-from-right shadow-[rgba(0,0,0,0.08)_-2px_0_15px]">
      <div className="h-[59px] bg-[#f0f2f5] flex items-center justify-between px-4 shrink-0 z-10 border-b border-slate-200/60 safe-top">
        <div className="font-medium text-[16px] text-[#111b21] flex items-center gap-2"><i className="fa-solid fa-list-check text-[#54656f]"></i> Task Hub</div>
        <button onClick={() => setShowRightSidebar(false)} className="w-10 h-10 rounded-full hover:bg-black/5 text-[#54656f] transition-colors flex items-center justify-center text-[19px]"><i className="fa-solid fa-xmark"></i></button>
      </div>
      <div className="flex-1 overflow-y-auto flex flex-col p-3 gap-4 bg-white">
        
        {/* Assigned to Me */}
        <div className="rounded-xl overflow-hidden flex flex-col flex-1 min-h-0">
          <div className="px-3 py-2 text-[12px] font-bold text-[#00a884] uppercase tracking-wider flex items-center gap-2"><i className="fa-solid fa-inbox"></i> Assigned To Me</div>
          <div className="overflow-y-auto flex-1 space-y-1">
            {tasksAssignedToMe.length === 0 ? (
              <div className="text-[13px] font-medium text-slate-400 text-center p-6 mt-4">Inbox zero!</div>
            ) : (
              tasksAssignedToMe.map(task => {
                const groupObj = groups.find(g => g.id === task.groupId);
                const isTaskDM = !groupObj;
                const groupNameStr = isTaskDM ? 'Direct Message' : groupObj.name;
                return (
                  <div key={task.id} onClick={() => {
                    if (groupObj) setActiveGroup(groupObj);
                    else {
                      const otherUid = task.groupId.replace(user.uid, '').replace('_', '');
                      const otherUser = dbUsers.find(u => u.uid === otherUid);
                      if (otherUser) setActiveGroup({ id: task.groupId, name: otherUser.name, isDM: true, members: [user.email, otherUser.email] });
                    }
                    setSelectedMessage(task); setIsEditingTaskTitle(false); setActiveModal('task_trail');
                  }} className="p-3 bg-white hover:bg-[#f5f6f6] rounded-lg cursor-pointer border-b border-slate-100 transition-all">
                    <div className="font-medium text-[14px] text-[#111b21] truncate mb-1">{task.text || 'File Task'}</div>
                    <div className="flex justify-between items-center mt-1.5">
                      <span className={`text-[12px] truncate max-w-[120px] font-semibold ${isTaskDM ? 'text-[#54656f]' : 'text-[#800020]'}`}>{groupNameStr}</span>
                      <span className="text-[11px] font-semibold text-[#ea0038]">Due {new Date(task.taskData.deadline).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Assigned By Me */}
        <div className="rounded-xl overflow-hidden flex flex-col flex-1 min-h-0 border-t border-slate-100 pt-3">
          <div className="px-3 py-2 text-[12px] font-bold text-[#00a884] uppercase tracking-wider flex items-center gap-2"><i className="fa-solid fa-paper-plane"></i> Assigned By Me</div>
          <div className="overflow-y-auto flex-1 space-y-1">
            {tasksAssignedByMe.length === 0 ? (
              <div className="text-[13px] font-medium text-slate-400 text-center p-6 mt-4">No active delegations</div>
            ) : (
              tasksAssignedByMe.map(task => {
                const groupObj = groups.find(g => g.id === task.groupId);
                const isTaskDM = !groupObj;
                return (
                  <div key={task.id} onClick={() => {
                    if (groupObj) setActiveGroup(groupObj);
                    else {
                      const otherUid = task.groupId.replace(user.uid, '').replace('_', '');
                      const otherUser = dbUsers.find(u => u.uid === otherUid);
                      if (otherUser) setActiveGroup({ id: task.groupId, name: otherUser.name, isDM: true, members: [user.email, otherUser.email] });
                    }
                    setSelectedMessage(task); setIsEditingTaskTitle(false); setActiveModal('task_trail');
                  }} className="p-3 bg-white hover:bg-[#f5f6f6] rounded-lg cursor-pointer border-b border-slate-100 transition-all">
                    <div className="font-medium text-[14px] text-[#111b21] truncate mb-1">{task.text || 'File Task'}</div>
                    <div className="text-[12px] text-[#54656f] truncate mb-1.5">To: {(task.taskData.assignees||[]).map(a=>(a||"").split('@')[0]).join(', ')}</div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm ${task.taskData.status==='Pending'?'bg-amber-100 text-amber-700':'bg-[#d1e8ff] text-blue-700'}`}>{task.taskData.status}</span>
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
