import React, { useState, useEffect, useRef } from 'react';

export default function GroupSettingsModal({
  setActiveModal,
  activeGroup,
  dbUsers,
  user,
  currentUserData,
  isVipAdmin,
  onGroupUpdate,
}) {
  const [editName, setEditName] = useState(activeGroup.name);
  const [uploading, setUploading] = useState(false);
  const groupPicInputRef = useRef(null);

  const isAdmin = activeGroup?.admins?.includes(user.email) || currentUserData?.isAdmin || isVipAdmin;

  // keep editName in sync if activeGroup changes externally
  useEffect(() => {
    setEditName(activeGroup.name);
  }, [activeGroup.name]);

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !isAdmin) return;
    onGroupUpdate({ profilePicFile: file });
  };

  const handleMemberToggle = (email, checked) => {
    if (!isAdmin) return;
    const newMembers = checked
      ? [...activeGroup.members, email]
      : activeGroup.members.filter(m => m !== email);
    // Keep admins only if still in members
    const newAdmins = activeGroup.admins.filter(a => newMembers.includes(a));
    onGroupUpdate({ members: newMembers, admins: newAdmins });
  };

  const handleSaveName = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== activeGroup.name) {
      onGroupUpdate({ name: trimmed });
    }
  };

  return (
    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-[60] flex items-center justify-center p-4" onClick={() => setActiveModal(null)}>
      <div className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 transform-gpu max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-4 mb-6 border-b border-slate-100 pb-5">
          <div className="relative cursor-pointer" onClick={() => isAdmin && groupPicInputRef.current?.click()}>
            {activeGroup.profilePicUrl ? (
              <img src={activeGroup.profilePicUrl} className="w-14 h-14 rounded-full object-cover shadow-sm border border-slate-100" alt="Group avatar" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 text-xl shadow-inner"><i className="fa-solid fa-people-group"></i></div>
            )}
            {isAdmin && (
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity backdrop-blur-sm">
                <i className="fa-solid fa-camera text-white text-sm"></i>
              </div>
            )}
          </div>
          <input
            type="file"
            ref={groupPicInputRef}
            className="hidden"
            accept="image/*"
            onChange={handlePhotoUpload}
          />
          <div className="overflow-hidden flex-1">
            {isAdmin ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); }}
                  className="text-xl font-bold text-slate-800 outline-none border-b border-slate-300 focus:border-[#008069] bg-transparent w-full"
                />
                <button
                  onClick={handleSaveName}
                  className="text-xs bg-[#008069] text-white px-3 py-1 rounded-lg font-semibold shadow-sm hover:bg-[#006e5a] transition-colors"
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="text-xl font-bold text-slate-800 truncate">{activeGroup.name}</div>
            )}
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Department Info</div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Directory</div>
          <div className="h-56 overflow-y-auto space-y-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl shadow-inner">
            {dbUsers.map(u => {
              const isMember = activeGroup.members?.includes(u.email);
              return (
                <label key={u.uid} className={`flex items-center gap-3 p-2 rounded-lg transition-colors border border-transparent ${isAdmin ? 'hover:bg-white hover:border-slate-200 hover:shadow-sm cursor-pointer' : ''}`}>
                  <input
                    type="checkbox"
                    disabled={!isAdmin || activeGroup.admins?.includes(u.email)}
                    checked={isMember}
                    onChange={(e) => handleMemberToggle(u.email, e.target.checked)}
                    className="w-4 h-4 accent-[#008069] disabled:opacity-40"
                  />
                  <span className="text-[14px] font-semibold text-slate-700 flex-1 truncate">{u.name}</span>
                  {activeGroup.admins?.includes(u.email) && (
                    <span className="text-[9px] font-bold text-[#008069] bg-teal-50 border border-teal-100 px-1.5 py-0.5 rounded uppercase tracking-wider">Admin</span>
                  )}
                </label>
              );
            })}
          </div>

          <div className="flex gap-3 mt-4 pt-2">
            <button onClick={() => setActiveModal(null)} className="flex-1 text-slate-500 font-bold hover:bg-slate-100 py-3 rounded-xl transition-colors">Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
