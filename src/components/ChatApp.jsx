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
import MessageBubble from './Chat/MessageBubble.jsx'; 

// Custom Enterprise Hooks
import useWorkspaceData from '../hooks/useWorkspaceData.js';
import useChatEngine from '../hooks/useChatEngine.js';

// Utils & Firebase Core
import { lockExtension, getNextWorkingDay9AM } from '../utils/helpers.js';
import { auth, db, storage, signOut } from '../firebase.js';
import { collection, addDoc, doc, updateDoc, setDoc, getDocs, query, where, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

// Global String Formatter (Prevents raw HTML showing in menus)
const stripHtml = (html) => html ? String(html).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ') : '';

// 👇 UPDATED: Slack Sidebar Input uses matching WYSIWYG Editor 👇
const ThreadSidebar = ({ activeThread, setActiveThread, messages, user, currentUserData, dbUsers, groups, handleReactionIntercept, deleteMessageDB, setActiveModal, sendMessageToDB, customTags, toolPreferences, setReplyingTo, setSelectedMessage }) => {
    const threadMessages = messages.filter(m => m.replyToId === activeThread.id).sort((a,b) => (a.timestamp?.toMillis?.() || 0) - (b.timestamp?.toMillis?.() || 0));
    const [text, setText] = useState('');
    const threadInputRef = useRef(null);
    
    const handleSend = async () => {
        if(!text.trim() || text === '<br>') return;
        await sendMessageToDB(text.trim(), { id: activeThread.id, sender: activeThread.sender, text: activeThread.text || activeThread.fileName });
        setText('');
        if(threadInputRef.current) threadInputRef.current.innerHTML = '';
    }

    return (
        <div className="w-80 md:w-96 bg-slate-50 border-l border-slate-200 flex flex-col h-full shadow-2xl animate-in slide-in-from-right z-50 absolute right-0 md:relative">
            <style>{`.custom-wysiwyg:empty:before { content: attr(data-placeholder); color: #9ca3af; pointer-events: none; display: block; }`}</style>
            <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between shadow-sm z-10 shrink-0 h-[59px]">
                <div>
                    <h3 className="font-bold text-slate-800 leading-tight">Thread</h3>
                    <span className="text-[11px] text-slate-500 font-medium">Discussion</span>
                </div>
                <button onClick={() => setActiveThread(null)} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-sidebar-scroll">
                <MessageBubble 
                    msg={activeThread} userEmail={user.email} currentUserData={currentUserData} dbUsers={dbUsers} 
                    groups={groups} isVipAdmin={false} handleReaction={handleReactionIntercept} handleDeleteMessage={deleteMessageDB} 
                    customTags={customTags} toolPreferences={toolPreferences} setActiveModal={setActiveModal} 
                    setReplyingTo={setReplyingTo} setSelectedMessage={setSelectedMessage} chatInputRef={threadInputRef} isThreadView={true} 
                />
                
                <div className="flex items-center gap-3 my-4 opacity-80">
                    <div className="flex-1 h-px bg-slate-300"></div>
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">{threadMessages.length} Replies</span>
                    <div className="flex-1 h-px bg-slate-300"></div>
                </div>

                {threadMessages.map(m => (
                    <MessageBubble 
                        key={m.id} msg={m} userEmail={user.email} currentUserData={currentUserData} dbUsers={dbUsers} 
                        groups={groups} isVipAdmin={false} handleReaction={handleReactionIntercept} handleDeleteMessage={deleteMessageDB} 
                        customTags={customTags} toolPreferences={toolPreferences} setActiveModal={setActiveModal} 
                        setReplyingTo={setReplyingTo} setSelectedMessage={setSelectedMessage} chatInputRef={threadInputRef} isThreadView={true} 
                    />
                ))}
            </div>
            <div className="p-3 border-t border-slate-200 bg-white shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
                <div className="flex gap-2 items-end bg-slate-50 rounded-xl border border-slate-200 focus-within:border-indigo-400 focus-within:bg-white transition-all shadow-sm p-1.5 pr-2">
                   <div 
                      contentEditable 
                      ref={threadInputRef}
                      onInput={e => setText(e.currentTarget.innerHTML)}
                      suppressContentEditableWarning={true}
                      data-placeholder="Reply to thread..."
                      className="custom-wysiwyg bg-transparent flex-1 outline-none text-[13px] text-slate-800 py-2 px-3 overflow-y-auto font-medium"
                      style={{ minHeight: '38px', maxHeight: '120px' }}
                   />
                   <button onClick={handleSend} disabled={!text.trim() || text === '<br>'} className="w-[36px] h-[36px] rounded-full bg-indigo-600 text-white flex items-center justify-center disabled:opacity-50 hover:bg-indigo-700 transition-colors shadow-sm shrink-0 mb-0.5"><i className="fa-solid fa-paper-plane text-xs ml-[-2px]"></i></button>
                </div>
            </div>
        </div>
    )
};

export default function ChatApp({ user, onLogout }) {
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
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const searchWrapperRef = useRef(null);

    const [activeThread, setActiveThread] = useState(null);
    const [dismissedBroadcastId, setDismissedBroadcastId] = useState(null);

    const [sidebarSearch, setSidebarSearch] = useState("");
    const [chatFilter, setChatFilter] = useState("all");
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [replyingTo, setReplyingTo] = useState(null);
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [editMessageText, setEditMessageText] = useState("");
    const [activeGroup, setActiveGroup] = useState(null);
    
    const [taskAssignees, setTaskAssignees] = useState([]);
    const [taskDeadline, setTaskDeadline] = useState("");
    const [taskPriority, setTaskPriority] = useState("Medium");
    const [delegateAssignees, setDelegateAssignees] = useState([]);
    const [showDelegateDropdown, setShowDelegateDropdown] = useState(false);
    const [trailComment, setTrailComment] = useState("");
    const [reminderDateTime, setReminderDateTime] = useState("");
    const [isEditingTaskTitle, setIsEditingTaskTitle] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState("");
    
    // 👇 NEW STATES for acknowledgment & proof
    const [requireAck, setRequireAck] = useState(false);
    const [ackTimeOption, setAckTimeOption] = useState('any'); // 'immediate','30min','1hr','2hr','3hr','eod','any'
    const [requireProof, setRequireProof] = useState(false);

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
    const lastNotifId = useRef(null);

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
        isVipAdmin, currentUserData, dbUsers, groups, customTags,
        activeReminders, genericNotifications, allAdminReminders, 
        immutableAuditLogs, toolPreferences, setToolPreferences,
        globalAnnouncement 
    } = useWorkspaceData(user, profileForm, setProfileForm);

    const {
        messages, typingStatus, isOnline, offlineDrafts,
        logImmutableAction, triggerTypingEvent, sendMessageToDB, reactToMessageDB,
        deleteMessageDB, editMessageDB, togglePinDB, toggleBookmarkDB,
        uploadAndSendFileDB, scheduleMessageDB, saveOfflineDraft, deleteOfflineDraft
    } = useChatEngine({ 
        user, activeGroup, dbUsers, groups, toolPreferences, isWorkspaceLoading, addToast 
    });

    useEffect(() => {
        if (toolPreferences?.darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [toolPreferences?.darkMode]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target)) {
                setIsSearchFocused(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const playMelody = useCallback((type) => {
        try {
            const incomingSound = 'https://firebasestorage.googleapis.com/v0/b/niltask.firebasestorage.app/o/sounds%2FINCOMING-MESSAGE-TASK-CREATE-UPDATE.mp3?alt=media&token=413e00ca-6dc0-41e1-85d9-3d02e53ca526';
            const outgoingSound = 'https://firebasestorage.googleapis.com/v0/b/niltask.firebasestorage.app/o/sounds%2FOUTGOING-MESSAGE-TASK-CREATE-UPDATE.mp3?alt=media&token=4f357d75-c496-4f53-8f6a-fd0e6e81b41d';
            const bannerSound = 'https://firebasestorage.googleapis.com/v0/b/niltask.firebasestorage.app/o/sounds%2FBANNER.mp3?alt=media&token=b3463c11-1f70-4450-8efc-049e04f33a0a';
            
            let soundUrl = outgoingSound; 
            switch (type) {
                case 'messageReceived':
                case 'taskCreated':
                case 'taskUpdated':
                case 'taskFileUpload':
                    soundUrl = incomingSound; break;
                case 'broadcast':
                    soundUrl = bannerSound; break;
                default: soundUrl = outgoingSound; break;
            }
            const audio = new Audio(soundUrl);
            audio.volume = 1.0;
            const playPromise = audio.play();
            if (playPromise !== undefined) playPromise.catch(err => console.warn("Audio blocked:", err));
        } catch(e) {}
    }, []);

    // 👇 NEW: Trigger sound when a new generic notification lands (e.g. Reply, Task Edit)
    useEffect(() => {
        if (genericNotifications.length > 0 && genericNotifications[0].id !== lastNotifId.current) {
            if (lastNotifId.current !== null) playMelody('messageReceived');
            lastNotifId.current = genericNotifications[0].id;
        }
    }, [genericNotifications, playMelody]);

    // 👇 NEW: Trigger Banner Sound when Global Announcement Drops
    useEffect(() => {
        if (globalAnnouncement?.isActive && globalAnnouncement.id !== dismissedBroadcastId) {
            playMelody('broadcast');
        }
    }, [globalAnnouncement?.isActive, globalAnnouncement?.id, dismissedBroadcastId, playMelody]);

    const handleAckBroadcast = async () => {
        if (!globalAnnouncement) return;
        setDismissedBroadcastId(globalAnnouncement.id);
        try {
            await addDoc(collection(db, "broadcast_acks"), {
                broadcastId: globalAnnouncement.id,
                userEmail: user.email,
                userName: currentUserData?.name || user.email.split('@')[0],
                timestamp: serverTimestamp()
            });
        } catch(e){}
    };

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
        return messages.filter(m => m.isTask && m.taskData?.status !== "Completed" && m.taskData?.assignees?.includes(user.email) && !(m.taskData?.dismissedBy || []).includes(user.uid));
    }, [messages, user.email, user.uid]);
    
    const totalNotifications = genericNotifications.length + activeActionableTasks.length;

    const pinnedMessages = useMemo(() => activeGroup ? messages.filter(m => m.groupId === activeGroup.id && m.isPinned) : [], [messages, activeGroup]);

    const globalSearchResults = useMemo(() => {
        if (!searchQuery.trim()) return null;
        const q = searchQuery.toLowerCase();
        
        const matchedUsers = dbUsers.filter(u => (u.name||'').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q));
        const matchedTags = (customTags || []).filter(t => (t.label||'').toLowerCase().includes(q) || (t.shortCode||'').toLowerCase().includes(q));
        
        const matchedMessages = messages.filter(m => {
            if (m.isPrivateMention && !m.allowedUsers?.includes(user.email) && m.senderEmail !== user.email) return false;
            
            const strippedText = stripHtml(m.text).toLowerCase();
            const textMatch = strippedText.includes(q);
            const fileMatch = (m.fileName || '').toLowerCase().includes(q);
            const trailMatch = m.isTask && (m.taskData?.trail || []).some(t => (t.comment || '').toLowerCase().includes(q));
            
            return textMatch || fileMatch || trailMatch;
        }).sort((a,b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0)).slice(0, 50);

        return { users: matchedUsers, tags: matchedTags, messages: matchedMessages };
    }, [searchQuery, dbUsers, customTags, messages, user.email]);

    const messagesToRender = useMemo(() => {
        if(!activeGroup) return [];
        let filtered = messages.filter(m => m.groupId === activeGroup.id && (!m.isPrivateMention || m.allowedUsers?.includes(user.email)));

        if (chatFilter === 'tasks-pending') filtered = filtered.filter(m => m.isTask && m.taskData?.status !== "Completed");
        else if (chatFilter === 'tasks-completed') filtered = filtered.filter(m => m.isTask && m.taskData?.status === "Completed");
        else if (chatFilter === 'messages') filtered = filtered.filter(m => !m.isTask);
        else if (chatFilter === 'today') filtered = filtered.filter(m => m.dateString === new Date().toISOString().split('T')[0]);
        else if (chatFilter === 'bookmarked') filtered = filtered.filter(m => m.bookmarkedBy?.includes(user.email));

        if (!searchQuery.trim() && (chatFilter === 'all' || chatFilter === 'messages')) {
            return filtered.filter(m => !m.replyToId).sort((a,b) => (a.timestamp?.toMillis?.() || 0) - (b.timestamp?.toMillis?.() || 0));
        }

        return filtered;
    }, [messages, activeGroup, user.email, chatFilter, searchQuery]);

    const tasksAssignedToMe = useMemo(() => messages.filter(m => m.isTask && m.taskData?.assignees?.includes(user.email)).sort((a,b) => new Date(a.taskData.deadline).getTime() - new Date(b.taskData.deadline).getTime()), [messages, user.email]);
    const tasksAssignedByMe = useMemo(() => messages.filter(m => m.isTask && m.senderEmail === user.email).sort((a,b) => new Date(a.taskData.deadline).getTime() - new Date(b.taskData.deadline).getTime()), [messages, user.email]);

    const triggerHighlight = useCallback((msgId) => {
        setHighlightedMsgId(msgId);
        if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = setTimeout(() => { setHighlightedMsgId(null); }, 4000);
    }, []);

    const scrollToMessageDirect = useCallback((msgId) => {
        const el = document.getElementById(`msg-${msgId}`);
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); triggerHighlight(msgId); }
    }, [triggerHighlight]);

    // 👇 UPDATED: Universal Router now handles slack-threads auto-opening 👇
    const navigateToMessageFromNotification = useCallback(async (msgId, targetGroupId, replyToId = null) => {
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
            
            if (replyToId) {
                const parentMsg = messages.find(m => m.id === replyToId);
                if (parentMsg) setActiveThread(parentMsg);
            }
            
            setTimeout(() => { setPendingScrollTarget(msgId); }, 50);
        }
    }, [groups, dbUsers, user.uid, user.email, messages]);

    const handleSendOfflineAware = async () => {
        if (!inputText.trim() || inputText === '<br>' || !activeGroup) return;
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
        const msgText = inputText.trim();
        await sendMessageToDB(msgText, replyingTo);
        playMelody('messageSent'); 
        if(chatInputRef.current) chatInputRef.current.innerHTML = '';
        setInputText(""); setEmojiPickerOpen(false); setReplyingTo(null);
        
        const otherMembers = (activeGroup.members || []).filter(email => email !== user.email);
        const uidsToNotify = dbUsers.filter(u => otherMembers.includes(u.email)).map(u => u.uid);
        for (const uid of uidsToNotify) {
            addDoc(collection(db, "notifications"), { 
                userId: uid, type: "message", 
                text: `New Message in ${activeGroup.name}: "${stripHtml(msgText).substring(0,40)}..."`, 
                groupId: activeGroup.id, timestamp: serverTimestamp(), isRead: false 
            }).catch(()=>{});
        }

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
        if(chatInputRef.current) chatInputRef.current.innerHTML = '';
        for (let i = 0; i < filesToProcess.length; i++) {
            let pf = filesToProcess[i];
            let finalCaption = pf.caption || "";
            if (i === 0 && currentText && currentText !== '<br>') finalCaption = finalCaption ? `${currentText}\n${finalCaption}` : currentText;
            pf.caption = finalCaption; pf.text = finalCaption; 
            
            if (pf.allowDownload === false) pf.customName = `__SECURE__${pf.customName}`;
            
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
        if (currentInput) { setInputText(''); if(chatInputRef.current) chatInputRef.current.innerHTML = ''; }
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
                    if (currentInput) { setInputText(''); if(chatInputRef.current) chatInputRef.current.innerHTML = ''; }
                }
            }
        }
    };

    const handleScheduleMessage = async (isTask = false, taskData = null) => {
        const text = pendingScheduledText || inputText.trim();
        if (!text || text === '<br>' || !scheduleDateTime || !activeGroup) return alert("Enter message text and a future date/time.");
        if (new Date(scheduleDateTime) <= new Date()) return alert("Scheduled time must be in the future.");
        try {
            await scheduleMessageDB(text, scheduleDateTime, isTask, taskData);
            setInputText(""); setPendingScheduledText(""); setScheduleDateTime(""); setActiveModal(null);
            if(chatInputRef.current) chatInputRef.current.innerHTML = '';
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
            try { await addDoc(collection(db, "notifications"), { userId: uid, type: "task", text: `"${stripHtml(taskMsg.text).substring(0,30)}..." - ${(user.email || "").split('@')[0]} updated ✅`, messageId: taskMsg.id, groupId: taskMsg.groupId, timestamp: serverTimestamp(), isRead: false }); } catch (e) {}
        }
    };

    // 👇 UPDATED convertToTask function with acknowledgment & proof fields
    const convertToTask = async () => {
        if (!selectedMessage || !taskDeadline || taskAssignees.length === 0) return alert("Please select Assignees, Priority, and Deadline.");
        try {
            const now = new Date();
            let ackDeadline = null;

            // Calculate acknowledgment deadline based on selected option
            if (requireAck) {
                switch (ackTimeOption) {
                    case 'immediate': // no timer, but ack still required
                        break;
                    case '30min':
                        ackDeadline = new Date(now.getTime() + 30 * 60 * 1000);
                        break;
                    case '1hr':
                        ackDeadline = new Date(now.getTime() + 60 * 60 * 1000);
                        break;
                    case '2hr':
                        ackDeadline = new Date(now.getTime() + 2 * 60 * 60 * 1000);
                        break;
                    case '3hr':
                        ackDeadline = new Date(now.getTime() + 3 * 60 * 60 * 1000);
                        break;
                    case 'eod':
                        ackDeadline = getNextWorkingDay9AM(now);
                        break;
                    case 'any':
                        // no automatic escalation, but ack button still required
                        break;
                    default:
                        break;
                }
            }

            const taskData = {
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
                    to: taskAssignees.map(email => {
    const u = dbUsers.find(x => x.email === email);
    return u ? u.name : (email||"").split('@')[0];
}).join(', ')
                }],
                requireAck: requireAck,
                ackDeadline: ackDeadline ? ackDeadline.toISOString() : null,
                acknowledged: false,
                requireProof: requireProof,
                escalated: false
            };

            await setDoc(doc(db, "messages", selectedMessage.id), {
                isTask: true,
                taskData: taskData
            }, { merge: true });

            taskAssignees.forEach(email => {
                if (email !== user.email) {
                    const assigneeUser = dbUsers.find(u => u.email === email);
                    if (assigneeUser) {
                        addDoc(collection(db, "notifications"), { 
                            userId: assigneeUser.uid, 
                            type: "task", 
                            text: `"${stripHtml(selectedMessage.text).substring(0,30)}..." - Assigned to You 🕒`, 
                            messageId: selectedMessage.id, 
                            groupId: selectedMessage.groupId, 
                            timestamp: serverTimestamp(), 
                            isRead: false 
                        }).catch(() => {});
                    }
                }
            });

            logImmutableAction("TASK_CREATE", `Converted to Task: "${stripHtml(selectedMessage.text)}"`, `Assignees: ${taskAssignees.join(', ')} | Priority: ${taskPriority}`);
            playMelody('taskCreated'); 
            setActiveModal(null); 
            setTaskAssignees([]);
            // Reset new states
            setRequireAck(false);
            setAckTimeOption('any');
            setRequireProof(false);
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
            const updatedTrail = [...selectedMessage.taskData.trail, { action: "Delegated", by: user.email, time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ', ' + now.toLocaleDateString(), to: delegateAssignees.map(email => {   const u = dbUsers.find(x => x.email === email);
    return u ? u.name : (email||"").split('@')[0];}).join(', ') }];
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
                const updatedTrail = [...selectedMessage.taskData.trail, { action: "File Uploaded", by: userEmail, time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ', ' + now.toLocaleDateString(), comment: "Attached file via system", fileUrl: downloadURL, fileName: file.name }];
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
            await addDoc(collection(db, "reminders"), { userId: user.uid, userEmail: user.email, messageId: selectedMessage.id, messageText: stripHtml(selectedMessage.text) || selectedMessage.fileName || "File Attachment", remindAt: reminderDateTime, isTriggered: false });
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

    const handleReactionIntercept = async (msgId, tagLabel) => {
        await reactToMessageDB(msgId, tagLabel);
        const msg = messages.find(m => m.id === msgId);
        if (msg && msg.senderEmail !== user.email) {
            const sender = dbUsers.find(u => u.email === msg.senderEmail);
            if (sender) {
                addDoc(collection(db, "notifications"), { 
                    userId: sender.uid, type: "reaction", 
                    text: `${currentUserData?.name || user.email.split('@')[0]} affixed ${tagLabel} to your message.`, 
                    messageId: msgId, groupId: activeGroup?.id || '', timestamp: serverTimestamp(), isRead: false 
                }).catch(()=>{});
            }
        }
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
            let updateData = { name: profileForm.name, fontSize: profileForm.fontSize, fontFamily: profileForm.fontFamily };
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
        const pendingTasks = dmMessages.filter(m => m.isTask && m.taskData?.status !== "Completed" && m.taskData?.assignees?.includes(user.email) && !(m.taskData?.dismissedBy || []).includes(user.uid) && m.senderEmail === otherUserEmail);
        return { unreadCount: unreadMsgs.length, pendingTaskCount: pendingTasks.length, total: unreadMsgs.length + pendingTasks.length };
    }, [messages, user.uid, user.email]);

    const getUnreadInfoForGroup = useCallback((groupId) => {
        const groupMsgs = messages.filter(m => m.groupId === groupId);
        const visibleMsgs = groupMsgs.filter(m => !m.isPrivateMention || m.allowedUsers?.includes(user.email));
        const unreadMsgs = visibleMsgs.filter(m => m.senderUid !== user.uid && !(m.seenBy || []).includes(user.email));
        const pendingTasks = visibleMsgs.filter(m => m.isTask && m.taskData?.status !== "Completed" && m.taskData?.assignees?.includes(user.email) && !(m.taskData?.dismissedBy || []).includes(user.uid));
        return { unreadCount: unreadMsgs.length, pendingTaskCount: pendingTasks.length, total: unreadMsgs.length + pendingTasks.length };
    }, [messages, user.uid, user.email]);

    // 👇 modalProps – ADD the new acknowledgment & proof states so they reach TaskConvertModal
    const modalProps = {
        activeModal, setActiveModal, selectedMessage, setSelectedMessage,
        setReplyingTo, chatInputRef, currentUserData, profileForm,
        setProfileForm, profilePicInputRef, profileUploadProgress,
        setProfileUploadProgress, handleProfileSubmit, toolPreferences,
        setToolPreferences, user, groupForm, setGroupForm, editingGroup,
        handleGroupSubmit, groupPicInputRef, handleGroupPicUpload,
        groupPicUploadProgress, dbUsers, activeGroup, isVipAdmin, customTags,
        handleUpdateGroupMembers, onGroupUpdate, isEditingTaskTitle,
        setIsEditingTaskTitle, newTaskTitle, setNewTaskTitle, handleSaveTaskTitle,
        delegateAssignees, setDelegateAssignees, showDelegateDropdown,
        setShowDelegateDropdown, convertToTask, taskAssignees, setTaskAssignees,
        taskDeadline, setTaskDeadline, taskPriority, setTaskPriority,
        reminderDateTime, setReminderDateTime, scheduleDateTime, setScheduleDateTime,
        pendingScheduledText, handleScheduleMessage, adminForm, setAdminForm,
        isUploading, uploadProgress, setReminder,
        handleDelegateTask, handleCompleteTask,
        trailFileInputRef, handleTrailFileUpload, handleAddComment,
        messages, groups, trailComment, setTrailComment, activeReminders, 
        readOnly: viewMode === "admin",
        // 👇 NEW props
        requireAck, setRequireAck,
        ackTimeOption, setAckTimeOption,
        requireProof, setRequireProof,
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
        <div className="flex flex-col h-screen w-full bg-slate-50 text-slate-800 overflow-hidden relative font-sans transition-opacity duration-700 ease-out opacity-100 dark:bg-slate-900">
            
            {globalAnnouncement?.isActive && globalAnnouncement.id !== dismissedBroadcastId && (
                <div className={`flex items-center justify-between px-4 py-3 shrink-0 shadow-md relative z-[100] ${
                    globalAnnouncement.type === 'emergency' ? 'bg-rose-600 text-white border-b-4 border-rose-800' : 
                    globalAnnouncement.type === 'warning' ? 'bg-amber-500 text-white border-b-4 border-amber-600' : 
                    'bg-indigo-600 text-white border-b-4 border-indigo-800'
                }`}>
                    <div className="flex items-center">
                        <i className={`fa-solid ${
                            globalAnnouncement.type === 'emergency' ? 'fa-bullhorn animate-pulse' : 
                            globalAnnouncement.type === 'warning' ? 'fa-clock' : 'fa-pen'
                        } mr-3 text-lg`}></i>
                        <div className="text-sm font-bold tracking-wide">
                            <span className="uppercase opacity-80 mr-2">{globalAnnouncement.author}:</span>
                            <span dangerouslySetInnerHTML={{__html: globalAnnouncement.message}}></span>
                        </div>
                    </div>
                    {/* 👇 "Got It" Acknowledgement Button 👇 */}
                    <button onClick={handleAckBroadcast} className="ml-4 px-4 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shadow-sm border border-white/20">
                        Got It
                    </button>
                </div>
            )}
            
            <div className="flex-1 flex overflow-hidden relative">
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
                  setViewMode={setViewMode}
                  setActiveModal={setActiveModal}
                  dbUsers={dbUsers}
                  groups={groups}
                  filteredAuditLogs={immutableAuditLogs} 
                  adminFilterUser={adminFilterUser}
                  setAdminFilterUser={setAdminFilterUser}
                  adminFilterDate={adminFilterDate}
                  setAdminFilterDate={setAdminFilterDate}
                  adminFilterType={adminFilterType}
                  setAdminFilterType={setAdminFilterType}
                  adminFilterGroup={adminFilterGroup}
                  setAdminFilterGroup={setAdminFilterGroup}
                  handleToggleApprove={(u) => updateDoc(doc(db, "users", u.uid), { isApproved: !u.isApproved })} 
                  handleToggleAdmin={async (u) => { await updateDoc(doc(db, "users", u.uid), { isAdmin: !u.isAdmin }); }}
                  handleToggleCanCreateGroups={async (u) => { await updateDoc(doc(db, "users", u.uid), { canCreateGroups: !u.canCreateGroups }); }}
                  setSelectedMessage={setSelectedMessage}
                  setIsEditingTaskTitle={setIsEditingTaskTitle}
                  messages={messages}
                  setGroupForm={setGroupForm}
                  setEditingGroup={setEditingGroup}
                  groupForm={groupForm}
                  editingGroup={editingGroup}
                  handleGroupSubmit={handleGroupSubmit}
                  handleGroupPicUpload={handleGroupPicUpload}
                  groupPicUploadProgress={groupPicUploadProgress}
                  globalAnnouncement={globalAnnouncement}
                  currentUserData={currentUserData}
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

                                    <div className="hidden md:flex flex-1 max-w-md mx-4 relative" ref={searchWrapperRef}>
                                        <div className="bg-slate-50 rounded-full flex items-center px-4 py-1.5 shadow-inner border border-slate-200 focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-500 transition-all w-full">
                                            <i className="fa-solid fa-search text-[14px] text-indigo-400 mr-2"></i>
                                            <input 
                                               type="text" 
                                               placeholder="Global Search (Users, Tags, Tasks, Messages)..." 
                                               className="bg-transparent outline-none flex-1 text-[13px] text-slate-800 placeholder-slate-400 font-medium" 
                                               value={searchQuery} 
                                               onChange={(e) => setSearchQuery(e.target.value)} 
                                               onFocus={() => setIsSearchFocused(true)} 
                                            />
                                            {searchQuery && <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600 ml-1"><i className="fa-solid fa-xmark text-xs"></i></button>}
                                        </div>
                                        
                                        {isSearchFocused && globalSearchResults && (
                                            <div className="absolute top-[110%] left-0 w-[550px] bg-white rounded-2xl shadow-2xl border border-slate-200 z-[100] max-h-[70vh] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2">
                                                <div className="p-3 bg-indigo-50 border-b border-indigo-100 text-xs font-bold text-indigo-600 uppercase tracking-widest flex justify-between">
                                                    <span>Global Search Engine</span>
                                                    <span>{globalSearchResults.users.length + globalSearchResults.tags.length + globalSearchResults.messages.length} Found</span>
                                                </div>
                                                <div className="overflow-y-auto p-2 custom-sidebar-scroll">
                                                    
                                                    {globalSearchResults.users.length > 0 && (
                                                        <div className="mb-4">
                                                            <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider"><i className="fa-solid fa-users mr-1"></i> Directory Users</div>
                                                            {globalSearchResults.users.map(u => (
                                                                <div key={u.uid} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-100">
                                                                    <MemoizedAvatar uid={u.uid} url={u.profilePicUrl} name={u.name} sizeClass="w-8 h-8" />
                                                                    <div>
                                                                        <div className="font-bold text-slate-800 text-sm leading-tight">{u.name}</div>
                                                                        <div className="text-[11px] text-slate-400 font-medium">{u.email}</div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    
                                                    {globalSearchResults.tags.length > 0 && (
                                                        <div className="mb-4">
                                                            <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider"><i className="fa-solid fa-hashtag mr-1"></i> Workflow Tags</div>
                                                            <div className="flex flex-wrap gap-2 px-3 pt-1">
                                                                {globalSearchResults.tags.map(t => (
                                                                    <span key={t.id} className={`px-2.5 py-1 rounded-md text-xs font-bold shadow-sm ${t.bgClass} ${t.textClass}`}>{t.label}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    
                                                    {globalSearchResults.messages.length > 0 && (
                                                        <div className="mb-2">
                                                            <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider"><i className="fa-solid fa-comments mr-1"></i> Messages & Tasks</div>
                                                            {/* 👇 UPDATED: Universal Click Routing routes directly to threads 👇 */}
                                                            {globalSearchResults.messages.map(m => (
                                                                <div key={m.id} onClick={() => { setIsSearchFocused(false); navigateToMessageFromNotification(m.id, m.groupId, m.replyToId); }} className="flex flex-col gap-1 p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-slate-200 mb-1.5">
                                                                    <div className="flex justify-between items-center">
                                                                        <div className="text-[11px] font-extrabold text-indigo-600">{(m.sender||'').split('@')[0]}</div>
                                                                        <div className="text-[10px] text-slate-400 font-semibold">{m.dateString}</div>
                                                                    </div>
                                                                    <div className="text-[13px] text-slate-700 line-clamp-2 leading-snug font-medium">
                                                                        {stripHtml(m.text) || m.fileName || 'Attached File'}
                                                                    </div>
                                                                    {m.isTask && (
                                                                        <div className="text-[9px] mt-1.5 font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded w-fit border border-amber-200 uppercase tracking-wider">
                                                                            <i className="fa-solid fa-square-check mr-1"></i> Task Card
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    
                                                    {globalSearchResults.users.length === 0 && globalSearchResults.tags.length === 0 && globalSearchResults.messages.length === 0 && (
                                                        <div className="text-center p-8 text-slate-400 font-medium text-sm flex flex-col items-center">
                                                            <i className="fa-solid fa-magnifying-glass text-3xl mb-3 text-slate-300"></i>
                                                            No matching results found across the workspace.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
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
                                                                <div className="text-[13px] text-slate-800 line-clamp-2 leading-snug font-medium">"{stripHtml(task.text)}"</div>
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
                                                        {[...genericNotifications].sort((a,b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0)).map(n => {
                                                          const timeStr = n.timestamp?.toDate ? new Date(n.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now';
                                                          return (
                                                            <div key={n.id} onClick={() => { if (n.messageId) navigateToMessageFromNotification(n.messageId, n.groupId || activeGroup?.id); }} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:border-indigo-300 hover:shadow transition-all flex items-start gap-3 relative pr-8">
                                                              <button onClick={(e) => { e.stopPropagation(); deleteDoc(doc(db, "notifications", n.id)); }} className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors">
                                                                <i className="fa-solid fa-xmark text-[11px]"></i>
                                                              </button>
                                                              <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 shrink-0 mt-0.5"><i className={n.type === 'reply' ? 'fa-solid fa-reply text-xs' : n.type === 'mention' ? 'fa-solid fa-at text-xs' : n.type === 'reminder' ? 'fa-solid fa-clock text-xs' : n.type === 'reaction' ? 'fa-solid fa-face-smile text-xs' : 'fa-solid fa-bolt text-xs'}></i></div>
                                                              <div className="flex-1 overflow-hidden pb-4">
                                                                <div className="text-[13px] font-bold text-slate-800">{n.type === 'reply' ? 'New Reply' : n.type === 'message' ? 'Direct Message' : n.type === 'mention' ? 'Mentioned You' : n.type === 'reminder' ? 'Reminder Alert' : n.type === 'task' ? 'Task Update' : n.type === 'reaction' ? 'New Reaction' : 'Notification'}</div>
                                                                <div className="text-[12px] text-slate-600 mt-0.5 leading-snug line-clamp-2 break-words font-medium">{stripHtml(n.text)}</div>
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

                                <button onClick={() => chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' })} className="absolute top-[80px] right-6 z-40 bg-indigo-600 text-white w-10 h-10 flex items-center justify-center rounded-full shadow-lg hover:bg-indigo-700 transition-all opacity-80 hover:opacity-100" title="Scroll to Bottom">
                                    <i className="fa-solid fa-arrow-down"></i>
                                </button>

                                <button onClick={() => chatContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })} className="absolute bottom-[90px] right-6 z-40 bg-indigo-600 text-white w-10 h-10 flex items-center justify-center rounded-full shadow-lg hover:bg-indigo-700 transition-all opacity-80 hover:opacity-100" title="Scroll to Top">
                                    <i className="fa-solid fa-arrow-up"></i>
                                </button>
                                
                                <ChatView
                                    messagesToRender={messagesToRender} messages={messages} activeGroup={activeGroup} user={user} currentUserData={currentUserData}
                                    isVipAdmin={isVipAdmin} pinnedMessages={pinnedMessages} typingStatus={typingStatus} replyingTo={replyingTo} setReplyingTo={setReplyingTo} 
                                    toolPreferences={toolPreferences} dbUsers={dbUsers} groups={groups} setActiveGroup={setActiveGroup} setShowRightSidebar={setShowRightSidebar} 
                                    setMobileSidebarOpen={setMobileSidebarOpen} pendingScrollTarget={pendingScrollTarget} setPendingScrollTarget={setPendingScrollTarget}
                                    setActiveModal={setActiveModal} scrollToMessageDirect={scrollToMessageDirect} handleReaction={handleReactionIntercept} 
                                    handleToggleBookmark={(m) => toggleBookmarkDB(m.id, m.bookmarkedBy)} handleTogglePin={(m) => togglePinDB(m.id, m.isPinned)} handleDeleteMessage={deleteMessageDB}
                                    chatInputRef={chatInputRef} editingMessageId={editingMessageId} editMessageText={editMessageText} setEditingMessageId={setEditingMessageId} 
                                    setEditMessageText={setEditMessageText} handleSaveEdit={handleSaveEdit} setSelectedMessage={setSelectedMessage} 
                                    setIsEditingTaskTitle={setIsEditingTaskTitle} messagesEndRef={messagesEndRef} chatContainerRef={chatContainerRef} 
                                    isAtBottom={isAtBottom} setIsAtBottom={setIsAtBottom} highlightedMsgId={highlightedMsgId} unreadHighlightIds={unreadHighlightIds} 
                                    handleAddInlineComment={handleAddInlineComment} jumpToPrivateSource={(msgId, groupId) => navigateToMessageFromNotification(msgId, groupId)}
                                    customTags={customTags} setActiveThread={setActiveThread}
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
                                        if (latestInput && latestInput !== '<br>') finalCaption = finalCaption ? `${latestInput}\n${finalCaption}` : latestInput;
                                        pf.caption = finalCaption; pf.text = finalCaption; setInputText("");
                                        if (pf.allowDownload === false) pf.customName = `__SECURE__${pf.customName}`;
                                        await uploadAndSendFileDB(pf, setUploadProgress);
                                    }} 
                                    setActiveModal={setActiveModal}
                                    setPendingScheduledText={setPendingScheduledText} offlineDrafts={offlineDrafts} user={user} dbUsers={dbUsers}
                                    groups={groups} currentUserData={currentUserData} MAX_FILE_SIZE_MB={MAX_FILE_SIZE_MB} handleSendPendingFiles={handleSendPendingFiles}
                                />
                            </div>
                        )}

                        {activeThread ? (
                            <ThreadSidebar 
                                activeThread={activeThread} setActiveThread={setActiveThread} messages={messages} user={user} 
                                currentUserData={currentUserData} dbUsers={dbUsers} groups={groups} handleReactionIntercept={handleReactionIntercept} 
                                deleteMessageDB={deleteMessageDB} setActiveModal={setActiveModal} sendMessageToDB={sendMessageToDB} customTags={customTags} 
                                toolPreferences={toolPreferences} setReplyingTo={setReplyingTo} setSelectedMessage={setSelectedMessage} chatInputRef={chatInputRef}
                            />
                        ) : showRightSidebar ? (
                          <RightSidebar
                            showRightSidebar={showRightSidebar} setShowRightSidebar={setShowRightSidebar} tasksAssignedToMe={tasksAssignedToMe}
                            tasksAssignedByMe={tasksAssignedByMe} groups={groups} dbUsers={dbUsers} user={user} setActiveGroup={setActiveGroup}
                            navigateToMessageFromNotification={navigateToMessageFromNotification} archivedTasks={[]} 
                          />
                        ) : null}
                        <ModalManager {...modalProps} />
                        <Toast toasts={toasts} removeToast={removeToast} />
                    </div>
                )}
            </div>
        </div>
    );
}
