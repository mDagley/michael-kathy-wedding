// test/function-factory.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFunction } from '../lib/function-factory.js';
import { createFileSheet } from '../lib/sheet-file.js';
import { createLimiter } from '../lib/limiter.js';

const VENUE = { name: 'The Test Hall', address: '1 Secret Way' };
const body = { name: 'Ada Lovelace', email: 'ada@example.com', attending: 'yes', dietary: '', notes: '', website: '' };

function build(over = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'fn-'));
  const sheet = createFileSheet(join(dir, 's.json'));
  return createFunction('rsvp', {
    sheet,
    venue: VENUE,
    limiter: over.limiter || createLimiter({ max: 100, windowMs: 1000 }),
  });
}
const post = (b) => ({ httpMethod: 'POST', headers: { 'x-nf-client-connection-ip': '1.2.3.4' }, body: typeof b === 'string' ? b : JSON.stringify(b) });

test('rejects non-POST with 405', async () => {
  const res = await build()({ httpMethod: 'GET', headers: {}, body: '' });
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, 'POST');
});

test('rejects invalid JSON with 400', async () => {
  const res = await build()(post('{nope'));
  assert.equal(res.statusCode, 400);
});

test('rejects oversize bodies with 413', async () => {
  const res = await build()(post({ ...body, notes: 'x'.repeat(20000) }));
  assert.equal(res.statusCode, 413);
});

test('rate limits per client IP with 429', async () => {
  const fn = build({ limiter: createLimiter({ max: 1, windowMs: 60000 }) });
  assert.equal((await fn(post(body))).statusCode, 200);
  assert.equal((await fn(post(body))).statusCode, 429);
});

test('a valid RSVP returns 200 JSON with the venue for yes', async () => {
  const res = await build()(post(body));
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(res.body), { ok: true, attending: true, venue: VENUE });
});

test('unexpected errors return a generic 500 and do not leak details', async () => {
  const sheet = { findByEmail: async () => { throw new Error('secret db detail'); }, append: async () => {}, update: async () => {} };
  const fn = createFunction('rsvp', { sheet, venue: VENUE, limiter: createLimiter({ max: 10, windowMs: 1000 }) });
  const res = await fn(post(body));
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.includes('secret'), false);
});

test('base64-encoded bodies are decoded', async () => {
  const b64 = Buffer.from(JSON.stringify(body), 'utf8').toString('base64');
  const res = await build()({ ...post(''), body: b64, isBase64Encoded: true });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), { ok: true, attending: true, venue: VENUE });
});

test('oversize base64-decoded bodies get 413', async () => {
  const b64 = Buffer.from(JSON.stringify({ ...body, notes: 'x'.repeat(20000) }), 'utf8').toString('base64');
  const res = await build()({ ...post(''), body: b64, isBase64Encoded: true });
  assert.equal(res.statusCode, 413);
});

test('unknown kind throws at construction', () => {
  assert.throws(() => createFunction('rsvps'));
});

test('lookup kind works end to end with the same sheet', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'fn-'));
  const sheet = createFileSheet(join(dir, 's.json'));
  const limiter = createLimiter({ max: 100, windowMs: 1000 });
  const rsvp = createFunction('rsvp', { sheet, venue: VENUE, limiter });
  const lookup = createFunction('lookup', { sheet, venue: VENUE, limiter });
  assert.equal((await rsvp(post(body))).statusCode, 200);
  const hit = await lookup(post({ name: 'ada lovelace', email: 'ADA@example.com' }));
  assert.deepEqual(JSON.parse(hit.body), { ok: true, found: true, venue: VENUE });
  const miss = await lookup(post({ name: 'Wrong Name', email: 'ada@example.com' }));
  assert.deepEqual(JSON.parse(miss.body), { ok: true, found: false });
});
