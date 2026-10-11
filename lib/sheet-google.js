// lib/sheet-google.js
import { google } from 'googleapis';

export const COLUMNS = ['timestamp', 'name', 'email', 'attending', 'dietary', 'notes'];
const TAB = 'RSVPs';

export const toRow = (record) => COLUMNS.map((c) => record[c] ?? '');
export const fromRow = (row) => Object.fromEntries(COLUMNS.map((c, i) => [c, row[i] ?? '']));
export const normalizePrivateKey = (key) => String(key ?? '').replace(/\\n/g, '\n');

// Sheet layout: a tab named "RSVPs" with header row A1:F1 = Timestamp, Name, Email, Attending, Dietary, Notes.
// Values are written RAW so a guest typing "=SUM(...)" is stored as plain text, not a formula.
export function createGoogleSheet({ sheetId, clientEmail, privateKey }) {
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: normalizePrivateKey(privateKey),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  return {
    async findByEmail(email) {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${TAB}!A2:F` });
      const rows = res.data.values || [];
      const i = rows.findIndex((r) => String(r[2] ?? '').trim().toLowerCase() === email);
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
