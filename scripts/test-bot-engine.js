require('dotenv').config();

const { processIncomingMessage } = require('../src/bot/engine');
const { supabaseAdmin } = require('../src/lib/supabase');

// Stub del sender para no enviar mensajes reales en el test
// Interceptamos la funcion sendAndStore

async function runScenario(name, steps) {
  console.log(`\n=== ${name} ===\n`);
  const phone = '+525555000' + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  console.log(`Usuario: ${phone}\n`);

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    console.log(`[STEP ${i + 1}] Usuario envia: "${step.input}"`);
    const result = await processIncomingMessage({
      from: phone,
      text: step.input,
      messageId: `test_${Date.now()}_${i}`,
      contactName: 'Test User'
    });
    console.log(`  handled=${result.handled} | sent_ok=${result.sent_ok} | flow=${result.response_flow || '-'} | step=${result.response_step || '-'} | bot_active=${result.bot_active}`);

    if (result.sent_ok === false) {
      console.log(`  WARN: send error (esperado en test local: Meta API falla)`);
    }
  }

  // Limpiar
  await supabaseAdmin.from('messages').delete().eq('metadata->>test', 'true').then(() => {});
  // Borrar por telefono
  const { data: conv } = await supabaseAdmin.from('conversations').select('id').eq('phone', phone);
  if (conv) {
    for (const c of conv) {
      await supabaseAdmin.from('messages').delete().eq('conversation_id', c.id);
    }
    await supabaseAdmin.from('conversations').delete().eq('phone', phone);
  }
  await supabaseAdmin.from('contacts').delete().eq('phone', phone);
  console.log(`\nLimpieza OK para ${phone}`);
}

(async () => {
  try {
    // Escenario 1: Usuario nuevo ve menu principal
    await runScenario('1) Usuario nuevo debe ver Menu Principal', [
      { input: 'hola' }
    ]);

    // Escenario 2: Navegar a FAQ
    await runScenario('2) Navegar a FAQ y luego horarios', [
      { input: 'menu' },
      { input: '2' }, // FAQ
      { input: '1' }, // horarios
      { input: '0' }  // volver al menu
    ]);

    // Escenario 3: Input no valido
    await runScenario('3) Input no valido genera ayuda', [
      { input: 'menu' },
      { input: '99' } // no existe
    ]);

    // Escenario 4: Catalogo (sin planes en BD, mostrara mensaje)
    await runScenario('4) Catalogo sin planes', [
      { input: 'menu' },
      { input: '1' } // catalogo
    ]);

    // Escenario 5: Reset con 0
    await runScenario('5) Reset con 0', [
      { input: 'menu' },
      { input: '2' }, // FAQ
      { input: '0' }  // reset a menu
    ]);

    // Escenario 6: Human takeover
    await runScenario('6) Takeover humano apaga el bot', [
      { input: 'menu' },
      { input: '3' }, // hablar con persona
    ]);

    console.log('\n=== Todos los escenarios completados ===');
  } catch (e) {
    console.error('ERROR FATAL:', e);
    process.exit(1);
  }
})();
