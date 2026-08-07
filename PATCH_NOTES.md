# Patch Notes

Changes since the site went live, **2026-07-08 → 2026-08-07** (`8902180` → `2253874`).
191 files, 12 merged PRs. Full record with measurements: `WHATS_LEFT.md` §1, §1b, §4*.

**Not yet deployed.** Nothing below is on the live server.

---

## Security

- **No shipped default admin password.** The old one was published in four committed docs. Replaced with an unsatisfiable sentinel plus an FTP-unlocked one-time reset screen that expires an hour after the flag file is uploaded.
- **Change Password was 0% functional.** `preg_replace` read the `$2y$12$` in every bcrypt hash as backreferences and wrote `y$…` to disk. Now `preg_replace_callback`, with the new hash read back and re-verified before the old file is discarded.
- **Login throttle rewritten.** Was a per-connection `sleep()` over an unlocked read-modify-write — 12 parallel guesses all got evaluated, and 10 parallel failures counted as 5. Now one `flock` around the decision and the increment: 5 free attempts, then 15/30/60/120/240s capped at 300s. A refused attempt is not counted and does not extend the window, so retrying cannot lock the owner out further.
- Same throttle now covers the change-password form, sharing one budget with the login form.
- CSRF token on every mutating POST; session cookies `HttpOnly` / `Secure` / `SameSite=Lax`, 8-hour lifetime.
- Uploads validated by extension **and** sniffed MIME, with non-user-controlled filenames; `basename()` + `realpath()` containment on every file read, write and delete.
- `.user.ini` was web-readable — dotfile block added.
- `display_errors` off: a `max_input_vars` truncation was printing the absolute server path four times before the session started.

## Contact form and leads

- **Quote text was being mangled.** `s()` stripped tags, eating `<1/4 inch and >` out of a real request, and double-escaped so the owner saw `&amp;amp;`. Escaping moved to the render boundary.
- **A missing `Referer` was rejected**, which privacy extensions and corporate proxies routinely cause — this cost real leads. Now accepted; only `http`/`https` referrers are host-compared, so Gmail for Android is no longer 403'd as an attack.
- Rate limiter moved above the referer and honeypot checks — honeypot POSTs had been completely unlimited.
- Rejected leads (403/429) are logged instead of vanishing, capped at 10 per IP per window.
- Auto-reply cap normalises Gmail plus- and dot-addressing; seven spellings of one mailbox had produced 15 auto-replies.
- Inline per-field errors with focus management, replacing one generic message.
- Fields capped (5,000 / 200 chars) with truncation announced; inquiry log rotates at 16 MB and is read from the tail.
- `company_name` CRLF-stripped before the `From:` header; non-string `form_type`/`email` no longer 500s.

## Admin — not losing the owner's work

- **Content editor destroyed typed input on any error**, repopulating from disk and then committing those disk values on retry under a green "Content saved".
- **`max_input_vars` truncation** silently dropped the back half of a long save. A positional sentinel now refuses the save instead.
- **A 302 on an expired session turned the POST into a GET**, discarding everything typed. It now renders in place, with a route back to the unsaved work, a `beforeunload` guard and a keepalive.
- Optimistic-concurrency signatures on Edit, Settings and Content, so two tabs cannot overwrite each other.
- Backups: 30 kept (was 5), correct ordering, same-second collision suffix, sequence past 99, item counts shown on the restore page.
- Advanced-mode spec-table JSON no longer discarded on a syntax error.
- Delete confirmation names the photo and drops the false "cannot be undone" — a backup is written first.
- Deleting a product removes its photo, keeping shared ones; upload refuses to overwrite another product's data sheet.
- Per-code upload error messages, a dedicated page for oversized posts, and a writability health banner.

## Public site — correctness

- **A JSON blip took the phone number off the Contact page.** Providers, navbar and footer now render above the catalog loading gate.
- **One bad product bricked every page** until a manual reload — the error boundary is keyed on the route.
- Empty spec tables rendered an invalid empty row inside a 391 × 508 px bordered panel; they now render nothing and the layout collapses to one column.
- Event-listener leak on related-product cards: 1 → 51 listeners after 20 scroll cycles.
- Duplicate React keys removed at 23 sites.
- The selected product's sidebar indicator never appeared on a fresh load — a `border: none` two lines below `borderLeft` wiped it.
- Four product photos showed a placeholder because `photoUrl` differed from the file on disk only by case.
- Sticky quote bar wraps; page padding no longer covers the footer; 375 px overflow fixed — 42/42 product pages clean.
- Catalog cache TTL was inert (nothing ever re-evaluated it); it now re-checks when the tab is refocused.
- 12 s fetch timeout, null-guarded parse, and the content type asserted — a wrong-content 200 used to fail silently.

## Owner-editable data reaching the site

- **Footer social icons built.** Five fields in Business Details had no visible effect on the site at all. Instagram and TikTok added since (**seven**), both defaulting to empty so nothing new appears until the accounts exist.
- **No text field in Business Details could ever be cleared** — a blank arrived as `""` and the hardcoded default rendered. Clearing now works where it makes sense, while still blocking the blanks that produced `© –2026` and `href="tel:"`.
- **Deleting every row of a section re-seeded the hardcoded defaults**, including republishing stale privacy text after the owner removed it.
- Services lead time, certifications, catalog PDF link, company name, slogan and founded year all wired through.
- Fax is no longer a `tel:` link; the About page reads its phone number from site info.
- The privacy page no longer claims it was updated today, every day.

## Brand colours and contrast

- **Pick a pale brand colour and the site shipped white-on-white**, with nothing warning the owner. Readable ink is now computed per surface and recomputed whenever a colour changes, with a plain-language readability note and live ratio under each picker. The save is never blocked — it is his brand.
- 77 translucent-white foregrounds and 12 `text-white` classes follow that ink instead of hardcoding white.
- Brand colours used as *text* darkened for legibility: **274 → 12** failures.
- Page-header eyebrow, all eight pages: **1.04 → 5.14:1** worst case.
- 165 accent glyphs and product-type chips on light backgrounds moved to the text-safe teal: **2.18 → 5.26:1**.

## SEO and accessibility

- **Every page but the homepage was an orphan.** Navigation was 63 `<button>`s against 15 links, so crawlers had nothing to follow and Ctrl/Cmd-click and "Copy Link Address" did nothing. All navigation is now real `<a href>`.
- **Every page announced itself as the homepage** — shared links previewed wrong and crawlers saw sitewide duplicate content. Per-route canonical and `og:url` added.
- Sitemap is generated from the live catalog on each request: **9 → 51 URLs**, tracking products added or deleted in the admin with no redeploy.
- FAQ structured data reads live content; product JSON-LD description fixed.
- Sortable table headers announce sort state; the FAQ accordion is exposed correctly to screen readers; the mega-menu is keyboard-operable.
- Every form control labelled; admin focus order and accessible names fixed.
- Back button no longer trapped by the category-filter cleanup.

## Performance

- **Images 9.36 MB → 2.67 MB (71.5% smaller).** Nothing cropped, nothing retouched, not one filename changed; every output quality-scored against its original.
- The product photo is the largest element painted — switched to eager; the footer logo to lazy.
- Long-cache scoped to `/assets/` only. It had covered owner-uploaded images and the logo, meaning a replacement would not reach a returning visitor for a year.

## What the owner can now change without a developer

Nine admin tabs. Everything below writes to one of three JSON files or two upload
folders, and every save takes a backup first.

**Business Details** → 36 fields: company name, short name, slogan, founded year,
description; phone, dial string, fax, email; full street address; opening hours
and days; ISO line plus any number of other certifications; feet-in-stock and
minimum-order figures; seven social links; any number of About paragraphs; the
four brand colours and the logo; full-catalogue PDF link. These feed the navbar,
footer, contact page, About page, search-engine structured data, and every
`tel:` / `mailto:` link on the site. **The contact form's recipient address is
this record's email field** — changing it redirects every future lead.

**Page Content** → 96 fixed copy fields in 12 groups, plus 16 add/remove/reorder
lists:

- Hero: badge, three headline lines, sub-headline, both button labels **and which
  page each button goes to**
- Page headers for Home, Services, Industries, About, FAQ, Contact and Privacy
- Navigation labels and footer headings
- 45 fields covering every label, placeholder, hint and error message on the
  contact form
- Products & Services cards, trust-bar stats, industries grid — each with an icon
  picker
- Industries detail blocks: applications, linked products (`SKU | Name`,
  validated against the real catalogue so a typo cannot ship a dead link),
  certification chips
- Value-added services: description, lead time, bullet points, optional brochure
- About timeline, team & capabilities, certifications
- FAQ questions, grouped by category
- Company menu, footer quick links, hero proof points, hero trust ticker
- Privacy policy sections
- **Search-engine title and description for all nine pages**
- Contact page sidebar tips

**Products** → add, edit and delete. Per product: SKU, name, caption, part type,
description, specifications summary, operating temperature, badges, photo, data
sheet label, two spec tables (row editor or raw JSON), and additional PDFs.

**Uploads** → product photos land in `/uploads/images/` named after the SKU with
the product's photo link set automatically; data sheets replace in place in
`/pdfs/` so existing links keep working, and the upload refuses to overwrite
another product's sheet.

**Read-only tabs** → Inquiries, Audit Log, Backups (restore any of the last 30),
Change Password, Help.

Two behaviours worth knowing. Changing a brand colour re-skins the whole site and
the readable text colour is recomputed automatically — the picker shows a live
contrast ratio and a plain-language warning, but never blocks the save. And
clearing a field now genuinely removes it from the site rather than falling back
to a hardcoded default, which was broken until this release.

## Infrastructure and documentation

- SPA rewrite in `.htaccess` — without it every deep link and refresh 404'd.
- Local dev serves the real data directory; three code paths had never run locally.
- Duplicate catalog copies removed — a fourth copy had been drifting silently.
- Runtime state files kept out of the repo; the uploads folder added to the deploy manifest and created at runtime with a protective `.htaccess`.
- A verification harness of 30+ suites is tracked in-repo and is the evidence behind every item above.
- The admin Help page rewritten as the single source of truth; the Word handoff document retired (12 of its statements were wrong, four actively harmful).
