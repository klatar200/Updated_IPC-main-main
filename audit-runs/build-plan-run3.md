# Build Plan — Run 3

**Source:** `audit-runs/audit3.md` (6 issues: 1 High, 4 Medium, 1 Low)
**Fixable here:** 5. **Human-required:** 1 new (C-06) + 2 carried (A-16, A-17).
**Scorecards:** `audit-runs/scorecards-run3.md`

## Issue IDs

| ID | Title | Sev | Sprint |
|---|---|---|---|
| C-01 | Run 1's `contact.php` change broke two acceptance suites; Run 2 missed it | High | 1 |
| C-02 | `plan8-chrome`'s B21 assertion contradicts the shipped F12 decision | Medium | 2 |
| C-03 | `contactflow-selftest` anchors on a minifier-chosen variable | Medium | 2 |
| C-04 | `plan10-admincrawl` asserts an exact census of `help.php`'s tables | Medium | 2 |
| C-05 | The two `plan10` crawls write into a tracked screenshot directory | Medium | 2 |
| C-06 | Three 5-column spec tables scroll horizontally at 1440 | Low | — (No) |

Two sprints: the regression Run 1 caused, then the four pre-existing harness
defects. Nothing in the product changes this run.

---

## Global guardrails

Runs 1 and 2's guardrails carry over. Three additions, each earned by this run:

1. **A regression batch is not selected by grep.** C-01 exists because Run 2
   chose suites by searching their sources for keywords. Any run that changes a
   request contract must re-run **every** suite that posts to the affected
   endpoint, found by searching for the *endpoint*, not for field names.
2. **A suite may only be edited when the behaviour it asserts changed by
   design in a recorded issue** (unchanged from Run 2) **or when the assertion
   is provably unreachable** — an exact census that has been wrong for several
   merges, or an anchor on a name no source controls. Both must say so in the
   diff and cite the audit ID.
3. **No suite may write into a tracked directory by default.** If a suite
   produces a durable record, the record is regenerated deliberately via an
   environment variable, never as a side effect of running the suite.

---

## Sprint 1 — Repair the regression Run 1 introduced

**Goal:** Every suite that posts to `contact.php` sends what the real form
sends, so their assertions measure a submission that actually happened.

**Issues:** C-01

**Tasks**
1. Sweep **every** `_harness/*.js` that mentions `contact.php`, parse each
   `form_type` block, and list the ones missing a now-required field. Do not
   fix by hand from the failure output — the point is to find the ones that are
   not failing loudly yet.
2. Add the missing field to each fixture, with a comment naming A-04 and saying
   the real form always sends it.
3. Re-run `contactflow`, `plan3-autoreply` and `contactflow-selftest`.

**Sprint guardrails**
- Add the field; change nothing else in the fixture. The assertions are about
  auto-reply capping, promise text and the inquiries viewer — none is about
  required-field validation, so none of them may move.
- The sweep must be mechanical and cover both `form_type` values, or it repeats
  the Run 2 mistake in a new form.

**Definition of done**
The mechanical sweep reports zero fixtures missing a required field;
`contactflow`, `plan3-autoreply` and `contactflow-selftest` all exit 0.

---

## Sprint 2 — Repair four pre-existing harness defects

**Goal:** No assertion is permanently red, no negative control is silently
dead, and no suite dirties tracked files.

**Issues:** C-02, C-03, C-04, C-05

**Tasks**
1. `plan8-chrome` — replace the pre-F12 wording requirement with what B21 still
   guarantees: the minority qualifier is not joined into the banner. Cite F12
   and the `leadTimeSummary` comment that records the owner's instruction.
2. `contactflow-selftest` — make the label mutation's anchor a RegExp over the
   minified local name, and teach the runner to accept a RegExp `find`.
3. `plan10-admincrawl` — replace `=== 11` with `>= 2`, which is what the
   screenshot state actually requires.
4. `plan10-crawl` and `plan10-admincrawl` — default `OUT` to `_harness/out/`
   (gitignored); keep `CRAWL_OUT` as the deliberate override.

**Sprint guardrails**
- Prove each of the four was failing **before** Run 1's changes, so none is
  recorded as fixing a regression it did not cause.
- No assertion may be deleted. C-02 and C-04 are re-pointed at the property
  actually under test; the assertion count must not drop.
- C-03 must **increase** the number of assertions that run — the anchor being
  dead is why its negative control was absent.
- The `CRAWL_OUT` override must still work, and `WHATS_LEFT.md`'s references to
  the dated folder must remain accurate (the folder is untouched).

**Definition of done**
`plan8-chrome`, `contactflow-selftest` and `plan10-admincrawl` all exit 0;
running either crawl leaves `git status` clean for `site-screenshots/`.

---

## Not scheduled (human required)

| ID | Why | What is needed |
|---|---|---|
| C-06 | Every honest fix costs more than the defect: shrinking type on a spec table harms the buyer it exists for, a full-width size chart is a layout redesign, and relaxing C49 weakens a stated criterion. The table already scrolls gracefully. | A decision on which of the three to accept. |
| A-16 | Behaviour is defensible; re-verified in Run 3 to have no user-visible effect. | Whether an untouched empty field should be written on save. |
| A-17 | Five products need real photography. | Product photos from the owner. |
