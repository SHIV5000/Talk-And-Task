import React, { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../../../firebase.js';
import PackageForm from './PackageForm.jsx';

const PACKAGE_COLLECTION = 'subscriptionPackages';
const ORG_DETAILS_COLLECTION_GROUP = 'org_details';

const formatCurrency = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
}).format(Number(value || 0));

const formatNumber = (value) => new Intl.NumberFormat().format(Number(value || 0));

const orgUsesPackage = (orgData, packageRecord) => {
  const packageId = packageRecord?.id;
  const packageName = packageRecord?.name;

  return [
    orgData?.subscriptionPackageId,
    orgData?.packageId,
    orgData?.subscriptionPackage?.id,
    orgData?.subscription?.packageId,
  ].some((value) => value === packageId) || [
    orgData?.subscriptionPackageName,
    orgData?.subscriptionType,
    orgData?.packageName,
    orgData?.subscriptionPackage?.name,
    orgData?.subscription?.packageName,
  ].some((value) => packageName && value === packageName);
};

const getPackageUsage = async (packageRecord) => {
  const checks = [
    query(collectionGroup(db, ORG_DETAILS_COLLECTION_GROUP), where('subscriptionPackageId', '==', packageRecord.id), limit(1)),
    query(collectionGroup(db, ORG_DETAILS_COLLECTION_GROUP), where('packageId', '==', packageRecord.id), limit(1)),
    query(collection(db, 'organizations'), where('subscriptionPackageId', '==', packageRecord.id), limit(1)),
    query(collection(db, 'organizations'), where('packageId', '==', packageRecord.id), limit(1)),
  ];

  if (packageRecord.name) {
    checks.push(
      query(collectionGroup(db, ORG_DETAILS_COLLECTION_GROUP), where('subscriptionType', '==', packageRecord.name), limit(1)),
      query(collection(db, 'organizations'), where('subscriptionType', '==', packageRecord.name), limit(1)),
    );
  }

  for (const usageQuery of checks) {
    const snapshot = await getDocs(usageQuery);
    const match = snapshot.docs.find((orgDoc) => orgUsesPackage(orgDoc.data(), packageRecord));
    if (match) return { inUse: true, orgPath: match.ref.path, orgData: match.data() };
  }

  return { inUse: false, orgPath: null, orgData: null };
};

export default function PackageList() {
  const [packages, setPackages] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    const packagesQuery = query(collection(db, PACKAGE_COLLECTION), orderBy('name'));
    const unsubscribe = onSnapshot(packagesQuery, (snapshot) => {
      setPackages(snapshot.docs.map((packageDoc) => ({ id: packageDoc.id, ...packageDoc.data() })));
      setIsLoading(false);
    }, (snapshotError) => {
      setError(`Failed to load packages: ${snapshotError.message}`);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const activeFormPackage = useMemo(() => {
    if (selectedPackage) return selectedPackage;
    if (showCreateForm) return null;
    return null;
  }, [selectedPackage, showCreateForm]);

  const resetForm = () => {
    setSelectedPackage(null);
    setShowCreateForm(false);
  };

  const handleCreate = async (payload) => {
    setIsSaving(true);
    setError('');
    setStatusMessage('');

    try {
      await addDoc(collection(db, PACKAGE_COLLECTION), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setStatusMessage('Package created successfully.');
      resetForm();
    } catch (submitError) {
      setError(`Failed to create package: ${submitError.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (payload) => {
    if (!selectedPackage?.id) return;

    setIsSaving(true);
    setError('');
    setStatusMessage('');

    try {
      await updateDoc(doc(db, PACKAGE_COLLECTION, selectedPackage.id), {
        ...payload,
        updatedAt: serverTimestamp(),
      });
      setStatusMessage('Package updated successfully.');
      resetForm();
    } catch (submitError) {
      setError(`Failed to update package: ${submitError.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (packageRecord) => {
    if (!packageRecord?.id) return;
    const confirmed = window.confirm(`Delete the ${packageRecord.name || 'selected'} package? This is only allowed when no organization uses it.`);
    if (!confirmed) return;

    setDeletingId(packageRecord.id);
    setError('');
    setStatusMessage('');

    try {
      const usage = await getPackageUsage(packageRecord);
      if (usage.inUse) {
        setError(`Cannot delete this package because an organization is using it (${usage.orgPath}).`);
        return;
      }

      await deleteDoc(doc(db, PACKAGE_COLLECTION, packageRecord.id));
      setStatusMessage('Package deleted successfully.');
      if (selectedPackage?.id === packageRecord.id) resetForm();
    } catch (deleteError) {
      setError(`Failed to delete package: ${deleteError.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const submitHandler = selectedPackage?.id ? handleUpdate : handleCreate;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#008069]">Developer console</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">Subscription packages</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">Manage package limits, pricing, and feature flags from Firestore.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSelectedPackage(null);
            setShowCreateForm(true);
            setError('');
            setStatusMessage('');
          }}
          className="rounded-xl bg-[#008069] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_15px_rgba(0,128,105,0.25)] transition-all hover:bg-[#006e5a]"
        >
          <i className="fa-solid fa-plus mr-2"></i>
          New package
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>
      )}
      {statusMessage && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{statusMessage}</div>
      )}

      {(showCreateForm || selectedPackage) && (
        <PackageForm
          packageRecord={activeFormPackage}
          onSubmit={submitHandler}
          onCancel={resetForm}
          isSaving={isSaving}
        />
      )}

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-lg font-bold text-slate-900">Package list</h3>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-3 p-10 text-sm font-bold text-slate-500">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#008069] border-t-transparent"></span>
            Loading packages…
          </div>
        ) : packages.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <i className="fa-solid fa-box-open"></i>
            </div>
            <h4 className="text-base font-bold text-slate-800">No packages yet</h4>
            <p className="mt-1 text-sm font-medium text-slate-500">Create a subscription package to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-5 py-3">Package</th>
                  <th className="px-5 py-3">Price (INR)</th>
                  <th className="px-5 py-3">Storage</th>
                  <th className="px-5 py-3">Users</th>
                  <th className="px-5 py-3">Flags</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {packages.map((packageRecord) => {
                  const enabledFlags = Object.entries(packageRecord.featureFlags || {}).filter(([, enabled]) => enabled);

                  return (
                    <tr key={packageRecord.id} className="align-top hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900">{packageRecord.name || 'Untitled package'}</div>
                        <div className="mt-1 font-mono text-xs text-slate-400">{packageRecord.id}</div>
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-700">{formatCurrency(packageRecord.pricePerUserPerMonth)} / user</td>
                      <td className="px-5 py-4 font-semibold text-slate-700">{formatNumber(packageRecord.storageLimitMB)} MB</td>
                      <td className="px-5 py-4 font-semibold text-slate-700">{formatNumber(packageRecord.maxUsers)}</td>
                      <td className="px-5 py-4">
                        {enabledFlags.length ? (
                          <div className="flex max-w-xs flex-wrap gap-1.5">
                            {enabledFlags.map(([flag]) => (
                              <span key={flag} className="rounded-full bg-[#008069]/10 px-2.5 py-1 text-xs font-bold text-[#008069]">{flag}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm font-medium text-slate-400">No flags enabled</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPackage(packageRecord);
                              setShowCreateForm(false);
                              setError('');
                              setStatusMessage('');
                            }}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:border-[#008069]/30 hover:bg-[#008069]/5 hover:text-[#008069]"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(packageRecord)}
                            disabled={deletingId === packageRecord.id}
                            className="rounded-xl border border-rose-100 px-3 py-2 text-xs font-bold text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingId === packageRecord.id ? 'Checking…' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
