import React, { useEffect } from 'react';
import MemoizedAvatar from '../Common/MemoizedAvatar';

function GroupSettingsModal({
    setActiveModal,
    activeGroup,
    groupForm,
    setGroupForm,
    dbUsers,
    user,
    currentUserData,
    isVipAdmin,
    handleUpdateGroupMembers,
    onGroupUpdate // Using the new instantly closing & background syncing function
}) {

    // Pre-fill the form with the current active group's details when opened
    useEffect(() => {
        if (activeGroup) {
            setGroupForm({
                name: activeGroup.name || "",
                members: activeGroup.members ? activeGroup.members.filter(m => !activeGroup.admins?.includes(m)) : [],
                admins: activeGroup.admins || [],
                profilePicUrl: activeGroup.profilePicUrl || null,
                profilePicFile: null
            });
        }
    }, [activeGroup, setGroupForm]);

    // Handle Image Selection
    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Store the file directly in the form state for `onGroupUpdate` to handle
            setGroupForm(prev => ({ ...prev, profilePicFile: file, profilePicUrl: URL.createObjectURL(file) }));
        }
    };

    // Toggle Member Selection
    const toggleMember = (email) => {
        setGroupForm(prev => {
            const isMember = prev.members.includes(email);
            return {
                ...prev,
                members: isMember ? prev.members.filter(m => m !== email) : [...prev.members, email]
            };
        });
    };

    // Prepare updates and pass to the parent handler
    const onSubmit = (e) => {
        e.preventDefault();
        
        const updates = {};
        if (groupForm.name !== activeGroup.name) updates.name = groupForm.name;
        if (groupForm.profilePicFile) updates.profilePicFile = groupForm.profilePicFile;
        
        // Reconstruct the full members list (combining regular members + admins)
        const combinedMembers = [...new Set([...groupForm.members, ...groupForm.admins])];
        
        // Only update if the arrays are fundamentally different
        if (JSON.stringify(combinedMembers.sort()) !== JSON.stringify([...activeGroup.members].sort())) {
            updates.members = combinedMembers;
        }

        // Call the parent function which handles the UI Optimism & Background Sync
        onGroupUpdate(updates);
    };

    const isGroupAdmin = activeGroup?.admins?.includes(user.email) || currentUserData?.isAdmin || isVipAdmin;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl shrink-0">
                    <h2 className="text-xl font-bold text-[#111b21] flex items-center gap-2">
                        <i className="fa-solid fa-users-gear text-[#00a884]"></i> Department Settings
                    </h2>
                    <button onClick={() => setActiveModal(null)} className="w-8 h-8 flex justify-center items-center rounded-full text-slate-400 hover:bg-slate-200 transition-colors">
                        <i className="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                {/* Form Body */}
                <div className="p-6 overflow-y-auto flex-1">
                    <form id="group-settings-form" onSubmit={onSubmit} className="space-y-6">
                        
                        {/* Avatar Section */}
                        <div className="flex flex-col items-center">
                            <label className={`relative cursor-pointer group ${isGroupAdmin ? '' : 'pointer-events-none'}`}>
                                <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-[#00a884] shadow-sm">
                                    {groupForm.profilePicUrl ? (
                                        <img src={groupForm.profilePicUrl} alt="Group Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-teal-50 flex items-center justify-center text-[#00a884]">
                                            <i className="fa-solid fa-users text-3xl"></i>
                                        </div>
                                    )}
                                </div>
                                {isGroupAdmin && (
                                    <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <i className="fa-solid fa-camera text-white text-xl"></i>
                                    </div>
                                )}
                                <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} disabled={!isGroupAdmin} />
                            </label>
                            {isGroupAdmin && <span className="text-xs text-[#54656f] mt-2 font-medium">Click to change avatar</span>}
                        </div>

                        {/* Name Section */}
                        <div>
                            <label className="block text-xs font-bold text-[#00a884] uppercase tracking-wide mb-2">Department Name</label>
                            <input 
                                type="text" 
                                value={groupForm.name} 
                                onChange={(e) => setGroupForm(prev => ({...prev, name: e.target.value}))} 
                                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#00a884]/30 focus:border-[#00a884] outline-none transition-all text-[#111b21] font-semibold disabled:bg-slate-50 disabled:text-slate-500" 
                                placeholder="Enter department name..." 
                                required
                                disabled={!isGroupAdmin}
                            />
                        </div>

                        {/* Members Section */}
                        <div>
                            <label className="block text-xs font-bold text-[#00a884] uppercase tracking-wide mb-2">Manage Members</label>
                            <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50/50">
                                <div className="max-h-64 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                                    {dbUsers.filter(u => u.isApproved || u.isAdmin).map(u => {
                                        const isAdmin = groupForm.admins?.includes(u.email) || false;
                                        const isChecked = groupForm.members?.includes(u.email) || isAdmin;
                                        
                                        return (
                                            <label key={u.uid} className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${isChecked ? 'bg-white shadow-sm border border-slate-200/60' : 'hover:bg-slate-100 border border-transparent'}`}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={isChecked} 
                                                    onChange={() => toggleMember(u.email)} 
                                                    disabled={!isGroupAdmin || isAdmin} // Cannot remove admins through this generic checkbox
                                                    className="w-4 h-4 text-[#00a884] rounded border-slate-300 focus:ring-[#00a884] disabled:opacity-50"
                                                />
                                                <MemoizedAvatar uid={u.uid} url={u.profilePicUrl} name={u.name} sizeClass="w-8 h-8 shrink-0" />
                                                <div className="flex flex-col min-w-0 flex-1">
                                                    <span className={`text-[14px] truncate ${isChecked ? 'font-bold text-[#111b21]' : 'font-medium text-[#54656f]'}`}>
                                                        {(u.name || "").split('@')[0]}
                                                        {u.email === user.email && " (You)"}
                                                    </span>
                                                    <span className="text-[11px] text-[#8696a0] truncate">{u.email}</span>
                                                </div>
                                                {isAdmin && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded uppercase shrink-0">Admin</span>}
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                            <p className="text-[11px] text-[#8696a0] mt-2 italic"><i className="fa-solid fa-circle-info mr-1"></i> Department Admins cannot be removed via this menu.</p>
                        </div>

                    </form>
                </div>

                {/* Footer / Buttons aligned side-by-side on the right */}
                {isGroupAdmin && (
                    <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl shrink-0 flex justify-end items-center gap-3">
                        <button 
                            type="button" 
                            onClick={() => setActiveModal(null)} 
                            className="px-5 py-2.5 rounded-lg font-bold text-[#54656f] bg-white border border-slate-200 hover:bg-slate-100 transition-colors text-[14px]"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            form="group-settings-form" 
                            className="px-6 py-2.5 rounded-lg font-bold text-white bg-[#00a884] shadow-sm hover:bg-[#008f6f] transition-all flex items-center gap-2 text-[14px]"
                        >
                            <i className="fa-solid fa-check"></i> Save Settings
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default GroupSettingsModal;
