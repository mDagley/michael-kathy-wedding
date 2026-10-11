// test/render.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { getPath, applyContent } from '../site/js/render.js';

const content = {
  a: { b: 'hello', list: [{ name: 'First' }, { name: '[SECOND TBD]' }] },
  link: 'https://example.com/x',
  linkTbd: '[LINK TBD]',
};

test('getPath reads nested keys and array indexes', () => {
  assert.equal(getPath(content, 'a.b'), 'hello');
  assert.equal(getPath(content, 'a.list.1.name'), '[SECOND TBD]');
  assert.equal(getPath(content, 'a.nope.deeper'), undefined);
});

test('applyContent fills text and flags bracketed placeholders as .tbd', () => {
  const { document } = new JSDOM(
    '<p id="x" data-c="a.b"></p><p id="y" data-c="a.list.1.name"></p><p id="z" data-c="a.missing"></p>'
  ).window;
  applyContent(document, content);
  assert.equal(document.getElementById('x').textContent, 'hello');
  assert.equal(document.getElementById('x').classList.contains('tbd'), false);
  assert.equal(document.getElementById('y').textContent, '[SECOND TBD]');
  assert.equal(document.getElementById('y').classList.contains('tbd'), true);
  assert.equal(document.getElementById('z').textContent, '[MISSING: a.missing]');
  assert.equal(document.getElementById('z').classList.contains('tbd'), true);
});

test('applyContent sets real links and neutralizes placeholder links', () => {
  const { document } = new JSDOM(
    '<a id="g" data-c-href="link">go</a><a id="p" data-c-href="linkTbd">tbd</a>'
  ).window;
  applyContent(document, content);
  assert.equal(document.getElementById('g').getAttribute('href'), 'https://example.com/x');
  assert.equal(document.getElementById('p').getAttribute('href'), '#');
  assert.equal(document.getElementById('p').classList.contains('tbd'), true);
});

test('a link that becomes valid loses the placeholder styling', () => {
  const { document } = new JSDOM('<a id="l" data-c-href="link">go</a>').window;
  const el = document.getElementById('l');
  applyContent(document, { link: '[LINK TBD]' });
  assert.equal(el.getAttribute('href'), '#');
  assert.equal(el.classList.contains('tbd'), true);
  applyContent(document, { link: 'https://example.com/real' });
  assert.equal(el.getAttribute('href'), 'https://example.com/real');
  assert.equal(el.classList.contains('tbd'), false);
});
