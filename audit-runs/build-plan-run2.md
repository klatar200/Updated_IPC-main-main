# Build Plan — Run 2

**Source:** `audit-runs/audit2.md` (5 issues: 2 High, 3 Medium)
**Fixable here:** 5. **Human-required:** 0 new (A-16 and A-17 carry forward from Run 1).
**Scorecards:** `audit-runs/scorecards-run2.md`

## Issue IDs

| ID | Title | Sev | Sprint |
|---|---|---|---|
| B-01 | A Run 1 comment broke the "no browser dialog survives" check | High | 1 |
| B-02 | `plan3-contact.js` pinned the two 422 strings A-04 changed | Medium | 1 |
| B-03 | `sync.sh` silently serves a stale `public/` file | High | 2 |
| B-04 | `.claude/launch.json` serves the repository root over HTTP | Medium | 2 |
| B-05 | A `plan8-catalog` assertion fails on its own text extraction | Medium | 2 |

Two sprints rather than five: every issue is in the verification layer, and
they split cleanly into "assertions that Run 1 broke" and "verification tooling
that was already wrong".

---

## Global guardrails (both sprints)

Run 1's guardrails carry over unchanged, plus one that this run's findings make
necessary:

1. Invariants must stay **17/17**; `lint.php` must stay **10/10** (Run 1 added
   the audit-action check). Neither may be edited to make a fix pass.
2. **A failing suite is fixed by changing the code, not the assertion — unless
   the assertion's expected value is stale because the behaviour changed by
   design in a recorded issue.** B-02 and B-05 are the only two that qualify,
   and each must say in the diff which issue changed the behaviour and why the
   assertion's *purpose* is unchanged. Every other suite must be made to pass
   by fixing the product.
3. Do not delete or weaken an assertion. B-05 is repaired by reading the right
   attribute, not by dropping the check.
4. No scope expansion into the product from a harness finding.

---

## Sprint 1 — Restore the assertions Run 1 broke

**Goal:** Every acceptance criterion that was green before Run 1 is green again,
without weakening any of them.

**Issues:** B-01, B-02

**Tasks**
1. `src/App.jsx` — reword the `isSafeExternalUrl` docblock so it does not
   contain the forbidden token, and add an explicit warning naming the check,
   the way `COPY_DEFAULTS` already carries the `copydrift.js` apostrophe
   warning. The behaviour of the function does not change.
2. `_harness/plan3-contact.js` — update `SERVER_MSG` to the two strings A-04
   now returns for an empty submission. Keep the verbatim comparison and its
   comment; add a dated note saying which issue changed the values.

**Sprint guardrails**
- B-01 is a comment-only edit. `isSafeExternalUrl`'s logic must be byte-identical
  afterwards, and Sprint 1 of Run 1 must still pass its own scorecard.
- The `SERVER_MSG` values must be **measured** from a real empty submission, not
  copied from the PHP source — the point of the assertion is that the app shows
  what the server actually sent.

**Definition of done**
`plan3-contact` exits 0 at 51/51; the two `alert(` assertions pass; Run 1's
criteria 1.1–1.7 and 2.6–2.10 still pass.

---

## Sprint 2 — Repair the verification tooling itself

**Goal:** The harness cannot silently measure the wrong bytes, the documented
dev server cannot expose secrets, and no assertion is permanently red.

**Issues:** B-03, B-04, B-05

**Tasks**
1. `_harness/sync.sh` — after the two bundle lines, compare every file in
   `public/` against its `dist/` counterpart and **exit non-zero** with a
   message naming the stale files and the command that fixes it.
2. `.claude/launch.json` — point the `php-admin` configuration at
   `_harness/site` with `router.php` and the harness ini, the docroot
   `_harness/README.md` documents, and drop the hardcoded Windows path.
3. `_harness/plan8-catalog.js` — capture the toggle's `aria-label` alongside its
   `textContent` and assert against whichever names the family.

**Sprint guardrails**
- The stale check compares **file contents**, not timestamps: a checkout or a
  copy can make mtimes lie, and a false "stale" that blocks every sync is worse
  than the silence it replaces.
- It must not run `npm run build` itself. `sync.sh`'s contract is "mirror what
  is built"; making it build would hide a broken build behind a green sync.
- The `launch.json` change must not add a configuration that writes to the real
  `data/` — the mirror is the point.
- B-05 must be shown to have been failing **before** Run 1's changes as well, so
  the repair is not recorded as fixing a regression it did not cause.

**Definition of done**
`sync.sh` exits 1 on a planted `public/` edit and 0 when in sync;
`launch.json` parses and names the harness docroot; `plan8-catalog` reaches
16/16 with the assertion still checking the same property.

---

## Not scheduled (carried from Run 1, human required)

| ID | Why | What is needed |
|---|---|---|
| A-16 | Behaviour is defensible; suppressing empty values changes what a save means. Re-verified in Run 2 to have no user-visible effect. | A decision on whether an untouched empty field should be written. |
| A-17 | Five products need real photography. | Product photos from the owner. |
