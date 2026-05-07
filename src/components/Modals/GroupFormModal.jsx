import React, { useState } from 'react';

export default function GroupFormModal({
  setActiveModal,
  groupForm,
  setGroupForm,
  editingGroup,
  handleGroupSubmit,
  groupPicInputRef,
  handleGroupPicUpload,
  groupPicUploadProgress,
  dbUsers,
  user,
}) {
  return (
    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-[60] flex items-center justify-center p-4" onClick={() => setActiveModal(null)}>
      <div className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 transform-gpu max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shadow-inner">
            <i className="fa-solid fa-layer-group"></i>
          </div>
          {editingGroup ? 'Edit Department' : 'New Department'}
        </div>

        {/* Group Avatar */}
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center overflow-hidden relative cursor-pointer group shadow-inner border-2 border-white ring-1 ring-slate-200" onClick={() => groupPicInputRef.current?.click()}>
            {groupForm.profilePicUrl ? <img src={groupForm.profilePicUrl} className="w-full h-full object-cover" alt="group" /> : <i className="fa-solid fa-people-group text-3xl text-slate-300"></i>}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
              <i className="fa-solid fa-camera text-white text-xl"></i>
            </div>
          </div>
          <input type="file" ref={groupPicInputRef} className="hidden" accept="image/*" onChange={handleGroupPicUpload} />
          {groupPicUploadProgress > 0 && <div className="text-[10px] text-[#008069] font-bold animate-pulse uppercase tracking-widest">Uploading {Math.round(groupPicUploadProgress)}%</div>}
        </div>

        <form onSubmit={handleGroupSubmit} className="space-y-4">
          <div className="relative">
            <label className="text-[10px] text-[#008069] font-bold uppercase tracking-widest absolute -top-2.5 left-3 bg-white px-1">Department Name</label>
            <input required type="text" value={groupForm.name} onChange={(e) => setGroupForm({...groupForm, name: e.target.value})} className="w-full p-3.5 pt-4 border border-slate-300 rounded-xl text-[14px] outline-none focus:ring-2 focus:ring-[#008069]/20 focus:border-[#008069] transition-all font-semibold text-slate-800" />
          </div>

          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-6 mb-2 px-1">Select Members</div>
          <div className="h-44 overflow-y-auto space-y-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl shadow-inner">
            {dbUsers.map(u => (
              <label key={u.uid} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200 hover:shadow-sm">
                <input type="checkbox" checked={groupForm.members.includes(u.email)} onChange={(e) => { const newMembers = e.target.checked ? [...groupForm.members, u.email] : groupForm.members.filter(m => m !== u.email); setGroupForm({...groupForm, members: newMembers}); }} className="w-4 h-4 accent-[#008069]" />
                <span className="text-[14px] font-semibold text-slate-700">{u.name}</span>
              </label>
            ))}
          </div>

          <div className="flex gap-3 mt-6 pt-2">
            <button type="button" onClick={() => setActiveModal(null)} className="flex-1 text-slate-500 font-bold hover:bg-slate-100 py-3 rounded-xl transition-colors">Cancel</button>
            <button type="submit" disabled={groupPicUploadProgress > 0} className="flex-1 bg-[#008069] text-white py-3 rounded-xl font-bold shadow-[0_4px_15px_rgba(0,128,105,0.3)] hover:bg-[#006e5a] transition-all disabled:opacity-50">
              {editingGroup ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
