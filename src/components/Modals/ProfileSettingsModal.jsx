import React from 'react';

export default function ProfileSettingsModal({
  setActiveModal, currentUserData, profileForm, setProfileForm,
  profilePicInputRef, profileUploadProgress, handleProfileSubmit,
  toolPreferences, setToolPreferences,
}) {
  
  // Ensures we always have 4 slots to map over
  const currentEmojis = toolPreferences?.quickEmojis || ['👍', '❤️', '😂', '😮'];

  return (
    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[60] flex items-center justify-center p-4 animate-in fade-in" onClick={() => setActiveModal(null)}>
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl animate-in zoom-in-95 overflow-hidden max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-5 flex items-center gap-4 sticky top-0 z-10">
          <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors -ml-2"><i className="fa-solid fa-arrow-left"></i></button>
          <h3 className="font-extrabold text-lg text-slate-800 tracking-wide">Settings</h3>
        </div>
        
        <div className="p-6 space-y-6 bg-white">
          <div className="flex flex-col items-center gap-4">
            <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden relative cursor-pointer group shadow-inner border-4 border-slate-50" onClick={() => profilePicInputRef.current?.click()}>
              {currentUserData?.profilePicUrl ? <img src={currentUserData.profilePicUrl} className="w-full h-full object-cover" alt="avatar" /> : <i className="fa-solid fa-user text-5xl text-slate-300"></i>}
              <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[1px]"><i className="fa-solid fa-camera text-white text-2xl"></i></div>
            </div>
            <input type="file" ref={profilePicInputRef} className="hidden" accept="image/*" />
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full">Tap to change avatar</div>
          </div>
          
          <div className="relative">
            <label className="text-[11px] text-indigo-600 font-bold uppercase tracking-widest absolute -top-2.5 left-3 bg-white px-1">Display Name</label>
            <input required type="text" value={profileForm.name} onChange={(e) => setProfileForm({...profileForm, name: e.target.value})} className="w-full p-4 pt-5 border border-slate-300 rounded-2xl text-[15px] outline-none bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-semibold text-slate-800 shadow-sm" />
          </div>
          
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 shadow-inner">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Preferences</div>
            
            <div className="space-y-1.5">
              <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200 hover:shadow-sm">
                <input type="checkbox" checked={toolPreferences.showWatermark !== false} onChange={(e) => setToolPreferences(prev => ({...prev, showWatermark: e.target.checked}))} className="w-4 h-4 accent-indigo-600 rounded" />
                <span className="text-[13px] font-bold text-slate-700 flex-1"><i className="fa-solid fa-droplet mr-2 text-indigo-500"></i> Background Watermark</span>
              </label>
              
              <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200 hover:shadow-sm">
                <input type="checkbox" checked={toolPreferences.reply} onChange={(e) => setToolPreferences(prev => ({...prev, reply: e.target.checked}))} className="w-4 h-4 accent-indigo-600 rounded" />
                <span className="text-[13px] font-bold text-slate-700 flex-1"><i className="fa-solid fa-reply mr-2 text-indigo-500"></i> Reply Button</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200 hover:shadow-sm">
                <input type="checkbox" checked={toolPreferences.react} onChange={(e) => setToolPreferences(prev => ({...prev, react: e.target.checked}))} className="w-4 h-4 accent-indigo-600 rounded" />
                <span className="text-[13px] font-bold text-slate-700 flex-1"><i className="fa-regular fa-face-smile mr-2 text-indigo-500"></i> Emoji Reactions</span>
              </label>
            </div>

            {/* 👇 FIX 2: Custom Quick Emoji Array Config */}
            {toolPreferences.react !== false && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">Menu Quick Emojis (Max 4)</label>
                 <div className="flex gap-2">
                   {[0, 1, 2, 3].map(i => (
                      <input 
                         key={i} 
                         type="text" 
                         value={currentEmojis[i] || ''} 
                         onChange={e => {
                            const val = Array.from(e.target.value)[0] || ''; 
                            const newEmojis = [...currentEmojis];
                            newEmojis[i] = val;
                            setToolPreferences(prev => ({...prev, quickEmojis: newEmojis.filter(e => e.trim() !== '')}));
                         }} 
                         className="w-12 h-12 text-center text-xl bg-white border border-slate-200 rounded-xl shadow-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" 
                         placeholder="?"
                      />
                   ))}
                 </div>
              </div>
            )}
          </div>

          <button onClick={handleProfileSubmit} disabled={profileUploadProgress > 0} className="w-full bg-indigo-600 text-white py-4 rounded-2xl shadow-[0_4px_15px_rgba(79,70,229,0.3)] hover:bg-indigo-700 font-bold text-[15px] transition-all hover:-translate-y-0.5 active:translate-y-0">
            {profileUploadProgress > 0 ? `Saving ${Math.round(profileUploadProgress)}%` : 'Save Changes'}
          </button>
        </div>

      </div>
    </div>
  );
}
