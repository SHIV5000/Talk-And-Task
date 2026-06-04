import React from 'react';

export default function GroupSettingsModal({
  setActiveModal,
  activeGroup,
  groupForm,
  setGroupForm,
  dbUsers,
  user,
  currentUserData,
  isVipAdmin,
  onGroupUpdate,
}) {
  // Only True Admins or the Creator can edit the group
  const isAdmin = activeGroup?.admins?.includes(user.email) || currentUserData?.isAdmin || isVipAdmin || activeGroup?.createdBy === user.email;

  return (
    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[60] flex items-center justify-center p-4 animate-in fade-in" onClick={() => setActiveModal(null)}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 animate-in zoom-in-95 transform-gpu flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* Header - Fixed */}
        <div className="flex items-center gap-4 p-6 border-b border-slate-100 dark:border-slate-700 shrink-0 bg-white dark:bg-slate-900 z-10">
          <div className="relative group/avatar">
            {activeGroup.profilePicUrl ? <img src={activeGroup.profilePicUrl} className="w-14 h-14 rounded-full object-cover shadow-sm border border-slate-100" alt=""/> 
              : <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 text-xl shadow-inner"><i className="fa-solid fa-people-group"></i></div>}
            
            {isAdmin && (
              <label className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full opacity-0 group-hover/avatar:opacity-100 cursor-pointer transition-opacity backdrop-blur-[1px]">
                 <i className="fa-solid fa-camera text-white text-sm"></i>
                 <input type="file" className="hidden" onChange={(e) => onGroupUpdate({ profilePicFile: e.target.files[0] })} />
              </label>
            )}
          </div>

          <div className="overflow-hidden flex-1">
            {isAdmin ? (
               <input value={groupForm.name || activeGroup.name} onChange={e => setGroupForm({...groupForm, name: e.target.value})} className="w-full text-xl font-bold text-slate-800 dark:text-slate-100 outline-none border-b border-dashed border-indigo-300 focus:border-indigo-600 bg-transparent placeholder-slate-400 truncate" />
            ) : (
               <div className="text-xl font-bold text-slate-800 dark:text-slate-100 truncate">{activeGroup.name}</div>
            )}
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Department Info</div>
          </div>
        </div>

        {/* Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950 custom-sidebar-scroll">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">Directory</div>
          <div className="space-y-1.5 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
            {dbUsers.map(u => {
              const baseMembers = groupForm.members?.length ? groupForm.members : (activeGroup.members || []);
              const baseAdmins = groupForm.admins?.length ? groupForm.admins : (activeGroup.admins || []);
              const isMember = baseMembers.includes(u.email);
              const memberAdmin = baseAdmins.includes(u.email);
              return (
                <label key={u.uid} className={`flex items-center gap-3 p-2 rounded-lg transition-colors border border-transparent ${isAdmin ? 'hover:bg-slate-50 hover:border-slate-200 hover:shadow-sm cursor-pointer' : ''}`}>
                  <input type="checkbox" disabled={!isAdmin || activeGroup.admins?.includes(u.email)} checked={isMember}
                    onChange={(e) => {
                      if(!isAdmin) return;
                      const newMembers = e.target.checked
                        ? [...new Set([...(baseMembers || []), u.email])]
                        : (baseMembers || []).filter(m => m !== u.email);
                      setGroupForm({...groupForm, members: newMembers});
                    }} className="w-4 h-4 accent-indigo-600 disabled:opacity-40 rounded" />
                  <span className="text-[14px] font-semibold text-slate-700 dark:text-slate-200 flex-1 truncate">{u.name}</span>
                  {isMember && isAdmin && (
                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); const admins = memberAdmin ? baseAdmins.filter(a => a !== u.email) : [...new Set([...baseAdmins, u.email])]; setGroupForm({...groupForm, admins, members: [...new Set([...baseMembers, u.email])]}); }} className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shadow-sm border ${memberAdmin ? 'text-indigo-600 bg-indigo-50 border-indigo-100' : 'text-slate-500 bg-slate-50 border-slate-200'}`}>{memberAdmin ? 'Admin' : 'Make Admin'}</button>
                  )}
                  {isMember && !isAdmin && memberAdmin && <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded uppercase tracking-wider shadow-sm">Admin</span>}
                </label>
              );
            })}
          </div>
        </div>

        {/* Footer - Fixed */}
        <div className="flex gap-3 p-5 border-t border-slate-100 dark:border-slate-700 shrink-0 bg-white dark:bg-slate-900 z-10">
          <button onClick={() => setActiveModal(null)} className="flex-1 text-slate-500 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 py-3 rounded-xl transition-colors">Close</button>
          {isAdmin && (
            <button onClick={() => onGroupUpdate({ members: groupForm.members, admins: groupForm.admins, name: groupForm.name })} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-[0_4px_15px_rgba(79,70,229,0.3)] hover:bg-indigo-700 transition-all hover:-translate-y-0.5">Save Changes</button>
          )}
        </div>

      </div>
    </div>
  );
}
