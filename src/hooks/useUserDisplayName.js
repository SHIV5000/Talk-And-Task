import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';

export default function useUserDisplayName(uid, fallback = '') {
  const [displayName, setDisplayName] = useState(fallback);

  useEffect(() => {
    if (!uid) {
      setDisplayName(fallback);
      return undefined;
    }
    const unsubscribe = onSnapshot(doc(db, 'users', uid), (snapshot) => {
      if (snapshot.exists()) setDisplayName(snapshot.data().name || fallback);
      else setDisplayName(fallback);
    }, () => setDisplayName(fallback));
    return () => unsubscribe();
  }, [uid, fallback]);

  return displayName;
}
