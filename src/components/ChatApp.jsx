import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

// UI Components
import RightSidebar from './Sidebar/RightSidebar.jsx';
import AdminPanel from './Admin/AdminPanel.jsx';
import LeftSidebar from './Sidebar/LeftSidebar.jsx';
import UploadOverlay from './Common/UploadOverlay.jsx';
import Toast from './Common/Toast.jsx';
import MemoizedAvatar from './Common/MemoizedAvatar.jsx';
import ChatView from './Chat/ChatView.jsx';
import InputArea from './Chat/InputArea.jsx';
import ModalManager from './Modals/ModalManager.jsx';

// Custom Enterprise Hooks
import useWorkspaceData from '../hooks/useWorkspaceData.js';
import useChatEngine from '../hooks/useChatEngine.js';

// Utils & Firebase Core
import { lockExtension } from '../utils/helpers.js';
import { auth, db, storage, signOut } from '../firebase.js';
import { collection, addDoc, doc, updateDoc, setDoc, getDocs, query, where, serverTimestamp, ref, uploadBytesResumable, getDownloadURL, deleteDoc } from '../firebase.js';

export default function ChatApp({ user, onLogout }) {
    // ==================== UI STATE ====================
    const [activeModal, setActiveModal] = useState(null);
    const [showRightSidebar, setShowRightSidebar] = useState(true);
    const [viewMode, setViewMode] = useState("chat");
    const [showFilterMenu, setShowFilterMenu] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [isAtBottom, setIsAtBottom] = useState(true);
    const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(true);
    const MAX_FILE_SIZE_MB = 10;
    const [inputText, setInputText] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [sidebarSearch, setSidebarSearch] = useState("");
    const [chatFilter, setChatFilter] = useState("all");
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [replyingTo, setReplyingTo] = useState(null);
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [editMessageText, setEditMessageText] = useState("");
    const [activeGroup, setActiveGroup] = useState(null);
    
    // Task Modals specific states
    const [taskAssignees, setTaskAssignees] = useState([]);
    const [taskDeadline, setTaskDeadline] = useState("");
    const [taskPriority, setTaskPriority] = useState("Medium");
    const [delegateAssignees, setDelegateAssignees] = useState([]);
    const [showDelegateDropdown, setShowDelegateDropdown] = useState(false);
    const [trailComment, setTrailComment] = useState("");
    const [reminderDateTime, setReminderDateTime] = useState("");
    const [isEditingTaskTitle, setIsEditingTaskTitle] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState("");
    
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [pendingFiles, setPendingFiles] = useState([]);
    const [showFileRename, setShowFileRename] = useState(false);
    const [trailFileUploading, setTrailFileUploading] = useState(false);
    const [profileUploadProgress, setProfileUploadProgress] = useState(0);
    const [groupPicUploadProgress, setGroupPicUploadProgress] = useState(0);
    
    const [adminForm, setAdminForm] = useState({ uid: '', name: '', email: '', isAdmin: false, canCreateGroups: false });
    const [profileForm, setProfileForm] = useState({ name: "", fontSize: "text-[14.2px]", fontFamily: "font-sans" });
    const [groupForm, setGroupForm] = useState({ name: "", members: [], admins: [], profilePicUrl: null });
    const [editingGroup, setEditingGroup] = useState(null);
    const [adminFilterUser, setAdminFilterUser] = useState("");
    const [adminFilterDate, setAdminFilterDate] = useState("");
    const [adminFilterType, setAdminFilterType] = useState("");
    const [adminFilterGroup, setAdminFilterGroup] = useState("");

    const [toasts, setToasts] = useState([]);
    const addToast = useCallback((message, type = 'message') => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);
    const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));
    
    const messagesEndRef = useRef(null);
    const chatContainerRef = useRef(null);
    const chatInputRef = useRef(null);
    const fileInputRef = useRef(null);
    const trailFileInputRef = useRef(null);
    const profilePicInputRef = useRef(null);
    const groupPicInputRef = useRef(null);
    const emojiPickerRef = useRef(null);
    const lastTypingTime = useRef(0);
    const highlightTimerRef = useRef(null);
    const lastMessageTrackerId = useRef(null);

    const [pendingScrollTarget, setPendingScrollTarget] = useState(null);
    const [currentTip, setCurrentTip] = useState("Type '@' to instantly mention peers.");
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
    const [highlightedMsgId, setHighlightedMsgId] = useState(null);
    const [unreadHighlightIds, setUnreadHighlightIds] = useState([]);
    const [scheduleDateTime, setScheduleDateTime] = useState("");
    const [pendingScheduledText, setPendingScheduledText] = useState("");
    const [activeReminderAlert, setActiveReminderAlert] = useState(null); 

    const { 
        isVipAdmin, currentUserData, dbUsers, groups, customTags, // 👈 TAGS IMPORTED
        activeReminders, genericNotifications, allAdminReminders, 
        immutableAuditLogs, toolPreferences, setToolPreferences 
    } = useWorkspaceData(user, profileForm, setProfileForm);

    const {
        messages, typingStatus, isOnline, offlineDrafts,
        logImmutableAction, triggerTypingEvent, sendMessageToDB, reactToMessageDB,
        deleteMessageDB, editMessageDB, togglePinDB, toggleBookmarkDB,
        uploadAndSendFileDB, scheduleMessageDB, saveOfflineDraft, deleteOfflineDraft
    } = useChatEngine({ 
        user, activeGroup, dbUsers, groups, toolPreferences, isWorkspaceLoading, addToast 
    });

    const playMelody = useCallback((type) => {
        try {
            const incomingSound = 'https://firebasestorage.googleapis.com/v0/b/niltask.firebasestorage.app/o/sounds%2FINCOMING-MESSAGE-TASK-CREATE-UPDATE.mp3?alt=media&token=413e00ca-6dc0-41e1-85d9-3d02e53ca526';
            const outgoingSound = 'https://firebasestorage.googleapis.com/v0/b/niltask.firebasestorage.app/o/sounds%2FOUTGOING-MESSAGE-TASK-CREATE-UPDATE.mp3?alt=media&token=4f357d75-c496-4f53-8f6a-fd0e6e81b41d';
            let soundUrl = outgoingSound; 
            switch (type) {
                case 'messageReceived':
                case 'taskCreated':
                case 'taskUpdated':
                case 'taskFileUpload':
                    soundUrl = incomingSound; break;
                default: soundUrl = outgoingSound; break;
            }
            const audio = new Audio(soundUrl);
            audio.volume = 1.0;
            const playPromise = audio.play();
            if (playPromise !== undefined) playPromise.catch(err => console.warn("Audio blocked:", err));
        } catch(e) {}
    }, []);

    useEffect(() => {
        if (messages.length > 0) {
            const latestMsg = messages[messages.length - 1];
            if (lastMessageTrackerId.current !== null && latestMsg.id !== lastMessageTrackerId.current) {
                if (latestMsg.senderUid !== user.uid && !latestMsg.isTask) playMelody('messageReceived');
            }
            lastMessageTrackerId.current = latestMsg.id;
        }
    }, [messages, user.uid, playMelody]);

    useEffect(() => {
        const timer = setTimeout(() => setIsWorkspaceLoading(false), 4000);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (isWorkspaceLoading || !groups.length || activeGroup) return;
        const savedGroupId = currentUserData?.lastActiveGroupId;
        if (savedGroupId) {
            const g = groups.find(gr => gr.id === savedGroupId && gr.members?.includes(user.email));
            if (g) setActiveGroup(g);
        }
    }, [isWorkspaceLoading, groups, currentUserData?.lastActiveGroupId, user.email, activeGroup]);

    useEffect(() => {
        if (!activeGroup?.id || !user.uid) return;
        updateDoc(doc(db, "users", user.uid), { lastActiveGroupId: activeGroup.id }).catch(() => {});
        setTimeout(() => {
            if (chatContainerRef.current) {
                chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
                setIsAtBottom(true);
            }
        }, 300);
    }, [activeGroup?.id, user.uid]);

    useEffect(() => {
        if (!activeGroup?.id || !user.email) return;
        const unread = messages.filter(m => m.groupId === activeGroup.id && !m.isMine && !(m.seenBy || []).includes(user.email)).map(m => m.id);
        if (unread.length > 0) {
            setUnreadHighlightIds(unread);
            const timer = setTimeout(() => setUnreadHighlightIds([]), 4000);
            return () => clearTimeout(timer);
        }
        setUnreadHighlightIds([]);
    }, [activeGroup?.id, user.email, messages]);

    useEffect(() => {
        const checkerInterval = setInterval(async () => {
            const now = new Date();
            const dueTasks = messages.filter(m => m.isTask && m.taskData?.status !== "Completed" && !m.taskData?.deadlineAlerted && m.taskData?.deadline && new Date(m.taskData.deadline) <= now);
            dueTasks.forEach(async (task) => {
                await updateDoc(doc(db, "messages", task.id), { "taskData.deadlineAlerted": true });
                const involved = new Set();
                if (task.senderEmail) involved.add(task.senderEmail);
                (task.taskData.assignees || []).forEach(a => involved.add(a));
                involved.forEach(email => {
                    const u = dbUsers.find(u => u.email === email);
                    if (u) addDoc(collection(db, "notifications"), { userId: u.uid, type: "task", text: `⏰ DUE NOW: "${task.text}"`, messageId: task.id, groupId: task.groupId, timestamp: serverTimestamp(), isRead: false }).catch(()=>{});
                });
            });

            const dueReminders = (activeReminders || []).filter(r => !r.isTriggered && r.remindAt && new Date(r.remindAt) <= now);
            for (const rem of dueReminders) {
                try {
                    await updateDoc(doc(db, "reminders", rem.id), { isTriggered: true });
                    await addDoc(collection(db, "notifications"), { userId: user.uid, type: "reminder", text: `⏰ REMINDER: "${rem.messageText}"`, messageId: rem.messageId, timestamp: serverTimestamp(), isRead: false });
                    playMelody('taskCreated'); 
                    setActiveReminderAlert(rem); 
                } catch(e) {}
            }

            try {
                const q = query(collection(db, "scheduled_messages"), where("senderUid", "==", user.uid), where("status", "==", "pending"));
                const snap = await getDocs(q);
                for (const document of snap.docs) {
                    const data = document.data();
                    if (new Date(data.scheduledFor) <= now) {
                        const payload = {
                            text: data.text,
                            groupId: data.groupId,
                            sender: currentUserData?.name || user.email.split('@')[0],
                            senderEmail: user.email,
                            senderUid: user.uid,
                            timestamp: serverTimestamp(),
                            dateString: new Date().toISOString().split('T')[0],
                            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            isTask: data.isTask || false,
                            taskData: data.taskData || null,
                            seenBy: [user.email]
                        };
                        await addDoc(collection(db, "messages"), payload);
                        await updateDoc(doc(db, "scheduled_messages", document.id), { status: "sent" });
                        playMelody('messageSent'); 
                    }
                }
            } catch(e) { console.error(e); }

        }, 15000); 
        return () => clearInterval(checkerInterval);
    }, [messages, dbUsers, activeReminders, user.uid, user.email, currentUserData, playMelody, addToast]);

    const myGroups = useMemo(() => {
        let filtered = groups.filter(g => g.members?.includes(user.email) && !g.isArchived);
        if (sidebarSearch) filtered = filtered.filter(g => g.name.toLowerCase().includes(sidebarSearch.toLowerCase()));
        return filtered;
    }, [groups, user.email, sidebarSearch]);

    const dmUsers = useMemo(() => {
        return dbUsers.filter(u => u.uid !== user.uid && (!sidebarSearch || u.name.toLowerCase().includes(sidebarSearch.toLowerCase())));
    }, [dbUsers, user.uid, sidebarSearch]);

    const activeActionableTasks = useMemo(() => {
        return messages.filter(m => m.isTask && m.taskData?.status !== "Completed" && m.taskData?.assignees?.includes(user.email) && !(m.taskData?.dismissedBy || []).includes(user.uid) && !m.taskData?.isArchived);
    }, [messages, user.email, user.uid]);
    
    const totalNotifications = genericNotifications.length + activeActionableTasks.length;

    const pinnedMessages = useMemo(() => activeGroup ? messages.filter(m => m.groupId === activeGroup.id && m.isPinned) : [], [messages, activeGroup]);

    const messagesToRender = useMemo(() => {
        if(!activeGroup) return [];
        let filtered = messages.filter(m => m.groupId === activeGroup.id && (!m.isPrivateMention || m.allowedUsers?.includes(user.email)));
        
        // 👇 UPDATED SEARCH ENGINE: Now explicitly searches for Tags / Hashtags inside reactions
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(m => 
                (m.text || '').toLowerCase().includes(q) || 
                (m.fileName || '').toLowerCase().includes(q) || 
                (m.sender || '').toLowerCase().includes(q) ||
                Object.keys(m.reactions || {}).some(tag => tag.toLowerCase().includes(q))
            );
        }

        if (chatFilter === 'tasks-pending') filtered = filtered.filter(m => m.isTask && m.taskData?.status !== "Completed");
        else if (chatFilter === 'tasks-completed') filtered = filtered.filter(m => m.isTask && m.taskData?.status === "Completed");
        else if (chatFilter === 'messages') filtered = filtered.filter(m => !m.isTask);
        else if (chatFilter === 'today') filtered = filtered.filter(m => m.dateString === new Date().toISOString().split('T')[0]);
        else if (chatFilter === 'bookmarked') filtered = filtered.filter(m => m.bookmarkedBy?.includes(user.email));
        return filtered;
    }, [messages, activeGroup, user.email, chatFilter, searchQuery]);

    const tasksAssignedToMe = useMemo(() => messages.filter(m => m.isTask && m.taskData?.assignees?.includes(user.email) && !m.taskData?.isArchived).sort((a,b) => new Date(a.taskData.deadline).getTime() - new Date(b.taskData.deadline).getTime()), [messages, user.email]);
    const tasksAssignedByMe = useMemo(() => messages.filter(m => m.isTask && m.senderEmail === user.email && !m.taskData?.isArchived).sort((a,b) => new Date(a.taskData.deadline).getTime() - new Date(b.taskData.deadline).getTime()), [messages, user.email]);
    const archivedTasks = useMemo(() => messages.filter(m => m.isTask && m.taskData?.isArchived && (m.senderEmail === user.email || m.taskData?.assignees?.includes(user.email))).sort((a,b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0)), [messages, user.email]);

    const filteredAuditLogs = useMemo(() => {
        let logs = immutableAuditLogs;
        if (adminFilterUser) logs = logs.filter(l => l.user === adminFilterUser);
        if (adminFilterDate) logs = logs.filter(l => l.dateString === adminFilterDate);
        if (adminFilterType) {
            if (adminFilterType === 'task-all') logs = logs.filter(l => l.type.startsWith("TASK_"));
            else if (adminFilterType === 'task-pending') logs = logs.filter(l => l.type === "TASK_CREATE" || l.type === "TASK_DELEGATE");
            else if (adminFilterType === 'task-completed') logs = logs.filter(l => l.type === "TASK_COMPLETE");
            else logs = logs.filter(l => l.type === adminFilterType);
        }
        if (adminFilterGroup) logs = logs.filter(l => l.groupId === adminFilterGroup);
        return logs;
    }, [immutableAuditLogs, adminFilterUser, adminFilterDate, adminFilterType, adminFilterGroup]);

    const triggerHighlight = useCallback((msgId) => {
        setHighlightedMsgId(msgId);
        if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = setTimeout(() => { setHighlightedMsgId(null); }, 4000);
    }, []);

    const scrollToMessageDirect = useCallback((msgId) => {
        const el = document.getElementById(`msg-${msgId}`);
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); triggerHighlight(msgId); }
    }, [triggerHighlight]);

    const navigateToMessageFromNotification = useCallback(async (msgId, targetGroupId) => {
        setChatFilter('all');
        setSearchQuery('');
        let targetGroup = groups.find(g => g.id === targetGroupId);
        if (!targetGroup && targetGroupId) {
            const otherUid = targetGroupId.split('_').find(id => id !== user.uid);
            if (otherUid) {
                const otherUser = dbUsers.find(u => u.uid === otherUid);
                if (otherUser) {
                    targetGroup = { id: targetGroupId, isDM: true, name: otherUser.name, members: [user.email, otherUser.email], profilePicUrl: otherUser.profilePicUrl };
                }
            }
        }

        if (targetGroup) {
            setActiveGroup(targetGroup);
            setShowRightSidebar(false);
            setMobileSidebarOpen(false);
            setShowNotifications(false);
            setActiveModal(null);
            setTimeout(() => { setPendingScrollTarget(msgId); }, 50);
        }
    }, [groups, dbUsers, user.uid, user.email]);

    const handleSendOfflineAware = async () => {
        if (!inputText.trim() || !activeGroup) return;
        if (!isOnline) {
            await saveOfflineDraft(inputText.trim(), activeGroup.id, activeGroup.name);
            setInputText(""); alert("📥 You are offline. Message saved as draft and will be sent when you reconnect."); return;
        }
        await handleSendMessage();
    };

    const handleTypingEvent = useCallback(() => {
        const now = Date.now();
        if (now - lastTypingTime.current > 1500) {
            lastTypingTime.current = now;
            triggerTypingEvent(currentUserData?.name);
        }
    }, [triggerTypingEvent, currentUserData?.name]);

    const handleSendMessage = async () => {
        if (!inputText.trim() || !activeGroup) return;
        await sendMessageToDB(inputText.trim(), replyingTo);
        playMelody('messageSent'); 
        setInputText(""); setEmojiPickerOpen(false); setReplyingTo(null);
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
            setIsAtBottom(true);
        }
    };

    const handleSaveEdit = async (msg) => {
        if (!editMessageText.trim()) return setEditingMessageId(null);
        await editMessageDB(msg.id, msg.text, editMessageText);
        setEditingMessageId(null);
    };

    const handleSendPendingFiles = async () => {
        if (pendingFiles.length === 0) return;
        const currentText = inputText.trim();
        const filesToProcess = [...pendingFiles];
        setPendingFiles([]); setShowFileRename(false); setIsUploading(true); setUploadProgress(0); setInputText(""); 
        for (let i = 0; i < filesToProcess.length; i++) {
            let pf = filesToProcess[i];
            let finalCaption = pf.caption || "";
            if (i === 0 && currentText) finalCaption = finalCaption ? `${currentText}\n${finalCaption}` : currentText;
            pf.caption = finalCaption; pf.text = finalCaption; 
            try { await uploadAndSendFileDB(pf, setUploadProgress); } catch (error) { alert(`Upload failed: ${error.message}`); }
        }
        playMelody('fileUpload');
        setIsUploading(false); setUploadProgress(0);
    };

    const handleFileUpload = (e) => {
        const files = Array.from(e.target.files).slice(0, 3);
        if (files.length === 0) return;
        e.target.value = '';
        const currentInput = inputText.trim();
        const newPending = files.map((file, index) => ({ id: Date.now() + Math.random(), file, customName: file.name, caption: index === 0 ? currentInput : '' }));
        setPendingFiles(prev => [...prev, ...newPending].slice(0, 3));
        setShowFileRename(true);
        if (currentInput) setInputText('');
    };

    const handlePaste = (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let index in items) {
            const item = items[index];
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                const blob = item.getAsFile();
                if (blob) {
                    const pastedName = `pasted_image_${Date.now()}.png`;
                    const currentInput = inputText.trim();
                    setPendingFiles(prev => [...prev, { id: Date.now() + Math.random(), file: blob, customName: pastedName, caption: currentInput }].slice(0, 3));
                    setShowFileRename(true);
                    if (currentInput) setInputText('');
                }
            }
        }
    };

    const handleScheduleMessage = async (isTask = false, taskData = null) => {
        const text = pendingScheduledText || inputText.trim();
        if (!text || !scheduleDateTime || !activeGroup) return alert("Enter message text and a future date/time.");
        if (new Date(scheduleDateTime) <= new Date()) return alert("Scheduled time must be in the future.");
        try {
            await scheduleMessageDB(text, scheduleDateTime, isTask, taskData);
            setInputText(""); setPendingScheduledText(""); setScheduleDateTime(""); setActiveModal(null);
            addToast(`✅ Scheduled for ${new Date(scheduleDateTime).toLocaleString()}`, 'success');
        } catch(e) { alert("Failed to schedule."); }
    };

    const notifyInvolvedInTask = async (taskMsg, actionText) => {
        const involved = new Set();
        if (taskMsg.senderEmail) involved.add(taskMsg.senderEmail);
        (taskMsg.taskData?.assignees || []).forEach(a => involved.add(a));
        (taskMsg.taskData?.trail || []).forEach(t => { if (t.by) involved.add(t.by); });
        involved.delete(user.email);
        const uidsToNotify = dbUsers.filter(u => involved.has(u.email)).map(u => u.uid);
        for (const uid of uidsToNotify) {
            try { await addDoc(collection(db, "notifications"), { userId: uid, type: "task", text: `"${taskMsg.text}" - ${(user.email || "").split('@')[0]} updated ✅`, messageId: taskMsg.id, groupId: taskMsg.groupId, timestamp: serverTimestamp(), isRead: false }); } catch (e) {}
        }
    };

    const convertToTask = async () => {
        if (!selectedMessage || !taskDeadline || taskAssignees.length === 0) return alert("Please select Assignees, Priority, and Deadline.");
        try {
            const now = new Date();
            await setDoc(doc(db, "messages", selectedMessage.id), {
                isTask: true,
                taskData: {
                    deadline: taskDeadline, assignees: taskAssignees, priority: taskPriority, status: "Pending", isArchived: false, dismissedBy: [],
                    trail: [{ action: "Task Created", by: user.email, time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ', ' + now.toLocaleDateString(), to: taskAssignees.map(a=>(a||"").split('@')[0]).join(', ') }]
                }
            }, { merge: true });

            taskAssignees.forEach(email => {
                if (email !== user.email) {
                    const assigneeUser = dbUsers.find(u => u.email === email);
                    if (assigneeUser) {
                        addDoc(collection(db, "notifications"), { userId: assigneeUser.uid, type: "task", text: `"${selectedMessage.text}" - Assigned to You 🕒`, messageId: selectedMessage.id, groupId: selectedMessage.groupId, timestamp: serverTimestamp(), isRead: false }).catch(() => {});
                    }
                }
            });

            logImmutableAction("TASK_CREATE", `Converted to Task: "${selectedMessage.text}"`, `Assignees: ${taskAssignees.join(', ')} | Priority: ${taskPriority}`);
            playMelody('taskCreated'); 
            setActiveModal(null); setTaskAssignees([]);
        } catch (error) { alert("Failed to create task."); }
    };

    const handleSaveTaskTitle = async () => {
        if (!newTaskTitle.trim() || !selectedMessage) return;
        try {
            await updateDoc(doc(db, "messages", selectedMessage.id), { text: newTaskTitle });
            setSelectedMessage(prev => ({...prev, text: newTaskTitle}));
            playMelody('taskUpdated');
            setIsEditingTaskTitle(false);
        } catch (e) { alert("Failed to update task title."); }
    };

    const handleDelegateTask = async () => {
        if (!selectedMessage || delegateAssignees.length === 0) return;
        try {
            const now = new Date();
            const updatedTrail = [...selectedMessage.taskData.trail, { action: "Delegated", by: user.email, time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ', ' + now.toLocaleDateString(), to: delegateAssignees.map(a=>(a||"").split('@')[0]).join(', ') }];
            await updateDoc(doc(db, "messages", selectedMessage.id), { "taskData.assignees": delegateAssignees, "taskData.status": "In Progress", "taskData.trail": updatedTrail, "taskData.dismissedBy": [] });
            playMelody('taskUpdated'); 
            setActiveModal(null); setDelegateAssignees([]); setShowDelegateDropdown(false);
        } catch (error) {}
    };

    const handleCompleteTask = async () => {
        if (!selectedMessage) return;
        try {
            const now = new Date();
            const updatedTrail = [...selectedMessage.taskData.trail, { action: "Marked Completed", by: user.email, time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ', ' + now.toLocaleDateString(), to: "System" }];
            await updateDoc(doc(db, "messages", selectedMessage.id), { "taskData.status": "Completed", "taskData.trail": updatedTrail });
            playMelody('taskUpdated'); 
            setActiveModal(null);
        } catch (error) {}
    };

    const handleArchiveTask = async () => {
        if (!selectedMessage) return;
        try {
            await updateDoc(doc(db, "messages", selectedMessage.id), { "taskData.isArchived": true });
            playMelody('taskUpdated'); 
            setActiveModal(null);
        } catch (error) {}
    };

    const handleAddComment = async (closeModal = false) => {
        if (!selectedMessage || !trailComment.trim()) return;
        try {
            const now = new Date();
            const updatedTrail = [...selectedMessage.taskData.trail, { action: "Update Added", by: user.email, time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ', ' + now.toLocaleDateString(), comment: trailComment }];
            const newStatus = selectedMessage.taskData.status === 'Pending' ? 'In Progress' : selectedMessage.taskData.status;
            await updateDoc(doc(db, "messages", selectedMessage.id), { "taskData.trail": updatedTrail, "taskData.status": newStatus });
            setTrailComment("");
            setSelectedMessage(prev => ({...prev, taskData: {...prev.taskData, trail: updatedTrail, status: newStatus}}));
            playMelody('taskUpdated'); 
            if (closeModal) setActiveModal(null);
        } catch (error) {}
    };

    const handleTrailFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !selectedMessage) return;
        setTrailFileUploading(true);
        const uniqueFileName = `${Date.now()}_${file.name}`;
        const uploadTask = uploadBytesResumable(ref(storage, `task_updates/${uniqueFileName}`), file);
        uploadTask.on('state_changed', null, () => { setTrailFileUploading(false); alert("Upload failed."); }, async () => {
            try {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                const now = new Date();
                const updatedTrail = [...selectedMessage.taskData.trail, { action: "File Uploaded", by: user.email, time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ', ' + now.toLocaleDateString(), comment: "Attached file via system", fileUrl: downloadURL, fileName: file.name }];
                const newStatus = selectedMessage.taskData.status === 'Pending' ? 'In Progress' : selectedMessage.taskData.status;
                await updateDoc(doc(db, "messages", selectedMessage.id), { "taskData.trail": updatedTrail, "taskData.status": newStatus });
                setSelectedMessage(prev => ({...prev, taskData: {...prev.taskData, trail: updatedTrail, status: newStatus}}));
                playMelody('taskFileUpload'); 
            } catch(e) {} finally { setTrailFileUploading(false); if(trailFileInputRef.current) trailFileInputRef.current.value = ""; }
        });
    };

    const setReminder = async () => {
        if (!selectedMessage || !reminderDateTime) return;
        try {
            await addDoc(collection(db, "reminders"), { userId: user.uid, userEmail: user.email, messageId: selectedMessage.id, messageText: selectedMessage.text || selectedMessage.fileName || "File Attachment", remindAt: reminderDateTime, isTriggered: false });
            await updateDoc(doc(db, "messages", selectedMessage.id), { hasReminder: true });
            setActiveModal(null); setReminderDateTime("");
            addToast("Reminder set successfully!", "success");
        } catch (error) { alert("Failed to save reminder."); }
    };

    const handleEditUserSubmit = async (e) => {
        e.preventDefault();
        await updateDoc(doc(db, "users", adminForm.uid), { name: adminForm.name, isAdmin: adminForm.isAdmin, canCreateGroups: adminForm.canCreateGroups });
        setActiveModal(null);
    };

    const handleAddInlineComment = async (targetMsg, commentText) => {
        if (!targetMsg || !commentText.trim()) return;
        try {
            const now = new Date();
            const updatedTrail = [...targetMsg.taskData.trail, { action: "Update Added", by: user.email, time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ', ' + now.toLocaleDateString(), comment: commentText }];
            const newStatus = targetMsg.taskData.status === 'Pending' ? 'In Progress' : targetMsg.taskData.status;
            await updateDoc(doc(db, "messages", targetMsg.id), { "taskData.trail": updatedTrail, "taskData.status": newStatus });
            await notifyInvolvedInTask(targetMsg, `${(user.email||"").split('@')[0]} updated a task.`);
            playMelody('taskUpdated'); 
        } catch (error) {}
    };

    const handleWipeAllTasks = async () => {
        if (!window.confirm("🚨 WARNING: This will permanently delete ALL tasks across all groups. Proceed?")) return;
        try {
            const q = query(collection(db, "messages"), where("isTask", "==", true));
            const snapshot = await getDocs(q);
            if (snapshot.empty) return alert("No tasks found! You are already clean.");
            await Promise.all(snapshot.docs.map(document => deleteDoc(doc(db, "messages", document.id))));
            alert(`🧹 Successfully wiped ${snapshot.docs.length} tasks! Clean slate ready.`);
        } catch (error) { alert("Failed to clean database."); }
    };

    const handleGroupPicUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setGroupPicUploadProgress(10);
        const uniqueFileName = `group_${Date.now()}_${file.name}`;
        const uploadTask = uploadBytesResumable(ref(storage, `group_avatars/${uniqueFileName}`), file);
        uploadTask.on('state_changed', (snapshot) => setGroupPicUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100), (error) => { setGroupPicUploadProgress(0); alert("Upload failed."); }, async () => {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            setGroupForm(prev => ({...prev, profilePicUrl: url}));
            setGroupPicUploadProgress(0);
        });
    };

    const handleUpdateGroupMembers = async (e) => {
        e.preventDefault();
        try {
            const finalMembers = [...new Set([...groupForm.members, ...(activeGroup?.admins || [])])];
            await updateDoc(doc(db, "groups", activeGroup.id), { members: finalMembers });
            setActiveModal(null); 
            setActiveGroup(prev => ({...prev, members: finalMembers}));
        } catch (error) { 
            alert("Failed to update members."); 
        }
    };
    
    const handleGroupSubmit = async (e) => {
        if(e && e.preventDefault) e.preventDefault();
        if(!groupForm.name.trim()) return;
        try {
            const finalMembers = [...new Set([...groupForm.members, user.email])];
            const groupData = { name: groupForm.name, members: finalMembers, profilePicUrl: groupForm.profilePicUrl };
            if (editingGroup) await updateDoc(doc(db, "groups", editingGroup.id), groupData);
            else await addDoc(collection(db, "groups"), { ...groupData, admins: [user.email], createdBy: user.email, createdAt: serverTimestamp(), isArchived: false });
            setActiveModal(null); setEditingGroup(null); setGroupForm({name: "", members: [], admins: [], profilePicUrl: null});
        } catch (error) { alert("Failed to save group."); }
    };

    const onGroupUpdate = useCallback(async (updates) => {
        if (!activeGroup || !activeGroup.id) return;
        setActiveModal(null);
        if (updates.profilePicFile) {
            const file = updates.profilePicFile;
            const uniqueFileName = `group_${Date.now()}_${file.name}`;
            const uploadTask = uploadBytesResumable(ref(storage, `group_avatars/${uniqueFileName}`), file);
            uploadTask.on('state_changed', null, null, async () => {
                const url = await getDownloadURL(uploadTask.snapshot.ref);
                await updateDoc(doc(db, "groups", activeGroup.id), { profilePicUrl: url });
                setActiveGroup(prev => ({ ...prev, profilePicUrl: url }));
            });
            return;
        }
        const cleanUpdates = {};
        if (updates.name) cleanUpdates.name = updates.name;
        if (updates.members) { cleanUpdates.members = updates.members; cleanUpdates.admins = updates.admins || activeGroup.admins.filter(a => updates.members.includes(a)); }
        if (Object.keys(cleanUpdates).length === 0) return;
        setActiveGroup(prev => ({ ...prev, ...cleanUpdates }));
        await updateDoc(doc(db, "groups", activeGroup.id), cleanUpdates);
    }, [activeGroup, storage, db, setActiveModal]);

    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        const file = profilePicInputRef.current?.files[0];
        try {
            let updateData = { name: profileForm.name, fontSize: profileForm.fontSize, fontFamily: profileForm.fontFamily, toolPreferences };
            if (file) {
                setProfileUploadProgress(10);
                const uniqueFileName = `${user.uid}_${Date.now()}_avatar`;
                const uploadTask = uploadBytesResumable(ref(storage, `avatars/${uniqueFileName}`), file);
                await new Promise((resolve, reject) => {
                    uploadTask.on('state_changed', (snapshot) => setProfileUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100), reject, async () => {
                        updateData.profilePicUrl = await getDownloadURL(uploadTask.snapshot.ref);
                        resolve();
                    });
                });
            }
            await updateDoc(doc(db, "users", user.uid), updateData);
            setActiveModal(null); setProfileUploadProgress(0);
        } catch (error) { alert("Profile update failed."); setProfileUploadProgress(0); }
    };

    const getUnreadInfoForUser = useCallback((otherUserEmail, otherUserUid) => {
        const dmIdList = [user.uid, otherUserUid].sort();
        const dmIdStr = dmIdList.join('_');
        const dmMessages = messages.filter(m => m.groupId === dmIdStr);
        const unreadMsgs = dmMessages.filter(m => m.senderUid !== user.uid && !(m.seenBy || []).includes(user.email));
        const pendingTasks = dmMessages.filter(m => m.isTask && m.taskData?.status !== "Completed" && m.taskData?.assignees?.includes(user.email) && !(m.taskData?.dismissedBy || []).includes(user.uid) && m.senderEmail === otherUserEmail && !m.taskData?.isArchived);
        return { unreadCount: unreadMsgs.length, pendingTaskCount: pendingTasks.length, total: unreadMsgs.length + pendingTasks.length };
    }, [messages, user.uid, user.email]);

    const getUnreadInfoForGroup = useCallback((groupId) => {
        const groupMsgs = messages.filter(m => m.groupId === groupId);
        const visibleMsgs = groupMsgs.filter(m => !m.isPrivateMention || m.allowedUsers?.includes(user.email));
        const unreadMsgs = visibleMsgs.filter(m => m.senderUid !== user.uid && !(m.seenBy || []).includes(user.email));
        const pendingTasks = visibleMsgs.filter(m => m.isTask && m.taskData?.status !== "Completed" && m.taskData?.assignees?.includes(user.email) && !(m.taskData?.dismissedBy || []).includes(user.uid) && !m.taskData?.isArchived);
        return { unreadCount: unreadMsgs.length, pendingTaskCount: pendingTasks.length, total: unreadMsgs.length + pendingTasks.length };
    }, [messages, user.uid, user.email]);

    const modalProps = {
        activeModal, setActiveModal, selectedMessage, setSelectedMessage,
        setReplyingTo, chatInputRef, currentUserData, profileForm,
        setProfileForm, profilePicInputRef, profileUploadProgress,
        setProfileUploadProgress, handleProfileSubmit, toolPreferences,
        setToolPreferences, user, groupForm, setGroupForm, editingGroup,
        handleGroupSubmit, groupPicInputRef, handleGroupPicUpload,
        groupPicUploadProgress, dbUsers, activeGroup, isVipAdmin, customTags, // 👈 TAGS PASSED TO PROFILE MODAL
        handleUpdateGroupMembers, onGroupUpdate, isEditingTaskTitle,
        setIsEditingTaskTitle, newTaskTitle, setNewTaskTitle, handleSaveTaskTitle,
        delegateAssignees, setDelegateAssignees, showDelegateDropdown,
        setShowDelegateDropdown, convertToTask, taskAssignees, setTaskAssignees,
        taskDeadline, setTaskDeadline, taskPriority, setTaskPriority,
        reminderDateTime, setReminderDateTime, scheduleDateTime, setScheduleDateTime,
        pendingScheduledText, handleScheduleMessage, adminForm, setAdminForm,
        isUploading, uploadProgress, setReminder,
        handleDelegateTask, handleCompleteTask, handleArchiveTask,
        trailFileInputRef, handleTrailFileUpload, handleAddComment,
        messages, groups, trailComment, setTrailComment, activeReminders, 
        readOnly: viewMode === "admin",
    };

    if (currentUserData && currentUserData.isApproved !== true && !currentUserData.isAdmin && !isVipAdmin) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50 p-4 text-slate-800">
                <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 border-t-8 border-indigo-600 text-center transform-gpu hover:scale-105 transition-transform">
                    <i className="fa-solid fa-user-clock text-5xl text-indigo-600 mb-4 animate-pulse"></i>
                    <h1 className="text-2xl font-bold mb-2">Pending Approval</h1>
                    <p className="text-sm text-slate-500 mb-6">Your Google Account requires Admin verification to join the portal.</p>
                    <button onClick={onLogout} className="bg-slate-100 text-slate-700 py-2 px-6 rounded-full font-bold shadow-sm hover:bg-slate-200 transition-colors">Sign Out</button>
                </div>
            </div>
        );
    }

    if (isWorkspaceLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-screen w-full bg-slate-50 fixed inset-0 z-50">
          <div className="relative mb-8">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 animate-pulse flex items-center justify-center shadow-2xl">
              <i className="fa-solid fa-list-check text-4xl text-white drop-shadow-lg"></i>
            </div>
            <div className="absolute -inset-3 border-4 border-indigo-500/20 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-3 tracking-tight">Talk & Task</h2>
          <div className="w-56 h-2 bg-slate-200 rounded-full overflow-hidden mb-6">
            <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-teal-500 animate-loading-bar rounded-full"></div>
          </div>
          <div className="text-slate-500 text-sm font-medium italic">{currentTip}</div>
        </div>
      );
    }
    
    return (
        <div className="flex h-screen w-full bg-slate-50 text-slate-800 overflow-hidden relative font-sans transition-opacity duration-700 ease-out opacity-100">
            
            {activeReminderAlert && (
                <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-white rounded-3xl shadow-2xl z-[100] border border-indigo-100 p-6 animate-in slide-in-from-top-10 duration-700">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center shadow-inner relative">
                            <span className="absolute inset-0 rounded-full bg-indigo-400 opacity-20 animate-ping"></span>
                            <i className="fa-solid fa-bell text-xl relative z-10 animate-bounce"></i>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 leading-tight">Reminder</h3>
                            <span className="text-xs font-bold text-indigo-500 uppercase tracking-widest">Time's Up!</span>
                        </div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-inner mb-6">
                        <p className="text-slate-700 font-medium text-sm">"{activeReminderAlert.messageText}"</p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => { setActiveModal('reminder'); setReminderDateTime(''); setActiveReminderAlert(null); }} className="flex-1 bg-white border border-slate-200 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-50 shadow-sm transition-all">Snooze</button>
                        <button onClick={() => setActiveReminderAlert(null)} className="flex-1 bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 shadow-[0_4px_15px_rgba(79,70,229,0.4)] hover:-translate-y-0.5 transition-all">OK</button>
                    </div>
                </div>
            )}

            {viewMode === "admin" ? (
           <AdminPanel
              setViewMode={setViewMode} setActiveModal={setActiveModal} dbUsers={dbUsers} groups={groups} filteredAuditLogs={filteredAuditLogs}
              adminFilterUser={adminFilterUser} setAdminFilterUser={setAdminFilterUser} adminFilterDate={adminFilterDate} setAdminFilterDate={setAdminFilterDate}
              adminFilterType={adminFilterType} setAdminFilterType={setAdminFilterType} adminFilterGroup={adminFilterGroup} setAdminFilterGroup={setAdminFilterGroup}
              handleToggleApprove={(u) => updateDoc(doc(db, "users", u.uid), { isApproved: !u.isApproved })} 
              handleToggleAdmin={async (u) => { await updateDoc(doc(db, "users", u.uid), { isAdmin: !u.isAdmin }); }}
              handleToggleCanCreateGroups={async (u) => { await updateDoc(doc(db, "users", u.uid), { canCreateGroups: !u.canCreateGroups }); }}
              setSelectedMessage={setSelectedMessage} setIsEditingTaskTitle={setIsEditingTaskTitle} messages={messages}
              setGroupForm={setGroupForm} setEditingGroup={setEditingGroup} groupForm={groupForm} editingGroup={editingGroup} handleGroupSubmit={handleGroupSubmit}
              handleAdminArchiveGroup={(id, name) => updateDoc(doc(db, "groups", id), { isArchived: true })}
              handleAdminRecoverGroup={(id, name) => updateDoc(doc(db, "groups", id), { isArchived: false })}
              handleGroupPicUpload={handleGroupPicUpload} groupPicUploadProgress={groupPicUploadProgress}
              playMelody={playMelody} customTags={customTags} // 👈 TAGS PASSED TO ADMIN PANEL
            />
            ) : (
                <div className="flex h-full w-full relative">
                    <LeftSidebar 
                        user={user} currentUserData={currentUserData} myGroups={myGroups} dmUsers={dmUsers} activeGroup={activeGroup} setActiveGroup={setActiveGroup}
                        setShowRightSidebar={setShowRightSidebar} setMobileSidebarOpen={setMobileSidebarOpen} getUnreadInfoForUser={getUnreadInfoForUser}
                        getUnreadInfoForGroup={getUnreadInfoForGroup} messages={messages} onLogout={onLogout} setActiveModal={setActiveModal} setGroupForm={setGroupForm} setEditingGroup={setEditingGroup}
                        sidebarSearch={sidebarSearch} setSidebarSearch={setSidebarSearch} mobileSidebarOpen={mobileSidebarOpen} isVipAdmin={isVipAdmin} setViewMode={setViewMode}
                    />
                    
                    {!activeGroup ? (
                        <div className="flex-1 flex flex-col items-center justify-center bg-slate-100 text-center p-8 relative">
                            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm mb-6 text-indigo-500 ring-4 ring-white border border-slate-100">
                                <i className="fa-solid fa-comments text-4xl"></i>
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 mb-2">Welcome to Talk & Task</h2>
                            <p className="text-slate-500 mb-8 max-w-md">Select a department or direct message from the sidebar to start collaborating, or create a new workspace.</p>
                            {(currentUserData?.isAdmin || isVipAdmin || currentUserData?.canCreateGroups) && (
                                <button onClick={() => { setGroupForm({name: "", members: [], admins: [], profilePicUrl: null}); setEditingGroup(null); setActiveModal('group_form_modal'); }} className="w-full max-w-xs bg-indigo-600 text-white px-6 py-3.5 rounded-xl font-bold shadow-sm hover:bg-indigo-700 transition-all">
                                    <i className="fa-solid fa-layer-group mr-2"></i> Create Department
                                </button>
                            )}                            
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col relative h-full bg-slate-50 overflow-hidden min-w-0">
                            <div className="h-[59px] bg-white flex items-center justify-between px-3 md:px-4 shrink-0 z-30 sticky top-0 border-b border-slate-200 safe-top">
                                <button onClick={() => setMobileSidebarOpen(true)} className="md:hidden w-10 h-10 rounded-full hover:bg-indigo-50 flex items-center justify-center text-indigo-600 mr-1 shrink-0"><i className="fa-solid fa-bars text-xl"></i></button>
                                
                                <div className="flex items-center gap-3 cursor-pointer flex-1 min-w-0" onClick={()=>{ if(!activeGroup.isDM) setActiveModal('group_settings'); }}>
                                    {activeGroup.isDM ? <MemoizedAvatar uid={activeGroup.id} url={null} name={activeGroup.name} sizeClass="w-10 h-10" /> : activeGroup.profilePicUrl ? <MemoizedAvatar uid={activeGroup.id} url={activeGroup.profilePicUrl} name={activeGroup.name} sizeClass="w-10 h-10" /> : <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm"><i className="fa-solid fa-users"></i></div>}
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <span className={`text-[16px] font-bold leading-tight truncate text-slate-800`}>{activeGroup.name}</span>
                                        <span className="text-[13px] text-indigo-500 truncate max-w-[150px] lg:max-w-[400px]">
                                            {activeGroup.isDM ? 'End-to-Server Encrypted' :
                                                (dbUsers.filter(u => activeGroup.members?.includes(u.email) && u.lastActive && (Date.now() - (u.lastActive?.toMillis?.() || 0) < 900000) && u.uid !== user.uid).length > 0)
                                                ? dbUsers.filter(u => activeGroup.members?.includes(u.email) && u.lastActive && (Date.now() - (u.lastActive?.toMillis?.() || 0) < 900000) && u.uid !== user.uid).map(u=>u.name.split(' ')[0]).join(', ') + ' (Online)'
                                                : `${activeGroup.members?.length||0} Members`
                                            }
                                        </span>
                                    </div>
                                </div>

                                <div className="hidden md:flex flex-1 max-w-md mx-4">
                                    <div className="bg-slate-50 rounded-full flex items-center px-4 py-1.5 shadow-inner border border-slate-200 focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-500 transition-all w-full">
                                        <i className="fa-solid fa-search text-[14px] text-indigo-400 mr-2"></i>
                                        <input type="text" placeholder="Search messages..." className="bg-transparent outline-none flex-1 text-[13px] text-slate-800 placeholder-slate-400" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                                        {searchQuery && <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600 ml-1"><i className="fa-solid fa-xmark text-xs"></i></button>}
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-1 shrink-0 relative">
                                  <button onClick={() => setShowFilterMenu(!showFilterMenu)} className="w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-colors text-indigo-500 hover:bg-indigo-50" title="Filter Messages"><i className="fa-solid fa-sliders"></i></button>
                                  {showFilterMenu && (
                                    <div className="absolute top-[55px] right-24 bg-white rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in py-2 w-48 border border-slate-200">
                                      {['all','tasks-pending','tasks-completed','messages','today','bookmarked'].map(f => (
                                        <div key={f} onClick={() => { setChatFilter(f); setShowFilterMenu(false); }} className={`px-4 py-2.5 text-[14px] cursor-pointer transition-colors flex items-center gap-3 ${chatFilter === f ? 'bg-indigo-50 text-indigo-600 font-semibold' : 'text-slate-700 hover:bg-slate-50'}`}>
                                          {f === 'bookmarked' ? 'BookMark' : f === 'all' ? 'All Content' : f.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  <button onClick={() => setActiveModal('active_schedules')} className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-colors text-indigo-500 hover:bg-indigo-50`} title="Scheduled & Reminders">
                                    <i className="fa-solid fa-calendar-alt"></i>
                                  </button>

                                  <div className="relative">
                                    <button onClick={() => setShowNotifications(!showNotifications)} className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-colors ${showNotifications ? 'bg-indigo-50 text-indigo-600' : 'text-indigo-500 hover:bg-indigo-50'} text-[19px] relative`}>
                                      <i className="fa-solid fa-bell"></i>
                                      {totalNotifications > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border border-white"></span>}
                                    </button>

                                    {showNotifications && (
                                      <div className="absolute top-full right-0 mt-2 w-80 max-w-[90vw] bg-white rounded-2xl shadow-2xl z-50 overflow-hidden animate-in slide-in-from-top-2 border border-slate-200">
                                        <div className="p-3.5 bg-slate-50 flex justify-between items-center border-b border-slate-200">
                                          <span className="text-[14px] font-bold text-slate-800 uppercase tracking-wide">Activity Feed</span>
                                          <button onClick={() => genericNotifications.map(n => updateDoc(doc(db, "notifications", n.id), { isRead: true }))} className="text-[11px] text-indigo-600 font-bold hover:underline">Clear All</button>
                                        </div>
                                        <div className="max-h-[70vh] overflow-y-auto bg-slate-50/50 p-2.5">
                                          {totalNotifications === 0 ? <div className="p-8 text-center text-[13px] font-medium text-slate-400">No new activity</div> : (
                                            <div className="flex flex-col gap-1.5">
                                              {activeActionableTasks.length > 0 && (
                                                <div className="mb-2">
                                                  <div className="px-2 pb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Action Required</div>
                                                  <div className="space-y-2">
                                                    {[...activeActionableTasks].sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0)).map(task => {
                                                        const timeStr = task.timestamp?.toDate ? new Date(task.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                                                        return (
                                                          <div key={task.id} onClick={() => navigateToMessageFromNotification(task.id, task.groupId)} className="bg-white p-3.5 rounded-xl border border-rose-100 shadow-sm cursor-pointer hover:border-rose-300 transition-all relative">
                                                            <div className="text-[12px] font-bold text-rose-600 mb-1.5 flex items-center justify-between"><span className="flex items-center"><i className="fa-regular fa-square-check mr-1.5"></i>Pending Task</span><span className="text-[10px] text-slate-400 font-semibold">{timeStr}</span></div>
                                                            <div className="text-[13px] text-slate-800 line-clamp-2 leading-snug font-medium">"{task.text}"</div>
                                                            <div className="text-[11px] text-rose-500 font-bold mt-1.5">Assigned to You <i className="fa-regular fa-clock ml-0.5"></i></div>
                                                          </div>
                                                        );
                                                    })}
                                                  </div>
                                                </div>
                                              )}
                                              {genericNotifications.length > 0 && (
                                                <div>
                                                  {activeActionableTasks.length > 0 && <div className="border-t border-slate-200 my-3 mx-2"></div>}
                                                  <div className="px-2 pb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Recent Updates</div>
                                                  <div className="space-y-2">
                                                    {/* SORTED LATEST AT TOP */}
                                                    {[...genericNotifications].sort((a,b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0)).map(n => {
                                                      const timeStr = n.timestamp?.toDate ? new Date(n.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now';
                                                      return (
                                                        <div key={n.id} onClick={() => { if (n.messageId) navigateToMessageFromNotification(n.messageId, n.groupId || activeGroup?.id); }} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-indigo-300 transition-all flex items-start gap-3 relative pr-8">
                                                          
                                                          <button onClick={(e) => { e.stopPropagation(); deleteDoc(doc(db, "notifications", n.id)); }} className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors">
                                                            <i className="fa-solid fa-xmark text-[11px]"></i>
                                                          </button>

                                                          <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 shrink-0 mt-0.5"><i className={n.type === 'reply' ? 'fa-solid fa-reply text-xs' : n.type === 'mention' ? 'fa-solid fa-at text-xs' : n.type === 'reminder' ? 'fa-solid fa-clock text-xs' : 'fa-solid fa-bolt text-xs'}></i></div>
                                                          <div className="flex-1 overflow-hidden pb-4">
                                                            <div className="text-[13px] font-bold text-slate-800">{n.type === 'reply' ? 'New Reply' : n.type === 'message' ? 'Direct Message' : n.type === 'mention' ? 'Mentioned You' : n.type === 'reminder' ? 'Reminder Alert' : n.type === 'task' ? 'Task Update' : 'New Reaction'}</div>
                                                            <div className="text-[12px] text-slate-600 mt-0.5 leading-snug line-clamp-2 break-words font-medium">{n.text}</div>
                                                          </div>
                                                          <div className="absolute bottom-2 right-3 text-[9px] text-slate-400 font-bold bg-white pl-2">{timeStr}</div>
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                    
                                  <button onClick={() => setShowRightSidebar(!showRightSidebar)} className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-colors ${showRightSidebar ? 'bg-indigo-50 text-indigo-600' : 'text-indigo-500 hover:bg-indigo-50'} text-[19px]`} title="Task Hub"><i className="fa-solid fa-clipboard-list"></i></button>
                                  
                                  {(currentUserData?.isAdmin || isVipAdmin) && <button onClick={handleWipeAllTasks} className="ml-2 bg-rose-50 text-rose-600 border border-rose-200 px-2 py-1 rounded text-[10px] font-bold hover:bg-rose-100 uppercase tracking-wider">Wipe DB</button>}
                                </div>
                            </div>
                            
                            <ChatView
                                messagesToRender={messagesToRender} messages={messages} activeGroup={activeGroup} user={user} currentUserData={currentUserData}
                                isVipAdmin={isVipAdmin} pinnedMessages={pinnedMessages} typingStatus={typingStatus} replyingTo={replyingTo} setReplyingTo={setReplyingTo} 
                                toolPreferences={toolPreferences} dbUsers={dbUsers} groups={groups} setActiveGroup={setActiveGroup} setShowRightSidebar={setShowRightSidebar} 
                                setMobileSidebarOpen={setMobileSidebarOpen} pendingScrollTarget={pendingScrollTarget} setPendingScrollTarget={setPendingScrollTarget}
                                setActiveModal={setActiveModal} scrollToMessageDirect={scrollToMessageDirect} handleReaction={reactToMessageDB}
                                handleToggleBookmark={(m) => toggleBookmarkDB(m.id, m.bookmarkedBy)} handleTogglePin={(m) => togglePinDB(m.id, m.isPinned)} handleDeleteMessage={deleteMessageDB}
                                chatInputRef={chatInputRef} editingMessageId={editingMessageId} editMessageText={editMessageText} setEditingMessageId={setEditingMessageId} 
                                setEditMessageText={setEditMessageText} handleSaveEdit={handleSaveEdit} setSelectedMessage={setSelectedMessage} 
                                setIsEditingTaskTitle={setIsEditingTaskTitle} messagesEndRef={messagesEndRef} chatContainerRef={chatContainerRef} 
                                isAtBottom={isAtBottom} setIsAtBottom={setIsAtBottom} highlightedMsgId={highlightedMsgId} unreadHighlightIds={unreadHighlightIds} 
                                handleAddInlineComment={handleAddInlineComment} jumpToPrivateSource={(msgId, groupId) => navigateToMessageFromNotification(msgId, groupId)}
                                customTags={customTags} // 👈 TAGS PASSED DOWN
                            />

                            <InputArea
                                inputText={inputText} setInputText={setInputText} isOnline={isOnline} isUploading={isUploading} activeGroup={activeGroup}
                                replyingTo={replyingTo} setReplyingTo={setReplyingTo} handleSendOfflineAware={handleSendOfflineAware}
                                handleTypingEvent={handleTypingEvent} handlePaste={handlePaste} chatInputRef={chatInputRef} fileInputRef={fileInputRef}
                                handleFileUpload={handleFileUpload} emojiPickerOpen={emojiPickerOpen} setEmojiPickerOpen={setEmojiPickerOpen}
                                emojiPickerRef={emojiPickerRef} pendingFiles={pendingFiles} setPendingFiles={setPendingFiles} showFileRename={showFileRename}
                                setShowFileRename={setShowFileRename} 
                                uploadFileDirectly={async (pf) => {
                                    const latestInput = inputText.trim();
                                    let finalCaption = pf.caption || "";
                                    if (latestInput) finalCaption = finalCaption ? `${latestInput}\n${finalCaption}` : latestInput;
                                    pf.caption = finalCaption; pf.text = finalCaption; setInputText("");
                                    await uploadAndSendFileDB(pf, setUploadProgress);
                                }} 
                                setActiveModal={setActiveModal}
                                setPendingScheduledText={setPendingScheduledText} offlineDrafts={offlineDrafts} user={user} dbUsers={dbUsers}
                                groups={groups} currentUserData={currentUserData} MAX_FILE_SIZE_MB={MAX_FILE_SIZE_MB} handleSendPendingFiles={handleSendPendingFiles}
                            />
                        </div>
                    )}

                    {showRightSidebar && (
                      <RightSidebar
                        showRightSidebar={showRightSidebar} setShowRightSidebar={setShowRightSidebar} tasksAssignedToMe={tasksAssignedToMe}
                        tasksAssignedByMe={tasksAssignedByMe} archivedTasks={archivedTasks} groups={groups} dbUsers={dbUsers} user={user} setActiveGroup={setActiveGroup}
                        navigateToMessageFromNotification={navigateToMessageFromNotification} 
                      />
                    )}
                    <ModalManager {...modalProps} />
                    <Toast toasts={toasts} removeToast={removeToast} />
                </div>
            )}
        </div>
    );
}
