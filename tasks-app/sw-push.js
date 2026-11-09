// Service Worker להתראות - תכל׳ס (tachlesapps.com; גם בכתובת הישנה beit-habira.com/tasks)
const BASE = self.registration.scope; // הכתובת שבה הוא רשום - '/' בחדשה, '/tasks/' בישנה
const ICON = new URL('icon-v3-192.png', BASE).href;
// מציג תזכורות שמגיעות מהשרת (FCM) - גם כשהאפליקציה סגורה.
const MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(self.navigator.userAgent || '');
// ── עבודה גם כשהשרת לא עונה (504) או כשהרשת חוסמת את הכתובת ──
// דף האפליקציה: קודם מהרשת (כדי לקבל עדכונים), ואם אין תשובה תוך 4 שניות או שגיאה – מהעותק השמור.
// קבצים קבועים (אייקונים, מילונים, ספריות Firebase): מהעותק השמור, ומתעדכנים ברקע.
const CACHE = 'tachles-v1';
const SHELL = BASE; // כתובת דף האפליקציה ('/' או '/tasks/')
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => fetch(SHELL, { cache: 'no-store' }).then((r) => { if (r.ok) return c.put(SHELL, r); })).catch(() => {}));
});
self.addEventListener('activate', (event) => event.waitUntil(Promise.all([
  self.clients.claim(),
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('tachles-') && k !== CACHE).map((k) => caches.delete(k)))),
])));
const STATIC_EXT = /\.(png|svg|json|ico|woff2?)$/i;
const CDN = /^https:\/\/(www\.gstatic\.com\/firebasejs\/|fonts\.(googleapis|gstatic)\.com\/|cdn\.jsdelivr\.net\/npm\/@tabler)/;
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate' && req.url.startsWith(BASE)) {
    const path = url.pathname.slice(new URL(BASE).pathname.length);
    if (path && !/^(index\.html)?$/.test(path)) return; // דפים אחרים (פרטיות וכו') – כרגיל
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const net = fetch(req).then((r) => { if (r.ok) cache.put(SHELL, r.clone()); return r; });
      const timeout = new Promise((res) => setTimeout(() => res(null), 4000));
      try {
        const r = await Promise.race([net, timeout]);
        if (r && r.ok) return r;
      } catch (e) {}
      const cached = await cache.match(SHELL);
      if (cached) return cached;
      return net.catch(() => new Response('<meta charset="utf-8"><p style="font:18px sans-serif;text-align:center;margin-top:30vh">אין חיבור כרגע – נסה שוב בעוד רגע</p>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
    })());
    return;
  }
  const same = req.url.startsWith(BASE) && STATIC_EXT.test(url.pathname) && !/manifest/.test(url.pathname);
  if (same || CDN.test(req.url)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      const net = fetch(req).then((r) => { if (r.ok || r.type === 'opaque') cache.put(req, r.clone()); return r; }).catch(() => null);
      if (cached) { event.waitUntil(net); return cached; }
      return (await net) || Response.error();
    })());
  }
});

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (e) {
    try { payload = { notification: { body: event.data.text() } }; } catch (e2) { payload = {}; }
  }
  const n = payload.notification || {};
  const data = payload.data || {};
  // תזכורת למשימה עם שעה: כפתורי "בוצע" / "עוד 30 דק׳" (עובדים בלי לפתוח את האפליקציה)
  const RTL = !data.lang || data.lang === 'he' || data.lang === 'ar'; // השרת שולח את שפת המשתמש ואת שמות הכפתורים
  const actions = data.act ? [{ action: 'done', title: data.l1 || '✅ בוצע' }, { action: 'snooze', title: data.l2 || '⏰ עוד 30 דק׳' }] : [];
  event.waitUntil(self.registration.showNotification(n.title || data.title || 'תכל׳ס', {
    actions,
    body: n.body || data.body || '',
    icon: ICON,
    badge: ICON,
    dir: RTL ? 'rtl' : 'ltr',
    lang: data.lang || 'he',
    tag: data.taskId ? 'task-' + data.taskId : undefined,
    renotify: true,
    requireInteraction: MOBILE, // במחשב ההתראה נעלמת לבד למרכז ההודעות ולא נערמת על המסך
    vibrate: [200, 100, 200],
    data: { link: data.link || BASE, act: data.act || '', l3: data.l3 || '', l4: data.l4 || '', rtl: RTL },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const act = event.notification.data && event.notification.data.act;
  if (act && (event.action === 'done' || event.action === 'snooze')) {
    event.waitUntil(fetch('https://beit-habira-api.onrender.com/tasks/nag/act', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: act, a: event.action }),
    }).then((r) => r.ok ? self.registration.showNotification(event.action === 'done' ? (event.notification.data.l3 || '✅ סומן כבוצע') : (event.notification.data.l4 || '⏰ אזכיר שוב בעוד 30 דקות'), { body: event.notification.title.replace(/^[^:]*:\s*/, ''), icon: ICON, dir: event.notification.data.rtl === false ? 'ltr' : 'rtl', tag: 'ack', requireInteraction: false, silent: true }) : null).catch(() => {}));
    return;
  }
  const link = (event.notification.data && event.notification.data.link) || BASE;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) if (c.url.startsWith(BASE) && 'focus' in c) return c.focus();
    return self.clients.openWindow(link);
  }));
});
