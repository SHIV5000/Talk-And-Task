import React, { useState } from 'react';
import MemoizedAvatar from '../Common/MemoizedAvatar.jsx';

export default function LeftSidebar({
  user,
  currentUserData,
  myGroups,
  dmUsers,
  activeGroup,
  setActiveGroup,
  setShowRightSidebar,
  setMobileSidebarOpen,
  getUnreadInfoForUser,
  messages,
  onLogout,
  setActiveModal,
  setGroupForm,
  setEditingGroup,
  sidebarSearch,
  setSidebarSearch,
  mobileSidebarOpen,
  isVipAdmin,
  setViewMode,
  sidebarWidth,
}) {
  const [showSearch, setShowSearch] = useState(false);

  return (
    <div className="relative z-20 h-full">
      {/* CSS injected to guarantee scrollbars are visible in Chrome/Edge/Safari */}
      <style>{`
        .custom-sidebar-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .custom-sidebar-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-sidebar-scroll::-webkit-scrollbar-thumb {
          background-color: rgba(255, 255, 255, 0.25);
          border-radius: 10px;
        }
        .custom-sidebar-scroll::-webkit-scrollbar-thumb:hover {
          background-color: rgba(255, 255, 255, 0.4);
        }
      `}</style>

      {mobileSidebarOpen && (
        <div
          className="mobile-sidebar-overlay md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      
      <div
        className={`${
          mobileSidebarOpen
            ? 'mobile-sidebar-panel open flex'
            : 'hidden md:flex'
        } w-[30%] min-w-[300px] max-w-[400px] bg-slate-950 text-white border-r border-slate-800 flex-col shrink-0 shadow-none h-full`}
        style={{ width: mobileSidebarOpen ? undefined : `${sidebarWidth || 320}px` }}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-slate-800 safe-top px-3 py-2">
          <div className="bg-transparent px-2 py-2 border-l-2 border-indigo-400">
            <div className="space-y-2.5">
            <div className="grid grid-cols-4 items-center gap-3">
              <div className="flex items-center justify-center shrink-0">
                <MemoizedAvatar
                  uid={user.uid}
                  url={currentUserData?.profilePicUrl}
                  name={currentUserData?.name || user.email.split('@')[0]}
                  sizeClass="w-10 h-10"
                  extraClasses="cursor-pointer hover:opacity-90 transition-opacity"
                  imageLoading="eager"
                />
              </div>
                <button
                  onClick={() => setShowSearch(prev => !prev)}
                  className="text-white/80 hover:text-white hover:bg-white/10 w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all"
                  title="Search groups & people"
                >
                  <i className="fa-solid fa-search"></i>
                </button>
                
                <button
                  onClick={() => setActiveModal('edit_profile')}
                  className="text-white/80 hover:text-white hover:bg-white/10 w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all"
                >
                  <i className="fa-solid fa-gear"></i>
                </button>
                <button
                  onClick={onLogout}
                  className="text-white/80 hover:text-white hover:bg-rose-500/20 w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all"
                >
                  <i className="fa-solid fa-power-off"></i>
                </button>
            </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className={`border-b border-slate-800 shrink-0 overflow-hidden transition-all duration-300 ease-out ${showSearch ? 'max-h-24 opacity-100 p-3' : 'max-h-0 opacity-0 px-3 py-0'}`}>
          <div className="bg-slate-900 border border-slate-700 rounded-md flex items-center px-3 py-1 focus-within:border-indigo-400 transition-all">
            <i className="fa-solid fa-search text-sm mr-2 opacity-70"></i>
            <input
              type="text"
              placeholder="Search groups & people..."
              value={sidebarSearch}
              onChange={e => setSidebarSearch(e.target.value)}
              className="bg-transparent outline-none flex-1 text-xs font-mono placeholder-white/40"
            />
            {sidebarSearch && (
              <button
                onClick={() => setSidebarSearch('')}
                className="text-white/70 hover:text-white ml-1"
              >
                <i className="fa-solid fa-xmark text-xs"></i>
              </button>
            )}
          </div>
        </div>

        {/* Scrollable group/DM list */}
        <div
          id="leftSidebarScroll"
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-sidebar-scroll"
          style={{
            scrollbarWidth: 'thin', /* Ensures Firefox respects the thin scrollbar */
            scrollbarColor: 'rgba(255, 255, 255, 0.25) transparent',
          }}
        >
          {myGroups.map(g => {
            const hasUnread = messages.some(
              m =>
                m.groupId === g.id &&
                !m.isMine &&
                !(m.seenBy || []).includes(user.email)
            );
            return (
              <div
                key={g.id}
                onClick={() => {
                  setActiveGroup(g);
                  setMobileSidebarOpen(false);
                }}
                className={`flex items-center gap-2 py-1.5 px-2 cursor-pointer transition-colors relative border-l-2 ${activeGroup?.id === g.id ? 'bg-white/10 border-indigo-400' : 'border-transparent hover:bg-white/5 hover:border-slate-500'}`}
              >
                <MemoizedAvatar
                  uid={g.id}
                  url={g.profilePicUrl}
                  name={g.name}
                  sizeClass="w-8 h-8"
                  isGroup={true}
                  extraClasses={`shrink-0 border ${hasUnread ? 'border-emerald-400' : 'border-slate-700'}`}
                />
                <div className="flex-1 min-w-0 overflow-hidden flex flex-col justify-center pr-2">
                  <div className="flex justify-between items-center mb-[2px]">
                    <span className="font-medium text-sm leading-tight break-words whitespace-normal pr-2">
                      {g.name}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-mono opacity-70 truncate">
                      {`${g.members?.length || 0} Members`}
                    </span>
                    {hasUnread && (
                      <div className="bg-emerald-500/20 border border-emerald-400 text-emerald-100 text-[10px] font-mono px-1 rounded shrink-0">
                        1
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {dmUsers.map(u => {
            const dmIdList = [user.uid, u.uid].sort();
            const dmIdStr = dmIdList.join('_');
            const unreadInfo = getUnreadInfoForUser(u.email, u.uid);
            const isOnline =
              u.lastActive &&
              Date.now() - (u.lastActive?.toMillis?.() || 0) < 900000;

            let statusText = isOnline ? 'Online' : 'Offline';
            if (unreadInfo.total > 0) {
              const parts = [];
              if (unreadInfo.unreadCount > 0) {
                parts.push(`${unreadInfo.unreadCount} unread`);
              }
              if (unreadInfo.pendingTaskCount > 0) {
                parts.push(
                  `${unreadInfo.pendingTaskCount} task${
                    unreadInfo.pendingTaskCount > 1 ? 's' : ''
                  }`
                );
              }
              statusText = parts.join(', ');
            }

            return (
              <div
                key={u.uid}
                onClick={() => {
                  setActiveGroup({
                    id: dmIdStr,
                    name: u.name,
                    isDM: true,
                    members: [user.email, u.email],
                  });
                  setMobileSidebarOpen(false);
                }}
                className={`flex items-center gap-2 py-1.5 px-2 cursor-pointer transition-colors relative border-l-2 ${activeGroup?.id === dmIdStr ? 'bg-white/10 border-indigo-400' : 'border-transparent hover:bg-white/5 hover:border-slate-500'}`}
              >
                <div className="relative shrink-0">
                  <MemoizedAvatar
                    uid={u.uid}
                    url={u.profilePicUrl}
                    name={u.name}
                    sizeClass="w-8 h-8"
                  />
                  <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full ${isOnline ? 'bg-emerald-700' : 'bg-[#800020]'}`} />
                </div>
                <div className="flex-1 min-w-0 overflow-hidden flex flex-col justify-center pr-2">
                  <div className="flex justify-between items-center mb-[2px]">
                    <span
                      className={`text-sm leading-tight break-words whitespace-normal pr-2 ${
                        unreadInfo.total > 0 ? 'font-semibold' : 'font-medium'
                      }`}
                    >
                      {u.name}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span
                      className={`text-[10px] font-mono truncate pr-4 ${
                        unreadInfo.total > 0 ? 'font-semibold' : 'opacity-70'
                      }`}
                    >
                      {statusText}
                    </span>
                    {unreadInfo.total > 0 && (
                      <div className="bg-emerald-500/20 border border-emerald-400 text-emerald-100 text-[10px] font-mono px-1 rounded shrink-0">
                        {unreadInfo.total}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Admin Workspace v25.0 button (visible if user is admin) */}
        {(currentUserData?.isAdmin || isVipAdmin) && (
          <div className="p-3 bg-transparent border-t border-slate-800 shrink-0">
            <button
              onClick={() => setViewMode('admin')}
              className="w-full border border-slate-700 hover:border-indigo-400 hover:bg-white/5 text-white py-1.5 rounded-md text-xs font-mono transition-colors flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-shield-halved"></i> Admin Workspace v25.0
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
