const fs = require('node:fs/promises');
const path = require('node:path');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const { removeCredential } = require('./staff-credentials');
const { configureSessionRevocation, revokeUserSessions } = require('./session-revocation');

async function revokeCredential() {
  const userId = process.argv[2];
  if (!userId) {
    throw new Error('Indica explícitamente el identificador: pnpm run staff:credential:revoke -- <userId>');
  }
  const secret = process.env.SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error('Configura el mismo SESSION_SECRET que utiliza el servidor para revocar sesiones existentes.');
  }
  const privateDirectory = path.resolve(process.env.PRIVATE_DATA_DIR || path.join(__dirname, '..', '..', 'private'));
  const sessionDirectory = path.join(privateDirectory, 'sessions');
  await fs.mkdir(sessionDirectory, { recursive: true, mode: 0o700 });
  const store = new FileStore({
    path: sessionDirectory,
    ttl: 8 * 60 * 60,
    retries: 0,
    secret,
    reapInterval: -1,
  });
  store.touch = undefined;
  configureSessionRevocation(store, sessionDirectory);
  await Promise.all([removeCredential(userId), revokeUserSessions(userId)]);
  console.log(`Credenciales y sesiones revocadas para el usuario ${userId}.`);
}

revokeCredential().catch((error) => {
  console.error(`No se pudieron revocar las credenciales: ${error.message}`);
  process.exitCode = 1;
});
