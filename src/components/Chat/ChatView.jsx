import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MessageBubble from './MessageBubble.jsx';
import MemoizedAvatar from '../Common/MemoizedAvatar.jsx';

const GLOBAL_SUPER_ADMIN_EMAIL = 'shivsuri1@gmail.com';

const DAY_FMT = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
const formatDayLabel = (value) => {
  if (!value) return '';
  const date = value.includes('-') ? new Date(`${value}T00:00:00`) : new Date(value);
  return DAY_FMT.format(date).replace(/ /g, '-');
};

const DEFAULT_VIRTUAL_ROW_HEIGHT = 156;
const VIRTUAL_OVERSCAN = 8;

const findVisibleStart = (offsets, sizes, scrollTop) => {
  for (let index = 0; index < offsets.length; index += 1) {
    if (offsets[index] + sizes[index] >= scrollTop) return index;
  }
  return Math.max(0, offsets.length - 1);
};

function useSimpleMessageVirtualizer(rows, scrollParentRef) {
  const rowSizesRef = useRef(new Map());
  const [measureVersion, setMeasureVersion] = useState(0);
  const [viewport, setViewport] = useState({ scrollTop: 0, height: 0 });

  useEffect(() => {
    const scrollParent = scrollParentRef.current;
    if (!scrollParent) return undefined;

    const updateViewport = () => {
      setViewport({ scrollTop: scrollParent.scrollTop, height: scrollParent.clientHeight });
    };

    updateViewport();
    scrollParent.addEventListener('scroll', updateViewport, { passive: true });
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateViewport) : null;
    resizeObserver?.observe(scrollParent);

    return () => {
      scrollParent.removeEventListener('scroll', updateViewport);
      resizeObserver?.disconnect();
    };
  }, [scrollParentRef]);

  const { offsets, sizes, totalSize } = useMemo(() => {
    let runningOffset = 0;
    const nextOffsets = [];
    const nextSizes = [];

    rows.forEach((row) => {
      nextOffsets.push(runningOffset);
      const rowSize = rowSizesRef.current.get(row.key) || DEFAULT_VIRTUAL_ROW_HEIGHT;
      nextSizes.push(rowSize);
      runningOffset += rowSize;
    });

    return { offsets: nextOffsets, sizes: nextSizes, totalSize: runningOffset };
  }, [rows, measureVersion]);

  const virtualItems = useMemo(() => {
    if (rows.length === 0) return [];
    if (!viewport.height) {
      const start = Math.max(0, rows.length - 20);
      return rows.slice(start).map((row, index) => ({ index: start + index, row, start: offsets[start + index] || 0 }));
    }

    const startIndex = Math.max(0, findVisibleStart(offsets, sizes, viewport.scrollTop) - VIRTUAL_OVERSCAN);
    const viewportEnd = viewport.scrollTop + viewport.height;
    let endIndex = startIndex;

    while (endIndex < rows.length && offsets[endIndex] <= viewportEnd) endIndex += 1;
    endIndex = Math.min(rows.length - 1, endIndex + VIRTUAL_OVERSCAN);

    const items = [];
    for (let index = startIndex; index <= endIndex; index += 1) {
      items.push({ index, row: rows[index], start: offsets[index] || 0 });
    }
    return items;
  }, [offsets, rows, sizes, viewport.height, viewport.scrollTop]);

  const measureRow = useCallback((rowKey, measuredHeight) => {
    if (!measuredHeight) return;
    const roundedHeight = Math.ceil(measuredHeight);
    if (rowSizesRef.current.get(rowKey) === roundedHeight) return;
    rowSizesRef.current.set(rowKey, roundedHeight);
    setMeasureVersion((version) => version + 1);
  }, []);

  const scrollToIndex = useCallback((index, align = 'center') => {
    const scrollParent = scrollParentRef.current;
    if (!scrollParent || index < 0 || index >= rows.length) return;

    const rowStart = offsets[index] || 0;
    const rowSize = sizes[index] || DEFAULT_VIRTUAL_ROW_HEIGHT;
    const nextTop = align === 'start'
      ? rowStart
      : rowStart - Math.max(0, (scrollParent.clientHeight - rowSize) / 2);

    scrollParent.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
  }, [offsets, rows.length, scrollParentRef, sizes]);

  return { measureRow, scrollToIndex, totalSize, virtualItems };
}

function VirtualMessageRow({ row, start, measureRow, children }) {
  const rowRef = useRef(null);

  useEffect(() => {
    const node = rowRef.current;
    if (!node) return undefined;

    const updateSize = () => measureRow(row.key, node.getBoundingClientRect().height);
    updateSize();

    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateSize) : null;
    resizeObserver?.observe(node);

    return () => resizeObserver?.disconnect();
  }, [measureRow, row.key, row.measureKey]);

  return (
    <div
      ref={rowRef}
      className="absolute left-0 top-0 w-full"
      style={{ transform: `translateY(${start}px)` }}
    >
      {children}
    </div>
  );
}

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
  customTags, setActiveReplies, setActiveTaskSidebar, sendMessageToDB, featureFlags = {},
  isLoadingOlderMessages = false, hasOlderMessages = false, loadOlderMessages
}) {
  const [expandedThreads, setExpandedThreads] = useState({});
  const userEmail = (user?.email || '').toLowerCase();
  const canManagePinnedMessages =
    userEmail === GLOBAL_SUPER_ADMIN_EMAIL ||
    (activeGroup?.admins || []).some((email) => (email || '').toLowerCase() === userEmail);
  const pinnedTooltip = canManagePinnedMessages ? 'Unpin message' : 'Only admins can unpin';

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

  const messageRows = useMemo(() => messagesToRender.map((msg, idx) => {
    const threadReplies = repliesByParent.get(msg.id) || [];
    const threadReplyCount = threadReplies.length;
    const currentDay = msg.dateString || (msg.timestamp?.toDate ? msg.timestamp.toDate().toISOString().split('T')[0] : '');
    const prev = messagesToRender[idx - 1];
    const prevDay = prev?.dateString || (prev?.timestamp?.toDate ? prev.timestamp.toDate().toISOString().split('T')[0] : '');
    const threadExpanded = !!expandedThreads[msg.id];
    const isEditing = editingMessageId === msg.id;

    return {
      key: msg.id,
      measureKey: `${msg.id}:${threadExpanded}:${threadReplyCount}:${isEditing}:${editMessageText?.length || 0}`,
      msg,
      currentDay,
      showDaySeparator: !!currentDay && currentDay !== prevDay,
      threadReplies,
      threadReplyCount,
      threadExpanded,
    };
  }), [editMessageText, editingMessageId, expandedThreads, messagesToRender, repliesByParent]);

  const messageIndexById = useMemo(() => {
    const map = new Map();
    messageRows.forEach((row, index) => map.set(row.msg.id, index));
    return map;
  }, [messageRows]);

  const { measureRow, scrollToIndex, totalSize, virtualItems } = useSimpleMessageVirtualizer(messageRows, chatContainerRef);

  const scrollToVirtualMessage = useCallback((messageId) => {
    const messageIndex = messageIndexById.get(messageId);
    if (messageIndex !== undefined) scrollToIndex(messageIndex, 'center');
    setTimeout(() => scrollToMessageDirect?.(messageId), 80);
  }, [messageIndexById, scrollToIndex, scrollToMessageDirect]);

  useEffect(() => {
    if (pendingScrollTarget) {
      const targetIndex = messageIndexById.get(pendingScrollTarget);
      if (targetIndex !== undefined) scrollToIndex(targetIndex, 'center');

      let attempts = 0;
      const scrollPoller = setInterval(() => {
        const el = document.getElementById(`msg-${pendingScrollTarget}`);
        if (el) {
          clearInterval(scrollPoller);
          setTimeout(() => {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });

            el.classList.add('ring-4', 'ring-yellow-300', 'bg-yellow-100', 'dark:bg-yellow-500/20', 'transition-all', 'duration-500');
            setTimeout(() => {
              el.classList.remove('ring-4', 'ring-yellow-300', 'bg-yellow-100', 'dark:bg-yellow-500/20');
            }, 2000);

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
  }, [messageIndexById, pendingScrollTarget, scrollToIndex, setPendingScrollTarget]);

  return (
    <div ref={chatContainerRef} onScroll={handleChatScroll} className="flex-1 overflow-y-auto px-3 md:px-4 bg-slate-50 dark:bg-slate-950 relative">
      <div className="mx-auto flex w-full max-w-3xl flex-col min-h-full justify-end py-4 pb-10">

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
          <span className="text-[12.5px] text-slate-500 dark:text-slate-300 bg-slate-200/50 dark:bg-slate-800/80 px-4 py-1.5 rounded-lg shadow-sm font-medium border border-slate-200 dark:border-slate-700">
            <i className="fa-solid fa-lock mr-1.5 text-[10px]"></i> Messages and tasks are end-to-server encrypted.
          </span>
        </div>

        {pinnedMessages.length > 0 && (
          <div
            className="sticky top-2 z-10 bg-white dark:bg-slate-900 shadow-lg rounded-lg p-2.5 mb-6 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border border-slate-100 dark:border-slate-700 pinned-banner-glow relative overflow-hidden"
            onClick={() => scrollToVirtualMessage(pinnedMessages[0].id)}
          >
            <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-300 font-medium mb-1">
              <span><i className="fa-solid fa-thumbtack mr-1 text-indigo-500"></i> Pinned Message</span>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  if (canManagePinnedMessages) handleTogglePin?.(pinnedMessages[0]);
                }}
                disabled={!canManagePinnedMessages}
                title={pinnedTooltip}
                aria-label={pinnedTooltip}
                className={`relative z-20 inline-flex h-6 w-6 items-center justify-center rounded-full border text-[10px] transition-colors ${canManagePinnedMessages ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/20' : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-70 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500'}`}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="text-sm text-slate-800 dark:text-slate-100 line-clamp-1 truncate font-medium">{pinnedMessages[0].text || pinnedMessages[0].fileName}</div>
          </div>
        )}

        <div className="relative z-[1] flex flex-col justify-end">
          {hasOlderMessages && (
            <div className="mb-4 flex justify-center">
              <button
                type="button"
                onClick={loadOlderMessages}
                disabled={isLoadingOlderMessages}
                className="rounded-full border border-indigo-200 bg-white px-4 py-2 text-xs font-bold text-indigo-600 shadow-sm transition-colors hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-500/30 dark:bg-slate-900 dark:text-indigo-200 dark:hover:bg-slate-800"
              >
                {isLoadingOlderMessages ? 'Loading older messages...' : 'Load older messages'}
              </button>
            </div>
          )}
          <div
            className="relative w-full"
            style={{ height: `${totalSize}px` }}
          >
            {virtualItems.map(({ row, start }) => {
              const { msg, currentDay, showDaySeparator, threadReplies, threadReplyCount, threadExpanded } = row;
              return (
                <VirtualMessageRow key={row.key} row={row} start={start} measureRow={measureRow}>
                  {showDaySeparator && (
                    <div className="flex items-center gap-3 my-5 text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                      <div className="flex-1 border-t border-dotted border-slate-300 dark:border-slate-700"></div>
                      <span>{formatDayLabel(currentDay)}</span>
                      <div className="flex-1 border-t border-dotted border-slate-300 dark:border-slate-700"></div>
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
                    scrollToMessageDirect={scrollToVirtualMessage}
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
                    threadExpanded={threadExpanded}
                    onToggleThread={() => setExpandedThreads(prev => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                    sendMessageToDB={sendMessageToDB}
                    featureFlags={featureFlags}
                  />
                </VirtualMessageRow>
              );
            })}
          </div>
        </div>

        {typingStatus.length > 0 && (
          <div className="flex items-start mt-2 relative z-[1]">
            <div className="bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl shadow-lg flex items-center gap-3 border border-indigo-500/10 dark:border-indigo-400/20">
              <div className="flex -space-x-2">
                {typingStatus.map(t => {
                  const uidPart = t.id.split('_')[1] || t.id;
                  const typist = dbUsers.find(u => u.uid === uidPart) || {};
                  return <MemoizedAvatar key={t.id} uid={uidPart} url={typist.profilePicUrl} name={t.name} sizeClass="w-7 h-7 typing-avatar-pulse border-2 border-white dark:border-slate-900 relative z-10" />
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
