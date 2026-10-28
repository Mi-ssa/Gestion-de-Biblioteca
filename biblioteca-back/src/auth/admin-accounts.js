const fs = require('node:fs/promises');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const bcrypt = require('bcryptjs');

const credentialsPath = path.resolve(
  process.env.ADMIN_CREDENTIALS_FILE || path.join(__dirname, '..', '..', 'private', 'admin-accounts.json'),
);
const dummyHash = bcrypt.hash(randomBytes(32).toString('hex'), 12);

async function verifyCredentials(username, password) {
  let accounts;
  try {
    accounts = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw Object.assign(new Error('La cuenta administrativa anterior no está configurada.'), { status: 503 });
    }
    throw error;
  }
  if (!Array.isArray(accounts)) throw new Error('El archivo anterior de cuentas debe contener una lista.');
  const account = accounts.find((record) => (
    record && typeof record.username === 'string'
    && record.username.toLocaleLowerCase() === username.toLocaleLowerCase()
    && typeof record.passwordHash === 'string'
  ));
  const valid = await bcrypt.compare(password, account?.passwordHash || await dummyHash);
  return account && valid ? account : null;
}

module.exports = { credentialsPath, verifyCredentials };
