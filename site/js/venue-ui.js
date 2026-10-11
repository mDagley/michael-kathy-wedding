// site/js/venue-ui.js
export function showVenue(doc, venue) {
  doc.querySelectorAll('[data-venue-state="locked"]').forEach((el) => { el.hidden = !!venue; });
  doc.querySelectorAll('[data-venue-state="revealed"]').forEach((el) => { el.hidden = !venue; });
  if (venue) {
    const name = String(venue.name ?? '');
    const address = String(venue.address ?? '');
    doc.querySelectorAll('[data-venue-name]').forEach((el) => { el.textContent = name; el.classList.toggle('tbd', name.startsWith('[')); });
    doc.querySelectorAll('[data-venue-address]').forEach((el) => { el.textContent = address; el.classList.toggle('tbd', address.startsWith('[')); });
  }
}
