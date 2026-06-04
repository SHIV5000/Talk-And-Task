import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase.js';

const LIVE_WINDOW_MS = 5 * 60 * 1000;

const getOrgId = (record = {}) => record.orgId || record.organizationId || record.tenantId || '';
const getTimestampMs = (value) => value?.toMillis?.() || (value ? new Date(value).getTime() : 0);
const formatDateTime = (value) => {
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : '—';
};

export default function LiveUsers() {
  const [users, setUsers] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map((userDoc) => ({ id: userDoc.id, ...userDoc.data() })));
    }, (snapshotError) => setError(`Failed to load users: ${snapshotError.message}`));

    const unsubscribeOrganizations = onSnapshot(collection(db, 'organizations'), (snapshot) => {
      setOrganizations(snapshot.docs.map((orgDoc) => ({ id: orgDoc.id, ...orgDoc.data() })));
    }, (snapshotError) => setError(`Failed to load organizations: ${snapshotError.message}`));

    return () => {
      unsubscribeUsers();
      unsubscribeOrganizations();
    };
  }, []);

  const orgNameById = useMemo(() => organizations.reduce((acc, org) => {
    acc[org.id] = org.orgName || org.name || org.displayName || org.id;
    return acc;
  }, {}), [organizations]);

  const liveUsers = useMemo(() => {
    const now = Date.now();
    return users
      .map((user) => ({ ...user, orgId: getOrgId(user), lastActiveMs: getTimestampMs(user.lastActive || user.lastLogin) }))
      .filter((user) => user.email && user.orgId && user.lastActiveMs && now - user.lastActiveMs <= LIVE_WINDOW_MS)
      .sort((a, b) => b.lastActiveMs - a.lastActiveMs);
  }, [users]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Developer Console</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Live Users</h2>
            <p className="mt-1 text-sm text-slate-500">Real-time logged-in users across tenants, refreshed from Firestore activity pings.</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700 ring-1 ring-emerald-200">
            {liveUsers.length} live
          </span>
        </div>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Organization</th>
                <th className="px-5 py-3">User Email</th>
                <th className="px-5 py-3">Last Active</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {liveUsers.map((user) => (
                <tr key={user.id || user.uid || user.email} className="hover:bg-slate-50/70">
                  <td className="px-5 py-4 font-bold text-slate-800">{orgNameById[user.orgId] || user.orgId}</td>
                  <td className="px-5 py-4 font-semibold text-slate-700">{user.email}</td>
                  <td className="px-5 py-4 text-xs font-semibold text-slate-500">{formatDateTime(user.lastActive || user.lastLogin)}</td>
                  <td className="px-5 py-4"><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">Online</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {liveUsers.length === 0 && <p className="p-8 text-center text-sm font-semibold text-slate-500">No logged-in users are active in the last 5 minutes.</p>}
      </section>
    </div>
  );
}
