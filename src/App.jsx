import React, { Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import ErrorBoundary from './components/ErrorBoundary';
import { listenToForegroundMessages } from './utils/notifications';

const ChatApp = lazy(() => import('./components/ChatApp'));
const LoginScreen = lazy(() => import('./components/LoginScreen'));

function AppContent() {
  const { user, loading } = useAuth();

  React.useEffect(() => {
    if (user) listenToForegroundMessages();
  }, [user]);

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }
  if (!user) {
    return (
      <Suspense fallback={<div>Loading login...</div>}>
        <LoginScreen />
      </Suspense>
    );
  }

  return (
    <WorkspaceProvider>
      <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading workspace...</div>}>
        <ChatApp />
      </Suspense>
    </WorkspaceProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
