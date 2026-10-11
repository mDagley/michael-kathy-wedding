// site/js/rsvp.js
import { showVenue } from './venue-ui.js';

function fieldValues(form) {
  const get = (n) => form.querySelector(`[name="${n}"]`);
  const checked = form.querySelector('[name="attending"]:checked');
  return {
    name: get('name')?.value ?? '',
    email: get('email')?.value ?? '',
    attending: checked ? checked.value : '',
    dietary: get('dietary')?.value ?? '',
    notes: get('notes')?.value ?? '',
    website: get('website')?.value ?? '', // honeypot, must stay empty for humans
  };
}

function clearErrors(doc) {
  doc.querySelectorAll('[data-error]').forEach((e) => { e.textContent = ''; });
}

export function initRsvpForm(doc, { fetchFn, store, contact }) {
  const form = doc.getElementById('rsvp-form');
  if (!form) return;
  const button = doc.getElementById('submit');
  const errorBox = doc.getElementById('rsvp-error');
  const yes = doc.getElementById('rsvp-yes');
  const no = doc.getElementById('rsvp-no');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors(doc);
    errorBox.hidden = true;
    button.disabled = true;
    try {
      const res = await fetchFn('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fieldValues(form)),
      });
      const data = await res.json();
      if (res.status === 400 && data && data.errors) {
        Object.entries(data.errors).forEach(([field, msg]) => {
          const slot = doc.querySelector(`[data-error="${field}"]`);
          if (slot) slot.textContent = msg;
        });
        button.disabled = false;
        return;
      }
      if (!res.ok || !data.ok) throw new Error('RSVP failed');

      form.hidden = true;
      if (data.attending && data.venue) {
        store.set(data.venue);
        showVenue(doc, data.venue);
        yes.hidden = false;
        no.hidden = true;
      } else {
        no.hidden = false;
        yes.hidden = true;
      }
    } catch {
      errorBox.textContent = `We couldn't send your RSVP right now. Please try again, or contact us at ${contact}.`;
      errorBox.hidden = false;
      button.disabled = false;
    }
  });
}

export function initLookup(doc, { fetchFn, store }) {
  const form = doc.getElementById('lookup-form');
  if (!form) return;
  const msg = doc.getElementById('lookup-msg');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    msg.textContent = '';
    const body = {
      name: form.querySelector('[name="name"]').value,
      email: form.querySelector('[name="email"]').value,
    };
    try {
      const res = await fetchFn('/api/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.ok && data.found && data.venue) {
        store.set(data.venue);
        showVenue(doc, data.venue);
      } else {
        msg.textContent = "We couldn't find a yes RSVP for that name and email. Check the spelling, or RSVP below.";
      }
    } catch {
      msg.textContent = "We couldn't look that up right now. Please try again in a moment.";
    }
  });
}
