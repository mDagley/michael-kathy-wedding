// lib/content-sheet.js
import { promises as fs } from 'node:fs';
import { getField } from './content-fields.js';

// Control characters, C1 controls, and invisible/bidi-override characters that can disguise text or links.
// U+200D (zero-width joiner) is deliberately kept: it is part of valid multi-person emoji.
// eslint-disable-next-line no-control-regex
const HIDDEN_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\u00AD\u200B\u200C\u200E\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;
// Printable ASCII only (rejects look-alike domains), and none of the characters that break out of attributes.
const URL_OK = /^https?:\/\/[\x21-\x7E]+$/;
const URL_BAD = /[<>"'`]/;

function cleanUrl(value, maxLength) {
  value = value.replace(/^https?:\/\//i, (scheme) => scheme.toLowerCase()); // render.js needs a lower-case scheme
  if (value.length > maxLength || !URL_OK.test(value) || URL_BAD.test(value)) return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  return value;
}

// rows: arrays of cells [Section, What it is, Value, key]. Returns { key: value } for allow-listed,
// valid, non-blank values only. Everything else is dropped so the built-in default stays in place.
// Duplicate keys: the FIRST row that produces a usable value wins. A blank or invalid earlier row
// does not claim the key, so a later row for the same key can still supply the value.
export function parseContentRows(rows) {
  const values = {};
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!Array.isArray(row)) continue;
    const key = String(row[3] ?? '').trim();
    const field = getField(key);
    if (!field || Object.hasOwn(values, key)) continue;

    // Cut a pathological cell early so every later step works on a bounded string.
    let value = String(row[2] ?? '').slice(0, field.maxLength * 4).replace(HIDDEN_CHARS, '').trim();
    if (!value) continue;

    if (field.kind === 'url') {
      value = cleanUrl(value, field.maxLength);
      if (value === null) continue;
    } else {
      if (field.kind === 'text') {
        value = value.split(/[\r\n\u2028\u2029]+/).map((part) => part.trim()).filter(Boolean).join(' ');
      } else {
        value = value.replace(/[\u2028\u2029]/g, '\n');
      }
      const chars = Array.from(value);
      if (chars.length > field.maxLength) value = chars.slice(0, field.maxLength).join('').trimEnd();
      if (!value) continue;
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
        const text = (await fs.readFile(path, 'utf8')).replace(/^\uFEFF/, '');
        if (!text.trim()) return {};
        map = JSON.parse(text);
      } catch (e) {
        if (e.code === 'ENOENT') return {};
        throw e;
      }
      const scalar = (v) => ['string', 'number', 'boolean'].includes(typeof v);
      return parseContentRows(
        Object.entries(map ?? {}).filter(([, value]) => scalar(value)).map(([key, value]) => ['', '', value, key]),
      );
    },
  };
}
