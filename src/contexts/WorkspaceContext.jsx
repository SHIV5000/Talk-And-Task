import { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { useAuth } from './AuthContext';

const WorkspaceContext = createContext();

export function WorkspaceProvider({ children }) {
  const { profile, user } = useAuth();
  const [workspaceId, setWorkspaceId] = useState(null);
  const [workspaceList, setWorkspaceList] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);

  // Load workspaces from user's profile
  useEffect(() => {
    if (profile?.workspaces) {
      const list = profile.workspaces.map(id => ({ id, name: 'Loading...' }));
      setWorkspaceList(list);
      // Fetch names
      profile.workspaces.forEach(async (wsId) => {
        const wsDoc = await getDoc(doc(db, 'workspaces', wsId));
        if (wsDoc.exists()) {
          setWorkspaceList(prev =>
            prev.map(w => (w.id === wsId ? { ...w, name: wsDoc.data().name } : w))
          );
        }
      });
    }
  }, [profile]);

  // Auto‑select first workspace
  useEffect(() => {
    if (workspaceList.length && !workspaceId) {
      setWorkspaceId(workspaceList[0].id);
    }
  }, [workspaceList, workspaceId]);

  // Fetch active workspace data
  useEffect(() => {
    if (!workspaceId) return;
    getDoc(doc(db, 'workspaces', workspaceId)).then(snap => {
      if (snap.exists()) setActiveWorkspace(snap.data());
    });
  }, [workspaceId]);

  const switchWorkspace = (wsId) => setWorkspaceId(wsId);

  return (
    <WorkspaceContext.Provider
      value={{
        workspaceId,
        activeWorkspace,
        workspaceList,
        switchWorkspace,
        userRole: activeWorkspace?.members?.[user?.uid]?.role || 'member',
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export const useWorkspace = () => useContext(WorkspaceContext);
