require('dotenv').config();

const crypto = require('crypto');
const https = require('https');

const APP_SECRET = process.env.META_APP_SECRET;
const WEBHOOK_URL = 'https://alebrijes-chatbot.vercel.app/api/webhook';

if (!APP_SECRET) {
  console.error('Falta META_APP_SECRET en .env');
  process.exit(1);
}

function postWebhook(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const sig = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(body, 'utf8').digest('hex');

    const url = new URL(WEBHOOK_URL);
    const req = https.request({
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-Hub-Signature-256': sig
      }
    }, (res) => {
      let respBody = '';
      res.on('data', chunk => respBody += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: respBody }));
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function buildPayload(from, text, contactName) {
  return {
    object: 'whatsapp_business_account',
    entry: [{
      id: '903725979444809',
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          metadata: { display_phone_number: '15555555555', phone_number_id: '1181282128398668' },
          contacts: contactName ? [{ profile: { name: contactName } }] : [],
          messages: [{
            from,
            id: `wamid.e2e.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`,
            timestamp: Math.floor(Date.now() / 1000).toString(),
            type: 'text',
            text: { body: text }
          }]
        },
        field: 'messages'
      }]
    }]
  };
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  const phone = '+525555000500';
  const steps = [
    { text: 'menu', desc: 'ver menu' },
    { text: '1', desc: 'elegir Escuela' },
    { text: 'A', desc: 'turno matutino' },
    { text: 'Carlos Lopez\n9 anos\nDelantero\nMaria Lopez', desc: 'datos' }
  ];

  console.log(`=== Test E2E contra ${WEBHOOK_URL} ===\n`);

  for (const step of steps) {
    console.log(`>> [${step.desc}] envia: "${step.text.replace(/\n/g, ' | ')}"`);
    const payload = buildPayload(phone, step.text, 'E2E Test');
    try {
      const r = await postWebhook(payload);
      console.log(`   status=${r.status} body=${r.body.substring(0, 200)}\n`);
    } catch (e) {
      console.error(`   ERROR: ${e.message}\n`);
    }
    await sleep(2000);
  }
}

run().catch(e => { console.error(e); process.exit(1); });
