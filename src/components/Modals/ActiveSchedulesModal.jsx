import React, { useState, useEffect } from 'react';
import { db } from '../../firebase.js';
import { collection, query, where, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';

export default function ActiveSchedulesModal({ setActiveModal, user, activeReminders }) {
  const [tab, setTab] = useState('reminders');
  const [scheduledMsgs, setScheduledMsgs] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Edit States
  const [editingId, setEditingId] = useState(null);
  const [editVal, setEditVal] = useState('');
  const [editDate, setEditDate] = useState('');

  useEffect(() => {
    if (tab === 'scheduled') fetchScheduled();
  }, [tab, user.uid]);

  const fetchScheduled = async () => {
    setLoading(true);
    try {
        const q = query(collection(db, "scheduled_messages"), where("senderUid", "==", user.uid), where("status", "==", "pending"));
        const snap = await getDocs(q);
        setScheduledMsgs(snap.docs.map(d => ({id: d.id, ...d.data()})));
    } catch(e) {}
    setLoading(false);
  };

  const cancelReminder = async (id) => { try { await deleteDoc(doc(db, "reminders", id)); } catch(e) {} };
  const cancelScheduled = async (id) => {
      try { await deleteDoc(doc(db, "scheduled_messages", id)); setScheduledMsgs(prev => prev.filter(m => m.id !== id)); } catch(e) {}
  };

  const saveEdit = async (id, isReminder) => {
      try {
          if (isReminder) {
              await updateDoc(doc(db, "reminders", id), { messageText: editVal, remindAt: editDate });
          } else {
              await updateDoc(doc(db, "scheduled_messages", id), { text: editVal, scheduledFor: editDate });
              fetchScheduled();
          }
          setEditingId(null);
      } catch(e) { alert("Failed to update."); }
  };

  const pendingReminders = (activeReminders || []).filter(r => !r.isTriggered);

  return (
    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[70] flex items-center justify-center p-4 animate-in fade-in" onClick={() => setActiveModal(null)}>
      <div className="bg-white w-full max-w-lg rounded-3xl p-6 md:p-8 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
        
        <div className="flex items-center justify-between mb-6 shrink-0">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shadow-inner"><i className="fa-solid fa-calendar-alt text-xl"></i></div>
             <h3 className="text-xl font-bold text-slate-800">Schedules</h3>
          </div>
          <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-full hover:bg-slate-100 flex justify-center items-center text-slate-500 transition-colors"><i className="fa-solid fa-xmark"></i></button>
        </div>

        <div className="flex gap-2 bg-slate-100 p-1.5 rounded-xl mb-4 shrink-0 shadow-inner">
          <button onClick={() => setTab('reminders')} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${tab === 'reminders' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Reminders ({pendingReminders.length})</button>
          <button onClick={() => setTab('scheduled')} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${tab === 'scheduled' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Scheduled Msgs</button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 custom-sidebar-scroll pr-2">
            {tab === 'reminders' && (
                pendingReminders.length === 0 ? <p className="text-slate-400 text-sm text-center italic py-8">No active reminders.</p> :
                pendingReminders.map(r => (
                    <div key={r.id} className="bg-slate-50 border border-slate-200 p-4 rounded-xl shadow-sm hover:border-indigo-200 transition-colors relative">
                        {editingId === r.id ? (
                            <div className="space-y-3">
                                <input type="datetime-local" value={editDate} onChange={e=>setEditDate(e.target.value)} className="modern-date-input" />
                                <input type="text" value={editVal} onChange={e=>setEditVal(e.target.value)} className="w-full text-sm border border-slate-300 p-2 rounded-lg bg-white" />
                                <div className="flex gap-2 justify-end">
                                    <button onClick={()=>setEditingId(null)} className="text-xs font-bold text-slate-500 hover:bg-slate-200 px-3 py-1.5 rounded-md">Cancel</button>
                                    <button onClick={()=>saveEdit(r.id, true)} className="text-xs font-bold text-white bg-indigo-500 hover:bg-indigo-600 px-3 py-1.5 rounded-md shadow">Save</button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex justify-between items-start">
                                <div className="overflow-hidden pr-3">
                                    <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-1"><i className="fa-regular fa-clock mr-1"></i>{new Date(r.remindAt).toLocaleString()}</div>
                                    <div className="text-sm font-semibold text-slate-700 truncate">"{r.messageText}"</div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => {setEditingId(r.id); setEditVal(r.messageText); setEditDate(r.remindAt);}} className="w-8 h-8 bg-white border border-slate-200 text-slate-500 rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors shadow-sm"><i className="fa-solid fa-pen text-xs"></i></button>
                                    <button onClick={() => cancelReminder(r.id)} className="w-8 h-8 bg-white border border-rose-100 text-rose-500 rounded-full flex items-center justify-center hover:bg-rose-50 transition-colors shadow-sm"><i className="fa-solid fa-trash-can text-xs"></i></button>
                                </div>
                            </div>
                        )}
                    </div>
                ))
            )}

            {tab === 'scheduled' && (
                loading ? <p className="text-slate-400 text-sm text-center italic py-8">Loading...</p> :
                scheduledMsgs.length === 0 ? <p className="text-slate-400 text-sm text-center italic py-8">No pending scheduled messages.</p> :
                scheduledMsgs.map(s => (
                    <div key={s.id} className="bg-slate-50 border border-slate-200 p-4 rounded-xl shadow-sm hover:border-indigo-200 transition-colors relative">
                         {editingId === s.id ? (
                            <div className="space-y-3">
                                <input type="datetime-local" value={editDate} onChange={e=>setEditDate(e.target.value)} className="modern-date-input" />
                                <input type="text" value={editVal} onChange={e=>setEditVal(e.target.value)} className="w-full text-sm border border-slate-300 p-2 rounded-lg bg-white" />
                                <div className="flex gap-2 justify-end">
                                    <button onClick={()=>setEditingId(null)} className="text-xs font-bold text-slate-500 hover:bg-slate-200 px-3 py-1.5 rounded-md">Cancel</button>
                                    <button onClick={()=>saveEdit(s.id, false)} className="text-xs font-bold text-white bg-indigo-500 hover:bg-indigo-600 px-3 py-1.5 rounded-md shadow">Save</button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex justify-between items-start">
                                <div className="overflow-hidden pr-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest"><i className="fa-regular fa-clock mr-1"></i>{new Date(s.scheduledFor).toLocaleString()}</span>
                                        <span className="text-[9px] font-bold bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full border border-slate-300 shadow-sm">{s.groupName || 'Direct'}</span>
                                    </div>
                                    <div className="text-sm font-semibold text-slate-700 truncate">"{s.text}"</div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => {setEditingId(s.id); setEditVal(s.text); setEditDate(s.scheduledFor);}} className="w-8 h-8 bg-white border border-slate-200 text-slate-500 rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors shadow-sm"><i className="fa-solid fa-pen text-xs"></i></button>
                                    <button onClick={() => cancelScheduled(s.id)} className="w-8 h-8 bg-white border border-rose-100 text-rose-500 rounded-full flex items-center justify-center hover:bg-rose-50 transition-colors shadow-sm"><i className="fa-solid fa-trash-can text-xs"></i></button>
                                </div>
                            </div>
                        )}
                    </div>
                ))
            )}
        </div>
      </div>
    </div>
  );
}
