import React, { useState, useRef } from 'react';
import MemoizedAvatar from '../Common/MemoizedAvatar.jsx';

export default function TaskTrailModal({
  selectedMessage, setSelectedMessage, setActiveModal,
  isEditingTaskTitle, setIsEditingTaskTitle, newTaskTitle, setNewTaskTitle, handleSaveTaskTitle,
  delegateAssignees, setDelegateAssignees, showDelegateDropdown, setShowDelegateDropdown, handleDelegateTask,
  trailComment, setTrailComment, handleAddComment, handleCompleteTask, handleArchiveTask,
  trailFileInputRef, handleTrailFileUpload,
  activeGroup, dbUsers, user, currentUserData, isVipAdmin, readOnly,
}) {
  const modalRef = useRef(null);
  if (!selectedMessage?.taskData) return null;

  const task = selectedMessage;
  const { taskData } = task;
  const isAdmin = currentUserData?.isAdmin || isVipAdmin || task.senderEmail === user.email;

  return (
    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-[60] flex items-center justify-center p-4 animate-in fade-in" onClick={() => setActiveModal(null)}>
      <div
        ref={modalRef}
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header - Fixed */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveModal(null)}
              className="w-8 h-8 rounded-full hover:bg-gray-100 text-text-secondary flex items-center justify-center transition-colors"
            >
              <i className="fa-solid fa-arrow-left text-sm"></i>
            </button>
            <h2 className="text-lg font-bold text-text-primary">Task Details</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              taskData.priority === 'High'   ? 'bg-red-100 text-red-700' :
              taskData.priority === 'Medium' ? 'bg-amber-100 text-amber-700' :
              'bg-green-100 text-green-700'}`}>
              {taskData.priority === 'High' ? '🔴' : taskData.priority === 'Medium' ? '🟡' : '🟢'} {taskData.priority || 'Medium'}
            </span>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              taskData.status === 'Completed' ? 'bg-teal-100 text-teal-700' :
              taskData.status === 'In Progress' ? 'bg-indigo-100 text-indigo-700' :
              'bg-amber-100 text-amber-700'}`}>
              {taskData.status}
            </span>
          </div>
        </div>

        {/* Body - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 bg-slate-50/30 custom-sidebar-scroll">
          {/* Task title */}
          <div>
            {isEditingTaskTitle ? (
              <div className="flex gap-2">
                <textarea autoFocus value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)}
                  className="w-full text-base font-medium p-3 rounded-xl border border-primary outline-none resize-none focus:ring-2 focus:ring-primary/20 bg-white" rows={2} />
                <div className="flex flex-col gap-2">
                  <button onClick={handleSaveTaskTitle} className="w-9 h-9 bg-primary text-white rounded-lg flex items-center justify-center hover:bg-primary-hover shadow-sm">
                    <i className="fa-solid fa-check"></i>
                  </button>
                  <button onClick={() => setIsEditingTaskTitle(false)} className="w-9 h-9 bg-gray-200 text-text-secondary rounded-lg flex items-center justify-center hover:bg-gray-300">
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between">
                <h3 className="text-base font-semibold text-text-primary">{task.text}</h3>
                {!readOnly && (taskData.assignees?.includes(user.email) || task.senderEmail === user.email || isAdmin) && (
                  <button onClick={() => { setIsEditingTaskTitle(true); setNewTaskTitle(task.text); }}
                    className="text-xs font-medium text-text-secondary hover:text-primary ml-2 whitespace-nowrap bg-white border border-gray-200 px-2 py-1 rounded-md shadow-sm">
                    <i className="fa-solid fa-pen mr-1"></i>Edit
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-4 bg-white shadow-sm rounded-xl p-4 border border-gray-100">
            <div>
              <div className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Assignees</div>
              <div className="flex items-center -space-x-2">
                {(taskData.assignees || []).slice(0, 5).map(email => {
                  const assignee = dbUsers?.find(u => u.email === email);
                  return <MemoizedAvatar key={email} uid={assignee?.uid || email} url={assignee?.profilePicUrl} name={assignee?.name || email.split('@')[0]} sizeClass="w-8 h-8" extraClasses="border-2 border-white" />;
                })}
                {(taskData.assignees || []).length > 5 && (
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-semibold text-text-secondary border-2 border-white">+{taskData.assignees.length - 5}</div>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Deadline</div>
              <span className="text-sm font-semibold text-warning">{new Date(taskData.deadline).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className={`h-2 rounded-full transition-all ${
              taskData.status === 'Completed' ? 'bg-teal-500 w-full' :
              taskData.status === 'In Progress' ? 'bg-indigo-500 w-1/2' :
              'bg-amber-500 w-1/4'}`}></div>
          </div>

          {/* Timeline */}
          <div className="relative pl-6 space-y-5 before:absolute before:inset-y-0 before:left-[11px] before:w-px before:bg-gray-200">
            {taskData.trail.map((item, idx) => (
              <div key={idx} className="flex gap-4 relative z-10">
                <div className="w-4 h-4 rounded-full bg-white border-2 border-primary shrink-0 mt-1"></div>
                <div className="flex-1 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-primary uppercase tracking-wider">{item.action}</span>
                    <span className="text-[11px] text-text-secondary">{item.time}</span>
                  </div>
                  <div className="text-sm font-semibold text-text-primary">
                    {(item.by || '').split('@')[0]}
                    {item.to && item.to !== 'System' && (
                      <>
                        <span className="text-text-secondary mx-1">→</span>
                        <span>{(item.to || '').split('@')[0]}</span>
                      </>
                    )}
                  </div>
                  {item.comment && (
                    <p className="mt-2 text-sm text-text-primary bg-gray-50 p-3 rounded-lg border border-gray-100">{item.comment}</p>
                  )}
                  {item.fileUrl && (
                    <a href={item.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 mt-2 text-xs font-bold text-primary hover:underline">
                      <i className="fa-solid fa-download"></i> Download Attached Resource
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer actions - Fixed */}
        {!readOnly && taskData.status !== 'Completed' && (taskData.assignees?.includes(user.email) || isAdmin) && (
          <div className="border-t border-gray-100 px-6 py-5 space-y-4 shrink-0 bg-white z-10">
            {/* Reassign / Update row */}
            <div className="flex flex-col md:flex-row gap-3">
              {/* Reassign */}
              <div className="flex-1 relative">
                <button onClick={() => setShowDelegateDropdown(!showDelegateDropdown)}
                  className="w-full bg-gray-50 border border-gray-200 text-left px-4 py-2.5 rounded-xl flex justify-between items-center text-sm font-semibold text-text-primary hover:bg-gray-100 transition-colors">
                  <span className="truncate">{delegateAssignees.length === 0 ? 'Transfer Task...' : delegateAssignees.map(a => (a || '').split('@')[0]).join(', ')}</span>
                  <i className={`fa-solid fa-chevron-${showDelegateDropdown ? 'up' : 'down'} text-text-secondary`}></i>
                </button>
                {showDelegateDropdown && (
                  <div className="absolute bottom-[105%] left-0 w-full bg-white border border-gray-200 shadow-xl max-h-48 overflow-y-auto z-[130] rounded-xl py-1">
                    {(activeGroup?.id === 'demo' ? dbUsers : dbUsers.filter(u => activeGroup?.members?.includes(u.email))).map(u => (
                      <label key={u.uid} className="flex items-center gap-3 cursor-pointer px-4 py-2.5 hover:bg-gray-50 transition-colors">
                        <input type="checkbox" checked={delegateAssignees.includes(u.email)}
                          onChange={(e) => { if (e.target.checked) setDelegateAssignees([...delegateAssignees, u.email]); else setDelegateAssignees(delegateAssignees.filter(em => em !== u.email)); }}
                          className="w-4 h-4 accent-primary rounded" />
                        <MemoizedAvatar uid={u.uid} url={u.profilePicUrl} name={u.name} sizeClass="w-6 h-6" />
                        <span className="text-sm font-semibold text-text-primary">{u.name}</span>
                      </label>
                    ))}
                  </div>
                )}
                {delegateAssignees.length > 0 && (
                  <button onClick={handleDelegateTask} className="mt-2 w-full bg-text-primary text-white py-2 rounded-lg text-xs font-bold hover:bg-gray-800 transition-colors">Confirm Transfer</button>
                )}
              </div>

              {/* Comment & file upload */}
              <div className="flex-[2] flex items-center bg-gray-50 rounded-xl px-3 py-1 border border-gray-200 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                <input type="text" value={trailComment} onChange={e => setTrailComment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddComment(true); } }}
                  placeholder="Add an update..." className="flex-1 bg-transparent outline-none text-sm font-medium text-text-primary py-2.5" />
                <input type="file" ref={trailFileInputRef} className="hidden" onChange={handleTrailFileUpload} />
                <button onClick={() => trailFileInputRef.current.click()} className="text-text-secondary hover:text-primary p-2"><i className="fa-solid fa-paperclip"></i></button>
                <button onClick={() => handleAddComment(true)} disabled={!trailComment.trim()} className="ml-1 text-primary disabled:text-text-secondary p-2 hover:bg-primary/5 rounded-lg transition-colors"><i className="fa-solid fa-paper-plane"></i></button>
              </div>
            </div>

            {/* Complete / Archive row */}
            <div className="flex gap-3">
              {taskData.status !== 'Completed' && (
                <button onClick={handleCompleteTask} className="flex-1 bg-success text-white py-2.5 rounded-xl text-sm font-bold hover:bg-teal-600 transition-colors flex items-center justify-center gap-2 shadow-sm">
                  <i className="fa-solid fa-check"></i> Mark Completed
                </button>
              )}
              <button onClick={handleArchiveTask} className="flex-1 bg-white text-text-secondary hover:bg-gray-50 hover:text-text-primary py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 border border-gray-200 shadow-sm">
                <i className="fa-solid fa-box-archive"></i> Archive Task
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
