# AUDIT-11 — independent verification of PLAN-10

**Written:** 2026-08-11, against `main` @ `33dffb8`.
**Contract:** `plans/AUDIT-11-verify-plan-10.md`, written by the session that
executed PLAN-10 phases C, D and E. Its claims were treated as the subject of
this audit, not as evidence.
**Nothing was fixed.** Per contract §7 this is an audit; the only repository
change it makes is this report and one `WHATS_LEFT.md` §2 record.

---

## 0. Verdict

**All twelve remediated findings are closed.** The thirteenth (A10-037, item 4)
was never executed, is still open, and still reproduces — as the contract said
it should.

The single highest-value claim — that `audit10-repalette.js` and
`audit10-p7reverify.js` still reporting `A10-045 REPRODUCES` / `A10-046
REPRODUCES` is **probe blindness, not fix failure** — is **correct**. It was
re-derived through the owner path and holds: 18/18.

Four numbers published by the executing session do not reproduce, one of them
owner-facing. Ten cited `file:line` references have drifted and four were wrong
when they were written. None of this changes a verdict; all of it is recorded
below with the measurement.

---

## 1. Per-finding verification

Verdicts are **closed** / **not closed** / **closed-but-weakly-verified**.
"Own probe" means a probe written for this audit, not PLAN-10's suite.
`p7reverify` is the audit's own frozen pass-7 probe, run **unedited**.

| Finding | Item | Verdict | Measurement |
|---|---|---|---|
| **A10-011** | 1 | **closed** | Own probe, all 42 products at 390: narrowest title column **276px** (was **0.0px**), **0** ink-over-button pairs (was overlap on 42 of 42), max 4 h1 line boxes, documentElement overflow 0px. `plan10-header` 8/8. `p7reverify`: DOES NOT REPRODUCE |
| **A10-001** | 2 | **closed** | `p7reverify` (unedited, independent of the fixer): DOES NOT REPRODUCE. `plan10-dashboard` 25/25 |
| **A10-002** | 2 | **closed** | as above — same probe, same suite |
| **A10-012** | 3 | **closed** | Own probe, **both** tabs × 390/834/1440 = 18/18: **0px** of the invalid field under the 65px sticky header (was 46 of 46px); label at 714.2/607.1/553.5 vs headerBottom 65 (was −21.8); `noValidate=false`, `valueMissing=true`, message intact — the fix is still `scroll-margin-top`, not a JS takeover |
| **A10-020** | 5 | **closed** | `plan10-adminrows` 15/15; the accepted cost re-measured independently — see §4 |
| **A10-021** | 6 | **closed** | Own probe, **all 13** pages at 390 = **52/52** — see §3 |
| **A10-022** | 7 | **closed** | Own probe at 390: `scrollWidth 390 === clientWidth 390` (was 689 vs 390); `overflow-x` is **not** `hidden` on html or body — the fit is real, not clipped; 0 of 26 tables past the viewport without a working scroller |
| **A10-027** | 8 | **closed** | Own probe — see §5. Settled no-op save logs `sku="none"`, `"Page content saved — no fields changed"`; a pure row **reorder** and a **delete-all** are both detected and named |
| **A10-028** | 9 | **closed** | Own probe reading `svg.querySelectorAll('text')`, never `innerText`: box 2 reads `Photo / Upload from / your computer`. No `Paste` and no `Photo URL` anywhere in the diagram's text nodes |
| **A10-029** | 10 | **closed** | Own probe: header is **1 row, 4 flat `<th>`**, every `colspan`/`rowspan` = 1, no column labelled Min or Max; the three data rows byte-identical to the pre-fix values; every Recovered < its Expanded. Domain evidence confirmed and **stronger than claimed** — see §6 |
| **A10-045** | 11 | **closed** | Own owner-path probe 18/18 — see §2 |
| **A10-046** | 12 | **closed** | Own owner-path probe 18/18 — see §2 |
| **A10-037** | 4 | **open, still reproducing** | `p7reverify`: **REPRODUCES**. Item 4 was never executed and is blocked on the owner. Confirmed and left alone, as instructed |

Nothing is **not closed**. Nothing is **closed-but-weakly-verified**, with the
qualification in §9 about A10-001/A10-002.

---

## 2. §4.1 — the probe-blindness claim is correct

### The claim holds, verified through the owner path

A probe written for this audit (`a11-owner-repalette.js`, no `page.addStyleTag`
anywhere) rewrites `theme` in `/data/site-info.json` through a route intercept —
which is exactly what saving Business Details → Branding produces — and measures
the five surfaces the two findings name, before and after.

**18/18.** All six new variables move, and every named surface moves with them:

```
--brand-accent-rgb      0, 190, 242      -> 255, 157, 46
--brand-accent-2-rgb    17, 158, 200     -> 210, 105, 30
--brand-dark-2          rgb(10, 42, 82)  -> rgb(45, 17, 0)
--brand-dark-panel      rgb(14, 40, 71)  -> rgb(62, 16, 0)
--brand-dark-drawer     rgb(10, 36, 68)  -> rgb(45, 14, 0)
--brand-primary-deep    rgb(0, 61, 122)  -> rgb(97, 18, 67)

header hairline         rgba(0,190,242,0.15) -> rgba(255,157,46,0.15)
homepage badges         8 found, 0 cyan leaks
/dashboard chips        95 tinted chips, 0 cyan leaks
product header (IP38FE) linear-gradient(135deg, rgb(10,42,82) 0%, rgb(0,93,163) 100%)
                     -> linear-gradient(135deg, rgb(45,17,0) 0%, rgb(138,28,90) 100%)
                        — the previously frozen FIRST stop moves
industries card headers linear-gradient(135deg, rgb(0,61,122), rgb(0,93,163))
                     -> linear-gradient(135deg, rgb(97,18,67), rgb(138,28,90))
                        — 5 card headers + the page header, 0 navy leaks
```

**The mechanism is confirmed, not assumed.** `ThemeInjector` derives the six new
variables from `site.theme.*` — the JSON — not from the CSS custom properties
(`src/App.jsx:7358-7361`, `:7446-7449`). The audit's drills inject
`:root{… !important}`, which outranks `ThemeInjector`'s inline `setProperty` for
the ten variables they list, but cannot reach a variable derived from JSON they
never touch. A custom property the drill does not inject genuinely cannot move.

### Reproducing the drills' unchanged output

Both frozen probes were run unedited:

```
audit10-p7reverify.js   A10-045 REPRODUCES · A10-046 REPRODUCES  (as documented)
audit10-repalette.js    41 leak rows, vars changed 10/10 on all 8 page-states
```

**41 rows confirmed**, matching the "byte-identical to its pre-fix run" claim.

### REFUTATION — the leaks do not go to zero

Contract §4.1 step 3 says to add the six variables to the drill's injection map
in a scratch copy and *"confirm the leaks go to zero."* They do not.

```
audit10-repalette.js, unedited                       41 leak rows
scratch copy + the six variables                     16 leak rows
```

The residual 16 is **2 per page-state × 8 page-states**, and both are the same
pair every time:

```
[family] color rgb(10,34,64) x1  a.ipc-skip  ~--brand-dark d=21.3
[family] bg    rgb(10,34,64) x1  footer      ~--brand-dark d=21.3
```

`rgb(10,34,64)` is `#0a2240`, the footer's hardcoded background and the skip
link that matches it. **A10-046's own record excludes that pair as deliberate**
(`findings.jsonl:46`: *"EXCLUDED as deliberate: the footer's rgb(10,34,64)/#0a2240
and the .ipc-skip link that matches it"*), and `src/App.jsx:7408-7411` states in
terms that the footer is not an owner-set colour.

So the substance is right — **every leak attributable to A10-045 or A10-046 goes
to zero** — but the contract's flat "go to zero", and the `WHATS_LEFT.md` §2
claim that *"`plan10-repalette.js`'s `vars` arm is that same drill with the
complete set, and it reports **0** leaks"*, are both imprecise. It is not that
same drill: `plan10-repalette.js:122-140` carries an explicit exclusion list for
the deliberate footer pair. The scoping is documented and honest; the sentence
describing it is not accurate as written.

### Judging the trade (contract §4.5, item 12)

The session accepted "the frozen probes will keep saying REPRODUCES" in exchange
for "the deployed site does not move on the default palette". **I agree, and the
evidence supports it.** With the shipped palette the four surfaces still paint
their original literals exactly — `rgb(10,42,82)`, `rgb(0,61,122)`,
`rgb(14,40,71)`, `rgb(10,36,68)` — measured in the "before" arm of both my probe
and the audit's own unedited drill. A cosmetic property of a frozen probe does
not outrank the appearance of the live site a buyer sees.

---

## 3. §4.2 — the admin nav on all thirteen pages

`plan10-adminnav.js:56` covers three (`index`, `settings`, `help`). Thirteen
pages `include 'nav.php'`. A probe written for this audit measured all thirteen
at 390, with the same painted-backdrop contrast method the finding requires
(`elementsFromPoint`, skipping the link and its own descendants, ancestors
eligible — an ancestor walk reports this finding as already fixed).

**52/52.** Four assertions × 13 pages: 0 items above the document top, 0 items
past the header's own bottom edge, every item ≥ 4.5:1 on its painted backdrop,
every item hit-testable.

```
page               items  hdr(px)  nav(px)  navTop  above  belowBar  minContrast  hits
index.php             11      125       63      54      0         0         4.59  11/11
settings.php          11      125       63      54      0         0         4.59  11/11
help.php              11      125       63      54      0         0         4.59  11/11
add.php               11      125       63      54      0         0         4.59  11/11   ← never measured
audit-log.php         11      125       63      54      0         0         4.59  11/11   ← never measured
backups.php           11      125       63      54      0         0         4.59  11/11
content.php           11      125       63      54      0         0         4.59  11/11
delete.php            11      119       57      54      0         0         4.59  11/11
edit.php              12      138       76      54      0         0         4.59  12/12   ← never measured
inquiries.php         11      125       63      54      0         0         4.59  11/11
password.php          11      121       59      54      0         0         4.59  11/11
upload-image.php      13      138       76      54      0         0         4.59  13/13   ← never measured
upload-pdf.php        12      138       76      54      0         0         4.59  12/12   ← never measured
```

The specificity override holds everywhere, including on all four never-measured
pages that carry the duplicate bare `header { … height: 60px … }`.

### REFUTATION — §4.2 names the wrong worst case

The contract says *"`edit.php` and `upload-pdf.php` also inject `$navExtra`, so
they carry **more** than 11 items — the exact case most likely to overflow."*

**Three** pages inject `$navExtra`, not two. `admin/upload-image.php:181-182`
injects **two** links (`Edit Details` **and** `Manage PDF`), giving it **13** nav
items — more than `edit.php` or `upload-pdf.php` at 12. The page the contract
identifies as the riskiest is not the riskiest; `upload-image.php` is, and it
was named in neither the contract nor the suite. It passes 13/13.

### The six-duplicate-header record is accurate

Confirmed by rule detection in the live page CSS: `index`, `help`, `add`,
`audit-log`, `edit`, `upload-pdf` carry a bare `header {` rule and the other
seven do not — exactly the six the record names, and `help.php` alone adds
`position: sticky; top: 0; z-index: 20`. `_harness/lint.php` has **no** header
drift check, so the record's suggestion does not duplicate anything.

---

## 4. §4.5 — the two judgement calls

### Item 5 (A10-020) — the wrap-vs-widen call: **agree**, and the cost claim reproduces exactly

```
                       commit 4969716 claims   measured now
Actions cell minimum   78px                    78.0px
maximum                122px                   122.0px
average                81.2px                  81.2px
```

All three to the digit, over 42 rows at 1440. `flex-wrap: wrap` is live and the
button row wraps to 2 rows. "Four rows in the space that held six" is sound
arithmetic: 6 × 48px = 288px pre-fix, and 288 / 81.2 = **3.55** rows now.

**REFUTATION of the contract, in the executor's favour.** Contract §4.5 renders
this as *"**every** catalog row grows 48px → 78px"*. The commit itself is more
careful and more correct — it says *"78px minimum (max 122, avg 81.2)"*. Rows are
not uniformly 78px; I measured five distinct heights (78, 78.5, 79, 108.5, 122).
The commit's number is right; the contract's paraphrase of it is not.

On the call itself: at 1024 the widened alternative leaves Delete a sliver at the
table edge reachable only by discovering a 74px horizontal scroll inside a card,
which is the audited failure mitigated rather than fixed. GUARDRAILS §0 settles
ties by asking which option protects Rick. Wrapping does. The cost was stated
plainly in the commit rather than discovered later, which is the right handling —
though the density change is visible on the page Rick uses most, and flagging it
for him is still the correct next step.

### Item 12 (A10-046) — the dedicated-variable call: **agree**, but one number is wrong

The decisive claim is that reuse would move three of four surfaces perceptibly.
I recomputed all four ΔE2000 figures independently (CIEDE2000, D65):

```
surface                    literal   reuse gives   claimed   measured   verdict
industries card header     #003d7a   #004c86         5.92       5.29     DIFFERS
mobile drawer              #0a2444   #0d2d52         3.22       3.22     matches
mega-dropdown panel        #0e2847   #0d2d52         2.24       2.24     matches
product-detail header      #0a2a52   #0d2d52         1.27       1.27     matches
```

Three reproduce to two decimal places, which indicates the same implementation.
The industries figure does not: **5.92 claimed, 5.29 measured**. No plausible
alternative comparand explains it — `#003d7a` against `--brand-primary` is 11.25,
against `--brand-dark` 6.95, against `--brand-dark-2` 7.59. `--brand-primary-hover`
(`#004c86`, = `#005da3` × 0.82/channel, and the variable PLAN-10 §5 actually
proposed and the orphan branch actually used) gives 5.29.

**The error does not change the decision.** 5.29 is still more than double the
~2.3 "noticeable at a glance" threshold, so three of four surfaces still move
perceptibly under reuse and the dedicated-variable route is still the right call.
The published number is simply wrong by 0.63.

---

## 5. §4.4 — the audit-log diff on the untested shapes

### REFUTATION — the key space is 31, not ~44

Contract §4.4 says *"`$SECTIONS` (~24 keys) and `$COPY_GROUPS` (~20)"*. Measured
by parsing the arrays: **`$SECTIONS` 17**, **`$COPY_GROUPS` 14**, total **31**.
`plan10-auditlog.js` exercises 4, so the coverage is 4 of 31, not 4 of ~44.

### The comprehensive test: a settled no-op save

The sharpest available check of all 31 keys at once is a settled no-op save. If
any key normalises unstably — `$out[$key] !== $storedContent[$key]` for a section
nobody touched — the handler reports it as changed on **every** save, forever.
That single assertion covers `services`/`brochure`, the `type: 'page'` default,
`families`, and every other key without needing to reach each through the UI.

```
settling save   sku="multiple"  "Updated: Product Families / Categories, Site Images,
                                 Datasheets page — banner, and 2 more"
no-op save      sku="none"      "Page content saved — no fields changed"
```

**All 31 keys normalise stably.** The `services` → `brochure` refold
(`admin/content.php:548-552`) is order-safe against the shipped data because
`brochure` is already the last key of the row that carries it.

### The two structural shapes, through the real controls

```
row REORDER (↑ on a non-first row)   sku="features"  "Updated: Products & Services Cards"
  then a further no-op save          sku="none"      "…no fields changed"   (settled, no oscillation)
DELETE EVERY ROW of a section        sku="stats"     "Updated: Trust Bar Stats"
```

A pure reorder **is** detected — PHP's `!==` on arrays is order-sensitive — and
emptying a section entirely **is** detected, which is what invariant 3 requires
the diff to agree with. `plan2-formlast` 8/8 and `plan2-trunc` 13/13 (with :8124
and :8125 genuinely up) confirm invariant 6 is intact.

The mirror's `content.json` was restored from `_harness/pristine` and asserted
byte-identical (39,018 bytes) before this was written. Separately, I verified
`plan10-auditlog`'s own restore: after its suite run the mirror was byte-identical
to pristine (`cmp` clean).

**A10-039 interaction, confirmed working.** The log line renders
`Products & Services Cards` while the stored title is
`'Products &amp; Services Cards'` (`admin/content.php:77`, `:162`, `:173`, still
escaped, deliberately unfixed). The `html_entity_decode` at `:645-648` does its
job. My own probe initially scored this a failure by comparing against the DOM's
escaped `aria-label` — that was my error, not the handler's.

---

## 6. §5 — A10-029's domain check

**The catalog evidence is confirmed and is stronger than the fix claimed.**

The fix cites four SKUs. Measured against `data/products-all.json` (read only),
the headers live in `specTable2.columnSpans` as `{label, sub, colspan}`:

```
IP29CG   Order Size | Expanded Diameter | Recovered Diameter | Recovered Wall
IP33PO   Order Size | Expanded Diameter | Recovered Diameter | Recovered Wall
IP33TW   Order Size | Expanded Diameter | Recovered Diameter | Recovered Wall
IP34SR   Order Size | Expanded Diameter | Recovered Diameter | Recovered Wall

20 of 42 products carry Expanded Diameter + Recovered Diameter as sibling columns
12 of 42 name their fourth column "Recovered Wall"
 0 of 42 split a heading into sibling Min | Max sub-columns
```

The 2:1 shape holds on the cited rows (2.00, 2.03, 2.02 : 1). The claim at
`admin/help.php:514` that *"No product uses a Min | Max split"* survives checking:
the only near-misses put Min/Max **inside one column label** (`CT`: "O. D.
Min.-Max", "I. D. Min.-Max"; `IP17TW-…`: "Wall Thickness (min/max)"), which is a
different shape.

**A caution about method.** My first pass reported *zero* occurrences of
"Expanded Diameter" in the catalog and would have been a serious false finding.
The labels are stored with embedded newlines (`"Expanded\nDiameter"`), so a raw
text search for the phrase misses every one. This is the same class of error as
the `innerText`/SVG trap the contract warns about, and it is worth recording next
to it.

**Where I disagree, mildly.** The session declined to rename the fourth column
from "Wall Thickness" to the catalog's "Recovered Wall", on the grounds that
whether `0.020"` is a recovered or a nominal wall is not settled by anything
measurable (`admin/help.php:519-522`). But **12 catalog products name that column
"Recovered Wall"**, and that is the *same* kind of evidence — the owner's own
documentation — used to justify renaming the second column. The evidence for the
two renames is of one kind; accepting it for one column and not the other is
inconsistent. It is a small point and the conservative choice is defensible, but
the asymmetry should be put to the owner along with the relabelling itself.

**The surrounding prose is consistent.** The "Split into sub-columns" explanation
at `admin/help.php:544` now uses `Recovered` → `Diameter`/`Wall` (a shape IP30HS
and IP30UV really use) instead of the old Min/Max example.

**For the owner.** A relabelled specification in Rick's own documentation is his
call to ratify. The numbers were deliberately left byte-identical, which is right —
inventing numbers to match a header would be worse than the defect — but it means
the worked example's `0.020"` wall at a 3/4" order size does not correspond to any
single catalog row, and never did.

---

## 7. §4.7 — cited `file:line` references

21 citations in the five phase commits were resolved twice: at their own commit,
and at `HEAD`. Two distinct failure modes.

### Drifted since (correct when written, stale now) — 10

Phases C, D and E inserted comment blocks into files earlier phases had already
cited.

| Cited | Claim | At HEAD |
|---|---|---|
| `src/App.jsx:9224` (item 2) | description width null → 300 | `}` |
| `src/App.jsx:10062` (item 2) | Part ID cell overflowWrap | `</tr>` |
| `src/App.jsx:10083` (item 2) | Part Type cell | `style={{` |
| `src/App.jsx:5107` (item 3) | form onSubmit | `onSubmit={onRfqSubmit}` |
| `src/App.jsx:5393` (item 3) | message form action | `action="/contact.php"` |
| `src/index.css:251` (item 3) | scroll-margin-top rule | footer-background comment |
| `src/App.jsx:7332` (item 11) | ThemeInjector derivation | the `for` loop above it |
| `admin/help.php:625` (item 9) | three `<text>` in box 2 | `<h2>🚀 Launching…</h2>` |
| `admin/help.php:606` (item 9) | the `<svg>` aria-label | `</div>` |
| `admin/help.php:600` (item 9) | third stale-assumption instance | an unrelated `<li>` |

### Wrong when written (unchanged since their commit, and never resolved) — 4

| Cited | Claim | Actually at | Off by |
|---|---|---|---|
| `admin/content.php:993` (item 8) | "the page subtitle" | `:1007` | 14 |
| `admin/help.php:530-536` (item 10) | "Split into sub-columns" explanation | `:544-545` | 14 |
| `admin/help.php:146-154` (item 10) | a scroller for this table at ≤640px | `:163-164` | 17 |
| `admin/help.php:496-518` (item 10) | header becomes four flat columns | comment `:506-522`, `<th>`s `:524-527` | range starts 10 early, ends 9 short of the elements it describes |

The contract's precedent (item 9's `plan10-help 24/29` → `23/29`, caught before
push) was not an isolated slip.

### And in `WHATS_LEFT.md` §2

- **`src/App.jsx:8139-8145`** — cited by the phase B record *and* left uncorrected
  by the 2026-08-11 amendment above it — as "the comment justifying the h1 staying
  white". Line 8139 is `const hasPdfFile = Boolean(product.pdfUrl);`; the comment
  is at ~`:8214`.
- **`src/App.jsx:7345`** — cited as "the way the header ink already is". Line 7345
  is `if (!m) return null;` inside `rgbOf`. `headerInk` is derived at **`:7372`**.
- **`admin/add.php:126`, `admin/audit-log.php:66`, `admin/edit.php:253`** — all
  three point at the `body {` line, one above the `header {` rule they describe
  (`:127`, `:67`, `:254`). Confirmed with `Read`, which agrees with the shell.
  `help.php:19` and `index.php:47` are correct. `upload-pdf.php` is cited with no
  line at all (it is `:145`).

The §4.6 amendment is right on both points it corrects, and §4.6's description of
it is accurate. It is two comments, not one (`src/App.jsx:8214` and `:10556`); the
near stops are `var(--brand-dark-2)` and `var(--brand-primary-deep)`; and it does
name the new re-derivation targets explicitly — `inkFor([dark2, primary])` for the
product header and `inkFor([primaryDeep, primary])` for the industries card
(`WHATS_LEFT.md:510-513`). The ink itself was correctly left alone, and `brandtext`
is unchanged at **11 failing**.

---

## 8. §6 — process

| # | Check | Result |
|---|---|---|
| 1 | Nothing deployed | **Confirmed.** `PATCH_NOTES.md:1152` — "Not yet deployed. Nothing above is on the live server." |
| 2 | `.htaccess` / `.user.ini` still `[UNVERIFIED]` | **Confirmed.** No PLAN-10 commit claims otherwise; the only mention in the range is the AUDIT-10 prompt bucketing them as unverifiable |
| 3 | Orphaned branch | **Confirmed harmless.** `origin/claude/plan-10-phase-c` @ `14c5024` is **not** an ancestor of `origin/main`; neither is `3408482`. It took the reuse route — `linear-gradient(135deg, var(--brand-dark) …)` at its `App.jsx:8151` and `var(--brand-primary-hover)` at `:10494`. `main` carries the dedicated-variable implementation via the separate `plan-10-phase-c-2` @ `766b146`, which **is** merged |
| 4 | Dead-code premise | **Holds.** No `src/*.jsx` or `src/*.js` imports from `components/`, `pages/` or `lib/`. Not reported as a finding, per §7 |
| 5 | Admin cyan tints unconverted | **Confirmed and correctly scoped.** `admin/index.php:68-69`, `:97` and `admin/help.php:40` still carry `rgba(0,190,242,…)` / `rgba(17,158,200,…)`. `ThemeInjector` does not run in the admin at all, so these cannot follow a palette by any mechanism the fix introduced. **Not a gap**, not logged |
| 6 | `cssdiff` | Run on `main`: **362 selectors** saved from `index-UZxGabLl.css`. No rebuild was performed afterwards, so there is no delta to report |
| 7 | `PATCH_NOTES.md` headline numbers | 3 of 4 reproduce — see below |
| 8 | C/D findings not silently changed | **A10-039**: storage still escaped at `content.php:77/:162/:173`, decoded only for the log line — unchanged, as intended. **A10-033**: `admin/help.php:336`'s diagram still describes the header as six items (`IPC Admin · Products · + Add Product · Audit Log · Help · Sign Out`) while the real header carries **11**. Unchanged — neither fixed nor made worse |

### §6.7 — PATCH_NOTES spot-check

| Claim | Measured | Verdict |
|---|---|---|
| "689px → 390px" | `scrollWidth 390 === clientWidth 390` at 390 | ✅ |
| "1,120 elements byte-identical" | `plan10-repalette` default arm 33/33 | ✅ |
| "0 of 42 rows clipped" | `plan10-adminrows` 15/15; 0 clipped px at 1440 and 1024 | ✅ |
| **"1.05:1 → 4.59:1"** | after: **4.59:1** on all 13 pages ✅. before: **1.07:1** | ❌ **the "before" is wrong** |

`PATCH_NOTES.md:1076` prints `1.05:1` in the summary table while
`PATCH_NOTES.md:1065`, three lines earlier on the same page, prints **`1.07:1`** —
and `1.07:1` is what A10-021's own evidence records, twice. The document
contradicts itself, and the wrong figure is the one in the owner-facing table.

---

## 9. Regression state — 65 suites

Full sweep on `main` @ `33dffb8`, all three servers up (`php-mail.ini` on :8123),
`config.local.php` present, plus the ten-server fleet on :8130-8139 for
`plan5-throttle`.

```
lint.php                  php -l 19/0 · node --check 9/0 · JSON 17/10/42
                          copy drift 110 matched, 0 JS-only · 11 families · 12 approvals
                          · 5 photo-slot defaults · no family literals

invariants               17/17     invariants-selftest      15/15
copydrift                   ok     copydrift-selftest         5/5
copyroundtrip            15/15     contrastparity           28/28
skuparity                33/33     deadlinks          0 of 18 dead
backdrop-selftest          9/9
plan2-formlast             8/8     plan2-formlast-selftest    PASS
plan2-sku                14/14     plan2-delete             18/18
plan2-contrast           42/42     plan2-trunc              13/13
plan3-contact            51/51     plan3-autoreply          22/22
plan4-public             27/27     plan4-admin              19/19
plan5-keys               11/11     plan5-spectable          13/13
plan5-images             12/12     plan5-social             35/35
plan5-listeners          11/11     plan5-throttle           12/12
plan5b-sidebar             9/9     plan5b-sitemap             9/9
plan5b-pwthrottle        10/10     plan5c-eyebrow             5/5
plan5c-brandink            6/6     plan5c-sitemap           17/17
plan6-families           13/13     plan7-approvals          11/11
plan7-datasheets           8/8     plan7-slots              16/16
plan7-imagery            11/11
plan8-certs                5/5     plan8-meta               15/15
plan8-catalog            16/16     plan8-lead               16/16
plan8-motion               8/8     plan8-chrome             16/16
plan8-keyboard             8/8     plan8-mobile             16/16
plan8-landing            18/18     plan8-crumbs             22/22
plan8-faq                19/19     plan8-formpolish         15/15
plan9-firstsave            8/8     plan9-band                 4/4
plan9-meta               18/18     plan9-notfound             8/8
plan9-slots-slash          9/9
plan10-header              8/8     plan10-dashboard         25/25
plan10-rfqscroll         24/24     plan10-repalette         33/33
plan10-adminrows         15/15     plan10-adminnav          25/25
plan10-helpwidth         21/21     plan10-auditlog          13/13
plan10-help              29/29

plan8-contrast           34/35  ← EXPECTED RED (EXEMPT_BRAND_SURFACE)
plan8-polish             16/17  ← EXPECTED RED (DejaVu width artifact on Linux)
brandtext                34/45  ← EXPECTED RED (11 failing; ceiling 13)
```

**Exactly three reds, all three expected, named, and at or better than their
documented state.** `brandtext` is at **11 failing**, the value the contract
predicts and two below its ceiling. **No other red.** The §4.3 gap is closed.

### All fourteen never-run suites, run

`plan2-sku` 14/14 · `plan2-delete` 18/18 · `plan5-keys` 11/11 · `plan5-social`
35/35 · `plan5b-sidebar` 9/9 · `plan5b-sitemap` 9/9 · `plan5c-sitemap` 17/17 ·
`plan5c-eyebrow` 5/5 · `plan6-families` 13/13 · `plan7-approvals` 11/11 ·
`plan7-datasheets` 8/8 · `plan8-certs` 5/5 · `copydrift-selftest` 5/5 ·
**`plan9-firstsave` 8/8** — the one the contract singled out, green.

### Deltas against the GUARDRAILS §4.1 baseline

Two suites score **higher** than the 2026-08-08 baseline because they gained
checks: `plan5c-eyebrow` 4/4 → **5/5**, `plan5c-brandink` 5/5 → **6/6**. Neither
is a regression.

**The §4.1 baseline table is stale.** It lists 30 suites; the harness now has 65.
Fifteen of the suites I ran appear in it nowhere — `plan5-listeners`,
`plan5b-pwthrottle`, `plan7-slots`, `plan7-imagery`, `plan8-landing`,
`plan8-polish`, `plan8-crumbs`, `plan8-faq`, `plan8-formpolish`, `backdrop-selftest`,
all four `plan9-*`, and all nine `plan10-*`. A baseline that omits half the suite
set cannot tell an executor what they inherited, which is the job GUARDRAILS §4.1
gives it. `plan3-autoreply`, `[UNVERIFIED]` on Windows, verifies **22/22** here.

---

## 10. Errors, gaps and missed process

### Errors — published numbers that do not reproduce

1. **ΔE2000 5.92 → 5.29** for the industries card header (§4). Does not change the
   decision it supports.
2. **`PATCH_NOTES.md:1076` "1.05:1"** should be **1.07:1**, and contradicts
   `:1065` three lines above it. Owner-facing.
3. **4 `file:line` citations wrong when written**, 10 more drifted, plus 5 stale
   or off-by-one references in `WHATS_LEFT.md` §2 (§7).
4. **`WHATS_LEFT.md` §2's "reports 0 leaks"** describes a drill with an exclusion
   list as "that same drill with the complete set" (§2). The measured figure for
   the unmodified drill plus the six variables is **16**, all of them the
   documented deliberate footer pair.

### Errors in the contract itself

5. **§4.1 "confirm the leaks go to zero"** — they go to 16 (§2).
6. **§4.2 names `edit.php` and `upload-pdf.php`** as the >11-item cases; the
   worst case is **`upload-image.php` at 13**, named nowhere (§3).
7. **§4.4 "~24 + ~20 keys"** — measured **17 + 14 = 31** (§5).
8. **§4.5 "every catalog row grows 48px → 78px"** — the commit it paraphrases is
   more accurate than the paraphrase (§4).
9. **§4.3 "about 25 suites were never run … `_harness/README.md` lists ~51"** —
   there are **65** runnable suites.

### Gaps — verified too narrowly, now closed

- **Item 6** was verified on 3 of 13 pages. Now 13 of 13 (§3).
- **Item 8** was verified on 4 of 31 keys. The settled-no-op-save test now covers
  all 31, plus the two structural shapes (§5).
- **The suite set**: PLAN-10's fullest sweep was 39. This audit ran 65 (§9).

### Missed process

- **The GUARDRAILS §4.1 baseline was never updated** after PLAN-8, so half the
  suites have no recorded baseline (§9).
- **`plan5-throttle` needs a ten-server fleet** and appears to have been skipped
  for that reason throughout PLAN-10. It passes 12/12 when the fleet is up.
- No phase re-ran the **complete** set, which is what GUARDRAILS §4.1 asks for
  before starting ("Run the full set before you start").

---

## 11. What is still open

1. **A10-037 / item 4** — the ISO 9001 revision contradiction. Never executed,
   blocked on the owner, still reproducing (`p7reverify`). Confirmed and left.
2. **The 39 severity-C and 9 severity-D findings** — out of scope for PLAN-10 and
   untouched. **A10-033** (help.php describing the admin header as 6 items when it
   has 11) and **A10-039** (`&amp;` in stored section titles) both confirmed
   unchanged.
3. **The three `WHATS_LEFT.md` §2 records from PLAN-10** — the probe-blindness
   record (accurate in substance, imprecise on "0 leaks"), the six-duplicated-headers
   record (accurate; three of its line numbers off by one), and the
   `brand-gradient-mixed-ends` amendment (right on both points it corrects).
4. **The `/contact` message tab's four mislabelled fields** — logged 2026-08-10,
   still open, still out of scope.
5. **`.htaccess` / `.user.ini`** — still `[UNVERIFIED]`; `php -S` cannot test them.
6. **A10-029's fourth column** — "Wall Thickness" vs the catalog's "Recovered
   Wall" (12 products). For the owner to settle along with the relabelling itself.
7. **Nothing is deployed.**
8. **New this session** — the record-integrity items in §10, logged to
   `WHATS_LEFT.md` §2.

---

## 12. What I did **not** check

Stated plainly, because scaling an audit down is the owner's call.

- **A10-001 and A10-002 were not re-derived with a probe of my own.** They rest on
  `audit10-p7reverify.js` — the audit's own frozen probe, run unedited, which is
  genuinely independent of the fixer — plus `plan10-dashboard` 25/25, which is not.
  I did not write an independent overlap-pair counter for `/dashboard`.
- **No pixel comparison against `origin/main~5`.** Contract §4.5 asks for one;
  GUARDRAILS §2 forbids `git checkout` without an explicit instruction in the
  current conversation, and I did not have one. I substituted a stronger check
  that needs no checkout: the four surfaces still paint their exact pre-fix
  literals under the default palette, measured in both my probe's "before" arm
  and the audit's own unedited drill. That verifies the same claim; it does not
  verify anything about pixels the two probes do not sample.
- **The admin was measured at 390 only**, for the 13-page nav sweep. 834/1024/1440
  rest on `plan10-adminnav` 25/25.
- **`plan3-autoreply` mail assertions** pass here on Linux; the Windows
  `[UNVERIFIED]` status is untested and unchanged.
- **I did not verify the "1,120 elements" figure element-by-element** — only that
  the suite asserting it passes 33/33.
- **The 39 C and 9 D findings were not re-run**, beyond the two the contract names.

---

## 13. Environment

```
main @ 33dffb8 (git fetch origin main before diffing — done)
node _harness/browser.js -> /opt/pw-browsers/chromium-1194 (no playwright install)
fc-match system-ui       -> DejaVu Sans   (C49 caveat; plan8-polish 16/17 is that artifact)
build                    0 errors, 368.07 kB JS / 23.41 kB CSS
mirror bundle            index-C4VDIpwN.js == dist bundle
:8123 php-mail.ini · :8124 php-trunc.ini · :8125 php-nb2-off.ini · :8130-8139 fleet
git diff --stat data/ pdfs/ uploads/   -> empty, asserted before finishing
_harness/site/data/content.json        -> restored from pristine, byte-identical (39,018 B)
_harness/site/admin/config.local.php   -> deleted before finishing
```
