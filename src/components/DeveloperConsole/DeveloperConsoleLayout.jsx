import React from 'react';
import DeveloperDashboard from './DeveloperDashboard.jsx';
import DeveloperSidebar from './DeveloperSidebar.jsx';

export default function DeveloperConsoleLayout({ children, activePath }) {
  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-slate-50 animate-in fade-in z-40 relative md:flex-row">
      <DeveloperSidebar activePath={activePath} />
      <div className="h-full min-w-0 flex-1 overflow-y-auto p-4 md:p-6">
        {children || <DeveloperDashboard />}
      </div>
    </div>
  );
}
