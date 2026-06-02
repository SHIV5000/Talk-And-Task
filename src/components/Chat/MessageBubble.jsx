import React, { useState, useEffect, useRef, useMemo } from 'react';
import { formatMessageText } from '../../utils/helpers.js';
import MemoizedAvatar from '../Common/MemoizedAvatar.jsx';
import useUserDisplayName from '../../hooks/useUserDisplayName.js';
import { db, storage } from '../../firebase.js';
import { doc, updateDoc, collection, addDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const TASK_DTF = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true });
const formatTaskDateTime = (value) => { if (!value) return 'N/A'; const d = new Date(value); if (Number.isNaN(d.getTime())) return 'N/A'; return TASK_DTF.format(d).replace(',', '').replace(/ /g, '-').replace(/-(\d{2}:\d{2})-/, ' $1 '); };

const STANDARD_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '👏', '🎉', '🔥', '👀', '💯', '✅', '❌', '🙏', '🙌', '✨', '🤔', '😎', '🥳', '🚀', '💡', '📌', '🤝', '👌', '🎯'];

const MessageBubble = React.memo(({
  msg, userEmail, currentUserData, activeGroup, isVipAdmin,
  hasReplies, replyCount, isHighlighted, isUnreadHighlight,
  editingMessageId, editMessageText,
  setEditingMessageId, setEditMessageText, handleSaveEdit,
  scrollToMessageDirect, handleReaction, handleToggleBookmark,
  handleTogglePin, handleDeleteMessage, chatInputRef, toolPreferences,
  setReplyingTo, setSelectedMessage, setIsEditingTaskTitle, setActiveModal, dbUsers,
  jumpToPrivateSource, handleAddInlineComment, customTags = [], setActiveReplies, setActiveTaskSidebar, isThreadView = false,
  onOpenTask, taskSidebarMode = false, threadExpanded = false, onToggleThread, threadReplies = []
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
  const [delegateComment, setDelegateComment] = useState("");
  const [delegateSearch, setDelegateSearch] = useState("");
  const [editingTrailIdx, setEditingTrailIdx] = useState(null);
  const [trailEditText, setTrailEditText] = useState("");
  const [trailFileUploading, setTrailFileUploading] = useState(false);
  const [trailUploadProgress, setTrailUploadProgress] = useState(0);
  const [msgReplyUploadProgress, setMsgReplyUploadProgress] = useState(0);
  const [inlineReplyOpen, setInlineReplyOpen] = useState(false);
  const [inlineReplyText, setInlineReplyText] = useState('');
  const [replyFormatOpen, setReplyFormatOpen] = useState(false);
  const [showAssigneeChips, setShowAssigneeChips] = useState(false);
  const inlineReplyRef = useRef(null);

  // NEW: per‑assignee review state for modern review panel
  const [reviewStates, setReviewStates] = useState({});

  const menuRef = useRef(null);
  const tagPickerRef = useRef(null);
  const inlineFileInputRef = useRef(null);
  const inlineUpdateRef = useRef(null);
  const msgReplyFileInputRef = useRef(null);

  const isBookmarked = msg.bookmarkedBy?.includes(userEmail);
  const canModify = msg.isMine && !msg.isTask && !hasReplies && !(Object.keys(msg.reactions || {}).length > 0);
  const isEditingThis = editingMessageId === msg.id;
  const seenByOthers = (msg.seenBy || []).filter(e => e !== userEmail).length > 0;
  const deliveredCount = (msg.deliveredTo || []).filter(e => e !== userEmail).length;
  const mentionsMe = (msg.mentionEmails || []).includes(userEmail);

  const senderUser = dbUsers?.find(u => u.email === msg.senderEmail) || {};
  const liveSenderName = useUserDisplayName(senderUser.uid || msg.senderUid, senderUser.name || (msg.sender || msg.senderEmail || '').split('@')[0]);
  const senderName = liveSenderName || senderUser.name || (msg.sender || msg.senderEmail || '').split('@')[0];
  const senderAvatar = senderUser.profilePicUrl || null;
  const getUserName = (email) => dbUsers?.find(u => u.email === email)?.name || (email || '').split('@')[0] || 'Unknown';
  const sortedGroupUsers = [...(dbUsers || [])]
    .filter(u => !activeGroup?.members || activeGroup.members.includes(u.email))
    .sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || ''));

  const isTaskParticipant = msg.isTask && (msg.senderEmail === userEmail || msg.taskData?.assignees?.includes(userEmail) || currentUserData?.isAdmin || isVipAdmin);
  const isAssignee = msg.isTask && msg.taskData?.assignees?.includes(userEmail);
  const isTaskCompleted = msg.isTask && msg.taskData?.status === 'Completed';
  const assigneeStates = msg.taskData?.assigneeStates || {};
  const masterReviewerEmail = msg.taskData?.masterReviewerEmail || msg.senderEmail;
  const isCreator = masterReviewerEmail === userEmail;
  const myAssigneeState = assigneeStates[userEmail] || (isAssignee ? 'assigned' : null);
  const isRevokedForMe = msg.isTask && myAssigneeState === 'revoked';
  const isSubmittedForReviewMe = msg.isTask && myAssigneeState === 'submitted_completed';
  const isAcceptedForMe = msg.isTask && myAssigneeState === 'accepted_completed';
  const isTransferredOutForMe = msg.isTask && myAssigneeState === 'transferred_out';
  const isTransferredInForMe = msg.isTask && myAssigneeState === 'transferred_in';
  const isNeedsReviewForMe = msg.isTask && myAssigneeState === 'needs_review';
  const myAckMap = msg.taskData?.ackBy || {};
  const myAcked = !!myAckMap[userEmail];
  const ackRequiredLocked = msg.isTask && isAssignee && msg.taskData?.requireAck && !myAcked;
  const isTaskReadOnlyForMe = isSubmittedForReviewMe || isAcceptedForMe || isTransferredOutForMe || isRevokedForMe;
  const canUseWorkerControls = isAssignee && !isTaskCompleted && !ackRequiredLocked && !isTaskReadOnlyForMe;
  const statusBadgeText = isTransferredOutForMe ? 'Task Transferred' : isTransferredInForMe ? 'Transferred Task' : isAcceptedForMe ? 'Completed' : isNeedsReviewForMe ? 'Under Review by Me' : isRevokedForMe ? 'Revoked' : isSubmittedForReviewMe ? 'Sent for Review' : msg.taskData?.status;
  const statusBadgeClass = isTransferredOutForMe ? 'bg-[#800020]/10 text-[#800020] border-[#800020]/30' : isTransferredInForMe ? 'bg-purple-50 text-purple-700 border-purple-200' : isAcceptedForMe ? 'bg-teal-50 text-teal-700 border-teal-200' : isNeedsReviewForMe ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : isRevokedForMe ? 'bg-rose-50 text-rose-700 border-rose-200' : isSubmittedForReviewMe ? 'bg-amber-50 text-amber-700 border-amber-200' : msg.taskData?.status === 'Completed' ? 'bg-teal-50 text-teal-700 border-teal-200' : msg.taskData?.status === 'In Progress' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-amber-50 text-amber-700 border-amber-200';
  const isSuperAdmin = currentUserData?.isAdmin || isVipAdmin;
  const canEditTask = (!isTaskCompleted || isSuperAdmin) && isCreator;
  const canPinItem = currentUserData?.isAdmin || isVipAdmin || activeGroup?.admins?.includes(userEmail) || (msg.isTask && msg.senderEmail === userEmail);
  const bubbleWidthClass = isThreadView ? 'w-full max-w-full' : 'w-[80%] max-w-[80%]';
  const taskShellClass = msg.isTask ? 'border-2 border-indigo-100 border-l-[6px] rounded-2xl' : '';
  const activeAssignees = (msg.taskData?.assignees || []).filter(e => !['revoked', 'transferred_out'].includes(assigneeStates[e]));
  const allAccepted = activeAssignees.length > 0 && activeAssignees.every(e => assigneeStates[e] === 'accepted_completed');

  const hasCompletionEvidence = useMemo(() => (msg.taskData?.trail || []).some(t => t.fileUrl || t.comment || /delegat|update/i.test(t.action || '')), [msg.taskData]);

  const hasReactions = Object.keys(msg.reactions || {}).length > 0;

  const isSecure = (msg.fileName || '').startsWith('__SECURE__');
  const displayFileName = isSecure ? msg.fileName.replace('__SECURE__', '') : msg.fileName;
  const maskUrl = (v = '') => String(v).replace(/https?:\/\/[^\s"']+/g, '[secure-link]');

  const getBorderColor = () => {
    if (msg.isTask) return isTaskCompleted ? 'border-l-slate-300' : 'border-l-warning';
    if (msg.isPrivateMention || msg.isPrivateForward) return 'border-l-purple-400';
    return 'border-l-primary';
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
      if (tagPickerRef.current && !tagPickerRef.current.contains(e.target)) setTagPickerOpen(false);
    };
    if (menuOpen || tagPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [menuOpen, tagPickerOpen]);

  const playTaskSound = () => { try { const a = new Audio('https://firebasestorage.googleapis.com/v0/b/niltask.firebasestorage.app/o/sounds%2FBANNER.mp3?alt=media&token=b3463c11-1f70-4450-8efc-049e04f33a0a'); a.volume = 0.8; a.play().catch(()=>{}); } catch(_) {} };

  const logTaskAudit = async (action, previousState = "", newState = "") => {
    try { await addDoc(collection(db, "Audit_Logs"), { taskId: msg.id, groupId: msg.groupId, actor_email: userEmail, action, previous_state: previousState, new_state: newState, timestamp: serverTimestamp() }); } catch(_) {}
  };

  const notifyTaskChange = async (actionText, eventType = "critical", routineKey = "") => {
    const involved = new Set();
    if (msg.senderEmail) involved.add(msg.senderEmail);
    (msg.taskData?.assignees || []).forEach(a => involved.add(a));
    involved.delete(userEmail);
    const uidsToNotify = dbUsers.filter(u => involved.has(u.email)).map(u => u.uid);
    for (const uid of uidsToNotify) {
      try {
        if (eventType === "routine") {
          const bucket = Math.floor(Date.now() / (5 * 60 * 1000));
          const key = `taskbatch_${msg.id}_${userEmail}_${routineKey}_${bucket}`;
          const prev = Number(localStorage.getItem(key) || 0) + 1;
          localStorage.setItem(key, String(prev));
          if (prev % 3 !== 1) continue;
          await addDoc(collection(db, "notifications"), { userId: uid, type: "task", text: `${prev} ${routineKey} update(s) by ${(currentUserData?.name || (userEmail||"").split("@")[0])}`, messageId: msg.id, groupId: msg.groupId, timestamp: serverTimestamp(), isRead: false });
        } else {
          await addDoc(collection(db, "notifications"), { userId: uid, type: "task", text: `"${msg.text}" - ${actionText}`, messageId: msg.id, groupId: msg.groupId, timestamp: serverTimestamp(), isRead: false });
        }
      } catch (e) {}
    }
  };

  const handleAcknowledge = async (e) => {
    e.stopPropagation();
    if (!window.confirm('Acknowledge this task? This confirms you have seen and accepted it.')) return;
    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "messages", msg.id);
        const snap = await tx.get(ref);
        const data = snap.data() || {};
        const currentTrail = data.taskData?.trail || [];
        const now = new Date();
        const nextAckBy = { ...(data.taskData?.ackBy || {}), [userEmail]: true };
        tx.update(ref, {
          "taskData.ackBy": nextAckBy,
          "taskData.status": data.taskData?.status === 'Pending' ? 'In Progress' : (data.taskData?.status || 'In Progress'),
          "taskData.trail": [...currentTrail, {
            action: `${getUserName(userEmail)} acknowledged the task.`,
            by: userEmail,
            time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ', ' + now.toLocaleDateString()
          }]
        });
      });
      notifyTaskChange(`${getUserName(userEmail)} acknowledged the task.`);
      logTaskAudit("acknowledged", "unacknowledged", "acknowledged");
    } catch(e) { alert("Failed to acknowledge."); }
  };

  const handleInlineSaveTitle = async () => {
    if (!tempTitle.trim()) return setIsEditingTitle(false);
    try { await updateDoc(doc(db, "messages", msg.id), { text: tempTitle }); setIsEditingTitle(false); } catch(e) {}
  };

  const submitInlineUpdate = async () => {
    if (!inlineUpdateText.trim()) return setIsAddingUpdate(false);
    try {
        const now = new Date();
        const updatedTrail = [...(msg.taskData.trail || []), { action: "Update Added", by: userEmail, time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ', ' + now.toLocaleDateString(), comment: inlineUpdateText }];
        await updateDoc(doc(db, "messages", msg.id), { "taskData.trail": updatedTrail });
        notifyTaskChange(`${currentUserData?.name || (userEmail||"").split('@')[0]} updated the task.`, "routine", "text");
      logTaskAudit("task_update");
      
        setInlineUpdateText(""); setIsAddingUpdate(false);
    } catch(e) {}
  };

  const handleInlineEditTrail = async (idx) => {
    if (!trailEditText.trim()) return setEditingTrailIdx(null);
    try {
      const newTrail = [...msg.taskData.trail];
      newTrail[idx].comment = trailEditText;
      newTrail[idx].isEdited = true;
      await updateDoc(doc(db, "messages", msg.id), { "taskData.trail": newTrail });
      setEditingTrailIdx(null);
    } catch(e) {}
  };

  const handleInlineDeleteTrail = async (idx) => {
    if(!window.confirm("Delete this update from the task?")) return;
    try {
      const newTrail = msg.taskData.trail.filter((_, i) => i !== idx);
      await updateDoc(doc(db, "messages", msg.id), { "taskData.trail": newTrail });
    } catch(e) {}
  };

  const handleInlineComplete = async (e) => {
    e.stopPropagation();
    if (!isAssignee || isRevokedForMe) return alert("Only active assignees can submit completion.");
    try {
      const now = new Date();
      const newTrail = [...msg.taskData.trail, { action: `${getUserName(userEmail)} submitted completion for review to ${getUserName(masterReviewerEmail)}.`, by: userEmail, time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ', ' + now.toLocaleDateString(), to: getUserName(masterReviewerEmail) }];
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "messages", msg.id);
        const snap = await tx.get(ref);
        const data = snap.data() || {};
        const states = { ...(data.taskData?.assigneeStates || {}), [userEmail]: "submitted_completed" };
        tx.update(ref, { "taskData.assigneeStates": states, "taskData.status": "In Progress", "taskData.trail": [...(data.taskData?.trail || []), ...[newTrail[newTrail.length-1]]] });
      });
      notifyTaskChange(`${currentUserData?.name || (userEmail||"").split('@')[0]} submitted completion for review ✅`);
      logTaskAudit("submit_completed", "assigned", "submitted_completed");
      playTaskSound();
    } catch(e) {}
  };

  const handleInlineDelegateSubmit = async () => {
    if (delegateSelection.length === 0) return setIsDelegating(false);
    if (!delegateComment || delegateComment.trim().length < 6) return alert("Delegate comment must be at least 6 characters.");
    try {
      const now = new Date();
      const toNames = delegateSelection.map(getUserName).join(', ');
      const newTrail = [...(msg.taskData?.trail || []), { action: `${getUserName(userEmail)} delegated task support to ${toNames}.`, by: userEmail, time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ', ' + now.toLocaleDateString(), to: toNames, comment: delegateComment.trim() }];
      const oldAssignees = msg.taskData?.assignees || [];
      const nextAssignees = Array.from(new Set([...oldAssignees, ...delegateSelection]));
      const nextStates = { ...(msg.taskData?.assigneeStates || {}) };
      delegateSelection.forEach(e => { if (!nextStates[e] || ['revoked', 'transferred_out'].includes(nextStates[e])) nextStates[e] = 'assigned'; });
      await updateDoc(doc(db, "messages", msg.id), { "taskData.assignees": nextAssignees, "taskData.assigneeStates": nextStates, "taskData.status": "In Progress", "taskData.trail": newTrail });
      for (const em of delegateSelection) { const u = dbUsers.find(x => x.email === em); if (u) await addDoc(collection(db, "notifications"), { userId: u.uid, type: "task", text: `Delegated task assigned: "${msg.text}"`, messageId: msg.id, groupId: msg.groupId, timestamp: serverTimestamp(), isRead: false }).catch(()=>{}); }
      notifyTaskChange(`${getUserName(userEmail)} delegated task support to ${toNames}.`);
      logTaskAudit("worker_delegate");
      playTaskSound();
      setIsDelegating(false); setDelegateSelection([]); setDelegateComment(""); setDelegateSearch("");
    } catch(e) {}
  };

  const handleInlineFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setTrailFileUploading(true);
    try {
      const uniqueFileName = `${Date.now()}_${file.name}`;
      const uploadTask = uploadBytesResumable(ref(storage, `task_updates/${uniqueFileName}`), file);
      uploadTask.on('state_changed', (snap) => { setTrailUploadProgress((snap.bytesTransferred / (snap.totalBytes || 1)) * 100); }, () => { setTrailFileUploading(false); setTrailUploadProgress(0); }, async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        const now = new Date();
        const newTrail = [...msg.taskData.trail, { action: `${getUserName(userEmail)} uploaded file: ${file.name}.`, by: userEmail, time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ', ' + now.toLocaleDateString(), comment: "Attached file via system", fileUrl: downloadURL, fileName: file.name }];
        await updateDoc(doc(db, "messages", msg.id), { "taskData.trail": newTrail });
        notifyTaskChange(`${currentUserData?.name || (userEmail||"").split('@')[0]} attached a file 📎`);
      playTaskSound();
        setTrailFileUploading(false); setTrailUploadProgress(100);
      });
    } catch(err) { setTrailFileUploading(false); } finally { if(inlineFileInputRef.current) inlineFileInputRef.current.value = ""; }
  };

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

  const applyInlineUpdateFormat = (tag) => {
    const el = inlineUpdateRef.current;
    if (!el) return;
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const selected = inlineUpdateText.slice(start, end) || '';
    const wrapped = tag === 'emoji' ? `${selected} 🙂` : `<${tag}>${selected}</${tag}>`;
    setInlineUpdateText(`${inlineUpdateText.slice(0, start)}${wrapped}${inlineUpdateText.slice(end)}`);
    setTimeout(() => el.focus(), 0);
  };

  const handleReplyAttachmentUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || msg.isTask) return;
    setMsgReplyUploadProgress(1);
    try {
      let processedFile = file;
      let fileName = file.name;
      if (file.type.startsWith('image/')) {
        const blob = await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
            canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(resolve, 'image/webp', 0.78);
          };
          img.src = URL.createObjectURL(file);
        });
        fileName = file.name.replace(/\.[^/.]+$/, '.webp');
        processedFile = new File([blob], fileName, { type: 'image/webp' });
      }
      const uploadTask = uploadBytesResumable(ref(storage, `chat_uploads/${Date.now()}_${fileName}`), processedFile);
      uploadTask.on('state_changed', snap => setMsgReplyUploadProgress((snap.bytesTransferred / (snap.totalBytes || 1)) * 100), () => setMsgReplyUploadProgress(0), async () => {
        const fileUrl = await getDownloadURL(uploadTask.snapshot.ref);
        await addDoc(collection(db, 'messages'), { text: '', senderUid: currentUserData?.uid || msg.senderUid, senderEmail: userEmail, groupId: msg.groupId, fileUrl, fileName, fileType: processedFile.type, timestamp: serverTimestamp(), isTask: false, seenBy: [userEmail], reactions: {}, replyToId: msg.id, originalText: msg.text || msg.fileName || 'Attachment', originalSender: senderName });
        setMsgReplyUploadProgress(0);
      });
    } catch (_) { setMsgReplyUploadProgress(0); }
    finally { if (msgReplyFileInputRef.current) msgReplyFileInputRef.current.value = ''; }
  };

  const sendInlineReply = async () => {
    const text = inlineReplyRef.current?.innerHTML || inlineReplyText;
    if (!text.replace(/<[^>]*>/g, '').trim()) return;
    await addDoc(collection(db, 'messages'), { text, senderUid: currentUserData?.uid || userEmail, senderEmail: userEmail, groupId: msg.groupId, timestamp: serverTimestamp(), isTask: false, seenBy: [userEmail], reactions: {}, replyToId: msg.id, originalText: msg.text || msg.fileName || 'Attachment', originalSender: senderName });
    setInlineReplyText('');
    if (inlineReplyRef.current) inlineReplyRef.current.innerHTML = '';
    setInlineReplyOpen(false);
  };

  const applyReplyFormat = (cmd) => {
    inlineReplyRef.current?.focus();
    document.execCommand(cmd, false, null);
    setInlineReplyText(inlineReplyRef.current?.innerHTML || '');
  };

  // ── Modern review panel helpers ──
  const openReviewAction = (assigneeEmail, mode) => {
    setReviewStates(prev => ({
      ...prev,
      [assigneeEmail]: { mode, comment: '', transferTo: [], transferComment: '' }
    }));
  };

  const closeReviewAction = (assigneeEmail) => {
    setReviewStates(prev => {
      const next = { ...prev };
      delete next[assigneeEmail];
      return next;
    });
  };

  const updateReviewComment = (assigneeEmail, comment) => {
    setReviewStates(prev => ({
      ...prev,
      [assigneeEmail]: { ...prev[assigneeEmail], comment }
    }));
  };

  const updateTransferSelection = (assigneeEmail, email, selected) => {
    setReviewStates(prev => {
      const current = prev[assigneeEmail]?.transferTo || [];
      const nextList = selected ? [...current, email] : current.filter(e => e !== email);
      return { ...prev, [assigneeEmail]: { ...prev[assigneeEmail], transferTo: nextList } };
    });
  };

  const updateTransferComment = (assigneeEmail, comment) => {
    setReviewStates(prev => ({
      ...prev,
      [assigneeEmail]: { ...prev[assigneeEmail], transferComment: comment }
    }));
  };

  const handleMarkDoneSubmit = async (assigneeEmail) => {
    const state = reviewStates[assigneeEmail];
    if (!state || state.comment.trim().length < 6) return alert("Comment must be at least 6 characters.");
    try {
      const nextStates = { ...(msg.taskData?.assigneeStates || {}), [assigneeEmail]: "accepted_completed" };
      const now = new Date();
      const newTrail = [...(msg.taskData?.trail || []), { action: `${getUserName(userEmail)} marked ${getUserName(assigneeEmail)}'s work as completed.`, by: userEmail, time: now.toLocaleTimeString([], {hour: "2-digit", minute:"2-digit"}) + ", " + now.toLocaleDateString(), to: getUserName(assigneeEmail), comment: state.comment.trim() }];
      const nextStatus = activeAssignees.every(e => (e === assigneeEmail ? 'accepted_completed' : (nextStates[e] || 'assigned')) === 'accepted_completed') ? 'Completed' : 'In Progress';
      await updateDoc(doc(db, "messages", msg.id), { "taskData.assigneeStates": nextStates, "taskData.status": nextStatus, "taskData.trail": newTrail });
      const u = dbUsers.find(x => x.email === assigneeEmail); if (u) await addDoc(collection(db, "notifications"), { userId: u.uid, type: "task", text: `Completion accepted: "${msg.text}"`, messageId: msg.id, groupId: msg.groupId, timestamp: serverTimestamp(), isRead: false }).catch(()=>{});
      logTaskAudit("mark_done", "submitted_completed", "accepted_completed");
      closeReviewAction(assigneeEmail);
      playTaskSound();
    } catch(e) { alert("Failed to mark as done."); }
  };

  const handleReviewAgainSubmit = async (assigneeEmail) => {
    const state = reviewStates[assigneeEmail];
    if (!state || state.comment.trim().length < 6) return alert("Comment must be at least 6 characters.");
    try {
      const now = new Date();
      const newTrail = [...(msg.taskData?.trail || []), { action: `${getUserName(userEmail)} requested rework from ${getUserName(assigneeEmail)}.`, by: userEmail, time: now.toLocaleTimeString([], {hour: "2-digit", minute:"2-digit"}) + ", " + now.toLocaleDateString(), to: getUserName(assigneeEmail), comment: state.comment.trim() }];
      const nextStates = { ...(msg.taskData?.assigneeStates || {}), [assigneeEmail]: "needs_review" };
      await updateDoc(doc(db, "messages", msg.id), { "taskData.assigneeStates": nextStates, "taskData.status": "In Progress", "taskData.trail": newTrail });
      const u = dbUsers.find(x => x.email === assigneeEmail); if (u) await addDoc(collection(db, "notifications"), { userId: u.uid, type: "task", text: `Review again requested: "${msg.text}"`, messageId: msg.id, groupId: msg.groupId, timestamp: serverTimestamp(), isRead: false }).catch(()=>{});
      logTaskAudit("review_again", "submitted_completed", "needs_review");
      closeReviewAction(assigneeEmail);
      playTaskSound();
    } catch(e) { alert("Failed to request rework."); }
  };

  const handleTransferSubmit = async (assigneeEmail) => {
    const state = reviewStates[assigneeEmail];
    if (!state || !state.transferTo.length) return alert("Select at least one assignee to transfer.");
    if (state.transferComment.trim().length < 6) return alert("Transfer comment must be at least 6 characters.");
    try {
      const now = new Date();
      const nextStates = { ...(msg.taskData?.assigneeStates || {}) };
      nextStates[assigneeEmail] = 'transferred_out';
      state.transferTo.forEach(e => { nextStates[e] = 'transferred_in'; });
      const mergedAssignees = Array.from(new Set([...(msg.taskData?.assignees || []), ...state.transferTo]));
      const transferNames = state.transferTo.map(getUserName).join(', ');
      const newTrail = [...(msg.taskData?.trail || []), { action: `${getUserName(userEmail)} transferred task from ${getUserName(assigneeEmail)} to ${transferNames}.`, by: userEmail, time: now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) + ', ' + now.toLocaleDateString(), to: transferNames, comment: state.transferComment.trim() }];
      await updateDoc(doc(db, 'messages', msg.id), { 'taskData.assignees': mergedAssignees, 'taskData.assigneeStates': nextStates, 'taskData.status': 'In Progress', 'taskData.trail': newTrail });
      for (const em of [assigneeEmail, ...state.transferTo]) { const u = dbUsers.find(x => x.email === em); if (u) await addDoc(collection(db,'notifications'), { userId: u.uid, type: 'task', text: em===assigneeEmail ? `Task transferred from you: "${msg.text}"` : `Transferred task assigned: "${msg.text}"`, messageId: msg.id, groupId: msg.groupId, timestamp: serverTimestamp(), isRead: false }).catch(()=>{}); }
      closeReviewAction(assigneeEmail);
      playTaskSound();
    } catch(e) { alert("Transfer failed."); }
  };

  return (
    <div id={`msg-${msg.id}`} className={`w-full flex ${msg.isMine ? 'justify-end' : 'justify-start'} ${isThreadView ? 'mb-4' : 'msg-row-spacing'} transform-gpu group/msg ${isUnreadHighlight || isHighlighted || mentionsMe ? 'highlight-flash' : ''} ${menuOpen ? 'relative z-[120]' : 'relative z-[1]'}`}>
      
      <MemoizedAvatar uid={msg.senderUid || 'anon'} url={senderAvatar} name={senderName} sizeClass="w-8 h-8 shrink-0 mt-1" extraClasses={msg.isMine ? 'ml-3 order-last' : 'mr-3'} />
      <div className={`self-stretch flex items-center ${msg.isMine ? 'order-first mr-2' : 'order-last ml-2'}`}><span className={`text-[9px] font-black tracking-widest ${msg.isTask ? 'text-amber-600' : 'text-slate-400'}`} style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>{msg.isTask ? 'TASK' : 'MESSAGE'}</span></div>
      
      {/* Arrow indicators removed */}
      
      <div className={`${bubbleWidthClass} ${taskShellClass} min-w-0 bg-white ${msg.isTask ? 'rounded-2xl' : msg.isMine ? 'rounded-[40px] rounded-tr-md' : 'rounded-[40px] rounded-tl-md'} shadow-sm border-2 border-slate-100 ${getBorderColor()} border-l-4 px-4 py-3 relative break-words flex flex-col`}>
        
        <div className="flex-1 w-full">
            <div className="flex items-baseline mb-1 pr-10">
              <span className="text-xs font-semibold text-indigo-600">{senderName}</span>
            </div>
            
            <button onClick={(e) => { e.stopPropagation(); setMenuOpen(prev => !prev); }} className="absolute top-2 right-2 opacity-0 group-hover/msg:opacity-100 transition-opacity text-slate-400 hover:text-indigo-600 hover:bg-slate-100 p-1.5 w-6 h-6 rounded-full flex items-center justify-center">
              <i className="fa-solid fa-ellipsis-vertical text-[14px]"></i>
            </button>
            
            {menuOpen && (
              <div ref={menuRef} className="absolute top-8 right-2 z-[120] bg-white rounded-xl shadow-lg border-2 border-slate-300 py-2 w-48 animate-in fade-in slide-in-from-top-2" onClick={(e) => e.stopPropagation()}>
                {!msg.isTask && !isThreadView && <button onClick={() => { setMenuOpen(false); setInlineReplyOpen(true); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600"><i className="fa-solid fa-reply w-5"></i> Reply</button>}
                {!msg.isTask && <button onClick={() => { setMenuOpen(false); setSelectedMessage(msg); setActiveModal('task_convert'); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600"><i className="fa-regular fa-square-check w-5"></i> Convert to Task</button>}
                <button onClick={() => { setMenuOpen(false); setSelectedMessage(msg); setActiveModal('reminder'); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-600"><i className="fa-regular fa-clock w-5"></i> Set Reminder</button>
                <button onClick={() => { setMenuOpen(false); handleToggleBookmark(msg); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-purple-50 hover:text-purple-600"><i className={`fa-solid fa-bookmark w-5 ${isBookmarked ? 'text-indigo-600' : ''}`}></i> {isBookmarked ? 'Unbookmark' : 'Bookmark'}</button>
                {canPinItem && <button onClick={() => { setMenuOpen(false); handleTogglePin(msg); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-amber-50 hover:text-amber-600"><i className={`fa-solid fa-thumbtack w-5 ${msg.isPinned ? 'text-indigo-600' : ''}`}></i> {msg.isPinned ? 'Unpin' : 'Pin'}</button>}
                {canModify && toolPreferences?.delete && (!msg.isTask || taskSidebarMode) && <button onClick={() => { setMenuOpen(false); handleDeleteMessage(msg); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-500 hover:bg-rose-50"><i className="fa-solid fa-trash w-5"></i> Delete</button>}
              </div>
            )}
            
            {isEditingThis ? (
              <div className="flex flex-col gap-2 my-1" onClick={e => e.stopPropagation()}>
                <textarea value={editMessageText} onChange={(e) => setEditMessageText(e.target.value)} className="w-full text-sm p-2 rounded border border-indigo-500 outline-none resize-none focus:ring-2 focus:ring-indigo-500/20" rows="2"></textarea>
                <div className="flex justify-end gap-2"><button onClick={() => setEditingMessageId(null)} className="text-xs text-slate-500 font-semibold px-3 py-1 hover:bg-slate-100 rounded">Cancel</button><button onClick={() => handleSaveEdit(msg)} className="text-xs bg-indigo-600 text-white px-4 py-1 rounded font-semibold hover:bg-indigo-700">Save</button></div>
              </div>
            ) : (
              <>
                {msg.isTask && (
                  <div onClick={(e) => { if (msg.isTask && !taskSidebarMode) { e.stopPropagation(); setIsTaskExpanded(prev => !prev); } }} className={`mt-2 border rounded-xl overflow-hidden shadow-sm transition-all ${!taskSidebarMode ? 'cursor-pointer hover:ring-2 hover:ring-indigo-200' : ''} ${isTransferredOutForMe ? 'bg-[#800020]/5 border-[#800020]/30 opacity-75' : isRevokedForMe ? 'bg-rose-50 border-rose-200 opacity-70' : isSubmittedForReviewMe ? 'bg-amber-50 border-amber-200 opacity-80' : isAcceptedForMe ? 'bg-teal-50 border-teal-200 opacity-90' : isTaskCompleted ? 'bg-slate-50 border-slate-200 opacity-95' : 'bg-white border-slate-200 hover:shadow-md'}`}>
                    <div className="p-3">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${msg.taskData.priority === 'High' ? 'bg-rose-50 text-rose-700 border-rose-200' : msg.taskData.priority === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                            {msg.taskData.priority === 'High' ? '🔴' : msg.taskData.priority === 'Medium' ? '🟡' : '🟢'} {msg.taskData.priority || 'Medium'}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${statusBadgeClass}`}>{statusBadgeText === 'Completed' ? '🏁 ' : myAcked ? '✅ ' : '🟠 '}{statusBadgeText}</span>
                          {msg.taskData.escalated && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 uppercase">🚨 Escalated</span>
                          )}
                          {msg.taskData?.trail?.some(t => /delegat/i.test(t.action || '')) && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 uppercase">Delegated</span>
                          )}
                        </div>
                        <div className={`text-[11px] font-bold flex items-center gap-3 flex-wrap shrink-0 ${isTaskCompleted ? 'text-slate-400' : 'text-slate-500'}`}>
                          <span><i className="fa-regular fa-calendar-check mr-1"></i>Due {formatTaskDateTime(msg.taskData.deadline)}</span>
                          <span title="Visible only to the master reviewer and assigned workers"><i className="fa-solid fa-lock mr-1"></i>Concerned only</span>
                        </div>
                      </div>
                      
                      {isEditingTitle && canEditTask ? (
                        <div className="flex gap-2 mb-3" onClick={e=>e.stopPropagation()}>
                          <input value={tempTitle} onChange={e=>setTempTitle(e.target.value)} className="w-full text-sm font-medium border border-indigo-500 p-1.5 rounded outline-none" autoFocus onKeyDown={(e)=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); handleInlineSaveTitle(); } }} />
                          <button onClick={handleInlineSaveTitle} className="text-xs bg-indigo-600 text-white px-3 py-1 rounded font-semibold hover:bg-indigo-700">Save</button>
                          <button onClick={()=>{setIsEditingTitle(false); setTempTitle(msg.text);}} className="text-xs bg-slate-200 text-slate-700 px-3 py-1 rounded font-semibold hover:bg-slate-300">Cancel</button>
                        </div>
                      ) : (
                        <p className={`text-sm font-semibold mb-3 leading-snug relative group/title ${isTaskCompleted ? 'text-slate-500' : 'text-slate-800'}`}>
                          {msg.text}
                          {canEditTask && isTaskParticipant && <i className="fa-solid fa-pen text-slate-300 hover:text-indigo-600 cursor-pointer ml-2 opacity-0 group-hover/title:opacity-100 transition-opacity" onClick={(e)=>{e.stopPropagation(); setIsEditingTitle(true);}}></i>}
                        </p>
                      )}

                      {isAssignee && !isTaskCompleted && msg.taskData?.requireAck && !myAcked && (
                        <div className="mb-3">
                          <button onClick={handleAcknowledge} className="w-full px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-xs font-bold text-[#800000] hover:bg-yellow-100 transition-colors">
                            <i className="fa-solid fa-check mr-1"></i> Acknowledge Task
                          </button>
                          {msg.taskData.ackDeadline && (
                            <div className="text-[10px] text-[#800000] mt-1 text-center">
                              Acknowledge by {formatTaskDateTime(msg.taskData.ackDeadline)}
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center -space-x-2 relative group/assignees cursor-pointer" onClick={(e) => { e.stopPropagation(); setShowAssigneeChips(v => !v); }} title="Show assignees">
                          {(msg.taskData.assignees || []).slice(0, 3).map(email => {
                            const assignee = dbUsers?.find(u => u.email === email);
                            return <MemoizedAvatar key={email} uid={assignee?.uid || email} url={assignee?.profilePicUrl} name={assignee?.name || email.split('@')[0]} sizeClass="w-6 h-6" extraClasses={`border-2 ${isTaskCompleted ? 'border-slate-50 opacity-70' : 'border-white'} relative z-10`} />;
                          })}
                          {(msg.taskData.assignees || []).length > 3 && (
                            <div className={`w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600 border-2 ${isTaskCompleted ? 'border-slate-50' : 'border-white'} relative z-10`}>
                              +{msg.taskData.assignees.length - 3}
                            </div>
                          )}
                        </div>
                      </div>
                      {showAssigneeChips && (
                        <div className="mt-3 flex flex-wrap gap-2 transition-all duration-200">{(msg.taskData.assignees || []).map((email) => <span key={email} className="px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-[11px] font-bold text-indigo-700">{getUserName(email)}</span>)}</div>
                      )}
                    </div>

                    {canUseWorkerControls && (
                        <div className="bg-slate-50 border-t border-slate-200 p-2 flex flex-wrap gap-2 items-center justify-end">
                           <input type="file" ref={inlineFileInputRef} className="hidden" onChange={handleInlineFileUpload} />
                           {trailFileUploading && <div className="mr-2 min-w-[120px]"><div className="h-1.5 bg-slate-200 rounded"><div className="h-full bg-indigo-600 rounded" style={{ width: `${Math.round(trailUploadProgress)}%` }} /></div><span className="text-[10px] font-bold text-indigo-500">Uploading {Math.round(trailUploadProgress)}%</span></div>}
                           
                           {isDelegating ? (
                              <div className="bg-white border-2 border-slate-300 rounded-lg p-2 shadow-sm w-full space-y-2">
                                 <input value={delegateSearch} onChange={(e)=>setDelegateSearch(e.target.value)} placeholder="Search users to delegate..." className="w-full text-[11px] border rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none" />
                                 <div className="max-h-32 overflow-y-auto grid grid-cols-1 gap-1">
                                   {sortedGroupUsers.filter(u => u.email !== userEmail && (u.name || u.email || '').toLowerCase().includes(delegateSearch.toLowerCase())).map(u => (
                                     <label key={u.uid} className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5">
                                       <input type="checkbox" checked={delegateSelection.includes(u.email)} onChange={(e)=> setDelegateSelection(prev => e.target.checked ? [...new Set([...prev, u.email])] : prev.filter(x=>x!==u.email))} />
                                       <span>{u.name || u.email}</span>
                                     </label>
                                   ))}
                                 </div>
                                 <input value={delegateComment} onChange={(e)=>setDelegateComment(e.target.value)} placeholder="Delegate comment (min 6 chars) — Enter to save" className="w-full text-[11px] border rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none" onKeyDown={(e)=>{ if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); if(delegateSelection.length>0 && delegateComment.trim().length>=6) handleInlineDelegateSubmit(e); } }} />
                                 <div className="flex items-center justify-end gap-2">
                                   <button onClick={handleInlineDelegateSubmit} disabled={delegateSelection.length===0 || delegateComment.trim().length<6} className="text-xs bg-indigo-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-full font-bold hover:bg-indigo-700 hover:-translate-y-0.5 hover:shadow-md transition-all">Save</button>
                                   <button onClick={()=>{setIsDelegating(false); setDelegateSelection([]); setDelegateComment(''); setDelegateSearch('');}} className="text-xs text-slate-500 hover:text-rose-500 px-2 font-bold transition-colors">X</button>
                                 </div>
                              </div>
                           ) : isAddingUpdate ? (
                              <div className="bg-white border-2 border-slate-300 rounded-xl p-2 shadow-sm w-full space-y-2">
                                 <div className="flex gap-1 text-[10px] font-black text-slate-500">
                                   <button onClick={()=>applyInlineUpdateFormat('b')} className="px-2 py-1 rounded bg-slate-100">B</button><button onClick={()=>applyInlineUpdateFormat('i')} className="px-2 py-1 rounded bg-slate-100 italic">I</button><button onClick={()=>applyInlineUpdateFormat('u')} className="px-2 py-1 rounded bg-slate-100 underline">U</button><button onClick={()=>applyInlineUpdateFormat('emoji')} className="px-2 py-1 rounded bg-slate-100">🙂</button>
                                 </div>
                                 <textarea ref={inlineUpdateRef} rows={2} value={inlineUpdateText} onChange={e=>setInlineUpdateText(e.target.value)} placeholder="Type update — Enter posts, Shift+Enter adds new line" className="w-full text-[12px] p-1 outline-none font-medium text-slate-700 resize-none" autoFocus onKeyDown={(e)=>{ if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); submitInlineUpdate(); } }} />
                                 <div className="flex justify-end gap-2"><button onClick={submitInlineUpdate} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-full font-bold hover:bg-indigo-700 hover:-translate-y-0.5 hover:shadow-md transition-all">Post</button>
                                 <button onClick={()=>setIsAddingUpdate(false)} className="text-xs text-slate-500 hover:text-rose-500 px-2 font-bold transition-colors">Cancel</button></div>
                              </div>
                           ) : (
                              <>
                                 <button onClick={(e) => { e.stopPropagation(); setIsAddingUpdate(true); }} className="px-3 py-1.5 bg-white border-2 border-slate-300 rounded-full text-[11px] font-bold text-slate-600 shadow-sm hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 hover:-translate-y-0.5 hover:shadow-md transition-all">Update</button>
                                 <button onClick={(e) => { e.stopPropagation(); inlineFileInputRef.current.click(); }} className="px-3 py-1.5 bg-white border-2 border-slate-300 rounded-full text-[11px] font-bold text-slate-600 shadow-sm hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 hover:-translate-y-0.5 hover:shadow-md transition-all">Attach</button>
                                 <button onClick={(e) => { e.stopPropagation(); setIsDelegating(true); }} className="px-3 py-1.5 bg-white border-2 border-slate-300 rounded-full text-[11px] font-bold text-slate-600 shadow-sm hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 hover:-translate-y-0.5 hover:shadow-md transition-all">Delegate</button>
                                 <button 
                                   onClick={handleInlineComplete} 
                                   disabled={!hasCompletionEvidence}
                                   className={`px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full text-[11px] font-bold text-emerald-700 shadow-sm hover:bg-emerald-100 hover:-translate-y-0.5 hover:shadow-md transition-all ${!hasCompletionEvidence ? 'opacity-50 cursor-not-allowed' : ''}`}
                                   title={!hasCompletionEvidence ? 'Add an update, attachment, or delegation before completing' : ''}
                                 >
                                   {isAcceptedForMe ? "Completed ✅" : "Completed"}
                                 </button>
                              </>
                           )}
                        </div>
                    )}

                    {/* ── MODERN REVIEW SECTION ── */}
                    {isCreator && (msg.taskData?.assignees || []).filter(email => (assigneeStates[email] || 'assigned') === 'submitted_completed').map(assigneeEmail => {
                      const reviewState = reviewStates[assigneeEmail];
                      const mode = reviewState?.mode;
                      return (
                        <div key={assigneeEmail} className="bg-blue-50 border-t border-blue-200 p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                            <span className="font-semibold text-blue-700 text-sm">{getUserName(assigneeEmail)}</span>
                            <span className="text-xs text-slate-500">submitted completion</span>
                          </div>
                          
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); openReviewAction(assigneeEmail, 'markDone'); }}
                              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${mode === 'markDone' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}
                            >
                              <i className="fa-solid fa-check mr-1"></i>Mark Done
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); openReviewAction(assigneeEmail, 'reviewAgain'); }}
                              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${mode === 'reviewAgain' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white border-amber-200 text-amber-700 hover:bg-amber-50'}`}
                            >
                              <i className="fa-solid fa-rotate-left mr-1"></i>Review Again
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); openReviewAction(assigneeEmail, 'transfer'); }}
                              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${mode === 'transfer' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white border-rose-200 text-rose-700 hover:bg-rose-50'}`}
                            >
                              <i className="fa-solid fa-shuffle mr-1"></i>Transfer
                            </button>
                          </div>

                          {mode === 'markDone' && (
                            <div className="bg-white rounded-lg border p-3 space-y-2" onClick={e => e.stopPropagation()}>
                              <textarea
                                value={reviewState.comment}
                                onChange={e => updateReviewComment(assigneeEmail, e.target.value)}
                                placeholder="Completion comment (min 6 chars)..."
                                className="w-full text-xs p-2 border rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 outline-none resize-none"
                                rows={2}
                              />
                              <div className="flex justify-end gap-2">
                                <button onClick={() => closeReviewAction(assigneeEmail)} className="text-xs text-slate-500 font-bold px-2">Cancel</button>
                                <button
                                  onClick={() => handleMarkDoneSubmit(assigneeEmail)}
                                  disabled={reviewState.comment.trim().length < 6}
                                  className="text-xs bg-emerald-600 text-white px-4 py-1.5 rounded-full font-bold hover:bg-emerald-700 disabled:opacity-50"
                                >
                                  <i className="fa-solid fa-paper-plane mr-1"></i>Send & Mark Done
                                </button>
                              </div>
                            </div>
                          )}

                          {mode === 'reviewAgain' && (
                            <div className="bg-white rounded-lg border p-3 space-y-2" onClick={e => e.stopPropagation()}>
                              <textarea
                                value={reviewState.comment}
                                onChange={e => updateReviewComment(assigneeEmail, e.target.value)}
                                placeholder="Rework comment (min 6 chars)..."
                                className="w-full text-xs p-2 border rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 outline-none resize-none"
                                rows={2}
                              />
                              <div className="flex justify-end gap-2">
                                <button onClick={() => closeReviewAction(assigneeEmail)} className="text-xs text-slate-500 font-bold px-2">Cancel</button>
                                <button
                                  onClick={() => handleReviewAgainSubmit(assigneeEmail)}
                                  disabled={reviewState.comment.trim().length < 6}
                                  className="text-xs bg-amber-500 text-white px-4 py-1.5 rounded-full font-bold hover:bg-amber-600 disabled:opacity-50"
                                >
                                  <i className="fa-solid fa-save mr-1"></i>Save & Request Rework
                                </button>
                              </div>
                            </div>
                          )}

                          {mode === 'transfer' && (
                            <div className="bg-white rounded-lg border p-3 space-y-2" onClick={e => e.stopPropagation()}>
                              <label className="block text-xs font-bold text-slate-600">Transfer to</label>
                              <div className="max-h-32 overflow-y-auto border rounded-lg p-2 grid grid-cols-1 gap-1">
                                {sortedGroupUsers.filter(u => u.email !== assigneeEmail).map(u => (
                                  <label key={u.uid} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-slate-50 rounded px-2 py-1">
                                    <input
                                      type="checkbox"
                                      checked={reviewState.transferTo.includes(u.email)}
                                      onChange={(e) => updateTransferSelection(assigneeEmail, u.email, e.target.checked)}
                                      className="accent-rose-600"
                                    />
                                    {u.name || u.email}
                                  </label>
                                ))}
                              </div>
                              <textarea
                                value={reviewState.transferComment}
                                onChange={e => updateTransferComment(assigneeEmail, e.target.value)}
                                placeholder="Transfer comment (min 6 chars)..."
                                className="w-full text-xs p-2 border rounded-lg focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 outline-none resize-none"
                                rows={2}
                              />
                              <div className="flex justify-end gap-2">
                                <button onClick={() => closeReviewAction(assigneeEmail)} className="text-xs text-slate-500 font-bold px-2">Cancel</button>
                                <button
                                  onClick={() => handleTransferSubmit(assigneeEmail)}
                                  disabled={reviewState.transferTo.length === 0 || reviewState.transferComment.trim().length < 6}
                                  className="text-xs bg-rose-600 text-white px-4 py-1.5 rounded-full font-bold hover:bg-rose-700 disabled:opacity-50"
                                >
                                  <i className="fa-solid fa-shuffle mr-1"></i>Save & Transfer
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <button onClick={(e) => { e.stopPropagation(); setIsTaskExpanded(!isTaskExpanded); setIsAddingUpdate(false); setIsDelegating(false); }} className={`w-full border-t border-slate-200 py-2 text-xs font-bold transition-colors flex items-center justify-center gap-2 ${isTaskCompleted ? 'bg-slate-100 text-slate-400' : 'bg-slate-50 text-slate-500 hover:text-indigo-600'}`}>
                      <i className={`fa-solid fa-chevron-${isTaskExpanded ? 'up' : 'down'} text-[10px]`}></i>
                      {isTaskExpanded ? 'Hide Details' : `View Updates & Trail (${msg.taskData.trail?.length || 0})`}
                    </button>

                    {isTaskExpanded && (
                      <div className="bg-slate-50 border-t border-slate-200 p-3 animate-in slide-in-from-top-2">
                        <div className="space-y-3 mb-4 pr-2 scroll-smooth">
                          {(msg.taskData.trail || []).map((t, idx) => {
                            const tAuthor = dbUsers.find(u => u.email === t.by)?.name || 'System';
                            const isAuthor = t.by === userEmail || isSuperAdmin;
                            return (
                            <div key={idx} className="flex gap-3 text-sm group/trailitem relative before:absolute before:left-3 before:top-7 before:bottom-[-12px] before:border-l before:border-slate-300">
                              <div className="w-6 h-6 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center text-slate-400 shrink-0 mt-1">
                                <i className={`text-[10px] ${t.action.includes('Created') ? 'fa-solid fa-bolt text-amber-500' : t.action.includes('Completed') ? 'fa-solid fa-check text-teal-500' : t.action.includes('Delegated') ? 'fa-solid fa-share-nodes text-indigo-500' : t.fileUrl ? 'fa-solid fa-paperclip text-blue-500' : 'fa-solid fa-comment-dots text-indigo-500'}`}></i>
                              </div>
                              <div className="flex-1 min-w-0">
                                  <div className="bg-transparent p-1.5 rounded-lg relative group/editbox">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="font-bold text-[11px] text-indigo-600">{tAuthor}</span>
                                      <span className="text-[10px] font-bold text-slate-400">{t.time?.split(',')[0]}</span>
                                    </div>
                                    <div className="text-[13px] text-slate-600 leading-snug break-words">
                                      <span className="font-semibold">{formatTrailAction(t)}</span>
                                      {t.fileUrl && (
                                          <div className="mt-2 flex items-center gap-2 p-1.5 border-2 border-slate-300 rounded-md bg-slate-50 cursor-pointer hover:bg-slate-100 relative" onClick={() => window.open(t.fileUrl, '_blank')}>
                                             <i className="fa-solid fa-file text-indigo-500 text-lg"></i>
                                             <span className="text-xs font-bold text-slate-600 truncate">{maskUrl(t.fileName)}</span>
                                          </div>
                                      )}
                                    </div>
                                  </div>
                              </div>
                            </div>
                          )})}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!msg.isTask && msg.isPrivateMention && !msg.isPrivateForward && (
                  <div className="text-xs font-semibold flex items-center gap-1 mb-2 text-purple-700"><i className="fa-solid fa-lock"></i> PRIVATE</div>
                )}
                
                {!msg.isTask && msg.isPrivateForward && (
                  <div onClick={(e) => { e.stopPropagation(); jumpToPrivateSource(msg.originalMsgId, msg.originalGroupId); }} className="mt-1 mb-2 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-3 shadow-sm cursor-pointer hover:shadow-md transition-all group/forward relative">
                     <div className="flex items-center gap-2 mb-2">
                       <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 shrink-0"><i className="fa-solid fa-share-nodes text-[10px]"></i></div>
                       <span className="text-xs font-bold text-purple-700 leading-tight">Mentioned in {msg.forwardedFromGroupName}</span>
                     </div>
                     <p className="text-[13px] text-slate-700 font-medium italic border-l-[3px] border-purple-300 pl-3 ml-1 break-words">"{msg.text?.replace('[Forwarded Private Mention] ', '')}"</p>
                  </div>
                )}

                {!msg.isTask && !msg.isPrivateForward && mentionsMe && (
                  <div className="text-[10px] font-black text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 mb-1 w-fit">@ Mentioned You</div>
                )}
                {!msg.isTask && !msg.isPrivateForward && msg.text && (
                  <div className={`text-[14px] leading-snug break-words font-medium text-slate-800 ${msg.fileUrl ? 'mb-2' : ''}`} dangerouslySetInnerHTML={{ __html: msg.text }}></div>
                )}
                
                {!msg.isTask && !msg.isPrivateForward && msg.fileUrl && (
                  <div className="flex flex-col gap-1 my-1">
                    {msg.fileType?.startsWith('image/') ? (
                       <div className="relative group/img overflow-hidden rounded-xl border-2 border-slate-300 w-fit">
                          <img 
                            src={msg.fileUrl} 
                            alt="Shared" 
                            onContextMenu={isSecure ? e => e.preventDefault() : undefined} 
                            className="w-24 h-24 md:w-28 md:h-28 object-cover cursor-pointer hover:opacity-90 transition-opacity" 
                            onClick={(e) => { e.stopPropagation(); if(!isSecure) window.open(msg.fileUrl, '_blank'); }} 
                          />
                          {isSecure && (
                              <div className="absolute top-2 right-2 bg-slate-900/80 text-white text-[10px] px-2 py-1 rounded-md backdrop-blur-sm font-bold shadow-lg"><i className="fa-solid fa-lock"></i> Protected</div>
                          )}
                          {!isSecure && (
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                  <i className="fa-solid fa-expand text-white text-3xl drop-shadow-md"></i>
                              </div>
                          )}
                       </div>
                    ) : (
                       <div className={`flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 border-2 border-slate-300 w-fit max-w-[220px] shadow-sm ${!isSecure ? 'cursor-pointer hover:bg-slate-100' : 'cursor-default opacity-90'}`} onClick={(e) => { e.stopPropagation(); if(!isSecure) window.open(msg.fileUrl, '_blank'); }}>
                          <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-indigo-500 shadow-sm shrink-0"><i className="fa-solid fa-file-lines text-lg"></i></div>
                          <div className="flex-1 overflow-hidden min-w-0 flex flex-col">
                             <p className="text-sm font-bold text-slate-700 truncate">{maskUrl(displayFileName)}</p>
                             {isSecure && <span className="text-[9px] font-bold text-rose-500 uppercase tracking-widest mt-0.5"><i className="fa-solid fa-lock"></i> Download Restricted</span>}
                          </div>
                          {!isSecure && <i className="fa-solid fa-download text-slate-400 pr-1 hover:text-indigo-600 transition-colors"></i>}
                       </div>
                    )}
                  </div>
                )}
              </>
            )}
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-end justify-between gap-3 w-full">
            <div className="flex flex-wrap items-center gap-1.5 flex-1">
                {Object.entries(msg.reactions || {}).map(([tagLabel, users]) => {
                    const isEmoji = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u.test(tagLabel) || STANDARD_EMOJIS.includes(tagLabel);
                    const isMe = users.includes(userEmail);
                    const hoverNames = users.map(e => dbUsers?.find(u => u.email === e)?.name || e.split('@')[0]).join(', ');
                    const titleText = `${tagLabel} affixed by: ${hoverNames}`;
                    if (isEmoji) {
                        return (
                            <button key={tagLabel} title={titleText} onClick={(e) => { e.stopPropagation(); handleReaction(msg.id, tagLabel); }}
                                className={`flex items-center gap-1 px-2 py-1 rounded-lg border transition-colors shadow-sm ${isMe ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                            >
                                <span className="text-[13px]" style={{fontFamily: '"Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif'}}>{tagLabel}</span>
                                <span className={`text-[11px] font-bold ${isMe ? 'text-indigo-600' : 'text-slate-500'}`}>{users.length}</span>
                            </button>
                        )
                    }
                    const tagObj = (customTags || []).find(t => t.label === tagLabel) || { bgClass: 'bg-slate-100', textClass: 'text-slate-600' };
                    return (
                        <button key={tagLabel} title={titleText} onClick={(e) => { e.stopPropagation(); handleReaction(msg.id, tagLabel); }}
                            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-colors shadow-sm ${isMe ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                        >
                            <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold tracking-wide ${tagObj.bgClass} ${tagObj.textClass}`}>
                                {tagObj.label}
                            </span>
                            <span className={`text-[11px] font-bold pr-1 ${isMe ? 'text-indigo-600' : 'text-slate-500'}`}>{users.length}</span>
                        </button>
                    )
                })}
                
                {toolPreferences?.react !== false && !msg.isTask && (
                    <div className="relative" ref={tagPickerRef}>
                        <button onClick={(e) => { e.stopPropagation(); setTagPickerOpen(!tagPickerOpen); }}
                            className={`h-8 px-2 flex items-center justify-center rounded-lg border-2 border-slate-300 bg-white text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-colors shadow-sm ${hasReactions ? '' : 'opacity-0 group-hover/msg:opacity-100'}`}
                        >
                            <i className="fa-solid fa-plus text-[11px]"></i><span className="text-[10px] font-bold ml-[3px] mt-[1px]"><i className="fa-regular fa-face-smile"></i></span>
                        </button>
                        
                        {tagPickerOpen && (
                            <div className="absolute bottom-full left-0 mb-1 z-[130] bg-white rounded-xl shadow-xl border-2 border-slate-300 p-3 w-56 max-h-72 overflow-y-auto custom-sidebar-scroll animate-in fade-in zoom-in-95" onClick={e=>e.stopPropagation()}>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1"><i className="fa-solid fa-bolt mr-1"></i> Frequent</div>
                                <div className="flex flex-col gap-1.5 mb-3">
                                    {(toolPreferences?.quickTags || ['#Approved', '#Reviewing', '#ActionRequired', '#Noted']).map(tagLabel => {
                                        const tagObj = (customTags || []).find(t => t.label === tagLabel);
                                        if(!tagObj) return null;
                                        return (
                                            <button key={`freq-${tagLabel}`} onClick={() => { setTagPickerOpen(false); handleReaction(msg.id, tagLabel); }}
                                                className={`w-full text-left text-[11px] font-bold px-3 py-2 rounded-lg transition-colors ${tagObj.bgClass} ${tagObj.textClass} hover:opacity-80 border border-white hover:border-${tagObj.bgClass.replace('bg-', '')} shadow-sm`}
                                            >
                                                {tagObj.label}
                                            </button>
                                        )
                                    })}
                                </div>
                                <div className="h-px bg-slate-100 my-2"></div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1 mt-2"><i className="fa-solid fa-tags mr-1"></i> All Workflows</div>
                                <div className="flex flex-col gap-1.5 mb-3">
                                    {(customTags || []).map(tagObj => (
                                        <button key={`all-${tagObj.id}`} onClick={() => { setTagPickerOpen(false); handleReaction(msg.id, tagObj.label); }}
                                            className={`w-full text-left text-[11px] font-bold px-3 py-2 rounded-lg transition-colors ${tagObj.bgClass} ${tagObj.textClass} hover:opacity-80 border border-white hover:border-${tagObj.bgClass.replace('bg-', '')} shadow-sm`}
                                        >
                                            {tagObj.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="h-px bg-slate-100 my-2"></div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1 mt-2"><i className="fa-regular fa-face-smile mr-1"></i> Standard Emoji</div>
                                <div className="flex flex-wrap gap-1.5">
                                    {STANDARD_EMOJIS.map(emoji => (
                                        <button key={emoji} onClick={() => { setTagPickerOpen(false); handleReaction(msg.id, emoji); }} className="w-8 h-8 flex items-center justify-center text-[18px] hover:bg-slate-100 rounded-lg transition-transform hover:scale-110" style={{fontFamily: '"Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif'}}>
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="flex flex-col items-end gap-1.5 justify-end shrink-0">
                <div className="flex items-center gap-1.5">
                   <span className="text-[10px] font-semibold text-slate-400 mr-1">{msg.time}</span>
                   {msg.isEdited && <span className="text-[10px] text-slate-400 italic mr-1">(edited)</span>}
                   {msg.hasReminder && <i className="fa-regular fa-clock text-amber-500 text-[10px] mr-1"></i>}
                   {isBookmarked && <i className="fa-solid fa-bookmark text-indigo-600 text-[10px] mr-1"></i>}
                   
                   {msg.isMine && !msg.isTask && (
                       <span className="text-[11px] font-bold ml-1 tracking-wide">
                       {seenByOthers ? (
                           <span className="text-green-700">Seen</span>
                       ) : deliveredCount > 0 ? (
                           <span className="text-orange-600">Delivered</span>
                       ) : (
                           <span className="text-blue-800">Sent</span>
                       )}
                       </span>
                   )}
                </div>
                
                {!msg.isTask && !isThreadView && (
                    <div className="flex items-center gap-2 mt-1 flex-wrap justify-end">
                      <input type="file" ref={msgReplyFileInputRef} className="hidden" onChange={handleReplyAttachmentUpload} />
                      <button onClick={(e) => { e.stopPropagation(); setInlineReplyOpen(v => !v); }} className="px-3 py-1.5 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 font-extrabold text-[11px] rounded-full border-2 border-slate-300">Reply</button>
                      <button onClick={(e) => { e.stopPropagation(); msgReplyFileInputRef.current?.click(); }} className="px-3 py-1.5 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 font-extrabold text-[11px] rounded-full border-2 border-slate-300">Attach</button>
                      {replyCount > 0 && <button onClick={(e) => { e.stopPropagation(); onToggleThread?.(); }} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-[11px] rounded-lg transition-colors border border-indigo-200 shadow-sm w-fit group/threadbtn"><i className="fa-solid fa-comments group-hover/threadbtn:scale-110 transition-transform"></i> {threadExpanded ? 'Hide' : 'Show'} {replyCount} Replies</button>}
                      {msgReplyUploadProgress > 0 && <span className="text-[10px] font-bold text-indigo-500">Uploading {Math.round(msgReplyUploadProgress)}%</span>}
                    {inlineReplyOpen && (
                      <div className="w-full mt-2 rounded-xl border border-slate-200 bg-white p-2 text-left">
                        {replyFormatOpen && <div className="flex gap-1 mb-1"><button onMouseDown={(e)=>{e.preventDefault(); applyReplyFormat('bold');}} className="px-2 py-1 text-[10px] font-black bg-slate-100 rounded">B</button><button onMouseDown={(e)=>{e.preventDefault(); applyReplyFormat('italic');}} className="px-2 py-1 text-[10px] italic bg-slate-100 rounded">I</button><button onMouseDown={(e)=>{e.preventDefault(); applyReplyFormat('underline');}} className="px-2 py-1 text-[10px] underline bg-slate-100 rounded">U</button><button onMouseDown={(e)=>{e.preventDefault(); document.execCommand('insertText', false, '🙂');}} className="px-2 py-1 text-[10px] bg-slate-100 rounded">🙂</button></div>}
                        <div ref={inlineReplyRef} contentEditable onMouseUp={()=>setReplyFormatOpen(!!window.getSelection()?.toString())} onKeyUp={()=>setReplyFormatOpen(!!window.getSelection()?.toString())} onInput={()=>setInlineReplyText(inlineReplyRef.current?.innerHTML || '')} onKeyDown={(e)=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); sendInlineReply(); } }} className="min-h-[38px] max-h-40 overflow-y-auto resize-y outline-none text-[13px] text-slate-700 whitespace-pre-wrap break-words leading-relaxed" data-placeholder="Reply inline..." suppressContentEditableWarning />
                        <div className="flex justify-end gap-2 mt-1"><button onClick={()=>setInlineReplyOpen(false)} className="text-[11px] font-bold text-slate-400">Cancel</button><button onClick={sendInlineReply} className="min-w-[58px] h-8 px-3 rounded-lg text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700">Send</button></div>
                      </div>
                    )}
                    </div>
                )}
            </div>
        </div>

        {/* Thread replies inside the bubble */}
        {!msg.isTask && threadExpanded && threadReplies.length > 0 && (
          <div className="mt-3 pt-2 border-t border-slate-200">
            <div className="space-y-2">
              {threadReplies.map((reply) => {
                const replyUser = dbUsers?.find(u => u.email === reply.senderEmail) || {};
                const replyName = replyUser.name || (reply.senderEmail || '').split('@')[0];
                return (
                  <div key={reply.id} className="flex gap-2 text-sm relative">
                    <div className="w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center text-indigo-500 shrink-0 mt-0.5">
                      <i className="fa-solid fa-reply text-[8px]"></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[11px] text-indigo-600">{replyName} <span className="text-[10px] text-slate-400 font-semibold ml-1">{reply.time}</span></div>
                      <div className="text-[13px] text-slate-700 break-words" dangerouslySetInnerHTML={{ __html: reply.text || '' }}></div>
                      {reply.fileUrl && reply.fileName && (
                        <div className="inline-flex items-center gap-1 mt-1 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-600 cursor-pointer hover:bg-slate-100" onClick={(e) => { e.stopPropagation(); window.open(reply.fileUrl, '_blank'); }}>
                          <i className="fa-solid fa-paperclip text-indigo-500 text-[10px]"></i>
                          <span className="truncate max-w-[120px]">{reply.fileName}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default MessageBubble;
