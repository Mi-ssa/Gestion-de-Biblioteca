const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const booksModel = require('../src/models/book.model');
const finePaymentsModel = require('../src/models/fine-payment.model');
const loansModel = require('../src/models/loan.model');
const usersModel = require('../src/models/user.model');
const JsonFileModel = require('../src/models/json-file.model');
const finePaymentService = require('../src/services/fine-payment.service');
const loanService = require('../src/services/loan.service');

const librarian = { id: 'librarian-1', rol: 'bibliotecario' };
const borrower = {
  id: 'borrower-1',
  nombre: 'Estudiante de prueba',
  rol: 'estudiante',
  bloqueadoHasta: null,
};

function configureModels({ users = [librarian, borrower], loans = [], payments = [] } = {}) {
  let storedUsers = structuredClone(users);
  let storedLoans = structuredClone(loans);
  let storedPayments = structuredClone(payments);
  let storedBooks = [{ id: 'book-1', stockTotal: 3, stockDisponible: 3 }];

  usersModel.findAll = async () => structuredClone(storedUsers);
  usersModel.saveAll = async (records) => {
    storedUsers = structuredClone(records);
    return structuredClone(records);
  };
  loansModel.findAll = async () => structuredClone(storedLoans);
  loansModel.saveAll = async (records) => {
    storedLoans = structuredClone(records);
    return structuredClone(records);
  };
  finePaymentsModel.findAll = async () => structuredClone(storedPayments);
  finePaymentsModel.saveAll = async (records) => {
    storedPayments = structuredClone(records);
    return structuredClone(records);
  };
  booksModel.findAll = async () => structuredClone(storedBooks);
  booksModel.saveAll = async (records) => {
    storedBooks = structuredClone(records);
    return structuredClone(records);
  };

  return {
    get users() { return structuredClone(storedUsers); },
    get loans() { return structuredClone(storedLoans); },
    get payments() { return structuredClone(storedPayments); },
    failPaymentSave() {
      finePaymentsModel.saveAll = async () => {
        throw new Error('Simulated payment ledger write failure.');
      };
    },
  };
}

function returnedLoan(id, userId = borrower.id, fine = 30) {
  return {
    id,
    usuarioId: userId,
    libroId: 'book-1',
    fechaPrestamo: '2026-10-01T12:00:00.000Z',
    fechaVencimiento: '2026-10-15T12:00:00.000Z',
    fechaDevolucion: '2026-10-20T12:00:00.000Z',
    diasRetraso: 3,
    multa: fine,
    estado: 'devuelto',
  };
}

test('legacy returned fines remain pending unless the payment ledger references them', () => {
  configureModels();
  const loans = [
    returnedLoan('old-unpaid', borrower.id, 80),
    returnedLoan('old-partly-paid', borrower.id, 50),
    { ...returnedLoan('active-estimate', borrower.id, 100), estado: 'activo' },
  ];
  const payments = [{
    id: 'payment-1',
    userId: borrower.id,
    librarianId: librarian.id,
    method: 'presencial',
    recordedAt: '2026-10-21T12:00:00.000Z',
    amount: 20,
    loans: [{ loanId: 'old-partly-paid', amount: 20 }],
  }];

  const debts = finePaymentService.getPendingFineByUser(loans, payments);
  assert.equal(debts.get(borrower.id), 110);
});

test('registering payment settles fines without changing historical loans and cannot be repeated', async () => {
  const oldLoans = [returnedLoan('fine-1', borrower.id, 80), returnedLoan('fine-2', borrower.id, 30)];
  const stores = configureModels({ loans: oldLoans });
  const originalLoans = JSON.stringify(oldLoans);

  const [first, repeated] = await Promise.allSettled([
    finePaymentService.registerFinePayment(borrower.id, librarian.id, new Date('2026-10-27T12:00:00.000Z')),
    finePaymentService.registerFinePayment(borrower.id, librarian.id, new Date('2026-10-27T12:00:01.000Z')),
  ]);
  assert.equal(first.status, 'fulfilled');
  assert.equal(first.value.amount, 110);
  assert.equal(first.value.userId, borrower.id);
  assert.equal(first.value.librarianId, librarian.id);
  assert.equal(first.value.method, 'presencial');
  assert.equal(first.value.recordedAt, '2026-10-27T12:00:00.000Z');
  assert.deepEqual(first.value.loans, [
    { loanId: 'fine-1', amount: 80 },
    { loanId: 'fine-2', amount: 30 },
  ]);
  assert.equal(repeated.status, 'rejected');
  assert.equal(repeated.reason.status, 409);
  assert.equal(stores.payments.length, 1);
  assert.equal(finePaymentService.getPendingFineByUser(stores.loans, stores.payments).get(borrower.id), undefined);
  assert.equal(JSON.stringify(stores.loans), originalLoans);
});

test('only an existing librarian can register a payment', async () => {
  configureModels({ loans: [returnedLoan('fine-1')] });
  await assert.rejects(
    finePaymentService.registerFinePayment(borrower.id, borrower.id),
    { status: 403 },
  );
  await assert.rejects(
    finePaymentService.registerFinePayment(borrower.id, 'missing-librarian'),
    { status: 403 },
  );
});

test('payment persistence errors do not append a ledger record or change fines', async () => {
  const loan = returnedLoan('fine-1', borrower.id, 45);
  const stores = configureModels({ loans: [loan] });
  const originalLoans = JSON.stringify(stores.loans);
  stores.failPaymentSave();

  await assert.rejects(
    finePaymentService.registerFinePayment(borrower.id, librarian.id),
    /Simulated payment ledger write failure/,
  );
  assert.equal(stores.payments.length, 0);
  assert.equal(JSON.stringify(stores.loans), originalLoans);
});

test('expired sanctions do not release borrowers with debt; payment does not shorten a live sanction', async () => {
  const userWithExpiredSanction = {
    ...borrower,
    bloqueadoHasta: '2026-10-26T12:00:00.000Z',
  };
  const stores = configureModels({
    users: [librarian, userWithExpiredSanction],
    loans: [returnedLoan('fine-1', borrower.id, 35)],
  });
  await assert.rejects(
    loanService.createLoan({ usuarioId: borrower.id, libroId: 'book-1' }),
    { status: 403 },
  );

  const liveSanctionUsers = stores.users;
  liveSanctionUsers[1].bloqueadoHasta = '2026-11-05T12:00:00.000Z';
  await usersModel.saveAll(liveSanctionUsers);
  await finePaymentService.registerFinePayment(borrower.id, librarian.id);
  assert.equal(stores.users[1].bloqueadoHasta, '2026-11-05T12:00:00.000Z');
  await assert.rejects(
    loanService.createLoan({ usuarioId: borrower.id, libroId: 'book-1' }),
    { status: 403 },
  );

  const expiredSanctionUsers = stores.users;
  expiredSanctionUsers[1].bloqueadoHasta = '2026-10-26T12:00:00.000Z';
  await usersModel.saveAll(expiredSanctionUsers);
  const loan = await loanService.createLoan({ usuarioId: borrower.id, libroId: 'book-1' });
  assert.equal(loan.estado, 'activo');
});

test('the payment ledger survives reopening its JSON model', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'entrel-neas-payments-'));
  try {
    const filePath = path.join(directory, 'pagos.json');
    const firstModel = new JsonFileModel('unused.json');
    firstModel.filePath = filePath;
    const record = {
      id: 'payment-1',
      userId: borrower.id,
      librarianId: librarian.id,
      method: 'presencial',
      recordedAt: '2026-10-27T12:00:00.000Z',
      amount: 20,
      loans: [{ loanId: 'fine-1', amount: 20 }],
    };
    await firstModel.saveAll([record]);

    const reopenedModel = new JsonFileModel('unused.json');
    reopenedModel.filePath = filePath;
    assert.deepEqual(await reopenedModel.findAll(), [record]);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
