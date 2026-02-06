import { useState, useEffect, useCallback } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

/**
 * VAPID public key from environment
 * Generate using: npx web-push generate-vapid-keys
 */
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

/**
 * Check if push notifications are supported
 */
export function isPushSupported() {
  return 'serviceWorker' in navigator && 
         'PushManager' in window && 
         'Notification' in window;
}

/**
 * Hook for managing push notification subscriptions
 */
export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const savePushSubscription = useMutation(api.notifications.savePushSubscription);
  const removePushSubscription = useMutation(api.notifications.removePushSubscription);

  /**
   * Register service worker and check current subscription status on mount.
   * SW must be registered before .ready resolves; otherwise the toggle stays disabled.
   */
  useEffect(() => {
    let fallbackId;
    async function checkSubscription() {
      if (!isPushSupported()) {
        setIsSupported(false);
        setIsLoading(false);
        return;
      }

      setIsSupported(true);
      setPermission(Notification.permission);

      try {
        // Register service worker so .ready can resolve (required for push)
        await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      } catch (err) {
        console.error('Error checking push subscription:', err);
        setError(err.message || 'Push setup failed');
      } finally {
        setIsLoading(false);
        if (fallbackId) clearTimeout(fallbackId);
      }
    }

    checkSubscription();
    // Safety: ensure loading is cleared if something hangs (e.g. SW never ready)
    fallbackId = setTimeout(() => setIsLoading(false), 5000);
    return () => clearTimeout(fallbackId);
  }, []);

  /**
   * Convert VAPID key from base64 to Uint8Array
   */
  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  /**
   * Subscribe to push notifications
   */
  const subscribe = useCallback(async () => {
    if (!isSupported) {
      setError('Push notifications are not supported');
      return false;
    }

    if (!VAPID_PUBLIC_KEY) {
      setError('VAPID public key not configured');
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Request notification permission
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== 'granted') {
        setError('Notification permission denied');
        return false;
      }

      // Register service worker if not already registered
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // Extract keys
      const subscriptionJson = subscription.toJSON();
      const p256dh = subscriptionJson.keys?.p256dh;
      const auth = subscriptionJson.keys?.auth;

      if (!p256dh || !auth) {
        throw new Error('Failed to get subscription keys');
      }

      // Save to Convex
      await savePushSubscription({
        endpoint: subscription.endpoint,
        p256dh,
        auth,
      });

      setIsSubscribed(true);
      return true;
    } catch (err) {
      console.error('Error subscribing to push:', err);
      setError(err.message || 'Failed to subscribe');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, savePushSubscription]);

  /**
   * Unsubscribe from push notifications
   */
  const unsubscribe = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Remove from Convex first
        await removePushSubscription({ endpoint: subscription.endpoint });
        
        // Then unsubscribe from browser
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      return true;
    } catch (err) {
      console.error('Error unsubscribing from push:', err);
      setError(err.message || 'Failed to unsubscribe');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [removePushSubscription]);

  /**
   * Toggle subscription
   */
  const toggleSubscription = useCallback(async () => {
    if (isSubscribed) {
      return unsubscribe();
    } else {
      return subscribe();
    }
  }, [isSubscribed, subscribe, unsubscribe]);

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    toggleSubscription,
  };
}

export default usePushNotifications;
