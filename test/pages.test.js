// test/pages.test.js
// Static integrity checks that run over EVERY page in site/*.html (new pages are picked up automatically).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { content } from '../site/js/content.js';
import { getPath } from '../site/js/render.js';

const SITE = new URL('../site/', import.meta.url);
const sitePath = (rel) => new URL(rel, SITE);
const pages = readdirSync(SITE).filter((f) => f.endsWith('.html'));
const navIds = content.nav.map((n) => n.id);
// Pages that later tasks create; links to them are allowed to dangle until their task lands.
// Remove an entry here as soon as its page exists. (Task 12 removes the last one.)
const NOT_BUILT_YET = new Set(['rsvp.html']);

test('the site has at least one page', () => {
  assert.ok(pages.length > 0);
});

for (const file of pages) {
  const html = readFileSync(sitePath(file), 'utf8');
  const { document } = new JSDOM(html).window;

  test(`${file}: every data-c and data-c-href path exists in content.js`, () => {
    for (const el of document.querySelectorAll('[data-c]')) {
      assert.notEqual(getPath(content, el.dataset.c), undefined, `data-c="${el.dataset.c}" is missing from content.js`);
    }
    for (const el of document.querySelectorAll('[data-c-href]')) {
      assert.notEqual(getPath(content, el.dataset.cHref), undefined, `data-c-href="${el.dataset.cHref}" is missing from content.js`);
    }
  });

  test(`${file}: local links, scripts, styles, and images exist on disk`, () => {
    const nodes = [...document.querySelectorAll('a[href], link[href], script[src], img[src]')];
    for (const el of nodes) {
      const ref = el.getAttribute('href') ?? el.getAttribute('src');
      if (!ref || ref.startsWith('#') || /^(https?:|mailto:|tel:)/.test(ref)) continue;
      const clean = ref.split('#')[0].split('?')[0];
      if (NOT_BUILT_YET.has(clean)) continue;
      const relative = clean.startsWith('/') ? clean.slice(1) : clean;
      assert.ok(existsSync(sitePath(relative)), `${file} references a missing file: ${ref}`);
    }
  });

  test(`${file}: data-page is a nav page id (or "none" for the 404 page)`, () => {
    const page = document.body.dataset.page;
    assert.ok(page === 'none' || navIds.includes(page), `data-page="${page}"`);
  });

  test(`${file}: element ids are unique`, () => {
    const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length, `duplicate ids in ${file}: ${ids.filter((id, i) => ids.indexOf(id) !== i)}`);
  });
}
