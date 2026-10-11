// site/js/content-merge.js
// SECURITY: merged values may contain arbitrary text or HTML. They must only ever be rendered through
// textContent / setAttribute('href') after the https check, as render.js does. Never use innerHTML.
// Applies sheet values on top of the built-in content. Only strings at paths that ALREADY exist
// as strings in the defaults can change, so the sheet cannot add structure, scripts, or links the
// developer did not put there. nav and credits are developer-owned.
const DEV_OWNED = new Set(['nav', 'credits']);
// The server limits each field to at most 4000 code points, which is at most 8000 UTF-16 units
// (String.length counts units, and an emoji is 2). 16000 leaves headroom and is only a sanity cap
// against absurd input, not the real limit.
const MAX_LEN = 16000;

export function mergeContent(defaults, values) {
  const merged = structuredClone(defaults);
  if (values === null || typeof values !== 'object' || Array.isArray(values)) return merged;

  for (const [path, value] of Object.entries(values)) {
    if (typeof value !== 'string' || value.length > MAX_LEN) continue;
    const parts = path.split('.');
    if (DEV_OWNED.has(parts[0])) continue;

    let parent = merged;
    for (let i = 0; i < parts.length - 1 && parent !== undefined; i += 1) {
      const next = parent !== null && typeof parent === 'object' && Object.hasOwn(parent, parts[i]) ? parent[parts[i]] : undefined;
      parent = next;
    }
    const last = parts[parts.length - 1];
    if (parent !== null && typeof parent === 'object' && Object.hasOwn(parent, last) && typeof parent[last] === 'string') {
      parent[last] = value;
    }
  }
  return merged;
}
