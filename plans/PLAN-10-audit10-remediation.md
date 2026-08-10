# PLAN-10 — Remediating AUDIT-10's severity A and B findings

**Audience:** the agent executing this plan, in a fresh session with no memory
of the audit.
**Status:** ready to execute. Binding rules: `plans/GUARDRAILS.md` — this plan
adds constraints and never relaxes one.
**Written:** 2026-08-10, against `claude/audit-10` @ `04a988f` (PR #26, which
adds the audit report, its records and its probes).
**Source of every item:** `_harness/AUDIT10-REPORT.md` and
`plans/audit10/state/findings.jsonl` — **13 findings, 1 severity A and 12
severity B**, every one `CONFIRMED` (measured twice) *and* re-verified in
pass-7 from a fresh browser context using only its own reproduce steps.
Nothing here is speculative.

**Twelve items for thirteen findings.** A10-001 and A10-002 are one change.

---

## 0. Orientation — read exactly this, in this order

Your context is finite. Read these and stop:

1. `CLAUDE.md` — architecture + the 12 invariants. Each names a real incident.
   Items 3, 8 and 12 sit next to one.
2. `plans/GUARDRAILS.md` — §1 scope discipline, §2 hard prohibitions, §4
   verification, §5 working rules, §6 records.
3. `_harness/AUDIT10-REPORT.md` — **the A and B blocks only** (the C and D
   sections are not this plan's scope), plus *Regression state* and the
   *Refuted* section. Refuted matters: it lists six probe defects and four
   font artifacts that have each already produced a plausible false finding.
4. `_harness/README.md` — how the harness works, what `sync.sh` does.

Do **not** read `WHATS_LEFT.md` end-to-end (274 KB). You need §2 only, so you
do not duplicate an open record. Do not read `DEPLOY_READINESS_v2.md` or the
older plans unless an item points you there.

Per-finding detail beyond the report is in
`plans/audit10/state/findings.jsonl` — one JSON object per line, with
`evidence.measurement`, `reproduce`, `where` and `dedupe_note`. Read the record
for the item you are on. Do not read all 62.

### Stand the environment up

Run everything from the repo root.

```sh
npm install
npm run build && sh _harness/sync.sh
PHP_CLI_SERVER_WORKERS=6 php -S 127.0.0.1:8123 -t _harness/site -c _harness/php-mail.ini _harness/router.php &
# :8124/:8125 only if you re-run plan2-trunc (item 8 requires it):
php -S 127.0.0.1:8124 -t _harness/site -c _harness/php-trunc.ini   _harness/router.php &
php -S 127.0.0.1:8125 -t _harness/site -c _harness/php-nb2-off.ini _harness/router.php &
```

- The mirror admin password is `audit-pass-123` (written by `sync.sh` →
  `setpw.php`). **Delete `_harness/site/admin/config.local.php` before your
  session ends.**
- **Re-run `sh _harness/sync.sh` after every `npm run build` and after every
  edit under `admin/` or `public/`.** Items 5–10 all edit `admin/`; a stale
  mirror has produced false passes before.
- `PHP_CLI_SERVER_WORKERS=6` is not optional if you run a probe and a crawl at
  once — pass-1 wedged the single-threaded server for minutes.
- `php -S` takes `php-mail.ini` on :8123. `routes.json` and `GUARDRAILS.md`
  §4.2 disagree about this; **`php-mail.ini` is the one that makes `mail()`
  work**, and pass-6 lost time to a false `plan8-lead` crash over it.
- Launch Chromium only via `_harness/browser.js`. Never `playwright install`.

### The regression baseline you inherit

Run the suite list **before touching anything**. Measured on `04a988f`:
`lint.php` all green, and 23 suites at their baseline scores, with exactly
three expected exceptions.

| Suite | Expected | Why — **not a finding, do not "fix" it** |
|---|---|---|
| `plan8-contrast` | **34/35** | one named `EXEMPT_BRAND_SURFACE` exemption for a computed brand ink on a computed brand surface. A counter, not a blanket rule. 34/35 **is** its passing state. |
| `plan8-polish` | **16/17 on Linux** | the failing check is exactly "no spec table scrolls horizontally at 1440". Font-metric dependent: `system-ui` → DejaVu Sans is ~21 % wider than Segoe UI. **Run `fc-match system-ui` before treating any width finding as real.** Under Liberation Sans the 1440 overflow is 0px on all 42 pages. |
| `brandtext` | **11 failing (ratchet ≤ 13)** | logged open item `brand-text-on-brand-surface`. Judge by the FAILING count, not the ratio — the scored-combination count wobbles ±1 because the hero animates. |

If you inherit any other red, **stop and say so before fixing anything**.

---

## 1. Guardrails specific to this plan — read twice

1. **Execute exactly the twelve items below. Nothing else.** AUDIT-10 also
   recorded 39 C and 9 D findings. They are **out of scope**. If you find a
   new defect while working, do not fix it: append it to `WHATS_LEFT.md` §2
   with date, evidence and `file:line`, and mention it in the handback.
2. All of GUARDRAILS §2 applies verbatim. In particular: **never edit
   `data/*.json`, `pdfs/`, `uploads/` or `_localsite/`**; never
   `git reset`/`stash`/`revert`/`rebase`/force-push; never commit
   `admin/config.local.php`; never put a real hash in `admin/config.php`;
   never use `preg_replace` on anything writing a bcrypt hash (invariant 1).
3. **`data/` is live customer state after the first deploy.** Item 4 is the
   only item that touches product or content data, and it is **an owner
   action, not a code change** — see it before you assume otherwise.
4. **Do not add or remove a single form field in `admin/content.php`.** The
   posted-variable count is **446** and `form_complete` must remain the LAST
   control (invariant 6, enforced positionally). Item 8 changes the *save
   handler*, not the field set. After item 8 re-run `plan2-formlast` **and**
   `plan2-trunc` (needs :8124/:8125) to prove it.
5. **Do not edit the `_harness/audit10-*.js` probes.** They are the audit's
   evidence and your failing-first tests. Copy what you need into new
   `_harness/plan10-*.js` suites. It is expected — and required — that
   `audit10-p7reverify.js` flips from demonstrating the defects to
   demonstrating their absence *without its code changing*. That is what
   makes it proof. Run it before your first edit and capture the output.
6. **Every new suite must fail first.** Run it against the unmodified tree,
   watch it fail for the audited reason, then fix. Mutation-proof it: revert
   the fix in the working tree temporarily, watch the suite fail, restore.
   Show both runs in the handback. Two invariant checks once passed here
   against a broken assertion (GUARDRAILS §4.4).
7. **Measure in the browser, not in the source.** Every acceptance below is a
   number read through :8123 with Playwright. AUDIT-10's own anti-hallucination
   incidents — and the three previous audits' — all came from reasoning
   forward from source. Two happened *inside pass-7* and are written up in the
   report's Refuted section: `innerText` does not contain inline **SVG** text,
   and the first `button[type=submit]` on `admin/content.php` is not **Save
   Content**.
8. **Check the font before every width claim.** `fc-match system-ui`. If it is
   DejaVu Sans, re-measure with the document forced to Liberation Sans
   (metric-compatible with Arial) before you believe any px number you
   produce. Four of AUDIT-10's leads died here.
9. **The Tailwind extractor scans raw source text, comments included.** A bare
   utility word (`hidden`, `flex`, `border`…) in a comment emits that rule into
   the shipped CSS. It has fired seven times, four inside comments. Run
   `node _harness/cssdiff.js --save` on the untouched tree before your first
   edit, then plain `node _harness/cssdiff.js` after every build — 0 added
   selectors expected.
10. **Nothing in this plan changes the security posture.** `require_auth()`,
    `csrf_check()`, upload validation, `basename()`+`realpath()` containment,
    `h()` on every echo and the optimistic-concurrency signatures must be
    byte-identical when you finish. Items 5–10 edit CSS, copy and one
    `audit_log()` call.
11. **Records are append-only.** `WHATS_LEFT.md`: supersede with
    `SUPERSEDED-BY` + date, never rewrite. §5 says exactly what to write.
12. **Escalate business calls; decide engineering calls.** This plan contains
    exactly one business call — item 4 — and it is **blocked on Rick** by
    design. Escalation format:
    `decision-needed | recommended | why | trade-off | blocked`.
13. **Fix loops: 3 attempts, then stop and report** what you tried, what you
    observed, what you now believe. Delta-only fix rounds.

---

## 2. Execution order and why

**1 → 2 → 3 → 11 → 12 → 5 → 6 → 7 → 8 → 9 → 10 → 4.**

Grouped into five landings, each independently shippable:

| Phase | Items | Tree | Why here |
|---|---|---|---|
| **A** | 1 | `src/` | The only severity A. Land it first and **alone** — one flex rule, 42 pages, no shared surface. |
| **B** | 2, 3 | `src/` | The two buyer-facing public Bs. Both are layout; neither touches the other's component. |
| **C** | 11, 12 | `src/` | The repalette pair. Item 11 creates the variables item 12's call sites need — **11 before 12, always**. |
| **D** | 5, 6, 7, 8 | `admin/` | Rick-facing. 5–7 are CSS; 8 is one `audit_log()` call. `sync.sh` after each. |
| **E** | 9, 10 | `admin/help.php` | Documentation copy only. Same file — do them together, one commit. |
| **F** | 4 | *nothing* | Owner action. Produces a question for Rick and a `WHATS_LEFT` record, **no code**. Last, because it cannot be completed by you. |

Commit per item (phase E as one commit), so a red suite bisects to one change.
Items 1, 2, 3, 11 and 12 each require `npm run build && sh _harness/sync.sh`
before their acceptance can be measured.

---

## 3. Phase A

### Item 1 · [A] A10-011 — The product name must stop painting underneath its own buttons

**Finding:** `A10-011` · `/products?productId=CC` · mobile-390 · all 42 pages.

#### The defect

`src/App.jsx:8131` renders the product-detail header strip as:

```jsx
<div className="px-8 py-5 flex items-start justify-between gap-4">
  <div className="min-w-0 flex-1"> …eyebrow, h1, SKU… </div>
  <div className="flex flex-wrap items-center gap-2 mt-1"> …Download PDF, Request Quote… </div>
```

The title column is `flex-1` (`flex: 1 1 0%`) with `min-w-0`, so it may shrink
to nothing. The button column carries no `basis`/`shrink` control, so its
min-content width wins. At 390 the strip's inner width is **340.0px**, the
button column resolves to **260.0px**, and **the title column resolves to
0.0px**. Everything in it overflows (`overflow: visible`) and paints across the
buttons.

**Measured, twice, then re-verified from a fresh context in pass-7:**

| | mobile-390 | tablet-834 | desktop-1440 |
|---|---|---|---|
| strip inner width | 340.0px | 784px | — |
| **title column** | **0.0px** | 431.4px | 557.4px |
| button column | 260.0px | 272.6px | — |
| pages with painted text under a button | **42 / 42** | 0 / 42 | 0 / 42 |

Worst overlap 124.6 × 24.0px (IP1274, `h1` × "Request Quote"); on `CC`,
118.6 × 20.0px across "Nonmetallic Liquid-tight Conduit Couplin". Consequences
of the same 0px column: the `h1` wraps to as many as 13 lines
(`IP64FS-IP65VC-IP66AC-IP67SC`), and the SKU line wraps on 10 of 42.

**Not the font.** Forced to Liberation Sans the title column is 16.0px and the
overlap still occurs on 42 of 42.

Failing-first probe, already in the repo: `node _harness/audit10-p2header.js`.

#### The fix — stack the strip below the `sm` breakpoint

One className, at `src/App.jsx:8131`:

```jsx
<div className="px-8 py-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
```

At <640px the title takes the full 340px and the buttons sit beneath it; at
≥640px the layout is byte-identical to today (`sm:flex-row sm:items-start
sm:justify-between` restores all three). Drop `mt-1` from the button column
only if the stacked spacing reads wrong — measure, do not assume.

#### What not to do

- **Do not touch the ink.** The comment at `src/App.jsx:8139-8145` records why
  the `h1` stays white: the gradient starts at a hardcoded `#0a2a52` and only
  its far end is owner-controlled, so no single ink works across both. That
  hardcoded stop is item 12's subject, **not this item's**.
- **Do not uppercase the `h1`** — C47 records why (these are the longest strings
  on the site and all-caps cost legibility on exactly the ones that wrap).
- **Do not demote the `h1`** — A3 made it an `h1` because 42 pages previously
  announced the same top-level heading.
- **Do not "fix" this by shrinking the buttons or truncating the title.** The
  title is the thing a buyer checks before requesting a quote.
- Do not add `flex-shrink-0` to the button column. It is already effectively
  unshrinkable; adding it makes the 0px title column permanent.

#### Acceptance — measured at :8123, all 42 products

1. mobile-390: title column width **> 200px** on 42/42, and **0/42** pages with
   painted title ink intersecting a button's box.
2. tablet-834 and desktop-1440: title column and overlap count **unchanged**
   from the table above (431.4 / 557.4px, 0/42).
3. `h1` line count at 390 ≤ 3 on 42/42 under Liberation Sans.
4. `node _harness/audit10-p2header.js` reports `0/42` at mobile-390 **without
   its code changing**.

New suite: `_harness/plan10-header.js` — asserts (1) and (2) across all 42
products at three viewports.

---

## 4. Phase B — the two buyer-facing public defects

### Item 2 · [B] A10-001 + A10-002 — `/dashboard`'s Description column must stop being starved

**Findings:** `A10-001` (desktop-1440) and `A10-002` (tablet-1024). Cluster
`dashboard-fixed-columns`. **The same change also closes the C-severity
`A10-015` (tablet-834)** — verify it, report it, and do not treat closing it as
licence to widen scope further.

#### The defect

`src/App.jsx:9196` declares:

```js
const DASHBOARD_COLS = [
  { key: "name",           label: "Product Name",   width: 190  },
  { key: "partId",         label: "Part ID",        width: 105  },
  { key: "partType",       label: "Part Type",      width: 115  },
  { key: "description",    label: "Description",    width: null },   // ← takes what is left
  { key: "operatingTemp",  label: "Temp",           width: 150  },
  { key: "specifications", label: "Specifications", width: 215  },
];
```

with `tableLayout: "fixed"` at `src/App.jsx:9785` and an Action column of
155px. The fixed tracks total **775 + 155 = 930px**. "Whatever is left" is only
generous while the table is wide:

| Viewport | Table width | Description track | Symptom |
|---|---|---|---|
| desktop-1440 | 1232 | 300px | 37 painted-text overlap pairs; the `Polyolefin Heat Shrink` pill runs **69.0px past** the Description text origin |
| tablet-1024 | 974 | **44.0px** | header paints `DESCRTIEMPON`; first description cell renders on **17 line boxes**; document **16,048px** tall vs 5,081 at 1440 |
| tablet-834 | 930 in a 784 box | **0.0px** | 146px hidden behind an in-card scroller (A10-015) |

All three re-verified from a fresh context in pass-7 with those exact numbers.
**Not the font** — under Liberation Sans A10-001 still shows 30 overlap pairs
and A10-002's header overprint is 71.2px.

Failing-first probe: `node _harness/audit10-p1dash.js`.

#### The fix — give the elastic track a floor, and let the table scroll instead of collapsing

Two coordinated changes:

1. **`DASHBOARD_COLS`**: give `description` a `minWidth` (recommended **220px**)
   while keeping `width: null`, and render it as `style={{ minWidth }}` on the
   `<col>`/`<th>`. Under `table-layout: fixed` a `min-width` on the sized
   element is honoured, so the track stops collapsing.
2. **The scroll container at `src/App.jsx:9777`** already has
   `overflowX: "auto"`. With the floor in place the table's intrinsic width
   becomes 930 + 220 = **1150px**, so at 1024 and 834 it scrolls horizontally in
   its own card — the behaviour the card was built for — instead of garbling.

Recommended, and worth the extra half hour: **also relieve the overlap at 1440**
by letting the two offenders wrap rather than escape. The Part Type pill and the
long compound Part IDs overflow a 115px / 105px track because nothing lets them
break. Add `overflowWrap: "anywhere"` (not `wordBreak: "break-all"` — that
breaks mid-token everywhere) to those two cells only. Measure the result; if
overlap pairs do not reach 0 at 1440, widen `partType` to 130px and re-measure
before adding a third mechanism.

#### What not to do

- **Do not remove `tableLayout: "fixed"`.** The comment at `src/App.jsx:9779-9784`
  records the incident: without it the declared widths are only hints, the table
  sized itself on content, the columns inverted **and** the primary action was
  clipped (B19/A6).
- **Do not shrink `Temp` back toward 90px.** The comment above `DASHBOARD_COLS`
  records that measurement: at 90px
  `"Up to 1200°F (Heat Treated); 130°C (Vinyl Coated); …"` wrapped to 282px and
  made one row taller than the four shortest rows combined. *"the description was
  never the problem — Temp and Specifications were."*
- **Do not desync `DASHBOARD_COL_COUNT`** (`src/App.jsx`, `DASHBOARD_COLS.length + 1`).
  It is derived precisely so adding a column cannot break the empty-state cell
  again (B20). Leave the derivation alone.
- Do not switch the whole index to cards at 1024. mobile-390 already does that
  and is clean; the table is the point of the page at tablet and desktop.

#### Acceptance — measured at :8123

1. desktop-1440: painted-text overlap pairs inside the table **0** (from 37),
   under the shipped face **and** Liberation Sans.
2. tablet-1024: Description track **≥ 220px**; header overlap **none**; first
   description cell ≤ 4 line boxes; document height **< 7,000px** (from 16,048).
3. tablet-834: Description track **≥ 220px**; the table scrolls inside its card
   (`wrap.scrollWidth > wrap.clientWidth`) and `documentElement` overflow stays
   **0px** — the page itself must not gain a horizontal scroll.
4. mobile-390 card list unchanged.
5. `plan8-catalog` 16/16 and `plan5-keys` 11/11 still green.

New suite: `_harness/plan10-dashboard.js` — column widths and overlap counts at
four viewports, under both faces.

---

### Item 3 · [B] A10-012 — A rejected quote form must not scroll the invalid field behind the header

**Finding:** `A10-012` · `/contact` · all viewports.

#### The defect

The RFQ form (`src/App.jsx:5102`, `<form method="post" action="/contact.php"
onSubmit={onRfqSubmit}>`) uses **native constraint validation** — the required
fields carry `required` and the form is not `noValidate`. Pressing Submit on an
empty form focuses `input[name=name]` and the browser scrolls it to the very top
of the viewport, which is underneath the 65px sticky header
(`src/App.jsx:568-575`, `position: sticky; top: 0; z-index: 50`).

Re-verified from a fresh context in pass-7:

| Viewport | field top / height | header bottom | hidden | its `Full Name *` label |
|---|---|---|---|---|
| mobile-390 | 0.2 / 46.0 | 65 | **46.0 of 46.0px — 100 %** | at **-21.8** (off-screen) |
| desktop-1440 | -0.5 / 46.0 | 65 | **45.5 of 46.0px** | at **-22.5** |

`validationMessage` is *"Please fill out this field."*, `valueMissing` is true —
so the browser **is** complaining, at a field the visitor cannot see. Computed
`scroll-margin-top` on the field is **0px**.

The codebase already solved this exact hazard elsewhere: `src/App.jsx:10412`
sets `scrollMarginTop: 84` on the `/industries` deep-link targets, with the
comment *"scroll-margin, or the sticky navbar covers the heading the fragment
just scrolled to."*

Failing-first probe: `node _harness/audit10-p2focus.js form`.

#### Both tabs, not just the one that was measured

**`/contact` has TWO forms**, and A10-012 measured only the first:

| Tab | Form | Handler | Required fields |
|---|---|---|---|
| `activeTab === "rfq"` (default) | `src/App.jsx:5103` | `onRfqSubmit` | yes — **measured** |
| `activeTab === "message"` | `src/App.jsx:5386` | `onMsgSubmit` | yes — **not measured by the audit** |

Both post to `/contact.php`, both carry `required` fields, and neither sets
`noValidate`, so the same mechanism applies. **Per §1.7, measure the message tab
before you assume it** — open `/contact`, switch to the message tab, submit
empty, and read the field rect against the header. If it reproduces (expected),
fix both. If it does not, fix the RFQ form only and say why in the handback.

#### The fix — the same 84px, on the form's own controls

1. Add a class — e.g. `ipc-rfq-form` — to the RFQ form at `src/App.jsx:5103`,
   and to the message form at `src/App.jsx:5386` if it reproduces.
2. In `src/index.css`, next to the other scroll-margin work:

   ```css
   /* A10-012 — native constraint validation scrolls the invalid field to
      viewport top, which is under the 65px sticky header, so the visitor sees
      a header and no error. Same 84px the /industries deep-link targets use
      (src/App.jsx:10412). */
   .ipc-rfq-form :is(input, select, textarea) { scroll-margin-top: 84px; }
   ```

`src/index.css` is the right home, not `GlobalStyles`: invariant 9 records that
`GlobalStyles` mounts inside the tree that only renders **after** loading
finishes.

#### What not to do

- **Do not touch `public/contact.php`.** Invariant 10: its `s()` deliberately
  does not HTML-escape, because its destinations are a `text/plain` email and a
  JSONL line. This defect is entirely client-side.
- **Do not duplicate the server-error path.** `src/App.jsx:4591-4619` already
  handles server rejections with `focus()` + `scrollIntoView({block:'center'})`
  and does it correctly. The browser's constraint-validation path never reaches
  that code. One mechanism per path — do not route native validation through
  the server-error region.
- **Do not set `noValidate` to take over validation in JS.** That trades a
  scroll bug for a whole validation surface, and pass-6 confirmed the existing
  server path already works (including the rate-limit alert path).
- Do not apply the rule to every input site-wide without measuring; the search
  and filter inputs are inside their own scroll contexts.

#### Acceptance — measured at :8123, all four viewports

1. Submit an empty RFQ form: the focused field's `top` is **≥ 65** and
   `underHeaderPx` is **0** at all four viewports. Same for the **message** tab
   if step 0 showed it reproduces.
2. Its `<label>` is fully within the viewport (`labelTop ≥ 65`).
3. `validationMessage` and `valueMissing` unchanged — native validation is still
   what fires.
4. `plan3-contact` 51/51 and `plan8-lead` 16/16 still green (`plan8-lead` needs
   `php-mail.ini` on :8123 — see §0).
5. `node _harness/audit10-p2focus.js form` reports `fullyHidden: false` **without
   its code changing**.

New suite: `_harness/plan10-rfqscroll.js`.

---

## 5. Phase C — the repalette pair

> **Order is binding: item 11, then item 12.** Item 12's call sites consume the
> variables item 11 creates.

### Item 11 · [B] A10-045 — `--brand-accent-rgb` must exist, so accent tints follow the owner's palette

**Finding:** `A10-045` · all public pages.

#### The defect

`src/index.css:9-45` declares `--brand-primary-rgb` and `ThemeInjector`
(`src/App.jsx:7328-7333`) recomputes it whenever Rick changes his colour:

```js
const m = /^#?([0-9a-f]{6})$/i.exec(t.primaryColor || "");
if (m) { … root.style.setProperty("--brand-primary-rgb", `${r}, ${g}, ${b}`); … }
```

53 call sites say `rgba(var(--brand-primary-rgb), α)` and follow the palette
correctly. **The accent colours never got the same treatment.** There is no
`--brand-accent-rgb` and no `--brand-accent-2-rgb`, so every translucent accent
tint is a literal.

Repalette drill (runtime variable injection, no source edit; all 10 chromatic
`--brand-*` variables moved to `#8a1c5a / #3a1200 / #ff9d2e / #d2691e`,
`varsActuallyChanged` 10/10). These stayed byte-identical before and after:

| Literal | Elements | Where |
|---|---|---|
| `rgba(0,190,242,0.15)` border | **110** on 110 of 110 public page × viewport rows | the `<header>`'s bottom hairline — **every page** |
| `rgba(17,158,200,0.1)` background | **88** on 6 page-rows | the 42 part-type chips on `/dashboard` |
| `rgba(0,190,242,0.3)` border | 12 | homepage badge + industries chips |
| `rgba(0,190,242,0.2)` border | 8 | mega-dropdown, open state |
| `rgba(0,190,242,0.12)` / `0.4` | 2 | mobile drawer top border; nav open-state underline |

Plus one mixed gradient (`src/App.jsx:3307`) whose *first* stop is derived and
*second* stop is the literal. Re-verified in pass-7: after the repalette,
`--brand-primary` moves `#005da3 → #8a1c5a` while the header's
`borderBottomColor` is `rgba(0, 190, 242, 0.15)` before **and** after, and
`/dashboard` still paints 84 cyan-tinted backgrounds.

Failing-first probe: `node _harness/audit10-repalette.js`.

#### The fix — mirror the `--brand-primary-rgb` mechanism exactly

1. **`src/index.css`**, beside `--brand-primary-rgb`:

   ```css
   --brand-accent-rgb: 0, 190, 242;
   --brand-accent-2-rgb: 17, 158, 200;
   ```

   (Defaults for the shipped palette and for the first paint, before React
   mounts — same reason the existing block gives.)

2. **`ThemeInjector` (`src/App.jsx:7328-7333`)**: extract the existing hex→`r, g, b`
   parse into one small helper and call it three times — for `primaryColor`,
   `accentColor` and `accent2Color`. Keep `--brand-primary-hover`'s `×0.82`
   derivation attached to the primary only; the accents have no hover shade.
3. **Replace the literals** with `rgba(var(--brand-accent-rgb), α)` /
   `rgba(var(--brand-accent-2-rgb), α)` at the call sites named in the record's
   `where`: `src/App.jsx:571`, `:760`, `:790`, `:816`, `:1077`, `:1107`,
   `:1130`, `:1299`, `:1765-1767`, `:3307` (second stop only), `:9719`,
   `:10027`, `:10432`. **Verify each line number against the file before
   editing** — items 1, 2 and 3 shift them.

#### What not to do

- **Do not use `color-mix()`.** The comment at `src/App.jsx:7355-7357` states
  the reason: an unsupported `color-mix()` makes the declaration invalid, which
  drops the colour to `inherit` — failing toward unreadable, which is the whole
  class of bug this machinery exists to prevent.
- **Do not touch the `--brand-*-ink` derivation (4.23).** Different mechanism,
  different defect, and it is working.
- Do not convert the *solid* `var(--brand-accent)` uses. They already follow.
  This item is only about the translucent `rgba(…)` literals.

#### Acceptance — the repalette drill, run twice

1. After injecting a non-cyan palette, `rgba(0,190,242,…)` and
   `rgba(17,158,200,…)` appear **0 times** in any computed `borderColor`,
   `backgroundColor` or `backgroundImage` across the 8 audited page-states.
2. The header hairline, the homepage badge outline and all 42 `/dashboard`
   chips paint in the injected hue.
3. With the **default** palette every one of those elements is
   byte-identical to today — `rgb(0, 190, 242)` at the same alphas. A repalette
   fix that changes the shipped site's appearance is a regression.
4. `plan8-contrast` 34/35, `brandtext` ≤ 13 failing, `contrastparity` 28/28.

New suite: `_harness/plan10-repalette.js` — assert (1) and (3).

---

### Item 12 · [B] A10-046 — Two brand gradients and two navy surfaces must stop being literals

**Finding:** `A10-046` · `/products?productId=IP38FE` and `/industries`.

#### The defect

Same drill, per-**stop** diff — a gradient whose string changes can still have a
stop that did not move:

| Surface | Before | After a repalette | Elements |
|---|---|---|---|
| product-detail header (`src/App.jsx:8128`) | `linear-gradient(135deg, rgb(10,42,82) 0%, rgb(0,93,163) 100%)` | `…rgb(10,42,82) 0%, rgb(138,28,90) 100%` — **stop 0 frozen** | **84** = all 42 product pages × 2 viewports |
| industries card header (`:10421`) | `linear-gradient(135deg, rgb(0,61,122), rgb(0,93,163))` | `…rgb(0,61,122), rgb(138,28,90)` — **stop 0 frozen** | 10 |
| mega-dropdown panel (`:788`, `:1105`) | `rgb(14,40,71)` | byte-identical | 8 |
| mobile drawer (`:1298`) | `rgb(10,36,68)` | byte-identical | 1 |

Re-verified in pass-7: on `/industries`, 5 of 6 sampled gradients keep a frozen
first stop. The result is not merely unthemed — the most prominent block on the
page a buyer lands on becomes a gradient from the **old navy** into the **new**
colour.

The four literals sit close to, but not on, existing variables — sRGB distance
from `--brand-dark` `#0d2d52`: `rgb(10,42,82)` **4.2**, `rgb(14,40,71)` **12.1**,
`rgb(10,36,68)` **16.9**; `rgb(0,61,122)` is **19.2** from
`--brand-primary-hover`.

#### The fix

Replace all four with the nearest existing variable — `var(--brand-dark)` for
the three navies, `var(--brand-primary-hover)` for `#003d7a`. Then **measure the
default-palette render against the pre-change capture**: a ≤ 4.2 sRGB shift on
the product header is invisible, a 19.2 shift on the industries card may not be.
If any surface moves perceptibly, the fallback is a dedicated
`--brand-dark-2` variable derived in `ThemeInjector`, defaulting to the current
literal — **not** leaving the literal in place.

**Once the product header's first stop follows the palette, revisit item 1's
white-ink comment** (`src/App.jsx:8139-8145`): its premise is *"the gradient
starts at a HARDCODED #0a2a52"*. That premise is now false. Do **not** change
the ink in this plan — record in the handback that
`brand-gradient-mixed-ends` should be re-derived through `inkFor([dark, primary])`
the way the header ink already is (`src/App.jsx:7345`), and append it to
`WHATS_LEFT.md` §2.

#### What not to do

- **Do not touch the footer.** `src/index.css:215-217` states in terms that the
  footer's `#0a2240` is a hardcoded surface and **not** an owner-set colour, and
  its 1px `#1a3a5c` border belongs to that same surface. A10-046 explicitly
  excludes both. The `.ipc-skip` link matches the footer deliberately.
- Do not fold this into item 11's commit. Different mechanism (solid stops vs
  translucent tints), different risk (this one can visibly change the default
  site).

#### Acceptance

1. After a repalette, **0** frozen stops in any changed gradient on
   `/products?productId=IP38FE` and `/industries`; the mega-dropdown panel and
   mobile drawer backgrounds both move.
2. With the default palette, every one of the four surfaces is within **2.0**
   sRGB of its pre-change value, or a `--brand-dark-2` variable is introduced
   and it is byte-identical.
3. `plan8-contrast` 34/35 and `plan8-chrome` 16/16 still green.

Extend `_harness/plan10-repalette.js` rather than adding a second suite.

---

## 6. Phase D — the four admin defects

> `sh _harness/sync.sh` after **every** edit under `admin/`. Nothing in this
> phase is visible to the mirror until you do.

### Item 5 · [B] A10-020 — The Delete button must be readable on the page Rick uses most

**Finding:** `A10-020` · `/admin/index.php` · desktop-1440 + tablet-1024.
Promoted C → B in AUDIT-10's severity-consistency review, then re-verified.

#### The defect

`admin/index.php:85` sets `table { min-width: 980px; table-layout: fixed; overflow: hidden }`,
`:92` gives the Actions column `width: 350px`, and `:98-99` set
`.actions { flex-wrap: nowrap }` with `.actions .btn { flex-shrink: 0 }`. Five
buttons do not fit:

| Viewport | Actions cell | Buttons run | Delete | Visible | Wrap can scroll? |
|---|---|---|---|---|---|
| desktop-1440 | 986 → 1336 (350px) | 1002 → **1388** | 1319 → 1388 | **16 of 68px** | **no** |
| tablet-1024 | ends at 1000 | to 1056 | 987 → 1056 | **12 of 68px** | only 4px |
| mobile-390 | — | — | — | — | yes, 690px |

`.table-wrap` has `overflow-x: auto` but `scrollWidth === clientWidth` at 1440,
so there is **no way to bring the control into view at all** at the two widths
Rick most likely uses. It is the destructive control, it repeats on all 42 rows,
and it is still live and clickable as a 16px red sliver.

#### The fix — let the button row wrap

```css
.actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
```

(`admin/index.php:98`.) Five buttons then take two lines inside the existing
350px cell; rows get taller only where they need to. Keep
`.actions .btn { flex-shrink: 0 }` — buttons should wrap, not squash.

**Alternative, if wrapping reads badly:** widen `th/td:nth-child(5)` to **420px**
and raise `table { min-width }` from 980 to **1050**. This keeps one row of
buttons and preserves the deliberate column alignment down the page, at the cost
of a real horizontal scroll at 1024. Measure both, pick one, say which in the
handback. **Wrapping is recommended** — it needs no scroll at any width.

#### What not to do

- Do not remove `table-layout: fixed` or the per-column widths. The comment at
  `admin/index.php:82-83` records that they exist so every category table lines
  up identically down the page.
- Do not shorten "Manage PDF" or rename "Delete" to "Del" to buy width.
  A10-033 already records `help.php` calling it "Del" as a naming-drift defect;
  do not propagate the drift into the real UI.
- Do not add a confirm-dialog change. `delete.php` already confirms; this item
  is about legibility only.

#### Acceptance

1. desktop-1440 and tablet-1024: the Delete button's `right` is **≤** the table
   content box's right edge, on all 42 rows — clipped px **0** (from 52 / 56).
2. Its full label is rendered (`getBoundingClientRect().width ≥ 60`).
3. tablet-834 and mobile-390 unchanged.
4. `plan4-admin` 19/19 still green.

New suite: `_harness/plan10-adminrows.js`.

---

### Item 6 · [B] A10-021 — The admin header must contain its own navigation at 390

**Finding:** `A10-021` · every signed-in admin page · mobile-390.

#### The defect

`admin/nav.php:24` sets
`.ipc-admin-header { height: 60px; display: flex; align-items: center; … }`
with **11** nav items (`:43-56`). At 390 the `<nav>` lays out **95px tall, from
y = -17.5**, inside a 60px bar that does not clip it (`overflow: visible`):

- **"Products"** and **"+ Add Product"** paint above y = 0 — **clipped off the
  top of the document, unreachable**.
- **"View Live Site ↗"** and **"Sign Out"** paint *below* the blue bar, onto the
  `rgb(240,244,248)` page background, while keeping `color: #fff` /
  `rgba(255,255,255,0.5)` — **1.07:1** and **1.05:1**. (Links that stay on the
  bar measure 7.53:1.)

Rick cannot navigate or sign out from a phone. At 834 and 1024 the nav already
wraps to two rows **inside** the bar and every link is legible — so the layout
works; the fixed height is what breaks it.

#### The fix — let the bar grow

In `admin/nav.php`'s `<style>` block:

```css
.ipc-admin-header { … min-height: 60px; padding: 8px 24px; flex-wrap: wrap; … }
.ipc-admin-header nav { display: flex; flex-wrap: wrap; align-items: center; row-gap: 4px; }
```

`height` → `min-height` plus vertical padding lets the bar contain a two- or
three-row nav exactly as it already does at 834/1024, and `flex-wrap` on the
header lets the logo and nav stack when 390 demands it.

#### What not to do

- **Do not delete nav items to make them fit.** A10-033 separately records that
  `help.php` under-describes this header; removing links makes that worse and
  removes Rick's only route to Backups and Inquiries.
- **Do not hide the nav behind a hamburger** without saying so — that is a new
  interaction surface, a new keyboard-trap risk, and beyond this item. If you
  believe it is right, escalate with the format in §1.12; do not build it.
- Do not change `nav a { margin-left: 20px }` to `gap` in the same edit — it
  changes desktop spacing. If you want it, measure 1440 before and after.
- The `<form>` wrapping Sign Out carries the CSRF token. Do not restructure it.

#### Acceptance — all four viewports

1. mobile-390: **0** nav items with `top < 0`; **0** items whose box extends
   below the header's own bottom edge; minimum link contrast **≥ 4.5:1** (from
   1.05).
2. All 11 items present and hit-testable (`elementFromPoint` at each centre
   returns the link or a descendant).
3. desktop-1440: header height **60px**, one row — unchanged.
4. `plan4-admin` 19/19 still green.

New suite: `_harness/plan10-adminnav.js`.

---

### Item 7 · [B] A10-022 — The Help page must fit a phone

**Finding:** `A10-022` · `/admin/help.php` · mobile-390.

#### The defect

`documentElement.scrollWidth` **689** against `clientWidth` **390** — **299px**
of page-level horizontal overflow. Re-verified in pass-7: **11 of 11**
`table.field-ref` elements are wider than the viewport with **no scroll
container** (834 and 1440 are both 0px overflow, 0 tables past the viewport).

`admin/help.php:112` is the driver:
`table.field-ref td:first-child { … white-space: nowrap; }` — the term column
cannot wrap, so each table's intrinsic width is the longest term plus a full
explanation column. The **whole page** carries the overflow, so the header,
the heading and the contents list all slide sideways with it.

Rick opens Help precisely when he is stuck, and the column that contains every
answer is off-screen — including the Quick Reference table whose entire job is
"what you want to do → where to go". Eight named instances are in the record's
`instances[]`.

#### The fix

1. Wrap each reference table in a scroller, the way `admin/index.php:84` already
   does: `.table-wrap { overflow-x: auto; }`. Either add the wrapper markup
   around all 11 tables, or — fewer edits, same effect — give the table itself a
   scrolling box at narrow widths:

   ```css
   @media (max-width: 640px) {
     table.field-ref { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
     table.field-ref td:first-child { white-space: normal; }
   }
   ```

2. Relaxing `white-space: nowrap` at narrow widths is what actually shrinks the
   tables; the scroller catches whatever remains.

Measure after (1) alone: if `documentElement` overflow is already 0 and every
table's second column is reachable, you may not need both halves. Prefer the
smaller change that meets the acceptance.

#### What not to do

- Do not restructure the tables into definition lists. Eleven tables, a large
  diff, and a documentation rewrite is not this item.
- Do not touch the `#quickref` table's content. Removing it drops the page to
  546px, which tells you it is *a* driver, not *the* driver — the remaining
  `field-ref` tables hold the page at 546 on their own.
- Do not set `overflow-x: hidden` on `body`. That hides the symptom and makes
  the second column permanently unreachable.

#### Acceptance

1. mobile-390: `documentElement.scrollWidth === clientWidth` (**390**), i.e.
   page-level overflow **0px** (from 299).
2. **0** of 11 tables extend past the viewport without a scrolling ancestor.
3. For each of the 8 instances in the record, the explanation column is
   reachable — either painted within 390px or inside a container whose
   `scrollWidth > clientWidth`.
4. tablet-834, tablet-1024 and desktop-1440: overflow still **0px**, and the
   tables render as they do today.

New suite: `_harness/plan10-helpwidth.js`.

---

### Item 8 · [B] A10-027 — The audit log must record which page was edited

**Finding:** `A10-027` · `/admin/audit-log.php` · viewport n/a.

#### The defect

`admin/content.php:607`:

```php
audit_log('content', 'homepage', 'Homepage content updated' . …);
```

The SKU and the detail are **string literals**. `content.php` renders 99
textareas and **446** posted fields covering Homepage, Services, Industries,
About, FAQ, Contact, Privacy, SEO, navigation, footer and product families — and
every save is logged identically.

Measured, and re-verified in pass-7 by editing `copy[privacyHeader][eyebrow]`
(the Privacy page's eyebrow) and pressing Save Content:

```
2026-08-10 15:36:37 | content | homepage | Homepage content updated | 127.0.0.1
```

Byte-identical to a homepage edit. `admin/content.php:940` compounds it: the
page subtitle reads *"Edit the homepage sections below."* on a form that edits
every page of the site.

#### The fix — name the sections that actually changed

Both `$SECTIONS` and `$COPY_GROUPS` already carry a human `title`
(`'privacyHeader' => ['title' => 'Privacy page — banner', …]`,
`'features' => ['title' => 'Products &amp; Services Cards', …]`). The save
handler has `$out` in hand and can `load_content()` for the previous state:

1. Before `save_content($out)`, diff old vs new per top-level section key and
   per `copy` group key.
2. Build the detail from the `title`s of the groups that changed — e.g.
   `"Updated: Privacy page — banner"`, or
   `"Updated: Homepage — Hero, Footer — Labels, and 2 more"` past a sensible cap.
3. Pass a meaningful SKU column value — the changed group key when there is
   exactly one, `'multiple'` otherwise. Keep the action `'content'`.
4. Preserve the existing unmatched-product-code suffix verbatim.
5. Fix `admin/content.php:940`'s subtitle to describe what the page really
   edits.

**Decode the titles before logging.** Three section titles are stored
*already HTML-escaped* (`'Products &amp; Services Cards'` at `:77`, `:162`,
`:173`) — that is A10-039's separate defect. If you log them raw the audit log
will read `Products &amp; Services Cards`. Run them through
`html_entity_decode()` for the log line; **do not** "fix" the storage here —
that is A10-039, a C finding, out of scope.

#### What not to do

- **Do not add or remove a form field.** Invariant 6: `form_complete` must stay
  the LAST control, and it is the `max_input_vars` truncation guard. The count
  is **446**. This fix lives entirely in the POST handler.
- Do not log field *values*. The audit log is not a content history and some
  fields are long; log the section names.
- Do not change `audit_log()`'s signature in `admin/config.php` — other callers
  depend on it.
- Do not touch the `$warnings` / `product_reference_resolves()` logic above it
  (4.12): it warns and still saves **by owner decision**.

#### Acceptance

1. Edit **only** a Privacy field → newest log row's detail names the Privacy
   section and does **not** say "Homepage".
2. Edit **only** a Homepage hero field → detail names the Homepage hero.
3. Edit fields in **two** sections → detail names both.
4. Save with **no** change → still logs (a save is a save), with a detail that
   does not claim a section changed.
5. No entity-escaped text (`&amp;`) in any logged detail.
6. **`plan2-formlast` 8/8 and `plan2-trunc` 13/13** (needs :8124/:8125), and
   `copyroundtrip` 15/15.
7. Restore `_harness/site/data/*.json` from `_harness/pristine/` afterwards and
   `cmp` byte-identical — this item's testing writes real content.

New suite: `_harness/plan10-auditlog.js`. It **must** restore the mirror.

---

## 7. Phase E — the Help page's two wrong instructions

> One file, `admin/help.php`. One commit. Neither item changes behaviour — both
> change what Rick is told to do.

### Item 9 · [B] A10-028 — The four-step diagram must stop teaching the abandoned workflow

**Finding:** `A10-028` · `/admin/help.php`.

#### The defect

Box 2 of *"The four-step sequence, visually"* (`admin/help.php:584-585`, inline
`<svg><text>` nodes) reads:

```
Edit / Paste in a / Photo URL
```

Numbered step 2, immediately beneath it (`:608`), reads:

> Click **Photo** on the product you just created and upload a picture from your
> computer — see Product photos. **The Add form has no photo field, so this
> always happens as a second step.**

The same page also says (`:504`) *"you pick a picture from your own computer and
it is uploaded to your server. You do not need Dropbox, Google Drive, or any
image-hosting service, and you do not need to know what a 'direct link' is"*,
and (`:413`) of the Photo URL field itself: **"You normally never type in this
box."** The diagram is the one thing on the page that people read, and it sends
a non-technical owner to hunt for an image host.

A third instance: `:566` still lists *"a hosted link to a product photo (if you
have one)"* among the things to have ready before starting.

#### The fix

1. `admin/help.php:584-585` — retitle box 2 to the real step, e.g.
   `Photo` / `Upload from` / `your computer`. Keep the two-line
   `<text>` shape and the existing `x`/`y`/`font-size` attributes; only the
   strings change.
2. `:571` — update the `<svg>`'s `aria-label`
   (*"Diagram of the four steps: Add Product, Edit, Manage PDF, View"*) so the
   accessible name matches the new box 2.
3. `:566` — drop "a hosted link to a product photo (if you have one)" from the
   before-you-start list, or replace it with "the photo file on your computer".

#### What not to do

- Do not change the Photo URL row at `:413`. It is correct: the field still
  exists for the rare case of an image already on his own site, and it already
  says he normally never types in it.
- Do not renumber the four steps or restructure the `<svg>`. Two `<text>`
  strings and one `aria-label`.
- **Do not verify this with `innerText`.** Inline SVG text is not in
  `innerText`, and pass-7's first attempt at this check wrongly reported the
  finding as not reproducing because of it. Read
  `svg.querySelectorAll('text')` and their `textContent`.

#### Acceptance

1. The diagram's `<text>` nodes contain **no** "Photo URL" / "Paste in" string.
2. The concatenated box-2 text and numbered step 2 both describe uploading from
   the computer.
3. The `<svg>`'s `aria-label` matches the rendered boxes.
4. `/admin/help.php` renders with no PHP notice and no console error at all four
   viewports.

---

### Item 10 · [B] A10-029 — The worked size chart must stop showing Max below Min

**Finding:** `A10-029` · `/admin/help.php` · desktop-1440.

#### The defect

`admin/help.php:462-475` renders the example chart *as customers see it*, with a
`rowspan`/`colspan` header splitting **Expanded Diameter** into **Min | Max**:

| Order Size | Expanded Diameter — Min | Expanded Diameter — Max | Wall Thickness |
|---|---|---|---|
| 3/4" | 0.750" | **0.375"** | 0.020" |
| 1" | 1.000" | **0.500"** | 0.024" |
| 1-1/2" | 1.500" | **0.750"** | 0.030" |

**Every Max is exactly half its Min** (ratio 0.5, 0.5, 0.5 — re-verified in
pass-7). It is the pattern Rick copies when he builds his own chart, and a
buyer looking for a spec-grade part would act on it.

**The numbers are correct; the header is wrong.** The catalog settles it. The
real products use two *sibling* columns, never a Min/Max split — `IP29CG`'s
`specTable2.columnSpans` is:

```json
[{"label":"Order\nSize"}, {"label":"Expanded\nDiameter"},
 {"label":"Recovered\nDiameter"}, {"label":"Recovered\nWall"}]
```

and its first row is `["3/64\"", ".046\"", ".023\"", ".018\""]` — the same 2:1
shape as the help example. `IP42MW`, `IP46MD` and `IP47HV` carry the identical
`Expanded Diameter` / `Recovered Diameter` pair. **No product in the catalog
uses a `Min | Max` sub-header at all**, so the help page is also teaching a
sub-column structure the real data never uses.

#### The fix

Replace the two-row header at `:463-471` with a flat four-column header
matching the catalog's own vocabulary:

```
Order Size | Expanded Diameter | Recovered Diameter | Wall Thickness
```

Leave all three data rows byte-identical — they are right. Consider matching
the catalog's fourth-column name (`Recovered Wall`) too; if you change it, say
so in the handback, because the surrounding prose may name "Wall Thickness".

Check the prose immediately around the table (the *"Split into sub-columns"*
explanation the size-chart editor offers). If it uses this table as its worked
example of a **sub-column**, it now needs a different example — one that a real
product actually uses, such as `IP37SH-IP36TH-IP39LH`. Do not invent one.

#### What not to do

- **Do not change the numbers to make Max exceed Min.** They are correct
  recovered diameters. Editing them would put a fabricated specification into
  the owner's documentation — the exact failure mode severity A exists for.
- Do not touch `data/products-all.json`. It is right, and it is live customer
  state (§1.2, §1.3).
- Do not remove the sub-column feature from `admin/spectable-editor.js`. Real
  products use it (`IP38FE`, `IP44A2-IP45A3`); only this example misuses it.

#### Acceptance

1. Table 4 on `/admin/help.php` renders four flat headers, no `colspan`/`rowspan`
   sub-header, and **0** rows where column 3 < column 2 **under the header that
   claims they are a Min/Max pair**.
2. The header strings match the vocabulary in `products-all.json`
   (`Expanded Diameter`, `Recovered Diameter`).
3. Three data rows byte-identical to before.
4. `/admin/help.php` renders clean at all four viewports.

New suite for items 9 + 10: `_harness/plan10-help.js`.

---

## 8. Phase F — the one item you cannot fix

### Item 4 · [B] A10-037 — The site states three different ISO 9001 revisions

**Finding:** `A10-037` · `/`, `/about`, `/products?productId=VALUE-ADDED`,
`/dashboard` · desktop-1440.

> **This item produces a question and a record. It produces NO code change and
> NO data edit. Read all of it before doing anything.**

#### The defect

Re-verified in pass-7 across four URLs — three distinct normalised claims
render, all visible:

| Claim | Where |
|---|---|
| **ISO 9001:2008** | `/` hero stat card ×2, `/` "ISO 9001:2008 registered facility…" paragraph, `/about` certification card |
| **ISO 9001** (no revision) | `/` "ISO 9001 Quality" card, `/about` "ISO 9001 Registered" + the 1990s milestone, the site-wide footer badge on all 15 chrome-bearing routes |
| **ISO9001:2000** (also unspaced) | `/products?productId=VALUE-ADDED` description and spec chip, `/dashboard` row 41 |

A spec-grade buyer reads the quality claim before anything else. Two of these
name standards withdrawn in 2008 and 2015.

#### Why there is no code fix

Every one of these strings is **owner-owned data**:

- `data/content.json:31`, `:495`, `:604` (`:2008`), `:597` (bare)
- `data/products-all.json`, product `VALUE-ADDED` (`ISO9001:2000`)

`CLAUDE.md` is explicit: after the first deploy `data/` is **live customer
state**, and re-uploading it destroys Rick's edits with no backup. GUARDRAILS §2
forbids editing `data/*.json`. Correcting these in the repo would either do
nothing (the server's copy wins) or destroy his work.

**And you do not know the right answer.** The audit deliberately recorded the
contradiction and offered no rewrite. Which revision IPC actually holds is a
fact on a certificate you have not seen. ISO 9001:2015 is the current standard,
but *assuming* it and writing it into a certification claim would be fabricating
one — the precise harm severity A exists to prevent.

#### What to do instead

1. **Escalate**, in the §1.12 format. Draft for the handback:

   > `decision-needed` — the site states three ISO 9001 revisions (:2008 on the
   > homepage and About, :2000 on the Value-Added product, and unversioned in
   > the footer). Two name withdrawn standards.
   > `recommended` — Rick reads the revision and expiry from his current
   > certificate and sets **one** value everywhere.
   > `why` — a buyer who needs a certified supplier cannot tell which is true,
   > and may quote a withdrawn standard into their own documentation.
   > `trade-off` — none technically; it is 4 edits in the admin, ~5 minutes.
   > `blocked` — on Rick supplying the revision. Nobody else can supply it.

2. **Write him the exact click path**, so the answer is all that is missing:
   - Homepage + About wording → **Page Content** → the relevant sections
     (`data/content.json:31`, `:495`, `:604`, `:597`).
   - Footer certification badge → **Business Details → Certifications**
     (`admin/help.php`'s Business Details table already documents this row as
     *"ISO registration plus any others, shown in the footer and on the Quality
     page"*).
   - The Value-Added product → **Products → Edit** on *Value-Added Insulation
     Products* → description and specifications summary.

3. **Record it** in `WHATS_LEFT.md` §2 as an open **owner action**, with the
   date, the four locations and the finding id — alongside the four `photoUrl`
   case corrections already logged there as owner actions on the deployed
   server.

#### Optional, and only if Rick asks for it

A consistency check is a legitimate follow-up but is **not** in this plan: a
suite asserting the site renders exactly one ISO revision string. Propose it in
the handback; do not build it now. It cannot be written until the correct value
is known, or it will ratchet in whichever value happens to be there.

#### Acceptance

1. The escalation appears in the handback in the §1.12 format.
2. `WHATS_LEFT.md` §2 carries the owner-action record.
3. **`git diff --stat data/` is empty.** If it is not, you have made this worse.

---

## 9. Verification — run all of this before the handback

```sh
npm run build && sh _harness/sync.sh
node _harness/cssdiff.js                 # 0 added selectors
php _harness/lint.php                    # all green
fc-match system-ui                       # record what it says
node _harness/run.js invariants invariants-selftest copyroundtrip contrastparity \
  skuparity deadlinks backdrop-selftest plan2-formlast plan2-trunc plan2-contrast \
  plan3-contact plan4-admin plan4-public plan5-spectable plan5-images plan7-imagery \
  plan8-mobile plan8-motion plan8-keyboard plan8-crumbs plan8-catalog plan8-meta \
  plan8-chrome plan8-lead plan8-formpolish plan8-faq
node _harness/run.js plan8-contrast plan8-polish brandtext   # the three exceptions
node _harness/run.js plan10-header plan10-dashboard plan10-rfqscroll plan10-repalette \
  plan10-adminrows plan10-adminnav plan10-helpwidth plan10-auditlog plan10-help
node _harness/audit10-p7reverify.js      # 12 of 13 must now report DOES NOT REPRODUCE
```

**`invariants` must be 17/17.** The three expected exceptions must be **exactly**
34/35, 16/17 (Linux) and ≤ 13 failing. Any other red is yours.

The audit's own probes are the strongest evidence you have. Capture
`audit10-p7reverify.js` **before** your first edit and after your last; the
delta is the deliverable.

Then, before you finish:

```sh
for f in products-all.json site-info.json content.json; do
  cmp _harness/pristine/$f _harness/site/data/$f || echo "MIRROR DIRTY: $f"
done
rm -f _harness/site/admin/config.local.php
git status --porcelain          # nothing unexpected
git diff --stat data/ pdfs/ uploads/ _localsite/    # must be EMPTY
```

---

## 10. Records to write

- **`PATCH_NOTES.md`** — one section for this release, newest last, naming each
  item by its finding id.
- **`WHATS_LEFT.md` §2** — the item 4 owner action; the
  `brand-gradient-mixed-ends` re-derivation that item 12 unblocks; anything you
  found and did not fix (§1.1).
- **`_harness/README.md`** — the new `plan10-*.js` suites, one line each.
- **Do not edit** `_harness/AUDIT10-REPORT.md` or
  `plans/audit10/state/findings.jsonl`. They are the audit's record of what was
  true on 2026-08-10, not a task list to tick off. This plan is the task list.

---

## 11. Handback format

1. **Per item:** what changed (`file:line`), the acceptance numbers measured
   before and after, and the failing-first + mutation-proof runs of its suite.
2. **The regression table** as you measured it, with the three expected
   exceptions called out and any delta explained.
3. **`audit10-p7reverify.js` before and after**, unedited.
4. **The item 4 escalation**, verbatim, in the §1.12 format.
5. **Anything you found and did not fix**, with evidence and where you recorded
   it.
6. **The two judgement calls** and which way you went: item 5 (wrap vs widen)
   and item 12 (reuse `--brand-dark` vs introduce `--brand-dark-2`).

---

## 12. What this plan deliberately leaves alone

AUDIT-10 recorded **61 findings**. This plan covers **13** — the one A and the
twelve Bs. Out of scope, and not a gap in your work:

- **39 severity C findings.** The clusters the report names as one fix each are
  the natural PLAN-11: `product-detail-stretch-voids` (A10-003/004),
  `spec-table-scroller` (A10-006/016), `admin-390-page-overflow`
  (A10-023/035 — item 7 here is their sibling), `placeholder-wider-than-field`
  (A10-009/018), `admin-low-contrast` (A10-030/050/052),
  `hover-feedback` (A10-060/061).
- **9 severity D batches**, 66 instances. Character and token drift.
- **A10-056**, which AUDIT-10's pass-7 **refuted**. Back *does* restore scroll on
  `/products` — 6 of 6 visitor-shaped runs restore 1200 → 1200. The published
  numbers came from the harness's own scroll-into-view before navigating. It is
  not a defect; do not "fix" it, and do not let a future session re-chase it.
- **The three expected regression exceptions.** They are documented state.
- **Everything in `plans/audit10/guardrails.json` `known_issues`** — settled
  decisions and deliberate deferrals.
