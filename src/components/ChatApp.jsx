import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { auth, db, storage } from '../firebase.js';
import { onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup, setPersistence, inMemoryPersistence } from 'firebase/auth';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc, setDoc, getDocs, where, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

import AdminPanel from './Admin/AdminPanel.jsx';
import LeftSidebar from './Sidebar/LeftSidebar.jsx';
import RightSidebar from './Sidebar/RightSidebar.jsx';
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
import MemoizedAvatar from './Common/MemoizedAvatar.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import { compressImage } from '../utils/imageUtils.js';

const lockExtension = (originalName, newName) => {
  const originalExt = originalName.split('.').pop().toLowerCase();
  const baseName = newName.replace(/\.[^/.]+$/, '');
  return `${baseName}.${originalExt}`;
};

const toSentenceCase = (str) => {
    if (!str) return "";
    return str.toLowerCase().replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase());
};

const formatMessageText = (text) => {
    if (!text) return '';
    const safeText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return safeText
        .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
        .replace(/_(.*?)_/g, '<em>$1</em>')
        .replace(/~(.*?)~/g, '<del>$1</del>')
        .replace(/\n/g, '<br/>');
};

const EMOJI_LIST = ['😀','😂','🤣','😍','🥰','😘','😜','🤪','😎','🤩','😇','🙂','😊','🥳','😡','🤬','💀','👻','👍','👎','❤️','🔥','⭐','✨','🎉','💯','✅','❌','🤔','🙏','💪','🤝','👋','🙌','🤲','🫶','👀','🗣️','💬','📎','📌','🗑️','✏️','📷','🎵','🌈','🍕'];

export function ChatApp({ user, onLogout }) {
    // --- View & Modal States ---
    const [isVipAdmin, setIsVipAdmin] = useState(false);
    const [activeModal, setActiveModal] = useState(null);
    const [showRightSidebar, setShowRightSidebar] = useState(false);
    const [viewMode, setViewMode] = useState("chat");
    const [showFilterMenu, setShowFilterMenu] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [isAtBottom, setIsAtBottom] = useState(true);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(true);

    // --- Chat Interaction States ---
    const [inputText, setInputText] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [sidebarSearch, setSidebarSearch] = useState("");
    const [chatFilter, setChatFilter] = useState("all");
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [replyingTo, setReplyingTo] = useState(null);
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [editMessageText, setEditMessageText] = useState("");

    // --- Task specific states ---
    const [taskAssignees, setTaskAssignees] = useState([]);
    const [taskDeadline, setTaskDeadline] = useState("");
    const [delegateAssignees, setDelegateAssignees] = useState([]);
    const [showDelegateDropdown, setShowDelegateDropdown] = useState(false);
    const [trailComment, setTrailComment] = useState("");
    const [reminderDateTime, setReminderDateTime] = useState("");
    const [isEditingTaskTitle, setIsEditingTaskTitle] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState("");

    // --- Data Stream Arrays (Firestore Sync) ---
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

    // --- Admin/Form Management States ---
    const [adminForm, setAdminForm] = useState({ uid: '', name: '', email: '', password: '', isAdmin: false, canCreateGroups: false });
    const [profileForm, setProfileForm] = useState({ name: "", fontSize: "text-[14.2px]", fontFamily: "font-sans" });
    const [groupForm, setGroupForm] = useState({ name: "", members: [], admins: [], profilePicUrl: null });
    const [editingGroup, setEditingGroup] = useState(null);
    const [adminFilterUser, setAdminFilterUser] = useState("");
    const [adminFilterDate, setAdminFilterDate] = useState("");
    const [adminFilterType, setAdminFilterType] = useState("");
    const [adminFilterGroup, setAdminFilterGroup] = useState("");

    // --- File Upload & Rename States ---
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [trailFileUploading, setTrailFileUploading] = useState(false);
    const [profileUploadProgress, setProfileUploadProgress] = useState(0);
    const [groupPicUploadProgress, setGroupPicUploadProgress] = useState(0);
    
    const [pendingFiles, setPendingFiles] = useState([]);
    const [showFileRename, setShowFileRename] = useState(false);
    const MAX_FILE_SIZE_MB = 10;

    // --- DOM Element References ---
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
    const [pendingScrollTarget, setPendingScrollTarget] = useState(null);

    const loaderTips = [
        "Tip: Type '@' to instantly mention your peers or entire departments.",
        "Tip: Convert any message into an official trackable Task using the context menu.",
        "Tip: Your session will automatically secure and log out after 5 minutes of inactivity.",
        "Tip: Admins can download Immutable Audit Logs in PDF format from the Dashboard.",
        "Tip: Pressing 'Enter' instantly submits your Task Updates."
    ];
    const [currentTip, setCurrentTip] = useState(loaderTips[0]);

    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
    const [highlightedMsgId, setHighlightedMsgId] = useState(null);

    const [toolPreferences, setToolPreferences] = useState({
        reply: true, react: true, edit: true, delete: true, pin: true, bookmark: true, showWatermark: true, soundProfile: 'classic'
    });

    // Scheduled Messages
    const [scheduledMessages, setScheduledMessages] = useState([]);
    const [scheduleDateTime, setScheduleDateTime] = useState("");
    const [showScheduleInput, setShowScheduleInput] = useState(false);
    const [pendingScheduledText, setPendingScheduledText] = useState("");

    // Task Analytics
    const [analyticsView, setAnalyticsView] = useState("overview");

    // Recurring Task Templates
    const [taskTemplates, setTaskTemplates] = useState([]);
    const [templateForm, setTemplateForm] = useState({ title: "", assignees: [], deadlineDays: 1, groupId: "", recurring: "once", category: "General" });
    const [editingTemplate, setEditingTemplate] = useState(null);

    // Offline Draft Queue
    const [offlineDrafts, setOfflineDrafts] = useState([]);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    // Inactivity Warning
    const [showInactivityWarning, setShowInactivityWarning] = useState(false);
    const [inactivityCountdown, setInactivityCountdown] = useState(60);
    const inactivityTimerRef = useRef(null);
    const inactivityCountdownRef = useRef(null);
    const lastActivityRef = useRef(Date.now());

    // Scheduled Message
    const [msgScheduleDateTime, setMsgScheduleDateTime] = useState("");

    // ==========================================
    // MISSING FUNCTION INJECTED HERE
    // ==========================================
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

    useEffect(() => {
        let tipIndex = 0;
        const tipInterval = setInterval(() => {
            tipIndex = (tipIndex + 1) % loaderTips.length;
            setCurrentTip(loaderTips[tipIndex]);
        }, 1500);
        const timer = setTimeout(() => {
            clearInterval(tipInterval);
            setIsWorkspaceLoading(false);
            setIsLoaded(true);
        }, 4000);
        return () => { clearTimeout(timer); clearInterval(tipInterval); };
    }, []);

    useEffect(() => {
        const primeAudio = () => {
            if (!window.audioPrimed) {
                const audioEl = document.getElementById('app-sound');
                const taskAudioEl = document.getElementById('task-sound');
                if (audioEl) { audioEl.volume = 0; audioEl.play().then(() => { audioEl.pause(); audioEl.currentTime = 0; audioEl.volume = 1.0; window.audioPrimed = true; }).catch(()=>{}); }
                if (taskAudioEl) { taskAudioEl.volume = 0; taskAudioEl.play().then(() => { taskAudioEl.pause(); taskAudioEl.currentTime = 0; taskAudioEl.volume = 1.0; }).catch(()=>{}); }
            }
        };
        window.addEventListener('click', primeAudio, { once: true });
        window.addEventListener('touchstart', primeAudio, { once: true });
        return () => { window.removeEventListener('click', primeAudio); window.removeEventListener('touchstart', primeAudio); };
    }, []);

    useEffect(() => {
        let timeoutId;
        const INACTIVITY_LIMIT = 5 * 60 * 1000;
        const resetTimer = () => { clearTimeout(timeoutId); timeoutId = setTimeout(() => { onLogout(); }, INACTIVITY_LIMIT); };
        window.addEventListener('mousemove', resetTimer);
        window.addEventListener('keydown', resetTimer);
        window.addEventListener('click', resetTimer);
        window.addEventListener('touchstart', resetTimer);
        window.addEventListener('scroll', resetTimer, true);
        resetTimer();
        return () => {
            clearTimeout(timeoutId);
            window.removeEventListener('mousemove', resetTimer);
            window.removeEventListener('keydown', resetTimer);
            window.removeEventListener('click', resetTimer);
            window.removeEventListener('touchstart', resetTimer);
            window.removeEventListener('scroll', resetTimer, true);
        };
    }, [onLogout]);

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
        const audioUrls = {
            classic: "https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3",
            soft: "https://cdn.pixabay.com/download/audio/2022/03/15/audio_793bdf2292.mp3",
            subtle: "https://cdn.pixabay.com/download/audio/2022/03/10/audio_c8c8a73467.mp3"
        };
        const audioEl = document.getElementById('app-sound');
        if (audioEl && window.audioPrimed) {
            audioEl.src = audioUrls[toolPreferences.soundProfile || 'classic'] || audioUrls.classic;
            audioEl.currentTime = 0; audioEl.volume = 1.0;
            audioEl.play().catch(e => console.warn("Browser blocked audio:", e));
        }
    }, [toolPreferences.soundProfile]);

    const playTaskSound = useCallback(() => {
        try {
            const audio = new Audio("https://cdn.pixabay.com/download/audio/2021/08/09/audio_9ed1023bc2.mp3?filename=correct-2-46134.mp3");
            audio.volume = 0.8;
            audio.play().catch(()=>{});
        } catch(e) {}
    }, []);

    useEffect(() => {
        const q = query(collection(db, "messages"), orderBy("timestamp", "asc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const loadedMessages = snapshot.docs.map(docSnapshot => {
                const data = docSnapshot.data();
                return { id: docSnapshot.id, ...data, sender: data.senderEmail, isMine: data.senderUid === user.uid, time: data.timestamp?.toDate ? new Date(data.timestamp.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Sending...', dateString: data.timestamp?.toDate ? new Date(data.timestamp.toDate()).toISOString().split('T')[0] : '', isTask: data.isTask === true, groupId: data.groupId || "demo", reactions: data.reactions || {}, seenBy: data.seenBy || [], bookmarkedBy: data.bookmarkedBy || [], isPinned: data.isPinned || false, deliveredTo: data.deliveredTo || [], forwardedFromGroup: data.forwardedFromGroup, isPrivateForward: data.isPrivateForward, isMentionNotification: data.isMentionNotification, mentionedInGroup: data.mentionedInGroup, mentionedInGroupId: data.mentionedInGroupId, originalMessageId: data.originalMessageId, originalTextSnippet: data.originalTextSnippet };
            });
            setMessages(loadedMessages);
            if (prevMessagesCountRef.current > 0 && loadedMessages.length > prevMessagesCountRef.current && !isWorkspaceLoading) {
                const newMsg = loadedMessages[loadedMessages.length - 1];
                if (!newMsg.isMine && Date.now() - (newMsg.timestamp?.toMillis?.() || Date.now()) < 5000) {
                    playAlertSound();
                    if (document.hidden && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
                        navigator.serviceWorker.controller.postMessage({ type: 'SHOW_NOTIFICATION', title: `New Message from ${(newMsg.sender || "").split('@')[0]}`, body: newMsg.text || 'Sent an attachment' });
                    }
                }
            }
            prevMessagesCountRef.current = loadedMessages.length;
            
            if(!pendingScrollTarget) {
                setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 150);
            }
        });

        const unsubTyping = onSnapshot(collection(db, "typing"), (snapshot) => {
            const typingData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            const currentTyping = typingData.filter(t => t.groupId === activeGroup?.id && t.name && Date.now() - t.timestamp < 3000);
            setTypingStatus(currentTyping);
        });

        return () => { unsubscribe(); unsubTyping(); };
    }, [user.uid, activeGroup?.id, playAlertSound, isWorkspaceLoading, pendingScrollTarget]);

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
        const handleClickOutside = (e) => { if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) { setEmojiPickerOpen(false); } };
        if (emojiPickerOpen) { document.addEventListener('mousedown', handleClickOutside); document.addEventListener('touchstart', handleClickOutside); }
        return () => { document.removeEventListener('mousedown', handleClickOutside); document.removeEventListener('touchstart', handleClickOutside); };
    }, [emojiPickerOpen]);

    useEffect(() => { return () => { if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current); }; }, []);
    
    useEffect(() => {
        if (!user?.email) return;
        const q = query(collection(db, "scheduled_messages"), where("senderEmail", "==", user.email));
        const unsub = onSnapshot(q, snap => {
            setScheduledMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        const hb = setInterval(async () => {
            const now = new Date();
            const dueQ = query(collection(db, "scheduled_messages"), where("senderEmail", "==", user.email), where("status", "==", "pending"));
            const dueSnap = await getDocs(dueQ);
            for (const d of dueSnap.docs) {
                const sm = d.data();
                if (new Date(sm.scheduledFor) <= now) {
                    try {
                        const mentions = [];
                        (dbUsers || []).forEach(u => { if ((sm.text||"").toLowerCase().includes(`@${(u.name||"").toLowerCase()}`)) mentions.push(u.email); });
                        const isPrivate = mentions.length > 0 && sm.groupId && !sm.isDM;
                        if (sm.isTask) {
                            await addDoc(collection(db, "messages"), {
                                text: sm.text, senderUid: user.uid, senderEmail: user.email, timestamp: serverTimestamp(),
                                isTask: true, isPrivateMention: false, allowedUsers: [], seenBy: [user.email], deliveredTo: [user.email],
                                isPinned: false, bookmarkedBy: [], fileUrl: null, fileName: null, fileType: null,
                                groupId: sm.groupId, reactions: {},
                                taskData: { deadline: sm.taskDeadline, assignees: sm.taskAssignees || [], status: "Pending", isArchived: false, dismissedBy: [],
                                    trail: [{ action: "Task Created (Scheduled)", by: user.email, time: new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) + ', ' + new Date().toLocaleDateString(), to: (sm.taskAssignees||[]).map(a=>(a||"").split('@')[0]).join(', ') }] }
                            });
                        } else {
                            await addDoc(collection(db, "messages"), {
                                text: sm.text, senderUid: user.uid, senderEmail: user.email, timestamp: serverTimestamp(),
                                isTask: false, hasReminder: false, isPrivateMention: isPrivate, allowedUsers: isPrivate ? [...new Set([user.email, ...mentions])] : [],
                                seenBy: [user.email], deliveredTo: [user.email], isPinned: false, bookmarkedBy: [], fileUrl: null, fileName: null, fileType: null,
                                groupId: sm.groupId, reactions: {}
                            });
                        }
                        await updateDoc(doc(db, "scheduled_messages", d.id), { status: "sent" });
                        logImmutableAction("SCHEDULED_SENT", `Scheduled ${sm.isTask ? 'task' : 'message'} delivered: "${sm.text}"`, `Group ID: ${sm.groupId}`);
                        playTaskSound();
                    } catch(e) {}
                }
            }
        }, 30000);
        return () => { unsub(); clearInterval(hb); };
    }, [user?.email, user?.uid, dbUsers]);

    useEffect(() => {
        if (!user?.uid) return;
        const unsub = onSnapshot(collection(db, "task_templates"), snap => {
            setTaskTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, [user?.uid]);

    useEffect(() => {
        const goOnline = () => {
            setIsOnline(true);
            flushOfflineDrafts();
        };
        const goOffline = () => setIsOnline(false);
        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);
        loadOfflineDrafts();
        return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
    }, []);

    useEffect(() => {
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
    
    const triggerHighlight = useCallback((msgId) => {
        setHighlightedMsgId(msgId);
        if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = setTimeout(() => { setHighlightedMsgId(null); }, 3100);
    }, []);

    useEffect(() => {
        if (pendingScrollTarget && activeGroup) {
            const el = document.getElementById(`msg-${pendingScrollTarget}`);
            if (el) {
                setTimeout(() => {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    triggerHighlight(pendingScrollTarget);
                    setPendingScrollTarget(null);
                }, 200);
            }
        }
    }, [messages, pendingScrollTarget, activeGroup, triggerHighlight]);

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

    const tasksAssignedToMe = useMemo(() => {
        return messages.filter(m => m.isTask && m.taskData?.assignees?.includes(user.email) && !m.taskData?.isArchived)
            .sort((a,b) => new Date(a.taskData.deadline).getTime() - new Date(b.taskData.deadline).getTime());
    }, [messages, user.email]);

    const tasksAssignedByMe = useMemo(() => {
        return messages.filter(m => m.isTask && m.senderEmail === user.email && !m.taskData?.isArchived)
            .sort((a,b) => new Date(a.taskData.deadline).getTime() - new Date(b.taskData.deadline).getTime());
    }, [messages, user.email]);

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
        const staffMap = {};
        allTasks.forEach(task => {
            (task.taskData?.assignees || []).forEach(email => {
