import React from 'react';
import MemoizedAvatar from '../Common/MemoizedAvatar.jsx';

export default function LeftSidebar({ user, currentUserData, myGroups, dmUsers, activeGroup, setActiveGroup, setShowRightSidebar, setMobileSidebarOpen, getUnreadInfoForUser, getUnreadInfoForGroup, messages, onLogout, setActiveModal, setGroupForm, setEditingGroup, sidebarSearch, setSidebarSearch, mobileSidebarOpen, isVipAdmin, setViewMode }) {

  return (
    <div className={`w-72 md:w-80 bg-white border-r border-slate-200 flex flex-col h-full shadow-2xl md:shadow-none absolute md:relative z-40 transition-transform duration-300 ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
      
      {/* Header Profile */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white shrink-0 safe-top">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setActiveModal('profile')}>
          <div className="relative">
            <MemoizedAvatar uid={user.uid} url={currentUserData?.profilePicUrl} name={currentUserData?.name || user.email.split('@')[0]} sizeClass="w-10 h-10" />
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></div>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-slate-800 text-sm truncate">{currentUserData?.name || user.email.split('@')[0]}</span>
            <span className="text-[11px] font-bold text-emerald-600">Online</span>
          </div>
        </div>
        <div className="flex gap-1">
            
            <button onClick={onLogout} className="w-8 h-8 rounded-full hover:bg-rose-50 flex items-center justify-center text-rose-500 transition-colors" title="Sign Out"><i className="fa-solid fa-arrow-right-from-bracket"></i></button>
        </div>
      </div>

      {/* Unified Search */}
      <div className="p-3 border-b border-slate-200 shrink-0 bg-slate-50">
          <div className="bg-white rounded-lg flex items-center px-3 py-2 shadow-sm border border-slate-200 focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-500 transition-all">
              <i className="fa-solid fa-magnifying-glass text-slate-400 text-xs mr-2"></i>
              <input type="text" placeholder="Filter people & teams..." className="bg-transparent outline-none flex-1 text-[13px] text-slate-800 font-medium placeholder-slate-400" value={sidebarSearch} onChange={(e) => setSidebarSearch(e.target.value)} />
              {sidebarSearch && <button onClick={() => setSidebarSearch('')} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-xmark"></i></button>}
          </div>
      </div>

      {/* 👇 SINGLE-COLUMN CONTACTS LAYOUT (REVERTED) 👇 */}
      <div className="flex-1 overflow-y-auto bg-white custom-sidebar-scroll scroll-smooth">
         
         {/* Directory Users Section */}
         <div className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white sticky top-0 z-10">
            <span className="flex items-center gap-1.5"><i className="fa-solid fa-user text-indigo-400"></i> Staff Members</span>
         </div>
         <div className="px-2 space-y-0.5">
            {dmUsers.length === 0 ? (
                <div className="text-xs text-slate-400 text-center py-4 font-medium">No users found</div>
            ) : (
                dmUsers.map(u => {
                   const dmIdStr = [user.uid, u.uid].sort().join('_');
                   const isActive = activeGroup?.id === dmIdStr;
                   const { unreadCount, pendingTaskCount } = getUnreadInfoForUser(u.email, u.uid);
                   return (
                       <div key={u.uid} onClick={() => { setActiveGroup({ id: dmIdStr, isDM: true, name: u.name, members: [user.email, u.email], profilePicUrl: u.profilePicUrl }); setMobileSidebarOpen(false); setShowRightSidebar(false); }} className={`p-2.5 rounded-xl cursor-pointer flex items-center justify-between transition-all ${isActive ? 'bg-indigo-50 border border-indigo-100 shadow-sm' : 'hover:bg-slate-50 border border-transparent'}`}>
                          <div className="flex items-center gap-3 min-w-0">
                              <div className="relative">
                                <MemoizedAvatar uid={u.uid} url={u.profilePicUrl} name={u.name || u.email?.split('@')[0]} sizeClass="w-10 h-10 shrink-0" />
                                {u.lastActive && (Date.now() - new Date(u.lastActive?.toDate?.() || u.lastActive).getTime()) < 180000 && <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-7 h-[3px] rounded-full bg-emerald-500"></div>}
                              </div>
                              <span className={`text-[14px] truncate ${isActive ? 'font-bold text-indigo-700' : 'font-medium text-slate-700'}`}>{(u.name || u.email?.split('@')[0] || 'Unknown')}</span>
                          </div>
                          <div className="flex gap-1.5">
                             {unreadCount > 0 && <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-white"></span>{unreadCount}</span>}
                             {pendingTaskCount > 0 && <span className="bg-amber-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm ring-2 ring-amber-300">{pendingTaskCount}</span>}
                          </div>
                       </div>
                   );
                })
            )}
         </div>

         <div className="h-px bg-slate-100 mx-4 my-2"></div>

         {/* Teams / Departments Section */}
         <div className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white sticky top-0 z-10 flex items-center justify-between">
            <span className="flex items-center gap-1.5"><i className="fa-solid fa-layer-group text-teal-500"></i> Groups</span>
            {(currentUserData?.isAdmin || isVipAdmin || currentUserData?.canCreateGroups) && (
                <button onClick={() => { setGroupForm({name: "", members: [], admins: [], profilePicUrl: null}); setEditingGroup(null); setActiveModal('group_form_modal'); }} className="w-6 h-6 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors shadow-sm border border-slate-200"><i className="fa-solid fa-plus text-[10px]"></i></button>
            )}
         </div>
         <div className="px-2 pb-4 space-y-0.5">
            {myGroups.length === 0 ? (
                <div className="text-xs text-slate-400 text-center py-4 font-medium">No teams found</div>
            ) : (
                myGroups.map(g => {
                   const isActive = activeGroup?.id === g.id;
                   const { unreadCount, pendingTaskCount } = getUnreadInfoForGroup(g.id);
                   return (
                       <div key={g.id} onClick={() => { setActiveGroup(g); setMobileSidebarOpen(false); setShowRightSidebar(false); }} className={`p-2.5 rounded-xl cursor-pointer flex items-center justify-between transition-all ${isActive ? 'bg-indigo-50 border border-indigo-100 shadow-sm' : 'hover:bg-slate-50 border border-transparent'}`}>
                          <div className="flex items-center gap-3 min-w-0">
                              {g.profilePicUrl ? <MemoizedAvatar uid={g.id} url={g.profilePicUrl} name={g.name} sizeClass="w-10 h-10 shrink-0" /> : <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0"><i className="fa-solid fa-users text-[12px]"></i></div>}
                              <span className={`text-[14px] truncate ${isActive ? 'font-bold text-indigo-700' : 'font-medium text-slate-700'}`}>{g.name}</span>
                          </div>
                          <div className="flex gap-1.5">
                             {unreadCount > 0 && <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-white"></span>{unreadCount}</span>}
                             {pendingTaskCount > 0 && <span className="bg-amber-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm ring-2 ring-amber-300">{pendingTaskCount}</span>}
                          </div>
                       </div>
                   );
                })
            )}
         </div>
      </div>
      {(currentUserData?.isAdmin || isVipAdmin) && (
        <div className="p-3 border-t border-slate-200 bg-white">
          <button onClick={() => setViewMode('admin')} className="w-full h-10 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors">
            <i className="fa-solid fa-shield-halved"></i> Admin Console
          </button>
        </div>
      )}

    </div>
  );
}
