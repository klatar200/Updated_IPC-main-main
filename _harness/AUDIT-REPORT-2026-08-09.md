# Audit report — 2026-08-09, against `main` @ `4a3763a`

Auditor session, per `plans/AUDIT-PROMPT-2026-08-09.md`. Environment: Linux,
`php -S` mirror on :8123/:8124/:8125, Chromium via `_harness/browser.js`,
`system-ui` resolves to **DejaVu Sans** (verified with `fc-match` — the §6
font caveat applies to every width number below, and none of the findings is a
width claim). Nothing under `src/`, `admin/`, `public/`, `data/`, `pdfs/` or
`uploads/` was modified: `git status --short` over those trees is empty, and
`git diff --stat src/` is empty. New probe scripts live in `_harness/aud9-*.js`;
screenshots in `_harness/out/aud9/`.

The §5 baseline was measured **before** any auditing and matches the expected
table exactly — see *Regression state* at the end.

---

### [A] The first Page Content save after deploy silently deletes all five marketing photographs

**What it does to a real person.** The day Rick saves *anything* in Page
Content — a stray space in a heading is enough — every marketing photograph
disappears from the live site: the homepage hero photo, the whole team/building
band section, the About photo and the Services photo. He gets a green
"✅ Content saved" and no other signal. The admin cannot show him what he lost
(the five Site Images fields were already blank before he saved), and getting
the photos back means typing five exact paths like
`images/site/Marker-Sample-2.jpg` — which the record itself says he cannot do
reliably (four `photoUrl` values shipped with exactly that class of typo).

**Mechanism.** The shipped `data/content.json` predates PLAN-7 item 3a and has
no `copy.siteImages` key (verified: `copy` holds 12 groups, `siteImages` absent).
`admin/content.php` prefills every copy field with `?? ''` (line 956), so the
five fields render **empty**, and the save loop writes every configured field
back with `?? ''` (line 588) — so one save materializes
`siteImages: {heroPhoto:"", …}`. Because `.*Photo` is in `COPY_CLEARABLE`
(`src/App.jsx:6753`), `mergeContent` keeps those blanks instead of dropping
them (`src/App.jsx:6786`) — "" is a deliberate deletion for photo keys, by
design. The design is coherent for a user who cleared a visible value; it is
wrong for a key the admin never showed as set. Enumerated: exactly the five
`siteImages.*Photo` keys are clearable-and-absent-from-the-live-file;
`hero.subhead` (the other clearable key) is present in the live file and does
not fire.

**Why no suite sees it.** `plan7-slots` drives the three per-slot states by
*intercepting* `content.json` — it never performs a real admin save from the
pre-3a file. `copyroundtrip` performs real admin saves — its saves DO clear the
photos in passing — but line 111 restores `content.json` from pristine
unconditionally at the end, destroying the evidence its own journey created.
`plan7-imagery` then measures the restored mirror and passes.

**Evidence.** `_harness/aud9-clearrepro.js`, run twice, identical results:

```
before: siteImages in content.json = (absent)
before: homepage paints ["images/site/Marker-Sample-2.jpg","images/site/staff.jpg","images/site/IPC-Building.jpg"]
admin shows the five photo fields as: value "" (all five)
save banner: "✅ Content saved. The website will reflect the changes within ~60 seconds."
after:  siteImages in content.json = {"heroPhoto":"","bandTeamPhoto":"","bandBuildingPhoto":"","aboutPhoto":"","servicesPhoto":""}
after:  homepage paints []  (band section gone: bandSection false)
VERDICT: photos before=3 after=0; band before=true after=false
```

Screenshots: `_harness/out/aud9/clearrepro-before.png` / `clearrepro-after.png`.
The same clearing also occurred as an unintended side effect of my §7B journey
probe (`aud9-admin.js`) before I understood the mechanism — an independent
third occurrence.

**Reproduce.** Restore `_harness/site/data/content.json` from
`_harness/pristine/` (the pre-3a shape that ships on first deploy). Load `/` at
1440 — three `images/site/` photos paint. Sign in at `/admin/`
(`audit-pass-123`), open `content.php`, observe the five *Site Images* fields
are empty, append one space to *Homepage — Hero → Headline line 1*, Save.
Reload `/`: zero `images/site/` photos, no band section. `data/content.json`
now carries the five keys as `""`.

**Where.** `admin/content.php:956` (prefill `?? ''`), `admin/content.php:588`
(save `?? ''`), `src/App.jsx:6753` (`COPY_CLEARABLE` includes `.*Photo`),
`src/App.jsx:6786` (blank kept for clearable keys), `data/content.json` (no
`copy.siteImages`).

**Confidence.** CONFIRMED (full journey run twice, plus one independent
occurrence; mechanism verified in source on both sides).

**Note on invariants.** This does not propose reversing invariant 3, invariant
4, or the `COPY_CLEARABLE` design — clearing a *visible* value must keep
deleting the photo. The defect is that the admin materializes **absent** keys
as **cleared** ones. (No CLAUDE.md invariant covers this path.)

---

### [B] A mistyped or stale product URL shows a *different* product under a banner that claims to show the catalog

**What it does to a real person.** A buyer following a stale procurement link
or a typo'd SKU — `/products?productId=NOPE-XYZ-123` — reads
*"We couldn't find part “NOPE-XYZ-123” … **Showing the catalog instead** —
pick a part from the list"*, but what is below the banner is the **full detail
page for CC, Nonmetallic Liquid-tight Conduit Coupling** (the first product in
the catalog). Scroll, and the sticky conversion bar slides in quoting
**CC — Data Sheet — Request a Quote**. The page says catalog; it shows
somebody else's part with a working RFQ for it.

**Evidence.** `_harness/aud9-meta.js` (run twice, identical):

```
### garbage-id  /products?productId=NOPE-XYZ-123
banner: "We couldn't find part “NOPE-XYZ-123” … Showing the catalog instead — pick a part from the list…"
h1s:    ["Nonmetallic Liquid-tight Conduit Coupling"]     ← CC's detail, not the catalog grid
```

Sticky bar measured on the same URL after `scrollTo(0, 1200)`: one
`position:fixed; bottom:0` element, `transform: matrix(1,0,0,1,0,0)` (slid in),
text `"CC Nonmetallic Liquid-tight Conduit Coupling Data Sheet (opens in a new
tab) Request a Quote →"`.

**Why.** `src/App.jsx:8682` — `const product = selectedId ? matched ||
products[0] || null : null;` falls back to `products[0]` on a failed match. The
fallback itself is a recorded decision (WHATS_LEFT §4s: "needs something behind
it"), made when there was no catalog landing to show. The banner text
("Showing the catalog instead", `src/App.jsx:8832-8834`) predates C29 and now
promises exactly the landing state C29 built (`CatalogLanding`,
`src/App.jsx:8569`) — and the `landing` flag (`:8681`) is false on this path,
so the landing never renders. What is not recorded anywhere is that the copy
and the render contradict each other.

**Reproduce.** `/products?productId=NOPE-XYZ-123`, 1440×900. Read the banner;
read the `<h1>`; scroll ~1200px and read the sticky bar.

**Where.** `src/App.jsx:8682` (fallback), `src/App.jsx:8832-8834` (banner
copy), `src/App.jsx:8878-8882` (landing vs detail branch).

**Confidence.** CONFIRMED (measured twice; sticky bar measured once on top of
the twice-measured page state).

---

### [B] Unknown and alias `?productId=` URLs are indexable, self-canonical soft-404s whose breadcrumb data contradicts their own canonical

**What it does to a real person.** Every misspelled, restyled or dead product
URL that gets crawled or shared becomes its own "page" in search engines'
eyes: `?productId=NOPE-XYZ-123`, `?productId=cc`, `?productId=ip12ga-ip1274`
each declare a **self-referencing canonical of the raw parameter**, carry **no
`noindex`**, and render CC's (or the alias-matched product's) content under the
generic "Product Catalog —" title. The site's own records state the principle
this violates: *"a canonical on a soft 404 is the half-fix that looks done"*
(PATCH_NOTES A5) and *"structured data on a soft 404 is the same error as a
self-referencing canonical on one"* (WHATS_LEFT §4s) — A5 closed this for
unknown path *segments* and the `?productId=` axis was never covered. For a
buyer who pastes a lowercased SKU from a procurement email, the page renders
the right product but titles itself "Product Catalog", so the shared link
previews generically and the URL competes with the real product page in the
index.

**Evidence.** `_harness/aud9-meta.js`, run twice, identical:

```
### garbage-id  /products?productId=NOPE-XYZ-123      (renders CC's detail + banner)
title:     "Product Catalog — Insulation Products Corporation"
canonical: https://www.insulationproducts.com/products?productId=NOPE-XYZ-123   ← self, indexable
robots:    null                                                                  ← no noindex
crumbLastItem: https://www.insulationproducts.com/products?productId=CC          ← ≠ canonical

### alias-lowercase  /products?productId=cc            (renders CC's full detail)
title:     "Product Catalog — Insulation Products Corporation"                   ← generic, A3 regressed on aliases
canonical: https://www.insulationproducts.com/products?productId=cc              ← duplicate of ?productId=CC
crumbLastItem: https://www.insulationproducts.com/products?productId=CC          ← ≠ canonical

### alias-punct  /products?productId=ip12ga-ip1274     (renders "Extruded General Purpose Vinyl Tubing")
canonical: https://www.insulationproducts.com/products?productId=ip12ga-ip1274
crumbLastItem: https://www.insulationproducts.com/products?productId=IP12GA%20-%20IP1274
```

Control (`?productId=CC`) is correct on every field.

**Why.** `ProductPage` matches an id four ways — exact id, exact sku,
`normalizeSku` (case/punctuation-insensitive), `skuSegmentMatch`
(`src/App.jsx:8655-8666`) — so alias URLs *render* a product. `PageMeta`
matches **exact id only** (`src/App.jsx:6973-6976`) and passes the **raw
param** to `canonicalFor()` (`src/App.jsx:7081`), so on any non-exact id the
head metadata describes a page that isn't the one rendered. The A5 guard
(`unknownRoute`, `src/App.jsx:7096`) covers unknown path segments only. The
`Breadcrumb` component builds its trailing item from the *matched* product
(`src/App.jsx:8696`), so the C33 acceptance — "the trail's last item equals
the page's own canonical, byte for byte" — fails on every such URL.
`plan8-crumbs` passes 22/22 because it only ever visits exact ids.

**Reproduce.** The three URLs above at 1440; read `<link rel="canonical">`,
`<meta name="robots">`, `<title>`, and `#breadcrumb-ld`'s last
`itemListElement.item`.

**Where.** `src/App.jsx:6973-6976` (exact-only match), `:7081` (raw param into
`canonicalFor`), `:7096` (A5 scope), `:8696` (trail last item),
`_harness/plan8-crumbs.js` (exact-id-only coverage).

**Confidence.** CONFIRMED (measured twice).

---

### [C] The homepage band's building card is more than half empty at every desktop width

**What it does to a real person.** A visitor scrolling the homepage sees the
team photo beside a bordered card whose top ~48% is the building photo and
whose bottom ~52% is blank white — it reads exactly like C44's "a link that
had failed to load", on the homepage this time.

**Evidence.** `_harness/aud9-band.js` on the pristine mirror (shipped default
render):

```
1440: staff.jpg img 845×475 in figure 847×477 (2px slack)
      IPC-Building.jpg img 411×231 in figure 413×477 → 246px empty below
1024: img 310×174 in figure 312×363 → 189px empty
 768: img 225×126 in figure 227×267 → 141px empty
```

Screenshot: `_harness/out/aud9/band-default-1440.png`. Below 768 the grid is
single-column and the effect does not exist.

**Why.** Both `<figure>`s sit in `md:grid-cols-3` (`src/App.jsx:3084`); grid
items stretch to the row height by default. The team figure spans two columns,
so its 16:9 image sets a ~475px row; the building image is 16:9 **of one
column** (~231px) and its bordered figure stretches to 477px around it.
`plan7-imagery` asserts the photos paint, not that the cards fill — this is
its blind spot. Introduced by `248ab9a` (PLAN-7 item 2). Not recorded: the
PLAN-7 records discuss the crop and resolution of these files, not the
stretched card, and C37's "empty right half" is about the page-header band.

**Reproduce.** `/` at 1440, scroll to the band between the feature cards and
the markets; measure `figure` vs `img` bounding boxes.

**Where.** `src/App.jsx:3084` (grid), `:3099-3111` (building figure/img).

**Confidence.** CONFIRMED (measured at three viewports; screenshot; also
visible in `_harness/out/aud9/typo-band-1440.png` from a separate probe).

---

### [C] Trailing-slash URLs break every relative-path photo slot

**What it does to a real person.** A visitor who lands on `/about/` (external
link, typed URL — the site itself never emits a trailing slash) gets a fully
working page whose story photo is a 745×496 broken-image frame: the five
PLAN-7 slot defaults are *relative* paths (`images/site/…`,
`src/App.jsx:6411-6415`), so on `/about/` the browser asks for
`/about/images/site/IPC-Building.jpg`, and the SPA rewrite answers 200
`text/html`, which the `<img>` cannot decode. These `<img>`s have no `onError`
fallback (unlike the product photo's T2.7 branch).

**Evidence.** Measured twice (`aud9-buyer2.js`, then a standalone re-run):

```
/about/ image responses: ["200 text/html; charset=UTF-8 http://127.0.0.1:8123/about/images/site/IPC-Building.jpg"]
/about/ painted: [{src:"/about/images/site/IPC-Building.jpg", ok:false, w:745, h:496}]
/about  painted: [{src:"/images/site/IPC-Building.jpg", ok:true}]
```

The app itself boots fine on `/about/` (built asset URLs are absolute since
`base: '/'`), the title is correct, and the canonical points at the clean
`/about` — so the blast radius is the photographs only. Product `photoUrl`s in
`data/products-all.json` start with `/` and are immune.

**Reproduce.** `/about/` (note the trailing slash) at 1440; compare with
`/about`. Same for `/services/` and `/` + the homepage band.

**Where.** `src/App.jsx:6411-6415` (relative defaults; the same strings are
what the admin's Site Images fields document as the expected format).

**Confidence.** CONFIRMED (measured twice).

---

### [C] CLAUDE.md still documents `base: './'`; the code sets `base: '/'`

**What it does to a real person.** The next developer or session that trusts
CLAUDE.md's "Vite config sets `base: './'`" reasons wrongly about how the app
resolves URLs (it changed precisely because relative assets broke deep links —
PATCH_NOTES: "`base` is `'/'` now").

**Evidence.** `vite.config.js:98` → `base: '/'`; CLAUDE.md §React side →
"**Vite config** sets `base: './'`"; `dist/index.html` emits
`src="/assets/index-DKPovt2v.js"` (absolute). PATCH_NOTES 2026-08-08 records
the change; CLAUDE.md (re-verified 2026-08-04, before the change) was never
updated.

**Reproduce.** Read the three files.

**Where.** `CLAUDE.md` (React side bullet) vs `vite.config.js:98`.

**Confidence.** CONFIRMED (read, all three artifacts agree with each other and
disagree with CLAUDE.md).

---

## Coverage — what was swept, honestly

- **§5 baseline**: all 45 listed suites + `lint.php`, run once in full before
  auditing (three slower suites re-run individually to identify their failing
  checks). Results below.
- **§7A**: all 8 commits in `6bd7246..4a3763a` diffed and read; all 7 named
  hypotheses tested (results in *Findings* and *Refuted*).
- **§7B**: real admin journeys via `aud9-admin.js` — sign-in, edit, save,
  verify JSON + public render, browser Back after save, two-tab optimistic-
  concurrency conflict (typed work preserved, second Save applies), fake-image
  upload refusal. Oversized-form truncation relied on `plan2-trunc` (13/13
  against a real `max_input_vars=100` server). Plus the clearing journey in
  finding 1. Not driven: `settings.php`, `add.php`/`edit.php`/`delete.php`
  full journeys, backups page, password page (all covered by green plan
  suites, not independently re-driven).
- **§7C**: deep-link landing at 1440 and 390, datasheet fetch
  (200 `application/pdf`), full RFQ submit end-to-end (success state, one new
  line in `admin/inquiries.jsonl`, sales notification in the fakemail log,
  part number carried as `?part=IP17TW-IP18SW-IP19LW` and prefilled), JS-off
  render of the noscript card. One product driven end-to-end, not all 42.
- **§7D**: console errors + failed requests + horizontal overflow on all 10
  routes × 1440/390 with full-page scroll (zero findings), plus 1024/768
  (zero findings); all **42** product pages at 1440 (42/42 clean: no errors,
  no failed requests, no banner, no overflow). Keyboard-only traversal was
  **not** independently re-driven — I relied on `plan8-keyboard` 8/8 (which
  uses real Tab/Enter). Copy contract via `lint.php` copydrift (110 matched,
  0 PHP-only, 0 JS-only). `cssdiff.js` N/A — it requires a `--save` snapshot
  that does not exist in this clone and no source was modified to compare.
- Product pages at 390 were sampled (one page + `plan8-mobile` 16/16), not
  swept exhaustively.

## [UNVERIFIED] — cannot be tested locally, per §4.3

- Everything gated by `.htaccess` / `.user.ini` (`php -S` ignores both): the
  `admin/` and `data/` file-blocking rules, the `SetEnvIf` cache split (NB1),
  the dotfile block (NB15), the `ALLOW-PASSWORD-RESET` block (NB14), every
  `public/.user.ini` limit including `display_errors=Off`, and the SPA rewrite
  as Apache will actually run it (`router.php` only emulates it).
- Real mail delivery (`sendmail_path` here is the capturing `fakemail.sh`).
- Production font metrics: every width number in this report is DejaVu Sans;
  the C49 caveat applies (verified `fc-match system-ui` → DejaVu Sans).
- `plan3-autoreply` was not run (not in the §5 baseline table).

## Refuted — §7A hypotheses checked and found not to be defects

1. **Slot override → wrong reserved box / CLS.** Refuted by measurement.
   Every slot pins its box with CSS `aspect-ratio` + `object-fit: cover`
   (hero `1000/667` at `src/App.jsx:1902`, bands `16/9`, About `3/2`,
   Services `21/9`), so the override's intrinsic shape never reaches layout.
   `aud9-cls.js`: `bandTeamPhoto` overridden with the most differently-shaped
   usable file (`Front-Cover.jpg`, 773×1000 portrait into a 16:9 slot), CDP-
   throttled load, PerformanceObserver `layout-shift`, 3 runs each:
   **CLS 0.0000 default, 0.0000 override**; painted box 845×475 in both.
2. **`COPY_CLEARABLE`'s `.*Photo` matches a key it shouldn't.** Refuted by
   enumeration of all 113 leaf keys in `COPY_DEFAULTS`: the clearable set is
   exactly `heroPhoto, bandTeamPhoto, bandBuildingPhoto, aboutPhoto,
   servicesPhoto, subhead` — no photo-ish or subhead-ish key falls outside it.
   The regex change was strictly widening, so existing subhead behaviour is
   unchanged. (The regex is sound; finding 1 is in the admin's save path, not
   here.) Cleared-photo behaviour per slot is held by `plan7-slots` 16/16.
3. **C33 breadcrumb IA / BreadcrumbList validity.** On exact-id URLs and the
   three catalog views the emitted `BreadcrumbList` is valid — every
   `ListItem` (intermediates included) carries an absolute `item` URL and the
   trailing item equals the page canonical (`plan8-crumbs` 22/22; my own reads
   agree). `/dashboard` and `/datasheets` as children of "Product Catalog" are
   views of the catalog — defensible. The contract only breaks on alias/
   unknown ids — that is finding 3, not a C33 design flaw.
4. **C41 FAQ accessibility under stress paths.** Not reproduced as a defect.
   The open set is the single source of truth (`src/App.jsx:4115`), stale keys
   are pruned when the owner edits mid-session (`:4120-4128`), rapid toggling
   is guarded by effect cleanup of the 400ms fallback timer (`:3880-3881`),
   and the background-tab / no-`transitionend` case is deterministically
   covered by `plan8-faq` 19/19 (it forces transitions off).
5. **C37 padding regression at other viewports.** None found: 10 routes ×
   1440/1024/768/390, zero horizontal overflow, zero console errors; header
   band heights 178–202px at 1440 (matches the recorded 178–202), 173–197 at
   1024, 164–188 at 768, 140–244 at 390. The `GlobalStyles`-only placement of
   the override is safe: `GlobalStyles` mounts above the catalog gate
   (`src/App.jsx:12041`), so no pre-mount `.ipc-page-header` ever paints.
6. **C39 privacy note cleared or reading wrongly.** `privacyNote` is not in
   `COPY_CLEARABLE`, so clearing it restores the default — measured with the
   key served as `""`: the paragraph renders "We use your details only to
   answer this enquiry. See our Privacy Policy." The link is appended in code
   (`src/App.jsx:5336-5353`) and cannot be orphaned or repointed. Worst case
   for owner text is a doubled period — cosmetic.
7. **Hero photo downloaded on mobile.** The record's claim holds: 0 requests
   for `Marker-Sample-2.jpg` at 390 over a full-page scroll (interception).
8. *(Process note)* My first buyer probe reported the RFQ link losing product
   context — that was my selector clicking the navbar CTA. The detail page's
   "Request Quote" carries `?part=IP17TW-IP18SW-IP19LW` and the form arrives
   prefilled. Recorded so the next session doesn't chase it.

## Regression state — measured at `4a3763a` before auditing

`lint.php`: php -l 19/0 · node --check 9/0 · JSON 17/10/42 · copydrift 110
matched, 0 PHP-only, 0 JS-only · 11 families · 12 approvals. Build: 0 errors
(366.63 kB JS / 23.09 kB CSS).

All 42 fully-green suites from the §5 table passed at exactly the listed
scores (invariants 17/17, invariants-selftest 15/15, copydrift-selftest 5/5,
copyroundtrip 15/15, contrastparity 28/28, skuparity 33/33, deadlinks 0 of 18,
backdrop-selftest 9/9, plan2-formlast 8/8, plan2-sku 14/14, plan2-delete
18/18, plan2-contrast 42/42, plan2-trunc 13/13, plan3-contact 51/51,
plan4-admin 19/19, plan4-public 27/27, plan5-keys 11/11, plan5-spectable
13/13, plan5-images 12/12, plan5-social 35/35, plan5b-sidebar 9/9,
plan5b-sitemap 9/9, plan5c-sitemap 17/17, plan5c-eyebrow 5/5, plan5c-brandink
6/6, plan6-families 13/13, plan7-approvals 11/11, plan7-datasheets 8/8,
plan7-imagery 11/11, plan7-slots 16/16, plan8-certs 5/5, plan8-meta 15/15,
plan8-catalog 16/16, plan8-lead 16/16, plan8-motion 8/8, plan8-chrome 16/16,
plan8-keyboard 8/8, plan8-mobile 16/16, plan8-faq 19/19, plan8-crumbs 22/22,
plan8-landing 18/18, plan8-formpolish 15/15).

The three expected non-perfect scores, verified as the expected cases:

- `plan8-contrast` **34/35** — the one miss is the named `EXEMPT_BRAND_SURFACE`.
- `plan8-polish` **16/17** — re-run individually: the failing check is
  *"no spec table scrolls horizontally at 1440, across all 42 product pages"*,
  i.e. the C49 font-metric guard, on a box where `system-ui` → DejaVu Sans
  (`fc-match` verified). Environment artifact per §6, not a finding.
- `brandtext` **34/45 = 11 failing** (ratchet ≤ 13) — re-run individually: the
  failing combinations are the logged `brand-accent-on-dark-surfaces` set
  (`--brand-accent`/`--brand-accent1-on-dark` at 4.23–4.37:1 on the navy
  panels). Expected red, unchanged.

**Deltas from §5: none.** The audit inherited a green baseline and left the
mirror restored (content.json re-copied from pristine after the finding-1
reproductions; `_harness/site/admin/config.local.php` deleted per §1).
