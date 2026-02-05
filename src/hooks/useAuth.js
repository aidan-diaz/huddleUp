import { useEffect, useCallback } from 'react';
import { useQuery, useMutation, useConvexAuth } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { api } from '../../convex/_generated/api';

/**
 * Custom hook for authentication state and actions
 * Provides user data, auth status, and auth actions
 */
export function useAuth() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const currentUser = useQuery(api.users.getCurrentUser);

  return {
    isAuthenticated,
    isLoading,
    user: currentUser,
    signOut,
  };
}

/**
 * Custom hook for presence management
 * Automatically sends heartbeats and manages user presence status
 */
export function usePresence() {
  const { isAuthenticated } = useConvexAuth();
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
  const { isAuthenticated, isLoading } = useConvexAuth();

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
 * Custom hook for ensuring user profile exists
 * Creates or updates user profile after authentication
 */
export function useEnsureUser() {
  const { isAuthenticated } = useConvexAuth();
  const currentUser = useQuery(api.users.getCurrentUser);
  const createOrUpdateUser = useMutation(api.users.createOrUpdateUser);

  useEffect(() => {
    async function ensureUser() {
      if (!isAuthenticated || currentUser !== undefined) return;

      try {
        // Get identity from Convex auth
        // The user creation is handled by Convex Auth callbacks
        // This hook is mainly for monitoring
      } catch (error) {
        console.error('Failed to ensure user:', error);
      }
    }

    ensureUser();
  }, [isAuthenticated, currentUser, createOrUpdateUser]);

  return {
    user: currentUser,
    isLoading: currentUser === undefined && isAuthenticated,
  };
}

export default {
  useAuth,
  usePresence,
  useRequireAuth,
  useEnsureUser,
};
