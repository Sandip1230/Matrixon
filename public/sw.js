/**
 * sw.js — MATRIXON Service Worker
 * Handles background push notifications.
 * Place this file in your ROOT directory (same level as index.html).
 */

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

/* ── PUSH RECEIVED ── */
self.addEventListener('push', e => {
  let data = { title: 'MATRIXON', body: 'You have a new notification.', icon: '⚡', url: 'learning.html' };

  try {
    if (e.data) data = { ...data, ...e.data.json() };
  } catch (_) {
    if (e.data) data.body = e.data.text();
  }

  const options = {
    body:    data.body,
    icon:    data.iconUrl  || '/icons/icon-192.png',
    badge:   data.badgeUrl || '/icons/badge-72.png',
    tag:     data.tag      || 'matrixon-notif',
    renotify: true,
    data:    { url: data.url || 'learning.html' },
    actions: [
      { action: 'open',    title: '▸ Open MATRIXON' },
      { action: 'dismiss', title: '✕ Dismiss' }
    ],
    vibrate: [100, 50, 100],
  };

  e.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

/* ── NOTIFICATION CLICK ── */
self.addEventListener('notificationclick', e => {
  e.notification.close();

  if (e.action === 'dismiss') return;

  const targetUrl = (e.notification.data && e.notification.data.url) || 'learning.html';

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // Focus existing tab if open
      for (const client of list) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new tab
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});