# AUDIT-10 — final full-site inspection report

**Audit:** AUDIT-10 · **Branch:** `claude/audit-10` · **Completed:** 2026-08-10
**Scope:** every page, every element, every character, every colour, every design
choice, at four viewports, on the public site **and** `/admin` — after PLAN-1…PLAN-9.
**Method:** seven passes, one session each, machine-readable contract in
`plans/audit10/`. Findings only; **nothing was fixed**, not one character.

Machine-readable records: [`plans/audit10/state/findings.jsonl`](../plans/audit10/state/findings.jsonl)
(schema: `plans/audit10/findings.schema.json`) · human index:
[`plans/audit10/state/FINDINGS.md`](../plans/audit10/state/FINDINGS.md) · progress and
per-pass notes: [`plans/audit10/state/ledger.json`](../plans/audit10/state/ledger.json).

---

## Summary

| Severity | Meaning | Count |
|---|---|---:|
| **A** | breaks an outcome | **1** |
| **B** | real defect, will be hit and noticed | **12** |
| **C** | polish | **39** |
| **D** | observation / nit (batched; 66 individual instances) | **9** |
| | **Total findings** | **61** |
| | *of which folded into another record in dedupe (A10-044 → A10-036)* | *1* |
| | **Distinct defects** | **60** |
| | *Refuted in pass-7, retained as a record, **not** a finding* | *1* |
| | **Records in `findings.jsonl`** | **62** |

Every finding is `CONFIRMED` — measured twice, in a browser, at a stated URL and
viewport. **All 13 severity A and B findings were re-verified in pass-7 from a fresh
browser context, driven only from each record's own reproduce steps.** Twelve
reproduced. One did not, and is reported under [Refuted](#refuted) instead.

### The A, in one line

**A10-011** — on all 42 product pages at mobile-390 the title column resolves to
**0.0px**, so the product's own name paints underneath the Download PDF and Request
Quote buttons. On `CC` only the `N` of "Nonmetallic" survives. There is no
workaround and no other viewport shows it.

### The twelve Bs, in one line each

| ID | One line | Where it bites |
|---|---|---|
| A10-001 | `/dashboard` Part Type pills paint over the Description column — 37 overlap pairs | buyer, desktop-1440 |
| A10-002 | `/dashboard` at 1024: the Description track is starved to 44px, header reads `DESCRTIEMPON` | buyer, tablet-1024 |
| A10-012 | `/contact`: after a failed submit the invalid field sits **entirely** behind the sticky header | buyer, all viewports |
| A10-020 | Admin catalog: the **Delete** button is clipped to 16 of 68px on all 42 rows and cannot be scrolled into view | Rick, desktop-1440 + tablet-1024 |
| A10-021 | Admin nav overflows its own 60px bar at 390 — 2 links clipped off the top, 2 more at 1.05–1.07:1 | Rick, mobile-390 |
| A10-022 | `/admin/help.php` renders 689px wide in a 390px viewport; all 11 reference tables lose their answer column | Rick, mobile-390 |
| A10-027 | Every Page Content save is logged as "Homepage content updated", whatever page was edited | Rick, audit log |
| A10-028 | Help's four-step diagram says "Paste in a Photo URL"; the step beneath it says upload from your computer | Rick, help page |
| A10-029 | Help's worked size chart has **Max = half of Min** in all three rows — the pattern Rick copies | Rick → buyer |
| A10-037 | The site states three different ISO 9001 revisions — :2008, :2000, and unversioned | spec-grade buyer |
| A10-045 | No `--brand-accent-rgb` exists: every translucent accent tint survives a repalette as cyan | Rick, after rebranding |
| A10-046 | Two brand gradients and two navy surfaces are literals: after a repalette they read old-navy → new-colour | Rick, after rebranding |

### What the report says about itself

Three things are worth reading before the findings:

1. **One record was refuted by this pass.** A10-056 ("Back does not restore scroll on
   `/products`") was recorded as B by pass-6. It does not reproduce. The mechanism is
   identified, the original numbers are reproduced exactly by re-introducing the
   harness's own scroll, and the record is retained at the severity floor and reported
   under [Refuted](#refuted). This is the step that has killed the previous audits'
   confident wrong findings, and it earned its keep again.
2. **One record was promoted.** A10-020 moved C → B in the severity-consistency review
   for consistency with A10-021 — see its block for the argument — and was then
   re-verified from a fresh context like every other B.
3. **The Refuted section is not filler.** Forty-nine automated candidates, six probe
   defects that had each already produced a plausible false finding, four
   font-artifact leads and eight negative sweep results are written down there
   precisely so the next session does not re-chase them.

---

## Severity A — breaks an outcome

### [A] A10-011 — Product detail at 390: the action buttons take the whole header strip and the title paints under them

**What it does to a real person.** A buyer opens any product page on a phone and sees 'Download PDF' and 'Request Quote' printed on top of the product name and the PRODUCT DETAIL eyebrow — on CC only the 'N' of 'Nonmetallic' survives, and on IP75AD the entire one-word title 'Adhesives' is covered except the 'A'. Rick's catalogue looks broken on the device most first-time visitors use.

**Why this severity.** On all 42 product pages at phone width the product's own name — the one thing a buyer checks before requesting a quote — is painted underneath the Download PDF and Request Quote buttons, leaving one or two letters legible. A buyer cannot confirm which part they are looking at without leaving the page, and the header reads as a rendering failure rather than a design. Not B: there is no workaround, it is not one page, and the blast radius is the entire catalogue at the primary mobile viewport.

**Evidence.** The header strip is `div.px-8.py-5.flex.items-start.justify-between.gap-4` with a `div.min-w-0.flex-1` (eyebrow + h1 + SKU) and an un-shrunk button column. At 390 the strip's inner width is 340.0px, the button column resolves to 260.0px and the LEFT COLUMN RESOLVES TO 0.0px, so the eyebrow, h1 and SKU all overflow their own box (overflow:visible) and paint across the buttons. Painted-ink-on-button-box overlap on 42 of 42 product pages; worst 124.6 x 24.0px (IP1274, h1 x 'Request Quote'), 118.6 x 12.0px (CC, h1 x 'Download PDF'). Consequences of the same 0px column: the h1 wraps to as many as 13 lines (IP64FS-IP65VC-IP66AC-IP67SC), and the SKU line wraps on 10 of 42 (IP17TW-IP18SW-IP19LW into 3 lines, IP64FS-IP65VC-IP66AC-IP67SC into 4, VT-1100 into 2). NOT the C49/DejaVu artifact: with the document forced to Liberation Sans (metric-compatible with Arial) the left column is 16.0px and the overlap still occurs on 42 of 42, worst 81.4 x 11.0px. Does NOT occur at the larger viewports — tablet-834 left column 431.4px and 0 of 42 overlapping, desktop-1440 557.4px and 0 of 42. Two independent runs (shipped face and Liberation face, separate browser contexts and navigations) returned the same 42/42.

Probe: `_harness/audit10-p2header.js`. Issue screenshot: `_harness/out/audit10/issues/A10-011__mobile-390__product-header-buttons-over-title.png` (gitignored — the numbers above are the durable evidence).

**Re-verified in pass-7** (fresh browser context, driven from this record's own reproduce steps only, `_harness/audit10-p7reverify.js`): fresh context, 390x844 and 834x1112: strip inner 340.0px, LEFT COLUMN 0.0px, button column 260.0px; 4 painted-ink-over-button overlaps on /products?productId=CC, worst 118.6 x 20.0px ('Nonmetallic Liquid-tight Conduit Couplin' under 'Request Quote'); h1 paints on 5 line boxes. Control at 834: left column 431.4px, 0 overlaps.

**Reproduce.** `/products?productId=CC` at mobile-390.

1. npm run build && sh _harness/sync.sh
2. PHP_CLI_SERVER_WORKERS=6 php -S 127.0.0.1:8123 -t _harness/site -c _harness/php-mail.ini _harness/router.php
3. Open http://127.0.0.1:8123/products?productId=CC in a 390x844 viewport
4. Scroll to the navy PRODUCT DETAIL card: 'Download PDF' covers the eyebrow and 'Request Quote' is printed across 'Nonmetallic Liquid-tight'
5. Open the same URL at 834x1112 for the control — the same header lays out correctly
6. node _harness/audit10-p2header.js prints the resolved column widths and the ink-overlap count for all 42 products at 390 / 834 / 1440 under both faces

**Where.** src/App.jsx:8131-8172 (the flex strip, its `min-w-0 flex-1` title column, and the button column that carries no flex-shrink-0/basis)

**Confidence.** CONFIRMED · found by pass-2 · recorded 2026-08-10

---


## Severity B — real defect, will be hit and noticed

### [B] A10-001 — /dashboard: long Part Type pills and Part IDs paint on top of the neighbouring column

**What it does to a real person.** A buyer comparing parts on the public Product Index finds the description of a dozen products overprinted by a cyan category badge, so the first line of each is unreadable. Rick's own catalogue looks broken on the page that is supposed to make it scannable.

**Why this severity.** A buyer scanning the public product index reads part descriptions with a coloured badge struck through them. On 12 of the 42 rows at 1440 the first words of the description are covered by the Part Type pill, and five long Part IDs are covered by the pill in turn. Not A: the same description is legible one click away on the product page, and no wrong specification is shown — the text is obscured, not falsified.

**Evidence.** 42-row table at 1440x900. DASHBOARD_COLS fixes Part Type at 115px; the 'POLYOLEFIN HEAT SHRINK' pill paints 79.0px past the Description column's text origin. 34 painted-text overlap pairs across the table as shipped (DejaVu Sans) and 30 with the document forced to Liberation Sans, which is metric-compatible with Arial — so this is NOT the known C49/DejaVu width artifact. Long Part IDs do the same to the Part Type pill: 'IP17TW-IP18SW-IP19LW' overlaps 'Accessory' by 70.5px (44.0px under Liberation Sans). Identical across two separate navigations.

Probe: `_harness/audit10-p1dash.js`. Issue screenshot: `_harness/out/audit10/issues/A10-001__desktop-1440__dashboard-parttype-pill-over-description.png` (gitignored — the numbers above are the durable evidence).

**Re-verified in pass-7** (fresh browser context, driven from this record's own reproduce steps only, `_harness/audit10-p7reverify.js`): fresh context, 1440x900: 37 painted-text overlap pairs across the 42 rows; the IP29CG 'Polyolefin Heat Shrink' pill's right edge is 602.0px against the Description column's text origin at 533.0px — 69.0px past it, over 'Commercial Grade Polyolefin Tubing is an irradiate…'. Worst pair 108.0px ('IP64FS-IP65VC-IP66AC-IP67SC' over 'Fiberglass Sleeving').

**Reproduce.** `/dashboard` at desktop-1440.

1. npm run build && sh _harness/sync.sh
2. php -S 127.0.0.1:8123 -t _harness/site -c _harness/php-mail.ini _harness/router.php
3. Open http://127.0.0.1:8123/dashboard in a 1440x900 viewport
4. Scroll to the IP29CG row ('Commercial Grade Polyolefin Tubing'); the cyan POLYOLEFIN HEAT SHRINK pill is painted over the words 'an irradiated, economical and mechanically'
5. node _harness/audit10-p1dash.js prints the overlap counts under both the shipped face and Liberation Sans

**Where.** src/App.jsx:9196 (DASHBOARD_COLS fixed widths) with src/App.jsx:9782 (tableLayout: 'fixed')

**Not a duplicate of.** CLUSTER dashboard-fixed-columns: A10-001 (desktop-1440 pill escapes its 115px track), A10-002 (tablet-1024 Description starved to 44px), A10-015 (tablet-834 Description at 0px plus a 146px in-card scroller). Three distinct rendered outcomes with three distinct measurements, all from DASHBOARD_COLS fixing every track but Description under tableLayout:'fixed' — kept separate because a reader needs all three numbers, cross-referenced because one change addresses all three.

**Confidence.** CONFIRMED · found by pass-1 · recorded 2026-08-10

---

### [B] A10-002 — /dashboard at 1024: Description column collapses to 44px, garbling the header and every row

**What it does to a real person.** A buyer on a 1024-wide screen opens the Product Index and sees a table header reading 'DESCRTIEMPON', descriptions stacked one word per line, and operating temperatures printed on top of them. The page is 16,048px tall instead of 5,081px, so scanning 42 parts means scrolling three times as far through unreadable rows.

**Why this severity.** At 1024 the Product Index's own column header renders as the unreadable glyph pile 'DESCRTIEMPON', every description wraps to one word per line, and the Temp value is painted inside the description text. A buyer on a 1024-wide laptop or landscape tablet cannot use the table for the comparison it exists to support. Not A: /products still presents the same 42 products as a working card grid, so the catalogue is not unreachable.

**Evidence.** At 1024 the table is 974px wide. DASHBOARD_COLS fixes 190+105+115+150+215 = 775px and the Action column takes 155px, leaving the Description column 44.0px. The 'Description' header paints 80.3px into the 'Temp' header (71.2px under Liberation Sans, so structural rather than the DejaVu/C49 artifact) and renders as 'DESCRTIEMPON'. 60+ painted-text overlap pairs and 60+ cells overflowing their own content box, unchanged under Liberation Sans. Document height 16,048px at 1024 against 5,081px at 1440. Identical across two separate navigations. The three /dashboard?family= views show the same header overprint with 1-2 row overlaps each.

Probe: `_harness/audit10-p1dash.js`. Issue screenshot: `_harness/out/audit10/issues/A10-002__tablet-1024__dashboard-header-overprint.png` (gitignored — the numbers above are the durable evidence).

**Re-verified in pass-7** (fresh browser context, driven from this record's own reproduce steps only, `_harness/audit10-p7reverify.js`): fresh context, 1024x768: table 974px; resolved tracks 190 / 105 / 115 / **44** / 150 / 215 / 155; 'Description' paints 37.5px into 'Temp'; the first description cell renders on 17 line boxes; document height 16,048px.

**Reproduce.** `/dashboard` at tablet-1024.

1. npm run build && sh _harness/sync.sh
2. php -S 127.0.0.1:8123 -t _harness/site -c _harness/php-mail.ini _harness/router.php
3. Open http://127.0.0.1:8123/dashboard in a 1024x768 viewport
4. Read the table header: DESCRIPTION and TEMP are printed on top of each other
5. Read the first data row: the description wraps one word per line and the em-dash Temp value sits inside the description column's text area
6. node _harness/audit10-p1dash.js prints the resolved column widths and overlap counts under both faces

**Where.** src/App.jsx:9196 (DASHBOARD_COLS — only Description has width:null) with src/App.jsx:9782 (tableLayout: 'fixed')

**Not a duplicate of.** Distinct from A10-001: that one is a single over-wide pill escaping a 115px column and is visible at 1440 too; this is the Description track itself being starved to 44px, which only happens once the viewport drops under about 1200px. CLUSTER dashboard-fixed-columns: A10-001 (desktop-1440 pill escapes its 115px track), A10-002 (tablet-1024 Description starved to 44px), A10-015 (tablet-834 Description at 0px plus a 146px in-card scroller). Three distinct rendered outcomes with three distinct measurements, all from DASHBOARD_COLS fixing every track but Description under tableLayout:'fixed' — kept separate because a reader needs all three numbers, cross-referenced because one change addresses all three.

**Confidence.** CONFIRMED · found by pass-1 · recorded 2026-08-10

---

### [B] A10-012 — /contact: after a failed submit the invalid field is scrolled entirely behind the sticky header

**What it does to a real person.** A buyer fills in most of the quote form on a phone, taps Submit, and the page jumps — but what they see is the navy navbar and the next field down. The field the browser is complaining about, and its 'Full Name *' label, are both hidden above the fold behind the sticky header, so the form looks like it did nothing.

**Why this severity.** The RFQ form is the site's lead-capture path. When a required field is missing, the browser scrolls that field to the very top of the document — completely underneath the 65px sticky header — so the visitor is shown a header and a blank-looking form with no visible error and no visible field. Some will assume the submit did nothing and leave. Not A: the form still works and the visitor can scroll up 65px to find the field, so a determined buyer still gets through.

**Evidence.** The site uses native constraint validation (form.noValidate=false; the required fields carry `required`). Clicking Submit on an empty form focuses input[name=name] with validity.valueMissing=true and validationMessage 'Please fill out this field.', then scrolls it to viewport top. Measured field rect vs the header rect: mobile-390 field top 0.2 / bottom 46.2 against a sticky header 0-65 (position:sticky, z-index 50) => 46.0 of the field's 46.0px are under the header, i.e. 100% hidden; its label 'Full Name *' sits at top -21.8, above the viewport entirely. tablet-834 identical (46.0 of 46.0px, label at -21.9). Reproduces at the large viewports too: tablet-1024 45.7px hidden, desktop-1440 45.5px hidden. computed scroll-margin-top on the field is 0px, while the codebase already uses scrollMarginTop:84 elsewhere against this exact hazard (src/App.jsx:10407-10412 comment: 'or the sticky navbar covers the heading'). Measured twice per viewport in separate browser contexts with identical numbers.

Probe: `_harness/audit10-p2focus.js`. Issue screenshot: `_harness/out/audit10/issues/A10-012__mobile-390__contact-invalid-field-behind-header.png` (gitignored — the numbers above are the durable evidence).

**Re-verified in pass-7** (fresh browser context, driven from this record's own reproduce steps only, `_harness/audit10-p7reverify.js`): fresh context, submit pressed on an empty form: activeElement=input[name=name], validationMessage 'Please fill out this field.', valueMissing=true. mobile-390 field top 0.2 / height 46.0 against a position:sticky header whose bottom is 65 — 46.0 of 46.0px hidden, label at -21.8. desktop-1440 45.5 of 46.0px hidden, label at -22.5. computed scroll-margin-top 0px at both.

**Reproduce.** `/contact` at all.

1. npm run build && sh _harness/sync.sh
2. PHP_CLI_SERVER_WORKERS=6 php -S 127.0.0.1:8123 -t _harness/site -c _harness/php-mail.ini _harness/router.php
3. Open http://127.0.0.1:8123/contact in a 390x844 viewport
4. Scroll to the Request a Quote form and press Submit without filling anything in
5. The page scrolls to y=736; the 'Full Name *' field is now entirely behind the navbar and its label is off-screen above it
6. node _harness/audit10-p2focus.js form prints the field rect against the header rect at 834 and 390, twice each

**Where.** src/App.jsx:5106 (form onSubmit={onRfqSubmit} with native required fields) — no scroll-margin-top on the fields, against the 65px sticky header at src/App.jsx:568-575

**Not a duplicate of.** Not the PLAN-8/4.5 inline error region (src/App.jsx:4591-4619): that one handles SERVER rejections and does focus + scrollIntoView({block:'center'}) correctly. This is the browser's own constraint-validation path, which never reaches that code.

**Confidence.** CONFIRMED · found by pass-2 · recorded 2026-08-10

---

### [B] A10-020 — Product catalog: the Delete button on every row is clipped and cannot be scrolled into view

**What it does to a real person.** On the page Rick opens first and uses most, the last control on every product row is a red sliver with no readable label. He cannot tell what it is, and at 1440 or 1024 there is no scroll, zoom-independent way to reveal it.

**Why this severity.** Promoted C -> B in the pass-7 severity-consistency review, for consistency with A10-021. A10-021 is B for admin header controls being illegible/unreachable at mobile-390; this is the same class of harm — an admin control Rick cannot read — but at desktop-1440 AND tablet-1024, the two widths he is most likely to use, on all 42 rows, with wrapCanScroll=false so there is no way to bring it into view at all. Grading the desktop case below the mobile case was the inconsistency. It is the DESTRUCTIVE control, still live and clickable at 17 of 69px with no readable label, so 'misleading behavior Rick will encounter in normal use' fits B rather than the polish definition of C. Not A: it is operable and it destroys nothing on its own — delete.php still confirms.

**Evidence.** desktop-1440: table content box ends at x=1336 (left 104 + clientWidth 1232); the Actions cell is 986-1336 (350px) but its five buttons run 1002-1388. Delete occupies 1319-1388, so 52px of 69px is clipped — 17px visible. table{overflow-x:hidden} and .table-wrap scrollWidth 1232 == clientWidth 1232, so wrapCanScroll=false. tablet-1024: identical, Delete 987-1056 against a content box ending at 1004, wrap scrolls only 4px. Measured twice per viewport, identical both times. At tablet-834 (194px scrollable) and mobile-390 (638px scrollable) the same table DOES scroll in place, so the defect is specific to the two large viewports.

Probe: `_harness/audit10-p3evidence.js (lead: actioncol)`. Issue screenshot: `_harness/out/audit10/issues/A10-020__desktop-1440__admin-index-actions-clipped.png` (gitignored — the numbers above are the durable evidence).

**Re-verified in pass-7** (fresh browser context, driven from this record's own reproduce steps only, `_harness/audit10-p7reverify.js`): fresh context, signed in: 42 rows, five action buttons at 1002-1388 against a content box ending at x=1336 — Delete clipped 52 of 68px, 16px visible, wrapCanScroll=false. tablet-1024 clipped 56px (12px visible) with only 4px of wrap scroll. mobile-390 the wrap does scroll (690px), which is why the defect is specific to the two large viewports.

**Reproduce.** `/admin/index.php` at desktop-1440.

1. Start the mirror: npm run build && sh _harness/sync.sh && php -S 127.0.0.1:8123 -t _harness/site -c _harness/php-mail.ini _harness/router.php
2. Open http://127.0.0.1:8123/admin/ at 1440x900 and sign in
3. Land on /admin/index.php and look at the right-hand end of any product row
4. The Delete button is sliced at the table edge; nothing scrolls it into view

**Where.** admin/index.php:85 (table{min-width:980px;table-layout:fixed;overflow:hidden}), :92 (th/td:nth-child(5){width:350px}), :98 (.actions{flex-wrap:nowrap}), :99 (.actions .btn{flex-shrink:0})

**Confidence.** CONFIRMED · found by pass-3 · recorded 2026-08-10

---

### [B] A10-021 — At 390 the admin nav overflows its fixed 60px header: 4 of 11 links are unusable, two at 1.07:1

**What it does to a real person.** On his phone Rick opens the admin and the top navigation is broken: two links are cut off above the top of the page and two more are invisible white-on-white below the blue bar. He cannot get to the product list, add a product, or sign out.

**Why this severity.** Rick reaches the admin from whatever device is nearby. On a phone the two links he needs first (Products, + Add Product) are 7px tall slivers at the very top of the document, and Sign Out plus View Live Site are painted below the blue bar as near-white text on the near-white page background. He cannot navigate or sign out from the header. The workaround (typing an admin URL by hand) is not one a non-technical owner has.

**Evidence.** mobile-390: .ipc-admin-header is height:60px with overflow:visible; its <nav> lays out 95px tall from y=-17 to y=78. "Products" paints y=-14..7 and "+ Add Product" y=-14..1 — 15px of each is above the document top and unreachable. "View Live Site ↗" (y=43..77) and "Sign Out" (y=62..77) extend 17px below the bar onto body background rgb(240,244,248) while keeping color rgb(255,255,255) / rgba(255,255,255,0.5): contrast 1.07:1 and 1.07:1 against 7.53:1 for the links that stay on the bar. Measured twice, identical. At tablet-834 and tablet-1024 the nav wraps to two rows inside the bar and every link is legible; desktop-1440 is one row.

Probe: `_harness/audit10-p3issues.js (lead: nav390)`. Issue screenshot: `_harness/out/audit10/issues/A10-021__mobile-390__admin-nav-overflows-header.png` (gitignored — the numbers above are the durable evidence).

**Re-verified in pass-7** (fresh browser context, driven from this record's own reproduce steps only, `_harness/audit10-p7reverify.js`): fresh context, signed in at 390x844: .ipc-admin-header height 60px, overflow visible; its nav lays out from y=-17.5, 95px tall. 'Products' and '+ Add Product' are clipped above the document top. 'View Live Site ↗' 1.07:1 and 'Sign Out' 1.05:1 against the body ground below the bar.

**Reproduce.** `/admin/index.php` at mobile-390.

1. Open http://127.0.0.1:8123/admin/ at 390x844 and sign in
2. Look at the dark blue header on any signed-in admin page
3. The first nav row is sliced by the top of the page; the last row sits below the blue bar in white text on the light page background

**Where.** admin/nav.php:24 (.ipc-admin-header{height:60px;display:flex;align-items:center}) with 11 nav items at :43-56

**Confidence.** CONFIRMED · found by pass-3 · recorded 2026-08-10

---

### [B] A10-022 — Help page renders 689px wide in a 390px viewport; every reference table loses its explanation column

**What it does to a real person.** Rick opens Help on his phone because something is not working, and the half of every table that contains the answer is off the right edge. The Quick Reference "what you want to do -> where to go" table shows only the questions, never the answers.

**Why this severity.** help.php is the only documentation Rick has and the page he opens precisely when he is stuck. On a phone every one of its eleven reference tables is cut mid-row, so the column that explains what each field, button and badge does is off-screen — including the Quick Reference table whose entire job is to route him to the right page.

**Evidence.** mobile-390: documentElement.scrollWidth 689 against clientWidth 390 — 299px of page-level horizontal overflow. The driver is 11 unwrapped table.field-ref elements 557-599px wide with no scroll container (removing #quickref drops the page to 546px; the remaining field-ref tables hold it there). div.help-content is 665px wide; the first body paragraph runs to x=656, i.e. 266px past the viewport. Measured twice, identical. Same page is 1440/1024/834-clean (overflowX 0 at all three).

Probe: `_harness/audit10-p3evidence.js (lead: helpwidth)`. Issue screenshot: `_harness/out/audit10/issues/A10-022__mobile-390__help-reference-table-offscreen.png` (gitignored — the numbers above are the durable evidence).

**Re-verified in pass-7** (fresh browser context, driven from this record's own reproduce steps only, `_harness/audit10-p7reverify.js`): fresh context, signed in: mobile-390 documentElement.scrollWidth 689 vs clientWidth 390 = 299px, with 11 of 11 tables unwrapped and past the viewport. tablet-834 and desktop-1440 both 0px overflow, 0 tables past the viewport.

**Instances (8).**

- /admin/help.php :: Quick reference table — the whole destination column is off-screen
- /admin/help.php :: Add-Product field reference — the category list (Polyolefin, PVDF, Dual-Wall, ...) is entirely lost
- /admin/help.php :: action-button table — "Edit — Opens the full edit form for th[at product...]"
- /admin/help.php :: Business Details field table — right column reduced to 3-6 characters per row
- /admin/help.php :: Inquiries status-badge legend — meanings reduced to one letter each
- /admin/help.php :: audit-log badge legend — "ADD — A brand-new product w[as created.]"
- /admin/help.php :: What your server allows — "UPLOADS/IMAGES WRITABLE / NO —" with the consequence off-screen
- /admin/help.php :: section headings themselves clipped, e.g. "Building the size / dimensio[n chart]"

**Reproduce.** `/admin/help.php` at mobile-390.

1. Open http://127.0.0.1:8123/admin/help.php at 390x844, signed in
2. The whole page scrolls sideways; scroll right to find the second column of any reference table

**Where.** admin/help.php:table.field-ref (no overflow-x container; cf. admin/index.php:84 .table-wrap)

**Not a duplicate of.** CLUSTER admin-390-page-overflow: A10-022 (help.php, 299px, 11 unwrapped tables), A10-035 (audit-log.php, 200px, no .table-wrap), A10-023 (edit.php, 118px, the size-chart editor). Three admin pages carrying overflow on the page instead of inside a scroller; A10-022 is graded higher because all eleven tables lose their payload column at once on the page consulted under stress.

**Confidence.** CONFIRMED · found by pass-3 · recorded 2026-08-10

---

### [B] A10-027 — Every Page Content save is recorded as "Homepage content updated", whatever page was edited

**What it does to a real person.** Rick rewrites his privacy policy, then months later checks the audit log to find out when he did it. It says "Homepage content updated". He cannot tell which of his edits was which.

**Why this severity.** The audit log is the only record Rick has of what he changed and when. It labels every content save as a homepage change, so a Privacy-policy edit, an FAQ rewrite and a footer change are indistinguishable from each other and from a homepage tweak. His work is not lost, but the history misrepresents it — and the page subtitle plants the same wrong idea before he starts.

**Evidence.** Journey A edited copy[hero][headlineLine1] (homepage) -> log row [2026-08-10 12:31:41, CONTENT, homepage, "Homepage content updated"]. A second probe edited copy[privacyHeader][eyebrow] (Privacy page, nothing to do with the homepage) -> log row [2026-08-10 12:38:03, CONTENT, homepage, "Homepage content updated"] — byte-identical action, SKU and detail. The string is a literal, not derived from what changed. content.php renders 99 textareas and 446 posted fields covering Homepage, Services, Industries, About, FAQ, Contact, Privacy, SEO, navigation, footer and product families.

Probe: `_harness/audit10-p3shots.js (auditLogWording)`. Issue screenshot: `_harness/out/audit10/issues/A10-027__desktop-1440__auditlog-two-edits-both-homepage.png` (gitignored — the numbers above are the durable evidence).

**Re-verified in pass-7** (fresh browser context, driven from this record's own reproduce steps only, `_harness/audit10-p7reverify.js`): fresh context, signed in: edited copy[privacyHeader][eyebrow] (the Privacy page's eyebrow, 'Legal') and pressed Save Content on the 446-field form; landed on /admin/content.php?saved=1 with the new value persisted. The newest audit-log row reads `2026-08-10 15:36:37 | content | homepage | Homepage content updated | 127.0.0.1`. Mirror restored from pristine afterwards, cmp byte-identical.

**Instances (2).**

- admin/content.php:607 :: audit_log('content', 'homepage', 'Homepage content updated') — hardcoded for every section
- admin/content.php:940 :: page subtitle "Edit the homepage sections below." on a form that edits every page of the site

**Reproduce.** `/admin/audit-log.php` at n/a.

1. Sign in at http://127.0.0.1:8123/admin/ and open /admin/content.php
2. Change a field belonging to the Privacy Policy section and press Save Content
3. Open /admin/audit-log.php: the newest row reads SKU "homepage", detail "Homepage content updated"

**Where.** admin/content.php:607 and admin/content.php:940

**Confidence.** CONFIRMED · found by pass-3 · recorded 2026-08-10

---

### [B] A10-028 — Help page: the four-step diagram tells Rick to paste a photo URL, contradicting the step beneath it

**What it does to a real person.** Rick follows the picture-of-the-process, goes looking for somewhere to host a photo and get a link, and never finds the Photo upload button the next paragraph is telling him to press.

**Why this severity.** The documentation sends a non-technical owner to the one workflow the rest of the same page says he does not need. Following the diagram means hunting for an image host and a "direct link" instead of using the Photo button, and it is the diagram that people read.

**Evidence.** Box 2 of "The four-step sequence, visually" reads "Edit / Paste in a Photo URL". Numbered step 2 immediately below reads "Click Photo on the product you just created and upload a picture from your computer ... The Add form has no photo field, so this always happens as a second step." admin/help.php:504 states "you pick a picture from your own computer and it is uploaded to your server. You do not need Dropbox, Google Drive, or any image-hosting service, and you do not need to know what a 'direct link' is." The same stale assumption appears at admin/help.php:566: "a hosted link to a product photo (if you have one)". Independently reported by two reviewers at four viewports.

Issue screenshot: `_harness/out/audit10/current/desktop-1440/segments/admin_help.php__seg05.png` (gitignored — the numbers above are the durable evidence).

**Re-verified in pass-7** (fresh browser context, driven from this record's own reproduce steps only, `_harness/audit10-p7reverify.js`): fresh context, signed in: the diagram's own <svg> text nodes read `1 / Add Product / SKU, category, / name & details / → / 2 / Edit / Paste in a / Photo URL / …`, while numbered step 2 beneath it reads 'Click Photo on the product you just created and upload a picture from your computer — see Product photos. The Add form has no photo field, so this always happens as a second step.' The page also carries 'do not need Dropbox, Google Drive, or any image-hosting service' and 'You normally never type in this box'.

**Reproduce.** `/admin/help.php` at n/a.

1. Open http://127.0.0.1:8123/admin/help.php signed in, at 1440x900
2. Scroll to "Launching a brand-new product, start to finish"
3. Compare box 2 of the visual diagram with numbered step 2 directly beneath it

**Where.** admin/help.php (four-step diagram box 2) vs admin/help.php:504 and :566

**Confidence.** CONFIRMED · found by pass-3 · recorded 2026-08-10

---

### [B] A10-029 — Help page: the worked size-chart example has Max smaller than Min in all three rows

**What it does to a real person.** Rick copies the shape of the worked example when entering his own expanded-diameter chart, and reproduces a column pair that cannot be right.

**Why this severity.** It is labelled as the finished chart "as customers see it" and is the pattern Rick copies when he builds one. A size chart whose Max is half its Min is the kind of spec error a buyer looking for a spec-grade part would act on, and it starts here.

**Evidence.** Table 4 on /admin/help.php, headers ["ORDER SIZE","EXPANDED DIAMETER","WALL THICKNESS"] with EXPANDED DIAMETER split into MIN | MAX. Rows as rendered: 3/4" | 0.750" | 0.375" | 0.020"; 1" | 1.000" | 0.500" | 0.024"; 1-1/2" | 1.500" | 0.750" | 0.030". Every MAX is exactly half its MIN — the second column reads as recovered/shrunk diameter mislabelled as a maximum. admin/help.php:472-474.

Issue screenshot: `_harness/out/audit10/issues/A10-029__desktop-1440__help-size-chart-max-below-min.png` (gitignored — the numbers above are the durable evidence).

**Re-verified in pass-7** (fresh browser context, driven from this record's own reproduce steps only, `_harness/audit10-p7reverify.js`): fresh context, signed in: table 4, headers ORDER SIZE / EXPANDED DIAMETER (MIN | MAX) / WALL THICKNESS. All three data rows have MAX exactly half MIN — 0.750/0.375, 1.000/0.500, 1.500/0.750 (ratio 0.5, 0.5, 0.5).

**Reproduce.** `/admin/help.php` at desktop-1440.

1. Open http://127.0.0.1:8123/admin/help.php signed in
2. Scroll to "Building the size / dimension chart" and read the example chart under EXPANDED DIAMETER

**Where.** admin/help.php:465 (the MIN/MAX sub-header) and :472-474 (the three data rows)

**Confidence.** CONFIRMED · found by pass-3 · recorded 2026-08-10

---

### [B] A10-037 — The site states three different ISO 9001 revisions — :2008, :2000 and unversioned

**What it does to a real person.** A buyer comparing suppliers sees "ISO 9001:2008 Registered" on the homepage, "ISO 9001 Registered" and "ISO 9001:2008" on the About page, and "ISO9001:2000 quality standards" on the Value-Added product page and in the Product Index. He cannot tell from the site which revision IPC actually holds, and the two dated claims name standards that were superseded in 2008 and 2015.

**Why this severity.** A spec-grade buyer who needs a certified supplier reads the quality claim before anything else. Three revisions of one standard on one site — two of them (2000, 2008) long withdrawn — reads as a supplier who does not track his own certification, and the buyer has to ask which is true before he can quote it into his own documentation. Recorded as B rather than A because no page states a certification the company does not hold; the defect is that the site cannot agree with itself on which revision, and the buyer has a workaround (ask).

**Evidence.** Measured twice in Chromium at 1440x900, identical both runs. / renders, all visible: "ISO 9001:2008 Registered" (SPAN 223x21, twice), "ISO 9001:2008 registered facility. …" (P 295x80), "ISO 9001 Quality" (H3 295x18), "ISO 9001" (DIV 242x28). /about renders "ISO 9001 Registered" (SPAN 162x20) AND "ISO 9001:2008" (DIV 242x20) AND "ISO 9001 registration, formalizing quality systems…". /products?productId=VALUE-ADDED renders "ISO9001:2000" (SPAN 89x15, no space after ISO) and the paragraph "…under ISO9001:2000 quality standards."; /dashboard row 41 cell renders the same string. The site-wide footer badge on all 15 chrome-bearing routes renders "ESTABLISHED 1974 · ISO 9001" with no revision at all. That is 4 distinct claims: :2008, :2000, bare, and "ISO9001" unspaced. All four strings live in owner-owned data (data/content.json:31,495,604,597 and data/products-all.json, product VALUE-ADDED) — this is reported as a cross-page contradiction the site presents, not as a proposed edit to his data.

Probe: `_harness/audit10-facts.js (fact census) + _harness/audit10-copyverify.js (V2, browser confirmation)`. Issue screenshot: `_harness/out/audit10/issues/A10-037__desktop-1440__home-iso-9001-2008.png` (gitignored — the numbers above are the durable evidence).

**Re-verified in pass-7** (fresh browser context, driven from this record's own reproduce steps only, `_harness/audit10-p7reverify.js`): fresh context, four URLs: three distinct normalised claims render — ISO9001, ISO9001:2008, ISO9001:2000. / carries 6 ISO text nodes (2x 'ISO 9001:2008 Registered', 'ISO 9001 Quality', the :2008 paragraph, the bare footer badge), /about 6 (both 'ISO 9001 Registered' and 'ISO 9001:2008'), /products?productId=VALUE-ADDED 3 (ISO9001:2000 twice plus the bare footer badge), /dashboard 2. Every node visible:true.

**Reproduce.** `/` at desktop-1440.

1. npm run build && sh _harness/sync.sh && php -S 127.0.0.1:8123 -t _harness/site -c _harness/php-mail.ini _harness/router.php
2. Open http://127.0.0.1:8123/ at 1440x900 and read the fourth hero stat card and the "ISO 9001 Quality" card in the Products & Services grid — both say 9001:2008
3. Open /about and read the certification cards — one says "ISO 9001 Registered", the next says "ISO 9001:2008"
4. Open /products?productId=VALUE-ADDED and read the description paragraph and the specifications summary chips — both say ISO9001:2000
5. Open /dashboard and read the Specifications cell of the Value-Added Insulation Products row — ISO9001:2000
6. Read the footer badge on any page — "ESTABLISHED 1974 · ISO 9001", no revision

**Where.** data/content.json:31, :495, :604 (2008) · data/content.json:597 (bare) · data/products-all.json product VALUE-ADDED (ISO9001:2000) · rendered by src/App.jsx

**Not a duplicate of.** No earlier A10-* touches certification copy. A10-029 and A10-033 are help-page defects, not public certification claims.

**Confidence.** CONFIRMED · found by pass-4 · recorded 2026-08-10

---

### [B] A10-045 — No --brand-accent-rgb variable exists, so every translucent accent tint is a literal and survives a repalette

**What it does to a real person.** Rick changes his brand colours, reloads the site, and cyan is still there: a 1px cyan line under the header on every page, cyan outlines on the badges, cyan chips in the product index. He has no way to reach those from the admin, so the site looks half-rebranded to every buyer who visits.

**Why this severity.** Rick is invited to re-skin the whole site from Business Details -> Branding, and 4.23 built the machinery that makes that safe. The primary colour got an -rgb companion variable (--brand-primary-rgb, 53 call sites) precisely so translucent tints follow it; the accent never did. Pick any non-cyan brand and the site keeps a cyan hairline under the header on every page, cyan-bordered certification badges on the homepage and all five industry cards, and a cyan-tinted chip behind all 42 rows of the product index. It is not subtle and there is no workaround in the admin.

**Evidence.** Repalette drill (runtime CSS-variable injection via page.addStyleTag, no source edit): all 10 chromatic --brand-* variables moved from the navy/cyan palette to #8a1c5a / #3a1200 / #ff9d2e / #d2691e; varsActuallyChanged 10/10 on all 8 page-states. These elements still painted rgb(0,190,242) and rgb(17,158,200) afterwards, byte-identical before and after. Site-wide census counts: borderColor rgba(0,190,242,0.15) on <header> = 110 elements on 110 of 110 public page x viewport rows; borderColor rgba(0,190,242,0.3) = 12 (homepage badge 4 sides x 2 viewports, industries chips 20 at desktop); backgroundColor rgba(0,190,242,0.15) = 2; backgroundColor rgba(17,158,200,0.1) = 88 elements on 6 page-rows (42 part-type chips per /dashboard render); mega-dropdown border rgba(0,190,242,0.2) = 8 (open state); mobile drawer borderTop rgba(0,190,242,0.12) = 1; nav open-state underline rgba(0,190,242,0.4) = 1. Also mixed inside one gradient: linear-gradient(135deg, rgba(0,93,163,0.1) 0%, rgba(0,190,242,0.15) 100%) x8 — the first stop is derived from --brand-primary-rgb and follows, the second is the literal and does not. src/index.css declares --brand-primary-rgb but no --brand-accent-rgb or --brand-accent-2-rgb; grep counts 53 uses of var(--brand-primary-rgb) and 12 literal rgba(0,190,242,...) plus 2 literal rgba(17,158,200,...) in src/App.jsx. Measured twice (audit10-repalette.js --run 1 / --run 2): leak sets byte-identical.

Probe: `_harness/audit10-repalette.js`. Issue screenshot: `_harness/out/audit10/issues/A10-045__desktop-1440__home-accent-tints-after.png` (gitignored — the numbers above are the durable evidence).

**Re-verified in pass-7** (fresh browser context, driven from this record's own reproduce steps only, `_harness/audit10-p7reverify.js`): fresh context, repalette injected at runtime: --brand-primary moved #005da3 -> #8a1c5a on both pages. The header's borderBottomColor is rgba(0, 190, 242, 0.15) before AND after on / and on /dashboard; /dashboard still paints 84 cyan-tinted backgrounds after the move. src/index.css exposes no --brand-accent-rgb (the computed value is the empty string).

**Reproduce.** `/` at all.

1. Start the mirror: php -S 127.0.0.1:8123 -t _harness/site -c _harness/php-mail.ini _harness/router.php
2. Open http://127.0.0.1:8123/ at 1440x900
3. In DevTools run: document.head.insertAdjacentHTML('beforeend','<style>:root{--brand-primary:#8a1c5a!important;--brand-primary-rgb:138,28,90!important;--brand-dark:#3a1200!important;--brand-accent:#ff9d2e!important;--brand-accent-2:#d2691e!important}</style>')
4. The header's bottom border and the 'Bolingbrook, IL' badge outline are still cyan; open /dashboard and the 42 part-type chips are still cyan-tinted

**Where.** src/App.jsx:571 (header borderBottom), :760 and :1077 (nav open underline), :790/:816/:1107/:1130 (mega-dropdown borders), :1299 (mobile drawer borderTop), :1765-1767 (homepage badge), :3307 (mixed gradient), :9719 and :10027 (product-index chips), :10432 (industries chip); no --brand-accent-rgb in src/index.css:9-45

**Not a duplicate of.** CLUSTER repalette-literals: A10-045 (translucent accent tints with no --brand-accent-rgb), A10-046 (hardcoded gradient stops and navy surfaces), A10-054 (the image assets, which cannot follow a palette at all). One drill, three element sets, three different remedies.

**Confidence.** CONFIRMED · found by pass-5 · recorded 2026-08-10

---

### [B] A10-046 — Two brand gradients and two navy surfaces are hardcoded literals: after a repalette they read navy-to-new-colour

**What it does to a real person.** After Rick picks a new brand colour, every product page's header fades from the old navy into his new colour, and the industry cards do the same. It reads as a broken theme rather than a rebrand, on the pages buyers spend the most time on.

**Why this severity.** This is the louder half of the repalette defect. The product-detail header is a two-stop gradient whose second stop is var(--brand-primary) and whose first stop is the literal #0a2a52 — on all 42 product pages. Change the brand and the single most prominent block on the page a buyer lands on becomes a gradient from the OLD navy to the NEW colour: not merely unthemed, actively clashing. The same shape repeats on the five /industries card headers, the desktop mega-dropdown panel and the mobile navigation drawer.

**Evidence.** Same repalette drill, per-colour diff (a gradient whose string changes can still have a stop that did not move). /products?productId=IP38FE: background-image before = linear-gradient(135deg, rgb(10,42,82) 0%, rgb(0,93,163) 100%), after = linear-gradient(135deg, rgb(10,42,82) 0%, rgb(138,28,90) 100%) — stop 1 unmoved. Census: that exact gradient paints 84 elements on 84 page x viewport rows = all 42 product pages at both viewports. /industries: before linear-gradient(135deg, rgb(0,61,122), rgb(0,93,163)), after linear-gradient(135deg, rgb(0,61,122), rgb(138,28,90)) — 10 elements on 2 page-rows (5 industry card headers x 2 viewports). Mega-dropdown panel background rgb(14,40,71) and the mobile drawer background rgb(10,36,68) were byte-identical before and after. Distances from --brand-dark #0d2d52: rgb(10,42,82)=4.2, rgb(14,40,71)=12.1, rgb(10,36,68)=16.9; rgb(0,61,122) is 19.2 from --brand-primary-hover. Measured twice, leak sets byte-identical. EXCLUDED as deliberate: the footer's rgb(10,34,64)/#0a2240 and the .ipc-skip link that matches it — src/index.css:215-217 states in terms that the footer background is a hardcoded #0a2240 and NOT an owner-set colour, and its 1px #1a3a5c border belongs to that same surface.

Probe: `_harness/audit10-repalette.js`. Issue screenshot: `_harness/out/audit10/issues/A10-046__desktop-1440__product-header-gradient-after.png` (gitignored — the numbers above are the durable evidence).

**Re-verified in pass-7** (fresh browser context, driven from this record's own reproduce steps only, `_harness/audit10-p7reverify.js`): fresh context, repalette injected: /products?productId=IP38FE header background-image goes linear-gradient(135deg, rgb(10,42,82) 0%, rgb(0,93,163) 100%) -> linear-gradient(135deg, rgb(10,42,82) 0%, rgb(138,28,90) 100%) — the gradient string changes while stop 0 does not move. /industries shows the same frozen first stop rgb(0,61,122) on 5 of 6 sampled gradients.

**Reproduce.** `/products?productId=IP38FE` at desktop-1440.

1. Open http://127.0.0.1:8123/products?productId=IP38FE at 1440x900
2. In DevTools run: document.head.insertAdjacentHTML('beforeend','<style>:root{--brand-primary:#8a1c5a!important;--brand-dark:#3a1200!important;--brand-accent-2:#d2691e!important}</style>')
3. The product header now fades from the original navy into magenta; repeat on /industries for the five card headers

**Where.** src/App.jsx:8128 (product header gradient, #0a2a52), :10421 (industries card header, #003d7a), :788 and :1105 (mega-dropdown panel, #0e2847), :1298 (mobile drawer, #0a2444)

**Not a duplicate of.** CLUSTER repalette-literals: A10-045 (translucent accent tints with no --brand-accent-rgb), A10-046 (hardcoded gradient stops and navy surfaces), A10-054 (the image assets, which cannot follow a palette at all). One drill, three element sets, three different remedies.

**Confidence.** CONFIRMED · found by pass-5 · recorded 2026-08-10

---


## Severity C — polish

### [C] A10-003 — Product detail: the photo cell stretches to the description's height, painting a bordered empty column

**What it does to a real person.** On every product page the left half of the detail card continues below the photograph as blank white bounded by the card border and a full-height divider rule. On the worst pages that is a column of framed emptiness taller than the visitor's whole screen, which reads as a half of the page that failed to load rather than as deliberate whitespace.

**Evidence.** The detail body is `grid grid-cols-1 md:grid-cols-2` with the left cell carrying `md:border-r`; grid cells default to align-items:stretch, so the photo cell keeps the description cell's height. Painted void measured as cell bottom minus last painted descendant minus padding-bottom. desktop-1440: 38 of 42 product pages exceed 100px, worst IP75AD at 972.3px inside a 455x1324.3 cell with a 1px rgb(229,231,235) right divider. tablet-1024: 42 of 42 exceed 100px, worst IP75AD at 1574.1px inside a 327x1856.8 cell. Next worst at 1024: IP64FS-IP65VC-IP66AC-IP67SC 1072.8px, IP53MP 913.8px, IP30UV 812.8px. Two full probe runs over all 42 products at both viewports returned byte-identical JSON.

Probe: `_harness/audit10-p1void.js`. Issue screenshot: `_harness/out/audit10/issues/A10-003__tablet-1024__IP75AD-photo-cell-void.png` (gitignored — the numbers above are the durable evidence).

**Reproduce.** `/products?productId=IP75AD` at all.

1. npm run build && sh _harness/sync.sh
2. php -S 127.0.0.1:8123 -t _harness/site -c _harness/php-mail.ini _harness/router.php
3. Open http://127.0.0.1:8123/products?productId=IP75AD at 1024x768
4. Scroll to the detail card: the photograph ends and the left cell continues as blank white to the bottom of the six-paragraph description, with the divider rule drawn beside it the whole way
5. node _harness/audit10-p1void.js reports the void for all 42 products at both viewports

**Where.** src/App.jsx:8299-8304 (the `grid grid-cols-1 md:grid-cols-2 gap-0` body row and its `md:border-r` left cell)

**Not a duplicate of.** Not C37 (WHATS_LEFT S2), which is the page-header BAND's empty right half on the nine inner pages, and not 4.29, which was an empty spec table rendering its own chrome and was fixed in PLAN-5. This is the product-detail body grid stretching a short cell to a tall sibling's height. CLUSTER product-detail-stretch-voids: A10-003 (the photo cell) and A10-004 (the h-full spec panels) are the same align-items:stretch mechanism on two different elements with two different fixes.

**Confidence.** CONFIRMED · found by pass-1 · recorded 2026-08-10

---

### [C] A10-004 — Product detail: the h-full spec panels leave up to 1,392px of bordered empty white

**What it does to a real person.** On half the product pages the SPECIFICATIONS panel holds three or four lines and then continues as an empty bordered white box for the full height of the dimensions table beside it. A buyer looking for a spec sheet sees a framed blank panel where data should be and cannot tell whether the page failed or the data is missing.

**Evidence.** SpecTable1 and SpecTable2 each render `div.rounded-xl.overflow-hidden.h-full` with a 1px border inside a stretch grid, so the shorter panel is padded out to the taller one's height. Painted void = panel bottom minus last painted descendant. desktop-1440: SpecTable1 void exceeds 100px on 21 of 42 pages — worst IP38FE 1,392.0px inside a 390x1577 bordered panel (3 spec rows against a 36-row table), then IP1274 1,316.0px, IP12GA 1,295.0px, IP17TW-18SW-19LW 1,268.5px, IP37SH-IP36TH-IP39LH 1,142.5px. SpecTable2's void exceeds 100px on 5 of 39 — worst IP69HT 309.5px. tablet-1024: SpecTable1 20 of 42 (worst IP38FE 1,369.0px), SpecTable2 7 of 39 (worst IP69HT 474.5px). Two full probe runs returned byte-identical JSON.

Probe: `_harness/audit10-p1void.js`. Issue screenshot: `_harness/out/audit10/issues/A10-004__desktop-1440__IP38FE-spec-panel-void.png` (gitignored — the numbers above are the durable evidence).

**Reproduce.** `/products?productId=IP38FE` at all.

1. npm run build && sh _harness/sync.sh
2. php -S 127.0.0.1:8123 -t _harness/site -c _harness/php-mail.ini _harness/router.php
3. Open http://127.0.0.1:8123/products?productId=IP38FE at 1440x900
4. Scroll to the spec block: the SPECIFICATIONS panel's content stops after 'Electrical: Dielectric strength 2000 volts/mil.' and its bordered box continues empty beside the 36-row table
5. node _harness/audit10-p1void.js reports spec1/spec2 voids for all 42 products at both viewports

**Where.** src/App.jsx:7845 and src/App.jsx:7890 (`rounded-xl overflow-hidden h-full` with a 1px border) inside the grid at src/App.jsx:8498

**Not a duplicate of.** Not 4.29, which was a table with zero rows drawing its own chrome (fixed in PLAN-5; both components now return null on empty rows). Here both panels have real content and the SHORTER one is stretched. CLUSTER product-detail-stretch-voids: A10-003 (the photo cell) and A10-004 (the h-full spec panels) are the same align-items:stretch mechanism on two different elements with two different fixes.

**Confidence.** CONFIRMED · found by pass-1 · recorded 2026-08-10

---

### [C] A10-005 — Product catalog rail never scrolls to the product being viewed; its last row is sliced mid-glyph

**What it does to a real person.** A buyer lands on a product page and the catalog rail beside it shows an unrelated stretch of the list with nothing marked as current — on 11 of 42 pages at 1440 the row for the product they are actually looking at is entirely below the rail's fold. The rail also ends by cutting a product name horizontally through the middle of its letters, with no scrollbar or fade to say there is more.

**Evidence.** The rail is max-height:80vh with overflow-y:auto — clientHeight 718px against scrollHeight 1,339px at 1440 (612px vs 1,339px at 1024), and scrollTop is 0 on every product page. The selected family is auto-expanded but the box is never scrolled to the selected row. desktop-1440: the active row is entirely below the fold on 11 of 42 pages (IP25PU is 1,161.5px down a 718px window, i.e. 443px past it) and partly clipped on 2 more; 28 of 42 pages end with a row straddling the box's bottom edge. tablet-1024: active row fully below the fold on 14 of 42, partly clipped on 1, and 30 of 42 pages have a row sliced by the bottom edge. Two full probe runs returned byte-identical JSON.

Probe: `_harness/audit10-p1sidebar.js`. Issue screenshot: `_harness/out/audit10/issues/A10-005__desktop-1440__sidebar-active-below-fold.png` (gitignored — the numbers above are the durable evidence).

**Reproduce.** `/products?productId=IP25PU` at all.

1. npm run build && sh _harness/sync.sh
2. php -S 127.0.0.1:8123 -t _harness/site -c _harness/php-mail.ini _harness/router.php
3. Open http://127.0.0.1:8123/products?productId=IP25PU at 1440x900
4. The rail shows ACCESSORY expanded with CC, CC90 and CCS visible; IP25PU, the product on screen, is not visible and no row carries the active highlight
5. node _harness/audit10-p1sidebar.js reports scrollTop, the active row's offset and the sliced rows for all 42 products at both viewports

**Where.** src/App.jsx:7476-7486 (openFamilies follows the selection, but nothing scrolls the box) with the max-height:80vh / overflow-y:auto container at src/App.jsx:7655-7661

**Not a duplicate of.** B27 (WHATS_LEFT) collapsed the accordion so all ten family headings fit; it did not add a scroll-into-view for the selected ROW, which is what this measures.

**Confidence.** CONFIRMED · found by pass-1 · recorded 2026-08-10

---

### [C] A10-006 — At 1024 the sidebar keeps its full 288px, squeezing the spec table into a 261px scroller on 26 of 42 product pages

**What it does to a real person.** A buyer on a 1024-wide screen reads dimension tables through a 261px window and has to swipe sideways inside the table to see the last column. The rail that costs them that width is a navigation aid they are not using at that moment.

**Evidence.** 1024 is exactly the lg breakpoint, so the rail switches on at its full w-72 (288px) while the spec grid stays md:grid-cols-2: the SpecTable2 scroller measures 261px at 1024 against 389px at 1440. Overflow (scrollWidth - clientWidth) with the document forced to Liberation Sans (metric-compatible with Arial): 26 of 42 product pages still overflow, worst IP17TW-18SW-19LW 129px (table 390px in a 261px box), then IP47HV 97px, IP53MP 97px, IP37SH-IP36TH-IP39LH 94px, IP25PU 81px. As shipped on this DejaVu-Sans box the same pages read 28 of 42 and up to 174px. Measured independently by audit10-p1sweep.js and audit10-p1font.js on separate navigations with matching per-page numbers.

Probe: `_harness/audit10-p1font.js`. Issue screenshot: `_harness/out/audit10/issues/A10-006__tablet-1024__IP17TW-spec-table-clipped.png` (gitignored — the numbers above are the durable evidence).

**Reproduce.** `/products?productId=IP17TW-18SW-19LW` at tablet-1024.

1. npm run build && sh _harness/sync.sh
2. php -S 127.0.0.1:8123 -t _harness/site -c _harness/php-mail.ini _harness/router.php
3. Open http://127.0.0.1:8123/products?productId=IP17TW-18SW-19LW at 1024x768
4. The dimensions table's last column ('Light') is outside the 261px container; the region scrolls horizontally inside the card
5. node _harness/audit10-p1font.js measures every product page under both the shipped face and Liberation Sans

**Where.** src/App.jsx:7510 (`aside className="w-full lg:w-72"`) with the md:grid-cols-2 spec grid at src/App.jsx:8498

**Not a duplicate of.** NOT the known C49/plan8-polish red: that one is 'no spec table scrolls horizontally at 1440', and under Liberation Sans the 1440 overflow is 0px on all 42 pages (see the refutation recorded in the ledger). This finding is the 1024 case, which survives the font control. CLUSTER spec-table-scroller: A10-006 (1024, the lg rail takes its full 288px) and A10-016 (834, the md:grid-cols-2 split with no rail on screen) are two causes at two breakpoints for one symptom.

**Confidence.** CONFIRMED · found by pass-1 · recorded 2026-08-10

---

### [C] A10-007 — Homepage: two section headings sit 24px left of every other anchored element at desktop-1440

**What it does to a real person.** Reading down the homepage, the eyebrow and heading of the two biggest sections start a quarter-inch further left than the logo, the hero, the closing call-to-action and the footer above and below them. It is the kind of stagger a visitor feels as sloppiness without being able to name it.

**Evidence.** At 1440x900 the painted text left edge is 104px for the navbar logo, the hero H1, the '$50 minimum order…' CTA H2 and the first footer text, but 80px for the H2 'A Complete Insulation Supply Source' (y=1199.5) and the H2 'Trusted Across Demanding Markets' (y=2523.9) — a 24.0px stagger. The left-edge histogram for / at 1440 has two modes, 80px (23 blocks) and 104px (10 blocks); every other public page has a single mode at 104/105px. Cause is two container idioms: `section.px-6 > div.max-w-7xl` puts content at 80px, `div.max-w-7xl.mx-auto.px-6` puts it at 104px. Identical across two separate navigations. Does not occur at 1024, where max-w-7xl exceeds the viewport and both idioms resolve to 24px.

Probe: `_harness/audit10-p1sweep.js`. Issue screenshot: `_harness/out/audit10/current/desktop-1440/home.png` (gitignored — the numbers above are the durable evidence).

**Reproduce.** `/` at desktop-1440.

1. npm run build && sh _harness/sync.sh
2. php -S 127.0.0.1:8123 -t _harness/site -c _harness/php-mail.ini _harness/router.php
3. Open http://127.0.0.1:8123/ at 1440x900
4. Compare the left edge of the hero headline with the left edge of 'PRODUCTS & SERVICES / A Complete Insulation Supply Source' below it — the section heading starts 24px further left
5. The left-edge histogram is in _harness/out/audit10/p1sweep.json under url '/' viewport 'desktop-1440'

**Where.** src/App.jsx:3124 and src/App.jsx:3083 (`section className="py-20 px-6"` wrapping a bare `div.max-w-7xl.mx-auto`) against src/App.jsx:3224 (`div.max-w-7xl.mx-auto.px-6`)

**Confidence.** CONFIRMED · found by pass-1 · recorded 2026-08-10

---

### [C] A10-008 — /datasheets lights no navbar item although it is reachable only from the Products mega-menu

**What it does to a real person.** A buyer who opens the Products menu and clicks Datasheets arrives on a page where the Products menu is no longer highlighted, so the navbar stops telling them which section they are in — while /products and /dashboard, reached from the same menu, both stay lit.

**Evidence.** Measured the border-bottom colour of every navbar item on all ten public routes plus a product page, twice, with identical results: / lights Home; /products, /dashboard and /products?productId=CC light 'Products'; /services, /industries, /about and /faq light 'Company'; /datasheets lights nothing (0 items with a non-transparent 2px border-bottom). The active group is `prodPages = ['products','dashboard']`, which omits 'datasheets'. /datasheets is emitted only from the Products mega-menu (PLAN-7 item 3b put it there deliberately because the footer's Quick Links cannot carry it).

Issue screenshot: `_harness/out/audit10/current/desktop-1440/datasheets.png` (gitignored — the numbers above are the durable evidence).

**Reproduce.** `/datasheets` at all.

1. npm run build && sh _harness/sync.sh
2. php -S 127.0.0.1:8123 -t _harness/site -c _harness/php-mail.ini _harness/router.php
3. Open http://127.0.0.1:8123/products at 1440x900 — the 'Products' trigger carries a cyan 2px underline
4. Open http://127.0.0.1:8123/datasheets — no navbar item carries the underline

**Where.** src/App.jsx:712 (`const prodPages = ["products", "dashboard"]`)

**Not a duplicate of.** /contact and /privacy also light nothing, but neither appears in either dropdown, so no group is theirs to light; only /datasheets is inside a menu whose trigger it fails to light.

**Confidence.** CONFIRMED · found by pass-1 · recorded 2026-08-10

---

### [C] A10-009 — /dashboard search placeholder is cut off mid-word at every viewport

**What it does to a real person.** The Product Index's search box reads 'Search by part ID, type, or descr' — the sentence stops mid-word, so the one control that tells a buyer what they can search by looks broken before they have typed anything.

**Evidence.** The visible search field is 320px wide with 264px of inner width after padding. The placeholder 'Search by part ID, type, or description…' needs 322.2px in the shipped face (58.2px cut) and 284.6px with the document forced to Liberation Sans (20.6px cut) — so the truncation survives a metric-standard face and is not the DejaVu/C49 artifact. Identical at 1440x900 and 1024x768 because the field's width is fixed, and identical across two navigations.

Issue screenshot: `_harness/out/audit10/current/desktop-1440/dashboard.png` (gitignored — the numbers above are the durable evidence).

**Reproduce.** `/dashboard` at all.

1. npm run build && sh _harness/sync.sh
2. php -S 127.0.0.1:8123 -t _harness/site -c _harness/php-mail.ini _harness/router.php
3. Open http://127.0.0.1:8123/dashboard at 1440x900
4. Read the search field's placeholder: it ends '…or descr' with the rest cut off

**Not a duplicate of.** CLUSTER placeholder-wider-than-field: A10-009 (/dashboard search, every viewport) and A10-018 (/contact Special Requirements, 390). Same phenomenon, different pages; distinct from A10-038, where JavaScript cuts the string before the DOM sees it.

**Confidence.** CONFIRMED · found by pass-1 · recorded 2026-08-10

---

### [C] A10-013 — /dashboard family views: the '✕ Clear filter' control is 16.5px tall at 390, under the WCAG 2.5.8 floor

**What it does to a real person.** A buyer who filters the Product Index to one family on a phone and then wants everything back has to hit a 79 x 16px strip of 11px text — about a third of a fingertip. Missing it re-triggers whatever sits above or below.

**Evidence.** 79.1 x 16.5 CSS px (font-size 11px, padding 0, border none, display inline-block), at top 478.7 / left 24 in the mobile filter panel, no hidden ancestor. WCAG 2.5.8 Level AA asks 24x24. This is the ONLY element below 24x24 anywhere in the pass-2 sweep: 55 public URLs x 2 viewports closed + 10 routes x 2 viewports with the drawer open and both accordions expanded + /faq fully expanded at both viewports, measured under hasTouch/isMobile contexts with window.matchMedia('(pointer: coarse)').matches === true asserted at both viewports (so src/index.css:135's coarse-pointer 44px rules were live). 3 instances, one per family view; 1,289 further controls sit between 24 and 44px, which is above the AA floor and not reported. At tablet-834 the same button measures 0x0 inside a zero-height ancestor — it is a mobile-only control.

Probe: `_harness/audit10-p2tap.js`. Issue screenshot: `_harness/out/audit10/issues/A10-013__mobile-390__dashboard-clear-filter-16px.png` (gitignored — the numbers above are the durable evidence).

**Reproduce.** `/dashboard?family=Tape` at mobile-390.

1. npm run build && sh _harness/sync.sh
2. PHP_CLI_SERVER_WORKERS=6 php -S 127.0.0.1:8123 -t _harness/site -c _harness/php-mail.ini _harness/router.php
3. Open http://127.0.0.1:8123/dashboard?family=Tape in a 390x844 viewport with touch emulation on
4. Look under the family <select>: the '✕ Clear filter' button is a bare 11px text run with no padding
5. node _harness/audit10-p2tap.js reports every interactive element below 24x24 across all 55 public URLs at both small viewports plus the drawer-open and FAQ-open states

**Where.** src/App.jsx:9455-9471 (fontSize 11, padding 0, border none, background none)

**Not a duplicate of.** Outside plan8-mobile's covered set: that suite measures /contact, /about, /products?productId=IP33PO, /faq and bare /dashboard at 390, and on bare /dashboard activeFamily === 'All' so this button does not render at all. /dashboard?family=Tape and ?family=Adhesive are both emitted by the site's own family links, so the state is reachable (unlike ?family=Heat%20Shrink%20Tubing, which pass-1 established is not).

**Confidence.** CONFIRMED · found by pass-2 · recorded 2026-08-10

---

### [C] A10-014 — tablet-834: the footer keeps its four-track desktop grid, wrapping half the Quick Links to two lines

**What it does to a real person.** On an iPad in portrait the footer's Quick Links column is 166px wide, so half the links break across two lines and the two sub-columns stop lining up row for row. It is the ragged, squeezed look of a desktop layout that was never given a tablet breakpoint.

**Evidence.** The footer grid is `grid grid-cols-1 md:grid-cols-4 gap-10`, and md=768, so at 834 it resolves to grid-template-columns: 166.5px 166.5px 166.5px 166.5px inside a 786px row. 4 of the 8 Quick Links wrap to two painted line boxes: 'Product Catalog', 'Product Index', 'Resources / FAQ', 'Privacy Policy'. NOT the C49/DejaVu artifact — with the document forced to Liberation Sans the tracks are still 166.5px and the same 4 links still wrap. The band is unique to 834: at tablet-1024 the tracks are 214px and 2 links wrap under the shipped face but 0 under Liberation (that one IS a font artifact); at desktop-1440 (278px tracks) and mobile-390 (a single 342px track) nothing wraps. Footer height 452px at 834 against 448 at 1024 and 440 at 1440.

Probe: `_harness/audit10-p2focus.js`. Issue screenshot: `_harness/out/audit10/issues/A10-014__tablet-834__footer-quicklinks-wrap.png` (gitignored — the numbers above are the durable evidence).

**Reproduce.** `/` at tablet-834.

1. npm run build && sh _harness/sync.sh
2. PHP_CLI_SERVER_WORKERS=6 php -S 127.0.0.1:8123 -t _harness/site -c _harness/php-mail.ini _harness/router.php
3. Open http://127.0.0.1:8123/ at 834x1112 and scroll to the footer
4. Read the QUICK LINKS column: 'Product Catalog', 'Product Index', 'Resources / FAQ' and 'Privacy Policy' each occupy two lines while their neighbours in the paired sub-column do not
5. node _harness/audit10-p2focus.js footer prints the resolved track widths and the wrapped-link list at all four viewports under both faces

**Where.** src/App.jsx footer grid (`grid grid-cols-1 md:grid-cols-4 gap-10 mb-10`) — the jump from one column to four happens at md=768 with no intermediate step

**Confidence.** CONFIRMED · found by pass-2 · recorded 2026-08-10

---

### [C] A10-015 — /dashboard at 834: the Description column resolves to 0px and the table scrolls 146px inside its card

**What it does to a real person.** On an iPad in portrait the Product Index prints its Description header on top of its Temp header, gives the descriptions no column of their own at all, and hides 146px of the table behind a horizontal scroll a visitor has to discover. The page that exists to make 42 parts scannable is the least readable page on the tablet.

**Evidence.** At 834 the table's scroll container is 784px wide and the table is 930px, so 146px is hidden behind an overflow-x:auto scroller. DASHBOARD_COLS fixes Product Name 190 + Part ID 105 + Part Type 115 + Temp 150 + Specifications 215 and the Action column takes 155 = 930px, leaving the only width:null track — Description — resolved to 0.0px. 105 painted-text overlap pairs inside the table, starting with the header pair 'Description ⇅' x 'Temp ⇅'. Structural, not a font artifact: with the document forced to Liberation Sans the numbers are 784/930/146px identical and the overlap count is 99. The three /dashboard?family= views show the same 146px and the same header overprint (2 overlap pairs each, their tables holding 1 row). At mobile-390 the index switches to cards and there is no scroller and no overlap.

Probe: `_harness/audit10-p2evidence.js`. Issue screenshot: `_harness/out/audit10/issues/A10-015__tablet-834__dashboard-table-146px-scroll.png` (gitignored — the numbers above are the durable evidence).

**Reproduce.** `/dashboard` at tablet-834.

1. npm run build && sh _harness/sync.sh
2. PHP_CLI_SERVER_WORKERS=6 php -S 127.0.0.1:8123 -t _harness/site -c _harness/php-mail.ini _harness/router.php
3. Open http://127.0.0.1:8123/dashboard at 834x1112
4. Read the table header: DESCRIPTION and TEMP are printed on top of one another, and the description text has no column
5. Drag the table sideways — 146px of it is off to the right
6. node _harness/audit10-p2evidence.js dash prints the resolved column widths, the scroller numbers and the overlap counts at 834 and 390 under both faces

**Where.** src/App.jsx:9196 (DASHBOARD_COLS — only Description has width:null) with the tableLayout:'fixed' at src/App.jsx:9782

**Not a duplicate of.** Distinct from A10-002, which is the tablet-1024 case: there the Description track is starved to 44px and the document grows to 16,048px, but the table still fits its container. At 834 the track reaches 0px AND the container overflows by 146px, so the page gains a horizontal scroll it does not have at 1024. Distinct from A10-001, which is one over-wide pill escaping the 115px Part Type column and is visible at 1440. CLUSTER dashboard-fixed-columns: A10-001 (desktop-1440 pill escapes its 115px track), A10-002 (tablet-1024 Description starved to 44px), A10-015 (tablet-834 Description at 0px plus a 146px in-card scroller). Three distinct rendered outcomes with three distinct measurements, all from DASHBOARD_COLS fixing every track but Description under tableLayout:'fixed' — kept separate because a reader needs all three numbers, cross-referenced because one change addresses all three.

**Confidence.** CONFIRMED · found by pass-2 · recorded 2026-08-10

---

### [C] A10-016 — Product spec tables sit in a 325px scroller at 834 because the detail body stays two-column below lg

**What it does to a real person.** On an iPad in portrait the dimension table is read through a 325px window even though the whole 786px content width is free — the catalog rail that competes for it at 1024 is not even on screen at this width. A buyer checking wall thickness has to swipe sideways inside the card, and the last column is cut mid-glyph until they do.

**Evidence.** At 834 the detail body is still `grid grid-cols-1 md:grid-cols-2` (md=768), so SPECIFICATIONS and the dimension table each get ~325px while the `lg:hidden`/`lg:block` rail is not rendered beside them at all. Overflow inside the in-card scroller with the document forced to Liberation Sans (metric-compatible with Arial): 11 of 42 product pages still overflow — IP17TW-18SW-19LW +64px, IP47HV +32, IP53MP +32, IP37SH-IP36TH-IP39LH +29, IP25PU +16, CT +3, IP52EC +2. Under the shipped DejaVu face it is 21 of 42, worst +109px. At mobile-390 the body IS single column (298px scroller) and 16 of 26 pages still overflow under Liberation, worst IP17TW-18SW-19LW +92px. Document-level horizontal overflow is 0px on all 110 page x viewport combinations under both faces, so nothing escapes the page — the loss is inside the card.

Probe: `_harness/audit10-p2sweep.js`. Issue screenshot: `_harness/out/audit10/issues/A10-016__tablet-834__IP17TW-spec-scroller.png` (gitignored — the numbers above are the durable evidence).

**Reproduce.** `/products?productId=IP17TW-18SW-19LW` at tablet-834.

1. npm run build && sh _harness/sync.sh
2. PHP_CLI_SERVER_WORKERS=6 php -S 127.0.0.1:8123 -t _harness/site -c _harness/php-mail.ini _harness/router.php
3. Open http://127.0.0.1:8123/products?productId=IP17TW-18SW-19LW at 834x1112
4. The dimension table's 'Wall Thickness' group header and its last sub-column are outside the 325px scroller; the region scrolls sideways inside the card
5. node _harness/audit10-p2sweep.js and node _harness/audit10-p2sweep.js --font "Liberation Sans" print the per-page scroller overflow at both small viewports

**Where.** src/App.jsx:8498 (the `md:grid-cols-2` spec grid) — the two-column split starts at md=768 while the sidebar it was sized against only appears at lg=1024

**Not a duplicate of.** Not A10-006: that is the tablet-1024 case and its cause is the rail switching on at its full w-72 (288px) exactly at lg. At 834 the rail is not rendered beside the body at all, so the width is lost to the md:grid-cols-2 split itself — a different cause at a different breakpoint. Not the known plan8-polish/C49 red, which is the 1440 case and measures 0px under Liberation Sans. CLUSTER spec-table-scroller: A10-006 (1024, the lg rail takes its full 288px) and A10-016 (834, the md:grid-cols-2 split with no rail on screen) are two causes at two breakpoints for one symptom.

**Confidence.** CONFIRMED · found by pass-2 · recorded 2026-08-10

---

### [C] A10-017 — Horizontal chip rails hide most of their contents at 390 with no scrollbar gutter

**What it does to a real person.** On a phone the FAQ jump-nav shows one of its four categories and the catalog family filter shows two of its eleven, with no scrollbar and no arrow. A buyer who wants 'Ordering & Minimums' or the 'Accessory (13)' family has no cue that the rest exists.

**Evidence.** /faq category strip at mobile-390: clientWidth 214px, scrollWidth 777px, 563px hidden, 1 of 4 chips fully visible; the three hidden are 'Custom & Value-Added Fabrication', 'Ordering & Minimums', 'Support & Documentation'. Painted scrollbar gutter (offsetHeight - clientHeight) is 0px under a coarse-pointer context. At tablet-834 the same strip is 658/777 with 119px hidden and 3 of 4 visible ('Support & Documentation' hidden). The catalog family rail (.ipc-scroll-sm) at mobile-390: clientWidth 342px, scrollWidth 1800px, 1458px hidden, 2 of 11 chips fully visible plus 1 partially, gutter 0px; at tablet-834 786/1800 with 1014px hidden and 4 of 11 visible. The mechanism itself works — setting scrollLeft to scrollWidth reaches 563 / 1458 and the last chip becomes fully visible in every case, and C41's pinned 'Expand all' control stays outside the scroller and reachable throughout, so this is discoverability, not reachability. States identical with the FAQ accordions open (127px / 571px hidden).

Probe: `_harness/audit10-p2evidence.js`. Issue screenshot: `_harness/out/audit10/issues/A10-017__mobile-390__faq-chip-scroller.png` (gitignored — the numbers above are the durable evidence).

**Instances (5).**

- /faq :: mobile-390 :: 563 of 777px hidden, 1 of 4 chips visible, gutter 0px
- /faq :: tablet-834 :: 119 of 777px hidden, 3 of 4 chips visible, gutter 0px
- /products :: mobile-390 :: 1458 of 1800px hidden, 2 of 11 chips fully visible (1 partial), gutter 0px
- /products :: tablet-834 :: 1014 of 1800px hidden, 4 of 11 chips visible, gutter 0px
- /products?productId=CC :: mobile-390 :: identical 1458 of 1800px (the rail is on all 42 product pages)

**Reproduce.** `/faq` at mobile-390.

1. npm run build && sh _harness/sync.sh
2. PHP_CLI_SERVER_WORKERS=6 php -S 127.0.0.1:8123 -t _harness/site -c _harness/php-mail.ini _harness/router.php
3. Open http://127.0.0.1:8123/faq at 390x844 with touch emulation on
4. The sticky category row shows only the first chip before the pinned '+ Expand all' control; there is no scrollbar or fade
5. Open http://127.0.0.1:8123/products at 390x844 — the family rail shows All (42) and Polyolefin Heat Shrink (12) plus a sliver of a third
6. node _harness/audit10-p2evidence.js chips prints clientWidth/scrollWidth, the gutter height, the visible count and the hidden chip names at both small viewports

**Where.** src/App.jsx:4244-4247 (the FAQ chip scroller) and src/App.jsx:7514-7521 (.ipc-scroll-sm, whose 4px webkit thumb at src/App.jsx:6007 paints no gutter under a coarse pointer)

**Confidence.** CONFIRMED · found by pass-2 · recorded 2026-08-10

---

### [C] A10-018 — /contact at 390: the 'Special Requirements' placeholder is cut by 296px, losing the whole example

**What it does to a real person.** On a phone the RFQ form's Special Requirements hint reads 'e.g. C of C required, PPAP, cu' and stops. The one line that tells a buyer they may ask for a certificate of conformance or a specific colour is unreadable on the device they are most likely holding.

**Evidence.** The field is 300px wide with 270px of inner width after padding. Its placeholder 'e.g. C of C required, PPAP, custom marking, specific color, certifications needed' needs 638.5px in the shipped face (368.5px cut) and 565.9px with the document forced to Liberation Sans (295.9px cut), so the truncation survives a metric-standard face by a wide margin. Its three neighbours ARE font artifacts and are NOT reported: partNumber cut 7.4px, material 15.5px, requiredDate 17.3px under DejaVu and 0px under Liberation Sans; /datasheets' ds-filter likewise (9.2px shipped, 0px Liberation). The additionalNotes <textarea> also measures over-wide but a textarea placeholder wraps rather than truncating, so it is excluded. At tablet-834 the field is 720px and 0 of 10 placeholders are cut under either face.

Probe: `_harness/audit10-p2last.js`. Issue screenshot: `_harness/out/audit10/issues/A10-018__mobile-390__contact-specialreqs-placeholder.png` (gitignored — the numbers above are the durable evidence).

**Reproduce.** `/contact` at mobile-390.

1. npm run build && sh _harness/sync.sh
2. PHP_CLI_SERVER_WORKERS=6 php -S 127.0.0.1:8123 -t _harness/site -c _harness/php-mail.ini _harness/router.php
3. Open http://127.0.0.1:8123/contact at 390x844
4. Scroll to the Request a Quote form's SPECIAL REQUIREMENTS field and read its placeholder — it stops mid-word
5. node _harness/audit10-p2last.js ph prints every placeholder's needed width against its field's inner width at both small viewports under both faces

**Where.** src/App.jsx:6549 (specialPlaceholder)

**Not a duplicate of.** A10-009 is /dashboard's search placeholder, a fixed 320px control cut at every viewport. This is a different string on a different page and only at 390, and it is the lead-capture form rather than the index. CLUSTER placeholder-wider-than-field: A10-009 (/dashboard search, every viewport) and A10-018 (/contact Special Requirements, 390). Same phenomenon, different pages; distinct from A10-038, where JavaScript cuts the string before the DOM sees it.

**Confidence.** CONFIRMED · found by pass-2 · recorded 2026-08-10

---

### [C] A10-023 — Product edit form overflows a 390px viewport by 118px; the spec-table editor sets the floor

**What it does to a real person.** Editing a product on a phone makes the whole form scroll sideways, so the right edge of every card, the row delete buttons and the last size-chart column sit outside the screen while he types.

**Evidence.** mobile-390: documentElement.scrollWidth 508 vs clientWidth 390 = 118px overflow. Isolated by hiding elements one at a time: the sole cause is the size-chart editor block (div.form-group holding "Full Table JSON / Split into sub-columns / + Add row / + Add column"), which forces 426px of content; hiding it returns the page to exactly 390. .grid-2 has already collapsed correctly to a single 426px column, so the media query is not the problem. /admin/add.php, whose spec editor starts empty, does NOT overflow (scrollWidth 390) — so this is data-driven: it appears on products with a populated multi-column size chart. Measured twice, identical. No overflow at 1440/1024/834.

Probe: `_harness/audit10-p3evidence.js (lead: editwidth)`. Issue screenshot: `_harness/out/audit10/issues/A10-023__mobile-390__edit-form-overflows-viewport.png` (gitignored — the numbers above are the durable evidence).

**Reproduce.** `/admin/edit.php?sku=CC` at mobile-390.

1. Open http://127.0.0.1:8123/admin/edit.php?sku=CC at 390x844, signed in
2. The page scrolls horizontally; the size-chart card is the widest block

**Where.** admin/spectable-editor.js (the sub-column editor UI), rendered into admin/edit.php

**Not a duplicate of.** CLUSTER admin-390-page-overflow: A10-022 (help.php, 299px, 11 unwrapped tables), A10-035 (audit-log.php, 200px, no .table-wrap), A10-023 (edit.php, 118px, the size-chart editor). Three admin pages carrying overflow on the page instead of inside a scroller; A10-022 is graded higher because all eleven tables lose their payload column at once on the page consulted under stress.

**Confidence.** CONFIRMED · found by pass-3 · recorded 2026-08-10

---

### [C] A10-024 — Add Product: the spec-row Label field is too narrow to show its own instruction at 1024 and below

**What it does to a real person.** The placeholder is the only place that tells Rick a blank Label makes the row a note rather than a spec. At 390 he sees "Label (leav" and at 1024 "Label (leave blank for a n" — the instruction is cut before the part that matters.

**Evidence.** The placeholder string "Label (leave blank for a note)" needs 192px at the field's own computed font. input.ste-lab is painted 91px wide (clientWidth 89) at mobile-390 — 53% of the instruction invisible — and 187px (clientWidth 185) at tablet-1024, 5px short. Measured twice at each viewport, identical. The row keeps its Label/Value/x three-column layout at every width.

Probe: `_harness/audit10-p3issues.js (lead: addspec)`. Issue screenshot: `_harness/out/audit10/issues/A10-024__mobile-390__add-spec-label-input-91px.png` (gitignored — the numbers above are the durable evidence).

**Instances (3).**

- /admin/add.php :: mobile-390 :: input.ste-lab painted 91px, placeholder needs 192px
- /admin/add.php :: tablet-1024 :: input.ste-lab painted 187px, placeholder needs 192px
- /admin/add.php :: tablet-834 :: same three-column row, placeholder truncated to "Label (leave blank for a n"

**Reproduce.** `/admin/add.php` at mobile-390.

1. Open http://127.0.0.1:8123/admin/add.php at 390x844, signed in
2. Scroll to Specifications and read the first Label field placeholder

**Where.** admin/spectable-editor.js (.ste-row / .ste-lab), rendered into admin/add.php

**Confidence.** CONFIRMED · found by pass-3 · recorded 2026-08-10

---

### [C] A10-025 — Audit Log tells Rick a filter is hiding his history when no filter is set

**What it does to a real person.** On a server whose log is empty, the page says "No entries match the current filter." with no filter applied and no Clear control on screen. Rick is told something is being filtered out of his change history when nothing is, directly under a banner that says the opposite.

**Evidence.** GET /admin/audit-log.php with location.search = "" — input[name=sku].value = "", select[name=action].value = "", a.reset (the Clear link) not present — renders BOTH .alert "No activity recorded yet. The log file admin/admin-log.jsonl is created on the first save." AND .empty "No entries match the current filter." Measured twice, identical. The .empty branch is unconditional on $entries being empty; it never consults whether a filter was applied.

Probe: `_harness/audit10-p3issues.js (lead: emptylog)`. Issue screenshot: `_harness/out/audit10/issues/A10-025__desktop-1440__auditlog-contradictory-empty-state.png` (gitignored — the numbers above are the durable evidence).

**Reproduce.** `/admin/audit-log.php` at all.

1. Ensure _harness/site/admin/admin-log.jsonl does not exist (fresh install state)
2. Open http://127.0.0.1:8123/admin/audit-log.php signed in, with no query string
3. Both the amber banner and the "No entries match the current filter." line render together

**Where.** admin/audit-log.php:104 (the file-missing banner) and :126 (<div class="empty">No entries match the current filter.</div>, guarded only by empty($entries))

**Confidence.** CONFIRMED · found by pass-3 · recorded 2026-08-10

---

### [C] A10-026 — Page Content: the sticky Save bar paints over form labels and inputs at almost every scroll position

**What it does to a real person.** While Rick works down the 42,000px content form, an opaque 71px bar sits over the bottom of the window and hides whichever label and field happen to be there. Nothing is lost — scrolling reveals them — but a label he is reading disappears under the bar as he scrolls.

**Evidence.** .save-bar is position:sticky;bottom:0 with an opaque background rgb(240,244,248) and no z-index, and body has padding-bottom:0px, so no space is reserved for it. Sampling 8 scroll positions per viewport and hit-testing with elementFromPoint: desktop-1440 16 controls/labels painted over (6 of 8 positions), tablet-834 13 (5 of 8), mobile-390 10 (6 of 8). Worst single overlap 61px (textarea services[1][desc] at 390). Example at desktop y=0: label "Headline - line 3" fully covered plus 31px of its input. NOT reproduced on a focused field: focusing a field scrolls it clear (measured overlap 0px), so this costs reading, not typing.

Probe: `_harness/audit10-p3journeys.js (step A0b) + the scroll sweep in the pass-3 notes`. Issue screenshot: `_harness/out/audit10/issues/A10-026__desktop-1440__content-savebar-covers-fields.png` (gitignored — the numbers above are the durable evidence).

**Reproduce.** `/admin/content.php` at all.

1. Open http://127.0.0.1:8123/admin/content.php at 1440x900, signed in
2. Scroll to the top of the form; the Cancel/Save Content bar covers the "Headline - line 3" label and part of its input

**Where.** admin/content.php:932 (.save-bar{position:sticky;bottom:0}) — no matching bottom padding on the form or body

**Not a duplicate of.** Three screenshot reviewers reported this as "the bar covers a field" from full-page captures, where Playwright paints a sticky element once at an arbitrary position. That part was an artifact; the overlap recorded here is measured live at real scroll positions with elementFromPoint.

**Confidence.** CONFIRMED · found by pass-3 · recorded 2026-08-10

---

### [C] A10-030 — Every admin error message renders at 4.41:1, under the 4.5:1 AA floor for 13px text

**What it does to a real person.** The red-on-pink error text is the one thing on the page Rick must read when a save is refused, and it is the lowest-contrast text on the page — a real cost for a 60-year-old reading a phone or a laptop in a lit workshop.

**Evidence.** .error-list li computed color rgb(220,38,38) on effective background rgb(254,242,242) = 4.41:1 at font-size 13px, weight 400 (not large text, so the AA floor is 4.5:1). The same .error-list treatment carries the settings validation errors, the two-tab optimistic-concurrency message on content.php, and the upload refusal on upload-image.php. For comparison the success banner .alert-success measures 6.81:1 with the same font size.

Probe: `_harness/audit10-p3shots.js (errorContrast)`. Issue screenshot: `_harness/out/audit10/issues/A10-030__desktop-1440__settings-error-block.png` (gitignored — the numbers above are the durable evidence).

**Reproduce.** `/admin/settings.php` at desktop-1440.

1. Open http://127.0.0.1:8123/admin/settings.php signed in
2. Set the Company Email field to "not-an-email" and press Save Business Details
3. Measure the colour of the error line against its box background

**Where.** admin/settings.php (.error-list), and the same rule in admin/content.php and admin/upload-image.php

**Not a duplicate of.** Not the logged brand-text-on-brand-surface or plan8-contrast 34/35 items — both of those are public-site surfaces. No admin contrast measurement exists in WHATS_LEFT §2. CLUSTER admin-low-contrast: A10-030 (the #dc2626 error treatment at 4.41:1), A10-050 (the #9ca3af / #aeb8c4 greys at 1.82-2.54:1), A10-052 (the 4.16-4.39 batch on surfaces A10-030 does not name). The three populations are carved out of one 7,010-element scan and do not overlap.

**Confidence.** CONFIRMED · found by pass-3 · recorded 2026-08-10

---

### [C] A10-031 — Help page: "Admin dashboard address" renders as a labelled blank rule with no instruction

**What it does to a real person.** A framed box in the middle of the Help page shows a bold label and an 884px empty ruled line. Rick reads it as a value that failed to load, and the callout immediately below says "Don't write it on this page", which makes it worse.

**Evidence.** admin/help.php:258 renders <span class="cred-label">Admin dashboard address</span><span class="cred-fill"></span>; .cred-fill (help.php:97) is flex:1 with border-bottom:1px solid #9ca3af and min-height:20px, i.e. a write-on-the-line blank, painted 884px wide at desktop-1440. There is no text anywhere on the page instructing the reader to fill it in, the "credentials-box" contains exactly one row, and the next element is a tip reading "Don't write it on this page, in a document, or in an email". Reported independently as a broken/empty element by three of the four screenshot reviewers.

Issue screenshot: `_harness/out/audit10/issues/A10-031__desktop-1440__help-blank-credentials-rule.png` (gitignored — the numbers above are the durable evidence).

**Reproduce.** `/admin/help.php` at desktop-1440.

1. Open http://127.0.0.1:8123/admin/help.php signed in
2. Scroll to "Your admin password" and look at the boxed row under the first paragraph

**Where.** admin/help.php:258 with .cred-fill at admin/help.php:97

**Confidence.** CONFIRMED · found by pass-3 · recorded 2026-08-10

---

### [C] A10-032 — Four admin form controls have no label association: clicking their visible caption does nothing

**What it does to a real person.** On Add Product the "Feature Badges" and "Description Paragraphs" captions are plain headings, so clicking them does not put the cursor in the box — and the sibling Edit Product page does attach them, so the two pages behave differently for the same field. On the Audit Log the two filter controls have no caption at all.

**Evidence.** HTMLInputElement.labels (the same relationship a click on a label uses) is empty, with no aria-label, for: add.php textarea#badges, add.php textarea#description, audit-log.php input[name=sku], audit-log.php select[name=action]. Swept across all four viewports and all 11 admin pages: these four are the only ones — settings.php, content.php, edit.php, password.php, backups.php and inquiries.php return zero unlabelled controls, and zero <label for> anywhere points at a missing id. edit.php labels the same two textareas properly at edit.php:394 and :404.

Probe: `_harness/audit10-p3sweep.js (unlabelled controls) and _harness/audit10-p3evidence.js (lead: labels)`. Issue screenshot: `_harness/out/audit10/current/desktop-1440/admin_add.php.png` (gitignored — the numbers above are the durable evidence).

**Instances (4).**

- /admin/add.php :: textarea#badges — caption is div.card-title "Feature Badges" (add.php:217-218); edit.php:394 uses <label for="badges">
- /admin/add.php :: textarea#description — caption is div.card-title "Description Paragraphs" (add.php:221-222); edit.php:404 uses <label for="description">
- /admin/audit-log.php :: input[name=sku] — placeholder "Filter by SKU…" only, no label (audit-log.php:108)
- /admin/audit-log.php :: select[name=action] — first option "All actions" only, no label (audit-log.php:109)

**Reproduce.** `/admin/add.php` at all.

1. Open http://127.0.0.1:8123/admin/add.php signed in
2. Click the words "Feature Badges" — focus does not move into the textarea below it
3. Do the same on /admin/edit.php?sku=CC with "One badge per line" — focus does move

**Where.** admin/add.php:217-218, admin/add.php:221-222, admin/audit-log.php:108-109

**Confidence.** CONFIRMED · found by pass-3 · recorded 2026-08-10

---

### [C] A10-033 — Help page describes a 6-link header and a 2-button row; the real ones have 11 links and 5 buttons

**What it does to a real person.** The "Reading the dashboard" section reads as an exhaustive tour and leaves out five of the eleven things in the header, including Business Details, Page Content, Inquiries and Backups. The mock product row shows two buttons named differently from the real five, so the Photo button Rick is told elsewhere to click never appears in the diagram that is supposed to show him where it is.

**Evidence.** help.php prose: "quick links to Products, Add Product, Audit Log, and Help, plus a link to open the live public website in a new tab and Sign Out" (6 items). admin/nav.php:43-56 emits 11: Products, + Add Product, Business Details, Page Content, Inquiries, Backups, Audit Log, Password, Help, View Live Site, Sign Out. The mock ACTIONS cell shows "Edit" and "Del"; admin/index.php:221-232 renders five: Edit, Manage PDF, Photo, View ↗, Delete — and "Del" is a third name for the control the prose calls Delete. Seven sidebar entries also name their target section differently from that section's own heading (e.g. "Editing a product" -> "Editing an existing product"); all anchors resolve, so this is naming drift, not dead links.

Issue screenshot: `_harness/out/audit10/current/desktop-1440/segments/admin_help.php__seg02.png` (gitignored — the numbers above are the durable evidence).

**Reproduce.** `/admin/help.php` at n/a.

1. Open http://127.0.0.1:8123/admin/help.php signed in
2. Read "Reading the dashboard" and compare its header list and mock ACTIONS column against the real header at the top of the same page and any row of /admin/index.php

**Where.** admin/help.php ("Reading the dashboard") vs admin/nav.php:43-56 and admin/index.php:221-232

**Confidence.** CONFIRMED · found by pass-3 · recorded 2026-08-10

---

### [C] A10-034 — Help page: the last bullet of "Getting more help" is an unparseable sentence fragment

**What it does to a real person.** The list telling Rick what he still needs a developer for ends with a line he cannot read: he has no way to tell whether it applies to him.

**Evidence.** admin/help.php:842 renders, verbatim: "Anything in What your server allows reading a value you were told it shouldn't" — no verb agreement, no terminal punctuation. The two bullets above it (:840, :841) are well-formed sentences. Reported independently by two reviewers at three viewports.

Issue screenshot: `_harness/out/audit10/current/desktop-1440/segments/admin_help.php__seg08.png` (gitignored — the numbers above are the durable evidence).

**Reproduce.** `/admin/help.php` at n/a.

1. Open http://127.0.0.1:8123/admin/help.php signed in
2. Scroll to "Getting more help" and read the last bullet under "What genuinely still needs your developer"

**Where.** admin/help.php:842

**Confidence.** CONFIRMED · found by pass-3 · recorded 2026-08-10

---

### [C] A10-035 — Audit Log is the only admin table with no scroll wrapper: at 390 it scrolls the whole page 200px

**What it does to a real person.** Once Rick has any change history, checking it on a phone drags the entire page sideways — header, heading and filter row included — instead of the table scrolling inside its own card the way the product catalog does.

**Evidence.** mobile-390 with 3 log rows: table width 566px, right edge 590 against a 390px viewport; the table has NO overflow-x ancestor (inScroller=false), so the page itself carries the overflow — documentElement.scrollWidth 590 vs clientWidth 390 = 200px. Column right edges: WHEN 183, ACTION 293, SKU 396 (6px off), DETAIL 499 (109px off), IP 590 (200px off). Measured twice, identical. pass-0 recorded the same defect independently as candidate C-046 at 206px with a different set of rows. /admin/index.php wraps its tables in .table-wrap{overflow-x:auto} and scrolls in place at the same viewport; /admin/inquiries.php fits (304px) and /admin/backups.php uses cards, not a table — both clean at all four viewports.

Probe: `_harness/audit10-p3tables.js`. Issue screenshot: `_harness/out/audit10/issues/A10-035__mobile-390__audit-log-table-overflows-viewport.png` (gitignored — the numbers above are the durable evidence).

**Reproduce.** `/admin/audit-log.php` at mobile-390.

1. Sign in and save anything once so admin/admin-log.jsonl exists
2. Open http://127.0.0.1:8123/admin/audit-log.php at 390x844
3. The whole page scrolls horizontally; the IP column is 200px off-screen

**Where.** admin/audit-log.php:128 (<table> with no .table-wrap; cf. admin/index.php:84-85)

**Not a duplicate of.** Distinct from A10-022 (help.php): different page, different cause — help.php overflows from fixed-width reference tables in prose, this from a data table that simply has no wrapper. Resolves pass-0 candidate C-046. CLUSTER admin-390-page-overflow: A10-022 (help.php, 299px, 11 unwrapped tables), A10-035 (audit-log.php, 200px, no .table-wrap), A10-023 (edit.php, 118px, the size-chart editor). Three admin pages carrying overflow on the page instead of inside a scroller; A10-022 is graded higher because all eleven tables lose their payload column at once on the page consulted under stress.

**Confidence.** CONFIRMED · found by pass-3 · recorded 2026-08-10

---

### [C] A10-038 — Four components cut product copy at a fixed character count, landing mid-word 49 times on /dashboard alone

**What it does to a real person.** A buyer scanning the Product Index reads specification cells that stop mid-word — "· Wire Protectio…", "· O-r…", "Structural Adhesives (Ep…" — in the one view whose whole purpose is comparing parts at a glance. Two cells leave an opening bracket unclosed, so the line ends inside a parenthetical that never opens onto anything.

**Evidence.** Measured twice at 1440x900, identical. /dashboard: 294 body cells, 81 truncated with an ellipsis, 49 of those end on a letter (mid-word), 2 leave an unbalanced "(" — "…From Instant Adhesives (Cyanoacry…" and "Instant Adhesives (Cyanoacrylates) · Threadlockers & Anaerobics · Structural Adhesives (Ep…". Source: src/App.jsx:9251 descFull.slice(0,110)+"…" and src/App.jsx:10069 row.specs.slice(0,90)+"…". Same class in two more components: /products?productId=IP29CG scans 79 sidebar/related controls, 18 truncated, e.g. "IP29CGCommercial Grade Polyolefin Tubi…", "IP3LLayflat PVC Heat Shrink Tubing (…" (src/App.jsx:7644 slice(0,32), :7809 slice(0,38), :8553 slice(0,45)). And the crawler-facing copy: the meta description of /products?productId=IP71NS%20-%20IP72PS%20-%20IP73PP is exactly 300 characters, ends "…+275°F, 3000psi, " — trailing comma, trailing space, no terminator (src/App.jsx:7061 slice(0,300)). Across the whole 68-page dump: 73 distinct ellipsis cuts land inside a word against 32 that land at a boundary. CSS clipping is NOT the mechanism — the same probe found 0 elements clipped by line-clamp or text-overflow on /, /products, /dashboard, /datasheets, /faq and two product pages.

Probe: `_harness/audit10-trunc.js`. Issue screenshot: `_harness/out/audit10/issues/A10-038__desktop-1440__dashboard-midword-slices.png` (gitignored — the numbers above are the durable evidence).

**Reproduce.** `/dashboard` at desktop-1440.

1. Open http://127.0.0.1:8123/dashboard at 1440x900
2. Read the Description and Specifications columns — 49 of the 81 truncated cells stop inside a word
3. Find the "Adhesives" row: Description ends "From Instant Adhesives (Cyanoacry…", Specifications ends "Structural Adhesives (Ep…"
4. Open /products?productId=IP29CG and read the left catalog rail and the Related Products cards — 18 of 79 names are cut, e.g. "Layflat PVC Heat Shrink Tubing (…"
5. curl -s "http://127.0.0.1:8123/products?productId=IP71NS%20-%20IP72PS%20-%20IP73PP" is client-rendered; instead read document.querySelector('meta[name=description]').content in the browser — length 300, ends "3000psi, "

**Where.** src/App.jsx:7061 (300), :7644 (32), :7809 (38), :8553 (45), :9251 (110), :10069 (90)

**Not a duplicate of.** Not A10-009: that is a CSS width clipping a placeholder the browser renders whole. This is JavaScript cutting the string before it reaches the DOM, so no viewport or font change can recover it. Not the C46 case either — the comment at src/App.jsx:9002 records that the catalog CARD title was moved off a mid-word cut onto a two-line word-boundary clamp; these six call sites were not.

**Confidence.** CONFIRMED · found by pass-4 · recorded 2026-08-10

---

### [C] A10-039 — Page Content: 96 accessible names announce a literal "&amp;" instead of "and"

**What it does to a real person.** The 4.31 work exists so a screen-reader user can tell 18 boxes all called "Icon" apart. On the three sections whose titles contain an ampersand, what is announced is "Icon, row 1 of Products ampersand a-m-p semicolon Services Cards" — the row identity is still there but the section name is read out as markup. The visible legend above it is correct, so nothing on screen shows the fault.

**Evidence.** Measured twice at 1440x900, identical. The <legend> paints "Products & Services Cards" correctly. The label's accessible name is "Icon — row 1 of Products &amp; Services Cards" and the reorder button's aria-label is "Move row 1 of Products &amp; Services Cards up". 96 elements on the page carry a literal HTML entity in their accessible name (label span[data-rowctx] + button[aria-label]). The row-context span is correctly hidden visually: position absolute, clip rect(0,0,0,0), 1x1px. fieldset[data-section-title] also stores "Products &amp; Services Cards", so content-editor.js re-applies the same string on every reorder and on every newly added row. Cause: three section titles are stored already-escaped (admin/content.php:77, :162, :173 — 'Products &amp; Services Cards', 'About — Team &amp; Capabilities', 'About — Certifications &amp; Standards') while thirteen sibling titles store a bare "&" (e.g. :312, :333); the escaped ones then pass through h() a second time at :705, :788, :790 and :799. The legend at :990 echoes $cfg['title'] raw, which is why only the accessible copy is affected.

Probe: `_harness/audit10-copyscan.js (section a) + _harness/audit10-copyverify.js (V1)`. Issue screenshot: `_harness/out/audit10/issues/A10-039__desktop-1440__content-row-accessible-names.png` (gitignored — the numbers above are the durable evidence).

**Reproduce.** `/admin/content.php` at desktop-1440.

1. Sign in to http://127.0.0.1:8123/admin/ with the mirror password
2. Open /admin/content.php at 1440x900
3. In DevTools run: [...document.querySelectorAll('label span[data-rowctx], button[aria-label]')].filter(e => /&amp;/.test(e.textContent + (e.getAttribute('aria-label')||''))).length  -> 96
4. Inspect the first row of the "Products & Services Cards" fieldset: the legend reads correctly, the visually-hidden span inside the Icon label reads " — row 1 of Products &amp; Services Cards"

**Where.** admin/content.php:77, :162, :173 (pre-escaped titles) → :705, :788, :790, :799, :989 (h() applied again)

**Not a duplicate of.** Not A10-036: that batches button-label casing, catalogue/catalog, British spellings and one straight-vs-curly hint on the same page. This is a double-escape defect in the accessible-name layer, which A10-036 does not mention and which no visible string reveals.

**Confidence.** CONFIRMED · found by pass-4 · recorded 2026-08-10

---

### [C] A10-040 — Business Details "Live preview" shows a copyright line the site has never rendered

**What it does to a real person.** The panel is headed "Live preview", so Rick reads its bottom line as what the public footer says. It says "© 2026 Insulation Products Corporation — serving industry since 1974". The real footer says "© 1974–2026 Insulation Products Corporation. All rights reserved." The Help page separately tells him the founded year "drives the '© 1974–2026' line automatically", so two admin surfaces describe the same footer differently and only one of them matches it.

**Evidence.** Measured twice at 1440x900, identical. .preview-head textContent = "Live preview". #settings-preview .sp-foot textContent = "© 2026 Insulation Products Corporation — serving industry since 1974" (admin/settings-preview.js:62-63 builds it from new Date().getFullYear()). The rendered site footer <p> = "© 1974–2026 Insulation Products Corporation. All rights reserved." (src/App.jsx:11759). The preview badges also disagree with the site: preview "25 million ft in stock" vs the site's "25M+ / Feet in Stock" and "25 million feet in stock". admin/help.php:business table row 4 states: Drives the "© 1974–2026" line automatically. You never update the second year.

Probe: `_harness/audit10-copyverify.js (V13, V13b)`. Issue screenshot: `_harness/out/audit10/issues/A10-040__desktop-1440__settings-live-preview.png` (gitignored — the numbers above are the durable evidence).

**Reproduce.** `/admin/settings.php` at desktop-1440.

1. Sign in and open /admin/settings.php at 1440x900
2. Read the last line of the "Live preview" panel on the right
3. Open http://127.0.0.1:8123/ in another tab and read the last line of the footer
4. Open /admin/help.php, section "Business Details", and read the Founded year row

**Where.** admin/settings-preview.js:62-63 vs src/App.jsx:11759 and admin/help.php (Business Details table)

**Not a duplicate of.** Distinct from A10-033 (help page miscounting nav links and action buttons): this is the settings preview, and the disagreement is with the rendered footer rather than with the admin chrome.

**Confidence.** CONFIRMED · found by pass-4 · recorded 2026-08-10

---

### [C] A10-041 — Two Business Details field hints explain a field using developer vocabulary and nothing else

**What it does to a real person.** Rick is told what a field is for in words that only mean something to a developer. "Used in the site footer and search-engine (Schema.org) data." and "Digits with country code for click-to-call (tel:) links." — Schema.org and tel: are never defined anywhere in the admin or on the Help page, so the parenthetical is noise at best and, on the phone field, is the only thing explaining why this box wants a different format from the phone number he just typed one row above.

**Evidence.** Measured twice at 1440x900, identical. Both strings render in a div.hint, painted height 13px, immediately under their inputs: "Used in the site footer and search-engine (Schema.org) data." and "Digits with country code for click-to-call (tel:) links." A third hint in the same column, "Comma-separated. Used for search-engine hours data.", says "search-engine … data" with no jargon at all, which is the same idea expressed for the same reader — so the two flagged hints are not a house convention. Grep over the whole 68-page text dump: "Schema.org" appears once on the whole site, "tel:" once; neither string appears anywhere on /admin/help.php, so nothing explains them.

Probe: `_harness/audit10-copyverify.js (V14)`. Issue screenshot: `_harness/out/audit10/issues/A10-041__desktop-1440__settings-hints.png` (gitignored — the numbers above are the durable evidence).

**Reproduce.** `/admin/settings.php` at desktop-1440.

1. Sign in and open /admin/settings.php at 1440x900
2. Read the hint under the Address / company-name group: "Used in the site footer and search-engine (Schema.org) data."
3. Read the hint under the dial-string field: "Digits with country code for click-to-call (tel:) links."
4. Open /admin/help.php and search it for "Schema.org" or "tel:" — neither appears

**Where.** admin/settings.php (the two div.hint strings quoted above)

**Not a duplicate of.** Pass-3 recorded admin-copy defects on help.php (A10-028/029/031/033/034) and on audit-log.php (A10-025); none is on settings.php and none is about undefined vocabulary. The "755 over FTP" line on /admin/index.php is deliberately excluded — it is prefixed "Server setup problem — please send this to your developer.", which names the right reader.

**Confidence.** CONFIRMED · found by pass-4 · recorded 2026-08-10

---

### [C] A10-042 — The homepage makes two different shipping promises, two sections apart

**What it does to a real person.** A buyer who needs stock today reads the hero stat card "Same Day / Shipment Available / On in-stock items", scrolls one section, and reads "≤1 Day / Shipment Available / On most stock items". The stat has the same name in both strips and two different answers: same-day for everything in stock, or up to a day for most of it. The other two stats in each strip ($50 Minimum Order, 25M+ Feet in Stock) are repeated verbatim, so the shipping line is the one that changed.

**Evidence.** Measured twice at 1440x900, identical both runs. main section:nth-of-type(1) cells = ["$50","Minimum Order","No large MOQ required","25M+","Feet in Stock","Ready to ship today","Same Day","Shipment Available","On in-stock items","ISO 9001","Registered Quality","Every order, every time"]. main section:nth-of-type(2) cells = ["50+","Years in Business","Founded July 1, 1974","25M+","Feet in Stock","Ready to ship today","$50","Minimum Order","No large MOQ required","≤1 Day","Shipment Available","On most stock items"]. Painted at y=316 and y=1005 respectively in the 1440x900 document, i.e. both above the fold on one scroll. Both strips are owner-owned data (data/content.json hero proof points and trust-bar stats); reported as a contradiction the page presents, with no edit proposed. Recorded as C rather than B because the two claims are technically reconcilable — same-day for in-stock, ≤1 day for most stock — but a buyer reading both gets two answers to one question and cannot tell which governs his part.

Probe: `_harness/audit10-copyshots.js + _harness/audit10-copyverify.js (V7)`. Issue screenshot: `_harness/out/audit10/issues/A10-042__desktop-1440__home-hero-stats.png` (gitignored — the numbers above are the durable evidence).

**Reproduce.** `/` at desktop-1440.

1. Open http://127.0.0.1:8123/ at 1440x900
2. Read the four hero stat cards on the right of the hero — third card: "Same Day / Shipment Available / On in-stock items"
3. Scroll to the trust bar immediately below the hero — fourth stat: "≤1 Day / Shipment Available / On most stock items"
4. Compare the other three stats in each strip — $50 Minimum Order and 25M+ Feet in Stock are byte-identical in both

**Where.** data/content.json (heroProofPoints and trustBar sections), rendered by src/App.jsx

**Not a duplicate of.** Pass-1 recorded homepage layout findings (A10-007 heading alignment) but nothing about the duplicated stat strips or their copy.

**Confidence.** CONFIRMED · found by pass-4 · recorded 2026-08-10

---

### [C] A10-047 — The border role carries five near-identical greys, two of them 1.41 apart in sRGB

**What it does to a real person.** Nobody sees this directly, but it is why a card, a table cell and a sidebar row never quite match: three different hairline greys are doing one job, and any future adjustment has to be made in five places or the surfaces drift apart visibly.

**Evidence.** Computed-style census over 132 page x viewport combinations: the border role paints 37 distinct colours, 11 of them hardcoded literals accounting for 12,984 of the 15,088 bordered elements. Near-duplicate pairs at sRGB Euclidean distance < 12, same role: #f0f4f8 (998 elements) vs #f0f3f7 (366) d=1.41; #e5e9ee (3,914 on 128 page-rows) vs #e5e7eb (760, Tailwind gray-200) d=3.61; #f0f3f7 (366) vs #eef2f6 (4) d=2.45; #f0f4f8 vs #eef2f6 d=3.46; #e8edf2 (5,058, the product spec-table cells) vs #e5e9ee d=6.40; #e5e7eb vs #e0e4e8 (78) d=6.56; #e8edf2 vs #f0f3f7 d=11.18. The two largest — #e8edf2 on td.px-3.py-2.5.text-center and #e5e9ee on the catalog/industry cards — are 6.40 apart and appear on the same page: a product page paints #e8edf2 inside its spec table and #e5e9ee on the card that contains it. 59 near-duplicate pairs across all roles, 39 where both members are used 3+ times.

Probe: `_harness/audit10-colorclust.js`. Issue screenshot: `_harness/out/audit10/issues/A10-047__desktop-1440__spec-table-border-grey.png` (gitignored — the numbers above are the durable evidence).

**Reproduce.** `/products` at all.

1. node _harness/audit10-stylecensus.js  (writes plans/audit10/state/stylecensus.json)
2. node _harness/audit10-colorclust.js   (prints the near-duplicate table)
3. Or: open /products?productId=IP38FE and read borderColor on td.px-3.py-2.5.text-center (#e8edf2) against the containing card (#e5e9ee)

**Confidence.** CONFIRMED · found by pass-5 · recorded 2026-08-10

---

### [C] A10-048 — One card class paints three different elevations depending on which page it is on

**What it does to a real person.** The same white rounded card sits at three different heights above the page across the site, so a visitor moving from Services to Industries to a product page sees the same component subtly re-weighted each time.

**Evidence.** Census, signature div.bg-white.rounded-2xl.overflow-hidden paints three distinct box-shadows: rgba(0,93,163,0.07) 0px 4px 24px on 84 elements (product pages and /contact), rgba(0,93,163,0.05) 0px 1px 4px on 12 (/ and /services), rgba(0,93,163,0.06) 0px 2px 12px on 10 (/industries and /privacy). Three offsets, three blurs and three alphas for one class — this is the only same-class shadow drift on the site (1 of 15 distinct shadow values shows it). Six further shadows are used by 2 elements or fewer: rgba(0,93,163,0.2) 0 4px 16px, rgba(0,45,82,0.12) 0 4px 24px, rgba(0,93,163,0.1) 0 0 0 3px, rgba(13,45,82,0.18) 0 8px 24px, rgba(0,93,163,0.35) 0 4px 12px, rgba(0,0,0,0.28) 0 8px 32px.

Probe: `_harness/audit10-tokens.js`. Issue screenshot: `_harness/out/audit10/issues/A10-048__desktop-1440__card-shadow-industries.png` (gitignored — the numbers above are the durable evidence).

**Reproduce.** `/industries` at all.

1. Open /services, /industries and /contact at 1440x900
2. Read getComputedStyle(document.querySelector('.bg-white.rounded-2xl')).boxShadow on each

**Confidence.** CONFIRMED · found by pass-5 · recorded 2026-08-10

---

### [C] A10-049 — Admin buttons never get font-family:inherit, so 776 of them render in the UA font at line-height 1

**What it does to a real person.** Every button Rick presses in the admin is set in a different typeface from the label next to it, and the small square row buttons in the content editor sit on a line box exactly as tall as their glyphs. It reads as unfinished, on the surface built specifically for him.

**Evidence.** Census over 12 admin screens x 2 viewports: fontFamily 'Arial' on 776 elements across 12 admin pages, while the admin's own body rule is font-family: system-ui, sans-serif (admin/add.php:126, audit-log.php:66, backups.php:145, auth.php:160, config.php:261 — every admin page). Breakdown of the 776: button.rbtn 476, button.rbtn.danger 238, button.btn.btn-secondary 34, button.btn.btn-primary 6, button.ste-x 4, bare button 4. 'Arial' is not declared anywhere in admin/*.php — it is Chromium's UA default for <button>, which does not inherit font-family. The admin's <input>/<select>/<textarea> rules DO carry font-family: inherit (admin/add.php:144), so the omission is buttons only. The same elements inherit the UA line-height: fontSize 13px / lineHeight 13px = ratio 1.00 on 714 elements (.rbtn declares line-height: 1 explicitly at admin/content.php:907), 17px/17px on button.ste-x. For comparison the public site fixed exactly this defect with .ipc-sort-btn { font: inherit } at src/index.css:202.

Probe: `_harness/audit10-tokens.js`. Issue screenshot: `_harness/out/audit10/issues/A10-049__desktop-1440__admin-rbtn-arial.png` (gitignored — the numbers above are the durable evidence).

**Reproduce.** `/admin/content.php` at all.

1. Sign in at http://127.0.0.1:8123/admin/ and open /admin/content.php
2. Read getComputedStyle(document.querySelector('button.rbtn')).fontFamily -> 'Arial', against getComputedStyle(document.body).fontFamily -> 'system-ui, sans-serif'

**Where.** admin/content.php:907 (.rbtn, no font-family), admin/add.php:144 (the inputs that DO say font-family: inherit)

**Confidence.** CONFIRMED · found by pass-5 · recorded 2026-08-10

---

### [C] A10-050 — The admin's low-emphasis greys render at 1.82-2.54:1 — the field help under every setting is the least readable text there

**What it does to a real person.** The one-line explanation under each field — the text that tells a non-technical owner what 'Brand colors' or 'Logo URL' actually does — is the palest text on the page at 2.54:1, well under the 4.5:1 AA floor, at 11px. Rick is the only reader the admin has, and this is the copy written for him.

**Evidence.** 7,010 text-painting elements scored across 12 admin screens x 2 viewports using backdrop.js (the shared composited-background implementation the public contrast suites use — not a second implementation): 6,662 meet AA, 348 fail, in 34 distinct colour/size/class combinations. The grey family, all far below AA: #9ca3af on #ffffff = 2.54:1 on div.hint x16 (settings.php, add.php, password.php, 11px), span.k x10 (10px), td.ip x24 (audit-log, 11px), th x18 (inquiries, 10px), p.none x6 (13px), span.when x3 (12px), div.toc-group x10 (help, 10px), button.ste-x x4 (17px), div.sp-foot x2, code x2, strong x2; #9ca3af on #f0f4f8 = 2.30:1 on p.note x2 and code x2 (backups.php, 12px); #9ca3af on #f8fafc = 2.43:1 on span.when x1; #aeb8c4 on #ffffff = 2.01:1 on h3.pp-name.pp-ph (18px/800) and div.pp-meta.pp-ph, on #f8fafc = 1.92:1 (div.pp-imgph), on #f0f4f8 = 1.82:1 (div.pp-summary.pp-ph) — the add.php live-preview placeholders. AA needs 4.5:1 for all of these (none reaches the large-text threshold except button.ste-x, which needs 4.5 at weight 400). Measured twice (audit10-admincontrast.js --run 1 / --run 2): 7,010 scored, 348 failing, 34 distinct combinations, sets identical.

Probe: `_harness/audit10-admincontrast.js`. Issue screenshot: `_harness/out/audit10/issues/A10-050__desktop-1440__admin-hint-text-2.54to1.png` (gitignored — the numbers above are the durable evidence).

**Reproduce.** `/admin/settings.php` at all.

1. Sign in at http://127.0.0.1:8123/admin/ and open /admin/settings.php
2. Read the 11px grey line under 'Logo URL' — computed colour rgb(156,163,175) on rgb(255,255,255)
3. node _harness/audit10-admincontrast.js prints all 34 combinations with their ratios

**Where.** admin/add.php:143 and admin/edit.php:273 (.hint), admin/backups.php:154/159/162, admin/audit-log.php:89/90, admin/help.php:48, admin/product-preview.js:66/81/83 and admin/settings-preview.js:26 (#aeb8c4)

**Not a duplicate of.** Not A10-030, which measured the red .error-list treatment at 4.41:1 and names only the error blocks on settings.php / content.php / upload-image.php. This is a different token (#9ca3af / #aeb8c4 grey, not #dc2626 red), a different set of elements (field help, table metadata, the help-page table of contents, the add.php preview placeholders) and roughly half the ratio. brandtext and the plan5c suites never load /admin, so nothing measured any of this before. CLUSTER admin-low-contrast: A10-030 (the #dc2626 error treatment at 4.41:1), A10-050 (the #9ca3af / #aeb8c4 greys at 1.82-2.54:1), A10-052 (the 4.16-4.39 batch on surfaces A10-030 does not name). The three populations are carved out of one 7,010-element scan and do not overlap.

**Confidence.** CONFIRMED · found by pass-5 · recorded 2026-08-10

---

### [C] A10-051 — /faq paints its h3 two pixels larger than every h2 on the page, inverting the heading scale

**What it does to a real person.** The visual hierarchy contradicts the document outline: the deepest heading on the page looks like the most important one, so a visitor skimming the FAQ is drawn to 'Still have questions?' before the category headings that organise it.

**Evidence.** Every visible h1-h6 walked on 134 page x viewport rows (67 pages x 2 viewports): exactly one page inverts. /faq at desktop-1440 and mobile-390: the largest h2 is 16px/700 ('Products', 'Custom & Value-Added Fabrication' — .text-base.font-bold) while the h3 'Still have questions?' paints 18px/700 (.text-lg.font-bold.text-white), +2.00px. Ties are not counted as inversions, so this is the only strict one on the site; the other 132 page x viewport rows are monotonic or tied. 0 pages fail at any other level pair.

Probe: `_harness/audit10-headings.js`. Issue screenshot: `_harness/out/audit10/issues/A10-051__desktop-1440__faq-h3-larger-than-h2.png` (gitignored — the numbers above are the durable evidence).

**Reproduce.** `/faq` at all.

1. Open http://127.0.0.1:8123/faq at 1440x900
2. Compare getComputedStyle on the 'Products' h2 (16px) and the 'Still have questions?' h3 (18px)

**Confidence.** CONFIRMED · found by pass-5 · recorded 2026-08-10

---

### [C] A10-055 — Escape does not close either mega-menu once focus or the pointer has moved into the panel

**What it does to a real person.** A keyboard visitor who opens the Products menu and steps into it cannot dismiss it with Escape. The 560px panel stays over the page and they must tab through all thirteen links to get out of it. Escape works only while focus is still on the trigger itself.

**Why this severity.** A buyer navigating by keyboard opens Products, tabs into it, presses the universal dismiss key and nothing happens; the panel keeps covering the hero until they tab through all 13 links or reach for the mouse. Held at C rather than B because nothing is unreachable — Tab still exits the panel and a click elsewhere closes it — and the lower level is taken per severity.json when torn.

**Evidence.** Three activation paths at 1440, each driven with real keys/pointer. (1) Enter on the trigger, then Escape with focus still on the trigger: aria-expanded 'true' -> 'false', .ipc-dropdown-panel removed, focus stays on the trigger — WORKS. (2) Enter on the trigger, one Tab into the panel (focus on 'Browse All Products'), then Escape: aria-expanded stays 'true', panel still present and 'panelVisible':true, focus unchanged — NO EFFECT. (3) Hover the trigger, move the pointer onto a panel link, then Escape: aria-expanded stays 'true', panel still visible — NO EFFECT. Both triggers ('Products▼', 'Company▼') are rendered on all 57 public page-states in the census.

Probe: `_harness/audit10-p6verify.js`. Issue screenshot: `_harness/out/audit10/issues/A10-055__desktop-1440__mega-menu-still-open-after-escape.png` (gitignored — the numbers above are the durable evidence).

**Reproduce.** `/` at desktop-1440.

1. Open http://127.0.0.1:8123/ at 1440x900 in a fresh context
2. Press Tab four times to reach the 'Products▼' trigger (Tab 1 = skip link, 2 = logo, 3 = Home, 4 = Products)
3. Press Enter — the mega-menu opens and aria-expanded becomes 'true'
4. Press Tab once — focus moves to 'Browse All Products' inside the panel
5. Press Escape — the panel stays open, aria-expanded stays 'true', focus does not move

**Where.** src/App.jsx:741 (Escape is handled only in the trigger button's onKeyDown; the panel at src/App.jsx:781-798 carries onMouseEnter and no key handler). Company menu is the same shape at src/App.jsx:1058 and 1096-1113.

**Confidence.** CONFIRMED · found by pass-6 · recorded 2026-08-10

---

### [C] A10-057 — Two one-shot motions ignore prefers-reduced-motion: the sticky RFQ bar's spring slide and the FAQ panel's collapse

**What it does to a real person.** A visitor who has asked their operating system for reduced motion still gets a 70px bar springing up from the bottom edge — overshooting past its resting place and bouncing back — on every one of the 42 product pages, and an animated accordion on every FAQ answer. For a motion-sensitive visitor those are the two most repeated movements on the site.

**Evidence.** Sticky RFQ bar, /products?productId=CC at 1440, translateY sampled through the entrance: with motion allowed 42.93 -> 3.33 -> -7.14 -> 0 px; under reducedMotion 'reduce' 42.95 -> 3.34 -> -7.48 -> 0 px. The negative value is the spring overshooting past its resting position. The two curves are the same within a third of a pixel, and the computed transition is 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)' in both modes. FAQ panel, /faq: opening height sampled 6 -> 87 -> 151 px with motion allowed and 16 -> 87 -> 151 px under reduce, transitionDuration 0.3s in both. Both measured twice (audit10-p6verify.js then audit10-p6verify3.js for the bar; audit10-p6verify2.js then audit10-p6verify3.js for the panel). plan8-motion is 8/8 green and does not cover either: it asserts zero INFINITE animations, and both of these are one-shot transitions.

Probe: `_harness/audit10-p6verify3.js`. Issue screenshot: `_harness/out/audit10/issues/A10-057__desktop-1440__sticky-rfq-mid-slide-under-reduce.png` (gitignored — the numbers above are the durable evidence).

**Reproduce.** `/products?productId=CC` at all.

1. Launch a context with reducedMotion: 'reduce' at 1440x900
2. Open http://127.0.0.1:8123/products?productId=CC
3. window.scrollTo(0, 900) to cross the sticky-bar threshold
4. Sample getComputedStyle(bar).transform every ~70ms: translateY runs 42.95 -> 3.34 -> -7.48 -> 0 over 0.45s
5. Open http://127.0.0.1:8123/faq in the same context and press Enter on a question: the panel height animates 16 -> 87 -> 151px

**Where.** src/App.jsx:8969-8973 (sticky bar transform + 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)', no reduced-motion guard) and src/App.jsx:3962-3963 (FAQ panel 'transition-all duration-300' + animated maxHeight). usePrefersReducedMotion() exists at src/App.jsx:287 and is consumed by exactly one caller, Hero, at src/App.jsx:1741.

**Not a duplicate of.** Not the plan8-motion set. That suite's subject is infinite animations (the trust marquee, the skeleton shimmer, the submit spinner) and it is still 8/8 green this session. These two are one-shot transitions it does not look at.

**Confidence.** CONFIRMED · found by pass-6 · recorded 2026-08-10

---

### [C] A10-058 — Opening and closing the mobile menu leaves the page 276px below where the visitor was

**What it does to a real person.** A visitor part-way down a product page taps the menu, changes their mind and closes it, and the page has moved down by roughly a screenful. Whatever they were reading is now off the top and they have to scroll back up to find it.

**Evidence.** Driven with a real wheel scroll and a real Enter, with the burger focused via focus({preventScroll:true}) so no harness action can scroll the page. window.scrollY reads 600 immediately before Enter; the drawer's scroll lock parks body at top:-876px, i.e. it captured 876; after Escape the page is restored to 876. Net displacement +276px, which is the drawer's own height — opening it grows the document and Chromium's scroll anchoring compensates before the lock reads scrollY. Four runs, two at mobile-390 and two at tablet-834, all four identical (600 -> 876). plan8-mobile is 16/16 green and stays green because its assertion compares the restored offset against lockedAt, not against the pre-open offset.

Probe: `_harness/audit10-p6verify2.js`. Issue screenshot: `_harness/out/audit10/issues/A10-058__mobile-390__after-closing-the-menu-scrollY-876.png` (gitignored — the numbers above are the durable evidence).

**Reproduce.** `/products?productId=IP33PO` at mobile-390.

1. Open http://127.0.0.1:8123/products?productId=IP33PO at 390x844
2. Scroll down 600px with the mouse wheel (not scrollTo)
3. Focus the 'Open menu' button with focus({preventScroll: true}) so nothing scrolls the page
4. Read window.scrollY — 600. Press Enter to open the drawer
5. Read document.body.style.top — '-876px'. Press Escape
6. Read window.scrollY — 876, i.e. 276px below where the visitor was

**Where.** src/App.jsx:453-532 (the scroll lock reads `const y = window.scrollY` at the top of the effect, which runs after the drawer has already been inserted into the document flow).

**Not a duplicate of.** Does not contradict plan8-mobile's restore assertion, which is about the lock returning the offset it captured and is correct. The displacement happens upstream of the capture. plan8-mobile.js:124-131 attributes the same 600 -> 876 shift to Playwright scrolling the burger into view before clicking it; this measurement reproduces it with no click and no auto-scroll, so a real visitor sees it too.

**Confidence.** CONFIRMED · found by pass-6 · recorded 2026-08-10

---

### [C] A10-059 — At 834 the product title lands behind the sticky navbar after navigating from the catalog sidebar

**What it does to a real person.** A buyer picks the next part from the sidebar and the page settles with the product's name hidden under the navbar — only the small SKU eyebrow below it is visible. They can see specifications for a product whose name they cannot read without scrolling up.

**Evidence.** From /products?productId=CC scrolled to y=900, clicking the second visible sidebar product link and waiting 2.2s: tablet-834 lands at y=1696 with the h1 at top=41 and height=25 while the sticky header's bottom edge is at 65 — 24 of the h1's 25 pixels are covered. mobile-390 lands at y=2050 with the h1 at top=59, height=100 (it wraps to three lines) — 6px covered, so the name is still readable. desktop-1440 lands at y=0 with the h1 at top=388, fully clear. Two runs per viewport, identical. The industry and FAQ deep-link anchors are unaffected: they carry scroll-margin-top of 84px and 120px respectively and land clear of the 65px navbar at all three viewports.

Probe: `_harness/audit10-p6verify2.js`. Issue screenshot: `_harness/out/audit10/issues/A10-059__tablet-834__product-h1-under-the-sticky-navbar.png` (gitignored — the numbers above are the durable evidence).

**Reproduce.** `/products?productId=CC` at tablet-834.

1. Open http://127.0.0.1:8123/products?productId=CC at 834x1112
2. Scroll to y=900
3. Click the second visible product link in the catalog sidebar
4. Wait for the scroll to settle, then read the h1's getBoundingClientRect().top (41) and the header's .bottom (65)

**Not a duplicate of.** Not A10-005 (pass-1), which is the sidebar rail failing to scroll ITSELF to the selected product. This is where the MAIN column lands afterwards, and it is specific to the 834 band — desktop is clear and 390 is nearly clear.

**Confidence.** CONFIRMED · found by pass-6 · recorded 2026-08-10

---

### [C] A10-060 — Four components declare Tailwind hover: utilities that their own inline style overrides, so the hover never paints

**What it does to a real person.** Nothing breaks, but three of these four components end up with no pointer feedback at all — the six /about timeline cards, the two homepage section actions and the /services sidebar link look exactly the same hovered as at rest, while the CTAs beside them all respond. The intent to give them a hover state is in the source; the browser cannot honour it.

**Evidence.** Swept every element carrying a hover: utility on eleven routes and paired each utility with the CSS property it sets: 22 element occurrences where the property is also declared in that element's own inline style attribute, which always wins. Confirmed by measurement, not just by reading: hovering each of the three named components produces an empty computed-style delta. (1) SectionHeader action, className 'transition-colors duration-150 hover:bg-blue-700' with inline 'background: var(--brand-primary)' — 2 elements on / ('View Full Catalog →', 'View All Industries →'), hover delta []. (2) The 6 homepage industry cards, 'hover:border-blue-500 hover:bg-blue-50/30' with inline 'border: 1px solid rgb(229,233,238); background: rgb(255,255,255)' — 12 dead utilities; these still animate because their hover:-translate-y-0.5 and hover:shadow-lg are unaffected. (3) /services sidebar CTA 'Browse All Products', 'hover:text-white hover:border-white/50' with inline color and border — 2 dead utilities, hover delta []. (4) The 6 /about timeline cards, 'transition-colors duration-200 hover:border-blue-400' with inline 'border: 1px solid rgb(229,233,238)' — 6 dead utilities, hover delta []. Cases 1, 3 and 4 are also transition orphans: their transition-colors declaration has nothing left to animate. Only bg/text/border can collide this way — brightness, shadow, translate and opacity are properties these inline objects do not set, and those utilities were measured firing normally.

Probe: `_harness/audit10-p6comp.js`. Issue screenshot: `_harness/out/audit10/issues/A10-060__desktop-1440__about-timeline-card-hovered-identical.png` (gitignored — the numbers above are the durable evidence).

**Instances (5).**

- / :: 'View Full Catalog →' :: hover:bg-blue-700 vs inline background: var(--brand-primary) :: src/App.jsx:2148 + 2155
- / :: 'View All Industries →' :: hover:bg-blue-700 vs inline background: var(--brand-primary) :: src/App.jsx:2148 + 2155 (same SectionHeader component)
- / :: 6 industry cards (Automotive, Aerospace & Defense, Medical Devices, Industrial & OEM, Marine & Outdoor, Electronics & Lab) :: hover:border-blue-500 vs inline border, and hover:bg-blue-50/30 vs inline background :: src/App.jsx:3156
- /services :: 'Browse All Products' :: hover:text-white vs inline color, and hover:border-white/50 vs inline border :: src/App.jsx:11219 + 11224-11225
- /about :: 6 timeline cards (Founded, Expansion, ISO Certified, Value-Added, Remodel, 50 Years) :: hover:border-blue-400 vs inline border :: transition-colors duration-200 left with nothing to animate

**Reproduce.** `/about` at all.

1. Open http://127.0.0.1:8123/about at 1440x900 and scroll a timeline card into view
2. Park the pointer away from it, snapshot getComputedStyle(card) for backgroundColor/borderTopColor/boxShadow/transform
3. Move the pointer to the card's centre, wait out its 200ms transition, snapshot again — the two snapshots are identical
4. Read the element: className contains 'hover:border-blue-400' while the style attribute contains 'border: 1px solid rgb(229, 233, 238)', and the inline declaration wins
5. Repeat on / for 'View Full Catalog →' (hover:bg-blue-700 vs inline background) and on /services for 'Browse All Products' (hover:text-white vs inline color)

**Not a duplicate of.** CLUSTER hover-feedback: A10-060 is hover declared and overridden by an inline style; A10-061 is hover never declared. Different mechanisms, same visible result.

**Confidence.** CONFIRMED · found by pass-6 · recorded 2026-08-10

---

### [C] A10-061 — Whole control families have no hover feedback while comparable families on the same pages do

**What it does to a real person.** A buyer hovering the sortable column headers, the catalog family filters, the approval chips, a FAQ question or a sidebar family heading gets no response beyond the cursor, while every button and card beside them lights up. On the product index in particular, the column headers are the only way to re-order 42 rows and they look inert.

**Evidence.** Component classes swept at three viewports, up to 3 instances each preferring different pages, hover driven by a real pointer move and settled for the element's own transition-duration; a delta that failed to revert when the pointer left was discarded rather than counted. 190 instances per viewport. Pointer-affordant classes with no hover delta on any sampled instance: 23 of 64 measured at desktop-1440, 19 of 61 at tablet-834, 18 of 59 at mobile-390. The named components below were then verified individually, because the census signature collapses every inline-styled control into one bucket ('a' = 2,337 elements) and a class-level verdict on those buckets is not trustworthy. All of them compute cursor:pointer, so the affordance is claimed and only the feedback is missing. Counts are rendered elements / distinct page-states from the committed 6.1 census.

Probe: `_harness/audit10-p6hover.js`. Issue screenshot: `_harness/out/audit10/issues/A10-061__desktop-1440__sort-header-hovered-identical.png` (gitignored — the numbers above are the durable evidence).

**Instances (10).**

- NO hover state :: catalog sidebar family accordion headers (button.flex.items-center.justify-between.px-5.py-2.5.text-left.w-full) :: 440 elements on 44 page-states
- NO hover state :: inline tel: links (a@tel) :: 64 elements on 58 page-states
- NO hover state :: inline mailto: links (a@mailto) :: 61 elements on 58 page-states
- NO hover state :: /dashboard approval filter chips (button.duration-150.rounded.transition-colors) :: 48 elements on 4 page-states
- NO hover state :: /products catalog family filter chips (button.ipc-tap on /products) :: 44 elements on 4 page-states
- NO hover state :: /dashboard sortable column headers (button.ipc-sort-btn) :: 24 elements on 4 page-states — these DO have a designed 3px focus ring, so the same control has a keyboard state and no pointer state
- NO hover state :: /faq question rows (button.flex.items-center.justify-between.px-6.py-5.text-left.w-full) :: 18 elements on 1 page-state
- NO hover state :: admin nav logo / current-section link / Sign Out (a.logo, a.current, button.logout) :: 30 elements on 10 admin pages
- NO hover state :: admin secondary buttons (button.btn.btn-secondary, a.btn.btn-secondary) :: 20 elements
- HAS hover, for contrast :: navbar link on a non-current page (colour 0.6 -> 1.0 white), mega-menu trigger (same), navbar CTA (background #005da3 -> #004c86), hero primary CTA (box-shadow), dark-band CTA (filter brightness 1.1), footer nav link (colour -> #00bef2), homepage industry card (translateY -4px + shadow), product card (translateY -4px), product datasheet CTA (brightness 1.1), sticky RFQ bar links (background alpha 0.10 -> 0.18)

**Reproduce.** `/dashboard` at all.

1. Open http://127.0.0.1:8123/dashboard at 1440x900
2. Park the pointer at (2,2) and snapshot getComputedStyle of the 'Product Name' sort header (button.ipc-sort-btn)
3. Move the pointer onto it, wait 450ms, snapshot again — no property differs
4. Repeat for /products family filter chips, /faq question rows, the /products?productId=CC sidebar family headings, and any footer tel:/mailto: link
5. For contrast, do the same on the navbar CTA or a product card, which both change

**Not a duplicate of.** CLUSTER hover-feedback: A10-060 is hover declared and overridden by an inline style; A10-061 is hover never declared. Different mechanisms, same visible result.

**Confidence.** CONFIRMED · found by pass-6 · recorded 2026-08-10

---


## Appendix — severity D (observations and nits)

D exists so a hyper-meticulous sweep does not inflate C. Nine batched records hold **66
individual instances**; none of them is something a visitor would consciously notice.
A10-044 is **folded into A10-036** (same admin copy-drift phenomenon, recorded once by
pass-3 and once by pass-4) and is not a separate defect.

| ID | Subject | URL anchor | Instances | Found by |
|---|---|---|---|---|
| A10-010 | Batched nits: bordered empty spec cells, and related-product rows that fill 3 of 4 grid columns | `/products?productId=IP25PU` | 7 | pass-1 |
| A10-019 | Batched small-viewport nits: hyphen-broken part numbers, breadcrumb wrap, narrow card title tracks | `/products` | 10 | pass-2 |
| A10-036 | Batched admin copy nits: button-label casing, catalog/catalogue, British spellings, quote drift | `/admin/content.php` | 6 | pass-3 |
| A10-043 | Batched public-site character and terminology drift: apostrophes, British spelling, term casing | `/contact` | 9 | pass-4 |
| A10-044 | Batched admin copy nits not covered by A10-036: tab title, ellipsis style, a JSON-only error path | `/admin/` | 4 | pass-4 |
| A10-052 | Batched: admin text that misses AA by 0.1-0.35, on surfaces A10-030 does not name | `/admin/index.php` | 8 | pass-5 |
| A10-053 | Batched design-token nits: off-scale type sizes, a 1px radius split, and two monospace stacks for one role | `/datasheets` | 10 | pass-5 |
| A10-054 | Batched: the three brand-bearing image assets carry blues that are near but not equal to the palette, and none can repalette | `/` | 6 | pass-5 |
| A10-062 | Focus indication is split three ways — a designed accent ring on 3 classes, a custom border/shadow on admin fields, the browser default everywhere else | `/` | 6 | pass-6 |


#### A10-010 — Batched nits: bordered empty spec cells, and related-product rows that fill 3 of 4 grid columns

Nothing a visitor would consciously notice: a handful of dimension-table cells are drawn with borders and no value where the rest of the site prints an em dash, and half the related-product rows leave the fourth grid column empty. Recorded so a later pass does not rediscover them as new.

**Measurement.** Empty bordered <td> cells (>=400px2, no text, no child element), identical at desktop-1440 and tablet-1024 and across two navigations: IP25PU 10 cells at 67.98x41px, IP53MP 9, IP38FE 6, IP44A2 & IP45A3 6, IP47HV 3 — 34 cells across 5 of 42 products. IP37SH-IP36TH-IP39LH prints '-' in the same situation, so the catalogue uses two conventions. Related-products grid is md:grid-cols-4: of the 24 product pages that render one, 12 supply 4 cards (0px unused) and 12 supply 3, leaving 214.5px of unused track at 1440 and 150.5px at 1024; card heights within a row are equal (spread 0.0px) on all 24.

**Instances (7).**

- /products?productId=IP25PU :: 10 empty bordered td (67.98x41px each), I.D. column
- /products?productId=IP53MP :: 9 empty bordered td, Expanded Diameter column on the three material group rows
- /products?productId=IP38FE :: 6 empty bordered td, the '1.3 to 1 Shrink' and '1.67 to 1 Shrink' group rows
- /products?productId=IP44A2 & IP45A3 :: 6 empty bordered td, the '2:1 Shrink' and '3:1 Shrink' group rows
- /products?productId=IP47HV :: 3 empty bordered td, Recovered Wall > Medium on the 4-1/2", 6" and 7" rows
- /products?productId=IP37SH-IP36TH-IP39LH :: prints '-' in the same position — the other convention
- related 3-of-4 grid, 214.5px unused at 1440: IP13SP, IP35KY, IP37SH-IP36TH-IP39LH, IP38FE, IP42MW, IP44A2 & IP45A3, IP46MD, IP47HV, IP55FL, IP61ES & IP62EF, IP63ES, IP71NS - IP72PS - IP73PP


#### A10-019 — Batched small-viewport nits: hyphen-broken part numbers, breadcrumb wrap, narrow card title tracks

Nothing a visitor would call broken: compound part numbers split after a hyphen across two lines in the catalog cards, the last breadcrumb drops to its own line behind its separator, and a few table cells break a fraction after its hyphen. Recorded so a later pass does not rediscover them as new.

**Measurement.** Compound part numbers break at a hyphen (a legitimate CSS break opportunity — not a mid-token break; wordBreak:normal, overflowWrap:normal throughout): IP64FS-IP65VC-IP66AC-IP67SC paints on 2 lines on 44 page x viewport rows at mobile-390 and IP17TW-IP18SW-IP19LW on 43, in the /products grid, the /dashboard cards and every product page's catalog rail; at tablet-834 IP71NS-IP72PS-IP73PP and IP37SH-IP36TH-IP39LH each do it on 3 pages, in the related-products cards only. Breadcrumb: the final crumb wraps to line 2 (starting at x=24 behind its own '›') on 4 of 5 sampled product pages at mobile-390 and 1 of 5 at tablet-834 (only IP64FS-IP65VC-IP66AC-IP67SC). /dashboard mobile card list at 390: the product-title track is 125.8px inside a 342px card (99.9-156.7px across the list) and 6 titles wrap to 4-6 lines under the shipped face — but only 1 does under Liberation Sans, so the line counts are mostly the DejaVu penalty while the 125.8px track is not. Fraction values break after their hyphen in the narrow Order Size column ('1-1/4"' painting as '1-' / '1/4"').

**Instances (10).**

- /products :: mobile-390 :: 'IP64FS-IP65VC-IP66AC-IP67SC' painted as 'IP64FS-IP65VC-' / 'IP66AC-IP67SC' (44 page x viewport rows)
- /products :: mobile-390 :: 'IP17TW-IP18SW-IP19LW' painted as 'IP17TW-IP18SW-' / 'IP19LW' (43 rows)
- /dashboard :: mobile-390 :: 'IP71NS-IP72PS-IP73PP' on 2 lines
- /products?productId=IP13SP :: tablet-834 :: 'IP71NS-IP72PS-IP73PP' on 2 lines in the related-products card (also IP61ES & IP62EF, IP63ES)
- /products?productId=IP35KY :: tablet-834 :: 'IP37SH-IP36TH-IP39LH' on 2 lines in the related-products card (also IP38FE, IP55FL)
- /products?productId=CC :: mobile-390 :: breadcrumb 2 lines, final crumb at x=24 on line 2 (also IP71NS - IP72PS - IP73PP, IP37SH-IP36TH-IP39LH, IP64FS-IP65VC-IP66AC-IP67SC)
- /products?productId=IP64FS-IP65VC-IP66AC-IP67SC :: tablet-834 :: breadcrumb 2 lines (the only one of five sampled that wraps at this width)
- /dashboard :: mobile-390 :: product-title track 125.8px inside a 342px card; 'Fiberglass Sleeving (Heat Treated / Vinyl Co…' wraps to 6 lines shipped / 5 under Liberation Sans
- /dashboard :: tablet-834 :: 'Mil-I-23053/12' and 'Mil-I-23053/18' each painted on 2 lines in a <td>
- /products?productId=IP17TW-18SW-19LW :: tablet-834 :: Order Size '1-1/4"' painted as '1-' / '1/4"' (same on IP29CG, IP46MD, IP47HV, IP55FL, IP56DR, CC90, CCS, CT)


#### A10-036 — Batched admin copy nits: button-label casing, catalog/catalogue, British spellings, quote drift

Nothing a visitor would notice; a meticulous reader of the admin sees the same kind of control named two ways on one page.

**Measurement.** Five of the sixteen "+ Add …" buttons on content.php are sentence-cased while eleven are Title Case; help.php mixes British and American spellings of the same words within one document; content.php uses "catalogue" once against "catalog" everywhere else in the admin UI; one hint uses straight quotes where its neighbours use curly. Each string verified in source.

**Instances (6).**

- /admin/content.php :: "+ Add Industry section" vs "+ Add Card" / "+ Add Stat" / "+ Add Service" / "+ Add Milestone" / "+ Add Question" / "+ Add Capability" / "+ Add Certification" / "+ Add Section" / "+ Add Page" / "+ Add Tip" / "+ Add Family"
- /admin/content.php :: "+ Add Menu item", "+ Add Footer link", "+ Add Proof point", "+ Add Ticker item" — same sentence-case drift
- /admin/content.php:261 :: "in the order they appear in the catalogue sidebar" — "catalogue" against "catalog" in the h1 "Product Catalog" and throughout help.php
- /admin/help.php :: "colours" (Brand colours & logo), "dialling version" vs "colored pill labels", "What each colored badge means" in the same document
- /admin/content.php :: SEO hint uses straight quotes around "home" where neighbouring hints use curly quotes
- /admin/help.php :: glossary entry "Anything that fills it is recorded but not emailed to you." — missing "in"

**Dedupe.** A10-044 is folded into this record in pass-7 (same admin copy-drift phenomenon); its four instances are reported here.


#### A10-043 — Batched public-site character and terminology drift: apostrophes, British spelling, term casing

Nothing a visitor consciously notices. Recorded so the drift is written down once instead of surfacing again as five separate leads: one page uses a British spelling its own neighbouring sentence does not, the two not-found messages disagree about which apostrophe they use, and one term is rendered five ways across the catalog surfaces.

**Measurement.** Every instance below verified in the rendered page at 1440x900 twice. Site-owned strings only; owner data in data/*.json was excluded from the vocabulary triage (the site-emitted vocabulary is 760 of 3,391 unique prose tokens, all read in full — no genuine misspelling in site-owned copy). The whole 68-page dump contains exactly ONE curly apostrophe (U+2019) against 373 entries carrying a straight one, and exactly 3 three-dot ellipses against 178 U+2026 characters. Zero mojibake sequences, zero U+FFFD, zero repeated words ("the the") across 25,750 entries.

**Instances (9).**

- /contact :: "We use your details only to answer this enquiry. See our" (y=1166) against "General inquiries & questions" (y=361) on the same page — the only British "enquiry" on the site, against 5 "inquir*" renderings elsewhere. src/App.jsx:6592
- /no-such-page :: "That address doesn’t exist on this site." uses U+2019 — the only curly apostrophe anywhere on the site
- /products?productId=NOPE-XYZ-123 :: the sibling message "We couldn't find part “NOPE-XYZ-123”." uses U+0027 in the same feature, one PLAN-9 item apart
- /products?productId=IP29CG :: "Data Sheet" (button) and "data sheet" (body copy) render on one page
- /datasheets :: "Datasheets" (h1) x2, "datasheet" x43, "datasheets" x1 on one page; /dashboard renders "data sheets"
- / :: the same stat rendered "25M+" (hero and trust bar) and "25 million" (closing band), and "Minimum Order" against "minimum order."
- / :: "Same-Day" and "Same Day" both render on the homepage; /about and the meta description use "same-day"
- / and /about :: img alt "The IPC facility at 250 Gibraltar Drive, Bolingbrook, Illinois" against "250 Gibraltar Dr" in the footer, the contact block and the index.html <noscript> copy
- /, /industries :: "specification-grade" against "spec-grade" on 16 other URLs and "Spec-grade" on the product pages

**Where.** src/App.jsx:6592 (enquiry); remaining strings traced to src/App.jsx defaults and data/content.json

**Dedupe.** A10-036 batches ADMIN copy nits (button casing, catalogue, colours/dialling, one straight-quote hint on content.php). Every instance here is on a public route and none repeats one of its instances. The "catalogue" and British-spelling instances found again on /admin/content.php and /admin/help.php are deliberately NOT repeated here.


#### A10-044 — Batched admin copy nits not covered by A10-036: tab title, ellipsis style, a JSON-only error path

Nothing Rick would call a problem. Written down so the remediation plan has the exact strings and does not rediscover them.

**Measurement.** Each string read in the rendered admin page at 1440x900, twice. The signed-out screen's <title> is "IPC Admin — Login" while its own <h1> and its submit button both read "Sign In" / "Sign In →" — the browser tab names the page differently from the page. On /admin/add.php the <label> "Rows JSON" exists in the DOM but is display:none with a 0x0 box (spectable-editor.js replaces the raw textarea with the grid editor), and /admin/edit.php?id=CC renders no JSON label at all — so Rick never SEES the word, which is why this is a D and not a comprehensibility finding: the wording only surfaces on the JavaScript-off fallback path, where admin/add.php:41 and :52 and admin/edit.php:109 and :124 produce "Specifications Table JSON is invalid (" . json_last_error_msg() . "). Fix the syntax or clear the field." /admin/help.php already documents that message ("The Specifications or Size Chart won't save — it mentions invalid data/JSON."), so it is discoverable.

**Instances (4).**

- /admin/ (signed out) :: <title> "IPC Admin — Login" against the page's own h1 "Sign In" and submit button "Sign In →"; every other admin page's title matches its h1
- /admin/add.php :: placeholder "One paragraph per line..." uses three periods where /contact's placeholders and every other ellipsis on the site use U+2026 (178 occurrences against 3)
- /admin/add.php, /admin/edit.php :: the JS-off fallback error "Specifications Table JSON is invalid (Syntax error). Fix the syntax or clear the field." names JSON, syntax and a PHP diagnostic; unreachable while spectable-editor.js runs, so recorded at D per severity.json rule 3
- /admin/index.php, /admin/edit.php?id=CC :: both render <title> "IPC Admin — Products", so the product editor does not name itself in the browser tab

**Where.** admin/index.php (login screen title), admin/add.php:41, admin/edit.php:109, admin/spectable-editor.js

**Dedupe.** A10-036 covers button-label casing, catalog/catalogue, British spellings and quote drift on content.php and help.php; none of the four instances here appears in it. A10-033 counts help-page nav/button mismatches, not page titles. FOLDED INTO A10-036 in pass-7 dedupe: same url-family (/admin), same element class (prose strings), same phenomenon (character and terminology drift), recorded once by pass-3 and once by pass-4. severity.json D asks for related nits batched into ONE finding with an instances[] list. Kept as a record (records are folded, never deleted) and its four instances are reported under A10-036 in _harness/AUDIT10-REPORT.md; do not count it as a separate defect.


#### A10-052 — Batched: admin text that misses AA by 0.1-0.35, on surfaces A10-030 does not name

Nobody perceives a 0.2 shortfall against a threshold, but these are the same red and grey inks as the errors A10-030 already records, re-used on button fills and page sub-lines where nothing has measured them.

**Measurement.** From the same 7,010-element scan (backdrop.js): 5 distinct combinations sitting between 4.16:1 and 4.39:1 against a 4.5:1 floor, plus one exactly at threshold. Confirmed by two identical runs.

**Instances (8).**

- /admin/index.php + /admin/edit.php?id=CC :: a.btn.btn-sm.btn-danger 'Delete' — #dc2626 on #fceeee = 4.28:1 at 12px/600, 166 elements
- /admin/index.php + /admin/edit.php?id=CC :: a.btn.btn-sm.btn-danger 'Delete' on the hover/alt fill #f8ebec = 4.16:1, 2 elements
- /admin/help.php :: span.btn.btn-sm.btn-danger 'Delete' (mock button) — #dc2626 on #fceeee = 4.28:1, 4 elements
- /admin/content.php, settings.php, add.php, backups.php, password.php, inquiries.php, audit-log.php :: p.sub page sub-line — #6b7280 on #f0f4f8 = 4.37:1 at 13px/400, 16 elements
- /admin/index.php + /admin/edit.php?id=CC :: p '42 products across 10 categories' — #6b7280 on #f0f4f8 = 4.37:1, 4 elements
- /admin/backups.php :: em 'every' — #6b7280 on #f0f4f8 = 4.37:1, 2 elements
- /admin/help.php :: div.eyebrow.eyebrow-reference 'REFERENCE' — #b45309 on #f8eee6 = 4.39:1 at 11px/700, 8 elements
- /admin/help.php :: div.eyebrow.eyebrow-manage 'MANAGING PRODUCTS' — #15803d on #e8f6ed = 4.50:1, exactly at the floor, 16 elements (recorded for completeness; it passes)

**Dedupe.** A10-030 records the #dc2626-on-#fef2f2 4.41:1 .error-list treatment and names settings.php, content.php and upload-image.php. The 4.41:1 rows this scan also found on index.php, edit.php, inquiries.php and help.php are that same treatment and are deliberately NOT re-reported. Everything listed here is a different surface (#fceeee/#f8ebec button fills, #f0f4f8 page-header sub-lines, #f8eee6 and #e8f6ed help eyebrows) or a different ink. CLUSTER admin-low-contrast: A10-030 (the #dc2626 error treatment at 4.41:1), A10-050 (the #9ca3af / #aeb8c4 greys at 1.82-2.54:1), A10-052 (the 4.16-4.39 batch on surfaces A10-030 does not name). The three populations are carved out of one 7,010-element scan and do not overlap.


#### A10-053 — Batched design-token nits: off-scale type sizes, a 1px radius split, and two monospace stacks for one role

None of these is visible to a visitor. They are recorded so the type and radius scales can be read as scales — every one is a value used two or three times where a neighbouring value is used hundreds.

**Measurement.** From the 132-page computed-style census: 24 distinct fontSize values, 50 fontSize x fontWeight pairs, 17 borderRadius values, 24 letterSpacing values, 7 fontFamily values. The items below are the values used by 2 elements or fewer, the non-integer sizes, and the same-role stack splits.

**Instances (10).**

- type scale :: 52px used by 2 elements on 1 page (h1.font-extrabold.leading-tight.mb-6, the homepage hero) — the only size above 48px on the site
- type scale :: 25.6px used by 2 elements on 1 page (h2 in div.flex.flex-col.md:flex-row) — a 1.6rem value with no other fractional heading near it
- type scale :: 30px used by 2 elements on 2 pages (div.page-header-icon, admin) and 26px by 2 on 2 (h1 in the admin page-header) — the admin's only two sizes in that band
- type scale :: 10.8333px used by 2 elements on 2 pages (small inside summary>span.who, /admin/inquiries.php) — the smallest text on the site and the only size below 10px-rounded
- type scale :: 12.5px used by 860 elements on 90 pages (span.whitespace-pre-line, code) — heavily used but the only non-integer size in the body range
- monospace stack :: /dashboard, /products cards and the product pages use 'ui-monospace, SFMono-Regular, Menlo, monospace' (469 elements on 95 page-rows) while /datasheets uses 'ui-monospace, Menlo, monospace' (104 elements on 2 page-rows) for the same SKU role — identical on this box, divergent on any machine that has SFMono-Regular but not ui-monospace
- monospace stack :: the admin adds two more for the same job — '"Courier New", monospace' (66 elements, help.php code) and bare 'monospace' (42 elements: td.ip on audit-log.php, code on index/content/settings/edit/backups)
- radius :: admin form controls split 7px vs 8px — input.ci 576 and textarea.ci 198 at 7px (content.php) against input 30 and textarea 12 at 8px elsewhere in the admin
- radius :: 8px 8px 0px 0px on div.pp-sthead x2 and 0px 0px 8px 8px on div.pp-slist x2 are the only two partial-radius values on the site (admin/add.php product preview)
- line-height :: div.stat-val paints 22px/22px = 1.00 on 16 elements and div.font-extrabold.leading-none.mb-1 20px/20px = 1.00 on 4 — the only body-sized text below the 1.2 floor outside the admin buttons of A10-049


#### A10-054 — Batched: the three brand-bearing image assets carry blues that are near but not equal to the palette, and none can repalette

Invisible in isolation. It matters only if Rick repalettes: the logo and the social-share card keep the original navy no matter what he picks, and the logo's blue was never quite the site's blue to begin with.

**Measurement.** Each shipped asset decoded to a canvas at natural size and every painted pixel binned; the SVG values also read from the file text. public/logo.svg (223x226, painted by the navbar, the footer and the product-page figure via site.theme.logoUrl): dominant #025b9e at 41.2% of pixels, sRGB distance 5.74 from --brand-primary #005da3; secondary #1a2e5c at 16.3%, distance 16.43 from --brand-dark #0d2d52; six further navies (#1b2e5c, #19305f, #173364, #163769, #163668) between 17.2 and 26.7 from --brand-dark. The file contains no var() — 'contains var(): false' — so nothing in it can follow the palette; public/favicon.svg is byte-identical to it and admin/logo.svg is byte-identical to both (cmp). public/images/og-card.jpg (1200x630, the og:image at index.html:36): dominant #0a2649 at 88.2% of pixels, 93.45% of all pixels within 24 of --brand-dark, but #0a2649 is 8.2 from --brand-dark #0d2d52 and 10.8 from the footer's #0a2240 — it matches neither exactly. The photographic assets are clear: featured-category-2, id-markers and conduit-drawing have zero pixels within 24 of any brand variable, and IPC-Building/staff/featured-category-1/-3 have 0.42% or less. public/images/site/header-logo.jpg carries a third blue (#015ca3 at 23.9%, distance 1.41 from --brand-primary) but is referenced from no source file and paints nowhere — recorded as an unused asset, not as drift.

**Instances (6).**

- public/logo.svg :: #025b9e x4 fill occurrences, 41.2% of pixels, d=5.74 from --brand-primary #005da3
- public/logo.svg :: #1a2e5c x2, 16.3% of pixels, d=16.43 from --brand-dark #0d2d52
- public/favicon.svg :: byte-identical to public/logo.svg (cmp), same eight literals
- admin/logo.svg :: byte-identical to public/logo.svg (cmp); absent from the mirror because sync.sh copies only *.php/*.js into _harness/site/admin, which is the mirror-only broken-image artifact pass-0 recorded
- public/images/og-card.jpg :: #0a2649 at 88.2% of pixels, d=8.2 from --brand-dark and d=10.8 from the footer's #0a2240
- public/images/site/header-logo.jpg :: #015ca3 at 23.9%, d=1.41 from --brand-primary — asset is unreferenced, paints nowhere

**Dedupe.** CLUSTER repalette-literals: A10-045 (translucent accent tints with no --brand-accent-rgb), A10-046 (hardcoded gradient stops and navy surfaces), A10-054 (the image assets, which cannot follow a palette at all). One drill, three element sets, three different remedies.


#### A10-062 — Focus indication is split three ways — a designed accent ring on 3 classes, a custom border/shadow on admin fields, the browser default everywhere else

Nothing. Every indicator is visible and every one clears the 3:1 floor by a wide margin, so no keyboard visitor loses their place. It is recorded because the site has a designed focus ring and uses it on three classes out of eighty-two, so the ring reads as a one-off rather than as the site's focus style.

**Measurement.** 2,297 tab stops at desktop-1440 across 25 page-states, 770 at tablet-834 and 736 at mobile-390, every one driven by a real Tab press: all 3,803 matched :focus-visible, and 0 had no computed-style change on focus. Treatment split at desktop-1440: 19 classes get a designed indicator, 63 fall through to Chromium's outline:auto. The designed ones are .ipc-skip, .ipc-social-link and .ipc-sort-btn (3px solid #00bef2, offset 2px) plus the admin form fields, which use a border+box-shadow change instead of an outline. Rings were then measured as PIXELS rather than computed values, because outline:auto is painted by the UA as a two-tone dark+light stroke that its computed colour rgb(16,16,16) does not describe: 19 subjects on light and dark grounds, before/after clips diffed on a canvas, changed-pixel counts 579-8,463 and best contrast against the pixel's own ground ranging 4.75:1 (contact text input, the JS onFocus border) to 19.03:1 (FAQ row, submit button), with the navy navbar at 13.87:1 and the designed rings at 6.37:1 (sort header) and 7.33:1 (social link). Nothing measured below 3:1. Measured twice with identical values.

**Instances (6).**

- designed 3px solid #00bef2 :: .ipc-skip (57 elements, 57 page-states) :: src/index.css:173-180
- designed 3px solid #00bef2 :: .ipc-social-link (285 elements, 57 page-states) :: src/index.css:233-236
- designed 3px solid #00bef2, offset -3px :: .ipc-sort-btn (24 elements, 4 page-states) :: src/index.css:208-211
- designed border+box-shadow, no outline :: admin input.ci / textarea.ci / select.ci (288 + 83 + 31 elements on admin/content.php)
- designed border+box-shadow via JS onFocus/onBlur, not a pseudo-class :: the /datasheets filter input and 8 other search inputs (src/App.jsx:2954-2966) — fires on mouse click as well as on Tab, unlike every :focus-visible rule on the site
- browser default outline:auto :: the remaining 63 classes at desktop-1440, including every navbar link, every CTA, every product card, the FAQ rows and the mega-menu triggers


---

## Coverage

Stated honestly: what was swept, what was sampled, and what was not looked at.

### Pages × viewports

| | desktop-1440 | tablet-1024 | tablet-834 | mobile-390 |
|---|---|---|---|---|
| 10 public routes | ✅ | ✅ | ✅ | ✅ |
| 42 product detail pages (`?productId=`) | ✅ | ✅ | ✅ | ✅ |
| 3 `/dashboard?family=` views | ✅ | ✅ | ✅ | ✅ |
| 2 error states (soft-404, unknown segment) | ✅ | ✅ | ✅ | ✅ |
| 11 admin GET pages + the signed-out login | ✅ | ✅ | ✅ | ✅ |

**264 of 264 captures** in pass-0 (66 pages × 4 viewports), 0 crawl errors, 0 console
or page errors. Every screenshot the pass files assigned was reviewed — 110 shots by 13
parallel reviewers in pass-1, 110 by 12 in pass-2, and 162 images in pass-3 (48 full-page
admin captures plus 114 sliced segments of the two very tall pages) by 11 reviewers.
Nothing was sampled at the page level: where a pass file said "every", every page was
walked.

### Dimensions

| Dimension | Coverage | Numbers |
|---|---|---|
| Visual layout, large viewports (pass-1) | all pages | painted-box sweep + Liberation Sans font control |
| Visual layout, small viewports (pass-2) | all pages | 55 URLs × 2 viewports, plus drawer-open and FAQ-open states |
| Touch targets (pass-2) | all interactive elements | 1 element below 24×24 (A10-013); 1,289 between 24 and 44px, above the AA floor, not reported |
| Admin (pass-3) | 12 screens × 4 viewports + 4 owner journeys | journeys A–D all **passed on behaviour**; every defect found in them was presentation |
| Copy — every rendered character (pass-4) | 68 pages | 25,750 text entries dumped and committed; 3,391 unique prose tokens triaged, 760 site-emitted read in full |
| Colour and design tokens (pass-5) | 132 page × viewport rows | 15,088 bordered elements, 37 border colours, 24 font sizes, 17 radii; repalette drill run twice |
| Admin contrast (pass-5) | 12 screens × 2 viewports | 7,010 text-painting elements scored, 348 failing in 34 combinations |
| Interaction, keyboard, motion (pass-6) | 68 pages | 6,974 elements censused, 89 signatures; **3,803 tab stops driven by real Tab presses**; 190 hover instances per viewport |
| Heading scale (pass-5) | 134 page × viewport rows | exactly 1 strict inversion site-wide (A10-051) |

### Candidates — all resolved, none dropped

`plans/audit10/state/candidates.json` holds **49** automated candidates triaged by
pass-0 from 46 flagged crawler rows. **49 of 49 are resolved. Zero unresolved.**

| Outcome | Count | Detail |
|---|---:|---|
| → refuted | 47 | 45 `brokenImgs`/`failedRequest` on `admin/logo.svg` (mirror artifact), 2 homepage `invisibleImgs` |
| → finding | 2 | the two mobile-390 admin `overflowX` rows → A10-035 (audit-log, 206px) and A10-022 (help, 299px) |

Pass-6 recorded a true negative worth keeping: **no candidate was ever assigned to
pass-6** — all 49 rows belong to pass-2 or pass-3 — so its candidate-resolution step was
a no-op rather than a skip.

### What was NOT swept — stated plainly

- **`/dashboard?family=Heat%20Shrink%20Tubing`** is listed in `routes.json` but no
  product carries that `partType` and the site emits no such href. It was captured, and
  it is a 0-result view by construction. Recorded as a plan-file observation; the plan
  file was **not** edited (guardrails: the plan is the contract).
- **The product-edit form was mis-addressed in the plan file.** `routes.json` lists
  `/admin/edit.php?id=CC`, but `admin/edit.php:5` reads `$_GET['sku']`, so pass-0/1/2's
  `admin_edit.php_id_CC.png` captures are screenshots of the **catalog**, not the edit
  form. Pass-3 captured the real page (`?sku=CC`) at all four viewports and reviewed it,
  so the form *is* covered — but only from pass-3 onward.
- **Destructive admin paths were not exercised**: `delete.php`, `upload-image.php`,
  `upload-pdf.php` were reviewed as code and through their refusal paths (journey D),
  not driven to a successful destructive completion.
- **Only one mutating journey ran in pass-7** (A10-027's content save), and the mirror
  was restored from pristine byte-identical afterwards.
- **`_localsite/` was not touched** — it is a reference copy of an older deploy.
- **No `src/`, `admin/`, `public/`, `data/`, `pdfs/`, `uploads/` file was modified by any
  pass.** `git diff --stat` against `main` for those trees is empty.

---

## [UNVERIFIED]

Everything below is **neither passing nor failing** in this audit. `php -S` ignores
`.htaccess` and `.user.ini` entirely, so the rules in them were never executed. Apache
on Network Solutions is the real gate.

| What | Why it could not be tested | What would confirm it |
|---|---|---|
| `admin/` and `data/` direct-file blocking rules | `.htaccess` not read by `php -S` | request the paths against the deployed Apache |
| `SetEnvIf` cache headers on `data/` (~60 s) | same | `curl -I` the deployed `data/*.json` |
| Dotfile block | same | request `/.git/config` on the deployed host |
| `ALLOW-PASSWORD-RESET` block | same | request the sentinel file on the deployed host |
| Every `.user.ini` limit (`max_input_vars`, upload sizes, memory) | `php -S` uses `_harness/php-*.ini`, not `.user.ini` | `phpinfo()` on the deployed host |
| Apache's real rewrite (deep links, `/sitemap.xml` → `sitemap.php`) | emulated by `_harness/router.php` locally | load a deep link and `/sitemap.xml` on the deployed host |
| `mail()` delivery from `contact.php` | `sendmail_path` points at `_harness/fakemail.sh` | send a real RFQ on the deployed host |
| `plan3-autoreply` on Windows | POSIX sendmail script | run on a POSIX box (it is verified here on Linux) |
| The four `photoUrl` case corrections | **owner action on the deployed server**, already logged | check the live product pages |
| `admin/logo.svg` in the mirror | `_harness/sync.sh` copies only `admin/*.php` and `*.js`; the file *is* tracked and *is* deployed by `README.md:112` | already resolved — see Refuted |
| Mirror admin health banner about `uploads/` | the mirror has no `uploads/` directory | not a site defect; a mirror artifact |

**Security posture** (`require_auth()` before output, `csrf_check()` on every mutating
POST, upload validation by extension **and** sniffed MIME, `basename()` + `realpath()`
containment, `h()` on every dynamic echo, optimistic-concurrency signatures) was
**re-verified behaviourally where `php -S` can reach it** — the signed-out deep-URL
check, the two-tab conflict banner (journey C) and the upload refusal (journey D) all
behaved as documented — and **not re-derived from source**, per the guardrails. The
`.htaccess`-dependent half of that posture is `[UNVERIFIED]` for the reasons above.

---

## Refuted

Refutations are as valuable as findings. Each one below has a measurement, so the next
session does not re-chase it.

### 1. A10-056 — "Browser Back does not restore scroll position on `/products`" — **REFUTED**

Recorded as **severity B** by pass-6. **It is not a defect.** Back restores the catalog
to exactly the offset the visitor left it at.

| Arm | What it does | desktop-1440 | tablet-834 | mobile-390 |
|---|---|---|---|---|
| arm1 — real mouse click, pass-6's waits | what a visitor does | 1200 → **1200** | 1200 → **1200** | 1200 → **1200** |
| arm2 — real mouse click, long waits | rules out a short settle | 1200 → **1200** | 1200 → **1200** | 1200 → **1200** |
| arm3 — selector click (pass-6's shape) | control | *n/a* | 1200 → **0** | 1200 → **61** |

**Mechanism.** `page.click(selector)` performs an actionability scroll *before*
dispatching the click. The `/products` history entry is therefore committed at the
scrolled-to offset, not at y=1200, and Back then restores that offset **faithfully**.
The control arm reproduces pass-6's published numbers exactly — **0** at tablet-834 and
**61** at mobile-390, the two figures in the original record — but only when the harness
scroll is re-introduced. In the visitor-shaped arms `scrollAtNavigation === 1200` and
nothing moves.

Visitor-shaped arms restored: **6 of 6**. Probe: `_harness/audit10-p7back.js`
(three attempts, per the stop condition). The record is retained at D/LIKELY with a
`severity_rationale` stating the refutation; it must not be counted as a defect.

### 2. Forty-five `brokenImgs` candidates on `admin/logo.svg` — **mirror artifact**

`admin/logo.svg` **is** tracked in the repo and **is** deployed (`README.md:112` ships
the whole `admin/` folder). `_harness/sync.sh` copies only `admin/*.php` and
`admin/*.js`, so the mirror lacked the file and `router.php` answered the request with
the SPA shell — 200 `text/html`, which decodes to `naturalWidth 0`. Copying the tracked
file into the mirror and re-crawling all 44 admin captures dropped `brokenImgs` to **0**
on every page at every viewport (`GET /admin/logo.svg` → 200 `image/svg+xml`).
`sync.sh` was **not** edited — pre-AUDIT-10 harness files are read-only.

### 3. Two homepage `invisibleImgs` candidates at 834 and 390 — **refuted**, and `uploads/` likewise

Both resolved by pass-3 as environment artifacts, not site defects. The mirror has no
`uploads/` directory at all, which is also what drives the admin health banner in every
mirror screenshot.

### 4. The C49 / DejaVu font class — four leads refuted, two survived

`fc-match system-ui` → **DejaVu Sans** on this box, so every width and overflow claim was
re-measured with the document forced to **Liberation Sans** (metric-compatible with
Arial) before it became a finding.

**Refuted as font artifacts:**

- `/contact` placeholders `partNumber` (7.4px cut), `material` (15.5px), `requiredDate`
  (17.3px) and `/datasheets`'s `ds-filter` (9.2px) — all **0px** under Liberation Sans.
- `tablet-1024` footer link wrapping — 2 links wrap under DejaVu, **0** under Liberation.
- `/dashboard` mobile card titles — 6 titles wrap to 4–6 lines under DejaVu, **1** under
  Liberation. Only the 125.8px track itself is structural, and that is what A10-019
  records.
- **`plan8-polish` 16/17** — the failing check is exactly "no spec table scrolls
  horizontally at 1440", and the 1440 overflow is **0px on all 42 pages** under
  Liberation Sans. It is the font, not the site.

**Survived the font control and are therefore findings:** A10-001, A10-002, A10-009,
A10-011, A10-015, A10-016, A10-018 — each carries both numbers in its record.

### 5. Six probe defects, each of which had already produced a plausible false finding

Pass-6 recorded these. They are the most re-chaseable things in the audit.

| Probe defect | The false finding it produced | The real number |
|---|---|---|
| `cssPath()` is not unique — two `<a>` in identical table rows collide | "314 unreachable controls" | **0** (identity stamped per element) |
| A flat 500-Tab cap truncated `admin/content.php` (797 real stops) | "297 unreachable fields" | **0** (budget derived from the page's focusable count) |
| `blur()` does not reset Chromium's sequential-focus start | "the admin password field is unreachable" | reachable (plan8-keyboard reset + explicit documentElement focus) |
| A non-zero `getBoundingClientRect()` taken as proof of tabbability — content inside a collapsed `<details>` keeps its geometry | "16 unreachable links in `inquiries.php` / `help.php`" | correctly untabbable (gated on `checkVisibility()` + closed-`details`) |
| Live rects used as an ordering key inside an inner scroller / under a sticky container | "6 same-column tab-order inversions" | **1**, and it is a 1px sidebar/footer coincidence |
| Not every `[aria-expanded]` button is an accordion — the hamburger carries one, and clicking it collapses `documentElement.scrollHeight` | a corrupted first FAQ measurement | both probes now filter on `aria-label` |

A seventh belongs to **this** pass and is recorded in the same spirit: pass-7's first
A10-028 check used `document.body.innerText`, which does not include inline **SVG**
text, and returned "does not reproduce" for a finding that is real. The corrected check
reads the `<svg><text>` nodes directly. A second: the first A10-027 attempt clicked the
first `button[type=submit]` on the page rather than **Save Content**, so no save
occurred and the check reported a false negative.

### 6. Screenshot artifacts mistaken for defects

Three reviewers reported "the sticky Save bar covers a field" on `admin/content.php`
from full-page captures. Playwright paints a sticky element once, at an arbitrary
position, in a full-page capture — **that part was an artifact**. The overlap that *is*
recorded (A10-026) was measured live at eight real scroll positions per viewport with
`elementFromPoint`, and focusing a field scrolls it clear (measured overlap **0px**), so
it costs reading, not typing.

### 7. Negative sweep results — swept, found nothing

- **0** unreachable interactive elements on every public route at every viewport.
- **0** keyboard traps. Escape, Tab and Shift+Tab all behave in the mobile drawer on
  **20 of 20** route × viewport runs; focus enters, is contained, and returns to the
  burger on Escape.
- **0** tab stops without a focus indicator: all **3,803** matched `:focus-visible` and
  all **3,803** produced a computed-style change. Ring pixels measured on 19 subjects:
  best contrast **4.75:1 to 19.03:1**, nothing below 3:1.
- The `/contact` honeypot is genuinely unreachable — off-screen at x=-9999 inside an
  `aria-hidden` wrapper with `tabindex=-1`; **60** Tab presses never reach it.
- The documented "focus moves to the alert" behaviour is **real**: five successful RFQ
  submissions then a sixth trips `contact.php`'s 5-per-10-minutes limit, producing
  `role=alert` with `tabindex=-1`, and `document.activeElement` **is** that panel.
- Deep-link anchors are correct: `/industries` cards carry `scroll-margin-top: 84px` and
  `/faq` categories 120px, and all land clear of the 65px sticky navbar at all three
  viewports.
- **0** infinite animations under `reduce` on any route; only the trust marquee at
  default; nothing still running at t+10s on an idle page.
- Copy: **0** mojibake sequences, **0** `U+FFFD`, **0** repeated words across 25,750
  entries, and **no genuine misspelling** in site-owned copy (760 site-emitted tokens
  read in full).
- Admin form labelling: only **4** controls lack a label association across all 11 admin
  pages at all 4 viewports (A10-032); **0** `<label for>` anywhere points at a missing
  id.
- The 22 dead hover utilities in A10-060 are the **only** declared-but-dead hover
  styling on the site — brightness, shadow, translate and opacity utilities were all
  measured firing normally.
- All four pass-3 owner journeys **passed on behaviour**. Nothing in any journey lost or
  silently altered typed work.

### 8. Not re-litigated

Everything in `guardrails.json` `known_issues` — the settled decisions, the deliberate
deferrals, and the items already logged open in `WHATS_LEFT.md` §2 — was cross-checked
against the finding set one final time in pass-7. **No finding re-reports one of them.**
The adjacent cases each carry a `dedupe_note` saying why they are different: A10-006 and
A10-016 vs the C49 red; A10-030 and A10-050 vs `brandtext` / `plan8-contrast` (those are
public surfaces; no admin contrast measurement existed before); A10-057 vs
`plan8-motion` (that suite's subject is *infinite* animations, these are one-shot
transitions); A10-058 vs `plan8-mobile`'s restore assertion (which compares the restored
offset against `lockedAt`, and is correct).

---

## Regression state

Measured **this session**, on this branch, after `npm run build && sh _harness/sync.sh`,
against `plans/audit10/baseline.json` and the §5 table of the house audit prompt.

### Environment

```
fc-match system-ui   DejaVu Sans          (C49 caveat applies — see Refuted §4)
build                0 errors             366.93 kB JS · 23.12 kB CSS
mirror bundle        index-D1nsjcWW.js == dist bundle
server               php -S 127.0.0.1:8123 -t _harness/site -c _harness/php-mail.ini _harness/router.php
```

### `lint.php` — green, identical to baseline

```
php -l                    19 files, 0 failing
node --check              9 admin JS files, 0 failing
JSON parse                content 17 / site-info 10 / products-all 42 entries
copy-key drift            copydrift OK — 110 matched, 0 JS-only
family drift              11 families, PHP and JS identical
approval drift            12 approvals, PHP and JS identical
photo-default drift       5 slot defaults, PHP and JS identical
family literals           none in add.php or edit.php
```

### Suites re-run in pass-7 — 23 suites, all at their baseline scores

```
invariants               17/17 ✅      invariants-selftest      15/15 ✅
copydrift-selftest         5/5 ✅      copyroundtrip            15/15 ✅
contrastparity           28/28 ✅      skuparity                33/33 ✅
deadlinks          0 of 18 dead ✅      backdrop-selftest          9/9 ✅
plan2-formlast             8/8 ✅      plan2-contrast           42/42 ✅
plan3-contact            51/51 ✅      plan4-admin              19/19 ✅
plan4-public             27/27 ✅      plan5-spectable          13/13 ✅
plan5-images             12/12 ✅      plan7-imagery            11/11 ✅
plan8-mobile             16/16 ✅      plan8-motion               8/8 ✅
plan8-keyboard             8/8 ✅      plan8-crumbs             22/22 ✅
plan8-catalog            16/16 ✅      plan8-meta               15/15 ✅
plan8-chrome             16/16 ✅
```

**Zero deltas.** Every suite matches `baseline.json` exactly. The suite selection covers
`invariants` plus every suite a finding touches — the interaction suites for
A10-055…A10-062, `plan5-spectable` for A10-004/006/016, `plan3-contact` for
A10-012/018, `plan4-admin` for the admin findings, `plan8-meta` for A10-038's truncated
meta description, `plan8-catalog` and `plan8-crumbs` for the catalog findings,
`plan2-formlast` for invariant 6, and `plan7-imagery` / `plan5-images` for A10-054.

Pass-0 measured the full **50-suite** baseline at the start of the audit: 48 clean and
the 2 expected reds below. Pass-6 independently re-ran the 10 interaction-relevant
suites and found them all green. Nothing in the audit changed a suite score, which is
what you would expect from an audit that fixed nothing.

### The three expected regression exceptions — all exactly as documented

These are **not findings** and must not be reported as new.

| Suite | Measured this session | Expected | Verdict |
|---|---|---|---|
| **`plan8-contrast`** | **34/35** | 34/35 — one named exemption, `EXEMPT_BRAND_SURFACE`, for a computed brand ink on a computed brand surface. A counter, not a blanket rule, so a second failure cannot hide behind it. | ✅ as documented — this **is** its passing state |
| **`plan8-polish`** | **16/17** | 16/17 on Linux. The one failing check is exactly "no spec table scrolls horizontally at 1440". Measured: the same 14px string is 179.9px in DejaVu vs 148.9px in Segoe UI (~21 % wider); forcing Arial metrics brings all four tables back inside their column with `src/` untouched. | ✅ as documented — **the font, not the site** |
| **`brandtext`** | **34/45 → 11 FAILING** | Judge by the **FAILING count (11)**, not the ratio — the scored-combination count wobbles by one between runs of identical code because the hero animates and a small ink extent is position-sensitive. Ratchet: must not exceed **13 failing**. | ✅ 11 ≤ 13 — the logged-open `brand-text-on-brand-surface` item |

### Mirror hygiene at the end of pass-7

```
cmp _harness/pristine/products-all.json  _harness/site/data/products-all.json   IDENTICAL
cmp _harness/pristine/site-info.json     _harness/site/data/site-info.json      IDENTICAL
cmp _harness/pristine/content.json       _harness/site/data/content.json        IDENTICAL
_harness/site/admin/config.local.php                                            DELETED
_harness/site/data/*.backup.*.json (written by the A10-027 journey)             REMOVED
_harness/site/admin/admin-log.jsonl (written by the A10-027 journey)            REMOVED
```

One mutating journey ran in this pass — the A10-027 content save — and the mirror was
restored to pristine byte-for-byte afterwards.

---

## Reading order for a remediation plan

If a PLAN-10 is written from this report, the clusters below are one fix each; the
`dedupe_note` on every member names its siblings.

| Cluster | Members | One sentence |
|---|---|---|
| `dashboard-fixed-columns` | A10-001, A10-002, A10-015 | `DASHBOARD_COLS` fixes every track but Description under `tableLayout:'fixed'` — three viewports, three outcomes |
| `repalette-literals` | A10-045, A10-046, A10-054 | colour literals that cannot follow the owner's palette |
| `product-detail-stretch-voids` | A10-003, A10-004 | `align-items:stretch` padding a short cell out to a tall sibling |
| `spec-table-scroller` | A10-006, A10-016 | the `md`/`lg` breakpoint mismatch between the spec grid and the rail |
| `admin-390-page-overflow` | A10-022, A10-023, A10-035 | admin tables carrying overflow on the page instead of in a scroller |
| `placeholder-wider-than-field` | A10-009, A10-018 | placeholder strings wider than the control that holds them |
| `admin-low-contrast` | A10-030, A10-050, A10-052 | three non-overlapping populations from one 7,010-element scan |
| `hover-feedback` | A10-060, A10-061 | hover declared-and-dead, and hover never declared |

**Highest value per unit of work**, on the evidence: A10-011 (one flex rule, 42 pages,
the only A), then the `dashboard-fixed-columns` cluster (one column definition, three
findings), then A10-012 (one `scroll-margin-top` on the RFQ fields, the lead-capture
path), then A10-027 (one hardcoded string in the audit log).

---

*AUDIT-10, seven passes, 2026-08-09 → 2026-08-10. Findings only — nothing was fixed.*
