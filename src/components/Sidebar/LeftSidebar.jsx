import React, { useState } from 'react';
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
            {(currentUserData?.isAdmin || isVipAdmin) && (
              <button onClick={() => setViewMode('admin')} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors" title="Admin Console"><i className="fa-solid fa-shield-halved"></i></button>
            )}
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

      {/* 👇 TWO-COLUMN CONTACTS LAYOUT 👇 */}
      <div className="flex h-full w-full overflow-hidden bg-white">
         {/* Column 1: Directory Users */}
         <div className="w-1/2 h-full border-r border-slate-200 flex flex-col">
            <div className="p-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0 shadow-sm">
               <span className="flex items-center gap-1.5"><i className="fa-solid fa-user text-indigo-400"></i> Users</span>
            </div>
            <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 custom-sidebar-scroll">
               {dmUsers.length === 0 ? (
                   <div className="text-xs text-slate-400 text-center mt-4 font-medium">No users found</div>
               ) : (
                   dmUsers.map(u => {
                      const dmIdStr = [user.uid, u.uid].sort().join('_');
                      const isActive = activeGroup?.id === dmIdStr;
                      const { unreadCount, pendingTaskCount } = getUnreadInfoForUser(u.email, u.uid);
                      return (
                          <div key={u.uid} onClick={() => { setActiveGroup({ id: dmIdStr, isDM: true, name: u.name, members: [user.email, u.email], profilePicUrl: u.profilePicUrl }); setMobileSidebarOpen(false); setShowRightSidebar(false); }} className={`p-2 rounded-lg cursor-pointer flex items-center justify-between transition-colors ${isActive ? 'bg-indigo-50 border border-indigo-100' : 'hover:bg-slate-50 border border-transparent'}`}>
                             <div className="flex items-center gap-2 min-w-0">
                                 <MemoizedAvatar uid={u.uid} url={u.profilePicUrl} name={u.name} sizeClass="w-6 h-6 shrink-0" />
                                 <span className={`text-[13px] truncate ${isActive ? 'font-bold text-indigo-700' : 'font-medium text-slate-700'}`}>{u.name.split(' ')[0]}</span>
                             </div>
                             <div className="flex gap-1">
                                {unreadCount > 0 && <span className="bg-indigo-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{unreadCount}</span>}
                                {pendingTaskCount > 0 && <span className="bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{pendingTaskCount}</span>}
                             </div>
                          </div>
                      );
                   })
               )}
            </div>
         </div>
         
         {/* Column 2: Teams / Departments */}
         <div className="w-1/2 h-full flex flex-col">
            <div className="p-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0 shadow-sm">
               <span className="flex items-center gap-1.5"><i className="fa-solid fa-layer-group text-teal-500"></i> Teams</span>
               {(currentUserData?.isAdmin || isVipAdmin || currentUserData?.canCreateGroups) && (
                   <button onClick={() => { setGroupForm({name: "", members: [], admins: [], profilePicUrl: null}); setEditingGroup(null); setActiveModal('group_form_modal'); }} className="w-5 h-5 rounded hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"><i className="fa-solid fa-plus text-[10px]"></i></button>
               )}
            </div>
            <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 custom-sidebar-scroll">
               {myGroups.length === 0 ? (
                   <div className="text-xs text-slate-400 text-center mt-4 font-medium">No teams found</div>
               ) : (
                   myGroups.map(g => {
                      const isActive = activeGroup?.id === g.id;
                      const { unreadCount, pendingTaskCount } = getUnreadInfoForGroup(g.id);
                      return (
                          <div key={g.id} onClick={() => { setActiveGroup(g); setMobileSidebarOpen(false); setShowRightSidebar(false); }} className={`p-2 rounded-lg cursor-pointer flex items-center justify-between transition-colors ${isActive ? 'bg-indigo-50 border border-indigo-100' : 'hover:bg-slate-50 border border-transparent'}`}>
                             <div className="flex items-center gap-2 min-w-0">
                                 {g.profilePicUrl ? <MemoizedAvatar uid={g.id} url={g.profilePicUrl} name={g.name} sizeClass="w-6 h-6 shrink-0" /> : <div className="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-500 shrink-0"><i className="fa-solid fa-users text-[9px]"></i></div>}
                                 <span className={`text-[13px] truncate ${isActive ? 'font-bold text-indigo-700' : 'font-medium text-slate-700'}`}>{g.name}</span>
                             </div>
                             <div className="flex gap-1">
                                {unreadCount > 0 && <span className="bg-indigo-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{unreadCount}</span>}
                                {pendingTaskCount > 0 && <span className="bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{pendingTaskCount}</span>}
                             </div>
                          </div>
                      );
                   })
               )}
            </div>
         </div>
      </div>
    </div>
  );
}
