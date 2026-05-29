import { useState } from 'react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useAuth } from '../contexts/AuthContext';
import useWorkspaceData from '../hooks/useWorkspaceData';
import LeftSidebar from './Sidebar/LeftSidebar';
import ChatView from './Chat/ChatView';
import RightSidebar from './Sidebar/RightSidebar';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import AdminPanel from './Admin/AdminPanel';

export default function ChatApp() {
  const { workspaceId, workspaceList, switchWorkspace, activeWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { groups, members, broadcasts, loading } = useWorkspaceData();
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [showTaskBoard, setShowTaskBoard] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Loading data...</div>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* Workspace Switcher + Left Sidebar */}
      <div className="w-64 flex flex-col border-r">
        <WorkspaceSwitcher
          workspaces={workspaceList}
          activeId={workspaceId}
          onSwitch={switchWorkspace}
        />
        <LeftSidebar
          groups={groups}
          members={members}
          activeGroupId={activeGroupId}
          onSelectGroup={setActiveGroupId}
          broadcasts={broadcasts}
        />
      </div>
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        <ChatView groupId={activeGroupId} />
      </div>
      {/* Right Panel (Tasks/Kanban) */}
      <RightSidebar
        groupId={activeGroupId}
        showTaskBoard={showTaskBoard}
        toggleTaskBoard={() => setShowTaskBoard(!showTaskBoard)}
      />
      {/* Admin Button (only for workspace admins) */}
      {activeWorkspace?.admins?.includes(user?.uid) && (
        <button
          onClick={() => setShowAdmin(true)}
          className="fixed bottom-4 right-4 bg-purple-600 text-white p-2 rounded-full shadow-lg z-50"
        >
          Admin
        </button>
      )}
      {showAdmin && (
        <AdminPanel onClose={() => setShowAdmin(false)} />
      )}
    </div>
  );
}
