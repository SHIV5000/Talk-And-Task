import React, { useContext } from 'react';
import { AuthContext } from '../../contexts/AuthContext.jsx';

export default function VersionDisplay({ appVersion: propAppVersion }) {
  const authContext = useContext(AuthContext);
  const appVersion = propAppVersion || authContext?.appVersion;

  if (!appVersion) return null;

  return <div className="mt-1 text-xs font-bold text-slate-400">v{appVersion}</div>;
}
