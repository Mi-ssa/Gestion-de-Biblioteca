const usersModel = require('../models/user.model');
const { verifyCredentials } = require('./admin-accounts');
const { saveCredential } = require('./staff-credentials');
const { promptHidden, promptLine } = require('./prompt-input');

function getUserIdArgument(args = process.argv.slice(2)) {
  return args.find((argument) => (
    typeof argument === 'string'
    && argument !== '--'
    && !argument.startsWith('-')
  ));
}

async function migrateLegacyAccount() {
  const userId = getUserIdArgument();
  if (!userId) {
    throw new Error('Indica explícitamente el identificador verificado del bibliotecario: pnpm run auth:migrate-legacy -- <userId>');
  }
  const users = await usersModel.findAll();
  const userById = users.find((record) => record.id === userId);
  const roleMatches = userById?.rol === 'bibliotecario';
  console.log('[diagnóstico migración]', {
    argumentId: userId,
    usersFile: usersModel.filePath,
    foundById: Boolean(userById),
    foundRole: userById?.rol ?? null,
    roleMatches,
  });
  const user = roleMatches ? userById : null;
  if (!user) throw new Error('El identificador no corresponde a un usuario con rol bibliotecario.');

  console.log(`Vinculación explícita solicitada: ${user.nombre} (${user.email}), id ${user.id}.`);
  console.log('Confirma fuera de este sistema que esta cuenta de biblioteca pertenece a quien controla la cuenta administrativa anterior.');
  const username = await promptLine('Usuario de la cuenta administrativa anterior: ');
  const password = await promptHidden('Contraseña anterior (no se mostrará): ');
  const legacyAccount = await verifyCredentials(username, password);
  if (!legacyAccount) throw new Error('No se pudieron verificar las credenciales administrativas anteriores.');

  await saveCredential(user.id, legacyAccount.passwordHash);
  console.log(`Hash vinculado explícitamente al usuario ${user.id}. El archivo administrativo anterior se conservó sin cambios.`);
}

if (require.main === module) {
  migrateLegacyAccount().catch((error) => {
    console.error(`No se pudo completar la vinculación: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { getUserIdArgument };
