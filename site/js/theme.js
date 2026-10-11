// site/js/theme.js
export const THEMES = ['sage', 'terracotta', 'candlelit'];
export const DEFAULT_THEME = 'sage';
const PREVIEW_KEY = 'mk_preview';
const THEME_KEY = 'mk_theme';

export function isPreview(search, storage) {
  if (/[?&]preview(=|&|$)/.test(search || '')) {
    // If storage is unavailable, preview lasts only for this page.
    try { storage.setItem(PREVIEW_KEY, '1'); } catch { /* ignore */ }
    return true;
  }
  try {
    return storage.getItem(PREVIEW_KEY) === '1';
  } catch {
    return false;
  }
}

export function resolveTheme({ search, storage }) {
  if (!isPreview(search, storage)) return DEFAULT_THEME;
  let stored;
  try { stored = storage.getItem(THEME_KEY); } catch { return DEFAULT_THEME; }
  return THEMES.includes(stored) ? stored : DEFAULT_THEME;
}

export function setTheme(storage, name) {
  if (!THEMES.includes(name)) throw new Error(`Unknown theme: ${name}`);
  try { storage.setItem(THEME_KEY, name); } catch { /* ignore */ }
}
