// test/content-fields.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { content } from '../site/js/content.js';
import { EDITABLE_FIELDS, getField, FIELD_KINDS } from '../lib/content-fields.js';

const DEV_OWNED = new Set(['nav', 'credits']);

function stringPaths(value, prefix = '') {
  if (typeof value === 'string') return [prefix];
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => stringPaths(v, prefix ? `${prefix}.${k}` : k));
  }
  return [];
}
const contentPaths = stringPaths(content).filter((p) => !DEV_OWNED.has(p.split('.')[0]));
const fieldKeys = EDITABLE_FIELDS.map((f) => f.key);

test('every editable string in content.js has a sheet field', () => {
  assert.deepEqual(contentPaths.filter((p) => !fieldKeys.includes(p)), []);
});

test('every sheet field points at an existing string in content.js', () => {
  assert.deepEqual(fieldKeys.filter((k) => !contentPaths.includes(k)), []);
});

test('field keys are unique', () => {
  assert.equal(new Set(fieldKeys).size, fieldKeys.length);
});

test('developer-owned content (nav, credits) is never editable', () => {
  for (const k of fieldKeys) assert.equal(DEV_OWNED.has(k.split('.')[0]), false, k);
});

test('every field has a plain-English label, a section, a valid kind, and a sane length', () => {
  for (const f of EDITABLE_FIELDS) {
    assert.ok(f.label.length > 3, `${f.key} label`);
    assert.ok(f.section.length > 2, `${f.key} section`);
    assert.ok(FIELD_KINDS.includes(f.kind), `${f.key} kind`);
    assert.ok(Number.isInteger(f.maxLength) && f.maxLength > 0 && f.maxLength <= 4000, `${f.key} maxLength`);
  }
});

test('exactly the link fields are url fields', () => {
  for (const f of EDITABLE_FIELDS) assert.equal(f.key.endsWith('.link'), f.kind === 'url', f.key);
});

test('the announcement banner exists, defaults to empty (no banner), and is the first field', () => {
  assert.equal(content.announcement.text, '');
  assert.equal(EDITABLE_FIELDS[0].key, 'announcement.text');
  assert.equal(EDITABLE_FIELDS[0].maxLength, 300);
});

test('getField returns a field by key and undefined for unknown keys', () => {
  assert.equal(getField('dress.code').label, 'Dress code');
  assert.equal(getField('nav.0.label'), undefined);
  assert.equal(getField('__proto__'), undefined);
});

test('date fields warn that they do not change the countdown', () => {
  for (const k of ['couple.date', 'couple.dateLong']) assert.match(getField(k).label, /countdown/i);
});
