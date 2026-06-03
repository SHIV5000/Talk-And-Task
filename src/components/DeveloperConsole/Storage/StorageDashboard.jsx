import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../../../firebase.js';
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { getEffectiveStorageLimitMB, getPackageStorageLimitMB, toNumberOrNull } from '../../../utils/storageLimits.js';

const formatMB = (value) => {
  const numericValue = toNumberOrNull(value) || 0;
  if (numericValue >= 1024) return `${(numericValue / 1024).toFixed(2)} GB`;
  return `${numericValue.toFixed(2)} MB`;
};

export default function StorageDashboard({ currentUserData, isVipAdmin = false }) {
  const [tenants, setTenants] = useState([]);
  const [overrideDrafts, setOverrideDrafts] = useState({});
  const [savingOrgId, setSavingOrgId] = useState(null);
  const [error, setError] = useState('');

  const isPlatformOwner = isVipAdmin || currentUserData?.isPlatformOwner === true || currentUserData?.role === 'Platform Owner';

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'organizations'),
      (snapshot) => {
        const nextTenants = snapshot.docs.map((docSnapshot) => {
          const data = docSnapshot.data();
          const details = data.org_details || data.orgDetails || data;
          return {
            id: docSnapshot.id,
            details,
            storageUsedMB: toNumberOrNull(details.storageUsedMB) || 0,
            packageStorageLimitMB: getPackageStorageLimitMB(details),
            overrideStorageLimitMB: toNumberOrNull(details.storageLimitOverride),
            effectiveStorageLimitMB: getEffectiveStorageLimitMB(details),
          };
        });
        setTenants(nextTenants);
        setOverrideDrafts((previous) => {
          const nextDrafts = { ...previous };
          nextTenants.forEach((tenant) => {
            if (nextDrafts[tenant.id] === undefined) {
              nextDrafts[tenant.id] = tenant.overrideStorageLimitMB ?? '';
            }
          });
          return nextDrafts;
        });
        setError('');
      },
      (listenerError) => setError(listenerError.message)
    );

    return () => unsubscribe();
  }, []);

  const totalStorageUsedMB = useMemo(
    () => tenants.reduce((total, tenant) => total + tenant.storageUsedMB, 0),
    [tenants]
  );

  const handleSaveOverride = async (orgId) => {
    const parsedOverride = toNumberOrNull(overrideDrafts[orgId]);
    if (parsedOverride !== null && parsedOverride < 0) {
      setError('Override storage limit must be zero or greater.');
      return;
    }

    setSavingOrgId(orgId);
    setError('');
    try {
      await updateDoc(doc(db, 'organizations', orgId), {
        'org_details.storageLimitOverride': parsedOverride,
      });
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSavingOrgId(null);
    }
  };

  return (
    <div className="p-4 md:p-6 overflow-y-auto custom-sidebar-scroll h-full space-y-5">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-black text-indigo-600 uppercase tracking-[0.2em]">Developer Console</p>
          <h2 className="text-2xl font-black text-slate-800 mt-1"><i className="fa-solid fa-hard-drive mr-2 text-indigo-600"></i>Tenant Storage</h2>
          <p className="text-sm text-slate-500 mt-1">Monitor all tenant org_details storage usage and limits.</p>
        </div>
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-4 text-right">
          <p className="text-xs font-black text-indigo-500 uppercase tracking-wider">Total Storage Used</p>
          <p className="text-2xl font-black text-indigo-700">{formatMB(totalStorageUsedMB)}</p>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl p-4 text-sm font-bold">
          <i className="fa-solid fa-triangle-exclamation mr-2"></i>{error}
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[900px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider">Tenant</th>
                <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider">Storage Used</th>
                <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider">Package Limit</th>
                <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider">Override Limit</th>
                <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider">Effective Limit</th>
                <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider">Usage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tenants.map((tenant) => {
                const percentUsed = tenant.effectiveStorageLimitMB > 0
                  ? Math.min(100, (tenant.storageUsedMB / tenant.effectiveStorageLimitMB) * 100)
                  : 0;
                const tenantName = tenant.details.orgName || tenant.details.name || tenant.id;

                return (
                  <tr key={tenant.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4">
                      <div className="font-black text-slate-800">{tenantName}</div>
                      <div className="text-xs font-bold text-slate-400">{tenant.id}</div>
                    </td>
                    <td className="p-4 font-bold text-slate-700">{formatMB(tenant.storageUsedMB)}</td>
                    <td className="p-4">
                      <div className="font-bold text-slate-700">{formatMB(tenant.packageStorageLimitMB)}</div>
                      <div className="text-xs text-slate-400">{tenant.details.subscriptionType || 'Free'} package</div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          value={overrideDrafts[tenant.id] ?? ''}
                          onChange={(event) => setOverrideDrafts((previous) => ({ ...previous, [tenant.id]: event.target.value }))}
                          disabled={!isPlatformOwner || savingOrgId === tenant.id}
                          placeholder="No override"
                          className="w-36 border border-slate-200 rounded-xl p-2 text-sm font-bold outline-none focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
                        />
                        <span className="text-xs font-bold text-slate-400">MB</span>
                        <button
                          onClick={() => handleSaveOverride(tenant.id)}
                          disabled={!isPlatformOwner || savingOrgId === tenant.id}
                          className="bg-indigo-600 text-white px-3 py-2 rounded-xl text-xs font-black disabled:opacity-40"
                        >
                          {savingOrgId === tenant.id ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </td>
                    <td className="p-4 font-bold text-slate-700">{formatMB(tenant.effectiveStorageLimitMB)}</td>
                    <td className="p-4">
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full ${percentUsed >= 100 ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${percentUsed}%` }} />
                      </div>
                      <div className="text-xs font-bold text-slate-400 mt-1">{percentUsed.toFixed(1)}% used</div>
                    </td>
                  </tr>
                );
              })}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-sm font-bold text-slate-400">No tenant org_details found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
