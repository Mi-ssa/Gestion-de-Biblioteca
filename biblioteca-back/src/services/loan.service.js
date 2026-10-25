const { randomUUID } = require('node:crypto');
const booksModel = require('../models/book.model');
const usersModel = require('../models/user.model');
const loansModel = require('../models/loan.model');
const withOperationLock = require('./operation-lock');

const LOAN_DAYS = 14;
const MAX_ACTIVE_LOANS = { estudiante: 3, docente: 5 };
const FINE_PER_DAY = 5;

async function listLoans() {
  const [loans, books, users] = await Promise.all([
    loansModel.findAll(),
    booksModel.findAll(),
    usersModel.findAll(),
  ]);
  const bookById = new Map(books.map((book) => [book.id, book]));
  const userById = new Map(users.map((user) => [user.id, user]));
  return loans.map((loan) => ({
    ...loan,
    libro: bookById.get(loan.libroId) || null,
    usuario: userById.get(loan.usuarioId) || null,
  })).sort((a, b) => new Date(b.fechaPrestamo) - new Date(a.fechaPrestamo));
}

async function createLoan({ usuarioId, libroId }) {
  return withOperationLock(async () => {
    if (!usuarioId || !libroId) {
      throw Object.assign(new Error('Debes seleccionar un usuario y un libro.'), { status: 400 });
    }
    const [books, users, loans] = await Promise.all([
      booksModel.findAll(),
      usersModel.findAll(),
      loansModel.findAll(),
    ]);
    const user = users.find((item) => item.id === usuarioId);
    const book = books.find((item) => item.id === libroId);
    if (!user) throw Object.assign(new Error('Usuario no encontrado.'), { status: 404 });
    if (!book) throw Object.assign(new Error('Libro no encontrado.'), { status: 404 });
    if (user.rol === 'bibliotecario') {
      throw Object.assign(new Error('Los bibliotecarios no pueden registrar préstamos como prestatarios.'), { status: 400 });
    }
    if (user.bloqueadoHasta && new Date(user.bloqueadoHasta) > new Date()) {
      throw Object.assign(new Error(`El usuario está bloqueado hasta el ${new Date(user.bloqueadoHasta).toLocaleDateString('es-MX')}.`), { status: 403 });
    }
    if (book.stockDisponible <= 0) {
      throw Object.assign(new Error('No hay ejemplares disponibles de este libro.'), { status: 409 });
    }
    const activeCount = loans.filter((loan) => loan.usuarioId === user.id && loan.estado === 'activo').length;
    const limit = MAX_ACTIVE_LOANS[user.rol];
    if (activeCount >= limit) {
      throw Object.assign(new Error(`El límite para ${user.rol} es de ${limit} libros activos.`), { status: 409 });
    }

    const borrowedAt = new Date();
    const dueAt = new Date(borrowedAt);
    dueAt.setDate(dueAt.getDate() + LOAN_DAYS);
    const loan = {
      id: randomUUID(),
      usuarioId: user.id,
      libroId: book.id,
      fechaPrestamo: borrowedAt.toISOString(),
      fechaVencimiento: dueAt.toISOString(),
      fechaDevolucion: null,
      diasRetraso: 0,
      multa: 0,
      estado: 'activo',
    };
    book.stockDisponible -= 1;
    await booksModel.saveAll(books);
    await loansModel.saveAll([...loans, loan]);
    return { ...loan, libro: book, usuario: user };
  });
}

async function returnLoan(id) {
  return withOperationLock(async () => {
    const [loans, books, users] = await Promise.all([
      loansModel.findAll(),
      booksModel.findAll(),
      usersModel.findAll(),
    ]);
    const loanIndex = loans.findIndex((item) => item.id === id);
    if (loanIndex < 0) throw Object.assign(new Error('Préstamo no encontrado.'), { status: 404 });
    const loan = loans[loanIndex];
    if (loan.estado !== 'activo') {
      throw Object.assign(new Error('Este préstamo ya fue devuelto.'), { status: 409 });
    }
    const now = new Date();
    const dueAt = new Date(loan.fechaVencimiento);
    const daysLate = Math.max(0, Math.ceil((now - dueAt) / 86400000));
    const fine = daysLate * FINE_PER_DAY;
    const userIndex = users.findIndex((user) => user.id === loan.usuarioId);
    const bookIndex = books.findIndex((book) => book.id === loan.libroId);
    if (bookIndex < 0) throw Object.assign(new Error('No se encontró el libro asociado; no se puede completar la devolución.'), { status: 409 });

    const updatedLoan = {
      ...loan,
      fechaDevolucion: now.toISOString(),
      diasRetraso: daysLate,
      multa: fine,
      estado: 'devuelto',
    };
    loans[loanIndex] = updatedLoan;
    books[bookIndex].stockDisponible = Math.min(books[bookIndex].stockTotal, books[bookIndex].stockDisponible + 1);
    if (daysLate > 7 && userIndex >= 0) {
      const blockedUntil = new Date(now);
      blockedUntil.setDate(blockedUntil.getDate() + 7);
      const existing = users[userIndex].bloqueadoHasta ? new Date(users[userIndex].bloqueadoHasta) : null;
      users[userIndex].bloqueadoHasta = (existing && existing > blockedUntil ? existing : blockedUntil).toISOString();
    }
    await booksModel.saveAll(books);
    await loansModel.saveAll(loans);
    if (userIndex >= 0) await usersModel.saveAll(users);
    return {
      ...updatedLoan,
      multaPorDia: FINE_PER_DAY,
      usuarioBloqueadoHasta: daysLate > 7 && userIndex >= 0 ? users[userIndex].bloqueadoHasta : null,
    };
  });
}

module.exports = { listLoans, createLoan, returnLoan };
