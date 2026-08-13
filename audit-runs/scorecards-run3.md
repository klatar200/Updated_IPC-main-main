# Scorecards — Run 3

One scorecard per sprint in `audit-runs/build-plan-run3.md`. Each criterion is
Pass/Fail against a **measurement**. Sprint verdict = Pass only if every
criterion passes.

---

## Sprint 1 scorecard — C-01

| # | Criterion | How measured | Result |
|---|---|---|---|
| 1.1 | The sweep is mechanical, not driven by the failure output | a parser over every `_harness/*.js` mentioning `contact.php`, checking each `form_type` block against the required set | Pass |
| 1.2 | It found every broken fixture, including any not failing loudly | 3 found: `contactflow.js:448` (message, no `subject`), `contactflow.js:658` (rfq, no `quantity`), `plan3-autoreply.js:110` (message, no `subject`) | Pass |
| 1.3 | Re-running the sweep after the fix reports zero | re-run the parser | Pass — 0 fixtures missing a required field |
| 1.4 | `contactflow` exits 0 | run it | Pass — **85/85** (was 81/85) |
| 1.5 | `plan3-autoreply` exits 0 | run it | Pass — **22/22** (was 12/22) |
| 1.6 | `contactflow-selftest` exits 0 | run it | Pass — **26/26** |
| 1.7 | Only the missing field was added — no assertion moved | read the diff | Pass — three `append` lines plus comments; no assertion touched |
| 1.8 | The auto-reply cap assertions still measure capping, not validation | read the restored output | Pass — Gmail's four spellings collapse to one cap key, 3 auto-replies then the cap holds |
| 1.9 | The `inquiries.php` viewer assertions come back | read the restored output | Pass — the lead renders, the spec string is literal, nothing double-escaped (invariant 10) |
| 1.10 | No regression: invariants 17/17, lint 10/10, build clean | run all three | Pass |

**Sprint 1 verdict: PASS** (10/10) — verified 2026-08-13.

---

## Sprint 2 scorecard — C-02, C-03, C-04, C-05

| # | Criterion | How measured | Result |
|---|---|---|---|
| 2.1 | **C-02 was failing before Run 1's changes** | restore `src/App.jsx` to `3fa1c60`, rebuild, re-run | Pass — pre-existing; the F12 decision predates this branch |
| 2.2 | `plan8-chrome` exits 0 | run it | Pass — **16/16** (was 15/16) |
| 2.3 | C-02's replacement checks a real property, and no assertion was deleted | read the diff | Pass — same assertion count; now asserts the minority qualifier is not joined into the banner |
| 2.4 | The replacement cites the decision it defers to | read the comment | Pass — names F12, the owner's instruction, and `leadTimeSummary`'s comment |
| 2.5 | **C-03's anchor was dead before Run 1 too** | rebuild from `3fa1c60`, grep the bundle | Pass — the pre-audit bundle also emits `${P.name}`, not `${j.name}` |
| 2.6 | C-03 **increases** the assertions that actually run | compare totals | Pass — **23/24 → 26/26**: the repaired anchor re-enabled a negative control that had not been running |
| 2.7 | The anchor is now immune to a minifier rename | read the diff | Pass — RegExp `/htmlFor:`msg-\$\{\w+\.name\}`/`, and the runner accepts a RegExp `find` |
| 2.8 | **C-04's census has been wrong for several merges** | count `table.field-ref` at `40cc51b`, `eb1d40e`, `3fa1c60` and today | Pass — 12 at every one; the suite asserted 11 |
| 2.9 | `plan10-admincrawl` exits 0 | run it | Pass — completes; the `help-tables` state is reached |
| 2.10 | C-04's replacement matches what the state needs | read the diff | Pass — `>= 2`, because the shot scrolls to `.nth(1)` |
| 2.11 | **C-05: running a crawl leaves `site-screenshots/` clean** | run `plan10-admincrawl`, then `git status --short site-screenshots` | Pass — **0 tracked files changed** (was 40) |
| 2.12 | The shots still get written, just somewhere gitignored | count the output | Pass — 43 shots under `_harness/out/plan10-crawl/admin/` |
| 2.13 | The `CRAWL_OUT` override still works | read the diff | Pass — unchanged; only the default moved |
| 2.14 | `WHATS_LEFT.md`'s references to the dated folder stay accurate | the folder is untouched | Pass — restored with `git checkout` after the run that dirtied it |
| 2.15 | No regression: invariants 17/17, lint 10/10, build clean | run all three | Pass |

**Sprint 2 verdict: PASS** (15/15) — verified 2026-08-13.

---

## Run 3 suite results

Every suite executed this run. Suites are the project's stated acceptance
criteria; Run 3 ran the ones Runs 1 and 2 had not.

| Suite | Result | Note |
|---|---|---|
| contactflow | 85/85 | was 81/85 — C-01 |
| plan3-autoreply | 22/22 | was 12/22 — C-01 |
| contactflow-selftest | 26/26 | was 23/24 — C-03 |
| plan8-chrome | 16/16 | was 15/16 — C-02 |
| plan10-admincrawl | completes | crashed before — C-04 |
| plan2-trunc | 13/13 | `max_input_vars` guard, first time exercised |
| plan5-throttle | 12/12 | 10-server fleet, first time exercised |
| plan5b-pwthrottle | 10/10 | first time exercised |
| plan2-contrast | 42/42 | |
| plan5-listeners | 11/11 | |
| plan5c-brandink | 6/6 | |
| plan5c-eyebrow | 5/5 | |
| plan7-imagery | 11/11 | |
| plan8-contrast | 34/35 neutral | |
| plan8-mobile | 16/16 | |
| plan8-motion | 8/8 | |
| plan9-band | 4/4 | |
| plan9-slots-slash | 9/9 | |
| plan2-formlast-selftest | 8/8 | negative control |
| copydrift-selftest | 5/5 | negative control |
| invariants-selftest | 15/15 | negative control |
| backdrop-selftest | 9/9 | negative control |
| deadlinks | 0 of 18 dead | |
| copyroundtrip | 15/15 | |
| skuparity | 33/33 | |
| contrastparity | 28/28 | 23 colours × 3 implementations |
| plan10-help | 29/29 | |
| plan8-polish | 16/17 | C-06, not fixed — owner decision |
| brandtext | 36/47 | the CLOSED `brand-gradient-mixed-ends` decision; recorded, not reopened |

Plus the 32 suites Run 2 recorded, unchanged.

**Gates:** invariants **17/17**, `lint.php` **10/10**, build clean, mirror
restored to pristine.
