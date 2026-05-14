import React from 'react';

export default function ProfileSettingsModal({
  setActiveModal,
  currentUserData,
  profileForm,
  setProfileForm,
  profilePicInputRef,
  profileUploadProgress,
  handleProfileSubmit
}) {
  return (
    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in" onClick={() => setActiveModal(null)}>
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl animate-in zoom-in-95 overflow-hidden transform-gpu" onClick={e => e.stopPropagation()}>
        
        <div className="bg-indigo-600 text-white px-6 py-5 flex items-center gap-4">
          <button onClick={() => setActiveModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors -ml-2">
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <h3 className="font-bold text-lg tracking-wide">Profile Settings</h3>
        </div>
        
        <div className="p-6 space-y-8">
          <div className="flex flex-col items-center gap-4">
            <div className="w-32 h-32 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden relative cursor-pointer group shadow-inner border-4 border-slate-50" onClick={() => profilePicInputRef.current?.click()}>
              {currentUserData?.profilePicUrl ? (
                <img src={currentUserData.profilePicUrl} className="w-full h-full object-cover" alt="avatar" />
              ) : (
                <i className="fa-solid fa-user text-5xl text-slate-300"></i>
              )}
              <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[1px]">
                <i className="fa-solid fa-camera text-white text-2xl"></i>
              </div>
            </div>
            <input type="file" ref={profilePicInputRef} className="hidden" accept="image/*" />
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full border border-slate-100">Tap to change avatar</div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-2 ml-1">Display Name</label>
            <input 
              required 
              type="text" 
              value={profileForm.name} 
              onChange={(e) => setProfileForm({...profileForm, name: e.target.value})} 
              className="w-full p-3.5 border border-slate-200 rounded-xl text-[15px] outline-none bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-semibold text-slate-800 shadow-sm" 
              placeholder="Enter your full name"
            />
          </div>

          <button 
            onClick={handleProfileSubmit} 
            disabled={profileUploadProgress > 0} 
            className="w-full bg-indigo-600 text-white py-3.5 rounded-xl shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold tracking-wide hover:-translate-y-0.5 active:translate-y-0"
          >
            {profileUploadProgress > 0 ? `Uploading Photo ${Math.round(profileUploadProgress)}%` : 'Save Changes'}
          </button>
        </div>

      </div>
    </div>
  );
}
