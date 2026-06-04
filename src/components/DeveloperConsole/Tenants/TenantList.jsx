import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../../../firebase.js';
import TenantDetail from './TenantDetail.jsx';
import TenantForm from './TenantForm.jsx';

const DETAILS_DOC_FALLBACK_ID = 'details';
const GLOBAL_SUPPORT_ADMIN_EMAIL = 'shivsuri1@gmail.com';
const SUPPORT_GROUP_ID = 'support';

const normalizeOrgId = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 48);

const createTenantDirectly = async (payload) => {
  const orgId = normalizeOrgId(payload.orgId || payload.orgName);
  if (!orgId) throw new Error('Organization ID could not be generated. Enter an organization name.');

  const now = serverTimestamp();
  const tenantPayload = withoutUndefined({
    orgName: payload.orgName,
    name: payload.orgName,
    status: 'trial',
    packageId: payload.subscriptionPackageId || '',
    subscriptionPackageId: payload.subscriptionPackageId || '',
    firstAdminEmail: payload.adminEmail || '',
    adminEmail: payload.adminEmail || '',
    adminName: payload.adminName || '',
    featureFlagsOverride: payload.featureFlagsOverride || {},
    storageLimitOverride: payload.storageLimitOverride,
    maxUsersOverride: payload.maxUsersOverride,
    storageUsedMB: 0,
    createdAt: now,
    updatedAt: now,
  });

  await setDoc(doc(db, 'organizations', orgId), tenantPayload, { merge: true });
  await setDoc(doc(db, 'organizations', orgId, 'org_details', DETAILS_DOC_FALLBACK_ID), tenantPayload, { merge: true });

 if (payload.adminEmail) {
    await addDoc(collection(db, 'tenantInvitations'), {
      orgId,
      email: payload.adminEmail,
      name: payload.adminName || '',
      role: 'admin',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });
  }

  // --- NEW: CREATE DEFAULT WELCOME GROUP & MESSAGE ---
  const defaultGroupRef = doc(collection(db, 'organizations', orgId, 'groups'));
  await setDoc(defaultGroupRef, {
    name: "Welcome",
    members: payload.adminEmail ? [payload.adminEmail] : [],
    admins: payload.adminEmail ? [payload.adminEmail] : [],
    createdBy: "system",
    createdAt: now,
    isArchived: false,
    profilePicUrl: null
  });

  await addDoc(collection(db, 'organizations', orgId, 'messages'), {
    text: "👋 <strong>Welcome to Talk & Task!</strong><br><br>This is your default workspace. You can invite your team, share files, and convert any message here into a trackable task.",
    senderUid: "system",
    senderEmail: "Developer Console",
    groupId: defaultGroupRef.id,
    groupName: "Welcome",
    timestamp: now,
    isTask: false,
    seenBy: payload.adminEmail ? [payload.adminEmail] : [],
    reactions: {},
    isPrivateForward: false,
    allowedUsers: []
  });

  await setDoc(doc(db, 'organizations', orgId, 'groups', SUPPORT_GROUP_ID), {
    name: "SUPPORT",
    members: payload.adminEmail ? [payload.adminEmail] : [],
    admins: [GLOBAL_SUPPORT_ADMIN_EMAIL],
    createdBy: GLOBAL_SUPPORT_ADMIN_EMAIL,
    createdAt: now,
    isArchived: false,
    isSupport: true,
    universalRead: true,
    profilePicUrl: null,
  }, { merge: true });
  // ---------------------------------------------------

  return orgId;
};

const withoutUndefined = (record) => Object.fromEntries(
  Object.entries(record).filter(([, value]) => value !== undefined),
);

const normalizeString = (value = '') => String(value).trim().toLowerCase();

const getTenantPackageId = (tenant) => {
  const record = tenant || {};
  return (
    record.subscriptionPackageId
    || record.packageId
    || record.subscriptionPackage
    || record.subscriptionType
    || ''
  );
};

const getPackageName = (tenant, packages = []) => {
  const packageId = getTenantPackageId(tenant);
  const pkg = packages.find((item) => item.id === packageId || item.name === packageId || item.packageName === packageId);
  return pkg?.name || pkg?.packageName || pkg?.title || packageId || 'Unassigned';
};

const getUserOrgId = (user) => {
  const record = user || {};
  return record.orgId || record.organizationId || record.tenantId || '';
};

const getUserLastActiveMs = (user) => user?.lastActive?.toMillis?.() || user?.lastLogin?.toMillis?.() || (user?.lastActive ? new Date(user.lastActive).getTime() : 0);

const getStorageUsed = (tenant) => {
  const record = tenant || {};
  return record.storageUsedBytes || record.storageUsed || record.storageBytes || 0;
};

const formatBytes = (bytes) => {
  const value = Number(bytes || 0);
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / (1024 ** exponent)).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
};

const buildTenantRecord = (orgDoc, detailsDoc) => {
  const orgData = orgDoc.data();
  const detailsData = detailsDoc?.data?.() || {};
  return {
    ...orgData,
    ...detailsData,
    id: orgDoc.id,
    orgId: orgDoc.id,
    detailsDocId: detailsDoc?.id || orgData.detailsDocId || DETAILS_DOC_FALLBACK_ID,
  };
};

const buildSavePayload = (payload) => ({
  orgName: payload.orgName,
  name: payload.orgName,
  adminName: payload.adminName || '',
  adminEmail: payload.adminEmail || '',
  subscriptionPackageId: payload.subscriptionPackageId || '',
  featureFlagsOverride: payload.featureFlagsOverride || {},
  storageLimitOverride: payload.storageLimitOverride,
  maxUsersOverride: payload.maxUsersOverride,
  updatedAt: serverTimestamp(),
});

export default function TenantList() {
  const [tenants, setTenants] = useState([]);
  const [users, setUsers] = useState([]);
  const [subscriptionPackages, setSubscriptionPackages] = useState([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnboardForm, setShowOnboardForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [actionTenantId, setActionTenantId] = useState('');
  const [error, setError] = useState('');

  const loadTenants = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const orgSnap = await getDocs(collection(db, 'organizations'));
      const tenantRecords = await Promise.all(orgSnap.docs.map(async (orgDoc) => {
        const detailsSnap = await getDocs(collection(db, 'organizations', orgDoc.id, 'org_details'));
        return buildTenantRecord(orgDoc, detailsSnap.docs[0]);
      }));
      tenantRecords.sort((a, b) => (a.orgName || a.name || a.id).localeCompare(b.orgName || b.name || b.id));
      setTenants(tenantRecords);
      setSelectedTenantId((currentId) => currentId || tenantRecords[0]?.id || '');
    } catch (loadError) {
      setError(`Failed to load tenants: ${loadError.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  useEffect(() => {
    const unsubscribePackages = onSnapshot(collection(db, 'subscriptionPackages'), (snap) => {
      setSubscriptionPackages(snap.docs.map((packageDoc) => ({ id: packageDoc.id, ...packageDoc.data() })));
    }, (snapshotError) => setError(`Failed to load packages: ${snapshotError.message}`));

    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map((userDoc) => ({ id: userDoc.id, ...userDoc.data() })));
    }, (snapshotError) => setError(`Failed to load users: ${snapshotError.message}`));

    return () => {
      unsubscribePackages();
      unsubscribeUsers();
    };
  }, []);

  const usersByOrg = useMemo(() => users.reduce((acc, user) => {
    const orgId = getUserOrgId(user);
    if (!orgId) return acc;
    if (!acc[orgId]) acc[orgId] = { count: 0, emails: [], live: [] };
    acc[orgId].count += 1;
    if (user.email) acc[orgId].emails.push(user.email);
    if (getUserLastActiveMs(user) && Date.now() - getUserLastActiveMs(user) <= 5 * 60 * 1000) acc[orgId].live.push(user.email || user.uid);
    return acc;
  }, {}), [users]);

  const hydratedTenants = useMemo(() => tenants.map((tenant) => {
    const orgUsers = usersByOrg[tenant.id] || usersByOrg[tenant.orgId] || { count: 0, emails: [], live: [] };
    return {
      ...tenant,
      userCount: orgUsers.count,
      userEmails: [...new Set(orgUsers.emails)].sort((a, b) => a.localeCompare(b)),
      liveUserEmails: [...new Set(orgUsers.live)].sort((a, b) => a.localeCompare(b)),
    };
  }), [tenants, usersByOrg]);

  const filteredTenants = useMemo(() => {
    const term = normalizeString(searchTerm);
    if (!term) return hydratedTenants;
    return hydratedTenants.filter((tenant) => [
      tenant.id,
      tenant.orgName,
      tenant.name,
      tenant.adminEmail,
      getPackageName(tenant, subscriptionPackages),
    ].some((value) => normalizeString(value).includes(term)));
  }, [hydratedTenants, searchTerm, subscriptionPackages]);

  const selectedTenant = hydratedTenants.find((tenant) => tenant.id === selectedTenantId) || filteredTenants[0] || null;

  const refreshSelectedTenant = (tenantId, patch) => {
    setTenants((currentTenants) => currentTenants.map((tenant) => (
      tenant.id === tenantId ? { ...tenant, ...patch } : tenant
    )));
  };

  const handleOnboardTenant = async (payload) => {
    setIsSaving(true);
    setError('');
    try {
      let createdOrgId = payload.orgId;
      try {
        const onboardTenant = httpsCallable(getFunctions(), 'onboardTenant');
        const result = await onboardTenant(payload);
        createdOrgId = result?.data?.orgId || payload.orgId;
      } catch (callableError) {
        createdOrgId = await createTenantDirectly(payload);
        setError(`Backend onboardTenant was unavailable, so the tenant was saved directly to Firestore. ${callableError.message}`);
      }

      setShowOnboardForm(false);
      await loadTenants();
      setSelectedTenantId(createdOrgId);
    } catch (saveError) {
      setError(`Failed to onboard tenant: ${saveError.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveTenant = async (tenant, payload) => {
    setIsSaving(true);
    setError('');
    try {
      const detailsDocRef = doc(db, 'organizations', tenant.id, 'org_details', tenant.detailsDocId || DETAILS_DOC_FALLBACK_ID);
      const savePayload = buildSavePayload(payload);
      await setDoc(doc(db, 'organizations', tenant.id), savePayload, { merge: true });
      await setDoc(detailsDocRef, savePayload, { merge: true });
      refreshSelectedTenant(tenant.id, { ...savePayload, updatedAt: new Date() });
    } catch (saveError) {
      setError(`Failed to save tenant: ${saveError.message}`);
      throw saveError;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSuspendTenant = async (tenant) => {
    if (!window.confirm(`Suspend ${tenant.orgName || tenant.name || tenant.id}?`)) return;
    setActionTenantId(tenant.id);
    setError('');
    try {
      try {
        const suspendTenant = httpsCallable(getFunctions(), 'suspendTenant');
        await suspendTenant({ orgId: tenant.id });
      } catch (callableError) {
        setError(`Backend suspendTenant was unavailable, so the tenant was suspended directly in Firestore. ${callableError.message}`);
      }
      const detailsDocRef = doc(db, 'organizations', tenant.id, 'org_details', tenant.detailsDocId || DETAILS_DOC_FALLBACK_ID);
      const suspendPayload = { status: 'suspended', isSuspended: true, updatedAt: serverTimestamp() };
      await updateDoc(doc(db, 'organizations', tenant.id), suspendPayload).catch(() => setDoc(doc(db, 'organizations', tenant.id), suspendPayload, { merge: true }));
      await updateDoc(detailsDocRef, suspendPayload).catch(() => setDoc(detailsDocRef, suspendPayload, { merge: true }));
      refreshSelectedTenant(tenant.id, { status: 'suspended', isSuspended: true, updatedAt: new Date() });
    } catch (callableError) {
      setError(`Failed to suspend tenant: ${callableError.message}`);
    } finally {
      setActionTenantId('');
    }
  };

  const handleDeleteTenant = async (tenant) => {
    if (!window.confirm(`Permanently delete ${tenant.orgName || tenant.name || tenant.id}? This cannot be undone.`)) return;
    setActionTenantId(tenant.id);
    setError('');
    try {
      try {
        const deleteTenant = httpsCallable(getFunctions(), 'deleteTenant');
        await deleteTenant({ orgId: tenant.id });
      } catch (callableError) {
        await deleteDoc(doc(db, 'organizations', tenant.id, 'org_details', tenant.detailsDocId || DETAILS_DOC_FALLBACK_ID)).catch(() => {});
        await deleteDoc(doc(db, 'organizations', tenant.id));
        setError(`Backend deleteTenant was unavailable, so the tenant root/details records were deleted directly. ${callableError.message}`);
      }
      setTenants((currentTenants) => currentTenants.filter((item) => item.id !== tenant.id));
      setSelectedTenantId('');
    } catch (callableError) {
      setError(`Failed to delete tenant: ${callableError.message}`);
    } finally {
      setActionTenantId('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Developer Console</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">Tenant management</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage organization packages, tenant limits, feature overrides, and lifecycle actions.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowOnboardForm((current) => !current)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover"
        >
          {showOnboardForm ? 'Hide onboarding' : 'Onboard tenant'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}

      {showOnboardForm && (
        <TenantForm
          mode="create"
          subscriptionPackages={subscriptionPackages}
          isSaving={isSaving}
          onCancel={() => setShowOnboardForm(false)}
          onSubmit={handleOnboardTenant}
        />
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(320px,420px),1fr]">
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <label className="block text-sm font-medium text-slate-700" htmlFor="tenant-search">
              Search tenants
            </label>
            <input
              id="tenant-search"
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Name, ID, admin, package…"
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="max-h-[720px] overflow-auto">
            {isLoading ? (
              <div className="p-6 text-sm font-semibold text-slate-500">Loading tenant organizations…</div>
            ) : filteredTenants.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">No tenants found.</div>
            ) : filteredTenants.map((tenant) => {
              const isSelected = tenant.id === selectedTenant?.id;
              return (
                <button
                  key={tenant.id}
                  type="button"
                  onClick={() => setSelectedTenantId(tenant.id)}
                  className={`w-full border-b border-slate-100 p-4 text-left transition hover:bg-slate-50 ${isSelected ? 'bg-primary-light/60' : 'bg-white'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-slate-900">{tenant.orgName || tenant.name || tenant.id}</h3>
                      <p className="mt-1 truncate text-xs text-slate-500">{tenant.id}</p>
                      <p className="mt-1 truncate text-xs font-semibold text-slate-600">Admin: {tenant.adminName || '—'} • {tenant.adminEmail || 'No admin email'}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${tenant.status === 'suspended' || tenant.isSuspended ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {tenant.status === 'suspended' || tenant.isSuspended ? 'Suspended' : 'Active'}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="block text-slate-400">Package</span>
                      <span className="font-semibold text-slate-700">{getPackageName(tenant, subscriptionPackages)}</span>
                    </div>
                    <div>
                      <span className="block text-slate-400">Users</span>
                      <span className="font-semibold text-slate-700">{tenant.userCount} total</span>
                    </div>
                    <div>
                      <span className="block text-slate-400">Storage</span>
                      <span className="font-semibold text-slate-700">{formatBytes(getStorageUsed(tenant))}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <TenantDetail
          tenant={selectedTenant}
          subscriptionPackages={subscriptionPackages}
          isSaving={isSaving}
          actionTenantId={actionTenantId}
          onSave={handleSaveTenant}
          onSuspend={handleSuspendTenant}
          onDelete={handleDeleteTenant}
        />
      </div>
    </div>
  );
}
