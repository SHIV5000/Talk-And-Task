import React, { useMemo, useState } from 'react';

export const DEFAULT_FEATURE_FLAGS = [
  { key: 'chat', label: 'Chat workspace', description: 'Main chat screen and message search.' },
  { key: 'usersTab', label: 'Admin: Users tab', description: 'User control and account governance.' },
  { key: 'departmentsTab', label: 'Admin: Departments tab', description: 'Department creation and member management.' },
  { key: 'taskCards', label: 'Admin: Tasks tab', description: 'Task cards, conversion, and task workspace.' },
  { key: 'advancedAnalytics', label: 'Admin: Overview tab', description: 'Overview dashboard, metrics, and analytics.' },
  { key: 'dataGovernance', label: 'Admin: Security & Lifecycle tabs', description: 'Security sessions, retention policies, and governance tools.' },
  { key: 'auditLogs', label: 'Admin: Logs tab', description: 'Track administrative and workspace activity.' },
  { key: 'broadcasts', label: 'Admin: Broadcast tab', description: 'Workspace broadcasts and acknowledgement vault.' },
  { key: 'customBranding', label: 'Admin: Tags tab', description: 'Global tags and branding controls.' },
  { key: 'dsarCompliance', label: 'Admin: Recovery & Compliance tabs', description: 'Backups, exports, and DSAR workflows.' },
  { key: 'organizationSettings', label: 'Admin: Organization tab', description: 'Organization profile and app settings.' },
  { key: 'apiAccess', label: 'API access', description: 'Developer and integration API surfaces.' },
];

const normalizeFlagKey = (value) => String(value || '')
  .trim()
  .replace(/[^a-zA-Z0-9_ -]/g, '')
  .replace(/[\s-]+(.)?/g, (_, chr) => (chr ? chr.toUpperCase() : ''))
  .replace(/^[A-Z]/, (chr) => chr.toLowerCase());

const titleizeFlagKey = (key) => String(key || '')
  .replace(/([A-Z])/g, ' $1')
  .replace(/[_-]+/g, ' ')
  .replace(/^./, (chr) => chr.toUpperCase())
  .trim();

export default function FeatureFlagGrid({
  value = {},
  onChange,
  availableFlags = DEFAULT_FEATURE_FLAGS,
  disabled = false,
}) {
  const [customFlagName, setCustomFlagName] = useState('');

  const flagRows = useMemo(() => {
    const definedKeys = new Set(availableFlags.map((flag) => flag.key));
    const customFlags = Object.keys(value || {})
      .filter((key) => !definedKeys.has(key))
      .map((key) => ({ key, label: titleizeFlagKey(key), description: 'Custom package feature flag.' }));

    return [...availableFlags, ...customFlags];
  }, [availableFlags, value]);

  const setFlag = (key, enabled) => {
    if (!onChange) return;
    onChange({ ...(value || {}), [key]: enabled });
  };

  const addCustomFlag = () => {
    const key = normalizeFlagKey(customFlagName);
    if (!key) return;
    setFlag(key, true);
    setCustomFlagName('');
  };

  const removeCustomFlag = (key) => {
    if (!onChange) return;
    const nextFlags = { ...(value || {}) };
    delete nextFlags[key];
    onChange(nextFlags);
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {flagRows.map((flag) => {
          const isCustom = !availableFlags.some((availableFlag) => availableFlag.key === flag.key);

          return (
            <label
              key={flag.key}
              className={`flex items-start gap-3 rounded-2xl border p-3 transition-colors ${value?.[flag.key] ? 'border-[#008069]/30 bg-[#008069]/5' : 'border-slate-200 bg-white'} ${disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:border-[#008069]/40'}`}
            >
              <input
                type="checkbox"
                checked={Boolean(value?.[flag.key])}
                disabled={disabled}
                onChange={(event) => setFlag(flag.key, event.target.checked)}
                className="mt-1 h-4 w-4 accent-[#008069]"
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-slate-800">{flag.label}</span>
                  {isCustom && !disabled && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        removeCustomFlag(flag.key);
                      }}
                      className="text-xs font-bold text-rose-500 hover:text-rose-600"
                    >
                      Remove
                    </button>
                  )}
                </span>
                <span className="mt-0.5 block text-xs font-medium leading-5 text-slate-500">{flag.description}</span>
              </span>
            </label>
          );
        })}
      </div>

      {!disabled && (
        <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 sm:flex-row">
          <input
            type="text"
            value={customFlagName}
            onChange={(event) => setCustomFlagName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addCustomFlag();
              }
            }}
            placeholder="Add custom feature flag"
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-[#008069] focus:ring-2 focus:ring-[#008069]/20"
          />
          <button
            type="button"
            onClick={addCustomFlag}
            className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-700"
          >
            Add flag
          </button>
        </div>
      )}
    </div>
  );
}
