import { initializeApp } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup,
  signInWithEmailAndPassword, setPersistence, inMemoryPersistence
} from 'firebase/auth';
import {
  initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, addDoc, onSnapshot, query, orderBy, serverTimestamp,
  doc, updateDoc, setDoc, getDocs, where, deleteDoc
} from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getDatabase, ref as rtdbRef, set as rtdbSet, onValue, onDisconnect, remove as rtdbRemove, serverTimestamp as rtdbServerTimestamp } from 'firebase/database';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getPerformance, trace } from 'firebase/performance';

const firebaseConfig = {
  apiKey: "AIzaSyAoOsog2NP6Pf8YNSxn0rRYK4MSLEVNNZc",
  authDomain: "niltask.firebaseapp.com",
  projectId: "niltask",
  storageBucket: "niltask.firebasestorage.app",
 databaseURL: "https://niltask-default-rtdb.asia-southeast1.firebasedatabase.app",
  messagingSenderId: "868641827920",
  appId: "1:868641827920:web:70d9db79a361a76468f555"
};

const app = initializeApp(firebaseConfig);

const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY;
const appCheckDebugToken = import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN;

if (typeof self !== 'undefined' && appCheckDebugToken) {
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = appCheckDebugToken === 'true' ? true : appCheckDebugToken;
}

export const appCheck = appCheckSiteKey && typeof window !== 'undefined'
  ? initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    })
  : null;

if (!appCheckSiteKey) {
  console.warn('Firebase App Check is not initialized because VITE_FIREBASE_APPCHECK_SITE_KEY is missing.');
}

const createFirestoreInstance = () => {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch (error) {
    console.warn('Firestore persistent local cache is unavailable; falling back to default in-memory cache.', error);
    return getFirestore(app);
  }
};

export const auth = getAuth(app);
export const db = createFirestoreInstance();
export const storage = getStorage(app);
export const realtimeDb = getDatabase(app);
const functions = getFunctions(app);
export const performance = typeof window !== 'undefined' ? getPerformance(app) : null;

export {
  onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup,
  signInWithEmailAndPassword, setPersistence, inMemoryPersistence,
  collection, addDoc, onSnapshot, query, orderBy, serverTimestamp,
  doc, updateDoc, setDoc, getDocs, where, deleteDoc,
  ref, uploadBytesResumable, getDownloadURL,
  functions, httpsCallable, trace,
  rtdbRef, rtdbSet, onValue, onDisconnect, rtdbRemove, rtdbServerTimestamp
};
