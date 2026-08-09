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
- **The auto-reply's response promise is now editable**, plus an optional temporary notice for a shutdown or a backlog. A corrupt or missing `content.json` falls back to the built-in text and never stops a lead.

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
  contact form, plus the auto-reply's two response promises and an optional
  temporary notice
- Product families: the categories the catalogue groups by, in order, with the
  product count beside each
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

---

# 2026-08-08 — UI/UX audit remediation (PLAN-8)

Source: [UI_UX_AUDIT_2026-08-08.md](UI_UX_AUDIT_2026-08-08.md). 50 items —
**18 shipped, 25 deferred, 7 handed to the owner.** Four of six phases were
executed; scope was cut to severity A and B by agreement partway through, and
two whole phases were not started. Everything not shipped is named below, and
the deferred items are still live defects.

**Not yet deployed.**

## Certification accuracy

- **18 of 42 product pages printed a UL certification category the product's
  own data does not claim — measured over all 42 here, it is 20.** Two
  derivations ran on the same page from the same `badges` array:
  `extractComplianceBadges()` collapsed every UL mention — `U/L`, `UL File`,
  `UL Subject`, `UL Recognized`, `224`, `VW-1` — onto the single label
  "UL Listed" for the header chip row, while the "Approvals & Certifications"
  block 200 px below it separated Recognized / Listed / Approved correctly. Six
  pages said Listed against Recognized, three said Listed against Approved,
  nine said Listed where the only real UL fact was VW-1 flammability. UL Listed,
  UL Recognized and UL Approved are different UL categories with different
  scopes, and IPC sells into aerospace, medical and automotive — this was a
  compliance claim on a document a purchasing engineer may rely on, not a
  wording slip. `extractComplianceBadges` is deleted; there is one derivation
  now. 20 of 42 to 0 of 42. (A1)
- **The two worst cases were not in the audit's table.** `CT`'s own spec table
  reads "Recognized under the Components program of Underwriters' Laboratories
  File No. E129972" and the header called it *Listed*. `IP49VP`'s source says
  "U/L 224" — a standard number for extruded tubing, not a category in any
  sense — and the header called that *Listed* too. Both fell out of the audit's
  comparison because it only compared pages where *both* blocks printed a UL
  category, and in these two the approvals block printed none. (A1)
- **`CT` would have lost a true certification when the header row went.** The
  approvals vocabulary expected "UL … Recognized" within 18 characters and CT's
  phrasing is reversed and spelled out, so deleting the wrong header chip would
  have left a genuinely UL-Recognized product claiming nothing at all. A second
  boundary-anchored alternative was added, in `src/App.jsx` and
  `admin/config.php` together. Measured over all 42 before changing it: CT is
  the only product it moves. (A1)
- **The same certification was printed twice per page in two spellings.**
  "Product Features" printed the raw `badges` array verbatim while the
  approvals block printed the derived vocabulary, so `CC90`, `CCS` and `IP13SP`
  each said the same thing twice. Three blocks became two; 27 badge strings are
  absorbed into the approvals block and none is lost. (C32)
- **The site claimed "ISO 9001:2008" — a revision withdrawn in September 2018 —
  in three places.** `site-info.json` says only "ISO 9001"; the version had been
  typed into the copy by hand. Writing ":2015" because it is the current
  standard would have invented a certification claim, so the code defaults now
  say "ISO 9001" with no revision and the real answer is an owner action pending
  the registrar. Zero occurrences in `App.jsx` and zero in the shipped bundle.
  **The three live strings are still wrong on the site** until the owner edits
  them. (A2)
- **The SKU read as a third button.** On the product header it was a filled pill
  at button height, immediately left of "Download PDF" and "Request Quote". It
  is a monospace label beside the product name now. (C45)
- **Product names were shouted.** `NONMETALLIC LIQUID-TIGHT CONDUIT COUPLING` —
  all-caps applied to the longest strings on the site, which are exactly the
  ones that wrap. (C47)

## Indexing and sharing

- **All 42 product URLs described themselves identically.** Measured: 1 distinct
  `<title>`, 1 distinct meta description and 1 distinct `og:title` across 42
  indexable pages, each with a self-referencing canonical and each listed in the
  sitemap. The product name now drives all three, and is the page's `<h1>` — it
  had been an `<h2>` under an `<h1>` reading "Product Catalog", so every product
  page announced the same top-level heading. 1 to 42 distinct, with no URL moved
  and every canonical still byte-identical to the sitemap's `<loc>`. (A3)
- **Every mistyped URL returned the homepage at 200 with its own canonical.**
  `/quality`, `/prodcuts` and `/contact-us` each became a self-canonicalising
  duplicate of the homepage, and a visitor who mistyped got no signal at all.
  There is a real not-found page now, carrying `noindex` and **no** canonical —
  a canonical on a soft 404 is the half-fix that looks done. The server still
  answers 200, deliberately: the catch-all rewrite is what makes every deep link
  work. (A5)
- **Every URL with two or more path segments was a blank white page.** This is
  not in the audit — it was found while chasing A5's last failing assertion.
  `vite.config.js` set `base: './'`, so the shell asked for
  `./assets/index-*.js`, the browser resolved that against the current path and
  requested `/products/CC/assets/index-*.js`, and the SPA catch-all answered
  *that* with `index.html` at 200 with `Content-Type: text/html`. The browser
  tried to execute HTML as JavaScript and stopped. The audit only sampled
  single-segment typos, where `./` happens to resolve correctly, so it reported
  the soft 404 and never saw the white screen behind it. `base` is `'/'` now.
  (A5, and a defect nobody had reported)
- **Every link pasted into LinkedIn, Teams, Slack or an email client previewed
  as a bare text card.** `og:image` shipped as a TODO comment and no usable tag
  while `twitter:card` said `summary_large_image`. There is a 1200x630 card at
  33 KiB now, drawn from the brand's own navy, accent and wordmark. The static
  tag in `index.html` is the one that does the work — LinkedIn, Slack and
  Facebook do not execute JavaScript when they unfurl a link — with a
  per-product photo override for crawlers that render. (A4)
- **`/datasheets` served the homepage's meta description.** `content.json`'s
  `seo` array has 9 rows and no `datasheets` row, so it fell through to
  `home.desc`. A route with no row now falls back to its *own* default before
  the homepage's, guarded so it cannot re-seed a deletion. 9 of 10 distinct to
  10 of 10, with `content.json` untouched. The mechanism was the defect: any
  page added later without a row did the same thing silently. (B25)

## Catalog browsing

- **The primary action on the Product Index was cut off on every row.** All 41
  "View Product" buttons overflowed the table wrapper's right edge. Reproduced
  here at 1024 (41 of 41, table 1138 px in a 974 px wrapper) but not at 1440,
  where the audit measured it — the table was content-sized and glyph metrics
  differ between machines. 0 clipped at 1440, 1280 and 1024 now. (A6)
- **The table gave its two shortest columns 450 px and its longest content
  130 px.** Four column widths were declared and the browser ignored all of
  them, because a width is only a suggestion under content-driven layout. Part
  ID 223 and Part Type 227 held a short SKU and a small chip; Description got
  130 and wrapped to one to three words a line. Rows ran to 263 px and 41
  products made a **9,460 px** page. The widths are real now and Description
  takes the slack at 300 px. **9,460 px to 5,042 px.** Three of 42 rows are
  still over the 120 px target, held as a printed ratchet — closing the last
  34 px would either re-starve Description or truncate a certification list,
  and losing a spec string is the same class of harm as A1. (B19)
- **The no-results panel stopped 130 px short of the table's right edge**,
  leaving a grey band, because `colSpan` was hardcoded to 6 against a 7-column
  table. Derived from the column count now. (B20)
- **The catalog sidebar hid ten of its eleven categories.** Every family
  accordion opened on first paint, so the region was 2,932 px of content in a
  718 px box with nine of the ten headings below an inner fold and no cue that
  it scrolled — a visitor saw one category and no way to know the catalog had
  ten more. It arrives collapsed now with only the selected product's family
  open (2,932 px to 1,206 px), and the remaining scroll has a real 10 px
  scrollbar measured at 4.55:1 instead of a 4 px thumb at 0.4 alpha. The family
  toggles also had no `aria-expanded` at all. (B27)
- **The catalog was counted three different ways on four surfaces**, two of them
  on the same screen: 41 in the sidebar and the dashboard header, 42 in the
  dashboard's own approval filter four lines away, and 42 on `/datasheets`.
  `VALUE-ADDED` was excluded from the sidebar while being present in the Product
  Index, Datasheets and the sitemap. The owner settled it as a product; all four
  surfaces read 42, asserted from rendered text. (B12, C48)

## Lead capture

- **A screen-reader user submitted a quote request and got silence.** The form
  was replaced by a "Quote Request Received" panel with zero `aria-live`,
  `role="status"` and `role="alert"` regions on the page and
  `document.activeElement` still on `<body>`. The error path had been given a
  proper alert region in the previous release; the success path never got the
  same treatment, so the one outcome the visitor wanted confirmed was the one
  that announced nothing. It is an announced region that takes focus now. (B16)
- **Refreshing the confirmation threw it away and rebuilt an empty form**, and
  there was no distinct URL to hang a conversion goal on — on a site whose
  entire purpose is lead capture. It is `/contact?sent=1` now; reloading
  re-renders the confirmation and sends no POST, and Back returns to the form
  without re-submitting. (B17)
- **The "for urgent inquiries" line had a missing glyph in it.** It rendered as
  `[phone] 630.771.0700 · [fax] 630.771.0701 · ▯ sales@insulationproducts.com` —
  a tofu box where the mail icon should be, at the exact moment a visitor might
  want to make contact urgently. Emoji coverage is a font dependency; those are
  words and inline SVG now. *The audit also reported the phone, fax and email
  there as plain text rather than links — measured, they were already real
  `tel:`/`mailto:` links before this change.* (B18)
- **330 px of empty page sat between the buttons and the footer**, and this was
  the only page header on the site with no eyebrow above its `<h1>`. The gap was
  not the panel's padding, which is what it looked like — reducing the padding
  made it *bigger*, 360 to 376, which is what pointed at the wrapper being
  forced to a full viewport while holding 500 px of content. 376 px to 45 px.
  (B18)
- **The delivery-date field suggested a date 13 months in the past** —
  `e.g. ASAP, end of month, 6/30/2025` — which reads as a dead site. The code
  default is dateless now. **The live string is still wrong on the site** until
  the owner edits it. (B22)

## Deferred — these are still live defects

Not fixed. A reader of this file should not conclude otherwise.

- **On a phone, the quote form is 1,213 px down the page**, below four contact
  cards and a tip panel, on the page that exists for the form. The only correct
  fix reorders the DOM so the form comes first and restores the desktop layout
  with `lg:order-*`; a CSS-only reorder leaves keyboard tab order following the
  DOM while the eye follows the layout. That was not attempted rather than
  half-attempted. The suite's assertion for it is deliberately inverted — it
  asserts the defect is still present, so a later fix must come back and flip
  it. (B26)
- **Legibility and input (Phase E) was not started.** Product part numbers are
  painted at **1.64:1** against white — the one string a buyer scans a catalog
  for, nearly invisible on a phone (B8). Secondary grey text sits at 2.37–2.54:1
  across about 65 instances (B9). Footer text fails at 4.25:1 and 2.64:1 across
  121 instances (B10). `prefers-reduced-motion` is not honoured (B14). There is
  no skip link anywhere on the site — WCAG 2.4.1, Level A (B15). The two primary
  actions on the product page are 28 px tall on mobile (B24). `/services` skips
  a heading level (B28). The trust marquee is an unlabelled tab stop (C50).
- **Chrome, assets and copy (Phase F) was not started.** The mobile menu has no
  scrim, does not lock the page and ignores Escape (B13). The Services lead-time
  banner reads "≤ 1 week · ≤ 1 week (JIT by agreement)" (B21). The product photo
  ships no intrinsic dimensions and shifts the layout on load (B23). The footer
  paragraph is missing a space — "adhesives.$50 minimum order." — on every page
  (B11). Five products still carry a `placehold.co` photo URL (A7 — the *code*
  already treats such a URL as "no photo", so the branded panel is what renders;
  clearing the five values is an owner action).
- **All 22 severity-C suggestions were deferred** except C32, C45, C47 and C48,
  which were carried because they sat inside items being fixed anyway.

## Owner actions — not yet applied to the live site

These live in `data/*.json`, which is live customer state and is not editable
from this repo. Each is done in the admin dashboard; none needs a developer.

| # | Admin page | What to change |
|---|---|---|
| 1 | Page Content | Three "ISO 9001:2008" strings to the confirmed revision (A2) |
| 2 | Page Content | Required-date placeholder — remove "6/30/2025" (B22) |
| 3 | Products, Edit, x5 | Clear `photoUrl` on `IP12GA - IP1274`, `IP13SP`, `IP25PU`, `IP30UV`, `IP47HV` (A7) |
| 4 | Page Content, Footer Links | Add the "Datasheets" row (C35) |
| 5 | Page Content | About timeline "2024 · 50 Years"; privacy "Effective Date: January 1, 2025" (C42) |
| 6 | Business Details | Confirm or clear the five social URLs (C36) |
| 7 | Branding | Optional: a transparent-background or horizontal logo (C43) |

---

# 2026-08-08b — PLAN-8 Phase E, the WCAG tier

Appended after the section above, which recorded Phases A–D and listed Phase E
as **not started**. It is done now. Running total for PLAN-8:
**25 shipped, 18 deferred, 7 handed to the owner.**

**Not yet deployed.**

## Legibility

- **Product part numbers were painted at 1.64:1 against white** — the one
  string a buyer scans a catalog for, and on a phone it was very nearly
  invisible. 38 instances at 12 px bold. The selected part number had its own
  version of the same problem at 4.15:1. Both are legible now (~7:1). (B8)
- **Secondary grey text sat at 2.37–2.54:1 across 358 measured instances** —
  the homepage stat sub-lines, every certification line on `/datasheets`,
  "Showing 42 of 42 products", the catalog sidebar's family headings. One of
  them was written as a utility class rather than a colour value and survived
  the first pass; the measurement caught it, a search of the source would not
  have. (B9)
- **Footer text failed at 4.25:1 across 234 instances and 2.64:1 across 52** —
  Quick Links, the company description, the copyright and the domain line. Now
  solid colours on the navy at 10.5:1 and 6.1:1, rather than white at 45% and
  30% opacity. Opacity over a fixed navy is just a colour with extra steps, and
  it is what let these fail without anyone noticing. (B10)

  *The tool nearly missed this one.* Its first version scored white-at-45% as
  **15.96:1** — the figure for solid white — because it never composited the
  text's own transparency. A failing row reported as one of the best on the
  site: precisely the defect being hunted, reproduced inside the instrument.
  Once corrected it returned 4.25 and 2.64, matching the audit to two decimal
  places.

- **One contrast failure is measured and deliberately left**: the spec-table
  sub-header at 3.11:1. Both its ink and its background are computed from the
  owner's brand palette, so the fix belongs to that derivation across all four
  palettes — a different item. Hardcoding a colour would look like a fix and
  would be discarded the moment the owner picked a new brand colour. It is
  held with a counter so a second such failure cannot hide behind it.

## Motion, keyboard, and touch

- **`prefers-reduced-motion` was honoured by exactly one rule.** A visitor who
  asks their operating system to reduce motion still got the homepage
  certification marquee scrolling at them. The audit found one animation still
  running; asserting *zero* rather than assuming one found a **third** nobody
  had ever named — the spinner on the quote-form submit button. (B14)

  Stopping the marquee took more than switching the animation off: the strip is
  built from two copies of the certification list so it can loop without a
  seam, so freezing it would have printed every certification twice, side by
  side, with no explanation. Under reduced motion there is now one copy, it
  wraps to fit, and it is no longer a keyboard tab stop — that stop existed
  only to pause a scroll that no longer happens.

- **There was no skip link anywhere on the site.** Tab order on every page
  started at the logo and walked the whole header, both dropdown menus
  included, before reaching any content. WCAG 2.4.1 Bypass Blocks, Level A —
  and one of the few items here that is a legal-compliance question and not a
  judgement call. (B15)

  Tested with real Tab and Enter presses rather than by moving focus in code,
  because Chromium does not treat scripted focus the same way and a skip link
  can be "present" to a script while being invisible to the person it exists
  for. The link must also *move focus* into the content, not merely scroll
  there: without that, the next Tab jumps straight back to the navigation the
  visitor just asked to skip. Confirmed by breaking it deliberately and
  watching focus fall away on all ten routes.

- **On a phone, the product page's two primary actions were 28 px tall** —
  "Download PDF" and "Request Quote" — and every tappable phone number and
  email address on the site was 16–19 px. Both are how an order starts. They
  are 44 px now, on touch devices only; the desktop layout is measured
  unchanged. (B24)

  The inline phone numbers grew their tap area without moving a single word of
  the surrounding paragraph.

- **`/services` skipped a heading level**, the only page on the site that did.
  Fixed at the document level with no change to how anything looks. (B28)

## Still deferred after Phase E

Phase F was not started: the mobile menu has no scrim and ignores Escape
(B13); the Services lead-time banner repeats itself (B21); the product photo
shifts the layout as it loads (B23); the footer paragraph is missing a space —
"adhesives.$50 minimum order." — on every page (B11); five products still carry
a placeholder photo URL (A7, an owner action). B26 — the mobile quote form
sitting 1,213 px down the page — also remains open, along with the 22
severity-C suggestions.

---

# 2026-08-08c — PLAN-8 Phase F, and the end of the plan

All six phases are now executed. Running total: **30 shipped, 13 deferred,
7 handed to the owner.** Every severity-A and severity-B item in the audit is
closed except B26.

**Not yet deployed.**

## Chrome, assets and copy

- **The footer said "…industrial adhesives.$50 minimum order." on every page of
  the site.** A missing space, in the one paragraph that appears on all twelve
  routes. It is a JSX rule with teeth: a newline between two pieces of text
  becomes a space, but a newline between text and an inserted value is deleted
  outright. Swept the rest of the site for the same shape — there are no
  others. (B11)
- **The Services banner read "Standard Lead Time: ≤ 1 week · ≤ 1 week (JIT by
  agreement)"**, which reads like something broken rather than a fact. Five
  services say one thing; Kitting & Bagging says a qualified version of the
  same thing; the summary de-duplicated exact strings and joined whatever
  survived. It now leads with the common lead time and mentions the exception
  beside the pointer to the cards. The owner's wording is not rewritten — he is
  entitled to add "(JIT by agreement)", and normalising it away would delete
  the thing he took the trouble to say. (B21)
- **The product photograph reserved no space, so the page moved under the
  reader as it loaded.** It is the largest image on every product page. Both it
  and the "image coming soon" panel that stands in for it now hold the same
  fixed shape from the first paint — the shape they were already being drawn
  at, so nothing looks different. Measured contribution to layout movement:
  zero, on a throttled connection, at both desktop and phone widths. (B23)
- **Five products still point at a third-party placeholder image service.** The
  site already ignores those addresses and draws IPC's own panel instead, so no
  request ever leaves for them — now confirmed by watching every request across
  all 42 product pages rather than by reading the catalogue. Clearing the five
  values remains an owner action. (A7)

## The mobile menu

**The menu opened, and the page carried on underneath it.** Measured on a
phone-sized screen: the page behind scrolled freely while the menu was open,
the Escape key did nothing, and of fourteen presses of Tab only five landed on
anything in the menu — the rest walked through the page behind it, invisibly.
For anyone navigating by keyboard or screen reader, the menu was a suggestion
rather than a state.

It now behaves like a menu: the page behind is held still, keyboard focus moves
into it and stays there, Escape closes it and puts focus back on the button
that opened it, and the reader returns to exactly the position they left. That
last part is why the lock is built the way it is — the obvious approach throws
the position away and dumps the visitor back at the top of the page. (B13)

## Still open

- **On a phone, the quote form is 1,213 px down the page**, below four contact
  cards and a tip panel. Unchanged; it needs the contact page's markup
  reordered rather than restyled, and reordering it by CSS alone would leave
  keyboard users tabbing through it in the old order. (B26)
- **A small residual page movement on product pages, from the footer**, found
  while measuring B23 and not part of it. Not in the audit.
- **The 22 severity-C suggestions**, except the four carried inside other work.
- **Three of 42 rows** on the Product Index remain over the 120 px target.

---

# 2026-08-08d — B26, and every A and B item is closed

**31 shipped, 12 deferred, 7 handed to the owner.** Nothing in the audit's
severity-A or severity-B tiers is outstanding.

**Not yet deployed.**

## Lead capture

**On a phone, the quote form was 1,213 px down the page.** Four contact cards
and a "for fastest response" panel came first, on the page that exists for the
form. It now sits directly under the heading, at 638 px, with the contact
details following it.

The markup was reordered rather than restyled. Doing it in CSS alone would have
left the page *looking* right while the keyboard still moved through it in the
old order — press Tab and the highlight jumps to the bottom of the page. That
is worse than the problem it fixes, and invisible to anyone testing with a
mouse. The desktop arrangement is unchanged, and is now checked on every run
rather than assumed.

Hoisting the form pushed the phone number below the whole form, which trades
one way of getting in touch for another. A single line carrying the phone
number and email address now sits above the form on small screens only. (B26)

## Still open

Nothing in severity A or B. What remains is the 22 severity-C suggestions —
minus the four already carried — plus three smaller things found while
measuring: three of 42 rows on the Product Index still exceed the target
height, one spec-table header colour is decided by the brand palette rather
than by this work, and a small residual page movement on product pages that
comes from the footer.

---

# 2026-08-09 — PLAN-8, the severity-C suggestions

Source: `UI_UX_AUDIT_2026-08-08.md`. The A and B tiers closed on 2026-08-08.
This section covers the fifteen severity-C items that needed code, in three
commits — two of which shipped on 2026-08-08 without their notes and are
recorded here.

**All 50 audit IDs are now resolved: 46 shipped, 4 deferred with a stated
reason, 10 owner actions.**

## Catalog browsing

**`/products` was the CC product page.** The canonical catalog URL
auto-selected the first product and rendered its detail under a "Product
Catalog" banner and the sub-line "Select a product to view full
specifications" — with one already selected. Measured: `/products` and
`/products?productId=CC` rendered byte-identical text. So the page a buyer
reaches by searching "IPC product catalog" was one conduit coupling, and the
site declared two URLs for it. The bare route is now a grid of all 42 products
— photo, SKU, family, name — with no product selected, the sidebar intact
beside it, and a real `<h1>`. No URL moved: all 42 product canonicals are still
the self-referencing `?productId=` form, and the sitemap is unchanged. (C29)

**Six homepage market cards all pointed at the same place.** "Medical Devices"
and five others linked to bare `/industries`, which carried zero ids, so the
visitor landed at the top of a **3,479 px** page with their industry third of
six and nothing confirming they had arrived. Each section has an anchor now and
each card links to its own. Ids come from `iconKey`, not the owner-editable
title, because renaming "Medical Devices" in Page Content would otherwise break
every link pointing at it.

The first version of that shipped **three dangling fragments out of six** and
the suite passed. Cards and sections do not share a vocabulary — the cards say
`auto` / `aero` / `electronics`, the sections say `automotive` / `aerospace` /
nothing — so `industry-${m.iconKey}` produced `#industry-auto` against an id of
`industry-automotive`. It looked correct because the one anchor checked by hand
was `medical`, spelled the same in both lists. Fragments are now resolved
against the live industry list, and the suite asserts every emitted fragment
resolves to an id the page actually rendered. (C30)

A follow-up found the anchor offset had never worked either: the scroll-margin
was a **second `style` prop** on the same element, and JSX keeps the last one,
so esbuild had been printing "Duplicate style attribute" on every build while
the value was silently dropped. A cold load of `/industries#industry-medical`
put the heading at `top=0`, underneath the sticky navbar. It now lands at
`top=84`.

**Mobile product names were cut mid-word.** "Commercial Grade Polyolefin
Tubi…" was most of the catalog in the one view where the name is all a buyer
has. Clamped to two lines on a word boundary. (C46)

**Four spec tables were reported as overflowing at 1440 and do not.** The audit
measured `IP17TW-18SW-19LW` at 435 px in a 389 px column, plus three others.
Re-measured across all 42: **zero**. Nothing was changed; the assertion is kept
as a regression guard. (C49) — see the note under *Deferred* about what this
measurement depends on.

## Orientation and indexing

**No page had a breadcrumb and no page emitted `BreadcrumbList`.**
`nav[aria-label*=breadcrumb]` returned nothing on all 10 routes, on a
42-product catalog with a deep-linkable detail view. Product pages now carry
Home › Product Catalog › *family* › *product*, and the three catalog views
carry the matching shorter trails, with structured data alongside. The family
comes from each product's own `partType` checked against the owner-editable
family list — verified on all 42 individually, not by spot check — so there is
no second hardcoded list to drift.

This collapsed a latent bug on the way. The trail's last item has to equal the
page's own canonical, and the canonical was built inline in one place and would
have been built again in another. They would not have matched: the router
encodes a query with `URLSearchParams`, which writes a space as `+`, while the
canonical uses `encodeURIComponent`, which writes `%20`. **Nine product ids
contain a space, a `/` or an `&`** — `IP12GA - IP1274`, `IP41NE / IP43VT`,
`IP44A2 & IP45A3` — and a canonical is compared as a string by everything that
reads one. There is one definition now. (C33)

## Chrome, assets and copy

**Fourteen FAQ answers, eighteen now, and no way to open them.** Scanning for
an answer meant a click per question. There is a bulk expand/collapse control,
and the thing it must not do is bypass the accessibility work underneath it: a
collapsed answer leaves the accessibility tree and find-in-page at the *end* of
its collapse transition, and a bulk toggle that drove the animation directly
would silently put back the defect that fixed — a screen-reader user hearing
every answer to every question at once. It drives the same per-item state a
click drives. Verified against the real accessibility tree, and separately with
`transitionend` prevented from ever firing, which is what a background tab
does: all 18 panels still leave the tree. (C41)

**The contact form did not say what `*` meant, or what happens to your
details.** Four labels carried a star with nothing explaining it, and a form
collecting a name, email, phone and company had no privacy note anywhere near
the submit control. Both are there now, on both tabs, and both are
owner-editable. The Privacy Policy link is added in code rather than being part
of the editable string, so retyping the note cannot break the link. (C39)

**The phone placeholder said "Optional".** Every other placeholder on the form
is a worked example; this one repeated what the unstarred label already said
and taught nothing about the format. The default is now a real number. The live
value is saved in `content.json` and is **owner action 10** — this release does
not edit live customer data. (C39)

**The page-header band was 48 px of padding top and bottom around three short
lines** — a 226 px band for about 130 px of content, on all nine inner pages.
Now 36 px at desktop and 24 px below 768: **−24 px and −16 px per page**,
measured across all nine. Padding only; nothing reflowed. (C37)

**With JavaScript off the site was a blank white page** with no phone number.
A `<noscript>` block now carries the company name, phone, fax, email, address
and hours, styled inline because the CSS bundle may be the thing that failed.
Its values are a second copy of `site-info.json` and will not follow an admin
edit; the comment beside them says so. (C38)

**Both contact forms had no `method` and no `action`,** so they defaulted to
GET against the current address. If the bundle ever failed to load, submitting
put the sender's name, email and message into the query string and reloaded the
page: the enquiry was lost and the personal data went into browser history and
every proxy log along the way. They post to `contact.php` now, which reads
`$_POST` directly and whose field names these already matched. (C40)

**110 links opened a new tab without saying so.** All now carry
`rel="noopener noreferrer"` — two were bare `noopener` — and announce the new
tab in their accessible name. (C34)

**A service card with no brochure rendered an empty grey strip** "to preserve
the card silhouette". Beside Hot-Stamp Marking, which has a real link in
exactly that position, Cut-to-Length read as a link that had failed to load.
Empty sections render nothing. (C44)

**The trust marquee was an anonymous tab stop** — a bare `div` with
`tabIndex={0}`, 5,012 px wide, announcing the whole certification strip as one
unnamed blob. The tab stop is deliberate, because focus pauses the scroll, so
it keeps the capability and gains a name that says so. (C50)

**The header logo's `alt` was not changed, and that is the fix.** The audit
proposed naming the destination because the logo links home. The navbar `<a>`
already carries `aria-label="Insulation Products Corporation — Home"`, which
overrides the image's `alt` for the accessible name, so naming it again reads
the same phrase twice. All three logos are decorative in context. `alt=""` is
correct. The artwork itself remains owner action 9. (C43)

## Deferred — these are still live defects

- **Datasheet file sizes are not shown** (C34). The PDFs are owner-uploaded
  through the admin, so a build-time manifest goes stale the moment a datasheet
  is replaced, and a per-request read means a new dynamic endpoint. The `rel`
  and new-tab announcements did ship.
- **The no-JS form response is JSON, not a styled page** (C40). Giving it HTML
  means changing the response contract of a file that deliberately does not
  HTML-escape. The enquiry arriving matters more than what the fallback looks
  like.
- **The industry catalog link is not scoped to its industry** (C31). The
  Product Index filters by product *family*, and the data carries no
  industry-to-family mapping — industries carry individual SKUs. Inventing one
  would be a second hardcoded list of exactly the kind PLAN-6 spent a plan
  removing. The quote link *does* carry its industry, and the form arrives with
  "Industry: Medical Devices" in the notes.
- **The page-header band is still 32–71% empty on its right** at 1440 (47–52%
  typical), and the homepage hero's right column is still empty below the stat
  cards (C37). What belongs in that space is photography, which is PLAN-7's
  subject. Widening the sub-line into it would produce a 1232 px line, which is
  worse to read, not better.
- **The C49 spec-table guard is font-dependent.** It passes where `system-ui`
  resolves to Segoe UI and fails where it resolves to DejaVu Sans, which is
  ~21% wider for the same string — on a Linux CI box the four tables the audit
  named overflow again by 7–46 px. The layout is identical; only the font
  differs. Worth knowing before treating a red there as a regression.

## Owner actions — not yet applied to the live site

**Eight** — the seven carried from the A/B tiers, plus one new from C39.
Nothing in this release edits `data/*.json`; all eight are admin edits the
owner makes himself, and none needs a developer.

1. **A2** — the real ISO 9001 revision, three strings in Page Content. The
   2008 revision was withdrawn in 2018; confirm with the registrar before
   typing anything, because this is a certification claim and IPC sells into
   aerospace, medical and automotive.
2. **B22** — the required-date placeholder in Page Content.
3. **A7** — clear five `photoUrl` values in Products → Edit, which makes IPC's
   own branded panel the first paint instead of a third-party grey tile.
4. **C35** — add a Datasheets row in Page Content → Footer Links.
5. **C42** — two dated strings in Page Content: the About timeline
   "2024 · 50 Years", and privacy "Effective Date: January 1, 2025".
6. **C36** — confirm or clear five social URLs in Business Details.
7. **C43** — optional replacement logo artwork; the current file paints an
   opaque near-white rectangle across its full artboard.
8. **C39, new** — Page Content → Contact Page — Form → *Field: Phone —
   placeholder*. Currently `Optional`; should be a worked example such as
   `e.g. 630.771.0700 ext 12`. The shipped default is already that, so this
   only changes the value saved on the live server.

**Not yet deployed.**

---

# 2026-08-09b — PLAN-7 items 1 and 2, marketing imagery

## The site had no photography

**Seven pages painted none of it.** `src/App.jsx` held four `<img>` elements in
9,900 lines and three of them were the logo. Meanwhile `public/images/site/`
held 22 files, about 1 MB, referenced by nothing and shipping to the server on
every deploy — the customer's own photographs of his own team, his own
building and his own printed work, paid for on every page load and shown to
nobody.

Four of them are now on the page: the printed sleeves in the homepage hero's
right column, the team and the facility in a band between the feature cards
and the markets, the facility again on About, and the printed work again above
the Services cards.

**This cost nothing.** The plan expected the site to get heavier; measured, the
files already cover the boxes they are painted into as well as their sources
allow, so not one was re-encoded. Buying a true retina hero photo would have
cost **75 KB for a 0.29× sharpness gain** on a decorative image, and was not
bought.

**A hidden image is still downloaded.** The hero photo is desktop-only, and the
first version hid it with a CSS class — which costs the visitor the bytes and
shows them nothing. On a phone the file is now never requested: **122 KB saved
on every mobile homepage load**, confirmed by intercepting the requests rather
than by reading the markup.

The photograph sits where **no text crosses it**. That is not a style
preference: three full-bleed treatments were built and rejected, because the
best photograph in the set is a photograph *of text* — printed sleeves reading
"TRANSDUCER END" and "CAUTION: RF SHOCK HAZARD" — and a headline over it is
typography over typography that no darkening fixes.

## The contrast harness would have lied about it

**The tool that checks whether text is readable could not see photographs.**
Its background reader understood gradients and silently ignored anything else,
then scored the text against whatever was *behind* the thing it had ignored —
returning a confident pass for a background nobody sees. Nothing on the site
had a photograph behind text, so it had never mattered. Putting one on the
homepage would have made it matter on the busiest element there is.

It now records every layer it cannot read, and all three contrast suites fail
if they ever see one. Alongside it, a second method reads the **actual pixels**
under the text and scores against the worst one — because an average passes a
white headline over a photo that is 90 % dark with one bright highlight, and
the headline is illegible exactly where the highlight is.

Proven rather than asserted: over a test photograph that is black with one
white corner, the old method reports **21.00:1** (a comfortable pass), the
average reports **19.42:1**, and the real worst pixel under the text reports
**1.00:1**.

## Deferred

- **The catalog cover in the footer** was the fifth planned slot. The catalog
  PDF field is empty, so the slot would paint nothing — and shipping a 127 KB
  cover image for a slot that never renders would recreate the exact defect
  this work removes. Worth adding the day that field is filled in.
- **Owner-editable image slots and an image picker** (PLAN-7 item 3) are not
  started. Every slot is a fixed path today, so changing a photograph still
  needs a developer.
- **The team photograph is painted slightly larger than it really is** — a
  726 px file in an 845 px box. The original is the same size, so no
  re-encoding can fix it; only a new photograph would.

**Not yet deployed.** `public/images/site/` joins `data/`, `pdfs/` and
`uploads/` on the do-not-re-upload list from the first deploy onward, because
four of its files are now referenced by rendered pages.
