# IPC Website — Implementation Plan

Consolidated phased plan covering every recommendation from [AUDIT.md](AUDIT.md) and [MOBILE_AUDIT.md](MOBILE_AUDIT.md).

**Plan date:** 2026-05-18
**Phases:** 6 sprints, sized roughly 1–2 weeks each at typical part-time pace. A focused engineer could compress phases 1–3 into a single week.
**Ordering principle:** ship fixes that visitors notice today before refactors that only the engineer notices. Critical bugs and mobile UX come before code structure; code structure comes before optimization; optimization comes before strategic rewrites.

| Phase | Theme | Effort | Goal |
|---|---|---|---|
| **1** | Production hygiene | ~2 hours | Stop shipping broken assets and a known-published password |
| **2** | Mobile usability — emergency fixes | ~1 day | Site becomes usable on a phone |
| **3** | Mobile usability — polish | ~2 days | Site feels good on a phone |
| **4** | Code structure | ~3–5 days | `App.jsx` is no longer a single 7,700-line file |
| **5** | Performance & tooling | ~2–3 days | Faster initial paint, lint/type safety |
| **6** | Strategic / architectural | sized per item | Long-term durability — pick from the menu |

Each phase below describes the problems, the solutions, the order to do them in, and the acceptance criteria for "phase is done."

---

## Phase 1 — Production hygiene (~2 hours)

These are bugs that are currently live on the customer's site. Highest urgency-to-effort ratio in the entire plan. Do these before anything else.

### 1.1 Replace or remove the Google Analytics placeholder

**Problem.** [index.html:81–86](index.html#L81) ships with the literal placeholder `G-XXXXXXXXXX` as the GA Measurement ID. Every page load fires a real network request to `googletagmanager.com` with an invalid ID — the request resolves, downloads ~80 KB of GTM JavaScript, and writes nothing to any analytics property because the ID doesn't exist. Two costs: a useless network round-trip on every visit, and the customer thinks they have analytics when they don't.

**Solution.** Either:
- **Option A (preferred):** ask the customer for their real GA4 Measurement ID (Admin → Data Streams → Web → copy "Measurement ID"). Replace both occurrences of `G-XXXXXXXXXX`. Done.
- **Option B (fallback):** delete the `<script>` blocks at [index.html:81–87](index.html#L81) entirely until analytics is needed. Removes the request and the false impression.

**Acceptance.** Network tab on a fresh load shows either (a) a successful GTM request with the real ID or (b) no GTM request at all.

### 1.2 Add missing favicon and Open-Graph assets — or drop the references

**Problem.** [index.html:15–16](index.html#L15) references `/favicon.ico` and `/apple-touch-icon.png`; [index.html:24](index.html#L24) references `/images/og-card.jpg`. None of those files exist in `public/`. Result: 3× 404s on every page load, and social link previews (LinkedIn / Slack / Twitter) show no image.

**Solution.**
- Generate `public/favicon.ico` (multi-resolution: 16, 32, 48) and `public/apple-touch-icon.png` (180 × 180) from the existing `public/logo.svg`. Free online converters work (e.g. realfavicongenerator.net), or use ImageMagick: `magick logo.svg -resize 180x180 apple-touch-icon.png`.
- Create `public/images/og-card.jpg` (1200 × 630, < 200 KB, includes the IPC logo + tagline) for social previews.
- If any asset can't be produced now, delete the corresponding `<link>` or `<meta>` tag rather than leaving broken references.

**Acceptance.** All `<link rel="icon">` and `<meta property="og:image">` references resolve to 200-status assets. iOS home-screen install shows the IPC logo, not a screenshot. Pasting the URL into Slack shows the OG card.

### 1.3 Rotate the admin default password and remove it from public docs

**Problem.** [admin/config.php:33](admin/config.php#L33) ships the bcrypt hash of `ipc-admin-2025`. [admin/README.md:217](admin/README.md#L217) documents that string in plaintext. Anyone with repo access can log in to a live admin until the customer rotates. Even if they rotate quickly, the password lives in git history.

**Solution.** Two-step:

1. **Immediate:** rotate the live admin password using the documented `_hash.php` flow ([admin/README.md:202](admin/README.md#L202)). Update the deployed `config.php` only — do **not** commit the new hash to the repo. This unblocks the customer from being on a published password right now.
2. **Repository-side:** modify `admin/config.php` to read the hash from an optional `admin/config.local.php` (gitignored) and fall back to a "first-run setup" error message when not present:
   ```php
   if (file_exists(__DIR__ . '/config.local.php')) {
       require_once __DIR__ . '/config.local.php';
   } else {
       // No password set — block login and show setup instructions
       define('ADMIN_PASSWORD_HASH', '');
   }
   ```
   Add `auth.php` logic to render a one-time "set your password" form when `ADMIN_PASSWORD_HASH` is empty. Update `admin/README.md` to describe the new flow and remove every mention of `ipc-admin-2025`.

**Acceptance.** Fresh clones of the repo cannot log in to admin until the customer creates `config.local.php` (or completes the first-run setup). No password literal remains in any committed file. (Git history still contains it — accept this for now; rotating the password makes it inert.)

### 1.4 Add a `.gitignore`

**Problem.** The repo root has no `.gitignore`. Anyone running `npm install` then committing accidentally pulls in `node_modules/`, build output (`dist/`), OS metadata (`.DS_Store`, `Thumbs.db`), editor swap files, and — most concerning — the new `admin/config.local.php` and `admin/admin-log.jsonl` (which contains audit log entries with visitor IPs).

**Solution.** Create `.gitignore` at repo root with at minimum:
```
node_modules/
dist/
.DS_Store
Thumbs.db
*.swp
*.swo
.idea/
.vscode/
admin/config.local.php
admin/admin-log.jsonl
data/products-all.backup.*.json
```

**Acceptance.** `git status` on a fresh `npm install` shows nothing under `node_modules/`.

**Phase 1 done when:** customer's site no longer 404s its own favicons, no longer fires a bogus GA request, the admin is no longer on a published default password, and the repo can't accidentally commit secrets or build artifacts.

---

## Phase 2 — Mobile usability emergency fixes (~1 day)

The first six 🔴 mobile-audit findings make the site actively painful on a phone. These are all small code changes with outsized impact.

### 2.1 Form input font-size → 16 px (kills iOS auto-zoom)

**Problem.** Every `<input>` and `<textarea>` on the site uses `fontSize: 13` ([App.jsx:3330–3340](src/App.jsx#L3330) `inputStyle`, plus the dashboard search box at [App.jsx:5667–5683](src/App.jsx#L5667)). iOS Safari auto-zooms the viewport whenever a form input < 16 px receives focus, then refuses to fully zoom back out. This is the single most annoying interaction on the site for any visitor filling out the RFQ form on a phone.

**Solution.** In the `inputStyle` object at [App.jsx:3330](src/App.jsx#L3330), change `fontSize: 13` → `fontSize: 16`. Apply the same to the dashboard search input. Visually the inputs barely change at this scale; the zoom behavior disappears.

**Acceptance.** On a real iPhone (or iOS Simulator), tapping any input on the contact form, the dashboard search, or any other input no longer zooms the page.

### 2.2 ProductPage — scroll to detail after mobile product select

**Problem.** [App.jsx:4271–4390](src/App.jsx#L4271) — on `/products` at mobile widths, the sidebar (horizontal family pills + 2-col grid of all 40+ SKUs) renders **above** the product detail pane. Tapping a SKU updates the URL and re-renders the detail panel below, but the viewport stays scrolled to the sidebar. The user must manually scroll past the entire SKU grid every time they switch products. The page is functionally unusable on a phone for browsing more than one product.

**Solution.** Add a `useRef` on the `<div className="flex-1 min-w-0">` container at [App.jsx:5170](src/App.jsx#L5170). In `onSelect` ([App.jsx:5164](src/App.jsx#L5164)), call `detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })` after `setSelectedId`. Skip the scroll on desktop (`lg:` and up) since the sidebar is alongside, not above. Detect with a `matchMedia('(max-width: 1023px)')` check.

```js
const detailRef = useRef(null);
// in onSelect:
setSelectedId(id);
setShowStickyBar(false);
if (window.matchMedia('(max-width: 1023px)').matches) {
  detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
} else {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
```

**Acceptance.** On a phone, tapping any SKU smoothly scrolls the detail pane into view. Desktop behavior unchanged.

### 2.3 ProductDetail header — let action buttons wrap

**Problem.** [App.jsx:4746–4836](src/App.jsx#L4746) — the dark header bar has a left-side `<h2>` with the product name and a right-side action group containing the SKU badge, the "Download PDF" / "Request Data Sheet" button, and the "Request Quote" button. The action group has `flex-shrink-0` and its inner buttons don't wrap. At 320 px after the `px-8` (32 + 32 = 64 px) padding, the action group alone is ~280 px wide — wider than the remaining 256 px container. Result: either the h2 collapses to almost nothing or the buttons overflow the rounded card corner and clip.

**Solution.** Change the action wrapper at [App.jsx:4758](src/App.jsx#L4758) from `flex items-center gap-2 flex-shrink-0 mt-1` to `flex flex-wrap items-center gap-2 mt-1`. Add `min-w-0 flex-1` to the h2 wrapper at [App.jsx:4747](src/App.jsx#L4747). On widths below `sm`, the buttons stack below the title.

**Acceptance.** At 320 px and 375 px, the header reads cleanly: title above, three action chips wrapped below. No clipping at the rounded corner.

### 2.4 Mobile drawer — internal scroll & dismissible

**Problem.** [App.jsx:850–1184](src/App.jsx#L850) — the mobile nav drawer has no `maxHeight` and no `overflow-y`. With both Products and Company accordions expanded, drawer content runs ~800 px tall — longer than an iPhone SE viewport (568 px). The drawer extends past the bottom of the screen. To close it (hamburger is at the top of the page now), the user must first scroll the **whole page** up. There's also no backdrop, so tapping outside doesn't close the drawer.

**Solution.** Two changes to the drawer container at [App.jsx:851–858](src/App.jsx#L851):

1. Add `maxHeight: 'calc(100vh - 64px)'` and `overflowY: 'auto'` to the inner drawer wrapper so the drawer scrolls internally and the sticky navbar (with the hamburger) is always reachable.
2. Add a `<div onClick={() => setMenuOpen(false)}>` backdrop with `position: fixed; inset: 64px 0 0 0; background: rgba(0,0,0,0.3); zIndex: 49;` rendered when `menuOpen` is true, just below the drawer in z-index.

**Acceptance.** On any phone, opening the drawer with all accordions expanded keeps the hamburger reachable. Tapping outside the drawer closes it.

### 2.5 Dashboard — replace table with card list on `< sm`

**Problem.** [App.jsx:5687–6006](src/App.jsx#L5687) — the Product Index table has 7 columns (Name, Part ID, Part Type, Description, Temp, Specifications, Action). Even with each column constrained, the table is ≥ 900 px wide. Wrapped in `overflowX: auto`, on a 320 px screen the user must swipe ~500 px to the right just to reach the "View Product" button — the only primary action on the page. This is the single worst mobile failure on the site.

**Solution.** Render the table inside a `hidden sm:block` wrapper, and add a `sm:hidden` card list using the same `filtered` data. Each card layout:

```jsx
<div className="sm:hidden space-y-3">
  {filtered.map((row) => (
    <div key={row.productId} className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="text-xs font-bold text-blue-700">{row.partId}</div>
          <div className="text-sm font-semibold text-gray-900 mt-0.5">{row.name}</div>
        </div>
        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-cyan-50 text-cyan-700 flex-shrink-0">
          {row.partType}
        </span>
      </div>
      <div className="text-xs text-gray-600 mb-2 line-clamp-2">{row.descShort}</div>
      <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
        <span>Temp: {row.operatingTemp || '—'}</span>
      </div>
      <button onClick={() => handleViewProduct(row.productId)} className="w-full py-2.5 rounded bg-blue-700 text-white text-sm font-semibold">
        View Product →
      </button>
    </div>
  ))}
</div>
```

**Acceptance.** On a phone, the Product Index shows a vertical list of cards with the "View Product" button immediately tappable on each. No horizontal scroll anywhere on the page.

### 2.6 Contact tab switcher — stack on mobile

**Problem.** [App.jsx:3555–3624](src/App.jsx#L3555) — the "Request a Quote" / "Send a Message" tab switcher uses `flex` (not `flex-col`). At 320 px each tab gets ~136 px width. The label "📋  Request a Quote" (22 chars at `text-base` 14 px) wraps to two lines and the active-tab gradient background clips against the rounded card corner.

**Solution.** Change [App.jsx:3556](src/App.jsx#L3556) from `flex mb-6 rounded-xl overflow-hidden` to `flex flex-col sm:flex-row mb-6 rounded-xl overflow-hidden`. Change `borderRight` to `borderBottom` for `i === 0` when stacked: easiest is to switch both: `borderRight: i === 0 ? '1px solid #d1d9e0 sm:1px solid #d1d9e0' : 'none'` won't work in inline styles — instead drop the inline border and add a Tailwind class `border-b sm:border-b-0 sm:border-r border-gray-200 last:border-b-0 sm:last:border-r-0`.

**Acceptance.** At 320 px the two tabs stack vertically with the label fully visible. At 640 px+ they sit side-by-side as before.

**Phase 2 done when:** all six 🔴 mobile-audit findings are resolved. A real device test on iPhone SE (320 × 568) confirms the site is usable end-to-end: browse home, drill into a product, fill out the contact form.

---

## Phase 3 — Mobile usability polish (~2 days)

The 🟡 mobile-audit findings. Individually small; cumulatively they elevate the site from "usable on mobile" to "feels good on mobile."

### 3.1 Hero proof cards visible above the fold

**Problem.** [App.jsx:1221–1351](src/App.jsx#L1221) — Hero `minHeight: 560` plus `py-20` (160 px combined vertical padding). After the 64 px sticky navbar, the user scrolls past 624–704 px of hero before reaching the proof cards. The "Same-Day Shipment" and "25 M+ ft" stats are the strongest conversion levers and they're below the fold on every common phone.

**Solution.** On `< md`, drop `minHeight` and reduce padding. Change the inline style to a Tailwind utility: replace `minHeight: 560` and `py-20` with `min-h-0 py-12 md:min-h-[560px] md:py-20`. The right-column proof cards already render via a 2-column grid on every viewport, so they slide up naturally.

**Acceptance.** On a 375 × 667 viewport, at least the first proof card is visible without scrolling.

### 3.2 Trim trust-rail fade edges

**Problem.** [App.jsx:1362–1389](src/App.jsx#L1362) — left and right 80 px gradient fades on the marquee. At 320 px, that's 50% of the strip dimmed.

**Solution.** Change `width: 80` to `width: 'clamp(20px, 6vw, 80px)'` on both fade overlays.

### 3.3 Touch-friendly marquee pause

**Problem.** [App.jsx:4030](src/App.jsx#L4030) — `.ipc-marquee-track:hover` is the only way to pause. Touch users can't pause to read.

**Solution.** Add `:focus-within` to the selector and a `tabIndex={0}` on the marquee track wrapper. Alternatively bind `onTouchStart` to toggle a `paused` className for 3 seconds.

### 3.4 Reveal "Learn More →" on mobile

**Problem.** [App.jsx:2120–2130](src/App.jsx#L2120) — Home market cards have a "Learn More →" affordance gated behind `opacity-0 group-hover:opacity-100`. Touch users never see the call-to-action.

**Solution.** Change to `opacity-100 sm:opacity-0 sm:group-hover:opacity-100` so the link reveals by default on mobile and keeps the hover-reveal pattern on desktop.

### 3.5 Standardize tap targets — define `.ipc-tap` utility

**Problem.** Multiple pill/chip controls across the site fall below the WCAG 2.5.5 44 × 44 px minimum:
- ProductSidebar family pills ([App.jsx:4292](src/App.jsx#L4292)) — ~32 px
- DashboardPage filter pills ([App.jsx:5560](src/App.jsx#L5560)) — ~32 px
- Sticky RFQ bar buttons ([App.jsx:5240](src/App.jsx#L5240)) — ~36 px
- Drawer category links ([App.jsx:996](src/App.jsx#L996)) — ~32 px
- Footer Quick Links ([App.jsx:7263](src/App.jsx#L7263)) — ~12 px (worst offender)

**Solution.** Add a single utility class in the inline `GlobalStyles` block (or, later, in `src/index.css`):
```css
.ipc-tap { min-height: 44px; min-width: 44px; display: inline-flex; align-items: center; }
```
Apply `className="... ipc-tap"` to every offending control. For the footer specifically, change the `padding: 0` to `padding: 8px 0` and bump the grid `gap` from `6px 24px` to `12px 24px`.

### 3.6 Form autocomplete attributes

**Problem.** [App.jsx:3685–3705, 3909–3929](src/App.jsx#L3685) — phone, email, name, and company inputs are missing `autoComplete` hints. Without them, iOS / Android don't surface saved values from the keychain, making the contact form 3–4× slower to fill on mobile.

**Solution.** Add to the field definitions: `autoComplete: 'name' | 'email' | 'tel' | 'organization'`. Pass through to the `<input>`. Five-minute change, materially faster forms.

### 3.7 Dashboard filters in a collapsible "Filters ▾" sheet

**Problem.** [App.jsx:5457–5685](src/App.jsx#L5457) — on mobile, family `<select>` + clear-filter link + counter + search input stack to ~180 px before the table/cards start. After Phase 2.5 (cards), this is still ~180 px of chrome on a 568 px-tall viewport.

**Solution.** Wrap the entire filter region in a `<details>` element that's closed by default on `< sm`. Show only an "Active filter: Polyolefin · X" chip and a "Filters ▾" toggle in the collapsed state.

```jsx
<details className="sm:hidden mb-4" open={false}>
  <summary className="...">Filters {activeFamily !== 'All' && `(1)`}</summary>
  {/* existing filter UI */}
</details>
<div className="hidden sm:block">{/* existing filter UI duplicated */}</div>
```

(The duplication is short-term ugly. Phase 4's `App.jsx` split lets the filter UI become a reusable component.)

### 3.8 Page-header padding scale-down on mobile

**Problem.** Every internal page uses `.ipc-page-header` with `py-12 px-6` ([cross-cutting C-5](MOBILE_AUDIT.md#c-5--page-header-padding-py-12-px-6-is-uniform-across-all-pages)). Combined with the 64 px sticky navbar, that's ~175 px of chrome before any content on every page.

**Solution.** Add to the `GlobalStyles` injection (or `index.css` once Phase 4 lands):
```css
.ipc-page-header > div { padding: 32px 20px !important; }
@media (min-width: 768px) { .ipc-page-header > div { padding: 48px 24px !important; } }
```

### 3.9 Sticky RFQ bar — leave room for content underneath

**Problem.** [App.jsx:5176–5302](src/App.jsx#L5176) — when the bar shows, it covers the last ~56 px of the page. The "Related Products" footer clips against it.

**Solution.** When `showStickyBar` is true, apply `paddingBottom: 64` to the outer `<div>` of `ProductPage`. Tailwind: `style={{ paddingBottom: showStickyBar ? 64 : 0 }}`.

### 3.10 Smaller polish items

In order of impact:
- About sidebar facts — stack label/value on `< sm` ([App.jsx:2509](src/App.jsx#L2509))
- About timeline — collapse 3-column grid to a single column with year-badge as a card header on `< sm` ([App.jsx:2546](src/App.jsx#L2546))
- Industries product list buttons — `padding: 10px 0` instead of `4px 0` ([App.jsx:6340](src/App.jsx#L6340))
- Industries header `px-8 py-5` → `px-5 py-4 md:px-8 md:py-5` ([App.jsx:6266](src/App.jsx#L6266))
- StatsBar `py-7 px-6` → `py-5 px-4 md:py-7 md:px-6` ([App.jsx:1874](src/App.jsx#L1874))
- ProductDetail mobile padding — `p-5 sm:p-8` everywhere ([App.jsx:4879](src/App.jsx#L4879))
- Contact form `p-8` → `p-5 sm:p-8` ([App.jsx:3628](src/App.jsx#L3628))
- Logo slogan font-size: 9.5 → 11 ([App.jsx:320](src/App.jsx#L320))
- SpecTable2 — add a "← swipe →" hint at the right edge for narrow viewports ([App.jsx:4577](src/App.jsx#L4577))

**Phase 3 done when:** every 🟡 mobile-audit finding is closed. Real-device walkthrough on a phone feels fluid: no jarring zoom, no inaccessible buttons, no fade-edge readability problem, no awkward stacked typography.

---

## Phase 4 — Code structure refactor (~3–5 days)

`src/App.jsx` is 7,682 lines. Every page component, every SVG icon, every helper, every page's static copy lives in one file. This is the highest-leverage refactor in the plan — everything downstream (route-level code splitting, Tailwind theme tokens, type checking, testing) gets easier after this.

### 4.1 Target file structure

```
src/
├── main.jsx
├── App.jsx                      # ~150 lines: router + ErrorBoundary + shell only
├── index.css                    # Tailwind directives + the GlobalStyles CSS
├── lib/
│   ├── routing.js               # OverAI shim hooks (useSearchParam, etc.)
│   ├── useProducts.js           # fetchProductsCached + the hook
│   ├── extractComplianceBadges.js
│   └── constants.js             # FAMILY_ORDER, SIDEBAR_EXCLUDED, COMPANY_ITEMS, etc.
├── components/
│   ├── Navbar.jsx
│   ├── Footer.jsx
│   ├── ErrorBoundary.jsx
│   ├── Hero.jsx
│   ├── FeatureCard.jsx
│   ├── SectionHeader.jsx
│   ├── StatsBar.jsx
│   ├── ProductSidebar.jsx
│   ├── ProductDetail.jsx
│   ├── SpecTable1.jsx
│   ├── SpecTable2.jsx
│   ├── Badge.jsx
│   ├── FaqItem.jsx
│   ├── TeamCard.jsx
│   └── icons/                   # all the SVG icon sets
│       ├── CertIcons.jsx
│       ├── StatsIcons.jsx
│       ├── FeatureIcons.jsx
│       ├── MarketIcons.jsx
│       ├── IndustryIcons.jsx
│       └── ServiceIcons.jsx
└── pages/
    ├── HomePage.jsx
    ├── ProductPage.jsx
    ├── DashboardPage.jsx
    ├── IndustriesPage.jsx
    ├── ServicesPage.jsx
    ├── AboutPage.jsx
    ├── FaqPage.jsx
    ├── PrivacyPage.jsx
    └── ContactPage.jsx
```

### 4.2 Refactor approach — incremental, not big-bang

Do this one chunk at a time, with `npm run build` and a manual smoke test between chunks. Avoid trying to extract everything in a single commit.

**Order:**
1. **Pure helpers first** — extract `extractComplianceBadges`, `fetchProductsCached`, `useProducts`, the OverAI shim hooks, and all static arrays (`FAMILY_ORDER`, `COMPANY_ITEMS`, `MKT_MARKETS`, `FEATURES_DATA`, etc.) into `lib/`. Replace internal references with imports. No behavior change.
2. **Icon sets** — every `SOMETHING_ICONS` object literal of inline SVGs lifts to `components/icons/`. Each export an object keyed the same way the original was.
3. **Leaf components** — `Badge`, `FaqItem`, `TeamCard`, `FeatureCard`, `SectionHeader`, `SpecTable1`, `SpecTable2`. These have no children that live in `App.jsx`, so they extract cleanly.
4. **Composite components** — `Hero`, `StatsBar`, `Features`, `Navbar`, `Footer`, `ErrorBoundary`, `ProductSidebar`, `ProductDetail`. Each pulls in the leaves and the icons.
5. **Pages** — `HomePage`, `AboutPage`, `FaqPage`, `ContactPage`, `IndustriesPage`, `ServicesPage`, `PrivacyPage`, `ProductPage`, `DashboardPage`. These are last because they depend on everything else.
6. **`App.jsx`** — finally collapse what remains to ~150 lines: imports, the router, the ErrorBoundary wrapping, the loading/error skeleton, and the page switch.

**Acceptance per chunk:** `npm run build` succeeds, no console errors in the dev server, all routes render.

### 4.3 Move `GlobalStyles` into `src/index.css`

**Problem.** [App.jsx:4015–4122](src/App.jsx#L4015) — a 100-line CSS string is built at runtime and injected via `document.createElement('style')` on first render. The styles arrive after mount (brief flash of unstyled content), can't be fingerprinted by Vite, and can't be served compressed independently.

**Solution.** Copy the CSS contents into `src/index.css` (already exists, currently 3 lines of Tailwind directives). Delete the `GlobalStyles` component and remove the `<GlobalStyles />` mount from `App.jsx`.

### 4.4 Routing — replace the OverAI shim with real `react-router-dom` routes

**Problem.** [App.jsx:9–131](src/App.jsx#L9) — the OverAI shim treats `?page=` as the route discriminator and special-cases it to be a pathname segment. The shim is ~100 lines of glue, and the result is single-path-per-page URLs with messy `?productId=…` queries instead of clean paths like `/products/IP33PO`.

**Solution.** After extracting pages, replace the shim with:
```jsx
<BrowserRouter>
  <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/products" element={<ProductPage />} />
    <Route path="/products/:sku" element={<ProductPage />} />
    <Route path="/dashboard" element={<DashboardPage />} />
    <Route path="/industries" element={<IndustriesPage />} />
    <Route path="/services" element={<ServicesPage />} />
    <Route path="/about" element={<AboutPage />} />
    <Route path="/faq" element={<FaqPage />} />
    <Route path="/privacy" element={<PrivacyPage />} />
    <Route path="/contact" element={<ContactPage />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
</BrowserRouter>
```
Replace every `setSearchParam("page", "X")` call site with `navigate('/X')`. The `productId` query param becomes a `:sku` route param — better for SEO and shareability.

The `.htaccess` SPA rewrite already handles direct-URL refresh ([public/.htaccess:14](public/.htaccess#L14)).

### 4.5 Centralize brand tokens in `tailwind.config.js`

**Problem.** ~150 hex literals scattered across the codebase (`#005da3`, `#119ec8`, `#0d2d52`, `#00bef2`, `#141414`, etc.). A brand re-skin requires a global find-replace across hundreds of inline styles.

**Solution.** In `tailwind.config.js`:
```js
module.exports = {
  theme: {
    extend: {
      colors: {
        ipc: {
          navy:   '#0d2d52',
          blue:   '#005da3',
          cyan:   '#119ec8',
          accent: '#00bef2',
          ink:    '#141414',
          bg:     '#f5f7fa',
          gray: {
            50:  '#f8fafc',
            100: '#e5e9ee',
            200: '#d1d9e0',
            500: '#6b7280',
            700: '#4b5563',
          },
        },
      },
    },
  },
};
```
Then replace `style={{ color: '#005da3' }}` with `className="text-ipc-blue"`, etc. This is gradual — start with new code, sweep old code over time.

**Phase 4 done when:** `wc -l src/App.jsx` reports < 200 lines; pages and components live in their own files; the OverAI shim is deleted; brand tokens are in `tailwind.config.js`.

---

## Phase 5 — Performance & tooling (~2–3 days)

With the file split done, real performance wins become accessible.

### 5.1 Route-level code splitting with `React.lazy()`

**Problem.** Current build is ~83 KB gzipped JS. Every visitor downloads HomePage + ProductPage + IndustriesPage + Services + About + FAQ + Privacy + Contact + Dashboard on first paint — even though 80%+ of visitors only see Home.

**Solution.** In `App.jsx`:
```jsx
const ProductPage = lazy(() => import('./pages/ProductPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
// ... etc, all except HomePage which we keep eager-loaded

<Suspense fallback={<PageSkeleton />}>
  <Routes>...</Routes>
</Suspense>
```

**Expected impact:** initial JS payload drops from ~83 KB to ~35–45 KB gzipped. LCP improves 200–400 ms on slow connections.

**Acceptance.** Network tab on a fresh load downloads `index-*.js` (Home chunk) and nothing else. Navigating to `/products` downloads `ProductPage-*.js` on demand.

### 5.2 Image optimization

**Problem.** [MOBILE_AUDIT cross-cutting](MOBILE_AUDIT.md#cross-cutting-issues) — 4 `<img>` tags total, only one has `loading="lazy"`. No `<picture>` with WebP/AVIF. Product photos uploaded via admin ship as-is in whatever format the customer chose.

**Solution.**
- Add `loading="lazy" decoding="async"` to every `<img>` not visible above the fold.
- For the admin: when a product photo or PDF is uploaded, run it through a Sharp / ImageMagick step that emits a WebP sibling. Update `<img>` to use `<picture><source type="image/webp" ...><img src="...jpg" /></picture>`.

### 5.3 Preload product catalog JSON in HTML

**Problem.** [index.html](index.html) — no `<link rel="preload">` for `/data/products-all.json`. The catalog fetch begins only after JS parses.

**Solution.** Add to `<head>`: `<link rel="preload" href="/data/products-all.json" as="fetch" crossorigin="anonymous">`. The browser starts the fetch in parallel with JS download.

### 5.4 Render the shell before catalog loads

**Problem.** [App.jsx:7321–7603](src/App.jsx#L7321) — `<App />` shows a full-page skeleton (Navbar + Hero + Features) until products load. The navbar can't show categories until then, but the navbar shell itself, hero, and footer don't depend on `products`.

**Solution.** Render Navbar (with category dropdown showing "Loading…"), Hero, Features (static content), and Footer immediately. Only gate the per-route `<main>` content on `loading`. Removes ~500 ms of perceived load on average connections.

### 5.5 Add ESLint + Prettier

**Problem.** Zero lint/format tooling. The 7,700-line file became 7,700 lines partly because there was no automated nag against it.

**Solution.**
```bash
npm install -D eslint eslint-plugin-react eslint-plugin-react-hooks prettier eslint-config-prettier
```
- `.eslintrc.json` with `react`, `react-hooks`, `prettier` configs.
- `.prettierrc.json` with the project's existing conventions (2-space indent, double quotes, trailing commas).
- Add `npm run lint` and `npm run format` scripts.
- Optionally: add a pre-commit hook with `husky` + `lint-staged`.

### 5.6 Reduce backup churn from admin saves

**Problem.** [admin/config.php:108–131](admin/config.php#L108) — `save_products()` writes a timestamped backup on every save (Edit, Add, PDF upload, Import). Cap is 5 most recent. A busy admin day leaves a 5-backup window covering ~10 minutes, not 5 days.

**Solution.** Keep both:
- The 5-most-recent windowed backups (existing behavior).
- Plus one snapshot per calendar day (e.g. `products-all.daily.YYYY-MM-DD.json`), retained for 30 days.

### 5.7 Move rate-limit storage off `sys_get_temp_dir()`

**Problem.** [public/contact.php:49](public/contact.php#L49) — rate-limit file lives in `/tmp`. On Network Solutions shared hosting, `/tmp` may be cleared between requests or shared across customers.

**Solution.** Move to `data/rate-limit/ipc_rl_<hash>.json`. Update `data/.htaccess` to block direct access (already blocks PHP execution; ensure it also blocks the `rate-limit/` subdirectory).

**Phase 5 done when:** Lighthouse mobile performance score is in the green; lint passes clean; image lazy-loading is universal; admin backups have daily snapshots.

---

## Phase 6 — Strategic / architectural (menu, pick per quarter)

These are larger changes that don't fit in a single sprint. Each one is independent — pick based on the customer's priorities.

### 6.1 First-run admin password setup
**Problem.** Phase 1.3 partially solved this by gitignoring the live hash, but rotating still requires the FTP/`_hash.php`/edit flow. Three customer mistakes I'd expect to see:
- Forgetting to delete `_hash.php` → password generator stays public.
- Putting the hash inside quotes that contain a `$` literal that PHP interprets.
- Copying the hash with trailing whitespace that breaks `password_verify`.

**Solution.** Build an "Account" page inside the admin: prompts for current password + new password, hashes with `password_hash(PASSWORD_DEFAULT)`, writes a new `config.local.php`, takes a backup of the previous one. Eliminates the entire FTP step.

**Estimated effort:** 1 day.

### 6.2 Typed schema for the product catalog
**Problem.** `products-all.json` is freeform. The admin form validates required fields, but the React side has no schema check. A malformed product silently breaks the detail page.

**Solution.** Define a Zod (or hand-rolled) schema in `src/lib/productSchema.js`. Validate the fetched catalog once on load; surface a non-blocking warning for malformed records. Mirror the schema in the admin so the form validates against the same definition.

**Estimated effort:** 1–2 days.

### 6.3 Static-generate product pages at build time
**Problem.** Every product page is JS-rendered. Search engines render JS but with reduced crawl budget. SEO suffers for the long-tail product SKUs.

**Solution.** Add `vite-plugin-ssr` or `vike`. At build time, iterate the catalog JSON and emit one HTML file per SKU (`/products/IP33PO/index.html`). The HTML contains the full product detail markup with schema.org product data. The trade-off: admin edits no longer propagate within 60 seconds — they require a rebuild. Mitigation: a webhook from the admin that triggers a rebuild on save, OR keep the SPA fallback for the public site and use the static pages purely for crawlers.

**Estimated effort:** 3–5 days. Only worth doing if the customer specifically wants organic search traffic for individual SKUs.

### 6.4 Real transactional-email backend for the contact form
**Problem.** [public/contact.php:163](public/contact.php#L163) uses PHP `mail()` via Network Solutions' MTA. Spam-folder rate is high by default; lead loss is invisible.

**Solution.** Move sends to SendGrid / Postmark / SES via API. Add SPF, DKIM, DMARC on the customer's domain. Keep `mail()` as a fallback for the auto-reply since deliverability matters less there.

**Estimated effort:** 1 day (provider setup is the long pole).

### 6.5 Automated tests for the admin write path
**Problem.** No automated check that `save_products()` round-trips through the JSON without corrupting fields. A whole class of "I edited the spec table and the dimensions disappeared" bugs is invisible until the customer reports it.

**Solution.** 30-line PHP test script (`admin/tests/test-roundtrip.php`) that:
1. Loads `products-all.json` into memory.
2. Writes it back via `save_products()`.
3. Reloads and `assert(==)` on the entire array.
4. Repeats for a known-tricky product (multi-line specTable1 with `\n` in values).

**Estimated effort:** half a day.

### 6.6 Progressive TypeScript adoption
**Problem.** No static type checking. The `<input>` field definitions are hand-typed objects; the catalog JSON is freeform; the OverAI shim functions have implicit any.

**Solution.** Add `// @ts-check` to individual files (no full migration). Add `jsconfig.json` with `"checkJs": true`. Convert helpers and `lib/` to `.ts` over time; leave React components as `.jsx` until they're being heavily modified.

**Estimated effort:** ongoing.

---

## Sequencing summary

A reasonable engagement timeline:

| Week | Focus | Deliverable |
|---|---|---|
| 1 | Phase 1 + Phase 2 | Production hygiene; mobile site usable |
| 2 | Phase 3 | Mobile site feels good; all 🟡 closed |
| 3 | Phase 4 (chunks 1–3) | Helpers + icons + leaf components extracted |
| 4 | Phase 4 (chunks 4–6) | Composite components + pages extracted; routing converted |
| 5 | Phase 5 | Code-splitting; lint/format; performance polish |
| 6+ | Phase 6 menu | Customer-driven priorities |

A focused single-developer sprint can compress weeks 1–2 to one week (the changes are small and isolated) and weeks 3–4 to one week (the extraction is mechanical once a pattern is established).

## Dependencies between phases

- **Phase 2 depends on nothing** — every fix is isolated.
- **Phase 3 depends on nothing** — but is easier to apply consistently once Phase 4's component split happens. Doing Phase 3 first means re-applying some fixes inside the new file structure. Worth it: the user-facing improvements arrive sooner.
- **Phase 4 unblocks everything in Phase 5.** Don't try to do route-level code splitting before the file is split.
- **Phase 5 unblocks parts of Phase 6.** Static generation (6.3) assumes a clean file structure.
- **Phase 6 items are independent of each other.** Pick freely.
