import React, { useEffect, useMemo, useState } from 'react';

const FEATURE_FLAG_HINTS = [
  'chat',
  'usersTab',
  'departmentsTab',
  'taskCards',
  'advancedAnalytics',
  'dataGovernance',
  'auditLogs',
  'broadcasts',
  'customBranding',
  'dsarCompliance',
  'organizationSettings',
  'apiAccess',
];

const normalizeFlags = (flags = {}) => Object.entries(flags || {}).reduce((acc, [key, value]) => {
  if (key) acc[key] = !!value;
  return acc;
}, {});

export default function TenantFeatureOverrides({
  value = {},
  disabled = false,
  onChange,
}) {
  const [newFlagName, setNewFlagName] = useState('');
  const flags = useMemo(() => normalizeFlags(value), [value]);

  useEffect(() => {
    const normalized = normalizeFlags(value);
    if (JSON.stringify(normalized) !== JSON.stringify(value || {})) {
      onChange?.(normalized);
    }
  }, [value, onChange]);

  const updateFlag = (flagName, enabled) => {
    onChange?.({ ...flags, [flagName]: enabled });
  };

  const addFlag = () => {
    const cleanName = newFlagName.trim();
    if (!cleanName || flags[cleanName] !== undefined) return;
    onChange?.({ ...flags, [cleanName]: true });
    setNewFlagName('');
  };

  const removeFlag = (flagName) => {
    const nextFlags = { ...flags };
    delete nextFlags[flagName];
    onChange?.(nextFlags);
  };

  const flagNames = Object.keys(flags).sort((a, b) => a.localeCompare(b));
  const availableHints = FEATURE_FLAG_HINTS.filter((flagName) => !flags[flagName]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-800">Feature flag overrides</h4>
            <p className="mt-1 text-xs text-slate-500">
              These values override the tenant package defaults for this organization only.
            </p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500 shadow-sm">
            {flagNames.length} override{flagNames.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="mt-4 space-y-2">
          {flagNames.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
              No feature overrides set. Package defaults will apply.
            </div>
          ) : flagNames.map((flagName) => (
            <div key={flagName} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-white px-3 py-2 shadow-sm">
              <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={!!flags[flagName]}
                  disabled={disabled}
                  onChange={(event) => updateFlag(flagName, event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <span>{flagName}</span>
              </label>
              <button
                type="button"
                disabled={disabled}
                onClick={() => removeFlag(flagName)}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-4">
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="tenant-feature-flag-name">
          Add override
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id="tenant-feature-flag-name"
            type="text"
            value={newFlagName}
            disabled={disabled}
            onChange={(event) => setNewFlagName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addFlag();
              }
            }}
            placeholder="customFeatureFlag"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-slate-100"
          />
          <button
            type="button"
            disabled={disabled || !newFlagName.trim() || flags[newFlagName.trim()] !== undefined}
            onClick={addFlag}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            Add flag
          </button>
        </div>

        {availableHints.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {availableHints.map((flagName) => (
              <button
                key={flagName}
                type="button"
                disabled={disabled}
                onClick={() => {
                  onChange?.({ ...flags, [flagName]: true });
                }}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                + {flagName}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
