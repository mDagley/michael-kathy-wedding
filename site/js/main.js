// site/js/main.js
import { content } from './content.js';
import { applyContent } from './render.js';
import { renderChrome } from './chrome.js';
import { initTheme } from './theme-switcher.js';
import { startCountdown } from './countdown.js';
import { createVenueStore } from './venue-store.js';
import { showVenue } from './venue-ui.js';
import { initRsvpForm, initLookup } from './rsvp.js';
import { mergeContent } from './content-merge.js';
import { loadLiveContent } from './content-live.js';

function safeStorage() {
  try { return window.localStorage; } catch { return { getItem: () => null, setItem() {}, removeItem() {} }; }
}

function boot() {
  const page = document.body.dataset.page;
  const root = document.documentElement;
  initTheme(window);

  // Paint the built-in text right away. While content-pending is set, CSS hides the text and the footer
  // until the couple's edits arrive or about 1.5 s pass (no flash of "[TBD]" replaced by real text).
  // A 2.5 s CSS backstop reveals everything even if scripts fail. The announcement banner, if any,
  // only appears when live content arrives.
  let current = content;
  root.classList.add('content-pending');
  const paint = () => {
    renderChrome(document, current, page);
    applyContent(document, current);
  };
  paint();

  const countdown = document.querySelector('[data-countdown]');
  if (countdown) startCountdown(countdown);

  const store = createVenueStore(safeStorage());
  showVenue(document, store.get());

  const fetchFn = (...args) => window.fetch(...args);
  initRsvpForm(document, { fetchFn, store, contact: () => current.couple.contact });
  initLookup(document, { fetchFn, store });

  // The couple's edits from the Google Sheet. Any failure leaves the built-in text in place.
  loadLiveContent({ fetchFn })
    .then((values) => {
      if (values) {
        current = mergeContent(content, values);
        paint();
      }
    })
    .catch(() => {})
    .finally(() => root.classList.remove('content-pending'));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
