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
