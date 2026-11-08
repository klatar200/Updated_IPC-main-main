# Live audit — https://www.insulationproducts.com — 2026-11-08

Read-only audit of the live site against `main` at `65051f7`. It was run 2026-11-08, 18:30–19:30 UTC,
by eight parallel agents, one per area, and then checked by the coordinating session.

- **Raw evidence:** `_harness/out/live-audit/` (gitignored). Each area's full findings are in
  `<area>.md`, and its scripts, downloads and screenshots are in the folder of the same name. The
  brief every agent worked from is in `COMMON-BRIEF.md`.
- **Rules kept:**
  - Only GET and HEAD requests were sent, plus one OPTIONS and three TRACE.
  - Nothing on the server was changed. Nobody signed in to `/admin/`, and the quote form was never
    submitted. The Playwright runs aborted any POST to `contact.php`, and none was attempted.
  - **One POST was sent:** GO-LIVE §C3's `display_errors` check, 5,001 dummy fields to
    `/sitemap.php`, sent once. Area 5 first read `public/sitemap.php` to confirm it writes nothing,
    starts no session and sends no mail.

> **Update, same day:** the code findings M3, M4, L2, L4, L5, L6, L8, L10 and L11 are fixed in
> the repo and verified locally (`_harness/out/live-audit/verify/fixes-check.js`: 20/20 with the
> fix, 6/20 with `65051f7`'s bundle, which reproduces the live CLS numbers) and on real Apache
> (`prerender-apache` 24/24, 19/24 before). **None of it is live until `dist/` is deployed**
> (M1/M2). See WHATS_LEFT "Done since 2026-10-07", 2026-11-08.

## The short version

- **The site works.** Every page, all 42 product pages, every data sheet and every image loads,
  with no console errors, broken links or broken images. The text matches Rick's live data. The
  security rules all hold: none of 96 private paths answers with content, and nothing leaks.
- **The host is unreliable (High).** About one request in ten gets the proxy's own "An error
  occurred" 500 page or a failed secure connection, and many others take 5–12 s. I re-measured
  with nothing else running and it still happened, so the audit's own traffic was not the cause.
- **The public site is older than you think (Medium).** It is the 2026-10-19 build, edited by hand
  to say `/site-data/`. None of the homepage-layouts release (#82) is live, including the Classic
  homepage restyle. The deploy-day plan in WHATS_LEFT uploads only the admin. Doing that would
  give Rick a layout picker that saves and then shows nothing.

## Findings, by severity

The count is 1 High, 5 Medium (1 already known), 12 Low and 15 Info. "Area" says which area file
has the full evidence.

### High

#### H1. The host intermittently serves its own 500 page, fails the TLS handshake, or stalls for 5–12 s — NEW
- **URL:** any URL, static or PHP. Seen on `/`, `/about`, `/dashboard`, `/datasheets`, `/faq`,
  `/industries`, `/products?productId=CC`, `/site-data/*.json`, `/logo.svg`, `/favicon.svg`,
  `/images/products/IP38FE.png` and `/admin/*`.
- **Evidence:**
  - Every area saw it independently (areas 1a, 1b, 5, 6 and 7).
  - **Quiet re-measure** (`_harness/out/live-audit/verify/quiet-stability-1794166135157.json`):
    - It ran after all agents had stopped: one GET every 5 s, 60 requests, 19:21:39–19:28:50 UTC.
    - **6 of 60 failed.** Four were HTTP 500 (`/dashboard` at 12.5 s, `/logo.svg` twice,
      `/about` at 10.8 s). Two were TLS `alert internal error` (alert 80), on
      `/site-data/site-info.json` and `/logo.svg`.
    - 13 of 60 took over 3 s. The median was 504 ms and the maximum 12.5 s, against a normal
      ~0.25 s.
  - The 500 body is openresty's stock page (128,571 B, `Server: openresty/1.31.1.1`, `ETag
    "6a20d02e-1f63b"`). It carries openresty product promos and blog links. Screenshots:
    `area1a-pages/shots/home-missing-anchor-medical.png` and
    `area7-a11y-perf/shots/lh-industries-desktop-500s.jpg`. The second one shows a page rendered
    from `#ipc-boot` with all three data files and the logo returning 500.
  - When the three `/site-data/*.json` fetches fail, `/dashboard` shows **"Catalog Unavailable"**
    (area 1a). The header, footer and phone number stay up, as invariant 8 intends.
  - A static SVG fails just as often as PHP does. So this happens in the host's proxy/upstream
    tier, not in `index.php` or `.htaccess`.
- **Expected:** every route answers 200 (CLAUDE.md, "Navigation uses real path segments";
  GO-LIVE §C2).
- **Suggested fix:**
  1. Open a Network Solutions ticket. Give them the timestamps above, plus 18:45–19:16 UTC from the
     area files. Say there are intermittent openresty 500s, TLS alert 80 during the handshake, and
     5–12 s stalls on static files at about 1 request per 5 s.
  2. Ask about the account's entry-process / concurrency limits and the proxy's upstream health.
  3. Ask whether a branded error page is possible.
  4. Optionally add an external uptime monitor (a free tier, one check per 1–5 min) on `/` and
     `/site-data/products-all.json` so you have a record. Nothing in the repo causes or fixes this.

### Medium

#### M1. The live public site is the 2026-10-19 build (4589c7c), edited by hand; nothing from #82 is live — NEW
- **URL:** https://www.insulationproducts.com/, `/assets/index-o6b14ldU.js`, `/assets/index-DnzV-l5T.css`,
  `/images/site/*`, `/robots.txt`, `/sitemap.xml`
- **Evidence (areas 6, 1a and 3; re-verified by the coordinator):**
  - **The live JS is 4589c7c's JS with three strings changed.** `git show
    4589c7c:dist/assets/index-o6b14ldU.js` is 409,214 B and the live file is 409,229 B. Replacing
    `/site-data/` with `/data/` in the live file gives a byte-identical copy of 4589c7c's file
    (coordinator: `cmp` → identical, 3 sites).
  - The live CSS is byte-identical to 4589c7c's. The live `index.html` is 4589c7c's. The live
    `robots.txt` is the 2026-08-18 version (comments only differ). Live `sitemap.php` differs
    from HEAD in one generated comment line (`read from data/products-all.json`).
  - **Missing live, all 404:** the HEAD bundle `index-CjeIduFr.js` / `index-CwGYxeFr.css`, the 18
    self-hosted font files, `/images/site/bold-hero-spools.jpg` and
    `/images/site/bold-heat-shrink.jpg`. `/images/site/IPC-Building.jpg` is the old 425×281
    white-mat original, not HEAD's 397×264 crop.
  - **What buyers see:**
    - The homepage is the pre-restyle Classic design. It has no band captions, no "Visit us" card
      and no numbered feature cards with "Learn more →", and about 230 px under the building photo
      is empty at 1440. Compare `area1a-pages/shots/crop-live-band-scrolled2.png` with
      `crop-repo-band.png`.
    - `/dashboard?q=…` and `?approval=…` are ignored.
    - `/products`, `/dashboard`, `/datasheets` and `/industries` render text identical to HEAD's
      bundle (area 1a swapped the bundles against live data).
  - **Nothing live is missing from `main`:** the 30 live-only strings are the old Classic styling
    that 902291b removed on purpose (area 6).
  - **A clean build of HEAD equals the committed `dist/`:** all 93 files are byte-identical. An LF
    checkout gives the same JS/CSS hashes (area 6).
- **Expected:** `dist/` from `main` (`index-CjeIduFr.js`). WHATS_LEFT's 2026-10-31 "The data
  folder is `site-data/`" row says the deploy "built the bundle against `/site-data/`". In fact the
  built file was edited after the build and kept its name.
- **Suggested fix:**
  1. Deploy the whole `dist/` from a build of `main`: all of `assets/` (new JS, CSS and fonts),
     `images/site/`, `index.html`, `index.php`, `contact.php`, `sitemap.php` and `robots.txt`.
  2. Upload `assets/` and `images/` **before** `index.html`, then the rest.
  3. Never upload `site-data/`, `pdfs/` or `uploads/`.
  4. Afterwards, re-run `area1a-pages/scripts/bundlediff.js`; the home diff should be empty.
  5. Correct the WHATS_LEFT 2026-10-31 sentence.

#### M2. The deploy-day plan uploads only the admin, but the admin's layout features need the public bundle that is not live — NEW (amends a known row)
- **Status:** extends WHATS_LEFT "Upload the new admin pages (homepage-layout picker #82, PLAN-13
  #83)", which lists only `admin/*.php`, `*.js`, `*.svg` and `help-img/`.
- **URL:** https://www.insulationproducts.com/admin/ (after that upload), https://www.insulationproducts.com/
- **Evidence:** the live bundle has no layout code (`grep -c homeLayout` gives 0 for the live
  bundle and 2 for `dist/`). With only the admin uploaded:
  - **Business Details → Homepage layout** (`admin/settings.php:142–156`) would save
    `theme.homeLayout` under a green banner, and the homepage would stay Classic.
  - **Page Content's layout fields** would save with no visible effect.
  - **Site Images** would offer `bold-hero-spools.jpg` / `bold-heat-shrink.jpg`
    (`admin/site-images.php:53–54`), and both are 404 live.
- **Expected:** WHATS_LEFT 2026-10-17 rows: a chosen layout shows on the homepage.
- **Suggested fix:** reword that row (and GO-LIVE if it repeats it) to say: deploy `dist/` (built
  from `main`) **and** the admin pages together, `dist/` first. After the upload, sign-in should
  land on the Overview.

#### M3. `/dashboard` and `/datasheets` push the footer off-screen on every desktop load (CLS 0.19–0.48) — NEW (also in `main`)
- **URL:** https://www.insulationproducts.com/dashboard, https://www.insulationproducts.com/datasheets
- **Evidence (area 7, `area7-a11y-perf/cls-1440.json`):**
  - **1440×900, 3 of 3 loads:** `/dashboard` 0.188 and `/datasheets` 0.347. The source is
    `FOOTER`, which moves from y=731 / y=590 to off-screen just after `products-all.json` arrives.
  - **1920×1080:** 0.326 and 0.476.
  - **Every other route:** 0. The product page is 0.0094, within the settled range.
  - Lighthouse lab runs score these routes 0, so its scores hide the shift.
- **Expected:** under 0.1, the bar behind WHATS_LEFT Settled "Product-page footer layout shift".
- **Cause, the same in `main`:** `CatalogSkeleton`'s root (`src/App.jsx:16252`) has no minimum
  height. The resolved pages use `minHeight: "100vh"` (e.g. `src/App.jsx:3513`).
- **Suggested fix:** give the skeleton root `minHeight: "100vh"`. Add `/dashboard` and
  `/datasheets` at 1440/1920 to the CLS suite.

#### M4. The footer's "Full product catalog (PDF)" link fails WCAG 2.2 2.5.8 Target Size on phones — NEW (also in `main`)
- **URL:** every page at 390 px, e.g. https://www.insulationproducts.com/contact
- **Evidence:** Lighthouse `target-size` fails on 10 of 10 mobile runs, and axe gives the same
  result: `a[href="/pdfs/marketing/IPC-Product-Catalog.pdf"]` is 137×16 px with 13 px of safe
  space, against the 24 px minimum. The `mailto:` link sits 10 px below it.
  - It shows only because live `catalogPdfUrl` is set (an intentional Rick edit). AUDIT-10's
    2.5.8 sweep ran on repo data with that field empty, so it never saw the link.
- **Expected:** AUDIT-10 A10-013 made public pages pass 2.5.8. The footer contact column is
  `src/App.jsx:16081–16128`.
- **Suggested fix:** give the footer's tel, PDF and mailto anchors a 24 px minimum target
  (`inline-block; min-height:24px; line-height:24px` or the existing `.ipc-tap`). Add
  `catalogPdfUrl` to the a11y fixture.

#### M5. The apex `https://insulationproducts.com/` serves the whole site (admin included) with 200 — ALREADY KNOWN
- **Status:** WHATS_LEFT "Apex → `www` 301 (TLS done 2026-10-31)".
- **Evidence (area 5):**
  - `https://insulationproducts.com/` and `/admin/auth.php` answer 200.
  - `http://insulationproducts.com/` answers 301 → `https://insulationproducts.com/`, which stays
    on the apex.
  - Apex pages are byte-identical to `www`, and their canonical says `www` (area 4), so search
    engines are steered correctly.
- **Suggested fix:** as in the row. Add a host-level redirect, or a `RewriteCond %{HTTP_HOST}
  ^insulationproducts\.com$` rule built on `THE_REQUEST`, as the force-HTTPS rule is.

### Low

| # | Finding | URL / evidence | Expected (repo) | Suggested fix | Status | Area |
|---|---|---|---|---|---|---|
| L1 | The hand-edited JS kept its hashed name and is cached `immutable` for a year. It was replaced about 7 h after the first upload (Last-Modified 21:26 against 14:14 GMT on 10-30). A browser that loaded the first copy, which fetches the host-reserved `/data/`, keeps it, and its catalog pages say "Catalog Unavailable". | `/assets/index-o6b14ldU.js`, `Cache-Control: public, max-age=31536000, immutable` | `public/.htaccess:191` assumes a hashed name changes whenever its bytes change | Fixed by M1's real build, because the name changes. Never edit a file in `assets/` in place again. | NEW | 6 |
| L2 | `//index.html`, `/./index.html` and `/%69ndex.html` answer 200 with the bare shell: no canonical, no `#ipc-boot`, no plain-HTML body. Plain `/index.html` gives a correct 301. | `curl --path-as-is` | `public/.htaccess:116–125` (AUDIT-12 decision 25) matches only the literal request line | Key the 301 on the normalised path (`RewriteRule ^index\.html$` plus `REDIRECT_STATUS`/`IS_SUBREQ` guards). Add the three spellings to `prerender-apache.js`. | NEW | 4 |
| L3 | The homepage `<title>` is 74 characters and the description 165. Google truncates both, and "ISO 9001 registered." is the part lost. Every other URL is at most 60 / 159. | `/` (server and client agree) | `public/index.php:57` `IPC_META_DESC_MAX = 160` applies to products only. This text is the stored home SEO row, the same in the repo. | A content edit in Page Content → SEO → home (Rick, or you with his OK). Optionally warn above 60/160 in the admin. | NEW | 4 |
| L4 | `/products?family=` is case-sensitive, takes any value, and prints it in the header ("Bogus — showing 0 of 42 products."). A stale link left after a family rename empties the catalog. `/dashboard` handles the same input correctly. | `/products?family=Bogus`, `?family=polyolefin+heat+shrink`; `area1a-pages/shots/products-family-bogus-1440.png` | `src/App.jsx:12613–12616`; compare `DashboardPage` at `:13300–13312` | Resolve the value the way `DashboardPage` does: match case-insensitively, rewrite it with `{replace:true}`, and drop unknown values. | NEW (also in `main`) | 1a |
| L5 | On "Part not found", the "ask us about it" link goes to `/contact` without `?part=`, so the buyer has to retype the part number. | `/products?productId=NOSUCHSKU` → `<a href="/contact">` | `src/App.jsx:12863` | Pass `params={{ part: <raw productId> }}`. React escapes it; measured. | NEW (also in `main`) | 1b |
| L6 | The LCP image is `loading="lazy"` on the homepage (≥1024 px), on Services, and on the first catalog card. The home desktop LCP waits an extra 660 ms to load. | Lighthouse `lcp-discovery-insight` on home-desktop, services and products | 4.32's rule (history §4k): an above-the-fold LCP image is never lazy. `src/App.jsx:2228` and `:15360` are still lazy. | `loading="eager"` + `fetchPriority="high"` on the hero and services photos; eager on the first 3 catalog cards. | NEW (also in `main`) | 7 |
| L7 | The host gzips at level 1 and offers no brotli. The JS goes out at 142,236 B against 119,642 B at level 6, 16% more on every cold load. | `Accept-Encoding: gzip` and `br` on `/assets/index-o6b14ldU.js` | `GO-LIVE.md:469` expects ~112 kB, a figure measured on local Apache | Ask Network Solutions for gzip level 5–6 or brotli. Correct GO-LIVE:469 to "~140 kB on this host". | NEW | 7 |
| L8 | `robots.txt` and `manifest.json` have no `Cache-Control`. | both 200, `Last-Modified` + `ETag` only | `public/.htaccess:196/203` cover assets, images and HTML only | `<FilesMatch "^(robots\.txt\|manifest\.json)$"> Header set Cache-Control "public, max-age=3600"` | NEW | 5 |
| L9 | The proxy replaces the admin's `X-Frame-Options: DENY` with `SAMEORIGIN` and `Referrer-Policy: same-origin` with `no-referrer-when-downgrade`, and adds a malformed `X-XSS-Protection: "1; mode=block"`. Framing is still blocked by the CSP's `frame-ancestors 'none'`. An external link clicked in the admin sends the admin URL as the Referer. | `/admin/auth.php` | `admin/.htaccess:36,38` | Add `<meta name="referrer" content="same-origin">` in `admin_head()`. Record the override as a host limit in WHATS_LEFT. | ALREADY KNOWN as a host quirk (memory note); no WHATS_LEFT row | 5 |
| L10 | The quote-form field focus indicator is a 1 px border colour change plus a 10%-opacity halo, the weakest on the site. It passes 2.4.7 AA. | `/contact`; `area7-a11y-perf/shots/input-email-focused.png` | `src/App.jsx:6625–6643` | A halo of at least `rgba(var(--brand-primary-rgb),.35)` or a 2 px focus border | NEW (also in `main`) | 7 |
| L11 | `GET /contact.php` answers 405 without the `Allow` header that RFC 9110 requires. It is otherwise correct: nothing is sent or written. | `curl https://www.insulationproducts.com/contact.php` | `public/contact.php:434–435` | `header('Allow: POST');` before the 405, or a 303 to `/contact` for browsers | NEW | 1b |
| L12 | Privacy §7 "Contact Us" shows the phone number and email as plain text, while FAQ, Contact and the footer link them. | `/privacy` | `src/App.jsx:15601` renders the section as text | Optional: make the business phone and email into links there | NEW | 1b |

### Info

| # | Note | Area |
|---|---|---|
| I1 | **TRACE is now refused.** It answers 405 from the proxy on `https://www`, `http://www` and `https://` apex (coordinator, one request each). WHATS_LEFT "TRACE off" can be closed. | 5 + coordinator |
| I2 | The WHATS_LEFT 2026-10-31 "data folder is `site-data/`" row says the bundle was *built* against `/site-data/`. It was hand-patched after the build (M1). | 6 |
| I3 | The TLS certificate (GeoTrust wildcard plus apex) expires **2027-05-16** and is a paid certificate, so put the renewal in a calendar. TLS 1.0 and 1.1 are refused, HTTP/2 is offered, and TLS 1.2 still accepts one CBC/SHA-1 suite (the host's setting). | 5 |
| I4 | `/pdfs/*` advertises `Accept-Ranges: bytes`, but a Range request gets a 200 with the full file, not a 206. That is allowed, and the largest sheet is 822 KB. It is the proxy's behaviour. | 2 |
| I5 | The footer catalog PDF is 6.2 MB and not web-optimised. Every other PDF is at most 0.83 MB. | 3 |
| I6 | JSON-LD is produced only in the browser, as designed (`dist/index.html:79`). After rendering it is valid on all 53 URLs and uses only `www`. | 4 |
| I7 | The product BreadcrumbList's third item is `/products?family=…`, whose canonical is `/products`. Google accepts this. | 4 |
| I8 | Four Industries "View product" links use display SKUs (`productId=IP44A2+%26+IP45A3` and others). They render the right product with the right canonical, and the same is true in the repo data. | 1a |
| I9 | `OPTIONS /` returns the full page with a 200. The only version disclosure is `Server: openresty/1.31.1.1`. There is no `X-Powered-By` anywhere. | 5 |
| I10 | The quote form relies on native browser validation on Submit, with no blur messages and no `maxlength`, as designed (A10-012). A part number over 200 characters is truncated on the server, with a note only sales sees. Optional: `maxLength={200}`. | 1b |
| I11 | FAQ #15's question still says "data sheets", while its live answer (Rick's rewrite) says "datasheets". | 6 |
| I12 | 21 shipped images are not used live, as designed (Site Images picker stock). `/images/_unmatched/adhesiveLined.webp` is unusable by anything. | 3 |
| I13 | axe flags `label-content-name-mismatch` on the logo link and the family rail. This is by design (GUARDRAILS C43), and the visible words are in each name. | 7 |
| I14 | A clean build of `main` reproduces the committed `dist/` (93/93 files). Line endings change only the 10 copied text files, never a hash. | 6 |
| I15 | Live `index.php` behaviour equals the repo's. The repo's file run locally over live data was byte-identical to the server on all 65 URLs tested (areas 4 and 6). It is 4589c7c's file with the two data paths edited. | 4, 6 |

## Coverage

| Area | What was checked | Count | Passed | Failed / notes |
|---|---|---|---|---|
| 1a Pages: `/`, `/products`, `/dashboard`, `/datasheets`, `/industries` | render, console, failed requests, images, overflow at 1440/768/390 | 15 loads | 15 | 500s later, H1 |
| | internal links, PDFs, tel/mailto/social | 123 hrefs + 7 | 130 | 0 (4 display-SKU URLs resolve, I8) |
| | header dropdowns, mobile drawer, skip link, focus | 2 + 1 + 7 stops | all | 0 |
| | Product Index, Datasheets and catalog controls; Back/Forward/F5 | 3 pages, 10 reloads | all | `?q=` ignored (M1); `?family=` (L4) |
| | text vs live JSON | 186 strings | 186 | 0 |
| 1b Pages: `/services`, `/about`, `/faq`, `/contact`, `/privacy`, unknown route, unknown product | render, console, failed requests, images, overflow at 3 widths | 21 loads | 21 | 500s later, H1 |
| | internal links, brochure/catalog PDFs, tel/mailto, social | 54 + 3 + 2 + 5 | 63 | LinkedIn 403 to a script (inconclusive) |
| | text vs live JSON | 251 strings | 249 | 2 hidden by design |
| | FAQ accordions, chips, expand/collapse; menus; contact form (render only), `?part=`, honeypot, invariant 18 (`?sent=1`) | 19 + 6 + 14 + 16 controls | all | L5, L11, L12, I10 |
| 2 Products | 42 product pages at 1440, 12 at 390 | 54 loads | 54 | 0 |
| | photos (37) + placeholders (5 known) | 42 | 42 | 0 |
| | data sheet links: 200, `application/pdf`, `%PDF`, exact case | 43 links, 42 PDFs | 43 | 0 |
| | spec rows / size-chart cells vs JSON | 322 / 2,505 | all | 0 |
| | Request a Quote `?part=` prefill, related cards, breadcrumbs | 42 / 86 / 42 | all | 0 |
| | server head vs client head | 42 | 42 | 0 |
| 3 Assets | every referenced PDF and image (data, bundle, CSS, shell, manifest) | 91 references (45 PDFs, 63 images) | 91 | 0. 2 shipped-but-unused photos 404 (M1) |
| | byte-equal to repo | 44 PDFs | 44 | 0 |
| | exact path case, mixed content, `.deleted.`, path-prefix leak | 91 | 91 | 0 |
| | directory listing | 3 | 3 | 0 |
| 4 SEO | raw head vs rendered head (title, description, canonical, og, robots) | 53 URLs + 12 edge URLs | 65 | 0 |
| | repo `index.php` over live data vs live output | 65 URLs | 65 byte-identical | 0 |
| | sitemap `<loc>`: 200 and self-canonical | 52 | 52 | 1 comment line (M1) |
| | `#ipc-boot` valid and equal to live data; no-JS body | 53 | 53 | 0 |
| | og:image resolves with the declared size | 38 | 38 | 0 |
| | `/index.html` spellings | 4 | 1 | L2 |
| 5 Server | GO-LIVE §C1 curl checks | 11 | 10 | apex (M5) |
| | must-refuse probes (admin state, backups, locks, tmp, script-in-uploads, repo/tooling, old site) | 96 | 96 | 0 |
| | directory listing | 12 | 12 | 0 |
| | redirects (http→https, query kept, no prefix leak) | 17 | 14 | 3 apex (M5) |
| | security, cache and compression headers by type | 20 types | 18 | L8, L9 |
| | TLS / certificate | 4 | 4 | I3 |
| | admin as an anonymous visitor (302 → sign-in, cookie flags, CSP) | 19 | 19 | `home.php` and `help-img` 404 (known) |
| 6 Live vs repo | live JS/CSS/HTML provenance | 3 | identified | M1, L1 |
| | static `dist/` paths vs live | 95 | 63 = HEAD | 3 = 4589c7c; 22 HEAD-only 404; JS hand-edited |
| | clean build of HEAD vs `dist/` | 93 files | 93 | 0 |
| | live data vs repo data | 3 files, 42 SKUs | identical except 2 known edits | 0 unexpected |
| | admin static assets | 39 | 7 = HEAD, 5 = pre-PLAN-13 | 27 not uploaded (known) |
| 7 A11y / perf | Lighthouse mobile + desktop | 20 runs | 20 (2 re-run after host errors) | a11y 95–100, BP 100, SEO 100 |
| | axe-core 4.14 at 1440 and 390 | 20 | 0 contrast violations | M4 (target-size), I13 |
| | headings, alt, names, `lang`, skip link, reduced motion, 320 px / 200% reflow | 20 page states, 126 images, 860 links, 222 buttons | all | 0 |
| | CLS in a real browser | 11 routes × 4 sizes | all but 2 | M3 |
| Availability | spaced GET samples | ~250 requests by 5 agents, plus the coordinator's quiet 60 | ~90% | H1 (quiet run: 6/60 failed, 13/60 > 3 s) |

## What needs a decision

1. **When to deploy `main`'s `dist/` together with the admin (M1, M2).** It changes how the
   homepage looks (the Classic restyle), so Rick may want to see it first. The safe order is
   `assets/` + `images/` → `index.html` → the PHP files → the admin files.
2. **The Network Solutions ticket for H1** and the gzip level (L7). This is your call, as the
   account holder's contact.
3. **The homepage SEO title and description length (L3).** It is a Page Content edit, so decide
   whether you make it or Rick does.
4. **Whether to fix the code Lows/Mediums now** (M3, M4, L2, L4, L5, L6, L8, L10, L11; all small
   `src/App.jsx` / `.htaccess` / `contact.php` changes). If you fix them before the deploy, they
   ship with it.
5. **WHATS_LEFT corrections:**
   - close "TRACE off" (I1);
   - reword the deploy-day admin row (M2);
   - fix the 2026-10-31 sentence (I2);
   - correct GO-LIVE:469 (L7).
