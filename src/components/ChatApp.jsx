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
import { useAuth } from '../context/AuthContext.jsx';

// Utils & Firebase Core
import { lockExtension, getNextWorkingDay9AM } from '../utils/helpers.js';
import { compressImage } from '../utils/imageUtils.js';
import { auth, db, storage, signOut } from '../firebase.js';
import { collection, addDoc, doc, updateDoc, setDoc, getDocs, query, where, serverTimestamp, deleteDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

// Global String Formatter (Prevents raw HTML showing in menus)
const stripHtml = (html) => html ? String(html).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ') : '';
const formatNotificationTime = (value) => { const date = value?.toDate ? value.toDate() : value ? new Date(value) : null; if (!date || Number.isNaN(date.getTime())) return ''; const diff = Date.now() - date.getTime(); if (diff < 60000) return 'Just now'; if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`; if (diff < 86400000) return `${Math.floor(diff / 3600000)} hr ago`; return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); };
const getSnoozeDate = (mode) => { const date = new Date(); if (mode === '15m') date.setMinutes(date.getMinutes() + 15); else if (mode === '1h') date.setHours(date.getHours() + 1); else { date.setHours(17, 0, 0, 0); if (date <= new Date()) date.setDate(date.getDate() + 1); } return date; };
const GLOBAL_SUPER_ADMIN_EMAIL = 'shivsuri1@gmail.com';
const THEME_ACCENTS = {
  indigo: '#4f46e5',
  teal: '#0f766e',
  rose: '#e11d48',
  amber: '#d97706',
  emerald: '#059669',
};
const THEME_FONTS = {
  Inter: "Inter, Segoe UI, sans-serif",
  Roboto: "Roboto, Arial, sans-serif",
  Nunito: "Nunito, Arial, sans-serif",
  Poppins: "Poppins, Arial, sans-serif",
  System: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
};
const FONT_SCALE = { compact: '0.94rem', normal: '1rem', comfortable: '1.06rem', large: '1.13rem' };

const DEFAULT_FEATURE_FLAGS = {
  chat: true,
  taskCards: true,
  advancedAnalytics: true,
  dataGovernance: true,
  dsarCompliance: true,
  customBranding: true,
  apiAccess: true,
  auditLogs: true,
  prioritySupport: true,
  usersTab: true,
  departmentsTab: true,
  broadcasts: true,
  organizationSettings: true,
};

const normalizeFeatureFlags = (flags = {}) => ({
  ...DEFAULT_FEATURE_FLAGS,
  ...(flags || {}),
});

const FeatureLockedPanel = ({ title, message, icon = 'fa-lock' }) => (
  <div className="flex-1 h-full flex items-center justify-center bg-slate-50 p-8 text-center">
    <div className="max-w-md bg-white border border-slate-200 rounded-3xl shadow-sm p-8">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mb-4">
        <i className={`fa-solid ${icon} text-2xl`}></i>
      </div>
      <h2 className="text-xl font-black text-slate-800 mb-2">{title}</h2>
      <p className="text-sm font-semibold text-slate-500 leading-relaxed">{message}</p>
    </div>
  </div>
);
const universalTaskFilters = [
  { key: 'all', label: 'All', icon: 'fa-layer-group' },
  { key: 'tasks-pending', label: 'Pending Tasks', icon: 'fa-hourglass-half' },
  { key: 'tasks-completed', label: 'Completed', icon: 'fa-circle-check' },
  { key: 'messages', label: 'Messages', icon: 'fa-comment-dots' },
  { key: 'today', label: 'Today', icon: 'fa-calendar-day' },
  { key: 'scheduled', label: 'Scheduled', icon: 'fa-clock' },
  { key: 'files', label: 'Files', icon: 'fa-paperclip' },
  { key: 'date-range', label: 'By Date', icon: 'fa-calendar-days' },
  { key: 'task', label: 'Task', icon: 'fa-list-check' },
  { key: 'delegated', label: 'Delegate', icon: 'fa-share-nodes' },
  { key: 'transferred', label: 'Transfer', icon: 'fa-right-left' },
  { key: 'bookmarked', label: 'Bookmarked', icon: 'fa-bookmark' },
];

// 👇 UPDATED: Slack Sidebar Input uses matching WYSIWYG Editor 👇

const getMessageFileType = (message = {}) => {
  const explicitType = (message.fileType || '').toLowerCase();
  const fileName = (message.fileName || '').toLowerCase();
  if (explicitType.includes('image') || /\.(png|jpe?g|gif|webp|svg)$/i.test(fileName)) return 'image';
  if (explicitType.includes('pdf') || fileName.endsWith('.pdf')) return 'pdf';
  if (explicitType.includes('sheet') || explicitType.includes('excel') || /\.(xls|xlsx|csv)$/i.test(fileName)) return 'spreadsheet';
  if (explicitType.includes('word') || explicitType.includes('document') || /\.(doc|docx|txt|rtf)$/i.test(fileName)) return 'document';
  if (message.fileUrl || message.fileName) return 'other';
  return '';
};

const AdvancedSearchPage = ({ messages, dbUsers, groups = [], user, onBack, onOpen }) => {
  const [filters, setFilters] = useState({ userEmails: [], keyword: '', dateFrom: '', dateTo: '', hasFile: false, fileType: '' });
  const [results, setResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  const getSourceLabel = useCallback((message) => {
    const sourceGroup = groups.find(g => g.id === message.groupId);
    if (sourceGroup?.name) return sourceGroup.name;
    const dmPeerUid = (message.groupId || '').split('_').find(id => id && id !== user?.uid);
    const dmPeer = dbUsers.find(u => u.uid === dmPeerUid || u.email === dmPeerUid);
    return dmPeer ? `DM: ${dmPeer.name || dmPeer.email}` : 'Unknown source';
  }, [dbUsers, groups, user?.uid]);

  const canReadMessage = useCallback((message) => {
    if (!message || message.taskData?.isDeleted) return false;
    if (message.isPrivateMention && !message.allowedUsers?.includes(user?.email) && message.senderEmail !== user?.email) return false;
    if (message.isTask) {
      const reviewer = message.taskData?.masterReviewerEmail || message.senderEmail;
      if (reviewer !== user?.email && !(message.taskData?.assignees || []).includes(user?.email)) return false;
    }
    const sourceGroup = groups.find(g => g.id === message.groupId);
    if (sourceGroup) return sourceGroup.members?.includes(user?.email) || sourceGroup.name === 'Welcome' || sourceGroup.name === 'General';
    return (message.groupId || '').split('_').includes(user?.uid) || message.senderEmail === user?.email;
  }, [groups, user?.email, user?.uid]);

  const runSearch = () => {
    const keyword = filters.keyword.trim().toLowerCase();
    const fromMs = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`).getTime() : null;
    const toMs = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`).getTime() : null;
    const selectedUsers = new Set(filters.userEmails);

    const nextResults = messages
      .filter(canReadMessage)
      .filter((message) => {
        if (selectedUsers.size > 0 && !selectedUsers.has(message.senderEmail)) return false;

        const messageDate = message.timestamp?.toDate ? message.timestamp.toDate() : message.dateString ? new Date(`${message.dateString}T12:00:00`) : null;
        const messageMs = messageDate && !Number.isNaN(messageDate.getTime()) ? messageDate.getTime() : null;
        if (fromMs !== null && (messageMs === null || messageMs < fromMs)) return false;
        if (toMs !== null && (messageMs === null || messageMs > toMs)) return false;

        if (filters.hasFile && !message.fileUrl && !message.fileName) return false;
        if (filters.hasFile && filters.fileType && getMessageFileType(message) !== filters.fileType) return false;

        const trailText = (message.taskData?.trail || []).map(t => `${t.action || ''} ${t.comment || ''} ${t.fileName || ''}`).join(' ');
        const haystack = `${stripHtml(message.text)} ${message.fileName || ''} ${message.senderEmail || ''} ${getSourceLabel(message)} ${Object.keys(message.reactions || {}).join(' ')} ${message.taskData?.deadline || ''} ${message.taskData?.priority || ''} ${message.taskData?.status || ''} ${trailText}`.toLowerCase();
        return !keyword || haystack.includes(keyword);
      })
      .sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0))
      .slice(0, 150);

    setResults(nextResults);
    setHasSearched(true);
  };

  const updateUsers = (event) => {
    setFilters(prev => ({ ...prev, userEmails: Array.from(event.target.selectedOptions).map(option => option.value) }));
  };

  const clearSearch = () => {
    setFilters({ userEmails: [], keyword: '', dateFrom: '', dateTo: '', hasFile: false, fileType: '' });
    setResults([]);
    setHasSearched(false);
  };

  return (
    <div className="flex-1 h-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 overflow-y-auto p-4 md:p-6" style={{ fontFamily: 'var(--app-font-family)', fontSize: 'var(--app-font-size)' }}>
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-300">Advanced Search</p>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Find messages, tasks, and files</h2>
          </div>
          <button onClick={onBack} className="inline-flex items-center justify-center rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400">
            <i className="fa-solid fa-arrow-left mr-2"></i>Back to main page
          </button>
        </div>

        <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-6">
            <label className="xl:col-span-2">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Users</span>
              <select multiple value={filters.userEmails} onChange={updateUsers} className="h-32 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600">
                {dbUsers.map(u => <option key={u.uid || u.email} value={u.email}>{u.name || u.email}</option>)}
              </select>
              <span className="mt-1 block text-[10px] font-semibold text-slate-400">Hold Ctrl/Cmd to combine users.</span>
            </label>

            <label className="xl:col-span-2">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Keyword</span>
              <input value={filters.keyword} onChange={e => setFilters(prev => ({ ...prev, keyword: e.target.value }))} placeholder="Message, task, file, tag..." className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
            </label>

            <label>
              <span className="mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Date From</span>
              <input type="date" value={filters.dateFrom} onChange={e => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))} className="modern-date-input dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700" />
            </label>

            <label>
              <span className="mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Date To</span>
              <input type="date" value={filters.dateTo} onChange={e => setFilters(prev => ({ ...prev, dateTo: e.target.value }))} className="modern-date-input dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700" />
            </label>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/60 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex min-h-[44px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                <input type="checkbox" checked={filters.hasFile} onChange={e => setFilters(prev => ({ ...prev, hasFile: e.target.checked, fileType: e.target.checked ? prev.fileType : '' }))} className="h-4 w-4 accent-indigo-600" />
                Has File
              </label>
              <label>
                <span className="mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">File Type</span>
                <select value={filters.fileType} disabled={!filters.hasFile} onChange={e => setFilters(prev => ({ ...prev, fileType: e.target.value }))} className="h-11 min-w-44 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition-all disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                  <option value="">Any file</option>
                  <option value="image">Image</option>
                  <option value="pdf">PDF</option>
                  <option value="document">Document</option>
                  <option value="spreadsheet">Spreadsheet</option>
                  <option value="other">Other</option>
                </select>
              </label>
            </div>
            <div className="flex gap-2">
              <button onClick={clearSearch} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600 transition-all hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">Clear</button>
              <button onClick={runSearch} className="rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400">
                <i className="fa-solid fa-magnifying-glass mr-2"></i>Search
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-700">
            <h3 className="font-black text-slate-800 dark:text-slate-100">Search Results</h3>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500 dark:bg-slate-800 dark:text-slate-300">{hasSearched ? `${results.length} found` : 'Not searched yet'}</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {hasSearched && results.map(result => {
              const sender = dbUsers.find(u => u.email === result.senderEmail);
              const timestamp = result.timestamp?.toDate ? result.timestamp.toDate().toLocaleString() : result.dateString || 'Unknown time';
              return (
                <button key={result.id} onClick={() => onOpen(result.id, result.groupId, result.replyToId)} className="w-full p-4 text-left transition-colors hover:bg-yellow-50 dark:hover:bg-yellow-500/10">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-widest">
                    <span className="rounded-full bg-indigo-50 px-2 py-1 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">Source: {getSourceLabel(result)}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">User: {sender?.name || result.senderEmail || 'Unknown'}</span>
                    <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">Timestamp: {timestamp}</span>
                  </div>
                  <div className="text-sm font-semibold leading-relaxed text-slate-700 dark:text-slate-200 line-clamp-2">{stripHtml(result.text) || result.fileName || 'Task/Update'}</div>
                </button>
              );
            })}
            {!hasSearched && <div className="p-10 text-center text-sm font-bold text-slate-400">Set filters, then press Search to execute.</div>}
            {hasSearched && results.length === 0 && <div className="p-10 text-center text-sm font-bold text-slate-400">No results matched the selected filters.</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

const RepliesSidebar = ({ activeReplies, setActiveReplies, messages, user, currentUserData, dbUsers, groups, activeGroup, isVipAdmin, handleReactionIntercept, deleteMessageDB, setActiveModal, sendMessageToDB, handleToggleBookmark, handleTogglePin, customTags, toolPreferences, setReplyingTo, setSelectedMessage, sidebarWidth }) => {
    const threadMessages = messages.filter(m => m.replyToId === activeReplies.id).sort((a,b) => (a.timestamp?.toMillis?.() || Date.now()) - (b.timestamp?.toMillis?.() || Date.now()));
    const [text, setText] = useState('');
    const [threadPendingFiles, setThreadPendingFiles] = useState([]);
    const [showThreadFileRename, setShowThreadFileRename] = useState(false);
    const [isReplyUploading, setIsReplyUploading] = useState(false);
    const [replyUploadProgress, setReplyUploadProgress] = useState(0);
    const [threadEmojiPickerOpen, setThreadEmojiPickerOpen] = useState(false);
    const threadInputRef = useRef(null);
    const threadFileRef = useRef(null);
    const threadEmojiPickerRef = useRef(null);
    const repliesScrollRef = useRef(null);



    useEffect(() => {
        const scrollToLatest = () => repliesScrollRef.current?.scrollTo({ top: repliesScrollRef.current.scrollHeight, behavior: "smooth" });
        const timer = setTimeout(() => {
            scrollToLatest();
            threadInputRef.current?.focus();
        }, 80);
        return () => clearTimeout(timer);
    }, [activeReplies?.id, threadMessages.length]);

    const handleSend = async () => {
        if((!text.trim() || text === '<br>') && threadPendingFiles.length === 0) return;
        setIsReplyUploading(true);
        setReplyUploadProgress(0);
        const renamed = threadPendingFiles.map((pf) => {
          const file = pf.file;
          const base = (pf.customName || file.name.replace(/\.[^/.]+$/, '')).replace(/\.[^/.]+$/, '').trim() || file.name.replace(/\.[^/.]+$/, '');
          const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
          const renamedFile = new File([file], `${base}${ext}`, { type: file.type });
          renamedFile.caption = pf.caption || '';
          return renamedFile;
        });
        await sendMessageToDB(text.trim(), { id: activeReplies.id, sender: activeReplies.sender, text: activeReplies.text || activeReplies.fileName }, renamed, setReplyUploadProgress);
        setTimeout(() => repliesScrollRef.current?.scrollTo({ top: repliesScrollRef.current.scrollHeight, behavior: "smooth" }), 60);
        setText('');
        setThreadPendingFiles([]);
        setShowThreadFileRename(false);
        setReplyUploadProgress(100);
        setTimeout(() => setIsReplyUploading(false), 400);
        if(threadInputRef.current) threadInputRef.current.innerHTML = '';
    };

    const handleThreadFileUpload = (e) => {
        const files = Array.from(e.target.files || []).slice(0, 3);
        e.target.value = '';
        if (files.length === 0) return;
        setThreadPendingFiles(files.map((file) => ({ id: Date.now() + Math.random(), file, customName: file.name, caption: '' })));
        setShowThreadFileRename(true);
    };

    const handleThreadPaste = (e) => {
        const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items || [];
        for (let index in items) {
            const item = items[index];
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                const blob = item.getAsFile();
                if (blob) {
                    const file = new File([blob], `reply_pasted_image_${Date.now()}.png`, { type: blob.type || 'image/png' });
                    setThreadPendingFiles(prev => [...prev, { id: Date.now() + Math.random(), file, customName: file.name, caption: '' }].slice(0, 3));
                    setShowThreadFileRename(true);
                }
            }
        }
    };

    return (
        <div className="w-full bg-slate-50 border-l border-slate-200 flex flex-col h-full shadow-2xl animate-in slide-in-from-right z-50 absolute right-0 md:relative" style={{ width: `${sidebarWidth || 384}px` }}>
            <style>{`.custom-wysiwyg:empty:before { content: attr(data-placeholder); color: #9ca3af; pointer-events: none; display: block; }`}</style>
            <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between shadow-sm z-10 shrink-0 h-[59px]">
                <div>
                    <h3 className="font-bold text-slate-800 leading-tight">Replies</h3>
                    <span className="text-[11px] text-slate-500 font-medium">Replies Panel</span>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => repliesScrollRef.current?.scrollTo({ top: repliesScrollRef.current.scrollHeight, behavior: 'smooth' })} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors" title="Scroll to latest reply"><i className="fa-solid fa-arrow-down"></i></button>
                    <button onClick={() => setActiveReplies(null)} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors"><i className="fa-solid fa-xmark"></i></button>
                </div>
            </div>
            <div ref={repliesScrollRef} className="flex-1 overflow-y-auto p-4 custom-sidebar-scroll">
                <MessageBubble
                    msg={activeReplies} userEmail={user.email} currentUserData={currentUserData} dbUsers={dbUsers}
                    groups={groups} handleReaction={handleReactionIntercept} handleDeleteMessage={deleteMessageDB}
                    customTags={customTags} toolPreferences={toolPreferences} setActiveModal={setActiveModal}
                    setReplyingTo={setReplyingTo} setSelectedMessage={setSelectedMessage} chatInputRef={threadInputRef} isThreadView={true} activeGroup={activeGroup} isVipAdmin={isVipAdmin} handleToggleBookmark={handleToggleBookmark} handleTogglePin={handleTogglePin}
                />

                <div className="flex items-center gap-3 my-4 opacity-80">
                    <div className="flex-1 h-px bg-slate-300"></div>
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">{threadMessages.length} Replies</span>
                    <div className="flex-1 h-px bg-slate-300"></div>
                </div>

                {threadMessages.map(m => (
                    <MessageBubble
                        key={m.id} msg={m} userEmail={user.email} currentUserData={currentUserData} dbUsers={dbUsers}
                        groups={groups} handleReaction={handleReactionIntercept} handleDeleteMessage={deleteMessageDB}
                        customTags={customTags} toolPreferences={toolPreferences} setActiveModal={setActiveModal}
                        setReplyingTo={setReplyingTo} setSelectedMessage={setSelectedMessage} chatInputRef={threadInputRef} isThreadView={true} activeGroup={activeGroup} isVipAdmin={isVipAdmin} handleToggleBookmark={handleToggleBookmark} handleTogglePin={handleTogglePin}
                    />
                ))}
            </div>
            <InputArea
                inputText={text}
                setInputText={setText}
                isOnline={true}
                isUploading={isReplyUploading}
                activeGroup={activeGroup}
                replyingTo={null}
                setReplyingTo={() => {}}
                handleSendOfflineAware={handleSend}
                handleTypingEvent={() => {}}
                handlePaste={handleThreadPaste}
                chatInputRef={threadInputRef}
                fileInputRef={threadFileRef}
                handleFileUpload={handleThreadFileUpload}
                emojiPickerOpen={threadEmojiPickerOpen}
                setEmojiPickerOpen={setThreadEmojiPickerOpen}
                emojiPickerRef={threadEmojiPickerRef}
                pendingFiles={threadPendingFiles}
                setPendingFiles={setThreadPendingFiles}
                showFileRename={showThreadFileRename}
                setShowFileRename={setShowThreadFileRename}
                setActiveModal={setActiveModal}
                setPendingScheduledText={() => {}}
                offlineDrafts={[]}
                user={user}
                dbUsers={dbUsers}
                groups={groups}
                currentUserData={currentUserData}
                MAX_FILE_SIZE_MB={5}
                handleSendPendingFiles={handleSend}
                composerVariant="reply"
                placeholder="Write a reply with rich formatting..."
                showScheduleButton={false}
                showOfflineDrafts={false}
            />
        </div>
    )
};

const TaskSidebar = ({ activeTask, setActiveTask, messages, user, currentUserData, dbUsers, groups, activeGroup, isVipAdmin, handleReactionIntercept, deleteMessageDB, setActiveModal, handleToggleBookmark, handleTogglePin, customTags, toolPreferences, setReplyingTo, setSelectedMessage, chatInputRef, sidebarWidth }) => {
    const liveTask = messages.find(m => m.id === activeTask?.id) || activeTask;
    if (!liveTask) return null;
    const taskGroup = groups.find(g => g.id === liveTask.groupId) || activeGroup;
    return (
        <div className="w-full bg-slate-50 border-l border-slate-200 flex flex-col h-full shadow-2xl animate-in slide-in-from-right z-50 absolute right-0 md:relative" style={{ width: `${sidebarWidth || 384}px` }}>
            <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between shadow-sm z-10 shrink-0 h-[59px]">
                <div className="min-w-0">
                    <h3 className="font-bold text-slate-800 leading-tight flex items-center gap-2"><i className="fa-regular fa-square-check text-indigo-600"></i> Task Sidebar</h3>
                    <span className="text-[11px] text-slate-500 font-medium truncate block">Updates, uploads and review actions happen here</span>
                </div>
                <button onClick={() => setActiveTask(null)} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-sidebar-scroll">
                <MessageBubble
                    msg={liveTask}
                    userEmail={user.email}
                    currentUserData={currentUserData}
                    dbUsers={dbUsers}
                    groups={groups}
                    activeGroup={taskGroup}
                    handleReaction={handleReactionIntercept}
                    handleDeleteMessage={deleteMessageDB}
                    customTags={customTags}
                    toolPreferences={toolPreferences}
                    setActiveModal={setActiveModal}
                    setReplyingTo={setReplyingTo}
                    setSelectedMessage={setSelectedMessage}
                    chatInputRef={chatInputRef}
                    isThreadView={true}
                    isVipAdmin={isVipAdmin}
                    handleToggleBookmark={handleToggleBookmark}
                    handleTogglePin={handleTogglePin}
                    taskSidebarMode={true}
                />
            </div>
        </div>
    );
};

export default function ChatApp({ user, onLogout, appVersion: appVersionProp }) {
    const { appVersion: contextAppVersion , orgId } = useAuth();
    const appVersion = contextAppVersion || appVersionProp;
    const [activeModal, setActiveModal] = useState(null);
    const [showRightSidebar, setShowRightSidebar] = useState(true);
    const [activeTaskSidebar, setActiveTaskSidebar] = useState(null);
    const [maxFileSizeMb, setMaxFileSizeMb] = useState(() => Number(localStorage.getItem("maxFileSizeMb") || 5));
    const [viewMode, setViewMode] = useState("chat");
    const [showNotifications, setShowNotifications] = useState(false);
    const [alertPulseActive, setAlertPulseActive] = useState(false);
    const lastNotificationTotalRef = useRef(0);
    const [isAtBottom, setIsAtBottom] = useState(true);
    const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(true);
    const MAX_FILE_SIZE_MB = maxFileSizeMb || 5;
    const [inputText, setInputText] = useState("");

    const [searchQuery, setSearchQuery] = useState("");
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const searchWrapperRef = useRef(null);

    const [activeReplies, setActiveReplies] = useState(null);
    const [dismissedBroadcastId, setDismissedBroadcastId] = useState(null);

    const [sidebarSearch, setSidebarSearch] = useState("");
    const [chatFilter, setChatFilter] = useState("all");
    const [showFilterMenu, setShowFilterMenu] = useState(false);
    const [chatDateFilter, setChatDateFilter] = useState("");
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [replyingTo, setReplyingTo] = useState(null);
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [editMessageText, setEditMessageText] = useState("");
    const [activeGroup, setActiveGroup] = useState(null);
    const [isMobileViewport, setIsMobileViewport] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches);

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
    const [profileForm, setProfileForm] = useState({ name: "", fontSize: "text-[14.2px]", fontFamily: "font-sans", themeFont: "Inter", accentColor: "indigo", displayMode: "light", fontScale: "normal" });
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

    const [leftWidth, setLeftWidth] = useState(320);
    const [rightWidth, setRightWidth] = useState(380);

    const startResize = (side) => (e) => {
      e.preventDefault();
      const startX = e.clientX;
      const startLeft = leftWidth;
      const startRight = rightWidth;
      const onMove = (ev) => {
        if (side === 'left') {
          const next = Math.min(520, Math.max(260, startLeft + (ev.clientX - startX)));
          setLeftWidth(next);
        } else {
          const next = Math.min(520, Math.max(280, startRight - (ev.clientX - startX)));
          setRightWidth(next);
        }
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    };


    const {
        isVipAdmin, currentUserData, dbUsers, groups, customTags,
        activeReminders, genericNotifications, allAdminReminders,
        immutableAuditLogs, toolPreferences, setToolPreferences,
        globalAnnouncement
    } = useWorkspaceData(user, profileForm, setProfileForm, orgId);

    const isGlobalSuperAdmin = (user?.email || '').toLowerCase() === GLOBAL_SUPER_ADMIN_EMAIL;
    const effectiveIsVipAdmin = isVipAdmin || isGlobalSuperAdmin;
    const effectiveCurrentUserData = useMemo(() => ({
        ...(currentUserData || {}),
        isAdmin: currentUserData?.isAdmin || isGlobalSuperAdmin,
        isApproved: currentUserData?.isApproved !== false || isGlobalSuperAdmin,
        roles: isGlobalSuperAdmin ? Array.from(new Set([...(currentUserData?.roles || []), 'Super Admin'])) : currentUserData?.roles,
    }), [currentUserData, isGlobalSuperAdmin]);

    const featureFlags = useMemo(() => normalizeFeatureFlags(currentUserData?.featureFlags), [currentUserData?.featureFlags]);
    const shouldLoadChatData = viewMode === 'chat' && !isWorkspaceLoading && featureFlags.chat !== false;

    useEffect(() => {
        const root = document.documentElement;
        const font = currentUserData?.themeFont || profileForm.themeFont || 'Inter';
        const mode = currentUserData?.displayMode || profileForm.displayMode || 'light';
        const scale = currentUserData?.fontScale || profileForm.fontScale || 'normal';
        root.style.setProperty('--app-accent', THEME_ACCENTS.indigo);
        root.style.setProperty('--app-font-family', THEME_FONTS[font] || THEME_FONTS.Inter);
        root.style.setProperty('--app-font-size', FONT_SCALE[scale] || FONT_SCALE.normal);
        root.dataset.theme = mode;
        root.classList.toggle('dark', mode === 'dark' || !!toolPreferences?.darkMode);
    }, [currentUserData?.themeFont, currentUserData?.displayMode, currentUserData?.fontScale, profileForm.themeFont, profileForm.displayMode, profileForm.fontScale, toolPreferences?.darkMode]);

    const {
        messages, typingStatus, isOnline, offlineDrafts,
        logImmutableAction, triggerTypingEvent, sendMessageToDB, reactToMessageDB,
        deleteMessageDB, editMessageDB, togglePinDB, toggleBookmarkDB,
        uploadAndSendFileDB, scheduleMessageDB, saveOfflineDraft, deleteOfflineDraft
    } = useChatEngine({
        orgId,
        user, activeGroup, dbUsers, groups, toolPreferences, isWorkspaceLoading, addToast, maxFileSizeMb: MAX_FILE_SIZE_MB, currentUserData: effectiveCurrentUserData
    });


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
            const incomingSound = 'https://firebasestorage.googleapis.com/v0/b/niltask.firebasestorage.app/o/sounds%2FINCOMING-MESSAGE-TASK-CREATE-UPDATE.mp3?alt=media&token=a3ac611f-1dc1-4973-83fe-c122b02396d2';
            const outgoingSound = 'https://firebasestorage.googleapis.com/v0/b/niltask.firebasestorage.app/o/sounds%2FOUTGOING-MESSAGE-TASK-CREATE-UPDATE.mp3?alt=media&token=1bb9d617-3694-468d-9e5a-326e66aed434';
            const bannerSound = 'https://firebasestorage.googleapis.com/v0/b/niltask.firebasestorage.app/o/sounds%2FBANNER.mp3?alt=media&token=b3463c11-1f70-4450-8efc-049e04f33a0a';

            let soundUrl = outgoingSound;
            switch (type) {
                case 'messageReceived':
                case 'taskCreated':
                case 'taskUpdated':
                case 'taskFileUpload':
                    soundUrl = bannerSound; break;
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
        if (!globalAnnouncement || !orgId) return;
        setDismissedBroadcastId(globalAnnouncement.id);
        try {
            await addDoc(collection(db, "organizations", orgId, "broadcast_acks"), {
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
        const media = window.matchMedia('(max-width: 767px)');
        const syncViewport = () => setIsMobileViewport(media.matches);
        syncViewport();
        media.addEventListener('change', syncViewport);
        return () => media.removeEventListener('change', syncViewport);
    }, []);

    useEffect(() => {
        if (isWorkspaceLoading || isMobileViewport || !groups.length || activeGroup) return;
        const savedGroupId = currentUserData?.lastActiveGroupId;
        if (savedGroupId) {
            const g = groups.find(gr => gr.id === savedGroupId && gr.members?.includes(user.email));
            if (g) setActiveGroup(g);
        }
    }, [isWorkspaceLoading, isMobileViewport, groups, currentUserData?.lastActiveGroupId, user.email, activeGroup]);

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
        if (!orgId) return;
        const checkerInterval = setInterval(async () => {
            const now = new Date();
            const dueTasks = messages.filter(m => m.isTask && m.taskData?.status !== "Completed" && !m.taskData?.deadlineAlerted && m.taskData?.deadline && new Date(m.taskData.deadline) <= now);
            dueTasks.forEach(async (task) => {
                await updateDoc(doc(db, "organizations", orgId, "messages", task.id), { "taskData.deadlineAlerted": true });
                const involved = new Set();
                if (task.senderEmail) involved.add(task.senderEmail);
                (task.taskData.assignees || []).forEach(a => involved.add(a));
                involved.forEach(email => {
                    const u = dbUsers.find(u => u.email === email);
                    if (u) addDoc(collection(db, "organizations", orgId, "notifications"), { userId: u.uid, type: "task", text: `⏰ DUE NOW: "${task.text}"`, messageId: task.id, groupId: task.groupId, timestamp: serverTimestamp(), isRead: false }).catch(()=>{});
                });
            });

            const ackDueTasks = messages.filter(m => m.isTask && m.taskData?.requireAck && m.taskData?.ackDeadline && !m.taskData?.ackReminderSent && new Date(m.taskData.ackDeadline) <= now);
            for (const task of ackDueTasks) {
                const pendingAssignees = (task.taskData.assignees || []).filter(email => !task.taskData?.ackBy?.[email]);
                const notifyEmails = [...new Set([...pendingAssignees, task.senderEmail].filter(Boolean))];
                for (const email of notifyEmails) {
                    const u = dbUsers.find(x => x.email === email);
                    if (u) await addDoc(collection(db, "organizations", orgId, "notifications"), { userId: u.uid, type: "task", text: `Kindly Ack the Task ${task.id} Allotted to You - Thanks.`, messageId: task.id, groupId: task.groupId, timestamp: serverTimestamp(), isRead: false }).catch(()=>{});
                }
                await updateDoc(doc(db, "organizations", orgId, "messages", task.id), { "taskData.ackReminderSent": true }).catch(()=>{});
            }

            const dueReminders = (activeReminders || []).filter(r => !r.isTriggered && r.remindAt && new Date(r.remindAt) <= now);
            for (const rem of dueReminders) {
                try {
                    await updateDoc(doc(db, "organizations", orgId, "reminders", rem.id), { isTriggered: true });
                    await addDoc(collection(db, "organizations", orgId, "notifications"), { userId: user.uid, type: "reminder", text: `⏰ REMINDER: "${rem.messageText}"`, messageId: rem.messageId, timestamp: serverTimestamp(), isRead: false });
                    playMelody('taskCreated');
                    setActiveReminderAlert(rem);
                } catch(e) {}
            }

            try {
                const q = query(collection(db, "organizations", orgId, "scheduled_messages"), where("senderUid", "==", user.uid), where("status", "==", "pending"));
                const snap = await getDocs(q);
                for (const document of snap.docs) {
                    const data = document.data();
                    const scheduledMs = data.scheduledAt?.toMillis?.() || new Date(data.scheduledFor).getTime();
                    if (scheduledMs <= now.getTime()) {
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
                        await addDoc(collection(db, "organizations", orgId, "messages"), payload);
                        await updateDoc(doc(db, "organizations", orgId, "scheduled_messages", document.id), { status: "sent", sentAt: serverTimestamp(), retryCount: data.retryCount || 0 });
                        playMelody('messageSent');
                    }
                }
            } catch(e) { console.error(e); }

        }, 15000);
        return () => clearInterval(checkerInterval);
    }, [orgId, messages, dbUsers, activeReminders, user.uid, user.email, currentUserData, playMelody, addToast]);

    const myGroups = useMemo(() => {
        // Implicitly include default departments and the tenant-wide SUPPORT department for every signed-in member.
        let filtered = groups.filter(g => (g.members?.includes(user.email) || g.name === "Welcome" || g.name === "General" || g.name === "SUPPORT" || g.isSupport === true || g.id === "support") && !g.isArchived);
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

    useEffect(() => {
        if (totalNotifications > lastNotificationTotalRef.current) {
            setAlertPulseActive(true);
            const timer = setTimeout(() => setAlertPulseActive(false), 3500);
            lastNotificationTotalRef.current = totalNotifications;
            return () => clearTimeout(timer);
        }
        lastNotificationTotalRef.current = totalNotifications;
    }, [totalNotifications]);

    const pinnedMessages = useMemo(() => activeGroup ? messages.filter(m => m.groupId === activeGroup.id && m.isPinned) : [], [messages, activeGroup]);

    const globalSearchResults = useMemo(() => {
        if (!searchQuery.trim()) return null;
        const q = searchQuery.toLowerCase();

        const matchedMessages = messages.filter(m => {
            if (m.isPrivateMention && !m.allowedUsers?.includes(user.email) && m.senderEmail !== user.email) return false;
            if (m.isTask) {
                const reviewer = m.taskData?.masterReviewerEmail || m.senderEmail;
                if (reviewer !== user.email && !(m.taskData?.assignees || []).includes(user.email)) return false;
            }

            const strippedText = stripHtml(m.text).toLowerCase();
            const textMatch = strippedText.includes(q);
            const fileMatch = (m.fileName || '').toLowerCase().includes(q);
            const trailMatch = m.isTask && (m.taskData?.trail || []).some(t => `${t.action || ''} ${t.comment || ''} ${t.fileName || ''}`.toLowerCase().includes(q));
            const tagMatch = Object.keys(m.reactions || {}).some(tag => tag.toLowerCase().includes(q));
            const dueMatch = m.isTask && `${m.taskData?.deadline || ''} ${m.taskData?.priority || ''} ${m.taskData?.status || ''}`.toLowerCase().includes(q);

            return textMatch || fileMatch || trailMatch || tagMatch || dueMatch;
        }).sort((a,b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0)).slice(0, 50);

        return { messages: matchedMessages };
    }, [searchQuery, messages, user.email]);

    const messagesToRender = useMemo(() => {
        if(!activeGroup) return [];
        let filtered = messages.filter(m => !m.taskData?.isDeleted && m.groupId === activeGroup.id && (!m.isPrivateMention || m.allowedUsers?.includes(user.email)));
        filtered = filtered.filter(m => {
            if (!m.isTask) return true;
            const reviewer = m.taskData?.masterReviewerEmail || m.senderEmail;
            return reviewer === user.email || (m.taskData?.assignees || []).includes(user.email);
        });

        if (chatFilter === 'tasks-pending') filtered = filtered.filter(m => m.isTask && m.taskData?.status !== "Completed");
        else if (chatFilter === 'tasks-completed') filtered = filtered.filter(m => m.isTask && m.taskData?.status === "Completed");
        else if (chatFilter === 'messages') filtered = filtered.filter(m => !m.isTask);
        else if (chatFilter === 'today') filtered = filtered.filter(m => m.dateString === new Date().toISOString().split('T')[0]);
        else if (chatFilter === 'scheduled') filtered = filtered.filter(m => m.scheduledFor || m.hasReminder);
        else if (chatFilter === 'files') filtered = filtered.filter(m => !!m.fileUrl);
        else if (chatFilter === 'date-range' && chatDateFilter) filtered = filtered.filter(m => m.dateString === chatDateFilter);
        else if (chatFilter === 'task') filtered = filtered.filter(m => m.isTask);
        else if (chatFilter === 'delegated') filtered = filtered.filter(m => m.isTask && (m.taskData?.trail || []).some(t => /delegat/i.test(t.action || '')));
        else if (chatFilter === 'transferred') filtered = filtered.filter(m => m.isTask && (m.taskData?.trail || []).some(t => /transfer/i.test(t.action || '')));
        else if (chatFilter === 'bookmarked') filtered = filtered.filter(m => m.bookmarkedBy?.includes(user.email));

        const topLevel = filtered.filter(m => !m.replyToId);
        if (!searchQuery.trim() && (chatFilter === 'all' || chatFilter === 'messages')) {
            // FIX: Use Date.now() instead of 0 to prevent null timestamps from jumping to 1970
            return topLevel.sort((a,b) => (a.timestamp?.toMillis?.() || Date.now()) - (b.timestamp?.toMillis?.() || Date.now()));
        }

        return topLevel;

        return topLevel;
    }, [messages, activeGroup, user.email, chatFilter, chatDateFilter, searchQuery]);

    const tasksAssignedToMe = useMemo(() => messages.filter(m => m.isTask && m.taskData?.assignees?.includes(user.email)).sort((a,b) => new Date(a.taskData.deadline).getTime() - new Date(b.taskData.deadline).getTime()), [messages, user.email]);
    const tasksAssignedByMe = useMemo(() => messages.filter(m => m.isTask && m.senderEmail === user.email).sort((a,b) => new Date(a.taskData.deadline).getTime() - new Date(b.taskData.deadline).getTime()), [messages, user.email]);

    const triggerHighlight = useCallback((msgId) => {
        setHighlightedMsgId(msgId);
        if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = setTimeout(() => { setHighlightedMsgId(null); }, 2000);
    }, []);

    const scrollToMessageDirect = useCallback((msgId) => {
        const el = document.getElementById(`msg-${msgId}`);
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); triggerHighlight(msgId); }
    }, [triggerHighlight]);

    // 👇 UPDATED: Universal Router now handles slack-threads auto-opening 👇
    const navigateToMessageFromNotification = useCallback(async (msgId, targetGroupId, replyToId = null) => {
        setChatFilter('all');
        setSearchQuery('');
        const targetMsg = messages.find(m => m.id === msgId) || messages.find(m => m.id === replyToId);
        const resolvedGroupId = targetMsg?.groupId || targetGroupId;
        let targetGroup = groups.find(g => g.id === resolvedGroupId);
        if (!targetGroup && resolvedGroupId) {
            const otherUid = resolvedGroupId.split('_').find(id => id !== user.uid);
            if (otherUid) {
                const otherUser = dbUsers.find(u => u.uid === otherUid);
                if (otherUser) {
                    targetGroup = { id: resolvedGroupId, isDM: true, name: otherUser.name, members: [user.email, otherUser.email], profilePicUrl: otherUser.profilePicUrl };
                }
            }
        }

        if (targetGroup) {
            setActiveGroup(targetGroup);
            setMobileSidebarOpen(false);
            setShowNotifications(false);
            setActiveModal(null);

            setActiveTaskSidebar(null);
            const effectiveReplyToId = replyToId || targetMsg?.replyToId || null;
            if (effectiveReplyToId) {
                const parentMsg = messages.find(m => m.id === effectiveReplyToId);
                if (parentMsg) {
                    setActiveReplies(parentMsg);
                    let attempts = 0;
                    const scrollReplyIntoView = () => {
                        const el = document.getElementById(`msg-${msgId}`);
                        if (el) {
                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            el.classList.add('ring-4', 'ring-yellow-300', 'bg-yellow-100', 'dark:bg-yellow-500/20', 'transition-all', 'duration-500');
                            setTimeout(() => el.classList.remove('ring-4', 'ring-yellow-300', 'bg-yellow-100', 'dark:bg-yellow-500/20'), 2000);
                        } else if (attempts < 30) {
                            attempts += 1;
                            setTimeout(scrollReplyIntoView, 150);
                        }
                    };
                    setTimeout(scrollReplyIntoView, 120);
                    return;
                }
            }

            setActiveReplies(null);
            setTimeout(() => { setPendingScrollTarget(msgId); }, 50);
        }
    }, [groups, dbUsers, user.uid, user.email, messages]);

    const scrollToTaskInMainChat = useCallback((msgId, targetGroupId) => {
        setChatFilter('all');
        setSearchQuery('');
        const targetMsg = messages.find(m => m.id === msgId);
        const resolvedGroupId = targetMsg?.groupId || targetGroupId;
        const targetGroup = groups.find(g => g.id === resolvedGroupId) || activeGroup;
        if (targetGroup && activeGroup?.id !== targetGroup.id) setActiveGroup(targetGroup);
        setActiveTaskSidebar(null);
        setActiveReplies(null);
        setShowRightSidebar(false);
        setTimeout(() => setPendingScrollTarget(msgId), 80);
    }, [activeGroup, groups, messages]);

    const handleSendOfflineAware = async () => {
        if (!inputText.trim() || inputText === '<br>' || !activeGroup) return;
        if (!isOnline) {
            await saveOfflineDraft(inputText.trim(), activeGroup.id, activeGroup.name);
            setInputText(""); alert("📥 You are offline. Message saved as draft and will be sent when you reconnect."); return;
        }
        await handleSendMessage();
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
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
            addDoc(collection(db, "organizations", orgId, "notifications"), {
                userId: uid, type: "message",
                text: `New Message in ${activeGroup.name}: "${stripHtml(msgText).substring(0,40)}..."`,
                groupId: activeGroup.id, timestamp: serverTimestamp(), isRead: false
            }).catch(()=>{});
        }

        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            if (chatContainerRef.current) chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
            setIsAtBottom(true);
        }, 120);
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
            const scheduledLabel = new Date(scheduleDateTime).toLocaleString();
            setInputText(""); setPendingScheduledText(""); setScheduleDateTime(""); setActiveModal(null);
            if(chatInputRef.current) chatInputRef.current.innerHTML = '';
            addToast(`✅ Scheduled for ${scheduledLabel}`, 'success');
            await scheduleMessageDB(text, scheduleDateTime, isTask, taskData);
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
            try { await addDoc(collection(db, "organizations", orgId, "notifications"), { userId: uid, type: "task", text: `"${stripHtml(taskMsg.text).substring(0,30)}..." - ${(user.email || "").split('@')[0]} updated ✅`, messageId: taskMsg.id, groupId: taskMsg.groupId, timestamp: serverTimestamp(), isRead: false }); } catch (e) {}
        }
    };

    // 👇 UPDATED convertToTask function with acknowledgment & proof fields

    useEffect(() => {
        const migrateAssigneeStates = async () => {
            const candidates = messages.filter(m => m.isTask && m.taskData?.assignees?.length && (!m.taskData?.assigneeStates || !m.taskData?.masterReviewerEmail || !m.taskData?.visibleTo));
            for (const m of candidates.slice(0, 20)) {
                const states = Object.fromEntries((m.taskData.assignees || []).map(e => [e, 'assigned']));
                await updateDoc(doc(db, "organizations", orgId, "messages", m.id), { "taskData.assigneeStates": m.taskData?.assigneeStates || states, "taskData.masterReviewerEmail": m.taskData?.masterReviewerEmail || m.senderEmail || "", "taskData.visibleTo": m.taskData?.visibleTo || [...new Set([m.senderEmail, m.taskData?.masterReviewerEmail, ...(m.taskData?.assignees || [])].filter(Boolean))], "taskData.ackBy": m.taskData?.ackBy || {} }).catch(() => {});
            }
        };
        migrateAssigneeStates();
    }, [messages]);

    const convertToTask = async () => {
        if (!featureFlags.taskCards) return alert("Task cards are not enabled for your account.");
        if (!selectedMessage || !taskDeadline || taskAssignees.length === 0) return alert("Please select Assignees, Priority, and Deadline.");
        try {
            const now = new Date();
            let ackDeadline = null;

            // Calculate acknowledgment deadline based on selected option
            if (requireAck) {
                switch (ackTimeOption) {
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

            const finalAssignees = Array.from(new Set([...(taskAssignees || [])]));

            const sanitizedTaskTitle = stripHtml(selectedMessage.text || "").replace(/ |&nbsp;/g, " ").trim() || "Task";

            const taskData = {
                deadline: taskDeadline,
                assignees: finalAssignees,
                priority: taskPriority,
                status: "Pending",
                isArchived: false,
                dismissedBy: [],
                trail: [{
                    action: "Task Created",
                    by: user.email,
                    time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ', ' + now.toLocaleDateString(),
                    to: finalAssignees.map(email => {
    const u = dbUsers.find(x => x.email === email);
    return u ? u.name : (email||"").split('@')[0];
}).join(', ')
                }],
                requireAck: requireAck,
                ackDeadline: ackDeadline ? ackDeadline.toISOString() : null,
                ackBy: {},
                requireProof: requireProof,
                escalated: false,
                assigneeStates: Object.fromEntries(finalAssignees.map(e => [e, "assigned"])),
                masterReviewerEmail: user.email,
                visibleTo: [...new Set([user.email, ...finalAssignees])],
                isDeleted: false,
                deletedAt: null
            };

            await setDoc(doc(db, "organizations", orgId, "messages", selectedMessage.id), {
                isTask: true,
                text: sanitizedTaskTitle,
                taskData: taskData
            }, { merge: true });

            finalAssignees.forEach(email => {
                if (email !== user.email) {
                    const assigneeUser = dbUsers.find(u => u.email === email);
                    if (assigneeUser) {
                        addDoc(collection(db, "organizations", orgId, "notifications"), {
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
            await updateDoc(doc(db, "organizations", orgId, "messages", selectedMessage.id), { text: newTaskTitle });
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
            await updateDoc(doc(db, "organizations", orgId, "messages", selectedMessage.id), { "taskData.assignees": delegateAssignees, "taskData.status": "In Progress", "taskData.trail": updatedTrail, "taskData.dismissedBy": [] });
            playMelody('taskUpdated');
            setActiveModal(null); setDelegateAssignees([]); setShowDelegateDropdown(false);
        } catch (error) {}
    };

    const handleCompleteTask = async () => {
        if (!selectedMessage) return;
        try {
            const now = new Date();
            const updatedTrail = [...selectedMessage.taskData.trail, { action: "Marked Completed", by: user.email, time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ', ' + now.toLocaleDateString(), to: "System" }];
            await updateDoc(doc(db, "organizations", orgId, "messages", selectedMessage.id), { "taskData.status": "Completed", "taskData.trail": updatedTrail });
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
            await updateDoc(doc(db, "organizations", orgId, "messages", selectedMessage.id), { "taskData.trail": updatedTrail, "taskData.status": newStatus });
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
                await updateDoc(doc(db, "organizations", orgId, "messages", selectedMessage.id), { "taskData.trail": updatedTrail, "taskData.status": newStatus });
                setSelectedMessage(prev => ({...prev, taskData: {...prev.taskData, trail: updatedTrail, status: newStatus}}));
                playMelody('taskFileUpload');
            } catch(e) {} finally { setTrailFileUploading(false); if(trailFileInputRef.current) trailFileInputRef.current.value = ""; }
        });
    };

    const setReminder = async () => {
        if (!selectedMessage || !reminderDateTime || !orgId) return;
        try {
            await addDoc(collection(db, "organizations", orgId, "reminders"), { userId: user.uid, userEmail: user.email, messageId: selectedMessage.id, messageText: stripHtml(selectedMessage.text) || selectedMessage.fileName || "File Attachment", remindAt: reminderDateTime, isTriggered: false });
            await updateDoc(doc(db, "organizations", orgId, "messages", selectedMessage.id), { hasReminder: true });
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
            await updateDoc(doc(db, "organizations", orgId, "messages", targetMsg.id), { "taskData.trail": updatedTrail, "taskData.status": newStatus });
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
                addDoc(collection(db, "organizations", orgId, "notifications"), {
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
            const q = query(collection(db, "organizations", orgId, "messages"), where("isTask", "==", true));
            const snapshot = await getDocs(q);
            if (snapshot.empty) return alert("No tasks found! You are already clean.");
            await Promise.all(snapshot.docs.map(document => deleteDoc(doc(db, "organizations", orgId, "messages", document.id))));
            alert(`🧹 Successfully wiped ${snapshot.docs.length} tasks! Clean slate ready.`);
        } catch (error) { alert("Failed to clean database."); }
    };

    const handleGroupPicUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setGroupPicUploadProgress(10);
        const uniqueFileName = `group_${Date.now()}.webp`;
        const compressedBlob = await compressImage(file, 640, 640, 0.68);
        const groupFile = new File([compressedBlob], uniqueFileName, { type: 'image/webp' });
        const uploadTask = uploadBytesResumable(ref(storage, `group_avatars/${uniqueFileName}`), groupFile);
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
            await updateDoc(doc(db, "organizations", orgId, "groups", activeGroup.id), { members: finalMembers });
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
            if (editingGroup) await updateDoc(doc(db, "organizations", orgId, "groups", editingGroup.id), groupData);
            else await addDoc(collection(db, "organizations", orgId, "groups"), { ...groupData, admins: [user.email], createdBy: user.email, createdAt: serverTimestamp(), isArchived: false });
            setActiveModal(null); setEditingGroup(null); setGroupForm({name: "", members: [], admins: [], profilePicUrl: null});
        } catch (error) { alert("Failed to save department."); }
    };

    const onGroupUpdate = useCallback(async (updates) => {
        if (!activeGroup || !activeGroup.id) return;
        if (updates.profilePicFile) {
            const file = updates.profilePicFile;
            const uniqueFileName = `group_${Date.now()}.webp`;
            const compressedBlob = await compressImage(file, 640, 640, 0.68);
            const groupFile = new File([compressedBlob], uniqueFileName, { type: 'image/webp' });
            const uploadTask = uploadBytesResumable(ref(storage, `group_avatars/${uniqueFileName}`), groupFile);
            uploadTask.on('state_changed', null, null, async () => {
                const url = await getDownloadURL(uploadTask.snapshot.ref);
                await updateDoc(doc(db, "organizations", orgId, "groups", activeGroup.id), { profilePicUrl: url });
                setActiveGroup(prev => ({ ...prev, profilePicUrl: url }));
                setActiveModal(null);
            });
            return;
        }
        const cleanUpdates = {};
        if (Object.prototype.hasOwnProperty.call(updates, "name")) cleanUpdates.name = (updates.name ?? '').trim();
        if (updates.members) { cleanUpdates.members = updates.members; cleanUpdates.admins = updates.admins || activeGroup.admins.filter(a => updates.members.includes(a)); }
        if (Object.keys(cleanUpdates).length === 0) return;
        setActiveGroup(prev => ({ ...prev, ...cleanUpdates }));
        await updateDoc(doc(db, "organizations", orgId, "groups", activeGroup.id), cleanUpdates);
        setActiveModal(null);
    }, [activeGroup, orgId, storage, db, setActiveModal]);

    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        const file = profilePicInputRef.current?.files[0];
        try {
            let updateData = { name: profileForm.name ?? '', fontSize: profileForm.fontSize, fontFamily: profileForm.fontFamily, themeFont: profileForm.themeFont || 'Inter', displayMode: profileForm.displayMode || 'light', fontScale: profileForm.fontScale || 'normal' };
            if (file) {
                setProfileUploadProgress(10);
                const uniqueFileName = `${user.uid}_${Date.now()}_avatar.webp`;
                const compressedBlob = await compressImage(file, 512, 512, 0.62);
                const avatarBlob = compressedBlob instanceof Blob ? compressedBlob : new Blob([compressedBlob], { type: 'image/webp' });
                const avatarFile = new File([avatarBlob], uniqueFileName, { type: 'image/webp' });
                const uploadTask = uploadBytesResumable(ref(storage, `avatars/${uniqueFileName}`), avatarFile);
                await new Promise((resolve, reject) => {
                    uploadTask.on('state_changed', (snapshot) => setProfileUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100), reject, async () => {
                        updateData.profilePicUrl = await getDownloadURL(uploadTask.snapshot.ref);
                        setProfileUploadProgress(100);
                        resolve();
                    });
                });
            }
            await updateDoc(doc(db, "users", user.uid), updateData);
            setProfileForm(prev => ({ ...prev, name: updateData.name, themeFont: updateData.themeFont, displayMode: updateData.displayMode, fontScale: updateData.fontScale }));
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
        featureFlags,
        setReplyingTo, chatInputRef, currentUserData, profileForm,
        setProfileForm, profilePicInputRef, profileUploadProgress,
        setProfileUploadProgress, handleProfileSubmit, toolPreferences,
        setToolPreferences, user, groupForm, setGroupForm, editingGroup,
        handleGroupSubmit, groupPicInputRef, handleGroupPicUpload,
        groupPicUploadProgress, dbUsers, activeGroup, isVipAdmin: effectiveIsVipAdmin, customTags,
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

// NEW: Block users entirely if their Gmail isn't mapped to an Organization
    if (currentUserData && !currentUserData.orgId && !effectiveCurrentUserData.isAdmin && !effectiveIsVipAdmin) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50 p-4 text-slate-800">
                <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 border-t-8 border-rose-600 text-center transform-gpu hover:scale-105 transition-transform">
                    <i className="fa-solid fa-building-circle-xmark text-5xl text-rose-600 mb-4 animate-pulse"></i>
                    <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
                    <p className="text-sm font-bold text-rose-600 mb-6 uppercase tracking-wider leading-relaxed">
                        YOU ARE NOT THE PART OF ANY ORGANIZATION-PLEASE CONTACT YOUR ADMINISTRATOR
                    </p>
                    <button onClick={onLogout} className="bg-slate-100 text-slate-700 py-2 px-6 rounded-full font-bold shadow-sm hover:bg-slate-200 transition-colors">Sign Out</button>
                </div>
            </div>
        );
    }
  
    if (currentUserData && currentUserData.isApproved !== true && !effectiveCurrentUserData.isAdmin && !effectiveIsVipAdmin) {
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

    return (
        <div className="flex flex-col h-screen w-full bg-slate-50 text-slate-800 overflow-hidden relative transition-opacity duration-700 ease-out opacity-100 dark:bg-slate-900" style={{ fontFamily: 'var(--app-font-family)', fontSize: 'var(--app-font-size)' }}>

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
                    <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[90%] max-w-sm rounded-3xl border border-indigo-200 bg-white text-slate-800 shadow-2xl z-[100] p-6 animate-in slide-in-from-top-10 duration-700 dark:border-indigo-500/30 dark:bg-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center shadow-inner relative">
                                <span className="absolute inset-0 rounded-full bg-indigo-400 opacity-20 animate-ping"></span>
                                <i className="fa-solid fa-bell text-xl relative z-10 animate-bounce"></i>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">Reminder</h3>
                                <span className="text-xs font-bold text-indigo-500 dark:text-indigo-300 uppercase tracking-widest">Time's Up!</span>
                            </div>
                        </div>
                        <div className="bg-indigo-50 dark:bg-slate-950 p-4 rounded-2xl border border-indigo-100 dark:border-slate-700 shadow-inner mb-6">
                            <p className="text-slate-700 dark:text-slate-200 font-medium text-sm break-words whitespace-normal">"{activeReminderAlert.messageText}"</p>
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
                  currentUserData={effectiveCurrentUserData}
                  isVipAdmin={effectiveIsVipAdmin}
                  maxFileSizeMb={MAX_FILE_SIZE_MB}
                  setMaxFileSizeMb={setMaxFileSizeMb}
                  featureFlags={featureFlags}
                />
                ) : viewMode === "advanced" ? (
                    featureFlags.chat ? <AdvancedSearchPage messages={messages} dbUsers={dbUsers} groups={groups} user={user} onBack={() => setViewMode('chat')} onOpen={(id, groupId, replyToId) => { setViewMode('chat'); navigateToMessageFromNotification(id, groupId, replyToId); }} /> : <FeatureLockedPanel title="Chat is disabled" message="Message search is unavailable because chat is not enabled for your account." icon="fa-comments" />
                ) : (
                    <div className="flex h-full w-full relative">
                        <LeftSidebar sidebarWidth={leftWidth}
                            user={user} currentUserData={effectiveCurrentUserData} myGroups={myGroups} dmUsers={dmUsers} activeGroup={activeGroup} setActiveGroup={setActiveGroup}
                            setShowRightSidebar={setShowRightSidebar} setMobileSidebarOpen={setMobileSidebarOpen} getUnreadInfoForUser={getUnreadInfoForUser}
                            getUnreadInfoForGroup={getUnreadInfoForGroup} messages={messages} onLogout={onLogout} setActiveModal={setActiveModal} setGroupForm={setGroupForm} setEditingGroup={setEditingGroup}
                            sidebarSearch={sidebarSearch} setSidebarSearch={setSidebarSearch} mobileSidebarOpen={mobileSidebarOpen} isVipAdmin={effectiveIsVipAdmin} setViewMode={setViewMode}
                            isMobileHome={!activeGroup}
                            featureFlags={featureFlags}
                        />
                        <div className="hidden md:block app-resizer" onMouseDown={startResize('left')} title="Resize sidebar" />

                        {!featureFlags.chat ? (
                            <FeatureLockedPanel title="Chat is disabled" message="Chat workspaces and staff member messaging are not enabled for your account." icon="fa-comments" />
                        ) : !activeGroup ? (
                            <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-slate-100 text-center p-8 relative">
                                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm mb-6 text-indigo-500 ring-4 ring-white border border-slate-100">
                                    <i className="fa-solid fa-comments text-4xl"></i>
                                </div>
                                <h2 className="text-2xl font-bold text-slate-800 mb-2">Welcome to Talk & Task</h2>
                                <p className="text-slate-500 mb-8 max-w-md">Select a department or staff member from the sidebar to start collaborating, or create a new workspace.</p>
                                {(currentUserData?.isAdmin || isVipAdmin || currentUserData?.canCreateGroups) && (
                                    <button onClick={() => { setGroupForm({name: "", members: [], admins: [], profilePicUrl: null}); setEditingGroup(null); setActiveModal('group_form_modal'); }} className="w-full max-w-xs bg-indigo-600 text-white px-6 py-3.5 rounded-xl font-bold shadow-sm hover:bg-indigo-700 transition-all">
                                        <i className="fa-solid fa-layer-group mr-2"></i> New Department (Department Name, Members)
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col relative h-full bg-slate-50 dark:bg-slate-950 overflow-hidden min-w-0 chat-main-panel">
                                <div className="bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-2 px-3 md:px-4 py-2 shrink-0 z-30 sticky top-0 border-b border-slate-200 dark:border-slate-700 safe-top">
                                    <button onClick={() => setActiveGroup(null)} className="md:hidden w-10 h-10 rounded-full hover:bg-indigo-50 flex items-center justify-center text-indigo-600 mr-1 shrink-0" title="All departments and staff members"><i className="fa-solid fa-arrow-left text-xl"></i></button>

                                    <div className="flex items-center gap-3 cursor-pointer flex-1 min-w-0" onClick={()=>{ if(!activeGroup.isDM) { setGroupForm({ name: activeGroup.name || '', members: activeGroup.members || [], admins: activeGroup.admins || [], profilePicUrl: activeGroup.profilePicUrl || null }); setActiveModal('group_settings'); } }}>
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

                                    <div className="order-last flex basis-full md:order-none md:basis-auto md:flex-1 max-w-none md:max-w-md md:mx-4 relative" ref={searchWrapperRef}>
                                        <div className="bg-slate-50 rounded-full flex items-center px-4 py-1.5 shadow-inner border border-slate-200 focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-500 transition-all w-full">
                                            <i className="fa-solid fa-search text-[14px] text-indigo-400 mr-2"></i>
                                            <input
                                               type="text"
                                               placeholder="Search messages and tasks..."
                                               className="bg-transparent outline-none flex-1 text-[13px] text-slate-800 placeholder-slate-400 font-medium"
                                               value={searchQuery}
                                               onChange={(e) => setSearchQuery(e.target.value)}
                                               onFocus={() => setIsSearchFocused(true)}
                                            />
                                            {searchQuery && <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600 ml-1"><i className="fa-solid fa-xmark text-xs"></i></button>}
                                        </div>

                                        {isSearchFocused && globalSearchResults && (
                                            <div className="absolute top-[110%] left-0 right-0 md:right-auto w-full md:w-[550px] bg-white rounded-2xl shadow-2xl border border-slate-200 z-[100] max-h-[70vh] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2">
                                                <div className="p-3 bg-indigo-50 border-b border-indigo-100 text-xs font-bold text-indigo-600 uppercase tracking-widest flex justify-between">
                                                    <span>Messages & Tasks Search</span>
                                                    <span>{globalSearchResults.messages.length} Found</span>
                                                </div>
                                                <div className="overflow-y-auto p-2 custom-sidebar-scroll">

                                                    {globalSearchResults.messages.length > 0 && (
                                                        <div className="mb-2">
                                                            <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider"><i className="fa-solid fa-comments mr-1"></i> Messages & Tasks</div>
                                                            {/* 👇 UPDATED: Universal Click Routing routes directly to threads 👇 */}
                                                            {globalSearchResults.messages.map(m => (
                                                                <div key={m.id} onClick={() => { setIsSearchFocused(false); navigateToMessageFromNotification(m.id, m.groupId, m.replyToId); }} className="flex flex-col gap-1 p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-slate-200 mb-1.5">
                                                                    <div className="flex justify-between items-center">
                                                                        <div className="text-[11px] font-extrabold text-indigo-600">{(dbUsers.find(u => u.email === m.senderEmail)?.name || m.senderEmail || 'Unknown').split('@')[0]}</div>
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

                                                    {globalSearchResults.messages.length === 0 && (
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
                                      <div className="relative"><button onClick={() => setShowFilterMenu(v => !v)} className="px-3 h-9 md:h-10 rounded-full flex items-center justify-center transition-colors bg-white border border-slate-200 text-indigo-600 hover:bg-indigo-50 text-[11px] font-black" title="Filter"><i className="fa-solid fa-filter mr-2"></i>Filter <i className="fa-solid fa-chevron-down ml-2 text-[9px]"></i></button>{showFilterMenu && (<div className="absolute top-full right-0 mt-2 w-60 bg-white rounded-2xl shadow-2xl border border-slate-200 z-[140] p-2">{universalTaskFilters.map((f) => (<button key={f.key} onClick={() => { setChatFilter(f.key); setShowFilterMenu(false); if (f.key === 'date-range' && !chatDateFilter) setChatDateFilter(new Date().toISOString().split('T')[0]); }} className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold ${chatFilter === f.key ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}><i className={`fa-solid ${f.icon} w-4 mr-2`}></i>{f.label}</button>))}{chatFilter === 'date-range' && <input type="date" value={chatDateFilter} onChange={(e) => setChatDateFilter(e.target.value)} className="modern-date-input mt-2" />}</div>)}</div>
                                      <button onClick={() => setViewMode('advanced')} className="px-3 h-9 md:h-10 rounded-full flex items-center justify-center transition-colors bg-indigo-50 text-indigo-600 hover:bg-indigo-100 text-[11px] font-black" title="Advanced Search"><i className="fa-solid fa-magnifying-glass-chart md:mr-2"></i><span className="hidden md:inline">Advanced Search</span></button>

                                      <button onClick={() => setActiveModal('active_schedules')} className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-colors text-indigo-500 hover:bg-indigo-50`} title="Scheduled & Reminders">
                                        <i className="fa-solid fa-calendar-alt"></i>
                                      </button>

                                      <div className="relative">
                                        <button onClick={() => setShowNotifications(!showNotifications)} className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-colors ${showNotifications ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300' : totalNotifications > 0 ? 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10' : 'text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10'} ${alertPulseActive ? 'animate-pulse ring-2 ring-rose-300 bg-rose-50 dark:bg-rose-500/10' : ''} text-[19px] relative`}>
                                          <i className="fa-solid fa-bell"></i>
                                          {totalNotifications > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border border-white dark:border-slate-900"></span>}
                                        </button>

                                        {showNotifications && (
                                          <div className="absolute top-full right-0 mt-2 w-80 max-w-[90vw] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl z-[130] overflow-hidden animate-in slide-in-from-top-2 border border-slate-200 dark:border-slate-700">
                                            <div className="p-3 bg-white dark:bg-slate-900 flex justify-between items-center border-b border-slate-200 dark:border-slate-700">
                                              <span className="text-[13px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide">Alerts</span>
                                              <button onClick={() => genericNotifications.map(n => deleteDoc(doc(db, "organizations", orgId, "notifications", n.id)))} className="text-[11px] text-indigo-600 font-bold hover:underline">Clear All</button>
                                            </div>
                                            <div className="max-h-[70vh] overflow-y-auto bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600">
                                              {totalNotifications === 0 ? <div className="p-5 text-center text-[13px] font-medium text-slate-400">No new activity</div> : (
                                                <>
                                                  {[...activeActionableTasks].sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0)).map(task => (
                                                    <div key={task.id} onClick={() => { setShowNotifications(false); navigateToMessageFromNotification(task.id, task.groupId); }} className="p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 text-[12px] text-slate-700 dark:text-slate-200">
                                                      <div className="font-black text-rose-600">Pending Task</div>
                                                      <div className="line-clamp-2">{stripHtml(task.text)}</div><div className="text-[10px] text-slate-400 font-bold mt-1">{formatNotificationTime(task.timestamp)}</div>
                                                      <button onClick={(e)=>{ e.stopPropagation(); updateDoc(doc(db, "organizations", orgId, "messages", task.id), { 'taskData.dismissedBy': [...(task.taskData?.dismissedBy || []), user.uid] }); }} className="mt-1 text-[10px] font-bold text-slate-400 hover:text-rose-500">Clear</button>
                                                    </div>
                                                  ))}
                                                  {[...genericNotifications].sort((a,b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0)).map(n => (
                                                    <div key={n.id} onClick={() => { setShowNotifications(false); if (n.messageId) navigateToMessageFromNotification(n.messageId, n.groupId || activeGroup?.id); }} className="p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 text-[12px] text-slate-700 dark:text-slate-200 relative pr-12">
                                                      <button onClick={(e) => { e.stopPropagation(); deleteDoc(doc(db, "organizations", orgId, "notifications", n.id)); }} className="absolute top-2 right-3 text-[10px] font-bold text-slate-400 hover:text-rose-500">Clear</button>
                                                      <div className="font-black text-indigo-600">{n.type === 'reply' ? 'Reply' : n.type === 'message' ? 'Message' : n.type === 'mention' ? 'Mention' : n.type === 'reminder' ? 'Reminder' : n.type === 'task' ? 'Task' : 'Alert'}</div>
                                                      <div className="line-clamp-2">{stripHtml(n.text)}</div><div className="text-[10px] text-slate-400 font-bold mt-1">{formatNotificationTime(n.timestamp)}</div><select onClick={(e) => e.stopPropagation()} onChange={(e) => { if (!e.target.value) return; updateDoc(doc(db, "organizations", orgId, "notifications", n.id), { snoozeUntil: Timestamp.fromDate(getSnoozeDate(e.target.value)) }); e.target.value=''; }} className="mt-2 text-[10px] border border-slate-200 dark:border-slate-700 rounded px-1 py-0.5 bg-white dark:bg-slate-950 dark:text-slate-100"><option value="">Snooze</option><option value="15m">15 min</option><option value="1h">1 hour</option><option value="5pm">Until 5:00 PM</option></select>
                                                    </div>
                                                  ))}
                                                </>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </div>

                                      {(effectiveCurrentUserData?.isAdmin || effectiveIsVipAdmin) && <button onClick={handleWipeAllTasks} className="ml-2 bg-rose-50 text-rose-600 border border-rose-200 px-2 py-1 rounded text-[10px] font-bold hover:bg-rose-100 uppercase tracking-wider">Wipe DB</button>}

                                    </div>
                                </div>

                                <div className="hidden">
                                  {universalTaskFilters.map((f) => (
                                    <button
                                      key={f.key}
                                      onClick={() => { setChatFilter(f.key); if (f.key === 'date-range' && !chatDateFilter) setChatDateFilter(new Date().toISOString().split('T')[0]); }}
                                      className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all hover:-translate-y-0.5 hover:shadow-sm ${chatFilter === f.key ? 'border-indigo-200 bg-indigo-50 text-indigo-700 shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-600'}`}
                                      title={`Show ${f.label.toLowerCase()}`}
                                    >
                                      <i className={`fa-solid ${f.icon} text-[10px]`}></i>{f.label}
                                    </button>
                                  ))}
                                  {chatFilter === 'date-range' && (
                                    <input type="date" value={chatDateFilter} onChange={(e) => setChatDateFilter(e.target.value)} className="modern-date-input !w-auto !py-1.5 !text-[11px]" />
                                  )}
                                </div>

                                <button onClick={() => chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' })} className="fixed bottom-24 right-4 md:right-6 z-40 bg-indigo-600 text-white w-10 h-10 flex items-center justify-center rounded-full shadow-lg hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400 transition-all opacity-90 hover:opacity-100" title="Scroll to Bottom">
                                    <i className="fa-solid fa-arrow-down"></i>
                                </button>

                                <button onClick={() => chatContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })} className="fixed bottom-36 right-4 md:right-6 z-40 bg-indigo-600 text-white w-10 h-10 flex items-center justify-center rounded-full shadow-lg hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400 transition-all opacity-90 hover:opacity-100" title="Scroll to Top">
                                    <i className="fa-solid fa-arrow-up"></i>
                                </button>

                                <ChatView
                                    messagesToRender={messagesToRender} messages={messages} activeGroup={activeGroup} user={user} currentUserData={effectiveCurrentUserData}
                                    isVipAdmin={effectiveIsVipAdmin} pinnedMessages={pinnedMessages} typingStatus={typingStatus} replyingTo={replyingTo} setReplyingTo={setReplyingTo}
                                    toolPreferences={toolPreferences} dbUsers={dbUsers} groups={groups} setActiveGroup={setActiveGroup} setShowRightSidebar={setShowRightSidebar}
                                    setMobileSidebarOpen={setMobileSidebarOpen} pendingScrollTarget={pendingScrollTarget} setPendingScrollTarget={setPendingScrollTarget}
                                    setActiveModal={setActiveModal} scrollToMessageDirect={scrollToMessageDirect} handleReaction={handleReactionIntercept}
                                    handleToggleBookmark={(m) => toggleBookmarkDB(m.id, m.bookmarkedBy)} handleTogglePin={(m) => togglePinDB(m.id, m.isPinned)} handleDeleteMessage={deleteMessageDB}
                                    chatInputRef={chatInputRef} editingMessageId={editingMessageId} editMessageText={editMessageText} setEditingMessageId={setEditingMessageId}
                                    setEditMessageText={setEditMessageText} handleSaveEdit={handleSaveEdit} setSelectedMessage={setSelectedMessage}
                                    setIsEditingTaskTitle={setIsEditingTaskTitle} messagesEndRef={messagesEndRef} chatContainerRef={chatContainerRef}
                                    isAtBottom={isAtBottom} setIsAtBottom={setIsAtBottom} highlightedMsgId={highlightedMsgId} unreadHighlightIds={unreadHighlightIds}
                                    handleAddInlineComment={handleAddInlineComment} jumpToPrivateSource={(msgId, groupId) => navigateToMessageFromNotification(msgId, groupId)}
                                    customTags={customTags} setActiveReplies={setActiveReplies}
                                    setActiveTaskSidebar={setActiveTaskSidebar}
                                    featureFlags={featureFlags}
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
                                        await uploadAndSendFileDB(pf, setUploadProgress);
                                    }}
                                    setActiveModal={setActiveModal}
                                    setPendingScheduledText={setPendingScheduledText} offlineDrafts={offlineDrafts} user={user} dbUsers={dbUsers}
                                    groups={groups} currentUserData={effectiveCurrentUserData} MAX_FILE_SIZE_MB={MAX_FILE_SIZE_MB} uploadProgress={uploadProgress} handleSendPendingFiles={handleSendPendingFiles}
                                />
                            </div>
                        )}

                        {false && activeTaskSidebar ? (
                          <>
                            <div className="hidden md:block app-resizer" onMouseDown={startResize('right')} title="Resize task sidebar" />
                            <TaskSidebar
                                activeTask={activeTaskSidebar} setActiveTask={setActiveTaskSidebar} messages={messages} user={user}
                                currentUserData={effectiveCurrentUserData} dbUsers={dbUsers} groups={groups} activeGroup={activeGroup} isVipAdmin={effectiveIsVipAdmin} handleReactionIntercept={handleReactionIntercept}
                                deleteMessageDB={deleteMessageDB} setActiveModal={setActiveModal} handleToggleBookmark={(m) => toggleBookmarkDB(m.id, m.bookmarkedBy)} handleTogglePin={(m) => togglePinDB(m.id, m.isPinned)} customTags={customTags}
                                toolPreferences={toolPreferences} setReplyingTo={setReplyingTo} setSelectedMessage={setSelectedMessage} chatInputRef={chatInputRef} sidebarWidth={rightWidth}
                            />
                          </>
                        ) : false && activeReplies ? (
                          <>
                            <div className="hidden md:block app-resizer" onMouseDown={startResize('right')} title="Resize replies sidebar" />
                            <RepliesSidebar
                                activeReplies={activeReplies} setActiveReplies={setActiveReplies} messages={messages} user={user}
                                currentUserData={effectiveCurrentUserData} dbUsers={dbUsers} groups={groups} activeGroup={activeGroup} isVipAdmin={effectiveIsVipAdmin} handleReactionIntercept={handleReactionIntercept}
                                deleteMessageDB={deleteMessageDB} setActiveModal={setActiveModal} sendMessageToDB={sendMessageToDB} handleToggleBookmark={(m) => toggleBookmarkDB(m.id, m.bookmarkedBy)} handleTogglePin={(m) => togglePinDB(m.id, m.isPinned)} customTags={customTags}
                                toolPreferences={toolPreferences} setReplyingTo={setReplyingTo} setSelectedMessage={setSelectedMessage} chatInputRef={chatInputRef} sidebarWidth={rightWidth}
                            />
                          </>
                        ) : featureFlags.advancedAnalytics ? (
                          <>
                            <div className="hidden md:block app-resizer" onMouseDown={startResize('right')} title="Resize analytics sidebar" />
                            <RightSidebar
                              sidebarWidth={rightWidth}
                              showRightSidebar={showRightSidebar} setShowRightSidebar={setShowRightSidebar} tasksAssignedToMe={tasksAssignedToMe}
                              tasksAssignedByMe={tasksAssignedByMe} groups={groups} dbUsers={dbUsers} user={user} setActiveGroup={setActiveGroup}
                              navigateToMessageFromNotification={scrollToTaskInMainChat} archivedTasks={[]} messages={messages} currentUserData={effectiveCurrentUserData} appVersion={appVersion}
                            />
                          </>
                        ) : null}
                        <ModalManager {...modalProps} />
                        <Toast toasts={toasts} removeToast={removeToast} />
                    </div>
                )}
            </div>
        </div>
    );
}
