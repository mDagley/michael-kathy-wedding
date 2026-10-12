// lib/csv.js
const needsQuotes = /[",\r\n]/;

const cell = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return needsQuotes.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function toCsv(rows) {
  return rows.map((row) => row.map(cell).join(',')).join('\n') + '\n';
}
