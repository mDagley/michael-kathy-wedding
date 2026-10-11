// test/rsvp-core.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateRsvp, normalizeEmail, normalizeName, createHandlers } from '../lib/rsvp-core.js';
import { createFileSheet } from '../lib/sheet-file.js';

const VENUE = { name: 'The Test Hall', address: '1 Secret Way, Chicago, IL' };
const NOW = () => '2027-01-01T00:00:00.000Z';

function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'rsvp-'));
  const sheet = createFileSheet(join(dir, 'sheet.json'));
  return { sheet, handlers: createHandlers({ sheet, venue: VENUE, now: NOW }) };
}
const good = { name: 'Ada Lovelace', email: 'Ada@Example.com', attending: 'yes', dietary: 'vegetarian', notes: 'hi', website: '' };

test('normalizers', () => {
  assert.equal(normalizeEmail('  Ada@Example.COM '), 'ada@example.com');
  assert.equal(normalizeName('  ada   LOVELACE '), 'ada lovelace');
});

test('validateRsvp accepts a good body and trims/normalizes it', () => {
  const r = validateRsvp({ ...good, name: '  Ada   Lovelace ' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, { name: 'Ada Lovelace', email: 'ada@example.com', attending: 'yes', dietary: 'vegetarian', notes: 'hi' });
});

test('validateRsvp reports every bad field', () => {
  const r = validateRsvp({ name: '', email: 'nope', attending: 'maybe', dietary: 'x'.repeat(301), notes: 'y'.repeat(501) });
  assert.equal(r.ok, false);
  assert.deepEqual(Object.keys(r.errors).sort(), ['attending', 'dietary', 'email', 'name', 'notes']);
});

test('yes RSVP is saved and returns the venue', async () => {
  const { sheet, handlers } = setup();
  const res = await handlers.rsvp(good);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true, attending: true, venue: VENUE });
  const saved = await sheet.findByEmail('ada@example.com');
  assert.equal(saved.record.attending, 'yes');
  assert.equal(saved.record.timestamp, NOW());
});

test('no RSVP is saved and NEVER returns the venue', async () => {
  const { handlers } = setup();
  const res = await handlers.rsvp({ ...good, attending: 'no' });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true, attending: false });
  assert.equal(JSON.stringify(res.body).includes(VENUE.address), false);
});

test('invalid RSVP returns 400 with field errors and saves nothing', async () => {
  const { sheet, handlers } = setup();
  const res = await handlers.rsvp({ ...good, email: 'bad' });
  assert.equal(res.status, 400);
  assert.equal(res.body.ok, false);
  assert.ok(res.body.errors.email);
  assert.equal(await sheet.findByEmail('bad'), null);
});

test('same email RSVPs again: the row is updated, not duplicated', async () => {
  const { sheet, handlers } = setup();
  await handlers.rsvp(good);
  const res = await handlers.rsvp({ ...good, attending: 'no' });
  assert.equal(res.body.attending, false);
  const found = await sheet.findByEmail('ada@example.com');
  assert.equal(found.rowIndex, 0);
  assert.equal(found.record.attending, 'no');
});

test('honeypot: a filled hidden field gets a fake success and saves nothing', async () => {
  const { sheet, handlers } = setup();
  const res = await handlers.rsvp({ ...good, website: 'http://spam.example' });
  assert.equal(res.status, 200);
  assert.equal(res.body.venue, undefined);
  assert.equal(await sheet.findByEmail('ada@example.com'), null);
});

test('lookup returns the venue only when name and email match a YES RSVP', async () => {
  const { handlers } = setup();
  await handlers.rsvp(good);
  const ok = await handlers.lookup({ name: 'ada  lovelace', email: 'ADA@example.com' });
  assert.deepEqual(ok.body, { ok: true, found: true, venue: VENUE });
  const wrongName = await handlers.lookup({ name: 'Someone Else', email: 'ada@example.com' });
  assert.deepEqual(wrongName.body, { ok: true, found: false });
  const unknown = await handlers.lookup({ name: 'Ada Lovelace', email: 'zzz@example.com' });
  assert.deepEqual(unknown.body, { ok: true, found: false });
});

test('lookup never reveals the venue for a NO RSVP', async () => {
  const { handlers } = setup();
  await handlers.rsvp({ ...good, attending: 'no' });
  const res = await handlers.lookup({ name: 'Ada Lovelace', email: 'ada@example.com' });
  assert.deepEqual(res.body, { ok: true, found: false });
});

test('lookup with missing fields is a 400', async () => {
  const { handlers } = setup();
  const res = await handlers.lookup({ name: '', email: '' });
  assert.equal(res.status, 400);
});
