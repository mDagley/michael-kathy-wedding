// site/js/chrome.js
function el(doc, tag, attrs = {}, ...children) {
  const node = doc.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    node.setAttribute(k, v === true ? '' : v);
  }
  node.append(...children);
  return node;
}

// A value is a placeholder if it contains a bracketed [TBD] marker anywhere.
const flagIfPlaceholder = (value) => (value.includes('[') ? 'tbd' : false);

function renderAnnouncement(doc, content) {
  const text = String(content.announcement?.text ?? '').trim();
  const existing = doc.querySelector('.announcement');
  if (!text) {
    existing?.remove();
    return;
  }
  const bar = existing || el(doc, 'div', { class: 'announcement', role: 'region', 'aria-label': 'Announcement' });
  bar.textContent = text;
  if (!existing) doc.body.prepend(bar);
}

export function renderChrome(doc, content, currentPage) {
  renderAnnouncement(doc, content);
  const navHost = doc.getElementById('site-nav');
  if (navHost && !(navHost.querySelector('nav') && navHost.dataset.renderedFor === String(currentPage))) {
    // Skip the rebuild when the nav for this page is already there: replacing it can drop keyboard focus.
    const links = el(doc, 'div', { class: 'links' });
    content.nav.forEach((item) => {
      links.append(
        el(doc, 'a', {
          href: item.href,
          class: item.cta ? 'cta' : false,
          'aria-current': item.id === currentPage ? 'page' : false,
        }, item.label)
      );
    });
    navHost.replaceChildren(
      el(doc, 'nav', { class: 'nav', 'aria-label': 'Main' },
        el(doc, 'a', { class: 'logo', href: 'index.html', 'aria-label': 'Home' }, 'M & K'),
        links)
    );
    navHost.dataset.renderedFor = String(currentPage);
  }

  const footHost = doc.getElementById('site-footer');
  if (footHost) {
    const credits = el(doc, 'div', { class: 'credits' }, 'Photos and art: ');
    content.credits.forEach((c, i) => {
      if (i > 0) credits.append(' · ');
      credits.append(el(doc, 'a', { href: c.url, rel: 'noopener' }, c.label));
    });
    const deadline = el(doc, 'span', { class: flagIfPlaceholder(content.rsvp.deadline) }, content.rsvp.deadline);
    const hashtag = el(doc, 'span', { class: flagIfPlaceholder(content.couple.hashtag) }, content.couple.hashtag);
    footHost.replaceChildren(
      el(doc, 'footer', { class: 'footer' },
        el(doc, 'div', {}, 'RSVP BY ', deadline, ' · ', hashtag),
        credits)
    );
  }
}
