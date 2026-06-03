import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase.js';

const quickActions = [
  { href: '/developer-hq/tenants', label: 'Review tenants', icon: 'fa-users-gear' },
  { href: '/developer-hq/packages', label: 'Manage packages', icon: 'fa-layer-group' },
  { href: '/developer-hq/storage', label: 'Audit storage', icon: 'fa-hard-drive' },
  { href: '/developer-hq/version', label: 'Release version', icon: 'fa-rocket' },
];

const toneClasses = {
  indigo: 'bg-indigo-50 text-indigo-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  rose: 'bg-rose-50 text-rose-600',
};

const toMB = (value) => {
  const numberValue = Number(value || 0);
  if (!Number.isFinite(numberValue) || numberValue <= 0) return 0;
  return numberValue > 1024 * 1024 ? numberValue / (1024 * 1024) : numberValue;
};

const formatStorage = (mb) => {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb).toLocaleString()} MB`;
};

export default function DeveloperDashboard() {
  const [organizations, setOrganizations] = useState([]);
  const [packages, setPackages] = useState([]);
  const [appVersion, setAppVersion] = useState('25.0');
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribers = [
      onSnapshot(collection(db, 'organizations'), (snapshot) => {
        setOrganizations(snapshot.docs.map((orgDoc) => ({ id: orgDoc.id, ...orgDoc.data() })));
      }, (snapshotError) => setError(`Organizations: ${snapshotError.message}`)),
      onSnapshot(collection(db, 'subscriptionPackages'), (snapshot) => {
        setPackages(snapshot.docs.map((packageDoc) => ({ id: packageDoc.id, ...packageDoc.data() })));
      }, (snapshotError) => setError(`Packages: ${snapshotError.message}`)),
      onSnapshot(doc(db, 'platform', 'config'), (snapshot) => {
        setAppVersion(snapshot.data()?.appVersion || '25.0');
      }, (snapshotError) => setError(`Platform config: ${snapshotError.message}`)),
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  const metrics = useMemo(() => {
    const activeTenants = organizations.filter((org) => !['suspended', 'deleted'].includes(String(org.status || '').toLowerCase())).length;
    const totalStorageMB = organizations.reduce((total, org) => total + toMB(org.storageUsedMB ?? org.storageUsedBytes ?? org.org_details?.storageUsedMB), 0);
    const publishedPackages = packages.filter((pkg) => pkg.status !== 'archived').length;

    return [
      { label: 'Active Tenants', value: activeTenants.toLocaleString(), icon: 'fa-building-user', tone: 'indigo', helper: `${organizations.length.toLocaleString()} total organizations` },
      { label: 'Packages', value: packages.length.toLocaleString(), icon: 'fa-box-open', tone: 'emerald', helper: `${publishedPackages.toLocaleString()} available packages` },
      { label: 'Storage Used', value: formatStorage(totalStorageMB), icon: 'fa-database', tone: 'amber', helper: 'Across all tenant records' },
      { label: 'Current Version', value: String(appVersion).startsWith('v') ? appVersion : `v${appVersion}`, icon: 'fa-code-branch', tone: 'rose', helper: 'From platform/config' },
    ];
  }, [organizations, packages, appVersion]);

  return (
    <div className="min-h-full text-slate-800">
      <div className="bg-indigo-600 px-5 py-5 shadow-md rounded-3xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur shadow-inner border border-white/20">
              <i className="fa-solid fa-code text-xl text-white"></i>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/55">Platform Operations</p>
              <h1 className="font-bold text-xl md:text-2xl text-white tracking-wide">Developer Dashboard</h1>
            </div>
          </div>
          <a href="/developer-hq/version" className="bg-white/20 hover:bg-white/30 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm backdrop-blur border border-white/30">
            <i className="fa-solid fa-code-branch"></i>
            Version Control
          </a>
        </div>
      </div>

      <main className="max-w-7xl mx-auto py-6 space-y-6">
        {error && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">{error}</div>}
        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 md:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-800">Developer HQ Overview</h2>
              <p className="text-sm text-slate-500 font-medium mt-1">Live tenant, package, storage, and release data from Firestore.</p>
            </div>
            <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-full border border-emerald-100 w-fit">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Live Firestore data
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 p-5 md:p-6">
            {metrics.map((card) => (
              <div key={card.label} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 hover:bg-white hover:shadow-md transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">{card.label}</p>
                    <p className="text-3xl font-black text-slate-800 mt-2">{card.value}</p>
                  </div>
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${toneClasses[card.tone]}`}>
                    <i className={`fa-solid ${card.icon}`}></i>
                  </div>
                </div>
                <p className="text-xs font-bold text-slate-500 mt-4">{card.helper}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm p-5 md:p-6">
            <h3 className="font-black text-slate-800 mb-4">Quick Navigation</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {quickActions.map((action) => (
                <a key={action.href} href={action.href} className="group rounded-2xl border border-slate-200 p-4 flex items-center gap-3 hover:border-indigo-200 hover:bg-indigo-50 transition-all">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-white transition-all">
                    <i className={`fa-solid ${action.icon}`}></i>
                  </div>
                  <span className="font-bold text-sm text-slate-700 group-hover:text-indigo-700">{action.label}</span>
                  <i className="fa-solid fa-arrow-right ml-auto text-xs text-slate-300 group-hover:text-indigo-500"></i>
                </a>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 md:p-6">
            <h3 className="font-black text-slate-800 mb-4">Operational Notes</h3>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <i className="fa-solid fa-shield-halved"></i>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-700">Developer controls ready</p>
                  <p className="text-xs text-slate-500 font-medium mt-1">Use Tenants and Packages for no-code SaaS management.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <i className="fa-solid fa-circle-check"></i>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-700">Tenant onboarding fallback enabled</p>
                  <p className="text-xs text-slate-500 font-medium mt-1">If the callable is unavailable, the console writes tenant records directly to Firestore.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
