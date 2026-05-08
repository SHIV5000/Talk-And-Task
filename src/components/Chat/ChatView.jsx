import React, { useRef, useEffect } from 'react';
import MessageBubble from './MessageBubble.jsx';
import MemoizedAvatar from '../Common/MemoizedAvatar.jsx';

export default function ChatView({
  messagesToRender,
  messages,
  activeGroup,
  user,
  currentUserData,
  isVipAdmin,
  pinnedMessages,
  typingStatus,
  replyingTo,
  setReplyingTo,
  toolPreferences,
  dbUsers,
  groups,
  setActiveGroup,
  setShowRightSidebar,
  setMobileSidebarOpen,
  setPendingScrollTarget,
  setActiveModal,
  scrollToMessageDirect,
  handleReaction,
  handleToggleBookmark,
  handleTogglePin,
  handleDeleteMessage,
  chatInputRef,
  editingMessageId,
  editMessageText,
  setEditingMessageId,
  setEditMessageText,
  handleSaveEdit,
  setSelectedMessage,
  setIsEditingTaskTitle,
  messagesEndRef,
  chatContainerRef,
  isAtBottom,
  setIsAtBottom,
  highlightedMsgId,
}) {
  const handleChatScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    setIsAtBottom(Math.abs(scrollHeight - clientHeight - scrollTop) < 50);
  };

  const scrollToPosition = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: isAtBottom ? 0 : chatContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div ref={chatContainerRef} onScroll={handleChatScroll} className="flex-1 overflow-y-auto px-4 md:px-[8%] wa-bg relative">
      <div className="flex flex-col min-h-full justify-end py-4 pb-10">
        {/* Watermark */}
        {toolPreferences.showWatermark !== false && (
          <div className="doodle-watermark">
            {Array.from({ length: 15 }).map((_, rowIdx) => (
              <div key={rowIdx} className="doodle-row">
                {Array.from({ length: 8 }).map((_, i) => (
                  <span key={i} className="doodle-item" style={{ fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif', fontSize: '20pt', transform: 'rotate(-20deg)', opacity: 0.7 }}>
                    {currentUserData?.name || user.email.split('@')[0]}
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}

        <div className="text-center mb-6 mt-4 relative z-[1]">
          <span className="text-[12.5px] text-[#54656f] bg-[#ffeecd] px-4 py-1.5 rounded-lg shadow-sm font-medium">
            <i className="fa-solid fa-lock mr-1.5 text-[10px]"></i> Messages and tasks are end-to-server encrypted.
          </span>
        </div>

        {/* Pinned Message */}
        {pinnedMessages.length > 0 && (
          <div className="sticky top-2 z-10 bg-white shadow-[0_1px_2px_rgba(11,20,26,0.1)] rounded-lg p-2.5 mb-6 cursor-pointer transform-gpu hover:bg-slate-50 transition-colors mx-auto w-[92%] md:w-full md:max-w-[65vw] relative z-[1]"
            onClick={() => scrollToMessageDirect(pinnedMessages[0].id)}>
            <div className="flex justify-between items-center text-[12px] text-[#54656f] font-medium mb-1">
              <span><i className="fa-solid fa-thumbtack mr-1 text-[#8696a0]"></i> Pinned Message</span>
            </div>
            <div className="text-[14px] text-[#111b21] line-clamp-1 truncate">{pinnedMessages[0].text || pinnedMessages[0].fileName}</div>
          </div>
        )}

        {/* Message list */}
        <div className="relative z-[1] flex flex-col justify-end">
          {messagesToRender.map(msg => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              userEmail={user.email}
              currentUserData={currentUserData}
              activeGroup={activeGroup}
              isVipAdmin={isVipAdmin}
              hasReplies={messages.some(m => m.replyToId === msg.id)}
              isHighlighted={highlightedMsgId === msg.id}
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
            />
          ))}
        </div>

        {/* Typing indicator */}
        {typingStatus.length > 0 && (
          <div className="flex items-start animate-in fade-in slide-in-from-bottom-2 mt-2 relative z-[1]">
            <div className="bg-white px-4 py-2.5 rounded-2xl rounded-tl-none shadow-[0_4px_15px_rgba(0,168,132,0.15)] flex items-center gap-3 border border-teal-50">
              <div className="flex -space-x-2">
                {typingStatus.map(t => {
                  const uidPart = t.id.split('_')[1] || t.id;
                  const typist = dbUsers.find(u => u.uid === uidPart || u.name === t.name) || {};
                  return <MemoizedAvatar key={t.id} uid={uidPart} url={typist.profilePicUrl} name={t.name} sizeClass="w-7 h-7 typing-avatar-pulse border-2 border-white relative z-10" />
                })}
              </div>
              <span className="typing-gradient-text text-[13px] tracking-wide">
                {typingStatus.map(t => t.name).join(', ')} {typingStatus.length > 1 ? 'are' : 'is'} typing...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} className="h-6 shrink-0 relative z-[1]"></div>
      </div>

      {/* Scroll arrow */}
      <button onClick={scrollToPosition} className="absolute bottom-[80px] right-4 bg-white text-[#54656f] shadow-[0_1px_1px_0_rgba(11,20,26,.1),0_2px_5px_0_rgba(11,20,26,.2)] rounded-full w-10 h-10 flex items-center justify-center z-30 transition-transform">
        <i className={`fa-solid ${isAtBottom ? 'fa-arrow-up' : 'fa-arrow-down'} text-[16px]`}></i>
      </button>
    </div>
  );
}
