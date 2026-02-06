/* eslint-env serviceworker */
// Service Worker for HuddleUp Push Notifications

const CACHE_NAME = 'huddleup-v1';

// Install event - cache static assets
self.addEventListener('install', (_event) => {
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Push notification event
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    console.error('[SW] Push payload parse error', e);
    return;
  }

  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
    },
    actions: data.actions || [],
    // Unique tag so each notification shows; renotify so it pops up even if one exists
    tag: data.tag || 'huddleup-' + Date.now(),
    renotify: true,
    requireInteraction: false,
    ...(data.sound && { sound: data.sound }),
  };

  event.waitUntil(
    self.registration
      .showNotification(data.title || 'HuddleUp', options)
      .catch((err) => console.error('[SW] showNotification failed', err))
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window if none found
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});
