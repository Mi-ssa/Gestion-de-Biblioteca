import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getWelcomeGreeting } from '../src/utils/welcome-greeting.js';

function localTime(hour) {
  return new Date(2026, 0, 1, hour);
}

test('uses the authenticated name and local morning, afternoon, and evening hours', () => {
  assert.equal(getWelcomeGreeting('Lucía', localTime(5)), 'Buenos días, Lucía');
  assert.equal(getWelcomeGreeting('Carlos', localTime(11)), 'Buenos días, Carlos');
  assert.equal(getWelcomeGreeting('Ana', localTime(12)), 'Buenas tardes, Ana');
  assert.equal(getWelcomeGreeting('Carlos', localTime(18)), 'Buenas tardes, Carlos');
  assert.equal(getWelcomeGreeting('Ana', localTime(19)), 'Buenas noches, Ana');
  assert.equal(getWelcomeGreeting('Lucía', localTime(4)), 'Buenas noches, Lucía');
});

test('uses a neutral greeting when the authenticated name is not available', () => {
  assert.equal(getWelcomeGreeting(undefined, localTime(8)), 'Bienvenido/a a Entrelíneas');
  assert.equal(getWelcomeGreeting('   ', localTime(14)), 'Bienvenido/a a Entrelíneas');
});
