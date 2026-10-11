// test/theme.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, DEFAULT_THEME, isPreview, resolveTheme, setTheme } from '../site/js/theme.js';

const makeStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};

test('sage is the default and all three themes exist', () => {
  assert.equal(DEFAULT_THEME, 'sage');
  assert.deepEqual(THEMES, ['sage', 'terracotta', 'candlelit']);
});

test('guests (no ?preview) always get the default theme, even if one was stored', () => {
  const s = makeStorage();
  s.setItem('mk_theme', 'candlelit');
  assert.equal(isPreview('', s), false);
  assert.equal(resolveTheme({ search: '', storage: s }), 'sage');
});

test('?preview turns preview mode on and it persists for the session', () => {
  const s = makeStorage();
  assert.equal(isPreview('?preview', s), true);
  assert.equal(isPreview('', s), true); // later pages without the param
});

test('in preview mode the stored theme is used, ignoring invalid values', () => {
  const s = makeStorage();
  isPreview('?preview', s);
  setTheme(s, 'terracotta');
  assert.equal(resolveTheme({ search: '', storage: s }), 'terracotta');
  s.setItem('mk_theme', 'hotpink');
  assert.equal(resolveTheme({ search: '', storage: s }), 'sage');
});

test('setTheme rejects unknown themes', () => {
  const s = makeStorage();
  assert.throws(() => setTheme(s, 'hotpink'));
});
