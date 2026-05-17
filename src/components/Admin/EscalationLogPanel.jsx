import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import AssignmentActionModal from './AssignmentActionModal';
import { getEscalationInfo } from '../../utils/escalationHelpers';

export default function EscalationLogPanel({ currentUser }) {
  const [logs, setLogs] = useState([]);
  const [selected, setSelected] = useState(null); // { taskId, assigneeId, logId }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to all escalation logs, ordered by timestamp desc
    const q = query(
      collection(db, 'escalationLogs'),
      orderBy('timestamp', 'desc')
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(items);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) {
    return <div className="p-6 text-center text-slate-500">Loading escalation logs...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-slate-200 bg-white">
        <h2 className="text-lg font-bold text-slate-800">Escalation Management</h2>
        <p className="text-sm text-slate-500">Resolve overdue tasks and acknowledgments</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {logs.length === 0 ? (
          <div className="text-center p-10 text-slate-400">No escalations yet. All clear!</div>
        ) : (
          <div className="space-y-2">
            {logs.map(log => {
              const { label, color } = getEscalationInfo(log.newLevel);
              return (
                <div key={log.id} className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-sm font-bold text-slate-800">Task {log.taskId}</span>
                      <span className="text-xs text-slate-500">Assignee: {log.assigneeId?.slice(0,8)}...</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: color, color: '#fff' }}>{label}</span>
                    </div>
                    <div className="text-xs text-slate-400">
                      {log.timestamp?.toDate().toLocaleString()} — {log.action}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelected({ taskId: log.taskId, assigneeId: log.assigneeId, logId: log.id })}
                    className="ml-4 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg font-semibold text-sm hover:bg-indigo-100 transition-colors"
                  >
                    Resolve
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <AssignmentActionModal
          taskId={selected.taskId}
          assigneeId={selected.assigneeId}
          logId={selected.logId}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
