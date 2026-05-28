import React, { useState } from 'react';
import MemoizedAvatar from '../Common/MemoizedAvatar.jsx';

export default function LeftSidebar({ user, currentUserData, myGroups, dmUsers, activeGroup, setActiveGroup, setShowRightSidebar, setMobileSidebarOpen, getUnreadInfoForUser, messages, onLogout, setActiveModal, setGroupForm, setEditingGroup, sidebarSearch, setSidebarSearch, mobileSidebarOpen, isVipAdmin, setViewMode }) 
{
  const [showSearch, setShowSearch] = useState(false);

  return (
    <>
      {mobileSidebarOpen && <div className="mobile-sidebar-overlay md:hidden" onClick={() => setMobileSidebarOpen(false)}></div>}
      
      <div className={`hidden md:flex w-[30%] min-w-[300px] max-w-[400px] bg-white border-r border-slate-200 flex-col shrink-0 z-20 shadow-[2px_0_15px_rgba(0,0,0,0.03)] ${mobileSidebarOpen ? 'mobile-sidebar-panel open flex' : 'mobile-sidebar-panel'}`}>
        {/* Header */}
        <div className="h-[59px] bg-[#f0f2f5] flex items-center justify-between px-3 shrink-0 border-b border-slate-200/60 group relative safe-top">
          <div className="flex items-center gap-2">
            <MemoizedAvatar uid={user.uid} url={currentUserData?.profilePicUrl} name={currentUserData?.name || user.email.split('@')[0]} sizeClass="w-10 h-10 cursor-pointer hover:opacity-80 transition-opacity" />
            <button
              onClick={() => setShowSearch((prev) => !prev)}
              className="text-[#54656f] hover:bg-black/5 w-8 h-8 rounded-full transition-colors flex items-center justify-center text-[14px]"
              title="Search contacts & departments"
            >
              <i className="fa-solid fa-search"></i>
            </button>
          </div>
          <div className="flex items-center gap-1">
            {/* Create Department (always visible for admins) */}
            {(currentUserData?.isAdmin || isVipAdmin || currentUserData?.canCreateGroups) && (
              <button
                onClick={() => {
                  setGroupForm({ name: '', members: [], profilePicUrl: null });
                  setEditingGroup(null);
                  setActiveModal('group_form_modal');
                }}
                className="text-[#54656f] hover:bg-black/5 w-8 h-8 rounded-full transition-colors flex items-center justify-center text-[16px]"
                title="Create Department"
              >
                <i className="fa-solid fa-plus"></i>
              </button>
            )}
            <button onClick={() => setActiveModal('edit_profile')} className="text-[#54656f] hover:bg-black/5 w-8 h-8 rounded-full transition-colors flex items-center justify-center text-[16px]"><i className="fa-solid fa-gear"></i></button>
            <button onClick={onLogout} className="text-[#54656f] hover:bg-black/5 w-8 h-8 rounded-full transition-colors flex items-center justify-center text-[16px]"><i className="fa-solid fa-power-off"></i></button>
          </div>
          <div className="absolute top-14 left-4 glass-panel rounded-xl shadow-lg border border-slate-200 p-3 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
            <div className="font-bold text-[14px] text-slate-800">{currentUserData?.name || user.email.split('@')[0]}</div>
            <div className="text-[12px] font-medium text-slate-500">{user.email}</div>
          </div>
        </div>

        {/* Search */}
        <div className={`bg-white border-b border-slate-100 shrink-0 overflow-hidden transition-all duration-300 ease-out ${showSearch ? 'max-h-24 opacity-100 p-3' : 'max-h-0 opacity-0 px-3 py-0'}`}>
          <div className="bg-[#f0f2f5] rounded-lg flex items-center px-3 py-2 focus-within:bg-white focus-within:ring-1 focus-within:ring-[#00a884] transition-all">
            <i className="fa-solid fa-search text-[13px] text-[#54656f] mr-2"></i>
            <input type="text" placeholder="Search contacts & departments..." value={sidebarSearch} onChange={(e) => setSidebarSearch(e.target.value)} className="bg-transparent outline-none flex-1 text-[13px] text-slate-800" />
            {sidebarSearch && <button onClick={() => setSidebarSearch('')} className="text-slate-400 hover:text-slate-600 ml-1"><i className="fa-solid fa-xmark text-xs"></i></button>}
          </div>
        </div>

        {/* Group & DM List */}
        <div className="flex-1 overflow-y-auto flex flex-col bg-white">
          {myGroups.map(g => {
            const hasUnread = messages.some(m => m.groupId === g.id && !m.isMine && !(m.seenBy || []).includes(user.email));
            return (
              <div key={g.id} onClick={() => { setActiveGroup(g); setShowRightSidebar(false); setMobileSidebarOpen(false); }} className={`flex items-center h-[72px] cursor-pointer transition-colors relative ${activeGroup?.id === g.id ? 'bg-[#f0f2f5]' : 'hover:bg-[#f5f6f6]'} pl-3 pr-4`}>
                <MemoizedAvatar uid={g.id} url={g.profilePicUrl} name={g.name} sizeClass="w-[49px] h-[49px]" isGroup={true} extraClasses="mr-3 shrink-0" />
                <div className="flex-1 overflow-hidden border-b border-slate-100 h-full flex flex-col justify-center pr-2">
                  <div className="flex justify-between items-center mb-[2px]">
                    <span className="font-bold text-[16px] truncate text-[#800020]">{g.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[13px] text-[#54656f] truncate pr-4">{`${g.members?.length || 0} Members`}</span>
                    {hasUnread && <div className="w-[18px] h-[18px] bg-[#25d366] rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0 shadow-sm">1</div>}
                  </div>
                </div>
              </div>
            );
          })}
          {dmUsers.map(u => {
            const dmIdList = [user.uid, u.uid].sort();
            const dmIdStr = dmIdList.join('_');
            const unreadInfo = getUnreadInfoForUser(u.email, u.uid);
            const isOnline = u.lastActive && (Date.now() - (u.lastActive?.toMillis?.() || 0) < 900000);
            return (
              <div key={u.uid} onClick={() => { setActiveGroup({id: dmIdStr, name: u.name, isDM: true, members: [user.email, u.email]}); setShowRightSidebar(false); setMobileSidebarOpen(false); }} className={`flex items-center h-[72px] cursor-pointer transition-colors relative ${activeGroup?.id === dmIdStr ? 'bg-[#f0f2f5]' : 'hover:bg-[#f5f6f6]'} pl-3 pr-4`}>
                <div className="relative mr-3 shrink-0">
                  <MemoizedAvatar uid={u.uid} url={u.profilePicUrl} name={u.name} sizeClass="w-[49px] h-[49px]" />
                  {isOnline && <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#25d366] border-[3px] border-white rounded-full online-dot"></div>}
                </div>
                <div className="flex-1 overflow-hidden border-b border-slate-100 h-full flex flex-col justify-center pr-2">
                  <div className="flex justify-between items-center mb-[2px]">
                    <span className={`text-[16px] truncate ${unreadInfo.total > 0 ? 'font-bold text-[#111b21]' : 'font-medium text-[#111b21]'}`}>{u.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={`text-[12px] truncate pr-4 ${unreadInfo.total > 0 ? 'text-[#111b21] font-semibold' : 'text-[#54656f]'}`}>
                      {unreadInfo.total > 0
                        ? `${unreadInfo.unreadCount > 0 ? unreadInfo.unreadCount + ' unread' : ''}${unreadInfo.unreadCount > 0 && unreadInfo.pendingTaskCount > 0 ? ', ' : ''}${unreadInfo.pendingTaskCount > 0 ? unreadInfo.pendingTaskCount + ' task' + (unreadInfo.pendingTaskCount > 1 ? 's' : '') : ''}`
                        : (isOnline ? 'Online' : 'Offline')
                      }
                    </span>
                    {unreadInfo.total > 0 && <div className="w-[20px] h-[20px] bg-[#25d366] rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0 shadow-sm">{unreadInfo.total}</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Admin Panel button */}
        {(currentUserData?.isAdmin || isVipAdmin) && (
          <div className="p-3 bg-white border-t border-slate-200">
            <button onClick={() => setViewMode("admin")} className="w-full bg-[#f0f2f5] hover:bg-[#e9edef] text-[#111b21] py-2.5 rounded-lg text-[14px] font-semibold transition-colors flex items-center justify-center gap-2">
              <i className="fa-solid fa-shield-halved text-[#00a884]"></i> Admin Panel
            </button>
          </div>
        )}
      </div>
    </>
  );
}
