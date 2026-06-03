import React, { useEffect, useState } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase.js';

const CONFIG_REF = doc(db, 'platform', 'config');
const DEFAULT_VERSION = 'v2.1.3';

const normalizeVersion = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return DEFAULT_VERSION;
  return trimmed.startsWith('v') ? trimmed : `v${trimmed}`;
};

export default function VersionManager({ currentVersion = DEFAULT_VERSION }) {
  const [version, setVersion] = useState(normalizeVersion(currentVersion));
  const [draftVersion, setDraftVersion] = useState(normalizeVersion(currentVersion));
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const unsubscribe = onSnapshot(CONFIG_REF, (snapshot) => {
      const nextVersion = normalizeVersion(snapshot.data()?.appVersion || currentVersion);
      setVersion(nextVersion);
      setDraftVersion(nextVersion);
    }, () => {
      const fallbackVersion = normalizeVersion(currentVersion);
      setVersion(fallbackVersion);
      setDraftVersion(fallbackVersion);
    });

    return unsubscribe;
  }, [currentVersion]);

  const handleSave = async () => {
    const nextVersion = normalizeVersion(draftVersion);
    setIsSaving(true);
    setStatus('');

    try {
      await setDoc(CONFIG_REF, {
        appVersion: nextVersion,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setStatus('Version saved to platform/config.');
    } catch (error) {
      setStatus('Unable to save version. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.2em] text-indigo-500">Developer Console</div>
          <h3 className="text-base font-black text-slate-800">Application Version</h3>
          <p className="text-xs font-semibold text-slate-500">Read and write platform/config.appVersion for the auth context and sidebar.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">Current {version}</span>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="mb-1 block text-xs font-bold text-slate-500">Version</span>
          <input
            type="text"
            value={draftVersion}
            onChange={(event) => setDraftVersion(event.target.value)}
            placeholder={DEFAULT_VERSION}
            className="w-full rounded-xl border border-slate-200 p-2.5 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </label>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || normalizeVersion(draftVersion) === version}
          className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? 'Saving…' : 'Save Version'}
        </button>
      </div>

      {status && <div className="mt-3 text-xs font-bold text-slate-500">{status}</div>}
    </div>
  );
}
