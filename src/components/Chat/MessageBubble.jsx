import React, { useState } from 'react';
import MemoizedAvatar from '../Common/MemoizedAvatar.jsx';
import { EMOJI_LIST, stripHtml, toSentenceCase, formatToDDMMMYY } from '../../utils/helpers.js';

const MessageBubble = React.memo(({ 
    msg, userEmail, currentUserData, activeGroup, isVipAdmin,
    hasReplies, replyCount, isHighlighted, isUnreadHighlight,
    editingMessageId, editMessageText, setEditingMessageId,
    setEditMessageText, handleSaveEdit, scrollToMessageDirect,
    handleReaction, handleToggleBookmark, handleTogglePin,
    handleDeleteMessage, chatInputRef, toolPreferences,
    setReplyingTo, setSelectedMessage, setIsEditingTaskTitle,
    setActiveModal, dbUsers, jumpToPrivateSource, handleAddInlineComment,
    customTags = [], setActiveThread, isThreadView = false 
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false); 
  const [isTaskExpanded, setIsTaskExpanded] = useState(false);

  const isMine = msg.senderEmail === userEmail;
  const isVipOrAdmin = currentUserData?.isAdmin || isVipAdmin;
  const canModify = isMine || isVipOrAdmin;

  const formatTrailAction = (t) => {
    const action = t.action || 'Update';
    if (t.fileUrl) return `Upload: ${t.fileName || 'Attachment'}`;
    if (/acknowledg/i.test(action)) return 'Acknowledged';
    if (/review/i.test(action)) return `Review Again${t.comment ? `: ${t.comment}` : ''}`;
    if (/transfer/i.test(action)) return `Transferred${t.comment ? `: ${t.comment}` : ''}`;
    if (/delegat/i.test(action)) return `Delegated${t.to ? ` to ${t.to}` : ''}`;
    if (/completed|marked done/i.test(action)) return `Completed${t.comment ? `: ${t.comment}` : ''}`;
    if (t.comment) return `Update: ${t.comment}`;
    return action.replace(/\.$/, '');
  };

  return (
    <div id={`msg-${msg.id}`} className={`flex flex-col msg-row-spacing group relative ${isHighlighted ? 'bg-indigo-50 ring-2 ring-indigo-200 rounded-xl p-2' : ''} ${isUnreadHighlight ? 'bg-amber-50/50 rounded-xl p-2' : ''}`}>
      
      {msg.replyToId && !isThreadView && (
        <div className={`flex items-center gap-2 mb-1 ${isMine ? 'justify-end pr-14' : 'pl-14'} text-[11px] font-bold text-slate-400 cursor-pointer hover:text-indigo-500`} onClick={() => scrollToMessageDirect(msg.replyToId)}>
          <i className="fa-solid fa-reply"></i> Replied to a message
        </div>
      )}

      <div className={`flex gap-3 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
        
        <div className="shrink-0 pt-1">
          <MemoizedAvatar uid={msg.senderUid} url={null} name={msg.sender?.split('@')[0]} sizeClass="w-9 h-9 shadow-sm" />
        </div>

        <div className={`flex flex-col max-w-[75%] ${isMine ? 'items-end' : 'items-start'}`}>
          
          {editingMessageId === msg.id ? (
            <div className="bg-white p-3 rounded-2xl shadow-xl border border-indigo-200 flex flex-col gap-2 min-w-[250px] animate-in fade-in zoom-in-95">
              <textarea value={editMessageText} onChange={(e) => setEditMessageText(e.target.value)} className="w-full text-[14px] p-2 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 resize-none font-medium text-slate-700" rows="3" autoFocus />
              <div className="flex justify-end gap-2">
                <button onClick={() => setEditingMessageId(null)} className="text-[11px] font-bold text-slate-500 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-colors">Cancel</button>
                <button onClick={() => handleSaveEdit(msg)} className="text-[11px] font-bold bg-indigo-600 text-white hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors shadow-sm">Save</button>
              </div>
            </div>
          ) : (
            <div className={`relative px-3 py-2 rounded-xl shadow-sm text-[14.5px] leading-relaxed break-words font-medium ${
              isMine 
                  ? 'bg-indigo-600 text-white rounded-tr-sm border border-indigo-700' 
                  : 'bg-white text-slate-800 rounded-tl-sm border border-slate-200'
            }`}>
              
              {/* 🆕 NEW COMPACT HEADER (Inside Bubble) */}
              <div className={`flex justify-between items-center mb-1.5 pb-1 border-b ${isMine ? 'border-indigo-400/40' : 'border-slate-100'} gap-6`}>
                  <span className={`text-[9.5px] font-bold tracking-wider ${isMine ? 'text-indigo-200' : 'text-slate-400'}`}>
                      {formatToDDMMMYY(msg.timestamp?.toDate ? msg.timestamp.toDate() : msg.dateString)}, {msg.time}
                  </span>
                  <span className={`text-[11.5px] font-extrabold ${isMine ? 'text-white' : 'text-indigo-600'}`}>
                      {toSentenceCase(msg.sender?.split('@')[0])}
                  </span>
              </div>

              {msg.isForwarded && <div className={`text-[10px] font-bold mb-1 flex items-center gap-1 italic ${isMine ? 'text-indigo-200' : 'text-slate-400'}`}><i className="fa-solid fa-share"></i> Forwarded</div>}
              {msg.isPrivateMention && <div className="text-[10px] font-bold mb-1 text-rose-500 flex items-center gap-1 uppercase tracking-widest"><i className="fa-solid fa-lock text-[9px]"></i> Private Context</div>}
              
              {msg.fileUrl && (
                <div className={`mb-2 rounded-xl overflow-hidden border ${isMine ? 'border-indigo-500/50' : 'border-slate-100'}`}>
                  {msg.fileName?.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                    <img src={msg.fileUrl} alt="attachment" className="max-w-full sm:max-w-[300px] h-auto object-cover cursor-pointer hover:opacity-90 transition-opacity" onClick={() => window.open(msg.fileUrl, '_blank')} loading="lazy"/>
                  ) : (
                    <div className={`flex items-center gap-3 p-3 ${isMine ? 'bg-indigo-700/50 hover:bg-indigo-700' : 'bg-slate-50 hover:bg-slate-100'} transition-colors cursor-pointer`} onClick={() => window.open(msg.fileUrl, '_blank')}>
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${isMine ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-500 shadow-sm'}`}><i className="fa-solid fa-file"></i></div>
                      <div className="flex-1 min-w-0"><div className="text-sm font-bold truncate">{msg.fileName}</div><div className="text-[10px] uppercase tracking-widest opacity-70 mt-0.5">Click to view/download</div></div>
                    </div>
                  )}
                </div>
              )}

              {msg.isTask ? (
                <div className="flex flex-col gap-2 min-w-[260px]">
                  <div className="flex justify-between items-start gap-4">
                    <span className="font-bold text-[15px] underline decoration-indigo-400/30 underline-offset-4">{stripHtml(msg.text)}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded shadow-sm border uppercase tracking-wider shrink-0 ${
                      msg.taskData?.status === 'Completed' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                      msg.taskData?.status === 'In Progress' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' :
                      'bg-amber-100 text-amber-700 border-amber-200'
                    }`}>{msg.taskData?.status || 'Pending'}</span>
                  </div>
                  
                  <div className={`flex flex-col gap-1.5 p-2.5 rounded-xl border ${isMine ? 'bg-indigo-700/30 border-indigo-500/30' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest opacity-70 w-16">Assignees</span>
                      <div className="flex -space-x-1.5">
                        {(msg.taskData?.assignees || []).map(a => <MemoizedAvatar key={a} uid={a} name={a.split('@')[0]} sizeClass="w-6 h-6 border-2 border-white shadow-sm" />)}
                      </div>
                    </div>
                    {msg.taskData?.deadline && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-70 w-16">Deadline</span>
                        <span className="text-[12px] font-semibold flex items-center gap-1.5"><i className="fa-regular fa-calendar text-rose-400"></i> {new Date(msg.taskData.deadline).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                  
                  <button onClick={() => { setSelectedMessage(msg); setActiveModal('task_trail'); }} className={`w-full py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-colors mt-1 ${isMine ? 'bg-indigo-700 text-indigo-100 hover:bg-indigo-800' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    Open Task Trail <i className="fa-solid fa-arrow-right ml-1"></i>
                  </button>
                </div>
              ) : (
                msg.text && <div className={`text-[14.5px] leading-relaxed break-words font-medium ${msg.fileUrl ? 'mb-2' : ''}`} dangerouslySetInnerHTML={{ __html: msg.text }}></div>
              )}

              {/* Reactions */}
              {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                <div className={`flex flex-wrap gap-1 mt-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
                  {Object.entries(msg.reactions).map(([reaction, users]) => {
                    const matchedTag = customTags?.find(t => `${t.shortCode || ''} ${t.label}`.trim() === reaction);
                    return (
                        <div key={reaction} className={`px-2 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 shadow-sm border ${
                            matchedTag ? `${matchedTag.bgClass} ${matchedTag.textClass} ${matchedTag.borderClass}` : 'bg-white border-slate-200 text-slate-600'
                        }`}>
                            {reaction} <span className="opacity-70 text-[9px]">{users.length}</span>
                        </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Inline Replies UI */}
          {!isThreadView && hasReplies && (
            <div onClick={() => setActiveThread(msg)} className={`mt-1.5 flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm ${isMine ? 'self-end' : 'self-start'}`}>
              <div className="flex -space-x-2">
                {messages.filter(m => m.replyToId === msg.id).slice(0,3).map(m => (
                  <MemoizedAvatar key={m.id} uid={m.senderUid} name={m.sender?.split('@')[0]} sizeClass="w-6 h-6 border-2 border-white shadow-sm" />
                ))}
              </div>
              <span className="text-[11px] font-bold text-indigo-600">{replyCount} {replyCount === 1 ? 'reply' : 'replies'}</span>
            </div>
          )}
        </div>

        {/* Hover Actions Context Menu */}
        <div className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 pt-4 ${isMine ? 'pr-2' : 'pl-2'}`}>
          <div className="relative">
            <button onClick={() => setTagPickerOpen(!tagPickerOpen)} className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-amber-500 hover:bg-amber-50 shadow-sm flex items-center justify-center transition-colors">
              <i className="fa-regular fa-face-smile"></i>
            </button>
            {tagPickerOpen && (
              <div className="absolute bottom-[100%] right-0 mb-2 bg-white border border-slate-200 shadow-2xl rounded-2xl p-3 z-50 animate-in fade-in zoom-in-95 w-72 max-h-[300px] overflow-y-auto custom-sidebar-scroll">
                  {customTags && customTags.length > 0 && (
                      <div className="mb-4">
                          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-100 pb-1.5">
                              <i className="fa-solid fa-tags text-indigo-400"></i> Workflow Tags
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                              {customTags.map(tag => {
                                  const fullTagStr = `${tag.shortCode || ''} ${tag.label}`.trim();
                                  const isApplied = msg.reactions?.[fullTagStr]?.includes(userEmail); 
                                  return (
                                      <button key={tag.id} onClick={() => { handleReaction(msg.id, fullTagStr); setTagPickerOpen(false); }} className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold border shadow-sm transition-transform hover:scale-105 flex items-center gap-1 ${tag.bgClass} ${tag.textClass} ${isApplied ? 'ring-2 ring-indigo-400 border-indigo-400' : tag.borderClass}`}>{fullTagStr}</button>
                                  );
                              })}
                          </div>
                      </div>
                  )}
                  <div>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-100 pb-1.5">
                          <i className="fa-regular fa-face-smile text-amber-400"></i> Quick React
                      </div>
                      <div className="flex flex-wrap gap-1">
                          {EMOJI_LIST.map(emoji => {
                              const isApplied = msg.reactions?.[emoji]?.includes(userEmail);
                              return (
                                  <button key={emoji} onClick={() => { handleReaction(msg.id, emoji); setTagPickerOpen(false); }} className={`w-8 h-8 flex items-center justify-center rounded-lg text-lg transition-colors ${isApplied ? 'bg-indigo-100 ring-1 ring-indigo-300' : 'hover:bg-slate-100'}`}>{emoji}</button>
                              );
                          })}
                      </div>
                  </div>
              </div>
            )}
          </div>
          
          <button onClick={() => { if(isThreadView) setReplyingTo(msg); else setActiveThread(msg); }} className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 shadow-sm flex items-center justify-center transition-colors">
            <i className="fa-solid fa-reply"></i>
          </button>
          
          <div className="relative">
            <button onClick={() => setMenuOpen(!menuOpen)} className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-100 shadow-sm flex items-center justify-center transition-colors">
              <i className="fa-solid fa-ellipsis-vertical"></i>
            </button>
            {menuOpen && (
              <div className="absolute bottom-[100%] right-0 mb-2 w-48 bg-white border border-slate-200 shadow-xl rounded-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 py-1">
                <button onClick={() => { handleToggleBookmark(msg.id, msg.bookmarkedBy); setMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-3">
                  <i className={`fa-solid fa-bookmark ${msg.bookmarkedBy?.includes(userEmail) ? 'text-indigo-500' : 'text-slate-400'}`}></i> {msg.bookmarkedBy?.includes(userEmail) ? 'Remove Bookmark' : 'Bookmark'}
                </button>
                {(isVipOrAdmin || isMine) && (
                  <button onClick={() => { handleTogglePin(msg.id, msg.isPinned); setMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-3">
                    <i className="fa-solid fa-thumbtack text-slate-400"></i> {msg.isPinned ? 'Unpin Message' : 'Pin Message'}
                  </button>
                )}
                <button onClick={() => { setSelectedMessage(msg); setActiveModal('reminder'); setMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-3">
                  <i className="fa-regular fa-clock text-slate-400"></i> Set Reminder
                </button>
                {!msg.isTask && (
                  <button onClick={() => { setSelectedMessage(msg); setActiveModal('task_convert'); setMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 flex items-center gap-3">
                    <i className="fa-solid fa-bolt"></i> Convert to Task
                  </button>
                )}
                {canModify && !msg.isTask && (
                  <button onClick={() => { setEditMessageText(msg.text); setEditingMessageId(msg.id); setMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-3">
                    <i className="fa-solid fa-pen text-slate-400"></i> Edit Message
                  </button>
                )}
                {canModify && (
                  <button onClick={() => { handleDeleteMessage(msg); setMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-3">
                    <i className="fa-solid fa-trash-can"></i> Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default MessageBubble;
