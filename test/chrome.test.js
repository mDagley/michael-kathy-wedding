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
