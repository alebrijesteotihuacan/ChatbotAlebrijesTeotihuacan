require('dotenv').config();

const https = require('https');

const PROJECT_REF = 'sjajkaqenarsnaevhzko';
const MANAGEMENT_TOKEN = process.env.SUPABASE_MANAGEMENT_TOKEN;

if (!MANAGEMENT_TOKEN) {
  console.error('Error: SUPABASE_MANAGEMENT_TOKEN no esta en .env');
  process.exit(1);
}

const sql = require('fs').readFileSync(
  require('path').join(__dirname, '..', 'supabase', 'migrations', '002_registrations.sql'),
  'utf8'
);

const data = JSON.stringify({ query: sql });

const options = {
  hostname: 'api.supabase.com',
  port: 443,
  path: `/v1/projects/${PROJECT_REF}/database/query`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${MANAGEMENT_TOKEN}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log('Migracion 002_registrations aplicada OK');
      console.log('Tabla registrations creada con indices, RLS y realtime');
    } else {
      console.error(`Error ${res.statusCode}:`, body);
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.error('Error de red:', e.message);
  process.exit(1);
});

req.write(data);
req.end();
