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

const stripHtml = (html) => html ? String(html).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ') : '';

// 🚀 REPLIES / THREAD SIDEBAR ENGINE WITH FILE UPLOAD
const ThreadSidebar = ({ width, activeThread, setActiveThread, messages, user, currentUserData, dbUsers, groups, handleReactionIntercept, deleteMessageDB, setActiveModal, sendMessageToDB, customTags, toolPreferences, setReplyingTo, setSelectedMessage, uploadAndSendFileDB }) => {
    const threadMessages = messages.filter(m => m.replyToId === activeThread.id).sort((a,b) => (a.timestamp?.toMillis?.() || 0) - (b.timestamp?.toMillis?.() || 0));
    const [text, setText] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    
    const threadInputRef = useRef(null);
    const threadFileInputRef = useRef(null);
    
    const handleSend = async () => {
        if(!text.trim() || text === '<br>') return;
        await sendMessageToDB(text.trim(), { id: activeThread.id, sender: activeThread.sender, text: activeThread.text || activeThread.fileName });
        setText('');
        if(threadInputRef.current) threadInputRef.current.innerHTML = '';
    }

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        e.target.value = '';
        setIsUploading(true);
        const pf = { id: Date.now(), file, customName: file.name, caption: text.trim(), text: text.trim() };
        try {
            await uploadAndSendFileDB(pf, setUploadProgress, { replyToId: activeThread.id });
            setText('');
            if(threadInputRef.current) threadInputRef.current.innerHTML = '';
        } catch(err) { alert("Upload failed."); }
        setIsUploading(false);
        setUploadProgress(0);
    }

    return (
        <div style={{ width: width || 350 }} className="bg-slate-50 border-l border-slate-200 flex flex-col h-full shadow-2xl animate-in slide-in-from-right z-50 absolute right-0 md:relative">
            <style>{`.custom-wysiwyg:empty:before { content: attr(data-placeholder); color: #9ca3af; pointer-events: none; display: block; }`}</style>
            <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between shadow-sm z-10 shrink-0 h-[59px]">
                <div>
                    <h3 className="font-bold text-slate-800 leading-tight">Replies</h3>
                    <span className="text-[11px] text-slate-500 font-medium">Threaded Discussion</span>
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
            
            <div className="p-3 border-t border-slate-200 bg-white shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.02)] relative">
                {isUploading && (
                    <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center backdrop-blur-sm">
                        <div className="text-[11px] font-bold text-indigo-600 animate-pulse bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-200 shadow-sm">
                            <i className="fa-solid fa-spinner fa-spin mr-2"></i> Uploading {Math.round(uploadProgress)}%...
                        </div>
                    </div>
                )}
                <div className="flex gap-2 items-end bg-slate-50 rounded-2xl border border-slate-200 focus-within:border-indigo-400 focus-within:bg-white transition-all shadow-sm p-1.5 pr-2">
                   <input type="file" ref={threadFileInputRef} className="hidden" onChange={handleFileUpload} />
                   
                   <button onClick={() => threadFileInputRef.current?.click()} className="shrink-0 w-[38px] h-[38px] flex justify-center items-center rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:scale-105 transition-all shadow-sm border border-indigo-200 mb-0.5">
                       <i className="fa-solid fa-paperclip text-[15px]"></i>
                   </button>
                   
                   <div 
                      contentEditable 
                      ref={threadInputRef}
                      onInput={e => setText(e.currentTarget.innerHTML)}
                      suppressContentEditableWarning={true}
                      data-placeholder="Reply to thread..."
                      className="custom-wysiwyg bg-transparent flex-1 outline-none text-[13px] text-slate-800 py-2.5 px-2 overflow-y-auto font-medium"
                      style={{ minHeight: '38px', maxHeight: '120px' }}
                   />
                   
                   <button onClick={handleSend} disabled={!text.trim() || text === '<br>'} className={`shrink-0 w-[40px] h-[40px] flex justify-center items-center rounded-full transition-all mb-0.5 ${text.trim() && text !== '<br>' ? 'bg-[#00a884] text-white shadow-md hover:bg-[#008f6f] hover:scale-105' : 'bg-slate-200 text-slate-400'}`}>
                       <i className={`fa-solid fa-paper-plane text-[14px] ml-[-2px] ${text.trim() && text !== '<br>' ? 'text-white drop-shadow-md' : 'text-slate-400'}`}></i>
                   </button>
                </div>
            </div>
        </div>
    )
};

export default function ChatApp({ user, onLogout }) {
    
    // 🧱 RESIZABLE PANEL STATES
    const [leftSidebarWidth, setLeftSidebarWidth] = useState(320);
    const [rightSidebarWidth, setRightSidebarWidth] = useState(350);

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
    
    const [requireAck, setRequireAck] = useState(false);
    const [ackTimeOption, setAckTimeOption] = useState('any'); 
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
                    soundUrl = bannerSound;
                    break;
                default: soundUrl = outgoingSound; break;
            }
            const audio = new Audio(soundUrl);
            audio.volume = 1.0;
            const playPromise = audio.play();
            if (playPromise !== undefined) playPromise.catch(err => console.warn("Audio blocked:", err));
        } catch(e) {}
    }, []);

    useEffect(() => {
        if (genericNotifications.length > 0 && genericNotifications[0].id !== lastNotifId.current) {
            if (lastNotifId.current !== null) playMelody('messageReceived');
            lastNotifId.current = genericNotifications[0].id;
        }
    }, [genericNotifications, playMelody]);

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
                const involved = new Set([task.senderEmail, ...(task.taskData.assignees || [])]);
                involved.forEach(email => {
                    const u = dbUsers.find(u => u.email === email);
                    if (u) addDoc(collection(db, "notifications"), { userId: u.uid, type: "task", text: `⏰ DUE NOW: "${stripHtml(task.text)}"`, messageId: task.id, groupId: task.groupId, timestamp: serverTimestamp(), isRead: false }).catch(()=>{});
                });
            });

            const escalatingTasks = messages.filter(m => {
                if (!m.isTask || m.taskData?.status === "Completed" || m.taskData?.escalated) return false;
                const deadlinePassed = m.taskData?.deadline && new Date(m.taskData.deadline) <= now;
                const ackPassed = m.taskData?.requireAck && m.taskData?.ackDeadline && new Date(m.taskData.ackDeadline) <= now && (m.taskData.acknowledgedBy || []).length < (m.taskData.assignees || []).length;
                return deadlinePassed || ackPassed;
            });
            for (const task of escalatingTasks) {
                try {
                    const isAckBreach = task.taskData?.requireAck && task.taskData?.ackDeadline && new Date(task.taskData.ackDeadline) <= now && (task.taskData.acknowledgedBy || []).length < (task.taskData.assignees || []).length;
                    let offenders = []; 
                    if (isAckBreach) { offenders = (task.taskData.assignees || []).filter(a => !(task.taskData.acknowledgedBy || []).includes(a)); } 
                    else { offenders = task.taskData.assignees || []; }

                    const existingBreached = task.taskData.breachedBy || [];
                    const newBreached = [...new Set([...existingBreached, ...offenders])];
                    const offenderNames = offenders.map(e => dbUsers.find(u=>u.email===e)?.name || e.split('@')[0]).join(', ');
                    const reason = isAckBreach ? `Pending Acknowledgment from: ${offenderNames}` : `Final Deadline Missed`; 
                    const trailUpdate = { action: "System Escalation", by: "System", time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ', ' + now.toLocaleDateString(), comment: `🚨 SLA Breach.\n${reason}` };

                    await updateDoc(doc(db, "messages", task.id), {
                        "taskData.escalated": true,
                        "taskData.breachedBy": newBreached,
                        "taskData.trail": [...(task.taskData.trail||[]), trailUpdate]
                    });

                    const notifySet = new Set([task.senderEmail, ...offenders]);
                    notifySet.forEach(email => {
                        const u = dbUsers.find(u => u.email === email);
                        if (u) addDoc(collection(db, "notifications"), { userId: u.uid, type: "task", text: `🚨 ESCALATION ALERT: "${stripHtml(task.text).substring(0,30)}..."`, messageId: task.id, groupId: task.groupId, timestamp: serverTimestamp(), isRead: false }).catch(()=>{});
                    });
                } catch(e) { console.error("Escalation failed", e) }
            }

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
                            text: data.text, groupId: data.groupId, sender: currentUserData?.name || user.email.split('@')[0], senderEmail: user.email, senderUid: user.uid, timestamp: serverTimestamp(), dateString: new Date().toISOString().split('T')[0], time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), isTask: data.isTask || false, taskData: data.taskData || null, seenBy: [user.email]
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
            
            setTimeout(() => { 
                if (msgId) {
                    setPendingScrollTarget(msgId); 
                } else {
                    if (chatContainerRef.current) {
                        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
                        setIsAtBottom(true);
                    }
                }
            }, 300);
        }
    }, [groups, dbUsers, user.uid, user.email, messages]);

    const handleSendOfflineAware = async () => {
        if (!inputText.trim() || inputText === '<br>' || !activeGroup) return;
        if (!isOnline) {
            await saveOfflineDraft(inputText.trim(), activeGroup.id, activeGroup.name);
            setInputText("");
            alert("📥 You are offline. Message saved as draft and will be sent when you reconnect."); return;
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
        setInputText(""); 
        setEmojiPickerOpen(false); 
        setReplyingTo(null); 
        
        const otherMembers = (activeGroup.members || []).filter(email => email !== user.email);
        const uidsToNotify = dbUsers.filter(u => otherMembers.includes(u.email)).map(u => u.uid); 
        for (const uid of uidsToNotify) { 
            addDoc(collection(db, "notifications"), { userId: uid, type: "message", text: `New Message in ${activeGroup.name}: "${stripHtml(msgText).substring(0,40)}..."`, groupId: activeGroup.id, timestamp: serverTimestamp(), isRead: false }).catch(()=>{});
        } 
        if (chatContainerRef.current) { chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight; setIsAtBottom(true); } 
    };

    const handleSaveEdit = async (msg) => { if (!editMessageText.trim()) return setEditingMessageId(null); await editMessageDB(msg.id, msg.text, editMessageText); setEditingMessageId(null); };

    const handleSendPendingFiles = async () => {
        if (pendingFiles.length === 0) return; const currentText = inputText.trim(); const filesToProcess = [...pendingFiles];
        setPendingFiles([]); setShowFileRename(false); setIsUploading(true); setUploadProgress(0); setInputText(""); if(chatInputRef.current) chatInputRef.current.innerHTML = ''; 
        for (let i = 0; i < filesToProcess.length; i++) { 
            let pf = filesToProcess[i];
            let finalCaption = pf.caption || ""; if (i === 0 && currentText && currentText !== '<br>') finalCaption = finalCaption ? `${currentText}\n${finalCaption}` : currentText; 
            pf.caption = finalCaption; pf.text = finalCaption; 
            try { await uploadAndSendFileDB(pf, setUploadProgress); } catch (error) { alert(`Upload failed: ${error.message}`); } 
        } 
        playMelody('fileUpload'); setIsUploading(false); setUploadProgress(0); 
    };

    const handleFileUpload = (e) => {
        const files = Array.from(e.target.files).slice(0, 3); if (files.length === 0) return; e.target.value = '';
        const currentInput = inputText.trim(); const newPending = files.map((file, index) => ({ id: Date.now() + Math.random(), file, customName: file.name, caption: index === 0 ? currentInput : '' }));
        setPendingFiles(prev => [...prev, ...newPending].slice(0, 3)); setShowFileRename(true); if (currentInput) { setInputText(''); if(chatInputRef.current) chatInputRef.current.innerHTML = ''; } 
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
                    setShowFileRename(true); if (currentInput) { setInputText(''); if(chatInputRef.current) chatInputRef.current.innerHTML = ''; } 
                } 
            } 
        } 
    };

    const handleScheduleMessage = async (isTask = false, taskData = null) => { 
        const text = pendingScheduledText || inputText.trim();
        if (!text || text === '<br>' || !scheduleDateTime || !activeGroup) return alert("Enter message text and a future date/time.");
        if (new Date(scheduleDateTime) <= new Date()) return alert("Scheduled time must be in the future.");
        try { 
            await scheduleMessageDB(text, scheduleDateTime, isTask, taskData); setInputText(""); setPendingScheduledText(""); setScheduleDateTime(""); setActiveModal(null); if(chatInputRef.current) chatInputRef.current.innerHTML = '';
            addToast(`✅ Scheduled for ${new Date(scheduleDateTime).toLocaleString()}`, 'success'); 
        } catch(e) { alert("Failed to schedule."); } 
    };

    const notifyInvolvedInTask = async (taskMsg, actionText) => { 
        const involved = new Set(); if (taskMsg.senderEmail) involved.add(taskMsg.senderEmail);
        (taskMsg.taskData?.assignees || []).forEach(a => involved.add(a)); (taskMsg.taskData?.trail || []).forEach(t => { if (t.by) involved.add(t.by); }); involved.delete(user.email);
        const uidsToNotify = dbUsers.filter(u => involved.has(u.email)).map(u => u.uid); 
        for (const uid of uidsToNotify) { 
            try { await addDoc(collection(db, "notifications"), { userId: uid, type: "task", text: `"${stripHtml(taskMsg.text).substring(0,30)}..." - ${actionText}`, messageId: taskMsg.id, groupId: taskMsg.groupId, timestamp: serverTimestamp(), isRead: false });
            } catch (e) {} 
        } 
    }; 

    const convertToTask = async () => { 
        if (!selectedMessage || !taskDeadline || taskAssignees.length === 0) return alert("Please select Assignees, Priority, and Deadline.");
        try { 
            const now = new Date(); let ackDeadline = null;
            if (requireAck) { 
                switch (ackTimeOption) { 
                    case '30min': ackDeadline = new Date(now.getTime() + 30 * 60 * 1000); break;
                    case '1hr': ackDeadline = new Date(now.getTime() + 60 * 60 * 1000); break;
                    case '2hr': ackDeadline = new Date(now.getTime() + 2 * 60 * 60 * 1000); break;
                    case '3hr': ackDeadline = new Date(now.getTime() + 3 * 60 * 60 * 1000); break; 
                    case 'eod': ackDeadline = getNextWorkingDay9AM(now); break; 
                    case 'any': break; default: break; 
                } 
            } 
            const toNames = taskAssignees.map(email => { const u = dbUsers.find(x => x.email === email); return u ? u.name : (email||"").split('@')[0]; }).join(', ');
            const taskData = { deadline: taskDeadline, assignees: taskAssignees, priority: taskPriority, status: "Pending", isArchived: false, dismissedBy: [], trail: [{ action: "Task Created", by: user.email, time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ', ' + now.toLocaleDateString(), to: toNames }], requireAck: requireAck, ackDeadline: ackDeadline ? ackDeadline.toISOString() : null, acknowledgedBy: [], requireProof: requireProof, escalated: false };
            await setDoc(doc(db, "messages", selectedMessage.id), { isTask: true, taskData: taskData }, { merge: true });
            taskAssignees.forEach(email => { if (email !== user.email) { const assigneeUser = dbUsers.find(u => u.email === email); if (assigneeUser) { addDoc(collection(db, "notifications"), { userId: assigneeUser.uid, type: "task", text: `"${stripHtml(selectedMessage.text).substring(0,30)}..." - Assigned to You 🕒`, messageId: selectedMessage.id, groupId: selectedMessage.groupId, timestamp: serverTimestamp(), isRead: false }).catch(() => {}); } } });
            logImmutableAction("TASK_CREATE", `Converted to Task: "${stripHtml(selectedMessage.text)}"`, `Assignees: ${taskAssignees.join(', ')} | Priority: ${taskPriority}`); playMelody('taskCreated'); setActiveModal(null); setTaskAssignees([]); setRequireAck(false); setAckTimeOption('any'); setRequireProof(false);
        } catch (error) { alert("Failed to create task."); } 
    };

    const handleSaveTaskTitle = async () => { 
        if (!newTaskTitle.trim() || !selectedMessage) return;
        try { await updateDoc(doc(db, "messages", selectedMessage.id), { text: newTaskTitle }); setSelectedMessage(prev => ({...prev, text: newTaskTitle})); playMelody('taskUpdated'); setIsEditingTaskTitle(false);
        } catch (e) { alert("Failed to update task title."); } 
    };

    const handleDelegateTask = async () => { 
        if (!selectedMessage || delegateAssignees.length === 0) return;
        try { 
            const now = new Date(); const oldAssignees = selectedMessage.taskData.assignees || []; const newAssignees = delegateAssignees;
            const added = newAssignees.filter(u => !oldAssignees.includes(u)); const removed = oldAssignees.filter(u => !newAssignees.includes(u));
            const kept = oldAssignees.filter(u => newAssignees.includes(u)); const currentAckBy = selectedMessage.taskData.acknowledgedBy || []; const filteredAckBy = currentAckBy.filter(u => kept.includes(u)); const addedNames = added.map(e => dbUsers.find(u=>u.email===e)?.name || e.split('@')[0]).join(', ');
            const removedNames = removed.map(e => dbUsers.find(u=>u.email===e)?.name || e.split('@')[0]).join(', '); let actionText = "Delegated / Team Modified"; let commentText = "";
            if (added.length && removed.length) commentText = `Added: ${addedNames} | Removed: ${removedNames}`; else if (added.length) commentText = `Added: ${addedNames}`;
            else if (removed.length) commentText = `Removed: ${removedNames}`; const updatedTrail = [...selectedMessage.taskData.trail, { action: actionText, by: user.email, time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ', ' + now.toLocaleDateString(), comment: commentText }];
            const updates = { "taskData.assignees": newAssignees, "taskData.trail": updatedTrail, "taskData.acknowledgedBy": filteredAckBy };
            if (selectedMessage.taskData.requireAck && newAssignees.includes(user.email) && !filteredAckBy.includes(user.email)) { updates["taskData.acknowledgedBy"].push(user.email); } 
            if (selectedMessage.taskData.escalated) { updates["taskData.escalated"] = false; updates["taskData.escalationTransferred"] = true;
            updates["taskData.trail"].push({ action: "Escalation Intercept", by: "System", time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ', ' + now.toLocaleDateString(), comment: "Task structure modified by Admin to resolve escalation." });
            } 
            if (selectedMessage.taskData.requireAck) { if (updates["taskData.acknowledgedBy"].length === newAssignees.length && updates["taskData.status"] !== "Completed") { updates["taskData.status"] = "Acknowledged";
            updates["taskData.acknowledged"] = true; } else if (updates["taskData.status"] === "Pending" && updates["taskData.acknowledgedBy"].length > 0) { updates["taskData.status"] = "In Progress";
            } } await updateDoc(doc(db, "messages", selectedMessage.id), updates); added.forEach(email => { const u = dbUsers.find(x => x.email === email); if(u) addDoc(collection(db, "notifications"), { userId: u.uid, type: "task", text: `🔔 You were added to an ongoing task by Admin.`, messageId: selectedMessage.id, groupId: selectedMessage.groupId, timestamp: serverTimestamp(), isRead: false }); });
            removed.forEach(email => { const u = dbUsers.find(x => x.email === email); if(u) addDoc(collection(db, "notifications"), { userId: u.uid, type: "task", text: `🚫 You were removed from a task.`, messageId: selectedMessage.id, groupId: selectedMessage.groupId, timestamp: serverTimestamp(), isRead: false }); });
            playMelody('taskUpdated'); setActiveModal(null); setDelegateAssignees([]); setShowDelegateDropdown(false); 
        } catch (error) {} 
    }; 

    const handleCompleteTask = async () => { 
        if (!selectedMessage) return;
        try { const now = new Date(); const updatedTrail = [...selectedMessage.taskData.trail, { action: "Marked Completed", by: user.email, time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ', ' + now.toLocaleDateString(), to: "System" }];
            const updates = { "taskData.status": "Completed", "taskData.trail": updatedTrail }; const currentAckBy = selectedMessage.taskData.acknowledgedBy || [];
            const isAssignee = (selectedMessage.taskData.assignees || []).includes(user.email); if (selectedMessage.taskData.requireAck && isAssignee && !currentAckBy.includes(user.email)) { updates["taskData.acknowledgedBy"] = [...currentAckBy, user.email];
            } await updateDoc(doc(db, "messages", selectedMessage.id), updates); playMelody('taskUpdated'); setActiveModal(null); 
        } catch (error) {} 
    };

    const handleAddComment = async (closeModal = false) => { 
        if (!selectedMessage || !trailComment.trim()) return;
        try { const now = new Date(); const updatedTrail = [...selectedMessage.taskData.trail, { action: "Update Added", by: user.email, time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ', ' + now.toLocaleDateString(), comment: trailComment }];
            const newStatus = selectedMessage.taskData.status === 'Pending' ? 'In Progress' : selectedMessage.taskData.status; const updates = { "taskData.trail": updatedTrail, "taskData.status": newStatus };
            const currentAckBy = selectedMessage.taskData.acknowledgedBy || []; const isAssignee = (selectedMessage.taskData.assignees || []).includes(user.email);
            if (selectedMessage.taskData.requireAck && isAssignee && !currentAckBy.includes(user.email)) { updates["taskData.acknowledgedBy"] = [...currentAckBy, user.email]; } await updateDoc(doc(db, "messages", selectedMessage.id), updates); setTrailComment("");
            setSelectedMessage(prev => ({...prev, taskData: {...prev.taskData, trail: updatedTrail, status: newStatus, acknowledgedBy: updates["taskData.acknowledgedBy"] || prev.taskData.acknowledgedBy }})); playMelody('taskUpdated'); if (closeModal) setActiveModal(null);
        } catch (error) {} 
    }; 

    const handleTrailFileUpload = async (e) => { 
        const file = e.target.files[0];
        if (!file || !selectedMessage) return; setTrailFileUploading(true); const uniqueFileName = `${Date.now()}_${file.name}`; const uploadTask = uploadBytesResumable(ref(storage, `task_updates/${uniqueFileName}`), file);
        uploadTask.on('state_changed', null, () => { setTrailFileUploading(false); alert("Upload failed."); }, async () => { try { const downloadURL = await getDownloadURL(uploadTask.snapshot.ref); const now = new Date(); const updatedTrail = [...selectedMessage.taskData.trail, { action: "File Uploaded", by: user.email, time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ', ' + now.toLocaleDateString(), comment: "Attached file via system", fileUrl: downloadURL, fileName: file.name }]; const newStatus = selectedMessage.taskData.status === 'Pending' ? 'In Progress' : selectedMessage.taskData.status; const updates = { "taskData.trail": updatedTrail, "taskData.status": newStatus }; const currentAckBy = selectedMessage.taskData.acknowledgedBy || []; const isAssignee = (selectedMessage.taskData.assignees || []).includes(user.email); if (selectedMessage.taskData.requireAck && isAssignee && !currentAckBy.includes(user.email)) { updates["taskData.acknowledgedBy"] = [...currentAckBy, user.email];
            } await updateDoc(doc(db, "messages", selectedMessage.id), updates); setSelectedMessage(prev => ({...prev, taskData: {...prev.taskData, trail: updatedTrail, status: newStatus, acknowledgedBy: updates["taskData.acknowledgedBy"] || prev.taskData.acknowledgedBy}})); playMelody('taskFileUpload');
        } catch(e) {} finally { setTrailFileUploading(false); if(trailFileInputRef.current) trailFileInputRef.current.value = ""; } }); 
    };

    const setReminder = async () => { 
        if (!selectedMessage || !reminderDateTime) return;
        try { await addDoc(collection(db, "reminders"), { userId: user.uid, userEmail: user.email, messageId: selectedMessage.id, messageText: stripHtml(selectedMessage.text) || selectedMessage.fileName || "File Attachment", remindAt: reminderDateTime, isTriggered: false });
            await updateDoc(doc(db, "messages", selectedMessage.id), { hasReminder: true }); setActiveModal(null); setReminderDateTime(""); addToast("Reminder set successfully!", "success");
        } catch (error) { alert("Failed to save reminder."); } 
    }; 
    
    const handleEditUserSubmit = async (e) => { 
        e.preventDefault();
        await updateDoc(doc(db, "users", adminForm.uid), { name: adminForm.name, isAdmin: adminForm.isAdmin, canCreateGroups: adminForm.canCreateGroups }); setActiveModal(null); 
    };

    const handleAddInlineComment = async (targetMsg, commentText) => { 
        if (!targetMsg || !commentText.trim()) return;
        try { const now = new Date(); const updatedTrail = [...targetMsg.taskData.trail, { action: "Update Added", by: user.email, time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ', ' + now.toLocaleDateString(), comment: commentText }];
            const newStatus = targetMsg.taskData.status === 'Pending' ? 'In Progress' : targetMsg.taskData.status; const updates = { "taskData.trail": updatedTrail, "taskData.status": newStatus };
            const currentAckBy = targetMsg.taskData.acknowledgedBy || []; const isAssignee = (targetMsg.taskData.assignees || []).includes(user.email);
            if (targetMsg.taskData.requireAck && isAssignee && !currentAckBy.includes(user.email)) { updates["taskData.acknowledgedBy"] = [...currentAckBy, user.email]; } await updateDoc(doc(db, "messages", targetMsg.id), updates);
            await notifyInvolvedInTask(targetMsg, `${currentUserData?.name || (user.email||"").split('@')[0]} updated a task.`); playMelody('taskUpdated'); } catch (error) {} 
    };

    const handleReactionIntercept = async (msgId, tagLabel) => { 
        await reactToMessageDB(msgId, tagLabel); const msg = messages.find(m => m.id === msgId);
        if (msg && msg.senderEmail !== user.email) { 
            const sender = dbUsers.find(u => u.email === msg.senderEmail);
            if (sender) { addDoc(collection(db, "notifications"), { userId: sender.uid, type: "reaction", text: `${currentUserData?.name || user.email.split('@')[0]} affixed ${tagLabel} to your message.`, messageId: msgId, groupId: activeGroup?.id || '', timestamp: serverTimestamp(), isRead: false }).catch(()=>{});
            } 
        } 
    }; 

    const handleGroupPicUpload = async (e) => { 
        const file = e.target.files[0]; if (!file) return; setGroupPicUploadProgress(10); const uniqueFileName = `${Date.now()}_group_${file.name}`; const storageRef = ref(storage, `group_pics/${uniqueFileName}`); const uploadTask = uploadBytesResumable(storageRef, file);
        uploadTask.on('state_changed', (snapshot) => { setGroupPicUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100); }, (error) => { setGroupPicUploadProgress(0); alert("Upload failed"); }, async () => { const downloadURL = await getDownloadURL(uploadTask.snapshot.ref); setGroupForm(prev => ({...prev, profilePicUrl: downloadURL})); setGroupPicUploadProgress(0); });
    };

    const handleProfileSubmit = async () => { 
        if (!profileForm.name) return;
        const file = profilePicInputRef.current?.files[0];
        try { 
            if (file) { 
                setProfileUploadProgress(10); const uniqueFileName = `${Date.now()}_profile_${file.name}`; const storageRef = ref(storage, `profile_pics/${uniqueFileName}`); const uploadTask = uploadBytesResumable(storageRef, file);
                uploadTask.on('state_changed', (snapshot) => { setProfileUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100); }, (error) => { setProfileUploadProgress(0); alert("Upload failed"); }, async () => { const downloadURL = await getDownloadURL(uploadTask.snapshot.ref); await updateDoc(doc(db, "users", user.uid), { name: profileForm.name, profilePicUrl: downloadURL, toolPreferences }); setProfileUploadProgress(0); setActiveModal(null); });
            } else { 
                await updateDoc(doc(db, "users", user.uid), { name: profileForm.name, toolPreferences }); setActiveModal(null); 
            } 
        } catch(e) { setProfileUploadProgress(0); } 
    };

    const handleGroupSubmit = async (e) => { 
        e.preventDefault();
        try { 
            if (editingGroup) { await updateDoc(doc(db, "groups", editingGroup.id), { name: groupForm.name, members: groupForm.members, profilePicUrl: groupForm.profilePicUrl });
                if (activeGroup?.id === editingGroup.id) { setActiveGroup({ ...activeGroup, name: groupForm.name, members: groupForm.members, profilePicUrl: groupForm.profilePicUrl }); }
            } else { await addDoc(collection(db, "groups"), { name: groupForm.name, members: [...groupForm.members, user.email], admins: [user.email], createdBy: user.email, createdAt: serverTimestamp(), profilePicUrl: groupForm.profilePicUrl }); } 
            setActiveModal(null); 
        } catch (error) { alert("Failed to save department."); } 
    };

    const handleArchiveTask = async () => {
        if (!selectedMessage) return;
        try {
            await updateDoc(doc(db, "messages", selectedMessage.id), { "taskData.isArchived": true, "taskData.status": "Completed" });
            playMelody('taskUpdated');
            setActiveModal(null);
            addToast("Task successfully archived.", "success");
        } catch(e) {
            alert("Failed to archive task.");
        }
    };

    const handleUpdateGroupMembers = async (groupId, newMembers) => {
        try {
            await updateDoc(doc(db, "groups", groupId), { members: newMembers });
            if (activeGroup && activeGroup.id === groupId) {
                setActiveGroup(prev => ({ ...prev, members: newMembers }));
            }
        } catch(e) {}
    };

    const uploadFileDirectly = async (fileObj, additionalPayload = {}) => {
        const pf = {
            id: Date.now() + Math.random(),
            file: fileObj,
            customName: fileObj.name,
            caption: "",
            text: ""
        };
        try {
            setIsUploading(true);
            await uploadAndSendFileDB(pf, setUploadProgress, additionalPayload);
            setIsUploading(false);
            setUploadProgress(0);
        } catch (error) {
            setIsUploading(false);
            setUploadProgress(0);
        }
    };

    const jumpToPrivateSource = async (msgId) => {
        if (!msgId) return;
        const targetMsg = messages.find(m => m.id === msgId);
        if (!targetMsg) return;
        
        let targetGroup = groups.find(g => g.id === targetMsg.groupId);
        if (!targetGroup) {
            const otherUid = targetMsg.groupId.split('_').find(id => id !== user.uid);
            if (otherUid) {
                const otherUser = dbUsers.find(u => u.uid === otherUid);
                if (otherUser) targetGroup = { id: targetMsg.groupId, isDM: true, name: otherUser.name, members: [user.email, otherUser.email] };
            }
        }
        if (targetGroup) {
            setActiveGroup(targetGroup);
            setShowRightSidebar(false);
            setMobileSidebarOpen(false);
            setTimeout(() => scrollToMessageDirect(msgId), 300);
        }
    };

    const getUnreadInfoForUser = useCallback((dmUserEmail, dmUserUid) => {
        const dmId = [user.uid, dmUserUid].sort().join('_');
        const unreadMsgs = messages.filter(m => m.groupId === dmId && !m.isMine && !(m.seenBy || []).includes(user.email));
        const pendingTasks = messages.filter(m => m.groupId === dmId && m.isTask && m.taskData?.status !== "Completed" && m.taskData?.assignees?.includes(user.email));
        return { total: unreadMsgs.length + pendingTasks.length, unreadCount: unreadMsgs.length, pendingTaskCount: pendingTasks.length };
    }, [messages, user.uid, user.email]);

    const modalProps = {
        activeModal, setActiveModal,
        groupForm, setGroupForm,
        editingGroup, handleGroupSubmit, groupPicInputRef, handleGroupPicUpload, groupPicUploadProgress,
        profileForm, setProfileForm, profilePicInputRef, profileUploadProgress, setProfileUploadProgress, handleProfileSubmit, toolPreferences, setToolPreferences,
        taskAssignees, setTaskAssignees, taskDeadline, setTaskDeadline, convertToTask, taskPriority, setTaskPriority, requireAck, setRequireAck, requireProof, setRequireProof, ackTimeOption, setAckTimeOption,
        selectedMessage, setSelectedMessage, isEditingTaskTitle, setIsEditingTaskTitle, newTaskTitle, setNewTaskTitle, handleSaveTaskTitle,
        delegateAssignees, setDelegateAssignees, showDelegateDropdown, setShowDelegateDropdown, handleDelegateTask, trailComment, setTrailComment, handleAddComment, handleCompleteTask, handleArchiveTask, trailFileInputRef, handleTrailFileUpload,
        reminderDateTime, setReminderDateTime, setReminder, adminForm, setAdminForm, handleEditUserSubmit,
        dbUsers, user, activeGroup, currentUserData, isVipAdmin,
        isUploading, uploadProgress,
        scheduleDateTime, setScheduleDateTime, pendingScheduledText, handleScheduleMessage,
        messages, allAdminReminders,
        handleUpdateGroupMembers,
        onGroupUpdate: async (updates) => {
            if (!activeGroup) return;
            setActiveModal(null);
            addToast("Saving department updates...", "success");
            try {
                if (updates.profilePicFile) {
                    const uniqueFileName = `${Date.now()}_group_${updates.profilePicFile.name}`;
                    const storageRef = ref(storage, `group_pics/${uniqueFileName}`);
                    const uploadTask = uploadBytesResumable(storageRef, updates.profilePicFile);
                    uploadTask.on('state_changed', null, null, async () => {
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        updates.profilePicUrl = downloadURL;
                        delete updates.profilePicFile;
                        await updateDoc(doc(db, "groups", activeGroup.id), updates);
                    });
                } else {
                    await updateDoc(doc(db, "groups", activeGroup.id), updates);
                }
            } catch(e) {
                addToast("Failed to save updates.", "error");
            }
        },
        chatInputRef, setReplyingTo, customTags
    };

    if (isWorkspaceLoading) {
        return (
            <div className="flex flex-col justify-center items-center h-screen bg-[#F8F7F4] text-[#1E1B4B]">
                <div className="w-12 h-12 border-4 border-[#008069] border-t-transparent rounded-full animate-spin mb-4"></div>
                <span className="font-bold tracking-widest uppercase text-[12px] text-slate-500">Syncing Workspace...</span>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-[#f0f2f5] font-sans text-slate-800 overflow-hidden relative selection:bg-indigo-500 selection:text-white">
            
            {toolPreferences.showWatermark !== false && (
                <div className="doodle-watermark">
                    {Array.from({ length: 15 }).map((_, rowIdx) => (
                        <div key={`row-${rowIdx}`} className="doodle-row" style={{ transform: `translateX(${rowIdx % 2 === 0 ? '-5%' : '5%'})` }}>
                            {Array.from({ length: 8 }).map((_, itemIdx) => (
                                <span key={`item-${itemIdx}`} className="doodle-item font-extrabold text-[4rem]">TALK & TASK</span>
                            ))}
                        </div>
                    ))}
                </div>
            )}

            {activeReminderAlert && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-white rounded-2xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.2)] border border-slate-200 animate-in slide-in-from-top-4 max-w-md w-[90vw]">
                    <div className="flex items-center gap-4 mb-3">
                        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center animate-pulse"><i className="fa-regular fa-bell text-2xl"></i></div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">Reminder Alert!</h3>
                            <p className="text-sm font-medium text-slate-500">It's time to check this task.</p>
                        </div>
                    </div>
                    <p className="text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100 font-medium italic">"{activeReminderAlert.messageText}"</p>
                    <div className="mt-4 flex gap-3">
                        <button onClick={() => { 
                            if (activeReminderAlert.messageId) scrollToMessageDirect(activeReminderAlert.messageId); 
                            setActiveReminderAlert(null); 
                        }} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all">View Task</button>
                        <button onClick={() => setActiveReminderAlert(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-xl transition-all">Dismiss</button>
                    </div>
                </div>
            )}

            <div className="flex-1 flex overflow-hidden relative z-10">
                {viewMode === "admin" ? (
                    <AdminPanel 
                        setViewMode={setViewMode} setActiveModal={setActiveModal} dbUsers={dbUsers} groups={groups} 
                        filteredAuditLogs={immutableAuditLogs} messages={messages}
                        adminFilterUser={adminFilterUser} setAdminFilterUser={setAdminFilterUser} 
                        adminFilterDate={adminFilterDate} setAdminFilterDate={setAdminFilterDate} 
                        adminFilterType={adminFilterType} setAdminFilterType={setAdminFilterType} 
                        adminFilterGroup={adminFilterGroup} setAdminFilterGroup={setAdminFilterGroup}
                        setGroupForm={setGroupForm} setEditingGroup={setEditingGroup}
                        groupForm={groupForm} editingGroup={editingGroup}
                        handleGroupSubmit={handleGroupSubmit} groupPicUploadProgress={groupPicUploadProgress}
                        handleGroupPicUpload={handleGroupPicUpload} globalAnnouncement={globalAnnouncement}
                        currentUserData={currentUserData} customTags={customTags}
                    />
                ) : (
                    <div className="flex-1 flex overflow-hidden relative bg-[#f0f2f5]">
                        <LeftSidebar 
                            width={leftSidebarWidth}
                            user={user} currentUserData={currentUserData} myGroups={myGroups} dmUsers={dmUsers} 
                            activeGroup={activeGroup} setActiveGroup={setActiveGroup} setShowRightSidebar={setShowRightSidebar} 
                            setMobileSidebarOpen={setMobileSidebarOpen} getUnreadInfoForUser={getUnreadInfoForUser} 
                            messages={messages} onLogout={onLogout} setActiveModal={setActiveModal} 
                            setGroupForm={setGroupForm} setEditingGroup={setEditingGroup} sidebarSearch={sidebarSearch} 
                            setSidebarSearch={setSidebarSearch} mobileSidebarOpen={mobileSidebarOpen} isVipAdmin={isVipAdmin} setViewMode={setViewMode} 
                        />

                        {/* 🧱 LEFT SPLITTER */}
                        <div className="hidden md:block w-1.5 cursor-col-resize hover:bg-[#008069] active:bg-[#006e5a] bg-slate-200 shrink-0 z-30 transition-colors"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                const startX = e.clientX;
                                const startWidth = leftSidebarWidth;
                                const doDrag = (dragEvent) => setLeftSidebarWidth(Math.max(250, Math.min(600, startWidth + (dragEvent.clientX - startX))));
                                const stopDrag = () => { document.removeEventListener('mousemove', doDrag); document.removeEventListener('mouseup', stopDrag); };
                                document.addEventListener('mousemove', doDrag);
                                document.addEventListener('mouseup', stopDrag);
                            }} 
                        />

                        {/* MAIN CHAT AREA */}
                        <div className="flex-1 min-w-0 flex flex-col bg-[#efeae2] relative h-full">
                            
                            {globalAnnouncement?.isActive && dismissedBroadcastId !== globalAnnouncement.id && (
                                <div className="bg-indigo-600 text-white px-4 py-2 flex items-center justify-between shadow-md relative z-40">
                                    <div className="flex items-center gap-3">
                                        <i className="fa-solid fa-bullhorn animate-pulse"></i>
                                        <span className="font-semibold text-sm">
                                            <span className="opacity-70 mr-2">[{globalAnnouncement.authorName}]</span>
                                            {globalAnnouncement.message}
                                        </span>
                                    </div>
                                    <button onClick={handleAckBroadcast} className="p-1 hover:bg-indigo-500 rounded transition-colors text-xs font-bold uppercase tracking-wider">Acknowledge <i className="fa-solid fa-check ml-1"></i></button>
                                </div>
                            )}

                            <div className="h-[59px] bg-[#f0f2f5] border-b border-slate-200/60 flex items-center justify-between px-4 z-10 shrink-0 safe-top">
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setMobileSidebarOpen(true)} className="md:hidden w-10 h-10 rounded-full hover:bg-black/5 text-[#54656f] flex items-center justify-center transition-colors text-[19px]"><i className="fa-solid fa-bars"></i></button>
                                    
                                    {activeGroup && (
                                        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => { if(!activeGroup.isDM) setActiveModal('group_settings') }}>
                                            <MemoizedAvatar uid={activeGroup.id} url={activeGroup.profilePicUrl} name={activeGroup.name} sizeClass="w-10 h-10" isGroup={!activeGroup.isDM} />
                                            <div>
                                                <h2 className="font-semibold text-[15px] text-[#111b21] truncate max-w-[200px]">{activeGroup.name}</h2>
                                                <p className="text-[12px] text-[#54656f] font-medium truncate max-w-[200px]">
                                                    {activeGroup.isDM ? 'Direct Message' : `${activeGroup.members?.length || 0} participants`}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-1.5 relative">
                                    
                                    <div className={`flex items-center transition-all ${isSearchFocused ? 'w-64 bg-white ring-1 ring-[#00a884]' : 'w-10 bg-transparent'} rounded-full overflow-hidden`} ref={searchWrapperRef}>
                                        <button onClick={() => { setIsSearchFocused(true); setTimeout(()=>document.getElementById('global-search').focus(), 50) }} className="w-10 h-10 shrink-0 rounded-full hover:bg-black/5 text-[#54656f] flex items-center justify-center transition-colors text-[19px]"><i className="fa-solid fa-search"></i></button>
                                        <input id="global-search" type="text" placeholder="Search everywhere..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onFocus={() => setIsSearchFocused(true)} className={`bg-transparent outline-none text-[14px] text-slate-800 transition-all ${isSearchFocused ? 'w-full px-2 opacity-100' : 'w-0 opacity-0'} h-10`} />
                                        {searchQuery && <button onClick={() => setSearchQuery('')} className="w-8 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark"></i></button>}
                                    </div>

                                    <div className="relative">
                                        <button onClick={() => setShowFilterMenu(!showFilterMenu)} className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors text-[19px] ${chatFilter !== 'all' ? 'bg-[#00a884] text-white shadow-md' : 'text-[#54656f] hover:bg-black/5'}`}><i className="fa-solid fa-sliders"></i></button>
                                        {showFilterMenu && (
                                            <div className="absolute top-12 right-0 bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-slate-100 p-2 w-48 z-50">
                                                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-3 py-2">Filter View</div>
                                                <button onClick={() => { setChatFilter('all'); setShowFilterMenu(false); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg text-[14px] font-semibold text-slate-700 flex justify-between">Everything {chatFilter === 'all' && <i className="fa-solid fa-check text-[#00a884]"></i>}</button>
                                                <button onClick={() => { setChatFilter('tasks-pending'); setShowFilterMenu(false); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg text-[14px] font-semibold text-amber-600 flex justify-between">Pending Tasks {chatFilter === 'tasks-pending' && <i className="fa-solid fa-check text-amber-600"></i>}</button>
                                                <button onClick={() => { setChatFilter('tasks-completed'); setShowFilterMenu(false); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg text-[14px] font-semibold text-[#008069] flex justify-between">Completed Tasks {chatFilter === 'tasks-completed' && <i className="fa-solid fa-check text-[#008069]"></i>}</button>
                                                <button onClick={() => { setChatFilter('messages'); setShowFilterMenu(false); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg text-[14px] font-semibold text-slate-700 flex justify-between">Messages Only {chatFilter === 'messages' && <i className="fa-solid fa-check text-[#008069]"></i>}</button>
                                                <button onClick={() => { setChatFilter('bookmarked'); setShowFilterMenu(false); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg text-[14px] font-semibold text-indigo-600 flex justify-between">Bookmarked {chatFilter === 'bookmarked' && <i className="fa-solid fa-check text-indigo-600"></i>}</button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="relative">
                                        <button onClick={() => setShowNotifications(!showNotifications)} className="w-10 h-10 rounded-full hover:bg-black/5 text-[#54656f] transition-colors flex items-center justify-center text-[19px]">
                                            <i className="fa-regular fa-bell"></i>
                                            {totalNotifications > 0 && <span className="absolute top-1 right-1 w-4 h-4 bg-[#ea0038] border-2 border-[#f0f2f5] rounded-full"></span>}
                                        </button>
                                        
                                        {showNotifications && (
                                            <div className="absolute top-12 right-0 bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] border border-slate-100 w-[350px] z-50 max-h-[80vh] overflow-hidden flex flex-col custom-sidebar-scroll">
                                                <div className="p-4 border-b border-slate-100 bg-[#f0f2f5]">
                                                    <h3 className="font-bold text-[16px] text-[#111b21] flex items-center gap-2"><i className="fa-solid fa-bolt text-[#00a884]"></i> Activity Feed</h3>
                                                </div>
                                                <div className="overflow-y-auto flex-1 p-2 space-y-1">
                                                    {genericNotifications.map(n => (
                                                        <div key={n.id} onClick={() => { navigateToMessageFromNotification(n.messageId, n.groupId); deleteDoc(doc(db, "notifications", n.id)); }} className="flex gap-3 p-3 hover:bg-[#f5f6f6] rounded-xl cursor-pointer transition-colors relative group">
                                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm ${n.type === 'task' ? 'bg-amber-100 text-amber-600' : n.type === 'reaction' ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600'}`}>
                                                                <i className={`fa-solid ${n.type === 'task' ? 'fa-list-check' : n.type === 'reaction' ? 'fa-heart' : 'fa-message'}`}></i>
                                                            </div>
                                                            <div className="flex-1">
                                                                <p className="text-[13px] font-semibold text-[#111b21] leading-tight mb-1">{n.text}</p>
                                                                <p className="text-[10px] text-[#8696a0] font-medium">{new Date(n.timestamp?.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                                            </div>
                                                            <button onClick={(e) => { e.stopPropagation(); deleteDoc(doc(db, "notifications", n.id)); }} className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 transition-opacity"><i className="fa-solid fa-xmark"></i></button>
                                                        </div>
                                                    ))}
                                                    {genericNotifications.length === 0 && <div className="p-6 text-center text-[13px] text-[#8696a0] font-medium">You're all caught up!</div>}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <button onClick={() => setShowRightSidebar(!showRightSidebar)} className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors text-[19px] ${showRightSidebar ? 'bg-[#00a884] text-white shadow-md' : 'text-[#54656f] hover:bg-black/5'}`}>
                                        <i className="fa-solid fa-clipboard-list"></i>
                                    </button>
                                </div>
                            </div>

                            {globalSearchResults && (
                                <div className="absolute top-[60px] left-0 right-0 bottom-0 bg-white/95 backdrop-blur-sm z-40 overflow-y-auto p-6 flex justify-center animate-in fade-in">
                                    <div className="w-full max-w-2xl space-y-6">
                                        <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                                            <h2 className="text-xl font-bold text-slate-800">Search Results for "{searchQuery}"</h2>
                                            <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:bg-slate-100 p-2 rounded-full"><i className="fa-solid fa-xmark"></i></button>
                                        </div>
                                        
                                        {globalSearchResults.users?.length > 0 && (
                                            <div>
                                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">Directory</h3>
                                                <div className="grid grid-cols-2 gap-3">
                                                    {globalSearchResults.users.map(u => (
                                                        <div key={u.uid} onClick={() => {
                                                            const dmId = [user.uid, u.uid].sort().join('_');
                                                            setActiveGroup({ id: dmId, isDM: true, name: u.name, members: [user.email, u.email] });
                                                            setSearchQuery('');
                                                        }} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-indigo-500 hover:shadow-md transition-all">
                                                            <MemoizedAvatar uid={u.uid} url={u.profilePicUrl} name={u.name} sizeClass="w-10 h-10" />
                                                            <div className="min-w-0"><div className="font-bold text-slate-800 text-sm truncate">{u.name}</div><div className="text-xs text-slate-500 truncate">{u.email}</div></div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {globalSearchResults.messages?.length > 0 && (
                                            <div>
                                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">Messages & Tasks</h3>
                                                <div className="space-y-3">
                                                    {globalSearchResults.messages.map(m => (
                                                        <div key={m.id} onClick={() => {
                                                            navigateToMessageFromNotification(m.id, m.groupId);
                                                        }} className="bg-white p-4 rounded-xl border border-slate-200 hover:border-indigo-500 hover:shadow-md cursor-pointer transition-all">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <div className="flex items-center gap-2">
                                                                    <MemoizedAvatar uid={m.senderUid} name={m.sender?.split('@')[0]} sizeClass="w-6 h-6" />
                                                                    <span className="font-bold text-sm text-slate-800">{m.sender?.split('@')[0]}</span>
                                                                </div>
                                                                <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">{new Date(m.timestamp?.toDate()).toLocaleDateString()}</span>
                                                            </div>
                                                            <div className="text-sm text-slate-600 line-clamp-2 italic font-medium">"{stripHtml(m.text || m.fileName)}"</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {globalSearchResults.users?.length === 0 && globalSearchResults.messages?.length === 0 && (
                                            <div className="text-center p-12 text-slate-400 font-medium">No results found across the workspace.</div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {!activeGroup ? (
                                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#f0f2f5] text-center">
                                    <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm text-[#00a884] mb-6">
                                        <i className="fa-brands fa-whatsapp text-4xl"></i>
                                    </div>
                                    <h2 className="text-2xl font-light text-[#111b21] mb-3">Talk & Task Web</h2>
                                    <p className="text-[14px] text-[#54656f] max-w-md leading-relaxed font-medium">Send and receive messages seamlessly. Converts chats to trackable tasks with one click.</p>
                                    <div className="mt-8 bg-white px-5 py-2.5 rounded-full text-[13px] font-semibold text-[#54656f] border border-slate-200 shadow-sm flex items-center gap-2">
                                        <i className="fa-solid fa-lock text-[#00a884]"></i> End-to-end encrypted architecture
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <ChatView
                                        messagesToRender={messagesToRender} messages={messages} activeGroup={activeGroup} user={user} 
                                        currentUserData={currentUserData} isVipAdmin={isVipAdmin} pinnedMessages={pinnedMessages} 
                                        typingStatus={typingStatus} replyingTo={replyingTo} setReplyingTo={setReplyingTo} 
                                        toolPreferences={toolPreferences} dbUsers={dbUsers} groups={groups} setActiveGroup={setActiveGroup} 
                                        setShowRightSidebar={setShowRightSidebar} setMobileSidebarOpen={setMobileSidebarOpen} 
                                        pendingScrollTarget={pendingScrollTarget} setPendingScrollTarget={setPendingScrollTarget} 
                                        setActiveModal={setActiveModal} scrollToMessageDirect={scrollToMessageDirect} 
                                        handleReaction={handleReactionIntercept} handleToggleBookmark={toggleBookmarkDB} 
                                        handleTogglePin={togglePinDB} handleDeleteMessage={deleteMessageDB} chatInputRef={chatInputRef} 
                                        editingMessageId={editingMessageId} editMessageText={editMessageText} setEditingMessageId={setEditingMessageId} 
                                        setEditMessageText={setEditMessageText} handleSaveEdit={handleSaveEdit} setSelectedMessage={setSelectedMessage} 
                                        setIsEditingTaskTitle={setIsEditingTaskTitle} messagesEndRef={messagesEndRef} chatContainerRef={chatContainerRef} 
                                        isAtBottom={isAtBottom} setIsAtBottom={setIsAtBottom} highlightedMsgId={highlightedMsgId} 
                                        unreadHighlightIds={unreadHighlightIds} handleAddInlineComment={handleAddInlineComment} 
                                        jumpToPrivateSource={jumpToPrivateSource} customTags={customTags} setActiveThread={setActiveThread}
                                    />
                                    
                                    <InputArea
                                        inputText={inputText} setInputText={setInputText} isOnline={isOnline} isUploading={isUploading} 
                                        activeGroup={activeGroup} replyingTo={replyingTo} setReplyingTo={setReplyingTo} 
                                        handleSendOfflineAware={handleSendOfflineAware} handleTypingEvent={handleTypingEvent} 
                                        handlePaste={handlePaste} chatInputRef={chatInputRef} fileInputRef={fileInputRef} 
                                        handleFileUpload={handleFileUpload} emojiPickerOpen={emojiPickerOpen} setEmojiPickerOpen={setEmojiPickerOpen} 
                                        emojiPickerRef={emojiPickerRef} pendingFiles={pendingFiles} setPendingFiles={setPendingFiles} 
                                        showFileRename={showFileRename} setShowFileRename={setShowFileRename} uploadFileDirectly={uploadFileDirectly} 
                                        setActiveModal={setActiveModal} setPendingScheduledText={setPendingScheduledText} offlineDrafts={offlineDrafts} 
                                        user={user} dbUsers={dbUsers} groups={groups} currentUserData={currentUserData} MAX_FILE_SIZE_MB={MAX_FILE_SIZE_MB} 
                                        handleSendPendingFiles={handleSendPendingFiles}
                                    />
                                    
                                    {!isAtBottom && (
                                        <button onClick={() => chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' })} className="absolute bottom-24 right-6 w-11 h-11 bg-white text-[#54656f] rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.15)] hover:bg-[#f5f6f6] flex items-center justify-center transition-all z-20">
                                            <i className="fa-solid fa-chevron-down text-lg"></i>
                                            {messagesToRender.filter(m => !m.isMine && !(m.seenBy || []).includes(user.email)).length > 0 && <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-[#00a884] rounded-full border-2 border-white"></span>}
                                        </button>
                                    )}
                                </>
                            )}
                        </div>

                        {/* 🧱 RIGHT SPLITTER */}
                        {(!activeThread && showRightSidebar) && (
                            <div className="hidden md:block w-1.5 cursor-col-resize hover:bg-[#008069] active:bg-[#006e5a] bg-slate-200 shrink-0 z-30 transition-colors"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    const startX = e.clientX;
                                    const startWidth = rightSidebarWidth;
                                    const doDrag = (dragEvent) => setRightSidebarWidth(Math.max(280, Math.min(700, startWidth - (dragEvent.clientX - startX))));
                                    const stopDrag = () => { document.removeEventListener('mousemove', doDrag); document.removeEventListener('mouseup', stopDrag); };
                                    document.addEventListener('mousemove', doDrag); document.addEventListener('mouseup', stopDrag);
                                }} 
                            />
                        )}

                        {activeThread ? (
                            <ThreadSidebar 
                                width={rightSidebarWidth} activeThread={activeThread} setActiveThread={setActiveThread} messages={messages} user={user} 
                                currentUserData={currentUserData} dbUsers={dbUsers} groups={groups} handleReactionIntercept={handleReactionIntercept} 
                                deleteMessageDB={deleteMessageDB} setActiveModal={setActiveModal} sendMessageToDB={sendMessageToDB} customTags={customTags} 
                                toolPreferences={toolPreferences} setReplyingTo={setReplyingTo} setSelectedMessage={setSelectedMessage} chatInputRef={chatInputRef}
                                uploadAndSendFileDB={uploadAndSendFileDB}
                            />
                        ) : showRightSidebar ? (
                          <RightSidebar
                            width={rightSidebarWidth} showRightSidebar={showRightSidebar} setShowRightSidebar={setShowRightSidebar} tasksAssignedToMe={tasksAssignedToMe}
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
