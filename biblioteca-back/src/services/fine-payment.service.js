const { randomUUID } = require('node:crypto');
const finePaymentsModel = require('../models/fine-payment.model');
const loansModel = require('../models/loan.model');
const usersModel = require('../models/user.model');
const withOperationLock = require('./operation-lock');

function amountInCentavos(value) {
  if (!Number.isFinite(value) || value < 0) return null;
  const centavos = Math.round(value * 100);
  if (Math.abs(value * 100 - centavos) > 0.000001) {
    throw new Error('El registro de multas contiene un importe con precisión inválida.');
  }
  return centavos;
}

function calculatePaidFineByLoan(loans, payments) {
  const loansById = new Map(loans.map((loan) => [loan.id, loan]));
  const paidByLoan = new Map();
  const paymentIds = new Set();

  for (const payment of payments) {
    if (
      !payment
      || typeof payment.id !== 'string'
      || !payment.id
      || paymentIds.has(payment.id)
      || typeof payment.userId !== 'string'
      || !payment.userId
      || typeof payment.librarianId !== 'string'
      || !payment.librarianId
      || payment.method !== 'presencial'
      || !Number.isFinite(Date.parse(payment.recordedAt))
      || amountInCentavos(payment.amount) === null
      || amountInCentavos(payment.amount) <= 0
      || !Array.isArray(payment.loans)
      || payment.loans.length === 0
    ) {
      throw new Error('El registro de pagos contiene una operación inválida.');
    }
    paymentIds.add(payment.id);
    const allocatedLoanIds = new Set();
    let paymentTotal = 0;
    for (const allocation of payment.loans) {
      const loan = loansById.get(allocation.loanId);
      const allocationCentavos = amountInCentavos(allocation.amount);
      if (
        typeof allocation.loanId !== 'string'
        || allocatedLoanIds.has(allocation.loanId)
        || !loan
        || loan.usuarioId !== payment.userId
        || loan.estado !== 'devuelto'
        || allocationCentavos === null
        || allocationCentavos <= 0
      ) {
        throw new Error('El registro de pagos contiene una referencia de multa inválida.');
      }
      allocatedLoanIds.add(allocation.loanId);
      paymentTotal += allocationCentavos;
      paidByLoan.set(allocation.loanId, (paidByLoan.get(allocation.loanId) || 0) + allocationCentavos);
    }
    if (paymentTotal !== amountInCentavos(payment.amount)) {
      throw new Error('El registro de pagos contiene importes inconsistentes.');
    }
  }

  for (const [loanId, paidCentavos] of paidByLoan) {
    const loan = loansById.get(loanId);
    const fineCentavos = amountInCentavos(loan.multa);
    if (fineCentavos === null || paidCentavos > fineCentavos) {
      throw new Error('El registro de pagos excede el importe de una multa.');
    }
  }

  return paidByLoan;
}

function getPendingFineByUser(loans, payments) {
  const paidByLoan = calculatePaidFineByLoan(loans, payments);
  const debtByUser = new Map();
  for (const loan of loans) {
    if (loan.estado !== 'devuelto') continue;
    const fineCentavos = amountInCentavos(loan.multa);
    if (fineCentavos === null) {
      throw new Error('No se puede determinar la multa de un préstamo devuelto.');
    }
    if (fineCentavos <= 0) continue;
    const outstandingCentavos = Math.max(0, fineCentavos - (paidByLoan.get(loan.id) || 0));
    if (outstandingCentavos > 0) {
      debtByUser.set(
        loan.usuarioId,
        (debtByUser.get(loan.usuarioId) || 0) + outstandingCentavos,
      );
    }
  }
  for (const [userId, debtCentavos] of debtByUser) {
    debtByUser.set(userId, debtCentavos / 100);
  }
  return debtByUser;
}

function getUserBlockingStatus(user, pendingFine, now = new Date()) {
  const blockUntil = typeof user.bloqueadoHasta === 'string'
    ? new Date(user.bloqueadoHasta)
    : null;
  const temporaryBlockUntil = blockUntil && !Number.isNaN(blockUntil.getTime()) && blockUntil > now
    ? blockUntil
    : null;
  const isBorrower = user.rol === 'estudiante' || user.rol === 'docente';
  return {
    blocked: isBorrower && (temporaryBlockUntil !== null || pendingFine > 0),
    temporaryBlockUntil,
  };
}

async function registerFinePayment(userId, librarianId, now = new Date()) {
  return withOperationLock(async () => {
    const [users, loans, payments] = await Promise.all([
      usersModel.findAll(),
      loansModel.findAll(),
      finePaymentsModel.findAll(),
    ]);
    const librarian = users.find((user) => user.id === librarianId && user.rol === 'bibliotecario');
    if (!librarian) {
      throw Object.assign(new Error('Solo un bibliotecario autorizado puede registrar pagos.'), { status: 403 });
    }
    const user = users.find((record) => record.id === userId);
    if (!user) throw Object.assign(new Error('Usuario no encontrado.'), { status: 404 });
    if (!['estudiante', 'docente'].includes(user.rol)) {
      throw Object.assign(new Error('Solo se pueden registrar pagos de estudiantes y docentes.'), { status: 400 });
    }

    const pendingFineByUser = getPendingFineByUser(loans, payments);
    const pendingFine = pendingFineByUser.get(userId) || 0;
    if (pendingFine <= 0) {
      throw Object.assign(new Error('El usuario no tiene una deuda pendiente por pagar.'), { status: 409 });
    }
    const paidByLoan = calculatePaidFineByLoan(loans, payments);
    const allocations = loans
      .filter((loan) => loan.usuarioId === userId && loan.estado === 'devuelto')
      .map((loan) => {
        const fineCentavos = amountInCentavos(loan.multa);
        const outstandingCentavos = fineCentavos !== null && fineCentavos > 0
          ? Math.max(0, fineCentavos - (paidByLoan.get(loan.id) || 0))
          : 0;
        return { loanId: loan.id, amount: outstandingCentavos / 100 };
      })
      .filter((allocation) => allocation.amount > 0);
    const amountCentavos = allocations.reduce(
      (total, allocation) => total + amountInCentavos(allocation.amount),
      0,
    );
    const amount = amountCentavos / 100;
    const payment = {
      id: randomUUID(),
      userId,
      librarianId,
      method: 'presencial',
      recordedAt: now.toISOString(),
      amount,
      loans: allocations,
    };
    await finePaymentsModel.saveAll([...payments, payment]);
    return payment;
  });
}

module.exports = {
  getPendingFineByUser,
  getUserBlockingStatus,
  registerFinePayment,
};
