// site/js/render.js
export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function applyContent(root, content) {
  root.querySelectorAll('[data-c]').forEach((el) => {
    const value = getPath(content, el.dataset.c);
    if (value == null) {
      el.textContent = `[MISSING: ${el.dataset.c}]`;
      el.classList.add('tbd');
      return;
    }
    const text = String(value);
    el.textContent = text;
    el.classList.toggle('tbd', text.startsWith('['));
  });

  root.querySelectorAll('[data-c-href]').forEach((el) => {
    const value = getPath(content, el.dataset.cHref);
    if (typeof value === 'string' && /^https?:\/\//.test(value)) {
      el.setAttribute('href', value);
    } else {
      el.setAttribute('href', '#');
      el.classList.add('tbd');
    }
  });
}
