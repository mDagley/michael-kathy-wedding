// test/chrome.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { renderChrome } from '../site/js/chrome.js';
import { content } from '../site/js/content.js';

function setup() {
  const { document } = new JSDOM('<div id="site-nav"></div><div id="site-footer"></div>').window;
  return document;
}

test('nav lists every page and marks the current one', () => {
  const doc = setup();
  renderChrome(doc, content, 'travel');
  const links = [...doc.querySelectorAll('#site-nav .links a')];
  assert.equal(links.length, content.nav.length);
  const current = links.filter((a) => a.getAttribute('aria-current') === 'page');
  assert.equal(current.length, 1);
  assert.equal(current[0].textContent, 'Travel');
  assert.ok(links.at(-1).classList.contains('cta'));
  assert.equal(links.at(-1).textContent, 'RSVP');
});

test('footer shows the deadline, hashtag, and every photo credit as a link', () => {
  const doc = setup();
  renderChrome(doc, content, 'home');
  const footer = doc.getElementById('site-footer');
  assert.match(footer.textContent, /RSVP BY/);
  assert.match(footer.textContent, /#\[HASHTAG TBD\]/);
  const credits = [...footer.querySelectorAll('.credits a')];
  assert.equal(credits.length, content.credits.length);
  assert.equal(credits[0].getAttribute('href'), content.credits[0].url);
  assert.equal(credits[0].textContent, content.credits[0].label);
});

test('placeholder deadline and hashtag are highlighted with the tbd class', () => {
  const doc = setup();
  renderChrome(doc, content, 'home');
  const flagged = [...doc.querySelectorAll('#site-footer .tbd')].map((e) => e.textContent);
  assert.ok(flagged.includes(content.rsvp.deadline));
  assert.ok(flagged.includes(content.couple.hashtag));
});

test('real (non-bracketed) deadline and hashtag are not highlighted', () => {
  const doc = setup();
  const real = { ...content, rsvp: { deadline: 'July 24, 2027' }, couple: { ...content.couple, hashtag: '#MichaelAndKathy' } };
  renderChrome(doc, real, 'home');
  assert.equal(doc.querySelectorAll('#site-footer .tbd').length, 0);
});

test('footer renders one vecteezy link per credit, separated by a middle dot', () => {
  const doc = setup();
  renderChrome(doc, content, 'home');
  const credits = doc.querySelector('#site-footer .credits');
  const links = [...credits.querySelectorAll('a')];
  assert.equal(content.credits.length, 6);
  assert.equal(links.length, 6);
  content.credits.forEach((c) => assert.ok(c.url.startsWith('https://www.vecteezy.com/'), c.url));
  assert.ok(credits.textContent.startsWith('Photos and art: '));
  assert.equal(credits.textContent.split(' \u00b7 ').length, 6);
});

const withBanner = (text) => ({ ...content, announcement: { text } });

test('no announcement banner when the text is empty', () => {
  const doc = setup();
  renderChrome(doc, content, 'home');
  assert.equal(doc.querySelector('.announcement'), null);
});

test('a banner renders above the nav with the exact text and an accessible role', () => {
  const doc = setup();
  renderChrome(doc, withBanner('Parking lot B is closed.'), 'home');
  const bar = doc.querySelector('.announcement');
  assert.equal(bar.textContent, 'Parking lot B is closed.');
  assert.equal(bar.getAttribute('role'), 'region');
  assert.equal(bar.getAttribute('aria-label'), 'Announcement');
  assert.equal(doc.body.firstElementChild, bar);
});

test('markup in the banner text is shown literally (no HTML injection)', () => {
  const doc = setup();
  renderChrome(doc, withBanner('<img src=x onerror=alert(1)> <b>bold</b>'), 'home');
  const bar = doc.querySelector('.announcement');
  assert.equal(bar.querySelector('img, b, script'), null);
  assert.equal(bar.textContent, '<img src=x onerror=alert(1)> <b>bold</b>');
});

test('rendering twice never duplicates the banner and updates its text', () => {
  const doc = setup();
  renderChrome(doc, withBanner('First'), 'home');
  renderChrome(doc, withBanner('Second'), 'home');
  const bars = doc.querySelectorAll('.announcement');
  assert.equal(bars.length, 1);
  assert.equal(bars[0].textContent, 'Second');
});

test('clearing the text removes the banner', () => {
  const doc = setup();
  renderChrome(doc, withBanner('Temporary'), 'home');
  renderChrome(doc, withBanner('   '), 'home');
  assert.equal(doc.querySelector('.announcement'), null);
});

test('content without an announcement key does not break rendering', () => {
  const doc = setup();
  const { announcement, ...rest } = content;
  assert.doesNotThrow(() => renderChrome(doc, rest, 'home'));
  assert.equal(doc.querySelector('.announcement'), null);
});

test('rendering twice for the same page keeps the very same nav element', () => {
  const doc = setup();
  renderChrome(doc, content, 'travel');
  const first = doc.querySelector('#site-nav nav');
  renderChrome(doc, content, 'travel');
  const second = doc.querySelector('#site-nav nav');
  assert.equal(second, first);
});

test('rendering with a different page id rebuilds the nav and updates aria-current', () => {
  const doc = setup();
  renderChrome(doc, content, 'travel');
  const first = doc.querySelector('#site-nav nav');
  renderChrome(doc, content, 'home');
  const second = doc.querySelector('#site-nav nav');
  assert.notEqual(second, first);
  const current = [...doc.querySelectorAll('#site-nav .links a[aria-current="page"]')];
  assert.equal(current.length, 1);
  assert.equal(current[0].getAttribute('href'), content.nav.find((n) => n.id === 'home').href);
});
