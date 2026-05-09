import React, { useState, useEffect, useRef } from 'react';
import { formatMessageText } from '../../utils/helpers.js';
import MemoizedAvatar from '../Common/MemoizedAvatar.jsx';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢'];

const MessageBubble = React.memo(({
  msg,
  userEmail,
  currentUserData,
  activeGroup,
  isVipAdmin,
  hasReplies,
  isHighlighted,
  editingMessageId,
  editMessageText,
  setEditingMessageId,
  setEditMessageText,
  handleSaveEdit,
  scrollToMessageDirect,
  handleReaction,
  handleToggleBookmark,
  handleTogglePin,
  handleDeleteMessage,
  chatInputRef,
  toolPreferences,
  setReplyingTo,
  setSelectedMessage,
  setIsEditingTaskTitle,
  setActiveModal,
  dbUsers,     // needed for sender avatar
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const menuRef = useRef(null);
  const emojiRef = useRef(null);

  const isBookmarked = msg.bookmarkedBy?.includes(userEmail);
  const canModify = msg.isMine && !msg.isTask && !hasReplies && !(Object.keys(msg.reactions || {}).length > 0);
  const isEditingThis = editingMessageId === msg.id;

  // Sender info for left avatar
  const senderUser = dbUsers?.find(u => u.email === msg.senderEmail) || {};
  const senderName = (msg.sender || '').split('@')[0];
  const senderAvatar = senderUser.profilePicUrl || null;

  // Determine left border colour
  const getBorderColor = () => {
    if (msg.isTask) return 'border-l-orange-400';
    if (msg.isPrivateMention || msg.isPrivateForward) return 'border-l-purple-400';
    return 'border-l-indigo-400';
  };

  // Dropdown close on outside click
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
      <div className={`flex ${msg.isMine ? 'flex-row-reverse' : 'flex-row'} items-start max-w-[85vw] md:max-w-[70vw] group/msg relative ${isHighlighted ? 'highlight-flash' : ''}`}>
        
        {/* Avatar */}
        <MemoizedAvatar
          uid={msg.senderUid || 'anon'}
          url={senderAvatar}
          name={senderName}
          sizeClass="w-8 h-8 shrink-0 mt-1"
          extraClasses={msg.isMine ? 'ml-3' : 'mr-3'}
        />

        {/* Message Card */}
        <div className={`flex-1 bg-white rounded-xl shadow-sm border border-gray-100 ${getBorderColor()} border-l-4 px-4 py-3 relative`}>
          
          {/* Sender name & time */}
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-semibold text-primary">{senderName}</span>
            <span className="text-[11px] text-text-secondary">{msg.time}</span>
          </div>

          {/* Three‑dot menu button */}
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(prev => !prev); }}
            className="absolute top-2 right-2 opacity-0 group-hover/msg:opacity-100 transition-opacity text-text-secondary hover:text-primary p-1 rounded-full hover:bg-primary/5"
            title="More actions"
          >
            <i className="fa-solid fa-ellipsis-vertical text-xs"></i>
          </button>

          {/* Dropdown menu */}
          {menuOpen && (
            <div
              ref={menuRef}
              className="absolute bottom-full right-0 mb-2 z-50 bg-white rounded-xl shadow-lg border border-gray-200 py-2 w-56 animate-in fade-in slide-in-from-bottom-2"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={() => { setMenuOpen(false); setReplyingTo(msg); setTimeout(() => chatInputRef.current?.focus(), 100); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-primary-light hover:text-primary transition-colors">
                <i className="fa-solid fa-reply w-5"></i> Reply
              </button>
              {!msg.isTask && (
                <button onClick={() => { setMenuOpen(false); setSelectedMessage(msg); setActiveModal('task_convert'); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-blue-50 hover:text-blue-600 transition-colors">
                  <i className="fa-regular fa-square-check w-5"></i> Convert to Task
                </button>
              )}
              <button onClick={() => { setMenuOpen(false); setSelectedMessage(msg); setActiveModal('reminder'); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-amber-50 hover:text-amber-600 transition-colors">
                <i className="fa-regular fa-clock w-5"></i> Set Reminder
              </button>
              <button onClick={() => { setMenuOpen(false); handleToggleBookmark(msg); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-purple-50 hover:text-purple-600 transition-colors">
                <i className={`fa-solid fa-bookmark w-5 ${isBookmarked ? 'text-primary' : ''}`}></i> {isBookmarked ? 'Unbookmark' : 'Bookmark'}
              </button>
              {(currentUserData?.isAdmin || isVipAdmin || activeGroup?.admins?.includes(userEmail)) && (
                <button onClick={() => { setMenuOpen(false); handleTogglePin(msg); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-amber-50 hover:text-amber-600 transition-colors">
                  <i className={`fa-solid fa-thumbtack w-5 ${msg.isPinned ? 'text-primary' : ''}`}></i> {msg.isPinned ? 'Unpin' : 'Pin'}
                </button>
              )}
              {canModify && toolPreferences.delete && (
                <button onClick={() => { setMenuOpen(false); handleDeleteMessage(msg); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-danger hover:bg-red-50 transition-colors">
                  <i className="fa-solid fa-trash w-5"></i> Delete
                </button>
              )}
            </div>
          )}

          {/* Reply preview */}
          {msg.replyToId && (
            <div onClick={(e) => { e.stopPropagation(); scrollToMessageDirect(msg.replyToId); }} className="p-2 rounded bg-gray-50 mb-2 border-l-2 border-primary cursor-pointer opacity-80 hover:opacity-100 transition-opacity">
              <div className="font-semibold text-[11px] text-primary">{(msg.originalSender||'').split('@')[0]}</div>
              <div className="line-clamp-2 text-xs text-text-secondary mt-0.5">{msg.originalText}</div>
            </div>
          )}

          {/* Editing mode */}
          {isEditingThis ? (
            <div className="flex flex-col gap-2 my-1" onClick={e => e.stopPropagation()}>
              <textarea value={editMessageText} onChange={(e) => setEditMessageText(e.target.value)} className="w-full text-sm p-2 rounded border border-primary text-text-primary outline-none resize-none focus:ring-2 focus:ring-primary/20 transition-all" rows="2"></textarea>
              <div className="flex justify-end gap-2">
                <button onClick={() => setEditingMessageId(null)} className="text-xs text-text-secondary font-semibold px-3 py-1 hover:bg-gray-100 rounded transition-colors">Cancel</button>
                <button onClick={() => handleSaveEdit(msg)} className="text-xs bg-primary text-white px-4 py-1 rounded font-semibold shadow-sm hover:bg-primary-hover transition-colors">Save</button>
              </div>
            </div>
          ) : (
            <>
              {/* Task badge */}
              {msg.isTask && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">TASK</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${msg.taskData.status === 'Completed' ? 'bg-teal-100 text-teal-700' : 'bg-indigo-100 text-indigo-700'}`}>{msg.taskData.status}</span>
                </div>
              )}
              {/* Private mention / forward header */}
              {msg.isPrivateMention && (
                <div className="text-xs font-semibold flex items-center gap-1 mb-2 text-purple-700"><i className="fa-solid fa-lock"></i> {msg.text?.startsWith('[Forwarded') ? 'FORWARDED DM' : 'PRIVATE'}</div>
              )}
              {msg.isPrivateForward && (
                <div className="text-xs font-semibold flex items-center gap-1 mb-2 text-purple-700"><i className="fa-solid fa-lock"></i> Private from {msg.forwardedFromGroup}</div>
              )}
              
              {/* Text content */}
              {msg.fileUrl ? (
                <div className="flex flex-col gap-1 my-1">
                  {msg.fileType?.startsWith('image/') ? (
                    <img src={msg.fileUrl} alt="Shared" className="rounded max-w-full max-h-64 object-cover cursor-pointer shadow-sm" onClick={(e) => { e.stopPropagation(); window.open(msg.fileUrl, '_blank'); }} />
                  ) : (
                    <div className="flex items-center gap-3 p-2 rounded bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors" onClick={(e) => { e.stopPropagation(); window.open(msg.fileUrl, '_blank'); }}>
                      <div className="w-10 h-10 rounded bg-white flex items-center justify-center text-text-secondary shadow-sm"><i className="fa-solid fa-file-lines text-lg"></i></div>
                      <div className="flex-1 overflow-hidden"><p className="text-sm truncate text-text-primary">{msg.fileName}</p></div>
                    </div>
                  )}
                </div>
              ) : (
                <p className={`text-sm leading-relaxed whitespace-pre-wrap ${currentUserData?.fontSize || 'text-sm'}`} dangerouslySetInnerHTML={{ __html: formatMessageText(msg.text || '') }}></p>
              )}

              {/* Task details */}
              {msg.isTask && (
                <div className="mt-2 bg-gray-50 p-2 rounded flex flex-col gap-1 shadow-sm border border-gray-100">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-text-primary"><i className="fa-solid fa-users text-text-secondary"></i> {msg.taskData.assignees?.map(a => (a||'').split('@')[0]).join(', ')}</span>
                  <span className="text-[11px] text-warning font-semibold self-end"><i className="fa-regular fa-calendar mr-1"></i>Due {new Date(msg.taskData.deadline).toLocaleDateString()}</span>
                </div>
              )}

              {/* Read receipts & edited flag */}
              <div className="flex items-center gap-2 mt-1.5 text-[11px] text-text-secondary">
                {msg.isEdited && <span className="italic">(edited)</span>}
                {msg.hasReminder && <i className="fa-regular fa-clock text-amber-500"></i>}
                {isBookmarked && <i className="fa-solid fa-bookmark text-primary"></i>}
                {msg.isMine && (msg.seenBy || []).filter(e => e !== userEmail).length > 0 && <span title="Seen" className="text-teal-500"><i className="fa-solid fa-check-double text-xs"></i></span>}
              </div>
            </>
          )}
        </div>

        {/* Quick emoji button */}
        <button
          onClick={(e) => { e.stopPropagation(); setEmojiPickerOpen(prev => !prev); }}
          className="ml-2 self-end opacity-0 group-hover/msg:opacity-100 transition-opacity text-text-secondary hover:text-primary p-1 rounded-full hover:bg-primary/5 shrink-0"
          title="Add reaction"
        >
          <i className="fa-regular fa-face-smile text-sm"></i>
        </button>

        {/* Quick emoji picker */}
        {emojiPickerOpen && (
          <div ref={emojiRef} className="absolute bottom-full right-0 z-50 bg-white rounded-xl shadow-lg border border-gray-200 p-1.5 flex gap-1 animate-in fade-in slide-in-from-bottom-2" onClick={(e) => e.stopPropagation()}>
            {QUICK_EMOJIS.map(emoji => (
              <button key={emoji} onClick={() => { setEmojiPickerOpen(false); handleReaction(msg.id, emoji); }} className="text-[18px] hover:scale-125 transition-transform p-1">{emoji}</button>
            ))}
          </div>
        )}

        {/* Reaction pills */}
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
