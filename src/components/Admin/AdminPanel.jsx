import React, { useState, useMemo } from 'react';
import MemoizedAvatar from '../Common/MemoizedAvatar.jsx';
import { db } from '../../firebase.js';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

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
  handleAdminArchiveGroup,
  handleAdminRecoverGroup,
  handleGroupPicUpload,
}) {
  const [activeTab, setActiveTab] = useState('users');   // 'users' | 'groups' | 'logs' | 'tasks' | 'history'
  const [logSubTab, setLogSubTab] = useState('tasks');   // 'tasks' | 'messages'
  const [historyUserEmail, setHistoryUserEmail] = useState('');

  // ---- Add User form states ----
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserApprove, setNewUserApprove] = useState(true);

  // ---- Selection checkboxes for printing ----
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [selectedLogs, setSelectedLogs] = useState(new Set());
  const [selectedTasks, setSelectedTasks] = useState(new Set());

  // ---- LOGS TAB FILTERING ----
  const taskLogs = useMemo(() => filteredAuditLogs.filter(l => l.type.startsWith('TASK_')), [filteredAuditLogs]);
  const messageLogs = useMemo(() => filteredAuditLogs.filter(l => !l.type.startsWith('TASK_')), [filteredAuditLogs]);
  const currentLogs = logSubTab === 'tasks' ? taskLogs : messageLogs;

  // ---- HISTORY TAB FILTERING ----
  const userHistoryLogs = useMemo(() => {
    if (!historyUserEmail) return [];
    return filteredAuditLogs.filter(l => l.user === historyUserEmail).sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
  }, [filteredAuditLogs, historyUserEmail]);

  // ---- TASK TREE ----
  const taskMessages = useMemo(() => messages.filter(m => m.isTask), [messages]);
  const tasksByGroup = useMemo(() => {
    const map = {};
    taskMessages.forEach(task => {
      const groupId = task.groupId || 'direct';
      if (!map[groupId]) map[groupId] = [];
      map[groupId].push(task);
    });
    return map;
  }, [taskMessages]);

  const [expandedGroups, setExpandedGroups] = useState({});

  const getGroupName = (groupId) => {
    if (groupId === 'direct') return 'Direct Messages';
    const g = groups.find(gr => gr.id === groupId);
    return g ? g.name : groupId;
  };

  const openTaskTrail = (task) => {
    setSelectedMessage(task);
    setIsEditingTaskTitle(false);
    setActiveModal('task_trail');
  };

  // ---- SELECT ALL handlers ----
  const toggleSelectAllUsers = () => {
    if (selectedUsers.size === dbUsers.length) setSelectedUsers(new Set());
    else setSelectedUsers(new Set(dbUsers.map(u => u.uid)));
  };
  const toggleSelectUser = (uid) => {
    const newSet = new Set(selectedUsers);
    if (newSet.has(uid)) newSet.delete(uid); else newSet.add(uid);
    setSelectedUsers(newSet);
  };
  const toggleSelectAllLogs = () => {
    if (selectedLogs.size === currentLogs.length) setSelectedLogs(new Set());
    else setSelectedLogs(new Set(currentLogs.map(l => l.id)));
  };
  const toggleSelectLog = (id) => {
    const newSet = new Set(selectedLogs);
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    setSelectedLogs(newSet);
  };
  const toggleSelectAllTasks = () => {
    if (selectedTasks.size === taskMessages.length) setSelectedTasks(new Set());
    else setSelectedTasks(new Set(taskMessages.map(t => t.id)));
  };
  const toggleSelectTask = (id) => {
    const newSet = new Set(selectedTasks);
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    setSelectedTasks(newSet);
  };

  // ---- PRINT PDF FUNCTION ----
  const printSelectedPDF = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    doc.setFont('Inter');
    doc.setFontSize(16);
    doc.text('Talk & Task – Admin Report', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);

    let y = 40;
    if (activeTab === 'users') {
      const data = dbUsers.filter(u => selectedUsers.has(u.uid));
      doc.text('Selected Users', 14, y); y += 6;
      const tableData = data.map((u, i) => [i + 1, u.name, u.email, u.isApproved ? 'APPROVED' : 'PENDING']);
      doc.autoTable({ startY: y, head: [['#', 'Name', 'Email', 'Status']], body: tableData, styles: { fontSize: 9 }, headStyles: { fillColor: [79, 70, 229] } });
    } else if (activeTab === 'logs') {
      const data = currentLogs.filter(l => selectedLogs.has(l.id));
      doc.text(`Selected Logs – ${logSubTab === 'tasks' ? 'Task Logs' : 'Message Logs'}`, 14, y); y += 6;
      const tableData = data.map((l, i) => [i + 1, l.dateString + ' ' + l.time, l.type, (l.user || '').split('@')[0], l.content]);
      doc.autoTable({ startY: y, head: [['#', 'Time', 'Action', 'User', 'Details']], body: tableData, styles: { fontSize: 9 }, headStyles: { fillColor: [79, 70, 229] } });
    } else if (activeTab === 'tasks') {
      const data = taskMessages.filter(t => selectedTasks.has(t.id));
      doc.text('Selected Tasks', 14, y); y += 6;
      const tableData = data.map((t, i) => [i + 1, t.text, t.taskData?.status || 'Pending', t.taskData?.priority || 'Medium', getGroupName(t.groupId || 'direct')]);
      doc.autoTable({ startY: y, head: [['#', 'Task', 'Status', 'Priority', 'Team']], body: tableData, styles: { fontSize: 9 }, headStyles: { fillColor: [79, 70, 229] } });
    }
    doc.save(`admin_report_${activeTab}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // ---- ADD USER HANDLER ----
  const handleAddUser = async () => {
    if (!newUserEmail || !newUserName) return alert('Please enter email and name.');
    try {
      await addDoc(collection(db, "users"), {
        uid: `manual_${Date.now()}`,
        email: newUserEmail,
        name: newUserName,
        isApproved: newUserApprove,
        isAdmin: false,
        canCreateGroups: false,
        lastActive: serverTimestamp(),
        toolPreferences: { reply: true, react: true, edit: true, delete: true, pin: true, bookmark: true, showWatermark: true, soundProfile: 'classic' },
      });
      setNewUserEmail(''); setNewUserName(''); setShowAddUser(false);
      alert('User added successfully!');
    } catch (e) { alert('Failed to add user.'); }
  };

  return (
    <div className="flex flex-col h-full w-full bg-surface overflow-hidden animate-in fade-in z-40">
      {/* ---- HEADER ---- */}
      <div className="bg-primary px-4 py-3 flex items-center justify-between shadow-md shrink-0 safe-top">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur shadow-inner">
            <i className="fa-solid fa-shield-halved text-xl text-white"></i>
          </div>
          <h1 className="font-bold text-lg text-white tracking-wide">Admin Workspace</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={printSelectedPDF} className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm backdrop-blur border border-white/30">
            <i className="fa-solid fa-file-pdf"></i> Print Selected
          </button>
          <button onClick={() => setViewMode("chat")} className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm backdrop-blur border border-white/30">
            <i className="fa-solid fa-arrow-left"></i> Back to App
          </button>
        </div>
      </div>

      {/* ---- TAB NAVIGATION ---- */}
      <div className="flex gap-2 px-4 pt-4 bg-white border-b border-gray-200 flex-wrap">
        {['users', 'groups', 'logs', 'tasks', 'history'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 rounded-t-lg text-sm font-bold transition-colors ${
              activeTab === tab
                ? 'bg-surface text-primary border-b-2 border-primary'
                : 'text-text-secondary hover:text-primary hover:bg-gray-50'
            }`}
          >
            {tab === 'users' && <i className="fa-solid fa-users mr-2"></i>}
            {tab === 'groups' && <i className="fa-solid fa-people-group mr-2"></i>}
            {tab === 'logs' && <i className="fa-solid fa-list-check mr-2"></i>}
            {tab === 'tasks' && <i className="fa-solid fa-diagram-project mr-2"></i>}
            {tab === 'history' && <i className="fa-solid fa-clock-rotate-left mr-2"></i>}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* ---- CONTENT ---- */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-surface">
        {/* ===== USERS TAB ===== */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <h2 className="font-bold text-text-primary text-lg flex items-center gap-2">
                <i className="fa-solid fa-users text-primary"></i> User Control
              </h2>
              <button onClick={() => setShowAddUser(!showAddUser)} className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-primary-hover transition-colors">
                <i className="fa-solid fa-plus mr-2"></i> Add User
              </button>
            </div>
            {showAddUser && (
              <div className="p-5 bg-gray-50 border-b border-gray-200 flex flex-wrap gap-4 items-end">
                <div>
                  <label className="text-xs font-bold text-text-secondary block mb-1">Email</label>
                  <input type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="user@example.com" />
                </div>
                <div>
                  <label className="text-xs font-bold text-text-secondary block mb-1">Name</label>
                  <input type="text" value={newUserName} onChange={e => setNewUserName(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Full Name" />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={newUserApprove} onChange={e => setNewUserApprove(e.target.checked)} className="w-4 h-4 accent-primary" />
                  Approve immediately
                </label>
                <button onClick={handleAddUser} className="bg-success text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-teal-600 transition-colors">Save User</button>
                <button onClick={() => setShowAddUser(false)} className="bg-gray-200 text-text-secondary px-5 py-2 rounded-lg text-sm font-bold hover:bg-gray-300 transition-colors">Cancel</button>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-text-secondary text-xs uppercase">
                  <tr>
                    <th className="px-3 py-3"><input type="checkbox" onChange={toggleSelectAllUsers} checked={selectedUsers.size === dbUsers.length && dbUsers.length > 0} className="w-4 h-4 accent-primary" /></th>
                    <th className="px-3 py-3">#</th>
                    <th className="px-3 py-3">User</th>
                    <th className="px-3 py-3">Email</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-2 py-3 text-center">Admin</th>
                    <th className="px-2 py-3 text-center">Create Groups</th>
                    <th className="px-3 py-3 text-center">Login / Logout</th>
                    <th className="px-3 py-3 text-center">History</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dbUsers.map((u, idx) => (
                    <tr key={u.uid} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-3"><input type="checkbox" checked={selectedUsers.has(u.uid)} onChange={() => toggleSelectUser(u.uid)} className="w-4 h-4 accent-primary" /></td>
                      <td className="px-3 py-3 text-text-secondary">{idx + 1}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <MemoizedAvatar uid={u.uid} url={u.profilePicUrl} name={u.name} sizeClass="w-8 h-8" />
                          <span className="font-medium text-text-primary">{u.name}</span>
                          {u.isAdmin && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">ADMIN</span>}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-text-secondary">{u.email}</td>
                      <td className="px-3 py-3">
                        <button
                          onClick={() => handleToggleApprove(u)}
                          className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                            u.isApproved
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100'
                          }`}
                        >
                          {u.isApproved ? 'APPROVED' : 'PENDING'}
                        </button>
                      </td>
                      <td className="px-2 py-3 text-center">
                        <input type="checkbox" checked={u.isAdmin || false} onChange={() => handleToggleAdmin(u)} className="w-4 h-4 accent-primary" />
                      </td>
                      <td className="px-2 py-3 text-center">
                        <input type="checkbox" checked={u.canCreateGroups || false} onChange={() => handleToggleCanCreateGroups(u)} className="w-4 h-4 accent-primary" />
                      </td>
                      <td className="px-3 py-3 text-center text-[11px] text-text-secondary">
                        {u.lastLogin?.toDate ? new Date(u.lastLogin.toDate()).toLocaleString() : '—'}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => { setHistoryUserEmail(u.email); setActiveTab('history'); }}
                          className="text-primary hover:underline text-xs font-bold"
                        >
                          <i className="fa-solid fa-clock-rotate-left mr-1"></i>History
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========== GROUPS TAB ========== */}
        {activeTab === 'groups' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <h2 className="font-bold text-text-primary text-lg flex items-center gap-2">
                <i className="fa-solid fa-people-group text-primary mr-2"></i> Team Management
              </h2>
              <button
                onClick={() => { setGroupForm({ name: '', members: [], profilePicUrl: null }); setEditingGroup(null); setActiveModal('group_form_modal'); }}
                className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-primary-hover transition-colors"
              >
                <i className="fa-solid fa-plus mr-2"></i> Create Team
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
              {groups.map(g => (
                <div key={g.id} className="bg-surface border border-gray-200 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <MemoizedAvatar uid={g.id} url={g.profilePicUrl} name={g.name} sizeClass="w-10 h-10" isGroup={true} />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-text-primary truncate">{g.name}</h3>
                      <p className="text-xs text-text-secondary">{g.members?.length || 0} Members {g.isArchived && '· Archived'}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => { setGroupForm({ name: g.name, members: g.members, profilePicUrl: g.profilePicUrl }); setEditingGroup(g); setActiveModal('group_form_modal'); }}
                      className="flex-1 bg-gray-100 text-text-secondary py-2 rounded-lg text-xs font-bold hover:bg-gray-200"
                    >
                      <i className="fa-solid fa-pen mr-1"></i> Edit
                    </button>
                    <button
                      onClick={() => { setActiveModal('group_settings'); }}
                      className="flex-1 bg-gray-100 text-text-secondary py-2 rounded-lg text-xs font-bold hover:bg-gray-200"
                    >
                      <i className="fa-solid fa-users mr-1"></i> Members
                    </button>
                    {g.isArchived ? (
                      <button
                        onClick={() => { if (window.confirm('Recover this team?')) handleAdminRecoverGroup(g.id, g.name); }}
                        className="flex-1 bg-teal-50 text-teal-700 py-2 rounded-lg text-xs font-bold hover:bg-teal-100"
                      >
                        <i className="fa-solid fa-rotate-left mr-1"></i> Recover
                      </button>
                    ) : (
                      <button
                        onClick={() => { if (window.confirm('Archive this team?')) handleAdminArchiveGroup(g.id, g.name); }}
                        className="flex-1 bg-red-50 text-red-600 py-2 rounded-lg text-xs font-bold hover:bg-red-100"
                      >
                        <i className="fa-solid fa-box-archive mr-1"></i> Archive
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========== LOGS TAB ========== */}
        {activeTab === 'logs' && (
          <div className="flex flex-col gap-6">
            <div className="flex gap-2">
              {['tasks', 'messages'].map(sub => (
                <button
                  key={sub}
                  onClick={() => setLogSubTab(sub)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                    logSubTab === sub
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-white text-text-secondary border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <i className={`fa-solid ${sub === 'tasks' ? 'fa-check-square' : 'fa-comment'} mr-2`}></i>
                  {sub === 'tasks' ? 'Task Logs' : 'Message Logs'}
                </button>
              ))}
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[150px]">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block mb-1.5">By User</label>
                  <select value={adminFilterUser} onChange={e => setAdminFilterUser(e.target.value)} className="w-full p-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-primary/20 transition-all">
                    <option value="">All Users</option>
                    {dbUsers.map(u => <option key={u.uid} value={u.email}>{u.name}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block mb-1.5">By Type</label>
                  <select value={adminFilterType} onChange={e => setAdminFilterType(e.target.value)} className="w-full p-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-primary/20 transition-all">
                    <option value="">All Types</option>
                    <option value="MESSAGE_CREATE">Public Messages</option>
                    <option value="MESSAGE_EDIT">Edited Messages</option>
                    <option value="MESSAGE_DELETE">Deleted Messages</option>
                    <option value="REACTION">Reactions</option>
                    <option value="TASK_CREATE">Tasks Created</option>
                    <option value="TASK_DELEGATE">Tasks Delegated</option>
                    <option value="TASK_COMPLETE">Tasks Completed</option>
                    <option value="TASK_COMMENT">Tasks Commented</option>
                    <option value="GROUP_ARCHIVE">Group Archived</option>
                    <option value="GROUP_RECOVER">Group Recovered</option>
                  </select>
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block mb-1.5">By Group</label>
                  <select value={adminFilterGroup} onChange={e => setAdminFilterGroup(e.target.value)} className="w-full p-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-primary/20 transition-all">
                    <option value="">All Groups</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name} {g.isArchived ? '(Archived)' : ''}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block mb-1.5">By Date</label>
                  <input type="date" value={adminFilterDate} onChange={e => setAdminFilterDate(e.target.value)} className="w-full p-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                </div>
              </div>
              <button
                onClick={() => { setAdminFilterUser(""); setAdminFilterDate(""); setAdminFilterType(""); setAdminFilterGroup(""); }}
                className="mt-4 bg-gray-100 text-text-secondary px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-200 transition-colors"
              >
                Clear Filters
              </button>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-text-secondary text-xs uppercase">
                    <tr>
                      <th className="px-3 py-3"><input type="checkbox" onChange={toggleSelectAllLogs} checked={selectedLogs.size === currentLogs.length && currentLogs.length > 0} className="w-4 h-4 accent-primary" /></th>
                      <th className="px-3 py-3">#</th>
                      <th className="px-3 py-3">Time</th>
                      <th className="px-3 py-3">Action</th>
                      <th className="px-3 py-3">Initiated By</th>
                      <th className="px-3 py-3">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {currentLogs.length === 0 && (
                      <tr><td colSpan={6} className="px-5 py-8 text-center text-text-secondary italic">No records found.</td></tr>
                    )}
                    {currentLogs.map((log, idx) => (
                      <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-3"><input type="checkbox" checked={selectedLogs.has(log.id)} onChange={() => toggleSelectLog(log.id)} className="w-4 h-4 accent-primary" /></td>
                        <td className="px-3 py-3 text-text-secondary">{idx + 1}</td>
                        <td className="px-3 py-3">
                          <div className="text-xs text-text-secondary">{log.dateString}</div>
                          <div className="text-[11px] text-text-secondary">{log.time}</div>
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-[11px] font-bold bg-white text-text-primary px-2.5 py-1 rounded-full border border-gray-200 shadow-sm">{log.type}</span>
                        </td>
                        <td className="px-3 py-3 font-medium text-text-primary">{(log.user || '').split('@')[0]}</td>
                        <td className="px-3 py-3">
                          <div className="text-text-primary whitespace-pre-wrap leading-relaxed">{log.content}</div>
                          {log.target && <div className="text-[10px] font-bold text-primary mt-1 uppercase tracking-wider">{log.target}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===== TASKS TREE TAB ===== */}
        {activeTab === 'tasks' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-text-primary text-lg flex items-center gap-2">
                  <i className="fa-solid fa-diagram-project text-primary"></i> Organisation Task Tree
                </h2>
                <span className="text-sm text-text-secondary">{taskMessages.length} total tasks</span>
              </div>
              <div className="space-y-4">
                {Object.keys(tasksByGroup).length === 0 ? (
                  <p className="text-sm text-text-secondary text-center py-8">No tasks assigned yet.</p>
                ) : (
                  Object.entries(tasksByGroup).map(([groupId, tasks]) => {
                    const isExpanded = expandedGroups[groupId] !== false;
                    return (
                      <div key={groupId} className="border border-gray-200 rounded-xl overflow-hidden">
                        <button
                          onClick={() => setExpandedGroups(prev => ({ ...prev, [groupId]: !isExpanded }))}
                          className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <i className={`fa-solid fa-chevron-${isExpanded ? 'down' : 'right'} text-text-secondary text-sm`}></i>
                            <span className="font-bold text-sm text-text-primary">{getGroupName(groupId)}</span>
                            <span className="text-xs bg-white text-text-secondary px-2 py-0.5 rounded-full border">
                              {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {tasks.map((task, idx) => (
                              <div
                                key={task.id}
                                onClick={() => openTaskTrail(task)}
                                className="bg-surface border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                              >
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="text-xs font-bold text-text-secondary bg-white px-2 py-0.5 rounded-full border">{idx + 1}</span>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    task.taskData?.status === 'Completed' ? 'bg-teal-100 text-teal-700' :
                                    task.taskData?.status === 'In Progress' ? 'bg-indigo-100 text-indigo-700' :
                                    'bg-amber-100 text-amber-700'
                                  }`}>{task.taskData?.status || 'Pending'}</span>
                                  {task.taskData?.priority && (
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      task.taskData.priority === 'High' ? 'bg-red-100 text-red-700' :
                                      task.taskData.priority === 'Medium' ? 'bg-amber-100 text-amber-700' :
                                      'bg-green-100 text-green-700'
                                    }`}>{task.taskData.priority}</span>
                                  )}
                                </div>
                                <p className="text-sm font-semibold text-text-primary line-clamp-2 mb-3 group-hover:text-primary transition-colors">{task.text}</p>
                                <div className="flex items-center justify-between text-[11px] text-text-secondary">
                                  <div className="flex items-center -space-x-1.5">
                                    {(task.taskData?.assignees || []).slice(0, 3).map(email => {
                                      const assignee = dbUsers.find(u => u.email === email);
                                      return <MemoizedAvatar key={email} uid={assignee?.uid || email} url={assignee?.profilePicUrl} name={assignee?.name || email.split('@')[0]} sizeClass="w-6 h-6" extraClasses="border border-white" />;
                                    })}
                                  </div>
                                  <span className="flex items-center gap-1"><i className="fa-regular fa-calendar"></i> {new Date(task.taskData?.deadline).toLocaleDateString()}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-bold text-text-primary text-lg mb-4">Select tasks to print</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
                {taskMessages.map(task => (
                  <label key={task.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={selectedTasks.has(task.id)} onChange={() => toggleSelectTask(task.id)} className="w-4 h-4 accent-primary" />
                    <span className="truncate">{task.text}</span>
                  </label>
                ))}
              </div>
              <button onClick={printSelectedPDF} className="bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-primary-hover transition-colors">Print Selected Tasks</button>
            </div>
          </div>
        )}

        {/* ========== HISTORY TAB ========== */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-bold text-text-primary text-lg flex items-center gap-2">
                <i className="fa-solid fa-clock-rotate-left text-primary mr-2"></i> User Activity History
              </h2>
            </div>
            <div className="p-5 bg-gray-50 border-b border-gray-200">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block mb-1.5">Select User</label>
                  <select
                    value={historyUserEmail}
                    onChange={e => setHistoryUserEmail(e.target.value)}
                    className="w-full p-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  >
                    <option value="">Select a user...</option>
                    {dbUsers.map(u => <option key={u.uid} value={u.email}>{u.name} ({u.email})</option>)}
                  </select>
                </div>
                <button
                  onClick={() => setHistoryUserEmail('')}
                  className="bg-gray-100 text-text-secondary px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-200 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-text-secondary text-xs uppercase">
                  <tr>
                    <th className="px-5 py-3">#</th>
                    <th className="px-5 py-3">Time</th>
                    <th className="px-5 py-3">Action</th>
                    <th className="px-5 py-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {userHistoryLogs.length === 0 && (
                    <tr><td colSpan={4} className="px-5 py-8 text-center text-text-secondary italic">
                      {historyUserEmail ? 'No activity found for this user.' : 'Select a user above.'}
                    </td></tr>
                  )}
                  {userHistoryLogs.map((log, idx) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-text-secondary">{idx + 1}</td>
                      <td className="px-5 py-3">
                        <div className="text-xs text-text-secondary">{log.dateString}</div>
                        <div className="text-[11px] text-text-secondary">{log.time}</div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-[11px] font-bold bg-white text-text-primary px-2.5 py-1 rounded-full border border-gray-200 shadow-sm">{log.type}</span>
                      </td>
                      <td className="px-5 py-3 text-text-primary">{log.content}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
