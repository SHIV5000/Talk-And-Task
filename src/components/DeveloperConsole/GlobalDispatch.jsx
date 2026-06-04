import React, { useMemo, useState } from 'react';
import { functions, httpsCallable } from '../../firebase.js';

const GLOBAL_SUPPORT_ADMIN_EMAIL = 'shivsuri1@gmail.com';

export default function GlobalDispatch() {
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);

  const canSend = useMemo(() => message.trim().length > 0 && !isSending, [message, isSending]);

  const handleDispatch = async () => {
    if (!canSend) return;
    setIsSending(true);
    setStatus('Sending through backend global support dispatcher…');
    setSentCount(0);

    try {
      const globalSupportDispatch = httpsCallable(functions, 'globalSupportDispatch');
      const result = await globalSupportDispatch({ message: message.trim() });
      const dispatchResult = result.data || {};
      const deliveredCount = Number(dispatchResult.deliveredCount || 0);
      const failedCount = Number(dispatchResult.failedCount || 0);
      const totalTenants = Number(dispatchResult.totalTenants || deliveredCount + failedCount);

      setSentCount(deliveredCount);
      if (failedCount > 0) {
        const failedTenants = (dispatchResult.failures || [])
          .slice(0, 5)
          .map((failure) => failure.orgId)
          .filter(Boolean)
          .join(', ');
        setStatus(
          `Global Dispatch delivered to ${deliveredCount}/${totalTenants} tenants; ${failedCount} failed${failedTenants ? ` (${failedTenants}${failedCount > 5 ? ', …' : ''})` : ''}.`,
        );
      } else {
        setStatus(`Global Dispatch delivered to ${deliveredCount} tenant${deliveredCount === 1 ? '' : 's'}.`);
        setMessage('');
      }
    } catch (dispatchError) {
      setStatus(`Dispatch failed: ${dispatchError.message}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-br from-primary to-slate-900 p-6 text-white shadow-xl">
        <p className="text-[11px] font-black uppercase tracking-[0.28em] text-white/60">Developer HQ</p>
        <h1 className="mt-2 text-3xl font-black">Global Dispatch</h1>
        <p className="mt-2 max-w-3xl text-sm font-medium text-white/75">
          Send a top-level SUPPORT broadcast into every tenant workspace. Tenant replies are routed privately to the sender and {GLOBAL_SUPPORT_ADMIN_EMAIL}.
        </p>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">Broadcast composer</h2>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Messages are written to each tenant's SUPPORT department by a backend callable function.</p>
          </div>
          {sentCount > 0 && (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
              {sentCount} tenant{sentCount === 1 ? '' : 's'} updated
            </span>
          )}
        </div>

        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={8}
          className="min-h-44 w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-primary-light"
          placeholder="Write an announcement, incident update, release note, or support instruction for every tenant…"
        />

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
            SUPPORT top-level posts are reserved for the developer account; tenant users can only create private replies.
          </p>
          <button
            type="button"
            onClick={handleDispatch}
            disabled={!canSend}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white shadow-lg transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-primary-light dark:text-slate-950 dark:hover:bg-white dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
          >
            <i className={`fa-solid ${isSending ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
            {isSending ? 'Dispatching…' : 'Send Global Dispatch'}
          </button>
        </div>

        {status && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
            {status}
          </div>
        )}
      </section>
    </div>
  );
}
