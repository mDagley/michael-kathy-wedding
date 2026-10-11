// test/content-live.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadLiveContent } from '../site/js/content-live.js';

const respond = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test('returns the values map on success and requests /api/content', async () => {
  let seen;
  const fetchFn = async (url) => { seen = url; return respond(200, { ok: true, values: { 'dress.code': 'Black tie' } }); };
  assert.deepEqual(await loadLiveContent({ fetchFn }), { 'dress.code': 'Black tie' });
  assert.equal(seen, '/api/content');
});

test('returns null for HTTP errors, malformed bodies, or ok:false', async () => {
  assert.equal(await loadLiveContent({ fetchFn: async () => respond(503, { ok: false }) }), null);
  assert.equal(await loadLiveContent({ fetchFn: async () => respond(200, { ok: false }) }), null);
  assert.equal(await loadLiveContent({ fetchFn: async () => respond(200, { ok: true, values: 'x' }) }), null);
  assert.equal(await loadLiveContent({ fetchFn: async () => respond(200, null) }), null);
});

test('returns null when fetch throws or the body is not JSON', async () => {
  assert.equal(await loadLiveContent({ fetchFn: async () => { throw new Error('offline'); } }), null);
  assert.equal(await loadLiveContent({ fetchFn: async () => ({ ok: true, json: async () => { throw new Error('bad json'); } }) }), null);
});

test('gives up after the timeout and aborts the request', async () => {
  let aborted = false;
  const fetchFn = (url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); });
  });
  const started = Date.now();
  assert.equal(await loadLiveContent({ fetchFn, timeoutMs: 30 }), null);
  assert.ok(Date.now() - started < 500);
  assert.equal(aborted, true);
});
