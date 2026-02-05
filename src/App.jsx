import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useConvexAuth } from 'convex/react';
import AuthForm from './components/auth/AuthForm';
import ChatLayout from './components/chat/ChatLayout';
import ErrorBoundary from './components/errors/ErrorBoundary';
import LoadingSpinner from './components/common/LoadingSpinner';
import { usePresence } from './hooks/useAuth';

function App() {
  return (
    <ErrorBoundary name="App" level="critical">
      <BrowserRouter>
        <MainContent />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

/**
 * Main content component that handles auth state
 */
function MainContent() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  
  // Show loading while checking auth
  if (isLoading) {
    return <LoadingScreen />;
  }
  
  if (!isAuthenticated) {
    return <AuthForm />;
  }
  
  return <AuthenticatedApp />;
}

/**
 * Wrapper component for authenticated users
 * Handles presence tracking
 */
function AuthenticatedApp() {
  // Initialize presence tracking (sends heartbeat, handles visibility changes)
  usePresence();
  
  return (
    <ErrorBoundary name="ChatApp">
      <Routes>
        <Route path="/*" element={<ChatLayout />} />
      </Routes>
    </ErrorBoundary>
  );
}

function LoadingScreen({ message = "Loading HuddleUp..." }) {
  return (
    <div className="loading-screen">
      <LoadingSpinner size="large" />
      <p>{message}</p>
    </div>
  );
}

export default App;
