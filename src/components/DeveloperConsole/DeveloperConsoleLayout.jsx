import React from 'react';
import DeveloperDashboard from './DeveloperDashboard.jsx';
import DeveloperSidebar from './DeveloperSidebar.jsx';

export default function DeveloperConsoleLayout({ children, activePath }) {
  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-slate-50 overflow-hidden animate-in fade-in z-40 relative">
      <DeveloperSidebar activePath={activePath} />
      <div className="flex-1 min-w-0 h-full overflow-hidden">
        {children || <DeveloperDashboard />}
      </div>
    </div>
  );
}
