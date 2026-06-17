require('dotenv').config();

const loginHandler = require('../api/auth/login');
const meHandler = require('../api/auth/me');

function mockReqRes(method, body, headers = {}) {
  const req = { method, body, headers };
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

async function testLoginSuccess() {
  console.log('\n--- Test 1: Login exitoso ---');
  const { req, res } = mockReqRes('POST', {
    email: 'admin@alebrijesteotihuacan.com',
    password: 'Alebrijes2026!'
  });
  await loginHandler(req, res);
  console.log(`Status: ${res.statusCode}`);
  if (res.statusCode === 200) {
    console.log(`Email: ${res.body.user.email}`);
    console.log(`User ID: ${res.body.user.id}`);
    console.log(`Token (primeros 50 chars): ${res.body.token?.substring(0, 50)}...`);
    console.log(`Expires in: ${res.body.expires_in}s`);
  } else {
    console.log(`Error: ${JSON.stringify(res.body)}`);
  }
  return res.statusCode === 200 ? res.body.token : null;
}

async function testLoginWrongPassword() {
  console.log('\n--- Test 2: Login con password incorrecta ---');
  const { req, res } = mockReqRes('POST', {
    email: 'admin@alebrijesteotihuacan.com',
    password: 'WrongPassword123!'
  });
  await loginHandler(req, res);
  console.log(`Status: ${res.statusCode} body: ${JSON.stringify(res.body)}`);
  return res.statusCode === 401;
}

async function testLoginMissingFields() {
  console.log('\n--- Test 3: Login sin email/password ---');
  const { req, res } = mockReqRes('POST', { email: 'test@test.com' });
  await loginHandler(req, res);
  console.log(`Status: ${res.statusCode} body: ${JSON.stringify(res.body)}`);
  return res.statusCode === 400;
}

async function testLoginInvalidEmail() {
  console.log('\n--- Test 4: Login con email invalido ---');
  const { req, res } = mockReqRes('POST', { email: 'not-an-email', password: '123' });
  await loginHandler(req, res);
  console.log(`Status: ${res.statusCode} body: ${JSON.stringify(res.body)}`);
  return res.statusCode === 400;
}

async function testLoginMethodNotAllowed() {
  console.log('\n--- Test 5: GET en /api/auth/login ---');
  const { req, res } = mockReqRes('GET', {});
  await loginHandler(req, res);
  console.log(`Status: ${res.statusCode} body: ${JSON.stringify(res.body)}`);
  return res.statusCode === 405;
}

async function testMeSuccess(token) {
  console.log('\n--- Test 6: /me con token valido ---');
  const { req, res } = mockReqRes('GET', null, { authorization: `Bearer ${token}` });
  await meHandler(req, res);
  console.log(`Status: ${res.statusCode}`);
  if (res.statusCode === 200) {
    console.log(`Email: ${res.body.user.email}`);
    console.log(`Profile: ${JSON.stringify(res.body.profile)}`);
  } else {
    console.log(`Error: ${JSON.stringify(res.body)}`);
  }
  return res.statusCode === 200;
}

async function testMeNoToken() {
  console.log('\n--- Test 7: /me sin token ---');
  const { req, res } = mockReqRes('GET', null, {});
  await meHandler(req, res);
  console.log(`Status: ${res.statusCode} body: ${JSON.stringify(res.body)}`);
  return res.statusCode === 401;
}

async function testMeInvalidToken() {
  console.log('\n--- Test 8: /me con token invalido ---');
  const { req, res } = mockReqRes('GET', null, { authorization: 'Bearer invalid.token.here' });
  await meHandler(req, res);
  console.log(`Status: ${res.statusCode} body: ${JSON.stringify(res.body)}`);
  return res.statusCode === 401;
}

async function testMeMethodNotAllowed(token) {
  console.log('\n--- Test 9: POST en /api/auth/me ---');
  const { req, res } = mockReqRes('POST', { data: 'x' }, { authorization: `Bearer ${token}` });
  await meHandler(req, res);
  console.log(`Status: ${res.statusCode} body: ${JSON.stringify(res.body)}`);
  return res.statusCode === 405;
}

async function main() {
  const results = [];
  const token = await testLoginSuccess();
  results.push({ name: 'Login exitoso', pass: !!token });

  results.push({ name: 'Login password incorrecta', pass: await testLoginWrongPassword() });
  results.push({ name: 'Login campos faltantes', pass: await testLoginMissingFields() });
  results.push({ name: 'Login email invalido', pass: await testLoginInvalidEmail() });
  results.push({ name: 'Login GET no permitido', pass: await testLoginMethodNotAllowed() });

  if (token) {
    results.push({ name: '/me con token valido', pass: await testMeSuccess(token) });
  } else {
    results.push({ name: '/me con token valido', pass: false });
  }
  results.push({ name: '/me sin token', pass: await testMeNoToken() });
  results.push({ name: '/me token invalido', pass: await testMeInvalidToken() });
  results.push({ name: '/me POST no permitido', pass: await testMeMethodNotAllowed(token) });

  console.log('\n=== Resumen ===');
  results.forEach(r => console.log(`${r.pass ? 'OK' : 'FAIL'}  ${r.name}`));
  const passed = results.filter(r => r.pass).length;
  console.log(`\n${passed}/${results.length} tests pasaron`);
}

main().catch(e => {
  console.error('Error fatal:', e);
  process.exit(1);
});
