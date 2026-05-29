import { useEffect, useState, useCallback, useRef } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  getDocs,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../utils/firebase';
import { sanitizeInput } from '../utils/sanitize';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useAuth } from '../contexts/AuthContext';

const PAGE_SIZE = 30;

export default function useChatEngine(groupId) {
  const { workspaceId } = useWorkspace();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const lastVisibleRef = useRef(null);
  const unsubRef = useRef(null);

  useEffect(() => {
    if (!workspaceId || !groupId) return;
    if (unsubRef.current) unsubRef.current();

    const q = query(
      collection(db, 'workspaces', workspaceId, 'messages'),
      where('groupId', '==', groupId),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const msgs = [];
      snapshot.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));
      setMessages(msgs.reverse());
      if (snapshot.docs.length) {
        lastVisibleRef.current = snapshot.docs[snapshot.docs.length - 1];
      }
      setHasMore(snapshot.docs.length === PAGE_SIZE);
    });

    unsubRef.current = unsub;
    return () => unsub();
  }, [workspaceId, groupId]);

  const loadOlderMessages = useCallback(async () => {
    if (!lastVisibleRef.current || !hasMore || loadingOlder) return;
    setLoadingOlder(true);
    const q = query(
      collection(db, 'workspaces', workspaceId, 'messages'),
      where('groupId', '==', groupId),
      orderBy('createdAt', 'desc'),
      startAfter(lastVisibleRef.current),
      limit(PAGE_SIZE)
    );
    const snapshot = await getDocs(q);
    const older = [];
    snapshot.forEach(doc => older.push({ id: doc.id, ...doc.data() }));
    setMessages(prev => [...older.reverse(), ...prev]);
    if (snapshot.docs.length) {
      lastVisibleRef.current = snapshot.docs[snapshot.docs.length - 1];
    }
    setHasMore(snapshot.docs.length === PAGE_SIZE);
    setLoadingOlder(false);
  }, [workspaceId, groupId, hasMore, loadingOlder]);

  const sendMessage = async (text, attachments = []) => {
    const cleanText = sanitizeInput(text);
    if (!cleanText && attachments.length === 0) return;
    await addDoc(collection(db, 'workspaces', workspaceId, 'messages'), {
      text: cleanText,
      senderUid: user.uid,
      senderName: user.displayName,
      senderPhoto: user.photoURL,
      groupId,
      workspaceId,
      createdAt: serverTimestamp(),
      isTask: false,
      attachments,
    });
  };

  return { messages, sendMessage, loadOlderMessages, loadingOlder, hasMore };
}
