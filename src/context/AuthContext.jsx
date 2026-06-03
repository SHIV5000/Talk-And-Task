import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getDoc } from 'firebase/firestore';
import {
  auth,
  db,
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  setPersistence,
  inMemoryPersistence,
  serverTimestamp,
  doc,
  updateDoc,
  setDoc,
  collection,
  getDocs,
} from '../firebase.js';
import { notifyRuntimeEvent } from '../utils/runtimeEventNotifier.js';

const DEFAULT_APP_VERSION = '25.0';
const PLATFORM_OWNER_EMAIL = 'shivsuri1@gmail.com';

const defaultFeatureFlags = {};

const AuthContext = createContext(null);

function getBuildDeploymentInfo() {
  return {
    branch: typeof __BUILD_BRANCH_NAME__ !== 'undefined' ? __BUILD_BRANCH_NAME__ : 'unknown',
    commitHash: typeof __BUILD_COMMIT_HASH__ !== 'undefined' ? __BUILD_COMMIT_HASH__ : 'unknown',
    commitName: typeof __BUILD_COMMIT_SUBJECT__ !== 'undefined' ? __BUILD_COMMIT_SUBJECT__ : 'unknown',
    editedAt: typeof __BUILD_COMMIT_DATE__ !== 'undefined' ? __BUILD_COMMIT_DATE__ : 'unknown',
    source: typeof __BUILD_SOURCE_REPO__ !== 'undefined' ? __BUILD_SOURCE_REPO__ : 'unknown',
  };
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mergeFeatureFlags(packageData, orgData, userData) {
  return {
    ...defaultFeatureFlags,
    ...(packageData?.featureFlags || {}),
    ...(orgData?.featureFlagsOverride || {}),
    ...(userData?.featureFlagsOverride || {}),
  };
}

function resolvePackageId(orgData, userData) {
  return (
    orgData?.packageId ||
    orgData?.subscriptionPackageId ||
    orgData?.subscription?.packageId ||
    userData?.packageId ||
    userData?.subscriptionPackageId ||
    null
  );
}

async function readOrgDetails(resolvedOrgId) {
  if (!resolvedOrgId) return null;

  const orgDocSnap = await getDoc(doc(db, 'organizations', resolvedOrgId)).catch(() => null);
  const orgBase = orgDocSnap?.exists() ? { id: orgDocSnap.id, ...orgDocSnap.data() } : null;

  const detailsSnap = await getDocs(collection(db, 'organizations', resolvedOrgId, 'org_details')).catch(() => null);
  const detailsDocs = detailsSnap?.docs || [];
  const preferredDetailsDoc =
    detailsDocs.find((detailDoc) => ['org_details', 'details', 'default'].includes(detailDoc.id)) ||
    detailsDocs[0];
  const nestedDetails = preferredDetailsDoc ? { id: preferredDetailsDoc.id, ...preferredDetailsDoc.data() } : null;

  return orgBase || nestedDetails ? { ...(orgBase || {}), ...(nestedDetails || {}) } : null;
}

async function readAppVersion() {
  const configSnap = await getDoc(doc(db, 'platform', 'config')).catch(() => null);
  if (!configSnap?.exists()) return DEFAULT_APP_VERSION;
  return configSnap.data()?.appVersion || DEFAULT_APP_VERSION;
}

async function ensureUserProfile(loggedInUser, claims = {}) {
  const userRef = doc(db, 'users', loggedInUser.uid);
  const userSnap = await getDoc(userRef);
  const lowerEmail = (loggedInUser.email || '').toLowerCase();
  const isPlatformOwnerEmail = lowerEmail === PLATFORM_OWNER_EMAIL;

  if (!userSnap.exists()) {
    const allUsersSnap = await getDocs(collection(db, 'users'));
    const isFirstUser = allUsersSnap.empty;
    const newProfile = {
      uid: loggedInUser.uid,
      email: loggedInUser.email,
      name: loggedInUser.displayName || (loggedInUser.email || '').split('@')[0],
      isApproved: isFirstUser || isPlatformOwnerEmail,
      isAdmin: isFirstUser || isPlatformOwnerEmail,
      canCreateGroups: isFirstUser || isPlatformOwnerEmail,
      isPlatformOwner: !!claims.isPlatformOwner || !!claims.platformOwner || isPlatformOwnerEmail,
      profilePicUrl: loggedInUser.photoURL || null,
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
      lastActive: serverTimestamp(),
    };
    await setDoc(userRef, newProfile);
    return newProfile;
  }

  const existingProfile = { id: userSnap.id, ...userSnap.data() };
  if (isPlatformOwnerEmail) {
    const ownerPatch = {
      isApproved: true,
      isAdmin: true,
      canCreateGroups: true,
      isPlatformOwner: true,
    };
    await setDoc(userRef, ownerPatch, { merge: true });
    return { ...existingProfile, ...ownerPatch };
  }

  return existingProfile;
}

function resolveSessionClaims(claims, profile) {
  const resolvedOrgId = claims.orgId || profile?.orgId || profile?.organizationId || null;
  const resolvedRole = claims.role || profile?.role || profile?.roles?.[0] || (profile?.isAdmin ? 'admin' : 'member');
  const resolvedIsPlatformOwner = !!(
    claims.isPlatformOwner ||
    claims.platformOwner ||
    claims.platform_owner ||
    profile?.isPlatformOwner ||
    (profile?.email || '').toLowerCase() === PLATFORM_OWNER_EMAIL
  );

  return { resolvedOrgId, resolvedRole, resolvedIsPlatformOwner };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [orgId, setOrgId] = useState(null);
  const [role, setRole] = useState(null);
  const [isPlatformOwner, setIsPlatformOwner] = useState(false);
  const [orgDetails, setOrgDetails] = useState(null);
  const [subscriptionPackage, setSubscriptionPackage] = useState(null);
  const [featureFlags, setFeatureFlags] = useState(defaultFeatureFlags);
  const [appVersion, setAppVersion] = useState(DEFAULT_APP_VERSION);
  const [storageLimitMB, setStorageLimitMB] = useState(0);
  const [storageUsedMB, setStorageUsedMB] = useState(0);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState('');

  const clearSession = useCallback(() => {
    setUser(null);
    setUserProfile(null);
    setOrgId(null);
    setRole(null);
    setIsPlatformOwner(false);
    setOrgDetails(null);
    setSubscriptionPackage(null);
    setFeatureFlags(defaultFeatureFlags);
    setStorageLimitMB(0);
    setStorageUsedMB(0);
  }, []);

  const hydrateSession = useCallback(async (firebaseUser) => {
    if (!firebaseUser) {
      clearSession();
      return null;
    }

    const idTokenResult = await firebaseUser.getIdTokenResult();
    const claims = idTokenResult.claims || {};

    const profile = await ensureUserProfile(firebaseUser, claims);
    const { resolvedOrgId, resolvedRole, resolvedIsPlatformOwner } = resolveSessionClaims(claims, profile);

    const details = await readOrgDetails(resolvedOrgId);
    const packageId = resolvePackageId(details, profile);
    const packageSnap = packageId ? await getDoc(doc(db, 'subscriptionPackages', packageId)).catch(() => null) : null;
    const packageData = packageSnap?.exists() ? { id: packageSnap.id, ...packageSnap.data() } : null;
    const resolvedFeatureFlags = mergeFeatureFlags(packageData, details, profile);
    const resolvedAppVersion = await readAppVersion();

    await updateDoc(doc(db, 'users', firebaseUser.uid), { lastLogin: serverTimestamp() }).catch(() => {});

    setUser(firebaseUser);
    setUserProfile(profile);
    setOrgId(resolvedOrgId);
    setRole(resolvedRole);
    setIsPlatformOwner(resolvedIsPlatformOwner);
    setOrgDetails(details);
    setSubscriptionPackage(packageData);
    setFeatureFlags(resolvedFeatureFlags);
    setAppVersion(resolvedAppVersion);
    setStorageLimitMB(normalizeNumber(details?.storageLimitMB ?? packageData?.storageLimitMB, 0));
    setStorageUsedMB(normalizeNumber(details?.storageUsedMB ?? profile?.storageUsedMB, 0));

    return { firebaseUser, profile, resolvedOrgId, resolvedRole, resolvedIsPlatformOwner };
  }, [clearSession]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setAuthError('');
      try {
        await hydrateSession(currentUser);
      } catch (error) {
        console.error('Failed to hydrate auth session:', error);
        clearSession();
        setAuthError('Failed to load your session. Please sign in again.');
      } finally {
        setTimeout(() => setAuthChecked(true), 300);
      }
    });

    return unsubscribe;
  }, [clearSession, hydrateSession]);

  const login = useCallback(async (event) => {
    event?.preventDefault?.();
    setAuthError('');

    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }

    try {
      await setPersistence(auth, inMemoryPersistence);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const loggedInUser = result.user;
      await hydrateSession(loggedInUser);

      const deploymentInfo = getBuildDeploymentInfo();

      await notifyRuntimeEvent('user-login', {
        status: 'LOGIN_OK',
        note: 'User authenticated successfully. Safe checkpoint for rollback mapping.',
        userName: loggedInUser.displayName || (loggedInUser.email || '').split('@')[0] || 'unknown',
        userEmail: loggedInUser.email || 'unknown',
        branch: deploymentInfo.branch,
        commitHash: deploymentInfo.commitHash,
        commitName: deploymentInfo.commitName,
        editedAt: deploymentInfo.editedAt,
        source: deploymentInfo.source,
      }).catch(() => {});
    } catch (err) {
      setAuthError('Google Sign-In Cancelled or Failed.');
    }
  }, [hydrateSession]);

  const logout = useCallback(async () => {
    try {
      if (auth.currentUser) {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), { lastLogout: serverTimestamp() }).catch(() => {});
      }
    } catch (e) {}

    await signOut(auth);
    clearSession();
  }, [clearSession]);

  const contextValue = useMemo(() => ({
    user,
    userProfile,
    orgId,
    role,
    isPlatformOwner,
    orgDetails,
    subscriptionPackage,
    featureFlags,
    appVersion,
    storageLimitMB,
    storageUsedMB,
    login,
    logout,
    authChecked,
    authError,
  }), [
    user,
    userProfile,
    orgId,
    role,
    isPlatformOwner,
    orgDetails,
    subscriptionPackage,
    featureFlags,
    appVersion,
    storageLimitMB,
    storageUsedMB,
    login,
    logout,
    authChecked,
    authError,
  ]);

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
