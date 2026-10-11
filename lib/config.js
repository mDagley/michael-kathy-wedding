// lib/config.js
import { createFileSheet } from './sheet-file.js';
import { createGoogleSheet } from './sheet-google.js';
import { createSheetsClient } from './google-client.js';
import { createGoogleContentSource, createFileContentSource } from './content-sheet.js';

export function loadVenue(env) {
  return {
    name: env.VENUE_NAME || '[VENUE NAME TBD]',
    address: env.VENUE_ADDRESS || '[STREET ADDRESS TBD]',
  };
}

export function createSheet(env) {
  if (env.GOOGLE_SHEET_ID) {
    return createGoogleSheet({
      sheetId: env.GOOGLE_SHEET_ID,
      clientEmail: env.GOOGLE_CLIENT_EMAIL,
      privateKey: env.GOOGLE_PRIVATE_KEY,
    });
  }
  // Never silently fall back to a local file in production: RSVPs would be lost.
  if (env.CONTEXT === 'production') throw new Error('GOOGLE_SHEET_ID is not set in production.');
  return createFileSheet(env.DEV_SHEET_PATH || '.dev-rsvps.json');
}

export function createContentSource(env, deps = {}) {
  if (env.GOOGLE_SHEET_ID) {
    return createGoogleContentSource({
      sheetId: env.GOOGLE_SHEET_ID,
      tab: env.CONTENT_TAB || 'Site Details',
      sheetsClient: deps.sheetsClient ?? createSheetsClient({ clientEmail: env.GOOGLE_CLIENT_EMAIL, privateKey: env.GOOGLE_PRIVATE_KEY }),
    });
  }
  // Same rule as RSVP storage: never silently serve a local file in production.
  if (env.CONTEXT === 'production') throw new Error('GOOGLE_SHEET_ID is not set in production.');
  return createFileContentSource(env.DEV_CONTENT_PATH || '.dev-content.json');
}
