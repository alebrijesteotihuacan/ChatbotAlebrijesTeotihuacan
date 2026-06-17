#!/usr/bin/env node
/**
 * Aplica la migración SQL al proyecto de Supabase usando la Management API.
 *
 * REQUISITOS:
 * - SUPABASE_MANAGEMENT_TOKEN: Personal Access Token de https://supabase.com/dashboard/account/tokens
 *   (NO es el service_role key, es un token de management)
 *
 * Uso:
 *   SUPABASE_MANAGEMENT_TOKEN=sbp_xxx node scripts/apply-migration.js
 *   o setearlo en .env como SUPABASE_MANAGEMENT_TOKEN
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const PROJECT_REF = 'sjajkaqenarsnaevhzko';
const MGMT_TOKEN = process.env.SUPABASE_MANAGEMENT_TOKEN;

if (!MGMT_TOKEN) {
  console.error('ERROR: SUPABASE_MANAGEMENT_TOKEN no está definido en .env');
  console.error('Obtén uno en: https://supabase.com/dashboard/account/tokens');
  console.error('Agrégalo a tu .env: SUPABASE_MANAGEMENT_TOKEN=sbp_xxx...');
  process.exit(1);
}

const migrationFile = path.join(__dirname, '..', 'supabase', 'migrations', '001_initial_schema.sql');
const sql = fs.readFileSync(migrationFile, 'utf8');

async function applyMigration() {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

  console.log(`Aplicando migración a proyecto ${PROJECT_REF}...`);
  console.log(`SQL length: ${sql.length} chars\n`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MGMT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  const text = await response.text();

  if (!response.ok) {
    console.error(`Error HTTP ${response.status}:`);
    console.error(text);
    process.exit(1);
  }

  console.log('Migración aplicada exitosamente');
  console.log('Respuesta:', text);
}

applyMigration().catch(e => {
  console.error('Error fatal:', e);
  process.exit(1);
});
