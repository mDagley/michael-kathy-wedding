// lib/content-handler.js
import { clientIp, jsonResponse } from './http.js';
import { createLimiter } from './limiter.js';
import { createContentSource } from './config.js';

export const FRESH_MS = 60 * 1000; // serve from memory this long
export const STALE_MS = 10 * 60 * 1000; // if the sheet is failing, keep serving data up to this old
export const RETRY_MS = 10 * 1000; // after a failure, wait this long before asking the sheet again

export const LOAD_TIMEOUT_MS = 6000; // give up on a hung sheet read after this long

// deps (all optional, for tests): source, createSource, now, limiter, loadTimeoutMs.
export function createContentFunction(deps = {}) {
  const limiter = deps.limiter || createLimiter({ max: 120, windowMs: 10 * 60 * 1000 });
  const now = deps.now || Date.now;
  const loadTimeoutMs = deps.loadTimeoutMs ?? LOAD_TIMEOUT_MS;
  const makeSource = deps.createSource || (() => createContentSource(process.env));
  let source = deps.source || null;
  let cache = null; // { values, at }
  let inflight = null;
  let failure = null; // { at, err }
  let currentRefresh = 0; // id of the refresh allowed to write the cache

  // A negative age (clock went backwards) counts as expired.
  const age = (at) => now() - at;
  const isFresh = (c) => c && age(c.at) >= 0 && age(c.at) < FRESH_MS;
  const isStale = (c) => c && age(c.at) >= 0 && age(c.at) < STALE_MS;
  const inRetryWindow = (f) => f && age(f.at) >= 0 && age(f.at) < RETRY_MS;

  function loadWithTimeout() {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(Object.assign(new Error('Content source timed out.'), { code: 'ETIMEDOUT' }));
      }, loadTimeoutMs);
    });
    const loading = Promise.resolve().then(() => source.load());
    loading.catch(() => {}); // a late failure after the timeout must not become an unhandled rejection
    return Promise.race([loading, timeout]).finally(() => clearTimeout(timer));
  }

  // Log once per failed refresh attempt (requests sharing that attempt share this one line).
  // Only code + message: Google errors can carry request details.
  function logFailure(err) {
    console.error(`[content] could not load content: ${err?.code ?? 'no-code'} ${err?.message ?? String(err)}`);
  }

  function refresh() {
    if (!inflight) {
      const id = ++currentRefresh;
      // The id guards below are defensive: a timed-out load's late result can never reach the cache write,
      // because the race has already settled, and inflight is only cleared by the current refresh's own finally.
      inflight = (async () => {
        source = source || makeSource(); // if this throws, source stays null and the next attempt retries it
        const values = await loadWithTimeout();
        if (id === currentRefresh) cache = { values, at: now() };
        return values;
      })()
        .catch((err) => { logFailure(err); throw err; })
        .finally(() => { if (id === currentRefresh) inflight = null; });
    }
    return inflight;
  }

  async function getValues() {
    if (isFresh(cache)) return cache.values;
    if (!inRetryWindow(failure)) {
      try {
        const values = await refresh();
        failure = null;
        return values;
      } catch (err) {
        failure = { at: now(), err }; // already logged in refresh()
      }
    }
    if (isStale(cache)) return cache.values;
    throw failure.err; // failure is set: either the retry window is active, or the refresh above just failed
  }

  return async function handler(event) {
    if (event.httpMethod !== 'GET') {
      const res = jsonResponse(405, { ok: false, error: 'Method not allowed.' });
      res.headers.Allow = 'GET';
      return res;
    }
    if (!limiter.allow(clientIp(event))) {
      return jsonResponse(429, { ok: false, error: 'Too many requests. Please wait a few minutes and try again.' });
    }
    try {
      const values = await getValues();
      const res = jsonResponse(200, { ok: true, values });
      res.headers['Cache-Control'] = 'public, max-age=60';
      return res;
    } catch {
      // Already logged where the refresh failed (refresh).
      return jsonResponse(503, { ok: false, error: 'Content is temporarily unavailable.' });
    }
  };
}
