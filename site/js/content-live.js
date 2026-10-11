// site/js/content-live.js
// Fetches the couple's edits. Resolves to a { key: value } map, or null on ANY problem
// (offline, slow, error status, bad JSON), in which case the built-in text simply stays.
export async function loadLiveContent({ fetchFn, timeoutMs = 1500, url = '/api/content' }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.ok === true && data.values && typeof data.values === 'object' && !Array.isArray(data.values)
      ? data.values
      : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
