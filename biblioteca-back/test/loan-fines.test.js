const assert = require('node:assert/strict');
const { test } = require('node:test');

const booksModel = require('../src/models/book.model');
const loansModel = require('../src/models/loan.model');
const usersModel = require('../src/models/user.model');
const loanService = require('../src/services/loan.service');

const FINE_PER_DAY_MXN = 10;
const MILLISECONDS_PER_DAY = 86400000;
const dueDate = new Date('2026-10-20T12:00:00.000Z');
const baseLoan = {
  id: 'loan-1',
  usuarioId: 'user-1',
  libroId: 'book-1',
  fechaPrestamo: '2026-10-06T12:00:00.000Z',
  fechaVencimiento: dueDate.toISOString(),
  fechaDevolucion: null,
  diasRetraso: 0,
  multa: 0,
  estado: 'activo',
};

function configureModels(loanRecords = [baseLoan]) {
  const book = { id: 'book-1', stockTotal: 1, stockDisponible: 0 };
  const user = { id: 'user-1', bloqueadoHasta: null };
  let storedLoans = structuredClone(loanRecords);
  let storedBooks = [structuredClone(book)];
  let storedUsers = [structuredClone(user)];

  loansModel.findAll = async () => structuredClone(storedLoans);
  loansModel.saveAll = async (records) => {
    storedLoans = structuredClone(records);
    return records;
  };
  booksModel.findAll = async () => structuredClone(storedBooks);
  booksModel.saveAll = async (records) => {
    storedBooks = structuredClone(records);
    return records;
  };
  usersModel.findAll = async () => structuredClone(storedUsers);
  usersModel.saveAll = async (records) => {
    storedUsers = structuredClone(records);
    return records;
  };
  return {
    get loans() { return structuredClone(storedLoans); },
  };
}

test('an active loan within its deadline has no estimated fine', async () => {
  configureModels();
  const [loan] = await loanService.listLoans(new Date(dueDate.getTime() - 1));
  assert.equal(loan.multaEstimada, undefined);
  assert.equal(loan.diasRetrasoEstimados, undefined);
  assert.equal(loan.multa, 0);
});

test('estimates one day of delay at 10 MXN per day', async () => {
  configureModels();
  const [loan] = await loanService.listLoans(new Date(dueDate.getTime() + MILLISECONDS_PER_DAY));
  assert.equal(loan.diasRetrasoEstimados, 1);
  assert.equal(loan.multaEstimada, 10);
  assert.equal(loan.multa, 0);
});

test('estimates three days of delay at 10 MXN per day', async () => {
  configureModels();
  const [loan] = await loanService.listLoans(new Date(dueDate.getTime() + (3 * MILLISECONDS_PER_DAY)));
  assert.equal(loan.diasRetrasoEstimados, 3);
  assert.equal(loan.multaEstimada, 30);
  assert.equal(loan.multa, 0);
});

test('estimates eight days of delay at 10 MXN per day', async () => {
  configureModels();
  const [loan] = await loanService.listLoans(new Date(dueDate.getTime() + (8 * MILLISECONDS_PER_DAY)));
  assert.equal(loan.diasRetrasoEstimados, 8);
  assert.equal(loan.multaEstimada, 80);
});

test('a fraction of a late day rounds up consistently with the return calculation', async () => {
  const stores = configureModels();
  const returnedAt = new Date(dueDate.getTime() + 1);
  const [listedLoan] = await loanService.listLoans(returnedAt);
  const returnedLoan = await loanService.returnLoan(baseLoan.id, returnedAt);
  assert.equal(listedLoan.diasRetrasoEstimados, 1);
  assert.equal(listedLoan.multaEstimada, FINE_PER_DAY_MXN);
  assert.equal(returnedLoan.diasRetraso, listedLoan.diasRetrasoEstimados);
  assert.equal(returnedLoan.multa, listedLoan.multaEstimada);
  assert.equal(stores.loans[0].estado, 'devuelto');
});

test('a returned loan on time records zero late days and zero definitive fine', async () => {
  configureModels();
  const returnedLoan = await loanService.returnLoan(baseLoan.id, new Date(dueDate.getTime() - 1));
  assert.equal(returnedLoan.diasRetraso, 0);
  assert.equal(returnedLoan.multa, 0);
  assert.ok(returnedLoan.fechaDevolucion);
});

test('a returned loan one day late records a 10 MXN fine', async () => {
  configureModels();
  const returnedLoan = await loanService.returnLoan(
    baseLoan.id,
    new Date(dueDate.getTime() + 1),
  );
  assert.equal(returnedLoan.diasRetraso, 1);
  assert.equal(returnedLoan.multa, 10);
  assert.equal(returnedLoan.multaPorDia, FINE_PER_DAY_MXN);
});

test('a returned loan three days late records a 30 MXN fine', async () => {
  configureModels();
  const returnedLoan = await loanService.returnLoan(
    baseLoan.id,
    new Date(dueDate.getTime() + (2 * MILLISECONDS_PER_DAY) + 1),
  );
  assert.equal(returnedLoan.diasRetraso, 3);
  assert.equal(returnedLoan.multa, 30);
  assert.equal(returnedLoan.multaPorDia, FINE_PER_DAY_MXN);
});

test('a returned loan eight days late records an 80 MXN fine and preserves the block rule', async () => {
  const stores = configureModels();
  const returnedAt = new Date(dueDate.getTime() + (7 * MILLISECONDS_PER_DAY) + 1);
  const returnedLoan = await loanService.returnLoan(baseLoan.id, returnedAt);
  assert.equal(returnedLoan.diasRetraso, 8);
  assert.equal(returnedLoan.multa, 80);
  assert.equal(returnedLoan.multaPorDia, FINE_PER_DAY_MXN);
  assert.equal(returnedLoan.usuarioBloqueadoHasta, new Date(
    returnedAt.getTime() + (7 * MILLISECONDS_PER_DAY),
  ).toISOString());
  assert.equal(stores.loans[0].multa, 80);
});

test('a seven-day delay does not activate the existing block rule', async () => {
  configureModels();
  const returnedLoan = await loanService.returnLoan(
    baseLoan.id,
    new Date(dueDate.getTime() + (6 * MILLISECONDS_PER_DAY) + 1),
  );
  assert.equal(returnedLoan.diasRetraso, 7);
  assert.equal(returnedLoan.multa, 70);
  assert.equal(returnedLoan.usuarioBloqueadoHasta, null);
});

test('listing estimated fines does not persist or modify active loan records', async () => {
  configureModels();
  const originalRecords = JSON.stringify([baseLoan]);
  let saveCalls = 0;
  loansModel.saveAll = async () => {
    saveCalls += 1;
    throw new Error('Listing loans must not write loan data.');
  };

  const [loan] = await loanService.listLoans(new Date(dueDate.getTime() + 1));
  assert.equal(loan.multaEstimada, 10);
  assert.equal(JSON.stringify([baseLoan]), originalRecords);
  assert.equal(saveCalls, 0);
});
