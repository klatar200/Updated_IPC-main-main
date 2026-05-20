# IPC Website — Audit & Recommendations

Audit date: 2026-05-18
Scope: `src/App.jsx`, `admin/*.php`, `public/contact.php`, `index.html`, Vite/Tailwind config, `.htaccess` files.

This document is organized into three sections:

1. **Bugs & correctness issues** — things that are observably wrong or broken.
2. **Optimization opportunities** — things that work but are slower, bigger, or more fragile than they need to be.
3. **Architectural recommendations** — larger structural changes worth discussing before doing.

Severity tags: 🔴 high · 🟡 medium · 🟢 low.

---

## 1. Bugs & correctness issues

### 1.1 🔴 Hardcoded GA placeholder `G-XXXXXXXXXX` ships to production
[index.html:81–86](index.html#L81)

The Google Analytics 4 snippet still has the literal placeholder `G-XXXXXXXXXX`. Every visitor's browser issues a real request to `googletagmanager.com` with an invalid Measurement ID. **Effect:** no analytics, plus an extra ~80 KB blocking script load and one failed network round-trip on every page view.

**Fix:** replace with the real Measurement ID or remove the block until one exists.

### 1.2 🔴 Referenced favicon assets don't exist
[index.html:15–16](index.html#L15)

`index.html` links `/favicon.ico` and `/apple-touch-icon.png`, but only `public/favicon.svg` and `public/manifest.json` exist on disk. Every page load emits a 404 for both. iOS home-screen installs fall back to a screenshot of the page.

**Fix:** either add `public/favicon.ico` + `public/apple-touch-icon.png` (180×180), or remove those `<link>` tags.

### 1.3 🟡 OG card image `og-card.jpg` doesn't exist
[index.html:24](index.html#L24)

Open Graph references `https://www.insulationproducts.com/images/og-card.jpg`. There is no `images/` folder in `public/`, so social link previews (LinkedIn, Slack, Twitter) show no image.

**Fix:** add `public/images/og-card.jpg` (1200×630 recommended) or remove the meta tag.

### 1.4 🔴 Admin default password `ipc-admin-2025` is documented in two committed files
[admin/config.php:33](admin/config.php#L33), [admin/README.md:217](admin/README.md#L217)

The shipped bcrypt hash is documented as belonging to `ipc-admin-2025`, in plaintext, in both files. Anyone who can read the repo can log in until rotated. The README already flags this, but the admin still ships in that state.

**Fix options:** ship the admin in a "needs initial password" state where the first POST to a setup endpoint defines the password and writes the hash. Or move `ADMIN_PASSWORD_HASH` to `admin/config.local.php` that's `.gitignore`d and document the local override flow.

### 1.5 🟡 No `.gitignore` for build/secret files
Repo root contains `package-lock.json` and `data/` but no `.gitignore`. `dist/`, `node_modules/`, OS files (`.DS_Store`, `Thumbs.db`), editor swap files, and any `admin/config.local.php` could end up in the repo if not deliberately excluded.

**Fix:** add a minimal `.gitignore` covering `dist/`, `node_modules/`, `.DS_Store`, `Thumbs.db`, and `admin/admin-log.jsonl`.

### 1.6 🟡 React app calls `_setSearchParamsRef` before the ref is wired
[App.jsx:99–107](src/App.jsx#L99)

`setSearchParam()` and `setSearchParams()` (module-level functions) check for `_setSearchParamsRef` and fall back to manipulating `window.history.pushState` directly when it's null. That fallback **does not trigger a React re-render** — react-router-dom won't see the URL change. The race exists for one render after `<App />` first mounts, before `useSetSearchParamRef`'s `useEffect` fires.

In practice this only bites if a user clicks a navbar link in the first paint, but it's a latent inconsistency.

**Fix:** make the setter a no-op (or queue it) until the ref binds, instead of bypassing react-router.

### 1.7 🟡 Catalog "freshness" claim is contradictory
README and admin README both say edits propagate to the public site "within ~60 seconds." The setup is:
- React's `fetchProductsCached` uses a 60-second cache-buster ([App.jsx:4139](src/App.jsx#L4139)).
- Apache cache header on `data/products-all.json` is `max-age=300` (5 min, per the original `data/.htaccess`).
- The module-level `_productsCache` in JS lives for the **entire session** — no time-based invalidation.

So the 60-second figure only holds on a hard refresh or a fresh tab. A returning visitor on the same tab sees stale data indefinitely until they refresh.

**Fix:** either align the Apache header to `max-age=60`, or document the actual behavior, or add a periodic refetch.

### 1.8 🟢 Hard-coded color literals scattered across 7,682 lines
[App.jsx — 467 inline `style={{}}` blocks, 385 `className=` attributes]

Inline styles reference `#005da3`, `#119ec8`, `#00bef2`, `#0d2d52`, `#141414`, etc. by literal hex throughout. Changing the brand palette today requires a global find-replace across all of `App.jsx`. Tailwind is already configured but underused — the project mixes utility classes and inline styles inconsistently.

Not strictly a bug, but it's a maintenance hazard.

### 1.9 🔴 Mobile UX: product list pushes details off-screen (ProductPage)
[App.jsx:4271–4390 ProductSidebar mobile branch](src/App.jsx#L4271)

On `/products` at mobile widths, the sidebar renders **above** the product detail pane as a horizontal pill strip of families plus a 2-column grid of every SKU. Tapping a product updates the URL and changes which detail panel is mounted below — but the viewport stays scrolled to the top of the page where the sidebar lives. The user has to scroll past the entire grid (40+ products) every time they switch selection to see the specs they just asked for.

**Effect:** the page is functionally unusable on a phone for browsing more than one product. Tap → scroll down → read → scroll up → tap → scroll down → repeat.

**Fix options:**
- After `onSelect`, programmatically scroll the detail pane into view (`detailRef.current?.scrollIntoView({ behavior: 'smooth' })`). One-line fix, big UX win.
- Collapse the mobile sidebar into a single sticky "Choose product ▾" dropdown/sheet at the top, so the detail pane is always the dominant region.
- Treat each product as its own route (`/products/:sku`) and show a "Back to catalog" link inside the detail — the standard mobile master-detail pattern.

### 1.10 🟡 Mobile UX: Dashboard filters split into two stacked regions
[App.jsx:5457–5685 DashboardPage controls](src/App.jsx#L5457)

`/dashboard` on mobile stacks: (1) family `<select>` dropdown, (2) "Clear filter" link, (3) "N of M products" counter, (4) search input. That's ~180 px of chrome before any table row appears, on a phone screen that's 600–800 px tall. The table itself then has `overflowX: auto` — the "Action / View Product" column sits off-screen to the right, requiring a horizontal swipe to access.

**Fix options:**
- Wrap family filter + search in a single collapsible "Filters ▾" panel that's closed by default on mobile. Show only an active-filter chip row + "Filters" toggle until the user taps it.
- Convert the table to a card list on mobile (one row → one stacked card with the View Product button at the bottom). Eliminates horizontal scroll entirely.
- Consider whether `/dashboard` and `/products` should even be separate pages on mobile — the user benefit of the table view degrades sharply on a narrow screen.

### 1.11 🟢 Two contact codepaths can drift
[admin/contact.php] vs [public/contact.php] vs [src/App.jsx ContactPage]

The React form posts to `/contact.php`, but `admin/contact.php` doesn't exist — there's only `public/contact.php`. Functionally fine (Vite copies `public/contact.php` to dist root), but the duplication of "what fields exist" between the React form and the PHP handler is fragile. Adding a field today is a two-file change with no schema linkage.

---

## 2. Optimization opportunities

### 2.1 🔴 `App.jsx` is a single 7,682-line file
Every page component, every SVG icon, every helper, every page's static copy lives in one file. Implications:

- **Slow editor performance** — opening the file pegs lints/LSP.
- **No code splitting** — every visitor downloads HomePage + ProductPage + IndustriesPage + Services + About + FAQ + Privacy + Contact + Dashboard on first paint, even though most users only see Home.
- **No tree-shaking benefit** from Vite — the file is one module.
- **Git diffs are noisy** — touching a single page often shows up as a 7700-line file change.

**Fix:** split into `src/pages/*.jsx`, `src/components/*.jsx`, `src/lib/*.js`. Use `React.lazy()` + `<Suspense>` for non-home routes. This is the single highest-impact change available.

### 2.2 🟡 Bundle could shrink ~40–60% with route-based lazy loading
The current build is ~83 KB gzipped JS (per README). Of that, HomePage's hero + features is the only thing needed for first paint. ProductPage's `ProductSidebar` + `ProductDetail` + spec tables is several thousand lines on its own and only matters when the user navigates to `/products`.

**Estimated wins** (rough):
- Initial JS payload: 83 KB → 35–45 KB gzipped
- LCP on slow connections: down 200–400ms
- The 184 KB `products-all.json` already streams on demand; pages should follow.

### 2.3 🟡 `GlobalStyles` injects CSS via `useEffect` instead of an import
[App.jsx:4015–4122](src/App.jsx#L4015)

A 100-line CSS string is built and injected via `document.createElement('style')` on first render. Reasons this is suboptimal:
- The styles aren't part of the initial HTML, so they apply post-mount — a brief flash of unstyled content for anything they target.
- Vite can't fingerprint or cache them as a CSS file.
- They can't be served compressed independently.

**Fix:** move the contents to `src/index.css` (already exists, currently only 4 lines of Tailwind directives). Delete `GlobalStyles`.

### 2.4 🟡 Inline `style={{}}` objects re-allocate every render
467 inline object literals means React allocates 467 fresh objects per render of any component that mounts. For static styles (which is most of them) this is wasted GC pressure. Each also defeats memoization — children that receive these as props can't `React.memo` past them.

**Fix:** for any non-dynamic style block, move to a Tailwind class or a CSS class in `index.css`. Lifting just the navbar's repeated style objects to module scope would already pay off.

### 2.5 🟡 No image optimization pipeline
- `<img>` usage in `App.jsx` only has 1 `loading="lazy"` attribute across 4 `<img>` tags.
- No `<picture>` with WebP/AVIF.
- No `srcset` for responsive sizing.
- The PDF logo asset (`public/logo.svg`) and any future product photos go up raw.

**Fix:** add `loading="lazy" decoding="async"` to all images below the fold. For product photos uploaded via the admin, consider a `convert-on-upload` step that emits WebP siblings.

### 2.6 🟡 React hooks-of-rules dance in `<App />` and `useProducts`
[App.jsx:7319–7353](src/App.jsx#L7319), [App.jsx:4165–4197](src/App.jsx#L4165)

The comment "ALL hooks must be called before any conditional return" is correct, but the structure is fragile: `useProducts()` returns `loading/error/products`, then there's a giant skeleton block, then the error block, then `renderPage()`. Every prop fetch is gated by the loading flag — even rendering the navbar waits for products to load.

**Fix:** render the shell (Navbar + Footer) immediately and only gate the `<main>` content on `loading`. The site feels faster and Navbar's category dropdown can show a skeleton on its own.

### 2.7 🟢 Admin's `save_products()` writes a backup on **every** save
[admin/config.php:108–131](admin/config.php#L108)

Every Edit, every Add, every PDF upload (because PDF upload also calls `save_products()` to update `pdfUrl`) writes a timestamped backup. Cap is 5 most recent. That's reasonable, but it means a busy day of admin work leaves the customer's 5-backup window covering ~10 minutes of edits — not 5 days as one might assume.

**Fix:** keep 5 daily snapshots in addition to the 5 most-recent-by-write, or rotate by date prefix. Low priority.

### 2.8 🟢 No HTTP/2 server push hints / preload
[index.html](index.html)

No `<link rel="preload">` for the hashed JS/CSS bundles or for `/data/products-all.json`. The catalog fetch could begin in parallel with the JS parse.

**Fix:** Vite can inject preload hints automatically; or add `<link rel="preload" href="/data/products-all.json" as="fetch" crossorigin>` manually.

### 2.9 🟢 Rate-limit file lives in `sys_get_temp_dir()`
[public/contact.php:49](public/contact.php#L49)

On Network Solutions shared hosting, `/tmp` may be cleared between requests or shared across customers (depending on PHP configuration). The 5-per-IP-per-10-minute limit may not survive long enough to actually limit.

**Fix:** write the rate-limit file under the customer's `data/` (block direct access via `.htaccess`, which is already configured).

---

## 3. Architectural recommendations

### 3.1 Split `App.jsx` (highest ROI)
The de facto target structure:

```
src/
├── main.jsx
├── index.css
├── App.jsx                      # ~150 lines: router + ErrorBoundary + shell only
├── lib/
│   ├── routing.js               # the OverAI shim hooks
│   ├── useProducts.js           # fetchProductsCached + hook
│   └── format.js                # extractComplianceBadges, etc.
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
│   └── icons/                   # the cert icons + line icons
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

This unlocks lazy-loading and dramatically improves edit ergonomics.

### 3.2 Replace query-param routing with real `react-router-dom` routes
The OverAI shim is doing real work, but the result is a single-path SPA (`/` with `?page=…`, except `page` is special-cased to be a pathname segment). The shim is ~100 lines of glue. With `App.jsx` split, this could collapse to:

```jsx
<Routes>
  <Route path="/" element={<HomePage />} />
  <Route path="/products" element={<ProductPage />} />
  <Route path="/products/:sku" element={<ProductDetailPage />} />
  <Route path="/dashboard" element={<DashboardPage />} />
  …
</Routes>
```

That's idiomatic and gives the products page real per-SKU URLs (`/products/IP33PO` instead of `/products?productId=IP33PO`) — better for SEO, sharing, and analytics.

### 3.3 Move the product catalog behind a typed schema
`products-all.json` is freeform. The admin form validates required fields, but the React side has no schema check and silently rolls with whatever fields exist. Two improvements:

- Add a `zod` (or hand-rolled) schema in `src/lib/productSchema.js` that's run once on the fetched JSON, with diagnostics for malformed records.
- The admin already validates required fields server-side — make those validations match the schema so add/edit and the public site agree.

### 3.4 Generate static product pages at build (optional, bigger win for SEO)
Right now the entire site is one SPA. Search engines can render JS, but crawl budgets favor pre-rendered HTML. Vite has plugins (`vite-plugin-ssr`, `vike`) that can pre-render pages at build time from the catalog JSON. Every SKU becomes a real `/products/IP33PO/index.html` on disk.

This is a bigger lift, and only worth doing if SEO/organic traffic matters more than admin-edit freshness. The current "admin edits propagate in 60s" guarantee would change to "admin edits become visible after the next `npm run build`" — unless the admin triggers a rebuild.

### 3.5 Centralize brand tokens in `tailwind.config.js`
Pull the literal hex values out of the JSX and define them as Tailwind theme colors:

```js
// tailwind.config.js
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
      }
    }
  }
}
```

Then `style={{ color: '#005da3' }}` becomes `className="text-ipc-blue"`, and brand re-skins become a 6-line file edit.

### 3.6 Add basic frontend type/lint tooling
There are no `eslint`, `prettier`, or `typescript` configs. For a single-file 7700-line codebase that's understandable; for a split codebase it's near-mandatory. Suggest:

- ESLint with `eslint-plugin-react` + `eslint-plugin-react-hooks`
- Prettier with a shared config
- Optional: progressive TS via `// @ts-check` on individual files, no full migration needed

### 3.7 Move admin password rotation out of the file-edit flow
The current two-step (write `_hash.php`, visit it in browser, copy hash, edit `config.php`, delete `_hash.php`) is fragile and security-sensitive. Three customer mistakes I'd expect to see:

- Forgetting to delete `_hash.php` → password generator stays public.
- Putting the hash inside quotes that contain a `$` literal that PHP interprets.
- Copying the hash with trailing whitespace that breaks `password_verify`.

**Fix:** add an "Account" page to the admin itself: prompt for current password + new password, hash and write `config.local.php` (or just rewrite `config.php` with a regex), with a backup. This is straightforward PHP and removes the entire FTP step.

### 3.8 Consider a real backend for the contact form (later)
PHP `mail()` on Network Solutions shared hosting has a high spam-folder rate by default. Moving form submissions through SendGrid / Postmark / SES (via API, with SPF/DKIM/DMARC aligned to the customer's domain) materially improves deliverability. Not urgent — only relevant if the customer starts complaining about lost leads.

### 3.9 Add a real test for the admin write path
There's currently no automated check that `save_products()` actually round-trips through the JSON without corrupting fields. A 30-line PHP test that writes a known product, reads it back, and diffs it would catch a whole class of "I edited the spec table and the dimensions disappeared" bugs that customers tend to discover months later.

---

## 4. Quick wins (do these first)

If you have an hour, in order:

1. **Replace or remove the GA placeholder** ([1.1](#11)) — 2 min.
2. **Drop the broken favicon/og-card `<link>` tags** ([1.2](#12), [1.3](#13)) — 5 min.
3. **Scroll-into-view on mobile product select** ([1.9](#19)) — 5 min, biggest mobile UX win in the file.
4. **Add a minimal `.gitignore`** ([1.5](#15)) — 5 min.
5. **Move the `GlobalStyles` CSS into `index.css`** ([2.3](#23)) — 15 min.
6. **Add `loading="lazy"` to all `<img>` tags** ([2.5](#25)) — 10 min.
7. **Collapse Dashboard filters into a "Filters ▾" sheet on mobile** ([1.10](#110)) — 30 min.

If you have a day:

6. **Split `App.jsx` into `pages/` and `components/`** ([3.1](#31)) — 4–6 hours.
7. **Convert routing to real react-router routes** ([3.2](#32)) — 1–2 hours after the split.
8. **Centralize brand tokens in Tailwind** ([3.5](#35)) — 2–3 hours.
