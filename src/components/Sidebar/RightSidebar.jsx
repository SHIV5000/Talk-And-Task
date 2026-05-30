import React, { useMemo, useState } from 'react';

const inRange = (message, start, end) => {
  const ms = message.timestamp?.toMillis?.() || (message.timestamp?.toDate ? message.timestamp.toDate().getTime() : 0);
  if (!ms) return false;
  if (start && ms < new Date(start).setHours(0, 0, 0, 0)) return false;
  if (end && ms > new Date(end).setHours(23, 59, 59, 999)) return false;
  return true;
};

export default function RightSidebar({ messages = [], user, sidebarWidth }) {
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

  const filters = [
    ['today', 'Today'],
    ['week', 'This Week'],
    ['month', 'This Month'],
    ['custom', 'Date Picker'],
  ];

  return (
    <aside className="hidden lg:flex shrink-0 h-full bg-slate-100 border-l border-slate-200 flex-col p-4 gap-4 overflow-y-auto custom-sidebar-scroll" style={{ width: `${sidebarWidth || 380}px` }}>
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-800 text-white rounded-3xl p-5 shadow-xl">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-200">User Analytics</div>
        <div className="mt-2 text-xl font-black truncate">{user.email}</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {filters.map(([key, label]) => (
          <button key={key} onClick={() => setPreset(key)} className={`rounded-2xl p-3 text-left text-xs font-black border shadow-sm transition-all ${preset === key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>{label}</button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="grid grid-cols-2 gap-2 bg-white rounded-2xl p-3 border border-slate-200 shadow-sm">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="modern-date-input" />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="modern-date-input" />
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 flex-1">
        {stats.map((item) => (
          <div key={item.label} className={`rounded-3xl p-4 text-white bg-gradient-to-br ${item.tone} shadow-lg min-h-[92px] flex items-center justify-between`}>
            <div><div className="text-[11px] font-bold uppercase opacity-80">{item.label}</div><div className="text-4xl font-black mt-1">{item.value}</div></div>
            <i className={`fa-solid ${item.icon} text-3xl opacity-70`}></i>
          </div>
        ))}
      </div>
    </aside>
  );
}
