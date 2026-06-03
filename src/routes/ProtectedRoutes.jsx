import React from 'react';
import { Navigate, Outlet, useLocation } from './router.jsx';

const ACTIVE_ORG_STATES = new Set(['active', 'trial', 'trialing']);

export function getUserRole(userProfile) {
  if (userProfile?.isPlatformOwner === true) return 'platform-owner';
  if (userProfile?.isAdmin === true) return 'admin';
  return 'member';
}

export function getFallbackPath(userProfile) {
  return getUserRole(userProfile) === 'platform-owner' ? '/developer-hq' : '/app';
}

export function getOrgId(userProfile) {
  return userProfile?.orgId || userProfile?.currentOrgId || userProfile?.organizationId || '';
}

export function hasActiveOrTrialOrg(userProfile, org) {
  const status = String(
    org?.status ||
    org?.subscriptionStatus ||
    org?.billingStatus ||
    userProfile?.orgStatus ||
    userProfile?.subscriptionStatus ||
    ''
  ).toLowerCase();

  return ACTIVE_ORG_STATES.has(status);
}

function GuardShell({ children }) {
  return children || <Outlet />;
}

export function RouteLoadingScreen({ message = 'Checking access...' }) {
  return (
    <div className="flex flex-col justify-center items-center h-screen bg-surface text-primary">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
      <span className="font-bold tracking-widest uppercase text-sm">{message}</span>
    </div>
  );
}

export function AccessBlockedScreen({ title, message }) {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6 text-text-primary">
      <div className="bg-white border border-slate-200 shadow-xl rounded-3xl max-w-md w-full p-8 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-3xl mb-5">
          <i className="fa-solid fa-shield-halved"></i>
        </div>
        <h1 className="text-2xl font-black text-slate-800 mb-2">{title}</h1>
        <p className="text-sm text-slate-500 font-medium leading-6">{message}</p>
      </div>
    </div>
  );
}

export function AppRouteGuard({ user, userProfile, org, isLoading, children }) {
  const location = useLocation();
  const orgId = getOrgId(userProfile);

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (isLoading) {
    return <RouteLoadingScreen message="Checking workspace access..." />;
  }

  if (!orgId) {
    return (
      <AccessBlockedScreen
        title="Organization required"
        message="Your user profile is not linked to an organization yet. Contact your workspace administrator to finish setup."
      />
    );
  }

  if (!hasActiveOrTrialOrg(userProfile, org)) {
    return (
      <AccessBlockedScreen
        title="Organization inactive"
        message="This workspace must have an active or trial organization subscription before you can continue."
      />
    );
  }

  return <GuardShell>{children}</GuardShell>;
}

export function PlatformOwnerGuard({ user, userProfile, isLoading, children }) {
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (isLoading) {
    return <RouteLoadingScreen message="Checking platform owner access..." />;
  }

  if (userProfile?.isPlatformOwner !== true) {
    return <Navigate to={getFallbackPath(userProfile)} replace />;
  }

  return <GuardShell>{children}</GuardShell>;
}

export function RoleFallbackRedirect({ user, userProfile, isLoading }) {
  if (!user) return <Navigate to="/login" replace />;
  if (isLoading) return <RouteLoadingScreen />;
  return <Navigate to={getFallbackPath(userProfile)} replace />;
}
