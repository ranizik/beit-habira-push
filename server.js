const https = require('https');

// Config
const FIREBASE_URL = 'orders-app-78c0f-default-rtdb.europe-west1.firebasedatabase.app';
const ONESIGNAL_APP_ID = '0d7c05f2-fa00-4366-9d13-6799072e739b';
const ONESIGNAL_API_KEY = 'os_v2_app_bv6al4x2abbwnhitm6mqoltttnayn5ppgiiuax5ywcclctvhd43c6u2qkeophh2rab4zncy6apuhzxzvkust3avm2pmi4flepcgpgua';

let lastProcessed = {};

function sendPush(title, body, filters) {
  const payload = JSON.stringify({
    app_id: ONESIGNAL_APP_ID,
    headings: { en: title, he: title },
    contents: { en: body, he: body },
    filters: filters || [],
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
    res.on('end', () => console.log('Push sent:', data));
  });
  req.on('error', (e) => console.error('Push error:', e));
  req.write(payload);
  req.end();
}

function firebaseGet(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: FIREBASE_URL,
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
    req.on('error', reject);
    req.end();
  });
}

function firebaseDelete(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: FIREBASE_URL,
      path: path + '.json',
      method: 'DELETE'
    };
    const req = https.request(options, (res) => {
      res.on('data', () => {});
      res.on('end', resolve);
    });
    req.on('error', reject);
    req.end();
  });
}

async function checkQueue() {
  try {
    const queue = await firebaseGet('/bb_push_queue');
    if (!queue) return;

    for (const [key, item] of Object.entries(queue)) {
      if (lastProcessed[key]) continue;
      lastProcessed[key] = true;

      console.log('Processing:', item.title, item.body);

      // Build filters based on branch
      let filters = [];
      if (item.branch === 'telmond') {
        filters = [{ field: 'tag', key: 'branch', relation: '=', value: 'telmond' }];
      } else if (item.branch === 'shfayim') {
        filters = [{ field: 'tag', key: 'branch', relation: '=', value: 'shfayim' }];
      }
      // both or all = send to everyone (no filters)

      sendPush(item.title, item.body, filters);

      // Delete from queue
      await firebaseDelete('/bb_push_queue/' + key);
    }

    // Clean up old processed keys (keep last 100)
    const keys = Object.keys(lastProcessed);
    if (keys.length > 100) {
      keys.slice(0, keys.length - 100).forEach(k => delete lastProcessed[k]);
    }
  } catch(e) {
    console.error('Queue check error:', e);
  }
}

// Poll every 5 seconds
setInterval(checkQueue, 5000);
checkQueue();

// Keep-alive HTTP server (required by Render)
const http = require('http');
http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Beit Habira Push Server OK');
}).listen(process.env.PORT || 3000, () => {
  console.log('Push server running');
});
