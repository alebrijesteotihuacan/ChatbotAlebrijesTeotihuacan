#!/usr/bin/env node
/**
 * Configura las variables de entorno en Vercel leyendo el .env local.
 *
 * El token de Vercel se lee de la variable de entorno VERCEL_TOKEN.
 * Uso:
 *   export VERCEL_TOKEN=xxx
 *   node scripts/setup-vercel-env.js
 */

require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;

if (!VERCEL_TOKEN) {
  console.error('ERROR: VERCEL_TOKEN no esta definido');
  console.error('  export VERCEL_TOKEN=tu_token');
  console.error('  node scripts/setup-vercel-env.js');
  process.exit(1);
}

const envContent = fs.readFileSync('.env', 'utf8');
const lines = envContent.split('\n').filter(l => l && !l.startsWith('#'));

const vars = [];
for (const line of lines) {
  const [key, ...valueParts] = line.split('=');
  if (!key) continue;
  const value = valueParts.join('=').trim();
  if (key.includes('VERCEL_TOKEN') || key.includes('MANAGEMENT_TOKEN')) continue;
  vars.push({ key: key.trim(), value });
}

console.log(`Configurando ${vars.length} variables de entorno en Vercel (production)...\n`);

for (const { key, value } of vars) {
  try {
    execSync(`vercel env add ${key} production --yes --token ${VERCEL_TOKEN}`, {
      input: value,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: 'powershell.exe'
    });
    console.log(`  [OK] ${key}`);
  } catch (e) {
    try {
      execSync(`vercel env rm ${key} production --yes --token ${VERCEL_TOKEN}`, { stdio: 'pipe', shell: 'powershell.exe' });
      execSync(`vercel env add ${key} production --yes --token ${VERCEL_TOKEN}`, {
        input: value,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: 'powershell.exe'
      });
      console.log(`  [OK-Updated] ${key}`);
    } catch (e2) {
      console.log(`  [FAIL] ${key}`);
    }
  }
}

console.log('\nListo');
