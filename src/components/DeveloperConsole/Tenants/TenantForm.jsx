import React, { useEffect, useMemo, useState } from 'react';
import TenantFeatureOverrides from './TenantFeatureOverrides.jsx';

const slugifyOrgId = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 48);

const EMPTY_FORM = {
  orgName: '',
  orgId: '',
  adminName: '',
  adminEmail: '',
  subscriptionPackageId: '',
  storageLimitOverride: '',
  maxUsersOverride: '',
  featureFlagsOverride: {},
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

const toNumberOrNull = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const fromTenant = (tenant) => {
  const record = tenant || {};
  return {
    orgName: record.orgName || record.name || record.organizationName || '',
    orgId: record.id || record.orgId || '',
    adminName: record.adminName || '',
    adminEmail: record.adminEmail || record.email || '',
    subscriptionPackageId: getTenantPackageId(record),
    storageLimitOverride: record.storageLimitOverride ?? '',
    maxUsersOverride: record.maxUsersOverride ?? '',
    featureFlagsOverride: record.featureFlagsOverride || {},
  };
};

export default function TenantForm({
  mode = 'create',
  tenant,
  subscriptionPackages = [],
  isSaving = false,
  onSubmit,
  onCancel,
}) {
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    setForm(mode === 'edit' ? fromTenant(tenant) : EMPTY_FORM);
  }, [mode, tenant]);

  const packageOptions = useMemo(() => subscriptionPackages.map((pkg) => ({
    id: pkg.id,
    name: pkg.name || pkg.packageName || pkg.title || pkg.id,
  })), [subscriptionPackages]);

  const title = mode === 'edit' ? 'Edit tenant assignment' : 'Onboard tenant';
  const submitLabel = mode === 'edit' ? 'Save tenant' : 'Onboard tenant';

  const updateField = (fieldName, value) => {
    setForm((current) => ({ ...current, [fieldName]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const orgName = form.orgName.trim();
    const orgId = form.orgId.trim() || slugifyOrgId(orgName);
    onSubmit?.({
      ...form,
      orgName,
      orgId,
      adminName: form.adminName.trim(),
      adminEmail: form.adminEmail.trim(),
      storageLimitOverride: toNumberOrNull(form.storageLimitOverride),
      maxUsersOverride: toNumberOrNull(form.maxUsersOverride),
      featureFlagsOverride: form.featureFlagsOverride || {},
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {mode === 'edit'
              ? 'Change package assignment and tenant-level overrides.'
              : 'Create a tenant organization. If the backend callable is unavailable, the console saves directly to Firestore.'}
          </p>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          Organization name
          <input
            type="text"
            required
            value={form.orgName}
            disabled={isSaving}
            onChange={(event) => updateField('orgName', event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-slate-100"
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Organization ID
          <input
            type="text"
            required={false}
            value={form.orgId}
            disabled={isSaving || mode === 'edit'}
            onChange={(event) => updateField('orgId', event.target.value)}
            placeholder="Auto-generated from organization name if blank"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-slate-100"
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Admin name
          <input
            type="text"
            value={form.adminName}
            disabled={isSaving}
            onChange={(event) => updateField('adminName', event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-slate-100"
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Admin email
          <input
            type="email"
            value={form.adminEmail}
            disabled={isSaving}
            onChange={(event) => updateField('adminEmail', event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-slate-100"
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Package assignment
          <select
            value={form.subscriptionPackageId}
            disabled={isSaving}
            onChange={(event) => updateField('subscriptionPackageId', event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-slate-100"
          >
            <option value="">No package assigned</option>
            {packageOptions.map((pkg) => (
              <option key={pkg.id} value={pkg.id}>{pkg.name}</option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Storage Limit for Organization override (bytes)
          <input
            type="number"
            min="0"
            value={form.storageLimitOverride}
            disabled={isSaving}
            onChange={(event) => updateField('storageLimitOverride', event.target.value)}
            placeholder="Leave blank for package default"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-slate-100"
          />
        </label>

        <label className="block text-sm font-medium text-slate-700 md:col-span-2">
          Max users override
          <input
            type="number"
            min="0"
            value={form.maxUsersOverride}
            disabled={isSaving}
            onChange={(event) => updateField('maxUsersOverride', event.target.value)}
            placeholder="Leave blank for package default"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-slate-100"
          />
        </label>
      </div>

      <TenantFeatureOverrides
        value={form.featureFlagsOverride}
        disabled={isSaving}
        onChange={(featureFlagsOverride) => updateField('featureFlagsOverride', featureFlagsOverride)}
      />

      <div className="sticky bottom-0 z-10 -mx-5 flex justify-end gap-3 border-t border-slate-100 bg-white/95 px-5 py-4 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] backdrop-blur">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSaving || !form.orgName.trim()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
