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
