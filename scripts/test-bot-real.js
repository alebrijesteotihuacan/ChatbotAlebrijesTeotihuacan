require('dotenv').config();

const { supabaseAdmin } = require('../src/lib/supabase');
const { processIncomingMessage } = require('../src/bot/engine');

const SCENARIOS = [
  {
    name: 'Escenario 1: Usuario nuevo ve menu',
    phone: '+525555000001',
    messages: [
      { text: 'hola', desc: 'usuario nuevo' }
    ]
  },
  {
    name: 'Escenario 2: Escuela - Flujo exitoso con datos validos (edad 9)',
    phone: '+525555000002',
    messages: [
      { text: 'menu', desc: 'ver menu' },
      { text: '1', desc: 'elegir Escuela' },
      { text: 'A', desc: 'elegir turno matutino' },
      { text: 'Carlos Lopez Mendez\n9 anos\nDelantero\nMaria Lopez', desc: 'datos del jugador' }
    ]
  },
  {
    name: 'Escenario 3: Escuela - Edad fuera de rango (15 anos)',
    phone: '+525555000003',
    messages: [
      { text: 'menu', desc: 'ver menu' },
      { text: '1', desc: 'elegir Escuela' },
      { text: 'B', desc: 'elegir turno vespertino' },
      { text: 'Pedro Ramirez\n15 anos\nMediocampista\nAna Ramirez', desc: 'datos con edad invalida' }
    ]
  },
  {
    name: 'Escenario 4: TDP - Flujo exitoso (nacido 2008)',
    phone: '+525555000004',
    messages: [
      { text: 'menu', desc: 'ver menu' },
      { text: '2', desc: 'elegir TDP' },
      { text: 'Juan Hernandez Garcia\n2008\nDefensa Central', desc: 'datos TDP' }
    ]
  },
  {
    name: 'Escenario 5: TDP - Anio fuera de rango (2015)',
    phone: '+525555000005',
    messages: [
      { text: 'menu', desc: 'ver menu' },
      { text: '2', desc: 'elegir TDP' },
      { text: 'Luis Perez\n2015\nPortero', desc: 'datos con anio invalido' }
    ]
  },
  {
    name: 'Escenario 6: Piloto - Flujo exitoso (nacido 2003)',
    phone: '+525555000006',
    messages: [
      { text: 'menu', desc: 'ver menu' },
      { text: '3', desc: 'elegir Piloto' },
      { text: 'Roberto Silva\n2003\nExtremo derecho Diestro', desc: 'datos Piloto' }
    ]
  },
  {
    name: 'Escenario 7: Piloto - Anio fuera de rango (2010)',
    phone: '+525555000007',
    messages: [
      { text: 'menu', desc: 'ver menu' },
      { text: '3', desc: 'elegir Piloto' },
      { text: 'Mario Vega\n2010\nDelantero Zurdo', desc: 'datos con anio invalido' }
    ]
  },
  {
    name: 'Escenario 8: FAQ - categorias y horarios',
    phone: '+525555000008',
    messages: [
      { text: 'menu', desc: 'ver menu' },
      { text: '4', desc: 'elegir FAQ' },
      { text: '1', desc: 'horarios y ubicacion' },
      { text: 'menu', desc: 'volver al menu' }
    ]
  },
  {
    name: 'Escenario 9: Reset con "menu" desde cualquier paso',
    phone: '+525555000009',
    messages: [
      { text: '1', desc: 'elegir Escuela' },
      { text: 'menu', desc: 'resetear a menu' }
    ]
  }
];

async function cleanup(phone) {
  const { data: conv } = await supabaseAdmin
    .from('conversations')
    .select('id')
    .eq('phone', phone);

  if (conv && conv.length > 0) {
    const convIds = conv.map(c => c.id);
    await supabaseAdmin.from('registrations').delete().in('conversation_id', convIds);
    await supabaseAdmin.from('messages').delete().in('conversation_id', convIds);
    await supabaseAdmin.from('conversations').delete().in('id', convIds);
  }
  await supabaseAdmin.from('contacts').delete().eq('phone', phone);
}

async function runScenario(scenario) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(scenario.name);
  console.log(`Telefono: ${scenario.phone}`);
  console.log('='.repeat(70));

  for (const msg of scenario.messages) {
    console.log(`\n  >> [${msg.desc}] envia: "${msg.text.replace(/\n/g, ' | ')}"`);
    try {
      const result = await processIncomingMessage({
        from: scenario.phone,
        text: msg.text,
        messageId: `test-${Date.now()}-${Math.random()}`,
        contactName: 'Test User'
      });
      console.log(`     -> flow=${result.response_flow || '-'} step=${result.response_step || '-'} sent_ok=${result.sent_ok} validation_failed=${result.validation_failed || false}`);
    } catch (err) {
      console.error(`     !! Error: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  const { data: msgs } = await supabaseAdmin
    .from('messages')
    .select('direction, type, sent_by, content')
    .eq('conversation_id',
      (await supabaseAdmin.from('conversations').select('id').eq('phone', scenario.phone).order('updated_at', { ascending: false }).limit(1).maybeSingle())?.data?.id || '00000000-0000-0000-0000-000000000000'
    )
    .order('created_at', { ascending: true });

  console.log(`\n  Mensajes (${msgs?.length || 0}):`);
  msgs?.forEach((m, i) => {
    const preview = m.content.substring(0, 70).replace(/\n/g, ' ');
    console.log(`    ${i + 1}. [${m.direction}/${m.type}/${m.sent_by}] ${preview}${m.content.length > 70 ? '...' : ''}`);
  });

  const { data: regs } = await supabaseAdmin
    .from('registrations')
    .select('category, player_name, age, birth_year, position, schedule, tutor_name, profile')
    .eq('contact_phone', scenario.phone);

  if (regs && regs.length > 0) {
    console.log(`\n  Registros guardados (${regs.length}):`);
    regs.forEach((r, i) => {
      console.log(`    ${i + 1}. [${r.category}] ${r.player_name} | edad=${r.age || '-'} año=${r.birth_year || '-'} | pos=${r.position || '-'} | turno=${r.schedule || '-'} | tutor=${r.tutor_name || '-'} | perfil=${r.profile || '-'}`);
    });
  }
}

async function main() {
  console.log('=== TEST E2E: Flujos del Bot Alebrijes Teotihuacan ===\n');

  for (const scenario of SCENARIOS) {
    await cleanup(scenario.phone);
  }

  for (const scenario of SCENARIOS) {
    await runScenario(scenario);
  }

  console.log('\n' + '='.repeat(70));
  console.log('Limpieza final...');
  for (const scenario of SCENARIOS) {
    await cleanup(scenario.phone);
  }
  console.log('OK');
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
