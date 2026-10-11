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
