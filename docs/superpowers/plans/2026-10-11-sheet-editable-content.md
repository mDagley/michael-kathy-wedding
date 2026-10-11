# Couple-Editable Site Details (Google Sheet) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Michael and Kathy edit a `Site Details` tab in the existing Google Sheet and the live site shows their changes within about a minute, with an optional announcement banner, and with no way for a bad cell to break the site.

**Architecture:** A single registry of editable fields (`lib/content-fields.js`) drives a server allow-list, a CSV template for the sheet, and drift tests against `site/js/content.js`. A new read-only Netlify function `GET /api/content` reads the tab with the existing service account, validates every value, caches for 60 seconds, and serves stale data on errors. The front end shows the built-in text immediately, fetches `/api/content` with a 1.5 s timeout, merges only values at paths that already exist in the built-in content, and re-renders; if anything fails the built-in text stays.

**Tech Stack:** Same as the main site: plain ES modules, `node:test` + `jsdom`, Netlify Functions (esbuild, ESM), `googleapis`.

**Spec:** `docs/superpowers/specs/2026-10-11-sheet-editable-content-design.md` (approved, includes the announcement banner).

**Conventions**
- Run commands from `C:/Users/panda/claude/Michael & Kathy Wedding` in Git Bash (the folder name contains `&`: always quote it; never use `npx` or `netlify dev`; use `npm run dev` and `npm test`).
- Branch: `feature/sheet-content` (already created). Baseline: 129 tests passing.
- Every commit message ends with a blank line, then `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01HU8oEw5qpP4iS5CAVHzshn`.
- Placeholders in `[BRACKETS]` are real, intended site text until the couple replaces them.

## File structure

```
lib/content-fields.js        registry of editable details (key, section, label, kind, maxLength)
lib/google-client.js         shared service-account Sheets client (extracted from sheet-google.js)
lib/content-sheet.js         parseContentRows + Google/file content sources
lib/content-handler.js       GET /api/content logic: cache, stale-on-error, backoff, rate limit
lib/csv.js                   toCsv() for the sheet template
lib/config.js                (modify) createContentSource(env)
lib/sheet-google.js          (modify) use the shared client
netlify/functions/content.js thin wrapper
site/js/content-merge.js     mergeContent(defaults, values): allow-listed deep merge
site/js/content-live.js      loadLiveContent(): fetch with timeout, returns values or null
site/js/content.js           (modify) add announcement.text = ''
site/js/chrome.js            (modify) idempotent announcement banner
site/js/rsvp.js              (modify) contact may be a function
site/js/main.js              (modify) live content flow
site/css/base.css            (modify) .announcement, .content-pending
scripts/make-content-template.js   writes site-details-template.csv
docs/EDITING.md              plain-English guide for the couple
```

---

### Task 1: Field registry and drift tests

**Files:**
- Create: `lib/content-fields.js`
- Modify: `site/js/content.js` (add `announcement`)
- Test: `test/content-fields.test.js`

- [ ] **Step 1: Write the failing test** `test/content-fields.test.js`:

```js
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
```

- [ ] **Step 2: Run to verify it fails**: `node --test test/content-fields.test.js`. Expected: FAIL (cannot find `lib/content-fields.js`).

- [ ] **Step 3: Add `announcement` to `site/js/content.js`.** Insert as the first key inside `export const content = {`, directly above `couple: {`:

```js
  // Banner shown above the menu on every page. Empty string means no banner.
  announcement: { text: '' },
```

- [ ] **Step 4: Write `lib/content-fields.js`**:

```js
// lib/content-fields.js
// The single source of truth for what the couple may edit from the "Site Details" sheet tab.
// It drives: the server allow-list, the CSV template, and the drift tests against site/js/content.js.
// kind: 'text' (one line), 'multiline' (line breaks allowed), 'url' (must start with http:// or https://).
export const FIELD_KINDS = ['text', 'multiline', 'url'];

const f = (key, section, label, kind = 'text', maxLength = kind === 'multiline' ? 600 : kind === 'url' ? 500 : 200) => ({
  key, section, label, kind, maxLength,
});

export const EDITABLE_FIELDS = [
  f('announcement.text', 'Announcement', 'Announcement banner (leave blank for none)', 'text', 300),

  f('couple.names', 'The wedding', "Couple's names", 'text', 60),
  f('couple.date', 'The wedding', 'Wedding date, short form (does NOT change the countdown)', 'text', 60),
  f('couple.dateLong', 'The wedding', 'Wedding date, long form (does NOT change the countdown)', 'text', 80),
  f('couple.city', 'The wedding', 'City', 'text', 60),
  f('couple.contact', 'The wedding', 'Contact email or phone (shown if the RSVP form has a problem)', 'text', 100),
  f('couple.hashtag', 'The wedding', 'Wedding hashtag (include the #)', 'text', 60),
  f('rsvp.deadline', 'The wedding', 'RSVP deadline', 'text', 60),

  f('events.arrival.time', 'The day', 'Guest arrival time', 'text', 60),
  f('events.arrival.note', 'The day', 'Arrival note', 'multiline'),
  f('events.ceremony.time', 'The day', 'Ceremony start time', 'text', 60),
  f('events.ceremony.details', 'The day', 'Ceremony details', 'multiline'),
  f('events.reception.time', 'The day', 'Reception start time', 'text', 60),
  f('events.reception.details', 'The day', 'Reception details', 'multiline'),
  f('events.extra.time', 'The day', 'Extra event: time (optional)', 'text', 60),
  f('events.extra.title', 'The day', 'Extra event: title (optional)', 'text', 80),
  f('events.extra.details', 'The day', 'Extra event: details (optional)', 'multiline'),

  f('dress.code', 'Dress code', 'Dress code', 'text', 80),
  f('dress.note', 'Dress code', 'Dress code note', 'multiline'),

  f('travel.hotels.0.name', 'Travel: hotel 1', 'Hotel 1: name', 'text', 100),
  f('travel.hotels.0.address', 'Travel: hotel 1', 'Hotel 1: address', 'text', 200),
  f('travel.hotels.0.code', 'Travel: hotel 1', 'Hotel 1: group discount code', 'text', 60),
  f('travel.hotels.0.bookBy', 'Travel: hotel 1', 'Hotel 1: book by date', 'text', 60),
  f('travel.hotels.0.link', 'Travel: hotel 1', 'Hotel 1: booking link (must start with https://)', 'url'),
  f('travel.hotels.1.name', 'Travel: hotel 2', 'Hotel 2: name', 'text', 100),
  f('travel.hotels.1.address', 'Travel: hotel 2', 'Hotel 2: address', 'text', 200),
  f('travel.hotels.1.code', 'Travel: hotel 2', 'Hotel 2: group discount code', 'text', 60),
  f('travel.hotels.1.bookBy', 'Travel: hotel 2', 'Hotel 2: book by date', 'text', 60),
  f('travel.hotels.1.link', 'Travel: hotel 2', 'Hotel 2: booking link (must start with https://)', 'url'),
  f('travel.airports', 'Travel: getting here', 'Airports', 'multiline'),
  f('travel.rideshare', 'Travel: getting here', 'Rideshare', 'multiline'),
  f('travel.parking', 'Travel: getting here', 'Parking', 'multiline'),
  f('travel.shuttle', 'Travel: getting here', 'Shuttle', 'multiline'),

  f('registry.message', 'Registry', 'Registry message', 'multiline'),
  f('registry.items.0.name', 'Registry', 'Registry 1: name', 'text', 100),
  f('registry.items.0.description', 'Registry', 'Registry 1: short description', 'multiline'),
  f('registry.items.0.link', 'Registry', 'Registry 1: link (must start with https://)', 'url'),
  f('registry.items.1.name', 'Registry', 'Registry 2: name', 'text', 100),
  f('registry.items.1.description', 'Registry', 'Registry 2: short description', 'multiline'),
  f('registry.items.1.link', 'Registry', 'Registry 2: link (must start with https://)', 'url'),

  f('faq.plusOne', 'FAQ', 'FAQ answer: Can I bring a plus-one?', 'multiline'),
  f('faq.children', 'FAQ', 'FAQ answer: Are children welcome?', 'multiline'),
  f('faq.parking', 'FAQ', 'FAQ answer: Where do I park?', 'multiline'),
  f('faq.dietary', 'FAQ', 'FAQ answer: What about dietary restrictions?', 'multiline'),

  f('story.howWeMet', 'Our story', 'How we met', 'multiline', 4000),
  f('story.proposal', 'Our story', 'The proposal', 'multiline', 4000),
];

const BY_KEY = new Map(EDITABLE_FIELDS.map((field) => [field.key, field]));

export function getField(key) {
  return BY_KEY.get(key);
}
```

- [ ] **Step 5: Run to verify it passes**: `node --test test/content-fields.test.js`. Expected: PASS, 9 tests. Then `npm test`: all pass (the page-integrity test is unaffected because no HTML changed).

- [ ] **Step 6: Commit**:
```bash
git add lib/content-fields.js site/js/content.js test/content-fields.test.js
git commit -m "feat: registry of couple-editable fields with drift tests, and announcement default"
```

---

### Task 2: Content parsing and sources

**Files:**
- Create: `lib/google-client.js`, `lib/content-sheet.js`
- Modify: `lib/sheet-google.js`, `lib/config.js`
- Test: `test/content-sheet.test.js`, `test/google-client.test.js`

- [ ] **Step 1: Write the failing tests.**

`test/google-client.test.js`:
```js
// test/google-client.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSheetsClient, normalizePrivateKey } from '../lib/google-client.js';
import * as sheetGoogle from '../lib/sheet-google.js';

test('createSheetsClient requires credentials with a clear message', () => {
  assert.throws(() => createSheetsClient({ clientEmail: '', privateKey: 'k' }), /GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY/);
  assert.throws(() => createSheetsClient({ clientEmail: 'a@b.c', privateKey: '' }), /GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY/);
});

test('createSheetsClient returns a Sheets client without calling the network', () => {
  const client = createSheetsClient({ clientEmail: 'svc@example.iam.gserviceaccount.com', privateKey: 'not-a-real-key' });
  assert.equal(typeof client.spreadsheets.values.get, 'function');
});

test('normalizePrivateKey still turns literal \\n into newlines and sheet-google re-exports it', () => {
  assert.equal(normalizePrivateKey('a\\nb'), 'a\nb');
  assert.equal(sheetGoogle.normalizePrivateKey('a\\nb'), 'a\nb');
});
```

`test/content-sheet.test.js`:
```js
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
```

- [ ] **Step 2: Run to verify they fail**: `node --test test/content-sheet.test.js test/google-client.test.js`. Expected: FAIL (modules not found).

- [ ] **Step 3: Write `lib/google-client.js`**:

```js
// lib/google-client.js
import { google } from 'googleapis';

export const normalizePrivateKey = (key) => String(key ?? '').replace(/\\n/g, '\n');

// One place that builds the service-account Sheets client (used by RSVP storage and the content reader).
export function createSheetsClient({ clientEmail, privateKey }) {
  if (!clientEmail || !privateKey) {
    throw new Error('GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY are required when GOOGLE_SHEET_ID is set.');
  }
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: normalizePrivateKey(privateKey),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}
```

- [ ] **Step 4: Modify `lib/sheet-google.js`** to use it. Replace the import line and the client-creation block so the top of the file reads:

```js
// lib/sheet-google.js
import { createSheetsClient, normalizePrivateKey } from './google-client.js';

export { normalizePrivateKey };
export const COLUMNS = ['timestamp', 'name', 'email', 'attending', 'dietary', 'notes'];
const TAB = 'RSVPs';

export const toRow = (record) => COLUMNS.map((c) => record[c] ?? '');
export const fromRow = (row) => Object.fromEntries(COLUMNS.map((c, i) => [c, row[i] ?? '']));

// Sheet layout: a tab named "RSVPs" with header row A1:F1 = Timestamp, Name, Email, Attending, Dietary, Notes.
// Values are written RAW so a guest typing "=SUM(...)" is stored as plain text, not a formula.
export function createGoogleSheet({ sheetId, clientEmail, privateKey, sheetsClient }) {
  const sheets = sheetsClient ?? createSheetsClient({ clientEmail, privateKey });
```

Keep everything from `return {` (the `findByEmail`, `append`, `update` methods) exactly as it is now. Delete the old `import { google } from 'googleapis';`, the old `normalizePrivateKey` definition, and the old `let sheets = sheetsClient; if (!sheets) {...}` block.

- [ ] **Step 5: Write `lib/content-sheet.js`**:

```js
// lib/content-sheet.js
import { promises as fs } from 'node:fs';
import { EDITABLE_FIELDS } from './content-fields.js';

const FIELD_BY_KEY = new Map(EDITABLE_FIELDS.map((field) => [field.key, field]));
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
const URL_OK = /^https?:\/\/[^\s<>"']+$/i;

// rows: arrays of cells [Section, What it is, Value, key]. Returns { key: value } for allow-listed,
// valid, non-blank values only. Everything else is dropped so the built-in default stays in place.
export function parseContentRows(rows) {
  const values = {};
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!Array.isArray(row)) continue;
    const key = String(row[3] ?? '').trim();
    const field = FIELD_BY_KEY.get(key);
    if (!field || Object.hasOwn(values, key)) continue;

    let value = String(row[2] ?? '').replace(CONTROL_CHARS, '').trim();
    if (!value) continue;

    if (field.kind === 'url') {
      if (value.length > field.maxLength || !URL_OK.test(value)) continue;
    } else {
      if (field.kind === 'text') value = value.replace(/\s*[\r\n]+\s*/g, ' ');
      if (value.length > field.maxLength) value = value.slice(0, field.maxLength).trimEnd();
    }
    values[key] = value;
  }
  return values;
}

// Reads the "Site Details" tab: header in row 1, data from row 2, columns A to D.
export function createGoogleContentSource({ sheetId, tab = 'Site Details', sheetsClient }) {
  const range = `'${String(tab).replace(/'/g, "''")}'!A2:D`;
  return {
    async load() {
      const res = await sheetsClient.spreadsheets.values.get({ spreadsheetId: sheetId, range });
      return parseContentRows(res.data.values || []);
    },
  };
}

// Local development: a flat JSON map { "dress.code": "Black tie" }, validated like the real sheet.
export function createFileContentSource(path) {
  return {
    async load() {
      let map;
      try {
        map = JSON.parse(await fs.readFile(path, 'utf8'));
      } catch (e) {
        if (e.code === 'ENOENT') return {};
        throw e;
      }
      return parseContentRows(Object.entries(map ?? {}).map(([key, value]) => ['', '', value, key]));
    },
  };
}
```

- [ ] **Step 6: Modify `lib/config.js`.** Add the imports at the top and the new function at the bottom:

```js
import { createSheetsClient } from './google-client.js';
import { createGoogleContentSource, createFileContentSource } from './content-sheet.js';
```
```js
export function createContentSource(env) {
  if (env.GOOGLE_SHEET_ID) {
    return createGoogleContentSource({
      sheetId: env.GOOGLE_SHEET_ID,
      tab: env.CONTENT_TAB || 'Site Details',
      sheetsClient: createSheetsClient({ clientEmail: env.GOOGLE_CLIENT_EMAIL, privateKey: env.GOOGLE_PRIVATE_KEY }),
    });
  }
  // Same rule as RSVP storage: never silently serve a local file in production.
  if (env.CONTEXT === 'production') throw new Error('GOOGLE_SHEET_ID is not set in production.');
  return createFileContentSource(env.DEV_CONTENT_PATH || '.dev-content.json');
}
```
(Leave the existing imports, `loadVenue`, and `createSheet` untouched.)

- [ ] **Step 7: Run to verify**: `node --test test/content-sheet.test.js test/google-client.test.js`. Expected: PASS. Then `npm test`: ALL pass (the existing `sheet-google` and `config` tests must still pass unchanged; if one fails, fix the refactor, not the test).

- [ ] **Step 8: Commit**:
```bash
git add lib/google-client.js lib/content-sheet.js lib/sheet-google.js lib/config.js test/content-sheet.test.js test/google-client.test.js
git commit -m "feat: validated content parsing and Google/file content sources, shared Sheets client"
```

---

### Task 3: The `/api/content` function

**Files:**
- Create: `lib/content-handler.js`, `netlify/functions/content.js`
- Test: `test/content-handler.test.js`

- [ ] **Step 1: Write the failing test** `test/content-handler.test.js`:

```js
// test/content-handler.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createContentFunction, FRESH_MS, STALE_MS, RETRY_MS } from '../lib/content-handler.js';
import { createLimiter } from '../lib/limiter.js';

const get = (ip = '1.2.3.4') => ({ httpMethod: 'GET', headers: { 'x-nf-client-connection-ip': ip } });

function build({ load, startAt = 1_000_000, limiter } = {}) {
  let t = startAt;
  const calls = { load: 0 };
  const source = { load: async () => { calls.load += 1; return load(calls.load); } };
  const handler = createContentFunction({
    source,
    now: () => t,
    limiter: limiter || createLimiter({ max: 1000, windowMs: 1000 }),
  });
  return { handler, calls, advance: (ms) => { t += ms; } };
}

test('only GET is allowed', async () => {
  const { handler } = build({ load: () => ({}) });
  const res = await handler({ httpMethod: 'POST', headers: {}, body: '{}' });
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, 'GET');
});

test('returns the values as JSON with a 60 second public cache header', async () => {
  const { handler } = build({ load: () => ({ 'dress.code': 'Black tie' }) });
  const res = await handler(get());
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), { ok: true, values: { 'dress.code': 'Black tie' } });
  assert.equal(res.headers['Cache-Control'], 'public, max-age=60');
  assert.equal(res.headers['Content-Type'], 'application/json');
});

test('values are cached in memory for 60 seconds, then refreshed', async () => {
  const { handler, calls, advance } = build({ load: (n) => ({ 'dress.code': `v${n}` }) });
  await handler(get());
  advance(FRESH_MS - 1);
  assert.equal(JSON.parse((await handler(get())).body).values['dress.code'], 'v1');
  assert.equal(calls.load, 1);
  advance(2);
  assert.equal(JSON.parse((await handler(get())).body).values['dress.code'], 'v2');
  assert.equal(calls.load, 2);
});

test('concurrent requests share one sheet read', async () => {
  const { handler, calls } = build({ load: async () => { await new Promise((r) => setTimeout(r, 20)); return { a: 'b' }; } });
  await Promise.all([handler(get()), handler(get()), handler(get())]);
  assert.equal(calls.load, 1);
});

test('when the sheet fails, recent data is served instead (stale on error)', async () => {
  const { handler, advance } = build({ load: (n) => { if (n === 1) return { 'dress.code': 'Black tie' }; throw new Error('quota'); } });
  await handler(get());
  advance(FRESH_MS + 1);
  const res = await handler(get());
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).values['dress.code'], 'Black tie');
});

test('stale data is not served forever', async () => {
  const { handler, advance } = build({ load: (n) => { if (n === 1) return { x: 'y' }; throw new Error('down'); } });
  await handler(get());
  advance(STALE_MS + RETRY_MS + 1);
  assert.equal((await handler(get())).statusCode, 503);
});

test('with no data and a failing sheet the answer is a generic 503 with no details', async () => {
  const origError = console.error;
  const logged = [];
  console.error = (...a) => logged.push(a.join(' '));
  try {
    const { handler } = build({ load: () => { const e = new Error('Unable to parse range: secret-tab'); e.config = { data: 'guest@example.com' }; throw e; } });
    const res = await handler(get());
    assert.equal(res.statusCode, 503);
    assert.deepEqual(JSON.parse(res.body), { ok: false, error: 'Content is temporarily unavailable.' });
    assert.equal(res.headers['Cache-Control'], 'no-store');
    assert.equal(res.body.includes('secret-tab'), false);
    assert.equal(logged.length, 1);
    assert.equal(logged[0].includes('guest@example.com'), false);
  } finally {
    console.error = origError;
  }
});

test('after a failure the sheet is not hammered: retries wait RETRY_MS', async () => {
  const origError = console.error;
  console.error = () => {};
  try {
    const { handler, calls, advance } = build({ load: () => { throw new Error('down'); } });
    await handler(get());
    await handler(get());
    await handler(get());
    assert.equal(calls.load, 1);
    advance(RETRY_MS + 1);
    await handler(get());
    assert.equal(calls.load, 2);
  } finally {
    console.error = origError;
  }
});

test('a source that cannot be created (bad config) is retried later, not cached as broken', async () => {
  const origError = console.error;
  console.error = () => {};
  try {
    let attempts = 0;
    let t = 1_000_000;
    const handler = createContentFunction({
      createSource: () => {
        attempts += 1;
        if (attempts === 1) throw new Error('GOOGLE_SHEET_ID is not set in production.');
        return { load: async () => ({ 'dress.code': 'Black tie' }) };
      },
      now: () => t,
      limiter: createLimiter({ max: 1000, windowMs: 1000 }),
    });
    assert.equal((await handler(get())).statusCode, 503);
    t += RETRY_MS + 1;
    const res = await handler(get());
    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body).values, { 'dress.code': 'Black tie' });
    assert.equal(attempts, 2);
  } finally {
    console.error = origError;
  }
});

test('requests are rate limited per client IP', async () => {
  const { handler } = build({ load: () => ({}), limiter: createLimiter({ max: 2, windowMs: 60_000 }) });
  assert.equal((await handler(get('9.9.9.9'))).statusCode, 200);
  assert.equal((await handler(get('9.9.9.9'))).statusCode, 200);
  assert.equal((await handler(get('9.9.9.9'))).statusCode, 429);
  assert.equal((await handler(get('8.8.8.8'))).statusCode, 200);
});
```

- [ ] **Step 2: Run to verify it fails**: `node --test test/content-handler.test.js`. Expected: FAIL (module not found).

- [ ] **Step 3: Write `lib/content-handler.js`**:

```js
// lib/content-handler.js
import { clientIp, jsonResponse } from './http.js';
import { createLimiter } from './limiter.js';
import { createContentSource } from './config.js';

export const FRESH_MS = 60 * 1000; // serve from memory this long
export const STALE_MS = 10 * 60 * 1000; // if the sheet is failing, keep serving data up to this old
export const RETRY_MS = 10 * 1000; // after a failure, wait this long before asking the sheet again

// deps (all optional, for tests): source, createSource, now, limiter.
export function createContentFunction(deps = {}) {
  const limiter = deps.limiter || createLimiter({ max: 120, windowMs: 10 * 60 * 1000 });
  const now = deps.now || Date.now;
  const makeSource = deps.createSource || (() => createContentSource(process.env));
  let source = deps.source || null;
  let cache = null; // { values, at }
  let inflight = null;
  let failure = null; // { at, err }

  function refresh() {
    if (!inflight) {
      inflight = (async () => {
        source = source || makeSource(); // if this throws, source stays null and the next attempt retries it
        const values = await source.load();
        cache = { values, at: now() };
        return values;
      })().finally(() => { inflight = null; });
    }
    return inflight;
  }

  async function getValues() {
    if (cache && now() - cache.at < FRESH_MS) return cache.values;
    if (!(failure && now() - failure.at < RETRY_MS)) {
      try {
        const values = await refresh();
        failure = null;
        return values;
      } catch (err) {
        failure = { at: now(), err };
      }
    }
    if (cache && now() - cache.at < STALE_MS) return cache.values;
    throw failure.err;
  }

  return async function handler(event) {
    if (event.httpMethod !== 'GET') {
      const res = jsonResponse(405, { ok: false, error: 'Method not allowed.' });
      res.headers.Allow = 'GET';
      return res;
    }
    if (!limiter.allow(clientIp(event))) {
      return jsonResponse(429, { ok: false, error: 'Too many requests. Please wait a few minutes and try again.' });
    }
    try {
      const values = await getValues();
      const res = jsonResponse(200, { ok: true, values });
      res.headers['Cache-Control'] = 'public, max-age=60';
      return res;
    } catch (err) {
      // Log only code + message: Google errors can carry request details.
      console.error(`[content] unexpected error: ${err?.code ?? 'no-code'} ${err?.message ?? String(err)}`);
      return jsonResponse(503, { ok: false, error: 'Content is temporarily unavailable.' });
    }
  };
}
```

- [ ] **Step 4: Write `netlify/functions/content.js`**:

```js
// netlify/functions/content.js
import { createContentFunction } from '../../lib/content-handler.js';

export const handler = createContentFunction();
```

- [ ] **Step 5: Run `node --test test/content-handler.test.js` (PASS) and verify the wrapper loads:**

```bash
node --input-type=module -e "
const m = await import('./netlify/functions/content.js');
console.log(typeof m.handler);
const res = await m.handler({ httpMethod: 'POST', headers: {}, body: '' });
console.log(res.statusCode, res.headers.Allow);
"
```
Expected: `function`, then `405 GET`.

- [ ] **Step 6: Run the full suite** (`npm test`; all pass) and commit:
```bash
git add lib/content-handler.js netlify/functions/content.js test/content-handler.test.js
git commit -m "feat: /api/content with memory cache, stale-on-error, retry backoff, and rate limiting"
```

---

### Task 4: Front-end merge, live loader, and contact getter

**Files:**
- Create: `site/js/content-merge.js`, `site/js/content-live.js`
- Modify: `site/js/rsvp.js`
- Test: `test/content-merge.test.js`, `test/content-live.test.js`, and an addition to `test/rsvp-ui.test.js`

- [ ] **Step 1: Write the failing tests.**

`test/content-merge.test.js`:
```js
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
  mergeContent(defaults, { __proto__: 'x', 'a.__proto__.polluted': 'x', 'constructor.prototype.polluted': 'x', 'a.constructor': 'x' });
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
```

`test/content-live.test.js`:
```js
// test/content-live.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadLiveContent } from '../site/js/content-live.js';

const respond = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test('returns the values map on success and requests /api/content', async () => {
  let seen;
  const fetchFn = async (url) => { seen = url; return respond(200, { ok: true, values: { 'dress.code': 'Black tie' } }); };
  assert.deepEqual(await loadLiveContent({ fetchFn }), { 'dress.code': 'Black tie' });
  assert.equal(seen, '/api/content');
});

test('returns null for HTTP errors, malformed bodies, or ok:false', async () => {
  assert.equal(await loadLiveContent({ fetchFn: async () => respond(503, { ok: false }) }), null);
  assert.equal(await loadLiveContent({ fetchFn: async () => respond(200, { ok: false }) }), null);
  assert.equal(await loadLiveContent({ fetchFn: async () => respond(200, { ok: true, values: 'x' }) }), null);
  assert.equal(await loadLiveContent({ fetchFn: async () => respond(200, null) }), null);
});

test('returns null when fetch throws or the body is not JSON', async () => {
  assert.equal(await loadLiveContent({ fetchFn: async () => { throw new Error('offline'); } }), null);
  assert.equal(await loadLiveContent({ fetchFn: async () => ({ ok: true, json: async () => { throw new Error('bad json'); } }) }), null);
});

test('gives up after the timeout and aborts the request', async () => {
  let aborted = false;
  const fetchFn = (url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); });
  });
  const started = Date.now();
  assert.equal(await loadLiveContent({ fetchFn, timeoutMs: 30 }), null);
  assert.ok(Date.now() - started < 500);
  assert.equal(aborted, true);
});
```

Add to `test/rsvp-ui.test.js` (append this test at the end; it reuses that file's existing `rsvpHtml`, `memStore`, `flush`, `submit` helpers):
```js
test('the contact text may be a function, so live content changes show in the fallback message', async () => {
  const { document } = new JSDOM(rsvpHtml).window;
  let contact = 'old@example.com';
  const fetchFn = async () => { throw new Error('offline'); };
  initRsvpForm(document, { fetchFn, store: memStore(), contact: () => contact });
  contact = 'new@example.com';
  submit(document);
  await flush();
  assert.match(document.getElementById('rsvp-error').textContent, /new@example\.com/);
});
```

- [ ] **Step 2: Run to verify they fail**: `node --test test/content-merge.test.js test/content-live.test.js test/rsvp-ui.test.js`. Expected: the merge/live tests FAIL (modules missing) and the new rsvp test FAILS.

- [ ] **Step 3: Write `site/js/content-merge.js`**:

```js
// site/js/content-merge.js
// Applies sheet values on top of the built-in content. Only strings at paths that ALREADY exist
// as strings in the defaults can change, so the sheet cannot add structure, scripts, or links the
// developer did not put there. nav and credits are developer-owned.
const DEV_OWNED = new Set(['nav', 'credits']);
const MAX_LEN = 4000;

export function mergeContent(defaults, values) {
  const merged = structuredClone(defaults);
  if (values === null || typeof values !== 'object' || Array.isArray(values)) return merged;

  for (const [path, value] of Object.entries(values)) {
    if (typeof value !== 'string' || value.length > MAX_LEN) continue;
    const parts = path.split('.');
    if (DEV_OWNED.has(parts[0])) continue;

    let parent = merged;
    for (let i = 0; i < parts.length - 1 && parent !== undefined; i += 1) {
      const next = parent !== null && typeof parent === 'object' && Object.hasOwn(parent, parts[i]) ? parent[parts[i]] : undefined;
      parent = next;
    }
    const last = parts[parts.length - 1];
    if (parent !== null && typeof parent === 'object' && Object.hasOwn(parent, last) && typeof parent[last] === 'string') {
      parent[last] = value;
    }
  }
  return merged;
}
```

- [ ] **Step 4: Write `site/js/content-live.js`**:

```js
// site/js/content-live.js
// Fetches the couple's edits. Resolves to a { key: value } map, or null on ANY problem
// (offline, slow, error status, bad JSON), in which case the built-in text simply stays.
export async function loadLiveContent({ fetchFn, timeoutMs = 1500, url = '/api/content' }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.ok === true && data.values && typeof data.values === 'object' && !Array.isArray(data.values)
      ? data.values
      : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 5: Modify `site/js/rsvp.js`.** In `initRsvpForm`'s `catch` block, replace the line that builds the error message so it reads the contact lazily:

```js
    } catch {
      const contactText = typeof contact === 'function' ? contact() : contact;
      errorBox.textContent = `We couldn't send your RSVP right now. Please try again, or contact us at ${contactText}.`;
      errorBox.hidden = false;
      button.disabled = false;
    }
```
(Everything else in `rsvp.js` stays as is.)

- [ ] **Step 6: Run to verify**: `node --test test/content-merge.test.js test/content-live.test.js test/rsvp-ui.test.js` (PASS), then `npm test` (all pass).

- [ ] **Step 7: Commit**:
```bash
git add site/js/content-merge.js site/js/content-live.js site/js/rsvp.js test/content-merge.test.js test/content-live.test.js test/rsvp-ui.test.js
git commit -m "feat: allow-listed content merge, live content loader with timeout, lazy contact text"
```

---

### Task 5: Announcement banner

**Files:**
- Modify: `site/js/chrome.js`, `site/css/base.css`
- Test: `test/chrome.test.js` (append)

- [ ] **Step 1: Append the failing tests to `test/chrome.test.js`** (the file already imports `JSDOM`, `renderChrome`, and `content`; the helper `setup()` returns a `document` with `#site-nav` and `#site-footer`):

```js
const withBanner = (text) => ({ ...content, announcement: { text } });

test('no announcement banner when the text is empty', () => {
  const doc = setup();
  renderChrome(doc, content, 'home');
  assert.equal(doc.querySelector('.announcement'), null);
});

test('a banner renders above the nav with the exact text and an accessible role', () => {
  const doc = setup();
  renderChrome(doc, withBanner('Parking lot B is closed.'), 'home');
  const bar = doc.querySelector('.announcement');
  assert.equal(bar.textContent, 'Parking lot B is closed.');
  assert.equal(bar.getAttribute('role'), 'region');
  assert.equal(bar.getAttribute('aria-label'), 'Announcement');
  assert.equal(doc.body.firstElementChild, bar);
});

test('markup in the banner text is shown literally (no HTML injection)', () => {
  const doc = setup();
  renderChrome(doc, withBanner('<img src=x onerror=alert(1)> <b>bold</b>'), 'home');
  const bar = doc.querySelector('.announcement');
  assert.equal(bar.querySelector('img, b, script'), null);
  assert.equal(bar.textContent, '<img src=x onerror=alert(1)> <b>bold</b>');
});

test('rendering twice never duplicates the banner and updates its text', () => {
  const doc = setup();
  renderChrome(doc, withBanner('First'), 'home');
  renderChrome(doc, withBanner('Second'), 'home');
  const bars = doc.querySelectorAll('.announcement');
  assert.equal(bars.length, 1);
  assert.equal(bars[0].textContent, 'Second');
});

test('clearing the text removes the banner', () => {
  const doc = setup();
  renderChrome(doc, withBanner('Temporary'), 'home');
  renderChrome(doc, withBanner('   '), 'home');
  assert.equal(doc.querySelector('.announcement'), null);
});

test('content without an announcement key does not break rendering', () => {
  const doc = setup();
  const { announcement, ...rest } = content;
  assert.doesNotThrow(() => renderChrome(doc, rest, 'home'));
  assert.equal(doc.querySelector('.announcement'), null);
});
```

- [ ] **Step 2: Run to verify they fail**: `node --test test/chrome.test.js`. Expected: the new banner tests FAIL.

- [ ] **Step 3: Modify `site/js/chrome.js`.** Add this function above `renderChrome`:

```js
function renderAnnouncement(doc, content) {
  const text = String(content.announcement?.text ?? '').trim();
  const existing = doc.querySelector('.announcement');
  if (!text) {
    existing?.remove();
    return;
  }
  const bar = existing || el(doc, 'div', { class: 'announcement', role: 'region', 'aria-label': 'Announcement' });
  bar.textContent = text;
  if (!existing) doc.body.prepend(bar);
}
```
and call it as the first statement inside `renderChrome`:

```js
export function renderChrome(doc, content, currentPage) {
  renderAnnouncement(doc, content);
  const navHost = doc.getElementById('site-nav');
  ...
```
(Leave the rest of `renderChrome` unchanged.)

- [ ] **Step 4: Add the banner styles to `site/css/base.css`**, just above the `/* footer and switcher */` comment:

```css
/* announcement banner (text comes from the couple's sheet; empty means no banner) */
.announcement { background: var(--band); color: var(--band-text); text-align: center; padding: 10px 20px; font-size: 14px; letter-spacing: 1px; line-height: 1.4; border-bottom: 1px solid var(--band-line); overflow-wrap: anywhere; }
```

- [ ] **Step 5: Run to verify**: `node --test test/chrome.test.js` (PASS) and `npm test` (all pass).

- [ ] **Step 6: Commit**:
```bash
git add site/js/chrome.js site/css/base.css test/chrome.test.js
git commit -m "feat: idempotent announcement banner above the menu"
```

---

### Task 6: Wire live content into `main.js`

**Files:**
- Modify: `site/js/main.js`, `site/css/base.css`

`main.js` is browser glue and is verified in the browser task; here, check syntax and imports.

- [ ] **Step 1: Replace `site/js/main.js` entirely with:**

```js
// site/js/main.js
import { content } from './content.js';
import { applyContent } from './render.js';
import { renderChrome } from './chrome.js';
import { initTheme } from './theme-switcher.js';
import { startCountdown } from './countdown.js';
import { createVenueStore } from './venue-store.js';
import { showVenue } from './venue-ui.js';
import { initRsvpForm, initLookup } from './rsvp.js';
import { mergeContent } from './content-merge.js';
import { loadLiveContent } from './content-live.js';

function safeStorage() {
  try { return window.localStorage; } catch { return { getItem: () => null, setItem() {}, removeItem() {} }; }
}

function boot() {
  const page = document.body.dataset.page;
  const root = document.documentElement;
  initTheme(window);

  // Show the built-in text right away (hidden by CSS until the couple's edits arrive or 1.5 s pass,
  // so guests never see a flash of "[TBD]" replaced by the real text).
  let current = content;
  root.classList.add('content-pending');
  const paint = () => {
    renderChrome(document, current, page);
    applyContent(document, current);
  };
  paint();

  const countdown = document.querySelector('[data-countdown]');
  if (countdown) startCountdown(countdown);

  const store = createVenueStore(safeStorage());
  showVenue(document, store.get());

  const fetchFn = (...args) => window.fetch(...args);
  initRsvpForm(document, { fetchFn, store, contact: () => current.couple.contact });
  initLookup(document, { fetchFn, store });

  // The couple's edits from the Google Sheet. Any failure leaves the built-in text in place.
  loadLiveContent({ fetchFn })
    .then((values) => {
      if (values) {
        current = mergeContent(content, values);
        paint();
      }
    })
    .catch(() => {})
    .finally(() => root.classList.remove('content-pending'));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
```

- [ ] **Step 2: Add the pending style to `site/css/base.css`**, directly under the `.announcement` rule from Task 5:

```css
/* Hide text until live content arrives; the animation reveals it after 2.5 s even if scripts fail. */
@keyframes content-reveal { to { visibility: visible; } }
.content-pending [data-c] { visibility: hidden; animation: content-reveal 0s linear 2.5s forwards; }
```

- [ ] **Step 3: Verify syntax and imports** (read-only):
```bash
node --check site/js/main.js
node --input-type=module -e "
import './site/js/content-merge.js';
import './site/js/content-live.js';
const m = await import('./site/js/content-merge.js');
const l = await import('./site/js/content-live.js');
console.log(typeof m.mergeContent, typeof l.loadLiveContent);
"
```
Expected: no output from `--check`, then `function function`.

- [ ] **Step 4: Run the full suite** (`npm test`; all pass) and commit:
```bash
git add site/js/main.js site/css/base.css
git commit -m "feat: show the couple's live edits with a 1.5 s timeout and built-in fallback"
```

---

### Task 7: Sheet template, editing guide, and docs

**Files:**
- Create: `lib/csv.js`, `scripts/make-content-template.js`, `docs/EDITING.md`
- Modify: `package.json`, `.gitignore`, `.env.example`, `README.md`
- Test: `test/csv.test.js`, `test/content-template.test.js`

- [ ] **Step 1: Write the failing tests.**

`test/csv.test.js`:
```js
// test/csv.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { toCsv } from '../lib/csv.js';

// A small RFC 4180 parser used only to prove round-tripping.
function parse(text) {
  const rows = []; let row = []; let cell = ''; let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i += 1; } else if (c === '"') quoted = false; else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

test('plain cells are not quoted', () => {
  assert.equal(toCsv([['a', 'b'], ['c', 'd']]), 'a,b\nc,d\n');
});

test('cells with commas, quotes, or line breaks are quoted and round-trip exactly', () => {
  const rows = [['a, b', 'say "hi"', 'line1\nline2', '', "O'Hare & Midway"]];
  assert.deepEqual(parse(toCsv(rows)), rows);
});

test('non-string cells become text', () => {
  assert.equal(toCsv([[1, null, undefined, true]]), '1,,,true\n');
});
```

`test/content-template.test.js`:
```js
// test/content-template.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTemplateRows } from '../scripts/make-content-template.js';
import { EDITABLE_FIELDS } from '../lib/content-fields.js';
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

test('the announcement row is blank by default and labelled as optional', () => {
  const row = buildTemplateRows().find((r) => r[3] === 'announcement.text');
  assert.equal(row[2], '');
  assert.match(row[1], /leave blank/i);
});

test('every row has exactly four cells', () => {
  for (const r of buildTemplateRows()) assert.equal(r.length, 4);
});
```

- [ ] **Step 2: Run to verify they fail**: `node --test test/csv.test.js test/content-template.test.js`. Expected: FAIL (modules missing).

- [ ] **Step 3: Write `lib/csv.js`**:

```js
// lib/csv.js
const needsQuotes = /[",\r\n]/;

const cell = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return needsQuotes.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function toCsv(rows) {
  return rows.map((row) => row.map(cell).join(',')).join('\n') + '\n';
}
```

- [ ] **Step 4: Write `scripts/make-content-template.js`**:

```js
// scripts/make-content-template.js
// Writes site-details-template.csv: import it into a new "Site Details" tab of the RSVP spreadsheet.
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { content } from '../site/js/content.js';
import { getPath } from '../site/js/render.js';
import { EDITABLE_FIELDS } from '../lib/content-fields.js';
import { toCsv } from '../lib/csv.js';

export function buildTemplateRows() {
  return [
    ['Section', 'What it is', 'Value (edit this column)', 'key (do not edit)'],
    ...EDITABLE_FIELDS.map((f) => [f.section, f.label, String(getPath(content, f.key) ?? ''), f.key]),
  ];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = 'site-details-template.csv';
  writeFileSync(out, toCsv(buildTemplateRows()), 'utf8');
  console.log(`Wrote ${out} (${EDITABLE_FIELDS.length} details). Import it into a new tab named "Site Details".`);
}
```

- [ ] **Step 5: Add the script to `package.json`** inside `"scripts"`:
```json
    "content-template": "node scripts/make-content-template.js",
```
(Keep the existing `test` and `dev` scripts.)

- [ ] **Step 6: Update `.gitignore`** by appending these lines:
```
.dev-content.json
/site-details-template.csv
```
and **`.env.example`** by appending:
```
# Optional: name of the sheet tab the couple edits (default: Site Details).
CONTENT_TAB=Site Details
# Local development only: a flat JSON map of edits, for example {"dress.code":"Black tie"} (git-ignored).
DEV_CONTENT_PATH=.dev-content.json
```

- [ ] **Step 7: Write `docs/EDITING.md`** (the plain-English guide for the couple; write it exactly like this):

````markdown
# Changing your wedding website

You can change most of the words on the site yourselves, any time, from your phone or computer. No special tools needed.

## How to do it

1. Open your **Wedding RSVPs** Google Sheet.
2. Click the **Site Details** tab at the bottom.
3. Find the row for the thing you want to change. The **What it is** column says what it is (for example "Ceremony start time").
4. Click the cell in the **Value (edit this column)** column and type your change. Press Enter.
5. Wait a minute or two, then refresh the website. Your change is live.

Please only edit the **Value** column. Leave the other columns alone.

## Good to know

- **Blank cell?** The website shows its placeholder (like "[CEREMONY TIME TBD]"). It never shows an empty gap.
- **Links** (hotel booking, registry) must start with `https://`. If one doesn't, the site ignores it and keeps the old one.
- **Announcement banner:** type a short message in the first row (up to 300 characters) to show a bar across the top of every page, for example "Parking lot B is closed, please use the garage." Delete the text to remove it.
- **Long answers** (our story, FAQ) can have line breaks. Press Ctrl+Enter (Windows) or Cmd+Enter (Mac) inside the cell to start a new line.
- **Length limits:** each detail has a maximum length; anything longer is cut off. A short answer is easier to read anyway.
- **Made a mistake?** Press Ctrl+Z to undo, or clear the cell to go back to the placeholder. You can't break the website from this sheet.

## What you can't change here

Ask your website helper for these:

- The **countdown date** (changing the date text in the sheet does not change the countdown)
- **Photos** and the order of things on a page
- **Colors and fonts**
- The **venue address** (it is kept private and only shown to guests who RSVP yes)
- The small photo credits at the bottom of each page
````

- [ ] **Step 8: Update `README.md`.** Add this new section directly above the `## The hidden venue` heading:

````markdown
## Letting the couple edit the details (Google Sheet)

The couple edit a **Site Details** tab in the same spreadsheet that holds the RSVPs, and the site picks their changes up within about a minute. See [docs/EDITING.md](docs/EDITING.md) for the guide to give them.

One-time setup:

1. `npm run content-template` writes `site-details-template.csv` (git-ignored).
2. In the Google Sheet choose **File, Import, Upload**, pick the CSV, and choose **Insert new sheet(s)**. Name the new tab exactly `Site Details` (or set `CONTENT_TAB` in Netlify to the name you chose). Freeze row 1 and, if you like, protect columns A, B and D so only column C can be edited.
3. No new keys or settings are needed: the service account that saves RSVPs already has access to the whole spreadsheet.

How it works: `GET /api/content` (the `content` function) reads the tab, validates every value, and caches it for 60 seconds; if the sheet is unavailable it keeps serving the last good copy for up to 10 minutes and then the site's built-in text. Only the details listed in `lib/content-fields.js` can be changed, and only the text itself: photos, themes, the countdown date, photo credits and the venue stay in code and Netlify settings. To make another detail editable, add it to `site/js/content.js` and to `lib/content-fields.js` (a test fails until both agree), then re-run `npm run content-template` and add the new row to the sheet.

Local development: put a flat JSON map in `.dev-content.json`, for example `{"dress.code":"Black tie","announcement.text":"Hello!"}`, and run `npm run dev`.
````
(The earlier README line "Edit **`site/js/content.js`**..." stays: it remains the source of the built-in defaults.)

- [ ] **Step 9: Run to verify**: `node --test test/csv.test.js test/content-template.test.js` (PASS), `npm test` (all pass), then generate the file once to prove the script works: `npm run content-template` and confirm it prints `Wrote site-details-template.csv (<N> details)...`; run `head -3 site-details-template.csv` and confirm the header and the announcement row look right; then `git status --short` must NOT list the CSV (it is ignored).

- [ ] **Step 10: Commit**:
```bash
git add lib/csv.js scripts/make-content-template.js docs/EDITING.md package.json .gitignore .env.example README.md test/csv.test.js test/content-template.test.js
git commit -m "feat: sheet template generator, plain-English editing guide, and docs"
```

---

### Task 8: Verification, review, and release (controller checklist)

These steps are run by the controller (not an implementer subagent), in this order.

- [ ] **Step 1: Full suite.** `npm test`: all pass; record the count.

- [ ] **Step 2: Real browser run with the local file source.**
  1. Create `.dev-content.json` (git-ignored) with: `{"announcement.text":"Parking lot B is closed, please use the garage.","events.ceremony.time":"4:30 PM","dress.code":"Cocktail attire","travel.hotels.0.link":"https://example.com/book","travel.hotels.1.link":"javascript:alert(1)","faq.plusOne":"Yes, one guest per invitation.\nPlease tell us on the RSVP form."}`
  2. Start the app with `npm run dev` (background) and wait until `http://localhost:8888/` returns 200.
  3. `curl -s http://localhost:8888/api/content` returns `ok:true` with every valid key and WITHOUT the `javascript:` link; its headers include `Cache-Control: public, max-age=60`; `POST` returns 405.
  4. In the browser (Playwright): the home page shows the banner above the menu, "4:30 PM" as the ceremony time and "Cocktail attire"; the Travel page shows the working hotel link (`href="https://example.com/book"`) and the second hotel link stays `#`; the FAQ shows the two-line answer; markup typed into a value renders as literal text.
  5. Edit `.dev-content.json` (change the banner text), wait 61 seconds, reload: the new text appears. Empty the banner value: the banner disappears.
  6. Failure behavior: make `.dev-content.json` invalid JSON; reload after the cache window; the site shows the built-in `[TBD]` text, content appears within about 2.5 s at worst, no console errors other than the expected failed request, and the RSVP form still works.
  7. Check for a flash of placeholder text with fast and artificially slow responses (throttle or delay the function), and the banner at 320 px, 390 px and 1280 px in all three themes (`?preview`): no horizontal overflow, readable contrast.
  8. Delete `.dev-content.json`; stop the dev server; remove any test RSVP data.

- [ ] **Step 3: Hardening and security review** (dispatch an opus reviewer): scope = `lib/content-fields.js`, `lib/content-sheet.js`, `lib/content-handler.js`, `site/js/content-merge.js`, `site/js/content-live.js`, `site/js/chrome.js` banner, `site/js/main.js` flow. It must probe: injection through every value type, prototype pollution, cache and backoff behavior under failure, information leaks in errors/logs, quota-exhaustion paths, URL validation bypasses, the announcement banner as a defacement vector, and anything that could blank the page. Fix every Critical/Important finding through an implementer subagent, then re-review.

- [ ] **Step 4: Final whole-project review** (opus): the new feature against the spec, plus a regression pass over the main site (RSVP flow, venue secrecy, themes, credits).

- [ ] **Step 5: Finish.** Use superpowers:finishing-a-development-branch: push `feature/sheet-content`, open a PR into `main` on `mDagley/michael-kathy-wedding` with a plain-language summary and the sheet-import steps below. Do NOT merge without the user's say-so.

- [ ] **Step 6: Tell the user, in plain language,** what was built and what they must do (after the PR is merged and Netlify redeploys):
  1. Run `npm run content-template` (or take the CSV the controller generates) to get `site-details-template.csv`.
  2. In the Wedding RSVPs sheet: File, Import, Upload the CSV, choose "Insert new sheet(s)", then rename the new tab to exactly `Site Details`.
  3. Edit one value (for example the dress code), wait about a minute, refresh the live site, and confirm it changed. Then give the couple `docs/EDITING.md`.

---

## Self-review against the spec

- **Sheet tab in the same spreadsheet, no new credentials:** Tasks 2, 3 (`createContentSource` reuses the service account); `CONTENT_TAB` optional.
- **Editable details = everything except nav/credits/photos/theme/venue; dates labelled "does NOT change the countdown":** Task 1 (registry + drift tests, label test).
- **Blank keeps placeholder; values validated; length limits; URLs https-only:** Task 2 `parseContentRows`.
- **60 s cache, stale on error, generic 503, rate limit:** Task 3 (plus a retry backoff so a failing sheet is not hammered).
- **Front end: built-in text first, 1.5 s timeout, allow-listed merge, re-render of footer and banner, no flash of [TBD], failure is silent:** Tasks 4 and 6 (the CSS animation reveals text after 2.5 s even if scripts fail).
- **Announcement banner (300 chars, plain text, above nav, idempotent, removable):** Tasks 1 and 5.
- **Template + plain-English guide + README:** Task 7.
- **Testing section of the spec:** drift test (T1), parse/handler/merge/live tests (T2 to T4), chrome banner tests (T5), browser verification (T8).
- **Deliberate small additions beyond the spec text:** a retry backoff in the handler (T3) and a `createSource` injection point for testing lazy initialization (T3).
