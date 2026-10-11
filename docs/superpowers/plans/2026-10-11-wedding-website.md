# Michael & Kathy Wedding Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the multi-page boho-chic wedding website (August 21, 2027, Chicago) with a sage-led theme, an RSVP form backed by a Google Sheet, and a venue address that is revealed only to guests who RSVP "yes."

**Architecture:** A static site (plain HTML, CSS, and ES-module JavaScript, no build step) published from `site/`. All wedding facts live in one content file and are bound into pages with `data-c` attributes. Colors and fonts live in one `theme.css` as CSS variables. Two Netlify serverless functions (`/api/rsvp`, `/api/lookup`) hold the venue address in environment variables, save RSVPs to a Google Sheet, and return the venue only for a "yes" RSVP. Business logic is in `lib/` and is unit-tested with dependency-injected sheet storage.

**Tech Stack:** HTML/CSS/vanilla JS (ES modules), Node 20+ with the built-in `node:test` runner, `jsdom` (tests only), Netlify Functions (esbuild, ESM), `googleapis` (Google Sheets), Netlify CLI for local dev and deploy.

**Source documents:**
- Spec: `docs/superpowers/specs/2026-10-11-wedding-website-design.md`
- Approved mockup (sage option): https://claude.ai/artifact/9EJm1orN9RkWMwqoT7Ro81

**Conventions used in this plan**
- Commands run from the project root `C:\Users\panda\claude\Michael & Kathy Wedding` in Git Bash.
- Any text in `[BRACKETS]` on the site is a placeholder the couple will fill in later. Do not invent real details.
- Photos must not be AI-generated and must not be wedding-specific scenes (spec rule). Only use the five files named in Task 1.

---

## File Structure

```
package.json                       scripts and dependencies
netlify.toml                       publish dir, functions dir, /api redirect, headers
.gitignore  .env.example  README.md
site/                              published directory
  index.html schedule.html travel.html rsvp.html registry.html faq.html story.html 404.html
  css/theme.css                    three themes as CSS variables (sage is default)
  css/base.css                     layout and components, uses only theme variables
  js/content.js                    ALL wedding facts and placeholders
  js/render.js                     binds content into [data-c] elements
  js/chrome.js                     injects nav and footer (with photo credits)
  js/countdown.js                  time-left math and live countdown
  js/theme.js                      theme list, preview detection, theme persistence
  js/theme-switcher.js             the floating preview-only A/B/C control
  js/venue-store.js                saves the revealed venue in the browser
  js/venue-ui.js                   shows or hides locked/revealed venue blocks
  js/rsvp.js                       RSVP form and "look up my venue" form behavior
  js/main.js                       page entry point, wires everything together
  assets/photos/*.jpg  assets/illustrations/*.jpg  assets/svg/*.svg
lib/                               server logic (also unit-tested)
  rsvp-core.js                     validation, RSVP handler, lookup handler
  limiter.js                       best-effort in-memory rate limiter
  http.js                          event parsing and JSON responses
  function-factory.js              builds the Netlify handler for rsvp and lookup
  config.js                        venue from env, chooses sheet storage
  sheet-file.js                    JSON-file sheet (local dev and tests)
  sheet-google.js                  Google Sheets storage (production)
netlify/functions/rsvp.js lookup.js   thin wrappers
test/*.test.js                     node:test unit tests
```

---

### Task 1: Project scaffold, git, and assets

**Files:**
- Create: `package.json`, `netlify.toml`, `.gitignore`, `.env.example`
- Create (copy): `site/assets/photos/macrame-panel.jpg`, `site/assets/photos/terracotta-fabric.jpg`, `site/assets/illustrations/vase-arch.jpg`, `site/assets/illustrations/leaf-rainbow.jpg`, `site/assets/illustrations/poppy-hands.jpg`, `site/assets/svg/*.svg`

- [ ] **Step 1: Initialize git and create folders**

```bash
cd "C:/Users/panda/claude/Michael & Kathy Wedding"
git init
mkdir -p site/css site/js site/assets/photos site/assets/illustrations site/assets/svg lib netlify/functions test
```

Expected: `Initialized empty Git repository`.

- [ ] **Step 2: Create `.gitignore`**

```gitignore
node_modules/
.env
.dev-rsvps.json
.netlify/
.superpowers/
.playwright-mcp/
# large original downloads at the project root only (the leading slash matters:
# the web-sized copies under site/assets/ must stay tracked)
/assets/vecteezy_*
/assets/photos/
/assets/illustrations/
```

- [ ] **Step 3: Create `package.json`**

```json
{
  "name": "michael-kathy-wedding",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test test/",
    "dev": "netlify dev --port 8888"
  },
  "engines": { "node": ">=20" }
}
```

- [ ] **Step 4: Install dependencies**

```bash
npm install googleapis
npm install --save-dev jsdom netlify-cli
```

Expected: `added ... packages`, and `package.json` now lists `dependencies.googleapis` and `devDependencies.jsdom`, `devDependencies.netlify-cli`.

- [ ] **Step 5: Create `netlify.toml`**

```toml
[build]
  publish = "site"

[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    X-Frame-Options = "DENY"
```

- [ ] **Step 6: Create `.env.example`**

```bash
# Copy to .env for local development (netlify dev loads it automatically).
# Production values are set in the Netlify dashboard instead.
VENUE_NAME=Sample Venue Name
VENUE_ADDRESS=123 Sample Street, Chicago, IL 60601
# Leave the Google values empty locally to use the JSON-file store (.dev-rsvps.json).
GOOGLE_SHEET_ID=
GOOGLE_CLIENT_EMAIL=
GOOGLE_PRIVATE_KEY=
```

- [ ] **Step 7: Copy the approved, non-AI assets into `site/`**

```bash
cp "assets/photos/macrame-panel.jpg" site/assets/photos/
cp "assets/photos/terracotta-fabric.jpg" site/assets/photos/
cp "assets/illustrations/vase-arch.jpg" "assets/illustrations/leaf-rainbow.jpg" "assets/illustrations/poppy-hands.jpg" site/assets/illustrations/
cp assets/svg/*.svg site/assets/svg/
ls site/assets/photos site/assets/illustrations site/assets/svg
```

Expected: 2 photos, 3 illustrations, 6 SVGs. Do NOT copy `terracotta-dried-flower.jpg` or `pampas-plume.jpg` (Vecteezy marks them AI-generated).

- [ ] **Step 8: Verify the test runner works with no tests yet**

Run: `npm test`
Expected: exits 0 with `tests 0` (the folder is empty). If it errors on the empty folder, create `test/.gitkeep` and re-run.

- [ ] **Step 9: Commit**

```bash
git add .gitignore package.json package-lock.json netlify.toml .env.example site docs
git commit -m "chore: scaffold project, add approved assets and design docs"
```

---

### Task 2: Countdown math (TDD)

**Files:**
- Create: `site/js/countdown.js`
- Test: `test/countdown.test.js`

- [ ] **Step 1: Write the failing test**

```js
// test/countdown.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { timeLeft, pad, WEDDING_START } from '../site/js/countdown.js';

test('wedding start is August 21, 2027 at midnight Chicago time (CDT, UTC-5)', () => {
  assert.equal(WEDDING_START, '2027-08-21T00:00:00-05:00');
});

test('314 days remain on October 11, 2026', () => {
  const t = timeLeft('2026-10-11T00:00:00-05:00', WEDDING_START);
  assert.equal(t.days, 314);
  assert.equal(t.hours, 0);
  assert.equal(t.done, false);
});

test('splits hours, minutes, seconds', () => {
  const target = '2027-08-21T00:00:00-05:00';
  const now = new Date(new Date(target).getTime() - (3600 + 60 + 1) * 1000);
  assert.deepEqual(timeLeft(now, target), { done: false, days: 0, hours: 1, minutes: 1, seconds: 1 });
});

test('is done at and after the target, never negative', () => {
  assert.deepEqual(timeLeft(WEDDING_START, WEDDING_START), { done: true, days: 0, hours: 0, minutes: 0, seconds: 0 });
  assert.equal(timeLeft('2030-01-01T00:00:00Z', WEDDING_START).done, true);
});

test('pad left-pads to two digits', () => {
  assert.equal(pad(7), '07');
  assert.equal(pad(42), '42');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/countdown.test.js`
Expected: FAIL, `Cannot find module '../site/js/countdown.js'`.

- [ ] **Step 3: Write the implementation**

```js
// site/js/countdown.js
export const WEDDING_START = '2027-08-21T00:00:00-05:00';

export function pad(n) {
  return String(n).padStart(2, '0');
}

export function timeLeft(now, target) {
  const ms = new Date(target).getTime() - new Date(now).getTime();
  if (ms <= 0) return { done: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  const s = Math.floor(ms / 1000);
  return {
    done: false,
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

// Fills [data-unit="days|hours|minutes|seconds"] elements inside `root` and ticks every second.
// Returns a function that stops the timer.
export function startCountdown(root, target = WEDDING_START, now = () => new Date()) {
  const set = (unit, value) => {
    const el = root.querySelector(`[data-unit="${unit}"]`);
    if (el) el.textContent = unit === 'days' ? String(value) : pad(value);
  };
  let id;
  const tick = () => {
    const t = timeLeft(now(), target);
    set('days', t.days);
    set('hours', t.hours);
    set('minutes', t.minutes);
    set('seconds', t.seconds);
    if (t.done) clearInterval(id);
  };
  id = setInterval(tick, 1000);
  tick();
  return () => clearInterval(id);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/countdown.test.js`
Expected: PASS, `tests 5`, `pass 5`.

- [ ] **Step 5: Commit**

```bash
git add site/js/countdown.js test/countdown.test.js
git commit -m "feat: countdown math and live countdown"
```

---

### Task 3: Content file and content binding (TDD)

**Files:**
- Create: `site/js/content.js`, `site/js/render.js`
- Test: `test/render.test.js`

- [ ] **Step 1: Write the failing test**

```js
// test/render.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { getPath, applyContent } from '../site/js/render.js';

const content = {
  a: { b: 'hello', list: [{ name: 'First' }, { name: '[SECOND TBD]' }] },
  link: 'https://example.com/x',
  linkTbd: '[LINK TBD]',
};

test('getPath reads nested keys and array indexes', () => {
  assert.equal(getPath(content, 'a.b'), 'hello');
  assert.equal(getPath(content, 'a.list.1.name'), '[SECOND TBD]');
  assert.equal(getPath(content, 'a.nope.deeper'), undefined);
});

test('applyContent fills text and flags bracketed placeholders as .tbd', () => {
  const { document } = new JSDOM(
    '<p id="x" data-c="a.b"></p><p id="y" data-c="a.list.1.name"></p><p id="z" data-c="a.missing"></p>'
  ).window;
  applyContent(document, content);
  assert.equal(document.getElementById('x').textContent, 'hello');
  assert.equal(document.getElementById('x').classList.contains('tbd'), false);
  assert.equal(document.getElementById('y').textContent, '[SECOND TBD]');
  assert.equal(document.getElementById('y').classList.contains('tbd'), true);
  assert.equal(document.getElementById('z').textContent, '[MISSING: a.missing]');
  assert.equal(document.getElementById('z').classList.contains('tbd'), true);
});

test('applyContent sets real links and neutralizes placeholder links', () => {
  const { document } = new JSDOM(
    '<a id="g" data-c-href="link">go</a><a id="p" data-c-href="linkTbd">tbd</a>'
  ).window;
  applyContent(document, content);
  assert.equal(document.getElementById('g').getAttribute('href'), 'https://example.com/x');
  assert.equal(document.getElementById('p').getAttribute('href'), '#');
  assert.equal(document.getElementById('p').classList.contains('tbd'), true);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/render.test.js`
Expected: FAIL, `Cannot find module '../site/js/render.js'`.

- [ ] **Step 3: Write `render.js`**

```js
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/render.test.js`
Expected: PASS, `tests 3`.

- [ ] **Step 5: Write `content.js` (the single source of wedding facts)**

```js
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
    extra: { time: '[TIME TBD]', title: '[ANOTHER EVENT TBD]' },
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
  // Vecteezy free license requires attribution. Verify the exact snippet on each photo's page
  // ("How?" link) and update/add entries here; the footer renders this list on every page.
  credits: [
    { label: 'Boho Stock photos by Vecteezy', url: 'https://www.vecteezy.com/free-photos/boho' },
  ],
};
```

- [ ] **Step 6: Commit**

```bash
git add site/js/render.js site/js/content.js test/render.test.js
git commit -m "feat: content file and data-c binding"
```

---

### Task 4: Themes, base styles, and the preview switcher (TDD for theme logic)

**Files:**
- Create: `site/css/theme.css`, `site/css/base.css`, `site/js/theme.js`, `site/js/theme-switcher.js`
- Test: `test/theme.test.js`

- [ ] **Step 1: Write the failing test**

```js
// test/theme.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, DEFAULT_THEME, isPreview, resolveTheme, setTheme } from '../site/js/theme.js';

const makeStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};

test('sage is the default and all three themes exist', () => {
  assert.equal(DEFAULT_THEME, 'sage');
  assert.deepEqual(THEMES, ['sage', 'terracotta', 'candlelit']);
});

test('guests (no ?preview) always get the default theme, even if one was stored', () => {
  const s = makeStorage();
  s.setItem('mk_theme', 'candlelit');
  assert.equal(isPreview('', s), false);
  assert.equal(resolveTheme({ search: '', storage: s }), 'sage');
});

test('?preview turns preview mode on and it persists for the session', () => {
  const s = makeStorage();
  assert.equal(isPreview('?preview', s), true);
  assert.equal(isPreview('', s), true); // later pages without the param
});

test('in preview mode the stored theme is used, ignoring invalid values', () => {
  const s = makeStorage();
  isPreview('?preview', s);
  setTheme(s, 'terracotta');
  assert.equal(resolveTheme({ search: '', storage: s }), 'terracotta');
  s.setItem('mk_theme', 'hotpink');
  assert.equal(resolveTheme({ search: '', storage: s }), 'sage');
});

test('setTheme rejects unknown themes', () => {
  const s = makeStorage();
  assert.throws(() => setTheme(s, 'hotpink'));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/theme.test.js`
Expected: FAIL, `Cannot find module '../site/js/theme.js'`.

- [ ] **Step 3: Write `theme.js`**

```js
// site/js/theme.js
export const THEMES = ['sage', 'terracotta', 'candlelit'];
export const DEFAULT_THEME = 'sage';
const PREVIEW_KEY = 'mk_preview';
const THEME_KEY = 'mk_theme';

export function isPreview(search, storage) {
  if (/[?&]preview(=|&|$)/.test(search || '')) {
    storage.setItem(PREVIEW_KEY, '1');
    return true;
  }
  return storage.getItem(PREVIEW_KEY) === '1';
}

export function resolveTheme({ search, storage }) {
  if (!isPreview(search, storage)) return DEFAULT_THEME;
  const stored = storage.getItem(THEME_KEY);
  return THEMES.includes(stored) ? stored : DEFAULT_THEME;
}

export function setTheme(storage, name) {
  if (!THEMES.includes(name)) throw new Error(`Unknown theme: ${name}`);
  storage.setItem(THEME_KEY, name);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/theme.test.js`
Expected: PASS, `tests 5`.

- [ ] **Step 5: Write `theme-switcher.js` (browser only, shown only in preview mode)**

```js
// site/js/theme-switcher.js
import { THEMES, resolveTheme, isPreview, setTheme } from './theme.js';

export function initTheme(win = window) {
  const storage = win.localStorage;
  const doc = win.document;
  const apply = (name) => { doc.documentElement.dataset.theme = name; };
  apply(resolveTheme({ search: win.location.search, storage }));

  if (!isPreview(win.location.search, storage)) return;

  const box = doc.createElement('div');
  box.className = 'theme-switcher';
  box.setAttribute('role', 'group');
  box.setAttribute('aria-label', 'Preview theme');
  const label = doc.createElement('span');
  label.textContent = 'Preview theme';
  box.append(label);
  THEMES.forEach((name) => {
    const b = doc.createElement('button');
    b.type = 'button';
    b.textContent = name;
    b.addEventListener('click', () => { setTheme(storage, name); apply(name); });
    box.append(b);
  });
  doc.body.append(box);
}
```

- [ ] **Step 6: Write `site/css/theme.css`**

```css
/* All colors the site uses. To change a theme, edit values here only. Sage is the default. */
:root,
[data-theme="sage"] {
  --bg: #f7f0e3;
  --card: #fffaf0;
  --border: #d9d2bd;
  --text: #3b3a2a;
  --text-2: #5b5a45;
  --heading: #4f5b3d;
  --link: #3f4a30;
  --accent: #a8472a;
  --band: #4f5b3d;
  --band-text: #f7f0e3;
  --band-text-2: #d8e0bf;
  --band-line: #8a9a6b;
  --btn: #a8472a;
  --btn-text: #ffffff;
  --btn-border: #a8472a;
  --ph: #e4e8d2;
  --ph-border: #8a9a6b;
  --arch-border: #d9c9a3;
  --error: #a12a1d;
}

[data-theme="terracotta"] {
  --bg: #f5e6d8;
  --card: #faf0e6;
  --border: #e0c3a8;
  --text: #5a2e1c;
  --text-2: #6d4231;
  --heading: #8f3a21;
  --link: #5a2e1c;
  --accent: #a8472a;
  --band: #7a3a22;
  --band-text: #f7f0e3;
  --band-text-2: #f0d3bf;
  --band-line: #c98b66;
  --btn: #a8472a;
  --btn-text: #ffffff;
  --btn-border: #f7f0e3;
  --ph: #e7c7a8;
  --ph-border: #c98b66;
  --arch-border: #e0c3a8;
  --error: #a12a1d;
}

[data-theme="candlelit"] {
  --bg: #2a1a12;
  --card: #3a2418;
  --border: #5a3a28;
  --text: #f3dcc0;
  --text-2: #e0c7a8;
  --heading: #e0a57a;
  --link: #e0a57a;
  --accent: #e0a57a;
  --band: #1f130d;
  --band-text: #f6e3c8;
  --band-text-2: #e0a57a;
  --band-line: #8a6a4a;
  --btn: #d9a066;
  --btn-text: #2a1a12;
  --btn-border: #d9a066;
  --ph: #4a2f20;
  --ph-border: #8a6a4a;
  --arch-border: #5a3a28;
  --error: #ff9d8f;
}
```

- [ ] **Step 7: Write `site/css/base.css`**

```css
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Jost:wght@400;500&family=Pinyon+Script&display=swap');

*, *::before, *::after { box-sizing: border-box; }
[hidden] { display: none !important; }
body { margin: 0; background: var(--bg); color: var(--text); font-family: 'Jost', sans-serif; line-height: 1.6; min-height: 100vh; display: flex; flex-direction: column; }
main { flex: 1; }
a { color: var(--link); }
a:hover { color: var(--accent); }
img { max-width: 100%; }
h1, h2, h3 { margin: 0; }
p { margin: 0 0 12px; }

.script { font-family: 'Pinyon Script', cursive; font-weight: 400; }
.serif { font-family: 'Cormorant Garamond', serif; }
.eyebrow { font-size: 12px; letter-spacing: 3px; text-transform: uppercase; color: var(--accent); }
.tbd { border-bottom: 1px dotted currentColor; }

/* nav */
.nav { display: flex; flex-wrap: wrap; gap: 16px 36px; align-items: center; justify-content: space-between; padding: 24px 32px; border-bottom: 1px solid var(--border); background: var(--bg); }
.nav .logo { font-family: 'Pinyon Script', cursive; font-size: 30px; text-decoration: none; color: var(--heading); }
.nav .links { display: flex; flex-wrap: wrap; gap: 8px 28px; font-size: 14px; letter-spacing: 2px; text-transform: uppercase; }
.nav .links a { text-decoration: none; }
.nav .links a[aria-current="page"] { font-weight: 500; color: var(--accent); }
.nav .links a.cta { font-weight: 500; color: var(--accent); border-bottom: 1px solid var(--accent); }

/* bands and hero */
.band { background: var(--band); color: var(--band-text); text-align: center; padding: 44px 24px 48px; }
.band h1 { font-size: clamp(52px, 9vw, 76px); color: var(--band-text); line-height: 1.1; }
.band .eyebrow { color: var(--band-text-2); }
.hero { background: var(--band); color: var(--band-text); }
.hero-inner { max-width: 1100px; margin: 0 auto; padding: 64px 24px 0; display: flex; flex-wrap: wrap; gap: 40px; align-items: flex-end; justify-content: center; }
.hero-text { flex: 1 1 420px; min-width: 0; padding-bottom: 64px; }
.hero .eyebrow { font-size: 14px; letter-spacing: 5px; color: var(--band-text-2); }
.hero h1 { font-size: clamp(56px, 11vw, 96px); line-height: 1.05; color: var(--band-text); margin-top: 10px; }
.hero .when { font-family: 'Cormorant Garamond', serif; font-size: 28px; letter-spacing: 4px; margin-top: 14px; text-transform: uppercase; }
.hero .note { margin-top: 16px; max-width: 420px; color: var(--band-text-2); }
.arch { flex: 0 0 300px; width: 300px; height: 420px; border-radius: 150px 150px 0 0; overflow: hidden; border: 3px solid var(--arch-border); border-bottom: 0; }
.arch img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: center 22%; }

.countdown { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 32px; }
.count-box { min-width: 84px; text-align: center; padding: 14px 10px; border: 1px solid var(--band-line); }
.count-box b { display: block; font-family: 'Cormorant Garamond', serif; font-size: 40px; font-weight: 500; line-height: 1; }
.count-box span { display: block; margin-top: 6px; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: var(--band-text-2); }

/* layout */
.container { max-width: 1100px; margin: 0 auto; padding: 56px 24px 64px; }
.container--narrow { max-width: 760px; }
.grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }
.grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; }
.stack > * + * { margin-top: 24px; }
.section-title { font-family: 'Cormorant Garamond', serif; font-weight: 500; font-size: 34px; color: var(--heading); margin: 44px 0 16px; }
.center { text-align: center; }

/* cards and buttons */
.card { background: var(--card); border: 1px solid var(--border); padding: 28px; text-align: center; }
.card--left { text-align: left; }
.card h3 { font-family: 'Cormorant Garamond', serif; font-weight: 500; font-size: 32px; color: var(--heading); margin: 8px 0; }
.card .big { font-family: 'Cormorant Garamond', serif; font-size: 34px; color: var(--heading); margin: 8px 0; }
.card-img { display: block; width: 100%; height: 140px; object-fit: cover; margin-bottom: 16px; }
.btn { display: inline-block; padding: 16px 44px; background: var(--btn); color: var(--btn-text); border: 2px solid var(--btn-border); text-decoration: none; font: inherit; font-size: 15px; letter-spacing: 3px; text-transform: uppercase; border-radius: 2px; cursor: pointer; }
.btn:hover { color: var(--btn-text); filter: brightness(1.08); }
.btn--ghost { background: transparent; color: var(--accent); border-color: var(--accent); }
.btn--ghost:hover { color: var(--accent); }
.btn[disabled] { opacity: .6; cursor: wait; }

/* photo placeholders */
.photo-ph { background: var(--ph); border: 2px dashed var(--ph-border); display: flex; align-items: center; justify-content: center; text-align: center; padding: 12px; font-size: 12px; letter-spacing: 3px; text-transform: uppercase; color: var(--text-2); }
.photo-ph--card { height: 140px; margin-bottom: 16px; }
.photo-ph--tall { aspect-ratio: 3 / 4; }

/* timeline */
.timeline { list-style: none; margin: 0; padding: 0; }
.timeline li { position: relative; display: flex; gap: 28px; padding-bottom: 36px; }
.timeline li:not(:last-child)::before { content: ""; position: absolute; left: 27px; top: 56px; bottom: 0; width: 2px; background: var(--band-line); }
.tl-icon { flex: 0 0 56px; width: 56px; height: 56px; border-radius: 50%; background: var(--band); color: var(--band-text); display: flex; align-items: center; justify-content: center; }
.tl-icon--add { background: transparent; border: 2px dashed var(--ph-border); color: var(--text-2); font-size: 24px; }
.tl-body { flex: 1; min-width: 0; padding-top: 4px; }
.tl-body h2 { font-family: 'Cormorant Garamond', serif; font-weight: 500; font-size: 32px; color: var(--heading); margin: 4px 0 0; }
.deco { display: block; margin: 0 auto 32px; width: 220px; mix-blend-mode: multiply; }

/* venue */
.venue-card { border: 2px dashed var(--ph-border); padding: 26px; text-align: center; }
.venue-card--open { border-style: solid; background: var(--card); }
.venue-card .big { font-family: 'Cormorant Garamond', serif; font-size: 28px; color: var(--heading); margin: 6px 0; }
.lookup { margin-top: 16px; text-align: left; }
.lookup summary { cursor: pointer; color: var(--link); }
.lookup form { margin-top: 12px; display: grid; gap: 12px; }

/* forms */
.form { background: var(--card); border: 1px solid var(--border); padding: 36px 32px; display: grid; gap: 22px; }
.field { display: grid; gap: 6px; }
.field label, .field legend { font-size: 12px; letter-spacing: 3px; text-transform: uppercase; color: var(--accent); }
.field input[type="text"], .field input[type="email"], .field textarea { width: 100%; padding: 14px; font: inherit; color: #3b3a2a; background: #ffffff; border: 1px solid var(--ph-border); border-radius: 2px; }
.field fieldset { border: 0; margin: 0; padding: 0; display: grid; gap: 10px; }
.field .radio { display: flex; align-items: center; gap: 12px; font-size: 17px; }
.error { color: var(--error); font-size: 14px; margin: 0; }
.status { margin: 0; font-size: 15px; }
.hp { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }

/* footer and switcher */
.footer { border-top: 1px solid var(--border); text-align: center; padding: 24px; font-size: 14px; letter-spacing: 2px; color: var(--text-2); }
.footer .credits { margin-top: 8px; font-size: 12px; letter-spacing: 1px; }
.theme-switcher { position: fixed; right: 16px; bottom: 16px; z-index: 10; display: flex; gap: 6px; align-items: center; padding: 8px 10px; background: var(--card); color: var(--text); border: 1px solid var(--border); border-radius: 6px; font-size: 12px; }
.theme-switcher button { padding: 6px 10px; font: inherit; text-transform: capitalize; color: var(--text); background: transparent; border: 1px solid var(--ph-border); border-radius: 4px; cursor: pointer; }

@media (max-width: 760px) {
  .grid-2, .grid-3 { grid-template-columns: 1fr; }
  .nav { padding: 16px 20px; }
  .container { padding: 40px 20px 48px; }
  .arch { flex-basis: 100%; width: 100%; max-width: 360px; margin: 0 auto; }
  .form { padding: 24px 20px; }
  .timeline li { gap: 18px; }
}
```

- [ ] **Step 8: Commit**

```bash
git add site/css site/js/theme.js site/js/theme-switcher.js test/theme.test.js
git commit -m "feat: three themes, base styles, preview-only theme switcher"
```

---

### Task 5: Site chrome (nav, footer, credits) (TDD)

**Files:**
- Create: `site/js/chrome.js`
- Test: `test/chrome.test.js`

- [ ] **Step 1: Write the failing test**

```js
// test/chrome.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { renderChrome } from '../site/js/chrome.js';
import { content } from '../site/js/content.js';

function setup() {
  const { document } = new JSDOM('<div id="site-nav"></div><div id="site-footer"></div>').window;
  return document;
}

test('nav lists every page and marks the current one', () => {
  const doc = setup();
  renderChrome(doc, content, 'travel');
  const links = [...doc.querySelectorAll('#site-nav .links a')];
  assert.equal(links.length, content.nav.length);
  const current = links.filter((a) => a.getAttribute('aria-current') === 'page');
  assert.equal(current.length, 1);
  assert.equal(current[0].textContent, 'Travel');
  assert.ok(links.at(-1).classList.contains('cta'));
  assert.equal(links.at(-1).textContent, 'RSVP');
});

test('footer shows the deadline, hashtag, and every photo credit as a link', () => {
  const doc = setup();
  renderChrome(doc, content, 'home');
  const footer = doc.getElementById('site-footer');
  assert.match(footer.textContent, /RSVP BY/);
  assert.match(footer.textContent, /#\[HASHTAG TBD\]/);
  const credits = [...footer.querySelectorAll('.credits a')];
  assert.equal(credits.length, content.credits.length);
  assert.equal(credits[0].getAttribute('href'), content.credits[0].url);
  assert.equal(credits[0].textContent, content.credits[0].label);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/chrome.test.js`
Expected: FAIL, `Cannot find module '../site/js/chrome.js'`.

- [ ] **Step 3: Write `chrome.js`**

```js
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

export function renderChrome(doc, content, currentPage) {
  const navHost = doc.getElementById('site-nav');
  if (navHost) {
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
  }

  const footHost = doc.getElementById('site-footer');
  if (footHost) {
    const credits = el(doc, 'div', { class: 'credits' }, 'Photos and art via ');
    content.credits.forEach((c, i) => {
      if (i > 0) credits.append(', ');
      credits.append(el(doc, 'a', { href: c.url, rel: 'noopener' }, c.label));
    });
    const deadline = el(doc, 'span', { class: content.rsvp.deadline.startsWith('[') ? 'tbd' : false }, content.rsvp.deadline);
    footHost.replaceChildren(
      el(doc, 'footer', { class: 'footer' },
        el(doc, 'div', {}, 'RSVP BY ', deadline, ` · ${content.couple.hashtag}`),
        credits)
    );
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/chrome.test.js`
Expected: PASS, `tests 2`.

- [ ] **Step 5: Commit**

```bash
git add site/js/chrome.js test/chrome.test.js
git commit -m "feat: nav and footer with photo credits"
```

---

### Task 6: Venue store and venue UI (TDD)

**Files:**
- Create: `site/js/venue-store.js`, `site/js/venue-ui.js`
- Test: `test/venue.test.js`

- [ ] **Step 1: Write the failing test**

```js
// test/venue.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createVenueStore } from '../site/js/venue-store.js';
import { showVenue } from '../site/js/venue-ui.js';

const makeStorage = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
};

test('store returns null until a venue is saved', () => {
  const store = createVenueStore(makeStorage());
  assert.equal(store.get(), null);
});

test('store saves and returns a venue, and clears it', () => {
  const store = createVenueStore(makeStorage());
  store.set({ name: 'The Hall', address: '1 Main St' });
  assert.deepEqual(store.get(), { name: 'The Hall', address: '1 Main St' });
  store.clear();
  assert.equal(store.get(), null);
});

test('store ignores corrupt or wrongly shaped data', () => {
  const s = makeStorage();
  s.setItem('mk_venue', '{not json');
  assert.equal(createVenueStore(s).get(), null);
  s.setItem('mk_venue', JSON.stringify({ name: 5 }));
  assert.equal(createVenueStore(s).get(), null);
});

test('store survives storage that throws (private browsing)', () => {
  const broken = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };
  const store = createVenueStore(broken);
  assert.equal(store.get(), null);
  assert.doesNotThrow(() => store.set({ name: 'a', address: 'b' }));
});

const html = `
  <div id="l" data-venue-state="locked"></div>
  <div id="r" data-venue-state="revealed" hidden>
    <span data-venue-name></span><span data-venue-address></span>
  </div>`;

test('showVenue(null) shows locked blocks and hides revealed ones', () => {
  const { document } = new JSDOM(html).window;
  showVenue(document, null);
  assert.equal(document.getElementById('l').hidden, false);
  assert.equal(document.getElementById('r').hidden, true);
});

test('showVenue(venue) reveals and fills the name and address', () => {
  const { document } = new JSDOM(html).window;
  showVenue(document, { name: 'The Hall', address: '1 Main St' });
  assert.equal(document.getElementById('l').hidden, true);
  assert.equal(document.getElementById('r').hidden, false);
  assert.equal(document.querySelector('[data-venue-name]').textContent, 'The Hall');
  assert.equal(document.querySelector('[data-venue-address]').textContent, '1 Main St');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/venue.test.js`
Expected: FAIL, `Cannot find module`.

- [ ] **Step 3: Write `venue-store.js`**

```js
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
```

- [ ] **Step 4: Write `venue-ui.js`**

```js
// site/js/venue-ui.js
export function showVenue(doc, venue) {
  doc.querySelectorAll('[data-venue-state="locked"]').forEach((el) => { el.hidden = !!venue; });
  doc.querySelectorAll('[data-venue-state="revealed"]').forEach((el) => { el.hidden = !venue; });
  if (venue) {
    doc.querySelectorAll('[data-venue-name]').forEach((el) => { el.textContent = venue.name; el.classList.toggle('tbd', venue.name.startsWith('[')); });
    doc.querySelectorAll('[data-venue-address]').forEach((el) => { el.textContent = venue.address; el.classList.toggle('tbd', venue.address.startsWith('[')); });
  }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `node --test test/venue.test.js`
Expected: PASS, `tests 6`.

- [ ] **Step 6: Commit**

```bash
git add site/js/venue-store.js site/js/venue-ui.js test/venue.test.js
git commit -m "feat: remember revealed venue and toggle venue blocks"
```

---

### Task 7: RSVP and lookup form behavior (TDD)

**Files:**
- Create: `site/js/rsvp.js`
- Test: `test/rsvp-ui.test.js`

The server contract these forms rely on (built in Tasks 9 to 11):
- `POST /api/rsvp` body `{name,email,attending:'yes'|'no',dietary,notes,website}` returns JSON. Success: `{ok:true, attending:boolean, venue?:{name,address}}`. Validation failure: HTTP 400 `{ok:false, errors:{field:message}}`.
- `POST /api/lookup` body `{name,email}` returns `{ok:true, found:boolean, venue?:{name,address}}`.

- [ ] **Step 1: Write the failing test**

```js
// test/rsvp-ui.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { initRsvpForm, initLookup } from '../site/js/rsvp.js';

const rsvpHtml = `
<form id="rsvp-form">
  <input name="name" value="Ada Lovelace"><span data-error="name"></span>
  <input name="email" value="ada@example.com"><span data-error="email"></span>
  <input type="radio" name="attending" value="yes" checked>
  <input type="radio" name="attending" value="no">
  <span data-error="attending"></span>
  <input name="dietary" value=""><input name="notes" value="">
  <input name="website" value="">
  <button id="submit" type="submit">Send RSVP</button>
  <p id="rsvp-error" hidden></p>
</form>
<section id="rsvp-yes" hidden><span data-venue-name></span><span data-venue-address></span></section>
<section id="rsvp-no" hidden></section>
<div data-venue-state="locked"></div><div data-venue-state="revealed" hidden><span data-venue-name></span><span data-venue-address></span></div>`;

function memStore() {
  let v = null;
  return { get: () => v, set: (x) => { v = x; }, clear: () => { v = null; } };
}
const jsonResponse = (status, body) => ({ ok: status < 400, status, json: async () => body });
const flush = () => new Promise((r) => setTimeout(r, 0));

function submit(doc) {
  doc.getElementById('rsvp-form').dispatchEvent(new doc.defaultView.Event('submit', { cancelable: true, bubbles: true }));
}

test('yes RSVP stores and shows the venue, hides the form', async () => {
  const { document } = new JSDOM(rsvpHtml).window;
  const store = memStore();
  const calls = [];
  const fetchFn = async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return jsonResponse(200, { ok: true, attending: true, venue: { name: 'The Hall', address: '1 Main St' } }); };
  initRsvpForm(document, { fetchFn, store, contact: 'a@b.c' });
  submit(document);
  await flush();
  assert.equal(calls[0].url, '/api/rsvp');
  assert.equal(calls[0].body.attending, 'yes');
  assert.equal(calls[0].body.email, 'ada@example.com');
  assert.deepEqual(store.get(), { name: 'The Hall', address: '1 Main St' });
  assert.equal(document.getElementById('rsvp-form').hidden, true);
  assert.equal(document.getElementById('rsvp-yes').hidden, false);
  assert.equal(document.querySelector('#rsvp-yes [data-venue-name]').textContent, 'The Hall');
  assert.equal(document.getElementById('rsvp-no').hidden, true);
});

test('no RSVP shows the decline message and never stores a venue', async () => {
  const { document } = new JSDOM(rsvpHtml).window;
  document.querySelector('input[value="no"]').checked = true;
  const store = memStore();
  const fetchFn = async () => jsonResponse(200, { ok: true, attending: false });
  initRsvpForm(document, { fetchFn, store, contact: 'a@b.c' });
  submit(document);
  await flush();
  assert.equal(store.get(), null);
  assert.equal(document.getElementById('rsvp-no').hidden, false);
  assert.equal(document.getElementById('rsvp-yes').hidden, true);
});

test('validation errors show per field and keep the form and entries', async () => {
  const { document } = new JSDOM(rsvpHtml).window;
  const fetchFn = async () => jsonResponse(400, { ok: false, errors: { email: 'Please enter a valid email.' } });
  initRsvpForm(document, { fetchFn, store: memStore(), contact: 'a@b.c' });
  submit(document);
  await flush();
  assert.equal(document.querySelector('[data-error="email"]').textContent, 'Please enter a valid email.');
  assert.equal(document.getElementById('rsvp-form').hidden, false);
  assert.equal(document.querySelector('input[name="name"]').value, 'Ada Lovelace');
  assert.equal(document.getElementById('submit').disabled, false);
});

test('network failure shows a fallback with the contact info and keeps entries', async () => {
  const { document } = new JSDOM(rsvpHtml).window;
  const fetchFn = async () => { throw new Error('offline'); };
  initRsvpForm(document, { fetchFn, store: memStore(), contact: 'kathy@example.com' });
  submit(document);
  await flush();
  const msg = document.getElementById('rsvp-error');
  assert.equal(msg.hidden, false);
  assert.match(msg.textContent, /kathy@example\.com/);
  assert.equal(document.querySelector('input[name="name"]').value, 'Ada Lovelace');
  assert.equal(document.getElementById('submit').disabled, false);
});

const lookupHtml = `
<div data-venue-state="locked">
  <form id="lookup-form">
    <input name="name" value="Ada Lovelace"><input name="email" value="ada@example.com">
    <button type="submit">Look up</button><p id="lookup-msg"></p>
  </form>
</div>
<div data-venue-state="revealed" hidden><span data-venue-name></span><span data-venue-address></span></div>`;

test('lookup success saves the venue and reveals it', async () => {
  const { document } = new JSDOM(lookupHtml).window;
  const store = memStore();
  const fetchFn = async (url) => { assert.equal(url, '/api/lookup'); return jsonResponse(200, { ok: true, found: true, venue: { name: 'The Hall', address: '1 Main St' } }); };
  initLookup(document, { fetchFn, store });
  document.getElementById('lookup-form').dispatchEvent(new document.defaultView.Event('submit', { cancelable: true, bubbles: true }));
  await flush();
  assert.deepEqual(store.get(), { name: 'The Hall', address: '1 Main St' });
  assert.equal(document.querySelector('[data-venue-state="revealed"]').hidden, false);
});

test('lookup with no match shows a message and reveals nothing', async () => {
  const { document } = new JSDOM(lookupHtml).window;
  const store = memStore();
  const fetchFn = async () => jsonResponse(200, { ok: true, found: false });
  initLookup(document, { fetchFn, store });
  document.getElementById('lookup-form').dispatchEvent(new document.defaultView.Event('submit', { cancelable: true, bubbles: true }));
  await flush();
  assert.equal(store.get(), null);
  assert.match(document.getElementById('lookup-msg').textContent, /couldn't find/i);
  assert.equal(document.querySelector('[data-venue-state="revealed"]').hidden, true);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/rsvp-ui.test.js`
Expected: FAIL, `Cannot find module '../site/js/rsvp.js'`.

- [ ] **Step 3: Write `rsvp.js`**

```js
// site/js/rsvp.js
import { showVenue } from './venue-ui.js';

function fieldValues(form) {
  const get = (n) => form.querySelector(`[name="${n}"]`);
  const checked = form.querySelector('[name="attending"]:checked');
  return {
    name: get('name')?.value ?? '',
    email: get('email')?.value ?? '',
    attending: checked ? checked.value : '',
    dietary: get('dietary')?.value ?? '',
    notes: get('notes')?.value ?? '',
    website: get('website')?.value ?? '', // honeypot, must stay empty for humans
  };
}

function clearErrors(doc) {
  doc.querySelectorAll('[data-error]').forEach((e) => { e.textContent = ''; });
}

export function initRsvpForm(doc, { fetchFn, store, contact }) {
  const form = doc.getElementById('rsvp-form');
  if (!form) return;
  const button = doc.getElementById('submit');
  const errorBox = doc.getElementById('rsvp-error');
  const yes = doc.getElementById('rsvp-yes');
  const no = doc.getElementById('rsvp-no');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors(doc);
    errorBox.hidden = true;
    button.disabled = true;
    try {
      const res = await fetchFn('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fieldValues(form)),
      });
      const data = await res.json();
      if (res.status === 400 && data && data.errors) {
        Object.entries(data.errors).forEach(([field, msg]) => {
          const slot = doc.querySelector(`[data-error="${field}"]`);
          if (slot) slot.textContent = msg;
        });
        button.disabled = false;
        return;
      }
      if (!res.ok || !data.ok) throw new Error('RSVP failed');

      form.hidden = true;
      if (data.attending && data.venue) {
        store.set(data.venue);
        showVenue(doc, data.venue);
        yes.hidden = false;
        no.hidden = true;
      } else {
        no.hidden = false;
        yes.hidden = true;
      }
    } catch {
      errorBox.textContent = `We couldn't send your RSVP right now. Please try again, or contact us at ${contact}.`;
      errorBox.hidden = false;
      button.disabled = false;
    }
  });
}

export function initLookup(doc, { fetchFn, store }) {
  const form = doc.getElementById('lookup-form');
  if (!form) return;
  const msg = doc.getElementById('lookup-msg');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    msg.textContent = '';
    const body = {
      name: form.querySelector('[name="name"]').value,
      email: form.querySelector('[name="email"]').value,
    };
    try {
      const res = await fetchFn('/api/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.ok && data.found && data.venue) {
        store.set(data.venue);
        showVenue(doc, data.venue);
      } else {
        msg.textContent = "We couldn't find a yes RSVP for that name and email. Check the spelling, or RSVP below.";
      }
    } catch {
      msg.textContent = "We couldn't look that up right now. Please try again in a moment.";
    }
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/rsvp-ui.test.js`
Expected: PASS, `tests 6`.

- [ ] **Step 5: Commit**

```bash
git add site/js/rsvp.js test/rsvp-ui.test.js
git commit -m "feat: RSVP form and venue lookup behavior"
```

---

### Task 8: Page entry point `main.js`

**Files:**
- Create: `site/js/main.js`

- [ ] **Step 1: Write `main.js`**

```js
// site/js/main.js
import { content } from './content.js';
import { applyContent } from './render.js';
import { renderChrome } from './chrome.js';
import { initTheme } from './theme-switcher.js';
import { startCountdown } from './countdown.js';
import { createVenueStore } from './venue-store.js';
import { showVenue } from './venue-ui.js';
import { initRsvpForm, initLookup } from './rsvp.js';

function safeStorage() {
  try { return window.localStorage; } catch { return { getItem: () => null, setItem() {}, removeItem() {} }; }
}

function boot() {
  const page = document.body.dataset.page;
  initTheme(window);
  renderChrome(document, content, page);
  applyContent(document, content);

  const countdown = document.querySelector('[data-countdown]');
  if (countdown) startCountdown(countdown);

  const store = createVenueStore(safeStorage());
  showVenue(document, store.get());

  const fetchFn = (...args) => window.fetch(...args);
  initRsvpForm(document, { fetchFn, store, contact: content.couple.contact });
  initLookup(document, { fetchFn, store });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
```

Note: `initTheme` reads `window.localStorage` directly. If storage throws (rare private-mode browsers), the theme code will throw before the rest of `boot()` runs. Guard it in the next step.

- [ ] **Step 2: Make theme init storage-safe**

In `site/js/theme-switcher.js`, replace the line `const storage = win.localStorage;` with:

```js
  let storage;
  try { storage = win.localStorage; } catch { storage = { getItem: () => null, setItem() {} }; }
```

- [ ] **Step 3: Run the whole suite**

Run: `npm test`
Expected: all tests pass, none fail.

- [ ] **Step 4: Commit**

```bash
git add site/js/main.js site/js/theme-switcher.js
git commit -m "feat: page entry point wiring content, theme, countdown, venue, forms"
```

---

### Task 9: Home page

**Files:**
- Create: `site/index.html`

- [ ] **Step 1: Write `site/index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Michael &amp; Kathy · August 21, 2027</title>
  <meta name="description" content="Michael and Kathy are getting married on August 21, 2027 in Chicago.">
  <link rel="stylesheet" href="css/theme.css">
  <link rel="stylesheet" href="css/base.css">
</head>
<body data-page="home">
  <div id="site-nav"></div>
  <main>
    <header class="hero">
      <div class="hero-inner">
        <div class="hero-text">
          <div class="eyebrow">We're getting married</div>
          <h1 class="script" data-c="couple.names"></h1>
          <div class="when"><span data-c="couple.date"></span><br><span data-c="couple.city"></span></div>
          <div class="countdown" data-countdown aria-label="Time until the wedding">
            <div class="count-box"><b data-unit="days">0</b><span>Days</span></div>
            <div class="count-box"><b data-unit="hours">00</b><span>Hours</span></div>
            <div class="count-box"><b data-unit="minutes">00</b><span>Minutes</span></div>
            <div class="count-box"><b data-unit="seconds">00</b><span>Seconds</span></div>
          </div>
          <p style="margin-top:32px"><a class="btn" href="rsvp.html">RSVP</a></p>
          <p class="note">The venue is shared with guests once you RSVP yes.</p>
        </div>
        <div class="arch">
          <img src="assets/illustrations/vase-arch.jpg" alt="Illustration of a terracotta vase with leaves under an arch and sun">
        </div>
      </div>
    </header>

    <section class="container">
      <div class="grid-3">
        <div class="card">
          <div class="eyebrow">Ceremony</div>
          <div class="big" data-c="events.ceremony.time"></div>
          <p>Please arrive <span data-c="events.arrival.time"></span></p>
        </div>
        <div class="card">
          <div class="eyebrow">Reception</div>
          <div class="big" data-c="events.reception.time"></div>
          <p>Dinner, dancing, and candlelight</p>
        </div>
        <div class="card">
          <div class="eyebrow">Dress code</div>
          <div class="big" data-c="dress.code"></div>
          <p data-c="dress.note"></p>
        </div>
      </div>
    </section>
  </main>
  <div id="site-footer"></div>
  <script type="module" src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Start the dev server (background) and view the page**

Run (background): `npx netlify-cli dev --port 8888 --offline`
Expected: serves at `http://localhost:8888`. (`--offline` skips Netlify login for local work.)

Open `http://localhost:8888/` with the Playwright browser tool and take a screenshot.
Expected: olive hero with script names, 4-box countdown showing about 314 days, arch with the vase illustration, three cards with highlighted `[TBD]` placeholders, nav with Home marked, footer with RSVP deadline and the Vecteezy credit.

- [ ] **Step 3: Check at phone width**

Resize the browser to 390x844 and screenshot.
Expected: no horizontal scroll, hero text stacks above the arch, cards stack.

- [ ] **Step 4: Commit**

```bash
git add site/index.html
git commit -m "feat: home page"
```

---

### Task 10: Schedule page (timeline and venue slot)

**Files:**
- Create: `site/schedule.html`

- [ ] **Step 1: Write `site/schedule.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Schedule · Michael &amp; Kathy</title>
  <link rel="stylesheet" href="css/theme.css">
  <link rel="stylesheet" href="css/base.css">
</head>
<body data-page="schedule">
  <div id="site-nav"></div>
  <main>
    <header class="band">
      <div class="eyebrow" data-c="couple.dateLong"></div>
      <h1 class="script">The Day</h1>
    </header>

    <div class="container container--narrow">
      <img class="deco" src="assets/illustrations/leaf-rainbow.jpg" alt="">
      <ol class="timeline">
        <li>
          <div class="tl-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>
          </div>
          <div class="tl-body">
            <div class="eyebrow" data-c="events.arrival.time"></div>
            <h2>Guests arrive</h2>
            <p data-c="events.arrival.note"></p>
          </div>
        </li>
        <li>
          <div class="tl-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="9" cy="14" r="5"/><circle cx="15" cy="14" r="5"/><path d="M9 4l1.5 2L9 8 7.5 6z"/></svg>
          </div>
          <div class="tl-body">
            <div class="eyebrow" data-c="events.ceremony.time"></div>
            <h2>Ceremony</h2>
            <p data-c="events.ceremony.details"></p>
          </div>
        </li>
        <li>
          <div class="tl-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h10l-1 8a4 4 0 0 1-8 0z"/><path d="M12 15v6M8 21h8"/></svg>
          </div>
          <div class="tl-body">
            <div class="eyebrow" data-c="events.reception.time"></div>
            <h2>Reception</h2>
            <p>Dinner, dancing, and candlelight. <span data-c="events.reception.details"></span></p>
          </div>
        </li>
        <li>
          <div class="tl-icon tl-icon--add" aria-hidden="true">+</div>
          <div class="tl-body">
            <div class="eyebrow" data-c="events.extra.time"></div>
            <h2 data-c="events.extra.title"></h2>
            <p>Send-off, brunch, or anything else the couple adds.</p>
          </div>
        </li>
      </ol>

      <div class="grid-2" style="margin-top:44px">
        <div class="card card--left">
          <div class="eyebrow">Dress code</div>
          <div class="big" data-c="dress.code"></div>
          <p data-c="dress.note"></p>
        </div>

        <div>
          <div class="venue-card" data-venue-state="locked">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Locked" style="color:var(--accent)"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
            <div class="eyebrow" style="margin-top:8px">Venue · <span data-c="couple.city"></span></div>
            <div class="big">Revealed after you RSVP yes</div>
            <a class="btn" href="rsvp.html" style="padding:12px 28px;font-size:13px">RSVP</a>
            <details class="lookup">
              <summary>Already RSVP'd? Look up the venue</summary>
              <form id="lookup-form">
                <div class="field"><label for="lk-name">Full name</label><input id="lk-name" type="text" name="name" autocomplete="name" required></div>
                <div class="field"><label for="lk-email">Email</label><input id="lk-email" type="email" name="email" autocomplete="email" required></div>
                <button class="btn btn--ghost" type="submit" style="padding:12px 28px;font-size:13px">Look up</button>
                <p id="lookup-msg" class="status" role="status"></p>
              </form>
            </details>
          </div>

          <div class="venue-card venue-card--open" data-venue-state="revealed" hidden>
            <div class="eyebrow">Venue</div>
            <div class="big" data-venue-name></div>
            <p data-venue-address></p>
          </div>
        </div>
      </div>
    </div>
  </main>
  <div id="site-footer"></div>
  <script type="module" src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: View and verify**

Open `http://localhost:8888/schedule.html` and screenshot.
Expected: olive "The Day" band, leafy rainbow ornament, timeline with 4 items and connecting line, dress code card, and a dashed locked venue card with RSVP button and a collapsed "Already RSVP'd?" section.

- [ ] **Step 3: Commit**

```bash
git add site/schedule.html
git commit -m "feat: schedule timeline page with gated venue card"
```

---

### Task 11: Travel, Registry, FAQ, Our Story, 404 pages

**Files:**
- Create: `site/travel.html`, `site/registry.html`, `site/faq.html`, `site/story.html`, `site/404.html`

- [ ] **Step 1: Write `site/travel.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Travel · Michael &amp; Kathy</title>
  <link rel="stylesheet" href="css/theme.css">
  <link rel="stylesheet" href="css/base.css">
</head>
<body data-page="travel">
  <div id="site-nav"></div>
  <main>
    <header class="band">
      <div class="eyebrow" data-c="couple.city"></div>
      <h1 class="script">Travel &amp; Stay</h1>
    </header>
    <div class="container container--narrow">
      <h2 class="section-title" style="margin-top:0">Hotel blocks</h2>
      <div class="grid-2">
        <div class="card card--left">
          <div class="photo-ph photo-ph--card">[HOTEL PHOTO TBD]</div>
          <h3 data-c="travel.hotels.0.name"></h3>
          <p><span data-c="travel.hotels.0.address"></span><br>Group code: <strong data-c="travel.hotels.0.code"></strong><br>Book by: <span data-c="travel.hotels.0.bookBy"></span></p>
          <a class="btn btn--ghost" data-c-href="travel.hotels.0.link" href="#" style="padding:12px 28px;font-size:13px">Book a room</a>
        </div>
        <div class="card card--left">
          <div class="photo-ph photo-ph--card">[HOTEL PHOTO TBD]</div>
          <h3 data-c="travel.hotels.1.name"></h3>
          <p><span data-c="travel.hotels.1.address"></span><br>Group code: <strong data-c="travel.hotels.1.code"></strong><br>Book by: <span data-c="travel.hotels.1.bookBy"></span></p>
          <a class="btn btn--ghost" data-c-href="travel.hotels.1.link" href="#" style="padding:12px 28px;font-size:13px">Book a room</a>
        </div>
      </div>

      <h2 class="section-title">Getting here</h2>
      <div class="grid-2">
        <div class="card card--left"><div class="eyebrow">Airports</div><p data-c="travel.airports"></p></div>
        <div class="card card--left"><div class="eyebrow">Rideshare</div><p data-c="travel.rideshare"></p></div>
        <div class="card card--left"><div class="eyebrow">Parking</div><p data-c="travel.parking"></p></div>
        <div class="card card--left"><div class="eyebrow">Shuttle</div><p data-c="travel.shuttle"></p></div>
      </div>
    </div>
  </main>
  <div id="site-footer"></div>
  <script type="module" src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `site/registry.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Registry · Michael &amp; Kathy</title>
  <link rel="stylesheet" href="css/theme.css">
  <link rel="stylesheet" href="css/base.css">
</head>
<body data-page="registry">
  <div id="site-nav"></div>
  <main>
    <header class="band"><h1 class="script">Registry</h1></header>
    <div class="container container--narrow center">
      <p>Your presence is the greatest gift. If you'd like to give something, <span data-c="registry.message"></span></p>
      <div class="grid-2" style="margin-top:32px">
        <div class="card">
          <img class="card-img" src="assets/photos/macrame-panel.jpg" alt="Cream macrame wall hanging on white brick">
          <h3 data-c="registry.items.0.name"></h3>
          <p data-c="registry.items.0.description"></p>
          <a class="btn" data-c-href="registry.items.0.link" href="#" style="padding:14px 34px;font-size:13px">View registry</a>
        </div>
        <div class="card">
          <img class="card-img" src="assets/photos/terracotta-fabric.jpg" alt="Rust-colored gauze fabric">
          <h3 data-c="registry.items.1.name"></h3>
          <p data-c="registry.items.1.description"></p>
          <a class="btn" data-c-href="registry.items.1.link" href="#" style="padding:14px 34px;font-size:13px">View registry</a>
        </div>
      </div>
    </div>
  </main>
  <div id="site-footer"></div>
  <script type="module" src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 3: Write `site/faq.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>FAQ · Michael &amp; Kathy</title>
  <link rel="stylesheet" href="css/theme.css">
  <link rel="stylesheet" href="css/base.css">
</head>
<body data-page="faq">
  <div id="site-nav"></div>
  <main>
    <header class="band"><h1 class="script">Questions</h1></header>
    <div class="container container--narrow stack">
      <p class="center">Everything you might want to know before the big day.</p>
      <div class="card card--left"><h3>Can I bring a plus-one?</h3><p data-c="faq.plusOne"></p></div>
      <div class="card card--left"><h3>Are children welcome?</h3><p data-c="faq.children"></p></div>
      <div class="card card--left"><h3>Where do I park?</h3><p><span data-c="faq.parking"></span> See the <a href="travel.html">Travel page</a> for more.</p></div>
      <div class="card card--left"><h3>What about dietary restrictions?</h3><p><span data-c="faq.dietary"></span> Let us know on the <a href="rsvp.html">RSVP form</a>.</p></div>
      <div class="card card--left"><h3>When is the RSVP deadline?</h3><p>Please reply by <span data-c="rsvp.deadline"></span>.</p></div>
    </div>
  </main>
  <div id="site-footer"></div>
  <script type="module" src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 4: Write `site/story.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Our Story · Michael &amp; Kathy</title>
  <link rel="stylesheet" href="css/theme.css">
  <link rel="stylesheet" href="css/base.css">
</head>
<body data-page="story">
  <div id="site-nav"></div>
  <main>
    <header class="band"><h1 class="script">Our Story</h1></header>
    <div class="container container--narrow">
      <img class="deco" style="width:100%;max-width:640px" src="assets/illustrations/poppy-hands.jpg" alt="Illustration of hands holding red poppies">
      <div class="grid-2" style="margin-top:32px">
        <div><h2 class="section-title" style="margin-top:0">How we met</h2><p data-c="story.howWeMet"></p></div>
        <div><h2 class="section-title" style="margin-top:0">The proposal</h2><p data-c="story.proposal"></p></div>
      </div>
      <h2 class="section-title center">Engagement photos</h2>
      <div class="grid-3">
        <div class="photo-ph photo-ph--tall">[PHOTO TBD]</div>
        <div class="photo-ph photo-ph--tall">[PHOTO TBD]</div>
        <div class="photo-ph photo-ph--tall">[PHOTO TBD]</div>
      </div>
    </div>
  </main>
  <div id="site-footer"></div>
  <script type="module" src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 5: Write `site/404.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Page not found · Michael &amp; Kathy</title>
  <link rel="stylesheet" href="/css/theme.css">
  <link rel="stylesheet" href="/css/base.css">
</head>
<body data-page="none">
  <main class="container center">
    <h1 class="script" style="font-size:64px;color:var(--heading)">Lost on the way?</h1>
    <p>That page doesn't exist. <a href="/index.html">Head back home</a>.</p>
  </main>
</body>
</html>
```

- [ ] **Step 6: View each page**

Open and screenshot `travel.html`, `registry.html`, `faq.html`, `story.html` on the dev server.
Expected: each has the olive title band, cream cards, highlighted `[TBD]` placeholders, correct nav highlight, and footer. Registry shows the macrame and fabric photos. Story shows the poppy-hands illustration with no visible white box (it blends into the page).

- [ ] **Step 7: Commit**

```bash
git add site/travel.html site/registry.html site/faq.html site/story.html site/404.html
git commit -m "feat: travel, registry, faq, story, and 404 pages"
```

---

### Task 12: RSVP page

**Files:**
- Create: `site/rsvp.html`

- [ ] **Step 1: Write `site/rsvp.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>RSVP · Michael &amp; Kathy</title>
  <link rel="stylesheet" href="css/theme.css">
  <link rel="stylesheet" href="css/base.css">
</head>
<body data-page="rsvp">
  <div id="site-nav"></div>
  <main>
    <header class="band"><h1 class="script">RSVP</h1></header>
    <div class="container container--narrow">
      <p class="center">Please reply by <strong data-c="rsvp.deadline"></strong>.<br>Guests who say yes will see the venue as soon as they submit.</p>

      <form id="rsvp-form" class="form" style="margin-top:32px" novalidate>
        <div class="field">
          <label for="name">Full name</label>
          <input id="name" type="text" name="name" autocomplete="name" required>
          <p class="error" data-error="name" role="alert"></p>
        </div>
        <div class="field">
          <label for="email">Email</label>
          <input id="email" type="email" name="email" autocomplete="email" required>
          <p class="error" data-error="email" role="alert"></p>
        </div>
        <div class="field">
          <fieldset>
            <legend>Will you join us?</legend>
            <label class="radio"><input type="radio" name="attending" value="yes"> Joyfully accepts</label>
            <label class="radio"><input type="radio" name="attending" value="no"> Regretfully declines</label>
          </fieldset>
          <p class="error" data-error="attending" role="alert"></p>
        </div>
        <div class="field">
          <label for="dietary">Dietary needs</label>
          <input id="dietary" type="text" name="dietary" placeholder="Optional">
          <p class="error" data-error="dietary" role="alert"></p>
        </div>
        <div class="field">
          <label for="notes">A note for the couple</label>
          <textarea id="notes" name="notes" rows="3" placeholder="Optional"></textarea>
          <p class="error" data-error="notes" role="alert"></p>
        </div>
        <!-- Honeypot: hidden from people, bots fill it in. -->
        <div class="hp" aria-hidden="true">
          <label for="website">Leave this empty</label>
          <input id="website" type="text" name="website" tabindex="-1" autocomplete="off">
        </div>
        <p class="status tbd">[FORM FIELDS TBD: meal choice, plus-one, and song requests are pending Michael and Kathy.]</p>
        <p id="rsvp-error" class="error" role="alert" hidden></p>
        <div class="center"><button id="submit" class="btn" type="submit">Send RSVP</button></div>
      </form>

      <section id="rsvp-yes" class="card" style="margin-top:32px" hidden>
        <h2 class="script" style="font-size:56px;color:var(--heading)">We can't wait to see you</h2>
        <p>Thank you. Your RSVP is in.</p>
        <div class="venue-card venue-card--open">
          <div class="eyebrow">Your venue</div>
          <div class="big" data-venue-name></div>
          <p data-venue-address></p>
          <p>Saturday, August 21, 2027 · Ceremony <span data-c="events.ceremony.time"></span></p>
        </div>
        <p style="margin-top:20px"><a class="btn" href="schedule.html">See the schedule</a></p>
      </section>

      <section id="rsvp-no" class="card" style="margin-top:32px" hidden>
        <h2 class="script" style="font-size:48px;color:var(--heading)">We'll miss you</h2>
        <p>Thank you for letting us know. We'll be thinking of you on the day.</p>
      </section>
    </div>
  </main>
  <div id="site-footer"></div>
  <script type="module" src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Verify the form renders and client-side failure handling works with no backend yet**

Open `http://localhost:8888/rsvp.html`, fill name, email, choose "Joyfully accepts", submit.
Expected: with the functions not built yet the request fails, so the fallback appears: "We couldn't send your RSVP right now... contact us at [CONTACT EMAIL OR PHONE TBD]." The typed entries stay in the fields and the button is enabled again.

- [ ] **Step 3: Commit**

```bash
git add site/rsvp.html
git commit -m "feat: RSVP page with confirmation states"
```

---

### Task 13: Server validation and handlers (TDD)

**Files:**
- Create: `lib/sheet-file.js`, `lib/rsvp-core.js`
- Test: `test/rsvp-core.test.js`

- [ ] **Step 1: Write `lib/sheet-file.js` (storage used by tests and local dev)**

```js
// lib/sheet-file.js
import { promises as fs } from 'node:fs';

// Records: { timestamp, name, email, attending, dietary, notes }. Email is stored lowercase.
export function createFileSheet(path) {
  const read = async () => {
    try {
      return JSON.parse(await fs.readFile(path, 'utf8'));
    } catch (e) {
      if (e.code === 'ENOENT') return [];
      throw e;
    }
  };
  const write = (rows) => fs.writeFile(path, JSON.stringify(rows, null, 2));
  return {
    async findByEmail(email) {
      const rows = await read();
      const i = rows.findIndex((r) => r.email === email);
      return i < 0 ? null : { rowIndex: i, record: rows[i] };
    },
    async append(record) {
      const rows = await read();
      rows.push(record);
      await write(rows);
    },
    async update(rowIndex, record) {
      const rows = await read();
      rows[rowIndex] = record;
      await write(rows);
    },
  };
}
```

- [ ] **Step 2: Write the failing test**

```js
// test/rsvp-core.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateRsvp, normalizeEmail, normalizeName, createHandlers } from '../lib/rsvp-core.js';
import { createFileSheet } from '../lib/sheet-file.js';

const VENUE = { name: 'The Test Hall', address: '1 Secret Way, Chicago, IL' };
const NOW = () => '2027-01-01T00:00:00.000Z';

function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'rsvp-'));
  const sheet = createFileSheet(join(dir, 'sheet.json'));
  return { sheet, handlers: createHandlers({ sheet, venue: VENUE, now: NOW }) };
}
const good = { name: 'Ada Lovelace', email: 'Ada@Example.com', attending: 'yes', dietary: 'vegetarian', notes: 'hi', website: '' };

test('normalizers', () => {
  assert.equal(normalizeEmail('  Ada@Example.COM '), 'ada@example.com');
  assert.equal(normalizeName('  ada   LOVELACE '), 'ada lovelace');
});

test('validateRsvp accepts a good body and trims/normalizes it', () => {
  const r = validateRsvp({ ...good, name: '  Ada   Lovelace ' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, { name: 'Ada Lovelace', email: 'ada@example.com', attending: 'yes', dietary: 'vegetarian', notes: 'hi' });
});

test('validateRsvp reports every bad field', () => {
  const r = validateRsvp({ name: '', email: 'nope', attending: 'maybe', dietary: 'x'.repeat(301), notes: 'y'.repeat(501) });
  assert.equal(r.ok, false);
  assert.deepEqual(Object.keys(r.errors).sort(), ['attending', 'dietary', 'email', 'name', 'notes']);
});

test('yes RSVP is saved and returns the venue', async () => {
  const { sheet, handlers } = setup();
  const res = await handlers.rsvp(good);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true, attending: true, venue: VENUE });
  const saved = await sheet.findByEmail('ada@example.com');
  assert.equal(saved.record.attending, 'yes');
  assert.equal(saved.record.timestamp, NOW());
});

test('no RSVP is saved and NEVER returns the venue', async () => {
  const { handlers } = setup();
  const res = await handlers.rsvp({ ...good, attending: 'no' });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true, attending: false });
  assert.equal(JSON.stringify(res.body).includes(VENUE.address), false);
});

test('invalid RSVP returns 400 with field errors and saves nothing', async () => {
  const { sheet, handlers } = setup();
  const res = await handlers.rsvp({ ...good, email: 'bad' });
  assert.equal(res.status, 400);
  assert.equal(res.body.ok, false);
  assert.ok(res.body.errors.email);
  assert.equal(await sheet.findByEmail('bad'), null);
});

test('same email RSVPs again: the row is updated, not duplicated', async () => {
  const { sheet, handlers } = setup();
  await handlers.rsvp(good);
  const res = await handlers.rsvp({ ...good, attending: 'no' });
  assert.equal(res.body.attending, false);
  const found = await sheet.findByEmail('ada@example.com');
  assert.equal(found.rowIndex, 0);
  assert.equal(found.record.attending, 'no');
});

test('honeypot: a filled hidden field gets a fake success and saves nothing', async () => {
  const { sheet, handlers } = setup();
  const res = await handlers.rsvp({ ...good, website: 'http://spam.example' });
  assert.equal(res.status, 200);
  assert.equal(res.body.venue, undefined);
  assert.equal(await sheet.findByEmail('ada@example.com'), null);
});

test('lookup returns the venue only when name and email match a YES RSVP', async () => {
  const { handlers } = setup();
  await handlers.rsvp(good);
  const ok = await handlers.lookup({ name: 'ada  lovelace', email: 'ADA@example.com' });
  assert.deepEqual(ok.body, { ok: true, found: true, venue: VENUE });
  const wrongName = await handlers.lookup({ name: 'Someone Else', email: 'ada@example.com' });
  assert.deepEqual(wrongName.body, { ok: true, found: false });
  const unknown = await handlers.lookup({ name: 'Ada Lovelace', email: 'zzz@example.com' });
  assert.deepEqual(unknown.body, { ok: true, found: false });
});

test('lookup never reveals the venue for a NO RSVP', async () => {
  const { handlers } = setup();
  await handlers.rsvp({ ...good, attending: 'no' });
  const res = await handlers.lookup({ name: 'Ada Lovelace', email: 'ada@example.com' });
  assert.deepEqual(res.body, { ok: true, found: false });
});

test('lookup with missing fields is a 400', async () => {
  const { handlers } = setup();
  const res = await handlers.lookup({ name: '', email: '' });
  assert.equal(res.status, 400);
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `node --test test/rsvp-core.test.js`
Expected: FAIL, `Cannot find module '../lib/rsvp-core.js'`.

- [ ] **Step 4: Write `lib/rsvp-core.js`**

```js
// lib/rsvp-core.js
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeEmail = (e) => String(e ?? '').trim().toLowerCase();
export const normalizeName = (n) => String(n ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

export function validateRsvp(body) {
  const errors = {};
  const name = String(body.name ?? '').trim().replace(/\s+/g, ' ');
  const email = normalizeEmail(body.email);
  const attending = String(body.attending ?? '');
  const dietary = String(body.dietary ?? '').trim();
  const notes = String(body.notes ?? '').trim();

  if (!name) errors.name = 'Please enter your name.';
  else if (name.length > 100) errors.name = 'That name is too long.';
  if (!EMAIL.test(email) || email.length > 200) errors.email = 'Please enter a valid email address.';
  if (!['yes', 'no'].includes(attending)) errors.attending = 'Please choose yes or no.';
  if (dietary.length > 300) errors.dietary = 'Please keep this under 300 characters.';
  if (notes.length > 500) errors.notes = 'Please keep this under 500 characters.';

  return Object.keys(errors).length
    ? { ok: false, errors }
    : { ok: true, value: { name, email, attending, dietary, notes } };
}

export function createHandlers({ sheet, venue, now = () => new Date().toISOString() }) {
  return {
    async rsvp(body) {
      // Honeypot: real people never see this field. Pretend success, store nothing.
      if (String(body.website ?? '').trim() !== '') {
        return { status: 200, body: { ok: true, attending: false } };
      }
      const checked = validateRsvp(body);
      if (!checked.ok) return { status: 400, body: { ok: false, errors: checked.errors } };

      const record = { timestamp: now(), ...checked.value };
      const existing = await sheet.findByEmail(record.email);
      if (existing) await sheet.update(existing.rowIndex, record);
      else await sheet.append(record);

      const yes = record.attending === 'yes';
      return { status: 200, body: yes ? { ok: true, attending: true, venue } : { ok: true, attending: false } };
    },

    async lookup(body) {
      const name = normalizeName(body.name);
      const email = normalizeEmail(body.email);
      if (!name || !email) return { status: 400, body: { ok: false, errors: { email: 'Enter your name and email.' } } };

      const existing = await sheet.findByEmail(email);
      const match = existing
        && existing.record.attending === 'yes'
        && normalizeName(existing.record.name) === name;
      return { status: 200, body: match ? { ok: true, found: true, venue } : { ok: true, found: false } };
    },
  };
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `node --test test/rsvp-core.test.js`
Expected: PASS, `tests 11`.

- [ ] **Step 6: Commit**

```bash
git add lib/sheet-file.js lib/rsvp-core.js test/rsvp-core.test.js
git commit -m "feat: RSVP validation, save, venue release, and lookup logic"
```

---

### Task 14: Rate limiter and HTTP function factory (TDD)

**Files:**
- Create: `lib/limiter.js`, `lib/http.js`, `lib/config.js`, `lib/function-factory.js`
- Test: `test/limiter.test.js`, `test/function-factory.test.js`

- [ ] **Step 1: Write the limiter test**

```js
// test/limiter.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLimiter } from '../lib/limiter.js';

test('allows up to max hits per key within the window, then blocks', () => {
  let t = 1000;
  const limiter = createLimiter({ max: 3, windowMs: 60000, now: () => t });
  assert.equal(limiter.allow('ip1'), true);
  assert.equal(limiter.allow('ip1'), true);
  assert.equal(limiter.allow('ip1'), true);
  assert.equal(limiter.allow('ip1'), false);
  assert.equal(limiter.allow('ip2'), true); // other keys are independent
});

test('allows again once old hits fall out of the window', () => {
  let t = 0;
  const limiter = createLimiter({ max: 1, windowMs: 1000, now: () => t });
  assert.equal(limiter.allow('k'), true);
  assert.equal(limiter.allow('k'), false);
  t = 1001;
  assert.equal(limiter.allow('k'), true);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/limiter.test.js`
Expected: FAIL, `Cannot find module '../lib/limiter.js'`.

- [ ] **Step 3: Write `lib/limiter.js`**

```js
// lib/limiter.js
// Best-effort only: serverless instances do not share memory, so this slows casual abuse
// but is not a hard guarantee. The honeypot and per-email de-duplication back it up.
export function createLimiter({ max, windowMs, now = Date.now }) {
  const hits = new Map();
  return {
    allow(key) {
      const t = now();
      const recent = (hits.get(key) || []).filter((x) => t - x < windowMs);
      if (recent.length >= max) {
        hits.set(key, recent);
        return false;
      }
      recent.push(t);
      hits.set(key, recent);
      return true;
    },
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/limiter.test.js`
Expected: PASS, `tests 2`.

- [ ] **Step 5: Write `lib/http.js`**

```js
// lib/http.js
export const MAX_BODY_BYTES = 10 * 1024;

export function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}

export function clientIp(event) {
  const h = event.headers || {};
  return h['x-nf-client-connection-ip'] || (h['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
}

// Returns { ok: true, value } or { ok: false, status, error }.
export function parseJsonBody(event) {
  const raw = event.body ?? '';
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) return { ok: false, status: 413, error: 'Request too large.' };
  try {
    const value = JSON.parse(raw || '{}');
    if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('not an object');
    return { ok: true, value };
  } catch {
    return { ok: false, status: 400, error: 'Invalid JSON.' };
  }
}
```

- [ ] **Step 6: Write `lib/config.js`**

```js
// lib/config.js
import { createFileSheet } from './sheet-file.js';
import { createGoogleSheet } from './sheet-google.js';

export function loadVenue(env) {
  return {
    name: env.VENUE_NAME || '[VENUE NAME TBD]',
    address: env.VENUE_ADDRESS || '[STREET ADDRESS TBD]',
  };
}

export function createSheet(env) {
  if (env.GOOGLE_SHEET_ID) {
    return createGoogleSheet({
      sheetId: env.GOOGLE_SHEET_ID,
      clientEmail: env.GOOGLE_CLIENT_EMAIL,
      privateKey: env.GOOGLE_PRIVATE_KEY,
    });
  }
  // Never silently fall back to a local file in production: RSVPs would be lost.
  if (env.CONTEXT === 'production') throw new Error('GOOGLE_SHEET_ID is not set in production.');
  return createFileSheet(env.DEV_SHEET_PATH || '.dev-rsvps.json');
}
```

- [ ] **Step 7: Write the function-factory test**

```js
// test/function-factory.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFunction } from '../lib/function-factory.js';
import { createFileSheet } from '../lib/sheet-file.js';
import { createLimiter } from '../lib/limiter.js';

const VENUE = { name: 'The Test Hall', address: '1 Secret Way' };
const body = { name: 'Ada Lovelace', email: 'ada@example.com', attending: 'yes', dietary: '', notes: '', website: '' };

function build(over = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'fn-'));
  const sheet = createFileSheet(join(dir, 's.json'));
  return createFunction('rsvp', {
    sheet,
    venue: VENUE,
    limiter: over.limiter || createLimiter({ max: 100, windowMs: 1000 }),
  });
}
const post = (b) => ({ httpMethod: 'POST', headers: { 'x-nf-client-connection-ip': '1.2.3.4' }, body: typeof b === 'string' ? b : JSON.stringify(b) });

test('rejects non-POST with 405', async () => {
  const res = await build()({ httpMethod: 'GET', headers: {}, body: '' });
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, 'POST');
});

test('rejects invalid JSON with 400', async () => {
  const res = await build()(post('{nope'));
  assert.equal(res.statusCode, 400);
});

test('rejects oversize bodies with 413', async () => {
  const res = await build()(post({ ...body, notes: 'x'.repeat(20000) }));
  assert.equal(res.statusCode, 413);
});

test('rate limits per client IP with 429', async () => {
  const fn = build({ limiter: createLimiter({ max: 1, windowMs: 60000 }) });
  assert.equal((await fn(post(body))).statusCode, 200);
  assert.equal((await fn(post(body))).statusCode, 429);
});

test('a valid RSVP returns 200 JSON with the venue for yes', async () => {
  const res = await build()(post(body));
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(res.body), { ok: true, attending: true, venue: VENUE });
});

test('unexpected errors return a generic 500 and do not leak details', async () => {
  const sheet = { findByEmail: async () => { throw new Error('secret db detail'); }, append: async () => {}, update: async () => {} };
  const fn = createFunction('rsvp', { sheet, venue: VENUE, limiter: createLimiter({ max: 10, windowMs: 1000 }) });
  const res = await fn(post(body));
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.includes('secret'), false);
});
```

- [ ] **Step 8: Run to verify it fails**

Run: `node --test test/function-factory.test.js`
Expected: FAIL, `Cannot find module '../lib/function-factory.js'` (and `sheet-google.js` is not needed yet by this test, but `config.js` imports it, so create the stub in the next step before running).

- [ ] **Step 9: Write `lib/function-factory.js`**

```js
// lib/function-factory.js
import { createHandlers } from './rsvp-core.js';
import { clientIp, jsonResponse, parseJsonBody } from './http.js';
import { createLimiter } from './limiter.js';
import { createSheet, loadVenue } from './config.js';

// kind: 'rsvp' | 'lookup'. Dependencies are injectable for tests; production uses env.
export function createFunction(kind, deps = {}) {
  const limiter = deps.limiter || createLimiter({ max: 20, windowMs: 10 * 60 * 1000 });
  let handlers = null;

  const getHandlers = () => {
    if (!handlers) {
      const sheet = deps.sheet || createSheet(process.env);
      const venue = deps.venue || loadVenue(process.env);
      handlers = createHandlers({ sheet, venue });
    }
    return handlers;
  };

  return async function handler(event) {
    if (event.httpMethod !== 'POST') {
      const res = jsonResponse(405, { ok: false, error: 'Method not allowed.' });
      res.headers.Allow = 'POST';
      return res;
    }
    if (!limiter.allow(clientIp(event))) {
      return jsonResponse(429, { ok: false, error: 'Too many requests. Please wait a few minutes and try again.' });
    }
    const parsed = parseJsonBody(event);
    if (!parsed.ok) return jsonResponse(parsed.status, { ok: false, error: parsed.error });

    try {
      const result = await getHandlers()[kind](parsed.value);
      return jsonResponse(result.status, result.body);
    } catch (err) {
      console.error(`[${kind}] unexpected error`, err);
      return jsonResponse(500, { ok: false, error: 'Something went wrong on our end. Please try again.' });
    }
  };
}
```

- [ ] **Step 10: Create a temporary `lib/sheet-google.js` stub so imports resolve (replaced in Task 15)**

```js
// lib/sheet-google.js (stub, replaced in Task 15)
export function createGoogleSheet() {
  throw new Error('Google sheet adapter not implemented yet.');
}
```

- [ ] **Step 11: Run to verify it passes**

Run: `node --test test/function-factory.test.js`
Expected: PASS, `tests 6`.

- [ ] **Step 12: Run the full suite and commit**

Run: `npm test`
Expected: all tests pass.

```bash
git add lib test/limiter.test.js test/function-factory.test.js
git commit -m "feat: rate limiter and function factory with method, size, and error handling"
```

---

### Task 15: Google Sheets adapter and Netlify function wrappers

**Files:**
- Modify: `lib/sheet-google.js` (replace the stub)
- Create: `netlify/functions/rsvp.js`, `netlify/functions/lookup.js`
- Test: `test/sheet-google.test.js`

- [ ] **Step 1: Write a test for the pure row mapping helpers**

```js
// test/sheet-google.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { toRow, fromRow, COLUMNS, normalizePrivateKey } from '../lib/sheet-google.js';

test('columns match the sheet header order', () => {
  assert.deepEqual(COLUMNS, ['timestamp', 'name', 'email', 'attending', 'dietary', 'notes']);
});

test('toRow and fromRow round-trip a record', () => {
  const rec = { timestamp: 't', name: 'Ada', email: 'a@b.c', attending: 'yes', dietary: 'veg', notes: 'hi' };
  assert.deepEqual(fromRow(toRow(rec)), rec);
});

test('fromRow fills missing trailing cells with empty strings', () => {
  assert.deepEqual(fromRow(['t', 'Ada', 'a@b.c', 'no']), { timestamp: 't', name: 'Ada', email: 'a@b.c', attending: 'no', dietary: '', notes: '' });
});

test('normalizePrivateKey turns literal \\n into real newlines', () => {
  assert.equal(normalizePrivateKey('line1\\nline2'), 'line1\nline2');
  assert.equal(normalizePrivateKey('line1\nline2'), 'line1\nline2');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test test/sheet-google.test.js`
Expected: FAIL (the stub does not export these).

- [ ] **Step 3: Replace `lib/sheet-google.js`**

```js
// lib/sheet-google.js
import { google } from 'googleapis';

export const COLUMNS = ['timestamp', 'name', 'email', 'attending', 'dietary', 'notes'];
const TAB = 'RSVPs';

export const toRow = (record) => COLUMNS.map((c) => record[c] ?? '');
export const fromRow = (row) => Object.fromEntries(COLUMNS.map((c, i) => [c, row[i] ?? '']));
export const normalizePrivateKey = (key) => String(key ?? '').replace(/\\n/g, '\n');

// Sheet layout: a tab named "RSVPs" with header row A1:F1 = Timestamp, Name, Email, Attending, Dietary, Notes.
// Values are written RAW so a guest typing "=SUM(...)" is stored as plain text, not a formula.
export function createGoogleSheet({ sheetId, clientEmail, privateKey }) {
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: normalizePrivateKey(privateKey),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  return {
    async findByEmail(email) {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${TAB}!A2:F` });
      const rows = res.data.values || [];
      const i = rows.findIndex((r) => String(r[2] ?? '').trim().toLowerCase() === email);
      return i < 0 ? null : { rowIndex: i, record: fromRow(rows[i]) };
    },
    async append(record) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: `${TAB}!A:F`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [toRow(record)] },
      });
    },
    async update(rowIndex, record) {
      const sheetRow = rowIndex + 2; // +1 for header, +1 because sheets are 1-indexed
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${TAB}!A${sheetRow}:F${sheetRow}`,
        valueInputOption: 'RAW',
        requestBody: { values: [toRow(record)] },
      });
    },
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test test/sheet-google.test.js`
Expected: PASS, `tests 4`.

- [ ] **Step 5: Write the function wrappers**

```js
// netlify/functions/rsvp.js
import { createFunction } from '../../lib/function-factory.js';

export const handler = createFunction('rsvp');
```

```js
// netlify/functions/lookup.js
import { createFunction } from '../../lib/function-factory.js';

export const handler = createFunction('lookup');
```

- [ ] **Step 6: Run the full suite and commit**

Run: `npm test`
Expected: all tests pass.

```bash
git add lib/sheet-google.js netlify/functions test/sheet-google.test.js
git commit -m "feat: Google Sheets storage adapter and Netlify function wrappers"
```

---

### Task 16: End-to-end verification in a browser

**Files:** none changed unless a defect is found.

- [ ] **Step 1: Create a local `.env` and restart the dev server**

```bash
cp .env.example .env
```

Stop any running dev server, then run (background): `npx netlify-cli dev --port 8888 --offline`
Expected: log lines mention loading `.env` variables and the functions `rsvp` and `lookup`.

- [ ] **Step 2: Confirm the venue is NOT in the pages or the API before an RSVP**

```bash
for p in index schedule travel rsvp registry faq story; do
  curl -s "http://localhost:8888/$p.html" | grep -c "123 Sample Street" ;
done
curl -s http://localhost:8888/js/content.js | grep -c "123 Sample Street"
grep -rc "123 Sample Street" site | grep -v ":0" || echo "no matches under site/"
```

Expected: every count is `0`, and the last command prints `no matches under site/`.

- [ ] **Step 3: Verify a "no" RSVP never reveals the venue**

```bash
curl -s -X POST http://localhost:8888/api/rsvp -H "Content-Type: application/json" \
  -d '{"name":"Test Decliner","email":"no@example.com","attending":"no","dietary":"","notes":"","website":""}'
```

Expected: `{"ok":true,"attending":false}` with no venue text.

- [ ] **Step 4: Verify validation and method errors**

```bash
curl -s -X POST http://localhost:8888/api/rsvp -H "Content-Type: application/json" -d '{"name":"","email":"bad","attending":"x"}'
curl -s -i http://localhost:8888/api/rsvp | head -1
```

Expected: first returns `{"ok":false,"errors":{...name, email, attending...}}`; second prints `HTTP/1.1 405`.

- [ ] **Step 5: Browser test of the "yes" flow**

With the Playwright browser tool:
1. Open `http://localhost:8888/schedule.html`. Expected: locked venue card, no address anywhere on the page.
2. Open `http://localhost:8888/rsvp.html`, fill name "Test Guest", email "guest@example.com", choose "Joyfully accepts", submit.
   Expected: form disappears, "We can't wait to see you" appears with "Sample Venue Name" and "123 Sample Street, Chicago, IL 60601".
3. Open `http://localhost:8888/schedule.html` again.
   Expected: the locked card is replaced by the revealed venue (stored in the browser).
4. Open `.dev-rsvps.json` and confirm one record for `guest@example.com` with `attending: "yes"`.

- [ ] **Step 6: Browser test of lookup and changing an answer**

1. Clear site storage: run `localStorage.clear()` via the browser's evaluate tool, reload `schedule.html`. Expected: locked again.
2. Open "Already RSVP'd? Look up the venue", enter "test guest" and "GUEST@example.com", submit.
   Expected: the venue is revealed.
3. Enter name "Wrong Person" with the same email. Expected: "We couldn't find a yes RSVP for that name and email."
4. Go to `rsvp.html`, RSVP again as the same email with "Regretfully declines". Then clear storage and try the lookup again.
   Expected: lookup now fails (the answer is "no") and `.dev-rsvps.json` still has exactly one record for that email.

- [ ] **Step 7: Theme switcher**

1. Open `http://localhost:8888/?preview`. Expected: a "Preview theme" control appears bottom right.
2. Click `terracotta`, then navigate to Schedule via the nav (no `?preview` in the link). Expected: still terracotta, switcher still visible.
3. Click `candlelit` and check Home, Schedule, Travel, FAQ, and RSVP for readable text and visible inputs.
4. Open `http://localhost:8888/` in a fresh private window. Expected: sage theme, no switcher.

- [ ] **Step 8: Responsive and console checks**

Resize to 390x844 and visit every page.
Expected: no horizontal scrolling, nav wraps cleanly, forms are usable, photos do not overflow.
Check the browser console on every page. Expected: no errors (an `@import` font warning when offline is acceptable).

- [ ] **Step 9: Fix any defect found, re-run `npm test`, and commit**

```bash
git add -A
git commit -m "fix: issues found during end-to-end verification"
```

If nothing needed fixing, skip this commit.

---

### Task 17: Deploy to Netlify and connect the Google Sheet

**Files:**
- Create: `README.md`

This task needs the couple's or your accounts. Do each step and confirm before continuing.

- [ ] **Step 1: Create the Google Sheet and service account**

1. Create a Google Sheet named "Wedding RSVPs". Rename the first tab to exactly `RSVPs`. In row 1 enter: `Timestamp`, `Name`, `Email`, `Attending`, `Dietary`, `Notes` (columns A to F).
2. In Google Cloud Console create a project, enable the **Google Sheets API**, and create a **service account**. Create a JSON key for it and download it.
3. Share the Sheet with the service account's `client_email` as **Editor**.
4. Note the Sheet ID (the long string in the sheet URL between `/d/` and `/edit`).

- [ ] **Step 2: Create the Netlify site**

```bash
npx netlify-cli login
npx netlify-cli init
```

Choose "Create & configure a new project". Build command: leave empty. Publish directory: `site`. Functions directory: `netlify/functions`.

- [ ] **Step 3: Set environment variables in the Netlify dashboard**

Site configuration, Environment variables. Add:
- `GOOGLE_SHEET_ID`: the Sheet ID
- `GOOGLE_CLIENT_EMAIL`: `client_email` from the JSON key
- `GOOGLE_PRIVATE_KEY`: `private_key` from the JSON key, pasted exactly as in the file (including the `\n` sequences)
- `VENUE_NAME` and `VENUE_ADDRESS`: leave unset until the couple confirms them. Until then guests who RSVP yes see `[VENUE NAME TBD]` and `[STREET ADDRESS TBD]`.

Mark `GOOGLE_PRIVATE_KEY` and `VENUE_ADDRESS` as secret values.

- [ ] **Step 4: Deploy a preview and test against the real sheet**

```bash
npx netlify-cli deploy
```

Expected: a draft URL. On that URL submit a "yes" RSVP with a test email. Expected: a new row appears in the Google Sheet, and the confirmation shows the TBD venue placeholders.

- [ ] **Step 5: Deploy to production**

```bash
npx netlify-cli deploy --prod
```

Expected: the production URL loads the Home page. Submit one more test RSVP, then delete the test rows from the Sheet.

- [ ] **Step 6: Write `README.md`**

````markdown
# Michael & Kathy Wedding Website

Static site in `site/`, RSVP functions in `netlify/functions/`.

## Run locally
```bash
npm install
cp .env.example .env
npm run dev        # http://localhost:8888 (uses .dev-rsvps.json as a fake sheet)
npm test
```

## Fill in the details
Edit `site/js/content.js`. Anything in `[BRACKETS]` is a placeholder; replace the whole string.
To add a hotel or registry, copy an existing block in `travel.html` or `registry.html` and add a matching entry in `content.js`.

## Reveal the real venue
Set `VENUE_NAME` and `VENUE_ADDRESS` in the Netlify dashboard (Site configuration, Environment variables), then trigger a deploy. The address is never stored in the site files.

## Themes
Colors and fonts are in `site/css/theme.css`. Sage is the default. Add `?preview` to any URL to show the theme switcher. To remove the switcher before launch, delete the `initTheme` switcher block in `site/js/theme-switcher.js` (keep the line that applies the default theme) or just leave it, since guests never see it without `?preview`.

## Photo credits
Vecteezy free-license assets need attribution. Credits come from `credits` in `site/js/content.js` and appear in every page footer. Verify the exact wording on each photo's "How?" link.

## Adding RSVP fields
Add the input to `site/rsvp.html`, add its name to `fieldValues` in `site/js/rsvp.js`, validate it in `lib/rsvp-core.js` (`validateRsvp`), and add its key to `COLUMNS` in `lib/sheet-google.js` plus a column header in the Sheet.
````

- [ ] **Step 7: Commit and push the README**

```bash
git add README.md
git commit -m "docs: README with setup, content, venue, and theme instructions"
```

---

### Task 18: Launch checklist (with the couple)

**Files:** `site/js/content.js` (edits only)

- [ ] **Step 1: Collect and enter every placeholder.** Search for remaining placeholders:

```bash
grep -n "\[" site/js/content.js | grep -v "^.*//"
```

Expected at launch: no `[...TBD...]` strings remain. Enter times, dress code, hotels, registries, FAQ answers, story text, contact, hashtag, and RSVP deadline (3 to 4 weeks before August 21, 2027, so July 24 to 31, 2027).

- [ ] **Step 2: Replace photo placeholders.** Add the couple's engagement photos to `site/assets/photos/`, then swap the `photo-ph` blocks in `story.html` (and the hotel photo blocks in `travel.html`) for `<img>` tags with alt text. Keep photos non-AI and non-wedding-scene for stock images.

- [ ] **Step 3: Set the real venue.** Add `VENUE_NAME` and `VENUE_ADDRESS` in Netlify, redeploy, and RSVP "yes" with a test email to confirm the real address appears. RSVP "no" with another test email to confirm it does not.

- [ ] **Step 4: Confirm the theme.** Show the couple the three themes via `?preview`. If they pick a different default, change `DEFAULT_THEME` in `site/js/theme.js` and make that theme's variables the `:root` block in `site/css/theme.css`.

- [ ] **Step 5: Connect the custom domain** (if the couple wants one) in Netlify, Domain management. Confirm HTTPS works.

- [ ] **Step 6: Final checks.** Run `npm test` (all pass), then repeat Task 16 Steps 2 and 8 on the production URL. Delete test rows from the Sheet.

- [ ] **Step 7: Commit**

```bash
git add site/js/content.js site/assets
git commit -m "content: launch details and photos"
```

---

## Self-Review Notes (checked against the spec)

- **Pages (Home, Schedule, Travel, RSVP, Registry, FAQ, Our Story):** Tasks 9 to 12. A 404 page is added in Task 11.
- **Single content file with TBD placeholders:** Task 3 (`content.js`, `data-c` binding, highlighted placeholders).
- **Theme system, sage default, three themes, `?preview` switcher, persistence, easy removal:** Task 4 and Task 8.
- **Venue revealed only for yes, stored in browser, lookup by name and email, address only in function settings:** Tasks 6, 7, 13, 14, 16.
- **Spam protection (honeypot, rate limiting):** Tasks 13 and 14. The rate limit is best-effort, as noted in `lib/limiter.js`. This is a small deviation from the spec's "simple rate limiting", which cannot be a hard guarantee on stateless serverless functions.
- **Errors (keep entries, contact fallback):** Task 7.
- **Testing (end-to-end, widths, themes, venue not in source):** Task 16.
- **Photo attribution footer and photo rules (no AI, no wedding scenes):** Tasks 1, 5, 17, 18.
- **Hosting (Netlify static plus functions, Google Sheet):** Tasks 15 and 17.
- **Open items deliberately not built:** password protection, optional extras (Add to Calendar, wedding party page, guest photo upload), meal choice, plus-one, and song-request fields. The README explains how to add RSVP fields once the couple decides.
- **Consistency check:** `createFileSheet`, `createGoogleSheet`, `createHandlers`, `createFunction`, `createVenueStore`, `showVenue`, `initRsvpForm`, `initLookup`, `renderChrome`, `applyContent`, `startCountdown`, `timeLeft`, `resolveTheme`, and `setTheme` are each defined once and used with the same signatures everywhere. The sheet record shape `{timestamp,name,email,attending,dietary,notes}` and the API shapes in Task 7 match Task 13.
