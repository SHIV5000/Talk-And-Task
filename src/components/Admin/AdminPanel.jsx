import React, { useState, useMemo } from 'react';
import MemoizedAvatar from '../Common/MemoizedAvatar.jsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Global String Formatter for clean rendering & PDF export
const stripHtml = (html) => html ? String(html).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ') : '';

export default function AdminPanel({
    setViewMode, setActiveModal, dbUsers, groups, filteredAuditLogs,
    adminFilterUser, setAdminFilterUser, adminFilterDate, setAdminFilterDate,
    adminFilterType, setAdminFilterType, adminFilterGroup, setAdminFilterGroup,
    handleToggleApprove, handleToggleAdmin, handleToggleCanCreateGroups,
    setSelectedMessage, setIsEditingTaskTitle, messages, setGroupForm,
    setEditingGroup, groupForm, editingGroup, handleGroupSubmit,
    handleGroupPicUpload, groupPicUploadProgress, globalAnnouncement, currentUserData
}) {
    const [activeTab, setActiveTab] = useState('overview');
    const [taskStatusFilter, setTaskStatusFilter] = useState('All');

    // Performance Foundation - Localized Audit State
    const [localAuditSearch, setLocalAuditSearch] = useState("");

    // 🚀 PHASES 3 & 4: Inline Expansion States
    const [expandedGroup, setExpandedGroup] = useState(null);
    const [expandedTask, setExpandedTask] = useState(null);

    // Overview Metrics
    const totalUsers = dbUsers.length;
    const pendingApprovals = dbUsers.filter(u => !u.isApproved).length;
    const totalGroups = groups.filter(g => !g.isDM).length;
    
    const allTasks = messages.filter(m => m.isTask);
    const activeTasks = allTasks.filter(m => m.taskData?.status !== "Completed");
    const completedTasks = allTasks.filter(m => m.taskData?.status === "Completed");
    const escalatedTasks = allTasks.filter(m => m.taskData?.escalated === true);

    const recentActivity = useMemo(() => {
        return [...filteredAuditLogs]
            .sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0))
            .slice(0, 30);
    }, [filteredAuditLogs]);

    const filteredTasks = useMemo(() => {
        let filtered = allTasks;
        if (taskStatusFilter !== 'All') {
            filtered = filtered.filter(t => t.taskData?.status === taskStatusFilter);
        }
        return filtered.sort((a,b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
    }, [allTasks, taskStatusFilter]);

    const slaMetrics = useMemo(() => {
        if (activeTab !== 'sla') return []; 
        return dbUsers.map(user => {
            const userTasks = allTasks.filter(t => t.taskData?.assignees?.includes(user.email));
            const totalAssigned = userTasks.length;
            const breachedTasks = allTasks.filter(t => (t.taskData?.breachedBy || []).includes(user.email));
            const totalBreaches = breachedTasks.length;
            const completedOnTime = userTasks.filter(t => t.taskData?.status === "Completed" && !breachedTasks.includes(t)).length;
            
            let complianceScore = 100;
            if (totalAssigned > 0) complianceScore = Math.round(((totalAssigned - totalBreaches) / totalAssigned) * 100);
            else complianceScore = 0; 

            return { ...user, totalAssigned, completedOnTime, totalBreaches, complianceScore };
        }).sort((a, b) => a.complianceScore - b.complianceScore); 
    }, [dbUsers, allTasks, activeTab]);

    // --- 🚀 PDF GENERATION ENGINE ---
    const generatePDFHeaderFooter = (doc, title) => {
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        doc.setFontSize(18);
        doc.setTextColor(79, 70, 229); 
        doc.text('Talk & Task Enterprise', 14, 22);
        doc.setFontSize(12);
        doc.setTextColor(100, 116, 139); 
        doc.text(title, 14, 30);

        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184); 
            const footerText = `Downloaded by ${currentUserData?.name || 'Admin'} | at ${timeStr} | on ${dateStr} | Talk & Task — MPGS | Confidential`;
            doc.text(footerText, 14, doc.internal.pageSize.height - 10);
        }
    };

    const exportOverviewPDF = () => {
        const doc = new jsPDF();
        generatePDFHeaderFooter(doc, 'Executive Summary & Recent Activity');

        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59); 
        doc.text(`Total Users: ${totalUsers}    |    Pending Approvals: ${pendingApprovals}`, 14, 45);
        doc.text(`Departments: ${totalGroups}    |    Active Tasks: ${activeTasks.length}    |    Escalated: ${escalatedTasks.length}`, 14, 52);

        const tableData = recentActivity.map(log => [
            log.timestamp?.toDate ? new Date(log.timestamp.toDate()).toLocaleString() : 'N/A',
            log.userEmail?.split('@')[0] || 'System',
            log.action || 'Unknown',
            stripHtml(log.details)
        ]);

        doc.autoTable({
            startY: 62, head: [['Timestamp', 'Actor', 'Action', 'Details']], body: tableData,
            theme: 'grid', headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' },
            styles: { fontSize: 8, cellPadding: 3 }, columnStyles: { 0: { cellWidth: 35 }, 1: { cellWidth: 35 }, 2: { cellWidth: 35 }, 3: { cellWidth: 'auto' } }
        });
        generatePDFHeaderFooter(doc, 'Executive Summary & Recent Activity');
        doc.save(`Executive_Summary_${Date.now()}.pdf`);
    };

    const exportGroupsPDF = () => {
        const doc = new jsPDF();
        const tableData = groups.filter(g => !g.isDM).map(g => [
            g.name,
            g.members?.length || 0,
            g.admins?.length || 0,
            g.createdBy?.split('@')[0] || 'Unknown'
        ]);

        doc.autoTable({
            startY: 40, head: [['Department Name', 'Members', 'Admins', 'Created By']], body: tableData,
            theme: 'grid', headStyles: { fillColor: [20, 184, 166], textColor: [255, 255, 255], fontStyle: 'bold' },
            styles: { fontSize: 9, cellPadding: 4 }
        });
        generatePDFHeaderFooter(doc, 'Department Roster Report');
        doc.save(`Department_Roster_${Date.now()}.pdf`);
    };

    const exportTasksPDF = () => {
        const doc = new jsPDF();
        const tableData = filteredTasks.map(t => [
            stripHtml(t.text).substring(0, 60) + (stripHtml(t.text).length > 60 ? '...' : ''),
            t.sender.split('@')[0],
            (t.taskData?.assignees || []).map(a => a.split('@')[0]).join(', '),
            t.taskData?.status || 'Unknown',
            t.taskData?.deadline ? new Date(t.taskData.deadline).toLocaleDateString() : 'N/A'
        ]);

        doc.autoTable({
            startY: 40, head: [['Task Detail', 'Creator', 'Assignees', 'Status', 'Deadline']], body: tableData,
            theme: 'grid', headStyles: { fillColor: [245, 158, 11], textColor: [255, 255, 255], fontStyle: 'bold' },
            styles: { fontSize: 8, cellPadding: 3 }, columnStyles: { 0: { cellWidth: 70 } }
        });
        generatePDFHeaderFooter(doc, 'Master Task Ledger');
        doc.save(`Task_Master_Report_${Date.now()}.pdf`);
    };

    // --- UI HELPERS ---
    const getStatusColor = (status) => {
        switch(status) {
            case 'Completed': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'In Progress': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
            case 'Acknowledged': return 'bg-blue-100 text-blue-700 border-blue-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const getPriorityColor = (priority) => {
        switch(priority) {
            case 'High': return 'bg-rose-100 text-rose-700 border-rose-200';
            case 'Medium': return 'bg-amber-100 text-amber-700 border-amber-200';
            default: return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-slate-50 relative overflow-hidden">
            
            {/* Header */}
            <div className="h-[70px] bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-sm z-20">
                <div className="flex items-center gap-4">
                    <button onClick={() => setViewMode('chat')} className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors">
                        <i className="fa-solid fa-arrow-left"></i>
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 leading-tight">Admin Console</h2>
                        <p className="text-[12px] text-slate-500 font-medium">Workspace Management & Telemetry</p>
                    </div>
                </div>
                
                {/* Dynamic Global Export Buttons */}
                {activeTab === 'overview' && (
                    <button onClick={exportOverviewPDF} className="px-4 py-2 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-lg text-sm font-bold shadow-sm hover:bg-indigo-100 transition-colors flex items-center gap-2">
                        <i className="fa-solid fa-file-pdf"></i> Download PDF
                    </button>
                )}
                {activeTab === 'groups' && (
                    <button onClick={exportGroupsPDF} className="px-4 py-2 bg-teal-50 text-teal-600 border border-teal-200 rounded-lg text-sm font-bold shadow-sm hover:bg-teal-100 transition-colors flex items-center gap-2">
                        <i className="fa-solid fa-file-pdf"></i> Download PDF
                    </button>
                )}
                {activeTab === 'tasks' && (
                    <button onClick={exportTasksPDF} className="px-4 py-2 bg-amber-50 text-amber-600 border border-amber-200 rounded-lg text-sm font-bold shadow-sm hover:bg-amber-100 transition-colors flex items-center gap-2">
                        <i className="fa-solid fa-file-pdf"></i> Download PDF
                    </button>
                )}
            </div>

            {/* Navigation Tabs */}
            <div className="bg-white px-6 border-b border-slate-200 flex gap-6 shrink-0 pt-2 z-10 overflow-x-auto">
                {[
                    { id: 'overview', label: 'Overview', icon: 'fa-chart-pie' },
                    { id: 'users', label: 'Directory', icon: 'fa-users' },
                    { id: 'groups', label: 'Departments', icon: 'fa-layer-group' },
                    { id: 'tasks', label: 'Task Master', icon: 'fa-tasks' },
                    { id: 'sla', label: 'SLA Compliance', icon: 'fa-ranking-star' },
                    { id: 'audit', label: 'Audit Logs', icon: 'fa-clipboard-list' }
                ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`pb-3 text-[13px] font-bold tracking-wide transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'}`}>
                        <i className={`fa-solid ${tab.icon}`}></i> {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 custom-sidebar-scroll">
                
                {/* OVERVIEW TAB */}
                {activeTab === 'overview' && (
                    <div className="animate-in slide-in-from-bottom-4 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow">
                                <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 text-lg"><i className="fa-solid fa-users"></i></div>
                                <div><p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Total Users</p><h3 className="text-2xl font-extrabold text-slate-800">{totalUsers}</h3></div>
                            </div>
                            
                            <div onClick={() => setActiveTab('users')} className="bg-white p-5 rounded-2xl shadow-sm border border-amber-200 flex items-center gap-4 cursor-pointer hover:shadow-md hover:bg-amber-50 transition-all group relative overflow-hidden">
                                <div className="absolute right-0 top-0 w-1 h-full bg-amber-400"></div>
                                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-lg"><i className="fa-solid fa-user-clock"></i></div>
                                <div><p className="text-[11px] font-bold text-amber-600 uppercase tracking-widest group-hover:text-amber-700">Approvals</p><h3 className="text-2xl font-extrabold text-amber-700">{pendingApprovals}</h3></div>
                            </div>

                            <div onClick={() => setActiveTab('groups')} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4 cursor-pointer hover:shadow-md hover:bg-slate-50 transition-all">
                                <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 text-lg"><i className="fa-solid fa-layer-group"></i></div>
                                <div><p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Departments</p><h3 className="text-2xl font-extrabold text-slate-800">{totalGroups}</h3></div>
                            </div>

                            <div onClick={() => { setActiveTab('tasks'); setTaskStatusFilter('All'); }} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4 cursor-pointer hover:shadow-md hover:bg-slate-50 transition-all">
                                <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 text-lg"><i className="fa-solid fa-spinner"></i></div>
                                <div><p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Active Tasks</p><h3 className="text-2xl font-extrabold text-slate-800">{activeTasks.length}</h3></div>
                            </div>

                            <div onClick={() => { setActiveTab('tasks'); setTaskStatusFilter('All'); }} className="bg-white p-5 rounded-2xl shadow-sm border border-rose-200 flex items-center gap-4 cursor-pointer hover:shadow-md hover:bg-rose-50 transition-all group relative overflow-hidden">
                                <div className="absolute right-0 top-0 w-1 h-full bg-rose-500 animate-pulse"></div>
                                <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 text-lg"><i className="fa-solid fa-fire"></i></div>
                                <div><p className="text-[11px] font-bold text-rose-600 uppercase tracking-widest group-hover:text-rose-700">Escalated</p><h3 className="text-2xl font-extrabold text-rose-700">{escalatedTasks.length}</h3></div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2"><i className="fa-solid fa-bolt text-amber-500"></i> Workspace Live Pulse (Last 30 Actions)</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                                            <th className="p-3 pl-6 font-bold w-48">Timestamp</th>
                                            <th className="p-3 font-bold w-40">Actor</th>
                                            <th className="p-3 font-bold w-40">Action</th>
                                            <th className="p-3 pr-6 font-bold">Details</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recentActivity.map(log => (
                                            <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors text-sm">
                                                <td className="p-3 pl-6 text-slate-500 font-medium text-xs">{log.timestamp?.toDate ? new Date(log.timestamp.toDate()).toLocaleString() : 'N/A'}</td>
                                                <td className="p-3 font-bold text-indigo-600">{log.userEmail?.split('@')[0] || 'System'}</td>
                                                <td className="p-3">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${log.action?.includes('System') || log.action?.includes('SECURITY') ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                                        {log.action || 'Unknown'}
                                                    </span>
                                                </td>
                                                <td className="p-3 pr-6 text-slate-700 truncate max-w-md">{stripHtml(log.details)}</td>
                                            </tr>
                                        ))}
                                        {recentActivity.length === 0 && (
                                            <tr><td colSpan="4" className="p-8 text-center text-slate-400 font-medium">No recent activity detected.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* DIRECTORY TAB (Users) */}
                {activeTab === 'users' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800">User Directory</h3>
                            <div className="text-xs font-bold text-slate-500">{pendingApprovals} Pending Approvals</div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                                        <th className="p-4 font-bold">Employee Profile</th>
                                        <th className="p-4 font-bold">System Role</th>
                                        <th className="p-4 font-bold">Group Privileges</th>
                                        <th className="p-4 font-bold">Access Status</th>
                                        <th className="p-4 font-bold text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dbUsers.map(u => (
                                        <tr key={u.uid} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                            <td className="p-4 flex items-center gap-3">
                                                <MemoizedAvatar uid={u.uid} url={u.profilePicUrl} name={u.name} sizeClass="w-8 h-8" />
                                                <div>
                                                    <div className="text-sm font-bold text-slate-800">{u.name}</div>
                                                    <div className="text-[11px] text-slate-400 font-medium">{u.email}</div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${u.isAdmin ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                                    {u.isAdmin ? 'Administrator' : 'Standard User'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-xs font-bold text-slate-600">
                                                {u.canCreateGroups ? <span className="text-emerald-600"><i className="fa-solid fa-check mr-1"></i> Authorized</span> : <span className="text-slate-400"><i className="fa-solid fa-xmark mr-1"></i> Restricted</span>}
                                            </td>
                                            <td className="p-4">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${u.isApproved ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200 animate-pulse'}`}>
                                                    {u.isApproved ? 'Approved' : 'Pending Review'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => handleToggleApprove(u)} className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${u.isApproved ? 'bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 shadow-sm'}`}>
                                                        {u.isApproved ? 'Revoke Access' : 'Approve Entry'}
                                                    </button>
                                                    <button onClick={() => handleToggleAdmin(u)} className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors border ${u.isAdmin ? 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200' : 'bg-purple-50 text-purple-600 hover:bg-purple-100 border-purple-200'}`}>
                                                        {u.isAdmin ? 'Remove Admin' : 'Make Admin'}
                                                    </button>
                                                    <button onClick={() => handleToggleCanCreateGroups(u)} className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
                                                        Toggle Groups
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 🚀 PHASE 3: DEPARTMENTS TAB WITH INLINE EXPANSION */}
                {activeTab === 'groups' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800">Department Roster</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                                        <th className="p-4 font-bold">Department Name</th>
                                        <th className="p-4 font-bold">Member Count</th>
                                        <th className="p-4 font-bold">Admin Count</th>
                                        <th className="p-4 font-bold">Created By</th>
                                        <th className="p-4 font-bold text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {groups.filter(g => !g.isDM).map(g => (
                                        <React.Fragment key={g.id}>
                                            <tr onClick={() => setExpandedGroup(expandedGroup === g.id ? null : g.id)} className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer group">
                                                <td className="p-4 flex items-center gap-3">
                                                    {g.profilePicUrl ? (
                                                        <MemoizedAvatar uid={g.id} url={g.profilePicUrl} name={g.name} sizeClass="w-8 h-8" />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center text-teal-600"><i className="fa-solid fa-users text-xs"></i></div>
                                                    )}
                                                    <span className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{g.name} <i className={`fa-solid fa-chevron-${expandedGroup === g.id ? 'up' : 'down'} text-[10px] text-slate-400 ml-2`}></i></span>
                                                </td>
                                                <td className="p-4 text-sm font-bold text-slate-600">{g.members?.length || 0} Members</td>
                                                <td className="p-4 text-sm font-bold text-indigo-600">{g.admins?.length || 0} Admins</td>
                                                <td className="p-4 text-xs font-bold text-slate-500">{g.createdBy?.split('@')[0]}</td>
                                                <td className="p-4 text-right">
                                                    <button onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingGroup(g);
                                                        setGroupForm({ name: g.name, members: g.members || [], admins: g.admins || [], profilePicUrl: g.profilePicUrl });
                                                        setActiveModal('group_form_modal');
                                                    }} className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white border border-slate-200 text-indigo-600 hover:bg-indigo-50 transition-colors shadow-sm">
                                                        Edit Config
                                                    </button>
                                                </td>
                                            </tr>
                                            {/* Sub-table for Active Tasks associated with this department */}
                                            {expandedGroup === g.id && (
                                                <tr className="bg-slate-50 border-b border-slate-200 shadow-inner">
                                                    <td colSpan="5" className="p-4">
                                                        <div className="pl-6 border-l-[3px] border-teal-300 py-2">
                                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><i className="fa-solid fa-spinner"></i> Active Department Tasks</h4>
                                                            <div className="space-y-2">
                                                                {activeTasks.filter(t => t.taskData?.assignees?.some(email => g.members?.includes(email))).length === 0 ? (
                                                                    <div className="text-xs text-slate-500 italic">No active tasks for this department.</div>
                                                                ) : (
                                                                    activeTasks.filter(t => t.taskData?.assignees?.some(email => g.members?.includes(email))).map(t => (
                                                                        <div key={t.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                                                                            <div className="text-sm font-semibold text-slate-700 truncate w-[400px]">{stripHtml(t.text)}</div>
                                                                            <div className="flex items-center gap-3">
                                                                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${getStatusColor(t.taskData?.status)}`}>{t.taskData?.status}</span>
                                                                                <div className="text-[10px] text-slate-500 font-bold w-24 text-right">Due: {t.taskData?.deadline ? new Date(t.taskData.deadline).toLocaleDateString() : 'N/A'}</div>
                                                                            </div>
                                                                        </div>
                                                                    ))
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                    {groups.filter(g => !g.isDM).length === 0 && (
                                        <tr><td colSpan="5" className="p-8 text-center text-slate-400 font-medium">No active departments found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 🚀 PHASE 4: TASK MASTERhhh TAB WITH INLINE EXPANSION */}
                {activeTab === 'tasks' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800">Global Task Registry</h3>
                            <select value={taskStatusFilter} onChange={(e) => setTaskStatusFilter(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-medium outline-none focus:border-indigo-500 shadow-sm text-slate-700 bg-white">
                                <option value="All">All Statuses</option>
                                <option value="Pending">Pending</option>
                                <option value="Acknowledged">Acknowledged</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Completed">Completed</option>
                            </select>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                                        <th className="p-4 font-bold">Task Detail</th>
                                        <th className="p-4 font-bold">Creator</th>
                                        <th className="p-4 font-bold">Assignees</th>
                                        <th className="p-4 font-bold">Flags</th>
                                        <th className="p-4 font-bold">Deadline</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTasks.map(task => (
                                        <React.Fragment key={task.id}>
                                            <tr onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)} className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer group">
                                                <td className="p-4">
                                                    <div className="text-sm font-bold text-slate-800 line-clamp-2 w-64 group-hover:text-indigo-600 transition-colors" title={stripHtml(task.text)}>
                                                        {stripHtml(task.text)} <i className={`fa-solid fa-chevron-${expandedTask === task.id ? 'up' : 'down'} text-[10px] text-slate-400 ml-1`}></i>
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 mt-1">{new Date(task.timestamp?.toDate()).toLocaleString()}</div>
                                                </td>
                                                <td className="p-4 text-xs font-bold text-slate-600">{task.sender.split('@')[0]}</td>
                                                <td className="p-4">
                                                    <div className="flex -space-x-2">
                                                        {(task.taskData?.assignees || []).slice(0, 3).map(email => (
                                                            <MemoizedAvatar key={email} uid={email} name={email.split('@')[0]} sizeClass="w-6 h-6 border-2 border-white" />
                                                        ))}
                                                        {(task.taskData?.assignees || []).length > 3 && (
                                                            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600 border-2 border-white relative z-10">
                                                              +{(task.taskData.assignees.length - 3)}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex flex-col gap-1.5 items-start">
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${getPriorityColor(task.taskData?.priority)}`}>{task.taskData?.priority}</span>
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${getStatusColor(task.taskData?.status)}`}>{task.taskData?.status}</span>
                                                        {task.taskData?.escalated && <span className="text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider bg-rose-100 text-rose-700 border-rose-300 animate-pulse">Escalated</span>}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-xs font-bold text-slate-600">{task.taskData?.deadline ? new Date(task.taskData.deadline).toLocaleDateString() : 'N/A'}</td>
                                            </tr>
                                            {/* Sub-table for Task Audit Trail */}
                                            {expandedTask === task.id && (
                                                <tr className="bg-slate-50 border-b border-slate-200 shadow-inner">
                                                    <td colSpan="5" className="p-4">
                                                        <div className="pl-6 border-l-[3px] border-amber-300 py-2">
                                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><i className="fa-solid fa-list-check"></i> Immutable Task Trail</h4>
                                                            <div className="space-y-1.5">
                                                                {(task.taskData?.trail || []).map((tr, i) => (
                                                                    <div key={i} className="text-[12px] bg-white border border-slate-200 rounded p-2 flex gap-3 items-center shadow-sm">
                                                                        <span className="font-bold text-slate-400 w-28 shrink-0">{tr.time?.split(',')[0]}</span>
                                                                        <span className={`font-bold uppercase tracking-wider text-[9px] px-1.5 py-0.5 rounded ${tr.action.includes('Created') ? 'bg-amber-100 text-amber-700' : tr.action.includes('Completed') ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                                                            {tr.action}
                                                                        </span>
                                                                        <span className="font-semibold text-slate-700">by {tr.by?.split('@')[0]}</span>
                                                                        {tr.to && <span className="text-slate-500">to <span className="font-semibold text-indigo-600">{tr.to}</span></span>}
                                                                        {tr.comment && <span className="italic text-slate-500 truncate">- "{tr.comment}"</span>}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                    {filteredTasks.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-slate-400 font-medium">No tasks found matching criteria.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* SLA COMPLIANCE TAB */}
                {activeTab === 'sla' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in">
                        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-slate-800">Employee Compliance Dashboard</h3>
                                <p className="text-xs text-slate-500 mt-0.5">Real-time performance and escalation telemetry.</p>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                                        <th className="p-4 font-bold">Employee</th>
                                        <th className="p-4 font-bold text-center">Total Assigned</th>
                                        <th className="p-4 font-bold text-center">Completed On Time</th>
                                        <th className="p-4 font-bold text-center text-rose-600">SLA Breaches</th>
                                        <th className="p-4 font-bold text-right">Compliance Rating</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {slaMetrics.map(user => (
                                        <tr key={user.uid} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                            <td className="p-4 flex items-center gap-3">
                                                <MemoizedAvatar uid={user.uid} url={user.profilePicUrl} name={user.name} sizeClass="w-8 h-8" />
                                                <div>
                                                    <div className="text-sm font-bold text-slate-800">{user.name}</div>
                                                    <div className="text-[11px] text-slate-400">{user.email}</div>
                                                </div>
                                            </td>
                                            <td className="p-4 text-center text-sm font-bold text-slate-600">{user.totalAssigned}</td>
                                            <td className="p-4 text-center text-sm font-bold text-emerald-600">{user.completedOnTime}</td>
                                            <td className="p-4 text-center text-sm font-bold text-rose-600">{user.totalBreaches}</td>
                                            <td className="p-4 text-right">
                                                {user.totalAssigned === 0 ? (
                                                    <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">No Data</span>
                                                ) : (
                                                    <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${user.complianceScore >= 90 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : user.complianceScore >= 75 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                                                        {user.complianceScore}% SLA
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* AUDIT LOGS TAB */}
                {activeTab === 'audit' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in flex flex-col h-[75vh]">
                        
                        <div className="p-4 border-b border-slate-200 bg-slate-50 shrink-0">
                            <h3 className="font-bold text-slate-800 mb-3">Immutable Audit Ledger</h3>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                <input type="text" placeholder="Filter by User..." className="text-sm p-2 rounded-lg border border-slate-300 outline-none focus:border-indigo-500 shadow-sm" value={localAuditSearch} onChange={e => setLocalAuditSearch(e.target.value)} />
                                <input type="date" className="text-sm p-2 rounded-lg border border-slate-300 outline-none focus:border-indigo-500 shadow-sm text-slate-600" value={adminFilterDate} onChange={e => setAdminFilterDate(e.target.value)} />
                                <select className="text-sm p-2 rounded-lg border border-slate-300 outline-none focus:border-indigo-500 shadow-sm text-slate-600" value={adminFilterType} onChange={e => setAdminFilterType(e.target.value)}>
                                    <option value="">All Action Types</option>
                                    <option value="TASK_CREATE">Task Creation</option>
                                    <option value="TASK_EDIT">Task Modification</option>
                                    <option value="TASK_DELETE">Task Deletion</option>
                                    <option value="FILE_UPLOAD">File Upload</option>
                                    <option value="SECURITY">Security/Access</option>
                                </select>
                                <input type="text" placeholder="Filter by Context (Group/Task)..." className="text-sm p-2 rounded-lg border border-slate-300 outline-none focus:border-indigo-500 shadow-sm" value={adminFilterGroup} onChange={e => setAdminFilterGroup(e.target.value)} />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-sidebar-scroll">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 bg-slate-100 shadow-sm z-10">
                                    <tr className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                                        <th className="p-4 font-bold w-48">Timestamp</th>
                                        <th className="p-4 font-bold w-48">Actor</th>
                                        <th className="p-4 font-bold w-48">Action Category</th>
                                        <th className="p-4 font-bold">Audit Detail / Payload</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAuditLogs.filter(l => !localAuditSearch || l.userEmail?.toLowerCase().includes(localAuditSearch.toLowerCase())).map(log => (
                                        <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                            <td className="p-4 text-xs font-medium text-slate-500">
                                                {log.timestamp?.toDate ? new Date(log.timestamp.toDate()).toLocaleString() : 'N/A'}
                                            </td>
                                            <td className="p-4 text-sm font-bold text-slate-700">{log.userEmail?.split('@')[0]}</td>
                                            <td className="p-4">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${log.action === 'SECURITY' ? 'bg-rose-50 text-rose-700 border-rose-200' : log.action?.includes('DELETE') ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                                    {log.action || 'Unknown'}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className="text-sm font-medium text-slate-800 break-words">{log.details}</div>
                                                {log.groupName && <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">Context: {log.groupName}</div>}
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredAuditLogs.length === 0 && (
                                        <tr><td colSpan="4" className="p-8 text-center text-slate-400 font-medium">No audit logs matching filters.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
