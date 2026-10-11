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


test('createContentSource (dev) reads DEV_CONTENT_PATH through the file source', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'content-'));
  const path = join(dir, 'c.json');
  writeFileSync(path, JSON.stringify({ 'dress.code': 'From file' }));
  assert.deepEqual(await createContentSource({ NETLIFY_DEV: 'true', DEV_CONTENT_PATH: path }).load(), { 'dress.code': 'From file' });
});

function mockClient(calls) {
  return { spreadsheets: { values: { get: async (p) => { calls.push(p); return { data: { values: [row('dress.code', 'Sheet value')] } }; } } } };
}

test('createContentSource (Google) uses the injected client, sheet id and default tab', async () => {
  const calls = [];
  const source = createContentSource({ GOOGLE_SHEET_ID: 'SHEET9' }, { sheetsClient: mockClient(calls) });
  assert.deepEqual(await source.load(), { 'dress.code': 'Sheet value' });
  assert.deepEqual(calls, [{ spreadsheetId: 'SHEET9', range: "'Site Details'!A2:D" }]);
});

test('createContentSource honors CONTENT_TAB', async () => {
  const calls = [];
  const source = createContentSource({ GOOGLE_SHEET_ID: 'SHEET9', CONTENT_TAB: 'Wedding Info' }, { sheetsClient: mockClient(calls) });
  await source.load();
  assert.deepEqual(calls, [{ spreadsheetId: 'SHEET9', range: "'Wedding Info'!A2:D" }]);
});

test('createContentSource in production builds with a sheet id and throws without one', () => {
  const g = createContentSource({ CONTEXT: 'production', GOOGLE_SHEET_ID: 'abc', GOOGLE_CLIENT_EMAIL: 'svc@example.iam.gserviceaccount.com', GOOGLE_PRIVATE_KEY: 'not-a-real-key' });
  assert.equal(typeof g.load, 'function');
  assert.throws(() => createContentSource({ CONTEXT: 'production' }), /GOOGLE_SHEET_ID/);
});

// ---- hardening ----
const timed = (rows) => { const t = performance.now(); const out = parseContentRows(rows); return [out, performance.now() - t]; };

test('pathological cells parse in linear time', () => {
  const cases = [
    [' '.repeat(50000), {}],
    [' '.repeat(1000000), {}],
    // The raw cell is cut at maxLength * 4 first, so the "x" past that point is never seen.
    [' '.repeat(50000) + 'x', {}],
    ['   x', { 'dress.code': 'x' }],
    [' '.repeat(100) + 'x', { 'dress.code': 'x' }],
    ['\n '.repeat(500000), {}],
    ['a' + ' '.repeat(50000) + 'b', { 'dress.code': 'a' }],
    ['a' + ' '.repeat(1000000) + 'b', { 'dress.code': 'a' }],
  ];
  for (const [value, expected] of cases) {
    const [out, ms] = timed([row('dress.code', value)]);
    assert.deepEqual(out, expected);
    assert.ok(ms < 100, `took ${ms.toFixed(1)} ms for length ${value.length}`);
  }
});

test('hidden and disguising characters are removed from every field', () => {
  const hidden = ['\x80', '\x9F', '\u00AD', '\u200B', '\u200C', '\u200E', '\u200F', '\u202A', '\u202E', '\u2060', '\u2064', '\u2066', '\u2069', '\uFEFF'];
  for (const ch of hidden) {
    assert.equal(parseContentRows([row('dress.code', `Black${ch}tie`)])['dress.code'], 'Blacktie', JSON.stringify(ch));
    assert.deepEqual(parseContentRows([row('dress.code', ch + ch)]), {}, 'only-hidden ' + JSON.stringify(ch));
  }
});

test('zero-width joiner is preserved so family emoji stay intact', () => {
  const family = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}';
  assert.equal(parseContentRows([row('dress.code', family)])['dress.code'], family);
});

test('url validation: accepted forms', () => {
  const k = 'travel.hotels.0.link';
  assert.equal(parseContentRows([row(k, 'https://example.com/a?b=c')])[k], 'https://example.com/a?b=c');
  assert.equal(parseContentRows([row(k, 'HTTPS://Example.com/Path')])[k], 'https://Example.com/Path');
  assert.equal(parseContentRows([row(k, 'http://example.com')])[k], 'http://example.com');
  assert.equal(parseContentRows([row(k, 'https://\u200Bevil.com')])[k], 'https://evil.com');
  assert.equal(parseContentRows([row(k, 'https://x.com/\u202Egpj.exe')])[k], 'https://x.com/gpj.exe');
});

test('url validation: rejected forms', () => {
  const k = 'travel.hotels.0.link';
  for (const bad of ['https://user:pass@evil.com', 'https://user@evil.com', 'https://\u0430pple.com', 'https://exa mple.com', 'https://x.com/`x`',
    'javascript:alert(1)', '//evil.com', 'https:\\evil.com', 'https://', 'https://x.com/<b>', 'https://x.com/a\u00e9', 'https://' + 'a'.repeat(600)]) {
    assert.deepEqual(parseContentRows([row(k, bad)]), {}, bad);
  }
});

test('truncation never splits a surrogate pair', () => {
  const out = parseContentRows([row('couple.city', 'a'.repeat(59) + '\u{1F600}\u{1F600}')])['couple.city'];
  assert.ok(!/[\ud800-\udfff]/.test(out.replace(/[\ud800-\udbff][\udc00-\udfff]/g, '')));
  assert.equal(out, 'a'.repeat(59) + '\u{1F600}');
});

test('duplicate keys: the first row with a usable value wins', () => {
  assert.deepEqual(parseContentRows([row('dress.code', ''), row('dress.code', 'Second')]), { 'dress.code': 'Second' });
  assert.deepEqual(parseContentRows([row('dress.code', 'First'), row('dress.code', 'Second')]), { 'dress.code': 'First' });
});

test('multiline fields keep line breaks and convert U+2028/2029 to newlines', () => {
  assert.equal(parseContentRows([row('faq.plusOne', 'a\u2028b\u2029c')])['faq.plusOne'], 'a\nb\nc');
});

test('file source: empty file, BOM, and non-scalar values', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'content-'));
  const write = (name, text) => { const p = join(dir, name); writeFileSync(p, text); return p; };
  assert.deepEqual(await createFileContentSource(write('empty.json', '')).load(), {});
  assert.deepEqual(await createFileContentSource(write('ws.json', ' \n ')).load(), {});
  assert.deepEqual(await createFileContentSource(write('bom.json', '\uFEFF{"dress.code":"Bom"}')).load(), { 'dress.code': 'Bom' });
  assert.deepEqual(await createFileContentSource(write('obj.json', '{"dress.code":{"x":1},"dress.note":"ok","faq.plusOne":[1],"faq.children":null}')).load(), { 'dress.note': 'ok' });
});

const UNPAIRED = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

test('a cap that cuts an emoji in half leaves no lone surrogate', () => {
  let out;
  assert.doesNotThrow(() => { out = parseContentRows([row('dress.code', '\u200B'.repeat(319) + '\u{1F600}')]); });
  const value = out['dress.code'];
  assert.equal(value === undefined || !UNPAIRED.test(value), true);
});

test('a lone surrogate from a JSON file source is cleaned', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'content-'));
  const p = join(dir, 'lone.json');
  writeFileSync(p, String.raw`{"dress.code":"Bla\ud83dck tie\ude00"}`); // JSON escapes decode to lone surrogates
  assert.deepEqual(await createFileContentSource(p).load(), { 'dress.code': 'Black tie' });
});

test('a url cell longer than the raw cap is dropped, not cut down to a prefix', () => {
  const longCell = 'https://x.com/pay' + ' '.repeat(2500) + '?to=me';
  assert.deepEqual(parseContentRows([row('travel.hotels.0.link', longCell)]), {});
});

test('a url containing a backslash is rejected', () => {
  assert.deepEqual(parseContentRows([row('travel.hotels.0.link', 'https://evil.com\@x')]), {});
});

test('duplicate keys: an invalid first url does not claim the key', () => {
  assert.deepEqual(
    parseContentRows([row('travel.hotels.0.link', 'javascript:alert(1)'), row('travel.hotels.0.link', 'https://good.com/a')]),
    { 'travel.hotels.0.link': 'https://good.com/a' },
  );
});
