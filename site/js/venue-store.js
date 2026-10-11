// site/js/venue-store.js
const KEY = 'mk_venue';

// A bracketed value such as [VENUE NAME TBD] is a server placeholder, never a real venue.
const isPlaceholder = (v) => String(v.name).startsWith('[') || String(v.address).startsWith('[');

export function createVenueStore(storage) {
  return {
    get() {
      try {
        const raw = storage.getItem(KEY);
        if (!raw) return null;
        const v = JSON.parse(raw);
        return v && typeof v.name === 'string' && typeof v.address === 'string' && !isPlaceholder(v)
          ? { name: v.name, address: v.address }
          : null;
      } catch {
        return null;
      }
    },
    set(venue) {
      if (!venue || isPlaceholder(venue)) return;
      try { storage.setItem(KEY, JSON.stringify({ name: venue.name, address: venue.address })); } catch { /* storage unavailable */ }
    },
    clear() {
      try { storage.removeItem(KEY); } catch { /* storage unavailable */ }
    },
  };
}
