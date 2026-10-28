const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');
const usersModel = require('../models/user.model');
const loansModel = require('../models/loan.model');
const finePaymentsModel = require('../models/fine-payment.model');
const withOperationLock = require('./operation-lock');
const {
  findCredentialByUserId,
  listCredentialUserIds,
  removeCredential,
  saveCredential,
  validatePassword,
} = require('../auth/staff-credentials');
const { revokeUserSessions } = require('../auth/session-revocation');
const { createUserWithCredential } = require('./user-creation-recovery');
const {
  getPendingFineByUser,
  getUserBlockingStatus,
  registerFinePayment,
} = require('./fine-payment.service');

const roles = new Set(['estudiante', 'docente', 'bibliotecario']);
const activeLoanLimit = { estudiante: 3, docente: 5 };

function validateUser(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw Object.assign(new Error('Los datos del usuario no son válidos.'), { status: 400 });
  }
  if (
    typeof input.nombre !== 'string'
    || typeof input.email !== 'string'
    || typeof input.rol !== 'string'
  ) {
    throw Object.assign(new Error('Nombre, correo y rol deben ser texto.'), { status: 400 });
  }
  const user = {
    nombre: input.nombre.trim(),
    email: input.email.trim().toLocaleLowerCase(),
    rol: input.rol.trim(),
  };
  if (
    !user.nombre
    || user.nombre.length > 120
    || !user.email
    || user.email.length > 254
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)
  ) {
    throw Object.assign(new Error('Nombre y un correo electrónico válido son obligatorios.'), { status: 400 });
  }
  if (!roles.has(user.rol)) {
    throw Object.assign(new Error('El rol debe ser estudiante, docente o bibliotecario.'), { status: 400 });
  }
  return user;
}

async function listUsers(now = new Date()) {
  const [users, credentialUserIds, loans, payments] = await Promise.all([
    usersModel.findAll(),
    listCredentialUserIds(),
    loansModel.findAll(),
    finePaymentsModel.findAll(),
  ]);
  const debtByUser = getPendingFineByUser(loans, payments);
  return users.map((user) => {
    const debt = debtByUser.get(user.id) || 0;
    const blockingStatus = getUserBlockingStatus(user, debt, now);
    return {
      ...user,
      hasAdminAccess: credentialUserIds.has(user.id) && user.rol === 'bibliotecario',
      deudaPendiente: debt,
      bloqueado: blockingStatus.blocked,
    };
  });
}

async function createUser(input) {
  return withOperationLock(async () => {
    const user = validateUser(input);
    const createAccess = input.crearAcceso === true;
    if (input.crearAcceso !== undefined && typeof input.crearAcceso !== 'boolean') {
      throw Object.assign(new Error('La opción de acceso administrativo no es válida.'), { status: 400 });
    }
    if (createAccess && user.rol !== 'bibliotecario') {
      throw Object.assign(new Error('Solo se puede crear acceso para un usuario bibliotecario.'), { status: 400 });
    }
    if (!createAccess && (input.password !== undefined || input.confirmPassword !== undefined)) {
      throw Object.assign(new Error('No envíes contraseñas si no se solicita acceso administrativo.'), { status: 400 });
    }
    let passwordHash;
    if (createAccess) {
      validatePassword(input.password, input.confirmPassword);
      passwordHash = await bcrypt.hash(input.password, 12);
    }
    const users = await usersModel.findAll();
    if (users.some((item) => item.email.toLocaleLowerCase() === user.email)) {
      throw Object.assign(new Error('Ya existe un usuario con ese correo.'), { status: 409 });
    }
    const created = {
      id: randomUUID(),
      ...user,
      bloqueadoHasta: null,
      createdAt: new Date().toISOString(),
    };
    if (createAccess) return createUserWithCredential(created, passwordHash);
    await usersModel.saveAll([...users, created]);
    return created;
  });
}

async function configureAdminAccess(id, input, actorUserId) {
  return withOperationLock(async () => {
    if (id === actorUserId) {
      throw Object.assign(new Error('No puedes configurar credenciales para tu propia cuenta.'), { status: 403 });
    }
    const user = await usersModel.findAll().then((users) => users.find((record) => record.id === id));
    if (!user) throw Object.assign(new Error('Usuario no encontrado.'), { status: 404 });
    if (user.rol !== 'bibliotecario') {
      throw Object.assign(new Error('Solo los usuarios con rol bibliotecario pueden tener acceso administrativo.'), { status: 403 });
    }
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw Object.assign(new Error('Los datos de acceso no son válidos.'), { status: 400 });
    }
    validatePassword(input.password, input.confirmPassword);
    if (await findCredentialByUserId(id)) {
      throw Object.assign(new Error('Este bibliotecario ya tiene acceso configurado.'), { status: 409 });
    }
    await saveCredential(id, await bcrypt.hash(input.password, 12));
    return { userId: id, hasAdminAccess: true };
  });
}

async function updateUser(id, input, actorUserId) {
  return withOperationLock(async () => {
    const userInput = validateUser(input);
    const [users, loans] = await Promise.all([usersModel.findAll(), loansModel.findAll()]);
    const index = users.findIndex((item) => item.id === id);
    if (index < 0) throw Object.assign(new Error('Usuario no encontrado.'), { status: 404 });
    if (id === actorUserId && userInput.rol !== users[index].rol) {
      throw Object.assign(new Error('No puedes modificar tu propio rol.'), { status: 403 });
    }
    if (users.some((item) => item.id !== id && item.email.toLocaleLowerCase() === userInput.email)) {
      throw Object.assign(new Error('Ya existe un usuario con ese correo.'), { status: 409 });
    }
    const activeLoans = loans.filter((loan) => loan.usuarioId === id && loan.estado === 'activo').length;
    if (userInput.rol === 'bibliotecario' && activeLoans > 0) {
      throw Object.assign(new Error('No se puede asignar el rol bibliotecario a un usuario con préstamos activos.'), { status: 409 });
    }
    if (activeLoans > (activeLoanLimit[userInput.rol] ?? 0)) {
      throw Object.assign(new Error(`El usuario tiene ${activeLoans} préstamos activos y supera el límite del nuevo rol.`), { status: 409 });
    }
    users[index] = { ...users[index], ...userInput };
    await usersModel.saveAll(users);
    if (users[index].rol !== 'bibliotecario') {
      await Promise.all([removeCredential(id), revokeUserSessions(id)]);
    }
    return users[index];
  });
}

async function deleteUser(id) {
  return withOperationLock(async () => {
    const [users, loans] = await Promise.all([usersModel.findAll(), loansModel.findAll()]);
    const user = users.find((item) => item.id === id);
    if (!user) throw Object.assign(new Error('Usuario no encontrado.'), { status: 404 });
    if (loans.some((loan) => loan.usuarioId === id && loan.estado === 'activo')) {
      throw Object.assign(new Error('No se puede eliminar un usuario con préstamos activos.'), { status: 409 });
    }
    await usersModel.saveAll(users.filter((item) => item.id !== id));
    await Promise.all([removeCredential(id), revokeUserSessions(id)]);
    return user;
  });
}

module.exports = {
  listUsers,
  createUser,
  configureAdminAccess,
  registerFinePayment,
  updateUser,
  deleteUser,
};
