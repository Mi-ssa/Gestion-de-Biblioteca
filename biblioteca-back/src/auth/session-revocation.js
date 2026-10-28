const fs = require('node:fs/promises');
const path = require('node:path');

let sessionStore;
let sessionDirectory;

function configureSessionRevocation(store, directory) {
  sessionStore = store;
  sessionDirectory = directory;
}

async function revokeUserSessions(userId) {
  if (!sessionStore || !sessionDirectory) return;
  const files = await fs.readdir(sessionDirectory);
  const sessionIds = files.filter((file) => file.endsWith('.json')).map((file) => file.slice(0, -5));
  await Promise.all(sessionIds.map((sessionId) => new Promise((resolve, reject) => {
    sessionStore.get(sessionId, (readError, storedSession) => {
      if (readError?.code === 'ENOENT') return resolve();
      if (readError) return reject(readError);
      if (storedSession?.staff?.userId !== userId) return resolve();
      return sessionStore.destroy(sessionId, (destroyError) => (
        destroyError ? reject(destroyError) : resolve()
      ));
    });
  })));
}

module.exports = { configureSessionRevocation, revokeUserSessions };
