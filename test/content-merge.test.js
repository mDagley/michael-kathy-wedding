// test/content-merge.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeContent } from '../site/js/content-merge.js';
import { content } from '../site/js/content.js';

const defaults = {
  a: { b: 'built-in', n: 5, list: [{ name: 'one' }, { name: 'two' }] },
  top: 'top',
  nav: [{ label: 'Home' }],
  credits: [{ label: 'Credit' }],
};

test('replaces strings at existing paths, including inside arrays', () => {
  const merged = mergeContent(defaults, { 'a.b': 'live', 'a.list.1.name': 'TWO', top: 'T' });
  assert.equal(merged.a.b, 'live');
  assert.equal(merged.a.list[1].name, 'TWO');
  assert.equal(merged.a.list[0].name, 'one');
  assert.equal(merged.top, 'T');
});

test('never mutates the defaults', () => {
  const before = JSON.stringify(defaults);
  mergeContent(defaults, { 'a.b': 'live' });
  assert.equal(JSON.stringify(defaults), before);
});

test('ignores paths that do not exist, non-string targets, and non-string values', () => {
  const merged = mergeContent(defaults, { 'a.zzz': 'x', 'a.n': 'text', 'a.b': 7, 'a.list.5.name': 'x', 'a.list': 'x', 'no.such.path': 'x' });
  assert.deepEqual(merged, defaults);
});

test('developer-owned roots (nav, credits) can never be changed', () => {
  const merged = mergeContent(defaults, { 'nav.0.label': 'Hacked', 'credits.0.label': 'Hacked' });
  assert.equal(merged.nav[0].label, 'Home');
  assert.equal(merged.credits[0].label, 'Credit');
});

test('prototype pollution attempts do nothing', () => {
  mergeContent(defaults, JSON.parse('{"__proto__":"x","a.__proto__.polluted":"x","constructor.prototype.polluted":"x","a.constructor":"x"}'));
  assert.equal({}.polluted, undefined);
  assert.equal(Object.prototype.polluted, undefined);
});

test('values longer than the 4000 character cap are ignored', () => {
  assert.equal(mergeContent(defaults, { top: 'x'.repeat(4001) }).top, 'top');
  assert.equal(mergeContent(defaults, { top: 'x'.repeat(4000) }).top.length, 4000);
});

test('null, undefined, or non-object values return a plain copy', () => {
  for (const bad of [null, undefined, 'x', 42, []]) assert.deepEqual(mergeContent(defaults, bad), defaults);
});

test('works against the real content.js: a sheet value replaces the placeholder', () => {
  const merged = mergeContent(content, { 'events.ceremony.time': '4:30 PM', 'announcement.text': 'Parking lot B is closed.' });
  assert.equal(merged.events.ceremony.time, '4:30 PM');
  assert.equal(merged.announcement.text, 'Parking lot B is closed.');
  assert.equal(merged.events.reception.time, content.events.reception.time);
});
