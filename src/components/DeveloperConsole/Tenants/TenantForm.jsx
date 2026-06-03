import React, { useEffect, useMemo, useState } from 'react';
import TenantFeatureOverrides from './TenantFeatureOverrides.jsx';

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

const getTenantPackageId = (tenant = {}) => (
  tenant.subscriptionPackageId
  || tenant.packageId
  || tenant.subscriptionPackage
  || tenant.subscriptionType
  || ''
);

const toNumberOrNull = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const fromTenant = (tenant = {}) => ({
  orgName: tenant.orgName || tenant.name || tenant.organizationName || '',
  orgId: tenant.id || tenant.orgId || '',
  adminName: tenant.adminName || '',
  adminEmail: tenant.adminEmail || tenant.email || '',
  subscriptionPackageId: getTenantPackageId(tenant),
  storageLimitOverride: tenant.storageLimitOverride ?? '',
  maxUsersOverride: tenant.maxUsersOverride ?? '',
  featureFlagsOverride: tenant.featureFlagsOverride || {},
});

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
    onSubmit?.({
      ...form,
      orgName: form.orgName.trim(),
      orgId: form.orgId.trim(),
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
              : 'Create a tenant organization through the onboardTenant callable.'}
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
            required={mode === 'create'}
            value={form.orgId}
            disabled={isSaving || mode === 'edit'}
            onChange={(event) => updateField('orgId', event.target.value)}
            placeholder="tenant-slug"
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
          Storage limit override (bytes)
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

      <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
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
          disabled={isSaving || !form.orgName.trim() || (mode === 'create' && !form.orgId.trim())}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
