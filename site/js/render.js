// site/js/render.js
export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

// "1:15pm", "12:53 pm", "1pm" -> "1:15 PM" so times the couple types look alike. Anything else is left alone.
export function formatTime(text) {
  const m = /^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?$/i.exec(text.trim());
  return m ? `${m[1]}${m[2] ? ':' + m[2] : ''} ${m[3].toUpperCase()}M` : text;
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
}
