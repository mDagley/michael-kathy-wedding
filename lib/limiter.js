// lib/limiter.js
// Best-effort only: serverless instances do not share memory, so this slows casual abuse
// but is not a hard guarantee. The honeypot and per-email de-duplication back it up.
export function createLimiter({ max, windowMs, now = Date.now }) {
  const hits = new Map();
  return {
    allow(key) {
      const t = now();
      const recent = (hits.get(key) || []).filter((x) => t - x < windowMs);
      if (recent.length >= max) {
        hits.set(key, recent);
        return false;
      }
      recent.push(t);
      hits.set(key, recent);
      return true;
    },
  };
}
