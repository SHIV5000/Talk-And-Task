import { initializeApp } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup,
  signInWithEmailAndPassword, setPersistence, inMemoryPersistence
} from 'firebase/auth';
import {
  getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp,
  doc, updateDoc, setDoc, getDocs, where, deleteDoc
} from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

const firebaseConfig = {
  apiKey: "AIzaSyAoOsog2NP6Pf8YNSxn0rRYK4MSLEVNNZc",
  authDomain: "niltask.firebaseapp.com",
  projectId: "niltask",
  storageBucket: "niltask.firebasestorage.app",
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

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
const functions = getFunctions(app);

export {
  onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup,
  signInWithEmailAndPassword, setPersistence, inMemoryPersistence,
  collection, addDoc, onSnapshot, query, orderBy, serverTimestamp,
  doc, updateDoc, setDoc, getDocs, where, deleteDoc,
  ref, uploadBytesResumable, getDownloadURL,
  functions, httpsCallable
};
