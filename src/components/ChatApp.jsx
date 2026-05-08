import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { auth, db, storage } from '../firebase.js';
import { signOut } from 'firebase/auth';
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
import ChatView from './Chat/ChatView.jsx';
import InputArea from './Chat/InputArea.jsx';
import { compressImage } from '../utils/imageUtils.js';

const lockExtension = (originalName, newName) => {
  const originalExt = originalName.split('.').pop().toLowerCase();
  const baseName = newName.replace(/\.[^/.]+$/, '');  // remove any existing extension
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

export default function ChatApp({ user, onLogout }) {
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
    
    const [pendingFiles, setPendingFiles] = useState([]);   // { id, file, customName, caption }
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

    // Scheduled Message (per-message send scheduling)
    const [msgScheduleDateTime, setMsgScheduleDateTime] = useState("");

    // =====================================
    // NOTIFICATION ROUTING FUNCTION
    // =====================================
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
            tipIndex = (tipIndex + 1) % length;
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
                if (!staffMap[email]) staffMap[email] = { assigned: 0, completed: 0, pending: 0, overdue: 0 };
                staffMap[email].assigned++;
                if (task.taskData?.status === 'Completed') staffMap[email].completed++;
                else staffMap[email].pending++;
                if (task.taskData?.status !== 'Completed' && task.taskData?.deadline && new Date(task.taskData.deadline) < new Date()) staffMap[email].overdue++;
            });
        });
        const groupMap = {};
        allTasks.forEach(task => {
            const gname = groups.find(g => g.id === task.groupId)?.name || 'DM';
            if (!groupMap[gname]) groupMap[gname] = { total: 0, completed: 0 };
            groupMap[gname].total++;
            if (task.taskData?.status === 'Completed') groupMap[gname].completed++;
        });
        const trend = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const ds = d.toISOString().split('T')[0];
            const dayLabel = d.toLocaleDateString('en-IN', { weekday: 'short' });
            trend.push({
                label: dayLabel,
                created: allTasks.filter(m => m.dateString === ds).length,
                completed: completed.filter(m => (m.taskData?.trail || []).some(t => t.action === 'Marked Completed' && t.time?.includes(d.toLocaleDateString()))).length
            });
        }
        return { total: allTasks.length, completed: completed.length, pending: pending.length, inProgress: inProgress.length, overdue: overdue.length, staffMap, groupMap, trend, overdueList: overdue.slice(0,10), completionRate: allTasks.length ? Math.round((completed.length / allTasks.length) * 100) : 0 };
    }, [messages, groups]);

    const scrollToMessageDirect = useCallback((msgId) => {
        const el = document.getElementById(`msg-${msgId}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            triggerHighlight(msgId);
        }
    }, [triggerHighlight]);

    const logImmutableAction = useCallback(async (actionType, content, target = "") => {
        if(!activeGroup) return;
        try {
            await addDoc(collection(db, "audit_logs"), {
                type: actionType, user: user.email, content, target,
                groupId: activeGroup.id, groupName: activeGroup.name,
                timestamp: serverTimestamp()
            });
        } catch(e) {}
    }, [user.email, activeGroup]);

    const handleScheduleMessage = async (isTask = false, taskData = null) => {
        const text = pendingScheduledText || inputText.trim();
        const dt = scheduleDateTime || msgScheduleDateTime;
        if (!text || !dt || !activeGroup) return alert("Enter message text and a future date/time.");
        if (new Date(dt) <= new Date()) return alert("Scheduled time must be in the future.");
        try {
            const payload = {
                text, senderEmail: user.email, senderUid: user.uid,
                groupId: activeGroup.id, groupName: activeGroup.name,
                scheduledFor: dt, status: "pending", isTask: isTask,
                createdAt: serverTimestamp()
            };
            if (isTask && taskData) {
                payload.taskDeadline = taskData.deadline;
                payload.taskAssignees = taskData.assignees;
            }
            await addDoc(collection(db, "scheduled_messages"), payload);
            logImmutableAction("SCHEDULED_CREATE", `Scheduled ${isTask ? 'task' : 'message'}: "${text}"`, `Deliver at: ${new Date(dt).toLocaleString()}`);
            setInputText(""); setPendingScheduledText(""); setScheduleDateTime(""); setMsgScheduleDateTime(""); setShowScheduleInput(false); setActiveModal(null);
            playTaskSound();
            alert(`✅ ${isTask ? 'Task' : 'Message'} scheduled for ${new Date(dt).toLocaleString()}`);
        } catch(e) { alert("Failed to schedule."); }
    };

    const handleCancelScheduled = async (smId) => {
        if (!window.confirm("Cancel this scheduled message?")) return;
        try {
            await updateDoc(doc(db, "scheduled_messages", smId), { status: "cancelled" });
            logImmutableAction("SCHEDULED_CANCEL", "Cancelled a scheduled message", `ID: ${smId}`);
        } catch(e) {}
    };

    const handleSaveTemplate = async () => {
        if (!templateForm.title.trim()) return alert("Template title required.");
        try {
            const data = { ...templateForm, createdBy: user.email, createdAt: serverTimestamp() };
            if (editingTemplate) {
                await updateDoc(doc(db, "task_templates", editingTemplate.id), data);
            } else {
                await addDoc(collection(db, "task_templates"), data);
            }
            setTemplateForm({ title: "", assignees: [], deadlineDays: 1, groupId: "", recurring: "once", category: "General" });
            setEditingTemplate(null);
            setActiveModal('task_templates');
            playTaskSound();
        } catch(e) { alert("Failed to save template."); }
    };

    const handleDeleteTemplate = async (tid) => {
        if (!window.confirm("Delete this template?")) return;
        try { await deleteDoc(doc(db, "task_templates", tid)); } catch(e) {}
    };

    const handleUseTemplate = async (tpl) => {
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + (tpl.deadlineDays || 1));
        const deadlineStr = deadline.toISOString().slice(0, 16);
        const targetGroupId = tpl.groupId || (activeGroup?.id);
        if (!targetGroupId) return alert("Select a group first or set one in the template.");
        const targetGroup = groups.find(g => g.id === targetGroupId) || activeGroup;
        if (!targetGroup) return alert("Target group not found.");
        try {
            const now = new Date();
            await addDoc(collection(db, "messages"), {
                text: tpl.title, senderUid: user.uid, senderEmail: user.email, timestamp: serverTimestamp(),
                isTask: true, isPrivateMention: false, allowedUsers: [], seenBy: [user.email], deliveredTo: [user.email],
                isPinned: false, bookmarkedBy: [], fileUrl: null, fileName: null, fileType: null,
                groupId: targetGroupId, reactions: {},
                taskData: {
                    deadline: deadlineStr, assignees: tpl.assignees || [], status: "Pending", isArchived: false, dismissedBy: [],
                    trail: [{ action: "Task Created (From Template)", by: user.email, time: now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) + ', ' + now.toLocaleDateString(), to: (tpl.assignees||[]).map(a=>(a||"").split('@')[0]).join(', ') }]
                }
            });
            logImmutableAction("TEMPLATE_USED", `Used template: "${tpl.title}"`, `Group: ${targetGroup.name}`);
            setActiveModal(null);
            playTaskSound();
            if (activeGroup?.id !== targetGroupId) setActiveGroup(targetGroup);
        } catch(e) { alert("Failed to create task from template."); }
    };

    const openDraftDB = () => new Promise((resolve, reject) => {
        const req = indexedDB.open("TalkTaskDrafts", 1);
        req.onupgradeneeded = e => { e.target.result.createObjectStore("drafts", { keyPath: "id", autoIncrement: true }); };
        req.onsuccess = e => resolve(e.target.result);
        req.onerror = () => reject();
    });

    const saveOfflineDraft = async (text, groupId, groupName) => {
        try {
            const db2 = await openDraftDB();
            const tx = db2.transaction("drafts", "readwrite");
            tx.objectStore("drafts").add({ text, groupId, groupName, savedAt: new Date().toISOString() });
            loadOfflineDrafts();
        } catch(e) {}
    };

    const loadOfflineDrafts = async () => {
        try {
            const db2 = await openDraftDB();
            const tx = db2.transaction("drafts", "readonly");
            const req = tx.objectStore("drafts").getAll();
            req.onsuccess = () => setOfflineDrafts(req.result || []);
        } catch(e) {}
    };

    const deleteOfflineDraft = async (id) => {
        try {
            const db2 = await openDraftDB();
            const tx = db2.transaction("drafts", "readwrite");
            tx.objectStore("drafts").delete(id);
            loadOfflineDrafts();
        } catch(e) {}
    };

    const flushOfflineDrafts = async () => {
        try {
            const db2 = await openDraftDB();
            const tx = db2.transaction("drafts", "readonly");
            const req = tx.objectStore("drafts").getAll();
            req.onsuccess = async () => {
                const drafts = req.result || [];
                for (const draft of drafts) {
                    try {
                        await addDoc(collection(db, "messages"), {
                            text: `[Recovered Draft] ${draft.text}`, senderUid: user.uid, senderEmail: user.email,
                            timestamp: serverTimestamp(), isTask: false, hasReminder: false, isPrivateMention: false,
                            allowedUsers: [], seenBy: [user.email], deliveredTo: [user.email], isPinned: false, bookmarkedBy: [],
                            fileUrl: null, fileName: null, fileType: null, groupId: draft.groupId, reactions: {}
                        });
                        await deleteOfflineDraft(draft.id);
                    } catch(e) {}
                }
            };
        } catch(e) {}
    };

    const onGroupUpdate = useCallback(async (updates) => {
        if (!activeGroup || !activeGroup.id) return;

        // 1. INSTANTLY close the modal
        setActiveModal(null);

        // 2. BACKGROUND FILE UPLOAD
        if (updates.profilePicFile) {
            const file = updates.profilePicFile;
            const uniqueFileName = `group_${Date.now()}_${file.name}`;
            const uploadTask = uploadBytesResumable(ref(storage, `group_avatars/${uniqueFileName}`), file);
            
            uploadTask.on(
                'state_changed',
                null, // Silently upload in background
                (error) => { console.error('Background upload failed', error); },
                async () => {
                    const url = await getDownloadURL(uploadTask.snapshot.ref);
                    // Background sync to DB
                    await updateDoc(doc(db, "groups", activeGroup.id), { profilePicUrl: url });
                    // Update UI once the background upload finishes
                    setActiveGroup(prev => ({ ...prev, profilePicUrl: url }));
                    setGroups(prev => prev.map(g => g.id === activeGroup.id ? { ...g, profilePicUrl: url } : g));
                }
            );
            return;
        }

        // 3. OPTIMISTIC TEXT UPDATES (Name, Members, Admins)
        const cleanUpdates = {};
        if (updates.name) cleanUpdates.name = updates.name;
        if (updates.members) {
            cleanUpdates.members = updates.members;
            // Keep admins that are still in the members list
            cleanUpdates.admins = updates.admins || activeGroup.admins.filter(a => updates.members.includes(a));
        }
        
        if (Object.keys(cleanUpdates).length === 0) return;

        // Instantly update the local UI to reflect changes (Optimistic UI)
        setActiveGroup(prev => ({ ...prev, ...cleanUpdates }));
        setGroups(prev => prev.map(g => g.id === activeGroup.id ? { ...g, ...cleanUpdates } : g));

        // 4. BACKGROUND SYNC TO FIREBASE
        try {
            await updateDoc(doc(db, "groups", activeGroup.id), cleanUpdates);
            logImmutableAction("GROUP_UPDATE", `Updated group: ${activeGroup.name}`, `Fields: ${Object.keys(cleanUpdates).join(', ')}`);
        } catch (err) { 
            console.error('Background update failed', err); 
        }
    }, [activeGroup, storage, db, logImmutableAction, setActiveModal]);

    const handleSendOfflineAware = async () => {
        if (!inputText.trim() || !activeGroup) return;
        if (!isOnline) {
            await saveOfflineDraft(inputText.trim(), activeGroup.id, activeGroup.name);
            setInputText("");
            alert("📥 You are offline. Message saved as draft and will be sent when you reconnect.");
            return;
        }
        await handleSendMessage();
    };

    const handleStayLoggedIn = () => {
        setShowInactivityWarning(false);
        clearInterval(inactivityCountdownRef.current);
        setInactivityCountdown(60);
        clearTimeout(inactivityTimerRef.current);
        lastActivityRef.current = Date.now();
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
            replyData = {
                replyToId: replyingTo.id,
                originalText: replyingTo.text || replyingTo.fileName || 'Attachment',
                originalSender: (replyingTo.sender||"").split('@')[0]
            };
            if (replyingTo.senderUid !== user.uid) {
                try { await addDoc(collection(db, "notifications"), { userId: replyingTo.senderUid, type: "reply", text: `${(user.email||"").split('@')[0]} replied to your message.`, messageId: replyingTo.id, groupId: activeGroup.id, timestamp: serverTimestamp(), isRead: false }); } catch (e) {}
            }
        }

        try {
            const groupMsgRef = await addDoc(collection(db, "messages"), {
                text: messageText, senderUid: user.uid, senderEmail: user.email, timestamp: serverTimestamp(),
                isTask: false, hasReminder: false, isPrivateMention: isPrivate, allowedUsers: allowedUsers,
                seenBy: [user.email], deliveredTo: [user.email], isPinned: false, bookmarkedBy: [], fileUrl: null, fileName: null, fileType: null,
                groupId: activeGroup.id, reactions: {}, ...(replyData || {})
            });
            const groupMsgId = groupMsgRef.id;
            
            if (activeGroup.isDM) {
                const recipientEmail = activeGroup.members.find(m => m !== user.email);
                const recipient = dbUsers.find(u => u.email === recipientEmail);
                if (recipient) {
                    try { await addDoc(collection(db, "notifications"), { userId: recipient.uid, type: "message", text: `${(user.email||"").split('@')[0]} sent you a direct message.`, messageId: null, groupId: activeGroup.id, timestamp: serverTimestamp(), isRead: false }); } catch (e) {}
                }
            } else if (uniqueMentions.length > 0) {
                uniqueMentions.forEach(async (mentionedEmail) => {
                    if (mentionedEmail === user.email) return;
                    const mentionedUser = dbUsers.find(u => u.email === mentionedEmail);
                    if (mentionedUser) {
                        const dmIdList = [user.uid, mentionedUser.uid].sort();
                        const dmIdStr = dmIdList.join('_');
                        
                        await addDoc(collection(db, "messages"), {
                            text: `You were mentioned in ${activeGroup.name}`,
                            originalTextSnippet: messageText.substring(0, 150),
                            mentionedInGroup: activeGroup.name,
                            mentionedInGroupId: activeGroup.id,
                            originalMessageId: groupMsgId,
                            isMentionNotification: true,
                            senderUid: user.uid,
                            senderEmail: user.email,
                            timestamp: serverTimestamp(),
                            isTask: false,
                            hasReminder: false,
                            isPrivateMention: false,
                            allowedUsers: [user.email, mentionedEmail],
                            seenBy: [user.email],
                            deliveredTo: [user.email],
                            isPinned: false,
                            bookmarkedBy: [],
                            fileUrl: null,
                            fileName: null,
                            fileType: null,
                            groupId: dmIdStr,
                            reactions: {}
                        });
                        
                        await addDoc(collection(db, "notifications"), { 
                            userId: mentionedUser.uid, 
                            type: "mention", 
                            text: `${(user.email||"").split('@')[0]} mentioned you in ${activeGroup.name}.`, 
                            messageId: groupMsgId, 
                            groupId: dmIdStr, 
                            timestamp: serverTimestamp(), 
                            isRead: false 
                        });
                    }
                });
            }

            logImmutableAction("MESSAGE_CREATE", `Sent message: "${messageText}"`, isPrivate ? `Private: ${uniqueMentions.join(', ')}` : "Public");
            setReplyingTo(null);
        } catch (error) { alert("Failed to send message."); }
    };

    const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } };

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
            if (isAdding) logImmutableAction("REACTION", `Reacted ${emoji} to message`, `Message ID: ${msgId}`);
        } catch (err) {}
    };

    const uploadFileDirectly = async (pendingFileObj) => {
      const { file, customName, caption } = pendingFileObj;
      if (!file || !activeGroup) return;
      const maxSizeBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
      if (file.size > maxSizeBytes) {
        alert(`File "${customName}" exceeds ${MAX_FILE_SIZE_MB} MB limit.`);
        return;
      }
      // Remove this file from pending list immediately (optimistic)
      setPendingFiles(prev => prev.filter(f => f.id !== pendingFileObj.id));
      setIsUploading(true);
      setUploadProgress(0);
      // Compress images
      let processedFile = file;
      try {
        if (file.type.startsWith('image/')) {
          const compressedBlob = await compressImage(file);
          // Keep the same extension as the custom name
          const ext = customName.split('.').pop().toLowerCase();
          processedFile = new File([compressedBlob], customName, { type: `image/${ext === 'png' ? 'png' : 'jpeg'}` });
        }
      } catch (e) {
        console.warn('Compression failed, using original', e);
      }
      const finalName = customName;
      const uniqueFileName = `${Date.now()}_${finalName}`;
      const uploadTask = uploadBytesResumable(ref(storage, `chat_uploads/${uniqueFileName}`), processedFile);
      uploadTask.on(
        'state_changed',
        (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
        (error) => {
          setIsUploading(false);
          alert('File upload failed.');
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            const messageText = caption && caption.trim() !== "" ? caption.trim() : ""; // Safely extract user text
            
            await addDoc(collection(db, "messages"), {
              text: messageText,
              senderUid: user.uid,
              senderEmail: user.email,
              timestamp: serverTimestamp(),
              isTask: false,
              hasReminder: false,
              isPrivateMention: false,
              allowedUsers: [],
              seenBy: [user.email],
              deliveredTo: [user.email],
              isPinned: false,
              bookmarkedBy: [],
              fileUrl: downloadURL,
              fileName: finalName,
              fileType: processedFile.type,
              groupId: activeGroup.id,
              reactions: {},
            });
            logImmutableAction("FILE_UPLOAD", `Uploaded file: ${finalName}`, "Public");
          } catch (err) { console.error(err); }
          finally {
            setIsUploading(false);
            setUploadProgress(0);
          }
        }
      );
    };

    const handleFileUpload = (e) => {
      const files = Array.from(e.target.files).slice(0, 3);   // max 3 files
      if (files.length === 0) return;
      e.target.value = '';
      
      const currentInput = inputText.trim(); // Pull text from main chat bar
      
      const newPending = files.map((file, index) => ({
        id: Date.now() + Math.random(),
        file,
        customName: file.name,
        caption: index === 0 ? currentInput : '' // Inject main chat text into first file
      }));
      
      setPendingFiles(prev => [...prev, ...newPending].slice(0, 3));
      setShowFileRename(true);
      if (currentInput) setInputText(''); // Clear the main chat bar so it doesn't double-send
    };

    const handlePaste = (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let index in items) {
            const item = items[index];
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                const blob = item.getAsFile();
                if (blob) {
                  const pastedName = `pasted_image_${Date.now()}.png`;
                  const currentInput = inputText.trim(); // Pull text from main chat bar
                  const newItem = {
                    id: Date.now() + Math.random(),
                    file: blob,
                    customName: pastedName,
                    caption: currentInput // Inject main chat text
                  };
                  setPendingFiles(prev => [...prev, newItem].slice(0, 3));
                  setShowFileRename(true);
                  if (currentInput) setInputText(''); // Clear main chat bar
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

    const notifyInvolvedInTask = async (taskMsg, actionText) => {
        const involvedEmails = new Set([ taskMsg.senderEmail, ...(taskMsg.taskData?.assignees || []), ...(taskMsg.taskData?.trail?.map(t => t.by) || []) ]);
        involvedEmails.delete(user.email);
        const uidsToNotify = dbUsers.filter(u => involvedEmails.has(u.email)).map(u => u.uid);
        for (const uid of uidsToNotify) {
            try { await addDoc(collection(db, "notifications"), { userId: uid, type: "task", text: actionText, messageId: taskMsg.id, groupId: taskMsg.groupId, timestamp: serverTimestamp(), isRead: false }); } catch (e) {}
        }
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
                logImmutableAction("TASK_FILE", `Attached file ${file.name}`, `Task ID: ${selectedMessage.id}`);
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
            logImmutableAction("TASK_TITLE_EDIT", `Original: "${selectedMessage.text}" | Edited: "${newTaskTitle}"`, `Task ID: ${selectedMessage.id}`);
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
        if (!selectedMessage || !taskDeadline || taskAssignees.length === 0) return alert("Please select Assignees and Deadline.");
        try {
            const now = new Date();
            await setDoc(doc(db, "messages", selectedMessage.id), {
                isTask: true,
                taskData: { deadline: taskDeadline, assignees: taskAssignees, status: "Pending", isArchived: false, dismissedBy: [], trail: [{ action: "Task Created", by: user.email, time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ', ' + now.toLocaleDateString(), to: taskAssignees.map(a=>(a||"").split('@')[0]).join(', ') }] }
            }, { merge: true });
            logImmutableAction("TASK_CREATE", `Converted to Task: "${selectedMessage.text}"`, `Assignees: ${taskAssignees.join(', ')}`);
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
            logImmutableAction("TASK_DELEGATE", `Delegated Task ID: ${selectedMessage.id}`, `To: ${delegateAssignees.join(', ')}`);
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
            logImmutableAction("TASK_COMPLETE", `Completed Task ID: ${selectedMessage.id}`, "");
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
            logImmutableAction("TASK_ARCHIVED", `Archived Task ID: ${selectedMessage.id}`, "");
            setActiveModal(null);
        } catch (error) {}
    };

    const handleQuickArchive = async (taskId) => {
        try {
            await updateDoc(doc(db, "messages", taskId), { "taskData.isArchived": true });
            logImmutableAction("TASK_ARCHIVED", `Archived Task ID: ${taskId}`, "");
        } catch (e) {}
    };

    const handleAddComment = async (closeModal = false) => {
        if (!selectedMessage || !trailComment.trim()) return;
        try {
            const now = new Date();
            const updatedTrail = [...selectedMessage.taskData.trail, { action: "Update Added", by: user.email, time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ', ' + now.toLocaleDateString(), comment: trailComment }];
            await updateDoc(doc(db, "messages", selectedMessage.id), { "taskData.trail": updatedTrail });
            logImmutableAction("TASK_COMMENT", `Comment: "${trailComment}"`, `Task ID: ${selectedMessage.id}`);
            await notifyInvolvedInTask(selectedMessage, `${(user.email||"").split('@')[0]} updated a task.`);
            setTrailComment("");
            setSelectedMessage(prev => ({...prev, taskData: {...prev.taskData, trail: updatedTrail}}));
            playTaskSound();
            if (closeModal) setActiveModal(null);
        } catch (error) {}
    };

    const handleChatScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        setIsAtBottom(Math.abs(scrollHeight - clientHeight - scrollTop) < 50);
    };

    const scrollToPosition = () => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTo({ top: isAtBottom ? 0 : chatContainerRef.current.scrollHeight, behavior: 'smooth' });
        }
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
            logImmutableAction("GROUP_ARCHIVE", `Archived Group: "${groupName}"`, `Group ID: ${groupId}`);
        }
    };

    const handleAdminRecoverGroup = async (groupId, groupName) => {
        if(window.confirm("Recover this department?")) {
            await updateDoc(doc(db, "groups", groupId), { isArchived: false });
            logImmutableAction("GROUP_RECOVER", `Recovered Group: "${groupName}"`, `Group ID: ${groupId}`);
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

    if (currentUserData && currentUserData.isApproved !== true && !currentUserData.isAdmin && !isVipAdmin) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100 p-4 text-gray-800">
                <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 border-t-8 border-[#008069] text-center transform-gpu hover:scale-105 transition-transform">
                    <i className="fa-solid fa-user-clock text-5xl text-[#008069] mb-4 animate-pulse"></i>
                    <h1 className="text-2xl font-bold mb-2">Pending Approval</h1>
                    <p className="text-sm text-gray-500 mb-6">Your Google Account requires Admin verification to join the portal.</p>
                    <button onClick={onLogout} className="bg-gray-100 text-gray-700 py-2 px-6 rounded-full font-bold shadow-sm hover:bg-gray-200 transition-colors">Sign Out</button>
                </div>
            </div>
        );
    }

    if (isWorkspaceLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen w-full bg-[#f0f2f5] text-[#111b21] fixed inset-0 z-50">
                <div className="w-24 h-24 mb-6 relative">
                    <div className="absolute inset-0 bg-[#00a884] rounded-2xl opacity-20 animate-ping"></div>
                    <div className="relative w-full h-full bg-gradient-to-br from-[#00a884] to-teal-600 rounded-2xl flex items-center justify-center text-white text-4xl shadow-lg border-2 border-white">
                        <i className="fa-solid fa-hourglass-half animate-sandclock"></i>
                    </div>
                </div>
                <h2 className="text-xl font-bold mb-2 tracking-tight">Talk & Task Enterprise Portal</h2>
                <div className="flex items-center gap-3 text-[#54656f] font-semibold text-[13px] uppercase tracking-widest mt-2">
                    <i className="fa-solid fa-lock text-[#00a884]"></i> Preparing Workspace...
                </div>
                <div className="w-48 h-1 bg-gray-200 rounded-full mt-6 overflow-hidden">
                    <div className="h-full bg-[#00a884] animate-[pulse_1.5s_ease-in-out_infinite] w-full origin-left"></div>
                </div>
                <div className="mt-10 px-8 text-center max-w-md">
                    <p className="text-[#54656f] text-sm font-medium italic" key={currentTip}>{currentTip}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen w-full bg-[#f3f4f6] text-[#111b21] overflow-hidden relative font-sans transition-opacity duration-700 ease-out opacity-100">
            
            <audio id="app-sound" src="https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3?filename=success-1-6297.mp3" preload="auto" className="hidden"></audio>

            {viewMode === "admin" ? (
              <AdminPanel
                setViewMode={setViewMode}
                setActiveModal={setActiveModal}
                dbUsers={dbUsers}
                groups={groups}
                filteredAuditLogs={filteredAuditLogs}
                adminFilterUser={adminFilterUser}
                setAdminFilterUser={setAdminFilterUser}
                adminFilterDate={adminFilterDate}
                setAdminFilterDate={setAdminFilterDate}
                adminFilterType={adminFilterType}
                setAdminFilterType={setAdminFilterType}
                adminFilterGroup={adminFilterGroup}
                setAdminFilterGroup={setAdminFilterGroup}
                handleDownloadAudit={handleDownloadAudit}
                handleToggleApprove={handleToggleApprove}
                setAdminForm={setAdminForm}
                setGroupForm={setGroupForm}
                setEditingGroup={setEditingGroup}
                handleAdminArchiveGroup={handleAdminArchiveGroup}
                handleAdminRecoverGroup={handleAdminRecoverGroup}
              />
            ) : (
            
                <div className="flex h-full w-full relative">
                    <LeftSidebar 
                        user={user}  
                        currentUserData={currentUserData}  
                        myGroups={myGroups}  
                        dmUsers={dmUsers}  
                        activeGroup={activeGroup}  
                        setActiveGroup={setActiveGroup}  
                        setShowRightSidebar={setShowRightSidebar}  
                        setMobileSidebarOpen={setMobileSidebarOpen}  
                        getUnreadInfoForUser={getUnreadInfoForUser}  
                        messages={messages}  
                        onLogout={onLogout}  
                        setActiveModal={setActiveModal}  
                        setGroupForm={setGroupForm}  
                        setEditingGroup={setEditingGroup}  
                        sidebarSearch={sidebarSearch}  
                        setSidebarSearch={setSidebarSearch}  
                        mobileSidebarOpen={mobileSidebarOpen}  
                        isVipAdmin={isVipAdmin}  
                        setViewMode={setViewMode}
                    />
                    
                    {activeGroup ? (
                        <div className="flex-1 flex flex-col relative h-full bg-[#efeae2] overflow-hidden">
                            <div className="h-[59px] bg-[#f0f2f5] flex items-center justify-between px-3 md:px-4 shrink-0 z-30 sticky top-0 border-b border-slate-200/60 safe-top">
                                <button onClick={() => setMobileSidebarOpen(true)} className="md:hidden w-10 h-10 rounded-full hover:bg-black/5 flex items-center justify-center text-[#54656f] mr-1 shrink-0"><i className="fa-solid fa-bars text-xl"></i></button>
                                <div className="flex items-center gap-3 cursor-pointer flex-1 min-w-0" onClick={() => { if(!activeGroup.isDM) setActiveModal('group_settings'); }}>
                                    {activeGroup.isDM ? <MemoizedAvatar uid={activeGroup.id} url={null} name={activeGroup.name} sizeClass="w-10 h-10" /> : activeGroup.profilePicUrl ? <MemoizedAvatar uid={activeGroup.id} url={activeGroup.profilePicUrl} name={activeGroup.name} sizeClass="w-10 h-10" /> : <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-[#800020] shadow-sm"><i className="fa-solid fa-users"></i></div>}
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <span className={`text-[16px] font-bold leading-tight truncate ${activeGroup.isDM ? 'text-[#111b21]' : 'text-[#800020]'}`}>{activeGroup.name}</span>
                                        <span className="text-[13px] text-[#54656f] truncate max-w-[150px] lg:max-w-[400px]">
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
                                        <i className="fa-solid fa-search text-[14px] text-[#54656f] mr-2"></i>
                                        <input type="text" placeholder="Search messages..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-transparent outline-none flex-1 text-[13px] text-[#111b21]" />
                                        {searchQuery && <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600 ml-1"><i className="fa-solid fa-xmark text-xs"></i></button>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button onClick={() => setShowFilterMenu(!showFilterMenu)} className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-colors ${showFilterMenu ? 'bg-black/10' : 'hover:bg-black/5'} text-[#54656f] text-[19px]`} title="Filter Messages"><i className="fa-solid fa-sliders"></i></button>
                                    <div className="relative">
                                        <button onClick={() => setShowNotifications(!showNotifications)} className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-colors ${showNotifications ? 'bg-black/10' : 'hover:bg-black/5'} text-[#54656f] text-[19px] relative`}>
                                            <i className="fa-solid fa-bell"></i>
                                            {totalNotifications > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#25d366] rounded-full border border-[#f0f2f5]"></span>}
                                        </button>
                                        {showNotifications && (
                                            <div className="absolute top-full right-0 mt-2 w-80 max-w-[90vw] bg-white rounded-lg shadow-[0_2px_5px_0_rgba(11,20,26,.26),0_2px_10px_0_rgba(11,20,26,.16)] z-50 overflow-hidden animate-in slide-in-from-top-2 border border-slate-100">
                                                <div className="p-3 bg-white flex justify-between items-center border-b border-slate-100">
                                                    <span className="text-[15px] font-bold text-slate-800">Activity Feed</span>
                                                    <button onClick={handleClearNotifications} className="text-[12px] text-[#00a884] font-semibold hover:underline">Clear All</button>
                                                </div>
                                                <div className="max-h-[70vh] overflow-y-auto bg-slate-50 p-2 space-y-2">
                                                    {totalNotifications === 0 ? <div className="p-8 text-center text-[14px] text-[#54656f]">No new activity</div> :
                                                        <div>
                                                            {activeActionableTasks.map(task => {
                                                                const timeStr = task.timestamp?.toDate ? new Date(task.timestamp.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
                                                                return (
                                                                    <div key={task.id} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-slate-300 transition-all relative mb-2" onClick={() => navigateToMessageFromNotification(task.id, task.groupId)}>
                                                                        <div className="text-[13px] font-bold text-[#00a884] mb-1.5 flex items-center justify-between"><span className="flex items-center"><i className="fa-regular fa-square-check mr-1.5"></i>Pending Task</span> <span className="text-[10px] text-slate-400 font-semibold">{timeStr}</span></div>
                                                                        <div className="text-[14px] text-[#111b21] line-clamp-2 leading-snug font-medium">"{task.text}"</div>
                                                                    </div>
                                                                );
                                                            })}
                                                            {genericNotifications.map(n => {
                                                                const timeStr = n.timestamp?.toDate ? new Date(n.timestamp.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Just now';
                                                                return (
                                                                    <div key={n.id} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-slate-300 transition-all flex items-start gap-3 relative mb-2" onClick={() => { if(n.messageId) navigateToMessageFromNotification(n.messageId, n.groupId || activeGroup?.id); }}>
                                                                        <div className="w-8 h-8 rounded-full bg-[#d9fdd3] flex items-center justify-center text-[#00a884] shrink-0 mt-0.5"><i className={n.type === 'reply' ? "fa-solid fa-reply text-xs" : n.type === 'message' ? "fa-solid fa-message text-xs" : n.type === 'mention' ? "fa-solid fa-at text-xs" : "fa-solid fa-bolt text-xs"}></i></div>
                                                                        <div className="flex-1 overflow-hidden">
                                                                            <div className="text-[14px] font-bold text-[#111b21]">{n.type === 'reply' ? 'New Reply' : n.type === 'message' ? 'Direct Message' : n.type === 'mention' ? 'Mentioned You' : 'New Reaction'}</div>
                                                                            <div className="text-[13px] text-[#54656f] mt-0.5 leading-snug truncate pr-8 font-medium">{n.text}</div>
                                                                        </div>
                                                                        <div className="absolute bottom-3 right-3 text-[10px] text-slate-400 font-semibold">{timeStr}</div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    }
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={() => setShowRightSidebar(!showRightSidebar)} className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-colors ${showRightSidebar ? 'bg-black/10 text-[#111b21]' : 'hover:bg-black/5 text-[#54656f]'} text-[19px]`} title="Task Hub"><i className="fa-solid fa-clipboard-list"></i></button>
                                    {showFilterMenu && (
                                        <div className="absolute top-[55px] right-24 bg-white rounded-lg shadow-[0_2px_5px_0_rgba(11,20,26,.26),0_2px_10px_0_rgba(11,20,26,.16)] z-50 overflow-hidden animate-in fade-in py-2 w-48 border border-slate-100">
                                            {['all', 'tasks-pending', 'tasks-completed', 'messages', 'today', 'bookmarked'].map(f => (
                                                <div key={f} onClick={() => { setChatFilter(f); setShowFilterMenu(false); }} className={`px-4 py-2.5 text-[14px] cursor-pointer transition-colors flex items-center gap-3 ${chatFilter === f ? 'bg-[#f0f2f5] text-[#111b21]' : 'text-[#3b4a54] hover:bg-[#f5f6f6]'}`}>
                                                    {f === 'all' && <i className="fa-solid fa-layer-group w-5 text-center"></i>}
                                                    {f === 'tasks-pending' && <i className="fa-regular fa-clock w-5 text-center"></i>}
                                                    {f === 'tasks-completed' && <i className="fa-regular fa-square-check w-5 text-center"></i>}
                                                    {f === 'messages' && <i className="fa-regular fa-comment w-5 text-center"></i>}
                                                    {f === 'today' && <i className="fa-regular fa-calendar-day w-5 text-center"></i>}
                                                    {f === 'bookmarked' && <i className="fa-solid fa-bookmark w-5 text-center"></i>}
                                                    {f === 'bookmarked' ? 'Saved Messages' : f === 'all' ? 'All Content' : f.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="md:hidden px-3 py-2 bg-[#f0f2f5] border-b border-slate-200/60">
                                <div className="bg-white rounded-full flex items-center px-4 py-1.5 shadow-sm border border-slate-200">
                                    <i className="fa-solid fa-search text-[14px] text-[#54656f] mr-2"></i>
                                    <input type="text" placeholder="Search messages..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-transparent outline-none flex-1 text-[13px] text-[#111b21]" />
                                </div>
                            </div>

                            <ChatView
                              messagesToRender={messagesToRender}
                              messages={messages}
                              activeGroup={activeGroup}
                              user={user}
                              currentUserData={currentUserData}
                              isVipAdmin={isVipAdmin}
                              pinnedMessages={pinnedMessages}
                              typingStatus={typingStatus}
                              replyingTo={replyingTo}
                              setReplyingTo={setReplyingTo}
                              toolPreferences={toolPreferences}
                              dbUsers={dbUsers}
                              groups={groups}
                              setActiveGroup={setActiveGroup}
                              setShowRightSidebar={setShowRightSidebar}
                              setMobileSidebarOpen={setMobileSidebarOpen}
                              setPendingScrollTarget={setPendingScrollTarget}
                              setActiveModal={setActiveModal}
                              scrollToMessageDirect={scrollToMessageDirect}
                              handleReaction={handleReaction}
                              handleToggleBookmark={handleToggleBookmark}
                              handleTogglePin={handleTogglePin}
                              handleDeleteMessage={handleDeleteMessage}
                              chatInputRef={chatInputRef}
                              editingMessageId={editingMessageId}
                              editMessageText={editMessageText}
                              setEditingMessageId={setEditingMessageId}
                              setEditMessageText={setEditMessageText}
                              handleSaveEdit={handleSaveEdit}
                              setSelectedMessage={setSelectedMessage}
                              setIsEditingTaskTitle={setIsEditingTaskTitle}
                              messagesEndRef={messagesEndRef}
                              chatContainerRef={chatContainerRef}
                              isAtBottom={isAtBottom}
                              setIsAtBottom={setIsAtBottom}
                              highlightedMsgId={highlightedMsgId}
                            />

                            <InputArea
                              inputText={inputText}
                              setInputText={setInputText}
                              isOnline={isOnline}
                              isUploading={isUploading}
                              activeGroup={activeGroup}
                              replyingTo={replyingTo}
                              setReplyingTo={setReplyingTo}
                              handleSendOfflineAware={handleSendOfflineAware}
                              handleTypingEvent={handleTypingEvent}
                              handlePaste={handlePaste}
                              chatInputRef={chatInputRef}
                              fileInputRef={fileInputRef}
                              handleFileUpload={handleFileUpload}
                              emojiPickerOpen={emojiPickerOpen}
                              setEmojiPickerOpen={setEmojiPickerOpen}
                              emojiPickerRef={emojiPickerRef}
                              EMOJI_LIST={EMOJI_LIST}
                              pendingFiles={pendingFiles}
                              setPendingFiles={setPendingFiles}
                              showFileRename={showFileRename}
                              setShowFileRename={setShowFileRename}
                              lockExtension={lockExtension}
                              uploadFileDirectly={uploadFileDirectly}
                              setActiveModal={setActiveModal}
                              setPendingScheduledText={setPendingScheduledText}
                              offlineDrafts={offlineDrafts}
                              user={user}
                              dbUsers={dbUsers}
                              groups={groups}
                              handleSendMessage={handleSendMessage}
                              currentUserData={currentUserData}
                              MAX_FILE_SIZE_MB={MAX_FILE_SIZE_MB}
                            />
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center bg-[#f0f2f5] text-center p-8 relative">
                            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm mb-6 text-[#00a884] ring-4 ring-white border border-slate-100">
                                <i className="fa-solid fa-comments text-4xl"></i>
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 mb-2">Welcome to Talk & Task</h2>
                            <p className="text-slate-500 mb-8 max-w-md">Select a department or direct message from the sidebar to start collaborating, or create a new workspace.</p>
                            {(currentUserData?.isAdmin || isVipAdmin || currentUserData?.canCreateGroups) && (
                                <button
                                    onClick={() => { setGroupForm({name: "", members: [], admins: [], profilePicUrl: null}); setEditingGroup(null); setActiveModal('group_form_modal'); }}
                                    className="w-full max-w-xs bg-[#008069] text-white px-6 py-3.5 rounded-xl font-bold shadow-sm hover:bg-[#006e5a] transition-all"
                                >
                                    <i className="fa-solid fa-layer-group mr-2"></i> Create Department
                                </button>
                            )}                           
                            
                            <div className="absolute top-4 right-4 flex items-center gap-2">
                                <div className="relative">
                                    <button onClick={() => setShowNotifications(!showNotifications)} className={`w-10 h-10 bg-white rounded-full flex items-center justify-center transition-colors shadow-sm text-[#54656f] text-[19px] relative`}>
                                        <i className="fa-solid fa-bell"></i>
                                        {totalNotifications > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#25d366] rounded-full border border-white"></span>}
                                    </button>
                                    {showNotifications && (
                                        <div className="absolute top-full right-0 mt-2 w-80 max-w-[90vw] bg-white rounded-lg shadow-[0_2px_5px_0_rgba(11,20,26,.26),0_2px_10px_0_rgba(11,20,26,.16)] z-50 overflow-hidden animate-in slide-in-from-top-2 border border-slate-100">
                                            <div className="p-3 bg-white flex justify-between items-center border-b border-slate-100">
                                                <span className="text-[15px] font-bold text-slate-800">Activity Feed</span>
                                                <button onClick={handleClearNotifications} className="text-[12px] text-[#00a884] font-semibold hover:underline">Clear All</button>
                                            </div>
                                            <div className="max-h-[70vh] overflow-y-auto bg-slate-50 p-2 space-y-2">
                                                {totalNotifications === 0 ? <div className="p-8 text-center text-[14px] text-[#54656f]">No new activity</div> :
                                                    <div>
                                                        {activeActionableTasks.map(task => {
                                                            const timeStr = task.timestamp?.toDate ? new Date(task.timestamp.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
                                                            return (
                                                                <div key={task.id} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-slate-300 transition-all relative mb-2" onClick={() => navigateToMessageFromNotification(task.id, task.groupId)}>
                                                                    <div className="text-[13px] font-bold text-[#00a884] mb-1.5 flex items-center justify-between"><span className="flex items-center"><i className="fa-regular fa-square-check mr-1.5"></i>Pending Task</span> <span className="text-[10px] text-slate-400 font-semibold">{timeStr}</span></div>
                                                                    <div className="text-[14px] text-[#111b21] line-clamp-2 leading-snug font-medium">"{task.text}"</div>
                                                                </div>
                                                            );
                                                        })}
                                                        {genericNotifications.map(n => {
                                                            const timeStr = n.timestamp?.toDate ? new Date(n.timestamp.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Just now';
                                                            return (
                                                                <div key={n.id} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-slate-300 transition-all flex items-start gap-3 relative mb-2" onClick={() => { if(n.messageId) navigateToMessageFromNotification(n.messageId, n.groupId || activeGroup?.id); }}>
                                                                    <div className="w-8 h-8 rounded-full bg-[#d9fdd3] flex items-center justify-center text-[#00a884] shrink-0 mt-0.5"><i className={n.type === 'reply' ? "fa-solid fa-reply text-xs" : n.type === 'message' ? "fa-solid fa-message text-xs" : n.type === 'mention' ? "fa-solid fa-at text-xs" : "fa-solid fa-bolt text-xs"}></i></div>
                                                                    <div className="flex-1 overflow-hidden">
                                                                        <div className="text-[14px] font-bold text-[#111b21]">{n.type === 'reply' ? 'New Reply' : n.type === 'message' ? 'Direct Message' : n.type === 'mention' ? 'Mentioned You' : 'New Reaction'}</div>
                                                                        <div className="text-[13px] text-[#54656f] mt-0.5 leading-snug truncate pr-8 font-medium">{n.text}</div>
                                                                    </div>
                                                                    <div className="absolute bottom-3 right-3 text-[10px] text-slate-400 font-semibold">{timeStr}</div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                }
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* RIGHT SIDEBAR - TASKS */}
                    {showRightSidebar && (
                        <RightSidebar
                          showRightSidebar={showRightSidebar}
                          setShowRightSidebar={setShowRightSidebar}
                          tasksAssignedToMe={tasksAssignedToMe}
                          tasksAssignedByMe={tasksAssignedByMe}
                          groups={groups}
                          dbUsers={dbUsers}
                          user={user}
                          setActiveGroup={setActiveGroup}
                          setSelectedMessage={setSelectedMessage}
                          setIsEditingTaskTitle={setIsEditingTaskTitle}
                          setActiveModal={setActiveModal}
                        />
                    )}

                    {/* MODALS */}
                    {activeModal === 'context' && <ContextMenuModal selectedMessage={selectedMessage} setActiveModal={setActiveModal} setReplyingTo={setReplyingTo} chatInputRef={chatInputRef} />}
                    
                    {activeModal === 'edit_profile' && (
                      <ProfileSettingsModal
                        setActiveModal={setActiveModal}
                        currentUserData={currentUserData}
                        profileForm={profileForm}
                        setProfileForm={setProfileForm}
                        profilePicInputRef={profilePicInputRef}
                        profileUploadProgress={profileUploadProgress}
                        setProfileUploadProgress={setProfileUploadProgress}
                        handleProfileSubmit={handleProfileSubmit}
                        toolPreferences={toolPreferences}
                        setToolPreferences={setToolPreferences}
                        user={user}
                      />
                    )}

                    {activeModal === 'group_form_modal' && (
                      <GroupFormModal
                        setActiveModal={setActiveModal}
                        groupForm={groupForm}
                        setGroupForm={setGroupForm}
                        editingGroup={editingGroup}
                        handleGroupSubmit={handleGroupSubmit}
                        groupPicInputRef={groupPicInputRef}
                        handleGroupPicUpload={handleGroupPicUpload}
                        groupPicUploadProgress={groupPicUploadProgress}
                        dbUsers={dbUsers}
                        user={user}
                      />
                    )}

                    {activeModal === 'group_settings' && (
                      <GroupSettingsModal
                        setActiveModal={setActiveModal}
                        activeGroup={activeGroup}
                        groupForm={groupForm}
                        setGroupForm={setGroupForm}
                        dbUsers={dbUsers}
                        user={user}
                        currentUserData={currentUserData}
                        isVipAdmin={isVipAdmin}
                        handleUpdateGroupMembers={handleUpdateGroupMembers}
                        onGroupUpdate={onGroupUpdate}
                      />
                    )}

                    {activeModal === 'task_trail' && selectedMessage?.taskData && (
                      <TaskTrailModal
                        selectedMessage={selectedMessage}
                        setSelectedMessage={setSelectedMessage}
                        activeModal={activeModal}
                        setActiveModal={setActiveModal}
                        isEditingTaskTitle={isEditingTaskTitle}
                        setIsEditingTaskTitle={setIsEditingTaskTitle}
                        newTaskTitle={newTaskTitle}
                        setNewTaskTitle={setNewTaskTitle}
                        handleSaveTaskTitle={handleSaveTaskTitle}
                        delegateAssignees={delegateAssignees}
                        setDelegateAssignees={setDelegateAssignees}
                        showDelegateDropdown={showDelegateDropdown}
                        setShowDelegateDropdown={setShowDelegateDropdown}
                        handleDelegateTask={handleDelegateTask}
                        trailComment={trailComment}
                        setTrailComment={setTrailComment}
                        handleAddComment={handleAddComment}
                        handleCompleteTask={handleCompleteTask}
                        handleArchiveTask={handleArchiveTask}
                        trailFileInputRef={trailFileInputRef}
                        handleTrailFileUpload={handleTrailFileUpload}
                        activeGroup={activeGroup}
                        dbUsers={dbUsers}
                        user={user}
                        currentUserData={currentUserData}
                        isVipAdmin={isVipAdmin}
                      />
                    )}

                    {activeModal === 'task_convert' && (
                      <TaskConvertModal
                        setActiveModal={setActiveModal}
                        taskAssignees={taskAssignees}
                        setTaskAssignees={setTaskAssignees}
                        taskDeadline={taskDeadline}
                        setTaskDeadline={setTaskDeadline}
                        convertToTask={convertToTask}
                        activeGroup={activeGroup}
                        dbUsers={dbUsers}
                      />
                    )}

                    {activeModal === 'reminder' && (
                      <ReminderModal
                        setActiveModal={setActiveModal}
                        reminderDateTime={reminderDateTime}
                        setReminderDateTime={setReminderDateTime}
                        setReminder={setReminder}
                      />
                    )}

                    {activeModal === 'schedule_send' && (
                      <ScheduleSendModal
                        setActiveModal={setActiveModal}
                        scheduleDateTime={scheduleDateTime}
                        setScheduleDateTime={setScheduleDateTime}
                        pendingScheduledText={pendingScheduledText}
                        handleScheduleMessage={handleScheduleMessage}
                      />
                    )}

                    {activeModal === 'admin_edit_user' && (
                      <AdminEditUserModal
                        setActiveModal={setActiveModal}
                        adminForm={adminForm}
                        setAdminForm={setAdminForm}
                        handleEditUserSubmit={handleEditUserSubmit}
                      />
                    )}

                    {activeModal === 'task_analytics' && (
                      <TaskAnalyticsModal setActiveModal={setActiveModal} analyticsData={analyticsData} />
                    )}

                    {isUploading && <UploadOverlay uploadProgress={uploadProgress} fileName="" />}
                </div>
            )}
        </div>
    );
}
