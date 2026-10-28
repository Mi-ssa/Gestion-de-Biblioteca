const fs = require('node:fs/promises');
const path = require('node:path');
const usersModel = require('../models/user.model');
const { saveCredential } = require('../auth/staff-credentials');

const privateDirectory = path.resolve(process.env.PRIVATE_DATA_DIR || path.join(__dirname, '..', '..', 'private'));
const journalPath = path.join(privateDirectory, 'pending-user-creation.json');
let recoveryPromise;

async function writeJournal(transaction) {
  await fs.mkdir(privateDirectory, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') await fs.chmod(privateDirectory, 0o700);
  const temporaryPath = `${journalPath}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(transaction, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  await fs.rename(temporaryPath, journalPath);
}

async function commitUserCreation(transaction) {
  const users = await usersModel.findAll();
  const existingById = users.find((user) => user.id === transaction.user.id);
  if (!existingById) {
    if (users.some((user) => user.email.toLocaleLowerCase() === transaction.user.email.toLocaleLowerCase())) {
      throw Object.assign(new Error('Ya existe un usuario con ese correo; la creación pendiente requiere revisión.'), { status: 409 });
    }
    await usersModel.saveAll([...users, transaction.user]);
  }
  await saveCredential(transaction.user.id, transaction.passwordHash, { replace: true });
  await fs.rm(journalPath, { force: true });
  return transaction.user;
}

async function recoverPendingUserCreation() {
  if (recoveryPromise) return recoveryPromise;
  recoveryPromise = (async () => {
    let transaction;
    try {
      transaction = JSON.parse(await fs.readFile(journalPath, 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
    if (
      transaction?.version !== 1
      || typeof transaction.user?.id !== 'string'
      || transaction.user.rol !== 'bibliotecario'
      || typeof transaction.passwordHash !== 'string'
    ) {
      throw new Error('La operación pendiente de alta de bibliotecario no tiene un formato válido.');
    }
    return commitUserCreation(transaction);
  })();
  try {
    return await recoveryPromise;
  } finally {
    recoveryPromise = null;
  }
}

async function createUserWithCredential(user, passwordHash) {
  const transaction = { version: 1, user, passwordHash };
  await writeJournal(transaction);
  return commitUserCreation(transaction);
}

module.exports = { createUserWithCredential, recoverPendingUserCreation };
