const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onObjectDeleted, onObjectFinalized } = require('firebase-functions/v2/storage');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const crypto = require('node:crypto');

admin.initializeApp();
const db = admin.firestore();

const DEFAULT_ORG_ID = 'mpgs';
const FUNCTION_RUNTIME = { maxInstances: 10 };
const ADMIN_FUNCTION_RUNTIME = { maxInstances: 5 };
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMITS = {
  default: { limit: 60, windowMs: RATE_LIMIT_WINDOW_MS },
  admin: { limit: 30, windowMs: RATE_LIMIT_WINDOW_MS },
  securePdf: { limit: 10, windowMs: RATE_LIMIT_WINDOW_MS },
};
const TENANT_COLLECTIONS = [
  'messages',
  'groups',
  'notifications',
  'reminders',
  'workspace_tags',
  'audit_logs',
];
const DEFAULT_APP_VERSION = '1.0.0';
const GLOBAL_SUPPORT_ADMIN_EMAIL = 'shivsuri1@gmail.com';
const SUPPORT_GROUP_ID = 'support';
const TENANT_UPLOAD_PREFIX = /^organizations\/([^/]+)\/uploads\//;
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

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const assertGlobalSupportDispatchAccess = async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const tokenEmail = normalizeEmail(request.auth.token?.email);
  if (tokenEmail === GLOBAL_SUPPORT_ADMIN_EMAIL) return { email: tokenEmail, isGlobalSupportAdmin: true };
  if (request.auth.token?.isPlatformOwner || request.auth.token?.platformOwner) {
    return { email: tokenEmail, isPlatformOwner: true };
  }

  const userSnap = await db.collection('users').doc(request.auth.uid).get();
  const user = userSnap.data() || {};
  const userEmail = normalizeEmail(user.email || tokenEmail);
  if (userEmail === GLOBAL_SUPPORT_ADMIN_EMAIL) return { email: userEmail, isGlobalSupportAdmin: true };
  if (user.isPlatformOwner) return { email: userEmail, isPlatformOwner: true };

  throw new HttpsError('permission-denied', 'Global support dispatch is restricted to platform owners.');
};

const withoutUndefinedFields = (record) => Object.fromEntries(
  Object.entries(record).filter(([, value]) => value !== undefined),
);

const orgIdsForUserRecord = (record = {}) => [record.orgId, record.organizationId, record.tenantId]
  .map((value) => String(value || '').trim())
  .filter(Boolean);

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
    name: details.orgName || details.name || details.displayName || 'MPGS',
    orgName: details.orgName || details.name || details.displayName || 'MPGS',
    adminName: details.adminName || '',
    adminEmail: details.adminEmail || '',
    status: details.status || 'active',
    subscriptionPackageId: packageId,
    storageUsedBytes: Number(details.storageUsedBytes || 0),
    storageLimitBytes: Number(details.storageLimitBytes || packageData.storageLimitBytes || 0),
    storageLimitOverride: details.storageLimitOverride ?? null,
    maxUsersOverride: details.maxUsersOverride ?? null,
    featureFlagsOverride: details.featureFlagsOverride || {},
    updatedAt: now,
    createdAt: details.createdAt || now,
  }, { merge: true });
  await queueBatchSet(batchState, db.collection('organizations').doc(orgId).collection('org_details').doc('details'), {
    orgId,
    name: details.orgName || details.name || details.displayName || 'MPGS',
    orgName: details.orgName || details.name || details.displayName || 'MPGS',
    adminName: details.adminName || '',
    adminEmail: details.adminEmail || '',
    status: details.status || 'active',
    subscriptionPackageId: packageId,
    storageUsedBytes: Number(details.storageUsedBytes || 0),
    storageLimitBytes: Number(details.storageLimitBytes || packageData.storageLimitBytes || 0),
    storageLimitOverride: details.storageLimitOverride ?? null,
    maxUsersOverride: details.maxUsersOverride ?? null,
    featureFlagsOverride: details.featureFlagsOverride || {},
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

const logOrgAuditEvent = async (orgId, type, adminId, target, details = {}) => {
  const payload = {
    type,
    adminId,
    user: adminId,
    target,
    details,
    content: `${type}: ${target}`,
    immutableId: `${type}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  };
  await Promise.all([
    db.collection('audit_logs').add({ ...payload, orgId }).catch(() => null),
    db.collection('organizations').doc(orgId).collection('audit_logs').add(payload).catch(() => null),
  ]);
};

const sanitizeRateLimitKey = (value) => String(value || 'global').replace(/[^a-zA-Z0-9_.:-]/g, '_').slice(0, 120);

const enforceCallableRateLimit = async (request, bucket = 'default', orgId = 'platform') => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  const config = RATE_LIMITS[bucket] || RATE_LIMITS.default;
  const uid = request.auth.uid;
  const windowStart = Math.floor(Date.now() / config.windowMs) * config.windowMs;
  const rateLimitId = `${sanitizeRateLimitKey(bucket)}_${sanitizeRateLimitKey(uid)}_${windowStart}`;
  const ref = db.collection('rate_limits').doc(rateLimitId);
  const nextCount = await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const count = snap.exists ? Number(snap.data().count || 0) : 0;
    if (count >= config.limit) return count + 1;
    transaction.set(ref, {
      bucket,
      orgId,
      uid,
      count: count + 1,
      limit: config.limit,
      windowStart: admin.firestore.Timestamp.fromMillis(windowStart),
      expiresAt: admin.firestore.Timestamp.fromMillis(windowStart + config.windowMs * 2),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return count + 1;
  });
  if (nextCount > config.limit) {
    await db.collection('organizations').doc(orgId || 'platform').collection('abuse_logs').add({
      type: 'CALLABLE_RATE_LIMIT_EXCEEDED',
      bucket,
      uid,
      count: nextCount,
      limit: config.limit,
      createdAt: serverTimestamp(),
    }).catch(() => null);
    throw new HttpsError('resource-exhausted', 'Too many requests. Please wait and try again.');
  }
};

const getCallerProfile = async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  const snap = await db.collection('users').doc(request.auth.uid).get();
  return { uid: request.auth.uid, ...(snap.data() || {}) };
};

const assertOrgAdminCallable = async (request, orgId) => {
  const cleanOrgId = String(orgId || '').trim();
  if (!cleanOrgId) throw new HttpsError('invalid-argument', 'orgId is required.');
  const caller = await getCallerProfile(request);
  const token = request.auth.token || {};
  const callerOrgId = String(token.orgId || caller.orgId || '').trim();
  const isPlatformOwner = !!(token.isPlatformOwner || token.platformOwner || caller.isPlatformOwner) || normalizeEmail(token.email || caller.email) === GLOBAL_SUPPORT_ADMIN_EMAIL;
  const isAdmin = isPlatformOwner || !!(token.admin || caller.isAdmin) || ['admin', 'owner'].includes(String(token.role || caller.role || '').toLowerCase());
  if (!isPlatformOwner && callerOrgId !== cleanOrgId) throw new HttpsError('permission-denied', 'Cross-organization admin action denied.');
  if (!isAdmin) throw new HttpsError('permission-denied', 'Organization admin access is required.');
  await enforceCallableRateLimit(request, 'admin', cleanOrgId);
  return { orgId: cleanOrgId, caller, isPlatformOwner };
};

const assertUserBelongsToOrg = async (uid, orgId) => {
  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new HttpsError('not-found', 'User not found.');
  const user = userSnap.data() || {};
  if (String(user.orgId || '') !== orgId) throw new HttpsError('permission-denied', 'Target user is outside this organization.');
  return { userRef, user };
};

const getOrgIdFromTenantUploadPath = (filePath = '') => {
  const match = String(filePath || '').match(TENANT_UPLOAD_PREFIX);
  return match?.[1] || null;
};

const updateTenantUploadUsage = async (object, direction) => {
  const filePath = object?.name || '';
  const orgId = getOrgIdFromTenantUploadPath(filePath);
  const size = Number(object?.size || 0);
  if (!orgId || !Number.isFinite(size) || size <= 0) return;

  const deltaBytes = direction === 'delete' ? -size : size;
  const update = {
    storageUsedBytes: admin.firestore.FieldValue.increment(deltaBytes),
    storageLastUpdatedAt: serverTimestamp(),
  };
  const orgRef = db.collection('organizations').doc(orgId);
  await orgRef.set(update, { merge: true });
  await orgRef.collection('org_details').doc('details').set(update, { merge: true });
};

const uniqueStrings = (values = []) => Array.from(new Set((Array.isArray(values) ? values : [])
  .map((value) => String(value || '').trim())
  .filter(Boolean)));

const scheduledSourceToOrgId = (scheduleRef) => {
  const segments = scheduleRef.path.split('/');
  return segments[0] === 'organizations' && segments[2] === 'scheduled_messages' ? segments[1] : null;
};

const formatIstMessageParts = (date = new Date()) => ({
  dateString: new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date),
  time: new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date),
});

const normalizeTaskDisplayFields = (taskData = {}, text = '') => ({
  taskTitle: taskData.title || taskData.taskTitle || text || undefined,
  taskStatus: taskData.status || undefined,
  taskPriority: taskData.priority || undefined,
  taskDeadline: taskData.deadline || undefined,
  taskAssigneeEmails: uniqueStrings(taskData.assignees || []),
  taskAssigneeNames: Array.isArray(taskData.assigneeNames) ? uniqueStrings(taskData.assigneeNames) : undefined,
  taskAssigneeCount: Array.isArray(taskData.assignees) ? taskData.assignees.length : 0,
  taskMasterReviewerEmail: taskData.masterReviewerEmail || undefined,
});

const buildScheduledMessagePayload = (scheduleData = {}, deliveredAt = new Date()) => {
  const senderEmail = scheduleData.senderEmail || '';
  if (!scheduleData.senderUid || !senderEmail || !scheduleData.groupId) {
    throw new Error('Scheduled message is missing senderUid, senderEmail, or groupId.');
  }
  const allowedUsers = uniqueStrings(scheduleData.allowedUsers || []);
  const isPrivateForward = scheduleData.isPrivateForward === true || allowedUsers.length > 0;
  const commonPayload = {
    text: scheduleData.text || '',
    senderUid: scheduleData.senderUid || '',
    senderEmail,
    senderName: scheduleData.senderName || (senderEmail ? senderEmail.split('@')[0] : undefined),
    senderAvatar: scheduleData.senderAvatar || null,
    groupId: scheduleData.groupId || '',
    groupName: scheduleData.groupName || 'Scheduled',
    groupAvatar: scheduleData.groupAvatar || null,
    timestamp: serverTimestamp(),
    ...formatIstMessageParts(deliveredAt),
    isTask: scheduleData.isTask === true,
    allowedUsers: isPrivateForward ? allowedUsers : [],
    isPrivateForward,
    seenBy: uniqueStrings(scheduleData.seenBy || (senderEmail ? [senderEmail] : [])),
    reactions: scheduleData.reactions && typeof scheduleData.reactions === 'object' && !Array.isArray(scheduleData.reactions) ? scheduleData.reactions : {},
    deliveredTo: uniqueStrings(scheduleData.deliveredTo || (senderEmail ? [senderEmail] : [])),
    scheduledMessageId: scheduleData.id || null,
  };

  if (scheduleData.isTask === true) {
    Object.assign(commonPayload, normalizeTaskDisplayFields(scheduleData.taskData || {}, scheduleData.text || ''));
    commonPayload.taskData = scheduleData.taskData || {};
    if (scheduleData.taskDeadline) commonPayload.taskDeadline = scheduleData.taskDeadline;
    if (scheduleData.taskAssignees) commonPayload.taskAssignees = scheduleData.taskAssignees;
  }

  return Object.fromEntries(Object.entries(commonPayload).filter(([, value]) => value !== undefined));
};

const lockScheduledMessage = async (scheduleRef, invocationId, nowTimestamp) => db.runTransaction(async (transaction) => {
  const snap = await transaction.get(scheduleRef);
  if (!snap.exists) return null;
  const data = snap.data() || {};
  const leaseExpiresAt = data.processingLeaseExpiresAt?.toMillis?.() || 0;
  const canProcess = data.status === 'pending' || (data.status === 'processing' && leaseExpiresAt <= nowTimestamp.toMillis());
  if (!canProcess) return null;

  transaction.update(scheduleRef, {
    status: 'processing',
    processingStartedAt: nowTimestamp,
    processingLeaseExpiresAt: admin.firestore.Timestamp.fromMillis(nowTimestamp.toMillis() + 5 * 60 * 1000),
    processedBy: invocationId,
    retryCount: admin.firestore.FieldValue.increment(data.status === 'processing' ? 1 : 0),
  });
  return { id: snap.id, ref: scheduleRef, data: { ...data, id: snap.id } };
});

const markScheduledMessageFailed = async (scheduleRef, invocationId, error) => {
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(scheduleRef);
    if (!snap.exists) return;
    const data = snap.data() || {};
    if (data.status !== 'processing' || data.processedBy !== invocationId) return;
    transaction.update(scheduleRef, {
      status: 'failed',
      failedAt: serverTimestamp(),
      lastError: String(error?.message || error || 'Unknown scheduled delivery error').slice(0, 1000),
      processingLeaseExpiresAt: admin.firestore.FieldValue.delete(),
    });
  });
};

const deliverScheduledMessage = async (lockedSchedule, invocationId) => {
  const orgId = scheduledSourceToOrgId(lockedSchedule.ref);
  if (!orgId) throw new Error(`Scheduled message ${lockedSchedule.ref.path} is not under organizations/{orgId}.`);

  const messageRef = db.collection('organizations').doc(orgId).collection('messages').doc(`scheduled_${lockedSchedule.id}`);
  const deliveredAt = new Date();
  const payload = buildScheduledMessagePayload(lockedSchedule.data, deliveredAt);

  await db.runTransaction(async (transaction) => {
    const [scheduleSnap, messageSnap] = await Promise.all([
      transaction.get(lockedSchedule.ref),
      transaction.get(messageRef),
    ]);
    if (!scheduleSnap.exists) return;
    const scheduleData = scheduleSnap.data() || {};
    if (scheduleData.status !== 'processing' || scheduleData.processedBy !== invocationId) return;

    if (!messageSnap.exists) {
      transaction.set(messageRef, payload);
    }
    transaction.update(lockedSchedule.ref, {
      status: 'sent',
      sentAt: serverTimestamp(),
      messageId: messageRef.id,
      messagePath: messageRef.path,
      processingLeaseExpiresAt: admin.firestore.FieldValue.delete(),
      lastError: admin.firestore.FieldValue.delete(),
    });
  });
};

const fetchDueScheduledMessages = async (nowTimestamp) => {
  const pendingSnap = await db.collectionGroup('scheduled_messages')
    .where('status', '==', 'pending')
    .where('scheduledAt', '<=', nowTimestamp)
    .limit(100)
    .get();
  const staleProcessingSnap = await db.collectionGroup('scheduled_messages')
    .where('status', '==', 'processing')
    .where('processingLeaseExpiresAt', '<=', nowTimestamp)
    .limit(100)
    .get();

  const byPath = new Map();
  pendingSnap.docs.concat(staleProcessingSnap.docs).forEach((docSnap) => byPath.set(docSnap.ref.path, docSnap.ref));
  return Array.from(byPath.values());
};

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

const toCreateUserHttpsError = (error) => {
  const code = error?.code;
  const message = String(error?.message || '').toLowerCase();

  if (error instanceof HttpsError) return error;

  if (code === 'auth/email-already-exists') {
    return new HttpsError('already-exists', 'A user with this email already exists.');
  }

  if (code === 'auth/invalid-email') {
    return new HttpsError('invalid-argument', 'Email address is invalid.');
  }

  const isWeakPasswordFailure = code === 'auth/weak-password'
    || message.includes('weak password')
    || message.includes('password is too weak')
    || message.includes('password must be');
  if (code === 'auth/invalid-password' || isWeakPasswordFailure) {
    return new HttpsError('invalid-argument', 'Password is invalid or too weak.');
  }

  return new HttpsError('internal', 'Failed to create user.');
};


const defaultToolPreferences = () => ({
  reply: true,
  react: true,
  edit: true,
  delete: true,
  pin: true,
  bookmark: true,
  showWatermark: true,
  soundProfile: 'classic',
});

const publicUserProfile = (uid, profile) => {
  const { createdAt, updatedAt, lastActive, lastLogin, lastLogout, ...safeProfile } = profile || {};
  return { uid, ...safeProfile };
};

const findInvitationForEmail = async (email) => {
  const rawEmail = String(email || '').trim();
  const lowerEmail = rawEmail.toLowerCase();
  if (!lowerEmail) return null;

  const seen = new Set();
  const candidates = [];
  const invitationQueries = [
    db.collection('tenantInvitations').where('emailLower', '==', lowerEmail).limit(1),
    db.collection('tenantInvitations').where('email', '==', lowerEmail).limit(1),
  ];
  if (rawEmail && rawEmail !== lowerEmail) {
    invitationQueries.push(db.collection('tenantInvitations').where('email', '==', rawEmail).limit(1));
  }

  for (const invitationQuery of invitationQueries) {
    const snap = await invitationQuery.get();
    snap.docs.forEach((docSnap) => {
      if (!seen.has(docSnap.id)) {
        seen.add(docSnap.id);
        candidates.push({ id: docSnap.id, ...docSnap.data() });
      }
    });
    if (candidates.length > 0) break;
  }

  return candidates.find((invitation) => {
    const invitationEmail = String(invitation.emailLower || invitation.email || '').trim().toLowerCase();
    const status = String(invitation.status || 'pending').toLowerCase();
    return invitationEmail === lowerEmail && !['revoked', 'rejected', 'expired', 'disabled'].includes(status);
  }) || null;
};

const setOnboardingClaims = async (uid, profile) => {
  const orgId = profile.orgId || null;
  const role = profile.role || (profile.isAdmin ? 'admin' : 'member');
  const isPlatformOwner = !!profile.isPlatformOwner;
  const existingUser = await admin.auth().getUser(uid);
  const customClaims = {
    ...(existingUser.customClaims || {}),
    role,
    isPlatformOwner,
    platformOwner: isPlatformOwner,
    admin: !!profile.isAdmin || isPlatformOwner || role === 'admin',
  };
  customClaims.orgId = orgId || null;
  await admin.auth().setCustomUserClaims(uid, customClaims);
  return customClaims;
};

exports.trackTenantUploadCreated = onObjectFinalized(async (event) => {
  try {
    await updateTenantUploadUsage(event.data, 'create');
  } catch (error) {
    logger.error('Failed to increment tenant upload usage.', {
      path: event.data?.name,
      size: event.data?.size,
      error: error?.message || error,
    });
  }
});

exports.trackTenantUploadDeleted = onObjectDeleted(async (event) => {
  try {
    await updateTenantUploadUsage(event.data, 'delete');
  } catch (error) {
    logger.error('Failed to decrement tenant upload usage.', {
      path: event.data?.name,
      size: event.data?.size,
      error: error?.message || error,
    });
  }
});

exports.resolveAuthOnboarding = onCall(async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  const uid = request.auth.uid;
  const email = String(request.auth.token?.email || '').trim();
  const lowerEmail = email.toLowerCase();
  if (!lowerEmail) throw new HttpsError('failed-precondition', 'Your sign-in provider did not include an email address.');

  let invitation = null;
  try {
    invitation = await findInvitationForEmail(email);
  } catch (error) {
    logger.error('Failed to resolve tenant invitation during auth onboarding.', { uid, email: lowerEmail, error });
    throw new HttpsError('internal', 'We could not verify your tenant invitation. Please try again or contact your workspace admin.');
  }

  const isPlatformOwnerEmail = lowerEmail === GLOBAL_SUPPORT_ADMIN_EMAIL;
  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  const existingProfile = userSnap.exists ? { uid, ...userSnap.data() } : null;
  const bootstrapRef = db.collection('platform').doc('authBootstrap');
  let isFirstUser = false;

  if (!existingProfile) {
    const bootstrapSnap = await bootstrapRef.get();
    if (bootstrapSnap.data()?.hasBootstrappedUsers !== true) {
      const firstUserProbe = await db.collection('users').limit(1).get();
      isFirstUser = firstUserProbe.empty;
    }
  }

  const invitationOrgId = invitation?.orgId || null;
  const invitationRole = invitation?.role || null;
  const requestedDisplayName = String(request.data?.displayName || '').trim();
  const requestedPhotoURL = String(request.data?.photoURL || '').trim();
  const orgId = isPlatformOwnerEmail
    ? (existingProfile?.orgId || DEFAULT_ORG_ID)
    : (existingProfile?.orgId || invitationOrgId || request.auth.token?.orgId || null);
  const role = isPlatformOwnerEmail
    ? 'admin'
    : (existingProfile?.role || invitationRole || request.auth.token?.role || (isFirstUser ? 'admin' : 'member'));
  const isAdmin = isPlatformOwnerEmail || isFirstUser || existingProfile?.isAdmin === true || invitationRole === 'admin';
  const mergedProfile = {
    ...(existingProfile || {}),
    uid,
    email: existingProfile?.email || email,
    name: existingProfile?.name || requestedDisplayName || email.split('@')[0],
    profilePicUrl: existingProfile?.profilePicUrl || requestedPhotoURL || null,
    orgId,
    role,
    isApproved: isPlatformOwnerEmail || isFirstUser || !!invitationOrgId || existingProfile?.isApproved === true,
    isAdmin,
    canCreateGroups: existingProfile?.canCreateGroups === true || isFirstUser || isPlatformOwnerEmail || !!invitationOrgId,
    isPlatformOwner: existingProfile?.isPlatformOwner === true || isPlatformOwnerEmail,
    isArchived: existingProfile?.isArchived === true ? true : false,
    toolPreferences: existingProfile?.toolPreferences || defaultToolPreferences(),
  };

  const writePayload = {
    ...mergedProfile,
    updatedAt: serverTimestamp(),
    lastActive: serverTimestamp(),
  };
  if (!existingProfile) writePayload.createdAt = serverTimestamp();

  await userRef.set(writePayload, { merge: true });
  if (!existingProfile) {
    const bootstrapPayload = {
      hasBootstrappedUsers: true,
      updatedAt: serverTimestamp(),
    };
    if (isFirstUser) {
      bootstrapPayload.firstUserUid = uid;
      bootstrapPayload.bootstrappedAt = serverTimestamp();
    }
    await bootstrapRef.set(bootstrapPayload, { merge: true });
  }

  const claims = await setOnboardingClaims(uid, mergedProfile);
  return {
    ok: true,
    profile: publicUserProfile(uid, mergedProfile),
    claims,
    onboarding: {
      invitationMatched: !!invitationOrgId,
      firstUser: isFirstUser,
      platformOwnerBypass: isPlatformOwnerEmail,
    },
  };
});

exports.createUser = onCall(ADMIN_FUNCTION_RUNTIME, async (request) => {
  await enforceCallableRateLimit(request, 'admin', String(request.data?.orgId || request.auth?.token?.orgId || DEFAULT_ORG_ID));
  await assertPermission(request, 'Users', 'create');

  const data = request.data || {};
  const callerSnap = await db.collection('users').doc(request.auth.uid).get();
  const caller = callerSnap.data() || {};
  const callerOrgId = String(request.auth.token?.orgId || caller.orgId || '').trim();
  const requestedOrgId = String(data.orgId || '').trim();
  const isCallerPlatformOwner = !!request.auth.token?.isPlatformOwner || !!caller.isPlatformOwner;
  const email = String(data.email || '').trim().toLowerCase();
  const password = String(data.password || '').trim();
  const name = String(data.name || data.displayName || '').trim();
  const orgId = requestedOrgId || callerOrgId || DEFAULT_ORG_ID;
  const isAdmin = !!data.isAdmin;
  const canCreateGroups = !!data.canCreateGroups;
  const role = isAdmin ? 'admin' : 'member';

  if (!isCallerPlatformOwner && callerOrgId && orgId !== callerOrgId) {
    throw new HttpsError('permission-denied', 'You can only create users in your organization.');
  }

  if (!email || !password || !name) {
    throw new HttpsError('invalid-argument', 'Email, Name, and Password are required.');
  }
  if (password.length < 6) {
    throw new HttpsError('invalid-argument', 'Password must be at least 6 characters.');
  }

  let userRecord;
  try {
    userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name,
      disabled: false,
      emailVerified: false,
    });

    await admin.auth().setCustomUserClaims(userRecord.uid, {
      orgId,
      role,
      admin: isAdmin,
      isPlatformOwner: false,
    });

    await db.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      name,
      orgId,
      role,
      isAdmin,
      canCreateGroups,
      isApproved: true,
      isPlatformOwner: false,
      isArchived: false,
      roles: [],
      tempPasswordSet: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
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
    });

    await logAuditEvent('USER_CREATE', request.auth.uid, userRecord.uid, { email, orgId, role });

    return { ok: true, uid: userRecord.uid };
  } catch (error) {
    if (userRecord?.uid) {
      try {
        await admin.auth().deleteUser(userRecord.uid);
      } catch (cleanupError) {
        logger.error('Failed to clean up Auth user after createUser failure', {
          uid: userRecord.uid,
          error: cleanupError?.message,
        });
      }
    }
    throw toCreateUserHttpsError(error);
  }
});

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

exports.processScheduledMessages = onSchedule({
  schedule: 'every 1 minutes',
  timeZone: 'Asia/Kolkata',
}, async (event) => {
  const nowTimestamp = admin.firestore.Timestamp.now();
  const invocationId = event.id || `processScheduledMessages_${Date.now()}`;
  const scheduleRefs = await fetchDueScheduledMessages(nowTimestamp);
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const scheduleRef of scheduleRefs) {
    const lockedSchedule = await lockScheduledMessage(scheduleRef, invocationId, nowTimestamp);
    if (!lockedSchedule) {
      skipped += 1;
      continue;
    }

    try {
      await deliverScheduledMessage(lockedSchedule, invocationId);
      sent += 1;
    } catch (error) {
      failed += 1;
      logger.error('Failed to deliver scheduled message.', {
        path: scheduleRef.path,
        error: error?.message || error,
      });
      await markScheduledMessageFailed(scheduleRef, invocationId, error);
    }
  }

  logger.info('Processed scheduled messages.', { sent, failed, skipped, scanned: scheduleRefs.length });
  return { sent, failed, skipped, scanned: scheduleRefs.length };
});

exports.retentionCleanup = onSchedule('every day 02:00', async () => {
  const policies = await db.collection('retentionPolicies').where('isActive', '==', true).get();
  for (const policyDoc of policies.docs) {
    const policy = policyDoc.data();
    const category = policy.category || 'Chat Messages';
    const threshold = admin.firestore.Timestamp.fromMillis(Date.now() - Number(policy.ttlDays || 30) * 86400000);
    const queryConfigs = [];

    if (category === 'Chat Messages' || category === 'All Messages & Task Cards') {
      queryConfigs.push({ isTask: false, archiveCollection: 'archived_messages' });
    }
    if (category === 'Task Cards' || category === 'All Messages & Task Cards') {
      queryConfigs.push({ isTask: true, archiveCollection: 'archived_tasks' });
    }
    if (queryConfigs.length === 0) continue;

    let affected = 0;
    for (const config of queryConfigs) {
      const expiredMessages = await db.collectionGroup('messages')
        .where('isTask', '==', config.isTask)
        .where('timestamp', '<', threshold)
        .limit(500)
        .get();
      if (expiredMessages.empty) continue;

      const batch = db.batch();
      expiredMessages.docs.forEach((msgDoc) => {
        if (policy.action === 'archive') {
          const archiveId = msgDoc.ref.path.replace(/[^a-zA-Z0-9_-]/g, '__');
          batch.set(db.collection(config.archiveCollection).doc(archiveId), {
            ...msgDoc.data(),
            originalPath: msgDoc.ref.path,
            lifecycleRuleId: policyDoc.id,
            archivedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
        batch.delete(msgDoc.ref);
      });
      await batch.commit();
      affected += expiredMessages.size;
    }

    await db.collection('retention_cleanup_logs').add({ ruleId: policyDoc.id, ruleName: category, affected, status: 'completed', timestamp: admin.firestore.FieldValue.serverTimestamp() });
    await logAuditEvent('RETENTION_RUN', 'scheduler', policyDoc.id, { affected, category, action: policy.action });
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
    platformOwner: !!isPlatformOwner,
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


exports.globalSupportDispatch = onCall(async (request) => {
  const caller = await assertGlobalSupportDispatchAccess(request);
  const text = String(request.data?.message || request.data?.text || '').trim();
  if (!text) throw new HttpsError('invalid-argument', 'message is required.');

  const [organizationsSnap, usersSnap] = await Promise.all([
    db.collection('organizations').get(),
    db.collection('users').get(),
  ]);

  const tenantUserEmails = new Map();
  usersSnap.docs.forEach((userDoc) => {
    const user = userDoc.data() || {};
    const email = normalizeEmail(user.email);
    if (!email) return;
    orgIdsForUserRecord(user).forEach((orgId) => {
      if (!tenantUserEmails.has(orgId)) tenantUserEmails.set(orgId, new Set());
      tenantUserEmails.get(orgId).add(email);
    });
  });

  const failures = [];
  const delivered = [];

  for (const orgSnap of organizationsSnap.docs) {
    const orgId = orgSnap.id;
    try {
      const supportGroupRef = orgSnap.ref.collection('groups').doc(SUPPORT_GROUP_ID);
      const supportGroupSnap = await supportGroupRef.get();
      const memberEmails = Array.from(tenantUserEmails.get(orgId) || []);
      const batch = db.batch();
      const groupPayload = withoutUndefinedFields({
        name: 'SUPPORT',
        admins: admin.firestore.FieldValue.arrayUnion(GLOBAL_SUPPORT_ADMIN_EMAIL),
        createdBy: supportGroupSnap.exists ? undefined : GLOBAL_SUPPORT_ADMIN_EMAIL,
        createdAt: supportGroupSnap.exists ? undefined : serverTimestamp(),
        updatedAt: serverTimestamp(),
        isArchived: false,
        isSupport: true,
        universalRead: true,
        profilePicUrl: null,
        members: memberEmails.length > 0
          ? admin.firestore.FieldValue.arrayUnion(...memberEmails)
          : (supportGroupSnap.exists ? undefined : []),
      });

      batch.set(supportGroupRef, groupPayload, { merge: true });
      batch.set(orgSnap.ref.collection('messages').doc(), {
        text,
        senderUid: 'global-dispatch',
        senderEmail: GLOBAL_SUPPORT_ADMIN_EMAIL,
        senderName: 'Developer HQ',
        groupId: SUPPORT_GROUP_ID,
        groupName: 'SUPPORT',
        timestamp: serverTimestamp(),
        isTask: false,
        isSupportBroadcast: true,
        isPrivateForward: false,
        allowedUsers: [],
        seenBy: [GLOBAL_SUPPORT_ADMIN_EMAIL],
        reactions: {},
        dispatchedByUid: request.auth.uid,
        dispatchedByEmail: caller.email || null,
      });

      await batch.commit();
      delivered.push({ orgId, memberEmailsAdded: memberEmails.length });
    } catch (error) {
      logger.error('Global support dispatch failed for tenant.', { orgId, error });
      failures.push({ orgId, message: error.message || 'Unknown tenant dispatch failure.' });
    }
  }

  return {
    ok: failures.length === 0,
    totalTenants: organizationsSnap.size,
    deliveredCount: delivered.length,
    failedCount: failures.length,
    delivered,
    failures,
  };
});

exports.onboardTenant = onCall(async (request) => {
  await assertPlatformOwner(request);
  const data = request.data || {};
  const orgName = data.orgName || data.name || data.displayName;
  const orgId = data.orgId || toSlug(orgName);
  if (!orgId) throw new HttpsError('invalid-argument', 'orgId or name is required.');
  const orgRef = db.collection('organizations').doc(orgId);
  const existing = await orgRef.get();
  if (existing.exists && data.failIfExists !== false) throw new HttpsError('already-exists', `Tenant ${orgId} already exists.`);

  const batchState = { batch: db.batch(), count: 0 };
  await seedSubscriptionPackages(batchState);
  await seedOrganizationDetails(orgId, {
    ...data,
    orgName,
    name: orgName,
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
    groupName: "Welcome",
    timestamp: serverTimestamp(),
    isTask: false,
    seenBy: adminEmail ? [adminEmail] : [],
    reactions: {},
    isPrivateForward: false,
    allowedUsers: []
  }, { merge: true });

  const supportMembers = [...new Set([adminEmail].filter(Boolean))];
  const supportGroupRef = db.collection('organizations').doc(orgId).collection('groups').doc(SUPPORT_GROUP_ID);
  await queueBatchSet(batchState, supportGroupRef, {
    name: "SUPPORT",
    members: supportMembers,
    admins: [GLOBAL_SUPPORT_ADMIN_EMAIL],
    createdBy: GLOBAL_SUPPORT_ADMIN_EMAIL,
    createdAt: serverTimestamp(),
    isArchived: false,
    isSupport: true,
    universalRead: true,
    profilePicUrl: null
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

exports.backfillPublicMessageVisibility = onCall(async (request) => {
  await assertPlatformOwner(request);
  const data = request.data || {};
  const targetOrgId = data.orgId ? String(data.orgId) : null;
  const dryRun = data.dryRun === true;
  const batchState = dryRun ? null : { batch: db.batch(), count: 0 };
  const stats = {
    dryRun,
    organizationsScanned: 0,
    messagesScanned: 0,
    messagesUpdated: 0,
    skippedPrivate: 0,
    skippedTasks: 0,
  };

  const orgDocs = targetOrgId
    ? [await db.collection('organizations').doc(targetOrgId).get()]
    : (await db.collection('organizations').get()).docs;

  for (const orgSnap of orgDocs) {
    if (!orgSnap.exists) continue;
    stats.organizationsScanned += 1;
    let lastMessageSnap = null;

    while (true) {
      let messagesQuery = orgSnap.ref
        .collection('messages')
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(400);
      if (lastMessageSnap) messagesQuery = messagesQuery.startAfter(lastMessageSnap);
      const messagesSnap = await messagesQuery.get();
      if (messagesSnap.empty) break;

      for (const messageSnap of messagesSnap.docs) {
        stats.messagesScanned += 1;
        const message = messageSnap.data() || {};
        const hasAllowedUsers = Object.prototype.hasOwnProperty.call(message, 'allowedUsers');
        const hasPrivateAllowedUsers = Array.isArray(message.allowedUsers) && message.allowedUsers.length > 0;
        const isTaskMessage = message.isTask === true || !!message.taskData;
        const isPrivateMessage = message.isPrivateForward === true || message.isPrivateMention === true || hasPrivateAllowedUsers;

        if (isTaskMessage) {
          stats.skippedTasks += 1;
          continue;
        }
        if (isPrivateMessage) {
          stats.skippedPrivate += 1;
          continue;
        }
        if (hasAllowedUsers && message.isPrivateForward === false) continue;

        stats.messagesUpdated += 1;
        if (!dryRun) {
          await queueBatchUpdate(batchState, messageSnap.ref, {
            allowedUsers: [],
            isPrivateForward: false,
          });
        }
      }

      lastMessageSnap = messagesSnap.docs[messagesSnap.docs.length - 1];
    }
  }

  if (!dryRun) await commitBatchIfNeeded(batchState, true);
  logger.info('Public message visibility backfill completed.', stats);
  return stats;
});

exports.toggleUserArchiveStatus = onCall(ADMIN_FUNCTION_RUNTIME, async (request) => {
  await enforceCallableRateLimit(request, 'admin', String(request.data?.orgId || request.auth?.token?.orgId || DEFAULT_ORG_ID));
  await assertPermission(request, 'Users', 'update');
  const { uid, isArchived } = request.data || {};
  if (!uid) throw new HttpsError('invalid-argument', 'uid is required.');

  try {
    // 1. Physically disable or enable the user in Firebase Auth
    await admin.auth().updateUser(uid, { disabled: !!isArchived });

    // 2. Update the user document in Firestore
    await db.collection('users').doc(uid).set({
      isArchived: !!isArchived,
      archivedAt: isArchived ? serverTimestamp() : null,
      archivedBy: isArchived ? request.auth.uid : null,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    // 3. Log the audit event
    await logAuditEvent(isArchived ? 'USER_ARCHIVE' : 'USER_UNARCHIVE', request.auth.uid, uid, { isArchived });

    return { ok: true, uid, isArchived: !!isArchived };
  } catch (error) {
    logger.error('Failed to toggle user archive status', { uid, error });
    throw new HttpsError('internal', error.message || 'Failed to update user status.');
  }
});


exports.health = onRequest(FUNCTION_RUNTIME, async (request, response) => {
  response.set('Cache-Control', 'no-store');
  response.status(200).json({
    ok: true,
    service: 'talk-task-functions',
    version: process.env.K_REVISION || DEFAULT_APP_VERSION,
    checkedAt: new Date().toISOString(),
  });
});

exports.adminDeleteRole = onCall(ADMIN_FUNCTION_RUNTIME, async (request) => {
  const { orgId, roleId } = request.data || {};
  const { caller } = await assertOrgAdminCallable(request, orgId);
  const cleanRoleId = String(roleId || '').trim();
  if (!cleanRoleId) throw new HttpsError('invalid-argument', 'roleId is required.');
  const roleRef = db.collection('organizations').doc(orgId).collection('roles').doc(cleanRoleId);
  const roleSnap = await roleRef.get();
  if (!roleSnap.exists) throw new HttpsError('not-found', 'Role not found.');
  const role = roleSnap.data() || {};
  if (role.system || ['Super Admin', 'Auditor', 'Department Moderator'].includes(role.name)) {
    throw new HttpsError('failed-precondition', 'System roles cannot be deleted.');
  }
  await roleRef.delete();
  await logOrgAuditEvent(orgId, 'ROLE_DELETE', caller.uid, cleanRoleId, { name: role.name });
  return { ok: true };
});

exports.adminUpdateUserAccess = onCall(ADMIN_FUNCTION_RUNTIME, async (request) => {
  const { orgId, uid, roles, isAdmin, isApproved } = request.data || {};
  const { caller } = await assertOrgAdminCallable(request, orgId);
  const cleanUid = String(uid || '').trim();
  if (!cleanUid) throw new HttpsError('invalid-argument', 'uid is required.');
  const { userRef, user } = await assertUserBelongsToOrg(cleanUid, orgId);
  const updates = { updatedAt: serverTimestamp() };
  if (Array.isArray(roles)) updates.roles = [...new Set(roles.map((role) => String(role || '').trim()).filter(Boolean))];
  if (typeof isAdmin === 'boolean') {
    updates.isAdmin = isAdmin;
    updates.role = isAdmin ? 'admin' : (user.role === 'admin' ? 'member' : (user.role || 'member'));
  }
  if (typeof isApproved === 'boolean') updates.isApproved = isApproved;
  await userRef.set(updates, { merge: true });
  if (typeof isAdmin === 'boolean') {
    const authUser = await admin.auth().getUser(cleanUid).catch(() => null);
    await admin.auth().setCustomUserClaims(cleanUid, {
      ...(authUser?.customClaims || {}),
      orgId,
      admin: isAdmin,
      role: updates.role || user.role || 'member',
      isPlatformOwner: !!user.isPlatformOwner,
      platformOwner: !!user.isPlatformOwner,
    });
  }
  await logOrgAuditEvent(orgId, 'USER_ACCESS_UPDATE', caller.uid, cleanUid, { roles: updates.roles, isAdmin, isApproved });
  return { ok: true };
});

exports.adminForceLogoutSession = onCall(ADMIN_FUNCTION_RUNTIME, async (request) => {
  const { orgId, sessionId, uid } = request.data || {};
  const { caller } = await assertOrgAdminCallable(request, orgId);
  const sessionRef = db.collection('organizations').doc(orgId).collection('sessions').doc(String(sessionId || '').trim());
  if (!sessionId) throw new HttpsError('invalid-argument', 'sessionId is required.');
  await sessionRef.delete();
  if (uid) await admin.auth().revokeRefreshTokens(String(uid)).catch(() => null);
  await logOrgAuditEvent(orgId, 'FORCE_LOGOUT', caller.uid, sessionId, { affectedUid: uid || null });
  return { ok: true };
});

exports.adminForceLogoutAll = onCall(ADMIN_FUNCTION_RUNTIME, async (request) => {
  const { orgId } = request.data || {};
  const { caller } = await assertOrgAdminCallable(request, orgId);
  const sessionsSnap = await db.collection('organizations').doc(orgId).collection('sessions').limit(500).get();
  const uids = [...new Set(sessionsSnap.docs.map((docSnap) => docSnap.data().uid).filter(Boolean))];
  await Promise.all(uids.map((uid) => admin.auth().revokeRefreshTokens(uid).catch(() => null)));
  const batch = db.batch();
  sessionsSnap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
  if (!sessionsSnap.empty) await batch.commit();
  await logOrgAuditEvent(orgId, 'FORCE_LOGOUT_ALL', caller.uid, 'all-sessions', { count: sessionsSnap.size, affectedUsers: uids });
  return { ok: true, count: sessionsSnap.size };
});

exports.adminDeleteRetentionPolicy = onCall(ADMIN_FUNCTION_RUNTIME, async (request) => {
  const { orgId, policyId } = request.data || {};
  const { caller } = await assertOrgAdminCallable(request, orgId);
  const ref = db.collection('organizations').doc(orgId).collection('retentionPolicies').doc(String(policyId || '').trim());
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Retention policy not found.');
  await ref.delete();
  await logOrgAuditEvent(orgId, 'RETENTION_POLICY_DELETE', caller.uid, policyId, snap.data() || {});
  return { ok: true };
});

exports.adminRunRetentionCleanup = onCall({ ...ADMIN_FUNCTION_RUNTIME, timeoutSeconds: 120 }, async (request) => {
  const { orgId, policyId } = request.data || {};
  const { caller } = await assertOrgAdminCallable(request, orgId);
  const orgRef = db.collection('organizations').doc(orgId);
  const policyRef = orgRef.collection('retentionPolicies').doc(String(policyId || '').trim());
  const policySnap = await policyRef.get();
  if (!policySnap.exists) throw new HttpsError('not-found', 'Retention policy not found.');
  const policy = policySnap.data() || {};
  const threshold = admin.firestore.Timestamp.fromMillis(Date.now() - Number(policy.ttlDays || 30) * 24 * 60 * 60 * 1000);
  const messagesSnap = await orgRef.collection('messages').where('timestamp', '<', threshold).limit(500).get();
  const batch = db.batch();
  let affected = 0;
  messagesSnap.docs.forEach((messageSnap) => {
    const message = messageSnap.data() || {};
    const category = policy.category || 'Chat Messages';
    const matches = category === 'All Messages & Task Cards' || (category === 'Task Cards' ? message.isTask === true : message.isTask !== true);
    if (!matches) return;
    if (policy.action === 'archive') {
      batch.set(orgRef.collection(message.isTask ? 'archived_tasks' : 'archived_messages').doc(messageSnap.id), { ...message, archivedAt: serverTimestamp(), lifecycleRuleId: policyId });
    }
    batch.delete(messageSnap.ref);
    affected += 1;
  });
  if (affected > 0) await batch.commit();
  await orgRef.collection('retention_cleanup_logs').add({ ruleId: policyId, ruleName: policy.category || 'Chat Messages', timestamp: serverTimestamp(), status: 'completed', affected });
  await logOrgAuditEvent(orgId, 'RETENTION_RUN', caller.uid, policyId, { affected, action: policy.action, ttlDays: policy.ttlDays, category: policy.category });
  return { ok: true, affected };
});

exports.adminArchiveUserPersonalData = onCall({ ...ADMIN_FUNCTION_RUNTIME, timeoutSeconds: 120 }, async (request) => {
  const { orgId, uid } = request.data || {};
  const { caller } = await assertOrgAdminCallable(request, orgId);
  const cleanUid = String(uid || '').trim();
  const { userRef, user } = await assertUserBelongsToOrg(cleanUid, orgId);
  const emailHash = crypto.createHash('sha256').update(String(user.email || cleanUid)).digest('hex');
  await userRef.set({ name: 'Deleted User', emailHash, email: '', isArchived: true, profilePicUrl: null, updatedAt: serverTimestamp() }, { merge: true });
  await admin.auth().updateUser(cleanUid, { disabled: true }).catch(() => null);
  const orgRef = db.collection('organizations').doc(orgId);
  const messagesSnap = await orgRef.collection('messages').where('senderUid', '==', cleanUid).limit(500).get();
  const sessionsSnap = await orgRef.collection('sessions').where('uid', '==', cleanUid).limit(500).get();
  const batch = db.batch();
  messagesSnap.docs.forEach((docSnap) => batch.set(docSnap.ref, { senderEmail: 'deleted-user', senderUid: 'deleted-user', text: docSnap.data().isTask ? docSnap.data().text : '[deleted]' }, { merge: true }));
  sessionsSnap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
  if (!messagesSnap.empty || !sessionsSnap.empty) await batch.commit();
  await logOrgAuditEvent(orgId, 'DSAR_DELETE', caller.uid, cleanUid, { emailHash, messages: messagesSnap.size, sessions: sessionsSnap.size });
  return { ok: true, messages: messagesSnap.size, sessions: sessionsSnap.size };
});

exports.adminDeleteTaskMessage = onCall(ADMIN_FUNCTION_RUNTIME, async (request) => {
  const { orgId, messageId } = request.data || {};
  const { caller } = await assertOrgAdminCallable(request, orgId);
  const ref = db.collection('organizations').doc(orgId).collection('messages').doc(String(messageId || '').trim());
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Task not found.');
  if (snap.data()?.isTask !== true) throw new HttpsError('failed-precondition', 'Only task messages can be deleted with this action.');
  await ref.delete();
  await logOrgAuditEvent(orgId, 'TASK_DELETE', caller.uid, messageId, { text: snap.data()?.text || '' });
  return { ok: true };
});

const getDayKey = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date);
const PDF_DAILY_LIMIT = 5;

const assertSecurePdfAccess = async (request, orgId, messageId) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  if (!orgId || !messageId) throw new HttpsError('invalid-argument', 'orgId and messageId are required.');
  const userSnap = await db.collection('users').doc(request.auth.uid).get();
  const user = userSnap.data() || {};
  const email = normalizeEmail(request.auth.token?.email || user.email);
  const messageRef = db.collection('organizations').doc(orgId).collection('messages').doc(messageId);
  const messageSnap = await messageRef.get();
  if (!messageSnap.exists) throw new HttpsError('not-found', 'Secure PDF message was not found.');
  const message = messageSnap.data() || {};
  const allowed = uniqueStrings(message.secureRecipients || []).map(normalizeEmail);
  const isSender = message.senderUid === request.auth.uid || normalizeEmail(message.senderEmail) === email;
  if (message.secureDownload !== true) throw new HttpsError('failed-precondition', 'This file is not a secure PDF.');
  if (!isSender && !allowed.includes(email)) throw new HttpsError('permission-denied', 'You are not authorized to download this secure PDF.');
  return { user, email, messageRef, message };
};

const incrementDailyCounter = async (orgId, collectionName, uid, dayKey, limit) => db.runTransaction(async (transaction) => {
  const ref = db.collection('organizations').doc(orgId).collection(collectionName).doc(`${dayKey}_${uid}`);
  const snap = await transaction.get(ref);
  const count = snap.exists ? Number(snap.data().count || 0) : 0;
  if (count >= limit) throw new HttpsError('resource-exhausted', `Daily limit of ${limit} reached.`);
  transaction.set(ref, { uid, dayKey, count: count + 1, updatedAt: serverTimestamp() }, { merge: true });
  return count + 1;
});

exports.requestPdfOtp = onCall(FUNCTION_RUNTIME, async (request) => {
  const { orgId, messageId } = request.data || {};
  await enforceCallableRateLimit(request, 'securePdf', String(orgId || 'platform'));
  const { email, message } = await assertSecurePdfAccess(request, orgId, messageId);
  const dayKey = getDayKey();
  await incrementDailyCounter(orgId, 'secure_pdf_otp_daily', request.auth.uid, dayKey, PDF_DAILY_LIMIT);
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 5 * 60 * 1000);
  await db.collection('organizations').doc(orgId).collection('secure_pdf_otps').doc(`${request.auth.uid}_${messageId}`).set({
    uid: request.auth.uid,
    email,
    messageId,
    otp,
    attempts: 0,
    expiresAt,
    createdAt: serverTimestamp(),
  });
  await db.collection('mail').add({
    to: [email],
    message: {
      subject: `Talk & Task secure PDF OTP: ${message.fileName || 'Secure PDF'}`,
      text: `Your OTP is ${otp}. It expires in 5 minutes. File: ${message.fileName || 'Secure PDF'}.`,
      html: `<p>Your secure PDF OTP is <strong>${otp}</strong>.</p><p>It expires in 5 minutes.</p><p>File: ${message.fileName || 'Secure PDF'}</p>`,
    },
    createdAt: serverTimestamp(),
  });
  return { success: true };
});

exports.verifyPdfOtpAndDownload = onCall(FUNCTION_RUNTIME, async (request) => {
  const { orgId, messageId, otp } = request.data || {};
  await enforceCallableRateLimit(request, 'securePdf', String(orgId || 'platform'));
  const { email, message } = await assertSecurePdfAccess(request, orgId, messageId);
  const otpRef = db.collection('organizations').doc(orgId).collection('secure_pdf_otps').doc(`${request.auth.uid}_${messageId}`);
  const otpSnap = await otpRef.get();
  if (!otpSnap.exists) throw new HttpsError('not-found', 'Request a new OTP.');
  const otpData = otpSnap.data() || {};
  if ((otpData.expiresAt?.toMillis?.() || 0) < Date.now()) {
    await otpRef.delete();
    throw new HttpsError('deadline-exceeded', 'OTP expired. Request a new OTP.');
  }
  if (Number(otpData.attempts || 0) >= 3) throw new HttpsError('resource-exhausted', 'Too many OTP attempts.');
  if (String(otpData.otp) !== String(otp || '').trim()) {
    await otpRef.set({ attempts: admin.firestore.FieldValue.increment(1), lastFailedAt: serverTimestamp() }, { merge: true });
    throw new HttpsError('permission-denied', 'Invalid OTP.');
  }
  const dayKey = getDayKey();
  const downloadRef = db.collection('organizations').doc(orgId).collection('userDownloads').doc(`${request.auth.uid}_${messageId}`);
  if ((await downloadRef.get()).exists) throw new HttpsError('already-exists', 'This secure PDF was already downloaded by you.');
  await incrementDailyCounter(orgId, 'secure_pdf_download_daily', request.auth.uid, dayKey, PDF_DAILY_LIMIT);
  await otpRef.delete();
  await downloadRef.set({ uid: request.auth.uid, email, messageId, downloadedAt: serverTimestamp(), fileName: message.fileName || null });
  await db.collection('organizations').doc(orgId).collection('downloadSummaries').doc(message.senderUid || 'system').collection('pending').add({
    messageId,
    fileName: message.fileName || 'Secure PDF',
    downloadedBy: email,
    downloadedAt: serverTimestamp(),
    senderUid: message.senderUid || null,
  });
  const bucket = admin.storage().bucket();
  const [downloadUrl] = await bucket.file(message.storagePath).getSignedUrl({ action: 'read', expires: Date.now() + 2 * 60 * 1000 });
  return { success: true, downloadUrl, stamped: false, note: 'Secure audit recorded; signed one-time URL issued.' };
});

exports.sendSecurePdfDownloadSummaries = onSchedule({ schedule: 'every day 15:00', timeZone: 'Asia/Kolkata' }, async () => {
  const orgs = await db.collection('organizations').get();
  for (const orgSnap of orgs.docs) {
    const summaryUsers = await orgSnap.ref.collection('downloadSummaries').listDocuments();
    for (const senderRef of summaryUsers) {
      const pendingSnap = await senderRef.collection('pending').limit(50).get();
      if (pendingSnap.empty) continue;
      const lines = pendingSnap.docs.map((docSnap) => {
        const data = docSnap.data() || {};
        return `Your file ${data.fileName} was downloaded by ${data.downloadedBy}.`;
      });
      await orgSnap.ref.collection('messages').add({
        text: lines.join('\n'),
        senderUid: 'system',
        senderEmail: 'system@talk-task.local',
        senderName: 'Talk & Task Secure PDF Bot',
        groupId: 'secure-pdf-summary',
        groupName: 'Secure PDF Summary',
        timestamp: serverTimestamp(),
        isTask: false,
        allowedUsers: [],
        isPrivateForward: false,
        seenBy: [],
        reactions: {},
      });
      await Promise.all(pendingSnap.docs.map((docSnap) => docSnap.ref.delete()));
    }
  }
});
