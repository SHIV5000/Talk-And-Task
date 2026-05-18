import React, { useState, useEffect, useRef } from 'react';
import { formatMessageText } from '../../utils/helpers.js';
import MemoizedAvatar from '../Common/MemoizedAvatar.jsx';
import { db, storage } from '../../firebase.js';
import { doc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { useTaskAssignments } from '../../hooks/useTaskAssignments';
const STANDARD_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '👏', '🎉', '🔥', '👀', '💯', '✅', '❌', '🙏', '🙌', '✨', '🤔', '😎', '🥳', '🚀', '💡', '📌', '🤝', '👌', '🎯'];

// ===== TaskAssigneesSummary – moved OUTSIDE the return =====
const TaskAssigneesSummary = ({ taskId, isMine }) => {
  const { assignments, loading } = useTaskAssignments(taskId);
  if (loading) return null;

  return (
    <div className={`flex flex-wrap gap-1.5 mt-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
      {assignments.map((assign) => {
        const level = assign.escalationLevel || 0;
        const colors = {
          0: 'bg-green-100 text-green-800 border-green-200',
          1: 'bg-yellow-100 text-yellow-800 border-yellow-200',
          2: 'bg-orange-100 text-orange-800 border-orange-200',
          3: 'bg-red-100 text-red-800 border-red-200',
        };
        const labels = { 0: 'Normal', 1: 'Ack Due', 2: 'Overdue', 3: 'Critical' };
        return (
          <span
            key={assign.id}
            className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${colors[level]}`}
            title={`${labels[level]} – ${assign.isAcknowledged ? 'Acknowledged' : 'Not Ack'}`}
          >
            {assign.id.slice(0, 6)}… {labels[level]}
          </span>
        );
      })}
    </div>
  );
};

// ===== MessageBubble =====
const MessageBubble = React.memo(({
  msg, userEmail, currentUserData, activeGroup, isVipAdmin,
  hasReplies, replyCount, isHighlighted, isUnreadHighlight,
  editingMessageId, editMessageText,
  setEditingMessageId, setEditMessageText, handleSaveEdit,
  scrollToMessageDirect, handleReaction, handleToggleBookmark,
  handleTogglePin, handleDeleteMessage, chatInputRef, toolPreferences,
  setReplyingTo, setSelectedMessage, setIsEditingTaskTitle, setActiveModal, dbUsers,
  jumpToPrivateSource, handleAddInlineComment, customTags = [], setActiveThread, isThreadView = false 
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false); 
  const [isTaskExpanded, setIsTaskExpanded] = useState(false);
  
  // Task Inline Control States
  const [isAddingUpdate, setIsAddingUpdate] = useState(false);
  const [inlineUpdateText, setInlineUpdateText] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(msg.text);
  const [isDelegating, setIsDelegating] = useState(false);
  const [delegateSelection, setDelegateSelection] = useState([]);
  const [editingTrailIdx, setEditingTrailIdx] = useState(null);
  const [trailEditText, setTrailEditText] = useState("");
  const [trailFileUploading, setTrailFileUploading] = useState(false);
  
  const menuRef = useRef(null);
  const tagPickerRef = useRef(null);
  const inlineFileInputRef = useRef(null);

  const isBookmarked = msg.bookmarkedBy?.includes(userEmail);
  const canModify = msg.isMine && !msg.isTask && !hasReplies && !(Object.keys(msg.reactions || {}).length > 0);
  const isEditingThis = editingMessageId === msg.id;
  const seenByOthers = (msg.seenBy || []).filter(e => e !== userEmail).length > 0;
  const deliveredCount = (msg.deliveredTo || []).filter(e => e !== userEmail).length;

  const senderUser = dbUsers?.find(u => u.email === msg.senderEmail) || {};
  const senderName = (msg.sender || '').split('@')[0];
  const senderAvatar = senderUser.profilePicUrl || null;

  const isTaskParticipant = msg.isTask && (msg.senderEmail === userEmail || msg.taskData?.assignees?.includes(userEmail) || currentUserData?.isAdmin || isVipAdmin);
  const isTaskCompleted = msg.isTask && msg.taskData?.status === 'Completed';
  const isSuperAdmin = currentUserData?.isAdmin || isVipAdmin;
  const canEditTask = !isTaskCompleted || isSuperAdmin;

  const hasReactions = Object.keys(msg.reactions || {}).length > 0;

  const isSecure = (msg.fileName || '').startsWith('__SECURE__');
  const displayFileName = isSecure ? msg.fileName.replace('__SECURE__', '') : msg.fileName;

  const getBorderColor = () => {
    if (msg.isTask) return isTaskCompleted ? 'border-l-slate-300' : 'border-l-warning';
    if (msg.isPrivateMention || msg.isPrivateForward) return 'border-l-purple-400';
    return 'border-l-primary';
  };

  // ... all your event handlers (notifyTaskChange, handleInlineSaveTitle, etc.) remain exactly the same ...

  // ===== JSX =====
  return (
    <div id={`msg-${msg.id}`} className={`w-full flex ${msg.isMine ? 'justify-end' : 'justify-start'} ${isThreadView ? 'mb-4' : 'msg-row-spacing'} transform-gpu group/msg ${isUnreadHighlight || isHighlighted ? 'highlight-flash' : ''} ${menuOpen ? 'relative z-50' : 'relative z-[1]'}`}>
      
      <MemoizedAvatar uid={msg.senderUid || 'anon'} url={senderAvatar} name={senderName} sizeClass="w-8 h-8 shrink-0 mt-1" extraClasses={msg.isMine ? 'ml-3 order-last' : 'mr-3'} />
      
      <div className={`flex-1 w-full min-w-0 bg-white rounded-2xl shadow-sm border border-slate-100 ${getBorderColor()} border-l-4 px-4 py-3 relative break-words flex flex-col`}>
        
        {/* ... keep everything unchanged until the task section ... */}

        {/* Inside the task block, where you previously had the invalid placement: */}
        {msg.isTask && (
          <TaskAssigneesSummary taskId={msg.id} isMine={msg.isMine} />
        )}

        {/* ... rest of your component unchanged ... */}

      </div>
    </div>
  );
});

export default MessageBubble;
