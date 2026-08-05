# PLAN 1 — SEO and crawlability

**Items:** **4.21**, **4.3**, **4.1**, `seo: []`
**Depends on:** Plan 0 (you cannot verify 4.1 without working content plumbing).
**Effort:** 4.21 medium; the rest small. **Risk:** 4.21 is the highest-risk change
in the whole set — it touches every navigation control on the public site.
**Read [GUARDRAILS.md](GUARDRAILS.md) first.**

This is the plan that changes what the business gets out of the site. A
distributor whose catalog Google cannot crawl is invisible for exactly the
long-tail part-number searches it should win.

Do 4.3 and 4.1 first — they are small, independent, and give you a green
baseline before the risky one.

---

## 4.3 — No canonical URL anywhere, and every page claims to be the homepage

### Evidence (confirmed 2026-08-05)

`index.html` has **no `rel="canonical"` at all**, and line 19:

```html
<meta property="og:url" content="https://www.insulationproducts.com/" />
```

`index.html` is the single shell for all nine routes, so `/products`,
`/contact`, `/about`, `/services`, `/industries`, `/quality`, `/privacy`,
`/terms` and every `?productId=` variant all announce themselves as the site
root. Shared links preview as the homepage, and crawlers get a duplicate-content
signal across the entire site.

### The fix

Both tags must become **per-route and runtime-updated**, because the page
identity is only known after the router resolves.

- Add a small effect — near `StructuredData` (`src/App.jsx:4892`), which already
  does exactly this kind of head management — that on every `page` change:
  - upserts `<link rel="canonical" href="…">` in `document.head`
  - updates `og:url` to the same URL
- Build the URL from a single origin constant plus `pageToPath(page)`
  (`src/App.jsx:14`). **Do not read `window.location.origin`** — dev, the
  `php -S` mirror and production would each self-declare as canonical, which is
  worse than a wrong constant. Define the production origin once and use it.
- Include the `productId` search param when present, so an individual product
  page is canonical to itself. Exclude every other param — `?family=`, search
  terms and UI state must not create canonical variants.
- Follow the existing cleanup idiom: `StructuredData` removes its node on
  unmount. Match it.

**Escalate before hardcoding the origin.** `www` vs apex is a business decision
with real consequences — picking the wrong one splits ranking signals. The
existing tag says `https://www.insulationproducts.com/`. Confirm that is the
canonical host before relying on it, in the five-field form from GUARDRAILS §5.

### Acceptance

- On each of the nine routes: exactly **one** `<link rel="canonical">`, whose
  `href` matches the route.
- `og:url` equals the canonical on all nine.
- `/products?productId=IP35KY` is canonical to itself; `/products?family=…` is
  canonical to `/products`.
- Navigating between routes updates both tags — assert after a client-side
  navigation, not just a fresh load. This is the case a naive implementation
  fails.

---

## 4.1 — Rick's FAQ edits never reach Google

### Evidence (confirmed 2026-08-05)

`src/App.jsx:3058–3075`, inside `FaqPage`:

```js
useEffect(() => {
  const el = document.createElement("script");
  el.id = "faq-ld";
  …
  "mainEntity": categories.flatMap(…)
  …
}, []);                    // ← line 3075
```

`categories` comes from `groupFaq(faq)` (`3056`), and `faq` comes from
`useContent()`. `ContentProvider` (`4870`) initialises to `contentDefaults`
(`4871`) and **renders children immediately**, swapping in fetched content later.

So the effect runs once, on mount, against the **defaults**, and the `[]` deps
array guarantees it never re-runs. The FAQPage structured data Google sees is
permanently the hardcoded default set. Every FAQ Rick writes in the admin is
absent from the rich-result markup.

### The fix

Add `categories` — or a stable derived value — to the dependency array so the
script is rebuilt when content arrives.

Watch two things:

- `categories` is a **new array identity on every render** (`groupFaq` is called
  inline at `3056`, not memoised). Putting it in the deps as-is re-runs the
  effect on every render, tearing down and re-appending a `<script>` each time.
  Memoise `categories` with `useMemo` keyed on `faq`, or key the effect on a
  stable serialisation. State in a comment which you chose and why.
- The cleanup at `3074` removes by `id`. Keep that — without it you will
  accumulate duplicate `faq-ld` nodes, which is a worse structured-data error
  than stale content.

### Acceptance

- Edit an FAQ question in `data/content.json`, reload, and read
  `document.getElementById('faq-ld').text` — the edited question is present.
  **Restore from `_harness/pristine/content.json` and `cmp` afterwards.**
- Exactly **one** `#faq-ld` node after five client-side navigations away from and
  back to `/faq`.
- The JSON parses and `mainEntity` length equals the number of rendered FAQ items.

---

## `seo: []` — clearing the SEO section does not clear titles

### Evidence

Recorded as an `AMENDED` line in `WHATS_LEFT.md` §4 (T1.4). Title resolution is
`entry.title || home.title || document.title`, and `document.title` has already
been set from the defaults by the first effect pass — so emptying `seo` leaves
the default per-page titles in place.

Fifteen of the sixteen array sections honour invariant 3 (an empty array is a
deletion). `seo` is the exception.

### The fix — and the reason it was deliberately left

I left this alone because making it literally correct would let Rick empty the
SEO section and blank **every page title on the site**. That is a worse outcome
than a stale default, and invariant 3 exists to respect deletions, not to
manufacture empty output.

Fix the honesty problem instead of the mechanism: when `seo` is empty, fall back
to a **computed** title — the page's own `copy.*` heading plus the company name —
rather than to the hardcoded `SEO_DEFAULTS` entry. Deleting the section then
means "stop overriding titles", which is what Rick would expect, and no page can
end up untitled.

**If that turns out to be more than a contained change, stop and leave the
current behaviour.** It is benign. Do not force it.

### Acceptance

- With `seo: []`, every one of the nine routes has a non-empty, distinct
  `document.title` derived from that page's own heading.
- With `seo` populated, the configured titles win.
- `node _harness/invariants.js` still 15/15.

---

## 4.21 — No crawlable internal link graph

**This is the high-value, high-risk item. Read the whole section before editing.**

### Evidence (confirmed 2026-08-05)

Navigation is `<button onClick>` throughout. In `src/App.jsx`: **63 `<button`
against 15 `<a href`**.

The mechanism, `Navbar` at `219`:

```js
const nav = (p, params = {}) => {
  setSearchParams({ ...params, page: p });   // line 234
  setMenuOpen(false);
  setOpenDropdown(null);
  setMobileOpen(null);
};
```

and call sites like `src/App.jsx:295`:

```jsx
<button onClick={() => nav(null)} … aria-label="Insulation Products Corporation — Home">
```

`setSearchParams` is the module-level ref wired by `useSetSearchParamRef()`
(`60`, called at `8861`). The `"page"` key writes the URL **pathname** via
`pageToPath` (`14`); every other key is a search param.

Consequences:

- A crawler that does not execute JS sees no internal links at all, and one that
  does still finds no `href` to follow. The site is effectively a set of orphan
  URLs reachable only from the sitemap.
- Ctrl/Cmd-click and middle-click do nothing. "Open in new tab" is impossible —
  a real cost on a catalog where buyers compare parts side by side.
- Right-click → Copy Link Address is unavailable.

### The fix

Introduce **one** shared component and route every *navigational* control
through it. Do not hand-convert call sites individually.

`PageLink` must:

- Render a real `<a>` whose `href` is the same URL the router would produce —
  reuse `pageToPath`, and append search params for cases like `?productId=`.
  A wrong `href` is worse than a button: it becomes a crawlable 404.
- On click, **let the browser handle the event** when it is not a plain primary
  click. Return early — without `preventDefault()` — if any of
  `e.metaKey`, `e.ctrlKey`, `e.shiftKey`, `e.altKey` is set, or `e.button !== 0`.
  This is the entire point of the change; getting it wrong reintroduces the bug
  in a form that looks fixed.
- Otherwise `preventDefault()` and call the existing `nav(...)`, preserving the
  single batched `setSearchParams` call. **Do not split it into two calls** —
  the comment at `231–233` records that react-router v6 reads `prev` from the
  current URL, so separate calls lose updates.
- Accept and forward `className`, `style`, `aria-label`, `aria-current` and
  children, so no call site changes visually.
- Support the side effects the current `nav` performs — closing the mobile menu
  and dropdowns.

Then convert, in this order, verifying after each: `Navbar` (`219`) including the
logo at `295` and the mobile menu; `Footer` (`8310`); hero and CTA buttons;
product cards and category chips; any in-page "see also" links.

### What you must NOT convert

Only controls that **change the page** become anchors. These stay `<button>`:

- form submits, the search box and its clear control
- dropdown/accordion/menu toggles, including `setOpenDropdown`
- sort headers (Plan 4 owns those)
- anything whose `onClick` does not ultimately call `nav`

Converting a toggle to an anchor breaks its semantics for screen readers and
produces a meaningless `href`. If you are unsure, it stays a button.

### Styling risk

The existing nav buttons carry `background: none; border: none; cursor: pointer;
padding: 0` and Tailwind classes (see `296–306`). An `<a>` has different default
`display`, `color` and `text-decoration`. Expect visual drift, especially in the
flex header at `285–292` and the mobile menu.

The two suites that catch this are `sweep.js` (18 loads, both viewports) and
`overflow.js` (42 product pages at 375 px). Both must stay green — the 375 px
overflow class of bug has already bitten this codebase twice.

### Acceptance

1. On `/` and `/products`, every navigational control is an `<a>` with a
   non-empty `href` — assert **zero** elements matching
   `button[data-nav]`-equivalent, i.e. no remaining button that calls `nav`.
2. `document.querySelectorAll('a[href]')` on `/` yields **at least one link to
   each of the nine routes**, and each `href` matches what `pageToPath` produces.
3. Ctrl-click (and middle-click) on a nav link opens a **new tab at the correct
   URL** and leaves the current page's URL unchanged. Test this explicitly; it is
   the requirement most likely to be silently wrong.
4. Plain click still navigates client-side — **no full page reload**. Assert that
   a module-scope sentinel survives the navigation, or that no `load` event fires.
5. Back/Forward still work across five navigations, including into and out of a
   `?productId=` page. The routing shim's `{ replace: true }` contract must not
   be disturbed.
6. Every `href` resolves to a real route — crawl all of them and assert no 404
   against the `php -S` mirror, which applies the real rewrite.
7. `sweep.js` 18/18, `overflow.js` 0 overflow, `nb4.js` 17/17, `invariants.js`
   15/15, `ttl.js` 3/3.
8. Screenshots at 1440 and 375 of the header, mobile menu and footer, before and
   after, showing no visual change.

---

## Scope boundary

`src/App.jsx`, `index.html`, and nothing else. You are **not** adding a router
library, changing `pageToPath`/`pathnameToPage`, touching `public/.htaccess` —
its rewrite is load-bearing and already correct — adding analytics, or editing
`sitemap.xml`/`robots.txt` (raise it in §2 if you believe they need work).

Do not add `og:image`. `index.html:20` carries a TODO for a 1200×630 card that
does not exist; creating brand imagery is a business decision, not an
engineering one.

---

## Records

`WHATS_LEFT.md`: move 4.1, 4.3, 4.21 (and `seo` if you shipped it) into §1b with
evidence in a §4-series block. If you leave `seo` as-is, say so explicitly and
keep the `AMENDED` line intact.
