import React from 'react';

export default function UploadOverlay({ uploadProgress, fileName }) {
  return (
    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-[80] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-xs rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center transform-gpu">
        <div className="w-14 h-14 border-4 border-[#008069] border-t-transparent rounded-full animate-spin mb-5 shadow-sm"></div>
        <h3 className="font-bold text-lg text-slate-800 tracking-wide">Sending File...</h3>
        <div className="text-[11px] font-bold text-[#008069] uppercase tracking-widest mt-1">{Math.round(uploadProgress)}% Complete</div>
      </div>
    </div>
  );
}
