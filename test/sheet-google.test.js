// test/sheet-google.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { toRow, fromRow, COLUMNS, normalizePrivateKey } from '../lib/sheet-google.js';

test('columns match the sheet header order', () => {
  assert.deepEqual(COLUMNS, ['timestamp', 'name', 'email', 'attending', 'dietary', 'notes']);
});

test('toRow and fromRow round-trip a record', () => {
  const rec = { timestamp: 't', name: 'Ada', email: 'a@b.c', attending: 'yes', dietary: 'veg', notes: 'hi' };
  assert.deepEqual(fromRow(toRow(rec)), rec);
});

test('fromRow fills missing trailing cells with empty strings', () => {
  assert.deepEqual(fromRow(['t', 'Ada', 'a@b.c', 'no']), { timestamp: 't', name: 'Ada', email: 'a@b.c', attending: 'no', dietary: '', notes: '' });
});

test('normalizePrivateKey turns literal \\n into real newlines', () => {
  assert.equal(normalizePrivateKey('line1\\nline2'), 'line1\nline2');
  assert.equal(normalizePrivateKey('line1\nline2'), 'line1\nline2');
});
