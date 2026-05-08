import React from 'react';
import { formatMessageText } from '../../utils/helpers.js';

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
}) => {
  const isBookmarked = msg.bookmarkedBy?.includes(userEmail);
  const canModify = msg.isMine && !msg.isTask && !hasReplies && !(Object.keys(msg.reactions || {}).length > 0);
  const isEditingThis = editingMessageId === msg.id;
  const seenByOthers = (msg.seenBy || []).filter(e => e !== userEmail).length > 0;
  const deliveredCount = (msg.deliveredTo || []).filter(e => e !== userEmail).length;

  const getBubbleStyles = () => {
    let baseStyles = "";
    if (msg.isTask) baseStyles = "bg-[#d1e8ff] text-[#111b21] border border-[#b8daff]";
    else if (msg.isPrivateMention || msg.isPrivateForward) baseStyles = msg.isMine ? "bg-[#f3e8ff] text-[#111b21] border border-[#e9d5ff]" : "bg-[#faf5ff] text-[#111b21] border border-[#f3e8ff]";
    else baseStyles = msg.isMine ? "bg-[#d9fdd3] text-[#111b21] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]" : "bg-white text-[#111b21] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]";
    return `${baseStyles} ${msg.isMine ? 'rounded-lg rounded-tr-none' : 'rounded-lg rounded-tl-none'} shadow-sm`;
  };

  const ActionBar = () => (
    <div className="hidden md:flex opacity-0 group-hover/msg:opacity-100 transition-opacity items-center gap-1 bg-white/90 backdrop-blur shadow-sm border border-slate-200 rounded-full px-2 py-0.5 shrink-0 z-20 mx-1">
      {toolPreferences.reply && <button onClick={(e)=>{e.stopPropagation(); setReplyingTo(msg); setTimeout(()=>chatInputRef.current?.focus(), 100);}} className="text-slate-400 hover:text-[#008069] text-[13px] p-1.5 transition-colors" title="Reply"><i className="fa-solid fa-reply"></i></button>}
      {toolPreferences.react && ['👍','❤️','😂','😮'].map(e => <button key={e} onClick={(ev)=>{ev.stopPropagation(); handleReaction(msg.id, e);}} className="hover:scale-125 transition-transform text-[16px] ml-0.5">{e}</button>)}
      {toolPreferences.bookmark && <button onClick={(e)=>{e.stopPropagation(); handleToggleBookmark(msg);}} className={`${isBookmarked ? 'text-[#008069]' : 'text-slate-400 hover:text-[#008069]'} text-[13px] p-1.5 transition-colors`} title="Save for later"><i className="fa-solid fa-bookmark"></i></button>}
      {toolPreferences.pin && (currentUserData?.isAdmin || isVipAdmin || activeGroup?.admins?.includes(userEmail)) && <button onClick={(e)=>{e.stopPropagation(); handleTogglePin(msg);}} className={`${msg.isPinned ? 'text-[#008069]' : 'text-slate-400 hover:text-[#008069]'} text-[13px] p-1.5 transition-colors`} title="Pin"><i className="fa-solid fa-thumbtack"></i></button>}
      {canModify && toolPreferences.edit && <button onClick={(e)=>{e.stopPropagation(); setEditingMessageId(msg.id); setEditMessageText(msg.text);}} className="text-slate-400 hover:text-[#008069] text-[13px] p-1.5 transition-colors" title="Edit"><i className="fa-solid fa-pen"></i></button>}
      {canModify && toolPreferences.delete && <button onClick={(e)=>{e.stopPropagation(); handleDeleteMessage(msg);}} className="text-slate-400 hover:text-red-500 text-[13px] p-1.5 transition-colors" title="Delete"><i className="fa-solid fa-trash"></i></button>}
    </div>
  );

  return (
    <div id={`msg-${msg.id}`} className={`w-full flex flex-col ${msg.isMine ? 'items-end' : 'items-start'} msg-row-spacing transform-gpu`}>
      <div className={`flex items-center relative max-w-full group/msg ${isHighlighted ? 'highlight-flash' : ''}`}>
        {msg.isMine && <ActionBar/>}
        <div className={`max-w-[80vw] sm:max-w-[75vw] md:max-w-[65vw] relative px-[10px] py-[7px] pb-[9px] ${getBubbleStyles()} transition-all hover:shadow-md break-words`}>
          {!msg.isMine && !msg.isTask && <div className="text-[12.5px] font-semibold text-[#1fa855] mb-0.5 tracking-tight">{(msg.sender||"").split('@')[0]}</div>}
          {msg.replyToId && (
            <div onClick={(e) => { e.stopPropagation(); scrollToMessageDirect(msg.replyToId); }} className={`p-2 rounded bg-black/5 mb-1.5 border-l-4 cursor-pointer opacity-80 hover:opacity-100 transition-opacity ${msg.isMine ? 'border-[#02a698]' : 'border-[#02a698]'}`}>
              <div className="font-semibold text-[11.5px] text-[#02a698] tracking-tight">{(msg.originalSender||"").split('@')[0]}</div>
              <div className="line-clamp-2 text-[13px] text-[#667781] mt-0.5 leading-snug">{msg.originalText}</div>
            </div>
          )}
          {isEditingThis ? (
            <div className="flex flex-col gap-2 min-w-[200px] md:min-w-[300px] my-1" onClick={e=>e.stopPropagation()}>
              <textarea value={editMessageText} onChange={(e)=>setEditMessageText(e.target.value)} className="w-full text-[14.2px] p-2 rounded border border-[#008069] text-slate-800 outline-none resize-none focus:ring-2 focus:ring-[#008069]/20 transition-all" rows="2"></textarea>
              <div className="flex justify-end gap-2">
                <button onClick={()=>setEditingMessageId(null)} className="text-[12px] text-[#54656f] font-semibold px-3 py-1 hover:bg-slate-100 rounded transition-colors">Cancel</button>
                <button onClick={()=>handleSaveEdit(msg)} className="text-[12px] bg-[#008069] text-white px-4 py-1 rounded font-semibold shadow-sm hover:bg-[#006e5a] transition-colors">Save</button>
              </div>
            </div>
          ) : (
            <div onClick={() => { setSelectedMessage(msg); setIsEditingTaskTitle(false); setActiveModal(msg.isTask ? 'task_trail' : 'context'); }} className="cursor-pointer">
              {msg.isTask && (
                <div className="flex justify-between items-center mb-1.5 pb-1.5 border-b border-black/5">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-800 tracking-tight"><i className="fa-regular fa-square-check"></i> OFFICIAL TASK</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shadow-sm ${msg.taskData.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{msg.taskData.status}</span>
                </div>
              )}
              {msg.isPrivateMention && <div className="text-[11px] font-semibold flex items-center gap-1.5 mb-1.5 pb-1 border-b border-black/5 text-purple-700 tracking-tight"><i className="fa-solid fa-lock"></i> {msg.text.startsWith('[Forwarded') ? 'FORWARDED DM' : 'PRIVATE'}</div>}
              {msg.isPrivateForward && (
                <div className="flex items-center gap-1.5 mb-1.5 pb-1.5 border-b border-black/5">
                  <i className="fa-solid fa-lock text-purple-700 text-[11px]"></i>
                  <span className="text-[11px] font-semibold text-purple-700 tracking-tight">Private from {msg.forwardedFromGroup}</span>
                </div>
              )}
              {msg.fileUrl ? (
                <div className="flex flex-col gap-1 my-1">
                  {msg.fileType?.startsWith('image/') ? <img src={msg.fileUrl} alt="Shared" className="rounded max-w-full max-h-64 object-cover cursor-pointer shadow-sm" onClick={(e) => { e.stopPropagation(); window.open(msg.fileUrl, '_blank'); }}/> :
                  <div className="flex items-center gap-3 p-2 rounded bg-black/5 cursor-pointer hover:bg-black/10 transition-colors" onClick={(e) => { e.stopPropagation(); window.open(msg.fileUrl, '_blank'); }}>
                    <div className="w-10 h-10 rounded bg-white flex items-center justify-center text-[#54656f] shadow-sm"><i className="fa-solid fa-file-lines text-lg"></i></div>
                    <div className="flex-1 overflow-hidden"><p className="text-[14.2px] truncate text-[#111b21]">{msg.fileName}</p></div>
                  </div>}
                </div>
              ) : <p className={`leading-snug whitespace-pre-wrap ${currentUserData?.fontSize || 'text-[14.2px]'}`} dangerouslySetInnerHTML={{ __html: formatMessageText(msg.text) }}></p>}
              {msg.isTask && (
                <div className="mt-2 bg-white/60 p-2 rounded flex flex-col gap-1 shadow-sm border border-black/5">
                  <span className="flex items-center gap-1.5 text-[12px] font-medium text-slate-700"><i className="fa-solid fa-users text-[#54656f]"></i> {msg.taskData.assignees?.map(a => (a||"").split('@')[0]).join(', ')}</span>
                  <span className="text-[11px] text-red-600 font-semibold self-end"><i className="fa-regular fa-calendar mr-1"></i>Due {new Date(msg.taskData.deadline).toLocaleDateString()}</span>
                </div>
              )}
              <div className="float-right flex items-center gap-1 mt-1 ml-3 text-[11px] text-[#667781] font-medium">
                {msg.isEdited && <span className="italic mr-1">(edited)</span>}
                {msg.hasReminder && <i className="fa-regular fa-clock text-amber-500 mr-0.5"></i>}
                {isBookmarked && <i className="fa-solid fa-bookmark text-[#008069] mr-0.5"></i>}
                <span className="mt-[2px]">{msg.time}</span>
                {msg.isMine && seenByOthers && <span title="Seen by others" className="ml-0.5 text-[#53bdeb] flex items-center mt-[2px]"><i className="fa-solid fa-check-double text-[13px]"></i></span>}
                {msg.isMine && !seenByOthers && deliveredCount > 0 && <span title="Delivered" className="ml-0.5 text-[#667781] flex items-center mt-[2px]"><i className="fa-solid fa-check-double text-[13px]"></i></span>}
                {msg.isMine && !seenByOthers && deliveredCount === 0 && <span title="Sent" className="ml-0.5 text-[#667781] flex items-center mt-[2px]"><i className="fa-solid fa-check text-[13px]"></i></span>}
              </div>
            </div>
          )}
          {!msg.isMine && <ActionBar/>}
        </div>
        {Object.keys(msg.reactions || {}).length > 0 && (
          <div className={`absolute -bottom-5 ${msg.isMine ? 'right-3' : 'left-3'} flex gap-1 z-10`}>
            {Object.entries(msg.reactions).map(([emoji, users]) => (
              <div key={emoji} onClick={(e)=>{e.stopPropagation(); handleReaction(msg.id, emoji);}} className={`text-[14px] bg-white border border-slate-200 rounded-full px-2 py-[2px] shadow-sm flex items-center gap-1 cursor-pointer hover:scale-110 transition-transform ${users.includes(userEmail) ? 'bg-slate-100 border-slate-300' : ''}`}>
                <span>{emoji}</span><span className="font-semibold text-slate-600 text-[11px]">{users.length}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default MessageBubble;
