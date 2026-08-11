# AUDIT-11 — verify PLAN-10 actually closed AUDIT-10

**Audience:** a fresh Claude Code session with no memory of PLAN-10's execution.
**Status:** binding for that session. Written 2026-08-11, against `main` @ `1497f77`.
**Written by:** the session that executed phases C, D and E. Treat it as a
self-report from an interested party, not as evidence. **Its claims are exactly
what you are here to check.**

---

## CORRECTIONS — added 2026-08-11 after AUDIT-11 ran

This document was executed, and the audit it commissioned refuted five of its own
claims. The sections below are left **as written**, because
`_harness/AUDIT11-REPORT.md` quotes them verbatim and silently rewriting them
would break that audit trail. Read these corrections first; they supersede the
text they name.

| § | As written | Measured |
|---|---|---|
| 4.1 | "confirm the leaks go to zero" | They go to **16** — 2 per page-state × 8, every one the footer `#0a2240` / `.ipc-skip` pair that A10-046's own record **excludes as deliberate**. Every leak attributable to A10-045 or A10-046 does reach zero. |
| 4.2 | "`edit.php` and `upload-pdf.php` … carry **more** than 11 items — the exact case most likely to overflow" | **Three** pages inject `$navExtra`, not two. `admin/upload-image.php:181-182` injects **two** links for **13** items, against 12 on the two named. The riskiest page was named neither here nor in any suite. It passes 13/13. |
| 4.3 | "about 25 suites … `_harness/README.md` lists ~51" | **65** runnable suites. 14 were never run in phases C–E; AUDIT-11 ran all 65. |
| 4.4 | "`$SECTIONS` (~24 keys) and `$COPY_GROUPS` (~20)" | **17 + 14 = 31**. |
| 4.5 | "every catalog row grows 48px → 78px" | The item 5 commit it paraphrases is the more accurate statement; treat the commit as authoritative. |

One further correction, to a number this document repeats from PR #29: the
industries-card ΔE2000 is **5.29, not 5.92**. Both figures are arithmetically
correct — 5.92 is the distance to `--brand-primary-hover`'s *`index.css` default*
`#004e8c`, 5.29 the distance to the value `ThemeInjector` actually derives and
paints, `#004c86` (×0.82). The painted value is the one that matters, so 5.29 is
the right figure. It does not change the decision it supports: 5.29 is still more
than double the ~2.3 noticeable-at-a-glance threshold. Corrected in place
throughout this document, `WHATS_LEFT.md`, `src/index.css` and `src/App.jsx`.

**What AUDIT-11 confirmed:** all twelve remediated findings closed; item 4 still
open and still reproducing; the probe-blindness claim in §4.1 correct; both
judgement calls in §4.5 sound. Its report is `_harness/AUDIT11-REPORT.md`.

---

## 0. Why you exist

AUDIT-10 recorded 13 A/B findings. PLAN-10 remediated them across five phases,
now all merged to `main`. The executing session verified its own work. That is
the problem: every "measured" number below was produced by the same session that
wrote the fix, and in three places it also **rewrote the acceptance criteria it
was being judged against**. Those are the places to look hardest.

Your job is **not** to re-audit the site. It is to answer one question per
finding: *was this actually closed, or does it merely have a passing suite?*

**Deliverable:** a findings list in the AUDIT-10 record format, covering errors,
gaps and skipped process. Fix nothing unless §7 says so.

---

## 1. Read first, in this order

1. `CLAUDE.md` — architecture and the 12 invariants.
2. `plans/GUARDRAILS.md` — binding. §1 scope, §4 verification, §7 do-not-re-report.
3. `plans/PLAN-10-audit10-remediation.md` — the contract that was executed.
4. `_harness/AUDIT10-REPORT.md` — the 13 A/B records, *Regression state*, *Refuted*.
5. `WHATS_LEFT.md` §2 — three records were added during PLAN-10; two are traps
   for you specifically (§4.1, §4.6 below).
6. `PATCH_NOTES.md` — the PLAN-10 section, phases A–E.

Machine detail: `plans/audit10/state/findings.jsonl`, one JSON object per line.

---

## 2. What landed, and where to find it

`main` @ `1497f77`. Five merged PRs; **one commit per item**, so every claim
bisects to a single change.

| Phase | Items | Findings | PR | Executed by |
|---|---|---|---|---|
| A | 1 | A10-011 (the only severity A) | #27 | an earlier session |
| B | 2, 3 | A10-001, A10-002, A10-012 | #28 | an earlier session |
| C | 11, 12 | A10-045, A10-046 | #29 | this document's author |
| D | 5, 6, 7, 8 | A10-020, A10-021, A10-022, A10-027 | #30 | ” |
| E | 9, 10 | A10-028, A10-029 | #31 | ” |

**Item 4 (A10-037, the ISO 9001 contradiction) was never executed.** It is the
12th item and it is blocked on the owner. Confirm it is still open and still
reproducing — do not treat its absence as an oversight, and do not fix it.

Nine suites were added: `plan10-header`, `-dashboard`, `-rfqscroll`,
`-repalette`, `-adminrows`, `-adminnav`, `-helpwidth`, `-auditlog`, `-help`.

---

## 3. Standing up

```bash
npm install && npm run build && sh _harness/sync.sh
PHP_CLI_SERVER_WORKERS=6 php -S 127.0.0.1:8123 -t _harness/site -c _harness/php-mail.ini _harness/router.php &
php -S 127.0.0.1:8124 -t _harness/site -c _harness/php-trunc.ini _harness/router.php &
php -S 127.0.0.1:8125 -t _harness/site -c _harness/php-nb2-off.ini _harness/router.php &
```

- **`php-mail.ini` on :8123**, not `php-extra.ini`. `routes.json` and GUARDRAILS
  §4.2 disagree; `php-mail.ini` is the one that makes `mail()` work.
- **`_harness/site/admin/config.local.php` is deleted at the end of every
  session.** `sync.sh` recreates it (password `audit-pass-123`). Without it,
  admin probes silently fail to sign in and report **false negatives**. Delete
  it again before you finish.
- **A suite whose TOTAL changes is bailing, not failing.** `plan2-trunc` reports
  `1/2` instead of `13/13` when :8124/:8125 are down. This bit the executing
  session; check server liveness before believing any red.
- **`fc-match system-ui` → DejaVu Sans**, ~21% wider than Segoe UI. Re-measure
  any width claim under Liberation Sans. `plan8-polish` 16/17 is that artifact.
- **`git fetch origin main` before diffing.** The local `main` ref can be stale.
- Launch Chromium only via `_harness/browser.js`. Never `playwright install`.
- Never touch `data/`, `pdfs/`, `uploads/`, `_localsite/`. Assert
  `git diff --stat data/ pdfs/ uploads/` is empty before you finish.

---

## 4. The seven things most likely to be wrong

These are ranked. Do them in order; stop and report if any confirms.

### 4.1 The audit's own probes still say two findings REPRODUCE — decide for yourself whether that is a probe artifact

Run, unedited:

```bash
node _harness/audit10-p7reverify.js
node _harness/audit10-repalette.js
```

You will see **`A10-045 REPRODUCES`** and **`A10-046 REPRODUCES`**, and
`audit10-repalette.js`'s leak set **byte-identical to its pre-fix run, 41 rows**.

The executing session's claim (`WHATS_LEFT.md` §2, and PR #29) is that this is a
**property of the probes, not of the fixes**: both drills inject the ten
`--brand-*` variables that existed when the audit ran, phase C added six more,
and a custom property the drill does not inject cannot move.

**This is the single highest-value thing you can check, because if the claim is
wrong, two severity-B findings are open and marked closed.** Verify it
independently — do not accept the reasoning:

1. Confirm the six new variables exist and are derived:
   `--brand-accent-rgb`, `--brand-accent-2-rgb`, `--brand-dark-2`,
   `--brand-dark-panel`, `--brand-dark-drawer`, `--brand-primary-deep`.
2. Repalette through the **owner path** — the admin's Business Details →
   Branding, or an intercept of `/data/site-info.json` — not a style tag. That
   is what Rick does. Confirm the header hairline, the homepage badge, the 42
   `/dashboard` chips, the product-detail header gradient and the five
   `/industries` card headers all move.
3. Then re-run the audit probes with the six variables added to their injection
   maps **in a scratch copy** (§1.5 forbids editing them in place) and confirm
   the leaks go to zero.

If (2) fails, the fixes are incomplete and you have found a real defect. If (2)
passes, the claim stands — record it and move on.

### 4.2 Item 6 was verified on 3 of the 13 admin pages that include `nav.php`

`_harness/plan10-adminnav.js:56` tests `index.php`, `settings.php`, `help.php`.
Thirteen pages include `nav.php`: also `add`, `audit-log`, `backups`, `content`,
`delete`, `edit`, `inquiries`, `password`, `upload-image`, `upload-pdf`.

This matters more than a coverage number, because of the mechanism: **six pages
carry a duplicate bare `header { … height: 60px … }`** in their own `<head>`
(`add`, `audit-log`, `edit`, `help`, `index`, `upload-pdf`), and that explicit
height is what defeated the first version of the fix. The suite covers **two of
those six** (`index`, `help`). `add.php`, `audit-log.php`, `edit.php` and
`upload-pdf.php` were **never measured**.

The override should hold everywhere — `.ipc-admin-header` (0,1,0) outranks
`header` (0,0,1) — but "should" is not the standard. Measure the nav at 390 on
**all thirteen**: 0 items above the document top, 0 below the header's own
bottom edge, every item ≥ 4.5:1 against its **painted** backdrop, all 11
hit-testable. `edit.php` and `upload-pdf.php` also inject `$navExtra`, so they
carry **more** than 11 items — the exact case most likely to overflow.

### 4.3 About 25 suites were never run during phases D and E

`_harness/README.md` lists ~51. The executing session's fullest sweep was 38.

**Run the complete set** and compare against GUARDRAILS §4.1 and
`plans/audit10/baseline.json`. Never run in D or E, and at least four are
directly relevant:

- **`plan9-firstsave`** — phase D item 8 rewrote `admin/content.php`'s save
  handler, and its suite needed a "settling save" precisely because the stored
  `content.json` predates fields the form renders. That is `plan9-firstsave`'s
  subject matter. **Run it first.**
- **`plan7-slots`, `plan5c-brandink`, `plan5c-eyebrow`** — brand/photo-slot
  machinery adjacent to phase C's `ThemeInjector` change.
- **`plan2-delete`, `plan2-sku`** — the catalog table phase D item 5 restyled.
- Also unrun: `plan3-autoreply` (`[UNVERIFIED]` on Windows, verified on Linux),
  `plan5-keys/listeners/social/throttle`, `plan5b-*`, `plan6-families`,
  `plan7-approvals/datasheets`, `plan8-certs`, `plan8-landing`, `plan9-band`,
  `plan9-meta`, `plan9-notfound`, `plan9-slots-slash`, `backdrop`, `copydrift`.

Expected reds are exactly three: `plan8-contrast` 34/35, `plan8-polish` 16/17 on
Linux, `brandtext` ≤ 13 failing (currently 11). **Any other red is a finding.**

### 4.4 Item 8's diff logic was tested on 4 of ~44 section keys

`admin/content.php` defines `$SECTIONS` (~24 keys) and `$COPY_GROUPS` (~20).
`plan10-auditlog.js` exercises **four**: `privacyHeader`, `hero`, `seo`,
`features`.

The handler compares `$storedContent[$key] !== $out[$key]`. Check the shapes
that comparison could get wrong and that were never exercised:

- a section whose rows are reordered but not otherwise changed;
- a section where every row is deleted (invariant 3 territory — `mergeContent`
  treats an empty array as a deletion, and the audit-log diff must agree);
- `services`, whose rows are restructured into a `brochure` object at
  `admin/content.php:548-554` before the comparison;
- a `type: 'page'` field that gets defaulted to `array_key_first($PAGE_OPTIONS)`;
- the `families` group, which lint checks for PHP/JS drift.

Also re-confirm **invariant 6**: `form_complete` must still be the last field in
the form. `plan2-formlast` covers it; run it, and run `plan2-trunc` with :8124
and :8125 actually up.

### 4.5 Two judgement calls went against the plan's first recommendation

Both are defensible and both were measured, but both are the executing session
overruling its contract, so verify the evidence rather than the argument.

**Item 12 (A10-046)** — PLAN-10 §5 suggests reusing `var(--brand-dark)` and
`var(--brand-primary-hover)`. The session introduced four dedicated derived
variables instead, on the grounds that reuse moves three of four surfaces
perceptibly (ΔE2000 5.29 / 3.22 / 2.24, versus 1.27 for the one that is fine).
**Check the claim that actually matters: with the default palette, is the
shipped site unchanged?** `plan10-repalette`'s `default` arm asserts 1,120
elements and 28 gradients byte-identical. Verify independently — capture the
four surfaces as images against `origin/main~5` and compare pixels.

Note the cost the session accepted: reuse *would* have made the audit probes
flip (`--brand-dark` is in their map). The dedicated-variable route is why §4.1
exists. Judge whether that trade was right.

**Item 5 (A10-020)** — PLAN-10 §6 offers wrap or widen. The session chose
`flex-wrap: wrap`, reporting that widening looks identical to the defect at
1024. It also corrected the plan: **every** catalog row grows 48px → 78px, not
"only where they need to", so 1440 shows four rows where it showed six. Confirm
both the 1024 claim and the row-height cost; decide whether the cost was the
owner's call to make rather than the executor's.

### 4.6 Three `WHATS_LEFT.md` §2 records were added — two are load-bearing

- **the audit-probe blindness record** — §4.1 above.
- **six admin pages duplicating the `nav.php` header** — §4.2 above. Recorded and
  deliberately not fixed. Confirm the record is accurate and that the suggested
  `lint.php` drift check does not already exist.
- **`brand-gradient-mixed-ends`, AMENDED** — item 12 made its premise false.
  Check the amendment is right on two points it corrects: that it is **two**
  comments (`src/App.jsx` product header *and* industries card), and that the
  re-derivation targets are now `inkFor([dark2, primary])` and
  `inkFor([primaryDeep, primary])`. The ink itself was deliberately not changed;
  confirm it still measures 10.78:1 at the shipped palette and that `brandtext`
  is unchanged at 11 failing.

### 4.7 Cited `file:line` references drift, and at least one number was already wrong

Commit messages and code comments cite `file:line` throughout. Phases D and E
inserted comment blocks into the same files, so **the line numbers in earlier
commits may no longer resolve**. Spot-check every `file:line` in the five phase
commits and in `WHATS_LEFT.md`.

Precedent for why this is worth doing: the item 9 commit originally claimed
`plan10-help 24/29`; the measured value was **23/29**, and the message was
amended before pushing. That slip was caught. Assume others were not.

---

## 5. Per-finding verification — the actual checklist

For each of the 13, answer: **closed / not closed / closed-but-weakly-verified**,
with a measurement. Re-run the finding's own *Reproduce* steps from
`findings.jsonl`, not the fix's suite — a suite written by the fixer can encode
the fixer's misunderstanding.

| Finding | Item | Verify by |
|---|---|---|
| A10-011 | 1 | product header at 390, all 42 products: title column > 200px, 0 ink over a button |
| A10-001 | 2 | `/dashboard` 1440/1024/834: 0 painted-text overlap pairs |
| A10-002 | 2 | `/dashboard` 1024: Description column not collapsed, no header overprint |
| A10-012 | 3 | `/contact` **both tabs**, failed submit: invalid field not behind the sticky header |
| A10-020 | 5 | `/admin/index.php` 1440 + 1024: Delete fully inside the table content box, hit-testable |
| A10-021 | 6 | admin nav at 390 on **13** pages (§4.2) |
| A10-022 | 7 | `/admin/help.php` at 390: `scrollWidth === clientWidth`, and the second column readable **without** `overflow-x: hidden` anywhere |
| A10-027 | 8 | edit a Privacy field, save, read `admin/admin-log.jsonl` — and §4.4's untested shapes |
| A10-028 | 9 | read `svg.querySelectorAll('text')`, **never `innerText`** — inline SVG text is not in `innerText`, and that produced a false "does not reproduce" in pass-7 |
| A10-029 | 10 | the size chart's header is flat, the three data rows byte-identical, no row labelled Max below its Min |
| A10-045 | 11 | §4.1 |
| A10-046 | 12 | §4.1 + §4.5 |
| A10-037 | 4 | **should still reproduce** — confirm it does and leave it |

### A10-029 needs a domain check, not just a code check

The fix relabelled the middle column from `Max` to **Recovered Diameter**, on the
evidence that IP29CG, IP33PO, IP33TW and IP34SR use `Expanded Diameter` /
`Recovered Diameter` as sibling columns with the same 2:1 shape. The **numbers
were left byte-identical** — deliberately, because inventing numbers to match a
wrong header would be worse than the defect.

Confirm the catalog evidence yourself in `data/products-all.json` (read only).
Then flag for the owner that a relabelled specification in his own documentation
is his call to ratify. The session also declined to rename the fourth column to
the catalog's `Recovered Wall`, on the grounds that whether `0.020"` is a
recovered or nominal wall is not settled by anything measurable — check whether
you agree, and whether the surrounding prose is now consistent.

---

## 6. Process gaps to check independently of any finding

1. **Nothing is deployed.** `PATCH_NOTES.md` ends "Not yet deployed." Confirm.
   The deploy is a manual FTP of `dist/` contents plus changed `admin/` files;
   `data/`, `pdfs/`, `uploads/` must **not** be re-uploaded (live customer
   state, FTP overwrite creates no backup).
2. **`.htaccess` and `.user.ini` remain `[UNVERIFIED]`.** `php -S` ignores both.
   Nothing in PLAN-10 changed that, and nothing in PLAN-10 should be reported as
   verifying it. Confirm no phase claimed otherwise.
3. **An orphaned branch exists.** `origin/claude/plan-10-phase-c` (`14c5024`,
   `3408482`) is a **concurrent session's independent phase C**, never merged, no
   PR. Its item 12 took the reuse route §4.5 rejected. Deleting it is blocked —
   the git proxy returns **HTTP 403 on ref deletion**. Confirm it is still
   unmerged and still harmless, and that `main` carries the dedicated-variable
   implementation, not that one.
4. **`src/components/`, `src/pages/`, `src/lib/` still contain the pre-fix
   literals** — `rgba(0,190,242,…)`, `#0a2a52`, `#0e2847`. This is **correct**:
   nothing imports them, editing them has zero effect on the bundle, and
   GUARDRAILS §2 forbids resuming that extraction. **Do not report it as a
   finding** (§7). Do verify the dead-code premise still holds — that no
   `src/*.jsx` imports from those folders.
5. **The admin's own cyan tints were not converted** — `.btn-pdf` and
   `.type-badge` in `admin/index.php` and `admin/help.php` still use
   `rgba(0,190,242,…)` / `rgba(17,158,200,…)`. A10-045 scoped itself to the
   public site, and the admin is not owner-repaletteable. Judge whether that
   scoping is right; if you think it is a gap, log it in `WHATS_LEFT.md` §2
   rather than fixing it.
6. **`cssdiff`.** Run `node _harness/cssdiff.js --save` on `main`, then after any
   rebuild. Phase B shipped a Tailwind utility into the bundle from a **comment**
   containing a utility name; every phase since ran cssdiff for that reason.
   Tailwind scans `./index.html` and `./src/**/*.{js,jsx,ts,tsx}` only.
7. **`PATCH_NOTES.md` numbers are owner-facing and were written by the fixer.**
   Spot-check the headline figures against your own measurements — especially
   "689px → 390px", "1,120 elements byte-identical", "1.05:1 → 4.59:1", and
   "0 of 42 rows clipped".
8. **The 39 severity-C and 9 severity-D findings were explicitly out of scope.**
   Confirm none was silently fixed or silently made worse. Two interact with
   PLAN-10's changes: **A10-039** (`&amp;` in accessible names — item 8 decodes
   those titles for the log line but did **not** fix the storage) and **A10-033**
   (help.php under-describing the admin header, which item 6 left at 11 links).

---

## 7. Rules for you

- **Fix nothing** except a defect you introduce while measuring. This is an
  audit. Findings go in the report; anything genuinely broken and out of scope
  goes in `WHATS_LEFT.md` §2 with date, evidence and `file:line`.
- **Never report something as verified without the artifact.** A command's
  output, a browser measurement, or a failing-then-passing test. "I read the
  code and it looks right" is not a result.
- **Measure in the browser, not in the source.** Every AUDIT-10 finding was.
- **The bash mount can lie.** Confirm any claim about file contents with `Read`.
  If `Read` and a shell command disagree, `Read` wins — say so.
- **Three failed attempts means your model of the problem is wrong.** Stop and
  report what you tried and what you now believe.
- Refutations are as valuable as findings. If a claim in this document is wrong,
  **say so with a measurement** — including the claims in §4. This document was
  written by the party under audit.

---

## 8. Handback

1. **Per finding** — closed / not closed / weakly verified, with the measurement.
2. **Errors** — anything the executing session got wrong: a fix that does not
   hold, a number that does not reproduce, a `file:line` that does not resolve.
3. **Gaps** — verified-too-narrowly, in the shape of §4.2 and §4.4.
4. **Missed process** — suites not run, records not written, guardrails skipped.
5. **The two judgement calls** — do you agree, on the evidence?
6. **Regression table**, before and after, with the three expected exceptions
   called out by name.
7. **What is still open**, including item 4 and everything in `WHATS_LEFT.md` §2.

State plainly what you did not check. Scaling the audit down is the owner's
call, not the auditor's.
