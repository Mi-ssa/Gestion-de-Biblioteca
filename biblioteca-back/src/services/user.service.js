const { randomUUID } = require('node:crypto');
const usersModel = require('../models/user.model');
const loansModel = require('../models/loan.model');
const withOperationLock = require('./operation-lock');

const roles = new Set(['estudiante', 'docente', 'bibliotecario']);
const activeLoanLimit = { estudiante: 3, docente: 5 };

function validateUser(input) {
  const user = {
    nombre: String(input.nombre || '').trim(),
    email: String(input.email || '').trim().toLocaleLowerCase(),
    rol: String(input.rol || '').trim(),
  };
  if (!user.nombre || !user.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) {
    throw Object.assign(new Error('Nombre y un correo electrónico válido son obligatorios.'), { status: 400 });
  }
  if (!roles.has(user.rol)) {
    throw Object.assign(new Error('El rol debe ser estudiante, docente o bibliotecario.'), { status: 400 });
  }
  return user;
}

async function listUsers() {
  return usersModel.findAll();
}

async function createUser(input) {
  return withOperationLock(async () => {
    const user = validateUser(input);
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
    await usersModel.saveAll([...users, created]);
    return created;
  });
}

async function updateUser(id, input) {
  return withOperationLock(async () => {
    const userInput = validateUser(input);
    const [users, loans] = await Promise.all([usersModel.findAll(), loansModel.findAll()]);
    const index = users.findIndex((item) => item.id === id);
    if (index < 0) throw Object.assign(new Error('Usuario no encontrado.'), { status: 404 });
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
    return user;
  });
}

module.exports = { listUsers, createUser, updateUser, deleteUser };
