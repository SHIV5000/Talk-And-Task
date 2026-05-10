import React, { useState, useEffect, useRef } from 'react';
import { formatMessageText } from '../../utils/helpers.js';
import MemoizedAvatar from '../Common/MemoizedAvatar.jsx';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢'];

const MessageBubble = React.memo(({
  msg, userEmail, currentUserData, activeGroup, isVipAdmin,
  hasReplies, isHighlighted, isUnreadHighlight,
  editingMessageId, editMessageText,
  setEditingMessageId, setEditMessageText, handleSaveEdit,
  scrollToMessageDirect, handleReaction, handleToggleBookmark,
  handleTogglePin, handleDeleteMessage, chatInputRef, toolPreferences,
  setReplyingTo, setSelectedMessage, setIsEditingTaskTitle, setActiveModal, dbUsers,
  jumpToPrivateSource
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [isTaskExpanded, setIsTaskExpanded] = useState(false); // 👈 New state for inline accordion
  const menuRef = useRef(null);
  const emojiRef = useRef(null);

  const isBookmarked = msg.bookmarkedBy?.includes(userEmail);
  const canModify = msg.isMine && !msg.isTask && !hasReplies && !(Object.keys(msg.reactions || {}).length > 0);
  const isEditingThis = editingMessageId === msg.id;
  const seenByOthers = (msg.seenBy || []).filter(e => e !== userEmail).length > 0;
  const deliveredCount = (msg.deliveredTo || []).filter(e => e !== userEmail).length;

  const senderUser = dbUsers?.find(u => u.email === msg.senderEmail) || {};
  const senderName = (msg.sender || '').split('@')[0];
  const senderAvatar = senderUser.profilePicUrl || null;

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

  // Handle the "Update" action: locks focus to main chat input just like "Reply"
  const handleInlineUpdateClick = (e) => {
    e.stopPropagation();
    setSelectedMessage(msg);
    // Setting replyingTo creates the context bar above the main input
    setReplyingTo({
      ...msg,
      text: `[Task Update] ${msg.text}` // Custom prefix so backend knows it's an update
    });
    setTimeout(() => chatInputRef.current?.focus(), 100);
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
            <button onClick={() => { setMenuOpen(false); setReplyingTo(msg); setTimeout(() => chatInputRef.current?.focus(), 100); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-primary-light hover:text-primary"><i className="fa-solid fa-reply w-5"></i> Reply</button>
            {!msg.isTask && <button onClick={() => { setMenuOpen(false); setSelectedMessage(msg); setActiveModal('task_convert'); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-blue-50 hover:text-blue-600"><i className="fa-regular fa-square-check w-5"></i> Convert to Task</button>}
            <button onClick={() => { setMenuOpen(false); setSelectedMessage(msg); setActiveModal('reminder'); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-amber-50 hover:text-amber-600"><i className="fa-regular fa-clock w-5"></i> Set Reminder</button>
            <button onClick={() => { setMenuOpen(false); handleToggleBookmark(msg); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-purple-50 hover:text-purple-600"><i className={`fa-solid fa-bookmark w-5 ${isBookmarked ? 'text-primary' : ''}`}></i> {isBookmarked ? 'Unbookmark' : 'Bookmark'}</button>
            {(currentUserData?.isAdmin || isVipAdmin || activeGroup?.admins?.includes(userEmail)) && <button onClick={() => { setMenuOpen(false); handleTogglePin(msg); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-amber-50 hover:text-amber-600"><i className={`fa-solid fa-thumbtack w-5 ${msg.isPinned ? 'text-primary' : ''}`}></i> {msg.isPinned ? 'Unpin' : 'Pin'}</button>}
            {canModify && toolPreferences.delete && <button onClick={() => { setMenuOpen(false); handleDeleteMessage(msg); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-danger hover:bg-red-50"><i className="fa-solid fa-trash w-5"></i> Delete</button>}
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
                
                {/* 1. Core Task View (Always Visible) */}
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                        msg.taskData.priority === 'High'   ? 'bg-red-50 text-red-700 border-red-200' :
                        msg.taskData.priority === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-green-50 text-green-700 border-green-200'}`}>
                        {msg.taskData.priority === 'High' ? '🔴' : msg.taskData.priority === 'Medium' ? '🟡' : '🟢'} {msg.taskData.priority || 'Medium'}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                        msg.taskData.status === 'Completed' ? 'bg-teal-50 text-teal-700 border-teal-200' :
                        msg.taskData.status === 'In Progress' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                        'bg-amber-50 text-amber-700 border-amber-200'}`}>
                        {msg.taskData.status}
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                      <i className="fa-regular fa-calendar-check"></i>
                      Due {new Date(msg.taskData.deadline).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <p className="text-sm font-medium text-slate-800 mb-3 leading-snug">{msg.text}</p>
                  
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

                {/* 2. Expand Toggle Button */}
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsTaskExpanded(!isTaskExpanded); }}
                  className="w-full bg-slate-50 border-t border-slate-200 py-2 text-xs font-semibold text-slate-500 hover:text-primary hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
                >
                  <i className={`fa-solid fa-chevron-${isTaskExpanded ? 'up' : 'down'} text-[10px]`}></i>
                  {isTaskExpanded ? 'Hide Details' : `View Updates & Trail (${msg.taskData.trail?.length || 0})`}
                </button>

                {/* 3. The Accordion Body (Trail & Action Bar) */}
                {isTaskExpanded && (
                  <div className="bg-slate-50 border-t border-slate-200 p-3 animate-in slide-in-from-top-2">
                    
                    {/* The Trail */}
                    <div className="space-y-3 mb-4 max-h-[300px] overflow-y-auto pr-2 custom-sidebar-scroll">
                      {(msg.taskData.trail || []).map((t, idx) => (
                        <div key={idx} className="flex gap-3 text-sm">
                          <div className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                            <i className={`text-[10px] ${
                              t.action.includes('Created') ? 'fa-solid fa-bolt text-amber-500' :
                              t.action.includes('Completed') ? 'fa-solid fa-check text-teal-500' :
                              t.action.includes('Delegated') ? 'fa-solid fa-share-nodes text-indigo-500' :
                              t.fileUrl ? 'fa-solid fa-paperclip text-blue-500' : 'fa-solid fa-comment-dots text-primary'
                            }`}></i>
                          </div>
                          <div className="flex-1 bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-[11px] text-slate-700">{(t.by||'').split('@')[0]}</span>
                              <span className="text-[10px] font-semibold text-slate-400">{t.time?.split(',')[0]}</span>
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
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Action Bar (Replaces the Modal features) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200">
                      <button 
                        onClick={handleInlineUpdateClick}
                        className="bg-white border border-slate-200 hover:border-primary hover:text-primary text-slate-600 font-semibold text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <i className="fa-regular fa-comment"></i> Update
                      </button>
                      
                      <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedMessage(msg); setActiveModal('task_trail'); /* We can keep a mini-modal just for delegation UI if needed, or expand inline */ }}
                        className="bg-white border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 text-slate-600 font-semibold text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <i className="fa-solid fa-users-rays"></i> Delegate
                      </button>

                      <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedMessage(msg); setActiveModal('task_trail'); }}
                        className="bg-white border border-slate-200 hover:border-blue-500 hover:text-blue-600 text-slate-600 font-semibold text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <i className="fa-solid fa-paperclip"></i> Attach
                      </button>

                      <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedMessage(msg); setActiveModal('task_trail'); }} // You can trigger the original complete logic here
                        disabled={msg.taskData.status === 'Completed'}
                        className={`font-semibold text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm ${
                          msg.taskData.status === 'Completed' 
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                          : 'bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-500 hover:text-white'
                        }`}
                      >
                        <i className="fa-solid fa-check"></i> Complete
                      </button>
                    </div>

                  </div>
                )}
              </div>
            )}

            {/* Standard DMs / Forwards below... */}
            {!msg.isTask && msg.isPrivateMention && !msg.isPrivateForward && (
              <div className="text-xs font-semibold flex items-center gap-1 mb-2 text-purple-700">
                <i className="fa-solid fa-lock"></i> PRIVATE
              </div>
            )}
            
            {!msg.isTask && msg.isPrivateForward ? (
              <div 
                onClick={(e) => { e.stopPropagation(); jumpToPrivateSource(msg.originalMsgId, msg.originalGroupId); }}
                className="mt-1 mb-2 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-3 shadow-sm cursor-pointer hover:shadow-md hover:border-purple-300 transition-all group/forward relative"
              >
                 <div className="flex items-center gap-2 mb-2">
                   <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                     <i className="fa-solid fa-share-nodes text-[10px]"></i>
                   </div>
                   <span className="text-xs font-bold text-purple-700 leading-tight">Mentioned in {msg.forwardedFromGroupName}</span>
                 </div>
                 <p className="text-[13px] text-slate-700 font-medium italic border-l-[3px] border-purple-300 pl-3 ml-1 break-words">
                   "{msg.text?.replace('[Forwarded Private Mention] ', '')}"
                 </p>
                 <div className="mt-2 text-[10px] font-bold text-indigo-500 flex items-center gap-1 opacity-70 group-hover/forward:opacity-100 transition-opacity">
                    Click to view original context <i className="fa-solid fa-arrow-right mt-[1px]"></i>
                 </div>
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
              {msg.isMine && !seenByOthers && deliveredCount > 0 && (
                <span className="text-[11px] font-medium text-[#800000] ml-1">Delivered</span>
              )}
              {msg.isMine && seenByOthers && (
                <span className="text-[11px] font-medium text-[#006400] ml-1">Seen</span>
              )}
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
