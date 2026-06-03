import React from 'react';
import { useAuth } from '../../context/AuthContext.jsx';

export default function VersionDisplay({ appVersion: propAppVersion }) {
  const { appVersion: contextAppVersion } = useAuth();
  const appVersion = propAppVersion || contextAppVersion;

  if (!appVersion) return null;

  return <div className="mt-1 text-xs font-bold text-slate-400">v{appVersion}</div>;
}
