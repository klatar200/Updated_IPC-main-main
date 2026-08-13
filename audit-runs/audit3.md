# Audit Run 3

**Date:** 2026-08-13
**Scope:** IPC website + /admin backend (project root), after Run 1 + Run 2 merged to `main`
**Checklist file:** audit-runs/endpoint-checklist.md
**Coverage:** 109/109 endpoints re-audited

## Coverage verification (Phase 4A)

**No missed coverage found.** A mechanical sweep of all 121 runtime and config
files across `admin/`, `public/`, `src/`, `data/`, `.claude/` and the repo root
matched every one against `project-map.md` or `endpoint-checklist.md`. Nothing
landed on `main` between Run 2 and Run 3 except Run 2's own merge (PR #43's
cleanup predates the Run 1 branch point).

Per the loop, a full re-audit was performed anyway. Run 3 deliberately targets
what Runs 1 and 2 **read but never executed**.

## What Run 3 executed for the first time

| Flow | Result |
|---|---|
| Real PDF upload (`upload-pdf.php`) | Saved as `IP30UV.pdf`, `pdfUrl` updated, audit-logged |
| Non-PDF with a `.pdf` name | Refused — "extension and content must both be PDF" |
| Real image upload (`upload-image.php`) | Saved, `photoUrl` updated, `uploads/.htaccess` written at runtime with `php_flag engine off` |
| PHP source renamed `.png` | Refused on sniffed MIME |
| Backup restore (`backups.php`) | Restored, prior state backed up first, audit-logged |
| Restore path traversal (`../../../etc/passwd`) | "Unrecognized backup filename" |
| Password change (`password.php`) | Hash rewritten uncorrupted (invariant 1 holds in practice), cost 12, old password rejected, new password works immediately |
| `ALLOW-PASSWORD-RESET` recovery | Open window shows "Set Admin Password"; reset succeeds; flag auto-deleted; recovered password signs in |
| Reset window expiry (mtime 2 h old) | Login screen explains itself, reset form withdrawn, a POST against it is refused and **no password is written** |
| Close-reset-window control (`index.php`) | Flag removed, success flash shown |
| `content.php` row add / reorder / remove | 119 rows; add reindexes contiguously; up/down round-trips; confirm names the row; **dismiss changes nothing**; disk untouched until Save; `form_complete` still last of 452 controls |
| `max_input_vars` truncation guard | `plan2-trunc` 13/13 against a real `max_input_vars=100` server |
| Login throttle under parallelism | `plan5-throttle` 12/12 across a 10-server fleet |
| Password-page throttle | `plan5b-pwthrottle` 10/10 |

Every one behaved correctly. **No product defect was found in Run 3** — all six
issues below are in the verification layer.

## Issues

| Title | Severity | Description | Location | Can Claude fix alone? |
|---|---|---|---|---|
| **Run 1's `contact.php` change broke two acceptance suites, and Run 2 missed it** | High | A-04 made `quantity` (RFQ) and `subject` (message) required. Three harness fixtures predate that and omit them, so their POSTs now 422 and the assertions measure a submission that never happened: `contactflow` 81/85 (the whole `inquiries.php` viewer block cascades from one rejected RFQ) and `plan3-autoreply` 12/22 (every Gmail/non-Gmail auto-reply-cap probe). **14 assertions across two suites, silently red since Run 1.** Run 2 chose its regression batch by grepping suite sources for keywords; neither suite's helper contains the literal word it was grepped for, so both were skipped. Selecting a regression batch by grep is not coverage. | `_harness/contactflow.js:448,658`, `_harness/plan3-autoreply.js:110` | Yes — **fixed** |
| A `plan8-chrome` assertion contradicts the shipped F12 decision | Medium | It required the services lead-time band to say "differ/except/vary" when one service carries a qualifier. UX-audit F12 **deleted** that clause at the owner's instruction — it named no service and "see below" pointed at nothing, since the cards have never rendered `leadTime`. The assertion was never updated, so it had been red on every run: the same permanently-failing-check fault as audit2 B-05. | `_harness/plan8-chrome.js:283-285` | Yes — **fixed** |
| `contactflow-selftest`'s label mutation anchors on a minifier-chosen variable | Medium | The mutation pinned the literal ``htmlFor:`msg-${j.name}` ``, but `j` is a name esbuild picks for a local. The bundle emits `${P.name}` — and did so before this release too — so the anchor was dead and that negative control had not run. The selftest correctly refused a vacuous pass and reported the drift, but the check it guards was silently absent. | `_harness/contactflow-selftest.js:134-141, 153` | Yes — **fixed** |
| `plan10-admincrawl` asserts an exact census of `help.php`'s reference tables | Medium | It required exactly **11** `table.field-ref`; `help.php` has carried **12** since at least `40cc51b`. Because the check gates a screenshot state, the miss did not report as a soft failure — the suite **crashed** ("STATE NOT REACHED"), taking the whole run with it. What the state needs is that a second table exists to scroll to. | `_harness/plan10-admincrawl.js:114-117` | Yes — **fixed** |
| The two `plan10` crawls write into a **tracked** screenshot directory | Medium | Both default their output to `site-screenshots/2026-08-11-after-plan10/`, an 83-PNG historical record referenced by name in `WHATS_LEFT.md`. Merely running the suite rewrote **40 tracked files in place** under a date they were no longer from and left the tree dirty; committing that would have replaced the record with a re-shoot wearing its old name. | `_harness/plan10-crawl.js:46-47`, `_harness/plan10-admincrawl.js:46-47` | Yes — **fixed** |
| Three 5-column spec tables scroll horizontally at 1440 | Low | `IP17TW-IP18SW-IP19LW` (435 in 389), `IP37SH-IP36TH-IP39LH` (396 in 389) and `IP47HV` (398 in 389). Root cause measured: a grouped `columnSpans` header yields **5 leaf columns**; every 4-column table fits. The panel already has `overflow-x: auto`, so the chart scrolls rather than clipping. | `_harness/plan8-polish.js:241` (C49); `src/App.jsx` `SpecTable2` (~8199) | **No** — see below |

**Totals:** 6 issues — 0 Blocker, 1 High, 4 Medium, 1 Low. 5 fixed; 1 needs a decision.

Five of the six are **pre-existing** and were proven so by re-running against
`src/App.jsx` restored to the pre-audit commit `3fa1c60`. The sixth — the High —
was **introduced by Run 1 and missed by Run 2**, which is the most useful thing
this run found: it says the previous run's verification method was wrong, not
just that a suite was red.

### Why the spec-table overflow is not fixed here

The three honest options all cost more than the defect:

1. **Shrink cell padding/type for wide tables** — this is a spec sheet; making
   the dimensions harder to read to remove a scrollbar makes the page worse for
   the buyer it exists for, and it touches all 42 product pages.
2. **Let the size chart span the full page width** — a product-detail layout
   redesign, far outside "smallest correct fix".
3. **Relax C49 to allow scrolling above 4 columns** — weakens a stated
   acceptance criterion, which this audit refuses to do without the owner
   agreeing the criterion was wrong.

The current behaviour — a horizontally scrollable data table inside its own
panel — is the normal, graceful treatment for a wide table. Which of the three
to take is a product decision.

## Three probe methodology errors caught before reporting

Recorded so a later run does not re-derive them as findings:

1. **Tap targets "below 24 px".** A sweep without `hasTouch`/`isMobile` measured
   `tel:`/`mailto:` links at 16–20 px tall. `src/index.css:172-181` grows them
   under `@media (pointer: coarse)`; re-measured with a coarse pointer they are
   **44–46 px**, 0 below the floor. `audit10-p2tap.js`'s header warns about
   exactly this mistake.
2. **9 px horizontal overflow on `/contact` at 320 px.** Also an artifact — the
   coarse-pointer rule makes the mailto link `inline-block`, and it wraps.
   Re-measured across 320/360/375/390/414 with a coarse pointer: **no
   page-level overflow anywhere**.
3. **"Focus trap" on `/contact` and `/dashboard`, and 11 controls with no focus
   ring.** Both from a crude detector. `/contact` walks 25 distinct, correctly
   ordered stops through the whole RFQ form into the footer; measuring focus
   affordance properly (`:focus-visible`, pseudo-elements, border and background
   change) gives **0** stops with no affordance on `/dashboard`.

## Verified-clean in Run 3

Invariants **17/17**; `lint.php` **10/10**. Responsive sweep of 11 routes ×
8 widths (320–1920) — 0 page-level overflow, 0 page errors. Assets: 61 images,
2.6 MB total, largest 194 KB, none over 500 KB; bundle 366 KB / 107 KB gzipped.
`help.php`: all 36 `<code>` paths resolve, and its upload limits are computed
through `min_upload_label()` rather than hardcoded, so they cannot drift from
the 20 MB / 8 MB caps the code enforces.

Suites green this run: `plan2-contrast` 42/42, `plan5-listeners` 11/11,
`plan5c-brandink` 6/6, `plan5c-eyebrow` 5/5, `plan7-imagery` 11/11,
`plan8-contrast` 34/35 neutral combinations, `plan8-mobile` 16/16,
`plan8-motion` 8/8, `plan9-band` 4/4, `plan9-slots-slash` 9/9,
`plan2-trunc` 13/13, `plan5-throttle` 12/12, `plan5b-pwthrottle` 10/10,
`plan2-formlast-selftest` 8/8, `copydrift-selftest` 5/5,
`invariants-selftest` 15/15, `backdrop-selftest` 9/9, and after the fixes
`plan8-chrome` 16/16 and `contactflow-selftest` 26/26.

## Reported by a suite, deliberately NOT re-raised

`brandtext` exits non-zero at **36/47** combinations meeting WCAG AA. The 11
failures are all `--brand-accent1-on-dark` at 4.16–4.37:1 (needs 4.5) on the
two mixed-end gradient strips. This is the tracked item
**`brand-gradient-mixed-ends`**, and it is **CLOSED, not open**: WHATS_LEFT.md
records the escalation being made and answered — leave both strips as they are,
because each heading is left-aligned over the *hardcoded* dark end where white
measures 10.78:1, so the failing end of each gradient is the empty end. That
entry closes with "re-asking a settled question every session is how the eyebrow
survived two of them", so this audit records the measurement and does not
reopen the decision.

## Carried forward, still needing a human

| ID | Title | Status |
|---|---|---|
| A-16 | A no-op "Save Content" rewrites `content.json` | Unchanged; still no user-visible effect |
| A-17 | Five products' photos hosted by placehold.co | Unchanged |
| C-06 | Three 5-column spec tables scroll at 1440 | New this run — see "Why the spec-table overflow is not fixed here" |
