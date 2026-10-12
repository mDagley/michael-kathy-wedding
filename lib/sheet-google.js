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

  return {
    async findByEmail(email) {
      const target = String(email ?? '').trim().toLowerCase();
      const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${TAB}!A2:F` });
      const rows = res.data.values || [];
      const i = rows.findIndex((r) => String(r[2] ?? '').trim().toLowerCase() === target);
      return i < 0 ? null : { rowIndex: i, record: fromRow(rows[i]) };
    },
    async append(record) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: `${TAB}!A:F`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [toRow(record)] },
      });
    },
    async update(rowIndex, record) {
      const sheetRow = rowIndex + 2; // +1 for header, +1 because sheets are 1-indexed
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${TAB}!A${sheetRow}:F${sheetRow}`,
        valueInputOption: 'RAW',
        requestBody: { values: [toRow(record)] },
      });
    },
  };
}
