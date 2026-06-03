const FEATURE_FLAG_KEYS = [
  'chat',
  'taskCards',
  'advancedAnalytics',
  'dataGovernance',
  'dsarCompliance',
  'customBranding',
  'apiAccess',
  'auditLogs',
  'prioritySupport',
];

export const FEATURE_FLAGS = Object.freeze({
  chat: { key: 'chat', label: 'Chat' },
  taskCards: { key: 'taskCards', label: 'Task cards' },
  advancedAnalytics: { key: 'advancedAnalytics', label: 'Advanced analytics' },
  dataGovernance: { key: 'dataGovernance', label: 'Data governance' },
  dsarCompliance: { key: 'dsarCompliance', label: 'DSAR compliance' },
  customBranding: { key: 'customBranding', label: 'Custom branding' },
  apiAccess: { key: 'apiAccess', label: 'API access' },
  auditLogs: { key: 'auditLogs', label: 'Audit logs' },
  prioritySupport: { key: 'prioritySupport', label: 'Priority support' },
});

export const DEFAULT_FEATURE_FLAGS = Object.freeze({
  chat: true,
  taskCards: true,
  advancedAnalytics: false,
  dataGovernance: false,
  dsarCompliance: false,
  customBranding: false,
  apiAccess: false,
  auditLogs: false,
  prioritySupport: false,
});

export const PACKAGE_STATUS_OPTIONS = Object.freeze([
  { value: 'draft', label: 'Draft' },
  { value: 'trialing', label: 'Trialing' },
  { value: 'active', label: 'Active' },
  { value: 'past_due', label: 'Past due' },
  { value: 'paused', label: 'Paused' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'archived', label: 'Archived' },
]);

const DEFAULT_STORAGE_LIMIT_MB = 1024;

const normalizeFlagValue = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return Boolean(value);
};

const applyKnownFeatureFlags = (baseFlags, flags) => {
  if (!flags || typeof flags !== 'object') return baseFlags;

  return FEATURE_FLAG_KEYS.reduce((mergedFlags, key) => {
    const hasFlag = Object.prototype.hasOwnProperty.call(flags, key);
    if (hasFlag && flags[key] !== undefined && flags[key] !== null) {
      mergedFlags[key] = normalizeFlagValue(flags[key]);
    }

    return mergedFlags;
  }, baseFlags);
};

export const mergeFeatureFlags = (packageFlags = {}, overrideFlags = {}) => {
  const mergedFlags = { ...DEFAULT_FEATURE_FLAGS };
  applyKnownFeatureFlags(mergedFlags, packageFlags);
  applyKnownFeatureFlags(mergedFlags, overrideFlags);
  return mergedFlags;
};

const toPositiveNumber = (value) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
};

const getStorageLimitFromDocument = (doc = {}) => {
  const megabyteLimit =
    toPositiveNumber(doc.storageLimitMb) ??
    toPositiveNumber(doc.storageLimitMB) ??
    toPositiveNumber(doc.storageLimitInMb) ??
    toPositiveNumber(doc.storageLimit);

  if (megabyteLimit !== null) return megabyteLimit;

  const gigabyteLimit =
    toPositiveNumber(doc.storageLimitGb) ??
    toPositiveNumber(doc.storageLimitGB) ??
    toPositiveNumber(doc.storageLimitInGb);

  return gigabyteLimit !== null ? gigabyteLimit * 1024 : null;
};

export const getEffectiveStorageLimit = (packageDoc = {}, orgDetails = {}) => {
  const orgStorageLimit = getStorageLimitFromDocument(orgDetails);
  if (orgStorageLimit !== null) return orgStorageLimit;

  const packageStorageLimit = getStorageLimitFromDocument(packageDoc);
  if (packageStorageLimit !== null) return packageStorageLimit;

  return DEFAULT_STORAGE_LIMIT_MB;
};
