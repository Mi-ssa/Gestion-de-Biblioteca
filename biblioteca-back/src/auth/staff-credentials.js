const fs = require('node:fs/promises');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const bcrypt = require('bcryptjs');
const usersModel = require('../models/user.model');

const credentialsPath = path.resolve(
  process.env.STAFF_CREDENTIALS_FILE || path.join(__dirname, '..', '..', 'private', 'staff-credentials.json'),
);
const dummyHash = bcrypt.hash(randomBytes(32).toString('hex'), 12);

async function readCredentials() {
  let credentials;
  try {
    credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw Object.assign(new Error('No hay credenciales de personal configuradas.'), { status: 503 });
    }
    throw error;
  }
  if (!Array.isArray(credentials)) throw new Error('El archivo privado de credenciales debe contener una lista.');
  return credentials;
}

async function readCredentialsOrEmpty() {
  try {
    return await readCredentials();
  } catch (error) {
    if (error.status === 503) return [];
    throw error;
  }
}

async function findCredentialByUserId(userId) {
  const credentials = await readCredentialsOrEmpty();
  return credentials.find((record) => record?.userId === userId && typeof record.passwordHash === 'string') || null;
}

function validatePassword(password, confirmation) {
  if (
    typeof password !== 'string'
    || password.length < 12
    || Buffer.byteLength(password, 'utf8') > 72
    || typeof confirmation !== 'string'
    || password !== confirmation
  ) {
    throw Object.assign(
      new Error('La contraseña debe coincidir con la confirmación, tener al menos 12 caracteres y no exceder 72 bytes UTF-8.'),
      { status: 400 },
    );
  }
}

async function verifyCredentials(email, password) {
  const users = await usersModel.findAll();
  const user = users.find((record) => (
    typeof record.email === 'string'
    && record.email.toLocaleLowerCase() === email.toLocaleLowerCase()
  ));
  const credential = user ? await findCredentialByUserId(user.id) : null;
  const hash = credential?.passwordHash || await dummyHash;
  const valid = await bcrypt.compare(password, hash);
  if (!valid || !credential || !user || user.rol !== 'bibliotecario') return null;
  return { userId: user.id, nombre: user.nombre, email: user.email, rol: user.rol };
}

async function saveCredential(userId, passwordHash, { replace = false } = {}) {
  const directory = path.dirname(credentialsPath);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') await fs.chmod(directory, 0o700);

  const credentials = await readCredentialsOrEmpty();
  const existingIndex = credentials.findIndex((record) => record?.userId === userId);
  if (existingIndex >= 0 && !replace) {
    throw Object.assign(new Error('Este bibliotecario ya tiene credenciales configuradas.'), { status: 409 });
  }
  const record = { userId, passwordHash, updatedAt: new Date().toISOString() };
  if (existingIndex >= 0) credentials[existingIndex] = record;
  else credentials.push({ ...record, createdAt: record.updatedAt });

  const temporaryPath = `${credentialsPath}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(credentials, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  await fs.rename(temporaryPath, credentialsPath);
}

async function listCredentialUserIds() {
  const credentials = await readCredentialsOrEmpty();
  return new Set(credentials
    .filter((record) => typeof record?.userId === 'string' && typeof record.passwordHash === 'string')
    .map((record) => record.userId));
}

async function removeCredential(userId) {
  const credentials = await readCredentialsOrEmpty();
  const nextCredentials = credentials.filter((record) => record?.userId !== userId);
  if (nextCredentials.length === credentials.length) return;
  const temporaryPath = `${credentialsPath}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(nextCredentials, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  await fs.rename(temporaryPath, credentialsPath);
}

module.exports = {
  credentialsPath,
  findCredentialByUserId,
  listCredentialUserIds,
  readCredentials,
  removeCredential,
  saveCredential,
  validatePassword,
  verifyCredentials,
};
