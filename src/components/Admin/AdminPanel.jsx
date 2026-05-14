import React, { useState, useMemo } from 'react';
import MemoizedAvatar from '../Common/MemoizedAvatar.jsx';
import { db } from '../../firebase.js';
import { collection, addDoc, serverTimestamp, updateDoc, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// ... (TAG THEMES AND VERTICAL TREE NODE UNCHANGED) ...
const tagThemes = {
  teal: { bg: 'bg-teal-50', text: 'text-teal-700' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-700' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700' },
  slate: { bg: 'bg-slate-100', text: 'text-slate-600' }
};

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
    <div style={indentStyle} className="relative py-1 w-full max-w-4xl">
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
        <div className="my-3 w-full bg-white border border-slate-200 rounded-lg shadow-sm text-left flex flex-col transition-all hover:bg-slate-50 relative group overflow-hidden">
          {tData.poked && (
             <div className="absolute top-0 right-0 bg-rose-500 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-bl-lg shadow-sm z-20 animate-pulse border-b border-l border-rose-600 tracking-widest">🚨 POKED</div>
          )}
          <div className="p-4 md:p-5 cursor-pointer" onClick={() => setShowInlineTrail(!showInlineTrail)}>
            <div className="flex justify-between items-center mb-2.5">
               <div className="text-[11px] text-slate-500 font-bold flex items-center gap-1.5"><i className="fa-solid fa-square-check text-indigo-500"></i> {node.id.slice(-5).toUpperCase()}</div>
               <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${tData.status === 'Completed' ? 'bg-teal-100 text-teal-700' : tData.status === 'In Progress' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>{tData.status}</span>
            </div>
            <h4 className="text-[15px] font-semibold text-slate-800 leading-snug mb-5">{node.name}</h4>
            <div className="flex items-end justify-between">
               <div className="flex items-center gap-3">
                 <i className={`fa-solid fa-flag text-[14px] ${tData.priority==='High'?'text-rose-500':tData.priority==='Medium'?'text-amber-500':'text-emerald-500'}`} title={tData.priority}></i>
                 {tData.status !== 'Completed' && (
                    <button onClick={(e) => handlePoke(node.task, e)} className="bg-slate-100 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 border border-transparent hover:border-indigo-200 px-3 py-1.5 rounded-lg text-[11px] font-extrabold transition-all shadow-sm">POKE</button>
                 )}
               </div>
               <div className="flex -space-x-1.5">
                  {(tData.assignees || []).slice(0, 5).map(email => {
                     const assignee = dbUsers.find(u => u.email === email);
                     return <MemoizedAvatar key={email} uid={assignee?.uid || email} url={assignee?.profilePicUrl} name={assignee?.name || 'User'} sizeClass="w-7 h-7" extraClasses="border-2 border-white shadow-sm" />;
                  })}
               </div>
            </div>
          </div>
          {showInlineTrail && (
            <div className="border-t border-slate-100 bg-slate-50 p-4 md:p-5 max-h-[300px] overflow-y-auto custom-sidebar-scroll scroll-smooth">
               <div className="relative pl-4 space-y-4 before:absolute before:inset-y-0 before:left-[7px] before:w-px before:bg-slate-300">
                  {(tData.trail || []).map((t, idx) => {
                     const authorName = dbUsers.find(u => u.email === t.by)?.name || 'System';
                     return (
                     <div key={idx} className="relative z-10 text-left">
                        <div className={`w-2 h-2 rounded-full absolute -left-[14px] top-1.5 border-2 border-slate-50 ${t.action.includes('Completed') ? 'bg-teal-500' : 'bg-indigo-500'}`}></div>
                        <div className="font-bold text-[13px] text-slate-700 leading-tight">
                            <span className="text-indigo-600">{authorName}</span> <span className="text-slate-400 font-medium mx-1">did</span> {t.action}
                            <span className="font-semibold text-slate-400 ml-2">{t.time?.split(',')[0]}</span>
                        </div>
                        {t.comment && <div className="text-[14px] text-slate-600 italic mt-1 bg-white p-2 rounded-lg border border-slate-200 shadow-sm w-fit">"{t.comment}"</div>}
                     </div>
                  )})}
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
  handleGroupSubmit, handleGroupPicUpload, groupPicUploadProgress, customTags,
  globalAnnouncement, currentUserData
}) { 
  const [activeTab, setActiveTab] = useState('dashboard'); // default to new dashboard
  const [logSubTab, setLogSubTab] = useState('tasks');
  const [dashboardTimeRange, setDashboardTimeRange] = useState('today'); // new
  
  // Broadcast Form State
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastType, setBroadcastType] = useState('info');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  
  const [historyUserEmail, setHistoryUserEmail] = useState('');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');

  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserApprove, setNewUserApprove] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [selectedLogs, setSelectedLogs] = useState(new Set());
  const [selectedHistory, setSelectedHistory] = useState(new Set());
  const [selectedReactions, setSelectedReactions] = useState(new Set()); 
  // localOverlay removed – group form now inline
  const [taskFilterStatus, setTaskFilterStatus] = useState('All');
  const [taskFilterStart, setTaskFilterStart] = useState('');
  const [taskFilterEnd, setTaskFilterEnd] = useState('');
  
  const [newTagLabel, setNewTagLabel] = useState('');
  const [newTagTheme, setNewTagTheme] = useState('teal');

  const [reactionFilterSender, setReactionFilterSender] = useState("");
  const [reactionFilterMsgId, setReactionFilterMsgId] = useState("");
  const [reactionFilterDate, setReactionFilterDate] = useState("");

  // ... (useMemo blocks remain identical – taskLogs, messageLogs, currentLogs, userHistoryLogs, filteredUsers, filteredTaskMessages, treeData) ...
  const taskLogs = useMemo(() => {
    let logs = filteredAuditLogs.filter(l => l.type?.startsWith('TASK_'));
    if (adminFilterUser) logs = logs.filter(l => l.user === adminFilterUser);
    if (adminFilterType) logs = logs.filter(l => l.type === adminFilterType);
    if (adminFilterDate) logs = logs.filter(l => l.dateString === adminFilterDate);
    if (adminFilterGroup) logs = logs.filter(l => l.groupId === adminFilterGroup);
    return logs;
  }, [filteredAuditLogs, adminFilterUser, adminFilterType, adminFilterDate, adminFilterGroup]);

  const messageLogs = useMemo(() => {
    let logs = filteredAuditLogs.filter(l => !l.type?.startsWith('TASK_') && l.type !== 'REACTION' && l.type !== 'LOGIN' && l.type !== 'LOGOUT');
    if (adminFilterUser) logs = logs.filter(l => l.user === adminFilterUser);
    if (adminFilterType) logs = logs.filter(l => l.type === adminFilterType);
    if (adminFilterDate) logs = logs.filter(l => l.dateString === adminFilterDate);
    if (adminFilterGroup) logs = logs.filter(l => l.groupId === adminFilterGroup);
    return logs;
  }, [filteredAuditLogs, adminFilterUser, adminFilterType, adminFilterDate, adminFilterGroup]);

  const currentLogs = logSubTab === 'tasks' ? taskLogs : messageLogs;

  const userHistoryLogs = useMemo(() => {
    let logs = filteredAuditLogs; 
    if (historyUserEmail) logs = logs.filter(l => l.user === historyUserEmail);
    if (historyStartDate) logs = logs.filter(l => new Date(l.dateString) >= new Date(historyStartDate));
    if (historyEndDate) logs = logs.filter(l => new Date(l.dateString) <= new Date(historyEndDate));
    return logs.sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
  }, [filteredAuditLogs, historyUserEmail, historyStartDate, historyEndDate]);

  const filteredUsers = useMemo(() => dbUsers, [dbUsers]);

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
    filteredTaskMessages.forEach(task => { const gid = task.groupId || 'direct'; if (!groupMap[gid]) groupMap[gid] = []; groupMap[gid].push(task); });
    Object.entries(groupMap).forEach(([gid, tasks]) => {
      const group = groups.find(g => g.id === gid);
      let groupName = gid;
      if (group) groupName = group.name;
      else if (gid === 'direct') groupName = 'Direct Tasks';
      else if (gid.includes('_')) {
        const uids = gid.split('_'); const u1 = dbUsers.find(u => u.uid === uids[0]); const u2 = dbUsers.find(u => u.uid === uids[1]);
        groupName = `DM: ${u1 ? u1.name.split(' ')[0] : 'User'} & ${u2 ? u2.name.split(' ')[0] : 'User'}`;
      }
      const teamNode = { id: gid, name: groupName, type: 'team', children: [] };
      tasks.forEach(task => { teamNode.children.push({ id: task.id, name: task.text || 'Untitled Task', type: 'task', task, children: [] }); });
      root.children.push(teamNode);
    });
    return root;
  }, [filteredTaskMessages, groups, dbUsers]);

  const isFilterActive = taskFilterStatus !== 'All' || taskFilterStart !== '' || taskFilterEnd !== '';

  const handlePoke = async (task, e) => {
    e.stopPropagation();
    if(!window.confirm(`Issue an urgent Poke to assignees for "${task.text}"?`)) return;
    try {
        const involved = [...new Set(task.taskData.assignees || [])];
        const uidsToNotify = dbUsers.filter(u => involved.includes(u.email)).map(u => u.uid);
        for (const uid of uidsToNotify) {
            await addDoc(collection(db, "notifications"), {
                userId: uid, type: "task", text: `👉 ADMIN POKE: Regarding task "${task.text}". Please complete as early as possible.`,
                messageId: task.id, groupId: task.groupId, timestamp: serverTimestamp(), isRead: false
            });
        }
        await updateDoc(doc(db, "messages", task.id), { "taskData.poked": true, "taskData.pokedAt": Date.now() });
    } catch(err) { alert("Failed to poke assignees."); }
  };

  const handleAddTag = async () => {
      if(!newTagLabel.trim() || !newTagLabel.startsWith('#')) return alert("Tag label must begin with '#'");
      const theme = tagThemes[newTagTheme];
      try {
          await addDoc(collection(db, "workspace_tags"), { 
             label: newTagLabel.trim(), bgClass: theme.bg, textClass: theme.text, themeName: newTagTheme, createdAt: serverTimestamp() 
          });
          setNewTagLabel('');
      } catch(e) { alert("Failed to save tag."); }
  };

  const publishBroadcast = async () => {
      if (!broadcastMessage.trim()) return alert('Please enter a message to broadcast.');
      setIsBroadcasting(true);
      try {
          await setDoc(doc(db, "workspace", "announcement"), {
              message: broadcastMessage.trim(),
              type: broadcastType,
              isActive: true,
              timestamp: serverTimestamp(),
              author: currentUserData?.name || 'Administrator'
          });
          setBroadcastMessage('');
          alert('Global Broadcast is LIVE!');
      } catch (error) {
          alert('Failed to broadcast.');
      }
      setIsBroadcasting(false);
  };

  const revokeBroadcast = async () => {
      if (!window.confirm("Are you sure you want to pull down the active global broadcast?")) return;
      try {
          await updateDoc(doc(db, "workspace", "announcement"), { isActive: false });
      } catch (error) {}
  };

  // Dashboard Metrics (NEW)
  const dashboardMetrics = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);
    const cutoff = dashboardTimeRange === 'today' ? todayStart :
                    dashboardTimeRange === 'week' ? weekAgo : monthAgo;

    const recentMessages = messages.filter(m => {
      const t = m.timestamp?.toMillis?.() || 0;
      return t >= cutoff.getTime();
    });

    const tasks = recentMessages.filter(m => m.isTask);
    const completedTasks = tasks.filter(t => t.taskData?.status === 'Completed');
    const activeTasks = tasks.filter(t => t.taskData?.status !== 'Completed');

    const usersActiveRecently = dbUsers.filter(u => {
      if (!u.lastActive?.toMillis) return false;
      return u.lastActive.toMillis() >= cutoff.getTime();
    });

    return {
      totalMessages: recentMessages.length,
      totalTasks: tasks.length,
      completedTasks: completedTasks.length,
      activeTasks: activeTasks.length,
      activeUsersCount: usersActiveRecently.length,
      pendingApprovals: dbUsers.filter(u => !u.isApproved).length,
      newestUser: dbUsers.sort((a, b) => (b.lastActive?.toMillis?.() || 0) - (a.lastActive?.toMillis?.() || 0))[0],
    };
  }, [messages, dbUsers, dashboardTimeRange]);

  const recentAuditFeed = useMemo(() => {
    return filteredAuditLogs.slice(0, 10).map(log => ({
      ...log,
      userName: dbUsers.find(u => u.email === log.user)?.name || 'System',
    }));
  }, [filteredAuditLogs, dbUsers]);

  // ... (rest of existing functions: sendersWithReactions, messagesBySender, reactionLogs, toggle select functions, printSelectedPDF, handleAddUser, download30DayLogins remain unchanged) ...
  const sendersWithReactions = useMemo(() => {
      const senders = new Set();
      messages.forEach(m => { if (Object.keys(m.reactions||{}).length > 0) senders.add(m.senderEmail); });
      return dbUsers.filter(u => senders.has(u.email));
  }, [messages, dbUsers]);

  const messagesBySender = useMemo(() => {
      if (!reactionFilterSender) return [];
      return messages.filter(m => m.senderEmail === reactionFilterSender && Object.keys(m.reactions||{}).length > 0);
  }, [messages, reactionFilterSender]);

  const reactionLogs = useMemo(() => {
      let logs = filteredAuditLogs.filter(l => l.type === 'REACTION');
      let mappedLogs = logs.map(l => {
          const msg = messages.find(m => m.id === l.messageId) || messages.find(m => m.text && m.text.includes(l.target)) || null;
          return { ...l, msgObj: msg };
      }).filter(l => l.msgObj);

      if (reactionFilterSender) mappedLogs = mappedLogs.filter(l => l.msgObj.senderEmail === reactionFilterSender);
      if (reactionFilterMsgId) mappedLogs = mappedLogs.filter(l => l.msgObj.id === reactionFilterMsgId);
      if (reactionFilterDate) mappedLogs = mappedLogs.filter(l => l.dateString === reactionFilterDate);

      return mappedLogs.sort((a,b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
  }, [filteredAuditLogs, messages, reactionFilterSender, reactionFilterMsgId, reactionFilterDate]);

  const toggleSelectAllUsers = () => { if (selectedUsers.size === filteredUsers.length) setSelectedUsers(new Set()); else setSelectedUsers(new Set(filteredUsers.map(u => u.uid))); };
  const toggleSelectUser = (uid) => { const s = new Set(selectedUsers); s.has(uid) ? s.delete(uid) : s.add(uid); setSelectedUsers(s); };
  const toggleSelectAllLogs = () => { if (selectedLogs.size === currentLogs.length) setSelectedLogs(new Set()); else setSelectedLogs(new Set(currentLogs.map(l => l.id))); };
  const toggleSelectLog = (id) => { const s = new Set(selectedLogs); s.has(id) ? s.delete(id) : s.add(id); setSelectedLogs(s); };
  const toggleSelectAllHistory = () => { if (selectedHistory.size === userHistoryLogs.length) setSelectedHistory(new Set()); else setSelectedHistory(new Set(userHistoryLogs.map(l => l.id))); };
  const toggleSelectHistory = (id) => { const s = new Set(selectedHistory); s.has(id) ? s.delete(id) : s.add(id); setSelectedHistory(s); };
  const toggleSelectAllReactions = () => { if (selectedReactions.size === reactionLogs.length) setSelectedReactions(new Set()); else setSelectedReactions(new Set(reactionLogs.map(l => l.id))); };
  const toggleSelectReaction = (id) => { const s = new Set(selectedReactions); s.has(id) ? s.delete(id) : s.add(id); setSelectedReactions(s); };

  const printSelectedPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4'); doc.setFont('Inter'); doc.setFontSize(16); doc.text('Talk & Task – Admin Report', 14, 20); doc.setFontSize(10); doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);
    let y = 40;
    if (activeTab === 'users') {
      const data = filteredUsers.filter(u => selectedUsers.has(u.uid)); doc.text('Selected Users', 14, y); y += 6;
      doc.autoTable({ startY: y, head: [['#', 'Name', 'Status']], body: data.map((u, i) => [i + 1, u.name, u.isApproved ? 'APPROVED' : 'PENDING']), styles: { fontSize: 9 }, headStyles: { fillColor: [79, 70, 229] } });
    } else if (activeTab === 'logs') {
      const data = currentLogs.filter(l => selectedLogs.has(l.id)); doc.text(`Logs – ${logSubTab === 'tasks' ? 'Task' : 'Message'}`, 14, y); y += 6;
      doc.autoTable({ startY: y, head: [['#', 'Time', 'Action', 'User', 'Details']], body: data.map((l, i) => { const uname = dbUsers.find(u=>u.email===l.user)?.name || 'System'; return [i + 1, l.dateString + ' ' + l.time, l.type, uname, l.content]}), styles: { fontSize: 9 }, headStyles: { fillColor: [79, 70, 229] } });
    } else if (activeTab === 'history') {
      const data = userHistoryLogs.filter(l => selectedHistory.has(l.id)); doc.text(`User Activity History`, 14, y); y += 6;
      doc.autoTable({ startY: y, head: [['#', 'Time', 'User', 'Action', 'Details']], body: data.map((l, i) => { const uname = dbUsers.find(u=>u.email===l.user)?.name || 'System'; return [i + 1, l.dateString + ' ' + l.time, uname, l.type, l.content]}), styles: { fontSize: 9 }, headStyles: { fillColor: [79, 70, 229] } });
    } else if (activeTab === 'reactions') {
      const data = reactionLogs.filter(l => selectedReactions.has(l.id)); doc.text(`Reactions & Tags Log`, 14, y); y += 6;
      doc.autoTable({ startY: y, head: [['#', 'Time', 'User', 'Tag/Emoji', 'Message Details']], body: data.map((l, i) => { const uname = dbUsers.find(u=>u.email===l.user)?.name || 'System'; return [i + 1, l.dateString + ' ' + l.time, uname, l.content.replace('Reacted with ', ''), l.target || '']}), styles: { fontSize: 9 }, headStyles: { fillColor: [79, 70, 229] } });
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

  const download30DayLogins = () => {
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const logins = filteredAuditLogs.filter(l => (l.type === 'LOGIN' || l.type === 'LOGOUT') && (l.timestamp?.toMillis?.() || 0) >= thirtyDaysAgo);
      if (logins.length === 0) return alert("No login activity found in the last 30 days.");
      
      const csvContent = "data:text/csv;charset=utf-8,User,Time,Action,Details\n" +
          logins.map(l => {
             const uname = dbUsers.find(u=>u.email===l.user)?.name || l.user;
             return `"${uname}","${l.dateString} ${l.time}","${l.type}","${l.content}"`
          }).join("\n");
          
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "30_Day_Login_Activity.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 overflow-hidden animate-in fade-in z-40 relative">

      <div className="bg-indigo-600 px-4 py-3 flex items-center justify-between shadow-md shrink-0 safe-top">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur shadow-inner"><i className="fa-solid fa-shield-halved text-xl text-white"></i></div>
          <h1 className="font-bold text-lg text-white tracking-wide">Admin Workspace</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Print button only for users, logs, history (fixed) */}
          {['users', 'logs', 'history'].includes(activeTab) && (
            <button onClick={printSelectedPDF} className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm backdrop-blur border border-white/30"><i className="fa-solid fa-file-pdf"></i> Print Selected</button>
          )}
          <button onClick={() => { setActiveModal(null); setViewMode("chat"); }} className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm backdrop-blur border border-white/30"><i className="fa-solid fa-arrow-left"></i> Back to App</button>
        </div>
      </div>

      <div className="flex gap-2 px-4 pt-4 bg-white border-b border-slate-200 flex-wrap overflow-x-auto custom-sidebar-scroll shrink-0">
        {/* Added Dashboard tab */}
        {['dashboard', 'tasks', 'groups', 'broadcast', 'tags', 'users', 'logs', 'reactions', 'history'].map(tab => ( 
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-5 py-2.5 rounded-t-lg text-sm font-bold transition-colors whitespace-nowrap ${activeTab === tab ? 'bg-slate-50 text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-50'}`}>
            {tab === 'dashboard' && <i className="fa-solid fa-gauge-high mr-2"></i>}
            {tab === 'users' && <i className="fa-solid fa-users mr-2"></i>}{tab === 'groups' && <i className="fa-solid fa-people-group mr-2"></i>}{tab === 'logs' && <i className="fa-solid fa-list-check mr-2"></i>}{tab === 'tasks' && <i className="fa-solid fa-diagram-project mr-2"></i>}{tab === 'history' && <i className="fa-solid fa-clock-rotate-left mr-2"></i>}{tab === 'tags' && <i className="fa-solid fa-hashtag mr-2"></i>}{tab === 'reactions' && <i className="fa-solid fa-face-smile mr-2"></i>}{tab === 'broadcast' && <i className="fa-solid fa-bullhorn mr-2"></i>}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50 relative">
        
        {/* 👇 DASHBOARD TAB (NEW) */}
        {activeTab === 'dashboard' && (
          <div className="flex flex-col gap-6 h-full overflow-y-auto custom-sidebar-scroll">
            {/* Time range selector */}
            <div className="flex items-center gap-2 justify-end">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Show:</span>
              {['today', 'week', 'month'].map(range => (
                <button
                  key={range}
                  onClick={() => setDashboardTimeRange(range)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    dashboardTimeRange === range
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {range.charAt(0).toUpperCase() + range.slice(1)}
                </button>
              ))}
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Messages</p>
                    <p className="text-2xl font-extrabold text-slate-800 mt-1">{dashboardMetrics.totalMessages}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600"><i className="fa-solid fa-comments"></i></div>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Tasks</p>
                    <p className="text-2xl font-extrabold text-slate-800 mt-1">{dashboardMetrics.activeTasks}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600"><i className="fa-solid fa-spinner"></i></div>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Completed</p>
                    <p className="text-2xl font-extrabold text-slate-800 mt-1">{dashboardMetrics.completedTasks}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600"><i className="fa-solid fa-check-circle"></i></div>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Users</p>
                    <p className="text-2xl font-extrabold text-slate-800 mt-1">{dashboardMetrics.activeUsersCount}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600"><i className="fa-solid fa-users"></i></div>
                </div>
              </div>
            </div>

            {/* Second row: pending approvals + new user */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Approvals</p>
                  <p className="text-2xl font-extrabold text-rose-600 mt-1">{dashboardMetrics.pendingApprovals}</p>
                </div>
                <button onClick={() => setActiveTab('users')} className="text-xs font-bold text-indigo-600 hover:underline">Manage Users</button>
              </div>
              {dashboardMetrics.newestUser && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center gap-4">
                  <MemoizedAvatar uid={dashboardMetrics.newestUser.uid} url={dashboardMetrics.newestUser.profilePicUrl} name={dashboardMetrics.newestUser.name} sizeClass="w-12 h-12" />
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Newest User</p>
                    <p className="text-lg font-bold text-slate-800">{dashboardMetrics.newestUser.name}</p>
                    <p className="text-xs text-slate-500">{dashboardMetrics.newestUser.email}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Recent Activity Feed */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <i className="fa-solid fa-clock-rotate-left text-indigo-500"></i> Recent Activity
                </h3>
              </div>
              <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto custom-sidebar-scroll">
                {recentAuditFeed.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-slate-400 italic">No recent activity.</p>
                ) : (
                  recentAuditFeed.map((log, idx) => (
                    <div key={log.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${
                        log.type?.startsWith('TASK_') ? 'bg-amber-50 text-amber-600' :
                        log.type === 'LOGIN' ? 'bg-emerald-50 text-emerald-600' :
                        'bg-indigo-50 text-indigo-600'
                      }`}>
                        <i className={`fa-solid ${
                          log.type?.startsWith('TASK_') ? 'fa-check-square' :
                          log.type === 'LOGIN' ? 'fa-right-to-bracket' : 'fa-circle'
                        }`}></i>
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">
                          <span className="font-semibold">{log.userName}</span> {log.content}
                        </p>
                        <p className="text-xs text-slate-400">{log.dateString} {log.time}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* BROADCAST TAB (unchanged) */}
        {activeTab === 'broadcast' && (
           <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 flex flex-col h-full overflow-hidden max-w-4xl mx-auto">
             {/* ... (keep original broadcast content unchanged) ... */}
             <div className="flex items-center gap-4 mb-6 border-b border-slate-100 pb-4 shrink-0">
                 <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center shadow-inner"><i className="fa-solid fa-tower-broadcast text-2xl"></i></div>
                 <div><h2 className="font-bold text-slate-800 text-xl leading-tight">Global Broadcast System</h2><span className="text-[11px] font-bold text-rose-500 uppercase tracking-wider">Push alerts to all active screens</span></div>
             </div>
             
             <div className="flex-1 flex flex-col gap-6 overflow-y-auto custom-sidebar-scroll">
                
                {globalAnnouncement?.isActive ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500"></div>
                        <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span> LIVE BROADCAST ACTIVE</h3>
                        <div className={`p-4 rounded-xl text-sm font-bold shadow-sm mb-4 ${globalAnnouncement.type === 'emergency' ? 'bg-rose-600 text-white' : globalAnnouncement.type === 'warning' ? 'bg-amber-500 text-white' : 'bg-indigo-600 text-white'}`}>
                            <i className="fa-solid fa-bullhorn mr-2"></i> {globalAnnouncement.message}
                        </div>
                        <button onClick={revokeBroadcast} className="px-5 py-2.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl font-bold text-sm hover:bg-rose-100 transition-colors shadow-sm">
                            <i className="fa-solid fa-power-off mr-2"></i> Revoke & Remove Broadcast
                        </button>
                    </div>
                ) : (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-inner">
                       <h3 className="font-bold text-slate-700 mb-4 text-sm uppercase tracking-wider">Draft New Broadcast</h3>
                       
                       <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Message Content</label>
                       <textarea value={broadcastMessage} onChange={e=>setBroadcastMessage(e.target.value)} placeholder="Type the alert message to display to all users..." rows={3} className="w-full p-3.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 mb-5 font-bold text-slate-700 shadow-sm resize-none"/>

                       <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Urgency Level (Color)</label>
                       <div className="flex flex-wrap gap-3 mb-6">
                           <label className={`flex-1 flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${broadcastType === 'emergency' ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'}`}>
                               <input type="radio" name="urgency" value="emergency" checked={broadcastType === 'emergency'} onChange={()=>setBroadcastType('emergency')} className="hidden" />
                               <div className="w-8 h-8 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm"><i className="fa-solid fa-bullhorn"></i></div>
                               <div className="flex flex-col"><span className="font-bold text-sm">Emergency (Red)</span><span className="text-[10px] font-semibold opacity-70">Highest visibility</span></div>
                           </label>
                           <label className={`flex-1 flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${broadcastType === 'warning' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'}`}>
                               <input type="radio" name="urgency" value="warning" checked={broadcastType === 'warning'} onChange={()=>setBroadcastType('warning')} className="hidden" />
                               <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm"><i class="fa-solid fa-clock"></i></div>
                               <div className="flex flex-col"><span className="font-bold text-sm">Warning (Amber)</span><span className="text-[10px] font-semibold opacity-70">Important updates</span></div>
                           </label>
                           <label className={`flex-1 flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${broadcastType === 'info' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'}`}>
                               <input type="radio" name="urgency" value="info" checked={broadcastType === 'info'} onChange={()=>setBroadcastType('info')} className="hidden" />
                               <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm"><i className="fa-solid fa-circle-info"></i></div>
                               <div className="flex flex-col"><span className="font-bold text-sm">Standard Info (Blue)</span><span className="text-[10px] font-semibold opacity-70">General announcements</span></div>
                           </label>
                       </div>
                       
                       <button onClick={publishBroadcast} disabled={isBroadcasting} className="w-full bg-rose-600 text-white font-black py-4 rounded-xl hover:bg-rose-700 shadow-lg shadow-rose-600/30 transition-transform hover:scale-[1.01] uppercase tracking-widest">
                           <i className="fa-solid fa-satellite-dish mr-2"></i> Publish Global Broadcast
                       </button>
                    </div>
                )}
             </div>
           </div>
        )}

        {/* TAGS STUDIO (unchanged) */}
        {activeTab === 'tags' && (
           <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 flex flex-col h-full overflow-hidden">
             <div className="flex items-center gap-4 mb-6 border-b border-slate-100 pb-4 shrink-0">
                 <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner"><i className="fa-solid fa-hashtag text-2xl"></i></div>
                 <div><h2 className="font-bold text-slate-800 text-xl leading-tight">Universal Tag Studio</h2><span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Manage Official Workflow Metadata</span></div>
             </div>
             
             <div className="flex flex-col md:flex-row gap-6 h-full min-h-0">
                <div className="w-full md:w-1/3 bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-inner overflow-y-auto">
                   <h3 className="font-bold text-slate-700 mb-4 text-sm uppercase tracking-wider">Create New Tag</h3>
                   
                   <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Hashtag Label</label>
                   <input value={newTagLabel} onChange={e=>setNewTagLabel(e.target.value)} placeholder="#Example" className="w-full p-2.5 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 mb-4 font-bold text-slate-700 shadow-sm"/>

                   <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Select Theme</label>
                   <div className="flex flex-wrap gap-2 mb-6">
                      {Object.entries(tagThemes).map(([name, classes]) => (
                         <div key={name} onClick={()=>setNewTagTheme(name)} className={`w-8 h-8 rounded-full cursor-pointer flex items-center justify-center shadow-sm border-2 ${newTagTheme === name ? 'border-slate-800 scale-110' : 'border-white'} ${classes.bg} ${classes.text}`}><i className="fa-solid fa-hashtag text-xs"></i></div>
                      ))}
                   </div>
                   
                   <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Live Preview</label>
                   <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-slate-200 bg-white w-fit mb-6 shadow-sm">
                      <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold tracking-wide ${tagThemes[newTagTheme].bg} ${tagThemes[newTagTheme].text}`}>{newTagLabel || '#Preview'}</span>
                      <span className="text-[11px] font-bold pr-1 text-slate-500">1</span>
                   </div>
                   
                   <button onClick={handleAddTag} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 shadow-sm transition-all">Publish Tag</button>
                </div>
                
                <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-5 overflow-y-auto custom-sidebar-scroll">
                   <h3 className="font-bold text-slate-700 mb-4 text-sm uppercase tracking-wider">Active Global Tags</h3>
                   <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                      {(customTags || []).map(tag => (
                         <div key={tag.id} className="flex justify-between items-center p-3 border border-slate-100 rounded-xl bg-white shadow-sm hover:border-indigo-200 transition-colors">
                            <span className={`px-2 py-1 rounded-md font-bold text-[11px] shadow-sm tracking-wide ${tag.bgClass} ${tag.textClass}`}>{tag.label}</span>
                            <button onClick={()=>deleteDoc(doc(db, "workspace_tags", tag.id))} className="text-slate-400 hover:text-rose-500 w-6 h-6 flex items-center justify-center rounded-full hover:bg-rose-50 transition-colors"><i className="fa-solid fa-trash text-[10px]"></i></button>
                         </div>
                      ))}
                   </div>
                </div>
             </div>
           </div>
        )}

        {/* REACTIONS TAB (unchanged) */}
        {activeTab === 'reactions' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100"><h2 className="font-bold text-slate-800 text-lg"><i className="fa-solid fa-face-smile text-indigo-600 mr-2"></i>Tags & Emojis Log</h2></div>
            <div className="p-5 bg-slate-50 border-b border-slate-200">
              <div className="flex flex-wrap gap-4 items-end">
                
                <div className="flex-1 min-w-[200px]">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">1. Filter By Sender</label>
                  <select value={reactionFilterSender} onChange={e => { setReactionFilterSender(e.target.value); setReactionFilterMsgId(""); }} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 font-medium">
                    <option value="">All Senders...</option>
                    {sendersWithReactions.map(u => <option key={u.uid} value={u.email}>{u.name}</option>)}
                  </select>
                </div>
                
                <div className="flex-[2] min-w-[300px]">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">2. Filter By Message</label>
                  <select value={reactionFilterMsgId} onChange={e => setReactionFilterMsgId(e.target.value)} disabled={!reactionFilterSender} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 font-medium disabled:opacity-50">
                    <option value="">{reactionFilterSender ? "All Messages from Sender..." : "Select Sender First..."}</option>
                    {messagesBySender.map(m => (
                        <option key={m.id} value={m.id}>{m.text ? m.text.substring(0,60) + '...' : m.fileName || 'Attached File'}</option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 min-w-[150px]">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">3. By Date</label>
                  <input type="date" value={reactionFilterDate} onChange={e => setReactionFilterDate(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 font-medium" />
                </div>

                <button onClick={() => { setReactionFilterSender(''); setReactionFilterMsgId(''); setReactionFilterDate(''); }} className="bg-slate-200 text-slate-600 px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-300">Clear</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                  <tr>
                     <th className="px-5 py-3"><input type="checkbox" onChange={toggleSelectAllReactions} checked={selectedReactions.size === reactionLogs.length && reactionLogs.length > 0} className="w-4 h-4 accent-indigo-600" /></th>
                     <th className="px-5 py-3">#</th>
                     <th className="px-5 py-3">Time</th>
                     <th className="px-5 py-3">Reacted By</th>
                     <th className="px-5 py-3">Tag/Emoji</th>
                     <th className="px-5 py-3">Message Snippet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reactionLogs.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400 italic font-medium">No reactions found matching filters.</td></tr>}
                  {reactionLogs.map((log, idx) => {
                     const msgText = log.msgObj?.text || log.msgObj?.fileName || log.target || 'Unknown Message';
                     const reactorName = dbUsers.find(u => u.email === log.user)?.name || 'System';
                     return (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3"><input type="checkbox" checked={selectedReactions.has(log.id)} onChange={() => toggleSelectReaction(log.id)} className="w-4 h-4 accent-indigo-600" /></td>
                      <td className="px-5 py-3 text-slate-500 font-bold">{idx + 1}</td>
                      <td className="px-5 py-3"><div className="text-xs font-bold text-slate-600">{log.dateString}</div><div className="text-[11px] text-slate-400 font-medium">{log.time}</div></td>
                      <td className="px-5 py-3 font-bold text-indigo-600">{reactorName}</td>
                      <td className="px-5 py-3"><span className="text-[12px] font-bold bg-white text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">{log.content.replace('Reacted with ', '')}</span></td>
                      <td className="px-5 py-3 text-[11px] text-slate-500 truncate max-w-xs">{msgText.substring(0, 50)}...</td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TASK TREE TAB (unchanged) */}
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
            
            <div className="flex-1 overflow-auto custom-sidebar-scroll pb-12 w-full">
               {treeData.children.length === 0 ? (
                 <div className="flex flex-col items-center justify-center mt-20 opacity-50">
                    <i className="fa-solid fa-folder-open text-6xl text-slate-300 mb-4"></i>
                    <p className="text-sm text-slate-500 font-bold">No tasks match your filters.</p>
                 </div>
               ) : (
                 <div className="org-tree w-full">
                    <ul><VerticalTreeNode node={treeData} depth={0} dbUsers={dbUsers} handlePoke={handlePoke} isFilterActive={isFilterActive} /></ul>
                 </div>
               )}
            </div>
          </div>
        )}

        {/* TEAM MANAGEMENT (NOW INLINE – NO OVERLAY) */}
        {activeTab === 'groups' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h2 className="font-bold text-slate-800 text-lg"><i className="fa-solid fa-people-group text-indigo-600 mr-2"></i>Team Management</h2>
              <button 
                onClick={() => { 
                  setGroupForm({ name: '', members: [], profilePicUrl: null }); 
                  setEditingGroup(null); 
                }} 
                className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-sm">
                <i className="fa-solid fa-plus mr-2"></i>Create Team
              </button>
            </div>

            {/* INLINE FORM PANEL (appears when editingGroup or groupForm has data) */}
            {(editingGroup || groupForm.name !== '' || groupForm.members?.length > 0) && (
              <div className="p-5 md:p-6 border-b border-slate-200 bg-slate-50 animate-in fade-in slide-in-from-top-2">
                <form onSubmit={(e) => { handleGroupSubmit(e); setEditingGroup(null); setGroupForm({name: '', members: [], profilePicUrl: null}); }} className="space-y-6 max-w-3xl">
                  {/* Team Name */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Team Name</label>
                    <input 
                      value={groupForm.name} 
                      onChange={e => setGroupForm({...groupForm, name: e.target.value})} 
                      className="w-full bg-white border border-slate-200 p-3.5 rounded-xl text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-slate-800 font-medium" 
                      placeholder="e.g. Marketing Team" required 
                    />
                  </div>

                  {/* Avatar upload */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Team Avatar</label>
                    <div className="flex items-center gap-4 bg-white border border-slate-200 p-3.5 rounded-xl">
                      <input type="file" onChange={handleGroupPicUpload} className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 transition-all cursor-pointer" />
                      {groupPicUploadProgress > 0 && <span className="text-xs font-bold text-indigo-600 animate-pulse">{Math.round(groupPicUploadProgress)}%</span>}
                    </div>
                  </div>

                  {/* Member selection */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Select Members</label>
                      <div className="flex gap-3">
                        <button type="button" onClick={() => setGroupForm({...groupForm, members: dbUsers.map(u => u.email)})} className="text-[10px] font-extrabold text-indigo-600 hover:text-indigo-800 hover:underline">Select All</button>
                        <button type="button" onClick={() => setGroupForm({...groupForm, members: []})} className="text-[10px] font-extrabold text-rose-500 hover:text-rose-700 hover:underline">Clear All</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border border-slate-200 p-4 rounded-xl max-h-56 overflow-y-auto bg-white">
                      {dbUsers.map(u => (
                        <label key={u.uid} className="flex items-center gap-3 text-sm bg-white p-3 border border-slate-100 rounded-xl shadow-sm cursor-pointer hover:border-indigo-200 hover:shadow transition-all group">
                          <div className="relative flex items-center justify-center">
                            <input 
                              type="checkbox" 
                              checked={groupForm.members.includes(u.email)} 
                              onChange={(e) => {
                                const m = new Set(groupForm.members); 
                                e.target.checked ? m.add(u.email) : m.delete(u.email); 
                                setGroupForm({...groupForm, members: Array.from(m)});
                              }} 
                              className="peer appearance-none w-5 h-5 border-2 border-slate-300 rounded-md checked:border-indigo-600 checked:bg-indigo-600 transition-all cursor-pointer" 
                            />
                            <i className="fa-solid fa-check absolute text-white text-[10px] opacity-0 peer-checked:opacity-100 pointer-events-none"></i>
                          </div>
                          <MemoizedAvatar uid={u.uid} url={u.profilePicUrl} name={u.name} sizeClass="w-8 h-8" extraClasses="group-hover:scale-105 transition-transform" />
                          <span className="font-semibold text-slate-700 truncate">{u.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <button type="button" onClick={() => { setEditingGroup(null); setGroupForm({name: '', members: [], profilePicUrl: null}); }} className="px-6 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors shadow-sm">Cancel</button>
                    <button type="submit" className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-600/30 transition-all hover:-translate-y-0.5">Save Team</button>
                  </div>
                </form>
              </div>
            )}

            {/* Team cards grid (unchanged) */}
            <div className="flex-1 overflow-auto bg-slate-50 custom-sidebar-scroll p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                     {groups.map((g, idx) => (
                         <div key={g.id} className="w-full bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all group flex flex-col">
                           <div className="flex items-center gap-3 mb-4">
                             <MemoizedAvatar uid={g.id} url={g.profilePicUrl} name={g.name} sizeClass="w-10 h-10 shadow-sm" isGroup={true} />
                             <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-slate-800 text-[14px] truncate group-hover:text-indigo-600 transition-colors">{g.name}</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{g.members?.length || 0} Members</p>
                             </div>
                           </div>
                           <div className="flex -space-x-1.5 mb-4 px-1">
                              {(g.members || []).slice(0, 8).map(email => {
                                 const u = dbUsers.find(u => u.email === email);
                                 return <MemoizedAvatar key={email} uid={u?.uid||email} url={u?.profilePicUrl} name={u?.name||'User'} sizeClass="w-6 h-6 border-2 border-white shadow-sm" />
                              })}
                              {(g.members || []).length > 8 && (
                                 <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-600 border-2 border-white shadow-sm relative z-10">
                                    +{(g.members || []).length - 8}
                                 </div>
                              )}
                           </div>
                           <div className="mt-auto pt-3 border-t border-slate-100">
                             <button onClick={() => { setGroupForm({ name: g.name, members: g.members, profilePicUrl: g.profilePicUrl }); setEditingGroup(g); }} className="w-full bg-slate-50 text-slate-600 py-2 rounded-lg text-xs font-bold border border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 shadow-sm transition-all"><i className="fa-solid fa-pen mr-1"></i>Edit Team</button>
                           </div>
                         </div>
                     ))}
                </div>
            </div>
          </div>
        )}

        {/* LOGS TAB (unchanged) */}
        {activeTab === 'logs' && (
          <div className="flex flex-col gap-6">
            <div className="flex gap-2">
              {['tasks', 'messages'].map(sub => (
                <button key={sub} onClick={() => { setLogSubTab(sub); setAdminFilterType(''); }} className={`px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors ${logSubTab === sub ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}><i className={`fa-solid ${sub === 'tasks' ? 'fa-check-square' : 'fa-comment'} mr-2`}></i>{sub === 'tasks' ? 'Task Logs' : 'Message Logs'}</button>
              ))}
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[150px]"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">By User</label><select value={adminFilterUser} onChange={e => setAdminFilterUser(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 font-medium"><option value="">All Users</option>{dbUsers.map(u => <option key={u.uid} value={u.email}>{u.name}</option>)}</select></div>
                
                <div className="flex-1 min-w-[150px]"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">By Type</label>
                    <select value={adminFilterType} onChange={e => setAdminFilterType(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 font-medium">
                        <option value="">All Types</option>
                        {logSubTab === 'tasks' ? (
                            <>
                                <option value="TASK_CREATE">Tasks Created</option>
                                <option value="TASK_DELEGATE">Delegated</option>
                                <option value="TASK_COMPLETE">Completed</option>
                                <option value="TASK_COMMENT">Commented</option>
                            </>
                        ) : (
                            <>
                                <option value="MESSAGE_CREATE">Public Message</option>
                                <option value="MESSAGE_EDIT">Edited Message</option>
                                <option value="MESSAGE_DELETE">Deleted Message</option>
                            </>
                        )}
                    </select>
                </div>
                
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
                        <td className="px-3 py-3 font-bold text-indigo-600">{dbUsers.find(u => u.email === log.user)?.name || 'Unknown'}</td>
                        <td className="px-3 py-3"><div className="text-slate-700 whitespace-pre-wrap leading-relaxed font-medium">{log.content}</div>{log.target && <div className="text-[10px] font-bold text-indigo-500 mt-1 uppercase tracking-wider">{log.target}</div>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* USERS TAB with bulk actions toolbar */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center flex-wrap gap-3">
              <h2 className="font-bold text-slate-800 text-lg"><i className="fa-solid fa-users text-indigo-600 mr-2"></i>User Control</h2>
              <div className="flex gap-2">
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

            {/* BULK ACTIONS TOOLBAR (NEW) */}
            {selectedUsers.size > 0 && (
              <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center gap-3 flex-wrap animate-in fade-in slide-in-from-top-1">
                <span className="text-sm font-bold text-indigo-700">
                  {selectedUsers.size} user{selectedUsers.size > 1 ? 's' : ''} selected
                </span>
                <div className="flex-1 flex flex-wrap gap-2">
                  <button onClick={async () => {
                      if (!window.confirm(`Approve ${selectedUsers.size} user(s)?`)) return;
                      const updates = Array.from(selectedUsers).map(uid => updateDoc(doc(db, "users", uid), { isApproved: true }));
                      await Promise.all(updates);
                      setSelectedUsers(new Set());
                    }} className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 shadow-sm transition-colors">
                    <i className="fa-solid fa-check mr-1"></i> Approve
                  </button>
                  <button onClick={async () => {
                      if (!window.confirm(`Grant Admin to ${selectedUsers.size} user(s)?`)) return;
                      const updates = Array.from(selectedUsers).map(uid => updateDoc(doc(db, "users", uid), { isAdmin: true }));
                      await Promise.all(updates);
                      setSelectedUsers(new Set());
                    }} className="px-3 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 shadow-sm transition-colors">
                    <i className="fa-solid fa-crown mr-1"></i> Make Admin
                  </button>
                  <button onClick={async () => {
                      if (!window.confirm(`Grant group creation to ${selectedUsers.size} user(s)?`)) return;
                      const updates = Array.from(selectedUsers).map(uid => updateDoc(doc(db, "users", uid), { canCreateGroups: true }));
                      await Promise.all(updates);
                      setSelectedUsers(new Set());
                    }} className="px-3 py-1.5 bg-teal-500 text-white text-xs font-bold rounded-lg hover:bg-teal-600 shadow-sm transition-colors">
                    <i className="fa-solid fa-users-gear mr-1"></i> Allow Groups
                  </button>
                  <button onClick={async () => {
                      if (!window.confirm(`Revoke Admin from ${selectedUsers.size} user(s)?`)) return;
                      const updates = Array.from(selectedUsers).map(uid => updateDoc(doc(db, "users", uid), { isAdmin: false }));
                      await Promise.all(updates);
                      setSelectedUsers(new Set());
                    }} className="px-3 py-1.5 bg-rose-500 text-white text-xs font-bold rounded-lg hover:bg-rose-600 shadow-sm transition-colors">
                    <i className="fa-solid fa-user-slash mr-1"></i> Revoke Admin
                  </button>
                  <button onClick={async () => {
                      if (!window.confirm(`Archive ${selectedUsers.size} user(s)?`)) return;
                      const updates = Array.from(selectedUsers).map(uid => updateDoc(doc(db, "users", uid), { isArchived: true }));
                      await Promise.all(updates);
                      setSelectedUsers(new Set());
                    }} className="px-3 py-1.5 bg-slate-500 text-white text-xs font-bold rounded-lg hover:bg-slate-600 shadow-sm transition-colors">
                    <i className="fa-solid fa-box-archive mr-1"></i> Archive
                  </button>
                  <button onClick={() => {
                      const selectedUsersList = filteredUsers.filter(u => selectedUsers.has(u.uid));
                      const csvContent = "data:text/csv;charset=utf-8,Name,Email,Approved,Admin,Can Create Groups\n" +
                        selectedUsersList.map(u => `"${u.name}","${u.email}","${u.isApproved}","${u.isAdmin}","${u.canCreateGroups}"`).join("\n");
                      const encodedUri = encodeURI(csvContent);
                      const link = document.createElement("a");
                      link.setAttribute("href", encodedUri);
                      link.setAttribute("download", "selected_users.csv");
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50 shadow-sm transition-colors">
                    <i className="fa-solid fa-file-csv mr-1"></i> Export CSV
                  </button>
                </div>
                <button onClick={() => setSelectedUsers(new Set())} className="ml-auto text-xs font-bold text-slate-500 hover:text-rose-600 transition-colors">Clear selection</button>
              </div>
            )}

            {/* Users table (unchanged) */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                  <tr><th className="px-3 py-3"><input type="checkbox" onChange={toggleSelectAllUsers} checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0} className="w-4 h-4 accent-indigo-600" /></th><th className="px-3 py-3">#</th><th className="px-3 py-3">User</th><th className="px-3 py-3">Email</th><th className="px-3 py-3">Status</th><th className="px-2 py-3 text-center">Admin</th><th className="px-2 py-3 text-center">Groups</th><th className="px-3 py-3 text-center">Login</th><th className="px-3 py-3 text-center">History</th></tr>
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
                      <td className="px-3 py-3 text-center"><button onClick={() => { setHistoryUserEmail(u.email); setActiveTab('history'); }} className="text-indigo-600 hover:underline text-xs font-bold"><i className="fa-solid fa-clock-rotate-left mr-1"></i>History</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* HISTORY TAB (unchanged) */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center flex-wrap gap-4">
               <h2 className="font-bold text-slate-800 text-lg"><i className="fa-solid fa-clock-rotate-left text-indigo-600 mr-2"></i>User Activity History</h2>
               <button onClick={download30DayLogins} className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-emerald-100 flex items-center gap-2">
                  <i className="fa-solid fa-file-csv"></i> Download 30-Day Logins
               </button>
            </div>
            <div className="p-5 bg-slate-50 border-b border-slate-200">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Select User</label><select value={historyUserEmail} onChange={e => setHistoryUserEmail(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 font-medium"><option value="">Select a user...</option>{dbUsers.map(u => <option key={u.uid} value={u.email}>{u.name}</option>)}</select></div>
                <div className="flex-1 min-w-[150px]"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">From Date</label><input type="date" value={historyStartDate} onChange={e => setHistoryStartDate(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 font-medium" /></div>
                <div className="flex-1 min-w-[150px]"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">To Date</label><input type="date" value={historyEndDate} onChange={e => setHistoryEndDate(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 font-medium" /></div>
                <button onClick={() => { setHistoryUserEmail(''); setHistoryStartDate(''); setHistoryEndDate(''); }} className="bg-slate-200 text-slate-600 px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-300">Clear Filters</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase"><tr><th className="px-5 py-3"><input type="checkbox" onChange={toggleSelectAllHistory} checked={selectedHistory.size === userHistoryLogs.length && userHistoryLogs.length > 0} className="w-4 h-4 accent-indigo-600" /></th><th className="px-5 py-3">#</th><th className="px-5 py-3">Time</th><th className="px-5 py-3">User</th><th className="px-5 py-3">Action</th><th className="px-5 py-3">Details</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {userHistoryLogs.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400 italic font-medium">No records found. Adjust filters to search.</td></tr>}
                  {userHistoryLogs.map((log, idx) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                       <td className="px-5 py-3"><input type="checkbox" checked={selectedHistory.has(log.id)} onChange={() => toggleSelectHistory(log.id)} className="w-4 h-4 accent-indigo-600" /></td>
                       <td className="px-5 py-3 text-slate-500 font-bold">{idx + 1}</td>
                       <td className="px-5 py-3"><div className="text-xs font-bold text-slate-600">{log.dateString}</div><div className="text-[11px] text-slate-400 font-medium">{log.time}</div></td>
                       <td className="px-5 py-3 font-bold text-indigo-600">{dbUsers.find(u => u.email === log.user)?.name || 'Unknown'}</td>
                       <td className="px-5 py-3"><span className={`text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm ${log.type === 'LOGIN' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : log.type === 'LOGOUT' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-white text-slate-600 border border-slate-200'}`}>{log.type}</span></td>
                       <td className="px-5 py-3 text-slate-700 font-medium">{log.content}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Old overlay completely removed */}
      </div>
    </div>
  );
}
