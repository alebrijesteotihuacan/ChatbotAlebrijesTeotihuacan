require('dotenv').config();

const axios = require('axios');
const { supabaseAdmin } = require('../src/lib/supabase');

const sender = require('../src/bot/sender');

let originalPost;

function mockMetaResponseOnce(status, data) {
  axios.post = async () => {
    if (status >= 200 && status < 300) {
      return { data };
    }
    const error = new Error(`Request failed with status code ${status}`);
    error.response = { status, data };
    throw error;
  };
}

function restoreAxios() {
  if (originalPost) axios.post = originalPost;
}

async function getOrCreateTestConv(phone) {
  const { data: contact } = await supabaseAdmin
    .from('contacts')
    .upsert({ phone, name: 'Sender Test' }, { onConflict: 'phone' })
    .select()
    .single();

  const { data: conv } = await supabaseAdmin
    .from('conversations')
    .select('*')
    .eq('contact_id', contact.id)
    .eq('status', 'active')
    .maybeSingle();

  if (conv) return conv;

  const { data: created } = await supabaseAdmin
    .from('conversations')
    .insert({ contact_id: contact.id, phone, status: 'active', bot_active: true })
    .select()
    .single();

  return created;
}

async function cleanup(phone) {
  const { data: conv } = await supabaseAdmin
    .from('conversations')
    .select('id')
    .eq('phone', phone);

  if (conv && conv.length > 0) {
    const ids = conv.map(c => c.id);
    await supabaseAdmin.from('messages').delete().in('conversation_id', ids);
    await supabaseAdmin.from('conversations').delete().in('id', ids);
  }
  await supabaseAdmin.from('contacts').delete().eq('phone', phone);
}

async function testSuccess() {
  console.log('\n--- Test 1: Envio exitoso (sin mock, usa Meta real) ---');
  const phone = '+525555111111';
  const conv = await getOrCreateTestConv(phone);
  const start = Date.now();
  const result = await sender.sendAndStore({
    phone,
    conversationId: conv.id,
    content: 'Test sender - mensaje de prueba',
    type: 'text'
  });
  const elapsed = Date.now() - start;
  console.log(`Resultado: ok=${result.ok} wa_id=${result.messageId} elapsed=${elapsed}ms attempts=${result.attempts}`);
  await cleanup(phone);
  return result.ok;
}

async function testMissingParams() {
  console.log('\n--- Test 2: Parametros faltantes ---');
  const result1 = await sender.sendAndStore({});
  console.log(`Sin params: ok=${result1.ok} error="${result1.error}"`);

  const result2 = await sender.sendAndStore({ phone: '+525555000000' });
  console.log(`Sin content ni convId: ok=${result2.ok} error="${result2.error}"`);

  return !result1.ok && !result2.ok;
}

async function testInvalidPhone() {
  console.log('\n--- Test 3: Numero invalido (Meta codigo 131030) ---');
  const phone = '+525555222222';
  const conv = await getOrCreateTestConv(phone);

  mockMetaResponseOnce(400, {
    error: {
      message: 'Invalid phone number',
      code: 131030,
      type: 'OAuthException'
    }
  });

  const result = await sender.sendAndStore({
    phone: 'invalid_phone_123',
    conversationId: conv.id,
    content: 'Test con numero invalido',
    type: 'text'
  });
  console.log(`Resultado: ok=${result.ok} code=${result.errorCode} category=${result.errorCategory} retriable=${result.retriable} attempts=${result.attempts}`);

  const { data: msgs } = await supabaseAdmin
    .from('messages')
    .select('direction, sent_by, metadata, content')
    .eq('conversation_id', conv.id)
    .order('created_at', { ascending: false })
    .limit(1);

  if (msgs && msgs[0]) {
    console.log(`Mensaje persistido: dir=${msgs[0].direction} sent_by=${msgs[0].sent_by}`);
    console.log(`  send_error en metadata: ${JSON.stringify(msgs[0].metadata?.send_error)}`);
  }

  restoreAxios();
  await cleanup(phone);
  return !result.ok && result.errorCode === 131030;
}

async function testRateLimitRetry() {
  console.log('\n--- Test 4: Rate limit (codigo 130429) con reintento exitoso ---');
  const phone = '+525555333333';
  const conv = await getOrCreateTestConv(phone);

  let callCount = 0;
  axios.post = async () => {
    callCount++;
    if (callCount === 1) {
      const err = new Error('Rate limit hit');
      err.response = {
        status: 429,
        data: { error: { message: 'Rate limit', code: 130429 } }
      };
      throw err;
    }
    return {
      data: { messages: [{ id: `wamid.retry.${Date.now()}` }] }
    };
  };

  const start = Date.now();
  const result = await sender.sendAndStore({
    phone,
    conversationId: conv.id,
    content: 'Test con rate limit',
    type: 'text'
  });
  const elapsed = Date.now() - start;
  console.log(`Resultado: ok=${result.ok} wa_id=${result.messageId} attempts=${result.attempts} elapsed=${elapsed}ms`);
  console.log(`Llamadas a axios: ${callCount}`);

  restoreAxios();
  await cleanup(phone);
  return result.ok && callCount === 2;
}

async function testRateLimitExhausted() {
  console.log('\n--- Test 5: Rate limit persistente - se agotan los reintentos ---');
  const phone = '+525555444444';
  const conv = await getOrCreateTestConv(phone);

  let callCount = 0;
  axios.post = async () => {
    callCount++;
    const err = new Error('Rate limit');
    err.response = {
      status: 429,
      data: { error: { message: 'Rate limit hit', code: 130429 } }
    };
    throw err;
  };

  const result = await sender.sendAndStore({
    phone,
    conversationId: conv.id,
    content: 'Test con rate limit permanente',
    type: 'text'
  });
  console.log(`Resultado: ok=${result.ok} code=${result.errorCode} category=${result.errorCategory} attempts=${result.attempts}`);
  console.log(`Llamadas a axios: ${callCount} (esperado: 4 = 1 inicial + 3 reintentos)`);

  restoreAxios();
  await cleanup(phone);
  return !result.ok && callCount === 4;
}

async function testImageSend() {
  console.log('\n--- Test 6: Envio de imagen (sin mock, Meta real) ---');
  const phone = '+525555555555';
  const conv = await getOrCreateTestConv(phone);

  const result = await sender.sendImageAndStore({
    phone,
    conversationId: conv.id,
    imageKey: 'pase',
    caption: 'Tu pase de prueba'
  });
  console.log(`Resultado: ok=${result.ok} wa_id=${result.messageId} attempts=${result.attempts} elapsed=${result.elapsedMs}ms`);

  await cleanup(phone);
  return result.ok;
}

async function testMetrics() {
  console.log('\n--- Test 7: Metricas del sender ---');
  sender.resetMetrics();

  mockMetaResponseOnce(400, { error: { message: 'Invalid', code: 131030 } });
  const phone1 = '+525555666666';
  const conv1 = await getOrCreateTestConv(phone1);
  await sender.sendAndStore({ phone: 'bad', conversationId: conv1.id, content: 'test' });
  restoreAxios();
  await cleanup(phone1);

  const phone2 = '+525555777777';
  const conv2 = await getOrCreateTestConv(phone2);
  await sender.sendAndStore({ phone: phone2, conversationId: conv2.id, content: 'test real' });
  await cleanup(phone2);

  const metrics = sender.getMetrics();
  console.log('Metricas:', JSON.stringify(metrics, null, 2));

  return metrics.total >= 2;
}

async function testClassifyError() {
  console.log('\n--- Test 8: Clasificacion de errores ---');
  const cases = [
    { code: 100, expectedCategory: 'invalid_parameter' },
    { code: 131030, expectedCategory: 'invalid_phone' },
    { code: 131026, expectedCategory: 'undeliverable' },
    { code: 130429, expectedCategory: 'rate_limit', expectedRetry: true },
    { code: 500, expectedCategory: 'meta_server_error', expectedRetry: true },
    { code: 99999, expectedCategory: 'unknown', expectedRetry: false }
  ];

  let pass = true;
  for (const c of cases) {
    const info = sender.classifyError(c.code);
    const catOk = info.category === c.expectedCategory;
    const retryOk = c.expectedRetry === undefined || info.retry === c.expectedRetry;
    const ok = catOk && retryOk;
    if (!ok) pass = false;
    console.log(`  code=${c.code} -> category=${info.category} retry=${info.retry} ${ok ? 'OK' : 'FAIL'}`);
  }
  return pass;
}

async function main() {
  originalPost = axios.post;

  const tests = [
    { name: 'Envio exitoso', fn: testSuccess },
    { name: 'Parametros faltantes', fn: testMissingParams },
    { name: 'Numero invalido', fn: testInvalidPhone },
    { name: 'Rate limit con reintento exitoso', fn: testRateLimitRetry },
    { name: 'Rate limit agotado', fn: testRateLimitExhausted },
    { name: 'Envio de imagen', fn: testImageSend },
    { name: 'Metricas', fn: testMetrics },
    { name: 'Clasificacion de errores', fn: testClassifyError }
  ];

  let passed = 0;
  for (const t of tests) {
    try {
      const ok = await t.fn();
      console.log(ok ? `✓ ${t.name}` : `✗ ${t.name}`);
      if (ok) passed++;
    } catch (e) {
      console.error(`✗ ${t.name}: ${e.message}`);
      console.error(e.stack);
    }
  }

  console.log(`\n=== Resultado: ${passed}/${tests.length} tests pasaron ===`);
  restoreAxios();
}

main().catch(e => {
  console.error('Error fatal:', e);
  restoreAxios();
  process.exit(1);
});
