require('dotenv').config();

const { supabaseAdmin } = require('../src/lib/supabase');
const { processIncomingMessage } = require('../src/bot/engine');

(async () => {
  // Limpiar planes de prueba existentes
  await supabaseAdmin.from('catalog_plans').delete().eq('category', 'test-bot');

  // Crear 3 planes de prueba
  const { data: plans, error } = await supabaseAdmin
    .from('catalog_plans')
    .insert([
      { name: 'Plan Pre-Infantil', description: 'Iniciacion deportiva para los mas pequenos. 2 dias por semana, lunes y miercoles.', price: 800, category: 'test-bot', is_active: true },
      { name: 'Plan Infantil', description: 'Entrenamiento para ninos de 7-10 anos. 3 dias por semana.', price: 1200, category: 'test-bot', is_active: true },
      { name: 'Plan Juvenil', description: 'Para adolescentes de 11-16 anos. 4 dias por semana + partidos sabatinos.', price: 1500, category: 'test-bot', is_active: true }
    ])
    .select();

  if (error) {
    console.error('Error creando planes:', error);
    return;
  }

  console.log(`Creados ${plans.length} planes de prueba\n`);

  // Test: usuario pide ver planes
  const phone = '+525555999111';
  console.log('--- Escenario: Ver catalogo con planes ---');
  await processIncomingMessage({ from: phone, text: 'menu', messageId: 'm1', contactName: 'Carlos' });
  await processIncomingMessage({ from: phone, text: '1', messageId: 'm2' }); // Catalogo
  await processIncomingMessage({ from: phone, text: '1', messageId: 'm3' }); // Plan 1 (Pre-Infantil)
  await processIncomingMessage({ from: phone, text: '1', messageId: 'm4' }); // Hablar con persona

  // Verificar mensajes guardados
  const { data: msgs } = await supabaseAdmin
    .from('messages')
    .select('direction, sent_by, content, created_at')
    .order('created_at', { ascending: true });

  console.log(`\n=== Mensajes en la conversacion (${msgs.length} total) ===`);
  msgs?.forEach((m, i) => {
    const preview = m.content.substring(0, 80).replace(/\n/g, ' ');
    console.log(`  ${i + 1}. [${m.direction}/${m.sent_by}] ${preview}${m.content.length > 80 ? '...' : ''}`);
  });

  // Verificar estado de la conversacion
  const { data: conv } = await supabaseAdmin
    .from('conversations')
    .select('current_flow, current_step, flow_data, bot_active')
    .eq('phone', phone)
    .single();

  console.log('\n=== Estado final de la conversacion ===');
  console.log(`  current_flow: ${conv?.current_flow}`);
  console.log(`  current_step: ${conv?.current_step}`);
  console.log(`  bot_active: ${conv?.bot_active}`);
  console.log(`  flow_data:`, JSON.stringify(conv?.flow_data));

  // Limpiar
  await supabaseAdmin.from('messages').delete().like('content', '%');
  await supabaseAdmin.from('conversations').delete().eq('phone', phone);
  await supabaseAdmin.from('contacts').delete().eq('phone', phone);
  await supabaseAdmin.from('catalog_plans').delete().eq('category', 'test-bot');
  console.log('\nLimpieza OK');
})();
