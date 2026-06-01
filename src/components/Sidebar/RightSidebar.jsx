import React, { useMemo, useState } from 'react';

const inRange = (message, start, end) => {
  const ms = message.timestamp?.toMillis?.() || (message.timestamp?.toDate ? message.timestamp.toDate().getTime() : 0);
  if (!ms) return false;
  if (start && ms < new Date(start).setHours(0, 0, 0, 0)) return false;
  if (end && ms > new Date(end).setHours(23, 59, 59, 999)) return false;
  return true;
};

export default function RightSidebar({ messages = [], user, sidebarWidth, dbUsers = [], currentUserData, appVersion }) {
  const [preset, setPreset] = useState('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const range = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    if (preset === 'week') start.setDate(now.getDate() - 6);
    if (preset === 'month') start.setMonth(now.getMonth() - 1);
    if (preset === 'custom') return { start: startDate, end: endDate || startDate };
    return { start: start.toISOString().split('T')[0], end: now.toISOString().split('T')[0] };
  }, [preset, startDate, endDate]);

  const stats = useMemo(() => {
    const scoped = messages.filter((m) => inRange(m, range.start, range.end));
    const sent = scoped.filter((m) => m.senderEmail === user.email);
    const received = scoped.filter((m) => m.senderEmail !== user.email && (!m.isPrivateMention || m.allowedUsers?.includes(user.email)));
    return [
      { label: 'Messages Sent', value: sent.filter((m) => !m.isTask).length, icon: 'fa-paper-plane', tone: 'from-blue-600 to-indigo-600' },
      { label: 'Messages Received', value: received.filter((m) => !m.isTask).length, icon: 'fa-inbox', tone: 'from-emerald-600 to-teal-600' },
      { label: 'Messages Acknowledged', value: scoped.filter((m) => m.taskData?.ackBy?.[user.email] || (m.seenBy || []).includes(user.email)).length, icon: 'fa-circle-check', tone: 'from-lime-600 to-emerald-700' },
      { label: 'Messages Replied', value: scoped.filter((m) => m.replyToId && m.senderEmail === user.email).length, icon: 'fa-reply', tone: 'from-purple-600 to-fuchsia-600' },
      { label: 'Task Allotted', value: scoped.filter((m) => m.isTask && m.senderEmail === user.email).length, icon: 'fa-list-check', tone: 'from-orange-600 to-amber-600' },
      { label: 'Task Completed', value: scoped.filter((m) => m.isTask && m.taskData?.status === 'Completed' && (m.senderEmail === user.email || m.taskData?.assignees?.includes(user.email))).length, icon: 'fa-flag-checkered', tone: 'from-rose-600 to-red-600' },
    ];
  }, [messages, range, user.email]);

  const onlineCount = useMemo(() => dbUsers.filter(u => u.lastActive && Date.now() - (u.lastActive?.toMillis?.() || 0) < 900000).length, [dbUsers]);

  const filters = [
    ['today', 'Today'],
    ['week', 'This Week'],
    ['month', 'This Month'],
    ['custom', 'Date Picker'],
  ];

  return (
    <aside className="hidden lg:flex shrink-0 h-full bg-white border-l border-slate-200 flex-col p-3 gap-2 overflow-hidden" style={{ width: `${sidebarWidth || 380}px` }}>
      <div className="bg-white text-slate-800 border-l-2 border-indigo-400 pl-3 py-2">
        <div className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-slate-400">User Analytics</div>
        <div className="mt-1 text-sm font-bold truncate">{currentUserData?.name || user.email.split('@')[0]}</div>
        <div className="mt-1 text-[10px] font-mono text-slate-400">Ver. {appVersion}</div>
      </div>
      <div className="flex gap-3 hover:bg-slate-50 py-1.5 px-2 -mx-2 rounded transition-colors group border-l-2 border-green-400 pl-3 items-center justify-between">
        <div><div className="text-[10px] font-mono uppercase text-slate-500">Online Users</div><div className="text-lg font-mono font-bold text-emerald-700">{onlineCount}</div></div>
        <i className="fa-solid fa-user-check text-2xl text-emerald-600"></i>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {filters.map(([key, label]) => (
          <button key={key} onClick={() => setPreset(key)} className={`rounded-full border px-3 py-1.5 text-[11px] font-mono transition-all ${preset === key ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-600'}`}>{label}</button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="grid grid-cols-2 gap-2 bg-white rounded-md p-3 border border-slate-200">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="modern-date-input" />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="modern-date-input" />
        </div>
      )}
      <div className="grid grid-cols-1 gap-1.5 flex-1">
        {stats.map((item) => (
          <div key={item.label} className="flex gap-3 hover:bg-slate-50 py-1.5 px-2 -mx-2 rounded transition-colors border-l-2 border-indigo-400 pl-3 min-h-0 items-center justify-between">
            <div><div className="text-[10px] font-mono uppercase text-slate-500">{item.label}</div><div className="text-xl font-mono font-bold mt-1 text-slate-800">{item.value}</div></div>
            <i className={`fa-solid ${item.icon} text-xl text-slate-300`}></i>
          </div>
        ))}
      </div>
    </aside>
  );
}
