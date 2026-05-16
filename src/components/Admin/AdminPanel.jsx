import React, { useState, useMemo } from 'react';
import MemoizedAvatar from '../Common/MemoizedAvatar.jsx';

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

    // Overview Metrics
    const totalUsers = dbUsers.length;
    const pendingApprovals = dbUsers.filter(u => !u.isApproved).length;
    const totalGroups = groups.length;
    
    const allTasks = messages.filter(m => m.isTask);
    const activeTasks = allTasks.filter(m => m.taskData?.status !== "Completed");
    const completedTasks = allTasks.filter(m => m.taskData?.status === "Completed");
    const escalatedTasks = allTasks.filter(m => m.taskData?.escalated === true);

    // Filter Tasks for Task Tab
    const filteredTasks = useMemo(() => {
        let filtered = allTasks;
        if (taskStatusFilter !== 'All') {
            filtered = filtered.filter(t => t.taskData?.status === taskStatusFilter);
        }
        return filtered.sort((a,b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
    }, [allTasks, taskStatusFilter]);

    // SLA Compliance Telemetry
    const slaMetrics = useMemo(() => {
        return dbUsers.map(user => {
            const userTasks = allTasks.filter(t => t.taskData?.assignees?.includes(user.email));
            const totalAssigned = userTasks.length;
            const breachedTasks = allTasks.filter(t => (t.taskData?.breachedBy || []).includes(user.email));
            const totalBreaches = breachedTasks.length;
            const completedOnTime = userTasks.filter(t => t.taskData?.status === "Completed" && !breachedTasks.includes(t)).length;
            
            let complianceScore = 100;
            if (totalAssigned > 0) {
                complianceScore = Math.round(((totalAssigned - totalBreaches) / totalAssigned) * 100);
            } else {
                complianceScore = 0; 
            }

            return { ...user, totalAssigned, completedOnTime, totalBreaches, complianceScore };
        }).sort((a, b) => a.complianceScore - b.complianceScore); // Sort worst offenders to top
    }, [dbUsers, allTasks]);

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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in slide-in-from-bottom-4">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-5">
                            <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 text-xl"><i className="fa-solid fa-users"></i></div>
                            <div><p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Total Users</p><h3 className="text-3xl font-extrabold text-slate-800">{totalUsers}</h3></div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-5">
                            <div className="w-14 h-14 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 text-xl"><i className="fa-solid fa-layer-group"></i></div>
                            <div><p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Departments</p><h3 className="text-3xl font-extrabold text-slate-800">{totalGroups}</h3></div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-5 relative overflow-hidden">
                            <div className="absolute right-0 top-0 w-2 h-full bg-amber-400"></div>
                            <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 text-xl"><i className="fa-solid fa-spinner"></i></div>
                            <div><p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Active Tasks</p><h3 className="text-3xl font-extrabold text-slate-800">{activeTasks.length}</h3></div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-rose-200 flex items-center gap-5 relative overflow-hidden">
                            <div className="absolute right-0 top-0 w-2 h-full bg-rose-500 animate-pulse"></div>
                            <div className="w-14 h-14 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 text-xl"><i className="fa-solid fa-fire"></i></div>
                            <div><p className="text-sm font-bold text-rose-500 uppercase tracking-widest">Escalated</p><h3 className="text-3xl font-extrabold text-rose-700">{escalatedTasks.length}</h3></div>
                        </div>
                    </div>
                )}

                {/* TASK MASTER TAB */}
                {activeTab === 'tasks' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800">Global Task Registry</h3>
                            <select value={taskStatusFilter} onChange={(e) => setTaskStatusFilter(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-medium outline-none focus:border-indigo-500">
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
                                        <tr key={task.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                            <td className="p-4">
                                                <div className="text-sm font-bold text-slate-800 line-clamp-2 w-64" dangerouslySetInnerHTML={{__html: task.text}}></div>
                                                <div className="text-[10px] text-slate-400 mt-1">{new Date(task.timestamp?.toDate()).toLocaleString()}</div>
                                            </td>
                                            <td className="p-4 text-xs font-bold text-slate-600">{task.sender.split('@')[0]}</td>
                                            <td className="p-4">
                                                <div className="flex -space-x-2">
                                                    {(task.taskData?.assignees || []).slice(0, 3).map(email => (
                                                        <MemoizedAvatar key={email} uid={email} name={email.split('@')[0]} sizeClass="w-6 h-6 border-2 border-white" />
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-col gap-1.5 items-start">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${getPriorityColor(task.taskData?.priority)}`}>{task.taskData?.priority}</span>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${getStatusColor(task.taskData?.status)}`}>{task.taskData?.status}</span>
                                                    {task.taskData?.escalated && <span className="text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider bg-rose-100 text-rose-700 border-rose-300 animate-pulse">Escalated</span>}
                                                </div>
                                            </td>
                                            <td className="p-4 text-xs font-bold text-slate-600">{new Date(task.taskData?.deadline).toLocaleDateString()}</td>
                                        </tr>
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
            </div>
        </div>
    );
}
