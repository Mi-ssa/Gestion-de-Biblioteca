import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReturnNotification } from '../src/utils/return-notification.js';

test('formats a successful return without delay using the definitive API fine', () => {
  assert.deepEqual(createReturnNotification({ diasRetraso: 0, multa: 0 }), {
    type: 'success',
    title: 'Devolución registrada',
    message: 'El libro se ha devuelto correctamente. Multa definitiva: $0.00 MXN',
  });
});

test('includes the book title in a successful return notification when provided', () => {
  assert.equal(
    createReturnNotification({ diasRetraso: 0, multa: 0 }, { bookTitle: 'El principito' }).message,
    '“El principito” se ha devuelto correctamente. Multa definitiva: $0.00 MXN',
  );
});

test('formats late days and definitive fine from the API response', () => {
  assert.equal(createReturnNotification({ diasRetraso: 3, multa: 30 }).type, 'warning');
  assert.equal(
    createReturnNotification({ diasRetraso: 3, multa: 30 }).message,
    'Retraso: 3 días. Multa definitiva: $30.00 MXN',
  );
});

test('includes the book title when a returned book has a fine', () => {
  assert.equal(
    createReturnNotification({ diasRetraso: 3, multa: 30 }, { bookTitle: 'El principito' }).message,
    '“El principito”. Retraso: 3 días. Multa definitiva: $30.00 MXN',
  );
});

test('includes a backend-provided unlock date when one is valid', () => {
  const notification = createReturnNotification({
    diasRetraso: 11,
    multa: 110,
    usuarioBloqueadoHasta: '2026-11-02T06:09:26.169Z',
  });
  assert.match(notification.message, /^Retraso: 11 días\. Multa definitiva: \$110\.00 MXN\nUsuario bloqueado hasta /);
});

test('does not invent or display an invalid unlock date', () => {
  const notification = createReturnNotification({
    diasRetraso: 8,
    multa: 80,
    usuarioBloqueadoHasta: 'invalid-date',
  });
  assert.equal(notification.message, 'Retraso: 8 días. Multa definitiva: $80.00 MXN');
});
