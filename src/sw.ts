/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST || []);

// Cache the app shell for offline navigation
const handler = createHandlerBoundToURL('/index.html');
const navigationRoute = new NavigationRoute(handler, {
  denylist: [/^\/api/],
});
registerRoute(navigationRoute);

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Milestone 3.2: Handle push event and display hourly notification
self.addEventListener('push', (event) => {
  let data: { title?: string; body?: string } = {};

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { body: event.data.text() };
    }
  }

  const title = data.title || 'Little Hours';
  const body = data.body || 'Tell me how you spent the past hour.';

  const options: NotificationOptions = {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'hourly', // Replaces an unread older reminder instead of stacking
    data: {
      url: '/?focus=1',
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Milestone 3.2: Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || '/?focus=1';

  event.waitUntil(
    (async () => {
      // 1. Check for open windows matching the app
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // 2. Focus existing window if available and notify it to focus input
      for (const client of allClients) {
        if ('focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICK_FOCUS' });
          if ('navigate' in client) {
            await client.navigate(targetUrl);
          }
          return client.focus();
        }
      }

      // 3. Otherwise open a new window pointing to /?focus=1
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })()
  );
});
