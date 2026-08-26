# Audit 7 — pre-launch stability audit

**Date:** 2026-08-26
**Base:** `ff62280` — `main` immediately after PR #50 merged the audit-6 work.
**Brief:** a complete stability audit ahead of go-live. No structural or UI
changes; close the errors and gaps that remain.
**Probe:** [`_harness/audit7.js`](../_harness/audit7.js), written against the
unfixed tree and watched to fail (GUARDRAILS §4.4).

---

## 0. The inherited state

The full suite was run **first**, before anything was read for findings, so
that nothing below could be a regression this session introduced.

```
php _harness/lint.php     php -l 19/0 · node --check 10/0 · JSON 17/10/42
                          copy drift 110 matched · 11 families · 12 approvals
                          · 5 photo-slot defaults · 14 audit actions
                          · doc drift 46 refs resolve · section drift 56, none reused
                          · href guard drift 2 fields, both sides
npm run build             0 errors, 375.51 kB JS / 23.59 kB CSS
invariants                17/17        invariants-selftest   15/15

76 suites run in two batches. Every suite green except the two documented
expected-reds:
  plan8-polish            16/17  ← EXPECTED RED (DejaVu width artifact, Linux)
  brandtext               36/47  ← EXPECTED RED (11 failing; ceiling 13)
  plan8-contrast          34/35  ← its documented PASSING state (EXEMPT_BRAND_SURFACE)
```

Nothing here is a regression. Everything below is an area the suites were
never written to cover.

**PHP compatibility was re-checked rather than assumed.** `CLAUDE.md` targets
PHP 7.4+; this container runs 8.4. All 19 files parse clean under both readings:
no `str_contains`/`str_starts_with`/`?->`/`match()`/attributes (which would
break 7.4), and no implicit-nullable parameter declarations (which PHP 8.4
deprecates and would print a notice on a host with `display_errors` left on).
Arrow functions (`fn() =>`) are the newest construct in the tree and are 7.4.

**The shipped bundle was re-checked too:** production React, no source maps, no
`localhost`/`TODO` strings, `console.error`/`console.warn` only.

---

## 1. Findings

Three findings, and all three are the same shape:

> **a fix that was applied to one half of its own surface.**

That is not a coincidence — it is what is left after six rounds. The obvious
defects are gone; what survives is the second call site of a rule that was
written once, and the second file that a one-line guard never reached. Each one
below names the fix it completes.

Nothing here is a new hardening class. A finding that would have *invented* a
rule rather than finished one is listed in §3 as considered-and-not-taken.

### A-7.1 — HIGH — the spec-table shape gate was write-side only, and a backup restore walks straight past it

`audit-runs/audit5.md` **A-5.12** — *"a malformed-but-savable spec table crashes
the product page"* — was closed on 2026-08-18. `grep -rn 'A-5.12'` finds the
marker in `admin/add.php`, `admin/edit.php` and `admin/config.php`. It finds it
in **no JSX**. The renderer was never touched.

That is the same reasoning this codebase already rejected, in writing, for
`pdfUrl`. From the L4 comment above `safeHref()` in `src/App.jsx`:

> `pdfUrl` and `additionalPdfs[].url` are gated where they are WRITTEN … but not
> where they are rendered, which is the same argument A1 rejected for the footer
> link: **data/ is a plain file, so an FTP edit or a backup restored from before
> those gates existed reaches the component with nothing in between.**

For spec tables the consequence is worse than a dead link, and the reachable
path needs no FTP at all:

- `admin/backups.php:25-29` restores the catalog by calling
  `save_products($products)` directly.
- `save_products()` (`admin/config.php:796`) sorts by SKU, encodes, and writes.
  It runs **none** of the form-level shape checks — those live in the `add.php`
  and `edit.php` POST handlers, which a restore does not go through.
- `BACKUP_KEEP` is **90 per prefix**. Every backup written before 2026-08-18
  predates the A-5.12 gate and carries the pre-gate shape.

So: the owner opens Backups, clicks Restore on a version from before the gate
landed, gets a success message — and the product page is gone.

**Measured** (`_harness/audit7.js`, 16/28 before the fix). Six shapes, each with
an untouched neighbouring product as a control on the same catalog load:

| Arm | Shape written into the catalog | Before |
|---|---|---|
| `T2-FLAT` | `specTable2.rows = ["8.0","9.0"]` — A-5.12's own repro | ErrorBoundary, no `<h1>` |
| `T2-NULLROW` | `specTable2.rows = [null]` | ErrorBoundary, no `<h1>` |
| `T2-NULLCOL` | `specTable2.columnSpans = [null]` | ErrorBoundary, no `<h1>` |
| `T1-NULLROW` | `specTable1.rows = [null]` | ErrorBoundary, no `<h1>` |
| `T1-OBJVAL` | `specTable1.rows = [{label:{},value:{}}]` | ErrorBoundary, no `<h1>` |
| `PDF-NULLROW` | `additionalPdfs = [null]` | ErrorBoundary, no `<h1>` |

In all six the **control product rendered correctly on the same load**, and the
navbar and footer survived — so this is a contained per-page crash, not the
whole-root unmount that L2 fixed. One product page, gone, for a buyer
evaluating a spec-grade part.

`/datasheets` was checked in the same pass and does **not** crash on
`additionalPdfs = [null]`; only the two product-page render sites do.

### A-7.2 — MEDIUM — the fetch timeout reached one of the three files it protects

`PRODUCTS_FETCH_TIMEOUT_MS` (12 s, `AbortController`) exists because of
`DEPLOY_READINESS_v2` **T2.1**: *"An origin that accepts the connection and then
hangs used to leave the site on the loading skeleton forever, with no error and
no retry."*

It is applied in `fetchProductsCached()` and nowhere else. `site-info.json` and
`content.json` — the same three files, in the same folder, from the same origin
— are fetched by `useRefetchOnReturn()`, which had a bare `fetch()`.

A hang there does not blank the chrome; the providers already render defaults,
which is invariant 8 doing its job. The cost is subtler and compounding:
`last` is stamped when the fetch **starts**, so every visibility change past the
TTL opens another request that will also never settle. Six of those exhaust the
browser's per-origin connection pool, and the next request to queue is whichever
one the visitor needs — including the catalog fetch, whose own 12 s abort cannot
fire before it has a socket to abort.

**Measured**, with the guarded fetch as the control. The origin is routed to a
handler that accepts and never responds; after 15 s the browser is asked what
became of each request:

```
                                    BEFORE            AFTER
catalog     (has the 12 s guard)    failed            failed      ← CONTROL
site-info   (useRefetchOnReturn)    pending           failed
```

The control matters: if the catalog request had *not* aborted, the probe would
be measuring something other than the timeout.

### A-7.3 — MEDIUM — `npm audit fix` was recommended twice and never run

`WHATS_LEFT.md` §2k *Corrected records* and §2l *Carried forward* both say the
same thing:

> Recommendation: take the free `react-router-dom@6.30.6` bump — re-verified
> this round that no `navigate()` call site takes anything but a literal, so
> nothing is reachable; the v7 migration stays the owner's call.

It was recorded as a recommendation in two consecutive audits and never
executed. `npm audit` at audit time: **8 vulnerabilities (1 low, 4 moderate,
3 high)**.

Split by whether the package reaches a visitor:

| Package | Ships? | Advisory | In-range fix |
|---|---|---|---|
| `react-router-dom` / `react-router` / `@remix-run/router` | **yes, in the bundle** | GHSA-2j2x-hqr9-3h42, open redirect | 6.30.3 → **6.30.6** |
| `postcss`, `nanoid` | no — build only | 2 high, sourceMappingURL / generator loop | 8.5.14 → 8.5.26, 3.3.12 → 3.3.18 |
| `@babel/*` | no — build only | GHSA-4x5r-pxfx-6jf8, arbitrary file read | 7.29.0 → 7.29.7 |
| `esbuild` / `vite` | no — **dev server only** | GHSA-67mh-4wv8-2f99 | **none in range** — needs `vite@8`, a breaking major |

`npm audit fix` (no `--force`) resolves the first three groups with 21
semver-compatible patch bumps and touches nothing else.

---

## 2. Fixed

All three, on the same branch, at the owner's instruction — the same sequence
audit 6 followed. Each entry in §1 is left as written: it is the record of what
was true at audit time.

| ID | File | What changed |
|---|---|---|
| **A-7.1** | `src/App.jsx` | `specRows1()` / `specRows2()` — one definition each of "a row this component can draw" — with `specHasRows()` counting the same thing, so the caller's layout condition and the component's early return still cannot disagree (4.29). `asText()` on every spec label, value, column label, sub-header and cell. `productExtraPdfs()` filters `additionalPdfs` at both render sites. |
| **A-7.2** | `src/App.jsx` | The same `AbortController` + `PRODUCTS_FETCH_TIMEOUT_MS` pair `fetchProductsCached()` carries, in `useRefetchOnReturn()`, with the timer cleared on both settle paths. |
| **A-7.3** | `package-lock.json` | `npm audit fix`. 21 patch bumps, `react-router-dom` 6.30.3 → 6.30.6 among them. `vite`/`esbuild` deliberately **not** taken — see below. |

### What is left after the fix, and why each one is unreachable here

`npm audit` goes **8 → 4**. No package was added or removed and `package.json`
is untouched: 21 patch bumps in the lock file, nothing else. The four that
remain all need `--force` and a breaking major, and each was re-derived against
this app rather than carried over:

| Advisory | Why it does not reach this site |
|---|---|
| GHSA-67mh-4wv8-2f99 (`esbuild`/`vite`) | A **dev-server** issue. `vite` is a `devDependency`, the dev server never runs on the host, and nothing esbuild emits carries it into `dist/`. |
| GHSA-337j-9hxr-rhxg (`react-router`, SSR hydration) | Requires SSR. `src/main.jsx` is `createRoot` — there is no `hydrateRoot`, no `renderToString`, no `StaticRouter` anywhere in the tree. Not applicable at all. |
| GHSA-wrjc-x8rr-h8h6 (`react-router`, open redirect via **backslash** in `<Link>`/`useNavigate`) | Needs an attacker-controlled path. There are exactly **three** `navigate()` call sites and all three go through `pageToPath()`. Its input is a literal at 38 `PageLink` sites; the other seven read a `page` field out of `content.json`, and `content.php` validates every `'page'`-type field against a fixed options map (`:575-577`, `:665-666`) — an unknown value falls back to the first option, so the owner cannot type a path into one. The remaining source is the URL itself, and `location.pathname` returns a backslash percent-encoded, so `/\evil.com` reaches `pageToPath()` as `%5Cevil.com` and resolves same-origin. |

This is the same conclusion audit 4's D-03 and audit 5 reached about the *older*
advisory, but it is re-derived here for the **new** one — the backslash bypass
did not exist when those were written, and it is the same backslash class as
A-5.13, so it was worth checking rather than assuming.

### Why `vite`/`esbuild` was left alone, deliberately

The only remaining advisory needs `npm audit fix --force`, which installs
`vite@8` — a breaking major, four versions on. GHSA-67mh-4wv8-2f99 is
*"esbuild enables any website to send any requests to the development server
and read the response"*: it is a **dev-server** issue. `vite` is a
`devDependency`, the dev server never runs on the host, and nothing esbuild
produces carries the flaw into `dist/`.

Trading a working, six-times-audited build for a major-version bump of the
bundler, days before launch, to close an advisory that cannot be reached from
the deployed site, is the wrong trade. It is recorded rather than taken.

### Why the four `(X || []).map(...)` sites went with A-7.1

The audit-5 Low tier introduced `asList()`/`asText()` and its comment names the
exact pattern it was written to kill:

> the product page did `(product.description || []).map(...)`, **which throws on
> a string** … Coerce instead of crashing — a wrong type should degrade to
> something renderable, exactly as a missing one already does.

It was then applied to "the five sites that crashed", and five sites carrying
the named-unsafe pattern were left: `ind.useCases`, `ind.products`, `ind.certs`,
`svc.details` and the `services` lead-time scan — every one of them reading an
owner-editable `content.json` field. `(x || [])` guards null and undefined and
does nothing about a string, which is the case the comment is about. They now
use `asList()`, and the five text slots inside them use `asText()`.

---

## 3. Considered and NOT taken

Recorded so the reasoning is not re-derived next round.

- **Coercing the scalar product fields** (`product.name`, `product.sku`,
  `product.caption`, `partType`, …) at their ~15 render sites. An object in one
  of those is "Objects are not valid as a React child", the same throw A-7.1
  fixes. Not taken: unlike the spec tables, this would *invent* a rule rather
  than finish one. These fields are written through `as_str()` on every path,
  no backup era exists in which they held anything but strings, so the only way
  in is an FTP hand-edit that types an object into a field that has always been
  a line of text — a far less plausible slip than mangling a nested `rows`
  matrix. The diff would be wide and the value marginal.
- **`{prod.sku}` reaching a URL param** (`params={{ productId: prod.sku }}`).
  A non-string stringifies to `[object Object]` and soft-404s. Ugly, not a
  crash, and the soft-404 path is already tested (`plan9-notfound`).
- **A real deny-by-default in `uploads/.htaccess`.** Still the right call to
  leave alone, for the reason already written into the file: it cannot be
  tested here (`php -S` ignores `.htaccess`) and getting it wrong 404s every
  product photo. Unchanged from audit 5.
- **`A-5.10` — no prerender.** Unchanged: deliberately deferred, owner's call.
- **`brandtext`'s 11 failing combinations.** The logged open item
  `brand-text-on-brand-surface`, held at a ceiling of 13. A contrast decision,
  not a stability defect, and touching it is a UI change.

---

## 4. Checked, no finding

Recorded so the next round does not re-derive them.

- **CSP vs the admin.** Audit 6's A-6.1 was an inline `onclick` under
  `script-src 'self'`. The whole admin was re-swept for the class: **zero**
  inline event handlers, **zero** inline `<script>` blocks (the one grep hit is
  `<script>x</script>` inside a comment at `config.php:1509`), zero `eval` and
  zero `new Function`. All 21 script tags carry `src`. The policy and the code
  agree.
- **The deploy manifest vs what the build emits.** `dist/` holds exactly
  `index.html`, `assets/`, `images/`, `.htaccess`, `.user.ini`, `contact.php`,
  `sitemap.php`, `favicon.svg`, `logo.svg`, `manifest.json`, `robots.txt` —
  and `README.md`'s upload table names every one, plus the three `.htaccess`
  files that travel from the repo. No row is missing and no row is stale. This
  is what A-6.2 was, and it holds.
- **Secrets.** No bcrypt hash in any tracked file outside frozen audit history
  and the harness's own synthetic sentinel. `config.local.php`, both JSONL logs,
  the throttle file and `ALLOW-PASSWORD-RESET` are all gitignored.
- **The health banner.** Covers `admin/`, `data/`, `uploads/images/`, `pdfs/`,
  the system temp folder and the password-reset window. Nothing a silent-failure
  path depends on is unwatched.
- **`mergeContent`'s null-row filter** reaches every top-level content array.
  Nested content values degrade rather than throw once §2's `asList()` change
  is in.
- **`contact.php`.** Re-read end to end. `ipc_site_info()`, `ipc_contact_copy()`
  and `ipc_log_inquiry()` all degrade to a default on any problem; the sales
  notification and the JSONL record are both written before the auto-reply is
  attempted; the limiter and the auto-reply cap both fail **closed**;
  `JSON_INVALID_UTF8_SUBSTITUTE` is on both log writes.
- **`sitemap.php`.** Both catalog shapes, non-scalar ids skipped per row, 200
  with the ten static routes on any failure.

## 5. Owner actions, unchanged

Not code, and still outstanding — carried from `audit-runs/audit5.md`
§ *Owner actions for launch* and `WHATS_LEFT.md` §2j:

- **Rotate the live admin password.** A working hash is in this public repo's
  history. This is genuinely launch-gating.
- **Resolve the four contradictory ISO 9001 claims.**
- Publish SPF/DKIM/DMARC and confirm the `noreply@` mailbox exists.
- Search Console: verify the property and submit `/sitemap.xml`.
- Add an uptime monitor and a contact-form self-test.
- Decide apex-vs-`www` and check the certificate covers both.
- Verify `display_errors` is actually `Off` on the live server, and that
  `.user.ini` is being honoured — the admin Help page prints the live values.
