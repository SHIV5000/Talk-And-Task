import React, { useMemo, useState } from 'react';
import TenantForm from './TenantForm.jsx';

const formatBytes = (bytes) => {
  const value = Number(bytes || 0);
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / (1024 ** exponent)).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
};

const formatINR = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0));

const calculateMonthlyCostInr = (pricePerUser, userCount) => {
  const subtotal = Number(pricePerUser || 0) * Number(userCount || 0);
  return { subtotal, gst: subtotal * 0.18, total: subtotal * 1.18 };
};

const formatDateTime = (value) => {
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : '—';
};

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

const DetailItem = ({ label, value }) => (
  <div className="rounded-lg bg-slate-50 p-3">
    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
    <dd className="mt-1 text-sm font-semibold text-slate-800">{value || '—'}</dd>
  </div>
);

export default function TenantDetail({
  tenant,
  subscriptionPackages = [],
  isSaving = false,
  actionTenantId = '',
  onSave,
  onSuspend,
  onDelete,
}) {
  const [isEditing, setIsEditing] = useState(false);

  const packageRecord = useMemo(() => {
    const packageId = getTenantPackageId(tenant);
    return subscriptionPackages.find((item) => item.id === packageId || item.name === packageId || item.packageName === packageId) || null;
  }, [tenant, subscriptionPackages]);
  const packageName = useMemo(() => getPackageName(tenant, subscriptionPackages), [tenant, subscriptionPackages]);
  const monthlyCost = useMemo(() => calculateMonthlyCostInr(packageRecord?.pricePerUserPerMonth ?? tenant?.pricePerUserPerMonth, tenant?.userCount), [packageRecord?.pricePerUserPerMonth, tenant?.pricePerUserPerMonth, tenant?.userCount]);
  const storageLimit = tenant?.storageLimitOverride ?? tenant?.storageLimitMB ?? tenant?.storageLimitBytes ?? tenant?.storageLimit ?? null;
  const storageLimitValue = storageLimit === null || storageLimit === undefined || storageLimit === ''
    ? 'Package default'
    : (tenant?.storageLimitOverride !== undefined || tenant?.storageLimitMB !== undefined ? `${storageLimit} MB` : formatBytes(storageLimit));
  const maxUsers = tenant?.maxUsersOverride ?? tenant?.maxUsers ?? null;
  const featureOverrides = Object.entries(tenant?.featureFlagsOverride || {}).sort(([a], [b]) => a.localeCompare(b));

  if (!tenant) {
    return (
      <div className="flex h-full min-h-[360px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <div>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <i className="fa-solid fa-building"></i>
          </div>
          <h3 className="text-lg font-semibold text-slate-800">Select a tenant</h3>
          <p className="mt-1 text-sm text-slate-500">Choose an organization to view details, edit overrides, suspend, or delete it.</p>
        </div>
      </div>
    );
  }

  const isCurrentAction = actionTenantId === tenant.id;
  const status = tenant.status || (tenant.isSuspended ? 'suspended' : 'active');

  if (isEditing) {
    return (
      <TenantForm
        mode="edit"
        tenant={tenant}
        subscriptionPackages={subscriptionPackages}
        isSaving={isSaving}
        onCancel={() => setIsEditing(false)}
        onSubmit={async (payload) => {
          await onSave?.(tenant, payload);
          setIsEditing(false);
        }}
      />
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-semibold text-slate-900">{tenant.orgName || tenant.name || tenant.id}</h3>
            <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${status === 'suspended' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {status}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">Tenant ID: {tenant.id}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Edit package & overrides
          </button>
          <button
            type="button"
            disabled={isCurrentAction}
            onClick={() => onSuspend?.(tenant)}
            className="rounded-lg border border-amber-200 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCurrentAction ? 'Working…' : 'Suspend'}
          </button>
          <button
            type="button"
            disabled={isCurrentAction}
            onClick={() => onDelete?.(tenant)}
            className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCurrentAction ? 'Working…' : 'Delete'}
          </button>
        </div>
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DetailItem label="Package" value={packageName} />
        <DetailItem label="Admin Name" value={tenant.adminName} />
        <DetailItem label="Admin Email" value={tenant.adminEmail} />
        <DetailItem label="Total Users" value={tenant.userCount} />
        <DetailItem label="Storage used" value={formatBytes(tenant.storageUsedBytes || tenant.storageUsed || tenant.storageBytes)} />
        <DetailItem label="Storage Limit for Organization" value={storageLimitValue} />
        <DetailItem label="Max users" value={maxUsers === null || maxUsers === undefined || maxUsers === '' ? 'Package default' : maxUsers} />
        <DetailItem label="Monthly Cost (INR incl. 18% GST)" value={formatINR(monthlyCost.total)} />
        <DetailItem label="Created" value={formatDateTime(tenant.createdAt)} />
        <DetailItem label="Updated" value={formatDateTime(tenant.updatedAt)} />
      </dl>

      <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <h4 className="text-sm font-semibold text-emerald-900">Dynamic INR pricing</h4>
        <p className="mt-2 text-sm font-bold text-emerald-800">
          Total Cost Per Month = ({formatINR(packageRecord?.pricePerUserPerMonth || 0)} × {tenant.userCount || 0} users) + 18% GST = {formatINR(monthlyCost.total)}
        </p>
        <p className="mt-1 text-xs font-semibold text-emerald-700">Subtotal {formatINR(monthlyCost.subtotal)} • GST {formatINR(monthlyCost.gst)}</p>
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-semibold text-slate-800">Organization users</h4>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{tenant.userCount || 0} total</span>
        </div>
        {tenant.userEmails?.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {tenant.userEmails.map((email) => (
              <span key={email} className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">{email}</span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No user emails found for this organization.</p>
        )}
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 p-4">
        <h4 className="text-sm font-semibold text-slate-800">Feature override summary</h4>
        {featureOverrides.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No feature overrides. This tenant uses package defaults.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {featureOverrides.map(([flagName, enabled]) => (
              <span
                key={flagName}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
              >
                {flagName}: {enabled ? 'on' : 'off'}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
