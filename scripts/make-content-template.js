// scripts/make-content-template.js
// Writes site-details-template.csv: import it into a new "Site Details" tab of the RSVP spreadsheet.
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
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
  // Always written to the project root, wherever the command is run from.
  const out = new URL('../site-details-template.csv', import.meta.url);
  writeFileSync(out, toCsv(buildTemplateRows()), 'utf8');
  console.log(`Wrote ${fileURLToPath(out)} (${EDITABLE_FIELDS.length} details). Import it into a new tab named "Site Details".`);
}
