import { useEffect, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useAuth as useClerkAuth } from '@clerk/clerk-react';
import { api } from '../../convex/_generated/api';

/**
 * Custom hook for authentication state and actions
 * Provides user data, auth status, and auth actions
 */
export function useAuth() {
  const { isSignedIn, isLoaded, signOut } = useClerkAuth();
  const currentUser = useQuery(api.users.getCurrentUser);

  return {
    isAuthenticated: isSignedIn,
    isLoading: !isLoaded,
    user: currentUser,
    signOut,
  };
}

/**
 * Custom hook for presence management
 * Automatically sends heartbeats and manages user presence status
 */
export function usePresence() {
  const { isSignedIn } = useClerkAuth();
  const isAuthenticated = isSignedIn;
  const sendHeartbeat = useMutation(api.users.sendHeartbeat);
  const updatePresenceStatus = useMutation(api.users.updatePresenceStatus);

  // Send heartbeat every 30 seconds
  useEffect(() => {
    if (!isAuthenticated) return;

    // Send initial heartbeat
    sendHeartbeat().catch(console.error);

    // Set up interval
    const intervalId = setInterval(() => {
      sendHeartbeat().catch(console.error);
    }, 30000);

    return () => clearInterval(intervalId);
  }, [isAuthenticated, sendHeartbeat]);

  // Update status to away when tab becomes hidden
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        updatePresenceStatus({ status: 'away' }).catch(console.error);
      } else {
        updatePresenceStatus({ status: 'active' }).catch(console.error);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isAuthenticated, updatePresenceStatus]);

  // Update status to offline when window closes
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable delivery
      const url = '/api/presence/offline'; // Would need HTTP endpoint
      // navigator.sendBeacon(url);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isAuthenticated]);

  const setStatus = useCallback(
    (status) => {
      return updatePresenceStatus({ status });
    },
    [updatePresenceStatus]
  );

  return { setStatus };
}

/**
 * Custom hook for protected routes
 * Returns authentication state for route guards
 */
export function useRequireAuth() {
  const { isSignedIn, isLoaded } = useClerkAuth();
  const isAuthenticated = isSignedIn;
  const isLoading = !isLoaded;

  return {
    isAuthenticated,
    isLoading,
    // Helper to check if we should show loading state
    showLoading: isLoading,
    // Helper to check if we should redirect to login
    shouldRedirect: !isLoading && !isAuthenticated,
  };
}

/**
 * Custom hook for ensuring user profile exists in Convex
 * Creates user from Clerk identity on first login
 */
export function useEnsureUser() {
  const { isSignedIn } = useClerkAuth();
  const currentUser = useQuery(api.users.getCurrentUser);
  const ensureUserExists = useMutation(api.users.ensureUserExists);

  useEffect(() => {
    if (!isSignedIn) return;
    // Only create user when we know they don't exist (null), not while loading (undefined)
    if (currentUser !== null) return;

    ensureUserExists().catch(console.error);
  }, [isSignedIn, currentUser, ensureUserExists]);

  return {
    user: currentUser,
    isLoading: currentUser === undefined && isSignedIn,
  };
}

export default {
  useAuth,
  usePresence,
  useRequireAuth,
  useEnsureUser,
};
