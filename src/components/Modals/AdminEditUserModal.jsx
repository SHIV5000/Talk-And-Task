import React from 'react';

export default function AdminEditUserModal({ setActiveModal, adminForm, setAdminForm, handleEditUserSubmit }) {
  return (
    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-[70] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 transform-gpu">
        <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-4">
          <h3 className="font-bold text-xl text-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-50 text-[#008069] rounded-xl flex items-center justify-center shadow-inner"><i className="fa-solid fa-user-pen"></i></div>
            Edit Staff Role
          </h3>
          <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center"><i className="fa-solid fa-xmark"></i></button>
        </div>
        <form onSubmit={handleEditUserSubmit} className="space-y-4">
          <input disabled type="email" value={adminForm.email} className="w-full p-3.5 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-400 font-medium" />
          <input required type="text" value={adminForm.name} onChange={(e) => setAdminForm({...adminForm, name: e.target.value})} className="w-full p-3.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#008069]/20 focus:border-[#008069] transition-all font-medium" />
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4">
            <label className="flex items-center gap-3 text-[13px] font-bold text-slate-800 cursor-pointer">
              <input type="checkbox" checked={adminForm.isAdmin} onChange={(e) => setAdminForm({...adminForm, isAdmin: e.target.checked})} className="w-5 h-5 accent-[#008069] rounded"/> Grant Full Admin Rights
            </label>
            <label className="flex items-center gap-3 text-[13px] font-bold text-slate-800 cursor-pointer">
              <input type="checkbox" checked={adminForm.canCreateGroups} onChange={(e) => setAdminForm({...adminForm, canCreateGroups: e.target.checked})} className="w-5 h-5 accent-[#008069] rounded"/> Allow Team Creation
            </label>
          </div>
          <button type="submit" className="w-full bg-[#008069] text-white py-3.5 mt-2 rounded-xl font-bold shadow-[0_4px_15px_rgba(0,128,105,0.3)] hover:bg-[#006e5a] transition-all">Save Changes</button>
        </form>
      </div>
    </div>
  );
}
