// Service Worker להתראות - תכל׳ס (tachlesapps.com; גם בכתובת הישנה beit-habira.com/tasks)
const BASE = self.registration.scope; // הכתובת שבה הוא רשום - '/' בחדשה, '/tasks/' בישנה
const ICON = new URL('icon-v3-192.png', BASE).href;
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
  // תזכורת למשימה עם שעה: כפתורי "בוצע" / "עוד 30 דק׳" (עובדים בלי לפתוח את האפליקציה)
  const actions = data.act ? [{ action: 'done', title: '✅ בוצע' }, { action: 'snooze', title: '⏰ עוד 30 דק׳' }] : [];
  event.waitUntil(self.registration.showNotification(n.title || data.title || 'תכל׳ס', {
    actions,
    body: n.body || data.body || '',
    icon: ICON,
    badge: ICON,
    dir: 'rtl',
    lang: 'he',
    tag: data.taskId ? 'task-' + data.taskId : undefined,
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: { link: data.link || BASE, act: data.act || '' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const act = event.notification.data && event.notification.data.act;
  if (act && (event.action === 'done' || event.action === 'snooze')) {
    event.waitUntil(fetch('https://beit-habira-api.onrender.com/tasks/nag/act', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: act, a: event.action }),
    }).then((r) => r.ok ? self.registration.showNotification(event.action === 'done' ? '✅ סומן כבוצע' : '⏰ אזכיר שוב בעוד 30 דקות', { body: event.notification.title.replace(/^[^:]*:\s*/, ''), icon: ICON, dir: 'rtl', tag: 'ack', requireInteraction: false, silent: true }) : null).catch(() => {}));
    return;
  }
  const link = (event.notification.data && event.notification.data.link) || BASE;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) if (c.url.startsWith(BASE) && 'focus' in c) return c.focus();
    return self.clients.openWindow(link);
  }));
});
