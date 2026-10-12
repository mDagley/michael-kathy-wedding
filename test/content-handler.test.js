// test/content-handler.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createContentFunction, FRESH_MS, STALE_MS, RETRY_MS, LOAD_TIMEOUT_MS } from '../lib/content-handler.js';
import { createLimiter } from '../lib/limiter.js';

const get = (ip = '1.2.3.4') => ({ httpMethod: 'GET', headers: { 'x-nf-client-connection-ip': ip } });

function build({ load, startAt = 1_000_000, limiter, loadTimeoutMs } = {}) {
  let t = startAt;
  const calls = { load: 0 };
  const source = { load: async () => { calls.load += 1; return load(calls.load); } };
  const handler = createContentFunction({
    source,
    now: () => t,
    limiter: limiter || createLimiter({ max: 1000, windowMs: 1000 }),
    ...(loadTimeoutMs !== undefined ? { loadTimeoutMs } : {}),
  });
  return { handler, calls, advance: (ms) => { t += ms; }, setTime: (v) => { t = v; } };
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

test('stale data returned is the cached value (strengthened)', async () => {
  const { handler, advance } = build({ load: (n) => { if (n === 1) return { 'dress.code': 'Black tie' }; throw new Error('down'); } });
  await handler(get());
  advance(STALE_MS - 1);
  const res = await handler(get());
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), { ok: true, values: { 'dress.code': 'Black tie' } });
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

// ---- hardening tests ----
async function withLog(fn) {
  const orig = console.error;
  const logged = [];
  console.error = (...a) => logged.push(a.join(' '));
  try { await fn(logged); } finally { console.error = orig; }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tick = () => new Promise((r) => setImmediate(r)); // let already-settled promises run their callbacks
// A promise whose outcome the TEST decides, and when.
function deferred() {
  let resolve; let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const val = (res) => JSON.parse(res.body).values['dress.code'];
const GENERIC = { ok: false, error: 'Content is temporarily unavailable.' };

test('LOAD_TIMEOUT_MS defaults to 6 seconds', () => {
  assert.equal(LOAD_TIMEOUT_MS, 6000);
});

test('timeout: a hung read with no cache answers 503 quickly and generically', async () => {
  await withLog(async (logged) => {
    const { handler } = build({ load: () => new Promise(() => {}), loadTimeoutMs: 50 });
    const started = Date.now();
    const res = await handler(get());
    assert.ok(Date.now() - started < 500);
    assert.equal(res.statusCode, 503);
    assert.deepEqual(JSON.parse(res.body), GENERIC);
    assert.equal(logged.length, 1);
    assert.ok(logged[0].includes('ETIMEDOUT'));
    assert.ok(logged[0].includes('Content source timed out.'));
  });
});

test('timeout: a hung refresh serves the stale data quickly', async () => {
  await withLog(async () => {
    const { handler, advance } = build({
      load: (n) => (n === 1 ? { 'dress.code': 'Black tie' } : new Promise(() => {})),
      loadTimeoutMs: 50,
    });
    await handler(get());
    advance(FRESH_MS + 1);
    const started = Date.now();
    const res = await handler(get());
    assert.ok(Date.now() - started < 500);
    assert.equal(res.statusCode, 200);
    assert.equal(val(res), 'Black tie');
  });
});

test('timeout: inflight is cleared so a later request loads again and can recover', async () => {
  await withLog(async () => {
    const { handler, calls, advance } = build({
      load: (n) => (n === 1 ? new Promise(() => {}) : { 'dress.code': 'Recovered' }),
      loadTimeoutMs: 50,
    });
    assert.equal((await handler(get())).statusCode, 503);
    assert.equal(calls.load, 1);
    advance(RETRY_MS + 1);
    const res = await handler(get());
    assert.equal(calls.load, 2);
    assert.equal(res.statusCode, 200);
    assert.equal(val(res), 'Recovered');
  });
});

test('timeout: a load that finishes late does not replace the cache', async () => {
  await withLog(async () => {
    const late = deferred();
    const { handler, calls, advance } = build({
      load: (n) => (n === 1 ? { 'dress.code': 'Black tie' } : late.promise),
      loadTimeoutMs: 50,
    });
    await handler(get());
    advance(FRESH_MS + 1);
    assert.equal(val(await handler(get())), 'Black tie'); // stale, refresh timed out
    late.resolve({ 'dress.code': 'LATE' }); // the late load resolves only now, after the timeout
    await tick();
    await tick();
    const res = await handler(get()); // clock unchanged: inside the retry window
    assert.equal(res.statusCode, 200);
    assert.equal(val(res), 'Black tie');
    assert.equal(calls.load, 2);
  });
});

test('timeout: a late rejection after the timeout is swallowed', async () => {
  await withLog(async () => {
    const late = deferred();
    const unhandled = [];
    const onUnhandled = (reason) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      const { handler } = build({ load: () => late.promise, loadTimeoutMs: 50 });
      assert.equal((await handler(get())).statusCode, 503);
      late.reject(new Error('late boom')); // fails only after the timeout already answered
      await sleep(50); // generous: unhandled rejections are reported within a tick or two
      assert.deepEqual(unhandled, []);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});

test('logging: a stale-served failure logs exactly one line with code and message, no secrets', async () => {
  await withLog(async (logged) => {
    const { handler, advance } = build({
      load: (n) => {
        if (n === 1) return { 'dress.code': 'Black tie' };
        const e = new Error('quota exceeded'); e.code = 429; e.config = { data: 'guest@example.com' }; throw e;
      },
    });
    await handler(get());
    advance(FRESH_MS + 1);
    const res = await handler(get());
    assert.equal(res.statusCode, 200);
    assert.equal(logged.length, 1);
    assert.ok(logged[0].includes('429'));
    assert.ok(logged[0].includes('quota exceeded'));
    assert.equal(logged[0].includes('guest@example.com'), false);
  });
});

test('logging: three requests within RETRY_MS of a failure log exactly one line in total', async () => {
  await withLog(async (logged) => {
    const { handler, calls } = build({ load: () => { throw new Error('down'); } });
    await handler(get());
    await handler(get());
    await handler(get());
    assert.equal(calls.load, 1);
    assert.equal(logged.length, 1);
  });
});

test('clock going backwards: the cache is treated as expired', async () => {
  const { handler, calls, setTime } = build({ load: (n) => ({ 'dress.code': `v${n}` }) });
  await handler(get());
  setTime(500_000);
  const res = await handler(get());
  assert.equal(calls.load, 2);
  assert.equal(val(res), 'v2');
});

test('a failed refresh with a cache does not hammer the sheet and serves the stale value', async () => {
  await withLog(async () => {
    const { handler, calls, advance } = build({
      load: (n) => { if (n === 1) return { 'dress.code': 'Black tie' }; throw new Error('down'); },
    });
    await handler(get());
    advance(FRESH_MS + 1);
    assert.equal(val(await handler(get())), 'Black tie');
    assert.equal(calls.load, 2);
    advance(RETRY_MS - 1000);
    assert.equal(val(await handler(get())), 'Black tie');
    assert.equal(val(await handler(get())), 'Black tie');
    assert.equal(calls.load, 2);
  });
});

test('failure state clears after a success; a later failure is a new failure', async () => {
  await withLog(async (logged) => {
    const { handler, calls, advance } = build({
      load: (n) => {
        if (n === 1) return { 'dress.code': 'v1' };
        if (n === 2) throw new Error('down');
        if (n === 3) return { 'dress.code': 'v3' };
        throw new Error('down again');
      },
    });
    await handler(get()); // load 1
    advance(FRESH_MS + 1);
    assert.equal(val(await handler(get())), 'v1'); // load 2 fails, stale served
    assert.equal(logged.length, 1);
    advance(RETRY_MS + 1);
    assert.equal(val(await handler(get())), 'v3'); // load 3 succeeds, NEW values
    assert.equal(calls.load, 3);
    advance(FRESH_MS + 1);
    assert.equal(val(await handler(get())), 'v3'); // load 4 fails, stale served
    assert.equal(calls.load, 4);
    assert.equal(logged.length, 2);
    assert.equal(val(await handler(get())), 'v3'); // inside the retry window
    assert.equal(calls.load, 4);
    advance(RETRY_MS + 1);
    await handler(get());
    assert.equal(calls.load, 5);
    assert.equal(logged.length, 3);
  });
});

test('concurrent requests sharing a rejecting refresh all get the same generic 503', async () => {
  await withLog(async (logged) => {
    const { handler, calls } = build({
      load: async () => { await sleep(20); throw new Error('boom'); },
    });
    const results = await Promise.all([handler(get()), handler(get()), handler(get())]);
    for (const res of results) {
      assert.equal(res.statusCode, 503);
      assert.deepEqual(JSON.parse(res.body), GENERIC);
    }
    assert.equal(calls.load, 1);
    assert.equal(logged.length, 1);
  });
});

test('logging: a plain string rejected on two separate attempts logs once per attempt', async () => {
  await withLog(async (logged) => {
    const { handler, calls, advance } = build({ load: () => { throw 'plain failure'; } }); // eslint-disable-line no-throw-literal
    await handler(get());
    advance(RETRY_MS + 1);
    await handler(get());
    assert.equal(calls.load, 2);
    assert.equal(logged.length, 2);
  });
});

test('logging: the same Error object rejected on two attempts logs once per attempt', async () => {
  await withLog(async (logged) => {
    const shared = new Error('same instance');
    const { handler, calls, advance } = build({ load: () => { throw shared; } });
    await handler(get());
    advance(RETRY_MS + 1);
    await handler(get());
    assert.equal(calls.load, 2);
    assert.equal(logged.length, 2);
  });
});
