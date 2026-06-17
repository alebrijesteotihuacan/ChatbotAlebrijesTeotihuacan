#!/usr/bin/env node
/**
 * Crea un usuario admin en Supabase Auth via GoTrue admin API.
 *
 * Usa la service_role key que tiene permisos administrativos sobre auth.users.
 */

require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@alebrijesteotihuacan.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Alebrijes2026!';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Administrador';

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  console.log(`Creando usuario admin: ${ADMIN_EMAIL}`);

  // admin.createUser con service_role
  const { data, error } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: ADMIN_NAME }
  });

  if (error) {
    if (error.message.includes('already') || error.status === 422) {
      console.log('  El usuario ya existe. Buscando...');

      // Listar usuarios
      const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
      if (listError) {
        console.error('  Error listando usuarios:', listError.message);
        process.exit(1);
      }

      const existing = listData.users.find(u => u.email === ADMIN_EMAIL);
      if (!existing) {
        console.error('  No se encontró el usuario existente');
        process.exit(1);
      }
      console.log('  Usuario encontrado:', existing.id);
      await registerDashboardUser(supabase, existing.id);
      console.log('\n=== USUARIO ADMIN LISTO ===');
      console.log(`  Email:    ${existing.email}`);
      console.log(`  ID:       ${existing.id}`);
      return;
    }
    console.error('  Error:', error.message);
    process.exit(1);
  }

  console.log('  Usuario creado:', data.user.id);
  await registerDashboardUser(supabase, data.user.id);
  console.log('\n=== USUARIO ADMIN LISTO ===');
  console.log(`  Email:    ${data.user.email}`);
  console.log(`  ID:       ${data.user.id}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
  console.log('\n  Guarda estas credenciales en un lugar seguro.');
}

async function registerDashboardUser(supabase, authUserId) {
  const { data: existing } = await supabase
    .from('dashboard_users')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (existing) {
    console.log('  dashboard_user ya existe');
  } else {
    const { error } = await supabase
      .from('dashboard_users')
      .insert({ auth_user_id: authUserId, display_name: ADMIN_NAME });
    if (error) throw error;
    console.log('  dashboard_user registrado');
  }
}

main().catch(e => { console.error('ERROR:', e); process.exit(1); });
