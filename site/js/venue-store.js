// site/js/venue-store.js
const KEY = 'mk_venue';

export function createVenueStore(storage) {
  return {
    get() {
      try {
        const raw = storage.getItem(KEY);
        if (!raw) return null;
        const v = JSON.parse(raw);
        return v && typeof v.name === 'string' && typeof v.address === 'string'
          ? { name: v.name, address: v.address }
          : null;
      } catch {
        return null;
      }
    },
    set(venue) {
      try { storage.setItem(KEY, JSON.stringify({ name: venue.name, address: venue.address })); } catch { /* storage unavailable */ }
    },
    clear() {
      try { storage.removeItem(KEY); } catch { /* storage unavailable */ }
    },
  };
}
