import React, { useState } from 'react';

const fontOptions = ['Inter', 'Roboto', 'Nunito', 'Poppins', 'System'];
export default function ProfileSettingsModal({
  setActiveModal,
  currentUserData,
  profileForm,
  setProfileForm,
  profilePicInputRef,
  profileUploadProgress,
  handleProfileSubmit,
  user,
  featureFlags = {},
}) {
  const [activeTab, setActiveTab] = useState('profile');
  const tabs = featureFlags.customBranding === false ? ['profile'] : ['profile', 'theme'];
  const fontScaleOptions = [
    { key: 'compact', label: 'Compact' },
    { key: 'normal', label: 'Normal' },
    { key: 'comfortable', label: 'Comfortable' },
    { key: 'large', label: 'Large' },
  ];

  return (
    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in" onClick={() => setActiveModal(null)}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 animate-in zoom-in-95 overflow-hidden transform-gpu" onClick={e => e.stopPropagation()}>
        
        <div className="bg-indigo-600 text-white px-6 py-5 flex items-center gap-4">
          <button onClick={() => setActiveModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors -ml-2">
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <h3 className="font-bold text-lg tracking-wide">Profile Settings</h3>
        </div>

        <div className="px-6 pt-5 flex gap-2 bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-700">
          {tabs.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-t-xl text-sm font-bold capitalize transition-all ${activeTab === tab ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-500 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300'}`}>{tab}</button>
          ))}
        </div>
        
        <div className="p-6 space-y-7 max-h-[72vh] overflow-y-auto custom-sidebar-scroll">
          {activeTab === 'profile' || featureFlags.customBranding === false ? (
            <>
              <div className="flex flex-col items-center gap-4">
                <div className="w-32 h-32 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden relative cursor-pointer group shadow-inner border-4 border-slate-50" onClick={() => profilePicInputRef.current?.click()}>
                  {currentUserData?.profilePicUrl ? (
                    <img src={currentUserData.profilePicUrl} className="w-full h-full object-cover" alt="avatar" loading="eager" decoding="async" fetchPriority="high" />
                  ) : (
                    <i className="fa-solid fa-user text-5xl text-slate-300"></i>
                  )}
                  <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[1px]">
                    <i className="fa-solid fa-camera text-white text-2xl"></i>
                  </div>
                </div>
                <input type="file" ref={profilePicInputRef} className="hidden" accept="image/*" />
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full border border-slate-100">Tap to change avatar</div>
                {profileUploadProgress > 0 && (
                  <div className="w-full max-w-xs"><div className="h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200"><div className="h-full bg-indigo-600 transition-all" style={{ width: `${Math.round(profileUploadProgress)}%` }} /></div><div className="mt-1 text-center text-[10px] font-black text-indigo-600">Uploading {Math.round(profileUploadProgress)}%</div></div>
                )}
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-2 ml-1">Email</label>
                <input
                  type="email"
                  value={user?.email || currentUserData?.email || ''}
                  disabled
                  className="w-full p-3.5 border border-slate-200 rounded-xl text-[15px] outline-none bg-slate-100 text-slate-500 cursor-not-allowed font-semibold shadow-sm"
                />
                <p className="mt-1.5 text-[11px] text-slate-400 font-semibold ml-1">Email is managed by your sign-in account.</p>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-2 ml-1">Display Name</label>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({...profileForm, name: e.target.value})}
                  className="w-full p-3.5 border border-slate-200 rounded-xl text-[15px] outline-none bg-slate-50 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-semibold text-slate-800 shadow-sm"
                  placeholder="Enter your full name"
                />
              </div>
            </>
          ) : (
            <div className="space-y-5">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-2 ml-1">Font Selection</label>
                <select value={profileForm.themeFont || 'Inter'} onChange={(e)=>setProfileForm({...profileForm, themeFont: e.target.value})} className="modern-date-input">
                  {fontOptions.map(font => <option key={font} value={font}>{font}</option>)}
                </select>
              </div>


              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
                <div>
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-100">Display Mode</div>
                  <div className="text-xs text-slate-500">Switch between light and dark UI modes.</div>
                </div>
                <button type="button" onClick={()=>setProfileForm({...profileForm, displayMode: profileForm.displayMode === 'dark' ? 'light' : 'dark'})} className={`w-16 h-8 rounded-full p-1 transition-all ${profileForm.displayMode === 'dark' ? 'bg-slate-900' : 'bg-indigo-100'}`}>
                  <span className={`block w-6 h-6 rounded-full bg-white shadow transition-transform ${profileForm.displayMode === 'dark' ? 'translate-x-8' : 'translate-x-0'}`}></span>
                </button>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-2 ml-1">Global Typography</label>
                <div className="grid grid-cols-4 gap-2">
                  {fontScaleOptions.map(opt => (
                    <button key={opt.key} type="button" onClick={()=>setProfileForm({...profileForm, fontScale: opt.key})} className={`py-2 rounded-xl text-xs font-bold border transition-all ${profileForm.fontScale === opt.key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-indigo-200'}`}>{opt.label}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button type="button" onClick={() => setActiveModal(null)} className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-100 py-3.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all font-bold tracking-wide">Cancel</button>
            <button onClick={handleProfileSubmit} disabled={profileUploadProgress > 0} className="flex-1 bg-indigo-600 text-white py-3.5 rounded-xl shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold tracking-wide hover:-translate-y-0.5 active:translate-y-0">
              {profileUploadProgress > 0 ? `Uploading Photo ${Math.round(profileUploadProgress)}%` : 'Save Changes'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
