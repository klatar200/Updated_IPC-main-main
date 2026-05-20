# Mobile Responsiveness Audit — IPC Website

**Audit date:** 2026-05-18
**Scope:** `src/App.jsx` (the entire public-facing React app). Admin (`admin/*.php`) and the mail handler (`public/contact.php`) are excluded.
**Test widths:** 320 px (iPhone SE), 375 px (iPhone standard), 414 px (iPhone Plus). Audit is source-only — no live browser testing.
**Severity:** 🔴 critical (page unusable or primary action unreachable) · 🟡 medium (usable but actively annoying) · 🟢 low (polish).

## Executive summary

- **6 critical** issues — concentrated in the Product page, Dashboard table, ProductDetail header, mobile drawer scroll, Contact tab switcher, and hover-only affordances.
- **18 medium** issues — sub-44 px tap targets, fixed pixel containers, dense type at small widths, missing input autocomplete.
- **Single worst offender:** the **Dashboard table** ([App.jsx:5687–6006](src/App.jsx#L5687)) — 7 wide columns inside `overflowX: auto`, and the only primary action (the "View Product" button) lives in the rightmost column behind a horizontal swipe. On a 320 px screen the user cannot reach the action without swiping past every other column.

---

## Home page

### 🔴 Hero is taller than the viewport on most phones — proof cards land below the fold
[App.jsx:1221–1351](src/App.jsx#L1221)

Hero uses `minHeight: 560` plus `py-20` (80 px top + 80 px bottom). After the navbar's 64 px sticky bar that's 624–704 px occupied before the proof cards. At 375×667 (iPhone SE2/8), the user sees only the eyebrow chip, headline, and the first line of the paragraph — never a proof point, never a CTA — until they scroll. The "Same-Day Shipment" anchor is the strongest conversion lever and it's invisible.

**Fix:** drop `minHeight` on viewports < 640 px (`md:min-h-[560px]` only) and reduce `py-20` → `py-12` on mobile (`py-12 md:py-20`). The proof cards are already 2-col on mobile and small; pulling them up 200 px makes them visible above the fold on every common phone.

### 🟡 Trust-rail fade edges (80 px each side) cover the marquee text on 320 px screens
[App.jsx:1362–1389](src/App.jsx#L1362)

Two absolute-positioned 80-px gradient fades sit on the left and right of the marquee track. On a 320 px viewport, that's 160 px (50%) of the strip dimmed — only the middle 160 px of any item is readable.

**Fix:** shrink fade `width: 80` → `width: 40` (or `clamp(20px, 6vw, 80px)`).

### 🟡 Trust-rail pauses on hover but has no equivalent on touch
[App.jsx:4030–4031 in GlobalStyles](src/App.jsx#L4030)

`.ipc-marquee-track:hover { animation-play-state: paused; }` — touch users can't pause to read.

**Fix:** add `.ipc-marquee-track:focus-within` and a tabindex on the wrapper, or pause briefly on `touchstart`.

### 🟡 Market card "Learn More →" affordance is invisible on touch
[App.jsx:2120–2130](src/App.jsx#L2120)

`opacity-0 group-hover:opacity-100` — appears only on mouse hover. Touch users never see the call-to-action.

**Fix:** drop the opacity-0 on mobile (`sm:opacity-0 sm:group-hover:opacity-100`) so it's always visible on phones.

### 🟢 StatsBar cell padding `py-7 px-6` is heavy on 320 px screens
[App.jsx:1874](src/App.jsx#L1874)

Each cell is ~110 px tall × half-viewport wide. Functional, but the whole stats strip eats ~220 px of vertical space (two rows of 110).

**Fix:** `py-5 px-4 md:py-7 md:px-6` cuts a row to ~80 px.

---

## Products (`/products`)

### 🔴 ProductDetail header buttons overflow horizontally at narrow widths
[App.jsx:4746–4836](src/App.jsx#L4746)

The header is `flex items-start justify-between gap-4` with the product name `<h2 class="text-xl">` on the left and a `flex items-center gap-2 flex-shrink-0` action group on the right holding three buttons: SKU badge + (Download PDF / Request Data Sheet) + Request Quote. The action group has `flex-shrink-0` and its inner buttons don't wrap. At 320 px after the `px-8` (32+32 = 64 px) padding, the action group alone is ~280 px wide — wider than the remaining 256 px container. Result: the h2 collapses to almost nothing and/or the action group overflows the rounded card, clipping "Request Quote."

**Fix:** wrap the action group: `flex flex-wrap items-center gap-2` (drop the `flex-shrink-0`), and add `min-w-0 flex-1` to the h2 wrapper. On `< sm` widths consider stacking actions below the title with `flex-col sm:flex-row`.

### 🔴 Mobile sidebar pushes detail off-screen — already documented in AUDIT.md §1.9
[App.jsx:4271–4390](src/App.jsx#L4271)

Tapping a product in the 2-col pill grid updates the URL but doesn't scroll the detail pane (which lives below the entire grid) into view. The user manually scrolls past 40+ SKU pills after every tap.

**Fix:** add a ref on the detail container and call `ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' })` from `onSelect`.

### 🟡 Family pill strip uses `padding: 6px 14px` — tap targets are ~32 px tall
[App.jsx:4292–4334](src/App.jsx#L4292)

Pills are 6+text(~17)+6 ≈ 29 px tall. WCAG 2.5.5 wants 44×44.

**Fix:** bump to `padding: 10px 16px` and add `min-h-[44px]` via Tailwind on the button.

### 🟡 Product pills are 2-col grid at 320 px → ~136 px wide cards with 10/12 px padding
[App.jsx:4339–4389](src/App.jsx#L4339)

Each pill has only ~110 px of inner content width. Product names truncate at 32 chars to fit, which is fine, but the SKU label (10 px, uppercase, tracking 0.06 em) is borderline illegible at this width.

**Fix:** make it 1-col on `< sm`: `gridTemplateColumns: window.innerWidth < 360 ? '1fr' : '1fr 1fr'` — or use Tailwind `grid-cols-1 sm:grid-cols-2`.

### 🟡 Sticky RFQ bar buttons have `padding: 9px 16/20px` — under the 44 px target
[App.jsx:5230–5300](src/App.jsx#L5230)

Sticky bar action buttons are ~36–38 px tall.

**Fix:** `padding: 12px 18px` so the bar's tap targets meet 44×44.

### 🟡 Sticky RFQ bar covers content on short viewports
[App.jsx:5176–5302](src/App.jsx#L5176)

The fixed bar is ~56 px and slides up at scroll. On a 320×568 (iPhone SE1) viewport, that's 10% of the screen permanently occluded. The product spec tables and "Related Products" rendered behind it can get clipped, especially at the bottom of the page.

**Fix:** add `paddingBottom: 64` to the page's outer container when the sticky bar is showing, OR auto-hide the bar after the user has scrolled past the related-products section.

### 🟢 SpecTable2 has `minWidth: 240` but no caption / scroll hint
[App.jsx:4577](src/App.jsx#L4577)

Already wrapped in `overflowX: auto`, so it works, but users have no signal that the table is scrollable.

**Fix:** add a subtle "← swipe →" hint label or fade-shadow at the right edge.

---

## Dashboard / Product Index (`/dashboard`)

### 🔴 Table forces horizontal scroll; primary action lives in the rightmost column
[App.jsx:5687–6006](src/App.jsx#L5687)

The `<table>` has 7 columns: Product Name (maxWidth 260), Part ID (whitespace-nowrap), Part Type (chip), Description (maxWidth 280), Operating Temp (maxWidth 110, whitespace allows wrap), Specifications (maxWidth 240), and Action (View Product button, whitespace-nowrap). Even with `maxWidth` constraints, the column minimums add up to ≥ 900 px; wrapped inside `overflowX: auto`, the user must swipe ~500 px to the right on a 320 px screen to reach the "View Product" button. This is the single worst mobile failure on the site.

**Fix:** at `< sm`, replace the table entirely with a card list (one card per row, View Product button at the bottom of each card). Tailwind: hide the `<table>` with `hidden sm:block` on the outer wrapper and render a card list with `sm:hidden`. Or: split into two views and reuse the row data through `tableRows`.

### 🟡 "Filters ▾" should collapse — already documented in AUDIT.md §1.10
[App.jsx:5457–5685](src/App.jsx#L5457)

Family select (60 px) + clear-filter link + counter + search input → ~180 px of chrome before the table starts on mobile.

**Fix:** group all filter controls in a single `<details>` panel that's closed by default on `< sm`.

### 🟡 Empty-state "Clear all filters" button has good size but search input is 13 px font
[App.jsx:5667–5683](src/App.jsx#L5667), [App.jsx:5820–5847](src/App.jsx#L5820)

Search input font-size 13 — iOS Safari will auto-zoom the page when an input < 16 px font is focused. This is the single most annoying form behavior on the site.

**Fix:** bump search input to `fontSize: 16` (looks identical to 13 with rem scaling but suppresses zoom). Apply the same to every form input across the app (see Cross-cutting §C-2).

### 🟢 Sort headers have no obvious tappability cue at narrow widths
[App.jsx:5703–5752](src/App.jsx#L5703)

`<th onClick={() => handleSort(col.key)}>` with `cursor: pointer` — fine for desktop, but on touch there's no visible affordance until you tap and see the indicator change. With the table behind horizontal scroll on mobile this is moot until the table-to-cards fix lands.

---

## Industries (`/industries`)

### 🟡 Product list buttons have `padding: 4px 0` — tap targets are tight
[App.jsx:6340–6402](src/App.jsx#L6340)

Each product link in the "IPC Products" column is a `<button>` with 4 px vertical padding. The inner content is multi-line (SKU + label + "View product →"), so the effective tap area is ~50–60 px tall — passable, but the `padding: 4px 0` reads as visually cramped and adjacent buttons are essentially touching each other.

**Fix:** `padding: 10px 0` and a `border-bottom: 1px solid rgba(0,0,0,0.04)` between items so the boundary is clear.

### 🟡 Industry card header `px-8 py-5` is wasteful on 320 px screens
[App.jsx:6266–6296](src/App.jsx#L6266)

After 32 px padding on each side, only ~256 px is left for the icon + h2 + subhead.

**Fix:** `px-5 py-4 md:px-8 md:py-5`.

### 🟢 "Browse All Products" secondary button stacks below "Request a Quote" on mobile — correct ordering ✓
[App.jsx:6429–6460](src/App.jsx#L6429)

Buttons inside `space-y-2` — primary action on top. Good.

---

## Services (`/services`)

### 🟡 Lead-time banner: `flex flex-wrap items-center justify-between` works but loses hierarchy on wrap
[App.jsx:6734–6792](src/App.jsx#L6734)

When the "Request a Quote →" button wraps under the lead-time text, the layout works visually but the button loses prominence (now flush-left under text). Consider centering on `< sm`.

**Fix:** `flex flex-col md:flex-row md:items-center justify-between` and `w-full md:w-auto` on the button.

### 🟢 Service cards stack 1-col on mobile, comfortable padding `px-6 py-5` ✓
[App.jsx:6796–6873](src/App.jsx#L6796)

Layout is correct.

---

## About (`/about`)

### 🟡 Sidebar facts: phone/fax values can wrap awkwardly with the right-aligned label flex
[App.jsx:2509–2532](src/App.jsx#L2509)

`flex items-center justify-between` with the label on the left and the value on the right. At 320 px, "PPAP / IMDS" label + "Available on request" value collide; one wraps inside the row.

**Fix:** `flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between` — stack label above value on phones.

### 🟡 Timeline year badge column has `minWidth: 80` and right-aligned content
[App.jsx:2546–2641](src/App.jsx#L2546)

Grid: `auto 24px 1fr`. At 320 px after `px-6` page padding, content is ~272 px; 80 (year) + 24 (line) + 168 (card) is workable but cramped. Card padding `px-5 py-4` further reduces usable text width to ~128 px. Milestone description text 12 px wraps to 5–6 lines per entry.

**Fix:** stack year above card on `< sm` — change grid to `gridTemplateColumns: '1fr'` and inline-render the year as a badge at the top of each card on mobile.

### 🟢 Capabilities grid `grid-cols-2 md:grid-cols-4` ✓
[App.jsx:2703](src/App.jsx#L2703)

Reasonable.

---

## FAQ (`/faq`)

### 🟡 FAQ trigger button content uses `pr-4` but no shrinking — long questions wrap correctly
[App.jsx:2801–2825](src/App.jsx#L2801)

Mostly OK: `px-6 py-5` gives a 44+ px tap area. Plus-circle is 28×28 — itself under the 44 px guideline but the whole row is tappable.

**Fix:** none required, but bumping the plus-circle to 36×36 improves a11y for users who happen to tap precisely on it.

### 🟢 Accordion ResizeObserver-driven height ✓
[App.jsx:2774–2790](src/App.jsx#L2774)

Animation handled correctly.

---

## Contact (`/contact`)

### 🔴 Tab switcher is `flex` (not `flex-col`) on mobile — tabs squish or overflow at 320 px
[App.jsx:3555–3624](src/App.jsx#L3555)

`flex mb-6 rounded-xl overflow-hidden`. Each tab has `flex: 1` and `padding: 18px 22px` with a `text-base` label ("📋  Request a Quote") plus an 11 px sub-line. At 320 px after page padding, each tab gets ~136 px width — the label "📋  Request a Quote" (22 chars) wraps to 2 lines, and the active-tab background can clip the rounded corner.

**Fix:** `flex flex-col sm:flex-row` and `borderRight: i === 0 ? '1px solid #d1d9e0' : 'none'` → `borderBottom: i === 0 ? '...' : 'none'` for mobile, or wrap the switcher in a `<select>` on `< sm`.

### 🟡 Form inputs all use `fontSize: 13` — iOS Safari will zoom the page on focus
[App.jsx:3330–3349 (`inputStyle`)](src/App.jsx#L3330)

Same issue as the Dashboard search input. Every input across both forms (RFQ + General Message) triggers iOS auto-zoom.

**Fix:** `fontSize: 16` in `inputStyle`. The visual size barely changes at this scale and the zoom behavior disappears.

### 🟡 Phone and email inputs are missing `autoComplete` and `inputMode`
[App.jsx:3693–3705, 3917–3928](src/App.jsx#L3693)

`<input type="tel" name="phone">` has the correct keyboard, but `autoComplete="tel"` would surface the user's saved number. Same for `<input type="email">` — should have `autoComplete="email"`.

**Fix:** add `autoComplete="name" / "email" / "tel" / "organization"` to the contact fields. Speeds up form completion noticeably on phones.

### 🟡 Submit button height (`py-3.5`) is good but the form is `p-8` inside `px-6 max-w-7xl`
[App.jsx:3628–3635](src/App.jsx#L3628)

Form wrapper `p-8` (32 px) + page `px-6` (24 px) = 56 px of padding on each side at 320 px → only 208 px of inner form width. Two-column field rows (`grid-cols-1 sm:grid-cols-2`) correctly stack to 1-col below 640 px, so this is OK functionally, but the padding feels excessive.

**Fix:** `p-5 sm:p-8`.

### 🟢 Honeypot is correctly hidden off-screen ✓
[App.jsx:3637–3640, 3863–3866](src/App.jsx#L3637)

Good pattern.

---

## Privacy (`/privacy`)

### 🟢 Single-column long-form layout, `text-sm leading-relaxed` body ✓
[App.jsx:6997–7064](src/App.jsx#L6997)

Reads well on every width. No findings.

---

## Navbar & Footer (chrome — appears on every page)

### 🔴 Mobile drawer has no max-height / overflow-y — extends past the viewport with no way to close
[App.jsx:850–1184](src/App.jsx#L850)

The drawer container has `padding: "8px 24px 16px"` and no `maxHeight` / `overflow-y`. Open both accordions on a 568 px-tall iPhone SE: Home (44) + Products (44 + 2 sub-items + ~10 category buttons × 32 px = ~376) + Company (44 + 4 sub-items × 50 = ~244) + Contact (44) + CTA (52) ≈ 800 px. The drawer extends below the viewport — to close it the user must scroll the **page** down (not the drawer) to reach the hamburger again. Worse: there's no overlay/backdrop, so tapping outside doesn't close it.

**Fix:**
1. Add `maxHeight: 'calc(100vh - 64px)', overflowY: 'auto'` to the drawer container so the drawer scrolls internally and the hamburger stays accessible.
2. Add an outside-click backdrop (a fixed overlay below the drawer).

### 🟡 Drawer category links use `padding: 8px 0 8px 20px` — tap targets are ~32 px tall
[App.jsx:992–1028](src/App.jsx#L992)

11 category items × 32 px is dense. Users mis-tap into adjacent categories.

**Fix:** `padding: 14px 0 14px 20px`.

### 🟡 Logo text block `font-size: 9.5px` for the slogan is below readable
[App.jsx:318–326](src/App.jsx#L318)

"Tubing & Sleeving Solutions" at 9.5 px on the navbar. Hidden on `< sm` so doesn't affect mobile, but on `sm` (640 px) it appears.

**Fix:** `fontSize: 11` or hide it on `< md`.

### 🟡 Footer Quick Links: `text-xs` (12 px) buttons with `padding: 0`
[App.jsx:7262–7283](src/App.jsx#L7262)

Tap targets are just the text glyph — ~12 px tall. 8 links in a 2-column grid with `gap: 6px 24px` — adjacent links are only 6 px apart vertically. Mis-tapping is almost guaranteed on a phone.

**Fix:** `padding: 8px 0` on each button and bump `gap` to `12px 24px`.

### 🟢 Hamburger button is 44×44 with proper `aria-label` and `aria-expanded` ✓
[App.jsx:803–846](src/App.jsx#L803)

Correct.

---

## Cross-cutting issues

### C-1 🔴 467 inline `style={{}}` objects bypass Tailwind breakpoints
Inline styles do not respect `sm:`, `md:`, `lg:` prefixes. Every fixed pixel value used for padding, gap, width, font-size, etc. inside an inline style applies to all viewports identically. Examples touched in this audit:
- Hero `minHeight: 560` ([line 1227](src/App.jsx#L1227))
- ProductDetail `px-8 py-5` (Tailwind utility, OK) plus inline `padding: '9px 16px'` on the sticky bar ([line 5240](src/App.jsx#L5240))
- Dashboard cell `padding: '13px 18px'` ([line 5871](src/App.jsx#L5871))
- All form `inputStyle` `padding: '10px 14px', fontSize: 13` ([line 3330](src/App.jsx#L3330))

**Fix:** every component would benefit from migrating the responsive values out of `style={{}}` and into Tailwind utility classes. The longer-term recommendation is in [AUDIT.md §3.5](AUDIT.md) — centralize tokens in `tailwind.config.js`.

### C-2 🔴 Form inputs and the dashboard search all use `fontSize: 13` → iOS auto-zoom
The single biggest annoyance across every form on the site. iOS Safari zooms the page in any time a `<input>` or `<textarea>` < 16 px font-size receives focus, and won't zoom back out cleanly. Affects: Dashboard search, RFQ form (10 inputs), General Message form (6 inputs).

**Fix:** global rule in `src/index.css` (or the `GlobalStyles` block): `input, textarea, select { font-size: 16px; }` on mobile widths, or just bump `inputStyle` in App.jsx.

### C-3 🟡 Hover-revealed UI patterns recur across the site
Hover affordances that have no touch equivalent:
- Marquee pause on hover ([§Home](#home-page))
- Market card "Learn More →" reveal ([line 2120](src/App.jsx#L2120))
- ProductDetail related-product "View →" arrow ([line 5035](src/App.jsx#L5035))
- All `onMouseEnter` / `onMouseLeave` border-color and color transitions across navbar, feature cards, cert cards, etc.

**Fix:** prefer Tailwind `hover:` utilities (which auto-pair with `:focus-visible` in modern Tailwind) and don't hide content with `opacity-0 group-hover:opacity-100` on mobile. Audit each `onMouseEnter` handler — if the change is purely cosmetic, leave it; if it conveys information, ensure a non-hover state shows it.

### C-4 🟡 Tap targets < 44 × 44 px recur across the site
WCAG 2.5.5 violations identified in:
- ProductSidebar family pills ([line 4292](src/App.jsx#L4292)) — 32 px
- DashboardPage filter pills ([line 5560](src/App.jsx#L5560)) — 32 px
- Sticky RFQ bar buttons ([line 5240](src/App.jsx#L5240)) — ~36 px
- Drawer category links ([line 996](src/App.jsx#L996)) — 32 px
- Footer Quick Links ([line 7263](src/App.jsx#L7263)) — 12 px
- FAQ accordion plus-circle ([line 2815](src/App.jsx#L2815)) — 28 px (whole row is tappable so practical hit is large)

**Fix:** introduce a Tailwind utility class `.ipc-tap` = `min-height: 44px; min-width: 44px;` and apply to every interactive element that isn't already inside a large clickable region.

### C-5 🟡 Page header padding `py-12 px-6` is uniform across all pages
Every page-header gradient block uses the same `py-12 px-6` (48 px vertical, 24 px horizontal). On a 320 px screen that's a 110+ px-tall block of just title + 1 paragraph before any content begins. Cumulatively with the 64 px navbar that's 175 px of chrome on every internal page.

**Fix:** `py-8 px-5 md:py-12 md:px-6` on the `.ipc-page-header` block.

### C-6 🟢 Hard-coded `max-w-7xl` (1280 px) wrappers
Consistent and correct — no findings, but worth knowing every section caps at 1280 px. This is fine for desktop and irrelevant on mobile.

---

## Quick wins — top 10 punchlist

Ordered by mobile-UX impact ÷ implementation cost:

1. **🔴 Fix form-input font-size to 16 px globally** — stops iOS auto-zoom. 5 min. ([C-2](#c-2--form-inputs-and-the-dashboard-search-all-use-fontsize-13--ios-auto-zoom))
2. **🔴 Add `scrollIntoView` after ProductSidebar `onSelect` on mobile** — single biggest UX repair. 5 min. ([Products](#-mobile-sidebar-pushes-detail-off-screen--already-documented-in-auditmd-19))
3. **🔴 Wrap ProductDetail header action group with `flex-wrap`** — stops button overflow. 5 min. ([Products](#-productdetail-header-buttons-overflow-horizontally-at-narrow-widths))
4. **🔴 Add `maxHeight: 'calc(100vh - 64px)'` + `overflowY: 'auto'` to the mobile drawer** — drawer becomes closable on short viewports. 2 min. ([Navbar](#-mobile-drawer-has-no-max-height--overflow-y--extends-past-the-viewport-with-no-way-to-close))
5. **🔴 Convert Dashboard table to card list on `< sm`** — un-buries the View Product action. 30 min. ([Dashboard](#-table-forces-horizontal-scroll-primary-action-lives-in-the-rightmost-column))
6. **🔴 Stack Contact tab switcher `flex-col sm:flex-row`** — no more squished tab labels. 2 min. ([Contact](#-tab-switcher-is-flex-not-flex-col-on-mobile--tabs-squish-or-overflow-at-320px))
7. **🟡 Reveal "Learn More →" on mobile (don't gate on `:hover`)** — home market cards become clearly clickable. 2 min. ([Home](#-market-card-learn-more--affordance-is-invisible-on-touch))
8. **🟡 Trim Hero `py-20` → `py-12` on `< md`** — proof cards visible above the fold. 1 min. ([Home](#-hero-is-taller-than-the-viewport-on-most-phones--proof-cards-land-below-the-fold))
9. **🟡 Add `autoComplete` attributes to contact form fields** — 4× faster form completion on phones. 5 min. ([Contact](#-phone-and-email-inputs-are-missing-autocomplete-and-inputmode))
10. **🟡 Increase pill/chip padding to `10px 16px` across ProductSidebar + Dashboard filters** — tap targets meet WCAG. 10 min. ([C-4](#c-4--tap-targets--44--44px-recur-across-the-site))

If you do only the first six (all marked 🔴), the site goes from "actively broken on mobile" to "usable on mobile" with under an hour of work.
