import React, { useState, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from './routes/router.jsx';
import { serverTimestamp, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import {
  auth, onAuthStateChanged, signOut,
  GoogleAuthProvider, signInWithPopup, setPersistence, inMemoryPersistence,
  db, collection, query, where, getDocs, setDoc, onSnapshot
} from './firebase.js';
import ChatApp from './components/ChatApp.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
// Firebase auth/data subscriptions are centralized in AuthContext to avoid duplicate SDK imports in the app shell.
import { notifyRuntimeEvent } from './utils/runtimeEventNotifier.js';
import {
  AppRouteGuard,
  PlatformOwnerGuard,
  RoleFallbackRedirect,
  RouteLoadingScreen,
  getFallbackPath,
  getOrgId,
} from './routes/ProtectedRoutes.jsx';

const deploymentInfo = {
  branch: typeof __BUILD_BRANCH_NAME__ !== 'undefined' ? __BUILD_BRANCH_NAME__ : 'unknown',
  commitHash: typeof __BUILD_COMMIT_HASH__ !== 'undefined' ? __BUILD_COMMIT_HASH__ : 'unknown',
  commitName: typeof __BUILD_COMMIT_SUBJECT__ !== 'undefined' ? __BUILD_COMMIT_SUBJECT__ : 'unknown',
  editedAt: typeof __BUILD_COMMIT_DATE__ !== 'undefined' ? __BUILD_COMMIT_DATE__ : 'unknown',
  source: typeof __BUILD_SOURCE_REPO__ !== 'undefined' ? __BUILD_SOURCE_REPO__ : 'unknown',
};

const APP_VERSION = "25.0";
const DEFAULT_ORG_ID = 'default';
const PLATFORM_OWNER_EMAILS = new Set(['shivsuri1@gmail.com']);

function FallbackScreen({ error }) {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-surface text-text-primary p-8">
      <div className="max-w-md text-center">
        <i className="fa-solid fa-triangle-exclamation text-4xl text-amber-500 mb-4"></i>
        <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
        <p className="text-sm text-text-secondary mb-4 break-all whitespace-normal max-h-40 overflow-auto">
          {error?.message || 'The application encountered an unexpected error.'}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="bg-primary text-white px-6 py-2.5 rounded-xl font-bold hover:bg-primary-hover transition-colors"
        >
          Reload App
        </button>
      </div>
    </div>
  );
}

function LoginScreen({ user, userProfile, isProfileLoading, authError, onGoogleLogin }) {
  const location = useLocation();
  const from = location.state?.from?.pathname;

  if (user) {
    if (isProfileLoading) return <RouteLoadingScreen message="Restoring session..." />;
    return <Navigate to={from && from !== '/login' ? from : getFallbackPath(userProfile)} replace />;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-surface p-4 relative app-entrance">
      <div className="absolute top-0 left-0 w-full h-[40vh] bg-primary z-0"></div>
      <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl p-8 z-10">
        <div className="flex justify-center mb-8 mt-2">
          <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary-hover rounded-2xl flex items-center justify-center text-white text-3xl shadow-inner border-2 border-white ring-1 ring-gray-200">
            <i className="fa-solid fa-list-check"></i>
          </div>
        </div>
        <h1 className="text-2xl font-normal text-center text-text-primary mb-2">Talk & Task</h1>
        <p className="text-xs text-text-secondary text-center mb-8 font-medium">Enterprise Coordination Portal</p>
        {authError && <div className="bg-red-50 text-red-600 p-3 rounded mb-6 text-sm font-semibold border border-red-100 text-center">{authError}</div>}
        <button onClick={onGoogleLogin} className="w-full bg-white border border-primary text-primary py-3.5 rounded shadow-sm hover:bg-primary-light font-semibold text-sm transition-all flex items-center justify-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20px" height="20px"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/></svg>
          Sign in with Google
        </button>
        <p className="text-[11px] text-slate-400 text-center mt-4 font-medium">Ver. {APP_VERSION}</p>
      </div>
    </div>
  );
}

function DeveloperConsole({ user, userProfile, org, onLogout }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-indigo-300">Developer HQ</p>
            <h1 className="text-3xl font-black mt-2">Talk & Task Developer Console</h1>
            <p className="text-sm text-slate-400 mt-2">Platform-owner workspace for operational diagnostics and launch controls.</p>
          </div>
          <button onClick={onLogout} className="bg-white text-slate-900 px-4 py-2 rounded-xl text-sm font-black hover:bg-slate-100">
            Sign out
          </button>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-3xl bg-white/10 border border-white/10 p-5">
            <p className="text-xs text-slate-400 uppercase font-black tracking-wider">Owner</p>
            <p className="font-bold mt-2 break-all">{userProfile?.name || user?.displayName || user?.email}</p>
            <p className="text-xs text-slate-500 mt-1 break-all">{user?.email}</p>
          </div>
          <div className="rounded-3xl bg-white/10 border border-white/10 p-5">
            <p className="text-xs text-slate-400 uppercase font-black tracking-wider">Organization</p>
            <p className="font-bold mt-2">{org?.name || org?.orgName || getOrgId(userProfile) || 'No org selected'}</p>
            <p className="text-xs text-slate-500 mt-1">Status: {org?.status || org?.subscriptionStatus || userProfile?.orgStatus || 'unknown'}</p>
          </div>
          <div className="rounded-3xl bg-white/10 border border-white/10 p-5">
            <p className="text-xs text-slate-400 uppercase font-black tracking-wider">Build</p>
            <p className="font-bold mt-2">{deploymentInfo.branch}</p>
            <p className="text-xs text-slate-500 mt-1 break-all">{deploymentInfo.commitHash}</p>
          </div>
        </section>

        <section className="rounded-3xl bg-indigo-500/10 border border-indigo-300/20 p-6">
          <h2 className="text-xl font-black mb-3">Console modules</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-300">
            {[
              ['Routing', 'Validate /login, /app/*, and /developer-hq/* entry points.'],
              ['Access', 'Confirm AppRouteGuard and PlatformOwnerGuard decisions.'],
              ['Runtime', 'Review current branch, commit, and runtime event telemetry.'],
              ['Workspace', 'Inspect organization linkage and active/trial eligibility.'],
            ].map(([title, text]) => (
              <div key={title} className="rounded-2xl bg-slate-900/70 border border-white/10 p-4">
                <p className="font-black text-white">{title}</p>
                <p className="text-slate-400 mt-1">{text}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState('');
  const [crash, setCrash] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [profileChecked, setProfileChecked] = useState(false);
  const [org, setOrg] = useState(null);
  const [orgChecked, setOrgChecked] = useState(false);

  useEffect(() => {
    notifyRuntimeEvent('app-run', {
      status: 'RUN_STARTED',
      note: 'App boot sequence started. If failures happen later, compare with latest RUN_OK event.',
      branch: deploymentInfo.branch,
      commitHash: deploymentInfo.commitHash,
      commitName: deploymentInfo.commitName,
      editedAt: deploymentInfo.editedAt,
      source: deploymentInfo.source,
    }).catch(() => {});

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setUserProfile(null);
      setOrg(null);
      setProfileChecked(!currentUser);
      setOrgChecked(!currentUser);
      setTimeout(() => setAuthChecked(true), 300);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user?.uid) return undefined;

    setProfileChecked(false);
    const unsubscribe = onSnapshot(
      doc(db, 'users', user.uid),
      (snapshot) => {
        setUserProfile(snapshot.exists() ? { uid: user.uid, ...snapshot.data() } : null);
        setProfileChecked(true);
      },
      () => {
        setUserProfile(null);
        setProfileChecked(true);
      }
    );

    return unsubscribe;
  }, [user?.uid]);

  useEffect(() => {
    if (!user) return undefined;

    const orgId = getOrgId(userProfile);
    if (!profileChecked) return undefined;

    if (!orgId) {
      setOrg(null);
      setOrgChecked(true);
      return undefined;
    }

    setOrgChecked(false);
    const unsubscribe = onSnapshot(
      doc(db, 'organizations', orgId),
      (snapshot) => {
        setOrg(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
        setOrgChecked(true);
      },
      () => {
        setOrg(null);
        setOrgChecked(true);
      }
    );

    return unsubscribe;
  }, [user, userProfile, profileChecked]);

  useEffect(() => {
    if (!authChecked) return;

    notifyRuntimeEvent('app-run-ok', {
      status: 'RUN_OK',
      note: user
        ? 'App initialized successfully with active session. Good rollback baseline.'
        : 'App initialized successfully and waiting for login. Good rollback baseline.',
      branch: deploymentInfo.branch,
      commitHash: deploymentInfo.commitHash,
      commitName: deploymentInfo.commitName,
      editedAt: deploymentInfo.editedAt,
      source: deploymentInfo.source,
      userEmail: user?.email || 'N/A',
    }).catch(() => {});
  }, [authChecked, user]);

  const handleGoogleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    if ("Notification" in window && Notification.permission !== "granted")
      Notification.requestPermission();

    try {
      await setPersistence(auth, inMemoryPersistence);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const loggedInUser = result.user;

      const usersSnap = await getDocs(query(collection(db, "users"), where("uid", "==", loggedInUser.uid)));
      const normalizedEmail = (loggedInUser.email || '').toLowerCase();
      const isPlatformOwner = PLATFORM_OWNER_EMAILS.has(normalizedEmail);

      if (usersSnap.empty) {
        const allUsersSnap = await getDocs(collection(db, "users"));
        const isFirstUser = allUsersSnap.empty;
        await setDoc(doc(db, "users", loggedInUser.uid), {
          uid: loggedInUser.uid,
          email: loggedInUser.email,
          name: loggedInUser.displayName || normalizedEmail.split('@')[0],
          orgId: DEFAULT_ORG_ID,
          orgStatus: 'active',
          isPlatformOwner: isFirstUser || isPlatformOwner,
          isApproved: isFirstUser || isPlatformOwner,
          isAdmin: isFirstUser || isPlatformOwner,
          canCreateGroups: isFirstUser || isPlatformOwner,
          profilePicUrl: loggedInUser.photoURL || null,
          toolPreferences: { reply: true, react: true, edit: true, delete: true, pin: true, bookmark: true, showWatermark: true, soundProfile: 'classic' },
          lastActive: serverTimestamp()
        });
      } else if (isPlatformOwner) {
        await setDoc(doc(db, "users", loggedInUser.uid), {
          orgId: DEFAULT_ORG_ID,
          orgStatus: 'active',
          isPlatformOwner: true,
          isApproved: true,
          isAdmin: true,
          canCreateGroups: true
        }, { merge: true });
      }

      await setDoc(doc(db, 'organizations', DEFAULT_ORG_ID), {
        name: 'Default Workspace',
        status: 'active',
        updatedAt: serverTimestamp(),
      }, { merge: true }).catch(() => {});

      await updateDoc(doc(db, "users", loggedInUser.uid), { lastLogin: serverTimestamp() }).catch(() => {});

      await notifyRuntimeEvent('user-login', {
        status: 'LOGIN_OK',
        note: 'User authenticated successfully. Safe checkpoint for rollback mapping.',
        userName: loggedInUser.displayName || normalizedEmail.split('@')[0] || 'unknown',
        userEmail: loggedInUser.email || 'unknown',
        branch: deploymentInfo.branch,
        commitHash: deploymentInfo.commitHash,
        commitName: deploymentInfo.commitName,
        editedAt: deploymentInfo.editedAt,
        source: deploymentInfo.source,
      }).catch(() => {});

    } catch (err) {
      setAuthError("Google Sign-In Cancelled or Failed.");
    }
  };

  const handleLogout = async () => {
    try {
      if (user) {
        await updateDoc(doc(db, "users", user.uid), { lastLogout: serverTimestamp() }).catch(() => {});
      }
    } catch (e) {}
    await signOut(auth);
  };

  if (!authChecked) {
    return <RouteLoadingScreen message="Initializing Enterprise Portal..." />;
  }

  if (crash) {
    return <FallbackScreen error={crash} />;
  }

  const isProfileLoading = !!user && (!profileChecked || !orgChecked);

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          <Route
            path="/login"
            element={
              <LoginScreen
                user={user}
                userProfile={userProfile}
                isProfileLoading={isProfileLoading}
                authError={authError}
                onGoogleLogin={handleGoogleLogin}
              />
            }
          />
          <Route
            path="/app/*"
            element={
              <AppRouteGuard user={user} userProfile={userProfile} org={org} isLoading={isProfileLoading}>
                <SafeChatApp user={user} onLogout={handleLogout} onCrash={setCrash} />
              </AppRouteGuard>
            }
          />
          <Route
            path="/developer-hq/*"
            element={
              <PlatformOwnerGuard user={user} userProfile={userProfile} isLoading={isProfileLoading}>
                <DeveloperConsole user={user} userProfile={userProfile} org={org} onLogout={handleLogout} />
              </PlatformOwnerGuard>
            }
          />
          <Route path="*" element={<RoleFallbackRedirect user={user} userProfile={userProfile} isLoading={isProfileLoading} />} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

// Thin wrapper that catches synchronous errors and passes them to the fallback screen.
function SafeChatApp({ user, onLogout, onCrash }) {
  try {
    return <ChatApp user={user} onLogout={onLogout} />;
  } catch (error) {
    onCrash(error);
    return null;
  }
}
