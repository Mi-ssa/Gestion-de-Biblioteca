const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const { after, before, describe, test } = require('node:test');
const bcrypt = require('bcryptjs');
const express = require('express');
const session = require('express-session');

const sessionFileStorePath = require.resolve('session-file-store');
const sessionFileStoreRequire = createRequire(sessionFileStorePath);
const FileStore = require('session-file-store')(session);
const fileStoreHelpers = sessionFileStoreRequire('./lib/session-file-helpers');
const fsExtra = sessionFileStoreRequire('fs-extra');
const secret = 'isolated-session-integrity-test-secret';
const origin = 'http://localhost:5173';
const password = 'Session-Test-Password-2026!';

let server;
let apiBase;
let temporaryDirectory;
let sessionDirectory;
let store;
let validCookie;

function sessionIdFromCookie(cookie) {
  const value = decodeURIComponent(cookie.split(';', 1)[0].split('=').slice(1).join('='));
  return value.slice(2).split('.', 1)[0];
}

function sessionPath(cookie) {
  return path.join(sessionDirectory, `${sessionIdFromCookie(cookie)}.json`);
}

function getSession(sessionId, targetStore = store) {
  return new Promise((resolve, reject) => {
    targetStore.get(sessionId, (error, value) => {
      if (error) reject(error);
      else resolve(value);
    });
  });
}

async function login() {
  return fetch(`${apiBase}/auth/login`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'librarian@school.test', password }),
  });
}

async function corruptIntegrity(cookie) {
  const file = sessionPath(cookie);
  const data = JSON.parse(await fs.readFile(file, 'utf8'));
  data.hmac = `${data.hmac}invalid`;
  await fs.writeFile(file, JSON.stringify(data));
  return file;
}

describe('session integrity handling', { concurrency: false }, () => {
before(async () => {
  temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'entrel-neas-session-test-'));
  sessionDirectory = path.join(temporaryDirectory, 'sessions');
  const credentialPath = path.join(temporaryDirectory, 'staff-credentials.json');
  await fs.mkdir(sessionDirectory, { recursive: true });
  await fs.writeFile(credentialPath, JSON.stringify([{
    userId: 'librarian-1',
    passwordHash: await bcrypt.hash(password, 4),
  }]));

  Object.assign(process.env, {
    SESSION_SECRET: secret,
    FRONTEND_ORIGIN: origin,
    STAFF_CREDENTIALS_FILE: credentialPath,
    PRIVATE_DATA_DIR: path.join(temporaryDirectory, 'private'),
  });

  const usersModel = require('../src/models/user.model');
  usersModel.findAll = async () => [{
    id: 'librarian-1',
    nombre: 'Test Librarian',
    email: 'librarian@school.test',
    rol: 'bibliotecario',
  }];

  const { login: loginController } = require('../src/auth/auth.controller');
  const { requireAuthentication, requireCsrf } = require('../src/auth/auth.middleware');
  store = new FileStore({
    path: sessionDirectory,
    secret,
    retries: 0,
    reapInterval: -1,
  });
  store.touch = undefined;

  const app = express();
  app.use(express.json());
  app.use(session({
    name: 'test.sid',
    secret,
    store,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 1000 },
  }));
  app.post('/auth/login', loginController);
  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.get('/protected', requireAuthentication, (req, res) => res.json({ authenticated: true }));
  app.post('/csrf-probe', requireAuthentication, requireCsrf, (req, res) => res.sendStatus(204));

  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  apiBase = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  if (temporaryDirectory) await fs.rm(temporaryDirectory, { recursive: true, force: true });
});

test('a valid session is saved and recovered with the same secret', async () => {
  const response = await login();
  assert.equal(response.status, 200);
  validCookie = response.headers.get('set-cookie').split(';', 1)[0];
  const body = await response.json();
  assert.equal(body.data.authenticated, true);
  assert.equal(typeof body.data.csrfToken, 'string');
  assert.match(validCookie, /^test\.sid=/);

  const sessionId = sessionIdFromCookie(validCookie);
  const recovered = await getSession(sessionId, new FileStore({
    path: sessionDirectory,
    secret,
    retries: 0,
    reapInterval: -1,
  }));
  assert.equal(recovered.staff.userId, 'librarian-1');
  assert.equal((await (await fetch(`${apiBase}/protected`, {
    headers: { Cookie: validCookie },
  })).json()).authenticated, true);
});

test('an integrity-invalid session is removed and rejected without stopping the server', async () => {
  const invalidFile = await corruptIntegrity(validCookie);
  assert.equal(await getSession(sessionIdFromCookie(validCookie)), null);
  const response = await fetch(`${apiBase}/protected`, {
    headers: { Cookie: validCookie },
  });

  assert.equal(response.status, 401);
  await assert.rejects(fs.access(invalidFile), { code: 'ENOENT' });
  assert.equal((await fetch(`${apiBase}/health`)).status, 200);
  assert.equal((await fetch(`${apiBase}/protected`, {
    headers: { Cookie: validCookie },
  })).status, 401);
});

test('login and CSRF protection work after invalidating a session', async () => {
  const response = await login();
  assert.equal(response.status, 200);
  const freshCookie = response.headers.get('set-cookie').split(';', 1)[0];
  const freshCsrfToken = (await response.json()).data.csrfToken;
  validCookie = freshCookie;

  assert.equal((await fetch(`${apiBase}/protected`, {
    headers: { Cookie: freshCookie },
  })).status, 200);
  assert.equal((await fetch(`${apiBase}/csrf-probe`, {
    method: 'POST',
    headers: { Origin: origin, Cookie: freshCookie },
  })).status, 403);
  assert.equal((await fetch(`${apiBase}/csrf-probe`, {
    method: 'POST',
    headers: { Origin: origin, Cookie: freshCookie, 'X-CSRF-Token': 'invalid-token' },
  })).status, 403);
  assert.equal((await fetch(`${apiBase}/csrf-probe`, {
    method: 'POST',
    headers: { Origin: origin, Cookie: freshCookie, 'X-CSRF-Token': freshCsrfToken },
  })).status, 204);
});

test('read permission errors propagate instead of becoming missing sessions', async () => {
  const sessionId = 'read-permission-fixture';
  const targetPath = path.join(sessionDirectory, `${sessionId}.json`);
  const permissionError = Object.assign(new Error('Simulated session read denial.'), { code: 'EACCES' });
  const originalReadFile = fsExtra.readFile;
  fsExtra.readFile = function (file, ...args) {
    if (path.resolve(file) === targetPath) {
      queueMicrotask(() => args.at(-1)(permissionError));
      return;
    }
    return originalReadFile.call(this, file, ...args);
  };

  try {
    await assert.rejects(getSession(sessionId), (error) => error === permissionError);
  } finally {
    fsExtra.readFile = originalReadFile;
  }
});

test('failure to remove an integrity-invalid session propagates through the store callback', async () => {
  const invalidFile = await corruptIntegrity(validCookie);
  const removalError = Object.assign(new Error('Simulated session removal denial.'), { code: 'EACCES' });
  const originalRemove = fsExtra.remove;
  fsExtra.remove = function (file, callback) {
    if (path.resolve(file) === invalidFile) {
      queueMicrotask(() => callback(removalError));
      return;
    }
    return originalRemove.call(this, file, callback);
  };

  try {
    await assert.rejects(getSession(sessionIdFromCookie(validCookie)), (error) => error === removalError);
    await fs.access(invalidFile);
  } finally {
    fsExtra.remove = originalRemove;
  }
});

test('a different decryption error propagates and does not invalidate the file', async () => {
  const response = await login();
  const cookie = response.headers.get('set-cookie').split(';', 1)[0];
  const file = sessionPath(cookie);
  const data = JSON.parse(await fs.readFile(file, 'utf8'));
  data.at = '00';
  await fs.writeFile(file, JSON.stringify(data));

  await assert.rejects(
    getSession(sessionIdFromCookie(cookie)),
    (error) => error instanceof Error && error.message === 'Unable to decrypt ciphertext!',
  );
  await fs.access(file);
});
});
