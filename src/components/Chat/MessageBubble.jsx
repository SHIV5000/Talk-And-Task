import React, { useState, useEffect, useRef, useMemo } from 'react';
import MemoizedAvatar from '../Common/MemoizedAvatar.jsx';
import { db, storage } from '../../firebase.js';
import { doc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

const STANDARD_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '👏', '🎉', '🔥', '👀', '💯', '✅', '❌', '🙏', '🙌', '✨', '🤔', '😎', '🥳', '🚀', '💡', '📌', '🤝', '👌', '🎯'];
const stripHtml = (html) => html ? String(html).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ') : '';

const MessageBubble = React.memo(({ msg, userEmail, currentUserData, activeGroup, isVipAdmin, hasReplies, replyCount, isHighlighted, isUnreadHighlight, editingMessageId, editMessageText, setEditingMessageId, setEditMessageText, handleSaveEdit, scrollToMessageDirect, handleReaction, handleToggleBookmark, handleTogglePin, handleDeleteMessage, chatInputRef, toolPreferences, setReplyingTo, setSelectedMessage, setIsEditingTaskTitle, setActiveModal, dbUsers, jumpToPrivateSource, handleAddInlineComment, customTags = [], setActiveThread, isThreadView = false }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false); 
  const [isTaskExpanded, setIsTaskExpanded] = useState(false);
  
  const [isAddingUpdate, setIsAddingUpdate] = useState(false);
  const [inlineUpdateText, setInlineUpdateText] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(stripHtml(msg.text));
  const [isDelegating, setIsDelegating] = useState(false);
  const [delegateSelection, setDelegateSelection] = useState([]);
  const [editingTrailIdx, setEditingTrailIdx] = useState(null);
  const [trailEditText, setTrailEditText] = useState("");
  const [trailFileUploading, setTrailFileUploading] = useState(false);
  
  const menuRef = useRef(null);
  const tagPickerRef = useRef(null);
  const inlineFileInputRef = useRef(null);

  const isBookmarked = msg.bookmarkedBy?.includes(userEmail);
  const canModify = msg.isMine && !msg.isTask && !hasReplies && !(Object.keys(msg.reactions || {}).length > 0);
  const isEditingThis = editingMessageId === msg.id;

  const senderUser = dbUsers?.find(u => u.email === msg.senderEmail) || {};
  const senderNameRaw = senderUser.name || msg.sender || msg.senderEmail || '';
  const senderName = senderNameRaw
    .toLowerCase()
    .replace(/(^\w|\s\w)/g, (m) => m.toUpperCase())
    .split('@')[0];
  const senderAvatar = senderUser.profilePicUrl || null;

  const isTaskParticipant = msg.isTask && (msg.senderEmail === userEmail || msg.taskData?.assignees?.includes(userEmail) || currentUserData?.isAdmin || isVipAdmin);
  const isCreator = msg.senderEmail === userEmail;
  const isAssignee = (msg.taskData?.assignees || []).includes(userEmail);
  const isTaskCompleted = msg.isTask && msg.taskData?.status === 'Completed';
  const isSuperAdmin = currentUserData?.isAdmin || isVipAdmin;
  const canEditTask = !isTaskCompleted || isSuperAdmin;
  
  const currentAckBy = msg.taskData?.acknowledgedBy || [];
  const hasAcknowledged = currentAckBy.includes(userEmail);

  // STRICT Visibility Rule
  const showAckButton = msg.isTask && !isTaskCompleted && msg.taskData?.requireAck && isAssignee && !isCreator && !hasAcknowledged;

  const hasProofAttached = useMemo(() => {
    if (!msg.taskData?.requireProof) return true;
    return (msg.taskData.trail || []).some(t => t.fileUrl);
  }, [msg.taskData]);

  const getBorderColor = () => {
    if (msg.isTask) return isTaskCompleted ? 'border-l-slate-300' : 'border-l-warning';
    if (msg.isPrivateMention || msg.isPrivateForward) return 'border-l-purple-400';
    return 'border-l-primary';
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
      if (tagPickerRef.current && !tagPickerRef.current.contains(e.target)) setTagPickerOpen(false);
    };
    if (menuOpen || tagPickerOpen) { document.addEventListener('mousedown', handleClickOutside); }
    return () => { document.removeEventListener('mousedown', handleClickOutside); };
  }, [menuOpen, tagPickerOpen]);

  const handleAcknowledge = async (e) => {
    e.stopPropagation();
    if (!window.confirm('Acknowledge this task? This confirms you have seen and accepted it.')) return;
    try {
      const now = new Date();
      const newTrail = [...(msg.taskData.trail || []), { action: "Acknowledged", by: userEmail, time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ', ' + now.toLocaleDateString() }];
      await updateDoc(doc(db, "messages", msg.id), { "taskData.acknowledgedBy": [...currentAckBy, userEmail], "taskData.status": "Acknowledged", "taskData.trail": newTrail });
    } catch(e) {}
  };

  const handleInlineSaveTitle = async () => {
    if (!tempTitle.trim()) return setIsEditingTitle(false);
    try { await updateDoc(doc(db, "messages", msg.id), { text: tempTitle }); setIsEditingTitle(false); } catch(e) {}
  };

  const submitInlineUpdate = async () => {
    if (!inlineUpdateText.trim()) return setIsAddingUpdate(false);
    try {
        const now = new Date();
        const updatedTrail = [...(msg.taskData.trail || []), { action: "Update Added", by: userEmail, time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ', ' + now.toLocaleDateString(), comment: inlineUpdateText }];
        const updates = { "taskData.trail": updatedTrail };
        if (msg.taskData.requireAck && isAssignee && !hasAcknowledged) updates["taskData.acknowledgedBy"] = [...currentAckBy, userEmail];
        await updateDoc(doc(db, "messages", msg.id), updates);
        setInlineUpdateText(""); setIsAddingUpdate(false);
    } catch(e) {}
  };

  const handleInlineComplete = async (e) => {
    e.stopPropagation();
    if (!isTaskParticipant) return;
    try {
      const now = new Date();
      const newTrail = [...msg.taskData.trail, { action: "Marked Completed", by: userEmail, time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ', ' + now.toLocaleDateString(), to: "System" }];
      const updates = { "taskData.status": "Completed", "taskData.trail": newTrail };
      if (msg.taskData.requireAck && isAssignee && !hasAcknowledged) updates["taskData.acknowledgedBy"] = [...currentAckBy, userEmail];
      await updateDoc(doc(db, "messages", msg.id), updates);
    } catch(e) {}
  };

  const handleInlineDelegateSubmit = async () => {
    if (delegateSelection.length === 0) return setIsDelegating(false);
    try {
      const now = new Date();
      const toNames = delegateSelection.map(email => dbUsers.find(x => x.email === email)?.name || email.split('@')[0]).join(', ');
      const newTrail = [...msg.taskData.trail, { action: "Delegated", by: userEmail, time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ', ' + now.toLocaleDateString(), to: toNames }];
      const updates = { "taskData.assignees": delegateSelection, "taskData.status": "In Progress", "taskData.trail": newTrail };
      if (msg.taskData.requireAck && isAssignee && !hasAcknowledged) updates["taskData.acknowledgedBy"] = [...currentAckBy, userEmail];
      await updateDoc(doc(db, "messages", msg.id), updates);
      setIsDelegating(false); setDelegateSelection([]);
    } catch(e) {}
  };

  const handleInlineFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setTrailFileUploading(true);
    try {
      const uniqueFileName = `${Date.now()}_${file.name}`;
      const uploadTask = uploadBytesResumable(ref(storage, `task_updates/${uniqueFileName}`), file);
      uploadTask.on('state_changed', null, () => setTrailFileUploading(false), async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        const now = new Date();
        const newTrail = [...msg.taskData.trail, { action: "File Uploaded", by: userEmail, time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ', ' + now.toLocaleDateString(), comment: "Attached file via system", fileUrl: downloadURL, fileName: file.name }];
        const updates = { "taskData.trail": newTrail };
        if (msg.taskData.requireAck && isAssignee && !hasAcknowledged) updates["taskData.acknowledgedBy"] = [...currentAckBy, userEmail];
        await updateDoc(doc(db, "messages", msg.id), updates);
        setTrailFileUploading(false);
      });
    } catch(err) { setTrailFileUploading(false); } finally { if(inlineFileInputRef.current) inlineFileInputRef.current.value = ""; }
  };

  return (
    <div id={`msg-${msg.id}`} className={`w-full flex ${msg.isMine ? 'justify-end' : 'justify-start'} ${isThreadView ? 'mb-4' : 'msg-row-spacing'} transform-gpu group/msg ${isUnreadHighlight || isHighlighted ? 'highlight-flash' : ''} ${menuOpen ? 'relative z-50' : 'relative z-[1]'}`}>
      <MemoizedAvatar uid={msg.senderUid || 'anon'} url={senderAvatar} name={senderName} sizeClass="w-8 h-8 shrink-0 mt-1" extraClasses={msg.isMine ? 'ml-3 order-last' : 'mr-3'} />
      <div className={`flex-1 w-full min-w-0 bg-white rounded-2xl shadow-sm border border-slate-100 ${getBorderColor()} border-l-4 px-4 py-3 relative break-words flex flex-col`}>
        <div className="flex-1 w-full">
            <div className="flex items-baseline mb-1 pr-10">
              <span className="text-xs font-semibold text-indigo-600">{senderName}</span>
            </div>
            
            <button onClick={(e) => { e.stopPropagation(); setMenuOpen(prev => !prev); }} className="absolute top-2 right-2 opacity-0 group-hover/msg:opacity-100 transition-opacity text-slate-400 hover:text-indigo-600 hover:bg-slate-100 p-1.5 w-6 h-6 rounded-full flex items-center justify-center">
              <i className="fa-solid fa-ellipsis-vertical text-[14px]"></i>
            </button>
            
            {menuOpen && (
              <div ref={menuRef} className="absolute top-8 right-2 z-50 bg-white rounded-xl shadow-lg border border-slate-200 py-2 w-48 animate-in fade-in slide-in-from-top-2" onClick={(e) => e.stopPropagation()}>
                {!msg.isTask && !isThreadView && <button onClick={() => { setMenuOpen(false); setActiveThread(msg); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600"><i className="fa-solid fa-reply w-5"></i> Reply in Thread</button>}
                {!msg.isTask && <button onClick={() => { setMenuOpen(false); setSelectedMessage(msg); setActiveModal('task_convert'); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600"><i className="fa-regular fa-square-check w-5"></i> Convert to Task</button>}
                <button onClick={() => { setMenuOpen(false); setSelectedMessage(msg); setActiveModal('reminder'); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-600"><i className="fa-regular fa-clock w-5"></i> Set Reminder</button>
                <button onClick={() => { setMenuOpen(false); handleToggleBookmark(msg); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-purple-50 hover:text-purple-600"><i className={`fa-solid fa-bookmark w-5 ${isBookmarked ? 'text-indigo-600' : ''}`}></i> {isBookmarked ? 'Unbookmark' : 'Bookmark'}</button>
                {(currentUserData?.isAdmin || isVipAdmin || activeGroup?.admins?.includes(userEmail)) && <button onClick={() => { setMenuOpen(false); handleTogglePin(msg); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-600"><i className={`fa-solid fa-thumbtack w-5 ${msg.isPinned ? 'text-indigo-600' : ''}`}></i> {msg.isPinned ? 'Unpin' : 'Pin'}</button>}
                {canModify && toolPreferences?.delete && <button onClick={() => { setMenuOpen(false); handleDeleteMessage(msg); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-500 hover:bg-rose-50"><i className="fa-solid fa-trash w-5"></i> Delete</button>}
              </div>
            )}
            
            {isEditingThis ? (
              <div className="flex flex-col gap-2 my-1" onClick={e => e.stopPropagation()}>
                <textarea value={editMessageText} onChange={(e) => setEditMessageText(e.target.value)} className="w-full text-sm p-2 rounded border border-indigo-500 outline-none resize-none focus:ring-2 focus:ring-indigo-500/20" rows="2"></textarea>
                <div className="flex justify-end gap-2"><button onClick={() => setEditingMessageId(null)} className="text-xs text-slate-500 font-semibold px-3 py-1 hover:bg-slate-100 rounded">Cancel</button><button onClick={() => handleSaveEdit(msg)} className="text-xs bg-indigo-600 text-white px-4 py-1 rounded font-semibold hover:bg-indigo-700">Save</button></div>
              </div>
            ) : (
              <>
                {msg.isTask && (
                  <div className={`mt-2 border rounded-xl overflow-hidden shadow-sm transition-all ${isTaskCompleted ? 'bg-slate-50 border-slate-200 opacity-95' : 'bg-white border-slate-200 hover:shadow-md'}`}>
                    
                    {/* 👇 ESCALATION TRANSFER BANNER */}
                    {msg.taskData.escalationTransferred && !isTaskCompleted && (
                        <div className="bg-rose-900 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 flex items-center gap-2">
                            <i className="fa-solid fa-triangle-exclamation animate-pulse"></i> Escalation Transfer: Reassigned by Admin
                        </div>
                    )}

                    <div className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${msg.taskData.priority === 'High' ? 'bg-rose-50 text-rose-700 border-rose-200' : msg.taskData.priority === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                            {msg.taskData.priority === 'High' ? '🔴' : msg.taskData.priority === 'Medium' ? '🟡' : '🟢'} {msg.taskData.priority || 'Medium'}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${msg.taskData.status === 'Completed' ? 'bg-teal-50 text-teal-700 border-teal-200' : msg.taskData.status === 'In Progress' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                            {msg.taskData.status}
                          </span>
                          {msg.taskData.escalated && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 uppercase animate-pulse">🚨 Escalated</span>
                          )}
                        </div>
                        <span className={`text-[11px] font-bold flex items-center gap-1 ${isTaskCompleted ? 'text-slate-400' : 'text-slate-500'}`}>
                          <i className="fa-regular fa-calendar-check"></i> Due {new Date(msg.taskData.deadline).toLocaleDateString()}
                        </span>
                      </div>
                      
                      {isEditingTitle && canEditTask ? (
                        <div className="flex gap-2 mb-3" onClick={e=>e.stopPropagation()}>
                          <input value={tempTitle} onChange={e=>setTempTitle(e.target.value)} className="w-full text-sm font-medium border border-indigo-500 p-1.5 rounded outline-none" autoFocus />
                          <button onClick={handleInlineSaveTitle} className="text-xs bg-indigo-600 text-white px-3 py-1 rounded font-semibold hover:bg-indigo-700">Save</button>
                          <button onClick={()=>{setIsEditingTitle(false); setTempTitle(stripHtml(msg.text));}} className="text-xs bg-slate-200 text-slate-700 px-3 py-1 rounded font-semibold hover:bg-slate-300">Cancel</button>
                        </div>
                      ) : (
                        <div className={`text-sm font-semibold mb-3 leading-snug relative group/title flex items-start gap-2 ${isTaskCompleted ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                          <div className="flex-1 break-words" dangerouslySetInnerHTML={{ __html: msg.text }}></div>
                          {canEditTask && isTaskParticipant && (
                            <i className="fa-solid fa-pen text-slate-300 hover:text-indigo-600 cursor-pointer opacity-0 group-hover/title:opacity-100 transition-opacity mt-1" 
                               onClick={(e)=>{e.stopPropagation(); setTempTitle(stripHtml(msg.text)); setIsEditingTitle(true);}}>
                            </i>
                          )}
                        </div>
                      )}

                      {/* 👇 THE MAROON ACKNOWLEDGE BUTTON */}
                      {showAckButton && (
                        <div className="mb-3">
                          <button onClick={handleAcknowledge} className="w-full px-3 py-2 bg-rose-900 hover:bg-rose-800 text-white rounded-lg text-xs font-bold transition-colors shadow-sm">
                            <i className="fa-solid fa-check-double mr-1"></i> Acknowledge Task
                          </button>
                          {msg.taskData.ackDeadline && (
                            <div className="text-[10px] text-slate-400 mt-1 text-center font-semibold tracking-wide">
                              Acknowledge by {new Date(msg.taskData.ackDeadline).toLocaleString()}
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center -space-x-2 relative group/assignees">
                          {(msg.taskData.assignees || []).slice(0, 3).map(email => {
                            const assignee = dbUsers?.find(u => u.email === email);
                            const hasAcked = currentAckBy.includes(email);
                            return (
                                <div key={email} className="relative z-10" title={`${assignee?.name || email} ${hasAcked ? '(Acknowledged)' : '(Pending)'}`}>
                                    <MemoizedAvatar uid={assignee?.uid || email} url={assignee?.profilePicUrl} name={assignee?.name || email.split('@')[0]} sizeClass="w-6 h-6" extraClasses={`border-2 ${isTaskCompleted ? 'border-slate-50 opacity-70' : 'border-white'}`} />
                                    {/* 👇 DOUBLE GREEN TICK FOR ACKNOWLEDGMENT */}
                                    {hasAcked && <div className="absolute -bottom-1 -right-2 bg-white rounded-full px-0.5"><i className="fa-solid fa-check-double text-emerald-500 text-[10px]"></i></div>}
                                </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="px-2 pb-2">
                      {!isThreadView && !msg.isTask && (
                        <button onClick={(e)=>{e.stopPropagation(); setActiveThread(msg);}} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700">
                          <i className="fa-solid fa-reply mr-1"></i>Replies {replyCount > 0 ? `(${replyCount})` : ''}
                        </button>
                      )}
                    </div>
                    {isTaskParticipant && !isTaskCompleted && (
                        <div className="bg-slate-50 border-t border-slate-200 p-2 flex flex-wrap gap-2 items-center justify-end">
                           <input type="file" ref={inlineFileInputRef} className="hidden" onChange={handleInlineFileUpload} />
                           {trailFileUploading && <span className="text-xs font-bold text-indigo-500 animate-pulse mr-2">Uploading...</span>}
                           
                           {isDelegating ? (
                              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded p-1 shadow-sm w-full md:w-auto flex-1">
                                 <select value="" onChange={(e) => { if(!delegateSelection.includes(e.target.value)) setDelegateSelection([...delegateSelection, e.target.value]); }} className="text-[11px] p-1 w-full outline-none">
                                    <option value="">+ Add Assignee</option>
                                    {dbUsers.map(u => <option key={u.uid} value={u.email}>{u.name}</option>)}
                                 </select>
                                 <div className="flex items-center gap-1">
                                    {delegateSelection.map(e => {
                                        const u = dbUsers.find(x => x.email === e);
                                        const displayName = u ? u.name : e.split('@')[0];
                                        return (
                                            <span key={e} onClick={()=>setDelegateSelection(delegateSelection.filter(x=>x!==e))} className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded cursor-pointer hover:bg-rose-100 hover:text-rose-600 truncate max-w-[60px]">
                                                @{displayName}
                                            </span>
                                        );
                                    })}
                                 </div>
                                 <button onClick={handleInlineDelegateSubmit} className="text-xs bg-indigo-600 text-white px-2 py-1 rounded font-bold hover:bg-indigo-700">Save</button>
                                 <button onClick={()=>{setIsDelegating(false); setDelegateSelection([]);}} className="text-xs text-slate-500 hover:text-rose-500 px-2 font-bold">X</button>
                              </div>
                           ) : isAddingUpdate ? (
                              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded p-1 shadow-sm w-full">
                                 <input type="text" value={inlineUpdateText} onChange={e=>setInlineUpdateText(e.target.value)} placeholder="Type a quick update..." className="flex-1 text-[12px] p-1 outline-none font-medium text-slate-700" autoFocus />
                                 <button onClick={submitInlineUpdate} className="text-xs bg-indigo-600 text-white px-3 py-1 rounded font-bold hover:bg-indigo-700">Post</button>
                                 <button onClick={()=>setIsAddingUpdate(false)} className="text-xs text-slate-500 hover:text-rose-500 px-2 font-bold">Cancel</button>
                              </div>
                           ) : (
                              <>
                                 <button onClick={(e) => { e.stopPropagation(); setIsDelegating(true); }} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600 shadow-sm hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors">Delegate</button>
                                 <button onClick={(e) => { e.stopPropagation(); inlineFileInputRef.current.click(); }} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600 shadow-sm hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors">Attach</button>
                                 <button onClick={(e) => { e.stopPropagation(); setIsAddingUpdate(true); }} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600 shadow-sm hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors">Update</button>
                                 <button onClick={handleInlineComplete} disabled={!hasProofAttached} className={`px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] font-bold text-emerald-700 shadow-sm hover:bg-emerald-100 transition-colors ${!hasProofAttached ? 'opacity-50 cursor-not-allowed' : ''}`} title={!hasProofAttached ? 'You must attach a file to complete this task' : ''}>Resolve</button>
                              </>
                           )}
                        </div>
                    )}

                    <button onClick={(e) => { e.stopPropagation(); setIsTaskExpanded(!isTaskExpanded); setIsAddingUpdate(false); setIsDelegating(false); }} className={`w-full border-t border-slate-200 py-2 text-xs font-bold transition-colors flex items-center justify-center gap-2 ${isTaskCompleted ? 'bg-slate-100 text-slate-400' : 'bg-slate-50 text-slate-500 hover:text-indigo-600'}`}>
                      <i className={`fa-solid fa-chevron-${isTaskExpanded ? 'up' : 'down'} text-[10px]`}></i>
                      {isTaskExpanded ? 'Hide Details' : `View Updates & Trail (${msg.taskData.trail?.length || 0})`}
                    </button>

                    {isTaskExpanded && (
                      <div className="bg-slate-50 border-t border-slate-200 p-3 animate-in slide-in-from-top-2">
                        <div className="space-y-3 mb-4 max-h-[300px] overflow-y-auto pr-2 custom-sidebar-scroll scroll-smooth">
                          {(msg.taskData.trail || []).map((t, idx) => {
                            const tAuthor = dbUsers.find(u => u.email === t.by)?.name || 'System';
                            return (
                            <div key={idx} className="flex gap-3 text-sm group/trailitem">
                              <div className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 shrink-0 mt-1">
                                <i className={`text-[10px] ${t.action.includes('Created') ? 'fa-solid fa-bolt text-amber-500' : t.action.includes('Completed') ? 'fa-solid fa-check text-teal-500' : t.action.includes('Delegated') ? 'fa-solid fa-share-nodes text-indigo-500' : t.fileUrl ? 'fa-solid fa-paperclip text-blue-500' : 'fa-solid fa-comment-dots text-indigo-500'}`}></i>
                              </div>
                              <div className="flex-1 min-w-0">
                                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm relative group/editbox">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="font-bold text-[11px] text-indigo-600">{tAuthor}</span>
                                      <span className="text-[10px] font-bold text-slate-400">{t.time?.split(',')[0]}</span>
                                    </div>
                                    <div className="text-[13px] text-slate-600 leading-snug break-words">
                                      <span className="font-semibold">{t.action}</span>
                                      {t.to && <span> to <span className="font-semibold text-indigo-600">{t.to}</span></span>}
                                      {t.comment && !t.fileUrl && <div className="mt-1 pl-2 border-l-[3px] border-slate-200 text-slate-500 italic relative">"{t.comment}"</div>}
                                      {t.fileUrl && <div className="mt-2 flex items-center gap-2 p-1.5 border border-slate-200 rounded-md bg-slate-50 cursor-pointer hover:bg-slate-100 relative" onClick={() => window.open(t.fileUrl, '_blank')}><i className="fa-solid fa-file text-indigo-500 text-lg"></i><span className="text-xs font-bold text-slate-600 truncate">{t.fileName}</span></div>}
                                    </div>
                                  </div>
                              </div>
                            </div>
                          )})}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {!msg.isTask && msg.text && <div className={`text-[15px] leading-relaxed break-words font-medium text-slate-800 ${msg.fileUrl ? 'mb-3' : ''}`} dangerouslySetInnerHTML={{ __html: msg.text }}></div>}
              </>
            )}
        </div>
      </div>
    </div>
  );
});

export default MessageBubble;
