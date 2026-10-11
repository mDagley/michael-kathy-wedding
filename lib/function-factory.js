// lib/function-factory.js
import { createHandlers } from './rsvp-core.js';
import { clientIp, jsonResponse, parseJsonBody } from './http.js';
import { createLimiter } from './limiter.js';
import { createSheet, loadVenue } from './config.js';

// kind: 'rsvp' | 'lookup'. Dependencies are injectable for tests; production uses env.
export function createFunction(kind, deps = {}) {
  const limiter = deps.limiter || createLimiter({ max: 20, windowMs: 10 * 60 * 1000 });
  let handlers = null;

  const getHandlers = () => {
    if (!handlers) {
      const sheet = deps.sheet || createSheet(process.env);
      const venue = deps.venue || loadVenue(process.env);
      handlers = createHandlers({ sheet, venue });
    }
    return handlers;
  };

  return async function handler(event) {
    if (event.httpMethod !== 'POST') {
      const res = jsonResponse(405, { ok: false, error: 'Method not allowed.' });
      res.headers.Allow = 'POST';
      return res;
    }
    if (!limiter.allow(clientIp(event))) {
      return jsonResponse(429, { ok: false, error: 'Too many requests. Please wait a few minutes and try again.' });
    }
    const parsed = parseJsonBody(event);
    if (!parsed.ok) return jsonResponse(parsed.status, { ok: false, error: parsed.error });

    try {
      const result = await getHandlers()[kind](parsed.value);
      return jsonResponse(result.status, result.body);
    } catch (err) {
      console.error(`[${kind}] unexpected error`, err);
      return jsonResponse(500, { ok: false, error: 'Something went wrong on our end. Please try again.' });
    }
  };
}
