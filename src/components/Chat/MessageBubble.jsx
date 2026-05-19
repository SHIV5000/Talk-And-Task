import React, { useState, useEffect, useRef } from 'react';
import { formatMessageText } from '../../utils/helpers.js';
import MemoizedAvatar from '../Common/MemoizedAvatar.jsx';
import { db, storage } from '../../firebase.js';
import { doc, updateDoc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
const STANDARD_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '👏', '🎉', '🔥', '👀', '💯', '✅', '❌', '🙏', '🙌', '✨', '🤔', '😎', '🥳', '🚀', '💡', '📌', '🤝', '👌', '🎯'];

const MessageBubble = React.memo(({
  msg, userEmail, currentUserData, activeGroup, isVipAdmin,
  hasReplies, replyCount, isHighlighted, isUnreadHighlight,
  editingMessageId, editMessageText,
  setEditingMessageId, setEditMessageText, handleSaveEdit,
  scrollToMessageDirect, handleReaction, handleToggleBookmark,
  handleTogglePin, handleDeleteMessage, chatInputRef, toolPreferences,
  setReplyingTo, setSelectedMessage, setIsEditingTaskTitle, setActiveModal, dbUsers,
  jumpToPrivateSource, handleAddInlineComment, customTags = [], setActiveThread, isThreadView = false,
  currentUserUid
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false); 
  const [isTaskExpanded, setIsTaskExpanded] = useState(false);
  
  // Task Inline Control States
  const [isAddingUpdate, setIsAddingUpdate] = useState(false);
  const [inlineUpdateText, setInlineUpdateText] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(msg.text);
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
  const seenByOthers = (msg.seenBy || []).filter(e => e !== userEmail).length > 0;
  const deliveredCount = (msg.deliveredTo || []).filter(e => e !== userEmail).length;

  const senderUser = dbUsers?.find(u => u.email === msg.senderEmail) || {};
  const senderName = (msg.sender || '').split('@')[0];
  const senderAvatar = senderUser.profilePicUrl || null;

  const isCreator = msg.senderEmail === userEmail;
  const isAssignee = msg.taskData?.assignees?.includes(userEmail);
  const isTaskParticipant = isCreator || isAssignee || currentUserData?.isAdmin || isVipAdmin;
  const isTaskCompleted = msg.isTask && msg.taskData?.status === 'Completed';
  const isSuperAdmin = currentUserData?.isAdmin || isVipAdmin;
  const canEditTask = !isTaskCompleted || isSuperAdmin;

  const hasReactions = Object.keys(msg.reactions || {}).length > 0;

  const isSecure = (msg.fileName || '').startsWith('__SECURE__');
  const displayFileName = isSecure ? msg.fileName.replace('__SECURE__', '') : msg.fileName;

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
    if (menuOpen || tagPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [menuOpen, tagPickerOpen]);

  const notifyTaskChange = async (actionText) => {
    const involved = new Set();
    if (msg.senderEmail) involved.add(msg.senderEmail);
    (msg.taskData?.assignees || []).forEach(a => involved.add(a));
    involved.delete(userEmail);
    const uidsToNotify = dbUsers.filter(u => involved.has(u.email)).map(u => u.uid);
    for (const uid of uidsToNotify) {
      try { await addDoc(collection(db, "notifications"), { userId: uid, type: "task", text: `"${msg.text}" - ${actionText}`, messageId: msg.id, groupId: msg.groupId, timestamp: serverTimestamp(), isRead: false }); } catch (e) {}
    }
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
        await updateDoc(doc(db, "messages", msg.id), { "taskData.trail": updatedTrail });
        notifyTaskChange(`${(userEmail||"").split('@')[0]} updated the task.`);
        setInlineUpdateText(""); setIsAddingUpdate(false);
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

  const handleInlineComplete = async (e) => {
    e.stopPropagation();
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
        await updateDoc(doc(db, "messages", msg.id), { "taskData.trail": newTrail });
        notifyTaskChange(`${(userEmail||"").split('@')[0]} attached a file 📎`);
        setTrailFileUploading(false);
      });
    } catch(err) { setTrailFileUploading(false); } finally { if(inlineFileInputRef.current) inlineFileInputRef.current.value = ""; }
  };

  // ─── Acknowledge handler (with trail entry) ─────────────────
  const handleAcknowledge = async (e) => {
    e.stopPropagation();
    if (!currentUserUid) return alert("Cannot identify user for acknowledgment.");
    if (!isAssignee) return; // safety check
    try {
      const newAckBy = [...(msg.taskData.acknowledgedBy || []), userEmail];
      const now = new Date();
      const trailEntry = {
        action: "Acknowledged",
        by: userEmail,
        time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ', ' + now.toLocaleDateString(),
        comment: `${(userEmail||"").split('@')[0]} acknowledged the task`
      };
      const updatedTrail = [...(msg.taskData.trail || []), trailEntry];
      
      await updateDoc(doc(db, "messages", msg.id), {
        "taskData.acknowledgedBy": newAckBy,
        "taskData.trail": updatedTrail,
      });

      const assignmentRef = doc(db, "messages", msg.id, "assignments", currentUserUid);
      try {
        await updateDoc(assignmentRef, {
          isAcknowledged: true,
          acknowledgedAt: serverTimestamp(),
        });
      } catch (updateError) {
        if (updateError.code === 'not-found') {
          await setDoc(assignmentRef, {
            assigneeId: currentUserUid,
            managerId: null,
            isAcknowledged: true,
            acknowledgedAt: serverTimestamp(),
            completed: false,
            completedAt: null,
            escalationLevel: 0,
            lastEscalatedAt: null,
            resolvedAt: null,
            resolvedBy: null,
          });
        } else {
          throw updateError;
        }
      }
      notifyTaskChange(`${(userEmail||"").split('@')[0]} acknowledged the task`);
    } catch (err) {
      alert("Acknowledgment failed: " + err.message);
    }
  };

  // Helper to show a tiny green check on acknowledged assignee avatars
  const AcknowledgedAvatar = ({ email }) => {
    const assignee = dbUsers?.find(u => u.email === email);
    const ackd = msg.taskData?.acknowledgedBy?.includes(email);
    if (!assignee) return null;
    return (
      <div className="relative shrink-0">
        <MemoizedAvatar
          uid={assignee.uid || email}
          url={assignee.profilePicUrl}
          name={assignee.name || email.split('@')[0]}
          sizeClass="w-6 h-6"
          extraClasses={`border-2 ${isTaskCompleted ? 'border-slate-50 opacity-70' : 'border-white'} relative z-10`}
        />
        {ackd && (
          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full flex items-center justify-center text-white text-[8px] font-bold shadow-sm">
            ✓
          </div>
        )}
      </div>
    );
  };

  // Check if the task card should be shown: only to creator and assignees
  const showTaskCard = msg.isTask && (isCreator || isAssignee);

  return (
    <div id={`msg-${msg.id}`} className={`w-full flex ${msg.isMine ? 'justify-end' : 'justify-start'} ${isThreadView ? 'mb-4' : 'msg-row-spacing'} transform-gpu group/msg ${isUnreadHighlight || isHighlighted ? 'highlight-flash' : ''} ${menuOpen ? 'relative z-50' : 'relative z-[1]'}`}>
      
      <MemoizedAvatar uid={msg.senderUid || 'anon'} url={senderAvatar} name={senderName} sizeClass="w-8 h-8 shrink-0 mt-1" extraClasses={msg.isMine ? 'ml-3 order-last' : 'mr-3'} />
      
      <div className={`flex-1 w-full min-w-0 bg-white rounded-2xl shadow-sm border border-slate-100 ${getBorderColor()} border-l-4 px-4 py-3 relative break-words flex flex-col`}>
        
        {!isThreadView && msg.isMine && (
            <div className="absolute -top-2.5 -right-2.5 bg-white border border-slate-200 rounded-full w-[26px] h-[26px] flex items-center justify-center shadow-md z-10" title="Sent">
                <i className="fa-solid fa-arrow-up text-[13px] text-green-700" style={{WebkitTextStroke: '1.5px currentColor'}}></i>
            </div>
        )}
        {!isThreadView && !msg.isMine && (
            <div className="absolute -top-2.5 -left-2.5 bg-white border border-slate-200 rounded-full w-[26px] h-[26px] flex items-center justify-center shadow-md z-10" title="Received">
                <i className="fa-solid fa-arrow-down text-[13px] text-orange-600" style={{WebkitTextStroke: '1.5px currentColor'}}></i>
            </div>
        )}

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
                {showTaskCard && (
                  <div className={`mt-2 border rounded-xl overflow-hidden shadow-sm transition-all ${isTaskCompleted ? 'bg-slate-50 border-slate-200 opacity-95' : 'bg-white border-slate-200 hover:shadow-md'}`}>
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${msg.taskData.priority === 'High' ? 'bg-rose-50 text-rose-700 border-rose-200' : msg.taskData.priority === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                            {msg.taskData.priority === 'High' ? '🔴' : msg.taskData.priority === 'Medium' ? '🟡' : '🟢'} {msg.taskData.priority || 'Medium'}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${msg.taskData.status === 'Completed' ? 'bg-teal-50 text-teal-700 border-teal-200' : msg.taskData.status === 'In Progress' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                            {msg.taskData.status}
                          </span>
                        </div>
                        <span className={`text-[11px] font-bold flex items-center gap-1 ${isTaskCompleted ? 'text-slate-400' : 'text-slate-500'}`}>
                          <i className="fa-regular fa-calendar-check"></i> Due {new Date(msg.taskData.deadline).toLocaleDateString()}
                        </span>
                      </div>
                      
                      {isEditingTitle && canEditTask ? (
                        <div className="flex gap-2 mb-3" onClick={e=>e.stopPropagation()}>
                          <input value={tempTitle} onChange={e=>setTempTitle(e.target.value)} className="w-full text-sm font-medium border border-indigo-500 p-1.5 rounded outline-none" autoFocus />
                          <button onClick={handleInlineSaveTitle} className="text-xs bg-indigo-600 text-white px-3 py-1 rounded font-semibold hover:bg-indigo-700">Save</button>
                          <button onClick={()=>{setIsEditingTitle(false); setTempTitle(msg.text);}} className="text-xs bg-slate-200 text-slate-700 px-3 py-1 rounded font-semibold hover:bg-slate-300">Cancel</button>
                        </div>
                      ) : (
                        <p className={`text-sm font-semibold mb-3 leading-snug relative group/title ${isTaskCompleted ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                          {msg.text}
                          {canEditTask && isTaskParticipant && <i className="fa-solid fa-pen text-slate-300 hover:text-indigo-600 cursor-pointer ml-2 opacity-0 group-hover/title:opacity-100 transition-opacity" onClick={(e)=>{e.stopPropagation(); setIsEditingTitle(true);}}></i>}
                        </p>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center -space-x-2 relative group/assignees">
                          {(msg.taskData.assignees || []).slice(0, 3).map(email => (
                            <AcknowledgedAvatar key={email} email={email} />
                          ))}
                          {(msg.taskData.assignees || []).length > 3 && (
                            <div className={`w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600 border-2 ${isTaskCompleted ? 'border-slate-50' : 'border-white'} relative z-10`}>
                              +{msg.taskData.assignees.length - 3}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Escalation badges REMOVED per request */}
                    
                    {isTaskParticipant && !isTaskCompleted && (
                        <div className="bg-slate-50 border-t border-slate-200 p-2 flex flex-wrap gap-2 items-center justify-end">
                           <input type="file" ref={inlineFileInputRef} className="hidden" onChange={handleInlineFileUpload} />
                           {trailFileUploading && <span className="text-xs font-bold text-indigo-500 animate-pulse mr-2">Uploading...</span>}
                           
                           {/* Acknowledge Button – only for assignees who haven't acknowledged */}
                           {msg.taskData?.requireAck && isAssignee && !msg.taskData?.acknowledgedBy?.includes(userEmail) && (
                             <button onClick={handleAcknowledge} className="px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-[11px] font-bold text-green-700 shadow-sm hover:bg-green-100 transition-colors">
                               ✅ Acknowledge
                             </button>
                           )}

                           {isDelegating ? (
                              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded p-1 shadow-sm w-full md:w-auto flex-1">
                                 <select value="" onChange={(e) => { if(!delegateSelection.includes(e.target.value)) setDelegateSelection([...delegateSelection, e.target.value]); }} className="text-[11px] p-1 w-full outline-none">
                                    <option value="">+ Add Assignee</option>
                                    {dbUsers.map(u => <option key={u.uid} value={u.email}>{u.name}</option>)}
                                 </select>
                                 <div className="flex items-center gap-1">
                                    {delegateSelection.map(e => <span key={e} onClick={()=>setDelegateSelection(delegateSelection.filter(x=>x!==e))} className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded cursor-pointer hover:bg-rose-100 hover:text-rose-600 truncate max-w-[60px]">{e.split('@')[0]}</span>)}
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
                                 <button onClick={handleInlineComplete} className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] font-bold text-emerald-700 shadow-sm hover:bg-emerald-100 transition-colors">Mark as Completed</button>
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
                            const isAuthor = t.by === userEmail || isSuperAdmin;
                            return (
                            <div key={idx} className="flex gap-3 text-sm group/trailitem">
                              <div className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 shrink-0 mt-1">
                                <i className={`text-[10px] ${t.action.includes('Created') ? 'fa-solid fa-bolt text-amber-500' : t.action.includes('Completed') ? 'fa-solid fa-check text-teal-500' : t.action.includes('Acknowledged') ? 'fa-solid fa-check text-green-500' : t.action.includes('Delegated') ? 'fa-solid fa-share-nodes text-indigo-500' : t.fileUrl ? 'fa-solid fa-paperclip text-blue-500' : 'fa-solid fa-comment-dots text-indigo-500'}`}></i>
                              </div>
                              <div className="flex-1 min-w-0">
                                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm relative group/editbox">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="font-bold text-[11px] text-indigo-600">{tAuthor}</span>
                                      <span className="text-[10px] font-bold text-slate-400">{t.time?.split(',')[0]}</span>
                                    </div>
                                    <div className="text-[13px] text-slate-600 leading-snug break-words">
                                      <span className="font-semibold">{t.action}</span>
                                      {t.to && <span> to <span className="font-semibold text-indigo-600">@{t.to}</span></span>}
                                      
                                      {t.comment && !t.fileUrl && (
                                         editingTrailIdx === idx ? (
                                            <div className="flex items-center gap-2 mt-2 bg-slate-50 p-1.5 rounded border border-slate-200">
                                               <input value={trailEditText} onChange={e=>setTrailEditText(e.target.value)} className="flex-1 border border-slate-300 p-1 text-xs rounded font-medium outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" autoFocus />
                                               <button onClick={()=>handleInlineEditTrail(idx)} className="text-emerald-600 hover:text-emerald-700 bg-white shadow-sm rounded p-1"><i className="fa-solid fa-check"></i></button>
                                               <button onClick={()=>setEditingTrailIdx(null)} className="text-rose-600 hover:text-rose-700 bg-white shadow-sm rounded p-1"><i className="fa-solid fa-xmark"></i></button>
                                            </div>
                                         ) : (
                                            <div className="mt-1 pl-2 border-l-[3px] border-slate-200 text-slate-500 italic relative">
                                                "{t.comment}"
                                                {t.isEdited && <span className="text-[9px] text-slate-400 ml-1 not-italic">(edited)</span>}
                                            </div>
                                         )
                                      )}

                                      {t.fileUrl && (
                                          <div className="mt-2 flex items-center gap-2 p-1.5 border border-slate-200 rounded-md bg-slate-50 cursor-pointer hover:bg-slate-100 relative" onClick={() => window.open(t.fileUrl, '_blank')}>
                                             <i className="fa-solid fa-file text-indigo-500 text-lg"></i>
                                             <span className="text-xs font-bold text-slate-600 truncate">{t.fileName}</span>
                                          </div>
                                      )}

                                      {isAuthor && editingTrailIdx !== idx && (
                                          <div className="absolute top-1 right-1 hidden group-hover/editbox:flex gap-1.5 bg-white border border-slate-200 shadow-sm rounded-md px-1.5 py-1 z-20">
                                              {t.comment && !t.fileUrl && <i className="fa-solid fa-pen text-[10px] text-indigo-500 cursor-pointer hover:scale-110" onClick={()=>{setEditingTrailIdx(idx); setTrailEditText(t.comment);}}></i>}
                                              <i className="fa-solid fa-trash text-[10px] text-rose-500 cursor-pointer hover:scale-110" onClick={()=>handleInlineDeleteTrail(idx)}></i>
                                          </div>
                                      )}

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

                {/* For non-task participants, just show the message text if it's a task */}
                {msg.isTask && !showTaskCard && (
                  <div className="text-[15px] leading-relaxed break-words font-medium text-slate-800 mt-1">
                    {msg.text}
                  </div>
                )}

                {!msg.isTask && msg.isPrivateMention && !msg.isPrivateForward && (
                  <div className="text-xs font-semibold flex items-center gap-1 mb-2 text-purple-700"><i className="fa-solid fa-lock"></i> PRIVATE</div>
                )}
                
                {!msg.isTask && msg.isPrivateForward && (
                  <div onClick={(e) => { e.stopPropagation(); jumpToPrivateSource(msg.originalMsgId, msg.originalGroupId); }} className="mt-1 mb-2 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-3 shadow-sm cursor-pointer hover:shadow-md transition-all group/forward relative">
                     <div className="flex items-center gap-2 mb-2">
                       <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 shrink-0"><i className="fa-solid fa-share-nodes text-[10px]"></i></div>
                       <span className="text-xs font-bold text-purple-700 leading-tight">Mentioned in {msg.forwardedFromGroupName}</span>
                     </div>
                     <p className="text-[13px] text-slate-700 font-medium italic border-l-[3px] border-purple-300 pl-3 ml-1 break-words">"{msg.text?.replace('[Forwarded Private Mention] ', '')}"</p>
                  </div>
                )}

                {!msg.isTask && !msg.isPrivateForward && msg.text && (
                  <div className={`text-[15px] leading-relaxed break-words font-medium text-slate-800 ${msg.fileUrl ? 'mb-3' : ''}`} dangerouslySetInnerHTML={{ __html: msg.text }}></div>
                )}
                
                {!msg.isTask && !msg.isPrivateForward && msg.fileUrl && (
                  <div className="flex flex-col gap-1 my-1">
                    {msg.fileType?.startsWith('image/') ? (
                       <div className="relative group/img overflow-hidden rounded-xl border border-slate-200 w-fit">
                          <img 
                            src={msg.fileUrl} 
                            alt="Shared" 
                            onContextMenu={isSecure ? e => e.preventDefault() : undefined} 
                            className="w-32 h-32 md:w-48 md:h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity" 
                            onClick={(e) => { e.stopPropagation(); if(!isSecure) window.open(msg.fileUrl, '_blank'); }} 
                          />
                          {isSecure && (
                              <div className="absolute top-2 right-2 bg-slate-900/80 text-white text-[10px] px-2 py-1 rounded-md backdrop-blur-sm font-bold shadow-lg"><i className="fa-solid fa-lock"></i> Protected</div>
                          )}
                          {!isSecure && (
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                  <i className="fa-solid fa-expand text-white text-3xl drop-shadow-md"></i>
                              </div>
                          )}
                       </div>
                    ) : (
                       <div className={`flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200 w-fit max-w-[280px] shadow-sm ${!isSecure ? 'cursor-pointer hover:bg-slate-100' : 'cursor-default opacity-90'}`} onClick={(e) => { e.stopPropagation(); if(!isSecure) window.open(msg.fileUrl, '_blank'); }}>
                          <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-indigo-500 shadow-sm shrink-0"><i className="fa-solid fa-file-lines text-lg"></i></div>
                          <div className="flex-1 overflow-hidden min-w-0 flex flex-col">
                             <p className="text-sm font-bold text-slate-700 truncate">{displayFileName}</p>
                             {isSecure && <span className="text-[9px] font-bold text-rose-500 uppercase tracking-widest mt-0.5"><i className="fa-solid fa-lock"></i> Download Restricted</span>}
                          </div>
                          {!isSecure && <i className="fa-solid fa-download text-slate-400 pr-1 hover:text-indigo-600 transition-colors"></i>}
                       </div>
                    )}
                  </div>
                )}
              </>
            )}
        </div>

        {/* Reactions section – now visible for tasks as well */}
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-end justify-between gap-3 w-full">
            <div className="flex flex-wrap items-center gap-1.5 flex-1">
                {Object.entries(msg.reactions || {}).map(([tagLabel, users]) => {
                    const isEmoji = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u.test(tagLabel) || STANDARD_EMOJIS.includes(tagLabel);
                    const isMe = users.includes(userEmail);
                    
                    const hoverNames = users.map(e => dbUsers?.find(u => u.email === e)?.name || e.split('@')[0]).join(', ');
                    const titleText = `${tagLabel} affixed by: ${hoverNames}`;
                    
                    if (isEmoji) {
                        return (
                            <button key={tagLabel} title={titleText} onClick={(e) => { e.stopPropagation(); handleReaction(msg.id, tagLabel); }}
                                className={`flex items-center gap-1 px-2 py-1 rounded-lg border transition-colors shadow-sm ${isMe ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                            >
                                <span className="text-[13px]" style={{fontFamily: '"Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif'}}>{tagLabel}</span>
                                <span className={`text-[11px] font-bold ${isMe ? 'text-indigo-600' : 'text-slate-500'}`}>{users.length}</span>
                            </button>
                        )
                    }

                    const tagObj = (customTags || []).find(t => t.label === tagLabel) || { bgClass: 'bg-slate-100', textClass: 'text-slate-600' };
                    return (
                        <button key={tagLabel} title={titleText} onClick={(e) => { e.stopPropagation(); handleReaction(msg.id, tagLabel); }}
                            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-colors shadow-sm ${isMe ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                        >
                            <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold tracking-wide ${tagObj.bgClass} ${tagObj.textClass}`}>
                                {tagObj.label}
                            </span>
                            <span className={`text-[11px] font-bold pr-1 ${isMe ? 'text-indigo-600' : 'text-slate-500'}`}>{users.length}</span>
                        </button>
                    )
                })}
                
                {/* Reaction picker – now available for all messages, including tasks */}
                {toolPreferences?.react !== false && (
                    <div className="relative" ref={tagPickerRef}>
                        <button onClick={(e) => { e.stopPropagation(); setTagPickerOpen(!tagPickerOpen); }}
                            className={`h-8 px-2 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-colors shadow-sm ${hasReactions ? '' : 'opacity-0 group-hover/msg:opacity-100'}`}
                        >
                            <i className="fa-solid fa-plus text-[11px]"></i><span className="text-[10px] font-bold ml-[3px] mt-[1px]"><i className="fa-regular fa-face-smile"></i></span>
                        </button>
                        
                        {tagPickerOpen && (
                            <div className="absolute bottom-full left-0 mb-1 z-50 bg-white rounded-xl shadow-xl border border-slate-200 p-3 w-56 max-h-72 overflow-y-auto custom-sidebar-scroll animate-in fade-in zoom-in-95" onClick={e=>e.stopPropagation()}>
                                
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1"><i className="fa-solid fa-bolt mr-1"></i> Frequent</div>
                                <div className="flex flex-col gap-1.5 mb-3">
                                    {(toolPreferences?.quickTags || ['#Approved', '#Reviewing', '#ActionRequired', '#Noted']).map(tagLabel => {
                                        const tagObj = (customTags || []).find(t => t.label === tagLabel);
                                        if(!tagObj) return null;
                                        return (
                                            <button key={`freq-${tagLabel}`} onClick={() => { setTagPickerOpen(false); handleReaction(msg.id, tagLabel); }}
                                                className={`w-full text-left text-[11px] font-bold px-3 py-2 rounded-lg transition-colors ${tagObj.bgClass} ${tagObj.textClass} hover:opacity-80 border border-white hover:border-${tagObj.bgClass.replace('bg-', '')} shadow-sm`}
                                            >
                                                {tagObj.label}
                                            </button>
                                        )
                                    })}
                                </div>

                                <div className="h-px bg-slate-100 my-2"></div>

                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1 mt-2"><i className="fa-solid fa-tags mr-1"></i> All Workflows</div>
                                <div className="flex flex-col gap-1.5 mb-3">
                                    {(customTags || []).map(tagObj => (
                                        <button key={`all-${tagObj.id}`} onClick={() => { setTagPickerOpen(false); handleReaction(msg.id, tagObj.label); }}
                                            className={`w-full text-left text-[11px] font-bold px-3 py-2 rounded-lg transition-colors ${tagObj.bgClass} ${tagObj.textClass} hover:opacity-80 border border-white hover:border-${tagObj.bgClass.replace('bg-', '')} shadow-sm`}
                                        >
                                            {tagObj.label}
                                        </button>
                                    ))}
                                </div>

                                <div className="h-px bg-slate-100 my-2"></div>

                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1 mt-2"><i className="fa-regular fa-face-smile mr-1"></i> Standard Emoji</div>
                                <div className="flex flex-wrap gap-1.5">
                                    {STANDARD_EMOJIS.map(emoji => (
                                        <button key={emoji} onClick={() => { setTagPickerOpen(false); handleReaction(msg.id, emoji); }} className="w-8 h-8 flex items-center justify-center text-[18px] hover:bg-slate-100 rounded-lg transition-transform hover:scale-110" style={{fontFamily: '"Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif'}}>
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="flex flex-col items-end gap-1.5 justify-end shrink-0">
                <div className="flex items-center gap-1.5">
                   <span className="text-[10px] font-semibold text-slate-400 mr-1">{msg.time}</span>
                   {msg.isEdited && <span className="text-[10px] text-slate-400 italic mr-1">(edited)</span>}
                   {msg.hasReminder && <i className="fa-regular fa-clock text-amber-500 text-[10px] mr-1"></i>}
                   {isBookmarked && <i className="fa-solid fa-bookmark text-indigo-600 text-[10px] mr-1"></i>}
                   
                   {msg.isMine && !msg.isTask && (
                       <span className="text-[11px] font-bold ml-1 tracking-wide">
                       {seenByOthers ? (
                           <span className="text-green-700">Seen</span>
                       ) : deliveredCount > 0 ? (
                           <span className="text-orange-600">Delivered</span>
                       ) : (
                           <span className="text-blue-800">Sent</span>
                       )}
                       </span>
                   )}
                </div>
                
                {!msg.isTask && !isThreadView && replyCount > 0 && (
                    <button onClick={(e) => { e.stopPropagation(); setActiveThread(msg); }} className="flex items-center gap-2 px-3 py-1.5 mt-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-[11px] rounded-lg transition-colors border border-indigo-200 shadow-sm w-fit group/threadbtn">
                        <i className="fa-solid fa-comments group-hover/threadbtn:scale-110 transition-transform"></i> View {replyCount} Replies
                    </button>
                )}
            </div>
        </div>

      </div>
    </div>
  );
});

export default MessageBubble;
