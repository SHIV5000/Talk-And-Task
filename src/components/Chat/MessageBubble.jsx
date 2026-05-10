import React, { useState, useEffect, useRef } from 'react';
import { formatMessageText } from '../../utils/helpers.js';
import MemoizedAvatar from '../Common/MemoizedAvatar.jsx';
import { db, storage } from '../../firebase.js';
import { doc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢'];

const MessageBubble = React.memo(({
  msg, userEmail, currentUserData, activeGroup, isVipAdmin,
  hasReplies, isHighlighted, isUnreadHighlight,
  editingMessageId, editMessageText,
  setEditingMessageId, setEditMessageText, handleSaveEdit,
  scrollToMessageDirect, handleReaction, handleToggleBookmark,
  handleTogglePin, handleDeleteMessage, chatInputRef, toolPreferences,
  setReplyingTo, setSelectedMessage, setIsEditingTaskTitle, setActiveModal, dbUsers,
  jumpToPrivateSource, handleAddInlineComment
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [isTaskExpanded, setIsTaskExpanded] = useState(false);
  
  // Inline Task States
  const [isAddingUpdate, setIsAddingUpdate] = useState(false);
  const [inlineUpdateText, setInlineUpdateText] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(msg.text);
  const [isDelegating, setIsDelegating] = useState(false);
  const [delegateSelection, setDelegateSelection] = useState([]);
  const [editingTrailIdx, setEditingTrailIdx] = useState(null);
  const [trailEditText, setTrailEditText] = useState("");
  
  const menuRef = useRef(null);
  const emojiRef = useRef(null);
  const inlineFileInputRef = useRef(null);

  const isBookmarked = msg.bookmarkedBy?.includes(userEmail);
  const canModify = msg.isMine && !msg.isTask && !hasReplies && !(Object.keys(msg.reactions || {}).length > 0);
  const isEditingThis = editingMessageId === msg.id;
  const seenByOthers = (msg.seenBy || []).filter(e => e !== userEmail).length > 0;
  const deliveredCount = (msg.deliveredTo || []).filter(e => e !== userEmail).length;

  const senderUser = dbUsers?.find(u => u.email === msg.senderEmail) || {};
  const senderName = (msg.sender || '').split('@')[0];
  const senderAvatar = senderUser.profilePicUrl || null;

  const isTaskParticipant = msg.isTask && (msg.senderEmail === userEmail || msg.taskData?.assignees?.includes(userEmail) || currentUserData?.isAdmin || isVipAdmin);

  const getBorderColor = () => {
    if (msg.isTask) return 'border-l-warning';
    if (msg.isPrivateMention || msg.isPrivateForward) return 'border-l-purple-400';
    return 'border-l-primary';
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
      if (emojiRef.current && !emojiRef.current.contains(e.target)) setEmojiPickerOpen(false);
    };
    if (menuOpen || emojiPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [menuOpen, emojiPickerOpen]);

  // ================== AUTONOMOUS INLINE FIREBASE LOGIC ==================
  
  const notifyTaskChange = async (actionText) => {
    const involved = new Set();
    if (msg.senderEmail) involved.add(msg.senderEmail);
    (msg.taskData?.assignees || []).forEach(a => involved.add(a));
    involved.delete(userEmail);
    const uidsToNotify = dbUsers.filter(u => involved.has(u.email)).map(u => u.uid);
    for (const uid of uidsToNotify) {
      try {
        await addDoc(collection(db, "notifications"), { userId: uid, type: "task", text: `"${msg.text}" - ${actionText}`, messageId: msg.id, groupId: msg.groupId, timestamp: serverTimestamp(), isRead: false });
      } catch (e) {}
    }
  };

  const handleInlineSaveTitle = async () => {
    if (!tempTitle.trim()) return setIsEditingTitle(false);
    try {
      await updateDoc(doc(db, "messages", msg.id), { text: tempTitle });
      setIsEditingTitle(false);
    } catch(e) {}
  };

  const handleInlineEditTrail = async (idx) => {
    if (!trailEditText.trim()) return setEditingTrailIdx(null);
    try {
      const newTrail = [...msg.taskData.trail];
      newTrail[idx].comment = trailEditText;
      newTrail[idx].isEdited = true;
      await updateDoc(doc(db, "messages", msg.id), { "taskData.trail": newTrail });
      setEditingTrailIdx(null);
    } catch(e) {}
  };

  const handleInlineDeleteTrail = async (idx) => {
    if(!window.confirm("Delete this update from the task?")) return;
    try {
      const newTrail = msg.taskData.trail.filter((_, i) => i !== idx);
      await updateDoc(doc(db, "messages", msg.id), { "taskData.trail": newTrail });
    } catch(e) {}
  };

  const handleInlineComplete = async () => {
    if (!isTaskParticipant) return alert("You don't have permission to complete this.");
    try {
      const now = new Date();
      const newTrail = [...msg.taskData.trail, { action: "Marked Completed", by: userEmail, time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ', ' + now.toLocaleDateString(), to: "System" }];
      await updateDoc(doc(db, "messages", msg.id), { "taskData.status": "Completed", "taskData.trail": newTrail });
      notifyTaskChange(`${(userEmail||"").split('@')[0]} completed the task ✅`);
    } catch(e) {}
  };

  const handleInlineDelegateSubmit = async () => {
    if (delegateSelection.length === 0) return setIsDelegating(false);
    try {
      const now = new Date();
      const newTrail = [...msg.taskData.trail, { action: "Delegated", by: userEmail, time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ', ' + now.toLocaleDateString(), to: delegateSelection.map(a=>(a||"").split('@')[0]).join(', ') }];
      await updateDoc(doc(db, "messages", msg.id), { "taskData.assignees": delegateSelection, "taskData.status": "In Progress", "taskData.trail": newTrail });
      notifyTaskChange(`${(userEmail||"").split('@')[0]} added new assignees 👤`);
      setIsDelegating(false);
      setDelegateSelection([]);
    } catch(e) {}
  };

  const handleInlineFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const uniqueFileName = `${Date.now()}_${file.name}`;
      const uploadTask = uploadBytesResumable(ref(storage, `task_updates/${uniqueFileName}`), file);
      uploadTask.on('state_changed', null, null, async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        const now = new Date();
        const newTrail = [...msg.taskData.trail, { action: "File Uploaded", by: userEmail, time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ', ' + now.toLocaleDateString(), comment: "Attached file", fileUrl: downloadURL, fileName: file.name }];
        await updateDoc(doc(db, "messages", msg.id), { "taskData.trail": newTrail });
        notifyTaskChange(`${(userEmail||"").split('@')[0]} attached a file 📎`);
      });
    } catch(err) {} finally { if(inlineFileInputRef.current) inlineFileInputRef.current.value = ""; }
  };

  return (
    <div
      id={`msg-${msg.id}`}
      className={`w-full flex ${msg.isMine ? 'justify-end' : 'justify-start'} msg-row-spacing transform-gpu group/msg ${isUnreadHighlight || isHighlighted ? 'highlight-flash' : ''} ${menuOpen || emojiPickerOpen ? 'relative z-50' : 'relative z-[1]'}`}
    >
      <MemoizedAvatar uid={msg.senderUid || 'anon'} url={senderAvatar} name={senderName} sizeClass="w-8 h-8 shrink-0 mt-1" extraClasses={msg.isMine ? 'ml-3' : 'mr-3'} />
      
      <div className={`w-fit max-w-[85%] md:max-w-[75%] bg-white rounded-xl shadow-sm border border-gray-100 ${getBorderColor()} border-l-4 px-4 py-3 relative break-words`}>
        
        <div className="flex items-baseline mb-1 pr-10">
          <span className="text-xs font-semibold text-primary">{senderName}</span>
        </div>
        
        <button onClick={(e) => { e.stopPropagation(); setMenuOpen(prev => !prev); }} className="absolute top-2 right-2 opacity-0 group-hover/msg:opacity-100 transition-opacity text-slate-400 hover:text-primary hover:bg-slate-100 p-1.5 rounded-full flex items-center justify-center">
          <i className="fa-solid fa-chevron-down text-[12px]"></i>
        </button>
        
        {menuOpen && (
          <div ref={menuRef} className="absolute top-8 right-2 z-50 bg-white rounded-xl shadow-lg border border-gray-200 py-2 w-56 animate-in fade-in slide-in-from-top-2" onClick={(e) => e.stopPropagation()}>
            {/* 👇 FIX: Reply removed for Task Cards */}
            {!msg.isTask && <button onClick={() => { setMenuOpen(false); setReplyingTo(msg); setTimeout(() => chatInputRef.current?.focus(), 100); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-primary-light hover:text-primary"><i className="fa-solid fa-reply w-5"></i> Reply</button>}
            {!msg.isTask && <button onClick={() => { setMenuOpen(false); setSelectedMessage(msg); setActiveModal('task_convert'); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-blue-50 hover:text-blue-600"><i className="fa-regular fa-square-check w-5"></i> Convert to Task</button>}
            
            <button onClick={() => { setMenuOpen(false); setSelectedMessage(msg); setActiveModal('reminder'); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-amber-50 hover:text-amber-600"><i className="fa-regular fa-clock w-5"></i> Set Reminder</button>
            <button onClick={() => { setMenuOpen(false); handleToggleBookmark(msg); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-purple-50 hover:text-purple-600"><i className={`fa-solid fa-bookmark w-5 ${isBookmarked ? 'text-primary' : ''}`}></i> {isBookmarked ? 'Unbookmark' : 'Bookmark'}</button>
            {(currentUserData?.isAdmin || isVipAdmin || activeGroup?.admins?.includes(userEmail)) && <button onClick={() => { setMenuOpen(false); handleTogglePin(msg); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-amber-50 hover:text-amber-600"><i className={`fa-solid fa-thumbtack w-5 ${msg.isPinned ? 'text-primary' : ''}`}></i> {msg.isPinned ? 'Unpin' : 'Pin'}</button>}
            {canModify && toolPreferences.delete && <button onClick={() => { setMenuOpen(false); handleDeleteMessage(msg); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-danger hover:bg-red-50"><i className="fa-solid fa-trash w-5"></i> Delete</button>}
            {/* Provide Archive option for tasks in the menu */}
            {msg.isTask && isTaskParticipant && <button onClick={() => { setMenuOpen(false); updateDoc(doc(db, "messages", msg.id), { "taskData.isArchived": true }); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-500 hover:bg-slate-50"><i className="fa-solid fa-box-archive w-5"></i> Archive Task</button>}
          </div>
        )}
        
        {msg.replyToId && !msg.text?.startsWith('[Task Update]') && (
          <div onClick={(e) => { e.stopPropagation(); scrollToMessageDirect(msg.replyToId); }} className="p-2 rounded bg-gray-50 mb-2 border-l-2 border-primary cursor-pointer opacity-80 hover:opacity-100">
            <div className="font-semibold text-[11px] text-primary">{(msg.originalSender||'').split('@')[0]}</div>
            <div className="line-clamp-2 text-xs text-text-secondary mt-0.5">{msg.originalText}</div>
          </div>
        )}
        
        {isEditingThis ? (
          <div className="flex flex-col gap-2 my-1" onClick={e => e.stopPropagation()}>
            <textarea value={editMessageText} onChange={(e) => setEditMessageText(e.target.value)} className="w-full text-sm p-2 rounded border border-primary outline-none resize-none focus:ring-2 focus:ring-primary/20" rows="2"></textarea>
            <div className="flex justify-end gap-2"><button onClick={() => setEditingMessageId(null)} className="text-xs text-text-secondary font-semibold px-3 py-1 hover:bg-gray-100 rounded">Cancel</button><button onClick={() => handleSaveEdit(msg)} className="text-xs bg-primary text-white px-4 py-1 rounded font-semibold hover:bg-primary-hover">Save</button></div>
          </div>
        ) : (
          <>
            {/* 👇 INLINE TASK ENGINE 👇 */}
            {msg.isTask && (
              <div className="mt-2 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                
                {/* 1. Core Task View */}
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${msg.taskData.priority === 'High' ? 'bg-red-50 text-red-700 border-red-200' : msg.taskData.priority === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                        {msg.taskData.priority === 'High' ? '🔴' : msg.taskData.priority === 'Medium' ? '🟡' : '🟢'} {msg.taskData.priority || 'Medium'}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${msg.taskData.status === 'Completed' ? 'bg-teal-50 text-teal-700 border-teal-200' : msg.taskData.status === 'In Progress' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                        {msg.taskData.status}
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                      <i className="fa-regular fa-calendar-check"></i>
                      Due {new Date(msg.taskData.deadline).toLocaleDateString()}
                    </span>
                  </div>
                  
                  {/* 👇 FIX: Inline Title Edit */}
                  {isEditingTitle ? (
                    <div className="flex gap-2 mb-3" onClick={e=>e.stopPropagation()}>
                      <input value={tempTitle} onChange={e=>setTempTitle(e.target.value)} className="w-full text-sm font-medium border border-primary p-1.5 rounded outline-none" autoFocus />
                      <button onClick={handleInlineSaveTitle} className="text-xs bg-primary text-white px-3 py-1 rounded font-semibold hover:bg-primary-hover">Save</button>
                      <button onClick={()=>{setIsEditingTitle(false); setTempTitle(msg.text);}} className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded font-semibold hover:bg-slate-200">Cancel</button>
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-slate-800 mb-3 leading-snug relative group/title">
                      {msg.text}
                      {isTaskParticipant && <i className="fa-solid fa-pen text-slate-300 hover:text-primary cursor-pointer ml-2 opacity-0 group-hover/title:opacity-100 transition-opacity" onClick={(e)=>{e.stopPropagation(); setIsEditingTitle(true);}}></i>}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center -space-x-2 relative group/assignees">
                      {(msg.taskData.assignees || []).slice(0, 3).map(email => {
                        const assignee = dbUsers?.find(u => u.email === email);
                        return <MemoizedAvatar key={email} uid={assignee?.uid || email} url={assignee?.profilePicUrl} name={assignee?.name || email.split('@')[0]} sizeClass="w-6 h-6" extraClasses="border-2 border-white relative z-10" />;
                      })}
                      {(msg.taskData.assignees || []).length > 3 && (
                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-500 border-2 border-white relative z-10">
                          +{msg.taskData.assignees.length - 3}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <button onClick={(e) => { e.stopPropagation(); setIsTaskExpanded(!isTaskExpanded); setIsAddingUpdate(false); setIsDelegating(false); }} className="w-full bg-slate-50 border-t border-slate-200 py-2 text-xs font-semibold text-slate-500 hover:text-primary hover:bg-slate-100 transition-colors flex items-center justify-center gap-2">
                  <i className={`fa-solid fa-chevron-${isTaskExpanded ? 'up' : 'down'} text-[10px]`}></i>
                  {isTaskExpanded ? 'Hide Details' : `View Updates & Trail (${msg.taskData.trail?.length || 0})`}
                </button>

                {isTaskExpanded && (
                  <div className="bg-slate-50 border-t border-slate-200 p-3 animate-in slide-in-from-top-2">
                    
                    {/* 👇 FIX: Trail with Edit/Delete capabilities */}
                    <div className="space-y-3 mb-4 max-h-[300px] overflow-y-auto pr-2 custom-sidebar-scroll">
                      {(msg.taskData.trail || []).map((t, idx) => {
                        const isMyTrail = t.by === userEmail;
                        return (
                        <div key={idx} className="flex gap-3 text-sm group/trailitem">
                          <div className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 shrink-0 mt-1">
                            <i className={`text-[10px] ${t.action.includes('Created') ? 'fa-solid fa-bolt text-amber-500' : t.action.includes('Completed') ? 'fa-solid fa-check text-teal-500' : t.action.includes('Delegated') ? 'fa-solid fa-share-nodes text-indigo-500' : t.fileUrl ? 'fa-solid fa-paperclip text-blue-500' : 'fa-solid fa-comment-dots text-primary'}`}></i>
                          </div>
                          
                          <div className="flex-1">
                            {editingTrailIdx === idx ? (
                              <div className="bg-white p-2 rounded-lg border border-primary shadow-sm" onClick={e=>e.stopPropagation()}>
                                <textarea value={trailEditText} onChange={e=>setTrailEditText(e.target.value)} className="w-full text-[13px] outline-none resize-none" rows="2" autoFocus />
                                <div className="flex justify-end gap-2 mt-1">
                                  <button onClick={()=>setEditingTrailIdx(null)} className="text-[10px] font-bold text-slate-500 hover:text-slate-700">Cancel</button>
                                  <button onClick={()=>handleInlineEditTrail(idx)} className="text-[10px] font-bold text-primary hover:text-primary-hover">Save</button>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm relative">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-bold text-[11px] text-slate-700">{(t.by||'').split('@')[0]}</span>
                                  <span className="text-[10px] font-semibold text-slate-400">{t.time?.split(',')[0]} {t.isEdited && <span className="italic ml-1">(edited)</span>}</span>
                                </div>
                                <div className="text-[13px] text-slate-600 leading-snug">
                                  <span className="font-semibold">{t.action}</span>
                                  {t.to && <span> to <span className="font-semibold text-indigo-600">@{t.to}</span></span>}
                                  {t.comment && <div className="mt-1 pl-2 border-l-[3px] border-slate-200 text-slate-500 italic">"{t.comment}"</div>}
                                  {t.fileUrl && (
                                    <a href={t.fileUrl} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1.5 bg-blue-50 text-blue-600 px-2.5 py-1 rounded text-xs font-semibold hover:bg-blue-100 transition-colors">
                                      <i className="fa-solid fa-download"></i> View Attachment
                                    </a>
                                  )}
                                </div>
                                
                                {/* Edit / Delete Trail Actions */}
                                {(isMyTrail || isVipAdmin || currentUserData?.isAdmin) && t.comment && !t.action.includes("File") && (
                                  <div className="absolute top-2 right-2 opacity-0 group-hover/trailitem:opacity-100 transition-opacity bg-white rounded shadow-sm border border-slate-100 flex overflow-hidden">
                                    <button onClick={(e)=>{e.stopPropagation(); setTrailEditText(t.comment); setEditingTrailIdx(idx);}} className="p-1.5 text-slate-400 hover:text-primary hover:bg-slate-50"><i className="fa-solid fa-pen text-[10px]"></i></button>
                                    <button onClick={(e)=>{e.stopPropagation(); handleInlineDeleteTrail(idx);}} className="p-1.5 text-slate-400 hover:text-danger hover:bg-red-50 border-l border-slate-100"><i className="fa-solid fa-trash text-[10px]"></i></button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )})}
                    </div>

                    {/* Action Bar (100% Modal Free) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200 relative">
                      <button onClick={(e) => { e.stopPropagation(); setIsAddingUpdate(!isAddingUpdate); setIsDelegating(false); }} className={`bg-white border hover:border-primary hover:text-primary font-semibold text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm ${isAddingUpdate ? 'border-primary text-primary' : 'border-slate-200 text-slate-600'}`}>
                        <i className="fa-regular fa-comment"></i> Update
                      </button>
                      
                      <button onClick={(e) => { e.stopPropagation(); setIsDelegating(!isDelegating); setIsAddingUpdate(false); }} className={`bg-white border hover:border-indigo-500 hover:text-indigo-600 font-semibold text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm ${isDelegating ? 'border-indigo-500 text-indigo-600' : 'border-slate-200 text-slate-600'}`}>
                        <i className="fa-solid fa-users-rays"></i> Delegate
                      </button>

                      <button onClick={(e) => { e.stopPropagation(); inlineFileInputRef.current?.click(); }} className="bg-white border border-slate-200 hover:border-blue-500 hover:text-blue-600 text-slate-600 font-semibold text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm">
                        <i className="fa-solid fa-paperclip"></i> Attach
                      </button>
                      <input type="file" className="hidden" ref={inlineFileInputRef} onChange={handleInlineFileUpload} />

                      <button onClick={(e) => { e.stopPropagation(); handleInlineComplete(); }} disabled={msg.taskData.status === 'Completed'} className={`font-semibold text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm ${msg.taskData.status === 'Completed' ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-500 hover:text-white'}`}>
                        <i className="fa-solid fa-check"></i> Complete
                      </button>
                    </div>

                    {/* The Embedded Text Input Box */}
                    {isAddingUpdate && (
                      <div className="mt-3 bg-white border border-slate-200 rounded-lg p-2 shadow-sm animate-in fade-in slide-in-from-top-2" onClick={(e) => e.stopPropagation()}>
                        <textarea value={inlineUpdateText} onChange={(e) => setInlineUpdateText(e.target.value)} placeholder="Type your update here..." className="w-full text-sm outline-none resize-none p-1.5 bg-transparent text-slate-700 placeholder-slate-400" rows="2" autoFocus />
                        <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-slate-100">
                          <button onClick={() => { setIsAddingUpdate(false); setInlineUpdateText(""); }} className="text-xs text-slate-500 font-semibold px-3 py-1.5 hover:bg-slate-100 rounded-md transition-colors">Cancel</button>
                          <button onClick={() => { handleAddInlineComment(msg, inlineUpdateText); setIsAddingUpdate(false); setInlineUpdateText(""); }} disabled={!inlineUpdateText.trim()} className={`text-xs font-semibold px-4 py-1.5 rounded-md transition-all shadow-sm ${inlineUpdateText.trim() ? 'bg-primary text-white hover:bg-primary-hover hover:-translate-y-0.5' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>Post Update</button>
                        </div>
                      </div>
                    )}

                    {/* The Embedded Delegate Box */}
                    {isDelegating && (
                      <div className="mt-3 bg-white border border-indigo-200 rounded-lg p-2 shadow-sm animate-in fade-in slide-in-from-top-2" onClick={(e) => e.stopPropagation()}>
                        <div className="text-xs font-bold text-indigo-600 mb-2 px-1">Select New Assignees</div>
                        <div className="max-h-32 overflow-y-auto mb-2 custom-sidebar-scroll space-y-1">
                          {dbUsers.map(u => (
                            <label key={u.uid} className="flex items-center gap-2 px-2 py-1.5 hover:bg-indigo-50 rounded cursor-pointer">
                              <input type="checkbox" checked={delegateSelection.includes(u.email)} onChange={(e) => { if(e.target.checked) setDelegateSelection([...delegateSelection, u.email]); else setDelegateSelection(delegateSelection.filter(em => em !== u.email)); }} className="rounded text-indigo-600 focus:ring-indigo-500" />
                              <span className="text-[13px] text-slate-700">{u.name}</span>
                            </label>
                          ))}
                        </div>
                        <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-slate-100">
                          <button onClick={() => { setIsDelegating(false); setDelegateSelection([]); }} className="text-xs text-slate-500 font-semibold px-3 py-1.5 hover:bg-slate-100 rounded-md transition-colors">Cancel</button>
                          <button onClick={handleInlineDelegateSubmit} disabled={delegateSelection.length === 0} className={`text-xs font-semibold px-4 py-1.5 rounded-md transition-all shadow-sm ${delegateSelection.length > 0 ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:-translate-y-0.5' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>Confirm Delegation</button>
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>
            )}

            {/* Standard DMs / Forwards below... */}
            {!msg.isTask && msg.isPrivateMention && !msg.isPrivateForward && (
              <div className="text-xs font-semibold flex items-center gap-1 mb-2 text-purple-700"><i className="fa-solid fa-lock"></i> PRIVATE</div>
            )}
            
            {!msg.isTask && msg.isPrivateForward ? (
              <div onClick={(e) => { e.stopPropagation(); jumpToPrivateSource(msg.originalMsgId, msg.originalGroupId); }} className="mt-1 mb-2 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-3 shadow-sm cursor-pointer hover:shadow-md hover:border-purple-300 transition-all group/forward relative">
                 <div className="flex items-center gap-2 mb-2">
                   <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 shrink-0"><i className="fa-solid fa-share-nodes text-[10px]"></i></div>
                   <span className="text-xs font-bold text-purple-700 leading-tight">Mentioned in {msg.forwardedFromGroupName}</span>
                 </div>
                 <p className="text-[13px] text-slate-700 font-medium italic border-l-[3px] border-purple-300 pl-3 ml-1 break-words">"{msg.text?.replace('[Forwarded Private Mention] ', '')}"</p>
                 <div className="mt-2 text-[10px] font-bold text-indigo-500 flex items-center gap-1 opacity-70 group-hover/forward:opacity-100 transition-opacity">Click to view original context <i className="fa-solid fa-arrow-right mt-[1px]"></i></div>
              </div>
            ) : !msg.isTask && msg.fileUrl ? (
              <div className="flex flex-col gap-1 my-1">
                {msg.fileType?.startsWith('image/') ? <img src={msg.fileUrl} alt="Shared" className="rounded max-w-full max-h-64 object-cover cursor-pointer" onClick={(e) => { e.stopPropagation(); window.open(msg.fileUrl, '_blank'); }} /> :
                <div className="flex items-center gap-3 p-2 rounded bg-gray-50 cursor-pointer hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); window.open(msg.fileUrl, '_blank'); }}>
                  <div className="w-10 h-10 rounded bg-white flex items-center justify-center text-text-secondary"><i className="fa-solid fa-file-lines text-lg"></i></div>
                  <div className="flex-1 overflow-hidden"><p className="text-sm truncate">{msg.fileName}</p></div>
                </div>}
              </div>
            ) : !msg.isTask && (
              <p className={`text-sm leading-relaxed whitespace-pre-wrap ${currentUserData?.fontSize || 'text-sm'}`} dangerouslySetInnerHTML={{ __html: formatMessageText(msg.text || '') }}></p>
            )}
            
            <div className="flex items-center gap-2 mt-1.5 text-[11px] text-text-secondary">
              <span className="font-semibold text-slate-400 mr-2">{msg.time}</span>
              {msg.isEdited && <span className="italic">(edited)</span>}
              {msg.hasReminder && <i className="fa-regular fa-clock text-amber-500"></i>}
              {isBookmarked && <i className="fa-solid fa-bookmark text-primary"></i>}
              {msg.isMine && !seenByOthers && deliveredCount > 0 && <span className="text-[11px] font-medium text-[#800000] ml-1">Delivered</span>}
              {msg.isMine && seenByOthers && <span className="text-[11px] font-medium text-[#006400] ml-1">Seen</span>}
            </div>
          </>
        )}

        {emojiPickerOpen && (
          <div ref={emojiRef} className="absolute bottom-full right-0 mb-2 z-50 bg-white rounded-xl shadow-lg border border-gray-200 p-1.5 flex gap-1 animate-in fade-in slide-in-from-bottom-2" onClick={(e) => e.stopPropagation()}>
            {QUICK_EMOJIS.map(emoji => (<button key={emoji} onClick={() => { setEmojiPickerOpen(false); handleReaction(msg.id, emoji); }} className="text-[18px] hover:scale-125 transition-transform p-1">{emoji}</button>))}
          </div>
        )}
        
        {Object.keys(msg.reactions || {}).length > 0 && (
          <div className="absolute -bottom-3.5 right-2 flex gap-1 z-10">
            {Object.entries(msg.reactions).map(([emoji, users]) => (
              <div key={emoji} onClick={(e) => { e.stopPropagation(); handleReaction(msg.id, emoji); }} className={`text-[13px] bg-white border border-gray-200 rounded-full px-2 py-[1px] shadow-sm flex items-center gap-1 cursor-pointer hover:scale-110 transition-transform ${users.includes(userEmail) ? 'bg-indigo-50 border-indigo-200' : ''}`}>
                <span>{emoji}</span><span className="font-semibold text-text-secondary text-[10px]">{users.length}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <button onClick={(e) => { e.stopPropagation(); setEmojiPickerOpen(prev => !prev); }} className="ml-2 self-end opacity-0 group-hover/msg:opacity-100 transition-opacity text-text-secondary hover:text-primary p-1 rounded-full hover:bg-primary/5 shrink-0">
        <i className="fa-regular fa-face-smile text-sm"></i>
      </button>

    </div>
  );
});

export default MessageBubble;
