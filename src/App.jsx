import React, { useState, useEffect } from 'react';
import { serverTimestamp, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import {
  auth, onAuthStateChanged, signOut,
  GoogleAuthProvider, signInWithPopup, setPersistence, inMemoryPersistence,
  db, collection, query, where, getDocs, setDoc
} from './firebase.js';
import ChatApp from './components/ChatApp.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { notifyRuntimeEvent } from './utils/runtimeEventNotifier.js';

const deploymentInfo = {
  branch: typeof __BUILD_BRANCH_NAME__ !== 'undefined' ? __BUILD_BRANCH_NAME__ : 'unknown',
  commitHash: typeof __BUILD_COMMIT_HASH__ !== 'undefined' ? __BUILD_COMMIT_HASH__ : 'unknown',
  commitName: typeof __BUILD_COMMIT_SUBJECT__ !== 'undefined' ? __BUILD_COMMIT_SUBJECT__ : 'unknown',
  editedAt: typeof __BUILD_COMMIT_DATE__ !== 'undefined' ? __BUILD_COMMIT_DATE__ : 'unknown',
  source: typeof __BUILD_SOURCE_REPO__ !== 'undefined' ? __BUILD_SOURCE_REPO__ : 'unknown',
};

const APP_VERSION = "9.0";

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

export default function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState('');
  const [crash, setCrash] = useState(null);
  const [chatAppReady, setChatAppReady] = useState(false);
  const localSessionId = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `sess_${Date.now()}`;

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
      setTimeout(() => setAuthChecked(true), 300);
    });
    return unsubscribe;
  }, []);

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

      const sessionsRef = collection(db, "user_sessions");
      const activeSessionsSnap = await getDocs(query(sessionsRef, where("uid", "==", loggedInUser.uid), where("status", "==", "active")));
      const activeSessions = activeSessionsSnap.docs.filter(d => d.id !== localSessionId);
      if (activeSessions.length > 0) {
        const kill = window.confirm(`You already have ${activeSessions.length} active session(s). Click OK to kill old session(s) and continue, or Cancel to abort this login.`);
        if (!kill) {
          await updateDoc(doc(db, "user_sessions", localSessionId), { status: "ended", endedAt: serverTimestamp() }).catch(() => {});
    await signOut(auth);
          return;
        }
        for (const s of activeSessions) {
          await updateDoc(doc(db, "user_sessions", s.id), { status: "killed", endedAt: serverTimestamp() }).catch(() => {});
        }
      }

      const usersSnap = await getDocs(query(collection(db, "users"), where("uid", "==", loggedInUser.uid)));
      const isMaster = (loggedInUser.email || '').toLowerCase() === 'shivsuri1@gmail.com';

      if (usersSnap.empty) {
        const allUsersSnap = await getDocs(collection(db, "users"));
        const isFirstUser = allUsersSnap.empty;
        await setDoc(doc(db, "users", loggedInUser.uid), {
          uid: loggedInUser.uid,
          email: loggedInUser.email,
          name: (loggedInUser.email || '').split('@')[0],
          isApproved: isFirstUser || isMaster,
          isAdmin: isFirstUser || isMaster,
          canCreateGroups: isFirstUser || isMaster,
          profilePicUrl: loggedInUser.photoURL || null,
          toolPreferences: { reply: true, react: true, edit: true, delete: true, pin: true, bookmark: true, showWatermark: true, soundProfile: 'classic' },
          lastActive: serverTimestamp()
        });
      } else if (isMaster) {
        await setDoc(doc(db, "users", loggedInUser.uid), {
          isApproved: true, isAdmin: true, canCreateGroups: true
        }, { merge: true });
      }

      await updateDoc(doc(db, "users", loggedInUser.uid), { lastLogin: serverTimestamp() }).catch(() => {});

      await setDoc(doc(db, "user_sessions", localSessionId), { uid: loggedInUser.uid, email: loggedInUser.email, status: "active", startedAt: serverTimestamp(), lastSeenAt: serverTimestamp(), appVersion: APP_VERSION }, { merge: true }).catch(() => {});

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
      setAuthError("Google Sign-In Cancelled or Failed.");
    }
  };

  const handleLogout = async () => {
    try {
      if (user) {
        await updateDoc(doc(db, "users", user.uid), { lastLogout: serverTimestamp() }).catch(() => {});
      }
    } catch (e) {}
    await updateDoc(doc(db, "user_sessions", localSessionId), { status: "ended", endedAt: serverTimestamp() }).catch(() => {});
    await signOut(auth);
  };

  if (!authChecked) {
    return (
      <>
        <div className="flex flex-col justify-center items-center h-screen bg-surface text-primary">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <span className="font-bold tracking-widest uppercase text-sm">Initializing Enterprise Portal...</span>
        </div>
      </>
    );
  }

  if (!user) {
    return (
      <>
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
          <button onClick={handleGoogleLogin} className="w-full bg-white border border-primary text-primary py-3.5 rounded shadow-sm hover:bg-primary-light font-semibold text-sm transition-all flex items-center justify-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20px" height="20px"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/></svg>
            Sign in with Google
          </button>
          <p className="text-[11px] text-slate-400 text-center mt-4 font-medium">Version {APP_VERSION}</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <ErrorBoundary>
        <SafeChatApp user={user} onLogout={handleLogout} onCrash={setCrash} />
      </ErrorBoundary>
    </>
  );
}

// Thin wrapper that catches synchronous errors and passes them to the fallback-TEST
function SafeChatApp({ user, onLogout, onCrash }) {
  try {
    // ChatApp renders everything, but if it throws, we catch it here
    return <ChatApp user={user} onLogout={onLogout} />;
  } catch (error) {
    // Immediately show the error
    onCrash(error);
    return null;
  }
}
