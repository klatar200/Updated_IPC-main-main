# PLAN-9 — Remediating the 2026-08-09 audit

**Audience:** the agent executing this plan, in a fresh session with no memory
of the audit.
**Status:** ready to execute. Binding rules: `plans/GUARDRAILS.md` — this plan
adds constraints and never relaxes one.
**Written:** 2026-08-09, against `main` @ `6ab9237` (the merge of PR #22, which
added the audit report and its probes).
**Source of every item:** `_harness/AUDIT-REPORT-2026-08-09.md` — six findings,
each CONFIRMED with a runnable probe. The probes are in the repo
(`_harness/aud9-*.js`) and are your failing-first tests. Nothing in this plan
is speculative; every "Evidence" block below was measured twice.

---

## 0. Orientation — read exactly this, in this order

Your context is finite. Read these and stop:

1. `CLAUDE.md` — architecture + the 12 invariants. Each names a real incident.
2. `plans/GUARDRAILS.md` — §1 scope discipline, §2 hard prohibitions, §4
   verification, §5 working rules, §6 records.
3. `_harness/AUDIT-REPORT-2026-08-09.md` — the findings you are fixing, with
   file:line evidence and reproduction steps.
4. `_harness/README.md` — how the harness works, what `sync.sh` does, the two
   things that have bitten before.

Do **not** read `WHATS_LEFT.md` end-to-end (274 KB). You need only: §2 (open
items — so you don't duplicate a record), and §4s (the C29/C33 records this
plan supersedes in part). Do not read `DEPLOY_READINESS_v2.md`,
`AUDIT_v3_FINDINGS.md`, or the older plans unless a specific item points you
there.

### Stand the environment up

Run everything from the repo root.

```sh
npm install
npm run build && sh _harness/sync.sh
php -S 127.0.0.1:8123 -t _harness/site -c _harness/php-mail.ini  _harness/router.php &
# :8124/:8125 only if you re-run plan2-trunc:
php -S 127.0.0.1:8124 -t _harness/site -c _harness/php-trunc.ini   _harness/router.php &
php -S 127.0.0.1:8125 -t _harness/site -c _harness/php-nb2-off.ini _harness/router.php &
```

- The mirror admin password is `audit-pass-123` (written by `sync.sh` →
  `setpw.php`).
- **Re-run `sh _harness/sync.sh` after every `npm run build` and every edit
  under `admin/`.** A stale mirror has produced false passes before.
- Launch Chromium only via `_harness/browser.js`. Never `playwright install`.

### The regression baseline you inherit

Run the full suite list **before touching anything** (§6 below has the exact
command). Expected at `6ab9237`: everything green at the scores in the audit
report's *Regression state* section, except exactly three:

| Suite | Expected | Why |
|---|---|---|
| `plan8-contrast` | 34/35 | one named `EXEMPT_BRAND_SURFACE` exemption |
| `plan8-polish` | 16/17 **on Linux** | the C49 spec-table check is font-metric dependent; `system-ui` → DejaVu Sans is ~21% wider. Verify with `fc-match system-ui` before treating it as real |
| `brandtext` | 11 failing (ratchet ≤ 13) | logged open item `brand-accent-on-dark-surfaces`. Judge by the FAILING count, not the ratio — the scored-combination count wobbles ±1 |

If you inherit any other red, **stop and say so before fixing anything**.

---

## 1. Guardrails specific to this plan — read twice

1. **Execute exactly the six items below. Nothing else.** If you find another
   defect while working: do not fix it; append it to `WHATS_LEFT.md` §2 with
   date, evidence, file:line; mention it in the handback. Renaming,
   reformatting, extracting helpers beyond what an item specifies, and
   "while I was here" tidying are all straying.
2. All of GUARDRAILS §2 applies verbatim. In particular: never edit
   `data/*.json`, `pdfs/`, `uploads/`, `_localsite/`, or
   `DEPLOY_READINESS_v2.md`; never `git checkout`/`reset`/`stash`/`revert`/
   `rebase`/force-push; never commit `admin/config.local.php`; never put a
   real hash in `admin/config.php`; never use `preg_replace` on anything
   writing a bcrypt hash.
3. **Do not add or remove a single form field in `admin/content.php`.** The
   posted-variable count is **446** and `form_complete` must remain the LAST
   control (invariant 6, enforced positionally). Item 1 changes *values*
   fields are prefilled with, not the field set. After item 1, re-run
   `plan2-formlast` and `plan2-trunc` (needs :8124/:8125) to prove it.
4. **Do not edit the `_harness/aud9-*.js` probes.** They are the audit's
   evidence. Copy what you need into new `plan9-*.js` suites. It is expected
   — and required — that `aud9-clearrepro.js` and `aud9-meta.js` flip from
   demonstrating the defect to demonstrating its absence *without their code
   changing*; that is what makes them proof.
5. **Every new suite must fail first.** Run it against the unmodified tree,
   watch it fail for the audited reason, then fix. A check that has never
   failed proves nothing — two invariant checks once passed against a broken
   assertion here (GUARDRAILS §4.4). Mutation-proof each new suite: revert
   the fix (in the working tree, temporarily), watch the suite fail, restore.
   Show both runs in the handback.
6. **Measure in the browser, not in the source.** Every acceptance below that
   is about what renders or what a crawler reads is measured through :8123
   with Playwright — the audit's three anti-hallucination incidents all came
   from reasoning forward from source.
7. **The Tailwind extractor scans raw source text, comments included.** A bare
   utility word (`hidden`, `flex`, `border`…) as an identifier or in a comment
   emits that rule into the shipped CSS. It has fired seven times, four inside
   comments. After every build run `node _harness/cssdiff.js` (first run:
   `--save` on the untouched tree before your first edit, then plain runs — 0
   added selectors expected).
8. **`mergeContent`'s clearable semantics are settled — do not touch them.**
   Item 1 is fixed on the **admin side only**. `COPY_CLEARABLE`
   (`src/App.jsx`, search `const COPY_CLEARABLE`), invariant 3 (empty array =
   deletion) and invariant 4 (blank-drop + `SITE_CLEARABLE`) must be
   byte-identical when you finish. `node _harness/invariants.js` → 17/17.
9. **One specific trap in item 1, stated up front:** do NOT combine the
   prefill fix with a save-side "skip absent+empty keys" guard. The two
   together break deliberate clearing (see item 1, *What not to do*). One
   mechanism, not two.
10. **Records are append-only.** `WHATS_LEFT.md`: supersede with
    `SUPERSEDED-BY` + date, never rewrite. Item 2 supersedes one recorded
    sentence — §7 tells you exactly which and what to write.
11. **Escalate business calls; decide engineering calls.** The only judgement
    call in this plan is item 4's visual choice, and it has a stated
    recommendation. Escalation format:
    `decision-needed | recommended | why | trade-off | blocked`.
12. **Fix loops: 3 attempts, then stop and report** what you tried, what you
    observed, what you now believe. Delta-only fix rounds.

---

## 2. Execution order and why

**1 → 2 → 3 → 5 → 4 → 6.**

Item 1 is the severity-A and touches only `admin/content.php` + `lint.php` +
one new suite — land it first and alone. Items 2 and 3 share
`ProductPage`/`PageMeta` and item 3's acceptance assumes item 2's render
change; do 2 then 3, verify together. Item 5 is a five-call-site render
helper. Item 4 is one class on one element. Item 6 is one documentation line.
Commit per item (or per 2+3 pair), so a red suite bisects to one change.

---

## 3. Item 1 · [A] — The first Page Content save must stop deleting the marketing photographs

### The defect (audit finding 1 — CONFIRMED twice, screenshots in `_harness/out/aud9/`)

The shipped `data/content.json` predates PLAN-7 item 3a: it has **no
`copy.siteImages` key**. In `admin/content.php`:

- the prefill renders every copy field with `?? ''`
  (search: `render_copy_field($g, $f, ($content['copy'][$g][$f['key']] ?? '')` — line ~956),
- the save loop writes **every configured field** back with `?? ''`
  (search: `as_str($_POST['copy'][$g][$f['key']] ?? '')` — line ~588).

So the five *Site Images* fields render empty, and Rick's first save — of
anything, a stray space in a heading is enough — materializes
`siteImages: {heroPhoto:"", …}`. Because `.*Photo` is in `COPY_CLEARABLE`,
`mergeContent` keeps those blanks as **deliberate deletions**: the hero photo,
the entire homepage band section, the About photo and the Services photo all
vanish under a green "✅ Content saved".

Measured: photos 3 → 0, band section gone, on one save appending a single
space to *Headline line 1*. Reproduce with `node _harness/aud9-clearrepro.js`
(it restores the mirror afterwards).

Why no suite sees it: `plan7-slots` *intercepts* `content.json` rather than
saving through the admin; `copyroundtrip` saves through the admin (and clears
the photos in passing) but restores from pristine before asserting.

### The fix — admin-side defaults for the five photo fields

In `admin/content.php`:

1. Add a `'default'` entry to each of the five `siteImages` field configs in
   `$COPY_GROUPS`, with values **byte-identical** to
   `COPY_DEFAULTS.siteImages` in `src/App.jsx` (search `siteImages: {`):

   ```
   heroPhoto          images/site/Marker-Sample-2.jpg
   bandTeamPhoto      images/site/staff.jpg
   bandBuildingPhoto  images/site/IPC-Building.jpg
   aboutPhoto         images/site/IPC-Building.jpg
   servicesPhoto      images/site/Marker-Sample-2.jpg
   ```

2. Prefill with the default **only when the key is absent from the stored
   file**: `$content['copy'][$g][$f['key']] ?? ($f['default'] ?? '')`.
   `??` is correct here: a stored `""` (a real clearing) is set, so it shows
   empty and stays cleared — only a missing key falls back.

3. The save loop stays exactly as it is. After the first save the file holds
   the explicit default paths — same pixels on the site, and now Rick can see
   and edit the live values, which the audit noted the admin could not show
   him.

4. **Guard the duplication.** The five path strings now exist in PHP and JS.
   Extend `_harness/lint.php`'s drift section (same pattern as the existing
   `family drift` / `approval drift` checks) with a `photo-default drift`
   check: parse both sides, assert the five (key → value) pairs are
   identical. This check must be capable of failing — prove it by mutating
   one PHP value and watching lint go red, then restoring.

### What NOT to do

- **Do not also add a save-side "if posted empty AND key absent from stored
  file, omit the key" guard.** With the prefill in place, an empty POST for a
  photo field means Rick deliberately cleared the prefilled value in his
  first session — the guard would resurrect the photo he just deleted, which
  is precisely the failure mode `COPY_CLEARABLE` exists to prevent. One
  mechanism: prefill.
- Do not touch `COPY_CLEARABLE`, `mergeContent`, or any `src/` code for this
  item. The site half is correct.
- Do not add hidden fields, change field order, or move `form_complete`.
- Do not "fix" the shipped `data/content.json` by adding the key there —
  `data/` is off-limits (GUARDRAILS §2) and the admin fix covers every
  content.json vintage, not just the shipped one.

### Acceptance — new suite `_harness/plan9-firstsave.js`

Derive from `aud9-clearrepro.js` (copy, don't edit the original). It must:

1. Copy `_harness/pristine/content.json` over `_harness/site/data/content.json`
   (the pre-3a shape), assert `copy.siteImages` is absent.
2. Assert `/` paints 3 `images/site/` photos at 1440.
3. Sign in, open `content.php`, assert the five Site Images inputs are
   prefilled with the five default paths (not empty).
4. Append one space to one heading, Save, assert the green banner.
5. Assert `/` still paints 3 photos and the band section survives.
6. Assert `content.json` now holds the five keys with the default paths.
7. **Clearing still clears:** empty `bandTeamPhoto` in the form, Save, assert
   the team figure is gone from `/` and no empty framed box remains
   (`plan7-slots` has the exact emptiness assertion to copy).
8. Restore the mirror from pristine on the way out, byte-identical.

Run order proof: run it against the unmodified tree first → steps 3/5/6 fail
for the audited reason. Then fix, then 8/8. Then re-run: `invariants` (17/17),
`plan2-formlast` (8/8), `plan2-trunc` on :8124/:8125 (13/13, content.json
byte-identical to pristine after), `copyroundtrip` (15/15), `plan7-slots`
(16/16), `plan4-admin` (19/19), `php _harness/lint.php` (with the new drift
line green), and `node _harness/aud9-clearrepro.js` — its VERDICT line must
now read `photos before=3 after=3; band before=true after=true`.

---

## 4. Item 2 · [B] — A failed product lookup shows the catalog it promises, not `products[0]`

### The defect (audit finding 2 — CONFIRMED twice)

`/products?productId=NOPE-XYZ-123` renders the amber banner *"We couldn't
find part … **Showing the catalog instead** — pick a part from the list"* —
above the **full detail page for CC** (the first product), and on scroll the
sticky RFQ bar slides in quoting `CC … Request a Quote →`. The buyer is told
catalog, shown somebody else's part, and offered a quote for it.

In `src/App.jsx` (`function ProductPage`, search these exact strings):

- `const product = selectedId ? matched || products[0] || null : null;` — the
  fallback (line ~8682);
- the banner copy `Showing the catalog instead` (line ~8832);
- `{landing ? (<CatalogLanding …>) : (<ProductDetail …>)}` (line ~8878);
- the header `<h1>`/`div` branch on `landing` (line ~8792).

The `products[0]` fallback is a recorded C29 decision ("needs something behind
it") made when the catalog landing did not exist as a state; the banner copy
predates C29 and now promises exactly the landing C29 built. Resolve in the
direction of the copy: the landing exists — show it.

### The fix

All in `ProductPage`:

1. `const product = matched;` — no fallback. (`matched` is already
   `null`-safe everywhere below: `crumbTrail` guards on `!product`, the
   sticky bar is `{product && …}`, `ProductSidebar` takes
   `product ? product.id : null`.)
2. Render the landing on the not-found path:
   `{landing || notFound ? <CatalogLanding …> : <ProductDetail …>}`.
3. The page header currently makes the heading a real `<h1>` only on
   `landing`. With `notFound` no longer rendering a `ProductDetail` (which
   held the page's `<h1>`), the not-found page would have **no h1 at all**.
   Change both the heading branch and the sub-line branch from `landing` to
   `landing || notFound`. Do not change the A3 comment's reasoning — extend
   it with one line saying the not-found path joins the landing state.
4. The banner text does not change. It becomes true.

### What NOT to do

- Do not change the match ladder (`exact → sku → normalizeSku →
  skuSegmentMatch`) — that is item 3's territory and even there it moves, it
  is not edited.
- Do not change the banner wording (public-facing copy; it is correct once
  the render matches it).
- Do not touch the empty-catalog early return (`if (!products.length)`).

### Acceptance — first half of new suite `_harness/plan9-notfound.js`

Against `/products?productId=NOPE-XYZ-123` at 1440:

1. The amber `role="alert"` banner renders with the existing copy.
2. The catalog grid renders: 42 `[data-ipc-catalog-card]` links (the landing
   already tags its cards — search `data-ipc-catalog-card`).
3. **No** `ProductDetail` content: zero elements from CC's detail (assert the
   detail `<h1>` "Nonmetallic Liquid-tight Conduit Coupling" is absent, and
   the page `<h1>` is "Product Catalog").
4. After `scrollTo(0, 1200)` + 900 ms, **no** fixed bottom bar exists.
5. Control: `?productId=CC` still renders the detail, its sticky bar, and
   `plan8-landing` (18/18), `plan8-crumbs` (22/22), `plan8-catalog` (16/16)
   still pass — the landing/detail split must not regress the exact-id path.

Fail-first: steps 3 and 4 fail against the unmodified tree.

---

## 5. Item 3 · [B] — One product-matching definition; honest metadata on alias and unknown ids

### The defect (audit finding 3 — CONFIRMED twice)

`ProductPage` matches a `?productId=` four ways; `PageMeta` matches **exact id
only** and hands the **raw param** to `canonicalFor()`. Measured consequences
(`node _harness/aud9-meta.js`):

- `?productId=cc` → renders CC's full detail, but `<title>` is the generic
  "Product Catalog — …", and `<link rel="canonical">` is
  `…?productId=cc` — a self-canonical duplicate of the real CC page.
- `?productId=NOPE-XYZ-123` → self-canonical, **no `noindex`** — an indexable
  soft-404 with an unbounded URL space. The repo's own records call this
  exact shape an error (PATCH_NOTES A5: "a canonical on a soft 404 is the
  half-fix that looks done") — A5 fixed it for unknown path *segments* only.
- The `BreadcrumbList`'s trailing item (built from the *matched* product)
  contradicts the page canonical on both cases — violating C33's own
  acceptance ("the trail's last item equals the page's own canonical, byte
  for byte"). `plan8-crumbs` passes because it only visits exact ids.

Relevant code (`src/App.jsx`, search anchors):

- the match ladder in `ProductPage` (search `No blind fall-through`);
- `normalizeSku` / `skuSegmentMatch` definitions (search
  `function normalizeSku`);
- `PageMeta`'s exact-only lookup (search `the product this URL is actually
  about`);
- `const canonical = canonicalFor(page, productId);` in `PageMeta`;
- the A5 branch (search `an unknown segment gets`);
- `Breadcrumb`'s LD emission (search `breadcrumb-ld`).

### The fix

1. **Extract one matcher.** Beside `normalizeSku`/`skuSegmentMatch`, add
   `function findProductByParam(products, raw)` containing the exact ladder
   currently inlined in `ProductPage` (move, don't rewrite — the comments on
   the ladder carry incident references and move with it). `ProductPage` and
   `PageMeta` both call it. This is the same one-definition rule C33 applied
   to the canonical, for the same reason: two constructions is how they
   drift.
2. **Alias URLs canonicalize to the real product.** In `PageMeta`:
   `const matched = productId ? findProductByParam(products, productId) : null;`
   - When `matched` (exact or alias): title/desc/og from `matched` (the
     existing A3 block — it already reads from `product`, rename carefully),
     and `canonical = canonicalFor(page, matched.id)` — the **matched id**,
     not the raw param. `?productId=cc` then declares
     `…?productId=CC`, agreeing with the BreadcrumbList byte for byte.
   - Exact-id behaviour is unchanged (`matched.id === productId`).
3. **Unknown ids become honest soft-404s**, mirroring A5:
   `const unknownProduct = !!productId && !matched;`
   - title: `Part not found — ${site.company.name}`; empty description.
   - `noindex` + canonical tag removed + no `og:url` — extend the existing
     A5 branch condition (`unknownRoute || unknownProduct`) rather than
     duplicating it, and extend its comment by one line.
4. **No structured breadcrumb data on the soft-404.** With item 2, the
   not-found page's trail is `Home › Product Catalog` (product is null). Give
   `Breadcrumb` an `ld` prop defaulting to `true`; `ProductPage` passes
   `ld={!notFound}`. The visible nav stays; only the `#breadcrumb-ld`
   `<script>` is suppressed — the records' principle is about structured
   data, not the human affordance.

### What NOT to do

- Do not "improve" the ladder (e.g. fuzzy matching) — move it verbatim.
- Do not redirect alias URLs; the canonical tag is the declared mechanism
  site-wide (A3/C33). No new routing behaviour.
- Do not touch `public/sitemap.php` — it emits exact ids only and is correct.
- `useProducts()` must not gain a second call site (its mount-once assumption
  is documented at its definition); `PageMeta` already receives `products` as
  a prop — use it.

### Acceptance — second half of `plan9-notfound.js`, plus `_harness/plan9-meta.js`

`plan9-meta.js` derives from `aud9-meta.js` and asserts, at 1440:

| URL | title | canonical | robots | breadcrumb-ld last item |
|---|---|---|---|---|
| `?productId=CC` (control) | CC's product title | `…?productId=CC` | absent | `…?productId=CC` |
| `?productId=cc` | CC's product title | `…?productId=CC` | absent | `…?productId=CC` |
| `?productId=ip12ga-ip1274` | that product's title | `…?productId=IP12GA%20-%20IP1274` | absent | same as canonical |
| `?productId=NOPE-XYZ-123` | `Part not found — …` | **no tag** | `noindex` | **no #breadcrumb-ld node** |

Plus: `og:url` equals the canonical where one exists and is absent on the
soft-404; and for every one of the **42** exact ids, canonical ==
breadcrumb-ld last item (loop, not spot-check — reuse `plan8-crumbs`'s
extraction code).

Fail-first: all three non-control rows fail against the unmodified tree.
After the fix, `node _harness/aud9-meta.js` (unedited) must show the new
values. Re-run `plan8-meta` (15/15), `plan8-crumbs` (22/22),
`plan5b-sitemap` (9/9), `plan5c-sitemap` (17/17) — no URL moved.

---

## 6. Item 5 · [C] — Slot paths must survive a trailing-slash URL

*(Ordered before item 4 because it is mechanical and item 4 is judgement.)*

### The defect (audit finding 5 — CONFIRMED twice)

The five slot defaults are **relative** paths (`images/site/…`,
`COPY_DEFAULTS.siteImages`). On `/about/` (trailing slash — external links
and typed URLs; the site itself never emits one) the browser resolves
`/about/images/site/IPC-Building.jpg`, the SPA rewrite answers it with 200
`text/html`, and a broken 745×496 frame paints. `/about` is fine. The app
itself boots (built assets are absolute), the canonical points at `/about` —
the blast radius is exactly the photographs. Product `photoUrl`s start with
`/` and are immune.

### The fix

One helper in `src/App.jsx`, defined once near `COPY_DEFAULTS`:

```js
// Owner-typed and default slot paths are site-relative ("images/site/…").
// Resolve them against the site root, not the current URL: on a
// trailing-slash URL ("/about/") a relative src resolves under /about/ and
// the SPA rewrite answers it with index.html — a broken frame where the
// photograph belongs. Absolute http(s) and root-relative values pass through.
```

`slotSrc(p)`: return `p` unchanged when falsy, when it starts with `/`, or
when it matches `/^[a-z]+:/i` (http:, https:, data:); otherwise `'/' + p`.
Apply it at the **five render sites only** — hero `<img src>` **and** its
`<source srcSet>` (two attributes, one element pair), band team, band
building, About, Services. Defaults and stored data stay untouched — the
helper also fixes every path Rick types later without a leading slash.

### What NOT to do

- Do not edit the five default strings (pointless churn once the helper
  exists, and the admin prefill from item 1 must stay byte-identical to
  them).
- Do not generalize the helper to product photos, logos, or PDFs — they are
  root-relative already; out of scope.
- Watch guardrail 7: the helper's comment must not contain bare Tailwind
  utility words.

### Acceptance — `_harness/plan9-slots-slash.js`

At 1440, for `/about/`, `/services/`, and `/` (control `/about` too):

1. Every `images/site/` request answers 200 with `image/*` content-type
   (intercept responses — the content-type clause is the load-bearing half,
   per the VALUE-ADDED pdf incident).
2. Every painted `images/site/` `<img>` has `naturalWidth > 0`.
3. An `https://…` override still passes through untouched: serve a patched
   `content.json` (route-interception pattern from `plan7-slots.js`) with
   `bandTeamPhoto: "https://example.invalid/x.jpg"` and assert the rendered
   `src` is exactly that URL (it will fail to load — assert the attribute,
   not the paint).

Fail-first: assertions 1–2 fail on `/about/` against the unmodified tree.
Re-run `plan7-imagery` (11/11), `plan7-slots` (16/16), `plan5-images`
(12/12) after.

---

## 7. Item 4 · [C] — The building card must not be half empty

### The defect (audit finding 4 — CONFIRMED, screenshots)

Homepage band, `md:grid-cols-3` (search `PLAN-7 item 2, slot 2` /
`bandTeamPhoto ?` in `HomePage`): the team figure spans two columns, so its
16:9 image sets a ~477px row; the building image is 16:9 **of one column**
(~231px at 1440) and its bordered `<figure>` stretches to the full row —
**246px of empty bordered card** below the photo at 1440, 189px at 1024,
141px at 768. It reads exactly like C44's "a link that had failed to load".
Screenshot: `_harness/out/aud9/band-default-1440.png`. Below 768 the grid is
single-column and unaffected.

### The fix (recommended) — the figure hugs its image

Add `md:self-start` to the **building** figure's className. The figure then
sizes to its content; the space below becomes plain `#f5f7fa` section
background — ordinary whitespace instead of an empty framed card. Nothing
else moves (the row height is set by the team figure either way).

This is the one judgement call in the plan. The rejected alternatives, so you
don't re-derive them: stretching the image to fill (`h-full` + cover) crops a
425×281 source to a ~411×475 portrait — a 1.7× upscale of a photograph
already at its resolution ceiling (PLAN-7 §0 measured this class of harm);
matching aspect ratios has the same upscale problem. If you believe
`md:self-start` is wrong after seeing it rendered, escalate with the
before/after screenshots rather than choosing a third option.

### Acceptance — `_harness/plan9-band.js`

Derive from `aud9-band.js`. At 1440, 1024, 768: for both band figures,
`figure.height − img.height ≤ 4px`. At 390: unchanged (single column,
already true). Screenshot before/after at 1440 into `_harness/out/plan9/`.
Fail-first: the building row fails at all three widths on the unmodified
tree. Re-run `plan7-imagery` (11/11) and `node _harness/cssdiff.js` (adding
`md:self-start` legitimately adds that one utility — record it; anything
else added is guardrail 7 firing).

---

## 8. Item 6 · [C] — CLAUDE.md must stop documenting the old Vite base

### The defect (audit finding 6)

`CLAUDE.md` (React side bullet) says **"Vite config sets `base: './'`"**;
`vite.config.js:98` sets `base: '/'` and `dist/index.html` emits absolute
`/assets/…` URLs. The change is recorded in PATCH_NOTES ("`base` is `'/'`
now" — it fixed a blank-page-at-depth defect) but CLAUDE.md was never
updated, and a future session trusting it will reason wrongly about URL
resolution — the audit nearly did.

### The fix

Edit the one bullet in `CLAUDE.md` to: **Vite config** sets `base: '/'`
(changed from `'./'` in PLAN-8 A5 — relative asset URLs broke deep links).
Nothing else in CLAUDE.md changes.

### Acceptance

`grep -n "base" CLAUDE.md vite.config.js` shows the two agree. No suite.

---

## 9. Regression gate — before you start, after every item, and at the end

```sh
php _harness/lint.php
node _harness/run.js invariants invariants-selftest copydrift-selftest \
  copyroundtrip contrastparity skuparity deadlinks backdrop-selftest \
  plan2-formlast plan2-sku plan2-delete plan2-contrast plan2-trunc \
  plan3-contact plan4-admin plan4-public plan5-keys plan5-spectable \
  plan5-images plan5-social plan5b-sidebar plan5b-sitemap plan5c-sitemap \
  plan5c-eyebrow plan5c-brandink plan6-families plan7-approvals \
  plan7-datasheets plan7-imagery plan7-slots plan8-certs plan8-meta \
  plan8-catalog plan8-lead plan8-motion plan8-chrome plan8-keyboard \
  plan8-mobile plan8-faq plan8-crumbs plan8-landing plan8-formpolish \
  plan8-contrast plan8-polish brandtext
```

Green means: every suite at its documented score, the three expected
exceptions at exactly `34/35`, `16/17` (Linux/DejaVu only, and only the C49
spec-table check), and `brandtext ≤ 13 failing`. Plus, when you finish:

- the five new suites (`plan9-firstsave`, `plan9-notfound`, `plan9-meta`,
  `plan9-slots-slash`, `plan9-band`) green, each with a recorded fail-first
  run and a mutation proof;
- `node _harness/aud9-clearrepro.js` → `photos before=3 after=3`;
- `node _harness/aud9-meta.js` → the item-3 acceptance table's values;
- `node _harness/cssdiff.js` → only the one recorded selector from item 4;
- `git status` clean of everything except your intended edits — and
  `_harness/site/admin/config.local.php` deleted before you hand back.

The ratchets you must not worsen: `page-header-sublines-on-gradient` 18,
`brand-text-on-brand-surface` ≤ 13 failing, `product-index-rows-over-120px`
3 of 42.

---

## 10. Records — write these as you land each item

Per GUARDRAILS §6 (append-only, supersede-don't-rewrite):

1. **`WHATS_LEFT.md` §1-series:** a new `## 1j. Shipped in PLAN-9` block —
   one entry per item with the measured before/after (photos 3→0→3; the
   metadata table; the 246px strip; the /about/ broken frame).
2. **`WHATS_LEFT.md` §2:** nothing in §2 closes — these were new findings,
   not logged items. If you strayed into finding something new, it lands
   here instead of in code.
3. **`WHATS_LEFT.md` §4-series:** a `## 4t. Verification evidence for PLAN-9`
   block: each suite's fail-first output, the mutation proofs, and the
   before/after regression table.
4. **The C29 supersession (item 2):** find the §4s C29 bullet reading
   "A **bad** `?productId=` still does [fall through to `products[0]`],
   because that path shows the not-found banner and needs something behind
   it." Append beneath it (do not edit the original):
   `SUPERSEDED-BY PLAN-9 item 2 (2026-08-09): the landing now stands behind
   the banner — the fallback rendered a different product's detail (with its
   RFQ bar) under copy promising the catalog; audit finding 2.`
5. **`PATCH_NOTES.md`:** a new dated section in the house voice — plain
   sentences about what a visitor/Rick would have hit, one per item.
6. **`CLAUDE.md`:** only the item-6 line. Do not add a PLAN-9 section —
   CLAUDE.md is constraints, not history.

---

## 11. Handback format

Per GUARDRAILS §8, in order: **Fixed** (file → change → proving artifact per
item) · **Not fixed and why** · **Escalations** (five-field form) · **Records
corrected** · **Regression state** (§9 table before and after, the three
expected exceptions called out). State plainly anything you did not do.

## 12. Stop conditions

- Any inherited red beyond the three expected → stop before fixing anything.
- Any fix that would require touching `COPY_CLEARABLE`, `mergeContent`,
  `mergeSiteInfo`, or any CLAUDE.md invariant → stop, escalate as a
  question. Twelve invariants exist because someone "simplified" one back.
- Three failed attempts on any one item → stop, report, move on only if the
  remaining items are independent (they are, except 2→3).
- The plan is six items. A seventh idea, however good, goes to
  `WHATS_LEFT.md` §2 and the handback — not into code.
