import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { useWorkspace } from '../contexts/WorkspaceContext';

export default function useWorkspaceData() {
  const { workspaceId } = useWorkspace();
  const [groups, setGroups] = useState([]);
  const [members, setMembers] = useState([]);
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) return;
    const q = query(collection(db, 'workspaces', workspaceId, 'groups'));
    const unsub = onSnapshot(q, (snap) => {
      const grps = [];
      snap.forEach(doc => grps.push({ id: doc.id, ...doc.data() }));
      setGroups(grps);
    });
    return () => unsub();
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;
    const q = query(collection(db, 'workspaces', workspaceId, 'members'));
    const unsub = onSnapshot(q, async (snap) => {
      const mems = [];
      snap.forEach(doc => mems.push({ uid: doc.id, ...doc.data() }));
      // Enrich with user data
      const enriched = await Promise.all(
        mems.map(async m => {
          const userSnap = await getDoc(doc(db, 'users', m.uid));
          return { ...m, ...(userSnap.data() || {}) };
        })
      );
      setMembers(enriched);
    });
    return () => unsub();
  }, [workspaceId]);

  useEffect(() => {
    const q = query(
      collection(db, 'broadcasts'),
      where('workspaceId', '==', workspaceId),
      where('isActive', '==', true)
    );
    const unsub = onSnapshot(q, (snap) => {
      const bcasts = [];
      snap.forEach(doc => bcasts.push({ id: doc.id, ...doc.data() }));
      setBroadcasts(bcasts);
    });
    return () => unsub();
  }, [workspaceId]);

  useEffect(() => {
    if (groups.length > 0 || members.length > 0) setLoading(false);
  }, [groups, members]);

  return { groups, members, broadcasts, loading };
}
