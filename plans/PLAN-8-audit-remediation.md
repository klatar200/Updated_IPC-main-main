# PLAN 8 — Remediating the 2026-08-08 UI/UX audit

**Source:** [`UI_UX_AUDIT_2026-08-08.md`](../UI_UX_AUDIT_2026-08-08.md) (PR #20).
Every ID below (`A1`–`C50`) maps 1:1 to that document, which carries the raw
measurements and the screenshots behind each one.

**Items:** 50 — 7 severity-A, 21 severity-B, 22 suggestions.
**Depends on:** nothing. Six phases, sequenced in §2.
**Read [GUARDRAILS.md](GUARDRAILS.md) first.** This plan adds constraints
(§1); it relaxes none.

---

## 0. Decisions needed before you start

Four items cannot be executed correctly by an agent alone. **Do not guess any of
them.** Ask, get an answer, record the answer in the item's entry, then build.
Everything not listed here is unblocked — start on those while you wait.

| ID | Question | Why it cannot be inferred |
|---|---|---|
| **A2** | What ISO 9001 revision is IPC actually registered to, and what is the certificate number / registrar? | The site says `:2008`, withdrawn in 2018. `site-info.json` says only "ISO 9001". Writing `:2015` because it is the current standard would be inventing a certification claim. |
| **A3 / C29** | Does product detail become its own route (`/products/:id`), or stay `?productId=` with per-product metadata? | Option A is the correct long-term shape and changes every product URL, the sitemap, the canonicals and `.htaccess`. Option B is ~1/5 the work and fixes the indexing problem without moving any URL. Recommendation and full trade-off in the A3 entry. |
| **C36** | Are all five linked social accounts (X, Facebook, LinkedIn, YouTube, Pinterest) live and maintained? | A dead profile linked from the footer and declared to Google in `sameAs` is worse than no link. Only the owner knows. |
| **C48** | Should `VALUE-ADDED` appear in the catalog sidebar? | It is deliberately in `SIDEBAR_EXCLUDED` but present in the Product Index, Datasheets and the sitemap. Both answers are defensible; the count fix (B12) needs the answer first. |

Owner-editable copy that is merely *stale* (C42) does not block: fix the
mechanism if there is one, and list the strings for Rick.

---

## 1. Constraints specific to this plan

These sit **on top of** GUARDRAILS §2, not instead of it.

### 1.1 `data/*.json` is off limits — and 9 of these items live there

GUARDRAILS §2 forbids modifying `data/products-all.json`, `data/content.json`
and `data/site-info.json`: they are live customer state and the repo copies are
not authoritative. Every item below is therefore tagged:

- **`CODE`** — fix in `src/`, `public/`, `admin/` or `index.html`. Build it.
- **`DATA`** — the wrong value lives in `data/*.json`. **Do not edit the file.**
  Fix the *default* in `App.jsx` if there is one, verify the admin can express
  the correct value, then add the change to the owner action list (§6). The only
  precedent for a direct data edit is the `photoUrl` case fix, which needed an
  explicit owner override.
- **`BOTH`** — needs a code change *and* an owner action to take effect on the
  live server.

If an item is `DATA` and the admin **cannot** express the correct value, that is
a `CODE` defect in the admin and it belongs in this plan. Say so.

### 1.2 The regression baseline in GUARDRAILS §4.1 is stale — do not trust it

Eleven of the thirteen commands it lists reference scripts that no longer exist
in the tree (`b1.js`, `b2.js`, `b3.js`, `nb2.js`, `nb4.js`, `help.js`, `ttl.js`,
`sweep.js`, `overflow.js`, `adminsweep.js`, `b1trunc.js`). Only
`_harness/lint.php` and `_harness/invariants.js` survive. The live suite list is
`_harness/README.md`.

**Use this as the baseline instead**, and run it before you start so you know
what you inherited:

```sh
npm run build                       # 0 errors
php _harness/lint.php               # php -l, node --check, JSON parse, copy-key drift
node _harness/invariants.js         # 15 checks, 0 failing  ← the twelve invariants
node _harness/invariants-selftest.js
node _harness/copydrift.js
node _harness/deadlinks.js
node _harness/skuparity.js && php _harness/skuparity.php
node _harness/contrastparity.js && php _harness/contrastparity.php
# then the per-plan suites you are about to disturb — see _harness/README.md
node _harness/plan4-public.js   node _harness/plan5-keys.js
node _harness/plan5-spectable.js node _harness/plan5-images.js
node _harness/plan5b-sitemap.js  node _harness/plan5c-sitemap.js
node _harness/plan5c-eyebrow.js  node _harness/plan5c-brandink.js
node _harness/brandtext.js
```

**Correcting GUARDRAILS §4.1 to the real list is part of this plan** (§7). A
baseline that names missing scripts produces a green report from a suite that
never ran.

### 1.3 Re-arm the harness after every build

`sh _harness/sync.sh` after **every** `npm run build` and every `admin/` or
`public/` edit, or the suites test stale code. This has caused false passes
before.

### 1.4 Contrast numbers must be measured, not calculated

Phase E changes colour values. Do not ship a value because the arithmetic says
it passes — composite it in the browser with `_harness/audit-a11y.js` and read
the number back. Six real mis-classifications during the earlier brand-colour
work were caught only by measuring.

---

## 2. Phases and order

| Phase | Items | Effort | Risk | Why here |
|---|---|---|---|---|
| **A — Product-page truth** | A1, A2, C32, C45, C47 | M | Low | Highest severity on the list and touches nothing else. A1 is a compliance claim, not a UI bug. Start here. |
| **B — Indexability & sharing** | A3, A5, A4, B25, C29, C33 | M–L | **High** | Gated on the §0 A3 decision. Changes routing, canonicals and the sitemap, so every later phase's screenshots and URL assertions depend on its outcome. Do it **second**, not last. |
| **C — Catalog browsing** | A6, B19, B20, B27, B12, C30, C35, C46, C48, C49 | M | Low | The three catalog views. Independent of D and F. |
| **D — Lead capture** | B16, B17, B18, B22, B26, C31, C39, C40 | M | Low | Every defect here costs an enquiry. Independent of C and F. |
| **F — Chrome, assets, copy** | B13, B21, B23, B11, A7, C34, C36, C37, C38, C41, C42, C43, C44 | M | Low | Mobile drawer, images, copy. Independent. |
| **E — Legibility & input** | B8, B9, B10, B14, B15, B24, B28, C50 | M | Med | **Last.** It changes colour on ~270 elements and adds a focusable skip link, so it moves every screenshot baseline and every tab-order assertion the other phases wrote. |

Phases C, D and F are independent of each other. B gates nothing structurally
but should precede them so URLs settle. E goes last for the same reason 4.32
went last in PLAN-5.

---

# Phase A — Product-page truth

## A1 — 18 of 42 product pages contradict themselves on UL certification category · `CODE`

### Evidence

Two derivations run on the same page from the same `badges` array.
`extractComplianceBadges()` (`src/App.jsx:6539`) maps **every** UL mention —
`U/L`, `UL File`, `UL Subject`, `UL Recognized`, `224`, `VW-1` — onto the single
label `"UL Listed"` for the page-header chip row. `APPROVALS`
(`src/App.jsx:2344`) correctly separates Recognized / Listed / Approved for the
"Approvals & Certifications" block below it.

Measured on all 42 pages, 18 disagree. `IP63ES` prints **"UL Listed"** and
**"UL Recognized"** within 200 px of each other. `IP42MW`, `IP44A2 & IP45A3` and
`IP47HV` print "UL Listed" against "UL **Approved**". Eleven more print
"UL Listed" where the only real UL fact is VW-1 flammability. Per-product record:
`_harness/out/audit/certs.json`.

UL Listed, UL Recognized and UL Approved are distinct UL categories with
different scopes. This is a certification claim on a supplier to aerospace,
medical and automotive buyers.

### The fix

**One derivation, not two.** Delete `extractComplianceBadges()` and render the
header chip row from the same source the approvals block uses.

Preserve the existing stored-field behaviour when you do: the approvals path
tests `Array.isArray(product.approvals)`, never truthiness, so a product whose
owner unticked every box (`approvals: []`) shows none rather than re-deriving
what he removed. That is invariant 3's rule applied to this field — keep it.

If the header row is kept at all, see C32 — the case for deleting it outright is
strong and this fix is a prerequisite either way.

`extractComplianceBadges` also emits `AMS` from `AMS[\s-]\d` and `NEMA`/`ASTM`
which the approvals table has no equivalent for. Losing them is acceptable;
inventing a UL category is not. If any are worth keeping, add them to
`APPROVALS` with a boundary-anchored regex — note the comment at `App.jsx:2338`
explaining why word boundaries are load-bearing (`Ultra Clear` and
`Encapsulating` both contain `ul`).

### Acceptance

- A new `_harness/plan8-certs.js` asserts, across **all 42** product pages, that
  no page prints two different UL categories. Currently 18/42 fail; must be 0/42.
- Prove the check can fail: reinstate `extractComplianceBadges` for one product
  and watch it go red.
- `IP63ES`, `IP42MW`, `IP47HV`, `IP13SP` screenshotted before and after.
- A product with a stored `approvals: []` still shows no approvals.
- `node _harness/plan7-approvals.js` at least as green as you found it.

---

## A2 — "ISO 9001:2008" is claimed in three places · `BOTH` · **blocked on §0**

### Evidence

ISO 9001:2008 was withdrawn in September 2018. It appears in the homepage trust
bar, the homepage "ISO 9001 Quality" feature card and the About page's
certifications grid: `data/content.json:31, 495, 604`, with matching hardcoded
defaults at `src/App.jsx:1453, 1958, 2973`. `data/site-info.json` says only
`"iso": "ISO 9001"` — the version was typed into the copy by hand.

### The fix

Get the real answer first (§0). Then:

- **`CODE`:** correct the three defaults in `App.jsx` so a fresh install is right.
- **`DATA`:** the live strings are in `content.json` and must be changed by the
  owner in **Page Content**. Add to §6 with the exact three field locations.
- Consider whether the version belongs in `site-info.json`'s
  `certifications.iso` instead of three copies of prose — if it does, that is a
  `CODE` change plus one admin field, and it makes the next revision a one-field
  edit. Note that `certifications.iso` is already read in the footer and JSON-LD,
  so check both render correctly with a versioned string before proposing it.

### Acceptance

- Zero occurrences of `9001:2008` in `src/`.
- Whatever string the owner supplies renders in all three places, screenshotted.
- If the value moves to `site-info.json`: `mergeSiteInfo`'s blank-drop still
  applies (invariant 4 — do **not** add it to `SITE_CLEARABLE` unless the owner
  should be able to clear it), and JSON-LD still validates.
- §6 lists the three admin fields Rick must edit.

---

## C32 — Three overlapping certification blocks per product page · `CODE`

### Evidence

Header chips ("Certifications & Standards"), "Approvals & Certifications" and
"Product Features" are all derived from the one `badges` array and print
overlapping — and per A1, sometimes conflicting — values. On `IP13SP`: header
says `UL Listed · MIL-SPEC · AMS`; approvals say `UL Recognized · MIL-SPEC`;
features say `U/L RECOGNIZED · MIL-SPEC · STANDARD AND REVERSE CUTS ·
FIRE RESISTANT`.

### The fix

Collapse to two blocks: **Approvals & Certifications** (the standards, derived
once per A1) and **Product Features** (everything in `badges` that is not a
standard). Delete the header chip row.

Do this **after** A1 lands, not instead of it — if the header row is ever
restored it must not reintroduce a second derivation.

### Acceptance

- One standards list per product page, across all 42.
- No badge string disappears entirely: every entry in a product's `badges` still
  appears in exactly one of the two blocks. Assert this over all 42.
- Screenshot `IP13SP` and `CC` before and after.

---

## C45 — The SKU chip reads as a third button · `CODE`

**Evidence.** On the product detail header the SKU (`CC`, `IP13SP`) is styled as
a filled pill immediately left of "Download PDF" and "Request Quote", in the
same row, at the same height.

**The fix.** Restyle it as a label — no button fill, no button padding — or move
it beside the product name where a part number belongs. It must not sit in the
action row looking clickable.

**Acceptance.** Screenshot at 1440 and 375. The SKU is not a `<button>` or an
`<a>`, and does not share the action row's visual treatment.

---

## C47 — Product names are uppercased in the detail header · `CODE`

**Evidence.** `NONMETALLIC LIQUID-TIGHT CONDUIT COUPLING` — all-caps applied to
the longest strings on the site, which wrap to two lines at 1440 and three at
375.

**The fix.** Drop the uppercase transform on the product name only. Leave the
small uppercase eyebrow labels alone — they are a deliberate part of the design
system (`PageEyebrow`, PLAN-5c).

**Acceptance.** Screenshot the three longest product names at 1440 and 375; no
line-count regression.

---

# Phase B — Indexability and sharing

## A3 — All 42 product pages ship the same title, description and `<h1>` · `CODE` · **blocked on §0**

### Evidence

Every `?productId=` URL renders `<title>Product Catalog — Insulation Products
Corporation</title>`, the `/products` meta description and the same `og:title`,
with the product name as an `<h2>` under an `<h1>` of "Product Catalog". Each one
declares a self-referencing canonical (PLAN-1 4.3) and is listed in the sitemap
(51 URLs, PLAN-5c). So 42 indexable URLs describe themselves identically.

### The fix — two options, decide in §0

**Option A — its own route, `/products/IP33PO`.** Correct long-term shape.
Requires: `pathnameToPage` to parse a second segment; `PageLink`/`pageHref` to
emit it; `public/.htaccess` unchanged (the catch-all already covers it);
`sitemap.php`'s `rawurlencode` and `PageMeta`'s `encodeURIComponent` to agree on
the five ids containing spaces, `&` and `/` — that agreement is asserted today by
`plan5c-sitemap.js` and must stay asserted; and **301s from every `?productId=`
URL**, because those are the URLs currently in the sitemap and in Google's index.
Roughly 5× the work of Option B and it moves 42 live URLs.

**Option B — keep `?productId=`, fix the metadata.** `PageMeta` derives
`<title>`, `description` and `og:title` from the selected product; the product
name becomes the page `<h1>` and "Product Catalog" is demoted to the eyebrow or
a visually-hidden heading. No URL moves, the sitemap is unchanged, and the
indexing problem is solved.

**Recommendation: Option B.** The audit found no evidence the query-string form
is being penalised — canonicals are correct and consistent, and the five
awkward ids already round-trip. The defect is the *metadata*, and Option B fixes
exactly that at a fraction of the risk. Take Option A only if the owner wants
readable product URLs as a goal in itself.

### Acceptance

- 42 distinct `<title>` values, 42 distinct meta descriptions, 42 distinct
  `og:title` values. Assert the count of distinct values equals 42, not merely
  that they are non-empty.
- One `<h1>` per page and it is the product name.
- Canonical still self-referencing and still byte-identical to the sitemap's
  `<loc>` for all 42, including `IP44A2 & IP45A3`, `IP41NE / IP43VT`,
  `IP12GA - IP1274`, `IP61ES & IP62EF`, `IP71NS - IP72PS - IP73PP`.
- `node _harness/plan5c-sitemap.js` and `plan5b-sitemap.js` green.
- If Option A: every old `?productId=` URL 301s to its new address, asserted over
  HTTP for all 42.

---

## A5 — Every unknown URL returns the homepage at 200 with its own canonical · `CODE`

### Evidence

`App.jsx:10237`'s `default:` case renders `<HomePage />` for any unrecognised
path segment, and `PageMeta` builds a title and canonical from that segment:

| URL | Status | Title | Canonical |
|---|---|---|---|
| `/quality` | 200 | Quality — Insulation Products Corporation | `…/quality` |
| `/prodcuts` | 200 | Prodcuts — Insulation Products Corporation | `…/prodcuts` |
| `/contact-us` | 200 | Contact Us — Insulation Products Corporation | `…/contact-us` |

There is no 404 state anywhere in the app. Every typo, stale bookmark and dead
inbound link becomes a self-canonicalising duplicate of the homepage.

### The fix

Add an explicit known-routes set and a `NotFoundPage`. Three parts, all needed:

1. `renderPage()`'s `default:` renders `NotFoundPage` when the segment is not in
   the known set — not `HomePage`. Home stays the `null`/`""` segment only.
2. `PageMeta` emits `<meta name="robots" content="noindex">` on that route and
   **emits no canonical at all**. A canonical pointing at a soft 404 is the
   half-fix that looks done.
3. The page itself: says the address doesn't exist, and offers the catalog, the
   Product Index and the phone number. A dead end that still sells.

The server will still answer 200 — Apache's catch-all rewrite is load-bearing
for every deep link and must not be narrowed to carve out unknown segments.
`noindex` is the correct answer for an SPA and is what search engines act on.
Say so in a comment so nobody "fixes" it later by breaking the rewrite.

### Acceptance

- `/quality`, `/prodcuts`, `/contact-us`, `/products/CC/extra` all render the
  not-found page, carry `noindex`, and carry **no** `<link rel="canonical">`.
- All 10 real routes are unaffected: still render, still canonical, no `noindex`.
  Assert this explicitly — an over-broad known-set check would silently noindex
  a real page.
- The three known-good deep links with query strings still work
  (`?productId=`, `?family=`, `?part=`).

---

## A4 — `og:image` ships as an empty tag · `CODE`

### Evidence

`index.html:20` carries `<!-- TODO: add /images/og-card.jpg (1200x630) … -->` and
line 21 ships `<meta property="og:image">` with **no `content` attribute**, while
`twitter:card` is `summary_large_image`. Every link pasted into LinkedIn, Teams,
Slack or an email client renders as a bare text card.

### The fix

Produce `public/images/og-card.jpg` at 1200×630 from existing brand assets —
logo, brand colours, and one line of the homepage proposition. No new
dependency and no paid service (GUARDRAILS §2); `sharp` is already the
established `npm i --no-save` tool for image work here (`_harness/imgopt.js`).

Then set `content` on the tag, and have `PageMeta` override it per route where a
better image exists — the product photo on a product page is the obvious one.
Fall back to the card whenever the product uses the branded placeholder (A7).

Keep it under the file-weight discipline PLAN-5's 4.32 set: nothing over 300 KB.

### Acceptance

- `og:image` has an absolute `https://` URL on every route (relative URLs are
  ignored by several crawlers) — assert over all 10 routes plus 3 product pages.
- The file exists, is ≤ 300 KB, and is 1200×630.
- On a product page with a real photo, `og:image` is that photo; on one using the
  branded placeholder, it is the card.
- `og:image:width` / `og:image:height` set, so the first share renders without a
  fetch.

---

## B25 — `/datasheets` inherits the homepage meta description · `CODE`

**Evidence.** `data/content.json`'s `seo` array has 9 rows and no `datasheets`
row, so the description falls through to `home.desc`. `SEO_DEFAULT` in
`App.jsx:5470` *has* the right text — it loses to the saved content, because
`mergeContent` replaces array sections wholesale (invariant 3, working as
designed).

**The fix.** Make the fallback per-page rather than per-site: a route with no
`seo` row should fall back to **its own** `SEO_DEFAULT` entry, and only then to
the homepage. This is the same class of bug as the `seo: []` amendment in PLAN-1
— that one fixed the *title* fallback and left the *description* fallback
pointing at `home`.

Do not fix this by editing `content.json` (`DATA`). The mechanism is the defect:
any page added later without an `seo` row does the same thing silently.

**Acceptance.** 10 of 10 routes have a distinct meta description with
`content.json` untouched. Prove it by deleting a *second* row from a scratch copy
of the content file and confirming that route still gets its own description.

---

## C33 — No breadcrumbs and no `BreadcrumbList` · `CODE`

**Evidence.** No breadcrumb markup anywhere; `nav[aria-label*=breadcrumb]`
returns nothing on all 10 routes. On a 42-product catalog with a deep-linkable
detail view this is the standard orientation cue.

**The fix.** A breadcrumb on product detail and on the three catalog views:
Home › Products › *family* › *product*. Render it as a real `<nav aria-label="Breadcrumb">`
with an ordered list, using `PageLink` so the links stay crawlable (PLAN-1 4.21),
and emit matching `BreadcrumbList` JSON-LD alongside the existing `Product`
node. Build it from `familyOrder(content)` and the product's own `partType`, not
a second hardcoded list.

**Acceptance.** Breadcrumb renders on all 42 product pages with the correct
family; `BreadcrumbList` parses and its `item` URLs match the page's own
canonical scheme; keyboard reachable; does not change the `<h1>`.

---

## C29 — `/products` has no catalog landing state · `CODE` · **see §0 A3**

**Evidence.** `/products` auto-selects `CC` and renders one product's detail
under an `<h1>` of "Product Catalog" and the sub-line "Select a product to view
full specifications" — when one is already selected. The canonical `/products`
page therefore *is* the CC product page.

**The fix.** Give the bare route its own state: a grid or list of all 41/42
products with photo, SKU, name and family, and no product pre-selected. This is
the natural landing page for a "product catalog" search and removes the
duplicate-content overlap with `?productId=CC`.

If Option A is chosen in §0, this falls out naturally (`/products` is an index,
`/products/:id` is a detail). If Option B, build the empty state explicitly.

**Acceptance.** `/products` with no query string renders no "Product Detail"
panel; its `<h1>` is "Product Catalog"; its content is not byte-identical to
`?productId=CC`. Sidebar navigation from it still works.

---

# Phase C — Catalog browsing

## A6 — "View Product" is clipped on all 41 Product Index rows · `CODE`

**Evidence.** At 1440 the table is **1264 px inside a 1230 px wrapper**
(`overflow-x: auto`), so every one of the 41 action buttons overflows the
wrapper's right edge by 16 px and is visibly cut. Measured: 41/41 clipped.

**The fix.** Make the table fit its wrapper at 1440. B19 is the same root cause
and fixing the column widths will likely resolve this on its own — do B19 first,
then re-measure before adding anything. If a residue remains, the action column
is the one to shrink, not the description.

**Acceptance.** 0 of 41 buttons overflow the wrapper at 1440, 1280 and 1024.
`wrapper.scrollWidth === wrapper.clientWidth` at all three. Screenshot each.

---

## B19 — Product Index column widths are inverted · `CODE`

**Evidence.** Measured header widths at 1440: Product Name 159, **Part ID 259**,
**Part Type 258**, **Description 142**, Temp 110, Specifications 163, Action 173.
The two columns holding a short SKU and a small chip take 517 px between them;
the longest content gets 142 px and wraps to one to three words per line. Rows
are 183–223 px tall, so 41 products make a **9,595 px** page with no pagination.

**The fix.** Set explicit column widths (or a `table-layout: fixed` grid) that
match content: Part ID and Part Type need ~110 px each; Description should take
the slack. Target a row height around 90–110 px.

Consider whether 41 rows on one page is right at all once rows are half the
height — but pagination is a feature, not a fix. If you do not add it, say so
rather than half-adding it.

**Acceptance.** Row heights ≤ 120 px for all 41; page height under 6,000 px;
no description cell wraps to fewer than 5 words per line at 1440. Screenshot at
1440, 1280, 1024 and 390. The mobile card layout is unaffected.

---

## B20 — The dashboard empty state doesn't span the table · `CODE`

**Evidence.** Searching with no matches gives a good empty state (icon, the query
echoed back, a clear-filter button) but the cell stops short of the table's right
edge, leaving a grey band. `colspan` is one short.
`_harness/out/audit/flow/08-dashboard-empty.png`.

**The fix.** Derive the `colspan` from the column count rather than hardcoding
it, so adding a column cannot desync it again.

**Acceptance.** The empty-state cell's width equals the table's width, measured.
Assert it stays correct if a column is added — derive, don't hardcode.

---

## B27 — The catalog sidebar hides 10 of its 11 categories in a silent scroller · `CODE`

**Evidence.** Measured: `max-height: 720px`, `clientHeight` 718,
`scrollHeight` **3,203**. Only "Polyolefin Heat Shrink" is expanded on arrival,
so the other ten category headers sit below the inner fold with no cue that the
region scrolls.

**The fix.** Either collapse all families by default so all eleven headers fit
(and expand the one containing the selected product), or make the scroll
affordance real — a visible scrollbar, a fade, or a sticky category jump list.
Collapsing is the smaller change and gives a better first impression of catalog
breadth.

Note `openFamilies` initialises to `new Set(order.concat(["Other"]))`
(`App.jsx:6059`) and the empty-list fallback in `familyOrder()` exists precisely
because an empty order leaves every accordion **closed** — read that comment
before changing the default open state, and keep `plan6-families.js` green.

**Acceptance.** All eleven family headers reachable without scrolling an inner
region at 1440, or a visible affordance measured at ≥ 3:1 against its
background. The family containing the current `?productId=` is open on arrival.
`node _harness/plan6-families.js` green.

---

## B12 — The catalog is counted three different ways · `CODE` · **blocked on §0 C48**

**Evidence.**

| Page | Says |
|---|---|
| `/products` sidebar | "41 products" |
| `/dashboard` header | "41 of 41 products" |
| `/dashboard` approval filter, same screen | "30 of **42** products carry at least one" |
| `/datasheets` | "**42** of 42 shown" |

`VALUE-ADDED` is in `SIDEBAR_EXCLUDED` (`App.jsx:6028`); `App.jsx:2447` prints
`products.length`, which is 42. On mobile the 41 and the 42 are four lines apart.

**The fix.** One derived count, used everywhere. Once §0 answers C48, either
`VALUE-ADDED` is a product (all four say 42) or it is not (all four say 41 and it
leaves the Product Index, Datasheets and the sitemap too). A product that is
excluded from one view and counted in another is the bug regardless of which way
it goes.

**Acceptance.** The same number on `/products`, `/dashboard` (both places) and
`/datasheets`, asserted in one check that reads the rendered text rather than the
source. Whatever the answer, the sitemap agrees.

---

## C30 — All six homepage market cards link to bare `/industries` · `CODE`

**Evidence.** Measured: six cards, six `href="/industries"`. And `/industries`
has **no anchors at all** — zero `id`s in its content. Clicking "Medical
Devices" drops the visitor at the top of a 3,479 px page with Medical Devices
third of six.

**The fix.** Give each industry section a stable `id` derived from its data (not
its title text — that is owner-editable and would break the link on a rename; see
PLAN-5's 4.27 for the same trap) and link `/industries#automotive` etc. Handle
the SPA case: the fragment must scroll after the content renders, not before.

**Acceptance.** All six cards deep-link and land with the target section at the
top of the viewport, from a cold load and from an in-app navigation. Renaming an
industry in the admin does not break its link.

---

## C35 — "Datasheets" is missing from the footer · `DATA`

**Evidence.** `FOOTER_LINKS` in `App.jsx:284` has 9 entries; the saved
`content.json` `footerLinks` has 8 and omits Datasheets, so the page is reachable
only from the Products dropdown.

**The fix.** `DATA` — one row in Page Content. Do not edit `content.json`. Add to
§6. Confirm first that the admin's footer-links editor can add a row pointing at
`datasheets`; if it cannot, that is a `CODE` defect in `admin/content.php` and
belongs here.

**Acceptance.** Either §6 lists the exact admin steps, or the admin gap is fixed
and demonstrated by adding the row through the UI and seeing it on the site.

---

## C46 — Mobile product names truncate mid-word · `CODE`

**Evidence.** "Commercial Grade Polyolefin Tubi…", "UV Resistant PVC Heat Shrink
Tub…", "Thin Wall Heat Shrinkable Polyol…" — most of the catalog, in the one view
where the name is all a buyer has to go on.

**The fix.** Allow two or three lines before truncating, or truncate on a word
boundary. `-webkit-line-clamp: 2` on the name is the smallest change.

**Acceptance.** No name truncates inside a word at 390 px. Screenshot the mobile
product list.

---

## C48 — `VALUE-ADDED` is in three views and out of one · `DECISION` · **§0**

Excluded from the catalog sidebar (`SIDEBAR_EXCLUDED`), present in the Product
Index, Datasheets and the sitemap. Resolve with B12; do not resolve them
separately.

---

## C49 — Four spec tables scroll horizontally at 1440 · `CODE`

**Evidence.** `IP17TW-18SW-19LW` (435 px in a 389 px column),
`IP37SH-IP36TH-IP39LH` (396), `IP47HV` (398), `IP53MP` (403). Handled with
`overflow-x: auto`, so nothing is lost — but at desktop width a spec table should
not need it; the two-column layout is squeezing them.

**The fix.** Let a table that overflows take the full content width and drop to a
single column, the same way PLAN-5's 4.29 collapses the grid when a table is
empty. Reuse that call site rather than adding a second rule.

**Acceptance.** Those four pages have no horizontally scrolling region inside
`<main>` at 1440. The other 38 are byte-identical — screenshot-diff one to prove
it. `node _harness/plan5-spectable.js` green.

---

# Phase D — Lead capture

## B16 — The success state announces nothing and takes no focus · `CODE`

**Evidence.** After a successful submit the form is replaced by a "Quote Request
Received" panel. Measured: **zero** `aria-live`, `role="status"` or `role="alert"`
regions on the page, and `document.activeElement` is `<body>`. A screen-reader
user gets silence. The *error* path was given a proper `role="alert"` region
(PLAN-3 4.5); the success path never got the same treatment.

**The fix.** Give the success panel `role="status"`, `aria-live="polite"`,
`tabIndex={-1}`, and move focus to it on the swap — the same pattern PLAN-3 built
for the error path. Reuse that component's mechanics rather than writing a second
one.

**Acceptance.** The panel is announced (verify over the real accessibility tree,
not by reading the JSX) and holds focus after submit. Tab from it lands somewhere
sensible. `node _harness/plan3-contact.js` green.

---

## B17 — The success state has no URL of its own · `CODE`

**Evidence.** The URL stays `/contact`. Refreshing loses the confirmation and
re-renders an empty form, and there is no distinct URL to hang an analytics
conversion goal on — on a site whose purpose is lead capture.

**The fix.** Write a param on success — `/contact?sent=1` — and render the panel
from it. Use the routing shim's `{ replace: true }`; pushing traps the Back
button, which is exactly the incident PLAN-1's T2.3 note records.

Decide and state what a reload of `?sent=1` shows: re-rendering "thank you" for a
bookmarked URL is the standard answer and is fine. Do **not** re-submit anything.

**Acceptance.** Submit → URL is `?sent=1`; reload shows the panel, sends no
request; Back returns to the form without re-submitting; forward works.

---

## B18 — Three defects on the success page itself · `CODE`

**Evidence.**
- The "urgent inquiries" line renders **a tofu box** where 📧 should be:
  `📞 630.771.0700 · 📠 630.771.0701 · ▯ sales@insulationproducts.com`.
- Phone, fax and email there are **plain text, not links** — no `tel:`/`mailto:`
  at the exact moment a visitor might want to call.
- ~330 px of empty page between the buttons and the footer, and the page header
  is the only one on the site with no eyebrow above the `<h1>`.

`_harness/out/audit/flow/10-success-full.png`.

**The fix.** Replace the emoji with the inline SVG icons the contact cards
already use — emoji coverage is a font dependency and this one is already
failing. Make the phone and email real `tel:`/`mailto:` links reading from
`site-info` (fax stays plain text — invariant, PLAN-1 4.8). Add a `PageEyebrow`.
Remove the fixed min-height that produces the gap.

**Acceptance.** Zero emoji in the success panel; phone and email are links with
44 px targets; fax is not a link; eyebrow present; gap under 80 px at 1440 and
390.

---

## B22 — The form suggests a date 13 months in the past · `CODE`

**Evidence.** Required Delivery Date placeholder: `e.g. ASAP, end of month,
6/30/2025`.

**The fix.** Remove the hardcoded date. Either drop the example or compute one
relative to today. Check the rest of the form's placeholders for the same class
of rot while you are there.

**Acceptance.** No literal date in any placeholder, asserted by regex over the
rendered form so it cannot come back.

---

## B26 — On mobile the quote form sits below ~1,000 px of contact cards · `CODE`

**Evidence.** Source order puts the "Direct Contact" rail (phone, fax, email,
address) and the "For fastest response, include:" panel above the form. On
desktop they are side by side; at 390 px a visitor scrolls past four cards and a
tip panel before seeing the thing the page exists for. Page is 3,331 px tall.
`_harness/out/audit/flow/m07-contact.png`.

**The fix.** Reorder for small viewports so the form comes first — CSS `order`
on the flex/grid container, not a second copy of the markup. Keep the phone
number visible near the top; it is the other conversion path.

**Acceptance.** At 390 px the first form field is above 900 px from the top of
the document. Desktop layout unchanged — screenshot-diff at 1440 to prove it.
Tab order still matches visual order after the reorder (a CSS-only reorder
desyncs them; if it does, fix the DOM order instead and use `order` for desktop).

---

## C31 — Industry-card CTAs carry no context · `CODE`

**Evidence.** "Request a Quote →" → `/contact` and "Browse All Products" →
`/products`, identical on all six cards. The product page already proves the
pattern works: `/contact?part=IP33PO` prefills the form (PLAN-1 4.6).

**The fix.** Carry the industry: `/contact?industry=Automotive` prefilling a
field or the notes, and a catalog link scoped to that industry's parts. The
`?family=` param already exists on `/dashboard` and is the obvious target for the
second one.

**Acceptance.** Each of the six cards produces a different, working URL, and the
contact form arrives with the industry visible in it. `deadlinks.js` green — the
industry product references it guards must not be disturbed.

---

## C39 — Contact form polish · `CODE`

**Evidence.** No privacy-policy note near submit; no legend explaining `*`;
"Optional" as the phone placeholder while every other placeholder is a worked
example.

**The fix.** One line under the submit linking the Privacy Policy; a `*` legend
above the first field; a real example in the phone placeholder. All three
strings should be owner-editable `copy` keys — see §5 before adding any.

**Acceptance.** Present on both form tabs; screenshot; `copydrift.js` green.

---

## C40 — The form is `method="get"` with no `action` · `CODE`

**Evidence.** Submitted by `fetch`, so this never fires in practice — but if the
bundle fails, the browser puts the lead's name, email and message into the query
string and reloads the page.

**The fix.** `method="post" action="/contact.php"` so the no-JS path degrades to a
real submission instead of leaking PII into the URL and history.
`public/contact.php` already handles a POST; confirm it responds acceptably to a
non-`fetch` one before claiming this works.

**Acceptance.** With JS disabled, a submit reaches `contact.php` and produces a
readable response. `node _harness/plan3-contact.js` and `plan3-autoreply.js`
green — the JS path must be unchanged.

---

# Phase F — Chrome, assets, copy

## B13 — The mobile menu has no scrim, doesn't lock the page and ignores Escape · `CODE`

**Evidence.** Measured with the drawer open at 390 px: no full-screen fixed
overlay, `body { overflow: visible }`, and `window.scrollTo(0, 900)` succeeded —
the page scrolls freely behind the open drawer. `Escape` leaves it open. The
drawer occupies only the top ~340 px so the rest of the page stays interactive
underneath it.

**The fix.** A scrim that closes on click; `overflow: hidden` on `body` while
open, restored on close; `Escape` closes and returns focus to the hamburger;
focus trapped inside the drawer while it is open.

Restore the scroll position on close — locking with `overflow: hidden` alone
jumps the page to the top on some mobile browsers.

**Acceptance.** With the drawer open: a scrim covers the viewport, `body` cannot
scroll, `Escape` closes it, focus is trapped, and focus returns to the hamburger.
Scroll position is preserved across open/close. Verified with real key presses,
not programmatic focus — Chromium will not match `:focus-visible` for the latter.

---

## B21 — The Services lead-time banner repeats itself · `CODE`

**Evidence.** Renders as **"Standard Lead Time: ≤ 1 week · ≤ 1 week (JIT by
agreement)"**. The summary (`App.jsx:9134`) de-duplicates exact strings; five
services carry `"≤ 1 week"` and Kitting & Bagging carries `"≤ 1 week (JIT by
agreement)"`, so both survive and get joined.

**The fix.** Show the common lead time, and mention the exception separately —
or show the single most-common value and let the per-service cards carry their
own. Do not fix this by normalising the owner's strings; he is entitled to write
a qualifier.

**Acceptance.** The banner reads sensibly for: all six identical; five plus one
qualified (today's data); and six all different. Drive all three from a scratch
content file.

---

## B23 — The product photo has no `width`/`height` · `CODE`

**Evidence.** It is the LCP element on every product page (correctly
`loading="eager"` since PLAN-5 4.32), painted at 390×260, and ships no intrinsic
dimensions — so it reserves no space and shifts the layout on load. Every other
image on the site has them.

**The fix.** Emit `width`/`height` from the file's real dimensions, or reserve
the box with `aspect-ratio` on the container. The branded fallback panel (A7)
must reserve the same box so swapping to it does not shift anything either.

**Acceptance.** CLS contribution from the product photo is 0, measured with
PerformanceObserver on a throttled load, on a product with a real photo **and**
on one using the fallback. `node _harness/plan5-images.js` green.

---

## B11 — Missing space in the footer paragraph · `CODE`

**Evidence.** Renders as *"…industrial adhesives.**$50** minimum order."* At
`src/App.jsx:9791-9794` the text ends `adhesives.` on one line and
`{site.stats.minimumOrder}` starts the next; JSX strips the newline entirely
rather than collapsing it to a space. On every page.

**The fix.** `{" "}` or restructure the line. Then grep the file for the same
shape — a text line ending immediately before an expression on the next line —
and check each one renders with the space it needs.

**Acceptance.** Footer text renders `adhesives. $50 minimum order.` Assert on the
rendered text, not the source. Report how many other instances the sweep found.

---

## A7 — Five products fetch their photo from `placehold.co` · `BOTH`

**Evidence.** `IP12GA - IP1274`, `IP13SP`, `IP25PU`, `IP30UV`, `IP47HV` carry
`photoUrl: "https://placehold.co/400x300/…"` in `data/products-all.json`. The
branded fallback ("PRODUCT IMAGE COMING SOON" over the IPC mark) is good and does
fire — but only *after* the external request fails, so each page pays a
third-party round trip, and on any network where placehold.co resolves the
visitor gets a grey third-party tile instead of the branded panel.

**The fix.** `DATA` — clearing those five `photoUrl` values in the admin makes
the branded panel the first paint. Add to §6.

`CODE` — also make the site robust to it: treat a `placehold.co` URL as "no
photo" at render time so the fallback is used directly and no external request is
made. Belt and braces, because the same URL can be typed again.

**Acceptance.** Zero external image requests on all 42 product pages, asserted by
intercepting requests, not by reading the data. The branded panel renders for
those five. Real photos are unaffected — screenshot-diff one.

---

## C34 — Datasheet links give no cue about what they do · `CODE`

**Evidence.** All 42 are `target="_blank" rel="noopener"` with no "opens in a new
window" text, no "PDF" label and no file size.

**The fix.** Add `noreferrer`; add a visually-hidden "(opens in a new window)" to
the accessible name; label the file type; and show the size. `sitemap.php` shows
the pattern for reading from disk per request — the size can be read the same
way, or emitted at build time if that is simpler. Say which you chose.

**Acceptance.** All 42 links carry `rel="noopener noreferrer"`, an accessible
name that announces the new window (read from the real AX tree), and a size that
matches the file on disk within a rounding step.

---

## C37 — Large empty regions in the primary layouts · `CODE`

**Evidence.** The homepage hero's right column is empty below the four stat cards
(~280 px); the page-header band is empty on its right half on all nine inner
pages; the contact page's left rail ends 320 px above the form; the Industries
cards leave a gap between certification chips and CTAs.

**The fix.** None of this is broken, and this item is explicitly **not** a
licence to redesign. Tighten the obvious dead space (the header band's height,
the contact rail) and leave the rest. The real answer is photography, which is
PLAN-7's subject — cross-reference it rather than pre-empting it.

**Acceptance.** State what you changed and what you deliberately left. Screenshot
before and after at 1440 and 390. No layout regression on any other route.

---

## C38 — No `<noscript>` · `CODE`

**Evidence.** The whole site is client-rendered. With JS off, or the bundle
failing, a visitor gets a blank white page and no phone number.

**The fix.** A `<noscript>` block in `index.html` with the company name, phone,
email, address and hours. It is a static shell, so the values are hardcoded
there — note in a comment that they are a second copy of `site-info.json` and
will not follow an admin edit. That is an acceptable trade for a fallback that
only renders when everything else has failed; say so rather than leaving it for
someone to "fix".

**Acceptance.** With JS disabled the page shows the company name and a working
`tel:` link. The block is invisible with JS on, at every viewport.

---

## C41 — FAQ opens fully collapsed with no "expand all" · `CODE`

**Evidence.** 14 questions, all closed. The category chips are good jump links
(verified: they scroll to the section), but scanning for an answer means 14
clicks.

**The fix.** An "Expand all / Collapse all" control. Keep every answer's `hidden`
state correct when it toggles — PLAN-4's 4.20 put `hidden` on the panel at the
*end* of the collapse transition specifically so collapsed answers leave the
accessibility tree, and a bulk toggle must not bypass that. The `transitionend`
handler's timeout backstop matters here: expanding 14 panels at once in a
background tab must not strand any of them.

**Acceptance.** Expand all → all 14 answers in the accessibility tree and
`window.find()` finds them. Collapse all → none. `node _harness/plan4-public.js`
green.

---

## C42 — Two dated pieces of copy · `DATA`

**Evidence.** The About timeline ends at **"2024 · 50 Years — Celebrating 50
years"** (it is now 52), and the privacy policy reads **"Effective Date: January
1, 2025"**.

**The fix.** Both are owner-editable — §6, with the exact Page Content locations.
Do not edit `content.json`.

Check whether a *mechanism* is missing: PLAN-1's 4.10 stopped the privacy page
reporting today's date every day, which is correct, but nothing prompts a review.
If a "last reviewed" field is worth adding, that is a `CODE` item — propose it,
do not build it unasked.

**Acceptance.** §6 lists both. If you propose a mechanism, it is a proposal in
the handback, not a shipped change.

---

## C36 — Confirm the five social accounts are current · `DATA` · **blocked on §0**

**Evidence.** X, Facebook, LinkedIn, YouTube and Pinterest all render in the
footer (PLAN-5 4.11b) and feed JSON-LD `sameAs`. Whether each still exists and is
maintained is not knowable from the code.

**The fix.** `DATA` — §6. Any account that is dead gets its field cleared in
**Business Details**; NB4's `SITE_CLEARABLE` allow-list already covers all five,
and `plan5-social.js` already asserts that a cleared field removes its icon and
that all five cleared removes the container entirely. So the mechanism is built
and tested; this item is purely the owner's answer.

**Acceptance.** §6 lists the five URLs for confirmation. If any are cleared,
`node _harness/plan5-social.js` green and the footer screenshotted.

---

## C43 — The header logo reads as a cropped tile · `CODE`

**Evidence.** `public/logo.svg` paints an opaque `#FEFFFE` rectangle across its
full 892×904 artboard and the swoosh runs off the edge, so at 46 px on the navy
bar it looks like a clipped blue square rather than a mark. Also `alt="IPC logo"`
on an image that links to the homepage.

**The fix.** `alt` first — it should name the destination
("Insulation Products Corporation — home"), and that is a one-line, zero-risk
change. Three places: `App.jsx:405`, `6910`, `9751`.

The artwork is a brand asset, not a bug. Do not redraw it. Flag it for the owner
with the screenshot (`_harness/out/audit/logo-mob.png`) and note that a
transparent-background version or a horizontal lockup would sit properly in the
bar. `site.theme.logoUrl` is already owner-settable, so a replacement needs no
code.

**Acceptance.** `alt` corrected in all three places and read from the real AX
tree. The logo file is unchanged. §6 carries the recommendation.

---

## C44 — Empty footer strip on one Services card · `CODE`

**Evidence.** "Cut-to-Length" renders a grey footer band with nothing in it,
where "Hot-Stamp Marking" has a brochure link. It reads as a missing link.

**The fix.** Render the footer band only when the card has something to put in
it — the same shape as PLAN-5's 4.29 (an empty section renders nothing, not
chrome around nothing).

**Acceptance.** No card renders an empty footer band. A card **with** a link is
unchanged — screenshot both.

---

# Phase E — Legibility and input

Run this phase **last**. It changes colour on roughly 270 elements and adds a
focusable skip link, so it moves every screenshot baseline and every tab-order
assertion the other phases wrote.

## B8 — Product SKU labels sit at 1.64:1 · `CODE`

**Evidence.** `rgb(196,203,212)` on white, 12 px bold — the part numbers in the
catalog sidebar, 80 instances. Needs 4.5:1. The part number is the one string a
buyer scans a catalog for, and at 390 px it is nearly invisible
(`_harness/out/audit/flow/m04-product-top.png`).

## B9 — Secondary grey text sits at 2.37–2.54:1 · `CODE`

**Evidence.** `rgb(156,163,175)` (Tailwind `gray-400`) on white and `#f8fafc`,
10–12 px, ~65 instances: the four homepage stat sub-lines, every certification
line on `/datasheets` (30 of them), "Showing 41 of 41 products", "Mon–Fri,
8am–5pm CT", "Typical reply: same day", the sidebar family headings.

## B10 — Footer text fails contrast · `CODE`

**Evidence.** Quick Links and the description: `rgba(255,255,255,0.45)` on
`#0a2240` → **4.25:1** at 12 px, 99 instances. Copyright and domain:
`rgba(255,255,255,0.3)` → **2.64:1**, 22 instances.

### The fix for B8, B9 and B10 together

They are one problem: the earlier brand-colour work
(`brandtext.js`, `plan5c-brandink.js`) measured only **brand-coloured** text, so
the neutral greys and the white-alpha values in the footer were never in scope.
Fix them as one pass with one set of tokens.

- Replace `gray-400` in *text* roles with a value that measures ≥ 4.5:1 on both
  white and `#f8fafc`. `gray-500` (`#6B7280`) is the obvious candidate — but
  **measure it, do not take that on trust** (§1.4).
- The SKU label needs the same treatment; it is smaller and bold, so check it
  separately.
- For the footer, prefer a solid token over white-alpha. Alpha over a fixed navy
  is just a colour with extra steps, and the alpha values are what made these
  fail quietly. If alpha is kept, raise it until the measurement passes with
  margin.
- Leave `gray-400` alone where it is used as a **border or icon** rather than
  text; those are governed by 3:1, not 4.5:1.

Add the neutral sweep to the standing regression so it cannot rot: extend
`_harness/audit-a11y.js` into a `plan8-contrast.js` that fails on any text
element below its threshold, and wire it into the baseline.

### Acceptance

- 0 text elements below threshold across all 10 routes plus 3 product pages, at
  1440 and 390, measured with composited backgrounds.
- `node _harness/brandtext.js`, `plan5c-eyebrow.js` and `plan5c-brandink.js` at
  least as green as you found them — this pass must not undo the brand-ink work.
- `node _harness/plan2-contrast.js` green across all four brand palettes: the
  owner can change the brand colours and these neutrals must hold for all of them.
- Before/after screenshots of the sidebar, the footer and `/datasheets`.

---

## B14 — `prefers-reduced-motion: reduce` is not honoured · `CODE`

**Evidence.** `src/index.css:85` has a reduced-motion block but it only disables
`.ipc-skeleton`. The homepage trust marquee
(`.ipc-marquee-track`, `animation: ipc-marquee 32s linear infinite`,
`App.jsx:4854`) keeps scrolling under `reduce`. Measured under an emulated
reduce preference: 1 infinite animation still running.

**The fix.** Extend the block to cover the marquee — and note the catch: the
track is **duplicated 2×** so `translateX(-50%)` loops seamlessly. Setting
`animation: none` alone leaves a visible doubled list. Under `reduce` the second
copy must also be suppressed and the strip allowed to wrap or scroll manually.

Audit for other infinite animations while you are in there; assert zero, do not
assume one.

**Acceptance.** Under an emulated `prefers-reduced-motion: reduce`, zero infinite
animations anywhere on any route. The trust content is still fully readable —
screenshot it. With motion allowed, the marquee is unchanged.

---

## B15 — No skip link · `CODE`

**Evidence.** Tab order on every page starts at the logo and walks the entire
header before reaching content. `document.querySelector('a[href^="#"]')` returns
null site-wide. WCAG 2.4.1 Bypass Blocks, Level A.

**The fix.** A skip link as the first focusable element, visible on focus,
targeting the `<main>` (`App.jsx:10254`), which needs an `id` and `tabIndex={-1}`
so focus actually lands there rather than only scrolling.

**Acceptance.** First Tab on all 10 routes reveals it; activating it moves focus
into `<main>`, verified by reading `document.activeElement` after a real
`Enter`. It is invisible until focused. Its focus indicator measures ≥ 3:1
against the navbar.

---

## B24 — Touch targets under 44 px on mobile · `CODE`

**Evidence.**

| Control | Size |
|---|---|
| Product "Download PDF" | 140×**28** |
| Product "Request Quote" | 125×**28** |
| Inline `tel:` / `mailto:` links (contact, about, datasheets, privacy, faq) | ×**14–19** |
| Dashboard approval chips | ×**25** |
| FAQ category chips | ×**30** |
| Footer social icons, hero CTAs | 40×40 |

The two 28 px ones are the primary actions on the most important page.

**The fix.** 44×44 minimum on a coarse pointer for the product CTAs and the
`tel:`/`mailto:` links first — those are conversion paths. Chips and the 40 px
items are above the WCAG 2.5.8 floor of 24 px; raise them if it costs nothing,
and say so if it does not. Use padding rather than font size so the visual design
holds. PLAN-2's 4.13 established the `@media (pointer: coarse)` pattern here —
reuse it.

**Acceptance.** Zero interactive elements below 44×44 at 390 px on the contact,
product and about routes; nothing below 24×24 anywhere. Desktop layout unchanged
— screenshot-diff at 1440.

---

## B28 — `/services` skips a heading level · `CODE`

**Evidence.** `h1` → `h3`, no `h2`. Every other page is well-formed.

**The fix.** Promote the service card headings to `h2`, or add the section `h2`
they were written under. Do not change their visual size to match — that is what
CSS is for.

**Acceptance.** No skipped level on any of the 10 routes. Screenshot `/services`
to prove the visual design is unchanged.

---

## C50 — The trust marquee is a focusable div with no name · `CODE`

**Evidence.** `<div className="ipc-marquee-track" tabIndex={0}>`
(`App.jsx:1638`), 5,012 px wide, no `role`, no `aria-label`. It is a tab stop
that announces the whole certification strip as one unlabelled blob.

**The fix.** The `tabIndex` exists so a keyboard user can pause the animation
(`:focus-within` pauses it, `App.jsx:4856`) and scroll it. Keep the capability
and give it a name and a role: `role="group"` with an `aria-label` naming what it
is. If B14 removes the animation under `reduce`, the tab stop is pointless in
that mode — drop it there.

**Acceptance.** The element has an accessible name read from the real AX tree.
Focusing it still pauses the animation. Under `reduce` it is not a tab stop.

---

# 3. Definition of done for the whole plan

A phase is done when every item in it has an artifact, not a description.
The plan is done when:

- Every ID in `UI_UX_AUDIT_2026-08-08.md` is either **shipped**, **deferred with
  a reason**, or **an owner action in §6**. None may be silently dropped.
- `node _harness/invariants.js` — 15/15, and `invariants-selftest.js` still
  proves it can fail.
- `php _harness/lint.php` green, including the copy-key drift check.
- Every suite named in §1.2 at least as green as you found it, with the
  before/after table in the handback (GUARDRAILS §8.5).
- `npm run build` clean, and the bundle size delta stated.
- `sh _harness/sync.sh` run after the final build.
- `data/products-all.json`, `data/content.json` and `data/site-info.json`
  byte-identical to `_harness/pristine/` — `cmp` all three and paste the output.

---

# 4. New harness suites this plan should leave behind

Each is the executable form of an acceptance criterion above. Without them these
defects come back and nothing catches them.

| Suite | Covers |
|---|---|
| `plan8-certs.js` | A1, C32 — no page prints two UL categories; every badge appears in exactly one block |
| `plan8-meta.js` | A3, A5, A4, B25 — 42 distinct titles/descriptions/og:titles, `noindex` on unknown routes and nowhere else, `og:image` absolute on every route |
| `plan8-contrast.js` | B8, B9, B10 — the neutral sweep `brandtext.js` never covered, across four brand palettes |
| `plan8-motion.js` | B14, C50 — zero infinite animations under `reduce`; the marquee is named |
| `plan8-mobile.js` | B13, B24, B26 — drawer scrim/lock/Escape/focus-trap, 44 px targets, form-first ordering |
| `plan8-counts.js` | B12 — one catalog count across four surfaces, read from rendered text |

Every one must be **proved able to fail**: break the thing it guards, watch it go
red, restore. `invariants-selftest.js` is the pattern. A check that cannot fail
is not a check.

---

# 5. Before adding any owner-editable string

Three items propose new `copy` keys (C39, and possibly A2 and B21). The content
contract has two sides and a hard limit:

1. A key added to `admin/content.php`'s `$COPY_GROUPS` **must** have a matching
   default in `App.jsx`'s `COPY_DEFAULTS`. `mergeContent` iterates
   `Object.keys(defaults)`, so a PHP-only key is a silent data-loss path with a
   green success banner on it. `_harness/copydrift.js` fails on drift — run it.
2. Every new field moves `content.php`'s posted-variable count, which is
   enforced positionally by the `form_complete` sentinel. The count is currently
   **435**. Follow PLAN-6 §0: update the asserted count in the same commit and
   re-run `node _harness/plan2-trunc.js` against a real `max_input_vars=100`
   server.
3. New fields go **above** `form_complete`. Never after it. (GUARDRAILS §2.)

---

# 6. Owner action list — build this as you go

Several defects live in `data/*.json`, which this plan may not touch
(GUARDRAILS §2, §1.1). Maintain a running list and hand it back as a section
Rick can work through in the admin without a developer. For each: **the exact
admin page, the exact field, the current value, the value it should be, and
why.**

Known members at the time of writing — confirm each is still needed, and add any
the work uncovers:

| ID | Admin page | What to change |
|---|---|---|
| A2 | Page Content | Three "ISO 9001:2008" strings → the confirmed revision |
| A7 | Products → Edit, ×5 | Clear `photoUrl` on `IP12GA - IP1274`, `IP13SP`, `IP25PU`, `IP30UV`, `IP47HV` |
| C35 | Page Content → Footer Links | Add the "Datasheets" row |
| C42 | Page Content | About timeline "2024 · 50 Years"; privacy "Effective Date: January 1, 2025" |
| C36 | Business Details | Confirm or clear the five social URLs (§0) |
| C43 | Branding | Optional: a transparent-background or horizontal logo |

If any of these **cannot** be done in the admin, that is a `CODE` defect in the
admin and it belongs in this plan — say which.

---

# 7. Records — including the patch notes

Three documents must be updated. This is not optional and it is not the last ten
minutes of the work: write each entry as its item lands, while the measurement is
still in front of you.

### 7.1 `PATCH_NOTES.md` — **append, never overwrite**

`PATCH_NOTES.md` already exists and is the record of the **2026-07-08 →
2026-08-07** release: 191 files, 12 merged PRs. Overwriting it destroys that
record. Add a **new dated section** below the existing one:

```markdown
## 2026-08-XX — UI/UX audit remediation (PLAN-8)

Source: UI_UX_AUDIT_2026-08-08.md. 50 items — N shipped, N deferred,
N handed to the owner.
```

Match the existing file's voice, which is the reason this document is worth
reading at all: **each entry names the defect first, in terms of what it did to a
real person, then what fixed it.** "Change Password was 0% functional. `preg_replace`
read the `$2y$12$` in every bcrypt hash as backreferences and wrote `y$…` to
disk. Now `preg_replace_callback`…" — that is the register. Not "improved
contrast"; rather "product part numbers were painted at 1.64:1 against white, so
the one string a buyer scans a catalog for was nearly invisible on a phone."

Group under the existing headings where they fit (**Public site — correctness**,
**Owner-editable data reaching the site**) and add new ones where they do not —
**Certification accuracy**, **Indexing and sharing**, **Legibility** are the
obvious three.

Rules for the section:

- Every item carries its audit ID in parentheses so it can be traced back.
- Every claim carries the number that was measured — "18 of 42", "1.64:1",
  "9,595 px", "41 of 41 clipped". A patch note without a measurement is a
  changelog entry, and the value of this file is that it is not one.
- Deferred items get a line saying they were deferred and why. A next agent
  reading only this file must not conclude a live defect was fixed.
- Owner actions (§6) get their own short list at the end, marked clearly as
  **not yet applied to the live site** — the existing file's "**Not yet
  deployed.**" note is the precedent.

### 7.2 `WHATS_LEFT.md` — append-only

GUARDRAILS §6. Shipped items to §1b, newly-discovered open items to §2, evidence
in a new §4-series block. Supersede, do not rewrite; mark corrections
`SUPERSEDED-BY` with the date.

### 7.3 `plans/GUARDRAILS.md` §4.1 and `plans/README.md`

Correct the stale baseline (§1.2 — eleven of thirteen scripts do not exist) and
add PLAN-8 to the README's execution table. A binding document that names missing
scripts is worse than no baseline, because it produces a green report from a
suite that never ran.

---

# 8. Handback

GUARDRAILS §8, plus one addition specific to this plan: a table of all 50 IDs
with their outcome — **shipped / deferred / owner action** — so the next agent
can see at a glance what is left without re-reading the audit.

State plainly what you did not do. Scaling the work down is the owner's call, not
the executor's.
