const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');
const bcrypt = require('bcryptjs');

let server;
let apiBase;
let temporaryDirectory;
let users;
let loginCookie;
let loginCsrf;
let secondLibrarianCookie;
let secondLibrarianCsrf;
let failNextUserSave = false;
let failNextPaymentSave = false;
let loanRecords = [];
let paymentRecords = [];
let credentialFilePath;

const origin = 'http://localhost:5173';
const usersFixture = [
  { id: 'usr-001', nombre: 'Ana Martínez', email: 'ana.martinez@escuela.edu', rol: 'estudiante', bloqueadoHasta: null },
  { id: 'usr-002', nombre: 'Carlos Ruiz', email: 'carlos.ruiz@escuela.edu', rol: 'docente', bloqueadoHasta: null },
  { id: 'usr-003', nombre: 'Lucía Fernández', email: 'lucia.fernandez@escuela.edu', rol: 'bibliotecario', bloqueadoHasta: null },
  { id: 'usr-004', nombre: 'Mario Salas', email: 'mario.salas@escuela.edu', rol: 'bibliotecario', bloqueadoHasta: null },
  { id: 'usr-005', nombre: 'Teresa Mora', email: 'teresa.mora@escuela.edu', rol: 'bibliotecario', bloqueadoHasta: null },
  { id: 'usr-006', nombre: 'Inés Vega', email: 'ines.vega@escuela.edu', rol: 'bibliotecario', bloqueadoHasta: null },
];

test('legacy migration extracts the user ID after pnpm separator arguments', () => {
  const { getUserIdArgument } = require('../src/auth/migrate-legacy-admin');
  assert.equal(getUserIdArgument(['--', 'usr-003']), 'usr-003');
  assert.equal(getUserIdArgument(['usr-003']), 'usr-003');
  assert.equal(getUserIdArgument(['--', '--replace', 'usr-003']), 'usr-003');
  assert.equal(getUserIdArgument(['--']), undefined);
});

function request(route, options = {}) {
  return fetch(`${apiBase}${route}`, options);
}

function mutationHeaders(cookie, csrf) {
  return {
    Origin: origin,
    'Content-Type': 'application/json',
    Cookie: cookie,
    'X-CSRF-Token': csrf,
  };
}

async function login(email, password) {
  return request('/auth/login', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

before(async () => {
  temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'library-staff-auth-'));
  credentialFilePath = path.join(temporaryDirectory, 'staff-credentials.json');
  const passwordHash = await bcrypt.hash('Test-Librarian-Password-2026!', 4);
  const studentHash = await bcrypt.hash('Test-Student-Password-2026!', 4);
  await fs.writeFile(credentialFilePath, JSON.stringify([
    { userId: 'usr-001', passwordHash: studentHash },
    { userId: 'usr-003', passwordHash },
    { userId: 'usr-004', passwordHash },
    { userId: 'usr-005', passwordHash },
  ]));

  Object.assign(process.env, {
    SESSION_SECRET: 'test-session-secret-with-at-least-thirty-two-bytes',
    FRONTEND_ORIGIN: origin,
    STAFF_CREDENTIALS_FILE: credentialFilePath,
    PRIVATE_DATA_DIR: path.join(temporaryDirectory, 'private'),
  });

  const usersModel = require('../src/models/user.model');
  const loansModel = require('../src/models/loan.model');
  const finePaymentsModel = require('../src/models/fine-payment.model');
  users = structuredClone(usersFixture);
  usersModel.findAll = async () => structuredClone(users);
  usersModel.saveAll = async (records) => {
    if (failNextUserSave) {
      failNextUserSave = false;
      throw Object.assign(new Error('Simulated users JSON write failure.'), { status: 500 });
    }
    users = structuredClone(records);
    return structuredClone(records);
  };
  loansModel.findAll = async () => structuredClone(loanRecords);
  loansModel.saveAll = async (records) => {
    loanRecords = structuredClone(records);
    return structuredClone(records);
  };
  finePaymentsModel.findAll = async () => structuredClone(paymentRecords);
  finePaymentsModel.saveAll = async (records) => {
    if (failNextPaymentSave) {
      failNextPaymentSave = false;
      throw new Error('Simulated payment ledger write failure.');
    }
    paymentRecords = structuredClone(records);
    return structuredClone(records);
  };

  const app = require('../index');
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  apiBase = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  if (temporaryDirectory) await fs.rm(temporaryDirectory, { recursive: true, force: true });
});

test('only librarians authenticate using their existing library identity', async () => {
  const student = await login('ana.martinez@escuela.edu', 'Test-Student-Password-2026!');
  const teacher = await login('carlos.ruiz@escuela.edu', 'Test-Librarian-Password-2026!');
  assert.equal(student.status, 401);
  assert.equal(teacher.status, 401);

  const librarian = await login('lucia.fernandez@escuela.edu', 'Test-Librarian-Password-2026!');
  assert.equal(librarian.status, 200);
  const cookieHeader = librarian.headers.get('set-cookie');
  assert.match(cookieHeader, /HttpOnly/i);
  loginCookie = cookieHeader.split(';')[0];
  const session = (await librarian.json()).data;
  loginCsrf = session.csrfToken;
  assert.deepEqual(session.user, {
    id: 'usr-003',
    nombre: 'Lucía Fernández',
    email: 'lucia.fernandez@escuela.edu',
    rol: 'bibliotecario',
  });
  assert.equal((await request('/api-does-not-exist')).status, 404);
  assert.equal((await request('/usuarios', { headers: { Cookie: loginCookie } })).status, 200);
});

test('payment endpoint preserves auth, origin and CSRF checks and settles the full outstanding debt', async () => {
  loanRecords = [
    { id: 'fine-001', usuarioId: 'usr-001', estado: 'devuelto', multa: 30 },
    { id: 'fine-002', usuarioId: 'usr-001', estado: 'devuelto', multa: 20 },
    { id: 'active-001', usuarioId: 'usr-001', estado: 'activo', multa: 100 },
  ];
  paymentRecords = [];
  const originalLoans = JSON.stringify(loanRecords);

  const noSession = await request('/usuarios/usr-001/pago', {
    method: 'POST',
    headers: { Origin: origin },
  });
  assert.equal(noSession.status, 401);

  const noCsrf = await request('/usuarios/usr-001/pago', {
    method: 'POST',
    headers: { Origin: origin, Cookie: loginCookie },
  });
  assert.equal(noCsrf.status, 403);

  const invalidOrigin = await request('/usuarios/usr-001/pago', {
    method: 'POST',
    headers: { ...mutationHeaders(loginCookie, loginCsrf), Origin: 'https://other.example' },
  });
  assert.equal(invalidOrigin.status, 403);

  const listedBefore = await request('/usuarios', { headers: { Cookie: loginCookie } });
  const borrowerBefore = (await listedBefore.json()).data.find((user) => user.id === 'usr-001');
  assert.equal(borrowerBefore.deudaPendiente, 50);
  assert.equal(borrowerBefore.bloqueado, true);

  const paid = await request('/usuarios/usr-001/pago', {
    method: 'POST',
    headers: mutationHeaders(loginCookie, loginCsrf),
  });
  assert.equal(paid.status, 201);
  const payment = (await paid.json()).data;
  assert.equal(payment.amount, 50);
  assert.equal(payment.userId, 'usr-001');
  assert.equal(payment.librarianId, 'usr-003');
  assert.equal(payment.method, 'presencial');
  assert.deepEqual(payment.loans, [
    { loanId: 'fine-001', amount: 30 },
    { loanId: 'fine-002', amount: 20 },
  ]);
  assert.equal(paymentRecords.length, 1);
  assert.equal(JSON.stringify(loanRecords), originalLoans);

  const listedAfter = await request('/usuarios', { headers: { Cookie: loginCookie } });
  const borrowerAfter = (await listedAfter.json()).data.find((user) => user.id === 'usr-001');
  assert.equal(borrowerAfter.deudaPendiente, 0);
  assert.equal(borrowerAfter.bloqueado, false);

  const repeated = await request('/usuarios/usr-001/pago', {
    method: 'POST',
    headers: mutationHeaders(loginCookie, loginCsrf),
  });
  assert.equal(repeated.status, 409);
  assert.equal(paymentRecords.length, 1);
});

test('a failed payment ledger write returns an error without settling the debt', async () => {
  loanRecords.push({ id: 'fine-003', usuarioId: 'usr-002', estado: 'devuelto', multa: 25 });
  const originalLoans = JSON.stringify(loanRecords);
  failNextPaymentSave = true;

  const failed = await request('/usuarios/usr-002/pago', {
    method: 'POST',
    headers: mutationHeaders(loginCookie, loginCsrf),
  });
  assert.equal(failed.status, 500);
  assert.equal(paymentRecords.length, 1);
  assert.equal(JSON.stringify(loanRecords), originalLoans);

  const listed = await request('/usuarios', { headers: { Cookie: loginCookie } });
  const borrower = (await listed.json()).data.find((user) => user.id === 'usr-002');
  assert.equal(borrower.deudaPendiente, 25);
  assert.equal(borrower.bloqueado, true);
});

test('a librarian cannot change their own role', async () => {
  const response = await request('/usuarios/usr-003', {
    method: 'PUT',
    headers: mutationHeaders(loginCookie, loginCsrf),
    body: JSON.stringify({
      nombre: 'Lucía Fernández',
      email: 'lucia.fernandez@escuela.edu',
      rol: 'estudiante',
    }),
  });
  assert.equal(response.status, 403);
  assert.equal(users.find((user) => user.id === 'usr-003').rol, 'bibliotecario');
});

test('only an authorized librarian can create users with linked administrative credentials', async () => {
  const beforeCount = users.length;
  const studentWithAccess = await request('/usuarios', {
    method: 'POST',
    headers: mutationHeaders(loginCookie, loginCsrf),
    body: JSON.stringify({
      nombre: 'Estudiante no autorizado',
      email: 'not-admin@escuela.edu',
      rol: 'estudiante',
      crearAcceso: true,
      password: 'Valid-Test-Password-2026!',
      confirmPassword: 'Valid-Test-Password-2026!',
    }),
  });
  assert.equal(studentWithAccess.status, 400);
  assert.equal(users.length, beforeCount);

  const mismatchedPasswords = await request('/usuarios', {
    method: 'POST',
    headers: mutationHeaders(loginCookie, loginCsrf),
    body: JSON.stringify({
      nombre: 'Bibliotecario inválido',
      email: 'invalid-admin@escuela.edu',
      rol: 'bibliotecario',
      crearAcceso: true,
      password: 'Valid-Test-Password-2026!',
      confirmPassword: 'Different-Test-Password-2026!',
    }),
  });
  assert.equal(mismatchedPasswords.status, 400);
  assert.equal(users.length, beforeCount);

  const password = 'New-Librarian-Password-2026!';
  const createdResponse = await request('/usuarios', {
    method: 'POST',
    headers: mutationHeaders(loginCookie, loginCsrf),
    body: JSON.stringify({
      nombre: 'Nuevo bibliotecario',
      email: 'new.librarian@escuela.edu',
      rol: 'bibliotecario',
      crearAcceso: true,
      password,
      confirmPassword: password,
    }),
  });
  assert.equal(createdResponse.status, 201);
  const createdUser = (await createdResponse.json()).data;
  assert.ok(createdUser.id);
  assert.equal(createdUser.rol, 'bibliotecario');
  const listedUsers = (await (await request('/usuarios', { headers: { Cookie: loginCookie } })).json()).data;
  assert.equal(listedUsers.find((user) => user.id === createdUser.id).hasAdminAccess, true);

  const credentialRecords = JSON.parse(await fs.readFile(credentialFilePath, 'utf8'));
  const linkedCredential = credentialRecords.find((record) => record.userId === createdUser.id);
  assert.ok(linkedCredential);
  assert.notEqual(linkedCredential.passwordHash, password);
  assert.equal(await bcrypt.compare(password, linkedCredential.passwordHash), true);
  assert.equal((await login(createdUser.email, password)).status, 200);
});

test('an existing librarian without credentials can be configured without registering again', async () => {
  const beforeCount = users.length;
  const password = 'Existing-Librarian-Password-2026!';
  const configured = await request('/usuarios/usr-006/acceso', {
    method: 'POST',
    headers: mutationHeaders(loginCookie, loginCsrf),
    body: JSON.stringify({ password, confirmPassword: password }),
  });
  assert.equal(configured.status, 201);
  assert.equal(users.length, beforeCount);
  assert.equal((await login('ines.vega@escuela.edu', password)).status, 200);

  const studentAttempt = await request('/usuarios/usr-001/acceso', {
    method: 'POST',
    headers: mutationHeaders(loginCookie, loginCsrf),
    body: JSON.stringify({ password, confirmPassword: password }),
  });
  assert.equal(studentAttempt.status, 403);
  const selfAttempt = await request('/usuarios/usr-003/acceso', {
    method: 'POST',
    headers: mutationHeaders(loginCookie, loginCsrf),
    body: JSON.stringify({ password, confirmPassword: password }),
  });
  assert.equal(selfAttempt.status, 403);
});

test('a failed user JSON write is recovered without duplicate users', async () => {
  failNextUserSave = true;
  const password = 'Recoverable-Librarian-Password-2026!';
  const createResponse = await request('/usuarios', {
    method: 'POST',
    headers: mutationHeaders(loginCookie, loginCsrf),
    body: JSON.stringify({
      nombre: 'Alta recuperable',
      email: 'recoverable.librarian@escuela.edu',
      rol: 'bibliotecario',
      crearAcceso: true,
      password,
      confirmPassword: password,
    }),
  });
  assert.equal(createResponse.status, 500);

  const listResponse = await request('/usuarios', { headers: { Cookie: loginCookie } });
  assert.equal(listResponse.status, 200);
  const recovered = (await listResponse.json()).data.filter((user) => user.email === 'recoverable.librarian@escuela.edu');
  assert.equal(recovered.length, 1);
  assert.equal(recovered[0].hasAdminAccess, true);
  assert.equal((await login(recovered[0].email, password)).status, 200);
});

test('role downgrade removes credentials and revokes all sessions for that librarian', async () => {
  const targetLogin = await login('mario.salas@escuela.edu', 'Test-Librarian-Password-2026!');
  assert.equal(targetLogin.status, 200);
  secondLibrarianCookie = targetLogin.headers.get('set-cookie').split(';')[0];
  secondLibrarianCsrf = (await targetLogin.json()).data.csrfToken;

  const downgrade = await request('/usuarios/usr-004', {
    method: 'PUT',
    headers: mutationHeaders(loginCookie, loginCsrf),
    body: JSON.stringify({
      nombre: 'Mario Salas',
      email: 'mario.salas@escuela.edu',
      rol: 'docente',
    }),
  });
  assert.equal(downgrade.status, 200);
  assert.equal((await request('/usuarios', { headers: { Cookie: secondLibrarianCookie } })).status, 401);
  assert.equal((await login('mario.salas@escuela.edu', 'Test-Librarian-Password-2026!')).status, 401);
});

test('deleting a librarian removes their linked credentials', async () => {
  const targetLogin = await login('teresa.mora@escuela.edu', 'Test-Librarian-Password-2026!');
  assert.equal(targetLogin.status, 200);
  const targetCookie = targetLogin.headers.get('set-cookie').split(';')[0];

  const deleteResponse = await request('/usuarios/usr-005', {
    method: 'DELETE',
    headers: mutationHeaders(loginCookie, loginCsrf),
  });
  assert.equal(deleteResponse.status, 200);
  assert.equal(users.some((user) => user.id === 'usr-005'), false);
  assert.equal((await request('/usuarios', { headers: { Cookie: targetCookie } })).status, 401);
  assert.equal((await login('teresa.mora@escuela.edu', 'Test-Librarian-Password-2026!')).status, 401);
});
