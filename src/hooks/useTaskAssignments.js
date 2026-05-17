import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';

export function useTaskAssignments(taskId) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!taskId) return;
    const q = query(collection(db, 'messages', taskId, 'assignments'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAssignments(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [taskId]);

  return { assignments, loading };
}
