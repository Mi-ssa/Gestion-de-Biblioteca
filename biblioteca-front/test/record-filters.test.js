import assert from 'node:assert/strict';
import { test } from 'node:test';
import { filterLoans, filterUsers } from '../src/utils/record-filters.js';

const users = [
  { id: 'usr-001', nombre: 'Ana Martínez', email: 'ana@escuela.edu', rol: 'estudiante' },
  { id: 'usr-002', nombre: 'Carlos Ruiz', email: 'carlos@escuela.edu', rol: 'docente' },
  { id: 'usr-003', nombre: 'Lucía Fernández', email: 'lucia@escuela.edu', rol: 'bibliotecario' },
];

const now = new Date('2026-10-26T12:00:00.000Z');
const loans = [
  {
    id: 'pre-001',
    estado: 'activo',
    fechaVencimiento: '2026-10-27T12:00:00.000Z',
    usuario: { nombre: 'Ana Martínez' },
    libro: { titulo: 'Cien años de soledad' },
  },
  {
    id: 'pre-002',
    estado: 'activo',
    fechaVencimiento: '2026-10-25T12:00:00.000Z',
    usuario: { nombre: 'Carlos Ruiz' },
    libro: { titulo: 'El principito' },
  },
  {
    id: 'pre-003',
    estado: 'devuelto',
    fechaVencimiento: '2026-10-20T12:00:00.000Z',
    usuario: { nombre: 'Ana Martínez' },
    libro: { titulo: 'La ciudad y los perros' },
  },
];

test('filters users by partial case-insensitive name, email, or ID and combines role', () => {
  assert.deepEqual(filterUsers(users, { query: 'MARTÍ', role: 'estudiante' }), [users[0]]);
  assert.deepEqual(filterUsers(users, { query: 'CARLOS@', role: 'docente' }), [users[1]]);
  assert.deepEqual(filterUsers(users, { query: 'usr-003', role: 'bibliotecario' }), [users[2]]);
  assert.deepEqual(filterUsers(users, { query: 'ana', role: 'docente' }), []);
});

test('filters loans by partial case-insensitive associated names and titles', () => {
  assert.deepEqual(filterLoans(loans, { query: 'cien AÑOS' }, now), [loans[0]]);
  assert.deepEqual(filterLoans(loans, { query: 'carlos' }, now), [loans[1]]);
});

test('filters loans by active, overdue, and returned states and combines filters', () => {
  assert.deepEqual(filterLoans(loans, { status: 'activo' }, now), [loans[0]]);
  assert.deepEqual(filterLoans(loans, { status: 'vencido' }, now), [loans[1]]);
  assert.deepEqual(filterLoans(loans, { status: 'devuelto' }, now), [loans[2]]);
  assert.deepEqual(filterLoans(loans, { query: 'Ana', status: 'vencido' }, now), []);
});

test('returns no matches for empty lists or unmatched searches', () => {
  assert.deepEqual(filterUsers([], { query: 'ana' }), []);
  assert.deepEqual(filterUsers(users, { query: 'inexistente' }), []);
  assert.deepEqual(filterLoans([], { status: 'activo' }, now), []);
  assert.deepEqual(filterLoans(loans, { query: 'inexistente' }, now), []);
});
