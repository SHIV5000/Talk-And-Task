import { initializeApp } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, signOut, setPersistence, inMemoryPersistence,
  GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword
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

// Auth
export const auth = getAuth(app);
export {
  onAuthStateChanged, signOut, setPersistence, inMemoryPersistence,
  GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword
};

// Firestore
export const db = getFirestore(app);
export {
  collection, addDoc, onSnapshot, query, orderBy, serverTimestamp,
  doc, updateDoc, setDoc, getDocs, where, deleteDoc
};

// Storage
export const storage = getStorage(app);
export { ref, uploadBytesResumable, getDownloadURL };
