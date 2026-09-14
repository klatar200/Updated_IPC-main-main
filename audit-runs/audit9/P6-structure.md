# P6 — Page structure and information architecture          agent: C′   started/finished: 2026-09-14 16:40 / 17:50   mirror: :8143
findings:   Blocker 0 · High 0 · Medium 1 · Low 3
| ID | sev | class | where | one line |
|---|---|---|---|---|
| A-9.P6-1 | Medium | code | App.jsx:7389 (title), 42 product pages | script-generated `<title>` has no length cap — 39/42 product titles exceed the adopted 60-char limit, up to 149 chars, truncating before the SKU in search results |
| A-9.P6-2 | Low | code | App.jsx:7397 (`.slice(0,300)`), 38 product pages + home/industries/about | meta description outside the adopted 50–160 range on 41/53 indexable pages (300-char cap, not 160; three hand-authored SEO_DEFAULT rows also run 4–21 chars over) |
| A-9.P6-3 | Low | code | App.jsx:10147-10152 | `/dashboard` page-header eyebrow literally repeats its own `<h1>` text ("Product Index" / "Product Index"), the only inner page whose eyebrow is not a distinct category label |
| A-9.P6-4 | Low | code | admin/nav.php:67-81 vs each page's own `<h1>` | admin `<h1>` wording diverges from the nav-tab label on 4/9 top-level tabs (Products→"Product Catalog", +Add Product→"Add New Product", Password→"Change Password", Help→"Help & Documentation") |
ledger:     done E001,E002,E003,E004,E005,E006,E007,E008,E009,E010,E011,E014,E015,E017,E021,E034,E035,E042,E044,E048,E072,E084,E118,E122,E176,E181,E182   blocked none
suites cited: plan5b-sitemap 9/9, plan5c-sitemap 17/17, plan8-meta 15/15, plan9-meta 18/18, plan8-crumbs 22/22, plan2-formlast 8/8, plan2-delete 18/18, plan10-adminnav 25/25, plan10-helpwidth 21/21
instruments: _harness/audit9-p6-navgraph.js — drives the live :8143 mirror to open both desktop mega-menus and the mobile drawer (cold DOM has neither — they mount on click), collects every internal href, cold-navigates each plain path and asserts 200, cold-navigates each #anchor in a FRESH page (same-document hash nav returns a null Response — probe artifact, not a finding) and asserts the target exists + is in-viewport, and dumps the top-level header controls
artifacts:  _harness/out/audit9/P6/navgraph.json (24 internal links, 19 cold-nav checks, 5 cold-anchor checks, 0 failing) · _harness/out/audit9/P6/outline-full.json (67-page heading-outline table) · _harness/out/audit9/P6/meta-rows.json (53-page meta table) · _harness/out/audit9/P6/meta-length-violations.json
out of brief: admin/nav.php:67 current-tab `class="current"` carries no `aria-current="page"` — routed to P9 (semantics)  ·  router.php:28 hardcodes the sweep mirror's docroot for file-existence/sitemap.php fallthrough on every :814x private mirror — pre-flagged by C as A-9.P3-1 (harness, already tracked), not re-raised here
[UNVERIFIED]/[UNSOURCED]: none
self-corrections: navgraph.js's first anchor-test pass used a single reused page for sequential #-only navigations, which Chromium treats as same-document (page.goto returns a null Response, no new HTTP request) — read as 4 failures before the fix; re-run with a fresh page per link resolved to 5/5 passing. Recorded so the artifact's history is legible; final navgraph.json already reflects the corrected run.
---

### A-9.P6-1 — Medium — code — the search-result title for most parts gets cut off before the part number

class:        code
pass:         P6     ledger: E122
surface:      the 42 product pages `/products?productId=<sku>`
where:        src/App.jsx:7384-7390 (title assembly, no length cap), measured on 2121597, 2026-09-14
not in §11:   checked GUARDRAILS §7, §7.1-§7.3 and PLAN-11 §11 — none of those settle a title-length rule; plan8-meta/plan9-meta (15/15, 18/18) assert distinctness and canonical correctness only, never a length cap, so this is genuinely new for this audit's adopted rules
reproduce:    node -e 'const fs=require("fs");const idx=JSON.parse(fs.readFileSync("_harness/out/audit9/I-crawl/index.json"));const rows=idx.pages.filter(p=>p.viewport==="1440x900"&&!p.slug.startsWith("admin-"));for(const p of rows){const r=JSON.parse(fs.readFileSync("_harness/out/audit9/I-crawl/"+p.json));if((r.meta.title||"").length>60)console.log(p.slug,r.meta.title.length)}'
observed:     41/53 indexable pages exceed 60 chars; 39 of the 42 product pages (only IP75AD at 52 and VT-1100 at 50 are within cap); worst case `product-IP64FS-IP65VC-IP66AC-IP67SC` at 149 chars: "Fiberglass Sleeving (Heat Treated / Vinyl Coating / Acrylic Coated / Silicone Coated) — IP64FS-IP65VC-IP66AC-IP67SC — Insulation Products Corporation" — Google's ~575-600px SERP truncation cuts this before the SKU ever appears. Full list: _harness/out/audit9/P6/meta-length-violations.json
expected:     title ≤ 60 chars (this audit's adopted rule, P6 step 7); the SKU a buyer searched for should survive truncation
consequence:  a buyer who searched by part number sees a truncated title in Google that never reaches their SKU, so they cannot visually confirm the result before clicking — friction on the exact discovery path the 42 product pages exist to serve. Home's 74-char title is hand-authored (SEO_DEFAULT) and not part of this scaling defect
evidence:     _harness/out/audit9/P6/meta-length-violations.json; _harness/out/audit9/I-crawl/product-*/1440x900.json meta.title
verified-by:  pending (V)
outcome:      pending

### A-9.P6-2 — Low — code — meta descriptions run far past what Google will show, on the same 41 pages

class:        code
pass:         P6     ledger: E122, E149
surface:      the 42 product pages + home/industries/about
where:        src/App.jsx:7392-7399 (`.slice(0, 300)` — the only cap applied), measured on 2121597, 2026-09-14
not in §11:   checked WHATS_LEFT.md §2/§3 and PLAN-11 §11 — not listed; the shipped cap is 300 chars, the adopted rule for this audit is 50–160
reproduce:    node -e 'const fs=require("fs");const idx=JSON.parse(fs.readFileSync("_harness/out/audit9/I-crawl/index.json"));const rows=idx.pages.filter(p=>p.viewport==="1440x900"&&!p.slug.startsWith("admin-")&&p.slug!=="unknown-route");for(const p of rows){const r=JSON.parse(fs.readFileSync("_harness/out/audit9/I-crawl/"+p.json));const n=(r.meta.description||"").length;if(n<50||n>160)console.log(p.slug,n)}'
observed:     41/53 pages outside 50-160: home 181, industries 164, about 165 (hand-authored, 4-21 chars over); 38 of 42 product pages up to 300 chars (e.g. product-IP71NS-IP72PS-IP73PP at 300, hard-truncated mid clause: "…Polypropylene: -40°F to +275°F, 3000psi, "). Full list: _harness/out/audit9/P6/meta-length-violations.json
expected:     50-160 chars (adopted rule, P6 step 7); the shipped generator caps at 300 with a bare `.slice()`, which can also cut a spec sentence mid-word as shown above
consequence:  Google truncates or rewrites the snippet regardless past ~160 chars, so the practical harm is small — mostly wasted authored text, plus the one case above where the raw slice() leaves a dangling clause if that exact text is ever rendered elsewhere un-truncated
evidence:     _harness/out/audit9/P6/meta-length-violations.json
verified-by:  pending (V)
outcome:      pending

### A-9.P6-3 — Low — code — the Product Index page announces its own title twice in a row

class:        code
pass:         P6     ledger: E002 (pattern also reachable from E003's row)
surface:      `/dashboard` — `DashboardPage`
where:        src/App.jsx:10147-10152, measured on 2121597, 2026-09-14
not in §11:   checked audit-runs/*.md and WHATS_LEFT.md §2 — not previously raised; distinct from A-05 (unlabelled category select, already closed, not re-reported here)
reproduce:    curl -s http://127.0.0.1:8143/dashboard (SPA shell only) — or read the crawl: node -e 'const fs=require("fs");console.log(JSON.parse(fs.readFileSync("_harness/out/audit9/I-crawl/dashboard/1440x900.json")).ariaSnapshot.slice(0,260))' — shows `text: Product Index` immediately followed by `heading "Product Index" [level=1]`
observed:     every other inner page's `<PageEyebrow>` is a distinct category label from `copy.*Header.eyebrow` (COPY_DEFAULTS, App.jsx:6772-6825: "Company", "Legal", "Resources", "Fabrication", "Technical library", "Contact", "Industries Served"). `/products` deliberately reuses "Products" for a different reason and documents it in a 15-line comment (App.jsx:9590-9610, F6/A3/C29). `/dashboard` has no such row in COPY_DEFAULTS and no comment — its `<PageEyebrow>Product Index</PageEyebrow>` (line 10148) is hardcoded to the exact string of its own `<h1>Product Index</h1>` (line 10151), with no owner control and no stated reason
expected:     shape-parity majority pattern (P6 step 3): eyebrow is a category label distinct from the h1, or a written reason when it isn't
consequence:  cosmetic/redundant for a sighted visitor (same four words at two sizes back to back); for a screen-reader user tabbing the header it is genuinely two consecutive identical announcements. Does not block any task
evidence:     _harness/out/audit9/I-crawl/dashboard/1440x900.json
verified-by:  pending (V)
outcome:      pending

### A-9.P6-4 — Low — code — four admin page titles use different words than the nav tab you clicked

class:        code
pass:         P6     ledger: E072
surface:      13 admin pages vs `admin/nav.php`
where:        admin/nav.php:67-81 (nav labels) vs each page's own `<h1>` (admin/index.php, add.php, password.php, help.php), measured on 2121597, 2026-09-14
not in §11:   checked audit-runs/audit4.md (nav-label/landing-h1 match was checked for the handoff email, not for this exact tab-vs-h1 rule) and WHATS_LEFT.md §2 — not previously raised
reproduce:    node -e 'const fs=require("fs");const idx=JSON.parse(fs.readFileSync("_harness/out/audit9/I-crawl/index.json"));for(const slug of ["admin-index","admin-add","admin-password","admin-help"]){const e=idx.pages.find(p=>p.slug===slug&&p.viewport==="1440x900");const r=JSON.parse(fs.readFileSync("_harness/out/audit9/I-crawl/"+e.json));console.log(slug, r.headingOutline.find(h=>h.tag==="h1").text)}'
observed:     nav "Products" → h1 "Product Catalog"; nav "+ Add Product" → h1 "Add New Product"; nav "Password" → h1 "Change Password"; nav "Help" → h1 "Help & Documentation". The other 5 top-level tabs match exactly (Business Details, Page Content, Inquiries, Backups, Audit Log all identical nav↔h1)
expected:     admin structure rule (P6 step 8): h1 = current nav label
consequence:  none functionally — the nav tab is still visually current (`.current`, admin/nav.php:52-53) and every h1 is still on-topic for its page, so this does not cost Rick a task. Pure wording consistency
evidence:     _harness/out/audit9/I-crawl/admin-{index,add,password,help}/1440x900.json
verified-by:  pending (V)
outcome:      pending

## Method record (steps 1-9, so the header's "done" list is auditable)

**Step 1 — outline.** All 67 distinct pages (10 public + 404 + 42 product + 14 admin, one record each at 1440x900 or the sole admin viewport pair) checked by script against `headingOutline`: exactly one `<h1>` everywhere (0 violations), no skipped heading levels (0 violations). DOM order vs. reading order cross-checked by anchoring each heading's exact `heading "text" [level=N]` token in the Playwright `ariaSnapshot` and asserting monotonic position — 0 mismatches across all 67 (two apparent mismatches on first pass, `faq` and `admin-help`, were the probe: a bare substring match found "Products"/section names earlier in nav/link text before the real `heading "…"` token; anchoring on the exact token cleared both). Artifact: `_harness/out/audit9/P6/outline-full.json`.

**Step 2 — landmarks.** All 293 crawl records checked: exactly one `<header>`/`<main>` on every page; `<footer>` present on all 53 public/product records, absent on all 28 admin records (all 13 admin pages, by design — grep confirms no `<footer>` tag anywhere under `admin/`, and `admin/auth.php`'s signed-out page additionally has no `<header>`/`<main>` at all, being a bare centered form — consistent across every admin page, not a defect). Nav distinctness: the instrument's landmark selector is `nav[aria-label]` (unlabelled navs are invisible to it by design, per `_harness/audit9-crawl.js:117`); source has exactly two `<nav>` elements site-wide (App.jsx:670 desktop nav, unlabelled; App.jsx:5989 breadcrumb, `aria-label="Breadcrumb"`) plus `admin/nav.php:66` (unlabelled) and `admin/help.php`'s in-page TOC (`aria-label="Help topics"`) — every place two navs co-occur (product pages, admin-help) they are already distinct by label, so "navs distinct by aria-label" is satisfied with no case of ambiguity. Drawer contract confirmed structurally: `role="dialog"` + `aria-modal="true"` at App.jsx:1321-1322 (interactive confirmation in P9 step 2).

**Step 3 — shape parity.** Table of the 9 inner pages' `.ipc-page-header` top, from `ariaSnapshot`:

| page | breadcrumb | eyebrow | h1 | intro |
|---|---|---|---|---|
| /products | yes | "Products" (documented exception, App.jsx:9590-9610) | "Product Catalog" (landing) | yes |
| /dashboard | yes | "Product Index" — **duplicates its own h1**, no comment (A-9.P6-3) | "Product Index" | yes |
| /datasheets | yes | "Technical library" | "Datasheets" | yes |
| /industries | no (top-level, not nested under /products) | "Industries Served" | "Applications by Industry" | yes |
| /services | no | "Fabrication" | "Value-Added Services" | yes |
| /about | no | "Company" | "About Insulation Products Corporation" | yes |
| /faq | no | "Resources" | "Frequently Asked Questions" | yes |
| /contact | no | "Contact" | "Get in Touch" | yes |
| /privacy | no | "Legal" | "Privacy Policy" | yes |

Majority pattern: eyebrow (distinct category label) + h1 + intro paragraph, breadcrumb only on the two pages nested under Products (dashboard, datasheets) — consistent with their place in the hierarchy, not a violation. Every page ends with a path to `/contact`: the footer (present on all 10 public routes identically) carries a "Contact" quick link and a `tel:` link; home/services/faq additionally carry an inline CTA. Home's section order — hero (find+quote CTAs) → trust badges → product/service categories (find a part) → team/facility trust → industries trust → final quote CTA — matches the buyer's job (find → trust → quote) with an early trust teaser before it; judged against the brief's own ordering, no finding.

**Step 4 — navigation graph.** `KNOWN_ROUTES` (10, App.jsx:6930-6959, `home/products/dashboard/datasheets/industries/services/about/faq/contact/privacy`) cross-checked against reachability: all 10 reachable in ≤2 clicks from `/` (home/contact are top-level = 1; products/dashboard/datasheets via the Products mega-menu = 2; industries/services/about/faq via the Company dropdown = 2; privacy via the always-present footer = 1). Cold-load link resolution driven live on `:8143` (`_harness/audit9-p6-navgraph.js`, since neither mega-menu nor the mobile drawer exist in a cold DOM — both mount on click, so the I-crawl instrument's static `links[]` cannot see them): 24 unique internal hrefs collected from the Products mega-menu (13), the Company dropdown (4), and the mobile drawer's two nested accordions + top items (19, overlapping) — 19 plain paths, all cold-navigate to 200 (0 failing); 5 of those hrefs are the homepage's `/industries#industry-*` anchors (A-03/F4 precedent, GUARDRAILS §7.1) — re-verified via a genuinely fresh page per link (see self-correction above) and all 5 resolve with the target both present and scrolled into the viewport on cold load (200/200, 5/5). Mobile drawer: `Escape` closes it from inside on a real keypress (true). Sitemap `<loc>` set membership and canonical agreement are **cited, not re-measured** — `plan5b-sitemap` 9/9 and `plan5c-sitemap` 17/17 (sweep-before.txt) — because `_harness/router.php:28` hardcodes the sweep mirror's docroot for `sitemap.php`'s fallthrough, so a `/sitemap.xml` fetch on any private :814x mirror (including this one) measures the SWEEP tree's catalog, not the pass agent's own copy (pre-flagged by C, tracked as A-9.P3-1, class harness — not re-raised here). `robots.txt` (byte-identical in both trees, a static file, unaffected by the router caveat): `Allow: /` plus `Disallow: /admin/` and `Disallow: /contact.php` only — neither disallow touches any of the 10 routes, the 42 product URLs, or `/sitemap.xml` itself, so "allows all" (of the site's real content) holds. Nothing both sitemoved-in and noindexed: all 52 crawl records for the sitemap's route set (`meta.robots`) come back null — 0 noindexed among them.

**Step 5 — dead ends.** Every named surface checked, by source (file:line) plus the live mirror for anything state-dependent:
- `/products` search/family-none (App.jsx:9256-9280): "Clear filters" button. Has a way out.
- `/dashboard` search/family/approval-none (App.jsx:10493-10502, 10740-10758): no inline button in the message itself, but the search box, family pills and `ApprovalFilter`'s toggle chips (App.jsx:2851-2866, `if (!counts.length) return null` — renders unconditionally otherwise) all stay visible and interactive above the empty message. Has a way out (persistent controls, not an inline CTA — a minor asymmetry with /products and /datasheets, not itself a dead end).
- `/datasheets` filter-none, **F11** (App.jsx:3033-3054): has a "Clear" button (`onClick={() => setQ("")}`) — F11 was fixed in PR #42 per the do-not-re-report index; re-verified still present.
- admin Audit Log filtered-empty (admin/audit-log.php:164-165): the filter form (with a `Clear` link, line 156-158) renders unconditionally before the empty check. Has a way out.
- admin Inquiries (admin/inquiries.php:154) and Backups (admin/backups.php:183) empty states: informational ("nothing yet"), not a filtered dead end — nothing to escape from.
- `CatalogError` (App.jsx:12931-12971): "Retry" button + phone/email links.
- 404 / `NotFoundPage` (App.jsx:7239-7278): "Browse the product catalog" + "Search the product index" buttons.
- Contact submission failure (App.jsx:6889, inline `submitError` banner): form stays live, phone number given; not a terminal dead end.
- Admin session-expired / CSRF-fail / too-large-upload, one shared page (`csrf_fail_page()`, admin/config.php:399-451): expired gets "Back to my unsaved page" + "Sign in again"; CSRF-mismatch and too-large both get "Go back" + a "Dashboard" link — a forward link that is not Back exists in every branch.
- Contact success panels, both tabs (App.jsx:4938-5022, `submittedTab` differentiates only the title/body strings): phone/email links plus a reset-and-return button, shared by both the RFQ and message tabs.

0 dead ends found among the named surfaces.

**Step 6 — URL/parameter behaviour.** Cited, not re-measured, per brief: C1 (`/Products`, `/products/`, `/products/x`, `//products` → 404/normalised, never blank, 404 `noindex`), C2 (`?productId=` unknown/alias/lowercase/trailing-space → "part not found", page renders), C3 (`?family=`/`?approval=` unknown → empty state with a way out, consistent with step 5's own findings above), C4 (`{replace:true}` on `?family=`/`?sent=1` → Back not trapped, no false success on reload) — all P7/agent A's rows, cited verbatim from the brief's Appendix C table.

**Step 7 — meta per route.** See A-9.P6-1/A-9.P6-2 for the two length findings. Everything else checked, no finding: 0 duplicate titles, 0 duplicate descriptions, 0 duplicate canonicals across all 53 indexable pages (cite `plan8-meta` 15/15, `plan9-meta` 18/18 for the underlying distinctness/canonical-correctness suites); canonical shape (`SITE_ORIGIN` + path, `productId` the only param) holds on all 53 (the one apparent violation was `unknown-route`, which correctly has no canonical at all, being noindexed); `og-card.jpg` exists at `public/images/og-card.jpg`, verified 1200×630 (JPEG SOF marker read directly), 33,964 bytes (< 300 kB) — E118 holds; 404 (`/no-such-page`) carries `<meta name="robots" content="noindex">` and no canonical, as expected.

**Step 8 — admin structure.** `<h1>` = current nav label on 9/13 (see A-9.P6-4 for the 4 that diverge in wording; the other 4 admin pages — edit/delete/upload-pdf/upload-image — are row actions with no direct nav entry to compare against, and their h1s are contextually correct: "Edit Product: CC", "Delete this product?", "Upload PDF: CC", "Product Photo: CC"). Current tab visually marked via `.current` (admin/nav.php:52-53, distinct color + underline) on all 9 top-level pages — present, though not exposed via `aria-current` (routed to P9, out of brief for P6's structural check). `content.php` `form_complete`-last and the destructive-control/confirm pattern are cited, not re-measured: `plan2-formlast` 8/8, `plan2-delete` 18/18. Health banner above the fold at 390: cited, not re-measured: `plan10-adminnav` 25/25, `plan10-helpwidth` 21/21.

**Step 9 — print.** `grep -rn "@media print" src/ public/ admin/` → 0 matches. Matches the recorded 2026-08-27 baseline (A-7.7, open, deliberately deferred as its own change). Recorded only, not fixed.

## Out of brief
- admin/nav.php:67 — the current admin tab is marked only by a CSS class (`a.current`), no `aria-current="page"` — routed to P9 (semantics).
