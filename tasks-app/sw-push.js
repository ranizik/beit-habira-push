// Service Worker להתראות - אפליקציית המשימות (beit-habira.com/tasks)
// מציג תזכורות שמגיעות מהשרת (FCM) - גם כשהאפליקציה סגורה.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (e) {
    try { payload = { notification: { body: event.data.text() } }; } catch (e2) { payload = {}; }
  }
  const n = payload.notification || {};
  const data = payload.data || {};
  event.waitUntil(self.registration.showNotification(n.title || data.title || 'משימות בית הבירה', {
    body: n.body || data.body || '',
    icon: '/TODO/icon-192.png',
    badge: '/TODO/icon-192.png',
    dir: 'rtl',
    lang: 'he',
    tag: data.taskId ? 'task-' + data.taskId : undefined,
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: { link: data.link || '/tasks/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/tasks/';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) if (c.url.includes('/tasks') && 'focus' in c) return c.focus();
    return self.clients.openWindow(link);
  }));
});
