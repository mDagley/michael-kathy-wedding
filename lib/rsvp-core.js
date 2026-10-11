// lib/rsvp-core.js
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeEmail = (e) => String(e ?? '').trim().toLowerCase();
export const normalizeName = (n) => String(n ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

export function validateRsvp(body) {
  const errors = {};
  const name = String(body.name ?? '').trim().replace(/\s+/g, ' ');
  const email = normalizeEmail(body.email);
  const attending = String(body.attending ?? '');
  const dietary = String(body.dietary ?? '').trim();
  const notes = String(body.notes ?? '').trim();

  if (!name) errors.name = 'Please enter your name.';
  else if (name.length > 100) errors.name = 'That name is too long.';
  if (!EMAIL.test(email) || email.length > 200) errors.email = 'Please enter a valid email address.';
  if (!['yes', 'no'].includes(attending)) errors.attending = 'Please choose yes or no.';
  if (dietary.length > 300) errors.dietary = 'Please keep this under 300 characters.';
  if (notes.length > 500) errors.notes = 'Please keep this under 500 characters.';

  return Object.keys(errors).length
    ? { ok: false, errors }
    : { ok: true, value: { name, email, attending, dietary, notes } };
}

export function createHandlers({ sheet, venue, now = () => new Date().toISOString() }) {
  return {
    async rsvp(body) {
      // Honeypot: real people never see this field. Pretend success, store nothing.
      if (String(body.website ?? '').trim() !== '') {
        return { status: 200, body: { ok: true, attending: false } };
      }
      const checked = validateRsvp(body);
      if (!checked.ok) return { status: 400, body: { ok: false, errors: checked.errors } };

      const record = { timestamp: now(), ...checked.value };
      const existing = await sheet.findByEmail(record.email);
      if (existing) await sheet.update(existing.rowIndex, record);
      else await sheet.append(record);

      const yes = record.attending === 'yes';
      return { status: 200, body: yes ? { ok: true, attending: true, venue } : { ok: true, attending: false } };
    },

    async lookup(body) {
      const name = normalizeName(body.name);
      const email = normalizeEmail(body.email);
      if (!name || !email) return { status: 400, body: { ok: false, errors: { email: 'Enter your name and email.' } } };

      const existing = await sheet.findByEmail(email);
      const match = existing
        && existing.record.attending === 'yes'
        && normalizeName(existing.record.name) === name;
      return { status: 200, body: match ? { ok: true, found: true, venue } : { ok: true, found: false } };
    },
  };
}
