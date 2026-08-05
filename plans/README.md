# Plans — closing out `WHATS_LEFT.md` §2

Six plans covering **all 21 open items**, plus the `seo: []` amendment and one
regression introduced by commit `6284708`.

Written 2026-08-05 against `main` @ `6284708`. Every file:line reference in these
plans was verified against the working tree on that date, not copied from an
earlier audit.

---

## Read this first

**[GUARDRAILS.md](GUARDRAILS.md)** — binding for every plan. Scope discipline,
hard prohibitions, the twelve invariants, how to arm the harness, the regression
baseline, and the handback format.

A plan may add constraints. It may never relax one from GUARDRAILS.

---

## Execution order

| Plan | Items | Effort | Risk | Why here |
|---|---|---|---|---|
| **[0 — Dev loop](PLAN-0-dev-loop.md)** | dev regression, 4.24 | S | Low | **Blocks everything.** `npm run dev` currently shows no products, and theming and content run on defaults, so every other plan would be verified against a lie |
| **[1 — SEO](PLAN-1-seo.md)** | 4.21, 4.3, 4.1, `seo: []` | M | **High** | The only plan that changes what the business gets. 4.21 touches every nav control — do 4.3 and 4.1 first for a green baseline |
| **[2 — Owner safety](PLAN-2-owner-safety.md)** | NB-copy, 4.12, 4.13, 4.23, `form_complete` | M | Med | Each item lets Rick do damage he cannot see. NB-copy first — it silently destroys work |
| **[3 — Lead capture](PLAN-3-lead-capture.md)** | 4.5, 4.15b | M | Low | Every defect here costs an enquiry |
| **[4 — Accessibility](PLAN-4-accessibility.md)** | 4.31, 4.30, 4.19, 4.20 | L | Low | **After Plan 1** — 4.21 changes what is a link vs a button |
| **[5 — Correctness & perf](PLAN-5-correctness-perf.md)** | 4.27, 4.29, 4.26, 4.32, 4.14, 4.11b | M | Low | **Last** — 4.32 changes image bytes every other plan's screenshots depend on |

Plans 2, 3 and 5 are independent of each other and of Plan 1. Plan 0 gates
everything; Plan 4 follows Plan 1; Plan 5 goes last.

---

## Coverage

Every item from `WHATS_LEFT.md` §2, accounted for exactly once.

| Item | Plan | | Item | Plan |
|---|---|---|---|---|
| 4.1 FAQ JSON-LD deps | 1 | | 4.23 no contrast guard | 2 |
| 4.3 canonical / og:url | 1 | | 4.24 no DEV branch | 0 |
| 4.5 `alert()` errors | 3 | | 4.26 leaked scroll listeners | 5 |
| 4.11b footer social icons | 5 | | 4.27 duplicate React keys | 5 |
| 4.12 unvalidated Industries SKU | 2 | | 4.29 empty spec tables | 5 |
| 4.13 unconfirmed ✕ delete | 2 | | 4.30 spec editor focus | 4 |
| 4.14 login throttle | 5 | | 4.31 418 unlabelled controls | 4 |
| 4.15b plus/dot addressing | 3 | | 4.32 9.1 MB images | 5 |
| 4.19 sort headers | 4 | | NB-copy key drift | 2 |
| 4.20 collapsed FAQ answers | 4 | | `form_complete` position | 2 |
| 4.21 no crawlable links | 1 | | `seo: []` (§4 amendment) | 1 |

**21 §2 items + `seo: []` + the dev-loop regression = 23, across 6 plans.**

Not covered, deliberately — these are decisions, not tasks, and live in
`WHATS_LEFT.md` §3: the `src/pages`/`components`/`lib` extraction, the git-history
rewrite for `169c0d7`, the `products-all.json` upload question, and the
no-paid-tooling rule.

---

## The regression that is not in §2

Commit `6284708` removed `public/products-all.json` as one of three duplicated
catalog copies. That was correct, but it orphaned the `import.meta.env.DEV`
branch at `src/App.jsx:4142`, which pointed at it.

Vite's SPA fallback answers the missing path with `index.html` and a **200**, so
`res.ok` is true and the failure only appears when `res.json()` throws.
`npm run dev` now renders **"Catalog Unavailable"** on `/products`.

**Production is unaffected** — the non-DEV branch reads `/data/products-all.json`.
Plan 0 fixes it properly rather than restoring the duplicate.

---

## How each plan is held to account

Every plan ends with acceptance criteria that are **measurements, not
assertions**. The pattern throughout:

- Reproduce the symptom and **watch a new check fail** before fixing it. Two
  invariant checks in session 3 passed against a broken assertion because they
  were matching incident comments quoting the old buggy pattern.
- Where a negative control exists, run it. `_harness/negctl.php` and
  `_harness/php-nb2-off.ini` exist because a suite that cannot fail is decoration.
- Restore any `data/*.json` touched by a test from `_harness/pristine/` and prove
  byte-identity with `cmp`.
- Label anything depending on `.htaccess` or `.user.ini` as `[UNVERIFIED]`.
  `php -S` ignores both.

The baseline every plan must preserve is in GUARDRAILS §4.1. Run it before you
start so you know what you inherited.
