// test/google-client.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSheetsClient, normalizePrivateKey } from '../lib/google-client.js';
import * as sheetGoogle from '../lib/sheet-google.js';

test('createSheetsClient requires credentials with a clear message', () => {
  assert.throws(() => createSheetsClient({ clientEmail: '', privateKey: 'k' }), /GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY/);
  assert.throws(() => createSheetsClient({ clientEmail: 'a@b.c', privateKey: '' }), /GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY/);
});

test('createSheetsClient returns a Sheets client without calling the network', () => {
  const client = createSheetsClient({ clientEmail: 'svc@example.iam.gserviceaccount.com', privateKey: 'not-a-real-key' });
  assert.equal(typeof client.spreadsheets.values.get, 'function');
});

test('normalizePrivateKey still turns literal \\n into newlines and sheet-google re-exports it', () => {
  assert.equal(normalizePrivateKey('a\\nb'), 'a\nb');
  assert.equal(sheetGoogle.normalizePrivateKey('a\\nb'), 'a\nb');
});
