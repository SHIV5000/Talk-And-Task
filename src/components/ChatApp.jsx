import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// Components
import RightSidebar from './Sidebar/RightSidebar.jsx';
import AdminPanel from './Admin/AdminPanel.jsx';
import LeftSidebar from './Sidebar/LeftSidebar.jsx';
import UploadOverlay from './Common/UploadOverlay.jsx';
import Toast from './Common/Toast.jsx';
import MemoizedAvatar from './Common/MemoizedAvatar.jsx';
import ChatView from './Chat/ChatView.jsx';
import InputArea from './Chat/InputArea.jsx';
import ModalManager from './Modals/ModalManager.jsx';

// Hooks & Utils
import useWorkspaceData from '../hooks/useWorkspaceData.js'; // 👈 NEW HOOK IMPORTED
import { compressImage } from '../utils/imageUtils.js';
import { formatMessageText, lockExtension } from '../utils/helpers.js';
import { auth, db, storage, signOut } from '../firebase.js';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc, setDoc, getDocs, where, deleteDoc, ref, uploadBytesResumable, getDownloadURL } from '../firebase.js';

const MAX_FILE_SIZE_MB = 10;

export default function ChatApp({ user, onLogout }) {
    // ==================== STATE ====================
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
    const [activeGroup, setActiveGroup] = useState(null);
    const [typingStatus, setTypingStatus] = useState([]);
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

    // ==================== TOAST & REFS ====================
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
    const prevMessagesCountRef = useRef(0);
    const lastTypingTime = useRef(0);
    const highlightTimerRef = useRef(null);
    const inactivityTimerRef = useRef(null);
    const inactivityCountdownRef = useRef(null);
    const lastActivityRef = useRef(Date.now());

    // ==================== OTHER STATES ====================
    const [pendingScrollTarget, setPendingScrollTarget] = useState(null);
    const loaderTips = ["Type '@' to instantly mention peers.", "Convert messages to trackable tasks.", "Secure session logs out after 5 mins.", "Press 'Enter' to submit task updates."];
    const [currentTip, setCurrentTip] = useState(loaderTips[0]);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
    const [highlightedMsgId, setHighlightedMsgId] = useState(null);
    const [unreadHighlightIds, setUnreadHighlightIds] = useState([]);
    const [scheduledMessages, setScheduledMessages] = useState([]);
    const [scheduleDateTime, setScheduleDateTime] = useState("");
    const [showScheduleInput, setShowScheduleInput] = useState(false);
    const [pendingScheduledText, setPendingScheduledText] = useState("");
    const [msgScheduleDateTime, setMsgScheduleDateTime] = useState("");
    const [offlineDrafts, setOfflineDrafts] = useState([]);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [showInactivityWarning, setShowInactivityWarning] = useState(false);
    const [inactivityCountdown, setInactivityCountdown] = useState(60);

    // 👇 NEW: INITIALIZE CUSTOM HOOK
    const { 
        isVipAdmin, currentUserData, dbUsers, groups, 
        activeReminders, genericNotifications, allAdminReminders, 
        immutableAuditLogs, toolPreferences, setToolPreferences 
    } = useWorkspaceData(user, profileForm, setProfileForm);

    // ==================== EFFECTS ====================
    useEffect(() => {
        let tipIndex = 0;
        const tipInterval = setInterval(() => { tipIndex = (tipIndex + 1) % loaderTips.length; setCurrentTip(loaderTips[tipIndex]); }, 1500);
        const timer = setTimeout(() => { clearInterval(tipInterval); setIsWorkspaceLoading(false); }, 4000);
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
                    cnt -= 1; setInactivityCountdown(cnt);
                    if (cnt <= 0) { clearInterval(inactivityCountdownRef.current); signOut(auth); }
                }, 1000);
            }, IDLE_WARN);
        };
        const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
        events.forEach(ev => window.addEventListener(ev, resetInactivity));
        resetInactivity();
        return () => { events.forEach(ev => window.removeEventListener(ev, resetInactivity)); clearTimeout(inactivityTimerRef.current); clearInterval(inactivityCountdownRef.current); };
    }, [showInactivityWarning]);

    // CHRON JOB FOR DEADLINE ALERTS (Keep this here for now)
    useEffect(() => {
        // ... rest of ChatApp.jsx continues here exactly as it was ...
