// test/config.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadVenue, createSheet } from '../lib/config.js';
import { clientIp } from '../lib/http.js';

test('loadVenue falls back to TBD placeholders', () => {
  assert.deepEqual(loadVenue({}), { name: '[VENUE NAME TBD]', address: '[STREET ADDRESS TBD]' });
});

test('loadVenue uses env values', () => {
  assert.deepEqual(loadVenue({ VENUE_NAME: 'X', VENUE_ADDRESS: 'Y' }), { name: 'X', address: 'Y' });
});

test('createSheet refuses a file fallback in production', () => {
  assert.throws(() => createSheet({ CONTEXT: 'production' }), /GOOGLE_SHEET_ID/);
});

test('createSheet returns a file sheet in dev', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cfg-'));
  const sheet = createSheet({ DEV_SHEET_PATH: join(dir, 's.json') });
  for (const m of ['findByEmail', 'append', 'update']) assert.equal(typeof sheet[m], 'function');
});

test('clientIp precedence', () => {
  assert.equal(clientIp({ headers: { 'x-nf-client-connection-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' } }), '1.1.1.1');
  assert.equal(clientIp({ headers: { 'x-forwarded-for': '2.2.2.2, 3.3.3.3' } }), '2.2.2.2');
  assert.equal(clientIp({ headers: {} }), 'unknown');
  assert.equal(clientIp({}), 'unknown');
});

test('createSheet builds a Google sheet in production when credentials are set', () => {
  const sheet = createSheet({
    CONTEXT: 'production',
    GOOGLE_SHEET_ID: 'abc',
    GOOGLE_CLIENT_EMAIL: 'svc@example.iam.gserviceaccount.com',
    GOOGLE_PRIVATE_KEY: 'not-a-real-key',
  });
  for (const m of ['findByEmail', 'append', 'update']) assert.equal(typeof sheet[m], 'function');
});
