const bcrypt = require('bcryptjs');
const usersModel = require('../models/user.model');
const { saveCredential } = require('./staff-credentials');
const { promptHidden } = require('./prompt-input');

async function initializeCredential() {
  const args = process.argv.slice(2);
  const userId = args.find((argument) => argument !== '--replace');
  const replace = args.includes('--replace');
  if (!userId) {
    throw new Error('Indica explícitamente el identificador del bibliotecario: pnpm run staff:credential:init -- <userId>');
  }
  const users = await usersModel.findAll();
  const user = users.find((record) => record.id === userId && record.rol === 'bibliotecario');
  if (!user) throw new Error('El identificador no corresponde a un usuario con rol bibliotecario.');

  const password = await promptHidden('Contraseña nueva (mínimo 12 caracteres, no se mostrará): ');
  if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('La contraseña debe tener al menos 12 caracteres y no exceder 72 bytes UTF-8.');
  }
  await saveCredential(user.id, await bcrypt.hash(password, 12), { replace });
  console.log(`Credenciales configuradas para el bibliotecario ${user.id}.`);
}

initializeCredential().catch((error) => {
  console.error(`No se pudieron configurar las credenciales: ${error.message}`);
  process.exitCode = 1;
});
