// test/function-factory.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { format } from 'node:util';
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

test('unexpected errors are logged without request data', async () => {
  const err = Object.assign(new Error('boom-message'), { code: 'E_X', config: { data: 'guest@example.com' }, response: { data: 'secret-details' } });
  const sheet = { findByEmail: async () => { throw err; }, append: async () => {}, update: async () => {} };
  const fn = createFunction('rsvp', { sheet, venue: VENUE, limiter: createLimiter({ max: 10, windowMs: 1000 }) });
  const logged = [];
  const orig = console.error;
  console.error = (...args) => logged.push(args);
  let res;
  try { res = await fn(post(body)); } finally { console.error = orig; }
  assert.equal(res.statusCode, 500);
  assert.deepEqual(JSON.parse(res.body), { ok: false, error: 'Something went wrong on our end. Please try again.' });
  assert.equal(logged.length, 1);
  const text = format(...logged[0]);
  assert.equal(text.includes('guest@example.com'), false);
  assert.equal(text.includes('secret-details'), false);
  assert.equal(text.includes('boom-message'), true);
});

test('non-string bodies get 400, even with isBase64Encoded', async () => {
  for (const b of [123, { name: 'x' }]) {
    for (const flag of [false, true]) {
      const res = await build()({ httpMethod: 'POST', headers: {}, body: b, isBase64Encoded: flag });
      assert.equal(res.statusCode, 400);
      assert.deepEqual(JSON.parse(res.body), { ok: false, error: 'Invalid JSON.' });
    }
  }
});

test('size limit is measured after base64 decoding', async () => {
  const json = JSON.stringify({ ...body, pad: 'p'.repeat(9500 - JSON.stringify(body).length - 12) });
  const b64 = Buffer.from(json, 'utf8').toString('base64');
  assert.ok(Buffer.byteLength(json) < 10240);
  assert.ok(Buffer.byteLength(b64) > 10240);
  const res = await build()({ ...post(''), body: b64, isBase64Encoded: true });
  assert.equal(res.statusCode, 200);
});
