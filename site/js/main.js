// site/js/main.js
import { content } from './content.js';
import { applyContent } from './render.js';
import { renderChrome } from './chrome.js';
import { initTheme } from './theme-switcher.js';
import { startCountdown } from './countdown.js';
import { createVenueStore } from './venue-store.js';
import { showVenue } from './venue-ui.js';
import { initRsvpForm, initLookup } from './rsvp.js';

function safeStorage() {
  try { return window.localStorage; } catch { return { getItem: () => null, setItem() {}, removeItem() {} }; }
}

function boot() {
  const page = document.body.dataset.page;
  initTheme(window);
  renderChrome(document, content, page);
  applyContent(document, content);

  const countdown = document.querySelector('[data-countdown]');
  if (countdown) startCountdown(countdown);

  const store = createVenueStore(safeStorage());
  showVenue(document, store.get());

  const fetchFn = (...args) => window.fetch(...args);
  initRsvpForm(document, { fetchFn, store, contact: content.couple.contact });
  initLookup(document, { fetchFn, store });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
