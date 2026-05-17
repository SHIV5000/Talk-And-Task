import { useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';

export function useEscalationAlerts(currentUser, onAlert) {
  useEffect(() => {
    if (!currentUser) return;

    const recent = new Date(Date.now() - 120000); // last 2 minutes
    const q = query(
      collection(db, 'escalationLogs'),
      where('assigneeId', '==', currentUser.uid),
      where('timestamp', '>=', Timestamp.fromDate(recent)),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          if (onAlert) onAlert(data);
        }
      });
    });

    return () => unsubscribe();
  }, [currentUser, onAlert]);
}
