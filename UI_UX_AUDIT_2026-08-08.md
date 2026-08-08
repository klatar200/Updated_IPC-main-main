# IPC website — UI/UX & user-flow audit

**Date:** 2026-08-08 · **Branch:** `claude/ipc-website-audit-8pa2zt`

Every claim below was measured in a browser against a running copy of the site,
not read out of the source. Nothing in `src/`, `admin/`, `public/` or `data/`
was changed by this audit — it adds four capture scripts under `_harness/` and
this document.

## How the site was stood up

```sh
npm install
npm run build
sh _harness/sync.sh                       # mirror dist/ + admin/ + data/ + pdfs/ into _harness/site
php -S 127.0.0.1:8123 -t _harness/site -c _harness/php-mail.ini _harness/router.php
```

`router.php` emulates the two `.htaccess` rules that matter (`/sitemap.xml` →
`sitemap.php`, and the SPA catch-all), so deep links and refreshes behave as
they will on Apache. As `CLAUDE.md` notes, `php -S` ignores `.htaccess`, so the
`admin/` and `data/` blocking rules are **not** exercised here and nothing about
them is reported.

## What was captured

| Artefact | Contents |
|---|---|
| `_harness/audit-capture.js` | 20 URLs × 2 viewports (1440×900 desktop, 390×844 iPhone/touch) — full-page PNG plus viewport-height slices so every section is legible. 202 images. |
| `_harness/audit-a11y.js` | contrast of every text-painting element against its **composited** background, keyboard-focusable-but-hidden scan, 44 px touch-target scan, `prefers-reduced-motion`, focus-ring screenshots. |
| `_harness/audit-flow.js` | drives the real journeys: mega menus, home → catalog → product → quote, form submit, search/sort/empty state, FAQ, mobile drawer. Screenshots each state. |
| `_harness/audit-products.js` | sweeps all 42 product pages for image, PDF, spec-table, overflow and layout defects. |

Output lands in `_harness/out/audit/` (`shots/`, `flow/`, `focus/`, and the
JSON records). Nothing there is deployed.

**Baseline health is good:** zero console errors and zero failed requests across
all 20 URLs × 2 viewports and every flow; no horizontal page scroll at either
width; all 42 datasheet PDFs and all 42 product images resolve; one `<h1>` per
page; correct `Organization`/`LocalBusiness`/`Product`/`FAQPage` structured
data; per-route canonical, title and `og:title`. The findings below are what sits
on top of that.

---

# Findings

**A** = broken, or costs a lead / credibility · **B** = real defect, visible ·
**C** = polish and suggestions.

## A — Fix before anything else

### A1. 18 of 42 product pages contradict themselves on UL certification category

Two different derivations run on the same page. `extractComplianceBadges()`
(`src/App.jsx:6539`) collapses **every** UL mention — `U/L`, `UL File`,
`UL Subject`, `UL Recognized`, `VW-1` — onto the single label **"UL Listed"** for
the header chip row. The "Approvals & Certifications" block below it uses
`APPROVALS` (`src/App.jsx:2344`), which correctly distinguishes Recognized /
Listed / Approved.

Measured on all 42 pages, **18 disagree**:

| Product | Header says | Approvals block says |
|---|---|---|
| IP63ES | UL Listed | UL Recognized |
| IP13SP | UL Listed | UL Recognized |
| IP17TW-18SW-19LW | UL Listed | UL Recognized |
| IP37SH-IP36TH-IP39LH | UL Listed | UL Recognized |
| IP61ES & IP62EF | UL Listed | UL Recognized |
| IP64FS-IP65VC-IP66AC-IP67SC | UL Listed | UL Recognized |
| IP42MW, IP44A2 & IP45A3, IP47HV | UL Listed | UL **Approved** |
| IP3L, IP10EX, IP30HS, IP32IP, IP33PO, IP33TW, IP34SR, IP35KY, IP55FL | UL Listed | UL VW-1 only |

UL Listed, UL Recognized and UL Approved are different UL categories with
different scopes. On IP63ES the page prints "UL Listed" and "UL Recognized"
within 200 px of each other. For a distributor selling into aerospace, medical
and automotive this is a compliance claim, not a wording slip. The code comment
at `App.jsx:2338` already says deriving structured facts from prose "is wrong in
ways nobody notices" — this is that.

Full per-product record: `_harness/out/audit/certs.json`.

### A2. "ISO 9001:2008" is claimed in three places

ISO 9001:2008 was withdrawn in September 2018. It appears in the homepage trust
bar, the homepage "ISO 9001 Quality" feature card and the About page's
certifications grid (`data/content.json:31,495,604`, defaults at
`src/App.jsx:1453,1958,2973`). Notably `data/site-info.json` says only
`"iso": "ISO 9001"` — the version was added by hand in the copy. Confirm the
current registration with Rick (almost certainly 9001:2015) and edit it in
**Page Content**; all three strings are owner-editable.

### A3. All 42 product pages ship the same title, description and heading

Every `?productId=` URL renders `<title>Product Catalog — Insulation Products
Corporation</title>` and the `/products` meta description, with the product name
as an `<h2>` under an `<h1>` reading "Product Catalog". Each one also declares a
self-referencing canonical and is listed in the sitemap (51 URLs), so Google is
being handed 42 indexable pages that describe themselves identically. The
product name should drive `<title>`, `description`, `og:title` and the `<h1>`.

### A4. `og:image` is an empty tag, so no link preview ever shows an image

`index.html:20` carries `<!-- TODO: add /images/og-card.jpg (1200x630) … -->` and
line 21 ships `<meta property="og:image">` with **no `content` attribute**, while
`twitter:card` is set to `summary_large_image`. Every link pasted into LinkedIn,
Teams, Slack or an email client renders as a bare text card. On a B2B site whose
product URLs get pasted into procurement threads, that's the cheapest visible
win on this list.

### A5. Every unknown URL returns the homepage with HTTP 200 and its own canonical

`App.jsx:10237`'s `default:` case renders `<HomePage />`, and `PageMeta` builds a
title and canonical from the path segment. Measured:

| URL | Status | Title | Canonical |
|---|---|---|---|
| `/quality` | 200 | Quality — Insulation Products Corporation | `…/quality` |
| `/prodcuts` | 200 | Prodcuts — Insulation Products Corporation | `…/prodcuts` |
| `/contact-us` | 200 | Contact Us — Insulation Products Corporation | `…/contact-us` |

There is no 404 state anywhere in the app. Every mistyped link, stale bookmark
and old inbound link becomes a self-canonicalising duplicate of the homepage,
and a visitor who typo'd gets no signal they're in the wrong place. Needs a real
"page not found" route with a `noindex` meta and links back into the catalog.

### A6. The "View Product" button is clipped on all 41 Product Index rows

At 1440 the table is **1264 px inside a 1230 px wrapper**, so every one of the 41
action buttons overflows the wrapper's right edge by 16 px and is visibly cut.
The wrapper is `overflow-x: auto`, so it can be scrolled — but nothing indicates
that, and the primary action on the page is the thing being hidden.

### A7. Five products fetch their photo from `placehold.co`

`IP12GA - IP1274`, `IP13SP`, `IP25PU`, `IP30UV`, `IP47HV` have
`photoUrl: "https://placehold.co/400x300/…"` in `data/products-all.json`. The
branded fallback panel ("PRODUCT IMAGE COMING SOON" over the IPC mark) is good
and does fire here — but only *after* the external request fails, so each of
those five pages pays a third-party round trip, and on any network where
placehold.co resolves the visitor sees a grey third-party stock tile instead of
the branded panel. Clear those five `photoUrl` values in the admin and the
branded panel becomes the first paint.

---

## B — Real defects, visible today

### B8. Product SKU labels sit at 1.64:1 contrast — 80 instances

`rgb(196,203,212)` on white, 12 px bold: the part numbers in the catalog
sidebar. Needs 4.5:1. The part number is the one string a buyer scans a catalog
for, and on mobile it is nearly invisible (see
`_harness/out/audit/flow/m04-product-top.png`).

### B9. Secondary grey text sits at 2.37–2.54:1 — about 65 instances

`rgb(156,163,175)` (Tailwind `gray-400`) on white / `#f8fafc`, 10–12 px. Hits
"Founded July 1, 1974" and the other three homepage stat sub-lines, every
certification line on `/datasheets` ("UL Listed · cUL", "CSA · MIL-SPEC · UL
VW-1", 30 of them), "Showing 41 of 41 products", "Mon–Fri, 8am–5pm CT",
"Typical reply: same day", and the family headings in the catalog sidebar.

### B10. Footer text fails contrast — 121 instances

- Quick Links and the description paragraph: `rgba(255,255,255,0.45)` on
  `#0a2240` → **4.25:1** at 12 px (99 instances)
- Copyright and the domain line: `rgba(255,255,255,0.3)` → **2.64:1** (22)

The earlier brand-colour work (`brandtext.js`) measured only *brand-coloured*
text; these are the neutral and white-alpha values it never looked at. Full
table: `_harness/out/audit/a11y.json`.

### B11. Missing space in the footer paragraph

Rendered: *"…electrical sleeving, and industrial adhesives.**$50** minimum
order."* At `src/App.jsx:9791-9794` the text ends `adhesives.` on one line and
`{site.stats.minimumOrder}` starts the next; JSX strips the newline entirely
rather than collapsing it to a space. Appears on every page.

### B12. The catalog is counted three different ways

| Page | Says |
|---|---|
| `/products` sidebar | "41 products" |
| `/dashboard` header | "41 of 41 products" |
| `/dashboard` approval filter, same screen | "30 of **42** products carry at least one" |
| `/datasheets` | "**42** of 42 shown" |

`VALUE-ADDED` is in `SIDEBAR_EXCLUDED` (`App.jsx:6028`) so the catalog views say
41, but `App.jsx:2447` prints `products.length`, which is 42. On mobile the 41
and the 42 are four lines apart.

### B13. The mobile menu has no scrim, doesn't lock the page and ignores Escape

Measured with the drawer open at 390 px: no full-screen fixed overlay,
`body { overflow: visible }`, and `window.scrollTo(0, 900)` succeeded — the page
scrolls freely behind the open drawer. `Escape` leaves it open. The drawer
occupies only the top ~340 px, so the rest of the page stays interactive
underneath it.

### B14. `prefers-reduced-motion: reduce` is not honoured

`src/index.css:85` has a reduced-motion block, but it only disables
`.ipc-skeleton`. The homepage trust marquee (`.ipc-marquee-track`,
`animation: ipc-marquee 32s linear infinite`) keeps scrolling under
`reduce`. Measured under an emulated reduce preference: 1 infinite animation
still running.

### B15. No skip link

Tab order on every page starts at the logo and walks the entire header before
reaching content. WCAG 2.4.1 Bypass Blocks, Level A. `document.querySelector('a[href^="#"]')` returns null site-wide.

### B16. The contact success state announces nothing and takes no focus

After a successful submit the form is replaced by a "Quote Request Received"
panel. There is **no** `aria-live`, `role="status"` or `role="alert"` region on
the page (measured: zero), and `document.activeElement` is `<body>`. A screen
reader user gets silence. The *error* path was given a proper `role="alert"`
region (WHATS_LEFT 4.5) — the success path never got the same treatment.

### B17. The success state has no URL of its own

The URL stays `/contact`. Refreshing loses the confirmation and re-renders an
empty form, and there is no distinct URL to hang an analytics conversion goal
on — on a site whose entire purpose is lead capture.

### B18. Three defects on the success page itself

- The "urgent inquiries" line renders **a tofu box** where the 📧 emoji should
  be: `📞 630.771.0700 · 📠 630.771.0701 · ▯ sales@insulationproducts.com`.
- Phone, fax and email there are **plain text, not links** — no `tel:`/`mailto:`
  at the exact moment a user might want to call.
- ~330 px of empty page between the buttons and the footer, and the page header
  is the only one on the site with no eyebrow label above the `<h1>`.

Screenshot: `_harness/out/audit/flow/10-success-full.png`.

### B19. Product Index column widths are inverted

Measured header widths: Product Name 159, **Part ID 259**, **Part Type 258**,
**Description 142**, Temp 110, Specifications 163, Action 173. The two columns
holding a short SKU and a small chip get 517 px between them; the longest
content gets 142 px and wraps to one to three words per line. Rows come out
183–223 px tall, so 41 products make a **9,595 px** page with no pagination.

### B20. The dashboard empty state doesn't span the table

Searching for something with no matches gives a good empty state (icon, the
query echoed back, a clear-filter button) — but the cell stops short of the
table's right edge, leaving a grey band. `colspan` is one short.
`_harness/out/audit/flow/08-dashboard-empty.png`.

### B21. The Services lead-time banner repeats itself

Rendered: **"Standard Lead Time: ≤ 1 week · ≤ 1 week (JIT by agreement)"**. The
summary de-duplicates exact strings, and five services carry `"≤ 1 week"` while
Kitting & Bagging carries `"≤ 1 week (JIT by agreement)"`, so both survive and
get joined. It reads like a rendering bug.

### B22. The contact form suggests a date that is 13 months in the past

Required Delivery Date placeholder: `e.g. ASAP, end of month, 6/30/2025`.

### B23. The product photo has no `width`/`height`

It is the LCP element on every product page (correctly `loading="eager"` since
4.32), painted at 390×260, but ships no intrinsic dimensions — so it reserves no
space and shifts the layout on load. Every other image on the site has them.

### B24. Touch targets under 44 px on mobile

| Control | Size |
|---|---|
| Product page "Download PDF" | 140×**28** |
| Product page "Request Quote" | 125×**28** |
| Inline `tel:` / `mailto:` links (contact, about, datasheets, privacy, faq) | ×**14–19** |
| Dashboard approval filter chips | ×**25** |
| FAQ category chips | ×**30** |
| Footer social icons, hero CTAs | 40×40 |

The two 28 px ones are the primary actions on the most important page.

### B25. `/datasheets` inherits the homepage meta description

`data/content.json`'s `seo` array has 9 rows and no `datasheets` row, so the
description falls through to `home.desc`. `SEO_DEFAULT` in `App.jsx` *does* have
the right text — it just loses to the saved content. Any future page added
without an `seo` row does the same silently.

### B26. On mobile, the quote form is below ~1,000 px of contact cards

Source order puts the "Direct Contact" rail (phone, fax, email, address cards)
and the "For fastest response, include:" panel above the form. On desktop
they're side by side; on a 390 px screen a visitor scrolls past four cards and a
tip panel before seeing the thing the page exists for.
`_harness/out/audit/flow/m07-contact.png`.

### B27. The catalog sidebar hides 10 of its 11 categories inside a silent scroller

Measured: `max-height: 720px`, `clientHeight` 718, `scrollHeight` **3,203**. Only
"Polyolefin Heat Shrink" is expanded on arrival; the other ten category headers
are below the inner fold with no visual cue that the region scrolls.

### B28. `/services` skips a heading level

`h1` → `h3` with no `h2`. Every other page is well-formed.

---

## C — Suggestions

### C29. `/products` has no catalog landing state
It auto-selects `CC` and renders one product's detail under an `<h1>` of
"Product Catalog" and the sub-line "Select a product to view full
specifications" — when one is already selected. The canonical `/products` page
is therefore the CC product page. A grid or list overview would give the route a
reason to exist and would be the natural landing page for "product catalog"
searches.

### C30. The six homepage market cards all link to bare `/industries`
And `/industries` has **no anchors at all** (measured: zero `id`s in content).
Clicking "Medical Devices" drops the visitor at the top of a 3,479 px page with
Medical Devices third of six. Give each section an `id` and link
`/industries#medical`.

### C31. Industry-card CTAs carry no context
"Request a Quote →" → `/contact` and "Browse All Products" → `/products`,
repeated identically on all six cards. The product page already proves the
pattern works (`/contact?part=IP33PO` prefills the form) — the same trick would
prefill the industry, or land on the catalog filtered to that industry's parts.

### C32. Three overlapping certification blocks per product page
Header chips, "Approvals & Certifications", and "Product Features" are all
derived from the single `badges` array and print overlapping, sometimes
conflicting values (see A1). Two blocks — approvals and features — would say
everything.

### C33. No breadcrumbs and no `BreadcrumbList`
On a 42-product catalog with a deep-linkable detail view, a
Home › Products › Polyolefin Heat Shrink › IP33PO trail is the standard
orientation cue, and it earns a rich result.

### C34. Datasheet links give no cue about what they do
All 42 are `target="_blank" rel="noopener"` with no "opens in a new window"
text, no "PDF" label and no file size. Adding `noreferrer`, a PDF badge and a
size would set expectations before a 400 KB download on mobile data.

### C35. "Datasheets" is missing from the footer
`FOOTER_LINKS` in `App.jsx` has 9 entries; the saved `content.json`
`footerLinks` has 8 and omits Datasheets. It is reachable only from the Products
dropdown. Adding it back is one row in Page Content.

### C36. Confirm the five social accounts are current
X, Facebook, LinkedIn, YouTube and Pinterest all render in the footer and feed
JSON-LD `sameAs`. Worth confirming each still exists and is maintained —
a dead profile linked from the footer and declared to Google is worse than none.

### C37. Large empty regions in the primary layouts
The homepage hero's right column is empty below the four stat cards (~280 px);
the page-header band on all nine inner pages is empty on the right half; the
contact page's left rail ends 320 px above the form; the Industries cards leave
a gap between their certification chips and their CTAs. None is broken — but on
a 50-year-old manufacturer's site those are the natural homes for facility,
fabrication and product photography, of which the site currently has none.

### C38. No `<noscript>`
The whole site is client-rendered. With JS off or the bundle failing, a visitor
gets a blank white page and no phone number. A four-line `<noscript>` with the
address and phone costs nothing.

### C39. Contact form polish
No privacy-policy note near the submit, no legend explaining `*`, and "Optional"
as the phone placeholder while every other placeholder is a worked example.

### C40. The form is `method="get"` with no `action`
It's submitted by `fetch`, so this never fires in practice — but if the bundle
fails, the browser would put the lead's name, email and message into the query
string and reload the page. `method="post" action="/contact.php"` would degrade
gracefully.

### C41. FAQ opens fully collapsed with no "expand all"
14 questions, all closed. The category chips are good jump links (verified:
scrolls to the section), but scanning for an answer means 14 clicks.

### C42. Two dated pieces of copy
The About timeline ends at **"2024 · 50 Years — Celebrating 50 years"** (it is
now 52), and the privacy policy reads **"Effective Date: January 1, 2025"**.
Both are owner-editable.

### C43. The header logo reads as a cropped tile
`public/logo.svg` paints an opaque `#FEFFFE` rectangle across its full
892×904 artboard and the swoosh runs off the edge, so at 46 px on the navy bar it
looks like a clipped blue square rather than a mark. A transparent-background
version, or a horizontal lockup, would sit properly in the bar. Also
`alt="IPC logo"` — since it links to the homepage, it should name the
destination.

### C44. Empty footer strip on one Services card
"Cut-to-Length" renders a grey footer band with nothing in it, where
"Hot-Stamp Marking" has a brochure link. It reads as a missing link.

### C45. The SKU chip looks like a button
On the product detail header, `IP13SP` is styled as a pill immediately left of
"Download PDF" and "Request Quote", so it reads as a third button.

### C46. Mobile product names truncate mid-word
"Commercial Grade Polyolefin Tubi…", "UV Resistant PVC Heat Shrink Tub…",
"Thin Wall Heat Shrinkable Polyol…" — most of the catalog, in the one view where
the name is all a buyer has to go on.

### C47. Product names are uppercased in the detail header
`NONMETALLIC LIQUID-TIGHT CONDUIT COUPLING` — all-caps costs legibility on the
longest strings on the site.

### C48. VALUE-ADDED is in three views and out of one
Excluded from the catalog sidebar, present in the Product Index, Datasheets and
the sitemap. Probably deliberate, but it's the source of the 41-vs-42 confusion
in B12 and is worth a decision either way.

### C49. Four spec tables scroll horizontally at 1440
`IP17TW-18SW-19LW` (435 px in a 389 px column), `IP37SH-IP36TH-IP39LH`,
`IP47HV`, `IP53MP`. Handled with `overflow-x: auto`, so nothing is lost — but at
desktop width a table shouldn't need it; the two-column spec layout is squeezing
them.

### C50. The trust marquee is a focusable div with no name
`<div class="ipc-marquee-track" tabIndex={0}>`, 5,012 px wide, no `role`, no
`aria-label`. It's a tab stop that announces the whole certification strip as one
unlabelled blob.

---

## Not findings — checked and clean

- Zero console errors and zero failed network requests across every route and
  every flow, at both viewports.
- No horizontal page scroll at 1440 or 390 on any route.
- All 42 datasheet PDFs resolve; all 42 product images resolve (5 via the
  branded fallback, per A7).
- Deep links and refreshes work on every route through the real rewrite.
- `?productId=` values containing spaces, `&` and `/` round-trip correctly, and
  the `+`-encoded links declare the same `%20` canonical the sitemap uses.
- One `<h1>` per page; `lang`, `viewport`, `theme-color`, favicon and manifest
  all present.
- `Organization`, `LocalBusiness`, `Product` and `FAQPage` structured data parse
  cleanly.
- Mega menus open on click, close on outside click and on Escape, and cannot
  both be open at once.
- The product → "Request Quote" → prefilled `/contact?part=IP33PO` flow works.
- Dashboard search, sort (`aria-sort` on exactly one column) and the empty state
  all behave.
- The sticky product RFQ bar stays below the fold until the user scrolls.
- `robots.txt` and the generated `/sitemap.xml` (51 URLs) are correct.
