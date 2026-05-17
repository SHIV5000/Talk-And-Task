import React, { useState } from 'react';
import EscalationLogPanel from './EscalationLogPanel'; // ← ADDED

export default function AdminPanel({
  setViewMode, setActiveModal, dbUsers, groups,
  filteredAuditLogs, adminFilterUser, setAdminFilterUser,
  adminFilterDate, setAdminFilterDate, adminFilterType, setAdminFilterType,
  adminFilterGroup, setAdminFilterGroup,
  handleToggleApprove, handleToggleAdmin, handleToggleCanCreateGroups,
  setSelectedMessage, setIsEditingTaskTitle, messages, setGroupForm,
  setEditingGroup, groupForm, editingGroup, handleGroupSubmit,
  handleGroupPicUpload, groupPicUploadProgress, globalAnnouncement,
  currentUserData, authUser  // ← authUser now accepted
}) {

  const [activeTab, setActiveTab] = useState('overview');

  // ... All your existing logic (filters, stats, etc.) stays exactly the same ...
  // I’m only showing the parts that changed for brevity.

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => setViewMode('chat')} className="text-slate-500 hover:text-slate-800">
            <i className="fa-solid fa-arrow-left mr-2"></i>Back
          </button>
          <h1 className="text-xl font-bold text-slate-800">Admin Console</h1>
        </div>
        {globalAnnouncement?.isActive && (
          <div className="bg-indigo-50 text-indigo-700 px-4 py-1.5 rounded-full text-sm font-bold">
            <i className="fa-solid fa-bullhorn mr-2 animate-pulse"></i>
            Broadcast Active
          </div>
        )}
      </div>

      {/* Tabs - Escalations added here */}
      <div className="flex border-b border-slate-200 bg-white px-6 gap-1 overflow-x-auto">
        {['overview', 'people', 'tasks', 'logs', 'broadcast', 'tags', 'organization', 'escalations'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab === 'escalations' ? 'Escalations' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'overview' && (
          <div>{/* your existing overview content */}</div>
        )}
        {activeTab === 'people' && (
          <div>{/* your existing people management */}</div>
        )}
        {activeTab === 'tasks' && (
          <div>{/* your existing tasks view */}</div>
        )}
        {activeTab === 'logs' && (
          <div>{/* your existing audit logs */}</div>
        )}
        {activeTab === 'broadcast' && (
          <div>{/* your existing broadcast tools */}</div>
        )}
        {activeTab === 'tags' && (
          <div>{/* your existing custom tags */}</div>
        )}
        {activeTab === 'organization' && (
          <div>{/* your existing groups/departments */}</div>
        )}

        {/* Escalation Management */}
        {activeTab === 'escalations' && (
          <EscalationLogPanel currentUser={authUser} />
        )}
      </div>
    </div>
  );
}
