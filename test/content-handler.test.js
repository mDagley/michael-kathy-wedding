// test/content-handler.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createContentFunction, FRESH_MS, STALE_MS, RETRY_MS } from '../lib/content-handler.js';
import { createLimiter } from '../lib/limiter.js';

const get = (ip = '1.2.3.4') => ({ httpMethod: 'GET', headers: { 'x-nf-client-connection-ip': ip } });

function build({ load, startAt = 1_000_000, limiter } = {}) {
  let t = startAt;
  const calls = { load: 0 };
  const source = { load: async () => { calls.load += 1; return load(calls.load); } };
  const handler = createContentFunction({
    source,
    now: () => t,
    limiter: limiter || createLimiter({ max: 1000, windowMs: 1000 }),
  });
  return { handler, calls, advance: (ms) => { t += ms; } };
}

test('only GET is allowed', async () => {
  const { handler } = build({ load: () => ({}) });
  const res = await handler({ httpMethod: 'POST', headers: {}, body: '{}' });
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, 'GET');
});

test('returns the values as JSON with a 60 second public cache header', async () => {
  const { handler } = build({ load: () => ({ 'dress.code': 'Black tie' }) });
  const res = await handler(get());
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), { ok: true, values: { 'dress.code': 'Black tie' } });
  assert.equal(res.headers['Cache-Control'], 'public, max-age=60');
  assert.equal(res.headers['Content-Type'], 'application/json');
});

test('values are cached in memory for 60 seconds, then refreshed', async () => {
  const { handler, calls, advance } = build({ load: (n) => ({ 'dress.code': `v${n}` }) });
  await handler(get());
  advance(FRESH_MS - 1);
  assert.equal(JSON.parse((await handler(get())).body).values['dress.code'], 'v1');
  assert.equal(calls.load, 1);
  advance(2);
  assert.equal(JSON.parse((await handler(get())).body).values['dress.code'], 'v2');
  assert.equal(calls.load, 2);
});

test('concurrent requests share one sheet read', async () => {
  const { handler, calls } = build({ load: async () => { await new Promise((r) => setTimeout(r, 20)); return { a: 'b' }; } });
  await Promise.all([handler(get()), handler(get()), handler(get())]);
  assert.equal(calls.load, 1);
});

test('when the sheet fails, recent data is served instead (stale on error)', async () => {
  const { handler, advance } = build({ load: (n) => { if (n === 1) return { 'dress.code': 'Black tie' }; throw new Error('quota'); } });
  await handler(get());
  advance(FRESH_MS + 1);
  const res = await handler(get());
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).values['dress.code'], 'Black tie');
});

test('stale data is not served forever', async () => {
  const { handler, advance } = build({ load: (n) => { if (n === 1) return { x: 'y' }; throw new Error('down'); } });
  await handler(get());
  advance(STALE_MS + RETRY_MS + 1);
  assert.equal((await handler(get())).statusCode, 503);
});

test('with no data and a failing sheet the answer is a generic 503 with no details', async () => {
  const origError = console.error;
  const logged = [];
  console.error = (...a) => logged.push(a.join(' '));
  try {
    const { handler } = build({ load: () => { const e = new Error('Unable to parse range: secret-tab'); e.config = { data: 'guest@example.com' }; throw e; } });
    const res = await handler(get());
    assert.equal(res.statusCode, 503);
    assert.deepEqual(JSON.parse(res.body), { ok: false, error: 'Content is temporarily unavailable.' });
    assert.equal(res.headers['Cache-Control'], 'no-store');
    assert.equal(res.body.includes('secret-tab'), false);
    assert.equal(logged.length, 1);
    assert.equal(logged[0].includes('guest@example.com'), false);
  } finally {
    console.error = origError;
  }
});

test('after a failure the sheet is not hammered: retries wait RETRY_MS', async () => {
  const origError = console.error;
  console.error = () => {};
  try {
    const { handler, calls, advance } = build({ load: () => { throw new Error('down'); } });
    await handler(get());
    await handler(get());
    await handler(get());
    assert.equal(calls.load, 1);
    advance(RETRY_MS + 1);
    await handler(get());
    assert.equal(calls.load, 2);
  } finally {
    console.error = origError;
  }
});

test('a source that cannot be created (bad config) is retried later, not cached as broken', async () => {
  const origError = console.error;
  console.error = () => {};
  try {
    let attempts = 0;
    let t = 1_000_000;
    const handler = createContentFunction({
      createSource: () => {
        attempts += 1;
        if (attempts === 1) throw new Error('GOOGLE_SHEET_ID is not set in production.');
        return { load: async () => ({ 'dress.code': 'Black tie' }) };
      },
      now: () => t,
      limiter: createLimiter({ max: 1000, windowMs: 1000 }),
    });
    assert.equal((await handler(get())).statusCode, 503);
    t += RETRY_MS + 1;
    const res = await handler(get());
    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body).values, { 'dress.code': 'Black tie' });
    assert.equal(attempts, 2);
  } finally {
    console.error = origError;
  }
});

test('requests are rate limited per client IP', async () => {
  const { handler } = build({ load: () => ({}), limiter: createLimiter({ max: 2, windowMs: 60_000 }) });
  assert.equal((await handler(get('9.9.9.9'))).statusCode, 200);
  assert.equal((await handler(get('9.9.9.9'))).statusCode, 200);
  assert.equal((await handler(get('9.9.9.9'))).statusCode, 429);
  assert.equal((await handler(get('8.8.8.8'))).statusCode, 200);
});
