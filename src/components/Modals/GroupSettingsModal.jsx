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
  const isAdmin = activeGroup?.admins?.includes(user.email) || currentUserData?.isAdmin || isVipAdmin;

  return (
    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-[60] flex items-center justify-center p-4" onClick={() => setActiveModal(null)}>
      <div className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 transform-gpu max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-4 mb-6 border-b border-slate-100 pb-5">
          {activeGroup.profilePicUrl ? <img src={activeGroup.profilePicUrl} className="w-14 h-14 rounded-full object-cover shadow-sm border border-slate-100" alt=""/> 
            : <div className="w-14 h-14 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 text-xl shadow-inner"><i className="fa-solid fa-people-group"></i></div>}
          <div className="overflow-hidden">
            <div className="text-xl font-bold text-slate-800 truncate">{activeGroup.name}</div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Team Info</div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Directory</div>
          <div className="h-56 overflow-y-auto space-y-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl shadow-inner">
            {dbUsers.map(u => {
              const isMember = activeGroup.members?.includes(u.email);
              return (
                <label key={u.uid} className={`flex items-center gap-3 p-2 rounded-lg transition-colors border border-transparent ${isAdmin ? 'hover:bg-white hover:border-slate-200 hover:shadow-sm cursor-pointer' : ''}`}>
                  <input type="checkbox" disabled={!isAdmin || activeGroup.admins?.includes(u.email)} checked={isMember || groupForm.members.includes(u.email)}
                    onChange={(e) => {
                      if(!isAdmin) return;
                      const newMembers = e.target.checked
                        ? [...groupForm.members, u.email]
                        : groupForm.members.filter(m => m !== u.email);
                      setGroupForm({...groupForm, members: newMembers});
                    }} className="w-4 h-4 accent-[#008069] disabled:opacity-40" />
                  <span className="text-[14px] font-semibold text-slate-700 flex-1 truncate">{u.name}</span>
                  {activeGroup.admins?.includes(u.email) && <span className="text-[9px] font-bold text-[#008069] bg-teal-50 border border-teal-100 px-1.5 py-0.5 rounded uppercase tracking-wider">Admin</span>}
                </label>
              );
            })}
          </div>
          <div className="flex gap-3 mt-4 pt-2">
            <button onClick={() => setActiveModal(null)} className="flex-1 text-slate-500 font-bold hover:bg-slate-100 py-3 rounded-xl transition-colors">Close</button>
            {isAdmin && (
              <button onClick={() => onGroupUpdate({ members: groupForm.members })} className="flex-1 bg-[#008069] text-white py-3 rounded-xl font-bold shadow-[0_4px_15px_rgba(0,128,105,0.3)] hover:bg-[#006e5a] transition-all">Save</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
