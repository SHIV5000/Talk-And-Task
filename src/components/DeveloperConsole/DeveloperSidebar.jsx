import React from 'react';

const developerLinks = [
  {
    href: '/developer-hq/tenants',
    label: 'Tenants',
    description: 'Workspace access',
    icon: 'fa-building-user',
  },
  {
    href: '/developer-hq/packages',
    label: 'Packages',
    description: 'Plans & modules',
    icon: 'fa-box-open',
  },
  {
    href: '/developer-hq/storage',
    label: 'Storage',
    description: 'Files & quotas',
    icon: 'fa-database',
  },
  {
    href: '/developer-hq/version',
    label: 'Version',
    description: 'Release control',
    icon: 'fa-code-branch',
  },
];

const getCurrentPath = () => {
  if (typeof window === 'undefined') return '';
  return window.location?.pathname || '';
};

export default function DeveloperSidebar({ activePath = getCurrentPath() }) {
  return (
    <aside className="w-full md:w-72 bg-primary text-white flex flex-col shrink-0 shadow-2xl md:h-full overflow-hidden">
      <div className="p-5 border-b border-white/10 bg-white/5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-white/15 rounded-2xl flex items-center justify-center shadow-inner border border-white/20">
            <i className="fa-solid fa-terminal text-xl"></i>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/50">Developer HQ</p>
            <h2 className="font-bold text-lg leading-tight truncate">Console</h2>
          </div>
        </div>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto custom-sidebar-scroll p-3 space-y-2">
        {developerLinks.map((link) => {
          const isActive = activePath === link.href || activePath.startsWith(`${link.href}/`);

          return (
            <a
              key={link.href}
              href={link.href}
              className={`group flex items-center gap-3 rounded-2xl px-3 py-3 transition-all border ${
                isActive
                  ? 'bg-white text-primary border-white shadow-lg'
                  : 'bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${isActive ? 'bg-primary-light text-primary' : 'bg-white/10 text-white group-hover:bg-white/15'}`}>
                <i className={`fa-solid ${link.icon}`}></i>
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-sm leading-tight truncate">{link.label}</div>
                <div className={`text-[11px] font-semibold truncate ${isActive ? 'text-primary/70' : 'text-white/55'}`}>{link.description}</div>
              </div>
              <i className={`fa-solid fa-chevron-right text-xs ${isActive ? 'text-primary/60' : 'text-white/35 group-hover:text-white/70'}`}></i>
            </a>
          );
        })}
      </nav>

      <div className="p-3 border-t border-white/10 bg-white/5">
        <div className="rounded-2xl bg-white/10 border border-white/10 p-3">
          <div className="flex items-center gap-2 text-xs font-bold text-white/80">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]"></span>
            Systems online
          </div>
          <p className="text-[11px] text-white/45 mt-1 leading-relaxed">Manage tenant operations and platform releases.</p>
        </div>
      </div>
    </aside>
  );
}
