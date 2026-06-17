require('dotenv').config();

const { supabaseAdmin } = require('../src/lib/supabase');
const { processIncomingMessage } = require('../src/bot/engine');

const loginHandler = require('../api/auth/login');
const listHandler = require('../api/messages/index');
const sendHandler = require('../api/messages/send');

function mockReqRes(method, body, query = {}, headers = {}) {
  const req = { method, body, query, headers };
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
    send(data) { this.body = data; return this; },
    end() { return this; }
  };
  return { req, res };
}

async function login() {
  const { req, res } = mockReqRes('POST', {
    email: 'admin@alebrijesteotihuacan.com',
    password: 'Alebrijes2026!'
  });
  await loginHandler(req, res);
  if (res.statusCode !== 200) throw new Error('Login fallo');
  return res.body.token;
}

async function seedConversationWithMessages() {
  const phone = '+525555200001';
  await supabaseAdmin.from('contacts').delete().eq('phone', phone);

  const { data: contact } = await supabaseAdmin
    .from('contacts')
    .insert({ phone, name: 'Mensajes Test' })
    .select()
    .single();

  const { data: conv } = await supabaseAdmin
    .from('conversations')
    .insert({
      contact_id: contact.id,
      phone,
      status: 'active',
      bot_active: true,
      current_flow: 'menu',
      current_step: 'start'
    })
    .select()
    .single();

  await processIncomingMessage({ from: phone, text: 'hola', messageId: 'm1' });
  await processIncomingMessage({ from: phone, text: '1', messageId: 'm2' });

  return { phone, contactId: contact.id, conversationId: conv.id };
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

async function testListBasic(token, conversationId) {
  console.log('\n--- Test 1: Listar mensajes de conversacion ---');
  const { req, res } = mockReqRes('GET', null, { conversation_id: conversationId }, { authorization: `Bearer ${token}` });
  await listHandler(req, res);
  console.log(`Status: ${res.statusCode} | Mensajes: ${res.body.messages?.length}`);
  if (res.statusCode === 200 && res.body.messages?.length > 0) {
    console.log(`  Conv: ${res.body.conversation.phone} bot_active=${res.body.conversation.bot_active}`);
    res.body.messages.forEach((m, i) => {
      console.log(`  ${i + 1}. [${m.direction}/${m.sent_by}] "${m.content.substring(0, 50).replace(/\n/g, ' ')}"`);
    });
  }
  return res.statusCode === 200 && res.body.messages?.length >= 4;
}

async function testListOrdered(token, conversationId) {
  console.log('\n--- Test 2: Mensajes ordenados ascendente por timestamp ---');
  const { req, res } = mockReqRes('GET', null, { conversation_id: conversationId }, { authorization: `Bearer ${token}` });
  await listHandler(req, res);
  const msgs = res.body.messages || [];
  let isOrdered = true;
  for (let i = 1; i < msgs.length; i++) {
    if (new Date(msgs[i].created_at) < new Date(msgs[i - 1].created_at)) {
      isOrdered = false;
      break;
    }
  }
  console.log(`Status: ${res.statusCode} | Orden correcto: ${isOrdered}`);
  return isOrdered;
}

async function testListMissingConvId(token) {
  console.log('\n--- Test 3: Sin conversation_id ---');
  const { req, res } = mockReqRes('GET', null, {}, { authorization: `Bearer ${token}` });
  await listHandler(req, res);
  console.log(`Status: ${res.statusCode} body: ${JSON.stringify(res.body)}`);
  return res.statusCode === 400;
}

async function testListConvNotFound(token) {
  console.log('\n--- Test 4: Conversacion inexistente ---');
  const fakeId = '00000000-0000-0000-0000-000000000000';
  const { req, res } = mockReqRes('GET', null, { conversation_id: fakeId }, { authorization: `Bearer ${token}` });
  await listHandler(req, res);
  console.log(`Status: ${res.statusCode}`);
  return res.statusCode === 404;
}

async function testListNoAuth() {
  console.log('\n--- Test 5: Sin token ---');
  const { req, res } = mockReqRes('GET', null, { conversation_id: '00000000-0000-0000-0000-000000000000' });
  await listHandler(req, res);
  console.log(`Status: ${res.statusCode}`);
  return res.statusCode === 401;
}

async function testListMethodNotAllowed(token, conversationId) {
  console.log('\n--- Test 6: POST en /api/messages ---');
  const { req, res } = mockReqRes('POST', { x: 1 }, { conversation_id: conversationId }, { authorization: `Bearer ${token}` });
  await listHandler(req, res);
  console.log(`Status: ${res.statusCode}`);
  return res.statusCode === 405;
}

async function testListLimit(token, conversationId) {
  console.log('\n--- Test 7: Limit custom ---');
  const { req, res } = mockReqRes('GET', null, { conversation_id: conversationId, limit: '2' }, { authorization: `Bearer ${token}` });
  await listHandler(req, res);
  console.log(`Status: ${res.statusCode} | returned=${res.body.pagination?.returned} has_more=${res.body.pagination?.has_more}`);
  return res.statusCode === 200 && res.body.messages.length === 2;
}

async function testSendSuccess(token, conversationId, phone) {
  console.log('\n--- Test 8: Enviar mensaje humano ---');
  const content = `Mensaje desde test ${Date.now()}`;
  const { req, res } = mockReqRes('POST', { conversation_id: conversationId, content }, {}, { authorization: `Bearer ${token}` });
  await sendHandler(req, res);
  console.log(`Status: ${res.statusCode}`);
  if (res.statusCode === 200) {
    console.log(`  wa_id: ${res.body.message.wa_id}`);
    console.log(`  sent_by: ${res.body.message.sent_by}`);
    console.log(`  attempts: ${res.body.attempts} elapsed_ms: ${res.body.elapsed_ms}`);
  } else {
    console.log(`  Error: ${JSON.stringify(res.body)}`);
  }
  return res.statusCode === 200 && res.body.message.sent_by === 'human';
}

async function testSendVerifyStored(conversationId, contentSnippet) {
  console.log('\n--- Test 9: Verificar mensaje guardado en BD ---');
  const { data: msgs } = await supabaseAdmin
    .from('messages')
    .select('direction, sent_by, content, metadata')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (msgs && msgs[0]) {
    const m = msgs[0];
    console.log(`  direction=${m.direction} sent_by=${m.sent_by}`);
    console.log(`  metadata.source=${m.metadata?.source} sent_by_user_email=${m.metadata?.sent_by_user_email}`);
    return m.direction === 'outbound' && m.sent_by === 'human' && m.content.includes(contentSnippet);
  }
  return false;
}

async function testSendMissingContent(token, conversationId) {
  console.log('\n--- Test 10: Send sin content ---');
  const { req, res } = mockReqRes('POST', { conversation_id: conversationId }, {}, { authorization: `Bearer ${token}` });
  await sendHandler(req, res);
  console.log(`Status: ${res.statusCode}`);
  return res.statusCode === 400;
}

async function testSendConvNotFound(token) {
  console.log('\n--- Test 11: Send a conv inexistente ---');
  const fakeId = '00000000-0000-0000-0000-000000000000';
  const { req, res } = mockReqRes('POST', { conversation_id: fakeId, content: 'hola' }, {}, { authorization: `Bearer ${token}` });
  await sendHandler(req, res);
  console.log(`Status: ${res.statusCode}`);
  return res.statusCode === 404;
}

async function testSendNoAuth(conversationId) {
  console.log('\n--- Test 12: Send sin token ---');
  const { req, res } = mockReqRes('POST', { conversation_id: conversationId, content: 'hola' });
  await sendHandler(req, res);
  console.log(`Status: ${res.statusCode}`);
  return res.statusCode === 401;
}

async function testSendMethodNotAllowed(token, conversationId) {
  console.log('\n--- Test 13: GET en /api/messages/send ---');
  const { req, res } = mockReqRes('GET', null, {}, { authorization: `Bearer ${token}` });
  await sendHandler(req, res);
  console.log(`Status: ${res.statusCode}`);
  return res.statusCode === 405;
}

async function testSendTooLong(token, conversationId) {
  console.log('\n--- Test 14: Content demasiado largo ---');
  const longContent = 'a'.repeat(5000);
  const { req, res } = mockReqRes('POST', { conversation_id: conversationId, content: longContent }, {}, { authorization: `Bearer ${token}` });
  await sendHandler(req, res);
  console.log(`Status: ${res.statusCode}`);
  return res.statusCode === 400;
}

async function main() {
  const phone = '+525555200001';
  await cleanup(phone);

  try {
    const token = await login();
    const { conversationId } = await seedConversationWithMessages();

    const tests = [
      { name: 'Listar mensajes', fn: () => testListBasic(token, conversationId) },
      { name: 'Orden ascendente', fn: () => testListOrdered(token, conversationId) },
      { name: 'Sin conversation_id', fn: () => testListMissingConvId(token) },
      { name: 'Conv no encontrada', fn: () => testListConvNotFound(token) },
      { name: 'Sin auth', fn: () => testListNoAuth() },
      { name: 'POST no permitido', fn: () => testListMethodNotAllowed(token, conversationId) },
      { name: 'Limit custom', fn: () => testListLimit(token, conversationId) },
      { name: 'Enviar mensaje', fn: () => testSendSuccess(token, conversationId, phone) },
      { name: 'Verificar almacenamiento', fn: () => testSendVerifyStored(conversationId, 'Mensaje desde test') },
      { name: 'Send sin content', fn: () => testSendMissingContent(token, conversationId) },
      { name: 'Send conv inexistente', fn: () => testSendConvNotFound(token) },
      { name: 'Send sin auth', fn: () => testSendNoAuth(conversationId) },
      { name: 'GET no permitido', fn: () => testSendMethodNotAllowed(token, conversationId) },
      { name: 'Content muy largo', fn: () => testSendTooLong(token, conversationId) }
    ];

    const results = [];
    for (const t of tests) {
      try {
        const ok = await t.fn();
        results.push({ name: t.name, pass: ok });
        console.log(`  ${ok ? 'OK' : 'FAIL'}`);
      } catch (e) {
        results.push({ name: t.name, pass: false, error: e.message });
        console.log(`  FAIL: ${e.message}`);
      }
    }

    console.log('\n=== Resumen ===');
    results.forEach(r => console.log(`${r.pass ? 'OK  ' : 'FAIL'} ${r.name}`));
    const passed = results.filter(r => r.pass).length;
    console.log(`\n${passed}/${results.length} tests pasaron`);

    await cleanup(phone);
  } catch (e) {
    console.error('Error fatal:', e);
    await cleanup(phone);
    process.exit(1);
  }
}

main();
