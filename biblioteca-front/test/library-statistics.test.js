import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateLibraryStatistics } from '../src/utils/library-statistics.js';

const books = [
  { id: 'b1', categoria: 'Novela', stockTotal: 4, stockDisponible: 2 },
  { id: 'b2', categoria: 'Novela', stockTotal: 2, stockDisponible: 2 },
  { id: 'b3', categoria: 'Infantil', stockTotal: 3, stockDisponible: 1 },
  { id: 'b4', categoria: '', stockTotal: 1, stockDisponible: 1 },
];

const users = [
  { id: 'u1', nombre: 'Nombre privado', email: 'privado@example.test', rol: 'estudiante' },
  { id: 'u2', nombre: 'Otro nombre', email: 'otro@example.test', rol: 'estudiante' },
  { id: 'u3', rol: 'docente' },
  { id: 'u4', rol: 'bibliotecario' },
  { id: 'u5', rol: 'rol-nuevo' },
];

const loans = [
  {
    id: 'l1',
    libroId: 'b1',
    estado: 'devuelto',
    fechaPrestamo: '2026-09-10T12:00:00.000Z',
    fechaDevolucion: '2026-09-16T12:00:00.000Z',
  },
  {
    id: 'l2',
    libroId: 'b1',
    estado: 'activo',
    fechaPrestamo: '2026-10-02T12:00:00.000Z',
    fechaDevolucion: null,
  },
  {
    id: 'l3',
    libroId: 'b2',
    estado: 'devuelto',
    fechaPrestamo: 'invalid-date',
    fechaDevolucion: '2026-10-03T12:00:00.000Z',
  },
];

test('aggregates category titles and physical copy counts separately', () => {
  const statistics = calculateLibraryStatistics({ books, users, loans });
  assert.deepEqual(statistics.categories, [
    { category: 'Infantil', titles: 1, copies: 3 },
    { category: 'Novela', titles: 2, copies: 6 },
  ]);
});

test('availability totals match book physical stock and card availability', () => {
  const statistics = calculateLibraryStatistics({ books, users, loans });
  assert.deepEqual(statistics.inventory, {
    totalCopies: 10,
    availableCopies: 6,
    borrowedCopies: 1,
    otherCopies: 3,
    activeLoanCount: 1,
  });
  assert.equal(
    statistics.inventory.availableCopies,
    books.reduce((total, book) => total + book.stockDisponible, 0),
  );
  assert.equal(
    statistics.inventory.availableCopies
      + statistics.inventory.borrowedCopies
      + statistics.inventory.otherCopies,
    statistics.inventory.totalCopies,
  );
});

test('distributes loans into mutually exclusive returned, active, and overdue statuses', () => {
  const loanRecords = [
    { estado: 'activo', fechaVencimiento: '2026-10-30T00:00:00.000Z' },
    { estado: 'activo', fechaVencimiento: '2026-10-27T00:00:00.000Z' },
    { estado: 'devuelto', fechaVencimiento: '2026-10-01T00:00:00.000Z' },
    { estado: 'pendiente', fechaVencimiento: '2026-11-01T00:00:00.000Z' },
  ];
  const statistics = calculateLibraryStatistics({
    books,
    users,
    loans: loanRecords,
    now: new Date('2026-10-28T02:48:00.000Z'),
  });

  assert.deepEqual(statistics.loanStatuses, [
    { status: 'activo', label: 'Activos', count: 1 },
    { status: 'vencido', label: 'Vencidos', count: 1 },
    { status: 'devuelto', label: 'Devueltos', count: 1 },
    { status: 'otro', label: 'Otros', count: 1 },
  ]);
  assert.equal(statistics.loanStatuses.reduce((total, item) => total + item.count, 0), loanRecords.length);
});

test('counts known roles without exposing personal data and preserves unknown roles as others', () => {
  const statistics = calculateLibraryStatistics({ books, users, loans });
  assert.deepEqual(statistics.roles, [
    { role: 'estudiante', label: 'Estudiantes', count: 2 },
    { role: 'docente', label: 'Docentes', count: 1 },
    { role: 'bibliotecario', label: 'Bibliotecarios', count: 1 },
    { role: 'otro', label: 'Otros', count: 1 },
  ]);
  assert.equal(JSON.stringify(statistics).includes('privado@example.test'), false);
  assert.equal(JSON.stringify(statistics).includes('Nombre privado'), false);
});

test('returns empty chart data and ignores malformed optional collections', () => {
  const statistics = calculateLibraryStatistics({ books: null, users: [], loans: {} });
  assert.deepEqual(statistics.categories, []);
  assert.deepEqual(statistics.loanStatuses, []);
  assert.deepEqual(statistics.roles, []);
  assert.deepEqual(statistics.inventory, {
    totalCopies: 0,
    availableCopies: 0,
    borrowedCopies: 0,
    otherCopies: 0,
    activeLoanCount: 0,
  });
});
