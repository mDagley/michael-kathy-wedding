// site/js/theme.js
export const THEMES = ['sage', 'terracotta', 'candlelit'];
export const DEFAULT_THEME = 'sage';
const PREVIEW_KEY = 'mk_preview';
const THEME_KEY = 'mk_theme';

export function isPreview(search, storage) {
  if (/[?&]preview(=|&|$)/.test(search || '')) {
    storage.setItem(PREVIEW_KEY, '1');
    return true;
  }
  return storage.getItem(PREVIEW_KEY) === '1';
}

export function resolveTheme({ search, storage }) {
  if (!isPreview(search, storage)) return DEFAULT_THEME;
  const stored = storage.getItem(THEME_KEY);
  return THEMES.includes(stored) ? stored : DEFAULT_THEME;
}

export function setTheme(storage, name) {
  if (!THEMES.includes(name)) throw new Error(`Unknown theme: ${name}`);
  storage.setItem(THEME_KEY, name);
}
