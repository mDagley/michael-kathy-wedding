// lib/content-fields.js
// The single source of truth for what the couple may edit from the "Site Details" sheet tab.
// It drives: the server allow-list, the CSV template, and the drift tests against site/js/content.js.
// kind: 'text' (one line), 'multiline' (line breaks allowed), 'url' (must start with http:// or https://).
export const FIELD_KINDS = ['text', 'multiline', 'url'];

const f = (key, section, label, kind = 'text', maxLength = kind === 'multiline' ? 600 : kind === 'url' ? 500 : 200) => ({
  key, section, label, kind, maxLength,
});

export const EDITABLE_FIELDS = [
  f('announcement.text', 'Announcement', 'Announcement banner (leave blank for none)', 'text', 300),

  f('couple.names', 'The wedding', "Couple's names", 'text', 60),
  f('couple.date', 'The wedding', 'Wedding date, short form (does NOT change the countdown)', 'text', 60),
  f('couple.dateLong', 'The wedding', 'Wedding date, long form (does NOT change the countdown)', 'text', 80),
  f('couple.city', 'The wedding', 'City', 'text', 60),
  f('couple.contact', 'The wedding', 'Contact email or phone (shown if the RSVP form has a problem)', 'text', 100),
  f('couple.hashtag', 'The wedding', 'Wedding hashtag (include the #)', 'text', 60),
  f('rsvp.deadline', 'The wedding', 'RSVP deadline', 'text', 60),

  f('events.arrival.time', 'The day', 'Guest arrival time', 'text', 60),
  f('events.arrival.note', 'The day', 'Arrival note', 'multiline'),
  f('events.ceremony.time', 'The day', 'Ceremony start time', 'text', 60),
  f('events.ceremony.details', 'The day', 'Ceremony details', 'multiline'),
  f('events.reception.time', 'The day', 'Reception start time', 'text', 60),
  f('events.reception.details', 'The day', 'Reception details', 'multiline'),
  f('events.extra.time', 'The day', 'Extra event: time (optional)', 'text', 60),
  f('events.extra.title', 'The day', 'Extra event: title (optional)', 'text', 80),
  f('events.extra.details', 'The day', 'Extra event: details (optional)', 'multiline'),

  f('dress.code', 'Dress code', 'Dress code', 'text', 80),
  f('dress.note', 'Dress code', 'Dress code note', 'multiline'),

  f('travel.hotels.0.name', 'Travel: hotel 1', 'Hotel 1: name', 'text', 100),
  f('travel.hotels.0.address', 'Travel: hotel 1', 'Hotel 1: address', 'text', 200),
  f('travel.hotels.0.code', 'Travel: hotel 1', 'Hotel 1: group discount code', 'text', 60),
  f('travel.hotels.0.bookBy', 'Travel: hotel 1', 'Hotel 1: book by date', 'text', 60),
  f('travel.hotels.0.link', 'Travel: hotel 1', 'Hotel 1: booking link (must start with https://)', 'url'),
  f('travel.hotels.1.name', 'Travel: hotel 2', 'Hotel 2: name', 'text', 100),
  f('travel.hotels.1.address', 'Travel: hotel 2', 'Hotel 2: address', 'text', 200),
  f('travel.hotels.1.code', 'Travel: hotel 2', 'Hotel 2: group discount code', 'text', 60),
  f('travel.hotels.1.bookBy', 'Travel: hotel 2', 'Hotel 2: book by date', 'text', 60),
  f('travel.hotels.1.link', 'Travel: hotel 2', 'Hotel 2: booking link (must start with https://)', 'url'),
  f('travel.airports', 'Travel: getting here', 'Getting here: airports', 'multiline'),
  f('travel.rideshare', 'Travel: getting here', 'Getting here: rideshare', 'multiline'),
  f('travel.parking', 'Travel: getting here', 'Getting here: parking', 'multiline'),
  f('travel.shuttle', 'Travel: getting here', 'Getting here: shuttle', 'multiline'),

  f('registry.message', 'Registry', 'Registry message', 'multiline'),
  f('registry.items.0.name', 'Registry', 'Registry 1: name', 'text', 100),
  f('registry.items.0.description', 'Registry', 'Registry 1: short description', 'multiline'),
  f('registry.items.0.link', 'Registry', 'Registry 1: link (must start with https://)', 'url'),
  f('registry.items.1.name', 'Registry', 'Registry 2: name', 'text', 100),
  f('registry.items.1.description', 'Registry', 'Registry 2: short description', 'multiline'),
  f('registry.items.1.link', 'Registry', 'Registry 2: link (must start with https://)', 'url'),

  f('faq.plusOne', 'FAQ', 'FAQ answer: Can I bring a plus-one?', 'multiline'),
  f('faq.children', 'FAQ', 'FAQ answer: Are children welcome?', 'multiline'),
  f('faq.parking', 'FAQ', 'FAQ answer: Where do I park?', 'multiline'),
  f('faq.dietary', 'FAQ', 'FAQ answer: What about dietary restrictions?', 'multiline'),

  f('story.howWeMet', 'Our story', 'How we met', 'multiline', 4000),
  f('story.proposal', 'Our story', 'The proposal', 'multiline', 4000),
];

const BY_KEY = new Map(EDITABLE_FIELDS.map((field) => [field.key, field]));

export function getField(key) {
  return BY_KEY.get(key);
}
