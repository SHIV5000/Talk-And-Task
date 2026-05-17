import React, { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';

export default function AssignmentActionModal({ taskId, assigneeId, logId, onClose }) {
  const [action, setAction] = useState('dismiss');
  const [comment, setComment] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [newAssigneeId, setNewAssigneeId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      // Try Firebase Callable function first; if not deployed, we'll use direct Firestore update
      const functions = getFunctions();
      const resolveEscalation = httpsCallable(functions, 'resolveEscalation');
      await resolveEscalation({ taskId, assigneeId, action, comment, newDeadline: newDeadline || undefined, newAssigneeId: newAssigneeId || undefined });
      onClose();
    } catch (err) {
      console.error('Error resolving escalation:', err);
      setError('Failed to resolve escalation. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-800">Resolve Escalation</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {error && <div className="mb-4 p-2 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Resolution Action</label>
            <select value={action} onChange={e => setAction(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
              <option value="dismiss">Dismiss (no action)</option>
              <option value="override_complete">Override &amp; Complete</option>
              <option value="reassign">Reassign to another user</option>
              <option value="extend_deadline">Extend Deadline</option>
            </select>
          </div>

          {action === 'reassign' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">New Assignee UID</label>
              <input
                type="text"
                value={newAssigneeId}
                onChange={e => setNewAssigneeId(e.target.value)}
                placeholder="User ID"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
          )}

          {action === 'extend_deadline' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">New Deadline</label>
              <input
                type="datetime-local"
                value={newDeadline}
                onChange={e => setNewDeadline(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Comment (optional)</label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50">
              {submitting ? 'Resolving...' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
