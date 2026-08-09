# Audit prompt — IPC website, post PLAN-8 + PLAN-7 (2026-08-09)

Paste everything below the line into a fresh Claude Code session.

---

You are auditing a production-bound website for defects. **You are a reviewer,
not an implementer.** Your single deliverable is a list of real, reproducible
errors and gaps. You fix nothing.

## The application

Insulation Products Corporation — a hybrid static React site plus a PHP admin,
for a real 50-year-old electrical-insulation distributor in Bolingbrook, IL.
Two audiences, and every judgement is settled by asking which one you are
protecting:

- **Rick**, the owner: non-technical, around 60, uses FTP reluctantly. He
  edits the site through `/admin`.
- **A buyer looking for a spec-grade part**, who arrived from a search engine
  or a procurement email.

`main` is at `4a3763a`. Nothing is deployed. The repo is public.

## Your objective, stated once

Find defects that are **present in the code at `4a3763a`** and **not already
recorded**. For each one, produce evidence a skeptical reader can re-run.

That is the whole job. You are not asked to improve the site, propose
features, refactor anything, or rate the design.

---

# 1. Absolute constraints

These are not negotiable and there is no exception for a "small" case.

| Never | Why |
|---|---|
| Modify **any** file under `src/`, `admin/`, `public/`, `data/`, `pdfs/`, `uploads/` | You are auditing, not fixing. A fix arrives without its test and is indistinguishable from scope creep |
| `git commit`, `git push`, `git checkout`, `reset`, `stash`, `revert`, `rebase` | The working tree is the only copy of some of this |
| Edit `data/*.json`, `pdfs/`, `uploads/` | Live customer state. `_harness/pristine/` holds the reference copies |
| Commit or print the contents of `admin/config.local.php` | It holds a live credential. **The repo is public** |
| Edit `DEPLOY_READINESS_v2.md` | Frozen. Its value is that it did not change |
| Touch `_localsite/` | A reference copy of an older deploy. Evidence, not source |
| Install a paid dependency or service | $0 budget |

**You MAY** write files under `_harness/` (new probe scripts) and under your
scratchpad. Temporary mutations to `src/` are allowed **only** to prove a test
can fail, and **must** be reverted in the same tool call sequence, with
`git diff --stat src/` shown as empty afterwards.

When you finish: delete `_harness/site/admin/config.local.php`.

---

# 2. Anti-hallucination rules — read these twice

This codebase has a documented history of confident, wrong findings. Three
real examples, all from earlier sessions:

- A contrast tool scored a gradient across an **element's box** rather than the
  **text's ink extent**. The box was 1232 px wide, the text 83 px. The
  resulting claim — "nothing passes AA in the page header" — was false and sat
  in the records for days.
- An audit reported four spec tables overflowing at 1440. Across all 42:
  **zero**. The four were an artifact of the auditor's font stack.
- A suite passed against a broken assertion because it was matching an incident
  comment that quoted the old buggy pattern, not the code.

So:

1. **A grep is not a measurement.** If a claim is about what renders, what
   paints, what a screen reader hears, or what a browser requests — measure it
   in the browser with Playwright. Reading source and reasoning forward is how
   all three failures above happened.
2. **Every finding carries an artifact.** A command and its output, a
   measurement, a screenshot path, or a failing probe you wrote. A finding
   without one does not go in the report.
3. **Reproduce before you report.** State the exact URL, viewport, and steps.
   If you cannot make it happen twice, it is not a finding.
4. **Never describe code you have not opened.** No "this likely...", no "this
   probably calls...". If you are inferring, say `INFERRED` and say what you
   would need to confirm it.
5. **Separate "broken" from "unverifiable".** `php -S` ignores `.htaccess` and
   `.user.ini`, so anything depending on them cannot be tested locally. Label
   those `[UNVERIFIED]` and do not report them as passing **or** failing.
6. **The bash mount can lie.** Truncated reads and false successes have both
   happened here. Confirm any claim about file contents with the `Read` tool.
   If `Read` and a shell command disagree, `Read` wins — and say so.
7. **Do not invent severity.** Use the scale in §7 and justify the level with
   the consequence to Rick or to a buyer.
8. **If you find nothing in an area, say so.** "Swept X, found nothing" is a
   valuable result. Do not manufacture a finding to fill a section. A report
   with three real defects beats one with three real defects and nine
   speculations.
9. **Do not re-litigate settled decisions.** §6 lists them. Raising one wastes
   a review cycle and has happened repeatedly.
10. **State your coverage honestly.** If you audited 6 of 10 routes, say six.
    Never imply a sweep you did not run.

---

# 3. Read these first, in this order

1. `CLAUDE.md` — architecture and the **12 invariants**. Each names a real
   defect it prevents. If your finding proposes reversing one, you are almost
   certainly wrong — check the invariant's incident note first.
2. `plans/GUARDRAILS.md` — binding rules. §4.1 is the regression baseline,
   §4.3 is what `php -S` cannot test, §7 is the do-not-re-report list.
3. `WHATS_LEFT.md` — **long, and the most important file for you.** §1* is what
   shipped, §2* is what is already open, §3 is settled decisions, §4* is the
   evidence. **Anything in §2 is already known — do not report it as new.**
4. `PATCH_NOTES.md` — the release record, most recent sections last.
5. `plans/PLAN-7-marketing-imagery.md` and
   `plans/PLAN-8-audit-remediation.md` — the two most recent plans. PLAN-8 §9
   is the 50-item outcome table.
6. `_harness/README.md` — the suites and what each one holds.

---

# 4. Stand the environment up

Run everything **from the repo root** — `php-mail.ini` sets a relative
`sendmail_path` and several suites resolve `_harness/...` relative to cwd.

```sh
npm install
npm run build && sh _harness/sync.sh
php -S 127.0.0.1:8123 -t _harness/site -c _harness/php-mail.ini _harness/router.php &
```

Two more servers are needed only by `plan2-trunc.js`:

```sh
php -S 127.0.0.1:8124 -t _harness/site -c _harness/php-trunc.ini   _harness/router.php &
php -S 127.0.0.1:8125 -t _harness/site -c _harness/php-nb2-off.ini _harness/router.php &
```

**Re-run `sh _harness/sync.sh` after every `npm run build` and every edit under
`admin/` or `public/`.** A stale mirror has produced false passes before.

`_harness/browser.js` is the shared Chromium launcher — use it, do not call
`chromium.launch()` directly and do not run `playwright install`.

---

# 5. The baseline — measured at `4a3763a`

**Run this before you audit anything**, so you know what you inherited rather
than what you caused.

```
lint.php    php -l 19/0 · node --check 9/0 · JSON 17/10/42
            copydrift 110 matched, 0 PHP-only, 0 JS-only · 11 families · 12 approvals
build       0 errors

invariants          17/17    invariants-selftest 15/15   copydrift-selftest 5/5
copyroundtrip       15/15    contrastparity      28/28   skuparity          33/33
deadlinks     0 of 18 dead   backdrop-selftest    9/9
plan2-formlast       8/8     plan2-sku           14/14   plan2-delete       18/18
plan2-contrast      42/42    plan2-trunc         13/13
plan3-contact       51/51    plan4-admin         19/19   plan4-public       27/27
plan5-keys          11/11    plan5-spectable     13/13   plan5-images       12/12
plan5-social        35/35    plan5b-sidebar       9/9    plan5b-sitemap      9/9
plan5c-sitemap      17/17    plan5c-eyebrow       5/5    plan5c-brandink     6/6
plan6-families      13/13    plan7-approvals     11/11   plan7-datasheets    8/8
plan7-imagery       11/11    plan7-slots         16/16
plan8-certs          5/5     plan8-meta          15/15   plan8-catalog      16/16
plan8-lead          16/16    plan8-motion         8/8    plan8-chrome       16/16
plan8-keyboard       8/8     plan8-mobile        16/16   plan8-faq          19/19
plan8-crumbs        22/22    plan8-landing       18/18   plan8-formpolish   15/15
plan8-contrast      34/35  ← EXPECTED, see below
plan8-polish        16/17  ← EXPECTED ON LINUX, see below
brandtext           34/45  ← EXPECTED RED, judge by FAILING count (11), ratchet 13
```

`node _harness/run.js <suite> [suite...]` runs a list and prints one line each.

**Three of these are expected and are NOT findings:**

- **`plan8-contrast` 34/35.** One named exemption (`EXEMPT_BRAND_SURFACE`) for
  a computed brand ink on a computed brand surface. A counter, not a blanket
  rule, so a second failure cannot hide behind it.
- **`brandtext` 34/45.** The logged open item `brand-text-on-brand-surface`.
  **Judge it by the FAILING count (11), not the ratio** — the number of scored
  combinations wobbles by one between runs of identical code, because the hero
  animates and a small ink extent is position-sensitive. It must not exceed
  **13 failing**.
- **`plan8-polish` 16/17 on Linux.** See §6, first entry. This is a font
  artifact, not a defect.

---

# 6. Already known — DO NOT report these as new

Each is closed with evidence or logged as open. Raising one wastes a cycle.

### Environment artifacts that look like defects

- **The C49 spec-table red.** `plan8-polish`'s "no spec table scrolls
  horizontally at 1440" fails on any box where `system-ui` resolves to DejaVu
  Sans instead of Segoe UI. Measured: the same 14 px string is 179.9 px in
  DejaVu, 159.7 px in Arial/Liberation, 148.9 px in Segoe UI — ~21 % wider.
  Forcing Arial metrics brings all four tables back inside their column
  (435→390, 396→389, 398→389, 403→389) with `src/` untouched. **A red C49 on
  Linux is the font.** Verify the font before treating any width finding as
  real, and apply the same caution to every other width or overflow claim you
  make.
- **`plan3-autoreply` is `[UNVERIFIED]` on Windows** — `sendmail_path` points
  at a POSIX shell script.
- **`php -S` ignores `.htaccess` and `.user.ini`.** The `admin/` and `data/`
  blocking rules, the `SetEnvIf` cache, the dotfile block, the
  `ALLOW-PASSWORD-RESET` block and every `public/.user.ini` limit are **not**
  exercised locally. Apache is the real gate.
- **`:focus-visible` will not match programmatic focus in Chromium.** Every
  focus assertion must drive real `Tab` / `Enter`.
- **The Tailwind extractor scans raw source text including comments.** A bare
  utility word anywhere — even inside a comment explaining the trap — emits
  that rule. It has fired **seven** times, at least four inside a comment about
  something else. `node _harness/cssdiff.js` catches it; the build's byte count
  does not.

### Closed with evidence — do not re-open

- Missing PDFs, `logo.svg`, `pdfs-marketing` — sandbox artifacts, present here.
- "Six Industries links wrong"; "Mega-menus broken on touch"; Apache 2.2
  `.htaccess` syntax.
- `src/pages/`, `src/components/`, `src/lib/` are **dead code**. Nothing
  imports them; `src/App.jsx` is the runtime. Editing them has zero effect.
  Do not report them, and do not propose resuming the extraction.
- **C43** — the logo `alt` was deliberately **not** changed. The navbar `<a>`
  carries `aria-label="Insulation Products Corporation — Home"`, which
  overrides the image's `alt`, so naming the destination again reads the phrase
  twice. `alt=""` on all three is correct.
- The security posture — `require_auth()`, `csrf_check()`, upload validation,
  `basename()`+`realpath()` containment, `h()` on every echo, optimistic
  concurrency. **Re-verify it; do not re-derive it.**

### Logged open in `WHATS_LEFT.md` §2 — known, not new

`page-header-sublines-on-gradient` (18, ratchet 18) ·
`brand-text-on-brand-surface` (11 failing, ratchet 13) ·
`product-index-rows-over-120px` (3 of 42) · `spec-table-subheader-contrast`
(3.11:1) · `product-page-footer-layout-shift` · `contact-desktop-focus-order`
(decided, not missed) · `c49-guard-is-font-metric-dependent` ·
`copy-extractors-are-blind-to-comments` · `backdrop-skips-raster-layers`
(closed by PLAN-7 item 1) · `marketing-imagery-unwired` (closed by item 2) ·
`plan7-item-3b-image-picker` (not started) · `staff.jpg` painted above its own
resolution (0.86×, source ceiling — only a new photograph fixes it).

### Deliberately deferred, with reasons — do not report as oversights

- **C34 datasheet file sizes** — PDFs are owner-uploaded, so a build-time
  manifest goes stale on the next upload and a per-request read needs a new
  dynamic endpoint.
- **C40 no-JS response format** — returns JSON, not a styled page. HTML means
  changing the response contract of a file that deliberately does not
  HTML-escape (invariant 10).
- **C31 catalog scoping** — `/dashboard` filters by product *family*; the data
  carries no industry→family mapping.
- **C37 empty space** — the page-header band is 32–71 % empty on its right at
  1440. The answer is photography (PLAN-7), not wider text.
- **PLAN-7 slot 5** (catalog cover in the footer) — `catalogPdfUrl` is `""`,
  so it would paint nothing.
- **PLAN-7 item 3b** (image picker) — not started.

### Settled decisions — do not relitigate

A2 (drop the ISO version from defaults; the real revision is the owner's) ·
A3/C29 (**Option B**, keep `?productId=`) · C36 (owner is checking the social
URLs) · C48 (`VALUE-ADDED` is a product, show it everywhere) · the git-history
rewrite for the exposed `_localsite` hash (**escalated, awaiting the owner** —
recorded, not forgotten).

---

# 7. What to audit, in priority order

## A. The most recent changes — highest value

These landed last and have had the least independent review. Commits
`dd50628`, `da2bde9`, `088c5cb`, `a0daf7f`, `190b17d`, `2ce4152`, `248ab9a`,
`ad81b9a`.

Start with `git log --oneline 6bd7246..HEAD` and
`git diff 6bd7246..HEAD -- src/ admin/`.

**Specific hypotheses to test — confirm or refute each with a measurement.
Do not assume any of them is true.**

1. **Owner-overridden image slots may reserve the wrong box.** PLAN-7 item 3a
   made five image slots owner-editable, but `width`/`height` come from the
   constants `HERO_PHOTO`, `BAND_TEAM`, `BAND_BUILDING` in `src/App.jsx`, which
   describe the **shipped default** files. Point a slot at a differently-shaped
   image and the declared box may not match the real one → layout shift.
   `plan7-slots` proved an override renders; it did not assert dimensions.
   Measure CLS with a PerformanceObserver on a throttled load, with a slot
   overridden to a file of a different aspect ratio.
2. **`COPY_CLEARABLE` is now `/^(subhead|.*Subhead|.*Photo)$/`.** Does `.*Photo`
   match any key it should not, now or by obvious future naming? Does clearing
   still behave correctly for every `subhead` key?
3. **C29 gave `product` a legitimate `null`** on a bare `/products`. Sweep every
   path in `ProductPage` that dereferences it — the sticky RFQ bar, the
   sidebar, the not-found banner, an empty catalog, and a bad `?productId=`.
4. **C33 claims `/dashboard` and `/datasheets` are children of `/products`.**
   Is that a defensible information architecture, and does the emitted
   `BreadcrumbList` validate against Google's requirements (intermediate items
   need an `item` URL)?
5. **C41 lifted `open` out of `FaqItem`.** Does the 4.20 accessibility contract
   still hold under every path — rapid toggling, reduced motion, a background
   tab, and an owner editing the FAQ while the page is open?
6. **C37 changed `.ipc-page-header` padding globally.** Check every route at
   1440, 1024, 768, 390 for a regression the suites do not cover.
7. **The C39 privacy note** is an owner-editable string with a hardcoded link
   appended. What happens if the owner clears it, or types something that reads
   wrongly with " Privacy Policy." appended?

## B. The admin, as Rick would use it

Password is `audit-pass-123` in the mirror (written by `sync.sh`). Drive real
journeys: edit content, save, break something, save again, use the Back button,
open two tabs, submit an oversized form, upload a bad file. **Anything that
loses his typed work is severity A.**

## C. The public site, as a buyer would use it

Land from a search result on a deep product URL. Find a part. Get a datasheet.
Request a quote. Do it at 1440 and at 390, and once with JavaScript disabled.

## D. Cross-cutting sweeps

Console errors and failed requests on all 10 routes × 2 viewports; all 42
product pages; keyboard-only traversal; the copy contract
(`node _harness/copydrift.js`); `node _harness/cssdiff.js` after any build.

---

# 8. Output format

A single markdown report. No fixes, no patches, no commits.

For each finding:

```
### [A|B|C] <one-line title>

**What it does to a real person.** One or two sentences, concretely.
Not "improves accessibility" — "a screen-reader user hears every answer to
every question with no way to tell which are collapsed".

**Evidence.** The command, the measurement, the screenshot path, or the probe
you wrote. A number wherever a number exists.

**Reproduce.** URL, viewport, exact steps.

**Where.** file:line.

**Confidence.** CONFIRMED (measured twice) | LIKELY (measured once) |
INFERRED (read, not measured — say what would confirm it).
```

Severity:

- **A** — broken, or costs a lead or credibility. A false certification claim,
  a lost enquiry, a page that does not render, destroyed owner input.
- **B** — a real defect a user will hit and notice.
- **C** — polish.

End the report with:

1. **Coverage** — what you swept and what you did not, honestly.
2. **`[UNVERIFIED]`** — everything you could not test locally, and why.
3. **Refuted** — hypotheses from §7A you checked and found **not** to be
   defects. This section is as valuable as the findings; a refutation with a
   measurement stops the next session re-chasing it.
4. **Regression state** — the §5 table as you measured it, with any deltas
   explained.

---

# 9. Stop conditions

- **Three failed attempts to reproduce one thing → stop and report it as
  unreproducible**, with what you tried and what you observed. Do not keep
  going.
- **If the baseline in §5 is red beyond the three expected cases**, say so
  before auditing anything else — you need to know whether you inherited it.
- **If a finding would require changing an invariant in `CLAUDE.md`**, stop and
  flag it as a question rather than a finding. Twelve of those exist because
  someone "simplified" one back.
- **Do not exceed the objective.** No feature suggestions, no redesigns, no
  refactors, no opinions on visual style unless a measurement backs them.
