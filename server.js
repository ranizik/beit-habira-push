const https = require('https');
const http = require('http');

const FIREBASE_HOST = 'orders-app-78c0f-default-rtdb.europe-west1.firebasedatabase.app';
const ONESIGNAL_APP_ID = '0d7c05f2-fa00-4366-9d13-6799072e739b';
const ONESIGNAL_API_KEY = 'os_v2_app_bv6al4x2abbwnhitm6mqolttto72mdezl7ruf3vb6g6uh7zljgnsst5mqdilvgk7oglvvgmwyv4zvra6qhxfxbs223vwheqt75pbfqi';

let lastProcessed = {};

function sendPush(title, body) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      app_id: ONESIGNAL_APP_ID,
      included_segments: ['Total Subscriptions'],
      headings: { en: title },
      contents: { en: body },
      url: 'https://beit-habira.com/tasks'
    });

    const options = {
      hostname: 'api.onesignal.com',
      path: '/notifications',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Key ' + ONESIGNAL_API_KEY,
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('OneSignal response:', data);
        resolve(data);
      });
    });
    req.on('error', (e) => { console.error('Push error:', e.message); resolve(null); });
    req.write(payload);
    req.end();
  });
}

function firebaseGet(path) {
  return new Promise((resolve) => {
    const options = {
      hostname: FIREBASE_HOST,
      path: path + '.json',
      method: 'GET'
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

function firebaseDelete(path) {
  return new Promise((resolve) => {
    const options = {
      hostname: FIREBASE_HOST,
      path: path + '.json',
      method: 'DELETE'
    };
    const req = https.request(options, (res) => {
      res.on('data', () => {});
      res.on('end', resolve);
    });
    req.on('error', () => resolve());
    req.end();
  });
}

async function checkQueue() {
  try {
    const queue = await firebaseGet('/bb_push_queue');
    if (!queue || typeof queue !== 'object') return;

    for (const [key, item] of Object.entries(queue)) {
      if (!item || lastProcessed[key]) continue;
      lastProcessed[key] = true;
      console.log('Sending push:', item.title, '-', item.body);
      await sendPush(item.title || 'בית הבירה', item.body || '');
      await firebaseDelete('/bb_push_queue/' + key);
    }

    const keys = Object.keys(lastProcessed);
    if (keys.length > 200) keys.slice(0, 100).forEach(k => delete lastProcessed[k]);
  } catch(e) {
    console.error('Queue error:', e.message);
  }
}

setInterval(checkQueue, 4000);
checkQueue();
console.log('Push server started');

http.createServer((req, res) => {
  res.writeHead(200);
  res.end('OK');
}).listen(process.env.PORT || 3000);
