import React, { useState, useMemo } from 'react';
import MemoizedAvatar from '../Common/MemoizedAvatar.jsx';
import { db } from '../../firebase.js';
import { collection, addDoc, serverTimestamp, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

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
  handleGroupSubmit, handleGroupPicUpload, groupPicUploadProgress, customTags 
}) { 
  const [activeTab, setActiveTab] = useState('tasks');
  const [logSubTab, setLogSubTab] = useState('tasks');
  
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
  const [localOverlay, setLocalOverlay] = useState(null); 
  const [taskFilterStatus, setTaskFilterStatus] = useState('All');
  const [taskFilterStart, setTaskFilterStart] = useState('');
  const [taskFilterEnd, setTaskFilterEnd] = useState('');
  
  const [newTagLabel, setNewTagLabel] = useState('');
  const [newTagTheme, setNewTagTheme] = useState('teal');

  const [reactionFilterSender, setReactionFilterSender] = useState("");
  const [reactionFilterMsgId, setReactionFilterMsgId] = useState("");
  const [reactionFilterDate, setReactionFilterDate] = useState("");

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
             const uname = dbUsers.find(u=>u.email===
