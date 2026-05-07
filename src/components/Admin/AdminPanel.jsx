
import React from 'react';
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
  handleDownloadAudit,
  handleToggleApprove,
  setAdminForm,
  setGroupForm,
  setEditingGroup,
  handleAdminArchiveGroup,
  handleAdminRecoverGroup,
}) {
  return (
    <div className="flex flex-col h-full w-full bg-[#f8fafc] overflow-hidden animate-in fade-in z-40">
      {/* Header */}
      <div className="glass-header bg-[#008069]/90 text-white p-4 flex items-center justify-between shadow-sm shrink-0 safe-top">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur shadow-inner">
            <i className="fa-solid fa-shield-halved text-xl"></i>
          </div>
          <div><h1 className="font-bold text-lg tracking-wide">Admin Control Center</h1></div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setActiveModal('task_analytics')} className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm backdrop-blur border border-white/30">
            <i className="fa-solid fa-chart-bar"></i> Analytics
          </button>
          <button onClick={() => setActiveModal('task_templates')} className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm backdrop-blur border border-white/30">
            <i className="fa-solid fa-layer-group"></i> Templates
          </button>
          <button onClick={() => setViewMode("chat")} className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm backdrop-blur border border-white/30">
            <i className="fa-solid fa-arrow-left"></i> Back to Hub
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
        {/* Audit Log Table */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col max-h-[600px]">
          <div className="bg-slate-50/50 p-5 border-b border-slate-100 flex justify-between items-center shrink-0">
            <h2 className="font-bold text-slate-800 flex items-center gap-3 text-lg">
              <div className="w-8 h-8 rounded-lg bg-[#008069]/10 text-[#008069] flex items-center justify-center"><i className="fa-solid fa-list-check"></i></div>
              Immutable Audit Ledger
            </h2>
            <button onClick={handleDownloadAudit} className="bg-[#008069] hover:bg-[#006e5a] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm hover:shadow-md">
              <i className="fa-solid fa-file-pdf text-sm"></i> Download PDF Report
            </button>
          </div>
          <div className="p-5 border-b border-slate-100 bg-white flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[150px]"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">By User</label>
              <select value={adminFilterUser} onChange={(e)=>setAdminFilterUser(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl text-[13px] bg-slate-50 outline-none focus:ring-2 focus:ring-[#008069]/20 transition-all"><option value="">All Users</option>{dbUsers.map(u => <option key={u.uid} value={u.email}>{u.name}</option>)}</select>
            </div>
            <div className="flex-1 min-w-[150px]"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">By Type</label>
              <select value={adminFilterType} onChange={(e)=>setAdminFilterType(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl text-[13px] bg-slate-50 outline-none focus:ring-2 focus:ring-[#008069]/20 transition-all"><option value="">All Types</option><option value="MESSAGE_CREATE">Public</option><option value="MESSAGE_EDIT">Edited Messages</option><option value="MESSAGE_DELETE">Deleted Messages</option><option value="REACTION">Reactions</option><option value="task-all">All Tasks</option><option value="task-pending">Tasks - Pending</option><option value="task-completed">Tasks - Completed</option><option value="GROUP_ARCHIVE">Group Archived</option><option value="GROUP_RECOVER">Group Recovered</option></select>
            </div>
            <div className="flex-1 min-w-[150px]"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">By Group</label>
              <select value={adminFilterGroup} onChange={(e)=>setAdminFilterGroup(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl text-[13px] bg-slate-50 outline-none focus:ring-2 focus:ring-[#008069]/20 transition-all"><option value="">All Groups</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name} {g.isArchived ? '(Archived)' : ''}</option>)}</select>
            </div>
            <div className="flex-1 min-w-[150px]"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">By Date</label><input type="date" value={adminFilterDate} onChange={(e)=>setAdminFilterDate(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl text-[13px] bg-slate-50 outline-none focus:ring-2 focus:ring-[#008069]/20 transition-all" /></div>
            <button onClick={()=>{setAdminFilterUser(""); setAdminFilterDate(""); setAdminFilterType(""); setAdminFilterGroup("");}} className="bg-slate-100 text-slate-600 px-5 py-2.5 rounded-xl text-[13px] font-bold hover:bg-slate-200 transition-colors shadow-sm">Clear</button>
          </div>
          <div className="p-0 overflow-y-auto flex-1">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-slate-50/80 backdrop-blur text-slate-500 text-[10px] font-bold uppercase tracking-wider sticky top-0 z-10">
                <tr><th className="px-5 py-3 border-b border-slate-200">Time</th><th className="px-5 py-3 border-b border-slate-200">Action Type</th><th className="px-5 py-3 border-b border-slate-200">Initiated By</th><th className="px-5 py-3 border-b border-slate-200">Details & Content</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAuditLogs.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-slate-400 italic">No records found matching current filters.</td></tr>}
                {filteredAuditLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3 text-[11px] text-slate-500 font-medium">{log.dateString}<br/>{log.time}</td>
                    <td className="px-5 py-3"><span className="text-[10px] font-bold bg-white text-slate-700 px-2.5 py-1 rounded-full border border-slate-200 shadow-sm">{log.type}</span></td>
                    <td className="px-5 py-3 font-semibold text-slate-800">{(log.user||'').split('@')[0]}</td>
                    <td className="px-5 py-3"><div className="text-slate-600 whitespace-pre-wrap leading-relaxed">{log.content}</div><div className="text-[10px] font-bold text-blue-500 mt-1 uppercase tracking-wider">{log.target}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Users & Groups Management */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Users table */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col max-h-[450px]">
            <div className="bg-slate-50/50 p-5 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h2 className="font-bold text-slate-800 flex items-center gap-3 text-lg"><div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><i className="fa-solid fa-users"></i></div> Users & Roles</h2>
              <div className="text-[10px] font-bold text-blue-600 bg-blue-100 px-3 py-1.5 rounded-lg">Staff must log in via Google to appear here.</div>
            </div>
            <div className="p-0 overflow-y-auto flex-1">
              <table className="w-full text-left text-[13px]">
                <tbody className="divide-y divide-slate-100">
                  {dbUsers.map(u => (
                    <tr key={u.uid} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3"><div className="font-semibold text-slate-800 flex items-center gap-2"><MemoizedAvatar uid={u.uid} url={u.profilePicUrl} name={u.name} sizeClass="w-6 h-6" /> {u.name}{u.isAdmin && <div className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider">ADMIN</div>}</div><div className="text-[11px] text-slate-500 mt-0.5">{u.email}</div></td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => handleToggleApprove(u)} className={`mr-2 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider transition-colors ${u.isApproved ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100' : 'bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100'}`}>{u.isApproved ? 'APPROVED' : 'PENDING'}</button>
                        <button onClick={() => { setAdminForm({ ...u, canCreateGroups: u.canCreateGroups || false }); setActiveModal('admin_edit_user'); }} className="text-slate-400 hover:text-blue-600 p-2 transition-colors"><i className="fa-solid fa-pen"></i></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Groups table */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col max-h-[450px]">
            <div className="bg-slate-50/50 p-5 border-b border-slate-100 flex justify-between items-center shrink-0"><h2 className="font-bold text-slate-800 flex items-center gap-3 text-lg"><div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center"><i className="fa-solid fa-people-group"></i></div> Departments & Teams</h2></div>
            <div className="p-0 overflow-y-auto flex-1">
              <table className="w-full text-left text-[13px]">
                <tbody className="divide-y divide-slate-100">
                  {groups.length === 0 && <tr><td className="p-5 text-center text-slate-400 italic">No custom groups created yet.</td></tr>}
                  {groups.map(g => (
                    <tr key={g.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3"><div className="font-semibold text-slate-800 flex items-center gap-2"><span className="text-[#800020]">{g.name}</span> {g.isArchived && <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold tracking-wider border border-slate-200">ARCHIVED</span>}</div><div className="text-[11px] text-slate-500 mt-0.5">{g.members?.length || 0} Members | Created by {(g.createdBy||"").split('@')[0]}</div></td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => { setGroupForm({name: g.name, members: g.members, profilePicUrl: g.profilePicUrl}); setEditingGroup(g); setActiveModal('group_form_modal'); }} className="text-slate-400 hover:text-[#008069] p-2 transition-colors"><i className="fa-solid fa-pen"></i></button>
                        {g.isArchived ? (
                          <button onClick={() => handleAdminRecoverGroup(g.id, g.name)} className="text-slate-400 hover:text-blue-500 p-2 transition-colors" title="Recover"><i className="fa-solid fa-rotate-left"></i></button>
                        ) : (
                          <button onClick={() => handleAdminArchiveGroup(g.id, g.name)} className="text-slate-400 hover:text-orange-500 p-2 transition-colors" title="Archive"><i className="fa-solid fa-box-archive"></i></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
