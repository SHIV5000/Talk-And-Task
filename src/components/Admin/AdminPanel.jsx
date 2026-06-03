import React, { useState, useMemo, useEffect } from 'react';
import MemoizedAvatar from '../Common/MemoizedAvatar.jsx';
import StorageDashboard from '../DeveloperConsole/Storage/StorageDashboard.jsx';
import { db } from '../../firebase.js';
import {
  collection, addDoc, serverTimestamp, updateDoc, doc,
  deleteDoc, setDoc, onSnapshot, query, orderBy, getDocs, where,
} from 'firebase/firestore';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { hasPermission } from '../../utils/rbac.js';
import VersionManager from '../DeveloperConsole/Version/VersionManager.jsx';

// Utility to strip HTML
const stripHtml = (html) =>
  html ? String(html).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ') : '';


const SYSTEM_ROLES = ['Super Admin', 'Auditor', 'Group Moderator'];
const PERMISSION_AREAS = ['Users', 'Tasks', 'Messages', 'Logs', 'Settings', 'Backups', 'Integrations', 'Compliance'];
const PERMISSION_ACTIONS = ['read', 'create', 'update', 'delete'];

const makePermissionGrid = (enabled = false) => PERMISSION_AREAS.reduce((acc, area) => {
  acc[area] = PERMISSION_ACTIONS.reduce((row, action) => ({ ...row, [action]: enabled }), {});
  return acc;
}, {});

const DEFAULT_ROLES = [
  { id: 'super-admin', name: 'Super Admin', system: true, permissions: makePermissionGrid(true) },
  { id: 'auditor', name: 'Auditor', system: true, permissions: { ...makePermissionGrid(false), Logs: { read: true, create: false, update: false, delete: false }, Compliance: { read: true, create: false, update: false, delete: false } } },
  { id: 'group-moderator', name: 'Group Moderator', system: true, permissions: { ...makePermissionGrid(false), Users: { read: true, create: false, update: false, delete: false }, Tasks: { read: true, create: true, update: true, delete: false }, Messages: { read: true, create: true, update: true, delete: false } } },
];

const formatDateTime = (value) => {
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : '—';
};

const toDateInput = (value) => (value?.toDate ? value.toDate() : value ? new Date(value) : new Date()).toISOString().split('T')[0];

const downloadTextFile = (filename, content, type = 'application/json') => {
  const blob = new Blob([content], { type });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
};

const tagThemes = {
  teal: { bg: 'bg-teal-50', text: 'text-teal-700' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-700' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700' },
  slate: { bg: 'bg-slate-100', text: 'text-slate-600' },
};

export default function AdminPanel({
  setViewMode,
  setActiveModal,
  dbUsers,
  groups,
  filteredAuditLogs,
  adminFilterUser,
  setAdminFilterUser,
  adminFilterDate,
  setAdminFilterDate,
  adminFilterType,
  setAdminFilterType,
  adminFilterGroup,
  setAdminFilterGroup,
  handleToggleApprove,
  handleToggleAdmin,
  handleToggleCanCreateGroups,
  setSelectedMessage,
  setIsEditingTaskTitle,
  messages,
  setGroupForm,
  setEditingGroup,
  editingGroup,
  groupForm,
  handleGroupSubmit,
  handleGroupPicUpload,
  groupPicUploadProgress,
  customTags,
  globalAnnouncement,
  currentUserData,
  isVipAdmin,
  maxFileSizeMb,
  setMaxFileSizeMb,
  appVersion,
}) {
  // ===== TABS =====
  const [activeTab, setActiveTab] = useState('overview');
  const [limitDraft, setLimitDraft] = useState(maxFileSizeMb || 5);

  // ----- Overview time range -----
  const [overviewTimeRange, setOverviewTimeRange] = useState('week');

  // ----- People (Users + Groups) -----
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserApprove, setNewUserApprove] = useState(true);
  const [newUserTempPassword, setNewUserTempPassword] = useState('');
  const [selectedUsers, setSelectedUsers] = useState(new Set());

  // ----- Tasks table -----
  const [taskStatusFilter, setTaskStatusFilter] = useState('All');
  const [taskGroupFilter, setTaskGroupFilter] = useState('');
  const [taskSearch, setTaskSearch] = useState('');
  const [expandedTasks, setExpandedTasks] = useState(new Set());
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskStatus, setEditTaskStatus] = useState('');
  const [editTaskPriority, setEditTaskPriority] = useState('');
  const [editTaskDeadline, setEditTaskDeadline] = useState('');
  const [editTaskAssignees, setEditTaskAssignees] = useState([]);

  // ----- Logs (Universal) -----
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [selectedLogs, setSelectedLogs] = useState(new Set());

  // ----- Broadcast -----
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastType, setBroadcastType] = useState('info');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [allAcks, setAllAcks] = useState([]);
  const [selectedBroadcastId, setSelectedBroadcastId] = useState(null);
  const [pastBroadcasts, setPastBroadcasts] = useState([]);
  const [broadcastSearch, setBroadcastSearch] = useState('');

  // ----- Tags -----
  const [newTagLabel, setNewTagLabel] = useState('');
  const [newTagTheme, setNewTagTheme] = useState('teal');
  const [editingTagId, setEditingTagId] = useState(null);
  const [editTagLabel, setEditTagLabel] = useState('');
  const [editTagTheme, setEditTagTheme] = useState('teal');

  // ----- Organization -----
  const [orgDetails, setOrgDetails] = useState({
    orgName: '',
    address: '',
    email: '',
    phone: '',
    adminName: '',
    adminDesignation: '',
    adminEmail: '',
    adminMobile: '',
    subscriptionType: 'Free',
    activeUsersCount: 0,
  });
  const [isOrgSaved, setIsOrgSaved] = useState(false);


  // ----- Enterprise Admin Workspace -----
  const [sessions, setSessions] = useState([]);
  const [roles, setRoles] = useState(DEFAULT_ROLES);
  const [selectedRoleId, setSelectedRoleId] = useState('super-admin');
  const [showRoleMatrix, setShowRoleMatrix] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [retentionPolicies, setRetentionPolicies] = useState([]);
  const [retentionRuns, setRetentionRuns] = useState([]);
  const [newRetentionPolicy, setNewRetentionPolicy] = useState({ category: 'Chat Messages', ttlDays: 30, action: 'archive', isActive: true });
  const [exportsHistory, setExportsHistory] = useState([]);
  const [storageIndex, setStorageIndex] = useState([]);
  const [dsarForm, setDsarForm] = useState({ uid: '', startDate: '', endDate: '', mode: 'access' });
  const [adminSettings, setAdminSettings] = useState({ institutionName: '', pointOfContactEmail: '', fileUploadSizeMb: maxFileSizeMb || 5 });

  // ===== REAL-TIME LISTENERS =====
  // Organization doc
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'workspace', 'org_details'), (docSnap) => {
      if (docSnap.exists()) {
        setOrgDetails(docSnap.data());
        setIsOrgSaved(true); // assume saved if data exists
      }
    });
    return () => unsub();
  }, []);



  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, 'sessions'), (snap) => setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.lastActivity?.toMillis?.() || 0) - (a.lastActivity?.toMillis?.() || 0)))),
      onSnapshot(collection(db, 'roles'), (snap) => {
        const stored = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const merged = [...DEFAULT_ROLES.filter((role) => !stored.some((s) => s.id === role.id || s.name === role.name)), ...stored];
        setRoles(merged);
      }),
      onSnapshot(collection(db, 'retentionPolicies'), (snap) => setRetentionPolicies(snap.docs.map((d) => ({ id: d.id, ...d.data() })))),
      onSnapshot(query(collection(db, 'retention_cleanup_logs'), orderBy('timestamp', 'desc')), (snap) => setRetentionRuns(snap.docs.map((d) => ({ id: d.id, ...d.data() })))),
      onSnapshot(query(collection(db, 'exports'), orderBy('timestamp', 'desc')), (snap) => setExportsHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() })))),
      onSnapshot(doc(db, 'settings', 'institution'), (snap) => {
        if (snap.exists()) setAdminSettings((prev) => ({ ...prev, ...snap.data() }));
      }),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, []);

  useEffect(() => {
    DEFAULT_ROLES.forEach((role) => {
      setDoc(doc(db, 'roles', role.id), { ...role, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
    });
  }, []);

  // Broadcast acks (for live & historical)
  useEffect(() => {
    if (activeTab === 'broadcast') {
      const unsubAcks = onSnapshot(collection(db, 'broadcast_acks'), (snap) => {
        const acks = snap.docs.map((d) => d.data());
        acks.sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
        setAllAcks(acks);
      });
      // Past broadcasts stored in a subcollection for history
      const q = query(collection(db, 'broadcasts'), orderBy('timestamp', 'desc'));
      const unsubPast = onSnapshot(q, (snap) => {
        setPastBroadcasts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      });
      return () => {
        unsubAcks();
        unsubPast();
      };
    }
  }, [activeTab]);

  // Derived broadcast data
  const uniqueBroadcastIds = useMemo(
    () => [...new Set((allAcks || []).map((a) => a.broadcastId))],
    [allAcks]
  );

  const displayedAcks = useMemo(() => {
    if (globalAnnouncement?.isActive)
      return (allAcks || []).filter((a) => a.broadcastId === globalAnnouncement.id);
    if (selectedBroadcastId)
      return (allAcks || []).filter((a) => a.broadcastId === selectedBroadcastId);
    return [];
  }, [allAcks, globalAnnouncement?.isActive, globalAnnouncement?.id, selectedBroadcastId]);

  // Filtered past broadcasts
  const filteredPastBroadcasts = useMemo(() => {
    if (!broadcastSearch.trim()) return pastBroadcasts;
    const q = broadcastSearch.toLowerCase();
    return pastBroadcasts.filter(
      (b) => (b.message || '').toLowerCase().includes(q) || (b.type || '').toLowerCase().includes(q)
    );
  }, [pastBroadcasts, broadcastSearch]);

  // ===== COMPUTED DATA =====
  const filteredUsers = useMemo(() => dbUsers || [], [dbUsers]);

  const allTasks = useMemo(() => (messages || []).filter((m) => m.isTask), [messages]);

  const filteredTasks = useMemo(() => {
    let tasks = [...allTasks];
    if (taskStatusFilter !== 'All')
      tasks = tasks.filter((t) => t.taskData?.status === taskStatusFilter);
    if (taskGroupFilter)
      tasks = tasks.filter((t) => t.groupId === taskGroupFilter);
    if (taskSearch.trim()) {
      const q = taskSearch.toLowerCase();
      tasks = tasks.filter(
        (t) =>
          (t.text || '').toLowerCase().includes(q) ||
          (t.taskData?.assignees || []).some((a) => (a || '').toLowerCase().includes(q))
      );
    }
    return tasks;
  }, [allTasks, taskStatusFilter, taskGroupFilter, taskSearch]);

  const universalLogs = useMemo(() => {
    let logs = [...(filteredAuditLogs || [])];
    if (logSearchQuery.trim()) {
      const q = logSearchQuery.toLowerCase();
      logs = logs.filter((l) => {
        const userName = ((dbUsers || []).find((u) => u.email === l.user)?.name || '').toLowerCase();
        const content = (l.content || '').toLowerCase();
        const type = (l.type || '').toLowerCase();
        return userName.includes(q) || content.includes(q) || type.includes(q);
      });
    }
    return logs.sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
  }, [filteredAuditLogs, logSearchQuery, dbUsers]);

  const overviewMetrics = useMemo(() => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const cutoff =
      overviewTimeRange === 'today'
        ? now - day
        : overviewTimeRange === 'week'
        ? now - 7 * day
        : now - 30 * day;
    const recentMsgs = (messages || []).filter((m) => (m.timestamp?.toMillis?.() || 0) >= cutoff);
    const recentTasks = recentMsgs.filter((m) => m.isTask);
    const overdueTasks = allTasks.filter(
      (t) => t.taskData?.status !== 'Completed' && new Date(t.taskData?.deadline) < new Date()
    );
    return {
      totalMessages: recentMsgs.length,
      activeTasks: recentTasks.filter((t) => t.taskData?.status !== 'Completed').length,
      completedTasks: recentTasks.filter((t) => t.taskData?.status === 'Completed').length,
      totalUsers: (dbUsers || []).length,
      activeSessionsToday: sessions.filter((session) => session.lastActivity?.toMillis?.() >= now - day).length,
      activeUsers: (dbUsers || []).filter((u) => u.lastActive?.toMillis?.() >= cutoff).length,
      upcomingBackupStatus: exportsHistory[0]?.status || 'Not scheduled',
      nextRetentionRun: retentionPolicies.some((policy) => policy.isActive) ? 'Daily 02:00 UTC' : 'No active policies',
      pendingApprovals: (dbUsers || []).filter((u) => !u.isApproved).length,
      overdueTasks: overdueTasks.length,
      newestUser: [...(dbUsers || [])].sort(
        (a, b) => (b.lastActive?.toMillis?.() || 0) - (a.lastActive?.toMillis?.() || 0)
      )[0],
    };
  }, [messages, dbUsers, overviewTimeRange, allTasks, sessions, exportsHistory, retentionPolicies]);

  const recentAuditFeed = useMemo(
    () =>
      (filteredAuditLogs || []).slice(0, 20).map((log) => ({
        ...log,
        userName: (dbUsers || []).find((u) => u.email === log.user)?.name || 'System',
      })),
    [filteredAuditLogs, dbUsers]
  );

  const criticalAuditFeed = useMemo(() => {
    const criticalTypes = ['FORCE_LOGOUT', 'FORCE_LOGOUT_ALL', 'ROLE_CREATE', 'ROLE_UPDATE', 'ROLE_DELETE', 'USER_ROLE_UPDATE', 'DSAR_EXPORT', 'DSAR_DELETE', 'RETENTION_POLICY_UPDATE', 'RETENTION_RUN', 'BACKUP_EXPORT', 'API_KEY_CREATE', 'API_KEY_REVOKE'];
    return (filteredAuditLogs || []).filter((log) => criticalTypes.includes(log.type)).slice(0, 20);
  }, [filteredAuditLogs]);

  const selectedRole = useMemo(() => roles.find((role) => role.id === selectedRoleId) || roles[0] || DEFAULT_ROLES[0], [roles, selectedRoleId]);
  const selectedDsarUser = useMemo(() => dbUsers.find((u) => u.uid === dsarForm.uid), [dbUsers, dsarForm.uid]);
  const canRunBackups = hasPermission(currentUserData, roles, 'Backups', 'create');
  const canRunCompliance = hasPermission(currentUserData, roles, 'Compliance', 'create');

  // ===== FUNCTIONS =====

  const logAuditEvent = async (type, target = '', details = {}) => {
    await addDoc(collection(db, 'audit_logs'), {
      type,
      user: currentUserData?.email || currentUserData?.uid || 'admin',
      adminId: currentUserData?.uid || currentUserData?.email || 'admin',
      content: `${type}: ${target}`,
      target,
      details,
      immutableId: `${type}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      timestamp: serverTimestamp(),
    }).catch(() => {});
  };

  const updateRolePermission = async (role, area, action, checked) => {
    const permissions = { ...(role.permissions || makePermissionGrid(false)) };
    permissions[area] = { ...(permissions[area] || {}), [action]: checked };
    await setDoc(doc(db, 'roles', role.id), { ...role, permissions, updatedAt: serverTimestamp() }, { merge: true });
    await logAuditEvent('ROLE_UPDATE', role.id, { role: role.name, area, action, checked });
  };

  const createRole = async () => {
    const name = newRoleName.trim();
    if (!name) return alert('Enter a role name.');
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `role-${Date.now()}`;
    await setDoc(doc(db, 'roles', id), { id, name, system: false, permissions: makePermissionGrid(false), createdAt: serverTimestamp() });
    await logAuditEvent('ROLE_CREATE', id, { name });
    setNewRoleName('');
    setSelectedRoleId(id);
  };

  const deleteRole = async (role) => {
    if (role.system || SYSTEM_ROLES.includes(role.name)) return alert('System roles cannot be deleted.');
    if (!window.confirm(`Delete role ${role.name}?`)) return;
    await deleteDoc(doc(db, 'roles', role.id));
    await logAuditEvent('ROLE_DELETE', role.id, { name: role.name });
    setSelectedRoleId('super-admin');
  };

  const updateUserRoles = async (userRecord, roleName, checked) => {
    const nextRoles = checked ? [...new Set([...(userRecord.roles || []), roleName])] : (userRecord.roles || []).filter((role) => role !== roleName);
    await updateDoc(doc(db, 'users', userRecord.uid), { roles: nextRoles });
    await logAuditEvent('USER_ROLE_UPDATE', userRecord.uid, { email: userRecord.email, roles: nextRoles });
  };

  const forceLogoutSession = async (session) => {
    if (!window.confirm(`Force logout ${session.email || session.uid}?`)) return;
    await deleteDoc(doc(db, 'sessions', session.id));
    await logAuditEvent('FORCE_LOGOUT', session.id, { affectedUid: session.uid, email: session.email, ip: session.ip });
  };

  const forceLogoutAll = async () => {
    if (!window.confirm('This will immediately sign out every user across all devices. Are you sure?')) return;
    await Promise.all(sessions.map((session) => deleteDoc(doc(db, 'sessions', session.id))));
    await logAuditEvent('FORCE_LOGOUT_ALL', 'all-sessions', { affectedUsers: sessions.map((s) => s.uid), count: sessions.length });
  };

  const saveRetentionPolicy = async () => {
    const payload = { ...newRetentionPolicy, ttlDays: Number(newRetentionPolicy.ttlDays), category: 'Chat Messages', updatedAt: serverTimestamp(), exemptTasks: true, exemptAuditLogs: true };
    await addDoc(collection(db, 'retentionPolicies'), payload);
    await logAuditEvent('RETENTION_POLICY_UPDATE', 'Chat Messages', payload);
  };

  const updateRetentionPolicy = async (policy, updates) => {
    await updateDoc(doc(db, 'retentionPolicies', policy.id), { ...updates, updatedAt: serverTimestamp() });
    await logAuditEvent('RETENTION_POLICY_UPDATE', policy.id, updates);
  };

  const runCleanupNow = async (policy) => {
    const threshold = Date.now() - Number(policy.ttlDays || 30) * 24 * 60 * 60 * 1000;
    const oldMessages = (messages || []).filter((m) => !m.isTask && (m.timestamp?.toMillis?.() || Date.now()) < threshold).slice(0, 500);
    const runRef = await addDoc(collection(db, 'retention_cleanup_logs'), { ruleId: policy.id, ruleName: policy.category, timestamp: serverTimestamp(), status: 'running', affected: 0 });
    for (const msg of oldMessages) {
      if (policy.action === 'archive') await setDoc(doc(db, 'archived_messages', msg.id), { ...msg, archivedAt: serverTimestamp() });
      await deleteDoc(doc(db, 'messages', msg.id));
    }
    await updateDoc(doc(db, 'retention_cleanup_logs', runRef.id), { status: 'completed', affected: oldMessages.length });
    await logAuditEvent('RETENTION_RUN', policy.id, { affected: oldMessages.length, action: policy.action, ttlDays: policy.ttlDays });
  };

  const exportFullDatabase = async () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      requestedBy: currentUserData?.email || 'admin',
      collections: { users: dbUsers, groups, messages, auditLogs: filteredAuditLogs, settings: adminSettings },
    };
    const fileName = `talk-task-export-${Date.now()}.json`;
    await addDoc(collection(db, 'exports'), { fileName, size: JSON.stringify(payload).length, timestamp: serverTimestamp(), status: 'ready', downloadUrl: 'Generated in browser download' });
    await logAuditEvent('BACKUP_EXPORT', fileName, { collections: Object.keys(payload.collections) });
    downloadTextFile(fileName, JSON.stringify(payload, null, 2));
  };

  const buildStorageIndex = () => {
    const files = [];
    dbUsers.forEach((u) => { if (u.profilePicUrl) files.push({ name: `${u.name || u.email} avatar`, path: `users/${u.uid}/profilePicUrl`, url: u.profilePicUrl }); });
    groups.forEach((g) => { if (g.profilePicUrl) files.push({ name: `${g.name} avatar`, path: `groups/${g.id}/profilePicUrl`, url: g.profilePicUrl }); });
    messages.forEach((m) => { if (m.fileUrl) files.push({ name: m.fileName || 'attachment', path: `messages/${m.id}/fileUrl`, url: m.fileUrl }); });
    setStorageIndex(files);
  };

  const generateDsarReport = async () => {
    if (!selectedDsarUser) return alert('Select a user first.');
    const start = dsarForm.startDate ? new Date(`${dsarForm.startDate}T00:00:00`).getTime() : 0;
    const end = dsarForm.endDate ? new Date(`${dsarForm.endDate}T23:59:59`).getTime() : Number.MAX_SAFE_INTEGER;
    const inRange = (ts) => { const ms = ts?.toMillis?.() || 0; return ms >= start && ms <= end; };
    const userMessages = messages.filter((m) => (m.senderUid === selectedDsarUser.uid || m.senderEmail === selectedDsarUser.email) && inRange(m.timestamp));
    const userTasks = messages.filter((m) => m.isTask && (m.senderEmail === selectedDsarUser.email || (m.taskData?.assignees || []).includes(selectedDsarUser.email)) && inRange(m.timestamp));
    const userLogs = filteredAuditLogs.filter((l) => (l.adminId === selectedDsarUser.uid || l.user === selectedDsarUser.email) && inRange(l.timestamp));
    const report = { metadata: { generatedAt: new Date().toISOString(), requestedBy: currentUserData?.email || 'admin', user: selectedDsarUser.email, dateRange: { start: dsarForm.startDate, end: dsarForm.endDate }, totalRecords: userMessages.length + userTasks.length + userLogs.length }, profile: selectedDsarUser, messages: userMessages, tasks: userTasks, auditLogs: userLogs, sessions: sessions.filter((s) => s.uid === selectedDsarUser.uid) };
    await logAuditEvent('DSAR_EXPORT', selectedDsarUser.uid, report.metadata);
    downloadTextFile(`dsar-${selectedDsarUser.uid}-${Date.now()}.json`, JSON.stringify(report, null, 2));
  };

  const executeHardDelete = async () => {
    if (!selectedDsarUser) return alert('Select a user first.');
    const code = `DELETE ${selectedDsarUser.email}`;
    if (window.prompt(`This permanently anonymises personal data for ${selectedDsarUser.name || selectedDsarUser.email}. Type: ${code}`) !== code) return;
    await updateDoc(doc(db, 'users', selectedDsarUser.uid), { name: 'Deleted User', emailHash: btoa(selectedDsarUser.email || selectedDsarUser.uid), email: '', isArchived: true, profilePicUrl: null });
    await Promise.all(messages.filter((m) => m.senderUid === selectedDsarUser.uid || m.senderEmail === selectedDsarUser.email).map((m) => updateDoc(doc(db, 'messages', m.id), { senderEmail: 'deleted-user', senderUid: 'deleted-user', text: m.isTask ? m.text : '[deleted]' }).catch(() => {})));
    await Promise.all(sessions.filter((s) => s.uid === selectedDsarUser.uid).map((s) => deleteDoc(doc(db, 'sessions', s.id))));
    await logAuditEvent('DSAR_DELETE', selectedDsarUser.uid, { confirmationCode: code });
  };

  const saveInstitutionSettings = async () => {
    const payload = { ...adminSettings, fileUploadSizeMb: Number(adminSettings.fileUploadSizeMb || maxFileSizeMb || 5), activeUsersCount: dbUsers.length, updatedAt: serverTimestamp() };
    await setDoc(doc(db, 'settings', 'institution'), payload, { merge: true });
    if (setMaxFileSizeMb) setMaxFileSizeMb(payload.fileUploadSizeMb);
    localStorage.setItem('maxFileSizeMb', String(payload.fileUploadSizeMb));
    await logAuditEvent('SETTINGS_UPDATE', 'institution', payload);
  };

  // --- Tasks ---
  const toggleTaskExpand = (id) => {
    const newSet = new Set(expandedTasks);
    newSet.has(id) ? newSet.delete(id) : newSet.add(id);
    setExpandedTasks(newSet);
  };

  const startEditTask = (task) => {
    setEditingTaskId(task.id);
    setEditTaskTitle(stripHtml(task.text || ''));
    setEditTaskStatus(task.taskData?.status || 'Pending');
    setEditTaskPriority(task.taskData?.priority || 'Medium');
    setEditTaskDeadline(task.taskData?.deadline || '');
    setEditTaskAssignees([...(task.taskData?.assignees || [])]);
  };

  const saveTaskEdit = async (taskId) => {
    const updates = {};
    updates.text = editTaskTitle;
    updates['taskData.status'] = editTaskStatus;
    updates['taskData.priority'] = editTaskPriority;
    updates['taskData.deadline'] = editTaskDeadline;
    updates['taskData.assignees'] = editTaskAssignees;
    await updateDoc(doc(db, 'messages', taskId), updates);
    setEditingTaskId(null);
  };

  const cancelEdit = () => setEditingTaskId(null);

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Delete this task permanently?')) return;
    await deleteDoc(doc(db, 'messages', taskId));
  };

  // --- People (Users) ---
  const toggleSelectAllUsers = () => {
    if (selectedUsers.size === filteredUsers.length) setSelectedUsers(new Set());
    else setSelectedUsers(new Set(filteredUsers.map((u) => u.uid)));
  };
  const toggleSelectUser = (uid) => {
    const s = new Set(selectedUsers);
    s.has(uid) ? s.delete(uid) : s.add(uid);
    setSelectedUsers(s);
  };

  const handleAddUser = async () => {
    if (!newUserEmail || !newUserName) return alert('Please enter email and name.');
    await addDoc(collection(db, 'users'), {
      uid: `manual_${Date.now()}`,
      email: newUserEmail,
      name: newUserName,
      isApproved: newUserApprove,
      isAdmin: false,
      canCreateGroups: false,
      isArchived: false,
      roles: [],
      tempPasswordSet: !!newUserTempPassword,
      lastActive: serverTimestamp(),
      toolPreferences: {
        reply: true,
        react: true,
        edit: true,
        delete: true,
        pin: true,
        bookmark: true,
        showWatermark: true,
        soundProfile: 'classic',
      },
    });
    setNewUserEmail('');
    setNewUserName('');
    setNewUserTempPassword('');
    setShowAddUser(false);
  };

  // --- Broadcast ---
  const publishBroadcast = async () => {
    if (!broadcastMessage.trim()) return alert('Please enter a message.');
    setIsBroadcasting(true);
    // Store in current announcement
    await setDoc(doc(db, 'workspace', 'announcement'), {
      message: broadcastMessage.trim(),
      type: broadcastType,
      isActive: true,
      timestamp: serverTimestamp(),
      author: currentUserData?.name || 'Administrator',
    });
    // Also store a copy in the broadcasts collection for history
    await addDoc(collection(db, 'broadcasts'), {
      message: broadcastMessage.trim(),
      type: broadcastType,
      timestamp: serverTimestamp(),
      author: currentUserData?.name || 'Administrator',
    });
    setBroadcastMessage('');
    setIsBroadcasting(false);
  };

  const revokeBroadcast = async () => {
    if (!window.confirm('Remove the active broadcast?')) return;
    await updateDoc(doc(db, 'workspace', 'announcement'), { isActive: false });
    if (globalAnnouncement?.id) setSelectedBroadcastId(globalAnnouncement.id);
  };

  // --- Tags ---
  const handleAddTag = async () => {
    if (!newTagLabel.trim() || !newTagLabel.startsWith('#'))
      return alert("Tag label must begin with '#'");
    const theme = tagThemes[newTagTheme];
    try {
      await addDoc(collection(db, 'workspace_tags'), {
        label: newTagLabel.trim(),
        bgClass: theme.bg,
        textClass: theme.text,
        themeName: newTagTheme,
        createdAt: serverTimestamp(),
      });
      setNewTagLabel('');
    } catch (e) {
      alert('Failed to create tag: ' + e.message);
    }
  };

  const startEditTag = (tag) => {
    setEditingTagId(tag.id);
    setEditTagLabel(tag.label);
    setEditTagTheme(tag.themeName || 'teal');
  };

  const saveTagEdit = async () => {
    if (!editTagLabel.trim() || !editTagLabel.startsWith('#')) return alert("Label must start with #");
    const theme = tagThemes[editTagTheme];
    await updateDoc(doc(db, 'workspace_tags', editingTagId), {
      label: editTagLabel.trim(),
      bgClass: theme.bg,
      textClass: theme.text,
      themeName: editTagTheme,
    });
    setEditingTagId(null);
  };

  // --- Organization ---
  const saveOrgDetails = async () => {
    try {
      await setDoc(doc(db, 'workspace', 'org_details'), orgDetails, { merge: true });
      setIsOrgSaved(true);
      alert('Organization details saved successfully!');
    } catch (e) {
      alert('Failed to save: ' + e.message);
    }
  };

  // --- Print / Export ---
  const printSelectedPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    doc.setFont('Inter');
    doc.setFontSize(16);
    doc.text('Talk & Task – Admin Report', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);
    let y = 40;
    if (activeTab === 'users') {
      const data = filteredUsers.filter((u) => selectedUsers.has(u.uid));
      doc.text('Selected Users', 14, y);
      y += 6;
      doc.autoTable({
        startY: y,
        head: [['S.No.', 'Name', 'Status']],
        body: data.map((u, i) => [i + 1, u.name, u.isApproved ? 'APPROVED' : 'PENDING']),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [79, 70, 229] },
      });
    } else if (activeTab === 'logs') {
      const data = universalLogs.filter((l) => selectedLogs.has(l.id));
      doc.text('Logs', 14, y);
      y += 6;
      doc.autoTable({
        startY: y,
        head: [['S.No.', 'Time', 'Action', 'User', 'Details']],
        body: data.map((l, i) => [
          i + 1,
          l.dateString + ' ' + l.time,
          l.type,
          (dbUsers || []).find((u) => u.email === l.user)?.name || 'System',
          stripHtml(l.content),
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [79, 70, 229] },
      });
    }
    doc.save(`admin_report_${activeTab}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // ===== RENDER =====
  return (
    <div className="flex flex-col h-full w-full bg-slate-50 overflow-hidden animate-in fade-in z-40 relative">
      {/* Header */}
      <div className="bg-indigo-600 px-4 py-3 flex items-center justify-between shadow-md shrink-0 safe-top">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur shadow-inner">
            <i className="fa-solid fa-shield-halved text-xl text-white"></i>
          </div>
          <h1 className="font-bold text-lg text-white tracking-wide">Admin Workspace v25.0</h1>
        </div>
        <div className="flex items-center gap-2">
          {['users', 'logs'].includes(activeTab) && (
            <button
              onClick={printSelectedPDF}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm backdrop-blur border border-white/30"
            >
              <i className="fa-solid fa-file-pdf"></i> Print Selected
            </button>
          )}
          <button
            onClick={() => {
              setActiveModal(null);
              setViewMode('chat');
            }}
            className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm backdrop-blur border border-white/30"
          >
            <i className="fa-solid fa-arrow-left"></i> Back to App
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-4 pt-4 bg-white border-b border-slate-200 flex-wrap overflow-x-auto custom-sidebar-scroll shrink-0 shadow-sm z-10 relative">
        {['overview', 'users', 'security', 'groups', 'tasks', 'logs', 'broadcast', 'tags', 'lifecycle', 'recovery', 'compliance', 'storage', 'organization'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-3 rounded-t-xl text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === tab
                ? 'bg-slate-50 text-indigo-600 border-t-2 border-indigo-600 shadow-[0_-2px_10px_rgba(0,0,0,0.02)]'
                : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-50'
            }`}
          >
            {tab === 'overview' && <i className="fa-solid fa-gauge-high mr-2"></i>}
            {tab === 'users' && <i className="fa-solid fa-users mr-2"></i>}
            {tab === 'security' && <i className="fa-solid fa-shield-halved mr-2"></i>}
            {tab === 'groups' && <i className="fa-solid fa-people-group mr-2"></i>}
            {tab === 'tasks' && <i className="fa-solid fa-list-check mr-2"></i>}
            {tab === 'logs' && <i className="fa-solid fa-clock-rotate-left mr-2"></i>}
            {tab === 'broadcast' && <i className="fa-solid fa-bullhorn mr-2"></i>}
            {tab === 'tags' && <i className="fa-solid fa-hashtag mr-2"></i>}
            {tab === 'lifecycle' && <i className="fa-solid fa-recycle mr-2"></i>}
            {tab === 'recovery' && <i className="fa-solid fa-cloud-arrow-down mr-2"></i>}
            {tab === 'compliance' && <i className="fa-solid fa-scale-balanced mr-2"></i>}
            {tab === 'storage' && <i className="fa-solid fa-hard-drive mr-2"></i>}
            {tab === 'organization' && <i className="fa-solid fa-building-columns mr-2"></i>}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden bg-slate-50 relative flex flex-col">

        {activeTab === 'storage' && (
          <StorageDashboard currentUserData={currentUserData} isVipAdmin={isVipAdmin} />
        )}

        {activeTab === 'limits' && (
          <div className="p-6 overflow-y-auto custom-sidebar-scroll h-full">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm max-w-md">
              <h2 className="font-bold text-slate-800 text-lg mb-2"><i className="fa-solid fa-file-arrow-up text-indigo-600 mr-2"></i>Upload Limits</h2>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Max file upload size (MB)</label>
              <input type="number" min="1" max="50" value={limitDraft} onChange={(e) => setLimitDraft(Math.max(1, Number(e.target.value || 5)))} className="mt-2 w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold outline-none focus:border-indigo-500" />
              <p className="text-xs text-slate-500 mt-3">Default is 5 MB. Changes apply after Save.</p>
              {Number(limitDraft) !== Number(maxFileSizeMb || 5) && <button onClick={() => { setMaxFileSizeMb?.(limitDraft); localStorage.setItem('maxFileSizeMb', String(limitDraft)); }} className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold">Save Limit</button>}
            </div>
          </div>
        )}

        {/* ========= OVERVIEW TAB ========= */}
        {activeTab === 'overview' && (
          <div className="flex flex-col gap-6 p-4 md:p-6 overflow-y-auto custom-sidebar-scroll h-full">
            {/* time range */}
            <div className="flex items-center gap-2 justify-end">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Show:</span>
              {['today', 'week', 'month'].map((range) => (
                <button key={range} onClick={() => setOverviewTimeRange(range)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm ${
                    overviewTimeRange === range ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >{range.charAt(0).toUpperCase() + range.slice(1)}</button>
              ))}
            </div>

            {/* Metric cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div onClick={() => setActiveTab('logs')} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-indigo-500 transition-colors">Messages</p>
                    <p className="text-2xl font-extrabold text-slate-800 mt-1">{overviewMetrics.totalMessages}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform"><i className="fa-solid fa-comments"></i></div>
                </div>
              </div>
              <div onClick={() => setActiveTab('tasks')} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-amber-300 transition-all cursor-pointer group">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-amber-500 transition-colors">Active Tasks</p>
                    <p className="text-2xl font-extrabold text-slate-800 mt-1">{overviewMetrics.activeTasks}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform"><i className="fa-solid fa-spinner"></i></div>
                </div>
              </div>
              <div onClick={() => { setActiveTab('tasks'); setTaskStatusFilter('Completed'); }} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer group">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-emerald-500 transition-colors">Completed</p>
                    <p className="text-2xl font-extrabold text-slate-800 mt-1">{overviewMetrics.completedTasks}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform"><i className="fa-solid fa-check-circle"></i></div>
                </div>
              </div>
              <div onClick={() => setActiveTab('users')} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-teal-300 transition-all cursor-pointer group">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-teal-500 transition-colors">Active Users</p>
                    <p className="text-2xl font-extrabold text-slate-800 mt-1">{overviewMetrics.activeUsers}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 group-hover:scale-110 transition-transform"><i className="fa-solid fa-users"></i></div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                ['Total Users', overviewMetrics.totalUsers, 'fa-address-book', 'text-indigo-700'],
                ['Active Sessions Today', overviewMetrics.activeSessionsToday, 'fa-user-clock', 'text-teal-700'],
                ['Upcoming Backup', overviewMetrics.upcomingBackupStatus, 'fa-database', 'text-slate-700'],
                ['Next Retention Run', overviewMetrics.nextRetentionRun, 'fa-recycle', 'text-emerald-700'],
              ].map(([label, value, icon, tone]) => (
                <div key={label} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                  <div className="flex justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className={`mt-1 text-lg font-black ${tone}`}>{value}</p></div><i className={`fa-solid ${icon} text-xl text-slate-300`}></i></div>
                </div>
              ))}
            </div>

            {/* additional cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Approvals</p>
                  <p className="text-2xl font-extrabold text-rose-600 mt-1">{overviewMetrics.pendingApprovals}</p>
                </div>
                <button onClick={() => setActiveTab('users')} className="text-xs font-bold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-lg hover:bg-indigo-100 transition-colors">Manage Users</button>
              </div>
              <div onClick={() => { setActiveTab('tasks'); setTaskStatusFilter('In Progress'); }} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow cursor-pointer">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Overdue Tasks</p>
                  <p className="text-2xl font-extrabold text-rose-600 mt-1">{overviewMetrics.overdueTasks}</p>
                </div>
                <button className="text-xs font-bold text-rose-600 bg-rose-50 px-4 py-2 rounded-lg hover:bg-rose-100 transition-colors">View All</button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50"><h3 className="font-bold text-slate-800 flex items-center gap-2"><i className="fa-solid fa-triangle-exclamation text-rose-500"></i> Critical Audit Timeline</h3></div>
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto custom-sidebar-scroll">
                {criticalAuditFeed.length === 0 ? <p className="p-6 text-sm text-slate-400 italic text-center">No critical events yet.</p> : criticalAuditFeed.map((log) => (
                  <div key={log.id} className="px-5 py-3"><div className="flex items-center justify-between gap-3"><span className="text-xs font-black text-rose-600">{log.type}</span><span className="text-[11px] text-slate-400">{formatDateTime(log.timestamp)}</span></div><p className="text-sm text-slate-700 mt-1">{stripHtml(log.content || log.target || '')}</p></div>
                ))}
              </div>
            </div>

            {/* activity feed */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-bold text-slate-800 flex items-center gap-2"><i className="fa-solid fa-clock-rotate-left text-indigo-500"></i> Recent Activity</h3>
              </div>
              <div className="divide-y divide-slate-100 overflow-y-auto custom-sidebar-scroll">
                {recentAuditFeed.length === 0 ? (
                  <p className="p-6 text-sm text-slate-400 italic text-center">No recent activity.</p>
                ) : (
                  recentAuditFeed.map((log) => (
                    <div key={log.id} className="px-5 py-3 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                      <span className={`w-9 h-9 rounded-full flex items-center justify-center text-xs shadow-sm ${
                        log.type?.startsWith('TASK_') ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                        log.type === 'LOGIN' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                        'bg-indigo-50 text-indigo-600 border border-indigo-100'
                      }`}>
                        <i className={`fa-solid ${log.type?.startsWith('TASK_') ? 'fa-check-square' : log.type === 'LOGIN' ? 'fa-right-to-bracket' : 'fa-circle'}`}></i>
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-slate-700 truncate leading-snug"><span className="font-bold text-slate-900">{log.userName}</span> <span className="font-medium">{stripHtml(log.content)}</span></p>
                        <p className="text-[11px] font-bold text-slate-400 mt-0.5">{log.dateString} at {log.time}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========= USERS / GROUPS TABS ========= */}
        {(activeTab === 'users' || activeTab === 'groups') && (
          <div className="flex flex-col gap-6 p-4 md:p-6 overflow-y-auto custom-sidebar-scroll h-full">
            {/* Users Section */}
            {activeTab === 'users' && <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
              <div className="p-5 border-b border-slate-100 flex justify-between items-center flex-wrap gap-3">
                <h2 className="font-bold text-slate-800 text-lg"><i className="fa-solid fa-users text-indigo-600 mr-2"></i>User Control</h2>
                <div className="flex gap-2"><button onClick={() => setShowRoleMatrix(true)} className="bg-white border border-indigo-200 text-indigo-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-50"><i className="fa-solid fa-user-shield mr-2"></i>Manage Roles</button><button onClick={() => setShowAddUser(!showAddUser)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700"><i className="fa-solid fa-plus mr-2"></i>Add User</button></div>
              </div>
              {showAddUser && (
                <div className="p-5 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-4 items-end">
                  <div><label className="text-xs font-bold text-slate-500 block mb-1">Email</label><input type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="user@example.com" /></div>
                  <div><label className="text-xs font-bold text-slate-500 block mb-1">Name</label><input type="text" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Full Name" /></div>
                  <div><label className="text-xs font-bold text-slate-500 block mb-1">Temporary Password</label><input type="text" value={newUserTempPassword} onChange={(e) => setNewUserTempPassword(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Set in Auth console" /></div>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={newUserApprove} onChange={(e) => setNewUserApprove(e.target.checked)} className="w-4 h-4 accent-indigo-600" /> Approve immediately</label>
                  <button onClick={handleAddUser} className="bg-teal-500 text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-teal-600">Save</button>
                  <button onClick={() => setShowAddUser(false)} className="bg-slate-200 text-slate-600 px-5 py-2 rounded-lg text-sm font-bold hover:bg-slate-300">Cancel</button>
                </div>
              )}
              {selectedUsers.size > 0 && (
                <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-bold text-indigo-700">{selectedUsers.size} selected</span>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={async () => { if (!window.confirm(`Approve ${selectedUsers.size} user(s)?`)) return; await Promise.all(Array.from(selectedUsers).map((uid) => updateDoc(doc(db, 'users', uid), { isApproved: true }))); setSelectedUsers(new Set()); }} className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700">Approve</button>
                    <button onClick={async () => { if (!window.confirm(`Grant admin to ${selectedUsers.size} user(s)?`)) return; await Promise.all(Array.from(selectedUsers).map((uid) => updateDoc(doc(db, 'users', uid), { isAdmin: true }))); setSelectedUsers(new Set()); }} className="px-3 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600">Make Admin</button>
                    <button onClick={async () => { if (!window.confirm(`Revoke admin from ${selectedUsers.size} user(s)?`)) return; await Promise.all(Array.from(selectedUsers).map((uid) => updateDoc(doc(db, 'users', uid), { isAdmin: false }))); setSelectedUsers(new Set()); }} className="px-3 py-1.5 bg-rose-500 text-white text-xs font-bold rounded-lg hover:bg-rose-600">Revoke Admin</button>
                    <button onClick={async () => { if (!window.confirm(`Archive ${selectedUsers.size} user(s)?`)) return; await Promise.all(Array.from(selectedUsers).map((uid) => updateDoc(doc(db, 'users', uid), { isArchived: true }))); setSelectedUsers(new Set()); }} className="px-3 py-1.5 bg-slate-500 text-white text-xs font-bold rounded-lg hover:bg-slate-600">Archive</button>
                    <button onClick={() => { const sel = filteredUsers.filter((u) => selectedUsers.has(u.uid)); const csv = 'Name,Email,Approved,Admin\n' + sel.map((u) => `"${u.name}","${u.email}","${u.isApproved}","${u.isAdmin}"`).join('\n'); const blob = new Blob([csv], { type: 'text/csv' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'selected_users.csv'; link.click(); }} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50">Export CSV</button>
                  </div>
                  <button onClick={() => setSelectedUsers(new Set())} className="ml-auto text-xs font-bold text-slate-500 hover:text-rose-600">Clear</button>
                </div>
              )}
              <div className="overflow-x-auto flex-1 custom-sidebar-scroll">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase sticky top-0">
                    <tr>
                      <th className="px-3 py-3"><input type="checkbox" onChange={toggleSelectAllUsers} checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0} className="w-4 h-4 accent-indigo-600" /></th>
                      <th className="px-3 py-3">S.No.</th>
                      <th className="px-3 py-3">User</th>
                      <th className="px-3 py-3">Email</th>
                      <th className="px-3 py-3">Roles</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-2 py-3 text-center">Admin</th>
                      <th className="px-2 py-3 text-center">Groups</th>
                      <th className="px-3 py-3 text-center">Last Login</th>
                      <th className="px-3 py-3 text-center">DSAR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map((u, idx) => (
                      <tr key={u.uid} className={`hover:bg-slate-50 ${u.isArchived ? 'opacity-60' : ''}`}>
                        <td className="px-3 py-3"><input type="checkbox" checked={selectedUsers.has(u.uid)} onChange={() => toggleSelectUser(u.uid)} className="w-4 h-4 accent-indigo-600" /></td>
                        <td className="px-3 py-3 text-slate-500">{idx + 1}</td>
                        <td className="px-3 py-3"><div className="flex items-center gap-2"><MemoizedAvatar uid={u.uid} url={u.profilePicUrl} name={u.name} sizeClass="w-7 h-7" /><span className="font-medium text-slate-800">{u.name}</span>{u.isAdmin && <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">ADMIN</span>}</div></td>
                        <td className="px-3 py-3 text-slate-500">{u.email}</td>
                        <td className="px-3 py-3 min-w-[220px]"><div className="flex flex-wrap gap-1">{roles.map((role) => (<label key={role.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-600 cursor-pointer"><input type="checkbox" checked={(u.roles || []).includes(role.name)} onChange={(e) => updateUserRoles(u, role.name, e.target.checked)} className="accent-indigo-600" /> <span onClick={(e) => { e.preventDefault(); setSelectedRoleId(role.id); setShowRoleMatrix(true); }}>{role.name}</span></label>))}</div></td>
                        <td className="px-3 py-3"><button onClick={() => handleToggleApprove(u)} className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${u.isApproved ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-orange-50 text-orange-700 border border-orange-200'}`}>{u.isApproved ? 'APPROVED' : 'PENDING'}</button></td>
                        <td className="px-2 py-3 text-center"><input type="checkbox" checked={u.isAdmin || false} onChange={() => handleToggleAdmin(u)} className="w-4 h-4 accent-indigo-600" /></td>
                        <td className="px-2 py-3 text-center"><input type="checkbox" checked={u.canCreateGroups || false} onChange={() => handleToggleCanCreateGroups(u)} className="w-4 h-4 accent-indigo-600" /></td>
                        <td className="px-3 py-3 text-center text-[11px] text-slate-500">{formatDateTime(u.lastLogin || u.lastActive)}</td>
                        <td className="px-3 py-3 text-center"><select onChange={(e) => { if (!e.target.value) return; setDsarForm((prev) => ({ ...prev, uid: u.uid, mode: e.target.value })); setActiveTab('compliance'); e.target.value = ''; }} className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white"><option value="">DSAR Actions</option><option value="access">Export User Data</option><option value="delete">Right to be Forgotten</option></select></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>}

            {/* Groups Section - TABLE view */}
            {activeTab === 'groups' && <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full min-h-0">
              <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                <h2 className="font-bold text-slate-800 text-lg"><i className="fa-solid fa-people-group text-indigo-600 mr-2"></i>Groups</h2>
                <button onClick={() => { setGroupForm({ name: '', members: [], profilePicUrl: null }); setEditingGroup(null); }} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700"><i className="fa-solid fa-plus mr-2"></i>New Group</button>
              </div>
              {(editingGroup || groupForm?.name || groupForm?.members?.length > 0) && (
                <div className="p-5 border-b border-slate-200 bg-slate-50">
                  <form onSubmit={(e) => { e.preventDefault(); handleGroupSubmit(e); }} className="space-y-4 max-w-3xl">
                    <div><label className="text-xs font-bold text-slate-500 block mb-1">Group Name</label><input value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} className="w-full bg-white border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-indigo-500" required /></div>
                    <div><label className="text-xs font-bold text-slate-500 block mb-1">Avatar</label><input type="file" onChange={handleGroupPicUpload} className="text-sm" /> {groupPicUploadProgress > 0 && <span className="text-xs font-bold text-indigo-600 ml-2">{Math.round(groupPicUploadProgress)}%</span>}</div>
                    <div>
                      <div className="flex justify-between items-center mb-2"><label className="text-xs font-bold text-slate-500">Members</label><div className="flex gap-2"><button type="button" onClick={() => setGroupForm({ ...groupForm, members: dbUsers.map((u) => u.email) })} className="text-xs text-indigo-600 font-bold hover:underline">Select All</button><button type="button" onClick={() => setGroupForm({ ...groupForm, members: [] })} className="text-xs text-rose-500 font-bold hover:underline">Clear</button></div></div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-sidebar-scroll">
                        {dbUsers.map((u) => (
                          <label key={u.uid} className="flex items-center gap-2 text-sm p-2 bg-white border border-slate-200 rounded-lg cursor-pointer">
                            <input type="checkbox" checked={(groupForm.members || []).includes(u.email)} onChange={(e) => { const m = new Set(groupForm.members); e.target.checked ? m.add(u.email) : m.delete(u.email); setGroupForm({ ...groupForm, members: Array.from(m) }); }} className="w-4 h-4 accent-indigo-600" />
                            <MemoizedAvatar uid={u.uid} url={u.profilePicUrl} name={u.name} sizeClass="w-6 h-6" />
                            <span className="font-medium">{u.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-end gap-3">
                      <button type="button" onClick={() => { setEditingGroup(null); setGroupForm({ name: '', members: [], profilePicUrl: null }); }} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50">Cancel</button>
                      <button type="submit" className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700">Save Group</button>
                    </div>
                  </form>
                </div>
              )}
              {/* Groups Table */}
              <div className="overflow-y-auto custom-sidebar-scroll flex-1">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase sticky top-0">
                    <tr>
                      <th className="px-4 py-3">Group Name</th>
                      <th className="px-4 py-3">Members</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {groups.map((g) => (
                      <tr key={g.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-bold text-slate-800">{g.name}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 flex-wrap">
                            {(g.members || []).slice(0, 5).map((email) => {
                              const u = dbUsers.find((u) => u.email === email);
                              return <MemoizedAvatar key={email} uid={u?.uid || email} url={u?.profilePicUrl} name={u?.name || 'User'} sizeClass="w-6 h-6 border border-white shadow-sm" />;
                            })}
                            {(g.members || []).length > 5 && <span className="text-xs font-bold text-slate-500">+{g.members.length - 5} more</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => { setGroupForm({ name: g.name, members: g.members, profilePicUrl: g.profilePicUrl }); setEditingGroup(g); }} className="text-indigo-600 hover:text-indigo-800 mr-2" title="Edit"><i className="fa-solid fa-pencil"></i></button>
                          <button onClick={async () => { if (!window.confirm('Delete this group?')) return; await deleteDoc(doc(db, 'groups', g.id)); }} className="text-rose-500 hover:text-rose-700" title="Delete"><i className="fa-solid fa-trash"></i></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>}
          </div>
        )}

        {/* ========= TASKS TAB (Table with S.No., Edit/Delete buttons) ========= */}
        {activeTab === 'tasks' && (
          <div className="flex flex-col gap-4 p-4 md:p-6 overflow-y-auto custom-sidebar-scroll h-full">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <h2 className="font-bold text-lg text-slate-800"><i className="fa-solid fa-list-check text-indigo-600 mr-2"></i>Tasks</h2>
              <div className="flex flex-wrap gap-2 items-center">
                <select value={taskStatusFilter} onChange={(e) => setTaskStatusFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold">
                  <option value="All">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
                <select value={taskGroupFilter} onChange={(e) => setTaskGroupFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold">
                  <option value="">All Groups</option>
                  {groups.map((g) => (<option key={g.id} value={g.id}>{g.name}</option>))}
                </select>
                <input type="text" value={taskSearch} onChange={(e) => setTaskSearch(e.target.value)} placeholder="Search tasks..." className="border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold w-48" />
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col flex-1">
              <div className="overflow-x-auto custom-sidebar-scroll flex-1">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase sticky top-0">
                    <tr>
                      <th className="px-4 py-3 w-12">S.No.</th>
                      <th className="px-4 py-3">Task</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Assignees</th>
                      <th className="px-4 py-3">Due Date</th>
                      <th className="px-4 py-3">Group</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTasks.map((task, idx) => {
                      const isExpanded = expandedTasks.has(task.id);
                      const groupName = groups.find((g) => g.id === task.groupId)?.name || (task.groupId === 'direct' ? 'Direct' : 'Unknown');
                      return (
                        <React.Fragment key={task.id}>
                          <tr className={`hover:bg-slate-50 cursor-pointer ${isExpanded ? 'bg-indigo-50/50' : ''}`} onClick={() => toggleTaskExpand(task.id)}>
                            <td className="px-4 py-3 text-slate-500">{idx + 1}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <i className={`fa-solid fa-flag text-xs ${task.taskData?.priority === 'High' ? 'text-rose-500' : task.taskData?.priority === 'Medium' ? 'text-amber-500' : 'text-emerald-500'}`}></i>
                                <span className="font-medium">{stripHtml(task.text)}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {editingTaskId === task.id ? (
                                <select value={editTaskStatus} onChange={(e) => setEditTaskStatus(e.target.value)} className="border border-slate-200 rounded p-1 text-xs font-bold" onClick={(e) => e.stopPropagation()}>
                                  <option>Pending</option>
                                  <option>In Progress</option>
                                  <option>Completed</option>
                                </select>
                              ) : (
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${task.taskData?.status === 'Completed' ? 'bg-teal-100 text-teal-700' : task.taskData?.status === 'In Progress' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>{task.taskData?.status || 'Pending'}</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex -space-x-1.5">
                                {(task.taskData?.assignees || []).slice(0, 3).map((email) => {
                                  const u = dbUsers.find((u) => u.email === email);
                                  return <MemoizedAvatar key={email} uid={u?.uid || email} url={u?.profilePicUrl} name={u?.name || email} sizeClass="w-6 h-6 border-2 border-white shadow-sm" />;
                                })}
                                {(task.taskData?.assignees || []).length > 3 && (
                                  <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600 border-2 border-white">+{task.taskData.assignees.length - 3}</div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs font-medium">{new Date(task.taskData?.deadline).toLocaleDateString()}</td>
                            <td className="px-4 py-3 text-xs font-medium">{groupName}</td>
                            <td className="px-4 py-3 text-right text-slate-300">—</td>
                          </tr>
                          {/* Edit form row */}
                          {editingTaskId === task.id && (
                            <tr>
                              <td colSpan={7} className="bg-slate-50 p-4">
                                <div className="flex flex-wrap gap-4 items-end">
                                  <div><label className="text-xs font-bold">Title</label><input value={editTaskTitle} onChange={(e) => setEditTaskTitle(e.target.value)} className="border border-slate-200 rounded p-1 text-sm w-full" /></div>
                                  <div><label className="text-xs font-bold">Priority</label><select value={editTaskPriority} onChange={(e) => setEditTaskPriority(e.target.value)} className="modern-date-input"><option>Low</option><option>Medium</option><option>High</option></select></div>
                                  <div><label className="text-xs font-bold">Deadline</label><input type="date" value={editTaskDeadline} onChange={(e) => setEditTaskDeadline(e.target.value)} className="modern-date-input" /></div>
                                  <div>
                                    <label className="text-xs font-bold">Assignees</label>
                                    <div className="flex flex-wrap gap-1">
                                      {dbUsers.map((u) => (
                                        <label key={u.uid} className="flex items-center gap-1 text-xs">
                                          <input type="checkbox" checked={editTaskAssignees.includes(u.email)} onChange={(e) => { const set = new Set(editTaskAssignees); e.target.checked ? set.add(u.email) : set.delete(u.email); setEditTaskAssignees(Array.from(set)); }} className="w-3 h-3" />
                                          {u.name.split(' ')[0]}
                                        </label>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="flex gap-2 ml-auto">
                                    <button onClick={() => saveTaskEdit(task.id)} className="bg-indigo-600 text-white px-3 py-1 rounded text-xs font-bold">Save</button>
                                    <button onClick={cancelEdit} className="bg-slate-200 text-slate-600 px-3 py-1 rounded text-xs font-bold">Cancel</button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                          {/* Trail expansion */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={7} className="bg-slate-50 p-4 border-t border-slate-200">
                                <div className="space-y-2 max-h-[200px] overflow-y-auto custom-sidebar-scroll">
                                  {(task.taskData?.trail || []).map((t, idx) => {
                                    const author = dbUsers.find((u) => u.email === t.by)?.name || 'System';
                                    return (
                                      <div key={idx} className="flex gap-2 text-xs">
                                        <span className="font-bold text-indigo-600">{author}</span>
                                        <span>{t.action}</span>
                                        <span className="text-slate-400">{t.time?.split(',')[0]}</span>
                                        {t.comment && <span className="italic text-slate-500">“{t.comment}”</span>}
                                      </div>
                                    );
                                  })}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========= LOGS TAB ========= */}
        {activeTab === 'logs' && (
          <div className="flex flex-col gap-4 p-4 md:p-6 overflow-y-auto custom-sidebar-scroll h-full">
            <div className="flex items-center gap-2">
              <input type="text" value={logSearchQuery} onChange={(e) => setLogSearchQuery(e.target.value)} placeholder="Search all logs (user, action, content)..." className="flex-1 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold" />
              {logSearchQuery && <button onClick={() => setLogSearchQuery('')} className="bg-slate-200 text-slate-600 px-3 py-2 rounded-xl text-sm font-bold">Clear</button>}
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col flex-1">
              <div className="overflow-x-auto custom-sidebar-scroll flex-1">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase sticky top-0">
                    <tr>
                      <th className="px-3 py-3"><input type="checkbox" onChange={() => { if (selectedLogs.size === universalLogs.length) setSelectedLogs(new Set()); else setSelectedLogs(new Set(universalLogs.map((l) => l.id))); }} checked={selectedLogs.size === universalLogs.length && universalLogs.length > 0} className="w-4 h-4 accent-indigo-600" /></th>
                      <th className="px-3 py-3">S.No.</th>
                      <th className="px-3 py-3">Time</th>
                      <th className="px-3 py-3">Action</th>
                      <th className="px-3 py-3">Initiated By</th>
                      <th className="px-3 py-3">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {universalLogs.map((log, idx) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="px-3 py-3"><input type="checkbox" checked={selectedLogs.has(log.id)} onChange={() => { const s = new Set(selectedLogs); s.has(log.id) ? s.delete(log.id) : s.add(log.id); setSelectedLogs(s); }} className="w-4 h-4 accent-indigo-600" /></td>
                        <td className="px-3 py-3 text-slate-500 font-bold">{idx + 1}</td>
                        <td className="px-3 py-3 text-xs font-bold text-slate-600">{log.dateString}<div className="text-[11px] text-slate-400">{log.time}</div></td>
                        <td className="px-3 py-3"><span className={`text-[10px] font-extrabold tracking-wider px-2 py-1 rounded-full shadow-sm ${log.type?.startsWith('TASK_') ? 'bg-amber-100 text-amber-700 border border-amber-200' : log.type === 'LOGIN' || log.type === 'LOGOUT' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : log.type === 'REACTION' ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}>{log.type}</span></td>
                        <td className="px-3 py-3 font-bold text-indigo-600">{dbUsers.find((u) => u.email === log.user)?.name || 'System'}</td>
                        <td className="px-3 py-3 max-w-xs"><div className="text-slate-600 whitespace-pre-wrap leading-relaxed font-medium text-[13px]">{stripHtml(log.content)}</div>{log.target && <div className="text-[10px] font-bold text-indigo-500 mt-1 uppercase tracking-wider">{stripHtml(log.target)}</div>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========= BROADCAST TAB (Smaller compose, filterable vault) ========= */}
        {activeTab === 'broadcast' && (
          <div className="p-4 md:p-6 overflow-y-auto custom-sidebar-scroll h-full">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 flex flex-col h-full max-w-4xl mx-auto">
              <div className="flex items-center gap-4 mb-4 border-b border-slate-100 pb-4 shrink-0">
                <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center shadow-inner"><i className="fa-solid fa-tower-broadcast text-2xl"></i></div>
                <div><h2 className="font-bold text-slate-800 text-xl leading-tight">Global Broadcast System</h2><span className="text-[11px] font-bold text-rose-500 uppercase tracking-wider">Push alerts to all active screens</span></div>
              </div>

              <div className="flex-1 flex flex-col gap-6 overflow-y-auto custom-sidebar-scroll">
                {globalAnnouncement?.isActive ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 relative overflow-hidden flex flex-col">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500"></div>
                    <div className="shrink-0 mb-2">
                      <h3 className="font-bold text-slate-700 mb-1 flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span> LIVE BROADCAST ACTIVE</h3>
                      <div className={`p-3 rounded-xl text-sm font-bold shadow-sm ${globalAnnouncement.type === 'emergency' ? 'bg-rose-600 text-white' : globalAnnouncement.type === 'warning' ? 'bg-amber-500 text-white' : 'bg-indigo-600 text-white'}`}>
                        <i className={`fa-solid ${globalAnnouncement.type === 'emergency' ? 'fa-bullhorn' : globalAnnouncement.type === 'warning' ? 'fa-clock' : 'fa-pen'} mr-2`}></i> {stripHtml(globalAnnouncement.message)}
                      </div>
                    </div>
                    <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col mb-2">
                      <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 font-bold text-slate-700 text-[11px] uppercase tracking-widest flex justify-between shrink-0"><span><i className="fa-solid fa-eye text-indigo-500 mr-1.5"></i> Read Receipts</span><span className="text-indigo-700 font-black">{(displayedAcks || []).length} Acknowledged</span></div>
                      <div className="overflow-y-auto custom-sidebar-scroll flex-1 p-2 max-h-40">
                        {(displayedAcks || []).length === 0 ? (
                          <div className="text-center text-slate-400 text-xs py-6 font-medium italic">No users have dismissed this broadcast yet.</div>
                        ) : (
                          (displayedAcks || []).map((ack, i) => (
                            <div key={i} className="flex justify-between items-center px-3 py-2.5 hover:bg-slate-50 border-b border-slate-50 last:border-0 rounded">
                              <span className="text-sm font-bold text-slate-800"><i className="fa-solid fa-check-double text-emerald-500 mr-2 text-[10px]"></i>{ack.userName}</span>
                              <span className="text-[11px] text-slate-400 font-bold">{ack.timestamp?.toDate ? new Date(ack.timestamp.toDate()).toLocaleString() : ''}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    <button onClick={revokeBroadcast} className="shrink-0 px-4 py-2.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl font-bold text-sm hover:bg-rose-100 transition-colors shadow-sm"><i className="fa-solid fa-power-off mr-2"></i> Revoke & Remove Broadcast</button>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-inner shrink-0">
                    <h3 className="font-bold text-slate-700 mb-3 text-sm uppercase tracking-wider">Draft New Broadcast</h3>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Message Content</label>
                    <textarea value={broadcastMessage} onChange={(e) => setBroadcastMessage(e.target.value)} placeholder="Type the alert message..." rows={2} className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 mb-3 font-bold text-slate-700 shadow-sm resize-none" />
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Urgency Level</label>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <label className={`flex-1 flex items-center gap-2 p-2 rounded-lg border-2 cursor-pointer transition-colors ${broadcastType === 'emergency' ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'}`}>
                        <input type="radio" name="urgency" value="emergency" checked={broadcastType === 'emergency'} onChange={() => setBroadcastType('emergency')} className="hidden" />
                        <div className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm"><i className="fa-solid fa-bullhorn text-xs"></i></div>
                        <span className="font-bold text-xs">Emergency</span>
                      </label>
                      <label className={`flex-1 flex items-center gap-2 p-2 rounded-lg border-2 cursor-pointer transition-colors ${broadcastType === 'warning' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'}`}>
                        <input type="radio" name="urgency" value="warning" checked={broadcastType === 'warning'} onChange={() => setBroadcastType('warning')} className="hidden" />
                        <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm"><i className="fa-regular fa-clock text-xs"></i></div>
                        <span className="font-bold text-xs">Warning</span>
                      </label>
                      <label className={`flex-1 flex items-center gap-2 p-2 rounded-lg border-2 cursor-pointer transition-colors ${broadcastType === 'info' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'}`}>
                        <input type="radio" name="urgency" value="info" checked={broadcastType === 'info'} onChange={() => setBroadcastType('info')} className="hidden" />
                        <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm"><i className="fa-solid fa-pen text-xs"></i></div>
                        <span className="font-bold text-xs">Info</span>
                      </label>
                    </div>
                    <button onClick={publishBroadcast} disabled={isBroadcasting} className="w-full bg-rose-600 text-white font-black py-3 rounded-xl hover:bg-rose-700 shadow-lg shadow-rose-600/30 transition-transform hover:scale-[1.01] uppercase tracking-widest text-sm"><i className="fa-solid fa-satellite-dish mr-2"></i> Publish Global Broadcast</button>
                  </div>
                )}

                {/* Historical Vault with search filter */}
                {!globalAnnouncement?.isActive && pastBroadcasts.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col min-h-0 flex-1">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap gap-4 items-center justify-between shrink-0">
                      <div>
                        <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wider flex items-center gap-2"><i className="fa-solid fa-box-archive text-indigo-400"></i> Historical Broadcast Vault</h3>
                        <p className="text-[11px] text-slate-500 mt-1">Audit read receipts from past alerts.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="text" placeholder="Search by message..." value={broadcastSearch} onChange={(e) => setBroadcastSearch(e.target.value)} className="p-2 border border-slate-200 rounded-lg text-sm font-medium" />
                        <select value={selectedBroadcastId || ''} onChange={(e) => setSelectedBroadcastId(e.target.value)} className="p-2.5 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20">
                          <option value="">Select a broadcast...</option>
                          {filteredPastBroadcasts.map((b) => (
                            <option key={b.id} value={b.id}>{b.message?.substring(0, 40)}... ({b.type})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-sidebar-scroll p-2 min-h-[200px]">
                      {!selectedBroadcastId ? (
                        <div className="flex flex-col items-center justify-center h-full opacity-50 py-10">
                          <i className="fa-solid fa-folder-open text-4xl text-slate-300 mb-3"></i>
                          <p className="text-xs font-bold text-slate-500">Select a broadcast to view its logs.</p>
                        </div>
                      ) : (displayedAcks || []).length === 0 ? (
                        <div className="text-center text-slate-400 text-xs py-10 font-medium italic">No acknowledgements found for this broadcast.</div>
                      ) : (
                        (displayedAcks || []).map((ack, i) => (
                          <div key={i} className="flex justify-between items-center px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 rounded-lg transition-colors">
                            <span className="text-sm font-bold text-slate-800"><i className="fa-solid fa-check-double text-emerald-500 mr-2 text-[10px]"></i>{ack.userName}</span>
                            <span className="text-[11px] text-slate-400 font-bold bg-white px-2 py-1 border border-slate-100 rounded-md shadow-sm">{ack.timestamp?.toDate ? new Date(ack.timestamp.toDate()).toLocaleString() : ''}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========= TAGS TAB (Table with Edit/Delete) ========= */}
        {activeTab === 'tags' && (
          <div className="p-4 md:p-6 overflow-y-auto custom-sidebar-scroll h-full">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 flex flex-col h-full min-h-0 overflow-hidden">
              <div className="flex items-center gap-4 mb-6 border-b border-slate-100 pb-4 shrink-0">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner"><i className="fa-solid fa-hashtag text-2xl"></i></div>
                <div><h2 className="font-bold text-slate-800 text-xl leading-tight">Universal Tag Studio</h2><span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Manage Official Workflow Metadata</span></div>
              </div>

              <div className="flex flex-col md:flex-row gap-6 h-full min-h-0">
                {/* Create Tag */}
                <div className="w-full md:w-1/3 bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-inner overflow-y-auto custom-sidebar-scroll">
                  <h3 className="font-bold text-slate-700 mb-4 text-sm uppercase tracking-wider">Create New Tag</h3>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Hashtag Label</label>
                  <input value={newTagLabel} onChange={(e) => setNewTagLabel(e.target.value)} placeholder="#Example" className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 mb-5 font-bold text-slate-700 shadow-sm bg-white" />
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Select Theme</label>
                  <div className="flex flex-wrap gap-2 mb-6 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                    {Object.entries(tagThemes).map(([name, classes]) => (
                      <div key={name} onClick={() => setNewTagTheme(name)} className={`w-8 h-8 rounded-full cursor-pointer flex items-center justify-center shadow-sm border-2 transition-transform ${newTagTheme === name ? 'border-slate-800 scale-110' : 'border-white'} ${classes.bg} ${classes.text}`}><i className="fa-solid fa-hashtag text-xs"></i></div>
                    ))}
                  </div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Live Preview</label>
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white w-fit mb-6 shadow-sm">
                    <span className={`px-2 py-1 rounded-md text-[11px] font-extrabold tracking-wide shadow-sm ${tagThemes[newTagTheme].bg} ${tagThemes[newTagTheme].text}`}>{newTagLabel || '#Preview'}</span>
                    <span className="text-[11px] font-bold pr-1 text-slate-400">1</span>
                  </div>
                  <button onClick={handleAddTag} className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-600/30 transition-all hover:-translate-y-0.5"><i className="fa-solid fa-cloud-arrow-up mr-2"></i>Publish Tag</button>
                </div>

                {/* Active Tags Table */}
                <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-5 overflow-y-auto custom-sidebar-scroll shadow-sm">
                  <h3 className="font-bold text-slate-700 mb-4 text-sm uppercase tracking-wider">Active Global Tags</h3>
                  {(!customTags || customTags.length === 0) ? (
                    <div className="text-center py-10 text-slate-400 font-medium italic">No tags created yet.</div>
                  ) : (
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-500 text-xs uppercase sticky top-0">
                        <tr>
                          <th className="px-4 py-3">Tag</th>
                          <th className="px-4 py-3">Theme</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(customTags || []).map((tag) => (
                          editingTagId === tag.id ? (
                            <tr key={tag.id} className="bg-slate-50">
                              <td className="px-4 py-2">
                                <input value={editTagLabel} onChange={(e) => setEditTagLabel(e.target.value)} className="border border-slate-200 rounded p-1 text-sm font-bold" />
                              </td>
                              <td className="px-4 py-2">
                                <select value={editTagTheme} onChange={(e) => setEditTagTheme(e.target.value)} className="modern-date-input">
                                  {Object.keys(tagThemes).map((theme) => <option key={theme} value={theme}>{theme}</option>)}
                                </select>
                              </td>
                              <td className="px-4 py-2 text-right">
                                <button onClick={saveTagEdit} className="text-emerald-600 hover:text-emerald-800 mr-2"><i className="fa-solid fa-check"></i></button>
                                <button onClick={() => setEditingTagId(null)} className="text-slate-400 hover:text-rose-500"><i className="fa-solid fa-xmark"></i></button>
                              </td>
                            </tr>
                          ) : (
                            <tr key={tag.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center gap-2">
                                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold tracking-wide shadow-sm ${tag.bgClass} ${tag.textClass}`}>
                                    {tag.label}
                                  </span>
                                  {/* Price-tag style effect: little circle */}
                                  <span className="w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[8px] border-l-slate-300"></span>
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-500 capitalize">{tag.themeName}</td>
                              <td className="px-4 py-3 text-right">
                                <button onClick={() => startEditTag(tag)} className="text-indigo-600 hover:text-indigo-800 mr-2" title="Edit"><i className="fa-solid fa-pencil"></i></button>
                                <button onClick={() => deleteDoc(doc(db, 'workspace_tags', tag.id))} className="text-rose-500 hover:text-rose-700" title="Delete"><i className="fa-solid fa-trash"></i></button>
                              </td>
                            </tr>
                          )
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}



        {showRoleMatrix && (
          <div className="fixed inset-0 bg-slate-900/40 z-[250] flex justify-end" onClick={() => setShowRoleMatrix(false)}>
            <div className="w-full max-w-4xl bg-white h-full shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="p-5 border-b border-slate-200 flex items-center justify-between"><div><h2 className="text-lg font-black text-slate-800">Granular RBAC Role Matrix</h2><p className="text-xs text-slate-500 font-bold">System roles are immutable. Custom roles can be created and edited.</p></div><button onClick={() => setShowRoleMatrix(false)} className="text-slate-400 hover:text-rose-500"><i className="fa-solid fa-xmark text-xl"></i></button></div>
              <div className="flex flex-1 min-h-0">
                <div className="w-64 border-r border-slate-200 p-4 overflow-y-auto custom-sidebar-scroll">
                  <div className="flex gap-2 mb-4"><input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="New role" className="min-w-0 flex-1 border border-slate-200 rounded-lg px-2 py-2 text-xs" /><button onClick={createRole} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold">Add</button></div>
                  {roles.map((role) => <button key={role.id} onClick={() => setSelectedRoleId(role.id)} className={`w-full text-left px-3 py-2 rounded-xl text-sm font-bold mb-1 ${selectedRole?.id === role.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>{role.name}{role.system && <span className="ml-2 text-[9px] text-slate-400">SYSTEM</span>}</button>)}
                </div>
                <div className="flex-1 p-5 overflow-auto custom-sidebar-scroll">
                  <div className="flex items-center justify-between mb-4"><h3 className="font-black text-slate-800">{selectedRole?.name}</h3>{selectedRole && !selectedRole.system && <button onClick={() => deleteRole(selectedRole)} className="text-xs font-bold text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">Delete Role</button>}</div>
                  <table className="w-full text-sm border border-slate-200 rounded-xl overflow-hidden"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3 text-left">Area</th>{PERMISSION_ACTIONS.map((action) => <th key={action} className="p-3 text-center">{action}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{PERMISSION_AREAS.map((area) => <tr key={area}><td className="p-3 font-bold text-slate-700">{area}</td>{PERMISSION_ACTIONS.map((action) => <td key={action} className="p-3 text-center"><input type="checkbox" disabled={selectedRole?.system} checked={!!selectedRole?.permissions?.[area]?.[action]} onChange={(e) => updateRolePermission(selectedRole, area, action, e.target.checked)} className="accent-indigo-600" /></td>)}</tr>)}</tbody></table>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="p-4 md:p-6 overflow-y-auto custom-sidebar-scroll h-full space-y-4">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 flex items-center justify-between gap-3 flex-wrap"><div><h2 className="text-xl font-black text-slate-800"><i className="fa-solid fa-shield-halved text-rose-600 mr-2"></i>Security & Sessions</h2><p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active logins refresh through Firestore session documents.</p></div><button onClick={forceLogoutAll} className="bg-rose-600 text-white px-5 py-3 rounded-xl font-black shadow-sm hover:bg-rose-700"><i className="fa-solid fa-power-off mr-2"></i>Force Logout All Users</button></div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3 text-left">User</th><th className="p-3 text-left">IP</th><th className="p-3 text-left">Device / Browser / OS</th><th className="p-3 text-left">Location</th><th className="p-3 text-left">Login</th><th className="p-3 text-left">Last Activity</th><th className="p-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{sessions.map((session) => <tr key={session.id} className="hover:bg-slate-50"><td className="p-3 font-bold text-slate-800">{session.email || session.uid}</td><td className="p-3 text-slate-600">{session.ip || '—'}</td><td className="p-3 text-slate-600">{session.deviceType || 'Device'} / {session.browser || 'Browser'} / {session.os || 'OS'}</td><td className="p-3 text-slate-600">{session.location?.city || '—'}, {session.location?.country || '—'}</td><td className="p-3 text-xs text-slate-500">{formatDateTime(session.loginTime)}</td><td className="p-3 text-xs text-slate-500">{formatDateTime(session.lastActivity)}</td><td className="p-3 text-right"><button onClick={() => forceLogoutSession(session)} className="text-xs font-bold text-rose-600 bg-rose-50 px-3 py-2 rounded-lg hover:bg-rose-100">Force Logout</button></td></tr>)}</tbody></table>{sessions.length === 0 && <p className="p-6 text-center text-sm text-slate-400">No active sessions.</p>}</div>
          </div>
        )}

        {activeTab === 'lifecycle' && (
          <div className="p-4 md:p-6 overflow-y-auto custom-sidebar-scroll h-full space-y-4">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5"><h2 className="text-xl font-black text-slate-800"><i className="fa-solid fa-recycle text-emerald-600 mr-2"></i>Data Lifecycle</h2><p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Retention policies are scoped to non-task chat messages only. Task trails and audit logs are exempt.</p></div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap gap-3 items-end"><div><label className="text-xs font-bold text-slate-500">Category</label><input value="Chat Messages" disabled className="block border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50" /></div><div><label className="text-xs font-bold text-slate-500">TTL</label><select value={newRetentionPolicy.ttlDays} onChange={(e) => setNewRetentionPolicy({ ...newRetentionPolicy, ttlDays: Number(e.target.value) })} className="block border border-slate-200 rounded-xl px-3 py-2 text-sm"><option value={30}>30 days</option><option value={60}>60 days</option><option value={90}>90 days</option></select></div><div><label className="text-xs font-bold text-slate-500">Action</label><select value={newRetentionPolicy.action} onChange={(e) => setNewRetentionPolicy({ ...newRetentionPolicy, action: e.target.value })} className="block border border-slate-200 rounded-xl px-3 py-2 text-sm"><option value="archive">Archive</option><option value="delete">Delete permanently</option></select></div><button onClick={saveRetentionPolicy} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold">Add Rule</button></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><div className="bg-white rounded-2xl border border-slate-200 overflow-hidden"><div className="p-3 font-black text-slate-700 border-b">Policies</div>{retentionPolicies.map((policy) => <div key={policy.id} className="p-4 border-b last:border-0 flex items-center justify-between gap-3"><div><div className="font-bold text-slate-800">{policy.category}</div><div className="text-xs text-slate-500">{policy.ttlDays} days • {policy.action} • Tasks/audit exempt</div></div><div className="flex gap-2"><button onClick={() => updateRetentionPolicy(policy, { isActive: !policy.isActive })} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${policy.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{policy.isActive ? 'Active' : 'Inactive'}</button><button onClick={() => runCleanupNow(policy)} disabled={!hasPermission(currentUserData, roles, 'Settings', 'update')} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 disabled:opacity-50">Run Cleanup Now</button></div></div>)}</div><div className="bg-white rounded-2xl border border-slate-200 overflow-hidden"><div className="p-3 font-black text-slate-700 border-b">Past Cleanup Executions</div>{retentionRuns.map((run) => <div key={run.id} className="p-4 border-b last:border-0"><div className="flex justify-between"><span className="font-bold text-slate-700">{run.ruleName || run.ruleId}</span><span className="text-xs text-slate-400">{formatDateTime(run.timestamp)}</span></div><div className="text-xs text-slate-500">{run.affected || 0} documents • {run.status}</div></div>)}</div></div>
          </div>
        )}

        {activeTab === 'recovery' && (
          <div className="p-4 md:p-6 overflow-y-auto custom-sidebar-scroll h-full space-y-4"><div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 flex items-center justify-between gap-3 flex-wrap"><div><h2 className="text-xl font-black text-slate-800"><i className="fa-solid fa-cloud-arrow-down text-indigo-600 mr-2"></i>Disaster Recovery</h2><p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Exports are logged to Firestore and downloaded as JSON.</p></div><button onClick={exportFullDatabase} disabled={!canRunBackups} className="bg-indigo-600 text-white px-5 py-3 rounded-xl font-black disabled:opacity-50">Export Full Database (JSON)</button></div><div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><div className="bg-white rounded-2xl border border-slate-200 overflow-hidden"><div className="p-3 font-black text-slate-700 border-b">Export History</div>{exportsHistory.map((item) => <div key={item.id} className="p-4 border-b last:border-0"><div className="font-bold text-slate-700">{item.fileName}</div><div className="text-xs text-slate-500">{formatDateTime(item.timestamp)} • {item.size || 0} bytes • {item.status}</div></div>)}</div><div className="bg-white rounded-2xl border border-slate-200 overflow-hidden"><div className="p-3 font-black text-slate-700 border-b flex justify-between"><span>Storage Link Index</span><button onClick={buildStorageIndex} className="text-xs text-indigo-600 font-bold">Refresh</button></div>{storageIndex.map((file, idx) => <div key={`${file.path}-${idx}`} className="p-4 border-b last:border-0 flex justify-between gap-3"><div className="min-w-0"><div className="font-bold text-slate-700 truncate">{file.name}</div><div className="text-xs text-slate-500 truncate">{file.path}</div></div><button onClick={() => window.open(file.url, '_blank')} className="text-xs font-bold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg">Download</button></div>)}</div></div></div>
        )}

        {activeTab === 'compliance' && (
          <div className="p-4 md:p-6 overflow-y-auto custom-sidebar-scroll h-full space-y-4"><div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5"><h2 className="text-xl font-black text-slate-800"><i className="fa-solid fa-scale-balanced text-purple-600 mr-2"></i>Compliance (DSAR)</h2><p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Generate access reports or execute right-to-be-forgotten workflows.</p></div><div className="bg-white rounded-2xl border border-slate-200 p-5 grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="text-xs font-bold text-slate-500">User</label><select value={dsarForm.uid} onChange={(e) => setDsarForm({ ...dsarForm, uid: e.target.value })} className="modern-date-input"><option value="">Select user</option>{dbUsers.map((u) => <option key={u.uid} value={u.uid}>{u.name} — {u.email}</option>)}</select></div><div><label className="text-xs font-bold text-slate-500">Action</label><select value={dsarForm.mode} onChange={(e) => setDsarForm({ ...dsarForm, mode: e.target.value })} className="modern-date-input"><option value="access">Generate Access Report</option><option value="delete">Execute Hard Delete</option></select></div><div><label className="text-xs font-bold text-slate-500">Start Date</label><input type="date" value={dsarForm.startDate} onChange={(e) => setDsarForm({ ...dsarForm, startDate: e.target.value })} className="modern-date-input" /></div><div><label className="text-xs font-bold text-slate-500">End Date</label><input type="date" value={dsarForm.endDate} onChange={(e) => setDsarForm({ ...dsarForm, endDate: e.target.value })} className="modern-date-input" /></div><div className="md:col-span-2 flex gap-3"><button onClick={generateDsarReport} disabled={!canRunCompliance} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold disabled:opacity-50">Generate Access Report</button><button onClick={executeHardDelete} disabled={!canRunCompliance} className="bg-rose-600 text-white px-4 py-2 rounded-xl font-bold disabled:opacity-50">Execute Hard Delete</button></div></div></div>
        )}

        {/* ========= ORGANIZATION TAB ========= */}
        {activeTab === 'organization' && (
          <div className="p-4 md:p-6 overflow-y-auto custom-sidebar-scroll h-full">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 flex flex-col max-w-4xl mx-auto h-full min-h-0">
              <div className="flex items-center gap-4 mb-6 border-b border-slate-100 pb-4 shrink-0">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner"><i className="fa-solid fa-building-columns text-2xl"></i></div>
                <div>
                  <h2 className="font-bold text-slate-800 text-xl leading-tight">Organization Details</h2>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Manage your company profile</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-sidebar-scroll pr-2">
                {isOrgSaved && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm font-bold mb-5 flex items-center gap-2">
                    <i className="fa-solid fa-circle-check"></i> Details saved successfully.
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  <div className="md:col-span-2 bg-indigo-50 border border-indigo-100 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">Official Institution Name</label>
                      <input type="text" value={adminSettings.institutionName || ''} onChange={(e) => setAdminSettings({ ...adminSettings, institutionName: e.target.value })} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-medium" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">Point-of-Contact Email</label>
                      <input type="email" value={adminSettings.pointOfContactEmail || ''} onChange={(e) => setAdminSettings({ ...adminSettings, pointOfContactEmail: e.target.value })} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-medium" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">File Upload Size Limit (MB)</label>
                      <input type="number" min="1" value={adminSettings.fileUploadSizeMb || maxFileSizeMb || 5} onChange={(e) => setAdminSettings({ ...adminSettings, fileUploadSizeMb: e.target.value })} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-medium" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">Active User Count</label>
                      <input type="number" value={dbUsers.length} readOnly className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-medium bg-slate-100 text-slate-500" />
                    </div>
                    <div className="md:col-span-2">
                      <VersionManager currentVersion={appVersion} />
                    </div>
                    <div className="md:col-span-2 flex justify-end"><button type="button" onClick={saveInstitutionSettings} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold">Save Institution Settings</button></div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Organization Name</label>
                    <input type="text" value={orgDetails.orgName} onChange={(e) => setOrgDetails({ ...orgDetails, orgName: e.target.value })} disabled={isOrgSaved} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-medium disabled:bg-slate-100 disabled:text-slate-500" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Address</label>
                    <input type="text" value={orgDetails.address} onChange={(e) => setOrgDetails({ ...orgDetails, address: e.target.value })} disabled={isOrgSaved} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-medium disabled:bg-slate-100 disabled:text-slate-500" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Email</label>
                    <input type="email" value={orgDetails.email} onChange={(e) => setOrgDetails({ ...orgDetails, email: e.target.value })} disabled={isOrgSaved} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-medium disabled:bg-slate-100 disabled:text-slate-500" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Phone</label>
                    <input type="text" value={orgDetails.phone} onChange={(e) => setOrgDetails({ ...orgDetails, phone: e.target.value })} disabled={isOrgSaved} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-medium disabled:bg-slate-100 disabled:text-slate-500" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Admin Name</label>
                    <input type="text" value={orgDetails.adminName} onChange={(e) => setOrgDetails({ ...orgDetails, adminName: e.target.value })} disabled={isOrgSaved} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-medium disabled:bg-slate-100 disabled:text-slate-500" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Admin Designation</label>
                    <input type="text" value={orgDetails.adminDesignation} onChange={(e) => setOrgDetails({ ...orgDetails, adminDesignation: e.target.value })} disabled={isOrgSaved} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-medium disabled:bg-slate-100 disabled:text-slate-500" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Admin Email</label>
                    <input type="email" value={orgDetails.adminEmail} onChange={(e) => setOrgDetails({ ...orgDetails, adminEmail: e.target.value })} disabled={isOrgSaved} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-medium disabled:bg-slate-100 disabled:text-slate-500" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Admin Mobile</label>
                    <input type="text" value={orgDetails.adminMobile} onChange={(e) => setOrgDetails({ ...orgDetails, adminMobile: e.target.value })} disabled={isOrgSaved} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-medium disabled:bg-slate-100 disabled:text-slate-500" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Subscription Type</label>
                    <select value={orgDetails.subscriptionType} onChange={(e) => setOrgDetails({ ...orgDetails, subscriptionType: e.target.value })} disabled={isOrgSaved} className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-medium disabled:bg-slate-100 disabled:text-slate-500">
                      <option>Free</option>
                      <option>Basic</option>
                      <option>Premium</option>
                      <option>Enterprise</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Active Users</label>
                    <input type="number" value={dbUsers.length} readOnly className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-medium bg-slate-100 text-slate-500" />
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  {isOrgSaved ? (
                    <button onClick={() => setIsOrgSaved(false)} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-sm hover:bg-indigo-700">
                      <i className="fa-solid fa-pen-to-square mr-2"></i>Edit Details
                    </button>
                  ) : (
                    <>
                      <button onClick={() => setIsOrgSaved(true)} className="bg-white border border-slate-200 text-slate-600 px-6 py-2.5 rounded-xl font-bold hover:bg-slate-50">Cancel</button>
                      <button onClick={saveOrgDetails} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-sm hover:bg-indigo-700">
                        <i className="fa-solid fa-floppy-disk mr-2"></i>Save Details
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
