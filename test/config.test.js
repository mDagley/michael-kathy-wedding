// test/config.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadVenue, createSheet, createContentSource, isLocalDev } from '../lib/config.js';
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
  const sheet = createSheet({ NETLIFY_DEV: 'true', DEV_SHEET_PATH: join(dir, 's.json') });
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

test('without a sheet id and without a local-dev flag both factories throw (production runtime has no CONTEXT)', () => {
  assert.throws(() => createSheet({}), /GOOGLE_SHEET_ID is not set/);
  assert.throws(() => createContentSource({}), /GOOGLE_SHEET_ID is not set/);
});

test('isLocalDev requires the exact string true', () => {
  assert.equal(isLocalDev({ NETLIFY_DEV: 'true' }), true);
  assert.equal(isLocalDev({ ALLOW_FILE_STORE: 'true' }), true);
  assert.equal(isLocalDev({}), false);
  assert.equal(isLocalDev({ NETLIFY_DEV: 'false', ALLOW_FILE_STORE: '1' }), false);
});

test('NETLIFY_DEV or ALLOW_FILE_STORE selects the file-backed sources', async () => {
  for (const flag of [{ NETLIFY_DEV: 'true' }, { ALLOW_FILE_STORE: 'true' }]) {
    const dir = mkdtempSync(join(tmpdir(), 'cfg-flag-'));
    const sheet = createSheet({ ...flag, DEV_SHEET_PATH: join(dir, 's.json') });
    assert.equal(await sheet.findByEmail('nobody@example.com'), null);
    const path = join(dir, 'c.json');
    writeFileSync(path, JSON.stringify({ 'dress.code': 'From file' }));
    assert.deepEqual(await createContentSource({ ...flag, DEV_CONTENT_PATH: path }).load(), { 'dress.code': 'From file' });
  }
});

test('NETLIFY_DEV=false and ALLOW_FILE_STORE=1 still throw', () => {
  for (const flag of [{ NETLIFY_DEV: 'false' }, { ALLOW_FILE_STORE: '1' }]) {
    assert.throws(() => createSheet(flag), /GOOGLE_SHEET_ID is not set/);
    assert.throws(() => createContentSource(flag), /GOOGLE_SHEET_ID is not set/);
  }
});

test('with a sheet id the Google sources are built regardless of flags', async () => {
  const creds = { GOOGLE_SHEET_ID: 'abc', GOOGLE_CLIENT_EMAIL: 'svc@example.iam.gserviceaccount.com', GOOGLE_PRIVATE_KEY: 'not-a-real-key' };
  const calls = [];
  const sheetsClient = { spreadsheets: { values: { get: async (p) => { calls.push(p); return { data: { values: [] } }; } } } };
  for (const flag of [{}, { NETLIFY_DEV: 'true' }, { ALLOW_FILE_STORE: 'true' }]) {
    const sheet = createSheet({ ...creds, ...flag });
    for (const m of ['findByEmail', 'append', 'update']) assert.equal(typeof sheet[m], 'function');
    await createContentSource({ ...creds, ...flag }, { sheetsClient }).load();
  }
  assert.equal(calls.length, 3);
  assert.ok(calls.every((c) => c.spreadsheetId === 'abc'));
});
