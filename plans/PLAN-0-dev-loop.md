# PLAN 0 — Restore the dev loop, and make it exercise real data

**Items:** dev-loop regression (new, my fault), **4.24**
**Depends on:** nothing. **Blocks:** every other plan.
**Effort:** small (under an hour). **Risk:** low, but it touches `vite.config.js`.
**Read [GUARDRAILS.md](GUARDRAILS.md) first.**

---

## Why this is first

Plans 1–5 are all verified by looking at the running site. Right now
`npm run dev` renders **"Catalog Unavailable"** on `/products`, and theming and
editable content silently run on hardcoded defaults. Every downstream plan would
be verified against a lie.

---

## Item A — `npm run dev` shows no products (regression)

### Evidence (confirmed 2026-08-05)

`src/App.jsx:4142`:

```js
const PRODUCTS_JSON_URL = import.meta.env.DEV
  ? "/products-all.json"
  : "/data/products-all.json";
```

The DEV branch resolves against Vite's `publicDir`, which `vite.config.js`
leaves at its default (`public/`). **`public/products-all.json` was deleted in
commit `6284708`** as one of three duplicated catalog copies. The file it points
at no longer exists.

Measured in the browser against `npm run dev`:

```
GET http://localhost:5173/products-all.json?v=29765958 → 200 OK
body: "<!doctype html>\n<html lang=\"en\">…"   (2241 bytes)
console: SyntaxError: Unexpected token '<', "<!doctype "... is not valid JSON
/products renders: "⚠️ Catalog Unavailable"
```

Vite's SPA fallback answers unknown paths with `index.html` and a **200**, so
`res.ok` is `true` and the failure only surfaces when `res.json()` throws.

**Production is unaffected** — the non-DEV branch reads `/data/products-all.json`,
which is served from `public_html/data/`.

### Root cause

The deletion was correct: three copies of the catalog invited overwriting the
customer's live one. The mistake was leaving a DEV branch pointing at a file
that had become the fourth copy.

---

## Item B — 4.24: theming and content are never exercised in dev

`src/App.jsx:4417` and `4587`:

```js
const SITE_INFO_URL = "/data/site-info.json";
const CONTENT_URL   = "/data/content.json";
```

Neither has a DEV branch, and Vite does not serve the repo's top-level `data/`
folder. Both therefore hit the same SPA fallback, both throw in `.then()`, and
both fall into a `.catch()` that keeps the defaults:

- `SiteInfoProvider` — `src/App.jsx:4566`
- `ContentProvider` — `src/App.jsx:4875`, which starts from `contentDefaults`
  (`4871`) and renders children immediately

The result: **`mergeSiteInfo`, `mergeContent`, theming, and every owner-editable
string are never executed locally.** Invariants 3 and 4 both live in that code.
This is why `CLAUDE.md` tells you to run `npx serve .` instead — a workaround
with no HMR that nobody uses.

---

## The fix — one change resolves both

Do **not** restore `public/products-all.json`. That reintroduces the duplicate
catalog the last commit removed, and a stale snapshot silently diverging from
`data/` is worse than no snapshot.

Instead, teach the dev server to serve the real `data/` folder.

### Step 1 — add a dev-only middleware to `vite.config.js`

Add a small plugin that maps `/data/*` onto the repo's top-level `data/`
directory. It must apply to `serve` only, so the production build is untouched.

Requirements, exactly:

- `apply: 'serve'` — never runs in `build`.
- Handle only paths beginning `/data/`. Strip any query string before resolving
  (the app appends `?v=<minute>` as a cache-buster).
- Resolve the path, then **verify the resolved absolute path is still inside the
  repo's `data/` directory** before reading. A `..` in the request must not
  escape. This mirrors the `basename()`+`realpath()` containment the PHP side
  already uses.
- Respond `Content-Type: application/json` and the file bytes. On a miss, `next()`
  so Vite's own 404/fallback handles it.
- Do not add caching headers; the app's cache-buster is enough and stale dev data
  is confusing.

### Step 2 — collapse the special case in `src/App.jsx`

Replace the block at `4142–4144` with a single constant:

```js
const PRODUCTS_JSON_URL = "/data/products-all.json";
```

All three URLs now agree, in both modes, and the `import.meta.env.DEV` branch —
the thing that rotted — is gone. Update the comment above it: it currently
explains the DEV snapshot and will be wrong.

### Step 3 — make a wrong content-type a failure, not a silent default

This is the reason a missing file cost a debugging session instead of showing an
error. In all three fetches, `res.ok` is true for the SPA fallback.

In each of the three `.then()` chains — `useProducts` (`~4300`), `SiteInfoProvider`
(`4566`), `ContentProvider` (`4875`) — reject a response whose `Content-Type`
does not contain `application/json`, routing it to the existing error path.

**Engineering call, already decided:** this is safe in production. A real
`data/*.json` is served as JSON; anything else — an Apache error page, a captive
portal, a misconfigured host returning HTML with a 200 — is exactly the case the
error path exists for. It converts a silent wrong-content failure into the
"Catalog Unavailable" screen that already exists and already tells the visitor
to phone.

Keep the behaviour difference straight: `useProducts` surfaces an error to the
user, while the two providers deliberately **keep their defaults** so the phone
number never disappears (invariant 8). Do not change that — only make the
content-type failure take the same route the existing `.catch()` already takes.

---

## Acceptance criteria

Every one of these must be demonstrated, with the output pasted into the handback.

1. `npm run dev`, then `/products` lists **42 products**, and the network panel
   shows `GET /data/products-all.json?v=… → 200` with
   `content-type: application/json`.
2. Zero console errors on `/`, `/products`, `/contact` in dev.
3. **Prove the content plumbing now runs.** Change one string in
   `data/content.json` — for example a `copy.hero` field — reload dev, and see it
   on the page. **Restore the file from `_harness/pristine/content.json`
   immediately afterwards** and confirm byte-identity:
   `cmp data/content.json _harness/pristine/content.json`.
4. **Prove theming now runs.** Same procedure with a `theme` color in
   `data/site-info.json`. Restore and `cmp` afterwards.
5. Temporarily rename `data/products-all.json`; `/products` shows "Catalog
   Unavailable" rather than a silent empty list. Rename it back.
6. `npm run build` succeeds and `dist/assets/*.js` contains **no** reference to
   `"/products-all.json"` as a root-level path.
7. Full regression baseline from GUARDRAILS §4.1 — all green.

---

## Scope boundary

You are changing `vite.config.js` and three constants plus three fetch
error-paths in `src/App.jsx`. You are **not**:

- restoring any deleted `products-all.json`,
- changing what `dist/` contains or how it is built,
- touching `mergeContent` or `mergeSiteInfo` (Plan 1 and the invariants own those),
- "improving" the fetch/caching layer beyond the content-type check,
- editing `data/*.json` as anything other than a temporary, restored-and-verified
  test.

---

## Records

Add to `WHATS_LEFT.md` §1b: 4.24 shipped, plus a line naming the dev-loop
regression introduced by `6284708` and fixed here. Put the measurements in a
§4-series evidence block. Remove the "Local dev gotcha" section from `CLAUDE.md`
— it documents the `npx serve .` workaround this plan makes obsolete — and say
in the handback that you did.
