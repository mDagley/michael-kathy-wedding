# Michael & Kathy Wedding Website

August 21, 2027 · Chicago, Illinois. A static site in `site/` plus two Netlify functions in `netlify/functions/` that save RSVPs to a Google Sheet and reveal the venue only to guests who RSVP "yes."

## Run it locally

```bash
npm install
cp .env.example .env     # sample venue + empty Google values (uses a local JSON file as the "sheet")
npm run dev              # http://localhost:8888
npm test                 # unit and page-integrity tests
```

`npm run dev` calls the Netlify CLI through `node` directly. Do not replace it with `netlify dev` on Windows: the `&` in this folder's name ("Michael & Kathy Wedding") breaks the `.cmd` launcher scripts.

Local RSVPs are written to `.dev-rsvps.json` (git-ignored). Delete that file to reset.

## Fill in the details

Edit **`site/js/content.js`**. Anything in `[BRACKETS]` is a placeholder (shown highlighted on the site); replace the whole string, brackets included. Pages bind to this file with `data-c="path.to.value"`, so you never edit page layouts to change text. A test fails if a page references a path that does not exist.

To add a third hotel or registry, copy an existing card in `travel.html` / `registry.html` and add the matching entry in `content.js`.

A few placeholders and pieces of copy live directly in the HTML instead, so also search the pages for `TBD` and read through them before launch:

- `rsvp.html`: the `[FORM FIELDS TBD ...]` note under the form. Delete it once the RSVP fields are final.
- `story.html` and `travel.html`: the `[PHOTO TBD]` and `[HOTEL PHOTO TBD]` blocks. Replace each `.photo-ph` block with an `<img>` pointing at a file you put in `site/assets/photos/`.
- `schedule.html`: the fourth timeline item ("add" circle, bound to `events.extra`). Delete that whole `<li>` if the couple has no extra event.
- Fixed wording such as "Dinner, dancing, and candlelight" (home and schedule) and "Your presence is the greatest gift" (registry). Edit these in the HTML if the couple wants different words.

## Letting the couple edit the details (Google Sheet)

The couple edit a **Site Details** tab in the same spreadsheet that holds the RSVPs, and the site picks their changes up within a minute or two. See [docs/EDITING.md](docs/EDITING.md) for the guide to give them.

One-time setup:

1. `npm run content-template` writes `site-details-template.csv` (git-ignored).
2. In the Google Sheet choose **File, Import, Upload** and pick the CSV. In the import dialog:
   - choose **Insert new sheet(s)** (NEVER "Replace spreadsheet" or "Replace current sheet": that would destroy the RSVPs tab);
   - **untick "Convert text to numbers, dates, and formulas"**. Left ticked, Sheets turns "August 21, 2027" into a date and the site would then show it as "8/21/2027".
3. Name the new tab exactly `Site Details` (or set `CONTENT_TAB` in Netlify to the name you chose). Then do these three things before handing it to the couple:
   - Select column C (the Value column) and choose **Format, Number, Plain text**. This is required: without it, a phone number typed as "+1 312 555 0100" is read as a formula and shows `#ERROR!`, and times or dates typed later can be reformatted. The site reads the text exactly as displayed.
   - Freeze row 1.
   - Protect columns A, B and D (**Data, Protect sheets and ranges**) so only column C can be edited.
4. No new keys or settings are needed: the service account that saves RSVPs already has access to the whole spreadsheet.

How it works: `GET /api/content` (the `content` function) reads the tab, validates every value, and caches it for 60 seconds; if the sheet is unavailable it keeps serving the last good copy for up to 10 minutes and then the site's built-in text. Only the details listed in `lib/content-fields.js` can be changed, and only the text itself: photos, themes, the countdown date, photo credits and the venue stay in code and Netlify settings. To make another detail editable, add it to `site/js/content.js` and to `lib/content-fields.js` (a test fails until both agree), then re-run `npm run content-template` and add the new row to the sheet.

Local development: put a flat JSON map in `.dev-content.json`, for example `{"dress.code":"Black tie","announcement.text":"Hello!"}`, and run `npm run dev`.

## The hidden venue

The venue is **never** in the site files. It lives in two environment variables, `VENUE_NAME` and `VENUE_ADDRESS`, and the `/api/rsvp` function returns it only when the saved answer is "yes."

- Guests who RSVP yes see it immediately and it is remembered in their browser.
- On a new device, a guest can use "Already RSVP'd? Look up the venue" on the Schedule page. It needs the **same name and email** as a saved "yes" RSVP.
- Guests who RSVP no, and anyone who does not match, get no venue and no hint why.
- Until the variables are set, a "yes" guest sees `[VENUE NAME TBD]` / `[STREET ADDRESS TBD]` on the confirmation. That placeholder is **never remembered** in their browser, so once you set the real venue and redeploy, they can use "Look up the venue" (or just RSVP again) to get it.
- A **real** venue is remembered in the guest's browser. If the address changes after guests have seen it, those guests keep seeing the old one until they clear their site data or RSVP "no" and back. Confirm the address before setting `VENUE_NAME` and `VENUE_ADDRESS`, and tell guests directly if it ever changes.
- Changing an RSVP to "no" clears the remembered venue on that device.

### Known limits (by design)

- Anyone who submits an RSVP with "yes" can see the venue and share it. The gate is friction, not a password.
- An RSVP is identified by email only. Anyone who knows a guest's email can overwrite that guest's RSVP. For a wedding this is an accepted trade-off; check the Sheet's timestamps if an answer changes unexpectedly.
- Rate limiting (20 requests per 10 minutes per IP) is best effort, because serverless instances do not share memory. The hidden honeypot field and the one-row-per-email rule back it up.

## Themes

Colors and fonts live in **`site/css/theme.css`** as CSS variables. Sage is the default; terracotta and candlelit are also defined. Add `?preview` to any URL (for example `https://yoursite.com/?preview`) to show a small theme switcher for trying them; it stays on for that browser session across pages, and `?preview=off` turns it off. Guests never see it. To make another theme the default, change `DEFAULT_THEME` in `site/js/theme.js` and move that theme's variables into the first (`:root`) block of `theme.css`.

## Photo credits

The Vecteezy free license requires attribution. Credits come from `credits` in `site/js/content.js` and appear in every page's footer: Vecteezy's generic snippet plus one entry per asset in use (contributor name and a link to its Vecteezy page). **When you add or remove an image, add or remove its credit entry.** Three of the five current assets are vector illustrations, not photos, which is why the footer says "Photos and art". If a photo's own "How?" link on Vecteezy asks for different wording, use that wording in the entry's `label`.

Image rules from the couple: nothing AI-generated (Vecteezy shows an "AI Generated" flag on each page) and nothing specifically of weddings; generic boho textures, objects, and illustrations only. Keep web images small (resize to about 800 to 1000 px wide).

## Deploying (Netlify + Google Sheets)

1. **Google Sheet.** Create a sheet. Name the first tab exactly `RSVPs`. In row 1 enter: `Timestamp`, `Name`, `Email`, `Attending`, `Dietary`, `Notes` (columns A to F). The site writes data from row 2.
2. **Service account.** In Google Cloud, create a project, enable the **Google Sheets API**, create a **service account**, and download a JSON key. Share the Sheet with the service account's `client_email` as **Editor**.
3. **Netlify site.** Log in and create a site from this folder: publish directory `site`, functions directory `netlify/functions` (already in `netlify.toml`). With the CLI: `node node_modules/netlify-cli/bin/run.js login`, then `... init`.
4. **Environment variables** (Site configuration, Environment variables). Set `GOOGLE_SHEET_ID` (the long id in the sheet URL), `GOOGLE_CLIENT_EMAIL`, and `GOOGLE_PRIVATE_KEY` (the `private_key` from the JSON, pasted as-is including the `\n` sequences), and mark the key secret. Set `VENUE_NAME` and `VENUE_ADDRESS` when the couple is ready to reveal the venue, then redeploy.
5. **Deploy**, then test with a real "yes" RSVP and a real "no" RSVP, and confirm the Sheet gets one row each. Delete the test rows.
6. Optional: connect a custom domain in Netlify (Domain management).

### Running the live Sheet

- Do not sort the sheet or delete rows while the site is accepting RSVPs: an update writes to the row position it found a moment earlier.
- Values are stored as plain text, so a guest typing `=SOMETHING` is not turned into a formula in Google Sheets. If you export to CSV and open it in Excel, a cell starting with `=`, `+`, `-` or `@` can still be interpreted as a formula there; open exports as text or import them as text columns.
- If the Sheet is unreachable, guests see a message with the couple's contact details (`couple.contact` in `content.js`) and keep what they typed.

## Adding an RSVP field (meal choice, plus-one, song request)

1. Add the input to `site/rsvp.html` (and a `<p class="error" data-error="fieldname">` slot).
2. Add its name to `fieldValues` in `site/js/rsvp.js`.
3. Validate and store it in `lib/rsvp-core.js` (`validateRsvp` and the record).
4. Add its key to `COLUMNS` in `lib/sheet-google.js` and a column header in the Sheet (extend the ranges from `A:F` to the new last column).
5. Add tests, run `npm test`.

## Project layout

```
site/            the published website (HTML, css/, js/, assets/)
netlify/functions/   rsvp.js and lookup.js (thin wrappers)
lib/             RSVP logic, validation, rate limiter, Google Sheets adapter
test/            node:test unit tests and the page-integrity test
docs/superpowers/    design spec and implementation plan
```
