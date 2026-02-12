import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Authenticated, Unauthenticated, AuthLoading } from 'convex/react';
import AuthForm from './components/auth/AuthForm';
import ChatLayout from './components/chat/ChatLayout';
import ErrorBoundary from './components/errors/ErrorBoundary';
import LoadingSpinner from './components/common/LoadingSpinner';
import { usePresence, useEnsureUser } from './hooks/useAuth';
import { CallProvider, useCall } from './hooks/useCall.jsx';
import { VideoRoom, IncomingCallModal } from './components/calls';

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
 * Main content component that handles auth state.
 * Uses Convex's Authenticated/Unauthenticated/AuthLoading so Convex
 * has validated the Clerk token before rendering authenticated content.
 */
function MainContent() {
  return (
    <>
      <AuthLoading>
        <LoadingScreen />
      </AuthLoading>
      <Unauthenticated>
        <AuthForm />
      </Unauthenticated>
      <Authenticated>
        <AuthenticatedApp />
      </Authenticated>
    </>
  );
}

/**
 * Wrapper component for authenticated users
 * Handles presence tracking and call management
 */
function AuthenticatedApp() {
  // Ensure Convex user profile exists (creates from Clerk identity on first login)
  const { user, isLoading } = useEnsureUser();

  // Don't render app content until user exists in Convex. This prevents a race where
  // presence heartbeat, notifications, etc. would run before the user is created,
  // causing "User profile not found" and the try-again screen on new sign-ups.
  if (isLoading || !user) {
    return <LoadingScreen message="Setting up your account..." />;
  }

  return (
    <ErrorBoundary name="ChatApp">
      <AuthenticatedContent />
    </ErrorBoundary>
  );
}

/**
 * Inner wrapper that runs presence and call logic only after user exists
 */
function AuthenticatedContent() {
  usePresence();
  return (
    <CallProvider>
      <CallAwareApp />
    </CallProvider>
  );
}

/**
 * Inner component that can use call hooks
 */
function CallAwareApp() {
  const { activeCall, isInCall, setCall, clearCall } = useCall();
  
  return (
    <>
      {/* Main chat routes */}
      <Routes>
        <Route path="/*" element={<ChatLayout />} />
      </Routes>
      
      {/* Incoming call modal - shows when there's an incoming call */}
      <IncomingCallModal 
        onAnswer={(callData) => setCall(callData)}
      />
      
      {/* Active call overlay */}
      {isInCall && activeCall && (
        <VideoRoom
          callId={activeCall.callId}
          token={activeCall.token}
          roomName={activeCall.roomName}
          callType={activeCall.callType}
          onLeave={clearCall}
        />
      )}
    </>
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
