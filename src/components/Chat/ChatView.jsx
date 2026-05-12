import React, { useEffect } from 'react';
import MessageBubble from './MessageBubble.jsx';
import MemoizedAvatar from '../Common/MemoizedAvatar.jsx';

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
  unreadHighlightIds, handleAddInlineComment, jumpToPrivateSource
}) {
  
  const handleChatScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    setIsAtBottom(Math.abs(scrollHeight - clientHeight - scrollTop) < 50);
  };

  // 👇 FIX: Aggressive Cross-Group Poller with forced Highlight
  useEffect(() => {
    if (pendingScrollTarget) {
      let attempts = 0;
      const scrollPoller = setInterval(() => {
        const el = document.getElementById(`msg-${pendingScrollTarget}`);
        if (el) {
          clearInterval(scrollPoller);
          setTimeout(() => {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Forcefully inject visual highlight classes for 4 seconds
            el.classList.add('ring-4', 'ring-primary', 'bg-primary/10', 'transition-all', 'duration-500');
            setTimeout(() => {
                el.classList.remove('ring-4', 'ring-primary', 'bg-primary/10');
            }, 4000);
            
            setPendingScrollTarget(null);
          }, 150); // slight delay to let rendering settle
        } else {
          attempts++;
          if (attempts > 30) { // Timeout after 15 seconds
            clearInterval(scrollPoller);
            setPendingScrollTarget(null);
          }
        }
      }, 500);

      return () => clearInterval(scrollPoller);
    }
  }, [pendingScrollTarget, setPendingScrollTarget]);

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
          <span className="text-[12.5px] text-text-secondary bg-primary-light px-4 py-1.5 rounded-lg shadow-sm font-medium">
            <i className="fa-solid fa-lock mr-1.5 text-[10px]"></i> Messages and tasks are end-to-server encrypted.
          </span>
        </div>

        {pinnedMessages.length > 0 && (
          <div className="sticky top-2 z-10 bg-white shadow-lg rounded-lg p-2.5 mb-6 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => scrollToMessageDirect(pinnedMessages[0].id)}>
            <div className="flex justify-between items-center text-xs text-text-secondary font-medium mb-1">
              <span><i className="fa-solid fa-thumbtack mr-1"></i> Pinned Message</span>
            </div>
            <div className="text-sm text-text-primary line-clamp-1 truncate">{pinnedMessages[0].text || pinnedMessages[0].fileName}</div>
          </div>
        )}

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
              isUnreadHighlight={unreadHighlightIds?.includes(msg.id)}
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
            />
          ))}
        </div>

        {typingStatus.length > 0 && (
          <div className="flex items-start mt-2 relative z-[1]">
            <div className="bg-white px-4 py-2.5 rounded-2xl shadow-lg flex items-center gap-3 border border-primary/10">
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

      <button
        onClick={() => {
          if (chatContainerRef.current) {
            chatContainerRef.current.scrollTo({
              top: isAtBottom ? 0 : chatContainerRef.current.scrollHeight,
              behavior: 'smooth'
            });
          }
        }}
        className="absolute bottom-[80px] right-4 bg-primary text-white shadow-lg rounded-full w-10 h-10 flex items-center justify-center z-30 transition-transform hover:scale-110"
        title={isAtBottom ? 'Scroll to top' : 'Scroll to latest'}
      >
        <i className={`fa-solid ${isAtBottom ? 'fa-arrow-up' : 'fa-arrow-down'} text-lg`}></i>
      </button>
    </div>
  );
}
