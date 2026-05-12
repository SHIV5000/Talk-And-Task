import React, { useState, useMemo } from 'react';
import MemoizedAvatar from '../Common/MemoizedAvatar.jsx';
import { db } from '../../firebase.js';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

/* ---------- helper: recursive tree node ---------- */
function TreeNode({ node, depth, dbUsers, openTaskTrail, allExpanded }) {
  const [localExpanded, setLocalExpanded] = useState(true);
  const isExpanded = allExpanded !== undefined ? allExpanded : localExpanded;
  const toggle = () => setLocalExpanded(prev => !prev);

  const hasChildren = node.children && node.children.length > 0;
  const isTask = node.type === 'task';

  return (
    <div className="relative">
      {depth > 0 && (
        <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" style={{ left: `${12 + (depth - 1) * 20}px` }}></div>
      )}

      <div className="flex items-start gap-2 py-1" style={{ paddingLeft: `${depth * 20}px` }}>
        {hasChildren ? (
          <button onClick={toggle} className="w-5 h-5 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center shrink-0 mt-0.5 text-xs text-text-secondary transition-colors">
            <i className={`fa-solid fa-chevron-${isExpanded ? 'down' : 'right'} text-[10px]`}></i>
          </button>
        ) : (
          <span className="w-5 shrink-0"></span>
        )}

        {isTask ? (
          <div
            onClick={() => openTaskTrail(node.task)}
            className="flex-1 bg-surface border border-gray-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                node.task.taskData?.status === 'Completed' ? 'bg-teal-100 text-teal-700' :
                node.task.taskData?.status === 'In Progress' ? 'bg-indigo-100 text-indigo-700' :
                'bg-amber-100 text-amber-700'
              }`}>{node.task.taskData?.status || 'Pending'}</span>
              {node.task.taskData?.priority && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  node.task.taskData.priority === 'High' ? 'bg-red-100 text-red-700' :
                  node.task.taskData.priority === 'Medium' ? 'bg-amber-100 text-amber-700' :
                  'bg-green-100 text-green-700'
                }`}>{node.task.taskData.priority}</span>
              )}
              <span className="text-[10px] text-text-secondary ml-auto flex items-center gap-1">
                <i className="fa-regular fa-calendar"></i> {new Date(node.task.taskData?.deadline).toLocaleDateString()}
              </span>
            </div>
            <p className="text-sm font-semibold text-text-primary line-clamp-2 group-hover:text-primary transition-colors">{node.name}</p>
            <div className="flex items-center -space-x-1.5 mt-2">
              {(node.task.taskData?.assignees || []).slice(0, 3).map(email => {
                const assignee = dbUsers.find(u => u.email === email);
                return <MemoizedAvatar key={email} uid={assignee?.uid || email} url={assignee?.profilePicUrl} name={assignee?.name || email.split('@')[0]} sizeClass="w-5 h-5" extraClasses="border border-white" />;
              })}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center gap-2">
            <i className={`fa-solid ${node.type === 'org' ? 'fa-building text-primary' : 'fa-people-group text-indigo-400'} text-sm`}></i>
            <span className="font-bold text-sm text-text-primary">{node.name}</span>
            <span className="text-xs text-text-secondary">({node.children?.length || 0})</span>
          </div>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div>
          {node.children.map(child => (
            <TreeNode key={child.id} node={child} depth={depth + 1} dbUsers={dbUsers} openTaskTrail={openTaskTrail} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ==================== ADMIN PANEL ==================== */
export default function AdminPanel({
  setViewMode, setActiveModal, dbUsers, groups, filteredAuditLogs,
  adminFilterUser, setAdminFilterUser, adminFilterDate, setAdminFilterDate,
  adminFilterType, setAdminFilterType, adminFilterGroup, setAdminFilterGroup,
  handleToggleApprove, handleToggleAdmin, handleToggleCanCreateGroups,
  setSelectedMessage, setIsEditingTaskTitle, messages,
  setGroupForm, setEditingGroup, editingGroup, groupForm,
  handleGroupSubmit, handleAdminArchiveGroup, handleAdminRecoverGroup,
  handleGroupPicUpload, groupPicUploadProgress
}) { 
  const [activeTab, setActiveTab] = useState('users');
  const [logSubTab, setLogSubTab] = useState('tasks');
  const [historyUserEmail, setHistoryUserEmail] = useState('');

  // Add User form
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserApprove, setNewUserApprove] = useState(true);

  // Print Selection
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [selectedLogs, setSelectedLogs] = useState(new Set());
  const [selectedHistory, setSelectedHistory] = useState(new Set());

  // Archive filter
  const [showArchivedUsers, setShowArchivedUsers] = useState(false);
  
  // Inline Overlays
  const [localOverlay, setLocalOverlay] = useState(null); 
  const [selectedTaskNode, setSelectedTaskNode] = useState(null);

  // Log filtering
  const taskLogs = useMemo(() => filteredAuditLogs.filter(l => l.type.startsWith('TASK_')), [filteredAuditLogs]);
  const messageLogs = useMemo(() => filteredAuditLogs.filter(l => !l.type.startsWith('TASK_')), [filteredAuditLogs]);
  const currentLogs = logSubTab === 'tasks' ? taskLogs : messageLogs;

  const userHistoryLogs = useMemo(() => {
    if (!historyUserEmail) return [];
    return filteredAuditLogs.filter(l => l.user === historyUserEmail).sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
  }, [filteredAuditLogs, historyUserEmail]);

  const filteredUsers = useMemo(() => {
    return dbUsers.filter(u => showArchivedUsers ? u.isArchived : !u.isArchived);
  }, [dbUsers, showArchivedUsers]);

  // ---------- TASK TREE ----------
  const taskMessages = useMemo(() => messages.filter(m => m.isTask), [messages]);

  const treeData = useMemo(() => {
    const root = { id: 'org', name: '🏢 Organisation', type: 'org', children: [] };
    const groupMap = {};
    taskMessages.forEach(task => {
      const gid = task.groupId || 'direct';
      if (!groupMap[gid]) groupMap[gid] = [];
      groupMap[gid].push(task);
    });

    Object.entries(groupMap).forEach(([gid, tasks]) => {
      const group = groups.find(g => g.id === gid);
      const groupName = group ? group.name : (gid === 'direct' ? 'Direct Messages' : gid);
      const teamNode = { id: gid, name: `📁 ${groupName}`, type: 'team', children: [] };

      tasks.forEach(task => {
        teamNode.children.push({
          id: task.id, name: task.text || 'Untitled Task', type: 'task', task, children: [],
        });
      });
      root.children.push(teamNode);
    });

    return root;
  }, [taskMessages, groups]);

  const openTaskTrail = (task) => {
    setSelectedTaskNode(task);
    setLocalOverlay('task_trail');
  };

  // Selection handlers
  const toggleSelectAllUsers = () => {
    if (selectedUsers.size === filteredUsers.length) setSelectedUsers(new Set());
    else setSelectedUsers(new Set(filteredUsers.map(u => u.uid)));
  };
  const toggleSelectUser = (uid) => {
    const s = new Set(selectedUsers); s.has(uid) ? s.delete(uid) : s.add(uid); setSelectedUsers(s);
  };
  const toggleSelectAllLogs = () => {
    if (selectedLogs.size === currentLogs.length) setSelectedLogs(new Set());
    else setSelectedLogs(new Set(currentLogs.map(l => l.id)));
  };
  const toggleSelectLog = (id) => {
    const s = new Set(selectedLogs); s.has(id) ? s.delete(id) : s.add(id); setSelectedLogs(s);
  };
  const toggleSelectAllHistory = () => {
    if (selectedHistory.size === userHistoryLogs.length) setSelectedHistory(new Set());
    else setSelectedHistory(new Set(userHistoryLogs.map(l => l.id)));
  };
  const toggleSelectHistory = (id) => {
    const s = new Set(selectedHistory); s.has(id) ? s.delete(id) : s.add(id); setSelectedHistory(s);
  };

  // ---------- PRINT PDF ----------
  const printSelectedPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    doc.setFont('Inter'); doc.setFontSize(16); doc.text('Talk & Task – Admin Report', 14, 20); doc.setFontSize(10); doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);
    let y = 40;

    if (activeTab === 'users') {
      const data = filteredUsers.filter(u => selectedUsers.has(u.uid));
      doc.text('Selected Users', 14, y); y += 6;
      doc.autoTable({ startY: y, head: [['#', 'Name', 'Email', 'Status']], body: data.map((u, i) => [i + 1, u.name, u.email, u.isApproved ? 'APPROVED' : 'PENDING']), styles: { fontSize: 9 }, headStyles: { fillColor: [79, 70, 229] } });
    } else if (activeTab === 'logs') {
      const data = currentLogs.filter(l => selectedLogs.has(l.id));
      doc.text(`Logs – ${logSubTab === 'tasks' ? 'Task' : 'Message'}`, 14, y); y += 6;
      doc.autoTable({ startY: y, head: [['#', 'Time', 'Action', 'User', 'Details']], body: data.map((l, i) => [i + 1, l.dateString + ' ' + l.time, l.type, (l.user || '').split('@')[0], l.content]), styles: { fontSize: 9 }, headStyles: { fillColor: [79, 70, 229] } });
    } else if (activeTab === 'history') {
      const data = userHistoryLogs.filter(l => selectedHistory.has(l.id));
      doc.text(`User Activity History – ${historyUserEmail || 'All'}`, 14, y); y += 6;
      doc.autoTable({ startY: y, head: [['#', 'Time', 'Action', 'Details']], body: data.map((l, i) => [i + 1, l.dateString + ' ' + l.time, l.type, l.content]), styles: { fontSize: 9 }, headStyles: { fillColor: [79, 70, 229] } });
    }
    doc.save(`admin_report_${activeTab}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleAddUser = async () => {
    if (!newUserEmail || !newUserName) return alert('Please enter email and name.');
    try {
      await addDoc(collection(db, "users"), { uid: `manual_${Date.now()}`, email: newUserEmail, name: newUserName, isApproved: newUserApprove, isAdmin: false, canCreateGroups: false, isArchived: false, lastActive: serverTimestamp(), toolPreferences: { reply: true, react: true, edit: true, delete: true, pin: true, bookmark: true, showWatermark: true, soundProfile: 'classic' } });
      setNewUserEmail(''); setNewUserName(''); setShowAddUser(false); alert('User added successfully!');
    } catch (e) { alert('Failed to add user.'); }
  };

  const handleToggleArchiveUser = async (u) => {
    try { const { updateDoc, doc } = await import('firebase/firestore'); await updateDoc(doc(db, "users", u.uid), { isArchived: !u.isArchived }); } catch (e) { alert('Failed to update user.'); }
  };

  return (
    <div className="flex flex-col h-full w-full bg-surface overflow-hidden animate-in fade-in z-40 relative">
      <div className="bg-primary px-4 py-3 flex items-center justify-between shadow-md shrink-0 safe-top">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur shadow-inner"><i className="fa-solid fa-shield-halved text-xl text-white"></i></div>
          <h1 className="font-bold text-lg text-white tracking-wide">Admin Workspace</h1>
        </div>
        <div className="flex items-center gap-2">
          {['users', 'logs', 'history'].includes(activeTab) && (
            <button onClick={printSelectedPDF} className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm backdrop-blur border border-white/30">
              <i className="fa-solid fa-file-pdf"></i> Print Selected
            </button>
          )}
          <button onClick={() => { setActiveModal(null); setViewMode("chat"); }} className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm backdrop-blur border border-white/30">
            <i className="fa-solid fa-arrow-left"></i> Back to App
          </button>
        </div>
      </div>

      <div className="flex gap-2 px-4 pt-4 bg-white border-b border-gray-200 flex-wrap">
        {['users', 'groups', 'logs', 'tasks', 'history'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-5 py-2.5 rounded-t-lg text-sm font-bold transition-colors ${activeTab === tab ? 'bg-surface text-primary border-b-2 border-primary' : 'text-text-secondary hover:text-primary hover:bg-gray-50'}`}>
            {tab === 'users' && <i className="fa-solid fa-users mr-2"></i>}{tab === 'groups' && <i className="fa-solid fa-people-group mr-2"></i>}{tab === 'logs' && <i className="fa-solid fa-list-check mr-2"></i>}{tab === 'tasks' && <i className="fa-solid fa-diagram-project mr-2"></i>}{tab === 'history' && <i className="fa-solid fa-clock-rotate-left mr-2"></i>}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-surface relative">
        {activeTab === 'users' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center flex-wrap gap-3">
              <h2 className="font-bold text-text-primary text-lg"><i className="fa-solid fa-users text-primary mr-2"></i>User Control</h2>
              <div className="flex gap-2">
                <button onClick={() => setShowArchivedUsers(!showArchivedUsers)} className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${showArchivedUsers ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-text-secondary'}`}>
                  <i className={`fa-solid ${showArchivedUsers ? 'fa-eye' : 'fa-box-archive'} mr-2`}></i>{showArchivedUsers ? 'Show Active' : 'Show Archived'}
                </button>
                <button onClick={() => setShowAddUser(!showAddUser)} className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-primary-hover"><i className="fa-solid fa-plus mr-2"></i>Add User</button>
              </div>
            </div>
            {showAddUser && (
              <div className="p-5 bg-gray-50 border-b border-gray-200 flex flex-wrap gap-4 items-end">
                <div><label className="text-xs font-bold text-text-secondary block mb-1">Email</label><input type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="user@example.com" /></div>
                <div><label className="text-xs font-bold text-text-secondary block mb-1">Name</label><input type="text" value={newUserName} onChange={e => setNewUserName(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Full Name" /></div>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={newUserApprove} onChange={e => setNewUserApprove(e.target.checked)} className="w-4 h-4 accent-primary" />Approve immediately</label>
                <button onClick={handleAddUser} className="bg-success text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-teal-600">Save</button>
                <button onClick={() => setShowAddUser(false)} className="bg-gray-200 text-text-secondary px-5 py-2 rounded-lg text-sm font-bold hover:bg-gray-300">Cancel</button>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-text-secondary text-xs uppercase">
                  <tr><th className="px-3 py-3"><input type="checkbox" onChange={toggleSelectAllUsers} checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0} className="w-4 h-4 accent-primary" /></th><th className="px-3 py-3">#</th><th className="px-3 py-3">User</th><th className="px-3 py-3">Email</th><th className="px-3 py-3">Status</th><th className="px-2 py-3 text-center">Admin</th><th className="px-2 py-3 text-center">Groups</th><th className="px-3 py-3 text-center">Login</th><th className="px-3 py-3 text-center">Archive</th><th className="px-3 py-3 text-center">History</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredUsers.map((u, idx) => (
                    <tr key={u.uid} className={`hover:bg-gray-50 ${u.isArchived ? 'opacity-60' : ''}`}>
                      <td className="px-3 py-3"><input type="checkbox" checked={selectedUsers.has(u.uid)} onChange={() => toggleSelectUser(u.uid)} className="w-4 h-4 accent-primary" /></td>
                      <td className="px-3 py-3 text-text-secondary">{idx + 1}</td>
                      <td className="px-3 py-3"><div className="flex items-center gap-2"><MemoizedAvatar uid={u.uid} url={u.profilePicUrl} name={u.name} sizeClass="w-7 h-7" /><span className="font-medium text-text-primary">{u.name}</span>{u.isAdmin && <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">ADMIN</span>}</div></td>
                      <td className="px-3 py-3 text-text-secondary">{u.email}</td>
                      <td className="px-3 py-3"><button onClick={() => handleToggleApprove(u)} className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${u.isApproved ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-orange-50 text-orange-700 border border-orange-200'}`}>{u.isApproved ? 'APPROVED' : 'PENDING'}</button></td>
                      <td className="px-2 py-3 text-center"><input type="checkbox" checked={u.isAdmin || false} onChange={() => handleToggleAdmin(u)} className="w-4 h-4 accent-primary" /></td>
                      <td className="px-2 py-3 text-center"><input type="checkbox" checked={u.canCreateGroups || false} onChange={() => handleToggleCanCreateGroups(u)} className="w-4 h-4 accent-primary" /></td>
                      <td className="px-3 py-3 text-center text-[11px] text-text-secondary">{u.lastLogin?.toDate ? new Date(u.lastLogin.toDate()).toLocaleString() : '—'}</td>
                      <td className="px-3 py-3 text-center"><button onClick={() => handleToggleArchiveUser(u)} className={`text-xs font-bold ${u.isArchived ? 'text-teal-600 hover:text-teal-800' : 'text-amber-600 hover:text-amber-800'}`}><i className={`fa-solid ${u.isArchived ? 'fa-rotate-left' : 'fa-box-archive'}`}></i></button></td>
                      <td className="px-3 py-3 text-center"><button onClick={() => { setHistoryUserEmail(u.email); setActiveTab('history'); }} className="text-primary hover:underline text-xs font-bold"><i className="fa-solid fa-clock-rotate-left mr-1"></i>History</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'groups' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <h2 className="font-bold text-text-primary text-lg"><i className="fa-solid fa-people-group text-primary mr-2"></i>Team Management</h2>
              <button onClick={() => { setGroupForm({ name: '', members: [], profilePicUrl: null }); setEditingGroup(null); setLocalOverlay('group_form'); }} className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-primary-hover"><i className="fa-solid fa-plus mr-2"></i>Create Team</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
              {groups.map(g => (
                <div key={g.id} className="bg-surface border border-gray-200 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <MemoizedAvatar uid={g.id} url={g.profilePicUrl} name={g.name} sizeClass="w-10 h-10" isGroup={true} />
                    <div className="flex-1 min-w-0"><h3 className="font-bold text-text-primary truncate">{g.name}</h3><p className="text-xs text-text-secondary">{g.members?.length || 0} Members {g.isArchived && '· Archived'}</p></div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => { setGroupForm({ name: g.name, members: g.members, profilePicUrl: g.profilePicUrl }); setEditingGroup(g); setLocalOverlay('group_form'); }} className="flex-1 bg-gray-100 text-text-secondary py-2 rounded-lg text-xs font-bold hover:bg-gray-200"><i className="fa-solid fa-pen mr-1"></i>Edit</button>
                    {g.isArchived ? (
                      <button onClick={() => { if (window.confirm('Recover?')) handleAdminRecoverGroup(g.id, g.name); }} className="flex-1 bg-teal-50 text-teal-700 py-2 rounded-lg text-xs font-bold hover:bg-teal-100"><i className="fa-solid fa-rotate-left mr-1"></i>Recover</button>
                    ) : (
                      <button onClick={() => { if (window.confirm('Archive?')) handleAdminArchiveGroup(g.id, g.name); }} className="flex-1 bg-red-50 text-red-600 py-2 rounded-lg text-xs font-bold hover:bg-red-100"><i className="fa-solid fa-box-archive mr-1"></i>Archive</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="flex flex-col gap-6">
            <div className="flex gap-2">
              {['tasks', 'messages'].map(sub => (
                <button key={sub} onClick={() => setLogSubTab(sub)} className={`px-4 py-2 rounded-lg text-sm font-bold ${logSubTab === sub ? 'bg-primary text-white shadow-sm' : 'bg-white text-text-secondary border border-gray-200 hover:bg-gray-50'}`}><i className={`fa-solid ${sub === 'tasks' ? 'fa-check-square' : 'fa-comment'} mr-2`}></i>{sub === 'tasks' ? 'Task Logs' : 'Message Logs'}</button>
              ))}
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[150px]"><label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block mb-1.5">By User</label><select value={adminFilterUser} onChange={e => setAdminFilterUser(e.target.value)} className="w-full p-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-primary/20"><option value="">All Users</option>{dbUsers.map(u => <option key={u.uid} value={u.email}>{u.name}</option>)}</select></div>
                <div className="flex-1 min-w-[150px]"><label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block mb-1.5">By Type</label><select value={adminFilterType} onChange={e => setAdminFilterType(e.target.value)} className="w-full p-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-primary/20"><option value="">All Types</option><option value="MESSAGE_CREATE">Public</option><option value="MESSAGE_EDIT">Edited</option><option value="MESSAGE_DELETE">Deleted</option><option value="REACTION">Reactions</option><option value="TASK_CREATE">Tasks Created</option><option value="TASK_DELEGATE">Delegated</option><option value="TASK_COMPLETE">Completed</option><option value="TASK_COMMENT">Commented</option></select></div>
                <div className="flex-1 min-w-[150px]"><label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block mb-1.5">By Group</label><select value={adminFilterGroup} onChange={e => setAdminFilterGroup(e.target.value)} className="w-full p-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-primary/20"><option value="">All Groups</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
                <div className="flex-1 min-w-[150px]"><label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block mb-1.5">By Date</label><input type="date" value={adminFilterDate} onChange={e => setAdminFilterDate(e.target.value)} className="w-full p-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-primary/20" /></div>
              </div>
              <button onClick={() => { setAdminFilterUser(""); setAdminFilterDate(""); setAdminFilterType(""); setAdminFilterGroup(""); }} className="mt-4 bg-gray-100 text-text-secondary px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-200">Clear Filters</button>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-text-secondary text-xs uppercase"><tr><th className="px-3 py-3"><input type="checkbox" onChange={toggleSelectAllLogs} checked={selectedLogs.size === currentLogs.length && currentLogs.length > 0} className="w-4 h-4 accent-primary" /></th><th className="px-3 py-3">#</th><th className="px-3 py-3">Time</th><th className="px-3 py-3">Action</th><th className="px-3 py-3">Initiated By</th><th className="px-3 py-3">Details</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {currentLogs.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-text-secondary italic">No records found.</td></tr>}
                    {currentLogs.map((log, idx) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-3 py-3"><input type="checkbox" checked={selectedLogs.has(log.id)} onChange={() => toggleSelectLog(log.id)} className="w-4 h-4 accent-primary" /></td>
                        <td className="px-3 py-3 text-text-secondary">{idx + 1}</td>
                        <td className="px-3 py-3"><div className="text-xs text-text-secondary">{log.dateString}</div><div className="text-[11px] text-text-secondary">{log.time}</div></td>
                        <td className="px-3 py-3"><span className="text-[11px] font-bold bg-white text-text-primary px-2.5 py-1 rounded-full border border-gray-200 shadow-sm">{log.type}</span></td>
                        <td className="px-3 py-3 font-medium text-text-primary">{(log.user || '').split('@')[0]}</td>
                        <td className="px-3 py-3"><div className="text-text-primary whitespace-pre-wrap leading-relaxed">{log.content}</div>{log.target && <div className="text-[10px] font-bold text-primary mt-1 uppercase tracking-wider">{log.target}</div>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold text-text-primary text-lg flex items-center gap-2"><i className="fa-solid fa-diagram-project text-primary"></i> Organisation Task Tree</h2>
              <span className="text-sm text-text-secondary">{taskMessages.length} tasks across {treeData.children.length} teams</span>
            </div>
            {treeData.children.length === 0 ? <p className="text-sm text-text-secondary text-center py-12">No tasks assigned yet.</p> : <TreeNode node={treeData} depth={0} dbUsers={dbUsers} openTaskTrail={openTaskTrail} allExpanded={true} />}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-5 border-b border-gray-100"><h2 className="font-bold text-text-primary text-lg"><i className="fa-solid fa-clock-rotate-left text-primary mr-2"></i>User Activity History</h2></div>
            <div className="p-5 bg-gray-50 border-b border-gray-200">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]"><label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block mb-1.5">Select User</label><select value={historyUserEmail} onChange={e => setHistoryUserEmail(e.target.value)} className="w-full p-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-primary/20"><option value="">Select a user...</option>{dbUsers.map(u => <option key={u.uid} value={u.email}>{u.name} ({u.email})</option>)}</select></div>
                <button onClick={() => setHistoryUserEmail('')} className="bg-gray-100 text-text-secondary px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-200">Clear</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-text-secondary text-xs uppercase"><tr><th className="px-5 py-3"><input type="checkbox" onChange={toggleSelectAllHistory} checked={selectedHistory.size === userHistoryLogs.length && userHistoryLogs.length > 0} className="w-4 h-4 accent-primary" /></th><th className="px-5 py-3">#</th><th className="px-5 py-3">Time</th><th className="px-5 py-3">Action</th><th className="px-5 py-3">Details</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {userHistoryLogs.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-text-secondary italic">{historyUserEmail ? 'No activity found.' : 'Select a user above.'}</td></tr>}
                  {userHistoryLogs.map((log, idx) => (
                    <tr key={log.id} className="hover:bg-gray-50"><td className="px-5 py-3"><input type="checkbox" checked={selectedHistory.has(log.id)} onChange={() => toggleSelectHistory(log.id)} className="w-4 h-4 accent-primary" /></td><td className="px-5 py-3 text-text-secondary">{idx + 1}</td><td className="px-5 py-3"><div className="text-xs text-text-secondary">{log.dateString}</div><div className="text-[11px] text-text-secondary">{log.time}</div></td><td className="px-5 py-3"><span className="text-[11px] font-bold bg-white text-text-primary px-2.5 py-1 rounded-full border border-gray-200 shadow-sm">{log.type}</span></td><td className="px-5 py-3 text-text-primary">{log.content}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================== INLINE OVERLAYS ==================== */}
        
        {localOverlay === 'group_form' && (
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-6 animate-in fade-in zoom-in-[0.98] duration-200">
             <div className="max-w-2xl w-full bg-white border border-slate-100 shadow-2xl rounded-3xl flex flex-col overflow-hidden max-h-[95vh] md:max-h-[90vh]">
                <div className="p-5 md:p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                   <h3 className="font-extrabold text-xl text-slate-800 tracking-tight">{editingGroup ? 'Edit Team Details' : 'Create New Team'}</h3>
                   <button onClick={() => setLocalOverlay(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors">
                     <i className="fa-solid fa-xmark"></i>
                   </button>
                </div>
                <div className="p-5 md:p-6 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 hover:scrollbar-thumb-slate-300 scrollbar-track-transparent custom-sidebar-scroll">
                   {/* 👇 FIX: No longer a <form> tag to prevent accidental submission crashing */}
                   <div className="space-y-6">
                      <div>
                         <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Team Name</label>
                         <input value={groupForm.name} onChange={e => setGroupForm({...groupForm, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-slate-800 font-medium" placeholder="e.g. Marketing Team" required />
                      </div>
                      <div>
                         <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Team Avatar</label>
                         <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                           <input type="file" onChange={handleGroupPicUpload} className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all cursor-pointer" />
                           {groupPicUploadProgress > 0 && <span className="text-xs font-bold text-primary animate-pulse">{Math.round(groupPicUploadProgress)}%</span>}
                         </div>
                      </div>
                      <div>
                         <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Select Members</label>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border border-slate-200 p-4 rounded-xl max-h-56 overflow-y-auto bg-slate-50 scrollbar-thin scrollbar-thumb-slate-200 custom-sidebar-scroll">
                            {dbUsers.map(u => (
                               <label key={u.uid} className="flex items-center gap-3 text-sm bg-white p-3 border border-slate-100 rounded-xl shadow-sm cursor-pointer hover:border-primary/40 hover:shadow transition-all group">
                                  <div className="relative flex items-center justify-center">
                                    <input type="checkbox" checked={groupForm.members.includes(u.email)} onChange={(e) => {
                                        const m = new Set(groupForm.members); e.target.checked ? m.add(u.email) : m.delete(u.email); setGroupForm({...groupForm, members: Array.from(m)});
                                    }} className="peer appearance-none w-5 h-5 border-2 border-slate-300 rounded-md checked:border-primary checked:bg-primary transition-all cursor-pointer" />
                                    <i className="fa-solid fa-check absolute text-white text-[10px] opacity-0 peer-checked:opacity-100 pointer-events-none"></i>
                                  </div>
                                  <MemoizedAvatar uid={u.uid} url={u.profilePicUrl} name={u.name} sizeClass="w-8 h-8" extraClasses="group-hover:scale-105 transition-transform" />
                                  <span className="font-semibold text-slate-700 truncate">{u.name}</span>
                               </label>
                            ))}
                         </div>
                      </div>
                      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                         <button type="button" onClick={() => setLocalOverlay(null)} className="px-6 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
                         {/* Manual trigger via onClick to avoid implicit form submits */}
                         <button type="button" onClick={(e) => { e.preventDefault(); handleGroupSubmit(e); setLocalOverlay(null); }} className="px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-hover shadow-lg shadow-primary/30 transition-all hover:-translate-y-0.5">Save Team</button>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        )}

        {localOverlay === 'task_trail' && selectedTaskNode && (
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-6 animate-in fade-in zoom-in-[0.98] duration-200">
             <div className="max-w-2xl w-full bg-white border border-slate-100 shadow-2xl rounded-3xl flex flex-col overflow-hidden max-h-[95vh] md:max-h-[90vh]">
                <div className="p-5 md:p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                   <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary"><i className="fa-solid fa-code-commit"></i></div>
                     <h3 className="font-extrabold text-xl text-slate-800 tracking-tight">Task Audit Trail</h3>
                   </div>
                   <button onClick={() => setLocalOverlay(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors">
                     <i className="fa-solid fa-xmark"></i>
                   </button>
                </div>
                
                <div className="p-5 md:p-6 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 hover:scrollbar-thumb-slate-300 scrollbar-track-transparent bg-slate-50/50 custom-sidebar-scroll">
                   <div className="mb-8 p-5 bg-white border border-slate-100 rounded-2xl shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-primary"></div>
                      <h4 className="font-bold text-lg text-slate-800 mb-3 pl-2">{selectedTaskNode.text}</h4>
                      <div className="flex flex-wrap gap-2 pl-2">
                         <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${selectedTaskNode.taskData?.status === 'Completed' ? 'bg-teal-50 text-teal-700 border-teal-100' : selectedTaskNode.taskData?.status === 'In Progress' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                            {selectedTaskNode.taskData?.status}
                         </span>
                         {selectedTaskNode.taskData?.priority && (
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${selectedTaskNode.taskData.priority === 'High' ? 'bg-rose-50 text-rose-700 border-rose-100' : selectedTaskNode.taskData.priority === 'Medium' ? 'bg-orange-50 text-orange-700 border-orange-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                               <i className="fa-solid fa-flag mr-1"></i>{selectedTaskNode.taskData.priority}
                            </span>
                         )}
                         <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200"><i className="fa-regular fa-calendar mr-1"></i>{new Date(selectedTaskNode.taskData?.deadline).toLocaleDateString()}</span>
                      </div>
                   </div>

                   <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                     <span className="w-8 h-px bg-slate-200"></span> Activity Timeline <span className="flex-1 h-px bg-slate-200"></span>
                   </h5>
                   
                   <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-[2px] before:bg-gradient-to-b before:from-slate-200 before:via-slate-200 before:to-transparent">
                      {(selectedTaskNode.taskData?.trail || []).map((t, i) => (
                         <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                             <div className="flex items-center justify-center w-10 h-10 rounded-full border-[3px] border-white bg-slate-50 text-primary shadow-sm md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                               <i className={`fa-solid text-[13px] ${t.action.includes('Created') ? 'fa-wand-magic-sparkles' : t.action.includes('Completed') ? 'fa-check text-emerald-500' : t.action.includes('Delegated') ? 'fa-users-arrow-right text-indigo-500' : t.action.includes('File') ? 'fa-paperclip text-amber-500' : 'fa-pen'}`}></i>
                             </div>
                             <div className="w-[calc(100%-3.5rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-primary/20 transition-all">
                                 <div className="flex items-center justify-between mb-1.5">
                                   <span className="font-bold text-slate-800 text-[13px]">{t.action}</span>
                                   <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">{t.time.split(',')[0]}</span>
                                 </div>
                                 <div className="text-slate-500 text-[11px] mb-2 font-medium">By <span className="text-slate-700">{t.by.split('@')[0]}</span></div>
                                 {t.comment && <div className="text-slate-600 text-[13px] bg-slate-50/80 p-3 rounded-xl border border-slate-100 mt-2 italic">"{t.comment}"</div>}
                             </div>
                         </div>
                      ))}
                   </div>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
