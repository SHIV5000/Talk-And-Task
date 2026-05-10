import React, { useRef } from 'react';

export default function ProfileSettingsModal({
  setActiveModal,
  currentUserData,
  profileForm,
  setProfileForm,
  profilePicInputRef,
  profileUploadProgress,
  setProfileUploadProgress,
  handleProfileSubmit,
  toolPreferences,
  setToolPreferences,
  user,
}) {
  const handleSoundPreview = (profile) => {
    const audioUrls = {
      classic: 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3',
      soft: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_793bdf2292.mp3',
      subtle: 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_c8c8a73467.mp3',
    };
    const audioElement = new Audio(audioUrls[profile] || audioUrls.classic);
    audioElement.play().catch(() => {});
  };

  return (
    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-[60] flex items-center justify-center p-4 animate-in fade-in" onClick={() => setActiveModal(null)}>
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl animate-in zoom-in-95 overflow-hidden transform-gpu max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-[#008069] to-teal-500 text-white px-6 py-5 flex items-center gap-4 sticky top-0 z-10">
          <i className="fa-solid fa-arrow-left cursor-pointer hover:bg-white/20 p-2 rounded-full transition-colors -ml-2" onClick={() => setActiveModal(null)}></i>
          <h3 className="font-bold text-lg tracking-wide">Profile Settings</h3>
        </div>
        <div className="p-6 space-y-6">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-4">
            <div className="w-32 h-32 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden relative cursor-pointer group shadow-inner" onClick={() => profilePicInputRef.current?.click()}>
              {currentUserData?.profilePicUrl ? <img src={currentUserData.profilePicUrl} className="w-full h-full object-cover" alt="avatar" /> : <i className="fa-solid fa-user text-5xl text-slate-300"></i>}
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"><i className="fa-solid fa-camera text-white text-2xl"></i></div>
            </div>
            <input type="file" ref={profilePicInputRef} className="hidden" accept="image/*" />
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tap to change avatar</div>
          </div>

          {/* Display Name */}
          <div className="relative">
            <label className="text-[11px] text-[#008069] font-bold uppercase tracking-widest absolute -top-2.5 left-3 bg-white px-1">Display Name</label>
            <input required type="text" value={profileForm.name} onChange={(e) => setProfileForm({...profileForm, name: e.target.value})} className="w-full p-4 pt-5 border border-slate-300 rounded-2xl text-[15px] outline-none bg-white focus:border-[#008069] focus:ring-2 focus:ring-[#008069]/20 transition-all font-semibold text-slate-800" />
          </div>

          {/* Tool Preferences */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
            <div className="text-[12px] font-bold text-slate-600 uppercase tracking-wider mb-3">Preferences</div>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-white rounded-lg transition-colors">
                <input type="checkbox" checked={toolPreferences.showWatermark !== false} onChange={(e) => setToolPreferences(prev => ({...prev, showWatermark: e.target.checked}))} className="w-4 h-4 accent-[#008069]" />
                <span className="text-[14px] font-medium text-slate-700"><i className="fa-solid fa-droplet mr-2 text-[#54656f]"></i> Show Background Watermark</span>
              </label>

              <label className="flex flex-col gap-1 cursor-pointer p-2 mt-1 hover:bg-white rounded-lg transition-colors">
                <span className="text-[12px] font-bold text-slate-600 uppercase tracking-wider"><i className="fa-solid fa-music mr-1 text-[#54656f]"></i> Alert Sound</span>
                <select value={toolPreferences.soundProfile || 'classic'} onChange={(e) => { setToolPreferences(prev => ({...prev, soundProfile: e.target.value})); handleSoundPreview(e.target.value); }} className="w-full p-2 border border-slate-200 rounded-lg text-[13px] bg-slate-50 outline-none focus:ring-2 focus:ring-[#008069]/20 transition-all">
                  <option value="classic">Classic Chime</option>
                  <option value="soft">Soft Pulse</option>
                  <option value="subtle">Subtle Pop</option>
                </select>
              </label>

              <div className="h-px bg-slate-200 my-2"></div>

              <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-white rounded-lg transition-colors">
                <input type="checkbox" checked={toolPreferences.reply} onChange={(e) => setToolPreferences(prev => ({...prev, reply: e.target.checked}))} className="w-4 h-4 accent-[#008069]" />
                <span className="text-[14px] font-medium text-slate-700"><i className="fa-solid fa-reply mr-2 text-[#54656f]"></i> Reply Button</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-white rounded-lg transition-colors">
                <input type="checkbox" checked={toolPreferences.react} onChange={(e) => setToolPreferences(prev => ({...prev, react: e.target.checked}))} className="w-4 h-4 accent-[#008069]" />
                <span className="text-[14px] font-medium text-slate-700"><i className="fa-regular fa-face-smile mr-2 text-[#54656f]"></i> Quick Emoji Reactions</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-white rounded-lg transition-colors">
                <input type="checkbox" checked={toolPreferences.bookmark} onChange={(e) => setToolPreferences(prev => ({...prev, bookmark: e.target.checked}))} className="w-4 h-4 accent-[#008069]" />
                <span className="text-[14px] font-medium text-slate-700"><i className="fa-solid fa-bookmark mr-2 text-[#54656f]"></i> Save for Later</span>
              </label>
            </div>
          </div>

          <button onClick={handleProfileSubmit} disabled={profileUploadProgress > 0} className="w-full bg-[#008069] text-white py-4 rounded-2xl shadow-[0_4px_15px_rgba(0,128,105,0.3)] hover:bg-[#006b56] disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold">
            {profileUploadProgress > 0 ? `Uploading ${Math.round(profileUploadProgress)}%` : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
