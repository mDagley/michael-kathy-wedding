# Michael & Kathy Wedding Website: Design

Date: 2026-10-11
Status: Draft for user review

## Summary

A multi-page wedding website for Michael and Kathy's wedding on **August 21, 2027 in Chicago**. Style: boho chic, based on Kathy's terracotta and rustic-fall inspiration boards. The exact venue is hidden until a guest RSVPs "yes." Facts not yet provided appear as visible `TBD` placeholders.

## Decisions made

| Topic | Decision |
|---|---|
| Layout | Multi-page |
| Hosting and build | Static HTML/CSS/JS on a free host (Netlify or Cloudflare Pages) plus a free serverless backend |
| RSVP storage | Google Sheet readable by the couple |
| Venue privacy | Revealed only to guests who RSVP "yes" (details below) |
| Theme | Sage-led with terracotta accents is the preferred direction (Kathy's Pinterest board and your pick). Not yet confirmed by the couple. Terracotta and Candlelit stay defined and swappable |
| Graphics | Original SVG set in `assets/svg/`, plus free-license stock photos chosen by the couple, and later their own engagement photos |
| Missing facts | Shown as clearly marked `TBD` placeholders |

## Pages

| Page | Contents | Public? |
|---|---|---|
| Home | Names, August 21, 2027, Chicago, countdown, RSVP button, "venue revealed after you RSVP" note | Yes |
| Schedule | Ceremony and reception times, arrival note, dress code, venue name and address after reveal | Times and dress code public, venue gated |
| Travel | Hotel blocks (name, address, booking link, discount code), airports, rideshare, parking, shuttle times | Yes |
| RSVP | Form and deadline notice | Yes |
| Registry | Registry links | Yes |
| FAQ | Plus-ones, children, parking, dietary restrictions | Yes |
| Our Story | How they met, the proposal, engagement photos | Yes |

All content lives in a single content file, so filling in a `TBD` never means editing page layouts.

## Photo attribution

Photo style rules from the couple: no AI-generated images (Vecteezy shows an "AI Generated" flag on each photo page, and the Non-AI filter helps), and no wedding-specific scenes. Use generic, vibey boho imagery such as textures, fabrics, lanterns, and natural objects.

Stock photos come from Vecteezy's free license, which requires attribution. Every page shares one footer with a "Photo credits" line that names the photographer (or contributor) and links to each Vecteezy photo page used on the site. Photos are tracked in a credits list in the content file, so adding or removing a photo updates the footer. The couple's own engagement photos need no credit line.

## Theme system

- `theme.css` defines three themes as CSS variables: Sunset Terracotta (default), Romantic Rustic Sage, Candlelit Evening.
- Variables cover colors (`--bg`, `--text`, `--accent`, `--accent-2`) and fonts (`--font-heading`, `--font-script`). Pages never use hard-coded colors or fonts.
- SVG assets use `currentColor`, so they recolor with the theme.
- **Preview switcher:** a floating "Preview theme" control (A/B/C) that appears only when the URL contains `?preview`. The choice persists in the browser across pages. Removing it before launch means deleting one script.
- Known swap risks: text contrast on the dark theme, photos color-matched to one palette, script-font width in the hero.

## RSVP and hidden venue

1. The guest submits the RSVP form. Fields are pending the couple's answers (candidates: name, attending yes/no, meal choice, dietary needs, plus-one, song requests).
2. A serverless function saves the response to the Google Sheet.
3. **Only if the guest answered "yes,"** the function returns the venue name and address.
4. The browser saves the venue so the Schedule page shows it on later visits.
5. Guests who cleared their browser can look up their RSVP by name or email to get the venue again. Lookup returns the venue only if the saved answer was "yes."
6. The venue address exists only in the serverless function's settings, never in the page files. Before an RSVP, the Schedule page shows "Venue revealed after you RSVP."

Limit: anyone who RSVPs "yes" can see and share the address.

RSVP deadline: placeholder, 3 to 4 weeks before the wedding (about July 24 to 31, 2027), to be confirmed by the couple.

## Errors and spam

- If the RSVP submission fails, show a clear message and keep the entered values.
- If the backend is unreachable, show a fallback asking guests to contact the couple.
- Spam protection: a hidden honeypot field and simple rate limiting.

## Testing

- Run the RSVP flow end to end in a browser: "yes" reveals the venue, "no" does not, and failures show the error messages.
- Check every page at phone and desktop widths.
- Check all three themes for readability.
- Confirm the venue address does not appear anywhere in the page source before an RSVP.

## Open items (not blocking the build)

- Which theme the couple picks.
- RSVP form fields.
- Wedding times, venues, dress code, hotel blocks, registry links, and story text.
- Domain name and whether the site is public or password-protected.
- Photos: free-license stock picks and, later, the couple's engagement photos.
- Whether to add the optional feature ideas (countdown is already included; others such as Add to Calendar, wedding party page, and guest photo upload remain optional).
