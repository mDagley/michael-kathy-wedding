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

// Netlify's CONTEXT is a build-time variable and does not exist inside functions at runtime, so it
// cannot be used to detect production. Instead the local JSON files are an explicit opt-in:
// NETLIFY_DEV is set by the Netlify CLI for `npm run dev`; ALLOW_FILE_STORE is for tests and scripts.
export function isLocalDev(env) {
  return env.NETLIFY_DEV === 'true' || env.ALLOW_FILE_STORE === 'true';
}

const MISSING_SHEET_ID = 'GOOGLE_SHEET_ID is not set. The local JSON file store is only used for local development (NETLIFY_DEV=true or ALLOW_FILE_STORE=true).';

export function createSheet(env) {
  if (env.GOOGLE_SHEET_ID) {
    return createGoogleSheet({
      sheetId: env.GOOGLE_SHEET_ID,
      clientEmail: env.GOOGLE_CLIENT_EMAIL,
      privateKey: env.GOOGLE_PRIVATE_KEY,
    });
  }
  // Never silently fall back to a local file outside local development: RSVPs would be lost.
  if (!isLocalDev(env)) throw new Error(MISSING_SHEET_ID);
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
  // Same rule as RSVP storage: never silently serve a local file outside local development.
  if (!isLocalDev(env)) throw new Error(MISSING_SHEET_ID);
  return createFileContentSource(env.DEV_CONTENT_PATH || '.dev-content.json');
}
