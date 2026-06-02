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
  isMobileHome = false,
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
            : isMobileHome
              ? 'mobile-home-sidebar flex md:flex'
              : 'hidden md:flex'
        } w-[30%] min-w-[300px] max-w-[400px] bg-[#312E81] text-white border-r border-white/10 flex-col shrink-0 shadow-2xl h-full`}
        style={{ width: mobileSidebarOpen || isMobileHome ? undefined : `${sidebarWidth || 320}px` }}
      >
        {/* Header */}
        <div className="shrink-0 border-b-2 border-white/20 safe-top px-3 py-3">
          <div className="bg-white/5 rounded-2xl px-3 py-3 border border-white/10 shadow-inner">
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
                  className="text-white/95 bg-white/10 hover:bg-white/20 w-8 h-8 rounded-xl flex items-center justify-center text-sm transition-all"
                  title="Search groups & people"
                >
                  <i className="fa-solid fa-search"></i>
                </button>
                
                <button
                  onClick={() => setActiveModal('edit_profile')}
                  className="text-white/95 bg-white/10 hover:bg-white/20 w-8 h-8 rounded-xl flex items-center justify-center text-sm transition-all"
                >
                  <i className="fa-solid fa-gear"></i>
                </button>
                <button
                  onClick={onLogout}
                  className="text-white/95 bg-white/10 hover:bg-rose-500/30 w-8 h-8 rounded-xl flex items-center justify-center text-sm transition-all"
                >
                  <i className="fa-solid fa-power-off"></i>
                </button>
            </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className={`border-b-2 border-white/20 shrink-0 overflow-hidden transition-all duration-300 ease-out ${showSearch ? 'max-h-24 opacity-100 p-3' : 'max-h-0 opacity-0 px-3 py-0'}`}>
          <div className="bg-white/10 rounded-lg flex items-center px-3 py-2 focus-within:bg-white/20 transition-all">
            <i className="fa-solid fa-search text-sm mr-2 opacity-70"></i>
            <input
              type="text"
              placeholder="Search groups & people..."
              value={sidebarSearch}
              onChange={e => setSidebarSearch(e.target.value)}
              className="bg-transparent outline-none flex-1 text-sm placeholder-white/50"
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
          <div className="px-4 pt-4 pb-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/50">Groups</div>
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
                className={`flex items-center min-h-[72px] py-2 cursor-pointer transition-colors relative ${
                  activeGroup?.id === g.id ? 'bg-white/10' : 'hover:bg-white/5'
                } pl-3 pr-4`}
              >
                <MemoizedAvatar
                  uid={g.id}
                  url={g.profilePicUrl}
                  name={g.name}
                  sizeClass="w-[49px] h-[49px]"
                  isGroup={true}
                  extraClasses={`mr-3 shrink-0 border-4 ${hasUnread ? 'border-emerald-700' : 'border-[#800020]'}`}
                />
                <div className="flex-1 min-w-0 overflow-hidden border-b-2 border-white/20 flex flex-col justify-center pr-2">
                  <div className="flex justify-between items-center mb-[2px]">
                    <span className="font-medium text-[14.5px] leading-tight break-words whitespace-normal pr-2">
                      {g.name}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs opacity-70 truncate">
                      {`${g.members?.length || 0} Members`}
                    </span>
                    {hasUnread && (
                      <div className="w-[18px] h-[18px] bg-success rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0 shadow-sm">
                        1
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <div className="px-4 pt-4 pb-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/50">Members / Direct Messages</div>
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
                className={`flex items-center min-h-[72px] py-2 cursor-pointer transition-colors relative ${
                  activeGroup?.id === dmIdStr
                    ? 'bg-white/10'
                    : 'hover:bg-white/5'
                } pl-3 pr-4`}
              >
                <div className="relative mr-3 shrink-0">
                  <MemoizedAvatar
                    uid={u.uid}
                    url={u.profilePicUrl}
                    name={u.name}
                    sizeClass="w-[49px] h-[49px]"
                  />
                  <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full ${isOnline ? 'bg-emerald-700' : 'bg-[#800020]'}`} />
                </div>
                <div className="flex-1 min-w-0 overflow-hidden border-b-2 border-white/20 flex flex-col justify-center pr-2">
                  <div className="flex justify-between items-center mb-[2px]">
                    <span
                      className={`text-[14.5px] leading-tight break-words whitespace-normal pr-2 ${
                        unreadInfo.total > 0 ? 'font-semibold' : 'font-medium'
                      }`}
                    >
                      {u.name}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span
                      className={`text-xs truncate pr-4 ${
                        unreadInfo.total > 0 ? 'font-semibold' : 'opacity-70'
                      }`}
                    >
                      {statusText}
                    </span>
                    {unreadInfo.total > 0 && (
                      <div className="w-[20px] h-[20px] bg-success rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0 shadow-sm">
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
          <div className="p-3 bg-white/5 border-t border-white/10 shrink-0">
            <button
              onClick={() => setViewMode('admin')}
              className="w-full bg-white/10 hover:bg-white/20 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-shield-halved"></i> Admin Workspace v25.0
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
