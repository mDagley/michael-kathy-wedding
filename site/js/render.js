// site/js/render.js
export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

// "1:15pm", "12:53 pm", "1pm" -> "1:15 PM" so times the couple types look alike. Anything else is left alone.
export function formatTime(text) {
  const m = /^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?$/i.exec(text.trim());
  return m ? `${m[1]}${m[2] ? ':' + m[2] : ''} ${m[3].toUpperCase()}M` : text;
}

// "1:15 PM" -> minutes since midnight, or null when the text is not a clock time.
export function timeToMinutes(text) {
  const m = /^(\d{1,2})(?::(\d{2}))? ([AP])M$/.exec(text);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2] || 0);
  if (hour < 1 || hour > 12 || minute > 59) return null;
  return (hour % 12) * 60 + minute + (m[3] === 'P' ? 720 : 0);
}

// Put the schedule in time order. If any event has no readable time yet, leave the order alone.
function sortTimeline(root) {
  const list = root.querySelector('.timeline');
  if (!list) return;
  const items = [...list.children].map((li) => ({
    li,
    minutes: timeToMinutes((li.querySelector('[data-c$=".time"]')?.textContent || '').trim()),
  }));
  if (items.length < 2 || items.some((i) => i.minutes === null)) return;
  items
    .map((item, index) => ({ ...item, index }))
    .sort((a, b) => a.minutes - b.minutes || a.index - b.index)
    .forEach(({ li }) => list.appendChild(li));
}

export function applyContent(root, content) {
  root.querySelectorAll('[data-c]').forEach((el) => {
    const value = getPath(content, el.dataset.c);
    if (value == null) {
      el.textContent = `[MISSING: ${el.dataset.c}]`;
      el.classList.add('tbd');
      return;
    }
    const text = /^events\.[^.]+\.time$/.test(el.dataset.c) ? formatTime(String(value)) : String(value);
    el.textContent = text;
    el.classList.toggle('tbd', text.startsWith('['));
  });

  root.querySelectorAll('[data-c-href]').forEach((el) => {
    const value = getPath(content, el.dataset.cHref);
    const valid = typeof value === 'string' && /^https?:\/\//.test(value);
    el.setAttribute('href', valid ? value : '#');
    el.classList.toggle('tbd', !valid);
  });

  sortTimeline(root);
}
