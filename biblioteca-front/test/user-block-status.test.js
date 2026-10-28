import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getLoanStatus } from '../src/utils/record-filters.js';
import { getActiveBlockUntil, getUserBlockDetails } from '../src/utils/user-block-status.js';

const now = new Date('2026-10-26T12:00:00.000Z');

test('recognizes a valid future block date and ignores null', () => {
  assert.equal(
    getActiveBlockUntil('2026-10-27T12:00:00.000Z', now)?.toISOString(),
    '2026-10-27T12:00:00.000Z',
  );
  assert.equal(getActiveBlockUntil(null, now), null);
});

test('ignores expired, invalid, empty, and non-string block dates', () => {
  assert.equal(getActiveBlockUntil('2026-10-25T12:00:00.000Z', now), null);
  assert.equal(getActiveBlockUntil('not-a-date', now), null);
  assert.equal(getActiveBlockUntil('', now), null);
  assert.equal(getActiveBlockUntil(1793016000000, now), null);
});

test('loan overdue state is independent from the associated user block', () => {
  const overdueLoanForUnblockedUser = {
    estado: 'activo',
    fechaVencimiento: '2026-10-25T12:00:00.000Z',
    usuario: { bloqueadoHasta: null },
  };
  const loanForBlockedUserStillWithinTerm = {
    estado: 'activo',
    fechaVencimiento: '2026-10-27T12:00:00.000Z',
    usuario: { bloqueadoHasta: '2026-10-28T12:00:00.000Z' },
  };

  assert.equal(getLoanStatus(overdueLoanForUnblockedUser, now), 'vencido');
  assert.equal(getActiveBlockUntil(overdueLoanForUnblockedUser.usuario.bloqueadoHasta, now), null);
  assert.equal(getLoanStatus(loanForBlockedUserStillWithinTerm, now), 'activo');
  assert.ok(getActiveBlockUntil(loanForBlockedUserStillWithinTerm.usuario.bloqueadoHasta, now));
});

test('a blocked borrower with pending debt sees the debt and payment action', () => {
  assert.deepEqual(getUserBlockDetails({
    rol: 'estudiante',
    bloqueado: true,
    bloqueadoHasta: null,
    deudaPendiente: 80,
  }, now), {
    isBorrower: true,
    blocked: true,
    blockedUntil: null,
    pendingDebt: 80,
    canRegisterFinePayment: true,
  });
});

test('a borrower without debt does not get the payment action', () => {
  assert.equal(getUserBlockDetails({
    rol: 'docente',
    bloqueado: true,
    bloqueadoHasta: '2026-10-27T12:00:00.000Z',
    deudaPendiente: 0,
  }, now).canRegisterFinePayment, false);
  const librarianWithLegacyFine = getUserBlockDetails({
    rol: 'bibliotecario',
    bloqueado: false,
    deudaPendiente: 500,
  }, now);
  assert.equal(librarianWithLegacyFine.canRegisterFinePayment, false);
  assert.equal(librarianWithLegacyFine.isBorrower, false);
});

test('cent-level pending debt remains visible and payable', () => {
  const details = getUserBlockDetails({
    rol: 'docente',
    bloqueado: true,
    deudaPendiente: 10.5,
  }, now);
  assert.equal(details.pendingDebt, 10.5);
  assert.equal(details.canRegisterFinePayment, true);
});
