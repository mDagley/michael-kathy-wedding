// test/limiter.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLimiter } from '../lib/limiter.js';

test('allows up to max hits per key within the window, then blocks', () => {
  let t = 1000;
  const limiter = createLimiter({ max: 3, windowMs: 60000, now: () => t });
  assert.equal(limiter.allow('ip1'), true);
  assert.equal(limiter.allow('ip1'), true);
  assert.equal(limiter.allow('ip1'), true);
  assert.equal(limiter.allow('ip1'), false);
  assert.equal(limiter.allow('ip2'), true); // other keys are independent
});

test('allows again once old hits fall out of the window', () => {
  let t = 0;
  const limiter = createLimiter({ max: 1, windowMs: 1000, now: () => t });
  assert.equal(limiter.allow('k'), true);
  assert.equal(limiter.allow('k'), false);
  t = 1001;
  assert.equal(limiter.allow('k'), true);
});
