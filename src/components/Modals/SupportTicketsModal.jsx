import React, { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { functions, httpsCallable, db } from '../../firebase.js';

const formatDate = (value) => {
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }) : '—';
};

export default function SupportTicketsModal({ setActiveModal, user, currentUserData, isVipAdmin, orgId }) {
  const [tickets, setTickets] = useState([]);
  const [supportStatus, setSupportStatus] = useState({ isAcceptingTickets: true });
  const [form, setForm] = useState({ subject: '', category: 'General', priority: 'normal', description: '' });
  const [replyText, setReplyText] = useState({});
  const [busy, setBusy] = useState(false);
  const isAdmin = currentUserData?.isAdmin || isVipAdmin;

  useEffect(() => {
    if (!orgId || !user?.uid) return undefined;
    const ticketQuery = isAdmin
      ? query(collection(db, 'organizations', orgId, 'supportTickets'), limit(100))
      : query(collection(db, 'organizations', orgId, 'supportTickets'), where('createdByUid', '==', user.uid), limit(20));
    const unsubTickets = onSnapshot(ticketQuery, (snap) => {
      const rows = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      rows.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setTickets(rows);
    });
    const unsubStatus = onSnapshot(collection(db, 'organizations', orgId, 'systemSettings'), (snap) => {
      const statusDoc = snap.docs.find((docSnap) => docSnap.id === 'supportStatus');
      setSupportStatus(statusDoc?.data() || { isAcceptingTickets: true });
    });
    return () => { unsubTickets(); unsubStatus(); };
  }, [isAdmin, orgId, user?.uid]);

  const canCreate = useMemo(() => supportStatus.isAcceptingTickets !== false && !isAdmin, [isAdmin, supportStatus.isAcceptingTickets]);

  const createTicket = async () => {
    if (!form.subject.trim() || !form.description.trim()) return alert('Enter subject and description.');
    setBusy(true);
    try {
      await httpsCallable(functions, 'createSupportTicket')({ orgId, ...form });
      setForm({ subject: '', category: 'General', priority: 'normal', description: '' });
    } catch (error) {
      alert(error.message || 'Failed to create ticket.');
    } finally { setBusy(false); }
  };

  const replyTicket = async (ticketId, internal = false) => {
    const text = (replyText[ticketId] || '').trim();
    if (!text) return;
    setBusy(true);
    try {
      await httpsCallable(functions, 'replySupportTicket')({ orgId, ticketId, text, internal });
      setReplyText((prev) => ({ ...prev, [ticketId]: '' }));
    } catch (error) { alert(error.message || 'Failed to reply.'); }
    finally { setBusy(false); }
  };

  const updateStatus = async (ticketId, status) => {
    setBusy(true);
    try { await httpsCallable(functions, 'updateSupportTicketStatus')({ orgId, ticketId, status }); }
    catch (error) { alert(error.message || 'Failed to update status.'); }
    finally { setBusy(false); }
  };

  const toggleIntake = async () => {
    const next = supportStatus.isAcceptingTickets === false;
    const pausedReason = next ? '' : window.prompt('Reason shown to users while support is paused:', supportStatus.pausedReason || '') || '';
    setBusy(true);
    try { await httpsCallable(functions, 'setSupportIntakeStatus')({ orgId, isAcceptingTickets: next, pausedReason }); }
    catch (error) { alert(error.message || 'Failed to update support status.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-200 flex flex-col">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-800"><i className="fa-solid fa-headset text-indigo-600 mr-2"></i>{isAdmin ? 'All Support Tickets' : 'My Support Tickets'}</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">1 ticket/week/user · private trail · estimated resolution dates</p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && <button onClick={toggleIntake} disabled={busy} className={`px-4 py-2 rounded-xl text-xs font-black ${supportStatus.isAcceptingTickets === false ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{supportStatus.isAcceptingTickets === false ? 'Resume Intake' : 'Pause Intake'}</button>}
            <button onClick={() => setActiveModal(null)} className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"><i className="fa-solid fa-xmark"></i></button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5">
          {!isAdmin && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3 h-fit">
              <h3 className="font-black text-slate-800">Create Ticket</h3>
              {supportStatus.isAcceptingTickets === false && <div className="rounded-xl bg-rose-50 border border-rose-100 p-3 text-xs font-bold text-rose-700">Support tickets are temporarily paused. {supportStatus.pausedReason || 'Please check back later.'}</div>}
              <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} disabled={!canCreate} placeholder="Subject" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} disabled={!canCreate} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option>General</option><option>Login</option><option>Chat</option><option>Task</option><option>Billing</option></select>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} disabled={!canCreate} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="normal">Normal</option><option value="urgent">Urgent</option></select>
              </div>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} disabled={!canCreate} rows={5} placeholder="Describe the issue..." className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm resize-none" />
              <button onClick={createTicket} disabled={!canCreate || busy} className="w-full rounded-xl bg-indigo-600 text-white py-3 text-sm font-black disabled:opacity-50">Submit Ticket</button>
            </div>
          )}

          <div className="space-y-3">
            {tickets.map((ticket) => (
              <div key={ticket.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-black text-slate-800">{ticket.subject}</div>
                    <div className="text-xs font-bold text-slate-400">{ticket.category} · {ticket.priority} · ETA {formatDate(ticket.estimatedResolution)}</div>
                    {isAdmin && <div className="text-xs text-slate-500 mt-1">By {ticket.createdByName || ticket.createdByEmail}</div>}
                  </div>
                  <span className="rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase text-indigo-700 border border-indigo-100">{ticket.status}</span>
                </div>
                <p className="mt-3 text-sm text-slate-600 whitespace-pre-wrap">{ticket.description}</p>
                <div className="mt-3 flex gap-2">
                  <input value={replyText[ticket.id] || ''} onChange={(e) => setReplyText((prev) => ({ ...prev, [ticket.id]: e.target.value }))} placeholder="Add public reply..." className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  <button onClick={() => replyTicket(ticket.id, false)} disabled={busy} className="rounded-xl bg-slate-800 text-white px-4 text-xs font-black">Reply</button>
                </div>
                {isAdmin && <div className="mt-3 flex flex-wrap gap-2"><button onClick={() => updateStatus(ticket.id, 'in-progress')} className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">In Progress</button><button onClick={() => updateStatus(ticket.id, 'resolved')} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Resolve</button><button onClick={() => updateStatus(ticket.id, 'closed')} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">Close</button><button onClick={() => replyTicket(ticket.id, true)} className="rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700">Save Internal Note</button></div>}
              </div>
            ))}
            {tickets.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm font-bold text-slate-400">No support tickets yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
