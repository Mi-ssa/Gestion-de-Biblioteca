import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { formatMxn } from '../src/utils/currency.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('formats MXN values with Mexican Spanish currency formatting', () => {
  assert.equal(formatMxn(0), '$0.00 MXN');
  assert.equal(formatMxn(10), '$10.00 MXN');
  assert.equal(formatMxn(30), '$30.00 MXN');
  assert.equal(formatMxn(80), '$80.00 MXN');
});

test('loan history and return notifications do not label fine amounts as USD', async () => {
  const files = [
    'src/components/LoanCard.jsx',
    'src/utils/return-notification.js',
  ];
  const contents = await Promise.all(
    files.map((file) => readFile(path.join(projectRoot, file), 'utf8')),
  );
  assert.ok(contents.every((content) => !/\bUSD\b/.test(content)));
});
