export const PACKAGE_STORAGE_LIMITS_MB = {
  Free: 100,
  Basic: 1024,
  Premium: 10240,
  Enterprise: 102400,
};

export const toNumberOrNull = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

export const getPackageStorageLimitMB = (details = {}) => {
  const explicitLimit = toNumberOrNull(details.packageStorageLimitMB ?? details.storageLimitMB);
  if (explicitLimit !== null) return explicitLimit;
  return PACKAGE_STORAGE_LIMITS_MB[details.subscriptionType] ?? PACKAGE_STORAGE_LIMITS_MB.Free;
};

export const getEffectiveStorageLimitMB = (details = {}) => {
  const overrideLimit = toNumberOrNull(details.storageLimitOverride);
  return overrideLimit !== null ? overrideLimit : getPackageStorageLimitMB(details);
};
