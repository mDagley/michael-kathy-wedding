# Couple-editable site details (Google Sheet): Design

Date: 2026-10-11
Status: Approved by the user. Next step: write the implementation plan, then build with subagent-driven development (same process as the main site: one implementer per task, then a spec+quality review, hardening for anything touching input).

## Goal

Michael and Kathy can change the wedding details on the live site (times, dress code, hotels, FAQ answers, story, and so on) by editing a Google Sheet tab, without any help and without any way to break the site.

## Decisions

- **Where:** a new tab named `Site Details` in the SAME spreadsheet that stores RSVPs (the service account already has Editor access; no new credentials or env vars needed beyond an optional `CONTENT_TAB`, default `Site Details`).
- **Editing experience:** one row per detail. Columns: `Section` (grouping, plain English), `What it is` (plain-English label), `Value (edit this)`, `key` (technical dotted path into `content.js`, last column, greyed out, "do not edit"). A short instruction row/note at the top. Blank value = keep the built-in placeholder, so nothing ever shows empty.
- **Editable:** everything in `site/js/content.js` EXCEPT `nav` and `credits` (developer-owned). That covers `couple.*` (names, date text, city, contact, hashtag), `rsvp.deadline`, `events.*`, `dress.*`, `travel.*` (hotels, airports, rideshare, parking, shuttle), `registry.*`, `faq.*`, `story.*`.
- **Announcement banner (added at the user's request, inspired by their 2020 site's notice):** one extra editable detail, `announcement.text` (section "Announcement", label "Announcement banner (leave blank for none)", max 300 characters, plain text, no link). Its default in `content.js` is the empty string `''`, which means "no banner". When non-empty, `chrome.js` renders a full-width bar ABOVE the nav on every page that uses the shared chrome (not the 404 page): `<div class="announcement" role="region" aria-label="Announcement">` with the text set via `textContent`, styled with the theme variables (`--band` background, `--band-text` text, centered, wraps on phones). Blank (or removed) means nothing renders. Because `chrome.js` is re-run after the sheet content arrives (see Architecture item 4), the banner appears with the rest of the live content, within about a minute of the couple editing the cell. It is NOT dismissible (YAGNI) and has no link field.
- **Not editable from the sheet:** photos, themes/colors/fonts, page layout, photo credits, and the **venue** (stays in the Netlify env vars `VENUE_NAME` / `VENUE_ADDRESS` so it can never leak via a shared spreadsheet).
- **Refresh:** changes appear within about two to three minutes (60 s function cache, plus the 60 s `Cache-Control` held by the CDN and the browser); no deploy.
- **Failure mode:** if the sheet, tab, or function is unavailable, the site silently shows the built-in `content.js` text. The sheet can never take the site down.

## Architecture

1. **`lib/content-fields.js`** (single source of truth): an ordered list of `{ key, label, section, maxLength, kind: 'text' | 'url' | 'multiline' }` for every editable detail. It drives (a) the server allow-list, (b) the CSV template generator, (c) tests that fail if `content.js` and this list drift apart (every editable string path in `content.js` has an entry, and every entry points at an existing string path). Hotel/registry links are `kind: 'url'` and must start with `https://` or `http://`.
2. **`lib/content-sheet.js`**: reads `'<tab>'!A2:D`-style rows via the existing Google client (injectable `sheetsClient` for tests), maps `key -> value`, drops unknown keys, drops blank values, trims, enforces `maxLength` (as built: text 200, multiline 600, url 500, announcement 300, the two story fields 4000; measured in Unicode code points, with the raw cell cut at 4x the limit before any processing), validates `url` kinds, and returns the values map. It lets API errors (for example a missing tab) propagate; the handler maps them to a generic 503 and logs one line with the error code and message. Added during review: hidden and bidirectional characters are stripped, URLs must be plain ASCII `http(s)` without credentials, and the client merge accepts values up to 16000 UTF-16 units so the unit difference can never silently drop valid text.
3. **`netlify/functions/content.js`** (+ `lib/content-handler.js`): `GET /api/content` returns `{ ok: true, values }` with `Cache-Control: public, max-age=60`; an in-memory 60 s cache in the function instance; on any failure returns 503 `{ ok: false }` (generic, no details); rate limited with the existing limiter (more generous than RSVP: 120 per 10 minutes per IP); non-GET gets 405.
4. **Front end:** `main.js` first applies the built-in `content.js` (as today), then fetches `/api/content` with a 1.5 s timeout. A tiny `mergeContent(defaults, values)` (in `site/js/content-merge.js`, unit-tested) copies only string values at paths that already exist in the defaults (the client-side allow-list; ignores anything else) into a fresh object, then re-runs `applyContent` and re-runs `renderChrome` (so the footer and the announcement banner update too; `renderChrome` must be idempotent: it replaces its own nodes rather than appending duplicates, including removing a previously rendered banner when the text becomes empty). To avoid a flash of `[TBD]` text, an inline-free approach: `main.js` adds class `content-pending` to `<html>` at boot (CSS: `.content-pending [data-c] { visibility: hidden; }`), and removes it when the fetch resolves, fails, or times out (never longer than 1.5 s).
5. **Template + guide:** `npm run content-template` writes `site-details-template.csv` from `content-fields.js` + `content.js` defaults (git-ignored output; also attach to the PR description). The user imports it once into the sheet (File, Import, "Insert new sheet(s)", name the tab `Site Details`). Add `docs/EDITING.md`: a one-page, plain-English guide for the couple (what to type where, that links must start with https://, that blank keeps the placeholder, how long changes take, who to ask for photos/venue changes).
6. **Security:** values only ever reach the DOM via `textContent` and `setAttribute('href')` after an `https?://` check (existing `render.js` behavior); length limits; allow-listed keys; no HTML; function returns only the allow-listed fields; the sheet is the couple's own, so the main residual risk is the couple (or someone with sheet access) typing wrong text, which is visible and fixable by editing the cell.

## Testing

- Unit: `content-fields` drift test; `content-sheet` with a mocked `sheetsClient` (known/unknown keys, blanks, over-length, bad URLs, missing tab, empty tab, formula-looking text `=1+1` passes through as text); handler tests (405, 503 on failure with no leakage, cache within 60 s, rate limit); `content-merge` tests (only existing string paths merged, non-strings ignored, original defaults object not mutated).
- Page integrity test stays green (the banner is rendered by `chrome.js`, so there are no new `data-c` keys in the HTML).
- Announcement banner: `chrome` tests that no banner renders when `announcement.text` is `''`, that it renders above the nav with `role="region"` and the exact text when set, that markup in the text is shown literally (no HTML injection), that calling `renderChrome` twice never duplicates it, and that it disappears when the text is cleared; a CSS check that it uses only theme variables; a browser check that it wraps cleanly at 320 px and reads well in all three themes.
- Real browser run with the local functions and a file-backed fake content store: edit a value, reload, see it; simulate the content endpoint failing (503) and timing out (slow) and confirm the built-in text appears within about 1.5 s; confirm no flash of `[TBD]` when the sheet answers fast; phone width.
- Whole-project review against this spec before merge.

## Follow-ups (not in this feature)

- Photos editable by the couple (would need an upload path).
- A "preview unpublished changes" mode.
- Move `googleapis` to `@googleapis/sheets` to shrink the functions.

## Context a new session needs

- Repo: https://github.com/mDagley/michael-kathy-wedding (public). Site live on Netlify at https://comforting-kleicha-caa808.netlify.app (auto-deploys from `main`). RSVP storage is the Google Sheet whose id is in the `GOOGLE_SHEET_ID` Netlify env var.
- Run locally on Windows with `npm run dev` (do NOT use `netlify dev` / `npx netlify`: the `&` in the folder name "Michael & Kathy Wedding" breaks the `.cmd` launchers). Tests: `npm test` (129 passing at the start of this feature).
- Rules from the couple: no AI-generated images, no wedding-scene photos, every image credited in the footer.
- Process used so far: brainstorm, spec, plan, then subagent-driven development with a review after each task and a final whole-project review; commits end with the Co-Authored-By and Claude-Session trailers; PR via `gh` from a feature branch to `main`.
