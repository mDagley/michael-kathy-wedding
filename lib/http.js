// lib/http.js
export const MAX_BODY_BYTES = 10 * 1024;

export function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}

export function clientIp(event) {
  const h = event.headers || {};
  return h['x-nf-client-connection-ip'] || (h['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
}

// Returns { ok: true, value } or { ok: false, status, error }.
export function parseJsonBody(event) {
  if (event.body != null && typeof event.body !== 'string') return { ok: false, status: 400, error: 'Invalid JSON.' };
  let raw = event.body ?? '';
  if (event.isBase64Encoded && raw) raw = Buffer.from(raw, 'base64').toString('utf8');
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) return { ok: false, status: 413, error: 'Request too large.' };
  try {
    const value = JSON.parse(raw || '{}');
    if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('not an object');
    return { ok: true, value };
  } catch {
    return { ok: false, status: 400, error: 'Invalid JSON.' };
  }
}
