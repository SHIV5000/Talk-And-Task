import React, { useState, useMemo } from 'react';
import MemoizedAvatar from '../Common/MemoizedAvatar.jsx';

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
}) {
  const [activeTab, setActiveTab] = useState('users');   // 'users' | 'logs' | 'tasks'
  const [logSubTab, setLogSubTab] = useState('tasks');   // 'tasks' | 'messages'

  // ---------- LOGS TAB FILTERING ----------
  const taskLogs = useMemo(() => filteredAuditLogs.filter(l => l.type.startsWith('TASK_')), [filteredAuditLogs]);
  const messageLogs = useMemo(() => filteredAuditLogs.filter(l => !l.type.startsWith('TASK_')), [filteredAuditLogs]);
  const currentLogs = logSubTab === 'tasks' ? taskLogs : messageLogs;

  // ---------- TASK TREE (grouped by group) ----------
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

  // ---------- RENDER ----------
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
          <button onClick={() => setActiveModal('task_analytics')} className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm backdrop-blur border border-white/30">
            <i className="fa-solid fa-chart-bar"></i> Analytics
          </button>
          <button onClick={() => setActiveModal('task_tree_report')} className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm backdrop-blur border border-white/30">
            <i className="fa-solid fa-sitemap"></i> Report
          </button>
          <button onClick={() => setViewMode("chat")} className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm backdrop-blur border border-white/30">
            <i className="fa-solid fa-arrow-left"></i> Back to Hub
          </button>
        </div>
      </div>

      {/* ---- TAB NAVIGATION ---- */}
      <div className="flex gap-2 px-4 pt-4 bg-white border-b border-gray-200">
        {['users', 'logs', 'tasks'].map(tab => (
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
            {tab === 'logs' && <i className="fa-solid fa-list-check mr-2"></i>}
            {tab === 'tasks' && <i className="fa-solid fa-diagram-project mr-2"></i>}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* ---- CONTENT ---- */}
      <div className="flex-1 overflow-y-auto p-6 bg-surface">
        {/* ===== USERS TAB ===== */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-bold text-text-primary text-lg flex items-center gap-2">
                <i className="fa-solid fa-users text-primary"></i> User Control
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-text-secondary text-xs uppercase">
                  <tr>
                    <th className="px-5 py-3">User</th>
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-center">Admin</th>
                    <th className="px-5 py-3 text-center">Can Create Groups</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dbUsers.map(u => (
                    <tr key={u.uid} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <MemoizedAvatar uid={u.uid} url={u.profilePicUrl} name={u.name} sizeClass="w-8 h-8" />
                          <span className="font-medium text-text-primary">{u.name}</span>
                          {u.isAdmin && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">ADMIN</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-text-secondary">{u.email}</td>
                      <td className="px-5 py-3">
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
                      <td className="px-5 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={u.isAdmin || false}
                          onChange={() => handleToggleAdmin(u)}
                          className="w-4 h-4 accent-primary rounded"
                        />
                      </td>
                      <td className="px-5 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={u.canCreateGroups || false}
                          onChange={() => handleToggleCanCreateGroups(u)}
                          className="w-4 h-4 accent-primary rounded"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== LOGS TAB ===== */}
        {activeTab === 'logs' && (
          <div className="flex flex-col gap-6">
            {/* Sub-tabs */}
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

            {/* Filters */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[150px]">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block mb-1.5">By User</label>
                  <select
                    value={adminFilterUser}
                    onChange={(e) => setAdminFilterUser(e.target.value)}
                    className="w-full p-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  >
                    <option value="">All Users</option>
                    {dbUsers.map(u => <option key={u.uid} value={u.email}>{u.name}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block mb-1.5">By Type</label>
                  <select
                    value={adminFilterType}
                    onChange={(e) => setAdminFilterType(e.target.value)}
                    className="w-full p-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  >
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
                  <select
                    value={adminFilterGroup}
                    onChange={(e) => setAdminFilterGroup(e.target.value)}
                    className="w-full p-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  >
                    <option value="">All Groups</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name} {g.isArchived ? '(Archived)' : ''}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block mb-1.5">By Date</label>
                  <input
                    type="date"
                    value={adminFilterDate}
                    onChange={(e) => setAdminFilterDate(e.target.value)}
                    className="w-full p-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>
              <button
                onClick={() => { setAdminFilterUser(""); setAdminFilterDate(""); setAdminFilterType(""); setAdminFilterGroup(""); }}
                className="mt-4 bg-gray-100 text-text-secondary px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-200 transition-colors"
              >
                Clear Filters
              </button>
            </div>

            {/* Log Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-text-secondary text-xs uppercase">
                    <tr>
                      <th className="px-5 py-3">Time</th>
                      <th className="px-5 py-3">Action</th>
                      <th className="px-5 py-3">Initiated By</th>
                      <th className="px-5 py-3">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {currentLogs.length === 0 && (
                      <tr><td colSpan={4} className="px-5 py-8 text-center text-text-secondary italic">No records found.</td></tr>
                    )}
                    {currentLogs.map(log => (
                      <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3">
                          <div className="text-xs text-text-secondary">{log.dateString}</div>
                          <div className="text-[11px] text-text-secondary">{log.time}</div>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-[11px] font-bold bg-white text-text-primary px-2.5 py-1 rounded-full border border-gray-200 shadow-sm">
                            {log.type}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-medium text-text-primary">
                          {(log.user || '').split('@')[0]}
                        </td>
                        <td className="px-5 py-3">
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
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="font-bold text-text-primary text-lg mb-4 flex items-center gap-2">
              <i className="fa-solid fa-diagram-project text-primary"></i> Organisation Task Tree
            </h2>
            <div className="space-y-3">
              {Object.keys(tasksByGroup).length === 0 ? (
                <p className="text-sm text-text-secondary text-center py-8">No tasks assigned yet.</p>
              ) : (
                Object.entries(tasksByGroup).map(([groupId, tasks]) => {
                  const isExpanded = expandedGroups[groupId] !== false; // default open
                  return (
                    <div key={groupId} className="border border-gray-200 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setExpandedGroups(prev => ({ ...prev, [groupId]: !isExpanded }))}
                        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <i className={`fa-solid fa-chevron-${isExpanded ? 'down' : 'right'} text-text-secondary text-xs transition-transform`}></i>
                          <span className="font-semibold text-sm text-text-primary">{getGroupName(groupId)}</span>
                          <span className="text-xs text-text-secondary bg-white px-2 py-0.5 rounded-full border">
                            {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="divide-y divide-gray-100">
                          {tasks.map(task => (
                            <div
                              key={task.id}
                              onClick={() => openTaskTrail(task)}
                              className="px-4 py-2.5 hover:bg-gray-50 flex items-center justify-between cursor-pointer group"
                            >
                              <div className="flex-1 min-w-0 mr-4">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-sm font-medium text-text-primary line-clamp-1 group-hover:text-primary transition-colors">{task.text}</span>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-text-secondary">
                                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                    task.taskData?.status === 'Completed' ? 'bg-teal-100 text-teal-700' :
                                    task.taskData?.status === 'In Progress' ? 'bg-indigo-100 text-indigo-700' :
                                    'bg-amber-100 text-amber-700'
                                  }`}>{task.taskData?.status || 'Pending'}</span>
                                  {task.taskData?.priority && (
                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                      task.taskData.priority === 'High' ? 'bg-red-100 text-red-700' :
                                      task.taskData.priority === 'Medium' ? 'bg-amber-100 text-amber-700' :
                                      'bg-green-100 text-green-700'
                                    }`}>
                                      {task.taskData.priority}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-text-secondary whitespace-nowrap">{task.time}</span>
                                <span className="text-primary opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold flex items-center gap-1">
                                  Trail <i className="fa-solid fa-arrow-right"></i>
                                </span>
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
        )}
      </div>
    </div>
  );
}
