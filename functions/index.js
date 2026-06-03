const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

const DEFAULT_ORG_ID = 'mpgs';
const TENANT_COLLECTIONS = [
  'messages',
  'groups',
  'notifications',
  'reminders',
  'workspace_tags',
  'audit_logs',
];
const DEFAULT_APP_VERSION = '1.0.0';
const DEFAULT_PACKAGES = {
  starter: {
    name: 'Starter',
    description: 'Entry package for small teams getting started with Talk And Task.',
    monthlyPriceUsd: 0,
    maxUsers: 25,
    storageLimitBytes: 5 * 1024 * 1024 * 1024,
    features: ['chat', 'tasks', 'reminders', 'basic_audit_logs'],
    isActive: true,
    sortOrder: 1,
  },
  professional: {
    name: 'Professional',
    description: 'Collaboration package for growing organizations.',
    monthlyPriceUsd: 49,
    maxUsers: 250,
    storageLimitBytes: 100 * 1024 * 1024 * 1024,
    features: ['chat', 'tasks', 'reminders', 'advanced_audit_logs', 'exports', 'rbac'],
    isActive: true,
    sortOrder: 2,
  },
  enterprise: {
    name: 'Enterprise',
    description: 'Enterprise package with platform owner controls and expanded limits.',
    monthlyPriceUsd: null,
    maxUsers: null,
    storageLimitBytes: 1024 * 1024 * 1024 * 1024,
    features: ['chat', 'tasks', 'reminders', 'advanced_audit_logs', 'exports', 'rbac', 'tenant_admin', 'priority_support'],
    isActive: true,
    sortOrder: 3,
  },
};

const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();
const toSlug = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 48);

const assertPlatformOwner = async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  if (request.auth.token?.isPlatformOwner || request.auth.token?.admin) return;
  const userSnap = await db.collection('users').doc(request.auth.uid).get();
  const user = userSnap.data() || {};
  if (user.isPlatformOwner || user.isAdmin) return;
  throw new HttpsError('permission-denied', 'Platform owner access is required.');
};

const commitBatchIfNeeded = async (state, force = false) => {
  if (state.count > 0 && (force || state.count >= 450)) {
    await state.batch.commit();
    state.batch = db.batch();
    state.count = 0;
  }
};

const queueBatchSet = async (state, ref, data, options) => {
  state.batch.set(ref, data, options);
  state.count += 1;
  await commitBatchIfNeeded(state);
};

const queueBatchUpdate = async (state, ref, data) => {
  state.batch.update(ref, data);
  state.count += 1;
  await commitBatchIfNeeded(state);
};

const queueBatchDelete = async (state, ref) => {
  state.batch.delete(ref);
  state.count += 1;
  await commitBatchIfNeeded(state);
};

const seedSubscriptionPackages = async (batchState) => {
  Object.entries(DEFAULT_PACKAGES).forEach(([id, packageData]) => {
    const ref = db.collection('subscriptionPackages').doc(id);
    batchState.batch.set(ref, {
      ...packageData,
      id,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    batchState.count += 1;
  });
  await commitBatchIfNeeded(batchState);
};

const seedPlatformConfig = async (batchState, appVersion = DEFAULT_APP_VERSION) => {
  await queueBatchSet(batchState, db.collection('platform').doc('config'), {
    appVersion,
    updatedAt: serverTimestamp(),
  }, { merge: true });
};

const seedOrganizationDetails = async (orgId, details = {}, batchState) => {
  const now = serverTimestamp();
  const packageId = details.subscriptionPackageId || details.packageId || 'enterprise';
  const packageSnap = await db.collection('subscriptionPackages').doc(packageId).get();
  const packageData = packageSnap.data() || DEFAULT_PACKAGES[packageId] || DEFAULT_PACKAGES.enterprise;
  await queueBatchSet(batchState, db.collection('organizations').doc(orgId), {
    orgId,
    name: details.name || details.displayName || 'MPGS',
    status: details.status || 'active',
    subscriptionPackageId: packageId,
    storageUsedBytes: Number(details.storageUsedBytes || 0),
    storageLimitBytes: Number(details.storageLimitBytes || packageData.storageLimitBytes || 0),
    updatedAt: now,
    createdAt: details.createdAt || now,
  }, { merge: true });
  await queueBatchSet(batchState, db.collection('organizations').doc(orgId).collection('org_details').doc('details'), {
    orgId,
    name: details.name || details.displayName || 'MPGS',
    status: details.status || 'active',
    subscriptionPackageId: packageId,
    storageUsedBytes: Number(details.storageUsedBytes || 0),
    storageLimitBytes: Number(details.storageLimitBytes || packageData.storageLimitBytes || 0),
    contactEmail: details.contactEmail || null,
    domain: details.domain || null,
    updatedAt: now,
    createdAt: details.createdAt || now,
  }, { merge: true });
};

const copyRootCollectionToOrganization = async (orgId, collectionName) => {
  const sourceSnap = await db.collection(collectionName).get();
  const batchState = { batch: db.batch(), count: 0 };
  for (const docSnap of sourceSnap.docs) {
    const targetRef = db.collection('organizations').doc(orgId).collection(collectionName).doc(docSnap.id);
    await queueBatchSet(batchState, targetRef, {
      ...docSnap.data(),
      orgId,
      migratedAt: serverTimestamp(),
    }, { merge: true });
    await queueBatchDelete(batchState, docSnap.ref);
  }
  await commitBatchIfNeeded(batchState, true);
  return sourceSnap.size;
};

const normalizeRole = (user) => {
  if (user.role) return user.role;
  if (user.isPlatformOwner) return 'platformOwner';
  if (user.isAdmin || (Array.isArray(user.roles) && user.roles.includes('Super Admin'))) return 'admin';
  return 'member';
};

const updateUsersForOrganization = async (orgId) => {
  const usersSnap = await db.collection('users').get();
  const batchState = { batch: db.batch(), count: 0 };
  let platformOwnerSeeded = false;
  for (const userDoc of usersSnap.docs) {
    const user = userDoc.data() || {};
    const isPlatformOwner = !!user.isPlatformOwner || (!platformOwnerSeeded && !!user.isAdmin);
    platformOwnerSeeded = platformOwnerSeeded || isPlatformOwner;
    const role = normalizeRole({ ...user, isPlatformOwner });
    await queueBatchUpdate(batchState, userDoc.ref, { orgId, role, isPlatformOwner, updatedAt: serverTimestamp() });
    try {
      await admin.auth().setCustomUserClaims(userDoc.id, {
        ...(await admin.auth().getUser(userDoc.id)).customClaims,
        orgId,
        role,
        isPlatformOwner,
        admin: role === 'admin' || isPlatformOwner || !!user.isAdmin,
      });
    } catch (error) {
      await db.collection('custom_claim_errors').add({
        uid: userDoc.id,
        orgId,
        message: error.message,
        timestamp: serverTimestamp(),
      });
    }
  }
  await commitBatchIfNeeded(batchState, true);
  return usersSnap.size;
};

const recursivelyDeleteCollection = async (collectionRef) => {
  const snap = await collectionRef.limit(250).get();
  if (snap.empty) return 0;
  const batch = db.batch();
  snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
  await batch.commit();
  return snap.size + await recursivelyDeleteCollection(collectionRef);
};


const PERMISSION_ACTIONS = ['read', 'create', 'update', 'delete'];
const logAuditEvent = async (type, adminId, target, details = {}) => db.collection('audit_logs').add({
  type,
  adminId,
  user: adminId,
  target,
  details,
  content: `${type}: ${target}`,
  immutableId: `${type}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
  timestamp: admin.firestore.FieldValue.serverTimestamp(),
});

const getMergedPermissions = async (uid) => {
  const userSnap = await db.collection('users').doc(uid).get();
  const user = userSnap.data() || {};
  if (user.isAdmin) return { '*': { read: true, create: true, update: true, delete: true } };
  const roleNames = user.roles || [];
  const rolesSnap = await db.collection('roles').where('name', 'in', roleNames.length ? roleNames.slice(0, 10) : ['__none__']).get();
  const merged = {};
  rolesSnap.forEach((doc) => {
    const role = doc.data();
    Object.entries(role.permissions || {}).forEach(([area, actions]) => {
      merged[area] = merged[area] || {};
      PERMISSION_ACTIONS.forEach((action) => { merged[area][action] = !!merged[area][action] || !!actions[action]; });
    });
  });
  return merged;
};

const assertPermission = async (request, area, action) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  const permissions = await getMergedPermissions(request.auth.uid);
  if (permissions['*']?.[action] || permissions[area]?.[action]) return;
  throw new HttpsError('permission-denied', `Missing ${area}.${action} permission.`);
};

exports.forceLogoutSession = onCall(async (request) => {
  await assertPermission(request, 'Users', 'update');
  const { uid, sessionId } = request.data || {};
  if (!uid || !sessionId) throw new HttpsError('invalid-argument', 'uid and sessionId are required.');
  await admin.auth().revokeRefreshTokens(uid);
  await db.collection('sessions').doc(sessionId).delete();
  await logAuditEvent('FORCE_LOGOUT', request.auth.uid, sessionId, { affectedUid: uid });
  return { ok: true };
});

exports.forceLogoutAllUsers = onCall(async (request) => {
  await assertPermission(request, 'Users', 'update');
  const sessions = await db.collection('sessions').get();
  const uids = [...new Set(sessions.docs.map((doc) => doc.data().uid).filter(Boolean))];
  await Promise.all(uids.map((uid) => admin.auth().revokeRefreshTokens(uid)));
  const batch = db.batch();
  sessions.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  await logAuditEvent('FORCE_LOGOUT_ALL', request.auth.uid, 'all-sessions', { count: uids.length, affectedUsers: uids });
  return { ok: true, count: uids.length };
});

exports.retentionCleanup = onSchedule('every day 02:00', async () => {
  const policies = await db.collection('retentionPolicies').where('isActive', '==', true).get();
  for (const policyDoc of policies.docs) {
    const policy = policyDoc.data();
    if (policy.category !== 'Chat Messages') continue;
    const threshold = admin.firestore.Timestamp.fromMillis(Date.now() - Number(policy.ttlDays || 30) * 86400000);
    const oldMessages = await db.collection('messages').where('isTask', '==', false).where('timestamp', '<', threshold).limit(500).get();
    const batch = db.batch();
    oldMessages.docs.forEach((msgDoc) => {
      if (policy.action === 'archive') batch.set(db.collection('archived_messages').doc(msgDoc.id), { ...msgDoc.data(), archivedAt: admin.firestore.FieldValue.serverTimestamp() });
      batch.delete(msgDoc.ref);
    });
    await batch.commit();
    await db.collection('retention_cleanup_logs').add({ ruleId: policyDoc.id, ruleName: policy.category, affected: oldMessages.size, status: 'completed', timestamp: admin.firestore.FieldValue.serverTimestamp() });
    await logAuditEvent('RETENTION_RUN', 'scheduler', policyDoc.id, { affected: oldMessages.size });
  }
});

exports.exportDatabase = onCall(async (request) => {
  await assertPermission(request, 'Backups', 'create');
  const collections = ['users', 'groups', 'messages', 'audit_logs', 'settings'];
  const payload = { exportedAt: new Date().toISOString(), requestedBy: request.auth.uid, collections: {} };
  for (const name of collections) {
    const snap = await db.collection(name).get();
    payload.collections[name] = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }
  const file = admin.storage().bucket().file(`exports/full-export-${Date.now()}.json`);
  await file.save(JSON.stringify(payload, null, 2), { contentType: 'application/json' });
  const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 60 * 60 * 1000 });
  await db.collection('exports').add({ fileName: file.name, size: Buffer.byteLength(JSON.stringify(payload)), downloadUrl: url, status: 'ready', timestamp: admin.firestore.FieldValue.serverTimestamp() });
  await logAuditEvent('BACKUP_EXPORT', request.auth.uid, file.name, { collections });
  return { url, fileName: file.name };
});

exports.dsarGenerateReport = onCall(async (request) => {
  await assertPermission(request, 'Compliance', 'create');
  await logAuditEvent('DSAR_EXPORT', request.auth.uid, request.data?.uid || 'unknown', { dateRange: request.data?.dateRange || null });
  return { ok: true, message: 'Use the admin UI generated report or extend this callable for server-side report generation.' };
});

exports.migrateToMultiTenant = onCall(async (request) => {
  await assertPlatformOwner(request);
  const orgId = request.data?.orgId || DEFAULT_ORG_ID;
  const appVersion = request.data?.appVersion || DEFAULT_APP_VERSION;
  const organizationDetails = request.data?.organization || {};
  const batchState = { batch: db.batch(), count: 0 };

  await seedSubscriptionPackages(batchState);
  await seedPlatformConfig(batchState, appVersion);
  await seedOrganizationDetails(orgId, organizationDetails, batchState);
  await commitBatchIfNeeded(batchState, true);

  const migratedCollections = {};
  for (const collectionName of TENANT_COLLECTIONS) {
    migratedCollections[collectionName] = await copyRootCollectionToOrganization(orgId, collectionName);
  }
  const usersUpdated = await updateUsersForOrganization(orgId);

  await db.collection('organizations').doc(orgId).collection('audit_logs').add({
    type: 'MIGRATE_TO_MULTI_TENANT',
    adminId: request.auth.uid,
    user: request.auth.uid,
    target: orgId,
    details: { migratedCollections, usersUpdated, appVersion },
    content: `MIGRATE_TO_MULTI_TENANT: ${orgId}`,
    immutableId: `MIGRATE_TO_MULTI_TENANT_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    timestamp: serverTimestamp(),
  });

  return { ok: true, orgId, migratedCollections, usersUpdated };
});

exports.createUser = onCall(async (request) => {
  await assertPermission(request, 'Users', 'create');
  const data = request.data || {};
  const email = String(data.email || '').trim();
  const name = String(data.name || '').trim();
  const password = String(data.password || '').trim();
  const orgId = String(data.orgId || DEFAULT_ORG_ID).trim() || DEFAULT_ORG_ID;
  const isApproved = !!data.isApproved;

  if (!email || !name) throw new HttpsError('invalid-argument', 'email and name are required.');
  if (password && password.length < 6) throw new HttpsError('invalid-argument', 'Temporary password must be at least 6 characters.');

  const authPayload = { email, displayName: name, disabled: false };
  if (password) authPayload.password = password;

  const userRecord = await admin.auth().createUser(authPayload);
  await db.collection('users').doc(userRecord.uid).set({
    uid: userRecord.uid,
    email,
    name,
    orgId,
    isApproved,
    isAdmin: false,
    canCreateGroups: false,
    isArchived: false,
    roles: [],
    tempPasswordSet: !!password,
    createdAt: serverTimestamp(),
    lastActive: serverTimestamp(),
    toolPreferences: {
      reply: true,
      react: true,
      edit: true,
      delete: true,
      pin: true,
      bookmark: true,
      showWatermark: true,
      soundProfile: 'classic',
    },
  }, { merge: true });

  await logAuditEvent('CREATE_USER', request.auth.uid, userRecord.uid, { email, orgId, isApproved });

  return { ok: true, uid: userRecord.uid, isApproved };
});

exports.setCustomClaims = onCall(async (request) => {
  await assertPlatformOwner(request);
  const { uid, orgId, role, isPlatformOwner = false, claims = {} } = request.data || {};
  if (!uid) throw new HttpsError('invalid-argument', 'uid is required.');
  const resolvedOrgId = orgId || DEFAULT_ORG_ID;
  const resolvedRole = role || (isPlatformOwner ? 'platformOwner' : 'member');
  const existingUser = await admin.auth().getUser(uid);
  const customClaims = {
    ...(existingUser.customClaims || {}),
    ...claims,
    orgId: resolvedOrgId,
    role: resolvedRole,
    isPlatformOwner: !!isPlatformOwner,
    admin: !!claims.admin || resolvedRole === 'admin' || !!isPlatformOwner,
  };
  await admin.auth().setCustomUserClaims(uid, customClaims);
  await db.collection('users').doc(uid).set({
    orgId: resolvedOrgId,
    role: resolvedRole,
    isPlatformOwner: !!isPlatformOwner,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  await db.collection('organizations').doc(resolvedOrgId).collection('audit_logs').add({
    type: 'SET_CUSTOM_CLAIMS',
    adminId: request.auth.uid,
    user: request.auth.uid,
    target: uid,
    details: { orgId: resolvedOrgId, role: resolvedRole, isPlatformOwner: !!isPlatformOwner },
    content: `SET_CUSTOM_CLAIMS: ${uid}`,
    immutableId: `SET_CUSTOM_CLAIMS_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    timestamp: serverTimestamp(),
  });
  return { ok: true, uid, claims: customClaims };
});

exports.onboardTenant = onCall(async (request) => {
  await assertPlatformOwner(request);
  const data = request.data || {};
  const orgId = data.orgId || toSlug(data.name || data.displayName);
  if (!orgId) throw new HttpsError('invalid-argument', 'orgId or name is required.');
  const orgRef = db.collection('organizations').doc(orgId);
  const existing = await orgRef.get();
  if (existing.exists && data.failIfExists !== false) throw new HttpsError('already-exists', `Tenant ${orgId} already exists.`);

  const batchState = { batch: db.batch(), count: 0 };
  await seedSubscriptionPackages(batchState);
  await seedOrganizationDetails(orgId, {
    ...data,
    status: 'active',
    createdAt: existing.exists ? existing.data().createdAt : serverTimestamp(),
  }, batchState);

  // --- NEW: CREATE DEFAULT WELCOME GROUP & MESSAGE ---
  const groupRef = db.collection('organizations').doc(orgId).collection('groups').doc();
  const adminEmail = data.adminEmail || '';
  
  await queueBatchSet(batchState, groupRef, {
    name: "Welcome",
    members: adminEmail ? [adminEmail] : [],
    admins: adminEmail ? [adminEmail] : [],
    createdBy: "system",
    createdAt: serverTimestamp(),
    isArchived: false,
    profilePicUrl: null
  }, { merge: true });

  const msgRef = db.collection('organizations').doc(orgId).collection('messages').doc();
  await queueBatchSet(batchState, msgRef, {
    text: "👋 <strong>Welcome to Talk & Task!</strong><br><br>This is your default workspace. You can invite your team, share files, and convert any message here into a trackable task.",
    senderUid: "system",
    senderEmail: "Developer Console",
    groupId: groupRef.id,
    timestamp: serverTimestamp(),
    isTask: false,
    seenBy: adminEmail ? [adminEmail] : [],
    reactions: {}
  }, { merge: true });
  // ---------------------------------------------------

  await commitBatchIfNeeded(batchState, true);

  if (data.ownerUid) {
    const owner = await admin.auth().getUser(data.ownerUid);
    const customClaims = {
      ...(owner.customClaims || {}),
      orgId,
      role: data.ownerRole || 'admin',
      isPlatformOwner: !!data.ownerIsPlatformOwner,
      admin: true,
    };
    await admin.auth().setCustomUserClaims(data.ownerUid, customClaims);
    await db.collection('users').doc(data.ownerUid).set({
      orgId,
      role: customClaims.role,
      isPlatformOwner: customClaims.isPlatformOwner,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }

  await orgRef.collection('audit_logs').add({
    type: 'ONBOARD_TENANT',
    adminId: request.auth.uid,
    user: request.auth.uid,
    target: orgId,
    details: { name: data.name || data.displayName || orgId, ownerUid: data.ownerUid || null },
    content: `ONBOARD_TENANT: ${orgId}`,
    immutableId: `ONBOARD_TENANT_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    timestamp: serverTimestamp(),
  });
  return { ok: true, orgId };
});

exports.suspendTenant = onCall(async (request) => {
  await assertPlatformOwner(request);
  const { orgId, reason = null, disableUsers = false } = request.data || {};
  if (!orgId) throw new HttpsError('invalid-argument', 'orgId is required.');
  const orgRef = db.collection('organizations').doc(orgId);
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) throw new HttpsError('not-found', `Tenant ${orgId} was not found.`);

  await orgRef.set({ status: 'suspended', suspendedAt: serverTimestamp(), suspendedBy: request.auth.uid, suspensionReason: reason, updatedAt: serverTimestamp() }, { merge: true });
  await orgRef.collection('org_details').doc('details').set({ status: 'suspended', suspendedAt: serverTimestamp(), suspendedBy: request.auth.uid, suspensionReason: reason, updatedAt: serverTimestamp() }, { merge: true });

  let disabledUsers = 0;
  if (disableUsers) {
    const usersSnap = await db.collection('users').where('orgId', '==', orgId).get();
    const batchState = { batch: db.batch(), count: 0 };
    for (const userDoc of usersSnap.docs) {
      await queueBatchUpdate(batchState, userDoc.ref, { tenantStatus: 'suspended', updatedAt: serverTimestamp() });
      await admin.auth().updateUser(userDoc.id, { disabled: true });
    }
    await commitBatchIfNeeded(batchState, true);
    disabledUsers = usersSnap.size;
  }

  await orgRef.collection('audit_logs').add({
    type: 'SUSPEND_TENANT',
    adminId: request.auth.uid,
    user: request.auth.uid,
    target: orgId,
    details: { reason, disabledUsers },
    content: `SUSPEND_TENANT: ${orgId}`,
    immutableId: `SUSPEND_TENANT_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    timestamp: serverTimestamp(),
  });
  return { ok: true, orgId, disabledUsers };
});

exports.deleteTenant = onCall(async (request) => {
  await assertPlatformOwner(request);
  const { orgId, deleteUsers = false } = request.data || {};
  if (!orgId) throw new HttpsError('invalid-argument', 'orgId is required.');
  if (orgId === DEFAULT_ORG_ID && request.data?.allowDefaultDelete !== true) {
    throw new HttpsError('failed-precondition', `Deleting ${DEFAULT_ORG_ID} requires allowDefaultDelete: true.`);
  }
  const orgRef = db.collection('organizations').doc(orgId);
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) throw new HttpsError('not-found', `Tenant ${orgId} was not found.`);

  await orgRef.collection('audit_logs').add({
    type: 'DELETE_TENANT',
    adminId: request.auth.uid,
    user: request.auth.uid,
    target: orgId,
    details: { deleteUsers },
    content: `DELETE_TENANT: ${orgId}`,
    immutableId: `DELETE_TENANT_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    timestamp: serverTimestamp(),
  });

  const deletedCollections = {};
  for (const collectionName of ['org_details', ...TENANT_COLLECTIONS]) {
    deletedCollections[collectionName] = await recursivelyDeleteCollection(orgRef.collection(collectionName));
  }
  await orgRef.delete();

  const usersSnap = await db.collection('users').where('orgId', '==', orgId).get();
  const batchState = { batch: db.batch(), count: 0 };
  for (const userDoc of usersSnap.docs) {
    if (deleteUsers) {
      await queueBatchDelete(batchState, userDoc.ref);
      await admin.auth().deleteUser(userDoc.id);
    } else {
      await queueBatchUpdate(batchState, userDoc.ref, {
        orgId: admin.firestore.FieldValue.delete(),
        role: admin.firestore.FieldValue.delete(),
        tenantStatus: 'deleted',
        updatedAt: serverTimestamp(),
      });
      const authUser = await admin.auth().getUser(userDoc.id);
      await admin.auth().setCustomUserClaims(userDoc.id, {
        ...(authUser.customClaims || {}),
        orgId: null,
        role: null,
        tenantStatus: 'deleted',
      });
    }
  }
  await commitBatchIfNeeded(batchState, true);

  return { ok: true, orgId, deletedCollections, affectedUsers: usersSnap.size };
});

exports.updateStorageUsed = onCall(async (request) => {
  await assertPlatformOwner(request);
  const { orgId = DEFAULT_ORG_ID, bytes, storageUsedBytes, deltaBytes } = request.data || {};
  const orgRef = db.collection('organizations').doc(orgId);
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) throw new HttpsError('not-found', `Tenant ${orgId} was not found.`);

  const numericDelta = deltaBytes !== undefined ? Number(deltaBytes) : undefined;
  const numericAbsolute = storageUsedBytes !== undefined ? Number(storageUsedBytes) : (bytes !== undefined ? Number(bytes) : undefined);
  if (numericDelta !== undefined && !Number.isFinite(numericDelta)) throw new HttpsError('invalid-argument', 'deltaBytes must be a finite number.');
  if (numericAbsolute !== undefined && (!Number.isFinite(numericAbsolute) || numericAbsolute < 0)) throw new HttpsError('invalid-argument', 'bytes/storageUsedBytes must be a non-negative finite number.');
  if (numericDelta === undefined && numericAbsolute === undefined) throw new HttpsError('invalid-argument', 'Provide deltaBytes, bytes, or storageUsedBytes.');

  const update = { updatedAt: serverTimestamp(), storageUpdatedBy: request.auth.uid };
  if (numericDelta !== undefined) update.storageUsedBytes = admin.firestore.FieldValue.increment(numericDelta);
  else update.storageUsedBytes = numericAbsolute;

  await orgRef.set(update, { merge: true });
  await orgRef.collection('org_details').doc('details').set(update, { merge: true });
  const updatedSnap = await orgRef.get();
  return { ok: true, orgId, storageUsedBytes: updatedSnap.data()?.storageUsedBytes || 0 };
});
