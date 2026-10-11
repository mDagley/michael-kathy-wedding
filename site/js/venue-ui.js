// site/js/venue-ui.js
export function showVenue(doc, venue) {
  doc.querySelectorAll('[data-venue-state="locked"]').forEach((el) => { el.hidden = !!venue; });
  doc.querySelectorAll('[data-venue-state="revealed"]').forEach((el) => { el.hidden = !venue; });
  if (venue) {
    doc.querySelectorAll('[data-venue-name]').forEach((el) => { el.textContent = venue.name; el.classList.toggle('tbd', venue.name.startsWith('[')); });
    doc.querySelectorAll('[data-venue-address]').forEach((el) => { el.textContent = venue.address; el.classList.toggle('tbd', venue.address.startsWith('[')); });
  }
}
