// test/content-sheet.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseContentRows, createGoogleContentSource, createFileContentSource } from '../lib/content-sheet.js';
import { createContentSource } from '../lib/config.js';

// A sheet row is [Section, What it is, Value, key].
const row = (key, value) => ['Section', 'Label', value, key];

test('known keys are returned, trimmed', () => {
  assert.deepEqual(parseContentRows([row('dress.code', '  Black tie  ')]), { 'dress.code': 'Black tie' });
});

test('unknown, developer-owned, and prototype keys are ignored', () => {
  const out = parseContentRows([row('nope', 'x'), row('nav.0.label', 'x'), row('credits.0.url', 'x'), row('__proto__', 'x'), row('constructor', 'x')]);
  assert.deepEqual(out, {});
  assert.equal(Object.getPrototypeOf(out), Object.prototype);
});

test('blank values keep the built-in default (the key is simply absent)', () => {
  assert.deepEqual(parseContentRows([row('dress.code', ''), row('dress.note', '   ')]), {});
});

test('short, empty, or malformed rows are ignored without throwing', () => {
  assert.deepEqual(parseContentRows([[], ['a', 'b'], null, undefined, ['a', 'b', 'c']]), {});
  assert.deepEqual(parseContentRows(null), {});
  assert.deepEqual(parseContentRows(undefined), {});
});

test('the first row for a duplicated key wins', () => {
  assert.deepEqual(parseContentRows([row('dress.code', 'First'), row('dress.code', 'Second')]), { 'dress.code': 'First' });
});

test('single-line fields collapse line breaks; multiline fields keep them', () => {
  const out = parseContentRows([row('dress.code', 'Black\ntie'), row('faq.plusOne', 'Line one\nLine two')]);
  assert.equal(out['dress.code'], 'Black tie');
  assert.equal(out['faq.plusOne'], 'Line one\nLine two');
});

test('over-length text is cut at the field limit', () => {
  const out = parseContentRows([row('couple.city', 'x'.repeat(500))]);
  assert.equal(out['couple.city'].length, 60);
});

test('announcement is limited to 300 characters', () => {
  assert.equal(parseContentRows([row('announcement.text', 'y'.repeat(1000))])['announcement.text'].length, 300);
});

test('control characters are stripped', () => {
  assert.equal(parseContentRows([row('dress.code', 'Black\u0000\u0007 tie\u007f')])['dress.code'], 'Black tie');
});

test('url fields accept only http(s) links', () => {
  const ok = parseContentRows([row('travel.hotels.0.link', 'https://example.com/book?code=A1')]);
  assert.equal(ok['travel.hotels.0.link'], 'https://example.com/book?code=A1');
  for (const bad of ['javascript:alert(1)', 'ftp://x.com', 'example.com', 'https://', 'https://a b.com', '[LINK TBD]', 'https://x.com/"onclick=1', 'data:text/html,hi']) {
    assert.deepEqual(parseContentRows([row('travel.hotels.0.link', bad)]), {}, bad);
  }
  assert.deepEqual(parseContentRows([row('travel.hotels.0.link', 'https://example.com/' + 'a'.repeat(600))]), {});
});

test('text that looks like a formula or markup is passed through as plain text', () => {
  const out = parseContentRows([row('faq.plusOne', '=SUM(1+1) <script>alert(1)</script>')]);
  assert.equal(out['faq.plusOne'], '=SUM(1+1) <script>alert(1)</script>');
});

test('non-string cell values (numbers) are converted to text', () => {
  assert.deepEqual(parseContentRows([row('dress.code', 42)]), { 'dress.code': '42' });
});

test('google source reads the Site Details tab from row 2 and parses it', async () => {
  const calls = [];
  const sheetsClient = { spreadsheets: { values: { get: async (p) => { calls.push(p); return { data: { values: [row('dress.code', 'Black tie'), row('nope', 'x')] } }; } } } };
  const source = createGoogleContentSource({ sheetId: 'SHEET1', sheetsClient });
  assert.deepEqual(await source.load(), { 'dress.code': 'Black tie' });
  assert.deepEqual(calls, [{ spreadsheetId: 'SHEET1', range: "'Site Details'!A2:D" }]);
});

test('google source escapes apostrophes in a custom tab name and tolerates an empty tab', async () => {
  const calls = [];
  const sheetsClient = { spreadsheets: { values: { get: async (p) => { calls.push(p.range); return { data: {} }; } } } };
  const source = createGoogleContentSource({ sheetId: 'S', tab: "Kathy's Details", sheetsClient });
  assert.deepEqual(await source.load(), {});
  assert.equal(calls[0], "'Kathy''s Details'!A2:D");
});

test('google source lets API errors propagate (the handler turns them into a 503)', async () => {
  const sheetsClient = { spreadsheets: { values: { get: async () => { throw new Error('Unable to parse range'); } } } };
  await assert.rejects(createGoogleContentSource({ sheetId: 'S', sheetsClient }).load(), /Unable to parse range/);
});

test('file source (local dev) reads a flat JSON map and applies the same validation', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'content-'));
  const path = join(dir, 'c.json');
  writeFileSync(path, JSON.stringify({ 'dress.code': 'Cocktail', 'travel.hotels.0.link': 'javascript:x', nope: 'y' }));
  assert.deepEqual(await createFileContentSource(path).load(), { 'dress.code': 'Cocktail' });
});

test('file source returns an empty map when the file does not exist', async () => {
  assert.deepEqual(await createFileContentSource(join(tmpdir(), 'definitely-missing-content.json')).load(), {});
});

test('createContentSource never falls back to a local file in production without a sheet id', () => {
  assert.throws(() => createContentSource({ CONTEXT: 'production' }), /GOOGLE_SHEET_ID/);
});

test('createContentSource builds a Google source when credentials are present, and a file source in dev', () => {
  const g = createContentSource({ CONTEXT: 'production', GOOGLE_SHEET_ID: 'abc', GOOGLE_CLIENT_EMAIL: 'svc@example.iam.gserviceaccount.com', GOOGLE_PRIVATE_KEY: 'not-a-real-key' });
  assert.equal(typeof g.load, 'function');
  assert.equal(typeof createContentSource({}).load, 'function');
});
