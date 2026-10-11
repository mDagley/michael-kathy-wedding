// site/js/content.js
// ALL wedding facts live here. Anything in [BRACKETS] is a placeholder: replace the whole
// string (including the brackets) with the real text. Placeholders render highlighted.
export const content = {
  couple: {
    names: 'Michael & Kathy',
    date: 'August 21, 2027',
    dateLong: 'Saturday, August 21, 2027',
    city: 'Chicago, Illinois',
    contact: '[CONTACT EMAIL OR PHONE TBD]',
    hashtag: '#[HASHTAG TBD]',
  },
  rsvp: { deadline: '[DEADLINE TBD]' },
  events: {
    arrival: { time: '[ARRIVAL TIME TBD]', note: '[ARRIVAL NOTE TBD]' },
    ceremony: { time: '[CEREMONY TIME TBD]', details: '[CEREMONY DETAILS TBD]' },
    reception: { time: '[RECEPTION TIME TBD]', details: '[RECEPTION DETAILS TBD]' },
    extra: { time: '[TIME TBD]', title: '[ANOTHER EVENT TBD]', details: '[EVENT DETAILS TBD]' },
  },
  dress: { code: '[ATTIRE TBD]', note: 'Earthy greens and warm tones are welcome.' },
  travel: {
    hotels: [
      { name: '[HOTEL NAME TBD]', address: '[ADDRESS TBD]', code: '[CODE TBD]', bookBy: '[DATE TBD]', link: '[LINK TBD]' },
      { name: '[HOTEL NAME TBD]', address: '[ADDRESS TBD]', code: '[CODE TBD]', bookBy: '[DATE TBD]', link: '[LINK TBD]' },
    ],
    airports: "Chicago O'Hare (ORD) and Chicago Midway (MDW). [DISTANCE AND TRAVEL TIME TO VENUE TBD]",
    rideshare: '[RECOMMENDED RIDESHARE AND PICKUP SPOT TBD]',
    parking: '[PARKING INSTRUCTIONS TBD]',
    shuttle: '[SHUTTLE TIMES TBD, IF ANY]',
  },
  registry: {
    message: '[REGISTRY MESSAGE TBD]',
    items: [
      { name: '[REGISTRY NAME TBD]', description: '[SHORT DESCRIPTION TBD]', link: '[LINK TBD]' },
      { name: '[REGISTRY NAME TBD]', description: '[SHORT DESCRIPTION TBD]', link: '[LINK TBD]' },
    ],
  },
  faq: {
    plusOne: '[ANSWER TBD]',
    children: '[ANSWER TBD]',
    parking: '[ANSWER TBD]',
    dietary: '[ANSWER TBD]',
  },
  story: {
    howWeMet: '[HOW MICHAEL AND KATHY MET: STORY TBD]',
    proposal: '[PROPOSAL STORY TBD]',
  },
  nav: [
    { id: 'home', label: 'Home', href: 'index.html' },
    { id: 'schedule', label: 'Schedule', href: 'schedule.html' },
    { id: 'travel', label: 'Travel', href: 'travel.html' },
    { id: 'registry', label: 'Registry', href: 'registry.html' },
    { id: 'faq', label: 'FAQ', href: 'faq.html' },
    { id: 'story', label: 'Our Story', href: 'story.html' },
    { id: 'rsvp', label: 'RSVP', href: 'rsvp.html', cta: true },
  ],
  // Vecteezy free license requires crediting each item's contributor with a link to its page.
  // The generic entry stays first; every used asset has its own entry after it.
  credits: [
    { label: 'Boho Stock photos by Vecteezy', url: 'https://www.vecteezy.com/free-photos/boho' },
    { label: 'Macrame wall panel by Natallia Krechka', url: 'https://www.vecteezy.com/photo/3280614-beautiful-boho-macrame-wall-panel-for-a-cozy-atmosphere' },
    { label: 'Terra cotta fabric by Kathryn Swezy', url: 'https://www.vecteezy.com/photo/52558004-gauze-bohemian-terra-cotta-fabric-background' },
    { label: 'Boho rainbows by FARZANA AFROZ', url: 'https://www.vecteezy.com/vector-art/68765270-baby-rainbows-boho-rainbow-elements-for-baby-kids-bedding' },
    { label: 'Boho vase illustration by Md Meharab Hossen Shagor', url: 'https://www.vecteezy.com/vector-art/86722658-boho-ceramic-vase-with-tropical-leaves-abstract-modern' },
    { label: 'Hands holding flowers by Panji Dwi Cahya', url: 'https://www.vecteezy.com/vector-art/59494896-elegant-feminine-hands-holding-flowers-botanical' },
  ],
};
