// test/sheet-google.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { toRow, fromRow, COLUMNS, normalizePrivateKey, createGoogleSheet } from '../lib/sheet-google.js';

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

// ---- adapter logic with an injected mock Sheets client ----
const rowA = ['t1', 'Ada', 'ada@example.com', 'yes', '', ''];
const rowB = ['t2', 'Bob', 'bob@example.com', 'no', 'veg', 'hi'];

function mockClient(values) {
  const calls = { get: [], append: [], update: [] };
  const sheetsClient = {
    spreadsheets: {
      values: {
        get: async (p) => { calls.get.push(p); return { data: values === undefined ? {} : { values } }; },
        append: async (p) => { calls.append.push(p); return {}; },
        update: async (p) => { calls.update.push(p); return {}; },
      },
    },
  };
  return { sheetsClient, calls };
}
const rec = { timestamp: 't', name: 'N', email: 'n@example.com', attending: 'yes', dietary: '', notes: '' };

test('findByEmail returns the zero-based data row index and reads RSVPs!A2:F', async () => {
  const { sheetsClient, calls } = mockClient([rowA, rowB]);
  const sheet = createGoogleSheet({ sheetId: 'sheet-123', sheetsClient });
  const found = await sheet.findByEmail('bob@example.com');
  assert.equal(found.rowIndex, 1);
  assert.deepEqual(found.record, fromRow(rowB));
  assert.equal(calls.get[0].spreadsheetId, 'sheet-123');
  assert.equal(calls.get[0].range, 'RSVPs!A2:F');
});

test('update writes to sheet row rowIndex + 2', async () => {
  const { sheetsClient, calls } = mockClient([rowA, rowB]);
  const sheet = createGoogleSheet({ sheetId: 'sheet-123', sheetsClient });
  await sheet.update(1, rec);
  await sheet.update(0, rec);
  assert.equal(calls.update[0].range, 'RSVPs!A3:F3');
  assert.equal(calls.update[1].range, 'RSVPs!A2:F2');
  assert.equal(calls.update[0].spreadsheetId, 'sheet-123');
});

test('append and update use RAW, INSERT_ROWS and the right ranges', async () => {
  const { sheetsClient, calls } = mockClient([]);
  const sheet = createGoogleSheet({ sheetId: 's', sheetsClient });
  await sheet.append(rec);
  await sheet.update(0, rec);
  assert.equal(calls.append[0].range, 'RSVPs!A:F');
  assert.equal(calls.append[0].insertDataOption, 'INSERT_ROWS');
  assert.equal(calls.append[0].valueInputOption, 'RAW');
  assert.equal(calls.update[0].valueInputOption, 'RAW');
});

test('formula-like guest input is passed through unchanged under RAW', async () => {
  const { sheetsClient, calls } = mockClient([]);
  const sheet = createGoogleSheet({ sheetId: 's', sheetsClient });
  const evil = { ...rec, name: '=SUM(1+1)', notes: '=SUM(1+1)' };
  await sheet.append(evil);
  await sheet.update(0, evil);
  for (const c of [calls.append[0], calls.update[0]]) {
    assert.equal(c.valueInputOption, 'RAW');
    assert.equal(c.requestBody.values[0][1], '=SUM(1+1)');
    assert.equal(c.requestBody.values[0][5], '=SUM(1+1)');
  }
});

test('an empty sheet yields null from findByEmail', async () => {
  const { sheetsClient } = mockClient(undefined);
  const sheet = createGoogleSheet({ sheetId: 's', sheetsClient });
  assert.equal(await sheet.findByEmail('a@b.c'), null);
});

test('findByEmail normalizes both the argument and stored emails', async () => {
  const { sheetsClient } = mockClient([['t', 'Ada', 'Ada@Example.COM', 'yes', '', '']]);
  const sheet = createGoogleSheet({ sheetId: 's', sheetsClient });
  const found = await sheet.findByEmail('  ada@example.com ');
  assert.equal(found.rowIndex, 0);
});

test('missing credentials without a sheetsClient throw a clear error', () => {
  const msg = 'GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY are required when GOOGLE_SHEET_ID is set.';
  assert.throws(() => createGoogleSheet({ sheetId: 's', privateKey: 'k' }), { message: msg });
  assert.throws(() => createGoogleSheet({ sheetId: 's', clientEmail: 'e@x', privateKey: '' }), { message: msg });
  assert.throws(() => createGoogleSheet({ sheetId: 's', clientEmail: 'e@x' }), { message: msg });
  assert.throws(() => createGoogleSheet({ sheetId: 's', clientEmail: '', privateKey: 'k' }), { message: msg });
});
