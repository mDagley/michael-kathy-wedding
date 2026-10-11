// site/js/theme-switcher.js
import { THEMES, resolveTheme, isPreview, setTheme } from './theme.js';

export function initTheme(win = window) {
  let storage;
  try { storage = win.localStorage; } catch { storage = { getItem: () => null, setItem() {} }; }
  const doc = win.document;
  const apply = (name) => { doc.documentElement.dataset.theme = name; };
  const initial = resolveTheme({ search: win.location.search, storage });
  apply(initial);

  if (!isPreview(win.location.search, storage)) return;

  const box = doc.createElement('div');
  box.className = 'theme-switcher';
  box.setAttribute('role', 'group');
  box.setAttribute('aria-label', 'Preview theme');
  const label = doc.createElement('span');
  label.textContent = 'Preview theme';
  box.append(label);
  const buttons = [];
  const markActive = (active) => buttons.forEach((btn) => btn.setAttribute('aria-pressed', String(btn.dataset.theme === active)));
  THEMES.forEach((name) => {
    const b = doc.createElement('button');
    b.type = 'button';
    b.textContent = name;
    b.dataset.theme = name;
    b.addEventListener('click', () => { setTheme(storage, name); apply(name); markActive(name); });
    buttons.push(b);
    box.append(b);
  });
  markActive(initial);
  doc.body.append(box);
}
