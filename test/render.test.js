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

test('formatTime makes typed times look alike and leaves other text alone', async () => {
  const { formatTime } = await import('../site/js/render.js');
  assert.equal(formatTime('1:15pm'), '1:15 PM');
  assert.equal(formatTime('12:53 pm'), '12:53 PM');
  assert.equal(formatTime('3 p.m.'), '3 PM');
  assert.equal(formatTime('[TIME TBD]'), '[TIME TBD]');
  assert.equal(formatTime('Around noon'), 'Around noon');
});

const timelineHtml = `<ol class="timeline">
  <li id="a"><div data-c="events.arrival.time"></div></li>
  <li id="c"><div data-c="events.ceremony.time"></div></li>
  <li id="r"><div data-c="events.reception.time"></div></li>
  <li id="x"><div data-c="events.extra.time"></div></li>
</ol>`;
const order = (document) => [...document.querySelectorAll('.timeline li')].map((li) => li.id).join('');
const times = (arrival, ceremony, reception, extra) => ({ events: { arrival: { time: arrival }, ceremony: { time: ceremony }, reception: { time: reception }, extra: { time: extra } } });

test('the schedule is put in time order, including 12 AM/PM edge cases', () => {
  const { document } = new JSDOM(timelineHtml).window;
  applyContent(document, times('12:53pm', '1:15pm', '2:30pm', '1:35pm'));
  assert.equal(order(document), 'acxr');
  applyContent(document, times('12:30 PM', '11:00 AM', '12:00 AM', '1 PM'));
  assert.equal(order(document), 'rcax');
});

test('the schedule keeps its order while any time is unreadable', () => {
  const { document } = new JSDOM(timelineHtml).window;
  applyContent(document, times('[ARRIVAL TIME TBD]', '1:15pm', '2:30pm', '1:35pm'));
  assert.equal(order(document), 'acrx');
  applyContent(document, times('Around noon', '1:15pm', '2:30pm', '1:35pm'));
  assert.equal(order(document), 'acrx');
});
