import React, { useEffect, useMemo, useState } from 'react';
import MessageBubble from './MessageBubble.jsx';
import MemoizedAvatar from '../Common/MemoizedAvatar.jsx';

const DAY_FMT = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
const formatDayLabel = (value) => {
  if (!value) return '';
  const date = value.includes('-') ? new Date(`${value}T00:00:00`) : new Date(value);
  return DAY_FMT.format(date).replace(/ /g, '-');
};

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
  customTags, setActiveReplies, setActiveTaskSidebar
}) {
  const [expandedThreads, setExpandedThreads] = useState({});

  // Inject pinned banner glow CSS
  useEffect(() => {
    const styleId = 'pinned-banner-glow-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .pinned-banner-glow::after {
          content: '';
          position: absolute;
          top: -2px; bottom: -2px;
          width: 10px;
          background: linear-gradient(to bottom, transparent 0%, rgba(99,102,241,0.22) 30%, rgba(99,102,241,0.06) 50%, rgba(99,102,241,0.22) 70%, transparent 100%);
          filter: blur(3px);
          animation: sweepGlow 4s ease-in-out infinite alternate;
          pointer-events: none;
          border-radius: 2px;
        }
        @keyframes sweepGlow {
          0% { left: calc(100% + 6px); opacity: 0.3; }
          30% { opacity: 0.85; }
          70% { opacity: 0.85; }
          100% { left: -16px; opacity: 0.3; }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const handleChatScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    setIsAtBottom(Math.abs(scrollHeight - clientHeight - scrollTop) < 50);
  };

  const repliesByParent = useMemo(() => {
    const map = new Map();
    messages.forEach((m) => {
      if (!m.replyToId) return;
      const arr = map.get(m.replyToId) || [];
      arr.push(m);
      map.set(m.replyToId, arr);
    });
    map.forEach((arr) => arr.sort((a, b) => (a.timestamp?.toMillis?.() || Date.now()) - (b.timestamp?.toMillis?.() || Date.now())));
    return map;
  }, [messages]);

  useEffect(() => {
    if (pendingScrollTarget) {
      let attempts = 0;
      const scrollPoller = setInterval(() => {
        const el = document.getElementById(`msg-${pendingScrollTarget}`);
        if (el) {
          clearInterval(scrollPoller);
          setTimeout(() => {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });

            el.classList.add('ring-4', 'ring-indigo-400', 'bg-indigo-50', 'transition-all', 'duration-500');
            setTimeout(() => {
              el.classList.remove('ring-4', 'ring-indigo-400', 'bg-indigo-50');
            }, 4000);

            setPendingScrollTarget(null);
          }, 150);
        } else {
          attempts++;
          if (attempts > 30) {
            clearInterval(scrollPoller);
            setPendingScrollTarget(null);
          }
        }
      }, 500);

      return () => clearInterval(scrollPoller);
    }
  }, [pendingScrollTarget, setPendingScrollTarget]);

  return (
    <div ref={chatContainerRef} onScroll={handleChatScroll} className="flex-1 overflow-y-auto px-4 md:px-[8%] bg-slate-50 relative">
      <div className="flex flex-col min-h-full justify-end py-4 pb-10">

        {toolPreferences?.showWatermark !== false && (
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
          <span className="text-[12.5px] text-slate-500 bg-slate-200/50 px-4 py-1.5 rounded-lg shadow-sm font-medium border border-slate-200">
            <i className="fa-solid fa-lock mr-1.5 text-[10px]"></i> Messages and tasks are end-to-server encrypted.
          </span>
        </div>

        {pinnedMessages.length > 0 && (
          <div
            className="sticky top-2 z-10 bg-white shadow-lg rounded-lg p-2.5 mb-6 cursor-pointer hover:bg-slate-50 transition-colors border border-slate-100 pinned-banner-glow relative overflow-hidden"
            onClick={() => scrollToMessageDirect(pinnedMessages[0].id)}
          >
            <div className="flex justify-between items-center text-xs text-slate-500 font-medium mb-1">
              <span><i className="fa-solid fa-thumbtack mr-1 text-indigo-500"></i> Pinned Message</span>
            </div>
            <div className="text-sm text-slate-800 line-clamp-1 truncate font-medium">{pinnedMessages[0].text || pinnedMessages[0].fileName}</div>
          </div>
        )}

        <div className="relative z-[1] flex flex-col justify-end">
          {messagesToRender.map((msg, idx) => {
            const threadReplies = repliesByParent.get(msg.id) || [];
            const threadReplyCount = threadReplies.length;
            const currentDay = msg.dateString || (msg.timestamp?.toDate ? msg.timestamp.toDate().toISOString().split('T')[0] : '');
            const prev = messagesToRender[idx - 1];
            const prevDay = prev?.dateString || (prev?.timestamp?.toDate ? prev.timestamp.toDate().toISOString().split('T')[0] : '');
            return (
              <React.Fragment key={msg.id}>
                {currentDay && currentDay !== prevDay && (
                  <div className="flex items-center gap-3 my-5 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    <div className="flex-1 border-t border-dotted border-slate-300"></div>
                    <span>{formatDayLabel(currentDay)}</span>
                    <div className="flex-1 border-t border-dotted border-slate-300"></div>
                  </div>
                )}
                <MessageBubble
                  msg={msg}
                  userEmail={user.email}
                  currentUserData={currentUserData}
                  activeGroup={activeGroup}
                  isVipAdmin={isVipAdmin}
                  hasReplies={threadReplyCount > 0}
                  replyCount={threadReplyCount}
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
                  customTags={customTags || []}
                  setActiveReplies={(msg) => { setActiveTaskSidebar?.(null); setActiveReplies?.(msg); }}
                  setActiveTaskSidebar={setActiveTaskSidebar}
                  onOpenTask={() => {}}
                  threadReplies={threadReplies}
                  threadExpanded={!!expandedThreads[msg.id]}
                  onToggleThread={() => setExpandedThreads(prev => ({ ...prev, [msg.id]: !prev[msg.id] }))}
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
