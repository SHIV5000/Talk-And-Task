import React, { useMemo } from 'react';

const MemoizedAvatar = React.memo(({ uid, url, name, sizeClass = "w-10 h-10", isGroup = false, extraClasses = "" }) => {
  const cachedUrl = useMemo(() => {
    if (!url) return null;
    try {
      const existing = localStorage.getItem(`avatar_${uid}`);
      if (existing === url) return url;
      localStorage.setItem(`avatar_${uid}`, url);
    } catch(e) {}
    return url;
  }, [uid, url]);

  // 👇 FIX: The image tag now checks isGroup. If true, it uses 'rounded-2xl' (Squircle). Otherwise 'rounded-full' (Circle).
  if (cachedUrl) {
    return (
      <img 
        src={cachedUrl} 
        loading="lazy" 
        className={`${sizeClass} ${isGroup ? 'rounded-2xl' : 'rounded-full'} object-cover shadow-sm ${extraClasses}`} 
        alt={name} 
      />
    );
  }

  // 👇 FIX: The fallback div also checks isGroup for the border-radius shape.
  return (
    <div 
      className={`${sizeClass} ${isGroup ? 'rounded-2xl bg-rose-50 text-[#800020] border border-rose-100' : 'rounded-full bg-[#dfe5e7] text-[#54656f]'} flex items-center justify-center font-bold text-sm shadow-sm ${extraClasses}`}
    >
      {isGroup ? <i className="fa-solid fa-users"></i> : (name || '').substring(0,2).toUpperCase()}
    </div>
  );
});

export default MemoizedAvatar;
