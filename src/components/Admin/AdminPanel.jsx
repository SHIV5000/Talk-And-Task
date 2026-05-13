import React, { useState, useMemo } from 'react';
import MemoizedAvatar from '../Common/MemoizedAvatar.jsx';
import { db } from '../../firebase.js';
import { collection, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// 👇 FIX 1: Correctly named function and passed depth prop
function VerticalTreeNode({ node, depth = 0, dbUsers, handlePoke, isFilterActive }) {
  const [localExpanded, setLocalExpanded] = useState(node.type === 'org');
  const [showInlineTrail, setShowInlineTrail] = useState(false);

  const isExpanded = isFilterActive || localExpanded;
  const toggle = () => setLocalExpanded(prev => !prev);

  const hasChildren = node.children && node.children.length > 0;
  const isTask = node.type === 'task';
  const tData = node.task?.taskData;

  const indentStyle = node.type !== 'org' ? { marginLeft: '1.25rem', paddingLeft: '1.25rem', borderLeft: '2px solid #e2e8f0' } : {};

  return (
    <div style={indentStyle} className="relative py-1">
      {!isTask && (
        <div onClick={toggle} className="flex items-center gap-3 py-2 px-3 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors w-fit select-none border border-transparent hover:border-slate-200">
           <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${node.type === 'org' ? 'bg-indigo-600 text-white shadow-indigo-600/30' : 'bg-slate-200 text-slate-600'}`}>
             <i className={`fa-solid ${node.type === 'org' ? 'fa-building text-lg' : 'fa-folder-open'}`}></i>
           </div>
           <div>
             <div className="font-extrabold text-slate-800 text-[15px] leading-tight">{node.name}</div>
             {hasChildren && <div className="text-[10px] font-bold text-slate-400 mt-0.5">{node.children.length} items</div>}
           </div>
           <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-[11px] text-slate-400 ml-4`}></i>
        </div>
      )}

      {isTask && (
        <div className="my-3 mx-4 w-[320px] bg-white border border-slate-200 rounded-lg shadow-sm text-left flex flex-col transition-all hover:bg-slate-50 relative group overflow-hidden">
          
          {tData.poked && (
             <div className="absolute top-0 right-0 bg-rose-500 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-bl-lg shadow-sm z-20 animate-pulse border-b border-l border-rose-600 tracking-widest">
                🚨 POKED
             </div>
          )}

          <div className="p-3.5 cursor-pointer" onClick={() => setShowInlineTrail(!showInlineTrail)}>
            <div className="flex justify-between items-center mb-2.5">
               <div className="text-[11px] text-slate-500 font-bold flex items-center gap-1.5"><i className="fa-solid fa-square-check text-indigo-500"></i> {node.id.slice(-5).toUpperCase()}</div>
               <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${tData.status === 'Completed' ? 'bg-teal-100 text-teal-700' : tData.status === 'In Progress' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>
                 {tData.status}
               </span>
            </div>
            
            <h4 className="text-[13.5px] font-semibold text-slate-800 leading-snug mb-4 line-clamp-2">{node.name}</h4>
            
            <div className="flex items-end justify-between">
               <div className="flex items-center gap-2">
                 <i className={`fa-solid fa-flag text-[12px] ${tData.priority==='High'?'text-rose-500':tData.priority==='Medium'?'text-amber-500':'text-emerald-500'}`} title={tData.priority}></i>
                 
                 {tData.status !== 'Completed' && (
                    <button onClick={(e) => handlePoke(node.task, e)} className="bg-slate-100 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 border border-transparent hover:border-indigo-200 px-2 py-1 rounded text-[10px] font-extrabold transition-all shadow-sm">
                      POKE
                    </button>
                 )}
               </div>

               <div className="flex -space-x-1">
                  {(tData.assignees || []).slice(0, 3).map(email => {
                     const assignee = dbUsers.find(u => u.email === email);
                     return <MemoizedAvatar key={email} uid={assignee?.uid || email} url={assignee?.profilePicUrl} name={assignee?.name || email.split('@')[0]} sizeClass="w-6 h-6" extraClasses="border border-white shadow-sm" />;
                  })}
               </div>
            </div>
          </div>

          {showInlineTrail && (
            <div className="border-t border-slate-100 bg-slate-50 p-3 max-h-[250px] overflow-y-auto custom-sidebar-scroll">
               <div className="relative pl-3 space-y-3 before:absolute before:inset-y-0 before:left-[5px] before:w-px before:bg-slate-300">
                  {(tData.trail || []).map((t, idx) => (
                     <div key={idx} className="relative z-10 text-left">
                        <div className={`w-2 h-2 rounded-full absolute -left-[11px] top-1 border-2 border-slate-50 ${t.action.includes('Completed') ? 'bg-teal-500' : 'bg-indigo-500'}`}></div>
                        <div className="font-bold text-[10px] text-slate-700 leading-tight">
                            {t.action} <span className="font-semibold text-slate-400 ml-1">{t.time?.split(',')[0]}</span>
                        </div>
                        {t.comment && <div className="text-[10px] text-slate-500 italic mt-0.5">"{t.comment}"</div>}
                     </div>
                  ))}
               </div>
            </div>
          )}
        </div>
      )}

      {hasChildren && isExpanded && (
        <div className="mt-1">
          {node.children.map(child => (
            <VerticalTreeNode key={child.id} node={child} depth={depth + 1} dbUsers={dbUsers} handlePoke={handlePoke} isFilterActive={isFilterActive} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminPanel({
  setViewMode, setActiveModal, dbUsers, groups, filteredAuditLogs,
  adminFilterUser, setAdminFilterUser, adminFilterDate, setAdminFilterDate,
  adminFilterType, setAdminFilterType, adminFilterGroup, setAdminFilterGroup,
  handleToggleApprove, handleToggleAdmin, handleToggleCanCreateGroups,
  setSelectedMessage, setIsEditingTaskTitle, messages,
  setGroupForm, setEditingGroup, editingGroup, groupForm,
  handleGroupSubmit, handleAdminArchiveGroup, handleAdminRecoverGroup,
  handleGroupPicUpload, groupPicUploadProgress, playMelody
}) { 
  const [activeTab, setActiveTab] = useState('tasks');
  const [logSubTab, setLogSubTab] = useState('tasks');
  const [historyUserEmail, setHistoryUserEmail] = useState('');
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserApprove, setNewUserApprove] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [selectedLogs, setSelectedLogs] = useState(new Set());
  const [selectedHistory, setSelectedHistory] = useState(new Set());
  const [showArchivedUsers, setShowArchivedUsers] = useState(false);
  const [localOverlay, setLocalOverlay] = useState(null); 
  const [taskFilterStatus, setTaskFilterStatus] = useState('All');
  const [taskFilterStart, setTaskFilterStart] = useState('');
  const [taskFilterEnd, setTaskFilterEnd] = useState('');

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

  const filteredTaskMessages = useMemo(() => {
    let filtered = messages.filter(m => m.isTask);
    if (taskFilterStatus !== 'All') filtered = filtered.filter(m => m.taskData?.status === taskFilterStatus);
    if (taskFilterStart) filtered = filtered.filter(m => new Date(m.taskData?.deadline) >= new Date(taskFilterStart));
    if (taskFilterEnd) filtered = filtered.filter(m => new Date(m.taskData?.deadline) <= new Date(taskFilterEnd));
    return filtered;
  }, [messages, taskFilterStatus, taskFilterStart, taskFilterEnd]);

  const treeData = useMemo(() => {
    const root = { id: 'org', name: 'Talk & Task Corp', type: 'org', children: [] };
    const groupMap = {};
    
    filteredTaskMessages.forEach(task => {
      const gid = task.groupId || 'direct';
      if (!groupMap[gid]) groupMap[gid] = [];
      groupMap[gid].push(task);
    });

    Object.entries(groupMap).forEach(([gid, tasks]) => {
      const group = groups.find(g => g.id === gid);
      let groupName = gid;
      if (group) groupName = group.name;
      else if (gid === 'direct') groupName = 'Direct Tasks';
      else if (gid.includes('_')) {
        const uids = gid.split('_');
        const u1 = dbUsers.find(u => u.uid === uids[0]);
        const u2 = dbUsers.find(u => u.uid === uids[1]);
        groupName = `DM: ${u1 ? u1.name.split(' ')[0] : 'User'} & ${u2 ? u2.name.split(' ')[0] : 'User'}`;
      }

      const teamNode = { id: gid, name: groupName, type: 'team', children: [] };
      tasks.forEach(task => {
        teamNode.children.push({ id: task.id, name: task.text || 'Untitled Task', type: 'task', task, children: [] });
      });
      root.children.push(teamNode);
    });
    return root;
  }, [filteredTaskMessages, groups, dbUsers]);

  const isFilterActive = taskFilterStatus !== 'All' || taskFilterStart !== '' || taskFilterEnd !== '';

  const handlePoke = async (task, e) => {
    e.stopPropagation();
    if(!window.confirm(`Issue an urgent Poke to assignees for "${task.text}"?`)) return;
    try {
        if(playMelody) playMelody('taskCreated'); 
        const involved = [...new Set(task.taskData.assignees || [])];
        const uidsToNotify = dbUsers.filter(u => involved.includes(u.email)).map(u => u.uid);
        for (const uid of uidsToNotify) {
            await addDoc(collection(db, "notifications"), {
                userId: uid, type: "task", 
                text: `👉 ADMIN POKE: Regarding task "${task.text}". Please complete as early as possible.`,
                messageId: task.id, groupId: task.groupId, timestamp: serverTimestamp(), isRead: false
            });
        }
        await updateDoc(doc(db, "messages", task.id), { "taskData.poked": true, "taskData.pokedAt": Date.now() });
    } catch(err) { alert("Failed to poke assignees."); }
  };

  const toggleSelectAllUsers = () => { if (selectedUsers.size === filteredUsers.length) setSelectedUsers(new Set()); else setSelectedUsers(new Set(filteredUsers.map(u => u.uid))); };
  const toggleSelectUser = (uid) => { const s = new Set(selectedUsers); s.has(uid) ? s.delete(uid) : s.add(uid); setSelectedUsers(s); };
  const toggleSelectAllLogs = () => { if (selectedLogs.size === currentLogs.length) setSelectedLogs(new Set()); else setSelectedLogs(new Set(currentLogs.map(l => l.id))); };
  const toggleSelectLog = (id) => { const s = new Set(selectedLogs); s.has(id) ? s.delete(id) : s.add(id); setSelectedLogs(s); };
  const toggleSelectAllHistory = () => { if (selectedHistory.size === userHistoryLogs.length) setSelectedHistory(new Set()); else setSelectedHistory(new Set(userHistoryLogs.map(l => l.id))); };
  const toggleSelectHistory = (id) => { const s = new Set(selectedHistory); s.has(id) ? s.delete(id) : s.add(id); setSelectedHistory(s); };

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
    <div className="flex flex-col h-full w-full bg-slate-50 overflow-hidden animate-in fade-in z-40 relative">

      <div className="bg-indigo-600 px-4 py-3 flex items-center justify-between shadow-md shrink-0 safe-top">
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

      <div className="flex gap-2 px-4 pt-4 bg-white border-b border-slate-200 flex-wrap">
        {['tasks', 'groups', 'users', 'logs', 'history'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-5 py-2.5 rounded-t-lg text-sm font-bold transition-colors ${activeTab === tab ? 'bg-slate-50 text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-50'}`}>
            {tab === 'users' && <i className="fa-solid fa-users mr-2"></i>}{tab === 'groups' && <i className="fa-solid fa-people-group mr-2"></i>}{tab === 'logs' && <i className="fa-solid fa-list-check mr-2"></i>}{tab === 'tasks' && <i className="fa-solid fa-diagram-project mr-2"></i>}{tab === 'history' && <i className="fa-solid fa-clock-rotate-left mr-2"></i>}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50 relative">
        
        {/* TASK TREE TAB */}
        {activeTab === 'tasks' && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 flex flex-col h-full overflow-hidden">
            <div className="flex flex-wrap items-center justify-between mb-6 gap-4 border-b border-slate-100 pb-4 shrink-0">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner"><i className="fa-solid fa-network-wired text-2xl"></i></div>
                 <div>
                    <h2 className="font-bold text-slate-800 text-xl leading-tight">Organisation Task Tree</h2>
                    <span className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider">{filteredTaskMessages.length} tasks rendered</span>
                 </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100">
                  <select value={taskFilterStatus} onChange={e=>setTaskFilterStatus(e.target.value)} className="text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none cursor-pointer">
                      <option value="All">All Statuses</option>
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                  </select>
                  <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
                      <i className="fa-regular fa-calendar text-indigo-400 text-xs"></i>
                      <input type="date" value={taskFilterStart} onChange={e=>setTaskFilterStart(e.target.value)} className="text-[11px] font-bold text-slate-600 uppercase outline-none cursor-pointer w-[110px]" title="Start Date" />
                      <span className="text-slate-300 font-bold">-</span>
                      <input type="date" value={taskFilterEnd} onChange={e=>setTaskFilterEnd(e.target.value)} className="text-[11px] font-bold text-slate-600 uppercase outline-none cursor-pointer w-[110px]" title="End Date" />
                  </div>
                  {isFilterActive && (
                      <button onClick={()=>{setTaskFilterStatus('All'); setTaskFilterStart(''); setTaskFilterEnd('');}} className="w-8 h-8 bg-white border border-rose-100 text-rose-500 rounded-lg hover:bg-rose-50 flex items-center justify-center transition-colors shadow-sm" title="Clear Filters"><i className="fa-solid fa-xmark"></i></button>
                  )}
              </div>
            </div>
            <div className="flex-1 overflow-auto custom-sidebar-scroll pb-12 w-full flex justify-center">
               {treeData.children.length === 0 ? (
                 <div className="flex flex-col items-center justify-center mt-20 opacity-50">
                    <i className="fa-solid fa-folder-open text-6xl text-slate-300 mb-4"></i>
                    <p className="text-sm text-slate-500 font-bold">No tasks match your filters.</p>
                 </div>
               ) : (
                 <div className="org-tree inline-block min-w-max">
                    <ul><VerticalTreeNode node={treeData} depth={0} dbUsers={dbUsers} handlePoke={handlePoke} isFilterActive={isFilterActive} /></ul>
                 </div>
               )}
            </div>
          </div>
        )}

        {/* HORIZONTAL GROUP TREE */}
        {activeTab === 'groups' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h2 className="font-bold text-slate-800 text-lg"><i className="fa-solid fa-people-group text-indigo-600 mr-2"></i>Team Management</h2>
              <button onClick={() => { setGroupForm({ name: '', members: [], profilePicUrl: null }); setEditingGroup(null); setLocalOverlay('group_form'); }} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-sm"><i className="fa-solid fa-plus mr-2"></i>Create Team</button>
            </div>
            
            <div className="flex-1 overflow-auto bg-slate-50 custom-sidebar-scroll p-8">
               <div className="flex items-center min-w-max h-full">
                  <div className="flex flex-col items-center justify-center gap-2 w-32 h-32 rounded-full border-4 shadow-md transition-all hover:scale-105 bg-indigo-600 border-indigo-200 text-white z-10 shrink-0">
                     <i className="fa-solid fa-sitemap text-3xl"></i>
                     <span className="font-bold text-xs text-center leading-tight px-2">Organisation</span>
                  </div>
                  {groups.length > 0 && <div className="w-12 h-1.5 bg-indigo-200 shrink-0 -ml-2 rounded-r-full"></div>}
                  {groups.length > 0 && (
                    <div className="relative flex flex-col gap-6 py-8 border-l-4 border-indigo-200 pl-10 ml-[-2px] rounded-l-xl">
                       {groups.map((g, idx) => (
                          <div key={g.id} className="relative flex items-center">
                             <div className="absolute -left-10 w-10 h-1 bg-indigo-200"></div>
                             <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm w-[320px] hover:border-indigo-300 hover:shadow-md transition-all z-10 group">
                               <div className="flex items-center gap-4 mb-4">
                                 <MemoizedAvatar uid={g.id} url={g.profilePicUrl} name={g.name} sizeClass="w-12 h-12 shadow-sm" isGroup={true} />
                                 <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-slate-800 text-[15px] truncate group-hover:text-indigo-600 transition-colors">{g.name}</h3>
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{g.members?.length || 0} Members {g.isArchived && '· Archived'}</p>
                                 </div>
                               </div>
                               <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
                                 <button onClick={() => { setGroupForm({ name: g.name, members: g.members, profilePicUrl: g.profilePicUrl }); setEditingGroup(g); setLocalOverlay('group_form'); }} className="flex-1 bg-slate-50 text-slate-600 py-2 rounded-lg text-xs font-bold border border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 shadow-sm transition-all"><i className="fa-solid fa-pen mr-1"></i>Edit</button>
                                 {g.isArchived ? (
                                   <button onClick={() => { if (window.confirm('Recover?')) handleAdminRecoverGroup(g.id, g.name); }} className="flex-1 bg-teal-50 text-teal-700 py-2 rounded-lg text-xs font-bold border border-teal-200 hover:bg-teal-100 shadow-sm transition-all"><i className="fa-solid fa-rotate-left mr-1"></i>Recover</button>
                                 ) : (
                                   <button onClick={() => { if (window.confirm('Archive?')) handleAdminArchiveGroup(g.id, g.name); }} className="flex-1 bg-rose-50 text-rose-600 py-2 rounded-lg text-xs font-bold border border-rose-200 hover:bg-rose-100 shadow-sm transition-all"><i className="fa-solid fa-box-archive mr-1"></i>Archive</button>
                                 )}
                               </div>
                             </div>
                          </div>
                       ))}
                    </div>
                  )}
               </div>
            </div>
          </div>
        )}

        {/* OTHER TABS */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center flex-wrap gap-3">
              <h2 className="font-bold text-slate-800 text-lg"><i className="fa-solid fa-users text-indigo-600 mr-2"></i>User Control</h2>
              <div className="flex gap-2">
                <button onClick={() => setShowArchivedUsers(!showArchivedUsers)} className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${showArchivedUsers ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                  <i className={`fa-solid ${showArchivedUsers ? 'fa-eye' : 'fa-box-archive'} mr-2`}></i>{showArchivedUsers ? 'Show Active' : 'Show Archived'}
                </button>
                <button onClick={() => setShowAddUser(!showAddUser)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700"><i className="fa-solid fa-plus mr-2"></i>Add User</button>
              </div>
            </div>
            {showAddUser && (
              <div className="p-5 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-4 items-end">
                <div><label className="text-xs font-bold text-slate-500 block mb-1">Email</label><input type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="user@example.com" /></div>
                <div><label className="text-xs font-bold text-slate-500 block mb-1">Name</label><input type="text" value={newUserName} onChange={e => setNewUserName(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Full Name" /></div>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={newUserApprove} onChange={e => setNewUserApprove(e.target.checked)} className="w-4 h-4 accent-indigo-600" />Approve immediately</label>
                <button onClick={handleAddUser} className="bg-teal-500 text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-teal-600">Save</button>
                <button onClick={() => setShowAddUser(false)} className="bg-slate-200 text-slate-600 px-5 py-2 rounded-lg text-sm font-bold hover:bg-slate-300">Cancel</button>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                  <tr><th className="px-3 py-3"><input type="checkbox" onChange={toggleSelectAllUsers} checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0} className="w-4 h-4 accent-indigo-600" /></th><th className="px-3 py-3">#</th><th className="px-3 py-3">User</th><th className="px-3 py-3">Email</th><th className="px-3 py-3">Status</th><th className="px-2 py-3 text-center">Admin</th><th className="px-2 py-3 text-center">Groups</th><th className="px-3 py-3 text-center">Login</th><th className="px-3 py-3 text-center">Archive</th><th className="px-3 py-3 text-center">History</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((u, idx) => (
                    <tr key={u.uid} className={`hover:bg-slate-50 ${u.isArchived ? 'opacity-60' : ''}`}>
                      <td className="px-3 py-3"><input type="checkbox" checked={selectedUsers.has(u.uid)} onChange={() => toggleSelectUser(u.uid)} className="w-4 h-4 accent-indigo-600" /></td>
                      <td className="px-3 py-3 text-slate-500">{idx + 1}</td>
                      <td className="px-3 py-3"><div className="flex items-center gap-2"><MemoizedAvatar uid={u.uid} url={u.profilePicUrl} name={u.name} sizeClass="w-7 h-7" /><span className="font-medium text-slate-800">{u.name}</span>{u.isAdmin && <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">ADMIN</span>}</div></td>
                      <td className="px-3 py-3 text-slate-500">{u.email}</td>
                      <td className="px-3 py-3"><button onClick={() => handleToggleApprove(u)} className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${u.isApproved ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-orange-50 text-orange-700 border border-orange-200'}`}>{u.isApproved ? 'APPROVED' : 'PENDING'}</button></td>
                      <td className="px-2 py-3 text-center"><input type="checkbox" checked={u.isAdmin || false} onChange={() => handleToggleAdmin(u)} className="w-4 h-4 accent-indigo-600" /></td>
                      <td className="px-2 py-3 text-center"><input type="checkbox" checked={u.canCreateGroups || false} onChange={() => handleToggleCanCreateGroups(u)} className="w-4 h-4 accent-indigo-600" /></td>
                      <td className="px-3 py-3 text-center text-[11px] text-slate-500">{u.lastLogin?.toDate ? new Date(u.lastLogin.toDate()).toLocaleString() : '—'}</td>
                      <td className="px-3 py-3 text-center"><button onClick={() => handleToggleArchiveUser(u)} className={`text-xs font-bold ${u.isArchived ? 'text-teal-600 hover:text-teal-800' : 'text-amber-600 hover:text-amber-800'}`}><i className={`fa-solid ${u.isArchived ? 'fa-rotate-left' : 'fa-box-archive'}`}></i></button></td>
                      <td className="px-3 py-3 text-center"><button onClick={() => { setHistoryUserEmail(u.email); setActiveTab('history'); }} className="text-indigo-600 hover:underline text-xs font-bold"><i className="fa-solid fa-clock-rotate-left mr-1"></i>History</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="flex flex-col gap-6">
            <div className="flex gap-2">
              {['tasks', 'messages'].map(sub => (
                <button key={sub} onClick={() => setLogSubTab(sub)} className={`px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors ${logSubTab === sub ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}><i className={`fa-solid ${sub === 'tasks' ? 'fa-check-square' : 'fa-comment'} mr-2`}></i>{sub === 'tasks' ? 'Task Logs' : 'Message Logs'}</button>
              ))}
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[150px]"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">By User</label><select value={adminFilterUser} onChange={e => setAdminFilterUser(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 font-medium"><option value="">All Users</option>{dbUsers.map(u => <option key={u.uid} value={u.email}>{u.name}</option>)}</select></div>
                <div className="flex-1 min-w-[150px]"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">By Type</label><select value={adminFilterType} onChange={e => setAdminFilterType(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 font-medium"><option value="">All Types</option><option value="MESSAGE_CREATE">Public</option><option value="MESSAGE_EDIT">Edited</option><option value="MESSAGE_DELETE">Deleted</option><option value="REACTION">Reactions</option><option value="TASK_CREATE">Tasks Created</option><option value="TASK_DELEGATE">Delegated</option><option value="TASK_COMPLETE">Completed</option><option value="TASK_COMMENT">Commented</option></select></div>
                <div className="flex-1 min-w-[150px]"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">By Group</label><select value={adminFilterGroup} onChange={e => setAdminFilterGroup(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 font-medium"><option value="">All Groups</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
                <div className="flex-1 min-w-[150px]"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">By Date</label><input type="date" value={adminFilterDate} onChange={e => setAdminFilterDate(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 font-medium" /></div>
              </div>
              <button onClick={() => { setAdminFilterUser(""); setAdminFilterDate(""); setAdminFilterType(""); setAdminFilterGroup(""); }} className="mt-4 bg-slate-100 text-slate-500 px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-200">Clear Filters</button>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase"><tr><th className="px-3 py-3"><input type="checkbox" onChange={toggleSelectAllLogs} checked={selectedLogs.size === currentLogs.length && currentLogs.length > 0} className="w-4 h-4 accent-indigo-600" /></th><th className="px-3 py-3">#</th><th className="px-3 py-3">Time</th><th className="px-3 py-3">Action</th><th className="px-3 py-3">Initiated By</th><th className="px-3 py-3">Details</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentLogs.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400 italic font-medium">No records found.</td></tr>}
                    {currentLogs.map((log, idx) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="px-3 py-3"><input type="checkbox" checked={selectedLogs.has(log.id)} onChange={() => toggleSelectLog(log.id)} className="w-4 h-4 accent-indigo-600" /></td>
                        <td className="px-3 py-3 text-slate-500 font-bold">{idx + 1}</td>
                        <td className="px-3 py-3"><div className="text-xs font-bold text-slate-600">{log.dateString}</div><div className="text-[11px] text-slate-400 font-medium">{log.time}</div></td>
                        <td className="px-3 py-3"><span className="text-[11px] font-bold bg-white text-slate-600 px-2.5 py-1 rounded-full border border-slate-200 shadow-sm">{log.type}</span></td>
                        <td className="px-3 py-3 font-bold text-indigo-600">{(log.user || '').split('@')[0]}</td>
                        <td className="px-3 py-3"><div className="text-slate-700 whitespace-pre-wrap leading-relaxed font-medium">{log.content}</div>{log.target && <div className="text-[10px] font-bold text-indigo-500 mt-1 uppercase tracking-wider">{log.target}</div>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100"><h2 className="font-bold text-slate-800 text-lg"><i className="fa-solid fa-clock-rotate-left text-indigo-600 mr-2"></i>User Activity History</h2></div>
            <div className="p-5 bg-slate-50 border-b border-slate-200">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Select User</label><select value={historyUserEmail} onChange={e => setHistoryUserEmail(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 font-medium"><option value="">Select a user...</option>{dbUsers.map(u => <option key={u.uid} value={u.email}>{u.name} ({u.email})</option>)}</select></div>
                <button onClick={() => setHistoryUserEmail('')} className="bg-slate-200 text-slate-600 px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-300">Clear</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase"><tr><th className="px-5 py-3"><input type="checkbox" onChange={toggleSelectAllHistory} checked={selectedHistory.size === userHistoryLogs.length && userHistoryLogs.length > 0} className="w-4 h-4 accent-indigo-600" /></th><th className="px-5 py-3">#</th><th className="px-5 py-3">Time</th><th className="px-5 py-3">Action</th><th className="px-5 py-3">Details</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {userHistoryLogs.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400 italic font-medium">{historyUserEmail ? 'No activity found.' : 'Select a user above.'}</td></tr>}
                  {userHistoryLogs.map((log, idx) => (
                    <tr key={log.id} className="hover:bg-slate-50"><td className="px-5 py-3"><input type="checkbox" checked={selectedHistory.has(log.id)} onChange={() => toggleSelectHistory(log.id)} className="w-4 h-4 accent-indigo-600" /></td><td className="px-5 py-3 text-slate-500 font-bold">{idx + 1}</td><td className="px-5 py-3"><div className="text-xs font-bold text-slate-600">{log.dateString}</div><div className="text-[11px] text-slate-400 font-medium">{log.time}</div></td><td className="px-5 py-3"><span className="text-[11px] font-bold bg-white text-slate-600 px-2.5 py-1 rounded-full border border-slate-200 shadow-sm">{log.type}</span></td><td className="px-5 py-3 text-slate-700 font-medium">{log.content}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* GROUP EDIT OVERLAY */}
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
                   <form onSubmit={(e) => { handleGroupSubmit(e); setLocalOverlay(null); }} className="space-y-6">
                      <div>
                         <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Team Name</label>
                         <input value={groupForm.name} onChange={e => setGroupForm({...groupForm, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-slate-800 font-medium" placeholder="e.g. Marketing Team" required />
                      </div>
                      <div>
                         <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Team Avatar</label>
                         <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                           <input type="file" onChange={handleGroupPicUpload} className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 transition-all cursor-pointer" />
                           {groupPicUploadProgress > 0 && <span className="text-xs font-bold text-indigo-600 animate-pulse">{Math.round(groupPicUploadProgress)}%</span>}
                         </div>
                      </div>
                      <div>
                         <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Select Members</label>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border border-slate-200 p-4 rounded-xl max-h-56 overflow-y-auto bg-slate-50 scrollbar-thin scrollbar-thumb-slate-200 custom-sidebar-scroll">
                            {dbUsers.map(u => (
                               <label key={u.uid} className="flex items-center gap-3 text-sm bg-white p-3 border border-slate-100 rounded-xl shadow-sm cursor-pointer hover:border-indigo-200 hover:shadow transition-all group">
                                  <div className="relative flex items-center justify-center">
                                    <input type="checkbox" checked={groupForm.members.includes(u.email)} onChange={(e) => {
                                        const m = new Set(groupForm.members); e.target.checked ? m.add(u.email) : m.delete(u.email); setGroupForm({...groupForm, members: Array.from(m)});
                                    }} className="peer appearance-none w-5 h-5 border-2 border-slate-300 rounded-md checked:border-indigo-600 checked:bg-indigo-600 transition-all cursor-pointer" />
                                    <i className="fa-solid fa-check absolute text-white text-[10px] opacity-0 peer-checked:opacity-100 pointer-events-none"></i>
                                  </div>
                                  <MemoizedAvatar uid={u.uid} url={u.profilePicUrl} name={u.name} sizeClass="w-8 h-8" extraClasses="group-hover:scale-105 transition-transform" />
                                  <span className="font-semibold text-slate-700 truncate">{u.name}</span>
                               </label>
                            ))}
                         </div>
                      </div>
                      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                         <button type="button" onClick={() => setLocalOverlay(null)} className="px-6 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors shadow-sm">Cancel</button>
                         <button type="submit" className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-600/30 transition-all hover:-translate-y-0.5">Save Team</button>
                      </div>
                   </form>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
