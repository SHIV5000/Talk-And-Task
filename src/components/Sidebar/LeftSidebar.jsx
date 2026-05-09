import React from 'react';
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
}) {
  return (
    <div className="relative z-20">
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
        } w-[30%] min-w-[300px] max-w-[400px] bg-[#312E81] text-white border-r border-white/10 flex-col shrink-0 shadow-2xl`}
      >
        {/* Header – unchanged */}
        <div className="h-[59px] flex items-center justify-between px-3 shrink-0 border-b border-white/10 safe-top">
          <div className="flex items-center gap-2">
            <MemoizedAvatar
              uid={user.uid}
              url={currentUserData?.profilePicUrl}
              name={currentUserData?.name || user.email.split('@')[0]}
              sizeClass="w-8 h-8"
              extraClasses="cursor-pointer hover:opacity-80 transition-opacity shrink-0"
            />
            <span className="font-medium text-sm truncate max-w-[100px]">
              {currentUserData?.name || user.email.split('@')[0]}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {(currentUserData?.isAdmin ||
              isVipAdmin ||
              currentUserData?.canCreateGroups) && (
              <button
                onClick={() => {
                  setGroupForm({ name: '', members: [], profilePicUrl: null });
                  setEditingGroup(null);
                  setActiveModal('group_form_modal');
                }}
                className="text-white hover:bg-white/20 w-8 h-8 rounded-full flex items-center justify-center text-lg"
                title="Create Team"
              >
                <i className="fa-solid fa-plus"></i>
              </button>
            )}
            <button
              onClick={() => setActiveModal('edit_profile')}
              className="text-white hover:bg-white/20 w-8 h-8 rounded-full flex items-center justify-center text-lg"
            >
              <i className="fa-solid fa-gear"></i>
            </button>
            <button
              onClick={onLogout}
              className="text-white hover:bg-white/20 w-8 h-8 rounded-full flex items-center justify-center text-lg"
            >
              <i className="fa-solid fa-power-off"></i>
            </button>
          </div>
        </div>

        {/* Search – unchanged */}
        <div className="p-3 border-b border-white/10">
          <div className="bg-white/10 rounded-lg flex items-center px-3 py-2 focus-within:bg-white/20 transition-all">
            <i className="fa-solid fa-search text-sm mr-2 opacity-70"></i>
            <input
              type="text"
              placeholder="Search teams & people..."
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
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

        {/* ★ The scrollable container now has an ID */}
        <div
          id="leftSidebarScroll"
          className="flex-1 overflow-y-auto flex flex-col"
        >
          {myGroups.map((g) => {
            const hasUnread = messages.some(
              (m) =>
                m.groupId === g.id &&
                !m.isMine &&
                !(m.seenBy || []).includes(user.email)
            );
            return (
              <div
                key={g.id}
                onClick={() => {
                  setActiveGroup(g);
                  setShowRightSidebar(false);
                  setMobileSidebarOpen(false);
                }}
                className={`flex items-center h-[72px] cursor-pointer transition-colors relative ${
                  activeGroup?.id === g.id
                    ? 'bg-white/10'
                    : 'hover:bg-white/5'
                } pl-3 pr-4`}
              >
                <MemoizedAvatar
                  uid={g.id}
                  url={g.profilePicUrl}
                  name={g.name}
                  sizeClass="w-[49px] h-[49px]"
                  isGroup={true}
                  extraClasses="mr-3 shrink-0"
                />
                <div className="flex-1 overflow-hidden border-b border-white/10 h-full flex flex-col justify-center pr-2">
                  <div className="flex justify-between items-center mb-[2px]">
                    <span className="font-medium text-[14.5px] truncate">
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
          {dmUsers.map((u) => {
            const dmIdList = [user.uid, u.uid].sort();
            const dmIdStr = dmIdList.join('_');
            const unreadInfo = getUnreadInfoForUser(u.email, u.uid);
            const isOnline =
              u.lastActive &&
              Date.now() - (u.lastActive?.toMillis?.() || 0) < 900000;
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
                  setShowRightSidebar(false);
                  setMobileSidebarOpen(false);
                }}
                className={`flex items-center h-[72px] cursor-pointer transition-colors relative ${
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
                  {isOnline && (
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-success border-2 border-[#312E81] rounded-full online-dot" />
                  )}
                </div>
                <div className="flex-1 overflow-hidden border-b border-white/10 h-full flex flex-col justify-center pr-2">
                  <div className="flex justify-between items-center mb-[2px]">
                    <span
                      className={`text-[14.5px] truncate ${
                        unreadInfo.total > 0 ? 'font-semibold' : 'font-medium'
                      }`}
                    >
                      {u.name}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span
                      className={`text-xs truncate pr-4 ${
                        unreadInfo.total > 0
                          ? 'font-semibold'
                          : 'opacity-70'
                      }`}
                    >
                      {unreadInfo.total > 0
                        ? `${unreadInfo.unreadCount > 0 ? unreadInfo.unreadCount + ' unread' : ''}${
                            unreadInfo.pendingTaskCount > 0
                              ? ', ' + unreadInfo.pendingTaskCount + ' task' +
                                (unreadInfo.pendingTaskCount > 1 ? 's' : '')
                              : ''
                          }`
                        : isOnline
                        ? 'Online'
                        : 'Offline'}
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

        {/* Admin Workspace button */}
        {(currentUserData?.isAdmin || isVipAdmin) && (
          <div className="p-3 bg-white/5 border-t border-white/10">
            <button
              onClick={() => setViewMode('admin')}
              className="w-full bg-white/10 hover:bg-white/20 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-shield-halved"></i> Admin Workspace
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
