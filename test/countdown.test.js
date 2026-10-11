// test/countdown.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { timeLeft, pad, WEDDING_START } from '../site/js/countdown.js';

test('wedding start is August 21, 2027 at midnight Chicago time (CDT, UTC-5)', () => {
  assert.equal(WEDDING_START, '2027-08-21T00:00:00-05:00');
});

test('314 days remain on October 11, 2026', () => {
  const t = timeLeft('2026-10-11T00:00:00-05:00', WEDDING_START);
  assert.equal(t.days, 314);
  assert.equal(t.hours, 0);
  assert.equal(t.done, false);
});

test('splits hours, minutes, seconds', () => {
  const target = '2027-08-21T00:00:00-05:00';
  const now = new Date(new Date(target).getTime() - (3600 + 60 + 1) * 1000);
  assert.deepEqual(timeLeft(now, target), { done: false, days: 0, hours: 1, minutes: 1, seconds: 1 });
});

test('is done at and after the target, never negative', () => {
  assert.deepEqual(timeLeft(WEDDING_START, WEDDING_START), { done: true, days: 0, hours: 0, minutes: 0, seconds: 0 });
  assert.equal(timeLeft('2030-01-01T00:00:00Z', WEDDING_START).done, true);
});

test('pad left-pads to two digits', () => {
  assert.equal(pad(7), '07');
  assert.equal(pad(42), '42');
});
