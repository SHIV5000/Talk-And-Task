import React, { useEffect } from 'react';
import MessageBubble from './MessageBubble.jsx';
import MemoizedAvatar from '../Common/MemoizedAvatar.jsx';
import { formatToDDMMMYY } from '../../utils/helpers.js';

export default function ChatView({
  messagesToRender, messages, activeGroup, user, currentUserData, isVipAdmin,
  pinnedMessages, typingStatus, replyingTo, setReplyingTo, toolPreferences,
  dbUsers, groups, setActiveGroup, setShowRightSidebar, setMobileSidebarOpen,
  pendingScrollTarget, setPendingScrollTarget,
  setActiveModal, scrollToMessageDirect, handleReaction,
  handleToggleBookmark, handleTogglePin, handleDeleteMessage, chatInputRef,
  editingMessageId, editMessageText, setEditingMessageId, setEditMessageText,
  handleSaveEdit, setSelectedMessage, setIsEditingTaskTitle, messagesEndRef,
  chatContainerRef, isAtBottom, setIsAtBottom, highlightedMsgId,
  unreadHighlightIds, handleAddInlineComment, jumpToPrivateSource,
  customTags, setActiveThread 
}) {
  
  const handleChatScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    setIsAtBottom(Math.abs(scrollHeight - clientHeight - scrollTop) < 50);
  };

  useEffect(() => {
    if (pendingScrollTarget) {
      let attempts = 0;
      const scrollPoller = setInterval(() => {
        const el = document.getElementById(`msg-${pendingScrollTarget}`);
        if (el) {
          clearInterval(scrollPoller);
          setTimeout(() => {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('highlight-flash');
            setTimeout(() => el.classList.remove('highlight-flash'), 3000);
          }, 100);
          setPendingScrollTarget(null);
        } else {
          attempts++;
          if (attempts > 20) {
            clearInterval(scrollPoller);
            setPendingScrollTarget(null);
          }
        }
      }, 100);
    }
  }, [pendingScrollTarget, messagesToRender, setPendingScrollTarget]);

  return (
    <div className="flex-1 overflow-y-auto p-4 custom-sidebar-scroll wa-bg relative" onScroll={handleChatScroll} ref={chatContainerRef}>
      
      {pinnedMessages && pinnedMessages.length > 0 && (
        <div className="sticky top-0 z-30 mb-4 flex flex-col gap-2">
          {pinnedMessages.map(pm => (
            <div key={`pin-${pm.id}`} onClick={() => scrollToMessageDirect(pm.id)} className="bg-white/95 backdrop-blur-md border border-indigo-200 p-3 rounded-xl shadow-md cursor-pointer hover:bg-indigo-50 transition-colors flex items-center gap-3 animate-in slide-in-from-top-2">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0"><i className="fa-solid fa-thumbtack"></i></div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold text-indigo-600 uppercase tracking-widest mb-0.5">Pinned Message</div>
                <div className="text-[13px] text-slate-700 truncate font-medium">{pm.text || pm.fileName}</div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); handleTogglePin(pm.id, true); }} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 transition-colors"><i className="fa-solid fa-xmark"></i></button>
            </div>
          ))}
        </div>
      )}

      <div className="max-w-4xl mx-auto flex flex-col">
        <div className="text-center my-6">
          <span className="bg-[#ffeecd] text-[#54656f] text-[12px] px-4 py-1.5 rounded-lg shadow-sm font-medium inline-flex items-center gap-2">
            <i className="fa-solid fa-lock text-[10px]"></i> Messages and tasks are end-to-end encrypted. No one outside of this workspace can read or listen to them.
          </span>
        </div>

        <div className="flex flex-col flex-1">
          {messagesToRender.map((msg, index) => {
            const currentMsgDate = msg.timestamp?.toDate ? new Date(msg.timestamp.toDate()) : new Date(msg.dateString || Date.now());
            const prevMsg = index > 0 ? messagesToRender[index - 1] : null;
            const prevMsgDate = prevMsg ? (prevMsg.timestamp?.toDate ? new Date(prevMsg.timestamp.toDate()) : new Date(prevMsg.dateString || Date.now())) : null;
            const showDivider = !prevMsg || currentMsgDate.toDateString() !== prevMsgDate.toDateString();

            return (
                <React.Fragment key={msg.id}>
                    {showDivider && (
                        <div className="flex items-center justify-center my-5 opacity-90 z-10 relative">
                            <div className="bg-slate-200/60 px-4 py-1.5 rounded-full shadow-sm border border-slate-200">
                                <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">{formatToDDMMMYY(currentMsgDate)}</span>
                            </div>
                        </div>
                    )}
                    <MessageBubble 
                      msg={msg}
                      userEmail={user.email}
                      currentUserData={currentUserData}
                      activeGroup={activeGroup}
                      isVipAdmin={isVipAdmin}
                      hasReplies={messages.some(m => m.replyToId === msg.id)}
                      replyCount={messages.filter(m => m.replyToId === msg.id).length}
                      isHighlighted={highlightedMsgId === msg.id}
                      isUnreadHighlight={unreadHighlightIds.includes(msg.id)}
                      editingMessageId={editingMessageId}
                      editMessageText={editMessageText}
                      setEditingMessageId={setEditingMessageId}
                      setEditMessageText={setEditMessageText}
                      handleSaveEdit={handleSaveEdit}
                      scrollToMessageDirect={scrollToMessageDirect}
                      handleReaction={handleReaction}
                      handleToggleBookmark={handleToggleBookmark}
                      handleTogglePin={handleTogglePin}
                      handleDeleteMessage={handleDeleteMessage}
                      chatInputRef={chatInputRef}
                      toolPreferences={toolPreferences}
                      setReplyingTo={setReplyingTo}
                      setSelectedMessage={setSelectedMessage}
                      setIsEditingTaskTitle={setIsEditingTaskTitle}
                      setActiveModal={setActiveModal}
                      dbUsers={dbUsers}
                      jumpToPrivateSource={jumpToPrivateSource} 
                      handleAddInlineComment={handleAddInlineComment} 
                      customTags={customTags || []} 
                      setActiveThread={setActiveThread}
                    />
                </React.Fragment>
            );
          })}
        </div>

        {typingStatus.length > 0 && (
          <div className="flex items-start mt-2 relative z-[1]">
            <div className="bg-white px-4 py-2.5 rounded-2xl shadow-lg flex items-center gap-3 border border-indigo-500/10">
              <div className="flex -space-x-2">
                {typingStatus.map(t => {
                  const uidPart = t.id.split('_')[1] || t.id;
                  const typist = dbUsers.find(u => u.uid === uidPart) || {};
                  return <MemoizedAvatar key={t.id} uid={uidPart} url={typist.profilePicUrl} name={t.name} sizeClass="w-7 h-7 typing-avatar-pulse border-2 border-white relative z-10" />
                })}
              </div>
              <span className="typing-gradient-text text-sm">... typing</span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} className="h-6 shrink-0"></div>
      </div>
    </div>
  );
}
