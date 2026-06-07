import React, { useEffect, useMemo, useState } from 'react';
import VersionDisplay from '../Common/VersionDisplay.jsx';

const inRange = (message, start, end) => {
  const ms = message.timestamp?.toMillis?.() || (message.timestamp?.toDate ? message.timestamp.toDate().getTime() : 0);
  if (!ms) return false;
  if (start && ms < new Date(start).setHours(0, 0, 0, 0)) return false;
  if (end && ms > new Date(end).setHours(23, 59, 59, 999)) return false;
  return true;
};

export default function RightSidebar({ messages = [], user, sidebarWidth, dbUsers = [], currentUserData, appVersion, featureFlags = {}, orgId }) {
  const [preset, setPreset] = useState('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [liveRefreshTick, setLiveRefreshTick] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => setLiveRefreshTick((tick) => tick + 1), 30000);
    return () => window.clearInterval(interval);
  }, []);

  const range = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    if (preset === 'week') start.setDate(now.getDate() - 6);
    if (preset === 'month') start.setMonth(now.getMonth() - 1);
    if (preset === 'custom') return { start: startDate, end: endDate || startDate };
    return { start: start.toISOString().split('T')[0], end: now.toISOString().split('T')[0] };
  }, [preset, startDate, endDate]);

  const stats = useMemo(() => {
    // messages is fed by Firestore snapshots; liveRefreshTick keeps date/online cards fresh without a page reload.
    const scoped = messages.filter((m) => inRange(m, range.start, range.end));
    const sent = scoped.filter((m) => m.senderEmail === user.email);
    const received = scoped.filter((m) => m.senderEmail !== user.email && (!m.isPrivateMention || m.allowedUsers?.includes(user.email)));
    return [
      { label: 'Messages Sent', value: sent.filter((m) => !m.isTask).length, icon: 'fa-paper-plane', tone: 'bg-blue-50 text-blue-700 border-blue-100' },
      { label: 'Messages Received', value: received.filter((m) => !m.isTask).length, icon: 'fa-inbox', tone: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
      { label: 'Messages Acknowledged', value: scoped.filter((m) => m.taskData?.ackBy?.[user.email] || (m.seenBy || []).includes(user.email)).length, icon: 'fa-circle-check', tone: 'bg-lime-50 text-lime-700 border-lime-100' },
      { label: 'Messages Replied', value: scoped.filter((m) => m.replyToId && m.senderEmail === user.email).length, icon: 'fa-reply', tone: 'bg-purple-50 text-purple-700 border-purple-100' },
      { label: 'Tasks Allotted To Me', value: scoped.filter((m) => m.isTask && m.taskData?.assignees?.includes(user.email)).length, icon: 'fa-list-check', tone: 'bg-amber-50 text-amber-700 border-amber-100' },
      { label: 'Task Completed', value: scoped.filter((m) => m.isTask && m.taskData?.status === 'Completed' && (m.senderEmail === user.email || m.taskData?.assignees?.includes(user.email))).length, icon: 'fa-flag-checkered', tone: 'bg-rose-50 text-rose-700 border-rose-100' },
    ];
  }, [messages, range, user.email, liveRefreshTick]);

  const onlineCount = useMemo(() => dbUsers.filter(u => u.lastActive && Date.now() - (u.lastActive?.toMillis?.() || 0) < 900000).length, [dbUsers, liveRefreshTick]);

  const filters = [
    ['today', 'Today'],
    ['week', 'This Week'],
    ['month', 'This Month'],
    ['custom', 'Date Picker'],
  ];

  if (featureFlags.advancedAnalytics === false) return null;

  return (
    <aside className="hidden lg:flex shrink-0 h-full bg-slate-100 border-l border-slate-200 flex-col p-3 gap-2 overflow-hidden" style={{ width: `${sidebarWidth || 380}px` }}>
      <div className="bg-white text-slate-800 rounded-2xl p-3 shadow-sm border border-slate-200">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">User Analytics</div>
        <div className="mt-2 text-[11px] font-black uppercase tracking-[0.18em] text-indigo-500 truncate">{currentUserData?.orgName || currentUserData?.organizationName || currentUserData?.schoolName || orgId || 'Organization'}</div>
        <div className="mt-1 text-sm font-black truncate">{currentUserData?.name || user.email.split('@')[0]}</div>
        <VersionDisplay appVersion={appVersion} />
      </div>
      <div className="rounded-2xl p-3 bg-white border border-emerald-100 shadow-sm flex items-center justify-between">
        <div><div className="text-[10px] font-bold uppercase text-slate-500">Online Users</div><div className="text-lg font-black text-emerald-700">{onlineCount}</div></div>
        <i className="fa-solid fa-user-check text-2xl text-emerald-600"></i>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {filters.map(([key, label]) => (
          <button key={key} onClick={() => setPreset(key)} className={`rounded-xl p-2 text-left text-xs font-black border shadow-sm transition-all ${preset === key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>{label}</button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="grid grid-cols-2 gap-2 bg-white rounded-2xl p-3 border border-slate-200 shadow-sm">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="modern-date-input" />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="modern-date-input" />
        </div>
      )}
      <div className="grid grid-cols-1 gap-2 flex-1">
        {stats.map((item) => (
          <div key={item.label} className={`rounded-2xl p-3 border ${item.tone} shadow-sm min-h-0 flex items-center justify-between`}>
            <div><div className="text-[11px] font-bold uppercase opacity-80">{item.label}</div><div className="text-xl font-black mt-1">{item.value}</div></div>
            <i className={`fa-solid ${item.icon} text-2xl opacity-60`}></i>
          </div>
        ))}
      </div>
    </aside>
  );
}
