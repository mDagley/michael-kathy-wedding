// lib/content-handler.js
import { clientIp, jsonResponse } from './http.js';
import { createLimiter } from './limiter.js';
import { createContentSource } from './config.js';

export const FRESH_MS = 60 * 1000; // serve from memory this long
export const STALE_MS = 10 * 60 * 1000; // if the sheet is failing, keep serving data up to this old
export const RETRY_MS = 10 * 1000; // after a failure, wait this long before asking the sheet again

// deps (all optional, for tests): source, createSource, now, limiter.
export function createContentFunction(deps = {}) {
  const limiter = deps.limiter || createLimiter({ max: 120, windowMs: 10 * 60 * 1000 });
  const now = deps.now || Date.now;
  const makeSource = deps.createSource || (() => createContentSource(process.env));
  let source = deps.source || null;
  let cache = null; // { values, at }
  let inflight = null;
  let failure = null; // { at, err }

  function refresh() {
    if (!inflight) {
      inflight = (async () => {
        source = source || makeSource(); // if this throws, source stays null and the next attempt retries it
        const values = await source.load();
        cache = { values, at: now() };
        return values;
      })().finally(() => { inflight = null; });
    }
    return inflight;
  }

  async function getValues() {
    if (cache && now() - cache.at < FRESH_MS) return cache.values;
    if (!(failure && now() - failure.at < RETRY_MS)) {
      try {
        const values = await refresh();
        failure = null;
        return values;
      } catch (err) {
        failure = { at: now(), err };
      }
    }
    if (cache && now() - cache.at < STALE_MS) return cache.values;
    throw failure.err;
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
    } catch (err) {
      // Log only code + message: Google errors can carry request details.
      console.error(`[content] unexpected error: ${err?.code ?? 'no-code'} ${err?.message ?? String(err)}`);
      return jsonResponse(503, { ok: false, error: 'Content is temporarily unavailable.' });
    }
  };
}
