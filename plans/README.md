# Plans

**Plans 0–5 are complete and merged.** All 21 items they covered are closed —
see `WHATS_LEFT.md` §1b and `PATCH_NOTES.md`. They are kept as the record of how
each was approached and what each was measured against.

**PLAN-6 is complete and merged** (items 4, 3 and 1, 2026-08-07).

**Two plans are open.**

**[PLAN-8](PLAN-8-audit-remediation.md) — the 2026-08-08 UI/UX audit.** 50 items
from [`UI_UX_AUDIT_2026-08-08.md`](../UI_UX_AUDIT_2026-08-08.md): 7 severity-A,
21 severity-B, 22 suggestions, in six sequenced phases. **Start with its §0** —
four items need an owner decision and must not be guessed, one of them a
certification claim. Its §1.2 also records that GUARDRAILS §4.1's regression
baseline is **stale**: eleven of the thirteen commands it lists name scripts that
no longer exist in the tree. Use PLAN-8 §1.2's list until that is corrected.

**[PLAN-7](PLAN-7-marketing-imagery.md) — marketing imagery.** Item 2 of the
2026-08-07 admin-surface review, held back for a scope decision. Like PLAN-6 it
is not a bug-closing plan, with one exception: item 1 closes a real hazard in
`_harness/backdrop.js`, which silently skips a raster background layer and would
report a passing contrast number for text sitting on a photograph.

PLAN-8's C37 (empty regions in the primary layouts) deliberately stops short of
what PLAN-7 covers. If both run, PLAN-7 goes second — it changes the images
PLAN-8's screenshots are measured against.

---

## Plans 0–5 — closing out `WHATS_LEFT.md` §2 (complete)

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

Plan 5 was followed by two unplanned rounds recorded only in `WHATS_LEFT.md`:
**5b** (`sidebar-active-border`, `password.php`'s throttle, the sitemap) and
**5c** (the page-header eyebrow, the teal accent text, and `sitemap.php`).

---

## Plan 6 — widening the admin surface (complete)

| Plan | Items | Effort | Risk | Why here |
|---|---|---|---|---|
| **[6 — Admin surface](PLAN-6-admin-surface.md)** | product families, auto-reply copy, social platforms | M | Med | Not defects. Three places where routine business change currently needs a developer. Item 1 is also a **latent defect** — the eleven category names are three separate literals that agree today and nothing keeps them agreeing |

Shipped **4, then 3, then 1** — ascending risk and blast radius. Items 1 and 3
both added fields under `content.php`'s `max_input_vars` sentinel; the posted
variable count moved 421 → 424 → **435**, each step re-run against a real
`max_input_vars=100` server. §0 of that plan is the procedure for any future
field.

---

## Plan 7 — marketing imagery (open)

| Plan | Items | Effort | Risk | Why here |
|---|---|---|---|---|
| **[7 — Marketing imagery](PLAN-7-marketing-imagery.md)** | harness raster gap, four image slots, owner-selectable images | M | Med | The homepage, About and Services pages paint no photography at all while the customer's own photographs ship to the server unused. Item 1 is a **latent harness defect** — a `url()` background layer is silently skipped by the contrast core, so the first photo behind text would be scored as if it were not there |

**Item 3b (the datasheet index) shipped 2026-08-07** — it was not in the original
plan, needed no data-shape change and no design decision, and turned up a live
broken `pdfUrl` plus the fact that nothing in the harness had ever checked one.

Take item **1 first** — it is the measurement that makes item 2 checkable, and
it is worth landing whether or not any image ships. Item 3 adds fields under the
same `max_input_vars` sentinel; read PLAN-6 §0 before it. Item 2 needs a scope
decision (PLAN-7 §5).

A fourth candidate — owner-editable marketing imagery — was reviewed and left
out. It needs a scope decision first and may need photography rather than code.

---

## Plan 8 — the 2026-08-08 UI/UX audit (open)

| Phase | Items | Effort | Risk | Why here |
|---|---|---|---|---|
| **A — Product-page truth** | A1, A2, C32, C45, C47 | M | Low | Highest severity and touches nothing else. A1 is a certification claim, not a UI bug: 18 of 42 product pages print "UL Listed" beside the approvals block's "UL Recognized" or "UL Approved" |
| **B — Indexability & sharing** | A3, A5, A4, B25, C29, C33 | M–L | **High** | Gated on the §0 decision about product URLs. Changes routing, canonicals and the sitemap, so every later phase's screenshots depend on its outcome — **second, not last** |
| **C — Catalog browsing** | A6, B19, B20, B27, B12, C30, C35, C46, C48, C49 | M | Low | The three catalog views. Independent of D and F |
| **D — Lead capture** | B16, B17, B18, B22, B26, C31, C39, C40 | M | Low | Every defect here costs an enquiry |
| **F — Chrome, assets, copy** | B13, B21, B23, B11, A7, C34, C37, C38, C41, C42, C43, C44 | M | Low | Mobile drawer, images, copy |
| **E — Legibility & input** | B8, B9, B10, B14, B15, B24, B28, C50 | M | Med | **Last** — it recolours ~270 elements and adds a skip link, moving every screenshot baseline and tab-order assertion the other phases wrote |

Same reason 4.32 went last in PLAN-5. Phases C, D and F are independent of each
other.

**Nine of the 50 items live in `data/*.json`**, which GUARDRAILS §2 forbids
touching. PLAN-8 tags every item `CODE` / `DATA` / `BOTH` and its §6 is the
owner-action list those `DATA` items produce — the fix is an admin edit, not a
commit.

PLAN-8 §7 requires the executing agent to append a dated section to
`PATCH_NOTES.md` — **append**, since that file is the record of the 12 merged PRs
in the 2026-07-08 → 2026-08-07 release and overwriting it destroys that.

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
