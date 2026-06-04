import React, { useEffect, useMemo, useState } from 'react';
import FeatureFlagGrid from './FeatureFlagGrid.jsx';

const emptyPackage = {
  name: '',
  pricePerUserPerMonth: '',
  storageLimitMB: '',
  maxUsers: '',
  featureFlags: {},
};

const toNumberOrNull = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export const buildPackagePayload = (formState) => ({
  name: formState.name.trim(),
  pricePerUserPerMonth: toNumberOrNull(formState.pricePerUserPerMonth) ?? 0,
  storageLimitMB: toNumberOrNull(formState.storageLimitMB) ?? 0,
  maxUsers: toNumberOrNull(formState.maxUsers) ?? 0,
  featureFlags: formState.featureFlags || {},
});

export default function PackageForm({
  packageRecord = null,
  onSubmit,
  onCancel,
  isSaving = false,
}) {
  const initialForm = useMemo(() => ({
    ...emptyPackage,
    ...(packageRecord || {}),
    pricePerUserPerMonth: packageRecord?.pricePerUserPerMonth ?? '',
    storageLimitMB: packageRecord?.storageLimitMB ?? '',
    maxUsers: packageRecord?.maxUsers ?? '',
    featureFlags: packageRecord?.featureFlags || {},
  }), [packageRecord]);

  const [formState, setFormState] = useState(initialForm);

  useEffect(() => {
    setFormState(initialForm);
  }, [initialForm]);

  const updateField = (field, value) => {
    setFormState((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!formState.name.trim()) return;
    onSubmit?.(buildPackagePayload(formState));
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#008069]">Subscription package</p>
          <h3 className="mt-1 text-xl font-bold text-slate-900">{packageRecord?.id ? 'Edit package' : 'Create package'}</h3>
          <p className="mt-1 text-sm font-medium text-slate-500">
            {packageRecord?.id ? 'Update limits, pricing, and feature access.' : 'New packages are saved with a generated Firestore ID.'}
          </p>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-3 py-2 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            Cancel
          </button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Name</label>
          <input
            required
            type="text"
            value={formState.name}
            onChange={(event) => updateField('name', event.target.value)}
            placeholder="Enterprise Plus"
            className="w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-[#008069] focus:ring-2 focus:ring-[#008069]/20"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Price per user / month</label>
          <input
            required
            min="0"
            step="0.01"
            type="number"
            value={formState.pricePerUserPerMonth}
            onChange={(event) => updateField('pricePerUserPerMonth', event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-[#008069] focus:ring-2 focus:ring-[#008069]/20"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Storage Limit for Organization (MB)</label>
          <input
            required
            min="0"
            step="1"
            type="number"
            value={formState.storageLimitMB}
            onChange={(event) => updateField('storageLimitMB', event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-[#008069] focus:ring-2 focus:ring-[#008069]/20"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Max users</label>
          <input
            required
            min="0"
            step="1"
            type="number"
            value={formState.maxUsers}
            onChange={(event) => updateField('maxUsers', event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-[#008069] focus:ring-2 focus:ring-[#008069]/20"
          />
        </div>
      </div>

      <div className="mt-5">
        <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500">Feature flags</label>
        <FeatureFlagGrid
          value={formState.featureFlags}
          onChange={(nextFlags) => updateField('featureFlags', nextFlags)}
          disabled={isSaving}
        />
      </div>

      <div className="sticky bottom-0 z-10 -mx-5 mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 bg-white/95 px-5 py-4 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] backdrop-blur sm:flex-row sm:justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="rounded-xl px-5 py-3 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-60"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSaving || !formState.name.trim()}
          className="rounded-xl bg-[#008069] px-5 py-3 text-sm font-bold text-white shadow-[0_4px_15px_rgba(0,128,105,0.25)] transition-all hover:bg-[#006e5a] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? 'Saving…' : packageRecord?.id ? 'Save package' : 'Create package'}
        </button>
      </div>
    </form>
  );
}
