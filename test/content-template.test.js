// test/content-template.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTemplateRows } from '../scripts/make-content-template.js';
import { EDITABLE_FIELDS, getField } from '../lib/content-fields.js';
import { content } from '../site/js/content.js';
import { getPath } from '../site/js/render.js';

test('the template has a header and one row per editable field, key in the last column', () => {
  const rows = buildTemplateRows();
  assert.deepEqual(rows[0], ['Section', 'What it is', 'Value (edit this column)', 'key (do not edit)']);
  assert.equal(rows.length, EDITABLE_FIELDS.length + 1);
  assert.deepEqual(rows.slice(1).map((r) => r[3]), EDITABLE_FIELDS.map((f) => f.key));
});

test('each row starts with the current built-in text so nothing looks blank', () => {
  for (const [, , value, key] of buildTemplateRows().slice(1)) assert.equal(value, getPath(content, key));
});

test('every built-in default fits inside its own field limit (so importing the template never truncates anything)', () => {
  for (const f of EDITABLE_FIELDS) {
    const value = String(getPath(content, f.key) ?? '');
    assert.ok(Array.from(value).length <= f.maxLength, `${f.key}: default is ${Array.from(value).length} characters, limit ${f.maxLength}`);
  }
});

test('the announcement row is blank by default and labelled as optional', () => {
  const row = buildTemplateRows().find((r) => r[3] === 'announcement.text');
  assert.equal(row[2], '');
  assert.match(row[1], /leave blank/i);
});

test('every row has exactly four cells', () => {
  for (const r of buildTemplateRows()) assert.equal(r.length, 4);
});

test('the four getting-here rows are clearly distinguishable from the FAQ parking answer', () => {
  for (const k of ['travel.airports', 'travel.rideshare', 'travel.parking', 'travel.shuttle']) {
    assert.match(getField(k).label, /^Getting here: /);
  }
  assert.notEqual(getField('travel.parking').label, getField('faq.parking').label);
});
