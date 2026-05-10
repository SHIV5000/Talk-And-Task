import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import RightSidebar from './Sidebar/RightSidebar.jsx';

import AdminPanel from './Admin/AdminPanel.jsx';
import LeftSidebar from './Sidebar/LeftSidebar.jsx';

import ContextMenuModal from './Modals/ContextMenuModal.jsx';
import ProfileSettingsModal from './Modals/ProfileSettingsModal.jsx';
import GroupFormModal from './Modals/GroupFormModal.jsx';
import GroupSettingsModal from './Modals/GroupSettingsModal.jsx';
import TaskTrailModal from './Modals/TaskTrailModal.jsx';
import TaskConvertModal from './Modals/TaskConvertModal.jsx';
import ReminderModal from './Modals/ReminderModal.jsx';
import ScheduleSendModal from './Modals/ScheduleSendModal.jsx';
import AdminEditUserModal from './Modals/AdminEditUserModal.jsx';
import TaskAnalyticsModal from './Modals/TaskAnalyticsModal.jsx';
import UploadOverlay from './Common/UploadOverlay.jsx';
import Toast from './Common/Toast.jsx';
import MemoizedAvatar from './Common/MemoizedAvatar.jsx';
import ChatView from './Chat/ChatView.jsx';
import InputArea from './Chat/InputArea.jsx';
import { compressImage } from '../utils/imageUtils.js';
import { formatMessageText, lockExtension } from '../utils/helpers.js';
import { auth, db, storage, signOut } from '../firebase.js';

// 👇 FIX: Moved the getDocs, query, and deleteDoc imports up here where they belong!
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc, setDoc, getDocs, where, deleteDoc, ref, uploadBytesResumable, getDownloadURL } from '../firebase.js';

const MAX_FILE_SIZE_MB = 10;

export default function ChatApp({ user, onLogout }) {
    // ==================== STATE ====================
    const [isVipAdmin, setIsVipAdmin] = useState(false);
    const [activeModal, setActiveModal] = useState(null);
   const [showRightSidebar, setShowRightSidebar] = useState(true);
    const [viewMode, setViewMode] = useState("chat");
    const [showFilterMenu, setShowFilterMenu] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [isAtBottom, setIsAtBottom] = useState(true);
    const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(true);
    const [inputText, setInputText] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [sidebarSearch, setSidebarSearch] = useState("");
    const [chatFilter, setChatFilter] = useState("all");
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [replyingTo, setReplyingTo] = useState(null);
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [editMessageText, setEditMessageText] = useState("");
    const [taskAssignees, setTaskAssignees] = useState([]);
    const [taskDeadline, setTaskDeadline] = useState("");
    const [taskPriority, setTaskPriority] = useState("Medium");
    const [delegateAssignees, setDelegateAssignees] = useState([]);
    const [showDelegateDropdown, setShowDelegateDropdown] = useState(false);
    const [trailComment, setTrailComment] = useState("");
    const [reminderDateTime, setReminderDateTime] = useState("");
    const [isEditingTaskTitle, setIsEditingTaskTitle] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState("");
    const [messages, setMessages] = useState([]);
    const [dbUsers, setDbUsers] = useState([]);
    const [groups, setGroups] = useState([]);
    const [activeGroup, setActiveGroup] = useState(null);
    const [currentUserData, setCurrentUserData] = useState(null);
    const [typingStatus, setTypingStatus] = useState([]);
    const [activeReminders, setActiveReminders] = useState([]);
    const [genericNotifications, setGenericNotifications] = useState([]);
    const [allAdminReminders, setAllAdminReminders] = useState([]);
    const [immutableAuditLogs, setImmutableAuditLogs] = useState([]);
    const [adminForm, setAdminForm] = useState({ uid: '', name: '', email: '', isAdmin: false, canCreateGroups: false });
    const [profileForm, setProfileForm] = useState({ name: "", fontSize: "text-[14.2px]", fontFamily: "font-sans" });
    const [groupForm, setGroupForm] = useState({ name: "", members: [], admins: [], profilePicUrl: null });
    const [editingGroup, setEditingGroup] = useState(null);
    const [adminFilterUser, setAdminFilterUser] = useState("");
    const [adminFilterDate, setAdminFilterDate] = useState("");
    const [adminFilterType, setAdminFilterType] = useState("");
    const [adminFilterGroup, setAdminFilterGroup] = useState("");
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [trailFileUploading, setTrailFileUploading] = useState(false);
    const [profileUploadProgress, setProfileUploadProgress] = useState(0);
    const [groupPicUploadProgress, setGroupPicUploadProgress] = useState(0);
    const [pendingFiles, setPendingFiles] = useState([]);
    const [showFileRename, setShowFileRename] = useState(false);

    // ==================== TOAST STATE & HELPERS ====================
    const [toasts, setToasts] = useState([]);
    const addToast = useCallback((message, type = 'message') => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);
    const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));
    
    // ==================== REFS ====================
    const messagesEndRef = useRef(null);
    const chatContainerRef = useRef(null);
    const chatInputRef = useRef(null);
    const fileInputRef = useRef(null);
    const trailFileInputRef = useRef(null);
    const profilePicInputRef = useRef(null);
    const groupPicInputRef = useRef(null);
    const emojiPickerRef = useRef(null);
    const prevMessagesCountRef = useRef(0);
    const lastTypingTime = useRef(0);
    const highlightTimerRef = useRef(null);
    const inactivityTimerRef = useRef(null);
    const inactivityCountdownRef = useRef(null);
    const lastActivityRef = useRef(Date.now());

    // ==================== OTHER STATES ====================
    const [pendingScrollTarget, setPendingScrollTarget] = useState(null);
    const loaderTips = [
        "A Tip: Type '@' to instantly mention your peers or entire departments.",
        "A Tip: Convert any message into an official trackable Task using the context menu.",
        "A Tip: Your session will automatically secure and log out after 5 minutes of inactivity.",
        "A Tip: Admins can download Immutable Audit Logs in PDF format from the Dashboard.",
        "A Tip: Pressing 'Enter' instantly submits your Task Updates."
    ];
    const [currentTip, setCurrentTip] = useState(loaderTips[0]);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
    const [highlightedMsgId, setHighlightedMsgId] = useState(null);
    const [unreadHighlightIds, setUnreadHighlightIds] = useState([]);
    const [toolPreferences, setToolPreferences] = useState({
        reply: true, react: true, edit: true, delete: true, pin: true, bookmark: true, showWatermark: true, soundProfile: 'classic'
    });
    const [scheduledMessages, setScheduledMessages] = useState([]);
    const [scheduleDateTime, setScheduleDateTime] = useState("");
    const [showScheduleInput, setShowScheduleInput] = useState(false);
    const [pendingScheduledText, setPendingScheduledText] = useState("");
    const [msgScheduleDateTime, setMsgScheduleDateTime] = useState("");
    const [analyticsView, setAnalyticsView] = useState("overview");
    const [taskTemplates, setTaskTemplates] = useState([]);
    const [templateForm, setTemplateForm] = useState({ title: "", assignees: [], deadlineDays: 1, groupId: "", recurring: "once", category: "General" });
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [offlineDrafts, setOfflineDrafts] = useState([]);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [showInactivityWarning, setShowInactivityWarning] = useState(false);
    const [inactivityCountdown, setInactivityCountdown] = useState(60);

    // ==================== EFFECTS ====================
    useEffect(() => {
        let tipIndex = 0;
        const tipInterval = setInterval(() => {
            tipIndex = (tipIndex + 1) % loaderTips.length;
            setCurrentTip(loaderTips[tipIndex]);
        }, 1500);
        const timer = setTimeout(() => {
            clearInterval(tipInterval);
            setIsWorkspaceLoading(false);
        }, 4000);
        return () => { clearTimeout(timer); clearInterval(tipInterval); };
    }, []);

    useEffect(() => {
        const primeAudio = () => {
            if (!window.audioPrimed) {
                const audioEl = document.getElementById('app-sound');
                if (audioEl) { audioEl.volume = 0; audioEl.play().then(() => { audioEl.pause(); audioEl.currentTime = 0; audioEl.volume = 1.0; window.audioPrimed = true; }).catch(()=>{}); }
            }
        };
        window.addEventListener('click', primeAudio, { once: true });
        window.addEventListener('touchstart', primeAudio, { once: true });
        return () => { window.removeEventListener('click', primeAudio); window.removeEventListener('touchstart', primeAudio); };
    }, []);

    useEffect(() => {
        const INACTIVITY_LIMIT = 5 * 60 * 1000;
        const IDLE_WARN = 4 * 60 * 1000;
        const IDLE_LOGOUT = 60;
        const resetInactivity = () => {
            lastActivityRef.current = Date.now();
            if (showInactivityWarning) return;
            clearTimeout(inactivityTimerRef.current);
            inactivityTimerRef.current = setTimeout(() => {
                setShowInactivityWarning(true);
                setInactivityCountdown(IDLE_LOGOUT);
                let cnt = IDLE_LOGOUT;
                clearInterval(inactivityCountdownRef.current);
                inactivityCountdownRef.current = setInterval(() => {
                    cnt -= 1;
                    setInactivityCountdown(cnt);
                    if (cnt <= 0) {
                        clearInterval(inactivityCountdownRef.current);
                        signOut(auth);
                    }
                }, 1000);
            }, IDLE_WARN);
        };
        const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
        events.forEach(ev => window.addEventListener(ev, resetInactivity));
        resetInactivity();
        return () => {
            events.forEach(ev => window.removeEventListener(ev, resetInactivity));
            clearTimeout(inactivityTimerRef.current);
            clearInterval(inactivityCountdownRef.current);
        };
    }, [showInactivityWarning]);

    // 👇 CHRON JOB FOR DEADLINE ALERTS
    useEffect(() => {
        const deadlineChecker = setInterval(() => {
            const now = new Date();
            const dueTasks = messages.filter(m => 
                m.isTask && 
                m.taskData?.status !== "Completed" && 
                !m.taskData?.deadlineAlerted && 
                m.taskData?.deadline && 
                new Date(m.taskData.deadline) <= now
            );

            dueTasks.forEach(async (task) => {
                await updateDoc(doc(db, "messages", task.id), { "taskData.deadlineAlerted": true });

                const involved = new Set();
                if (task.senderEmail) involved.add(task.senderEmail);
                (task.taskData.assignees || []).forEach(a => involved.add(a));

                involved.forEach(email => {
                    const u = dbUsers.find(user => user.email === email);
                    if (u) {
                        addDoc(collection(db, "notifications"), {
                            userId: u.uid,
                            type: "task",
                            text: `⏰ DUE NOW: "${task.text}"`,
                            messageId: task.id,
                            groupId: task.groupId,
                            timestamp: serverTimestamp(),
                            isRead: false
                        }).catch(()=>{});
                    }
                });
            });
        }, 60000); 

        return () => clearInterval(deadlineChecker);
    }, [messages, dbUsers]);

    const verifyAdminStatus = useCallback(async () => {
        if (!auth.currentUser) return false;
        try {
            const idTokenResult = await auth.currentUser.getIdTokenResult();
            return !!idTokenResult.claims.admin;
        } catch (e) { return false; }
    }, []);
    useEffect(() => { verifyAdminStatus().then(res => setIsVipAdmin(res)); }, [verifyAdminStatus]);

    useEffect(() => {
        const qPersonal = query(collection(db, "reminders"), where("userId", "==", user.uid), where("isTriggered", "==", false));
        const unsubPersonal = onSnapshot(qPersonal, (snapshot) => setActiveReminders(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))));

        const qAlerts = query(collection(db, "notifications"), where("userId", "==", user.uid), where("isRead", "==", false));
        const unsubAlerts = onSnapshot(qAlerts, (snapshot) => {
            const sorted = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
            setGenericNotifications(sorted);
        });

        let unsubAdmin = () => {}; let unsubAudit = () => {};
        if (currentUserData?.isAdmin || isVipAdmin) {
            const qAdmin = query(collection(db, "reminders"), orderBy("remindAt", "desc"));
            unsubAdmin = onSnapshot(qAdmin, (snapshot) => setAllAdminReminders(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))));
            const qAudit = query(collection(db, "audit_logs"), orderBy("timestamp", "desc"));
            unsubAudit = onSnapshot(qAudit, (snapshot) => {
                setImmutableAuditLogs(snapshot.docs.map(d => {
                    const data = d.data();
                    return { id: d.id, ...data, time: data.timestamp?.toDate ? new Date(data.timestamp.toDate()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '', dateString: data.timestamp?.toDate ? new Date(data.timestamp.toDate()).toISOString().split('T')[0] : '' };
                }));
            });
        }
        return () => { unsubPersonal(); unsubAlerts(); unsubAdmin(); unsubAudit(); };
    }, [user.uid, currentUserData?.isAdmin, isVipAdmin]);

    useEffect(() => {
        const heartbeatInterval = setInterval(() => { updateDoc(doc(db, "users", user.uid), { lastActive: serverTimestamp() }).catch(() => {}); }, 60000);
        const unsubCurrent = onSnapshot(doc(db, "users", user.uid), (docSnapshot) => {
            if (docSnapshot.exists()) {
                const data = docSnapshot.data(); setCurrentUserData(data);
                if(!profileForm.name && data.name) setProfileForm({ name: (data.name || "").split('@')[0], fontSize: data.fontSize || "text-[14.2px]", fontFamily: data.fontFamily || "font-sans" });
                if (data.toolPreferences) setToolPreferences(prev => ({ ...prev, ...data.toolPreferences }));
            }
        });
        const unsubUsers = onSnapshot(query(collection(db, "users"), orderBy("email", "asc")), (snapshot) => setDbUsers(snapshot.docs.map(document => document.data())));
        const unsubGroups = onSnapshot(collection(db, "groups"), (snapshot) => {
            const fetchedGroups = snapshot.docs.map(document => ({ id: document.id, ...document.data() }));
            setGroups(fetchedGroups);
        });
        return () => { clearInterval(heartbeatInterval); unsubCurrent(); unsubUsers(); unsubGroups(); };
    }, [user, currentUserData?.isAdmin, isVipAdmin]);

    const playAlertSound = useCallback(() => {
        const audioUrls = { classic: "https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3", soft: "https://cdn.pixabay.com/download/audio/2022/03/15/audio_793bdf2292.mp3", subtle: "https://cdn.pixabay.com/download/audio/2022/03/10/audio_c8c8a73467.mp3" };
        const audioEl = document.getElementById('app-sound');
        if (audioEl && window.audioPrimed) {
            audioEl.src = audioUrls[toolPreferences.soundProfile || 'classic'] || audioUrls.classic;
            audioEl.currentTime = 0; audioEl.volume = 1.0;
            audioEl.play().catch(e => console.warn("Browser blocked audio:", e));
        }
    }, [toolPreferences.soundProfile]);

    const playTaskSound = useCallback(() => {
        try {
            const audio = new Audio("https://cdn.freesound.org/previews/270/270404_5123851-lq.mp3");
            audio.volume = 0.8;
            audio.play().catch(() => {});
        } catch (e) {}
    }, []);

    useEffect(() => {
        const q = query(collection(db, "messages"), orderBy("timestamp", "asc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            let loadedMessages = snapshot.docs.map(docSnapshot => {
                const data = docSnapshot.data();
                return { id: docSnapshot.id, ...data, sender: data.senderEmail, isMine: data.senderUid === user.uid, time: data.timestamp?.toDate ? new Date(data.timestamp.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Sending...', dateString: data.timestamp?.toDate ? new Date(data.timestamp.toDate()).toISOString().split('T')[0] : '', isTask: data.isTask === true, groupId: data.groupId || "demo", reactions: data.reactions || {}, seenBy: data.seenBy || [], bookmarkedBy: data.bookmarkedBy || [], isPinned: data.isPinned || false, deliveredTo: data.deliveredTo || [] };
            });

            loadedMessages.sort((a, b) => {
                const timeA = a.timestamp?.toMillis?.() || Number.MAX_SAFE_INTEGER;
                const timeB = b.timestamp?.toMillis?.() || Number.MAX_SAFE_INTEGER;
                return timeA - timeB;
            });

            setMessages(loadedMessages);

            if (prevMessagesCountRef.current > 0 && loadedMessages.length > prevMessagesCountRef.current && !isWorkspaceLoading) {
                const newMsg = loadedMessages[loadedMessages.length - 1];
                if (!newMsg.isMine && Date.now() - (newMsg.timestamp?.toMillis?.() || Date.now()) < 5000) {
                    playAlertSound();
                    addToast(`New message from ${(newMsg.sender || "").split('@')[0]}`, 'message');
                    if (document.hidden && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
                        navigator.serviceWorker.controller.postMessage({ type: 'SHOW_NOTIFICATION', title: `New Message from ${(newMsg.sender || "").split('@')[0]}`, body: newMsg.text || 'Sent an attachment' });
                    }
                }
            }
            prevMessagesCountRef.current = loadedMessages.length;
        });

        const unsubTyping = onSnapshot(collection(db, "typing"), (snapshot) => {
            const typingData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            const currentTyping = typingData.filter(t => t.groupId === activeGroup?.id && t.name && Date.now() - t.timestamp < 3000);
            setTypingStatus(currentTyping);
        });

        return () => { unsubscribe(); unsubTyping(); };
    }, [user.uid, activeGroup?.id, playAlertSound, isWorkspaceLoading, addToast]);

    useEffect(() => {
        if (!activeGroup?.id || !user.email) return;
        const unseenMsgs = messages.filter(m => m.groupId === activeGroup.id && !m.isMine && !(m.seenBy || []).includes(user.email));
        if (unseenMsgs.length === 0) return;
        const batchUpdate = async () => {
            for (const msg of unseenMsgs) {
                try {
                    const updatedSeenBy = [...(msg.seenBy || []), user.email];
                    await updateDoc(doc(db, "messages", msg.id), { seenBy: updatedSeenBy, deliveredTo: [...new Set([...(msg.deliveredTo || []), user.email])] });
                } catch (e) {}
            }
        };
        batchUpdate();
    }, [activeGroup?.id, messages, user.email]);

    useEffect(() => {
        const goOnline = () => { setIsOnline(true); flushOfflineDrafts(); };
        const goOffline = () => setIsOnline(false);
        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);
        loadOfflineDrafts();
        return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
    }, []);

    // Save the last active group whenever the user switches
    useEffect(() => {
        if (!activeGroup?.id || !user.uid) return;
        updateDoc(doc(db, "users", user.uid), {
            lastActiveGroupId: activeGroup.id
        }).catch(() => {});
    }, [activeGroup?.id, user.uid]);

    // Restore the last active group once the app has loaded
    useEffect(() => {
        if (isWorkspaceLoading || !groups.length || activeGroup) return;
        const savedGroupId = currentUserData?.lastActiveGroupId;
        if (savedGroupId) {
            const g = groups.find(gr => gr.id === savedGroupId && gr.members?.includes(user.email));
            if (g) setActiveGroup(g);
        }
    }, [isWorkspaceLoading, groups, currentUserData?.lastActiveGroupId, user.email, activeGroup]);

    // Force scroll to the very bottom when the group changes
    useEffect(() => {
        if (!activeGroup || isWorkspaceLoading) return;
        setTimeout(() => {
            if (chatContainerRef.current) {
                chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
                setIsAtBottom(true);
            }
        }, 300);
    }, [activeGroup?.id, isWorkspaceLoading]);

    // Calculate unread highlight IDs
    useEffect(() => {
        if (!activeGroup?.id || !user.email) return;
        const unread = messages
            .filter(m => m.groupId === activeGroup.id && !m.isMine && !(m.seenBy || []).includes(user.email))
            .map(m => m.id);
        if (unread.length > 0) {
            setUnreadHighlightIds(unread);
            const timer = setTimeout(() => setUnreadHighlightIds([]), 4000);
            return () => clearTimeout(timer);
        }
        setUnreadHighlightIds([]);
    }, [activeGroup?.id, user.email, messages]);

    // ==================== MEMOS ====================
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

    const pinnedMessages = useMemo(() => {
        if(!activeGroup) return [];
        return messages.filter(m => m.groupId === activeGroup.id && m.isPinned);
    }, [messages, activeGroup]);

    const messagesToRender = useMemo(() => {
        if(!activeGroup) return [];
        let filtered = messages.filter(m => {
            if (m.groupId !== activeGroup.id) return false;
            if (m.isPrivateMention && !m.allowedUsers?.includes(user.email)) return false;
            return true;
        });
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(m => (m.text || '').toLowerCase().includes(q) || (m.fileName || '').toLowerCase().includes(q) || (m.sender || '').toLowerCase().includes(q));
        }
        if (chatFilter === 'tasks-pending') filtered = filtered.filter(m => m.isTask && m.taskData?.status !== "Completed");
        else if (chatFilter === 'tasks-completed') filtered = filtered.filter(m => m.isTask && m.taskData?.status === "Completed");
        else if (chatFilter === 'messages') filtered = filtered.filter(m => !m.isTask);
        else if (chatFilter === 'today') {
            const today = new Date().toISOString().split('T')[0];
            filtered = filtered.filter(m => m.dateString === today);
        }
        else if (chatFilter === 'bookmarked') filtered = filtered.filter(m => m.bookmarkedBy?.includes(user.email));
        return filtered;
    }, [messages, activeGroup, user.email, chatFilter, searchQuery]);

    const tasksAssignedToMe = useMemo(() => messages.filter(m => m.isTask && m.taskData?.assignees?.includes(user.email) && !m.taskData?.isArchived).sort((a,b) => new Date(a.taskData.deadline).getTime() - new Date(b.taskData.deadline).getTime()), [messages, user.email]);
    const tasksAssignedByMe = useMemo(() => messages.filter(m => m.isTask && m.senderEmail === user.email && !m.taskData?.isArchived).sort((a,b) => new Date(a.taskData.deadline).getTime() - new Date(b.taskData.deadline).getTime()), [messages, user.email]);

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

    const analyticsData = useMemo(() => {
        const allTasks = messages.filter(m => m.isTask);
        const completed = allTasks.filter(m => m.taskData?.status === 'Completed');
        const pending = allTasks.filter(m => m.taskData?.status === 'Pending');
        const inProgress = allTasks.filter(m => m.taskData?.status === 'In Progress');
        const overdue = allTasks.filter(m => m.taskData?.status !== 'Completed' && m.taskData?.deadline && new Date(m.taskData.deadline) < new Date() && !m.taskData?.isArchived);
        return { total: allTasks.length, completed: completed.length, pending: pending.length, inProgress: inProgress.length, overdue: overdue.length, overdueList: overdue.slice(0,10), completionRate: allTasks.length ? Math.round((completed.length / allTasks.length) * 100) : 0 };
    }, [messages, groups]);

    // ==================== HANDLERS ====================
    
    // 👇 FIX: Developer Nuke Tool
    const handleWipeAllTasks = async () => {
        if (!window.confirm("🚨 WARNING: This will permanently delete ALL tasks across all groups. Proceed?")) return;
        try {
            const q = query(collection(db, "messages"), where("isTask", "==", true));
            const snapshot = await getDocs(q);
            if (snapshot.empty) return alert("No tasks found! You are already clean.");
            const deletePromises = snapshot.docs.map(document => deleteDoc(doc(db, "messages", document.id)));
            await Promise.all(deletePromises);
            alert(`🧹 Successfully wiped ${snapshot.docs.length} tasks! Clean slate ready.`);
        } catch (error) {
            console.error("Failed to wipe tasks:", error);
            alert("Failed to clean database. Check console.");
        }
    };

    const triggerHighlight = useCallback((msgId) => {
        setHighlightedMsgId(msgId);
        if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = setTimeout(() => { setHighlightedMsgId(null); }, 3100);
    }, []);

    const scrollToMessageDirect = useCallback((msgId) => {
        const el = document.getElementById(`msg-${msgId}`);
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); triggerHighlight(msgId); }
    }, [triggerHighlight]);

    const logImmutableAction = useCallback(async (actionType, content, target = "") => {
        if(!activeGroup) return;
        try { await addDoc(collection(db, "audit_logs"), { type: actionType, user: user.email, content, target, groupId: activeGroup.id, groupName: activeGroup.name, timestamp: serverTimestamp() }); } catch(e) {}
    }, [user.email, activeGroup]);

    const navigateToMessageFromNotification = useCallback(async (msgId, targetGroupId) => {
        const targetGroup = groups.find(g => g.id === targetGroupId);
        if (targetGroup) {
            setActiveGroup(targetGroup);
            setShowRightSidebar(false);
            setMobileSidebarOpen(false);
            setShowNotifications(false);
            setPendingScrollTarget(msgId);
            setActiveModal(null);
        }
    }, [groups]);

    const notifyInvolvedInTask = async (taskMsg, actionText) => {
        const involved = new Set();
        if (taskMsg.senderEmail) involved.add(taskMsg.senderEmail);
        (taskMsg.taskData?.assignees || []).forEach(a => involved.add(a));
        (taskMsg.taskData?.trail || []).forEach(t => {
            if (t.by) involved.add(t.by);
        });
        involved.delete(user.email);
        const uidsToNotify = dbUsers
            .filter(u => involved.has(u.email))
            .map(u => u.uid);
            
        for (const uid of uidsToNotify) {
            try {
                await addDoc(collection(db, "notifications"), {
                    userId: uid,
                    type: "task",
                    text: `"${taskMsg.text}" - ${(user.email || "").split('@')[0]} updated ✅`,
                    messageId: taskMsg.id,
                    groupId: taskMsg.groupId,
                    timestamp: serverTimestamp(),
                    isRead: false,
                });
            } catch (e) {}
        }
    };

    const openDraftDB = () => new Promise((resolve, reject) => {
        const req = indexedDB.open("TalkTaskDrafts", 1);
        req.onupgradeneeded = e => { e.target.result.createObjectStore("drafts", { keyPath: "id", autoIncrement: true }); };
        req.onsuccess = e => resolve(e.target.result);
        req.onerror = () => reject();
    });

    const saveOfflineDraft = async (text, groupId, groupName) => {
        try { const db2 = await openDraftDB(); const tx = db2.transaction("drafts", "readwrite"); tx.objectStore("drafts").add({ text, groupId, groupName, savedAt: new Date().toISOString() }); loadOfflineDrafts(); } catch(e) {}
    };

    const loadOfflineDrafts = async () => {
        try { const db2 = await openDraftDB(); const tx = db2.transaction("drafts", "readonly"); const req = tx.objectStore("drafts").getAll(); req.onsuccess = () => setOfflineDrafts(req.result || []); } catch(e) {}
    };

    const deleteOfflineDraft = async (id) => {
        try { const db2 = await openDraftDB(); const tx = db2.transaction("drafts", "readwrite"); tx.objectStore("drafts").delete(id); loadOfflineDrafts(); } catch(e) {}
    };

    const flushOfflineDrafts = async () => {
        try {
            const db2 = await openDraftDB(); const tx = db2.transaction("drafts", "readonly"); const req = tx.objectStore("drafts").getAll();
            req.onsuccess = async () => {
                for (const draft of req.result || []) {
                    try {
                        await addDoc(collection(db, "messages"), { text: `[Recovered Draft] ${draft.text}`, senderUid: user.uid, senderEmail: user.email, timestamp: serverTimestamp(), isTask: false, hasReminder: false, isPrivateMention: false, allowedUsers: [], seenBy: [user.email], deliveredTo: [user.email], isPinned: false, bookmarkedBy: [], fileUrl: null, fileName: null, fileType: null, groupId: draft.groupId, reactions: {} });
                        await deleteOfflineDraft(draft.id);
                    } catch(e) {}
                }
            };
        } catch(e) {}
    };

    const onGroupUpdate = useCallback(async (updates) => {
        if (!activeGroup || !activeGroup.id) return;
        setActiveModal(null);
        if (updates.profilePicFile) {
            const file = updates.profilePicFile;
            const uniqueFileName = `group_${Date.now()}_${file.name}`;
            const uploadTask = uploadBytesResumable(ref(storage, `group_avatars/${uniqueFileName}`), file);
            uploadTask.on('state_changed', null, (error) => { console.error('Background upload failed', error); }, async () => {
                const url = await getDownloadURL(uploadTask.snapshot.ref);
                await updateDoc(doc(db, "groups", activeGroup.id), { profilePicUrl: url });
                setActiveGroup(prev => ({ ...prev, profilePicUrl: url }));
                setGroups(prev => prev.map(g => g.id === activeGroup.id ? { ...g, profilePicUrl: url } : g));
            });
            return;
        }
        const cleanUpdates = {};
        if (updates.name) cleanUpdates.name = updates.name;
        if (updates.members) { cleanUpdates.members = updates.members; cleanUpdates.admins = updates.admins || activeGroup.admins.filter(a => updates.members.includes(a)); }
        if (Object.keys(cleanUpdates).length === 0) return;
        setActiveGroup(prev => ({ ...prev, ...cleanUpdates }));
        setGroups(prev => prev.map(g => g.id === activeGroup.id ? { ...g, ...cleanUpdates } : g));
        try {
            await updateDoc(doc(db, "groups", activeGroup.id), cleanUpdates);
            logImmutableAction("GROUP_UPDATE", `Updated group: ${activeGroup.name}`, `Fields: ${Object.keys(cleanUpdates).join(', ')}`);
        } catch (err) { console.error('Background update failed', err); }
    }, [activeGroup, storage, db, logImmutableAction, setActiveModal]);

    const handleSendOfflineAware = async () => {
        if (!inputText.trim() || !activeGroup) return;
        if (!isOnline) {
            await saveOfflineDraft(inputText.trim(), activeGroup.id, activeGroup.name);
            setInputText(""); alert("📥 You are offline. Message saved as draft and will be sent when you reconnect."); return;
        }
        await handleSendMessage();
    };

    const handleTypingEvent = useCallback(() => {
        if(!activeGroup) return;
        const now = Date.now();
        if (now - lastTypingTime.current > 1500) {
            lastTypingTime.current = now;
            try { setDoc(doc(db, "typing", `${activeGroup.id}_${user.uid}`), { groupId: activeGroup.id, name: currentUserData?.name || user.email.split('@')[0], timestamp: now }, { merge: true }); } catch (e) {}
        }
    }, [activeGroup, user.uid, currentUserData?.name, user.email]);

    const handleSendMessage = async () => {
        if (!inputText.trim() || !activeGroup) return;
        const messageText = inputText.trim();
        setInputText(""); setEmojiPickerOpen(false);
        try { deleteDoc(doc(db, "typing", `${activeGroup.id}_${user.uid}`)); } catch(e) {}

        const mentions = [];
        dbUsers.forEach(u => { if (messageText.toLowerCase().includes(`@${(u.name || "").toLowerCase()}`)) mentions.push(u.email); });
        groups.forEach(g => {
            const teamTag = `@${(g.name || "").replace(/\s+/g, '').toLowerCase()}`;
            if (messageText.toLowerCase().includes(teamTag) && !g.isArchived) { (g.members || []).forEach(m => mentions.push(m)); }
        });
        const uniqueMentions = [...new Set(mentions)];
        const isPrivate = uniqueMentions.length > 0 && !activeGroup.isDM;
        const allowedUsers = isPrivate ? [...new Set([user.email, ...uniqueMentions])] : [];

        let replyData = null;
        if (replyingTo) {
            replyData = { replyToId: replyingTo.id, originalText: replyingTo.text || replyingTo.fileName || 'Attachment', originalSender: (replyingTo.sender||"").split('@')[0] };
        }

        try {
            const groupMsgRef = await addDoc(collection(db, "messages"), { 
                text: messageText, 
                senderUid: user.uid, 
                senderEmail: user.email, 
                timestamp: serverTimestamp(), 
                isTask: false, 
                isPrivateMention: isPrivate, 
                allowedUsers: allowedUsers, 
                seenBy: [user.email], 
                groupId: activeGroup.id, 
                reactions: {}, 
                ...(replyData || {}) 
            });

            logImmutableAction("MESSAGE_CREATE", `Sent message: "${messageText}"`, isPrivate ? `Private: ${uniqueMentions.join(', ')}` : "Public");

            if (isPrivate && uniqueMentions.length > 0) {
                uniqueMentions.forEach(async (mentionEmail) => {
                    if (mentionEmail === user.email) return; 
                    const recipient = dbUsers.find(u => u.email === mentionEmail);
                    if (recipient) {
                        const dmId = [user.uid, recipient.uid].sort().join('_');
                        await addDoc(collection(db, "messages"), {
                            text: `[Forwarded Private Mention] ${messageText}`,
                            senderUid: user.uid,
                            senderEmail: user.email,
                            timestamp: serverTimestamp(),
                            groupId: dmId,
                            isPrivateForward: true,
                            originalMsgId: groupMsgRef.id,
                            originalGroupId: activeGroup.id,
                            forwardedFromGroupName: activeGroup.name,
                            seenBy: [user.email],
                            reactions: {}
                        });
                        await addDoc(collection(db, "notifications"), {
                            userId: recipient.uid,
                            type: "mention",
                            text: `New private mention in ${activeGroup.name} 🔒`,
                            messageId: groupMsgRef.id,
                            groupId: activeGroup.id,
                            timestamp: serverTimestamp(),
                            isRead: false
                        });
                    }
                });
            }

            setReplyingTo(null);
            if (chatContainerRef.current) {
                chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
                setIsAtBottom(true);
            }
        } catch (error) { alert("Failed to send message."); }
    };

    const handleReaction = async (msgId, emoji) => {
        const msg = messages.find(m => m.id === msgId);
        if(!msg) return;
        let updatedReactions = { ...msg.reactions };
        let usersForEmoji = updatedReactions[emoji] || [];
        const isAdding = !usersForEmoji.includes(user.email);
        if (isAdding) usersForEmoji = [...usersForEmoji, user.email]; else usersForEmoji = usersForEmoji.filter(e => e !== user.email);
        if (usersForEmoji.length === 0) delete updatedReactions[emoji]; else updatedReactions[emoji] = usersForEmoji;
        try {
            await updateDoc(doc(db, "messages", msgId), { reactions: updatedReactions });
            if (isAdding && msg.senderUid !== user.uid) await addDoc(collection(db, "notifications"), { userId: msg.senderUid, type: "reaction", text: `${(user.email||"").split('@')[0]} reacted ${emoji}.`, messageId: msgId, groupId: msg.groupId, timestamp: serverTimestamp(), isRead: false });
        } catch (err) {}
    };

    const uploadFileDirectly = async (pendingFileObj) => {
        const { file, customName, caption } = pendingFileObj;
        if (!file || !activeGroup) throw new Error("Missing file or active group.");
        const maxSizeBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
        if (file.size > maxSizeBytes) throw new Error(`File exceeds ${MAX_FILE_SIZE_MB} MB limit.`);

        let processedFile = file;
        try { if (file.type.startsWith('image/')) { const compressedBlob = await compressImage(file); const ext = customName.split('.').pop().toLowerCase(); processedFile = new File([compressedBlob], customName, { type: `image/${ext === 'png' ? 'png' : 'jpeg'}` }); } } catch (e) {}

        const uniqueFileName = `${Date.now()}_${customName}`;
        const storageRef = ref(storage, `chat_uploads/${uniqueFileName}`);
        const uploadTask = uploadBytesResumable(storageRef, processedFile);

        uploadTask.on('state_changed', (snapshot) => { setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100); });
        await uploadTask;
        const downloadURL = await getDownloadURL(storageRef);

        const messageText = caption.trim() ? `${caption}\n\n📎 ${customName}` : `Shared a file: ${customName}`;
        await addDoc(collection(db, "messages"), { text: messageText, senderUid: user.uid, senderEmail: user.email, timestamp: serverTimestamp(), isTask: false, hasReminder: false, isPrivateMention: false, allowedUsers: [], seenBy: [user.email], deliveredTo: [user.email], isPinned: false, bookmarkedBy: [], fileUrl: downloadURL, fileName: customName, fileType: processedFile.type, groupId: activeGroup.id, reactions: {} });
        logImmutableAction("FILE_UPLOAD", `Uploaded file: ${customName}`, "Public");
    };

    const handleSendPendingFiles = async () => {
        if (pendingFiles.length === 0) return;
        const filesToUpload = [...pendingFiles];
        setPendingFiles([]); setShowFileRename(false); setIsUploading(true); setUploadProgress(0);
        for (const pf of filesToUpload) { try { await uploadFileDirectly(pf); } catch (error) { alert(`Upload failed for ${pf.customName}: ${error.message}`); } }
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
                    const newItem = { id: Date.now() + Math.random(), file: blob, customName: pastedName, caption: currentInput };
                    setPendingFiles(prev => [...prev, newItem].slice(0, 3));
                    setShowFileRename(true);
                    if (currentInput) setInputText('');
                }
            }
        }
    };

    const handleTogglePin = async (msg) => {
        if (!currentUserData?.isAdmin && !isVipAdmin && activeGroup?.admins && !activeGroup.admins.includes(user.email)) return alert("Only Department Admins can pin announcements.");
        try { await updateDoc(doc(db, "messages", msg.id), { isPinned: !msg.isPinned }); } catch (e) {}
    };

    const handleToggleBookmark = async (msg) => {
        let bookmarks = msg.bookmarkedBy || [];
        if (bookmarks.includes(user.email)) bookmarks = bookmarks.filter(e => e !== user.email); else bookmarks.push(user.email);
        try { await updateDoc(doc(db, "messages", msg.id), { bookmarkedBy: bookmarks }); } catch(e) {}
    };

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

    const handleTrailFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !selectedMessage) return;
        setTrailFileUploading(true);
        const uniqueFileName = `${Date.now()}_${file.name}`;
        const uploadTask = uploadBytesResumable(ref(storage, `task_updates/${uniqueFileName}`), file);
        uploadTask.on('state_changed', null, (error) => { setTrailFileUploading(false); alert("Upload failed."); }, async () => {
            try {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                const now = new Date();
                const updatedTrail = [...selectedMessage.taskData.trail, { action: "File Uploaded", by: user.email, time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ', ' + now.toLocaleDateString(), comment: "Attached file via system", fileUrl: downloadURL, fileName: file.name }];
                await updateDoc(doc(db, "messages", selectedMessage.id), { "taskData.trail": updatedTrail });
                await notifyInvolvedInTask(selectedMessage, `${(user.email||"").split('@')[0]} attached a file to a task.`);
                setSelectedMessage(prev => ({...prev, taskData: {...prev.taskData, trail: updatedTrail}}));
                playTaskSound();
            } catch(e) {} finally { setTrailFileUploading(false); if(trailFileInputRef.current) trailFileInputRef.current.value = ""; }
        });
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

    const handleGroupSubmit = async (e) => {
        e.preventDefault();
        if(!groupForm.name.trim()) return;
        try {
            const finalMembers = [...new Set([...groupForm.members, user.email])];
            const groupData = { name: groupForm.name, members: finalMembers, profilePicUrl: groupForm.profilePicUrl };
            if (editingGroup) {
                await updateDoc(doc(db, "groups", editingGroup.id), groupData);
            } else {
                await addDoc(collection(db, "groups"), { ...groupData, admins: [user.email], createdBy: user.email, createdAt: serverTimestamp(), isArchived: false });
            }
            setActiveModal(null); setEditingGroup(null); setGroupForm({name: "", members: [], admins: [], profilePicUrl: null});
        } catch (error) { alert("Failed to save group."); }
    };
    
    const handleUpdateGroupMembers = async (e) => {
        e.preventDefault();
        try {
            const finalMembers = [...new Set([...groupForm.members, ...activeGroup.admins])];
            await updateDoc(doc(db, "groups", activeGroup.id), { members: finalMembers });
            setActiveModal(null); setActiveGroup({...activeGroup, members: finalMembers});
        } catch (error) { alert("Failed to update members."); }
    };

    const handleClearNotifications = async () => {
        const alertPromises = genericNotifications.map(n => updateDoc(doc(db, "notifications", n.id), { isRead: true }));
        await Promise.all([...alertPromises]);
        setShowNotifications(false);
    };

    const handleDeleteMessage = async (msg) => {
        if(window.confirm("Permanently delete this message?")) {
            await deleteDoc(doc(db, "messages", msg.id));
            logImmutableAction("MESSAGE_DELETE", `Deleted content: "${msg.text || msg.fileName}"`, `Message ID: ${msg.id}`);
        }
    };

    const handleSaveEdit = async (msg) => {
        if (!editMessageText.trim()) { setEditingMessageId(null); return; }
        await updateDoc(doc(db, "messages", msg.id), { text: editMessageText, isEdited: true });
        logImmutableAction("MESSAGE_EDIT", `Original: "${msg.text}" | Edited: "${editMessageText}"`, `Message ID: ${msg.id}`);
        setEditingMessageId(null);
    };

    const handleSaveTaskTitle = async () => {
        if (!newTaskTitle.trim() || !selectedMessage) return;
        try {
            await updateDoc(doc(db, "messages", selectedMessage.id), { text: newTaskTitle });
            setSelectedMessage(prev => ({...prev, text: newTaskTitle}));
            setIsEditingTaskTitle(false);
            playTaskSound();
        } catch (e) { alert("Failed to update task title."); }
    };

    const setReminder = async () => {
        if (!selectedMessage || !reminderDateTime) return;
        try {
            await addDoc(collection(db, "reminders"), { userId: user.uid, userEmail: user.email, messageId: selectedMessage.id, messageText: selectedMessage.text || selectedMessage.fileName || "File Attachment", remindAt: reminderDateTime, isTriggered: false });
            await updateDoc(doc(db, "messages", selectedMessage.id), { hasReminder: true });
            setActiveModal(null); setReminderDateTime("");
        } catch (error) { alert("Failed to save reminder."); }
    };

    const convertToTask = async () => {
        if (!selectedMessage || !taskDeadline || taskAssignees.length === 0) return alert("Please select Assignees, Priority, and Deadline.");
        try {
            const now = new Date();
            await setDoc(doc(db, "messages", selectedMessage.id), {
                isTask: true,
                taskData: {
                    deadline: taskDeadline,
                    assignees: taskAssignees,
                    priority: taskPriority,
                    status: "Pending",
                    isArchived: false,
                    dismissedBy: [],
                    trail: [{
                        action: "Task Created",
                        by: user.email,
                        time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ', ' + now.toLocaleDateString(),
                        to: taskAssignees.map(a=>(a||"").split('@')[0]).join(', ')
                    }]
                }
            }, { merge: true });

            taskAssignees.forEach(email => {
                if (email !== user.email) {
                    const assigneeUser = dbUsers.find(u => u.email === email);
                    if (assigneeUser) {
                        addDoc(collection(db, "notifications"), {
                            userId: assigneeUser.uid,
                            type: "task",
                            text: `"${selectedMessage.text}" - Assigned to You 🕒`,
                            messageId: selectedMessage.id,
                            groupId: selectedMessage.groupId,
                            timestamp: serverTimestamp(),
                            isRead: false
                        }).catch(() => {});
                    }
                }
            });

            logImmutableAction("TASK_CREATE", `Converted to Task: "${selectedMessage.text}"`, `Assignees: ${taskAssignees.join(', ')} | Priority: ${taskPriority}`);
            setActiveModal(null); setTaskAssignees([]);
            playTaskSound();
        } catch (error) { alert("Failed to create task."); }
    };

    const handleDelegateTask = async () => {
        if (!selectedMessage || delegateAssignees.length === 0) return;
        try {
            const now = new Date();
            const updatedTrail = [...selectedMessage.taskData.trail, { action: "Delegated", by: user.email, time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ', ' + now.toLocaleDateString(), to: delegateAssignees.map(a=>(a||"").split('@')[0]).join(', ') }];
            await updateDoc(doc(db, "messages", selectedMessage.id), { "taskData.assignees": delegateAssignees, "taskData.status": "In Progress", "taskData.trail": updatedTrail, "taskData.dismissedBy": [] });
            await notifyInvolvedInTask(selectedMessage, `${(user.email||"").split('@')[0]} transferred a task.`);
            setActiveModal(null); setDelegateAssignees([]); setShowDelegateDropdown(false);
            playTaskSound();
        } catch (error) {}
    };

    const handleCompleteTask = async () => {
        if (!selectedMessage) return;
        if (!selectedMessage.taskData.assignees?.includes(user.email) && !currentUserData?.isAdmin && !isVipAdmin && selectedMessage.senderEmail !== user.email) return alert("Only the Assignees, Creator, or an Admin can complete this task.");
        try {
            const now = new Date();
            const updatedTrail = [...selectedMessage.taskData.trail, { action: "Marked Completed", by: user.email, time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ', ' + now.toLocaleDateString(), to: "System" }];
            await updateDoc(doc(db, "messages", selectedMessage.id), { "taskData.status": "Completed", "taskData.trail": updatedTrail });
            await notifyInvolvedInTask(selectedMessage, `${(user.email||"").split('@')[0]} marked a task as Completed.`);
            setActiveModal(null);
            playTaskSound();
        } catch (error) {}
    };

    const handleArchiveTask = async () => {
        if (!selectedMessage) return;
        if (!selectedMessage.taskData.assignees?.includes(user.email) && !currentUserData?.isAdmin && !isVipAdmin && selectedMessage.senderEmail !== user.email) return alert("Only Assignees, Creator, or Admin can archive.");
        try {
            await updateDoc(doc(db, "messages", selectedMessage.id), { "taskData.isArchived": true });
            setActiveModal(null);
        } catch (error) {}
    };

    const handleAddComment = async (closeModal = false) => {
        if (!selectedMessage || !trailComment.trim()) return;
        try {
            const now = new Date();
            const updatedTrail = [...selectedMessage.taskData.trail, { action: "Update Added", by: user.email, time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ', ' + now.toLocaleDateString(), comment: trailComment }];
            await updateDoc(doc(db, "messages", selectedMessage.id), { "taskData.trail": updatedTrail });
            await notifyInvolvedInTask(selectedMessage, `${(user.email||"").split('@')[0]} updated a task.`);
            setTrailComment("");
            setSelectedMessage(prev => ({...prev, taskData: {...prev.taskData, trail: updatedTrail}}));
            playTaskSound();
            if (closeModal) setActiveModal(null);
        } catch (error) {}
    };

    const handleAddInlineComment = async (targetMsg, commentText) => {
        if (!targetMsg || !commentText.trim()) return;
        try {
            const now = new Date();
            const updatedTrail = [...targetMsg.taskData.trail, { action: "Update Added", by: user.email, time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ', ' + now.toLocaleDateString(), comment: commentText }];
            await updateDoc(doc(db, "messages", targetMsg.id), { "taskData.trail": updatedTrail });
            await notifyInvolvedInTask(targetMsg, `${(user.email||"").split('@')[0]} updated a task.`);
            playTaskSound();
        } catch (error) {}
    };

    const handleToggleApprove = async (u) => { await updateDoc(doc(db, "users", u.uid), { isApproved: !u.isApproved }); };
    const handleEditUserSubmit = async (e) => {
        e.preventDefault();
        await updateDoc(doc(db, "users", adminForm.uid), { name: adminForm.name, isAdmin: adminForm.isAdmin, canCreateGroups: adminForm.canCreateGroups });
        setActiveModal(null);
    };

    const handleAdminArchiveGroup = async (groupId, groupName) => {
        if(window.confirm("Archive this department? Users will no longer see it.")) {
            await updateDoc(doc(db, "groups", groupId), { isArchived: true });
        }
    };

    const handleAdminRecoverGroup = async (groupId, groupName) => {
        if(window.confirm("Recover this department?")) {
            await updateDoc(doc(db, "groups", groupId), { isArchived: false });
        }
    };

    const handleDownloadAudit = () => {
        const doc = new jsPDF('landscape');
        doc.setFontSize(22); doc.setTextColor(0, 128, 105); doc.text("Talk & Task - Immutable Audit Ledger", 14, 22);
        doc.setFontSize(10); doc.setTextColor(100); doc.text(`Secure Report Generated on: ${new Date().toLocaleString()}`, 14, 30);
        const tableRows = filteredAuditLogs.map(log => [ `${log.dateString}\n${log.time}`, log.type, (log.user||'').split('@')[0], log.groupName || log.target || '-', log.content || '' ]);
        doc.autoTable({ startY: 36, head: [["Date & Time", "Action Type", "Initiated By", "Group/Target", "Encrypted Details"]], body: tableRows, theme: 'grid', styles: { fontSize: 9, cellPadding: 3 }, headStyles: { fillColor: [0, 128, 105], textColor: [255, 255, 255] }, alternateRowStyles: { fillColor: [240, 242, 245] }, columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 35 }, 2: { cellWidth: 35 }, 3: { cellWidth: 40 }, 4: { cellWidth: 'auto' } } });
        doc.save(`Secure_Audit_Ledger_${new Date().toISOString().split('T')[0]}.pdf`);
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

    const handleScheduleMessage = async (isTask = false, taskData = null) => {
        const text = pendingScheduledText || inputText.trim();
        const dt = scheduleDateTime || msgScheduleDateTime;
        if (!text || !dt || !activeGroup) return alert("Enter message text and a future date/time.");
        if (new Date(dt) <= new Date()) return alert("Scheduled time must be in the future.");
        try {
            const payload = { text, senderEmail: user.email, senderUid: user.uid, groupId: activeGroup.id, groupName: activeGroup.name, scheduledFor: dt, status: "pending", isTask: isTask, createdAt: serverTimestamp() };
            if (isTask && taskData) { payload.taskDeadline = taskData.deadline; payload.taskAssignees = taskData.assignees; }
            await addDoc(collection(db, "scheduled_messages"), payload);
            setInputText(""); setPendingScheduledText(""); setScheduleDateTime(""); setMsgScheduleDateTime(""); setShowScheduleInput(false); setActiveModal(null);
            playTaskSound(); alert(`✅ Scheduled for ${new Date(dt).toLocaleString()}`);
        } catch(e) { alert("Failed to schedule."); }
    };

    // ==================== RENDER ====================
    if (currentUserData && currentUserData.isApproved !== true && !currentUserData.isAdmin && !isVipAdmin) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100 p-4 text-gray-800">
                <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 border-t-8 border-[#4F46E5] text-center transform-gpu hover:scale-105 transition-transform">
                    <i className="fa-solid fa-user-clock text-5xl text-[#4F46E5] mb-4 animate-pulse"></i>
                    <h1 className="text-2xl font-bold mb-2">Pending Approval</h1>
                    <p className="text-sm text-gray-500 mb-6">Your Google Account requires Admin verification to join the portal.</p>
                    <button onClick={onLogout} className="bg-gray-100 text-gray-700 py-2 px-6 rounded-full font-bold shadow-sm hover:bg-gray-200 transition-colors">Sign Out</button>
                </div>
            </div>
        );
    }

    if (isWorkspaceLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-screen w-full bg-surface fixed inset-0 z-50">
          <div className="relative mb-8">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary to-primary-hover animate-pulse flex items-center justify-center shadow-2xl">
              <i className="fa-solid fa-list-check text-4xl text-white drop-shadow-lg"></i>
            </div>
            <div className="absolute -inset-3 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          </div>
          <h2 className="text-2xl font-bold text-text-primary mb-3 tracking-tight">Talk & Task</h2>
          <div className="w-56 h-2 bg-gray-200 rounded-full overflow-hidden mb-6">
            <div className="h-full bg-gradient-to-r from-primary via-primary-hover to-success animate-loading-bar rounded-full"></div>
          </div>
          <div className="text-text-secondary text-sm font-medium italic">
            {currentTip}
          </div>
        </div>
      );
    }
    
    return (
        <div className="flex h-screen w-full bg-[#f3f4f6] text-[#111b21] overflow-hidden relative font-sans transition-opacity duration-700 ease-out opacity-100">
            <audio id="app-sound" src="https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3?filename=success-1-6297.mp3" preload="auto" className="hidden"></audio>

            {viewMode === "admin" ? (
                <AdminPanel
                    setViewMode={setViewMode} setActiveModal={setActiveModal} dbUsers={dbUsers} groups={groups}
                    filteredAuditLogs={filteredAuditLogs} adminFilterUser={adminFilterUser} setAdminFilterUser={setAdminFilterUser}
                    adminFilterDate={adminFilterDate} setAdminFilterDate={setAdminFilterDate} adminFilterType={adminFilterType}
                    setAdminFilterType={setAdminFilterType} adminFilterGroup={adminFilterGroup} setAdminFilterGroup={setAdminFilterGroup}
                    handleDownloadAudit={handleDownloadAudit} handleToggleApprove={handleToggleApprove} setAdminForm={setAdminForm}
                    setGroupForm={setGroupForm} setEditingGroup={setEditingGroup} handleAdminArchiveGroup={handleAdminArchiveGroup}
                    handleAdminRecoverGroup={handleAdminRecoverGroup}
                />
            ) : (
                <div className="flex h-full w-full relative">
                    <LeftSidebar 
                        user={user} currentUserData={currentUserData} myGroups={myGroups} dmUsers={dmUsers} activeGroup={activeGroup} setActiveGroup={setActiveGroup}
                        setShowRightSidebar={setShowRightSidebar} setMobileSidebarOpen={setMobileSidebarOpen} 
                        getUnreadInfoForUser={getUnreadInfoForUser}
                        getUnreadInfoForGroup={getUnreadInfoForGroup}
                        messages={messages} onLogout={onLogout} setActiveModal={setActiveModal} setGroupForm={setGroupForm} setEditingGroup={setEditingGroup}
                        sidebarSearch={sidebarSearch} setSidebarSearch={setSidebarSearch} mobileSidebarOpen={mobileSidebarOpen} isVipAdmin={isVipAdmin} setViewMode={setViewMode}
                    />
                    
                    {!activeGroup ? (
                        <div className="flex-1 flex flex-col items-center justify-center bg-[#f0f2f5] text-center p-8 relative">
                            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm mb-6 text-[#00a884] ring-4 ring-white border border-slate-100">
                                <i className="fa-solid fa-comments text-4xl"></i>
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 mb-2">Welcome to Talk & Task</h2>
                            <p className="text-slate-500 mb-8 max-w-md">Select a department or direct message from the sidebar to start collaborating, or create a new workspace.</p>
                            {(currentUserData?.isAdmin || isVipAdmin || currentUserData?.canCreateGroups) && (
                                <button
                                    onClick={() => { setGroupForm({name: "", members: [], admins: [], profilePicUrl: null}); setEditingGroup(null); setActiveModal('group_form_modal'); }}
                                    className="w-full max-w-xs bg-primary text-white px-6 py-3.5 rounded-xl font-bold shadow-sm hover:bg-primary-hover transition-all"
                                >
                                    <i className="fa-solid fa-layer-group mr-2"></i> Create Department
                                </button>
                            )}                            
                        </div>
                    ) : (
                       <div className="flex-1 flex flex-col relative h-full bg-[#efeae2] overflow-hidden wa-bg min-w-0">
                            <div className="h-[59px] bg-[#f0f2f5] flex items-center justify-between px-3 md:px-4 shrink-0 z-30 sticky top-0 border-b border-slate-200/60 safe-top">
                                <button onClick={() => setMobileSidebarOpen(true)} className="md:hidden w-10 h-10 rounded-full hover:bg-primary/10 flex items-center justify-center text-primary mr-1 shrink-0">
                                  <i className="fa-solid fa-bars text-xl"></i>
                                </button>
                                
                                <div className="flex items-center gap-3 cursor-pointer flex-1 min-w-0" onClick={()=>{ if(!activeGroup.isDM) setActiveModal('group_settings'); }}>
                                    {activeGroup.isDM ? <MemoizedAvatar uid={activeGroup.id} url={null} name={activeGroup.name} sizeClass="w-10 h-10" /> : activeGroup.profilePicUrl ? <MemoizedAvatar uid={activeGroup.id} url={activeGroup.profilePicUrl} name={activeGroup.name} sizeClass="w-10 h-10" /> : <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-[#800020] shadow-sm"><i className="fa-solid fa-users"></i></div>}
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <span className={`text-[16px] font-bold leading-tight truncate ${activeGroup.isDM ? 'text-[#111b21]' : 'text-[#800020]'}`}>{activeGroup.name}</span>
                                        <span className="text-[13px] text-primary truncate max-w-[150px] lg:max-w-[400px]">
                                            {activeGroup.isDM ? 'End-to-Server Encrypted' :
                                                (dbUsers.filter(u => activeGroup.members?.includes(u.email) && u.lastActive && (Date.now() - (u.lastActive?.toMillis?.() || 0) < 900000) && u.uid !== user.uid).length > 0)
                                                ? dbUsers.filter(u => activeGroup.members?.includes(u.email) && u.lastActive && (Date.now() - (u.lastActive?.toMillis?.() || 0) < 900000) && u.uid !== user.uid).map(u=>u.name.split(' ')[0]).join(', ') + ' (Online)'
                                                : `${activeGroup.members?.length||0} Members`
                                            }
                                        </span>
                                    </div>
                                </div>

                                <div className="hidden md:flex flex-1 max-w-md mx-4">
                                    <div className="bg-white rounded-full flex items-center px-4 py-1.5 shadow-sm border border-slate-200 focus-within:ring-2 focus-within:ring-[#00a884]/30 focus-within:border-[#00a884] transition-all w-full">
                                        <i className="fa-solid fa-search text-[14px] text-primary mr-2"></i>
                                        <input type="text" placeholder="Search messages..." className="bg-transparent outline-none flex-1 text-[13px] text-[#111b21] placeholder-[#8696a0]" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                                        {searchQuery && <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600 ml-1"><i className="fa-solid fa-xmark text-xs"></i></button>}
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-1 shrink-0 relative">
                                  <button onClick={() => setShowFilterMenu(!showFilterMenu)} className="w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-colors text-primary hover:bg-primary/10" title="Filter Messages">
                                    <i className="fa-solid fa-sliders"></i>
                                  </button>
                                  {showFilterMenu && (
                                    <div className="absolute top-[55px] right-24 bg-white rounded-lg shadow-lg z-50 overflow-hidden animate-in fade-in py-2 w-48 border">
                                      {['all','tasks-pending','tasks-completed','messages','today','bookmarked'].map(f => (
                                        <div key={f} onClick={() => { setChatFilter(f); setShowFilterMenu(false); }} className={`px-4 py-2.5 text-[14px] cursor-pointer transition-colors flex items-center gap-3 ${chatFilter === f ? 'bg-primary-light text-primary' : 'text-text-primary hover:bg-gray-50'}`}>
                                          {f === 'bookmarked' ? 'Saved Messages' : f === 'all' ? 'All Content' : f.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  <button onClick={() => setActiveModal('task_analytics')} className="w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-colors text-primary hover:bg-primary/10" title="Task Analytics">
                                    <i className="fa-solid fa-chart-pie"></i>
                                  </button>

                                  <div className="relative">
                                    <button onClick={() => setShowNotifications(!showNotifications)} className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-colors ${showNotifications ? 'bg-primary-light text-primary' : 'text-primary hover:bg-primary/10'} text-[19px] relative`}>
                                      <i className="fa-solid fa-bell"></i>
                                      {totalNotifications > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-success rounded-full border border-white"></span>}
                                    </button>

                                    {showNotifications && (
                                      <div className="absolute top-full right-0 mt-2 w-80 max-w-[90vw] bg-white rounded-lg shadow-[0_2px_5px_0_rgba(11,20,26,.26),0_2px_10px_0_rgba(11,20,26,.16)] z-50 overflow-hidden animate-in slide-in-from-top-2 border border-slate-100">
                                        <div className="p-3 bg-white flex justify-between items-center border-b border-slate-100">
                                          <span className="text-[15px] font-bold text-slate-800">Activity Feed</span>
                                          <button onClick={handleClearNotifications} className="text-[12px] text-[#00a884] font-semibold hover:underline">Clear All</button>
                                        </div>
                                        <div className="max-h-[70vh] overflow-y-auto bg-slate-50 p-2">
                                          {totalNotifications === 0 ? (
                                            <div className="p-8 text-center text-[14px] text-[#54656f]">No new activity</div>
                                          ) : (
                                            <div className="flex flex-col gap-1">
                                              
                                              {activeActionableTasks.length > 0 && (
                                                <div className="mb-2">
                                                  <div className="px-2 pb-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Action Required</div>
                                                  <div className="space-y-2">
                                                    {[...activeActionableTasks]
                                                      .sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0))
                                                      .map(task => {
                                                        const timeStr = task.timestamp?.toDate ? new Date(task.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                                                        return (
                                                          <div key={task.id} onClick={() => navigateToMessageFromNotification(task.id, task.groupId)} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-slate-300 transition-all relative">
                                                            <div className="text-[13px] font-bold text-[#00a884] mb-1.5 flex items-center justify-between">
                                                              <span className="flex items-center"><i className="fa-regular fa-square-check mr-1.5"></i>Pending Task</span>
                                                              <span className="text-[10px] text-slate-400 font-semibold">{timeStr}</span>
                                                            </div>
                                                            <div className="text-[14px] text-[#111b21] line-clamp-2 leading-snug font-medium">"{task.text}"</div>
                                                            <div className="text-[12px] text-[#00a884] font-semibold mt-1">Assigned to You 🕒</div>
                                                          </div>
                                                        );
                                                      })}
                                                  </div>
                                                </div>
                                              )}

                                              {genericNotifications.length > 0 && (
                                                <div>
                                                  {activeActionableTasks.length > 0 && <div className="border-t border-slate-200 my-3 mx-2"></div>}
                                                  <div className="px-2 pb-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Recent Updates</div>
                                                  <div className="space-y-2">
                                                    {genericNotifications.map(n => {
                                                      const timeStr = n.timestamp?.toDate ? new Date(n.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now';
                                                      return (
                                                        <div key={n.id} onClick={() => { if (n.messageId) navigateToMessageFromNotification(n.messageId, n.groupId || activeGroup?.id); }} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-slate-300 transition-all flex items-start gap-3 relative">
                                                          <div className="w-8 h-8 rounded-full bg-[#d9fdd3] flex items-center justify-center text-[#00a884] shrink-0 mt-0.5">
                                                            <i className={n.type === 'reply' ? 'fa-solid fa-reply text-xs' : n.type === 'mention' ? 'fa-solid fa-at text-xs' : 'fa-solid fa-bolt text-xs'}></i>
                                                          </div>
                                                          <div className="flex-1 overflow-hidden pb-4">
                                                            <div className="text-[14px] font-bold text-[#111b21]">{n.type === 'reply' ? 'New Reply' : n.type === 'message' ? 'Direct Message' : n.type === 'mention' ? 'Mentioned You' : n.type === 'task' ? 'Task Update' : 'New Reaction'}</div>
                                                            <div className="text-[13px] text-[#54656f] mt-0.5 leading-snug line-clamp-2 break-words font-medium">{n.text}</div>
                                                          </div>
                                                          <div className="absolute bottom-3 right-3 text-[10px] text-slate-400 font-semibold bg-white pl-2">{timeStr}</div>
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

                                  <button onClick={() => setShowRightSidebar(!showRightSidebar)} className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-colors ${showRightSidebar ? 'bg-primary-light text-primary' : 'text-primary hover:bg-primary/10'} text-[19px]`} title="Task Hub">
                                    <i className="fa-solid fa-clipboard-list"></i>
                                  </button>
                                  
                                  {/* 👇 FIX: Hidden button to trigger task wipe via admin or testing */}
                                  {(currentUserData?.isAdmin || isVipAdmin) && (
                                    <button onClick={handleWipeAllTasks} className="ml-2 bg-red-100 text-red-600 px-2 py-1 rounded text-xs font-bold hover:bg-red-200">Wipe Tasks</button>
                                  )}
                                </div>
                            </div>
                            
                            <ChatView
                                messagesToRender={messagesToRender} messages={messages} activeGroup={activeGroup} user={user} currentUserData={currentUserData}
                                isVipAdmin={isVipAdmin} pinnedMessages={pinnedMessages} typingStatus={typingStatus} replyingTo={replyingTo}
                                setReplyingTo={setReplyingTo} toolPreferences={toolPreferences} dbUsers={dbUsers} groups={groups} setActiveGroup={setActiveGroup}
                                setShowRightSidebar={setShowRightSidebar} setMobileSidebarOpen={setMobileSidebarOpen} 
                                pendingScrollTarget={pendingScrollTarget} setPendingScrollTarget={setPendingScrollTarget}
                                setActiveModal={setActiveModal} scrollToMessageDirect={scrollToMessageDirect} handleReaction={handleReaction}
                                handleToggleBookmark={handleToggleBookmark} handleTogglePin={handleTogglePin} handleDeleteMessage={handleDeleteMessage}
                                chatInputRef={chatInputRef} editingMessageId={editingMessageId} editMessageText={editMessageText}
                                setEditingMessageId={setEditingMessageId} setEditMessageText={setEditMessageText} handleSaveEdit={handleSaveEdit}
                                setSelectedMessage={setSelectedMessage} setIsEditingTaskTitle={setIsEditingTaskTitle} messagesEndRef={messagesEndRef}
                                chatContainerRef={chatContainerRef} isAtBottom={isAtBottom} setIsAtBottom={setIsAtBottom} highlightedMsgId={highlightedMsgId}
                                unreadHighlightIds={unreadHighlightIds} handleAddInlineComment={handleAddInlineComment}
                            />

                            <InputArea
                                inputText={inputText} setInputText={setInputText} isOnline={isOnline} isUploading={isUploading} activeGroup={activeGroup}
                                replyingTo={replyingTo} setReplyingTo={setReplyingTo} handleSendOfflineAware={handleSendOfflineAware}
                                handleTypingEvent={handleTypingEvent} handlePaste={handlePaste} chatInputRef={chatInputRef} fileInputRef={fileInputRef}
                                handleFileUpload={handleFileUpload} emojiPickerOpen={emojiPickerOpen} setEmojiPickerOpen={setEmojiPickerOpen}
                                emojiPickerRef={emojiPickerRef} pendingFiles={pendingFiles} setPendingFiles={setPendingFiles} showFileRename={showFileRename}
                                setShowFileRename={setShowFileRename} uploadFileDirectly={uploadFileDirectly} setActiveModal={setActiveModal}
                                setPendingScheduledText={setPendingScheduledText} offlineDrafts={offlineDrafts} user={user} dbUsers={dbUsers}
                                groups={groups} currentUserData={currentUserData} MAX_FILE_SIZE_MB={MAX_FILE_SIZE_MB} handleSendPendingFiles={handleSendPendingFiles}
                            />
                        </div>
                    )}

                    {showRightSidebar && (
                      <RightSidebar
                        showRightSidebar={showRightSidebar} setShowRightSidebar={setShowRightSidebar} tasksAssignedToMe={tasksAssignedToMe}
                        tasksAssignedByMe={tasksAssignedByMe} groups={groups} dbUsers={dbUsers} user={user} setActiveGroup={setActiveGroup}
                        setSelectedMessage={setSelectedMessage} setIsEditingTaskTitle={setIsEditingTaskTitle} setActiveModal={setActiveModal}
                      />
                    )}

                    {/* --- MODALS --- */}
                    {activeModal === 'context' && <ContextMenuModal selectedMessage={selectedMessage} setActiveModal={setActiveModal} setReplyingTo={setReplyingTo} chatInputRef={chatInputRef} />}
                    {activeModal === 'edit_profile' && <ProfileSettingsModal setActiveModal={setActiveModal} currentUserData={currentUserData} profileForm={profileForm} setProfileForm={setProfileForm} profilePicInputRef={profilePicInputRef} profileUploadProgress={profileUploadProgress} setProfileUploadProgress={setProfileUploadProgress} handleProfileSubmit={handleProfileSubmit} toolPreferences={toolPreferences} setToolPreferences={setToolPreferences} user={user} />}
                    {activeModal === 'group_form_modal' && <GroupFormModal setActiveModal={setActiveModal} groupForm={groupForm} setGroupForm={setGroupForm} editingGroup={editingGroup} handleGroupSubmit={handleGroupSubmit} groupPicInputRef={groupPicInputRef} handleGroupPicUpload={handleGroupPicUpload} groupPicUploadProgress={groupPicUploadProgress} dbUsers={dbUsers} user={user} />}
                    {activeModal === 'group_settings' && <GroupSettingsModal setActiveModal={setActiveModal} activeGroup={activeGroup} groupForm={groupForm} setGroupForm={setGroupForm} dbUsers={dbUsers} user={user} currentUserData={currentUserData} isVipAdmin={isVipAdmin} handleUpdateGroupMembers={handleUpdateGroupMembers} onGroupUpdate={onGroupUpdate} />}
                    {activeModal === 'task_trail' && selectedMessage?.taskData && <TaskTrailModal selectedMessage={selectedMessage} setSelectedMessage={setSelectedMessage} activeModal={activeModal} setActiveModal={setActiveModal} isEditingTaskTitle={isEditingTaskTitle} setIsEditingTaskTitle={setIsEditingTaskTitle} newTaskTitle={newTaskTitle} setNewTaskTitle={setNewTaskTitle} handleSaveTaskTitle={handleSaveTaskTitle} delegateAssignees={delegateAssignees} setDelegateAssignees={setDelegateAssignees} showDelegateDropdown={showDelegateDropdown} setShowDelegateDropdown={setShowDelegateDropdown} handleDelegateTask={handleDelegateTask} trailComment={trailComment} setTrailComment={setTrailComment} handleAddComment={handleAddComment} handleCompleteTask={handleCompleteTask} handleArchiveTask={handleArchiveTask} trailFileInputRef={trailFileInputRef} handleTrailFileUpload={handleTrailFileUpload} activeGroup={activeGroup} dbUsers={dbUsers} user={user} currentUserData={currentUserData} isVipAdmin={isVipAdmin} />}
                    {activeModal === 'task_convert' && <TaskConvertModal setActiveModal={setActiveModal} taskAssignees={taskAssignees} setTaskAssignees={setTaskAssignees} taskDeadline={taskDeadline} setTaskDeadline={setTaskDeadline} convertToTask={convertToTask} activeGroup={activeGroup} taskPriority={taskPriority} setTaskPriority={setTaskPriority} dbUsers={dbUsers} />}
                    {activeModal === 'reminder' && <ReminderModal setActiveModal={setActiveModal} reminderDateTime={reminderDateTime} setReminderDateTime={setReminderDateTime} setReminder={setReminder} />}
                    {activeModal === 'schedule_send' && <ScheduleSendModal setActiveModal={setActiveModal} scheduleDateTime={scheduleDateTime} setScheduleDateTime={setScheduleDateTime} pendingScheduledText={pendingScheduledText} handleScheduleMessage={handleScheduleMessage} />}
                    {activeModal === 'admin_edit_user' && <AdminEditUserModal setActiveModal={setActiveModal} adminForm={adminForm} setAdminForm={setAdminForm} handleEditUserSubmit={handleEditUserSubmit} />}
                    {activeModal === 'task_analytics' && <TaskAnalyticsModal setActiveModal={setActiveModal} analyticsData={analyticsData} />}
                    {isUploading && <UploadOverlay uploadProgress={uploadProgress} fileName="" />}
                    
                    <Toast toasts={toasts} removeToast={removeToast} />
                </div>
            )}
        </div>
    );
}
