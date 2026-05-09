import { initializeApp } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup,
  setPersistence, inMemoryPersistence
} from 'firebase/auth';
import {
  getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp,
  doc, updateDoc, setDoc, getDocs, where, deleteDoc
} from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAoOsog2NP6Pf8YNSxn0rRYK4MSLEVNNZc",
  authDomain: "niltask.firebaseapp.com",
  projectId: "niltask",
  storageBucket: "niltask.firebasestorage.app",
  messagingSenderId: "868641827920",
  appId: "1:868641827920:web:70d9db79a361a76468f555"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export {
  onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup,
  setPersistence, inMemoryPersistence,
  collection, addDoc, onSnapshot, query, orderBy, serverTimestamp,
  doc, updateDoc, setDoc, getDocs, where, deleteDoc,
  ref, uploadBytesResumable, getDownloadURL
};
