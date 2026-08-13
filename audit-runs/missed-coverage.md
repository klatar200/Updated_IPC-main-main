# Missed Coverage — after Run 1 execution

**Date:** 2026-08-13
**Method:** mechanical sweep of all 442 tracked files under `admin/`, `public/`,
`src/`, `data/`, `pdfs/`, `uploads/`, `plans/`, `_harness/`, `.claude/` and the
repo root, matched against the IDs and paths named in
`audit-runs/project-map.md` and `audit-runs/endpoint-checklist.md`.

**Result: misses found.** They are absorbed into the checklist as E105–E109 and
audited in Run 2.

---

## 1. The verification harness itself (the significant miss)

Run 1's checklist named exactly three harness files — `sync.sh` (E104-adjacent),
`lint.php` and `invariants.js` — because those three are the drift and invariant
gates. It named **none of the ~180 measurement suites**.

That was a real hole, and it produced two defects that Run 1 shipped and only
this sweep caught:

1. **`_harness/plan3-contact.js` failed after Sprint 1.** The suite asserts a
   literal `grep -c "alert(" src/App.jsx` returns **0** — that is how the 4.5
   remediation proves no browser dialog survived in the app. The `FooterSocial`
   comment added in Sprint 1 quoted a `javascript:` URL followed by that
   function name, so a **comment** broke the check exactly as its own inline
   warning says it would. Two assertions failed.
2. **The same suite's `SERVER_MSG` expectations went stale after Sprint 2.** It
   pins the two 422 strings `contact.php` returns and asserts the app renders
   them verbatim; A-04 changed both by design. Six assertions failed across
   three viewports.

Neither would have been visible from `lint.php` or `invariants.js`, both of
which passed throughout. Both are recorded as findings in `audit2.md` and both
are fixed.

**Absorbed as:** E105 (harness regression suites covering changed surfaces).

## 2. `_harness/sync.sh` staleness after a `public/` edit

Found while measuring Sprint 2, not by the file sweep, and recorded here because
it is the same class of gap: `sync.sh`'s header says to run it after every edit
under `admin/` or `public/`, but `public/contact.php` reaches the mirror only
through `dist/`, i.e. only after `npm run build`. A bare `sync.sh` after a
`contact.php` edit serves the **previous** file, and the two bundle hashes
`sync.sh` prints are unchanged by a `contact.php` edit, so nothing indicates it.
Sprint 2's criteria 2.6/2.7 were first measured against a stale mirror.

**Absorbed as:** E106.

## 3. `.claude/launch.json`

Editor/launch configuration. Never opened in Run 1.

**Absorbed as:** E107.

## 4. `package-lock.json`

Named by no checklist ID; E054 covered `package.json` only.

**Absorbed as:** E108.

## 5. `plans/audit10/**` (14 JSON files)

Machine-readable planning artifacts for a previous audit (route lists,
viewports, severity scales, state ledgers). Not runtime, not deployed, not
referenced by any shipping code.

**Absorbed as:** E109, audited as documentation-only.

---

## Not misses (checked, already covered)

The sweep matches on basename and over-reports; these were all already in scope:

- `src/components/**`, `src/pages/**`, `src/lib/**` (35 files) — covered as a
  group by **E098**, confirmed in Run 1 as an abandoned extraction that nothing
  imports and that contributes nothing to the bundle.
- `pdfs/**`, `uploads/**`, `public/images/**` — covered by **E100** and **E101**
  as referential integrity against the catalog, which is the only property of
  them that can be audited.
- `plans/PLAN-*.md`, the root `*.md` documents — covered by project-map §7 and
  by `lint.php`'s existing `doc drift` check.
