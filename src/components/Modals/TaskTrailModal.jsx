import React, { useState, useRef } from 'react';
import MemoizedAvatar from '../Common/MemoizedAvatar.jsx';

export default function TaskTrailModal({
  selectedMessage,
  setSelectedMessage,
  activeModal,
  setActiveModal,
  isEditingTaskTitle,
  setIsEditingTaskTitle,
  newTaskTitle,
  setNewTaskTitle,
  handleSaveTaskTitle,
  delegateAssignees,
  setDelegateAssignees,
  showDelegateDropdown,
  setShowDelegateDropdown,
  handleDelegateTask,
  trailComment,
  setTrailComment,
  handleAddComment,
  handleCompleteTask,
  handleArchiveTask,
  trailFileInputRef,
  handleTrailFileUpload,
  activeGroup,
  dbUsers,
  user,
  currentUserData,
  isVipAdmin,
}) {
  const modalRef = useRef(null);

  if (!selectedMessage?.taskData) return null;   // safety check

  return (
    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-[60] flex items-center justify-center md:p-4 animate-in fade-in" onClick={() => setActiveModal(null)}>
      <div className="bg-slate-50 w-full h-full md:h-auto md:max-h-[90vh] md:max-w-3xl md:rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 transform-gpu modal-mobile-full" onClick={e => e.stopPropagation()} ref={modalRef}>

        {/* Corporate Header */}
        <div className="bg-white p-5 flex items-center justify-between shrink-0 border-b border-slate-200 z-10">
          <div className="flex items-center gap-4">
            <button className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-600 flex items-center justify-center transition-colors" onClick={() => setActiveModal(null)}><i className="fa-solid fa-arrow-left"></i></button>
            <h2 className="font-bold text-lg text-slate-800 tracking-wide">Task Overview</h2>
          </div>
          <div className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-md text-xs font-bold border border-slate-200 uppercase tracking-widest shadow-sm">{selectedMessage.taskData.status}</div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 md:p-8 space-y-6">
          {/* Task Objective Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-start gap-3">
              {isEditingTaskTitle ? (
                <div className="flex-1 flex gap-2">
                  <textarea autoFocus value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} className="w-full text-[15px] font-medium p-3 rounded-lg border border-[#008069] text-slate-800 outline-none focus:ring-2 focus:ring-[#008069]/20 transition-all resize-none shadow-inner" rows="2"></textarea>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button onClick={handleSaveTaskTitle} className="w-10 h-10 bg-[#008069] text-white rounded-lg shadow-sm hover:bg-[#006e5a] transition-colors flex items-center justify-center"><i className="fa-solid fa-check"></i></button>
                    <button onClick={() => setIsEditingTaskTitle(false)} className="w-10 h-10 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-colors flex items-center justify-center"><i className="fa-solid fa-xmark"></i></button>
                  </div>
                </div>
              ) : (
                <div className="flex-1">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2"><i className="fa-solid fa-bullseye mr-1.5"></i> Objective</div>
                  <p className="text-[16px] font-medium text-slate-800 leading-relaxed break-words">{selectedMessage.text}</p>
                  {(selectedMessage.taskData.assignees?.includes(user.email) || selectedMessage.senderEmail === user.email || currentUserData?.isAdmin || isVipAdmin) && (
                    <button onClick={() => { setIsEditingTaskTitle(true); setNewTaskTitle(selectedMessage.text); }} className="mt-3 text-[11px] font-bold text-slate-500 hover:text-[#008069] bg-slate-50 hover:bg-teal-50 px-3 py-1.5 rounded-md border border-slate-200 flex items-center gap-1.5 transition-colors uppercase tracking-wider w-max"><i className="fa-solid fa-pen"></i> Edit Objective</button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Grid Info */}
          <div className="grid grid-cols-2 gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex flex-col"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1"><i className="fa-solid fa-users mr-1"></i> Assigned To</span><span className="text-[13px] font-bold text-slate-700 truncate">{(selectedMessage.taskData.assignees||[]).map(a=>(a||"").split('@')[0]).join(', ')}</span></div>
            <div className="flex flex-col items-end"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1"><i className="fa-regular fa-calendar mr-1"></i> Deadline</span><span className="text-[13px] font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">{new Date(selectedMessage.taskData.deadline).toLocaleDateString()}</span></div>
          </div>

          {/* Timeline Trail */}
          <div className="relative pl-5 space-y-5 before:absolute before:inset-y-0 before:left-[27px] before:w-px before:bg-slate-300">
            {selectedMessage.taskData.trail.map((item, idx) => (
              <div key={idx} className="flex gap-4 relative z-10">
                <div className="w-4 h-4 rounded-full bg-slate-200 border-2 border-white shrink-0 mt-1 shadow-sm"></div>
                <div className="flex-1 bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-slate-300 transition-colors">
                  <div className="flex justify-between items-center mb-1"><span className="text-[11px] font-bold text-[#008069] uppercase tracking-wider">{item.action}</span><span className="text-[11px] font-medium text-slate-400">{item.time.split(',')[0]}</span></div>
                  <div className="text-[13px] font-bold text-slate-700">{(item.by||'').split('@')[0]} {item.to && item.to !== 'System' && <span className="text-slate-400 font-medium mx-1">→</span>} {item.to && item.to !== 'System' && <span className="text-slate-700">{(item.to||'').split('@')[0]}</span>}</div>
                  {item.comment && <div className="mt-2 text-[13px] text-slate-600 font-medium bg-slate-50 p-3 rounded-lg border border-slate-100 break-words">"{item.comment}"</div>}
                  {item.fileUrl && (<a href={item.fileUrl} target="_blank" className="mt-2 text-[12px] font-bold text-[#008069] hover:underline flex items-center w-max gap-2 transition-colors"><i className="fa-solid fa-download"></i> Download Attached Resource</a>)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        {selectedMessage.taskData.status !== "Completed" && (selectedMessage.taskData.assignees?.includes(user.email) || currentUserData?.isAdmin || isVipAdmin || selectedMessage.senderEmail === user.email) && (
          <div className="bg-white p-5 flex flex-col gap-3 shrink-0 border-t border-slate-200 z-20">
            <div className="flex flex-col md:flex-row gap-3">
              {/* Transfer Task */}
              <div className="flex-1 relative">
                <button onClick={() => setShowDelegateDropdown(!showDelegateDropdown)} className="w-full bg-slate-50 border border-slate-200 text-left px-4 py-3 rounded-xl flex justify-between items-center text-[13px] font-semibold text-slate-700 hover:bg-slate-100 transition-all"><span className="truncate pr-2">{delegateAssignees.length === 0 ? "Transfer Task..." : (delegateAssignees||[]).map(a=>(a||"").split('@')[0]).join(', ')}</span><i className={`fa-solid fa-chevron-${showDelegateDropdown ? 'up' : 'down'} text-slate-400`}></i></button>
                {showDelegateDropdown && (
                  <div className="absolute bottom-[105%] left-0 w-full bg-white border border-slate-200 shadow-xl max-h-48 overflow-y-auto z-50 rounded-xl py-1 custom-checkbox">
                    {(activeGroup?.id === 'demo' ? dbUsers : dbUsers.filter(u => activeGroup?.members?.includes(u.email))).map(u => (
                      <label key={u.uid} className="flex items-center gap-3 cursor-pointer px-4 py-2.5 hover:bg-slate-50 transition-colors">
                        <input type="checkbox" checked={delegateAssignees.includes(u.email)} onChange={(e) => { if (e.target.checked) setDelegateAssignees([...delegateAssignees, u.email]); else setDelegateAssignees(delegateAssignees.filter(email => email !== u.email)); }} className="absolute opacity-0 w-0 h-0" />
                        <div className="w-5 h-5 rounded border-2 border-slate-300 flex items-center justify-center transition-colors"><i className="fa-solid fa-check text-white text-[10px] opacity-0 transition-opacity"></i></div>
                        <MemoizedAvatar uid={u.uid} url={u.profilePicUrl} name={u.name} sizeClass="w-6 h-6" />
                        <span className="text-[14px] font-semibold text-slate-700 truncate">{u.name}</span>
                      </label>
                    ))}
                  </div>
                )}
                {delegateAssignees.length > 0 && <button onClick={handleDelegateTask} className="mt-2 w-full bg-slate-800 text-white py-2 rounded-lg text-[12px] font-bold shadow-sm hover:bg-slate-900 transition-all">Confirm Transfer</button>}
              </div>

              {/* Add Update */}
              <div className="flex-[2] flex flex-col gap-2">
                <div className="flex items-center bg-slate-50 rounded-xl px-3 py-1 border border-slate-200 focus-within:ring-2 focus-within:ring-[#008069]/20 transition-all h-full">
                  <input type="text" value={trailComment} onChange={(e) => setTrailComment(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter'){ e.preventDefault(); handleAddComment(true); }}} placeholder="Type update & press Enter..." className="flex-1 bg-transparent outline-none text-[13px] font-medium text-slate-700 py-2.5 h-full" />
                  <input type="file" ref={trailFileInputRef} className="hidden" onChange={handleTrailFileUpload} />
                  <button onClick={() => trailFileInputRef.current.click()} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-white rounded-lg transition-colors"><i className="fa-solid fa-paperclip"></i></button>
                  <button onClick={() => handleAddComment(true)} disabled={!trailComment.trim()} className="ml-1 text-[#008069] disabled:text-slate-300 p-2 hover:bg-teal-50 rounded-lg transition-colors"><i className="fa-solid fa-paper-plane"></i></button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              {selectedMessage.taskData.status !== "Completed" && (
                <button onClick={handleCompleteTask} className="flex-[2] bg-emerald-600 text-white py-3 rounded-xl text-[13px] font-bold shadow-sm hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"><i className="fa-solid fa-check"></i> Mark Completed</button>
              )}
              <button onClick={handleArchiveTask} className="flex-1 bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800 py-3 rounded-xl text-[13px] font-bold transition-all flex items-center justify-center gap-2 border border-slate-200"><i className="fa-solid fa-box-archive"></i> Archive Task</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
