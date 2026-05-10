import React, { useState, useEffect, useRef } from 'react';
import { formatMessageText } from '../../utils/helpers.js';
import MemoizedAvatar from '../Common/MemoizedAvatar.jsx';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢'];

const MessageBubble = React.memo(({
  msg, userEmail, currentUserData, activeGroup, isVipAdmin,
  hasReplies, isHighlighted, editingMessageId, editMessageText,
  setEditingMessageId, setEditMessageText, handleSaveEdit,
  scrollToMessageDirect, handleReaction, handleToggleBookmark,
  handleTogglePin, handleDeleteMessage, chatInputRef, toolPreferences,
  setReplyingTo, setSelectedMessage, setIsEditingTaskTitle, setActiveModal, dbUsers
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
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

  return (
    <div id={`msg-${msg.id}`} className={`w-full flex ${msg.isMine ? 'justify-end' : 'justify-start'} msg-row-spacing transform-gpu`}>
     <div
    id={`msg-${msg.id}`}
    className={`w-full flex ${msg.isMine ? 'justify-end' : 'justify-start'} msg-row-spacing transform-gpu ${isUnreadHighlight ? 'highlight-flash' : ''}`}
>
        <MemoizedAvatar uid={msg.senderUid || 'anon'} url={senderAvatar} name={senderName} sizeClass="w-8 h-8 shrink-0 mt-1" extraClasses={msg.isMine ? 'ml-3' : 'mr-3'} />
        <div className={`flex-1 bg-white rounded-xl shadow-sm border border-gray-100 ${getBorderColor()} border-l-4 px-4 py-3 relative`}>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-semibold text-primary">{senderName}</span>
            <span className="text-[11px] text-text-secondary">{msg.time}</span> 
          </div>
          <button onClick={(e) => { e.stopPropagation(); setMenuOpen(prev => !prev); }} className="absolute top-2 right-2 opacity-0 group-hover/msg:opacity-100 transition-opacity text-text-secondary hover:text-primary p-1 rounded-full hover:bg-primary/5"><i className="fa-solid fa-ellipsis-vertical text-xs"></i></button>
          {menuOpen && (
            <div ref={menuRef} className="absolute bottom-full right-0 mb-2 z-50 bg-white rounded-xl shadow-lg border border-gray-200 py-2 w-56 animate-in fade-in slide-in-from-bottom-2" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => { setMenuOpen(false); setReplyingTo(msg); setTimeout(() => chatInputRef.current?.focus(), 100); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-primary-light hover:text-primary"><i className="fa-solid fa-reply w-5"></i> Reply</button>
              {!msg.isTask && <button onClick={() => { setMenuOpen(false); setSelectedMessage(msg); setActiveModal('task_convert'); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-blue-50 hover:text-blue-600"><i className="fa-regular fa-square-check w-5"></i> Convert to Task</button>}
              <button onClick={() => { setMenuOpen(false); setSelectedMessage(msg); setActiveModal('reminder'); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-amber-50 hover:text-amber-600"><i className="fa-regular fa-clock w-5"></i> Set Reminder</button>
              <button onClick={() => { setMenuOpen(false); handleToggleBookmark(msg); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-purple-50 hover:text-purple-600"><i className={`fa-solid fa-bookmark w-5 ${isBookmarked ? 'text-primary' : ''}`}></i> {isBookmarked ? 'Unbookmark' : 'Bookmark'}</button>
              {(currentUserData?.isAdmin || isVipAdmin || activeGroup?.admins?.includes(userEmail)) && <button onClick={() => { setMenuOpen(false); handleTogglePin(msg); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-amber-50 hover:text-amber-600"><i className={`fa-solid fa-thumbtack w-5 ${msg.isPinned ? 'text-primary' : ''}`}></i> {msg.isPinned ? 'Unpin' : 'Pin'}</button>}
              {canModify && toolPreferences.delete && <button onClick={() => { setMenuOpen(false); handleDeleteMessage(msg); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-danger hover:bg-red-50"><i className="fa-solid fa-trash w-5"></i> Delete</button>}
            </div>
          )}
          {msg.replyToId && (
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
              {/* ===== NEW JIRA‑STYLE TASK CARD ===== */}
              {msg.isTask && (
                <div
                  className="mt-2 bg-white border border-gray-200 rounded-xl p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => { setSelectedMessage(msg); setIsEditingTaskTitle(false); setActiveModal('task_trail'); }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {/* Priority flag */}
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        msg.taskData.priority === 'High'   ? 'bg-red-100 text-red-700' :
                        msg.taskData.priority === 'Medium' ? 'bg-amber-100 text-amber-700' :
                        'bg-green-100 text-green-700'}`}>
                        {msg.taskData.priority === 'High' ? '🔴' : msg.taskData.priority === 'Medium' ? '🟡' : '🟢'} {msg.taskData.priority || 'Medium'}
                      </span>
                      {/* Status badge */}
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        msg.taskData.status === 'Completed' ? 'bg-teal-100 text-teal-700' :
                        msg.taskData.status === 'In Progress' ? 'bg-indigo-100 text-indigo-700' :
                        'bg-amber-100 text-amber-700'}`}>
                        {msg.taskData.status}
                      </span>
                    </div>
                    <span className="text-[11px] text-text-secondary flex items-center gap-1">
                      <i className="fa-regular fa-calendar"></i>
                      Due {new Date(msg.taskData.deadline).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-text-primary mb-2">{msg.text}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center -space-x-2">
                      {(msg.taskData.assignees || []).slice(0, 3).map(email => {
                        const assignee = dbUsers?.find(u => u.email === email);
                        return <MemoizedAvatar key={email} uid={assignee?.uid || email} url={assignee?.profilePicUrl} name={assignee?.name || email.split('@')[0]} sizeClass="w-6 h-6" extraClasses="border-2 border-white" />;
                      })}
                      {(msg.taskData.assignees || []).length > 3 && (
                        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-semibold text-text-secondary border-2 border-white">+{msg.taskData.assignees.length - 3}</div>
                      )}
                    </div>
                    {/* Progress indicator placeholder */}
                    <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${msg.taskData.status === 'Completed' ? 'bg-teal-500 w-full' : msg.taskData.status === 'In Progress' ? 'bg-indigo-500 w-1/2' : 'bg-amber-500 w-1/4'}`}></div>
                    </div>
                  </div>
                </div>
              )}
              {/* ===== END TASK CARD ===== */}

              {!msg.isTask && msg.isPrivateMention && <div className="text-xs font-semibold flex items-center gap-1 mb-2 text-purple-700"><i className="fa-solid fa-lock"></i> {msg.text?.startsWith('[Forwarded') ? 'FORWARDED DM' : 'PRIVATE'}</div>}
              {!msg.isTask && msg.isPrivateForward && <div className="text-xs font-semibold flex items-center gap-1 mb-2 text-purple-700"><i className="fa-solid fa-lock"></i> Private from {msg.forwardedFromGroup}</div>}
              
              {!msg.isTask && msg.fileUrl ? (
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
                {msg.isEdited && <span className="italic">(edited)</span>}
                {msg.hasReminder && <i className="fa-regular fa-clock text-amber-500"></i>}
                {isBookmarked && <i className="fa-solid fa-bookmark text-primary"></i>}
                {/* Read receipt indicator */}
{msg.isMine && !seenByOthers && deliveredCount > 0 && (
  <span className="text-[11px] font-medium text-[#800000] ml-1">Delivered</span>
)}
{msg.isMine && seenByOthers && (
  <span className="text-[11px] font-medium text-[#006400] ml-1">Seen</span>
)}
              </div>
            </>
          )}
        </div>
        <button onClick={(e) => { e.stopPropagation(); setEmojiPickerOpen(prev => !prev); }} className="ml-2 self-end opacity-0 group-hover/msg:opacity-100 transition-opacity text-text-secondary hover:text-primary p-1 rounded-full hover:bg-primary/5 shrink-0"><i className="fa-regular fa-face-smile text-sm"></i></button>
        {emojiPickerOpen && (
          <div ref={emojiRef} className="absolute bottom-full right-0 z-50 bg-white rounded-xl shadow-lg border border-gray-200 p-1.5 flex gap-1 animate-in fade-in slide-in-from-bottom-2" onClick={(e) => e.stopPropagation()}>
            {QUICK_EMOJIS.map(emoji => (<button key={emoji} onClick={() => { setEmojiPickerOpen(false); handleReaction(msg.id, emoji); }} className="text-[18px] hover:scale-125 transition-transform p-1">{emoji}</button>))}
          </div>
        )}
        {Object.keys(msg.reactions || {}).length > 0 && (
          <div className="absolute -bottom-4 right-0 flex gap-1 z-10">
            {Object.entries(msg.reactions).map(([emoji, users]) => (
              <div key={emoji} onClick={(e) => { e.stopPropagation(); handleReaction(msg.id, emoji); }} className={`text-[13px] bg-white border border-gray-200 rounded-full px-2 py-[1px] shadow-sm flex items-center gap-1 cursor-pointer hover:scale-110 transition-transform ${users.includes(userEmail) ? 'bg-indigo-50 border-indigo-200' : ''}`}>
                <span>{emoji}</span><span className="font-semibold text-text-secondary text-[10px]">{users.length}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default MessageBubble;
