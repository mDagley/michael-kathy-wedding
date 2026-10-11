// test/rsvp-ui.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { initRsvpForm, initLookup } from '../site/js/rsvp.js';
import { createVenueStore } from '../site/js/venue-store.js';

const rsvpHtml = `
<form id="rsvp-form">
  <input name="name" value="Ada Lovelace"><span data-error="name"></span>
  <input name="email" value="ada@example.com"><span data-error="email"></span>
  <input type="radio" name="attending" value="yes" checked>
  <input type="radio" name="attending" value="no">
  <span data-error="attending"></span>
  <input name="dietary" value=""><input name="notes" value="">
  <input name="website" value="">
  <button id="submit" type="submit">Send RSVP</button>
  <p id="rsvp-error" hidden></p>
</form>
<section id="rsvp-yes" hidden><span data-venue-name></span><span data-venue-address></span></section>
<section id="rsvp-no" hidden></section>
<div data-venue-state="locked"></div><div data-venue-state="revealed" hidden><span data-venue-name></span><span data-venue-address></span></div>`;

function memStore() {
  let v = null;
  return { get: () => v, set: (x) => { v = x; }, clear: () => { v = null; } };
}
const jsonResponse = (status, body) => ({ ok: status < 400, status, json: async () => body });
const flush = () => new Promise((r) => setTimeout(r, 0));

function submit(doc) {
  doc.getElementById('rsvp-form').dispatchEvent(new doc.defaultView.Event('submit', { cancelable: true, bubbles: true }));
}

test('yes RSVP stores and shows the venue, hides the form', async () => {
  const { document } = new JSDOM(rsvpHtml).window;
  const store = memStore();
  const calls = [];
  const fetchFn = async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return jsonResponse(200, { ok: true, attending: true, venue: { name: 'The Hall', address: '1 Main St' } }); };
  initRsvpForm(document, { fetchFn, store, contact: 'a@b.c' });
  submit(document);
  await flush();
  assert.equal(calls[0].url, '/api/rsvp');
  assert.equal(calls[0].body.attending, 'yes');
  assert.equal(calls[0].body.email, 'ada@example.com');
  assert.deepEqual(store.get(), { name: 'The Hall', address: '1 Main St' });
  assert.equal(document.getElementById('rsvp-form').hidden, true);
  assert.equal(document.getElementById('rsvp-yes').hidden, false);
  assert.equal(document.querySelector('#rsvp-yes [data-venue-name]').textContent, 'The Hall');
  assert.equal(document.getElementById('rsvp-no').hidden, true);
});

test('no RSVP shows the decline message and never stores a venue', async () => {
  const { document } = new JSDOM(rsvpHtml).window;
  document.querySelector('input[value="no"]').checked = true;
  const store = memStore();
  const fetchFn = async () => jsonResponse(200, { ok: true, attending: false });
  initRsvpForm(document, { fetchFn, store, contact: 'a@b.c' });
  submit(document);
  await flush();
  assert.equal(store.get(), null);
  assert.equal(document.getElementById('rsvp-no').hidden, false);
  assert.equal(document.getElementById('rsvp-yes').hidden, true);
});

test('validation errors show per field and keep the form and entries', async () => {
  const { document } = new JSDOM(rsvpHtml).window;
  const fetchFn = async () => jsonResponse(400, { ok: false, errors: { email: 'Please enter a valid email.' } });
  initRsvpForm(document, { fetchFn, store: memStore(), contact: 'a@b.c' });
  submit(document);
  await flush();
  assert.equal(document.querySelector('[data-error="email"]').textContent, 'Please enter a valid email.');
  assert.equal(document.getElementById('rsvp-form').hidden, false);
  assert.equal(document.querySelector('input[name="name"]').value, 'Ada Lovelace');
  assert.equal(document.getElementById('submit').disabled, false);
});

test('network failure shows a fallback with the contact info and keeps entries', async () => {
  const { document } = new JSDOM(rsvpHtml).window;
  const fetchFn = async () => { throw new Error('offline'); };
  initRsvpForm(document, { fetchFn, store: memStore(), contact: 'kathy@example.com' });
  submit(document);
  await flush();
  const msg = document.getElementById('rsvp-error');
  assert.equal(msg.hidden, false);
  assert.match(msg.textContent, /kathy@example\.com/);
  assert.equal(document.querySelector('input[name="name"]').value, 'Ada Lovelace');
  assert.equal(document.getElementById('submit').disabled, false);
});

const lookupHtml = `
<div data-venue-state="locked">
  <form id="lookup-form">
    <input name="name" value="Ada Lovelace"><input name="email" value="ada@example.com">
    <button type="submit">Look up</button><p id="lookup-msg"></p>
  </form>
</div>
<div data-venue-state="revealed" hidden><span data-venue-name></span><span data-venue-address></span></div>`;

test('lookup success saves the venue and reveals it', async () => {
  const { document } = new JSDOM(lookupHtml).window;
  const store = memStore();
  const fetchFn = async (url) => { assert.equal(url, '/api/lookup'); return jsonResponse(200, { ok: true, found: true, venue: { name: 'The Hall', address: '1 Main St' } }); };
  initLookup(document, { fetchFn, store });
  document.getElementById('lookup-form').dispatchEvent(new document.defaultView.Event('submit', { cancelable: true, bubbles: true }));
  await flush();
  assert.deepEqual(store.get(), { name: 'The Hall', address: '1 Main St' });
  assert.equal(document.querySelector('[data-venue-state="revealed"]').hidden, false);
});

test('lookup with no match shows a message and reveals nothing', async () => {
  const { document } = new JSDOM(lookupHtml).window;
  const store = memStore();
  const fetchFn = async () => jsonResponse(200, { ok: true, found: false });
  initLookup(document, { fetchFn, store });
  document.getElementById('lookup-form').dispatchEvent(new document.defaultView.Event('submit', { cancelable: true, bubbles: true }));
  await flush();
  assert.equal(store.get(), null);
  assert.match(document.getElementById('lookup-msg').textContent, /couldn't find/i);
  assert.equal(document.querySelector('[data-venue-state="revealed"]').hidden, true);
});

test('after a successful yes RSVP focus moves to the yes section', async () => {
  const { document } = new JSDOM(rsvpHtml).window;
  const fetchFn = async () => jsonResponse(200, { ok: true, attending: true, venue: { name: 'The Hall', address: '1 Main St' } });
  initRsvpForm(document, { fetchFn, store: memStore(), contact: 'a@b.c' });
  submit(document);
  await flush();
  assert.equal(document.activeElement, document.getElementById('rsvp-yes'));
});

test('after a successful no RSVP focus moves to the no section', async () => {
  const { document } = new JSDOM(rsvpHtml).window;
  document.querySelector('input[value="no"]').checked = true;
  const fetchFn = async () => jsonResponse(200, { ok: true, attending: false });
  initRsvpForm(document, { fetchFn, store: memStore(), contact: 'a@b.c' });
  submit(document);
  await flush();
  assert.equal(document.activeElement, document.getElementById('rsvp-no'));
});

test('submitting twice quickly sends only one request', async () => {
  const { document } = new JSDOM(rsvpHtml).window;
  let calls = 0;
  let resolveFetch;
  const fetchFn = () => { calls += 1; return new Promise((r) => { resolveFetch = r; }); };
  initRsvpForm(document, { fetchFn, store: memStore(), contact: 'a@b.c' });
  submit(document);
  submit(document);
  assert.equal(calls, 1);
  resolveFetch(jsonResponse(200, { ok: true, attending: false }));
  await flush();
  assert.equal(calls, 1);
});

const mapStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const lookupSubmit = (document) => document.getElementById('lookup-form').dispatchEvent(new document.defaultView.Event('submit', { cancelable: true, bubbles: true }));

test('placeholder venue is shown after a yes RSVP but never remembered', async () => {
  const { document } = new JSDOM(rsvpHtml).window;
  const store = createVenueStore(mapStorage());
  const venue = { name: '[VENUE NAME TBD]', address: '[STREET ADDRESS TBD]' };
  const fetchFn = async () => jsonResponse(200, { ok: true, attending: true, venue });
  initRsvpForm(document, { fetchFn, store, contact: 'a@b.c' });
  submit(document);
  await flush();
  assert.equal(document.querySelector('#rsvp-yes [data-venue-name]').textContent, '[VENUE NAME TBD]');
  assert.equal(document.getElementById('rsvp-yes').hidden, false);
  assert.equal(store.get(), null);
});

test('a no RSVP clears a venue stored by an earlier yes', async () => {
  const { document } = new JSDOM(rsvpHtml).window;
  document.querySelector('input[value="no"]').checked = true;
  const store = createVenueStore(mapStorage());
  store.set({ name: 'The Hall', address: '1 Main St' });
  const fetchFn = async () => jsonResponse(200, { ok: true, attending: false });
  initRsvpForm(document, { fetchFn, store, contact: 'a@b.c' });
  submit(document);
  await flush();
  assert.equal(store.get(), null);
});

test('lookup rate limit (429) shows a wait message', async () => {
  const { document } = new JSDOM(lookupHtml).window;
  const fetchFn = async () => jsonResponse(429, { ok: false });
  initLookup(document, { fetchFn, store: memStore() });
  lookupSubmit(document);
  await flush();
  assert.equal(document.getElementById('lookup-msg').textContent, 'Too many attempts. Please wait a few minutes and try again.');
});

test('after a successful lookup focus moves to the revealed block', async () => {
  const { document } = new JSDOM(lookupHtml).window;
  const fetchFn = async () => jsonResponse(200, { ok: true, found: true, venue: { name: 'The Hall', address: '1 Main St' } });
  initLookup(document, { fetchFn, store: memStore() });
  lookupSubmit(document);
  await flush();
  const revealed = document.querySelector('[data-venue-state="revealed"]');
  assert.equal(revealed.getAttribute('tabindex'), '-1');
  assert.equal(document.activeElement, revealed);
});

test('the contact text may be a function, so live content changes show in the fallback message', async () => {
  const { document } = new JSDOM(rsvpHtml).window;
  let contact = 'old@example.com';
  const fetchFn = async () => { throw new Error('offline'); };
  initRsvpForm(document, { fetchFn, store: memStore(), contact: () => contact });
  contact = 'new@example.com';
  submit(document);
  await flush();
  assert.match(document.getElementById('rsvp-error').textContent, /new@example\.com/);
});
