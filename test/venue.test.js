// test/venue.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createVenueStore } from '../site/js/venue-store.js';
import { showVenue } from '../site/js/venue-ui.js';

const makeStorage = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
};

test('store returns null until a venue is saved', () => {
  const store = createVenueStore(makeStorage());
  assert.equal(store.get(), null);
});

test('store saves and returns a venue, and clears it', () => {
  const store = createVenueStore(makeStorage());
  store.set({ name: 'The Hall', address: '1 Main St' });
  assert.deepEqual(store.get(), { name: 'The Hall', address: '1 Main St' });
  store.clear();
  assert.equal(store.get(), null);
});

test('store ignores corrupt or wrongly shaped data', () => {
  const s = makeStorage();
  s.setItem('mk_venue', '{not json');
  assert.equal(createVenueStore(s).get(), null);
  s.setItem('mk_venue', JSON.stringify({ name: 5 }));
  assert.equal(createVenueStore(s).get(), null);
});

test('store survives storage that throws (private browsing)', () => {
  const broken = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };
  const store = createVenueStore(broken);
  assert.equal(store.get(), null);
  assert.doesNotThrow(() => store.set({ name: 'a', address: 'b' }));
});

const html = `
  <div id="l" data-venue-state="locked"></div>
  <div id="r" data-venue-state="revealed" hidden>
    <span data-venue-name></span><span data-venue-address></span>
  </div>`;

test('showVenue(null) shows locked blocks and hides revealed ones', () => {
  const { document } = new JSDOM(html).window;
  showVenue(document, null);
  assert.equal(document.getElementById('l').hidden, false);
  assert.equal(document.getElementById('r').hidden, true);
});

test('showVenue(venue) reveals and fills the name and address', () => {
  const { document } = new JSDOM(html).window;
  showVenue(document, { name: 'The Hall', address: '1 Main St' });
  assert.equal(document.getElementById('l').hidden, true);
  assert.equal(document.getElementById('r').hidden, false);
  assert.equal(document.querySelector('[data-venue-name]').textContent, 'The Hall');
  assert.equal(document.querySelector('[data-venue-address]').textContent, '1 Main St');
});
