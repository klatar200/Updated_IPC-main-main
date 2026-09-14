# P5b — verbiage: admin pages, help.php, the two emails          agent: B2   started/finished: 2026-09-14 15:25 / 2026-09-14 17:44 UTC (paused ~15:45-17:36 by an API rate limit; resumed on C's instruction with the pass's artifacts intact and reused, not regenerated)   mirror: :8142
findings:   Blocker 0 · High 0 · Medium 5 · Low 6
| ID | sev | class | where | one line |
| A-9.B2-01 | Medium | doc | `admin/help.php:322,333` | The dashboard tour describes a header bar with four quick links; the real bar has nine section links plus View Live Site and Sign Out. |
| A-9.B2-02 | Medium | doc | `admin/help.php:802,805-817` | "The dropdown lists every action in the table below" — the dropdown lists 14 actions, the table explains 11; the three missing ones are the sign-in events. |
| A-9.B2-03 | Medium | doc | `admin/help.php:833,836-839` | "Three things can go wrong on the server" — the section lists four and the dashboard can raise eight, including the dropped-leads one. |
| A-9.B2-04 | Medium | code | `admin/upload-image.php:250`, `admin/upload-pdf.php:201` | Both upload screens hard-code a maximum file size; the Help page computes the real one, so the two screens disagree whenever the host's limit is lower. |
| A-9.B2-05 | Medium | code | `admin/content.php:341-345,980` | All five Site Images labels on Page Content print their own HTML as literal text. |
| A-9.B2-06 | Low | doc | `admin/help.php` ×8 | Rule 8 batch — eight instructions naming a control, label or location the admin does not have. |
| A-9.B2-07 | Low | code | `admin/*.php` ×12 | Rule 7 batch — developer vocabulary in flash text, including three messages naming a file (`products.json`) that does not exist. |
| A-9.B2-08 | Low | code | `admin/*.php` ×17 | Rule 2 batch — the admin has four names for itself, two spellings of colour, and six wordings of "could not save". |
| A-9.B2-09 | Low | code | `admin/*.php` ×13 | Rule 3 batch — curly/straight quotes and `…`/`...` mixed across the surface and within `upload-pdf.php`. |
| A-9.B2-10 | Low | code | `admin/*.php` ×17 | Rule 4 batch — Title-Case buttons and headings with a sentence-case minority, five of them inside one `+ Add …` family on one page. |
| A-9.B2-11 | Low | code | `admin/inquiries.php:184` | Four recorded inquiries render an unnamed link pointing at a bare `mailto:`. |
ledger:     done E068, E071, E087, E088, E092, E152, E153, E154   blocked none
suites cited: plan10-help 29/29, plan10-adminnav 25/25, plan10-helpwidth 21/21, plan10-header 8/8, plan10-auditlog 13/13, plan3-contact 51/51, plan3-autoreply 22/22 (`_harness/out/audit9/sweep-before.txt` lines 30, 25, 31, 29, 27, 41, 40 respectively)
instruments: none new (brief names none for P5b). Ad-hoc probes under `_harness/out/audit9/P5b/*.js`, BASE_URL/port-driven, launched through `_harness/browser.js`.
artifacts:  `_harness/out/audit9/P5b/admin-ui.json` — every h1/h2/card-title/button/nav-link/label/th/placeholder/data-confirm/aria-label/img-alt on all 13 admin pages at 1440
            `_harness/out/audit9/P5b/admin-rendered-text.json` + `text-<page>.txt` — rendered `innerText` per admin page, `<details>` forced open
            `_harness/out/audit9/P5b/cspell-raw.txt` — 18 unknown words; `cspell-stderr.txt` empty
            `_harness/out/audit9/P5b/vocab-counts.txt` — rule-2 variant counts per file over the 1,498 admin+email inventory records
            `_harness/out/audit9/P5b/mech-hits.txt` — rule-5 mechanical hit list (7 checks)
            `_harness/out/audit9/P5b/help-uirefs-all.txt` / `help-uirefs-unmatched.txt` — 163 bold/code UI references in help.php, 101 unmatched before triage
            `_harness/out/audit9/P5b/help-imperatives.txt` — 93 imperative sentences extracted for rule 8
            `_harness/out/audit9/P5b/rows-admin-email.jsonl` / `text-admin-email.txt` — the two surfaces' inventory slice
            screenshots: `rule8-real-nav-1440.png`, `rule8-help-dashboard-section.png`, `rule8-help-auditlog-badges.png`, `rule8-auditlog-dropdown.png`, `rule8-health-banner.png`, `rule8-help-health-table.png`, `rule8-uploadlabel-image.png`, `rule8-uploadlabel-pdf.png`, `rule8-help-server-limits.png`, `rule8-real-upload-image.png`, `rule8-help-photos-steps.png`, `rule8-preview-position-1440.png`, `rule8-help-specs-preview-claim.png`, `rule8-help-business-quality-page.png`, `rule8-paste-excel-modal.png`, `rule8-sizechart-after-split.png`, `rule9-content-label-raw-html.png`, `rule9-content-siteimages-section.png`
            `_harness/out/audit9/P5b/php-small-upload.ini` — the 2M/8M ini used for A-9.B2-04 only; `:8142` restored to `_harness/php-mail.ini` afterwards
out of brief: `admin/index.php:141` — the "Three things fail SILENTLY" code comment that A-9.B2-03's Help text tracks is itself stale (the block now builds eight entries); comments are out of P5's scope, routed to C.
            `data/content.json` + `src/App.jsx` — "Same Day"/"Same-Day"/"same day"/"same-day" all appear; P5a's surface, not audited here.
            `plans/GUARDRAILS.md:4.4` says the content form posts 439 variables; measured 448 named fields on `/admin/content.php` (help.php's "about 450" is the accurate one). Plans files are out of P5's scope.
environment artifacts consumed: `_harness/router.php:28` resolves static-file existence against the sweep mirror `_harness/site` rather than the private docroot (C, class `harness`, `A-9.P3-1`, `_harness/out/audit9/C/router-docroot.md`) — not re-reported. Checked against every P5b record: no finding here rests on a file being present or absent over HTTP. PHP pages execute from the private docroot (proved on `:8142`, see A-9.B2-03's note), and the only file this pass created (`admin/.inquiry-log-failed.json`) is read by PHP through `__DIR__`, not fetched. · Sweep mirror untouched: `diff -q _harness/site/admin/index.php _harness/out/audit9/site-B2/admin/index.php` → identical after the probe was reverted.
[UNVERIFIED]/[UNSOURCED]: A-9.B2-04's consequence depends on the production host's `upload_max_filesize`, which is [UNSOURCED] — STEP 0 records the site as NOT LIVE, so no live value exists. The divergence itself is measured. · Rule 6 (truth): P4's register did not exist while these surfaces were read (`audit-runs/audit9/P4-data-truth.md` landed 15:46, `_harness/out/audit9/P4/claims-register.md` 15:40). It was cross-referenced afterwards at 17:50 — result under "Checked, no finding". Nothing here duplicates a P4 record; anything P4 marks false stays P4's.
self-corrections: The started/finished stamps in this header were first written from my own estimate and were wrong by ~1h40; they are now taken from the container clock and the artifacts' mtimes, and the rate-limit pause is stated. The rule-6 line was also first written as "P4's register does not exist"; P4 landed at 15:46 during the pause and has now been cross-referenced — both lines are corrected above rather than left standing. Two candidates withdrawn after measurement, both recorded in §"Checked, no finding" below — (a) `help.php:803` "Click Clear to reset the filters" looked wrong because no Clear control exists on an unfiltered `/admin/audit-log.php`; it is step 4 of a sequence whose step 3 applies a filter, and `audit-log.php:159-160` renders Clear exactly then — measured. (b) `help.php:595` "Click Upload PDF →" looked wrong because the button reads "Replace PDF →" on every product in the shipped catalog (42 With PDF, 0 Missing PDF); `upload-pdf.php:235` picks the label from `$willOverwrite`, and the step is headed "Uploading a PDF for the first time" — correct as written.
---

### A-9.B2-01 — MEDIUM — The Help page's tour of the dashboard describes a header bar with four links; the real one has nine

class:        doc
pass:         P5b     ledger: E071
surface:      `/admin/help.php` § "Reading the dashboard"
where:        `admin/help.php:322` (prose) and `admin/help.php:333` (the SVG diagram's header text), measured on 2121597, 2026-09-14
not in §11:   checked GUARDRAILS §7/§7.1/§7.2/§7.3, `_harness/README.md` `plan10-help`, audit5–audit8, `WHATS_LEFT.md` §2. `plan10-help` (29/29, sweep line 30) covers only A10-028 (the four-step photo diagram) and A10-029 (the Min/Max size-chart header); it asserts nothing about the header-bar description. `grep -n "quick links to Products" audit-runs/*.md plans/GUARDRAILS.md` → no hit.
reproduce:    1. `cp -r _harness/site _harness/out/audit9/site-V && php -S 127.0.0.1:<port> -t _harness/out/audit9/site-V -c _harness/php-mail.ini _harness/router.php &`
              2. Sign in at `/admin/auth.php` with the mirror password.
              3. `GET /admin/index.php` → read the header bar left to right.
              4. `GET /admin/help.php#dashboard` → read the first `<li>` under "organized like this, top to bottom", then read the diagram's top bar via `svg.querySelectorAll('text')` (NOT `innerText` — inline SVG text is not in `innerText`; this is the `plan10-help` header note).
observed:     Real bar (`admin/nav.php:68-86`): Products · + Add Product · Business Details · Page Content · Inquiries · Backups · Audit Log · Password · Help · View Live Site ↗ · Sign Out.
              help.php:322: "your logo on the left; on the right, quick links to Products, Add Product, Audit Log, and Help, plus a link to open the live public website in a new tab and Sign Out."
              help.php:333 diagram `<text>`: "IPC Admin · Products · + Add Product · Audit Log · Help · Sign Out".
              Screenshots: `_harness/out/audit9/P5b/rule8-real-nav-1440.png`, `_harness/out/audit9/P5b/rule8-help-dashboard-section.png`.
expected:     Rule 8 — every stated location checked against the mirror: control exists, exact label, stated location. Appendix B fixes the admin-nav vocabulary as the ten labels `nav.php` renders. Both the prose and the diagram omit Business Details, Page Content, Inquiries, Backups and Password.
consequence:  This is the orientation section a non-technical owner reads first, and it is the one place the dashboard's shape is described as a whole. Five of the nine sections are invisible in it — including Inquiries, which `admin/nav.php:72-74` calls "the only place the owner is TOLD a lead arrived". Each section is documented later on the same page, which is what holds this at Medium rather than High.
evidence:     `_harness/out/audit9/P5b/rule8-real-nav-1440.png`; `_harness/out/audit9/P5b/rule8-help-dashboard-section.png`; `_harness/out/audit9/P5b/admin-ui.json` → `.index.navLinks`; sweep `plan10-help 29/29` (`sweep-before.txt:30`), `plan10-adminnav 25/25` (`:25`)
verified-by:  pending V
outcome:      pending C
fix-proof:    pending C

### A-9.B2-02 — MEDIUM — The Help page says the audit-log dropdown lists every action in its table; the dropdown has 14 and the table explains 11

class:        doc
pass:         P5b     ledger: E068, E071
surface:      `/admin/help.php` § "Audit log / change history"; `/admin/audit-log.php`
where:        `admin/help.php:802` (the claim), `admin/help.php:805-817` (the 11-row badge table), `admin/help.php:799` (the prose list of what is recorded); `admin/config.php:1050-1055` (`IPC_AUDIT_ACTIONS`, 14 entries); `admin/audit-log.php:154` (the dropdown reads that constant). Measured on 2121597, 2026-09-14.
not in §11:   checked GUARDRAILS §7–§7.3, audit1 A-15 (the ledger's E068 note: "A-15 vocabulary drift, closed since — re-verify, do not re-report"). A-15 was the *drift between the dropdown and the audit_log() call sites*, and it is still closed — `lint.php`'s audit-action drift check holds it. This is a different object: the Help page's explanatory table, which `lint.php` does not check and which no suite reads. `grep -n "sign-in-failed" audit-runs/*.md` → audit5 A-5.24 and a scorecard row, both about log writes, not about help.php.
reproduce:    1. Mirror + sign in as above.
              2. `GET /admin/audit-log.php` → `document.querySelectorAll('select[name=action] option')`.
              3. `GET /admin/help.php#auditlog` → count the rows of the "What each colored badge means" table.
observed:     Dropdown (15 options): All actions · add · edit · delete · upload-pdf · remove-pdf · upload-image · remove-image · settings · content · restore · password · **sign-in · sign-out · sign-in-failed**.
              Help table (11 rows): add, edit, delete, upload-pdf, remove-pdf, upload-image, remove-image, settings, content, restore, password.
              help.php:802 verbatim: "pick an action type from the dropdown. The dropdown lists every action in the table below."
              Screenshots: `_harness/out/audit9/P5b/rule8-auditlog-dropdown.png`, `_harness/out/audit9/P5b/rule8-help-auditlog-badges.png`.
expected:     Rule 8 — an instruction is accurate about the UI it describes. Either the table covers all 14 actions or the sentence stops claiming it does. help.php:799's prose list ("Adding, editing and deleting parts; uploading and removing data sheets and photos; saving Business Details; saving Page Content; restoring a backup; and changing your password") has the same gap.
consequence:  The three undocumented actions are the sign-in events. `sign-in-failed` is the row that tells the owner someone is guessing his password — `admin/index.php:161-165` warns that when `admin/` is unwritable those rows stop being written at all, so they matter. He filters for one, gets badges the Help page does not explain, on a page that told him every action was explained.
evidence:     `_harness/out/audit9/P5b/rule8-auditlog-dropdown.png`; `_harness/out/audit9/P5b/rule8-help-auditlog-badges.png`; sweep `plan10-auditlog 13/13` (`sweep-before.txt:27`)
verified-by:  pending V
outcome:      pending C
fix-proof:    pending C

### A-9.B2-03 — MEDIUM — The Help page's server-warning section says "three things", lists four, and the dashboard can raise eight

class:        doc
pass:         P5b     ledger: E071
surface:      `/admin/help.php` § "If the dashboard warns you about the server"; the red banner on `/admin/index.php`
where:        `admin/help.php:833` (the "Three things" sentence) and `admin/help.php:836-839` (the four-row table); `admin/index.php:151-228` (the eight `$healthProblems[]` branches); `admin/help.php:967-977` (the "What your server allows" table, which has no `pdfs` row). Measured on 2121597, 2026-09-14.
not in §11:   checked GUARDRAILS §7–§7.3, audit5/6/7/8 ("banner coverage" is listed in audit7 §3 — that entry is about the `admin_writable()` banner *being shown on every page*, which still holds; this is about which of its messages the Help page explains). `grep -n "Three things can go wrong" audit-runs/*.md plans/GUARDRAILS.md` → no hit.
reproduce:    1. Mirror + sign in as above.
              2. Force one undocumented branch: `echo '{"t":1}' > <mirror>/admin/.inquiry-log-failed.json`
              3. `GET /admin/index.php` → read the `.alert-error` list.
              4. `GET /admin/help.php#health` → look for that message in the table.
              5. `rm <mirror>/admin/.inquiry-log-failed.json`
              Note for V: `_harness/router.php:28` resolves file *existence* against `_harness/site`, not the private docroot (C's `A-9.P3-1`, class `harness`). It does not affect this step — `/admin/index.php` exists in both trees, so `router.php` returns false and `php -S` executes the **private** copy, and `$__DIR__`-relative `is_file()` therefore reads the private `admin/` folder. Proved on `:8142` by prepending an `X-Mirror-Probe: site-B2` header to the private `admin/index.php` and seeing it come back over HTTP; `_harness/site/admin/.inquiry-log-failed.json` never existed.
observed:     Banner rendered: "Server setup problem — please send this to your developer." → "**Quote requests are arriving but cannot be recorded.** The website could not write to admin/inquiries.jsonl (last tried Sep 14, 2026 10:35 am). … the Inquiries page is not recording new leads."
              The Help table's four rows are: `admin` not writable · `data` not writable · `uploads/images` missing or not writable · the password-reset window is OPEN. The message above is not among them.
              `admin/index.php` builds eight distinct entries; the four undocumented ones are the system temp folder (`:181`), the `pdfs` folder (`:186`), the inquiry-log marker (`:203`), and the *expired* reset-file variant (`:227`).
              Screenshots: `_harness/out/audit9/P5b/rule8-health-banner.png`, `_harness/out/audit9/P5b/rule8-help-health-table.png`.
expected:     Rule 8 — accurate about the UI it describes; rule 5 — "Three things" against its own four-row table is an internal count error on one screen.
consequence:  The banner is explicitly designed as the thing the owner forwards to his developer, and the Help section is where he is told what it means. Three of its messages have no entry, one of which is the dropped-sales-lead case the whole panel exists for ("The warning box is there so a dropped sales lead is something you find out about in a day, not in a quarter" — `help.php:843`). He sees a red box naming `pdfs/` or the temp folder and the page that promised to explain it does not.
evidence:     `_harness/out/audit9/P5b/rule8-health-banner.png`; `_harness/out/audit9/P5b/rule8-help-health-table.png`; `_harness/out/audit9/P5b/rule8-help-server-limits.png`
verified-by:  pending V
outcome:      pending C
fix-proof:    pending C

### A-9.B2-04 — MEDIUM — The two upload screens state a maximum file size the server may not allow; the Help page states the real one

class:        code
pass:         P5b     ledger: E071, E152
surface:      `/admin/upload-image.php`, `/admin/upload-pdf.php`, `/admin/help.php` § "What your server allows"
where:        `admin/upload-image.php:250` (`Select image — JPG, PNG, WEBP, or GIF (max 8MB)`), `admin/upload-pdf.php:201` (`Select PDF File (max 20MB)`) — both hard-coded; against `admin/help.php:571,594,873,980` and `admin/config.php:1885-1895` (`min_upload_label()`, which returns `min(upload_max_filesize, ownCap)`). Measured on 2121597, 2026-09-14.
not in §11:   checked GUARDRAILS §7–§7.3, audit7 §3 (C34 datasheet file sizes — that is a *deferred decision about the sizes of the shipped PDFs*, not about what the upload screens claim), audit5/6/8, `WHATS_LEFT.md` §2. `grep -n "max 8MB" audit-runs/*.md plans/GUARDRAILS.md` → no hit.
reproduce:    1. `sed -e 's/^upload_max_filesize.*/upload_max_filesize = 2M/' -e 's/^post_max_size.*/post_max_size = 8M/' _harness/php-mail.ini > /tmp/small.ini`
              2. `cp -r _harness/site <mirror> && php -S 127.0.0.1:<port> -t <mirror> -c /tmp/small.ini _harness/router.php &`
              3. Sign in; `GET /admin/upload-image.php?sku=IP33PO` → read `label[for=image_file]`.
              4. `GET /admin/upload-pdf.php?sku=IP33PO` → read `label[for=pdf_file]`.
              5. `GET /admin/help.php#server-limits` → read the "The two limits that actually apply to you" callout.
observed:     image label: `"Select image — JPG, PNG, WEBP, or GIF (max 8MB)"`
              pdf label:   `"Select PDF File (max 20MB)"`
              help callout: `"A data sheet must be a PDF and 2MB or smaller; a product photo must be 2MB or smaller."`
              help table:  `Largest single file the server accepts  2M`
              Screenshots: `_harness/out/audit9/P5b/rule8-uploadlabel-image.png`, `rule8-uploadlabel-pdf.png`, `rule8-help-server-limits.png`.
expected:     Rule 8 — the label on the screen where the choice is made must state the limit that applies. `min_upload_label()` exists for exactly this and is already used four times in `help.php` (`:571`, `:594`, `:873`, `:980`); the two labels are the only places the number is typed by hand. `admin/upload-image.php:118` and `upload-pdf.php:79` also hard-code 8MB/20MB in the too-large error, but that branch is only reached for a file PHP already accepted, so the number is right there.
consequence:  `admin/help.php:966` names this host state explicitly ("If they read 2M and 8M, the `.user.ini` file that raises them is not being applied on this host"), so it is a case the project already expects. Under it, the owner picks a 5 MB photo on the screen that told him 8 MB was fine, PHP refuses it, and the correct number lives on a different page.
evidence:     `_harness/out/audit9/P5b/rule8-uploadlabel-image.png`; `_harness/out/audit9/P5b/rule8-uploadlabel-pdf.png`; `_harness/out/audit9/P5b/rule8-help-server-limits.png`; `_harness/out/audit9/P5b/php-small-upload.ini`
consequence-note: the production host's `upload_max_filesize` is `[UNSOURCED]` — STEP 0 (`_harness/out/audit9/step0.md`) records the site as NOT LIVE. The divergence between the two screens is measured and is independent of the host value.
verified-by:  pending V
outcome:      pending C
fix-proof:    pending C

### A-9.B2-05 — MEDIUM — All five Site Images labels on the Page Content screen print their own HTML as literal text

class:        code
pass:         P5b     ledger: E152, E066 (page owner P7 — string is P5b's)
surface:      `/admin/content.php` § "Site Images"
where:        `admin/content.php:341-345` (the five labels, each carrying `<br><small …>…<code>uploads/</code>…</small>`) rendered through `admin/content.php:980` (`render_copy_field()`, which applies `h()` to `$f['label']`). `admin/content.php:841` (`render_field()`) echoes its label raw, which is why only the `copy` group is affected. Measured on 2121597, 2026-09-14.
not in §11:   checked GUARDRAILS §7–§7.3, audit1 A-11 (edit.php double-escape — a different file and a different mechanism, and that one is closed), audit7 §3, `WHATS_LEFT.md` §2 and §1 (the 4.31 note at `WHATS_LEFT.md:2022` records `render_copy_field`'s labels gaining their group span, which is when `h()` arrived; the side effect is not recorded anywhere). `grep -n "render_copy_field" audit-runs/*.md plans/GUARDRAILS.md` → no hit.
reproduce:    1. Mirror + sign in as above.
              2. `GET /admin/content.php`
              3. `document.querySelectorAll('label')` → filter to those whose `textContent` matches `/<br>|<small|<code>/`.
observed:     5 labels — `f-copy-siteImages-heroPhoto`, `-bandTeamPhoto`, `-bandBuildingPhoto`, `-aboutPhoto`, `-servicesPhoto`. Each `innerHTML` begins:
              `Homepage hero — photo (empty removes it)&lt;br&gt;&lt;small style="font-weight:400;color:#4b5563"&gt;Paths starting &lt;code&gt;uploads/&lt;/code&gt;…`
              and renders on screen, uppercased by the label's `text-transform`, as `HOMEPAGE HERO — PHOTO (EMPTY REMOVES IT)<BR><SMALL STYLE="FONT-WEIGHT:400;COLOR:#4B5563">PATHS STARTING <CODE>UPLOADS/</CODE> ARE SAFE FOREVER…`
              Screenshots: `_harness/out/audit9/P5b/rule9-content-label-raw-html.png` (one label, cropped), `rule9-content-siteimages-section.png` (the section as the owner meets it).
expected:     Rule 9 — a label names the data. This one names the data and then prints ~230 characters of markup after it. The five are the only `copy` labels carrying HTML; every other `copy` label is plain text and renders correctly.
consequence:  Site Images is the first section on the Page Content screen, so this is the first thing the owner sees there. The buried sentence is the one that stops him losing his own photographs: "Paths starting `uploads/` are safe forever. A path starting `images/` is part of the website itself and will be replaced the next time the site is updated." GUARDRAILS §2 records seven images already deleted and restored over this exact distinction. Medium rather than High because the field still works and the default paths are pre-filled.
evidence:     `_harness/out/audit9/P5b/rule9-content-siteimages-section.png`; `_harness/out/audit9/P5b/rule9-content-label-raw-html.png`; `_harness/out/audit9/P5b/probe-content-labels.js`; sweep `plan9-slots-slash 9/9` (`sweep-before.txt:85`), `plan7-slots 16/16` (`:78`) — neither reads the label text
verified-by:  pending V
outcome:      pending C
fix-proof:    pending C

### A-9.B2-06 — LOW — Rule 8 batch: eight Help/admin instructions name a control, label or location the admin does not have

class:        doc
pass:         P5b     ledger: E071
surface:      `/admin/help.php`, `/admin/password.php`
where:        eight instances, listed below; measured on 2121597, 2026-09-14
not in §11:   checked GUARDRAILS §7–§7.3, `plan10-help` (29/29 — covers only the photo diagram and the Min/Max header), audit5–audit8, `WHATS_LEFT.md` §2. Greps for "Choose File", "Quality page", "Set admin password" → no hit in `audit-runs/*.md` or `plans/GUARDRAILS.md`.
reproduce:    Mirror + sign in; then for each row below, open the Help line and the named admin screen side by side at 1440 and compare.
observed:     1. `help.php:571` "Click **Choose File** and pick a `.jpg`…" — the page has no control with that name. `admin/upload-image.php:250`'s label reads "Select image — JPG, PNG, WEBP, or GIF (max 8MB)"; "Choose File" is Chromium's own file-input text and reads "Browse…" in Firefox. The sibling step at `help.php:594` names the page's own label ("Select PDF File"), so the two procedures teach the same action two different ways. (`rule8-help-photos-steps.png`, `rule8-real-upload-image.png`)
              2. `help.php:496` "a **\"Live preview — what the website shows\"** panel appears right below the editor" — measured at 1440 on `/admin/edit.php?sku=IP33PO`: preview at x=896 w=440, editor column at x=104 w=768. It is beside the editor, not below; `admin/product-preview.js:110` stacks it below only at `max-width:1024`. The panel's title string is exact (`product-preview.js:232`). (`rule8-preview-position-1440.png`, `rule8-help-specs-preview-claim.png`)
              3. `help.php:702` "Certifications … shown in the footer and on the **Quality page**" — there is no Quality page. The React routes are home, products, services, industries, about, datasheets, faq, contact, privacy, dashboard. `site.certifications` renders in the footer (`src/App.jsx:12553`) and as a row *labelled* "Quality" in the About page's fact list (`src/App.jsx:3692`). (`rule8-help-business-quality-page.png`)
              4. `help.php:703` "**Brand colours & logo**" as a Business Details row name — the card on `/admin/settings.php` is titled "Branding & Theme" and its fields are "Primary color", "Dark (headers & footer)", "Accent", "Secondary accent". (The same line's "Live preview on the right of the page" is correct — measured x=937 of 1440.)
              5. `help.php:879` (FAQ, "I can't log in") "the page will briefly pause… Wait a few seconds and try again" against `help.php:281` on the same page: "up to a maximum of **5 minutes**". `admin/config.php:1239-1241`/`:1325` settles it: 15s doubling to a 300s ceiling. The FAQ answer understates the same page's own number.
              6. `help.php:868` (FAQ) "the +Add specification / +Add row buttons" — the buttons read "+ Add specification" and "+ Add row" (space after the plus); every other reference in the file spells them correctly.
              7. `help.php:337` (diagram) search placeholder drawn as "Search by SKU or product name…" — the real placeholder is "Search by SKU / part number or product name…" (`admin/index.php`, read via `[placeholder]`).
              8. `admin/password.php:133` "a one-time “Set admin password” screen appears" — the screen's heading is "Set Admin Password" (`admin/auth.php:203`); `help.php:311,889` and `admin/index.php:224` all use the correct form, so this is the single outlier.
expected:     Rule 8 — control exists, exact label, stated location.
consequence:  Each is a small wrong turn for a non-technical owner rather than a blocked task: #1 and #6 send him looking for a button by the wrong name on the right screen, #2 and #7 describe the right screen wrongly, #3 sends him to a page that does not exist, #5 makes him give up on a 5-minute wait after a few seconds. None loses data or a lead.
evidence:     `_harness/out/audit9/P5b/help-uirefs-unmatched.txt`, `help-imperatives.txt`, and the eight screenshots named inline
verified-by:  pending V — sample any 3
outcome:      pending C
fix-proof:    pending C

### A-9.B2-07 — LOW — Rule 7 batch: developer vocabulary in admin flash text, including three messages naming a file that does not exist

class:        code
pass:         P5b     ledger: E152
surface:      flash / error strings on `/admin/add.php`, `/admin/edit.php`, `/admin/settings.php`, `/admin/content.php`, `/admin/backups.php`, `/admin/upload-image.php`, `/admin/upload-pdf.php`
where:        twelve instances; measured on 2121597, 2026-09-14
not in §11:   checked GUARDRAILS §7–§7.3, audit5 "Checked, no finding", audit7 §3/§4, `WHATS_LEFT.md` §2. `grep -n "products.json" audit-runs/*.md plans/GUARDRAILS.md` → no hit.
reproduce:    `grep -rnoE "\$(errors|notices)\[\] *= *'[^']{5,200}'" admin/*.php` on the checkout; the full extraction is in the artifact below. To see one rendered: sign in on the mirror, `chmod a-w <mirror>/data`, then save any field on `/admin/settings.php`.
observed:     a) **Names a file that is not in the repo** — `data/` holds `content.json`, `products-all.json`, `site-info.json`; there is no `products.json`:
                 `admin/edit.php:213` "Failed to save products.json. Check file permissions."
                 `admin/upload-image.php:175` "Image was saved but could not update products.json."
                 `admin/upload-pdf.php:128` "PDF was saved but could not update products.json."
              b) **Names a JSON filename to a non-technical owner**, where `help.php:836-837` teaches the fix as a folder and a permission ("Set `data/` to 755 (or 775) over FTP"):
                 `admin/add.php:99` "Failed to save. Check file permissions on products-all.json."
                 `admin/content.php:749` "Failed to save content.json. Check file permissions on the data/ folder."
                 `admin/settings.php:179` "Failed to save site-info.json. Check file permissions on the data/ folder."
                 `admin/upload-image.php:61` / `admin/upload-pdf.php:47` "Could not save the catalog. Check file permissions on products-all.json."
              c) **Developer phrasing with no owner-actionable fix**:
                 `admin/backups.php:69` "The backup file is not valid JSON — restore aborted, nothing was changed."
                 `admin/backups.php:60` "Unrecognized backup filename."
              d) **"session" without the gloss its two siblings carry** — `admin/edit.php:30` "This product was changed by another session since you opened this page", against `admin/content.php:546` and `admin/settings.php:50`, which both say "by another session **(or another browser tab)**". `help.php:477` quotes edit.php's wording exactly, so the Help page is accurate; the message is the outlier.
              The JSON references on `admin/add.php:47,61` and `admin/edit.php:112,130` ("Specifications Table JSON is invalid") are **not** in this batch: the fields are labelled "Rows JSON" / "Full Table JSON" and sit inside Advanced mode, which is the carve-out rule 7 allows.
expected:     Rule 7 — admin flash text carries no developer vocabulary, and rule 9 — an error message names the field and the fix. GUARDRAILS §0: the audience is a non-technical owner who uses FTP reluctantly.
consequence:  Only reachable on a write failure, which is why this is Low — but a write failure is precisely when the owner needs an instruction he can act on, and (a) tells him to check permissions on a file that is not there.
evidence:     `_harness/out/audit9/P5b/rows-admin-email.jsonl`; `_harness/out/audit9/P5b/vocab-counts.txt`
verified-by:  pending V — sample any 3
outcome:      pending C
fix-proof:    pending C

### A-9.B2-08 — LOW — Rule 2 batch: the admin has four names for itself, two spellings of "colour", and six wordings of "could not save"

class:        code
pass:         P5b     ledger: E152, E071
surface:      whole admin surface
where:        seventeen instances; counts from `_harness/out/audit9/P5b/vocab-counts.txt` over the 1,498 admin+email inventory records, cross-checked against the rendered text in `admin-rendered-text.json`. Measured on 2121597, 2026-09-14.
not in §11:   checked GUARDRAILS §7–§7.3, audit1 A-15 (dropdown/call-site drift, closed and different), Appendix B. `grep -n "Admin Panel" / "catalogue" audit-runs/*.md plans/GUARDRAILS.md` → no hit.
reproduce:    `node _harness/out/audit9/P5b/vocab.js` from the repo root; then sign in on the mirror and compare `/admin/auth.php` (signed out) with any signed-in page.
observed:     a) **Four names for the product, two of them in the same slot.** `admin/auth.php:199` puts "Admin Panel" in the logo sub-line; `admin/nav.php:63` puts "Product Manager" in the same slot on every signed-in page; every `<title>` is "IPC Admin — …"; `help.php` calls it "this dashboard" throughout (17 occurrences of "dashboard" in the rendered text). `admin/auth.php:174`'s title is "IPC Admin — **Login**" while its own button and heading say "Sign In"; "sign in" 10 : "log in" 5 across the surface.
              b) **colour 6 : color 5**, mixed inside both files that use either. `admin/settings.php:138-145` validates "Primary colour"/"Dark colour"/"Accent colour"/"Second accent colour" and errors "must be a hex colour such as #0d2d52", while the same page's visible labels (`:298-303`) read "Primary color", "Accent", and its hint (`:314`) reads "These colors re-skin the entire public website." `help.php:231,259,695,703` say "colours" of the page whose own labels say "color". US spelling is the majority everywhere else on both surfaces.
              c) **catalog 38 : catalogue 1** — `help.php:411` "that order is the order the catalogue sidebar and the Products menu use" is the single British outlier.
              d) **Six wordings for one event.** "Failed to save." / "Failed to save <file>." / "Could not save the catalog." / "<X> was saved but could not update <file>." / "Restore failed — check file permissions on the data/ folder." / "Upload failed. Check write permissions on the /pdfs/ directory." — and "file permissions" vs "write permissions", "folder" vs "directory". (Overlaps A-9.B2-07(b); listed here for the rule-2 count, fixed once.)
              e) **folder : directory inside one page** — `admin/upload-pdf.php` says "the /pdfs/ folder" and "the /pdfs/ directory" two paragraphs apart (rendered text, `text-upload-pdf.txt`).
              f) **data sheet 35 : datasheet 1 : data-sheet 1 : spec sheet 1.** The `datasheet` instance is `admin/edit.php:362` "the marks on the Datasheets page", which is the measured route name `/datasheets` and is correct per Appendix B; the `data-sheet` and `spec sheet` instances are prose and are the outliers.
              g) **Emails** — the two auto-replies print the hours from `site-info.json` ("Mon–Fri, 8am–5pm CT", en dashes, measured in the captured mail), but `public/contact.php:181`'s fallback literal is `'Mon-Fri, 8am-5pm CT'` with hyphens. `hours.text` is not in `SITE_CLEARABLE` (`src/App.jsx:6471-6485`), so if the owner clears Hours the public site keeps the en-dash default while the emails switch to the hyphen form.
expected:     Rule 2 — one controlled vocabulary per surface, majority form canonical; Appendix B's admin-nav, hours, data-sheet and certification rows.
consequence:  None of these costs a task. (a) is the one a first-time owner notices — the product introduces itself by a different name before and after sign-in — and (g) is the only one that can reach a customer.
evidence:     `_harness/out/audit9/P5b/vocab-counts.txt`; `_harness/out/audit9/P5b/admin-rendered-text.json`; `_harness/out/audit9/P5b/cspell-raw.txt`; captured mail transcript quoted under "Checked, no finding" below
verified-by:  pending V — sample any 3
outcome:      pending C
fix-proof:    pending C

### A-9.B2-09 — LOW — Rule 3 batch: curly and straight quotes, and `…` and `...`, both mixed across the admin

class:        code
pass:         P5b     ledger: E152
surface:      whole admin surface
where:        thirteen instances; counts computed over rendered `innerText` per page (`admin-rendered-text.json`), which excludes HTML attributes. Measured on 2121597, 2026-09-14.
not in §11:   checked GUARDRAILS §7–§7.3, audit7/audit8 §3–§4. No prior entry on admin typography.
reproduce:    `node -e` over `_harness/out/audit9/P5b/admin-rendered-text.json` counting `/[“”]/g` vs `/"/g` and `/…/g` vs `/\.\.\./g` per page; the per-page table is reproduced in the artifact.
observed:     a) **Quotes.** Curly-only: `admin/settings.php` (2), `admin/password.php` (4), `admin/upload-pdf.php`'s confirm (`&quot;` → straight, see (c)). Straight-only: `admin/help.php` (140 double, 114 apostrophes, zero curly of either kind). Mixed: `admin/content.php` 62 curly + 12 straight; `admin/edit.php` 4 curly + 72 straight. On `edit.php` and `inquiries.php` the straight marks are inch marks and visitor-typed text — data, not chrome — so the chrome on those two is consistent; `help.php` against the rest of the admin is the real split.
              b) **Ellipsis.** `…` in `admin/index.php` ("Search by SKU / part number or product name…"), `admin/audit-log.php` ("Filter by SKU…"), `admin/settings.php` (8 placeholders, e.g. "https://facebook.com/…"). `...` in `admin/add.php` ("One paragraph per line...") and `admin/edit.php` ("https://... or /images/product.jpg", "First paragraph about the product...\nSecond paragraph..."). Same control type — a placeholder — two glyphs.
              c) **`data-confirm` strings.** `admin/content.php:935` uses curly (`“Save Content”`); `admin/upload-pdf.php:184` uses `&quot;Request Data Sheet&quot;`. The two dialogs sit one click apart.
expected:     Rule 3 — one form per surface; mixed on one page is a Low.
consequence:  Cosmetic. No task is affected.
evidence:     `_harness/out/audit9/P5b/admin-rendered-text.json`; `_harness/out/audit9/P5b/admin-ui.json` → `.*.placeholders`, `.*.confirms`; `_harness/out/audit9/P5b/vocab-counts.txt`
verified-by:  pending V — sample any 3
outcome:      pending C
fix-proof:    pending C

### A-9.B2-10 — LOW — Rule 4 batch: Title-Case buttons and headings with a sentence-case minority, five of them in one `+ Add …` family on one page

class:        code
pass:         P5b     ledger: E152
surface:      `/admin/content.php`, `/admin/add.php`, `/admin/edit.php`, `/admin/backups.php`, `/admin/delete.php`
where:        seventeen instances; census over every rendered button and `h1` on all 13 admin pages (`admin-ui.json`). Measured on 2121597, 2026-09-14.
not in §11:   checked GUARDRAILS §7–§7.3, `plan10-adminrows` 15/15, `plan10-adminnav` 25/25 (neither asserts case). No prior entry.
reproduce:    `node -e` over `_harness/out/audit9/P5b/admin-ui.json`, classifying each distinct button by whether every word after the first is capitalised (minor words excluded).
observed:     Buttons — 38 distinct Title Case, 16 sentence case.
              The sharpest instance is one page: `/admin/content.php` renders "+ Add Card", "+ Add Stat", "+ Add Industry", "+ Add Service", "+ Add Milestone", "+ Add Question", "+ Add Capability", "+ Add Certification", "+ Add Section", "+ Add Page", "+ Add Tip", "+ Add Family" (12, Title Case) alongside "+ Add Industry section", "+ Add Menu item", "+ Add Footer link", "+ Add Proof point", "+ Add Ticker item" (5, sentence case) — the same button family, the same screen.
              Elsewhere: "+ Add specification", "+ Add row", "+ Add column", "Split into sub-columns", "Fill grid" (add/edit, against "+ Add Product" in the nav on the same page) and "Restore this version" (backups).
              Headings — 12 of 13 `h1`s are Title Case noun phrases; `admin/delete.php`'s is "Delete this product?" (sentence case, and the only question).
expected:     Rule 4 — majority style per surface for buttons and headings, minority flagged. Catalog case is preserved and is not in scope here.
consequence:  Cosmetic.
evidence:     `_harness/out/audit9/P5b/admin-ui.json`
verified-by:  pending V — sample any 3
outcome:      pending C
fix-proof:    pending C

### A-9.B2-11 — LOW — Four recorded inquiries render an unnamed link pointing at a bare `mailto:`

class:        code
pass:         P5b     ledger: E152, E069 (page owner P3 — link text is P5b's)
surface:      `/admin/inquiries.php`
where:        `admin/inquiries.php:184` — `<a href="mailto:<?= h($e['email'] ?? '') ?>"><?= h($e['email'] ?? '—') ?></a>`. Measured on 2121597, 2026-09-14.
not in §11:   checked GUARDRAILS §7–§7.3, audit7 §3 ("inquiries.php viewer assertions"), audit5. No prior entry on this link.
reproduce:    1. Mirror + sign in; `GET /admin/inquiries.php`.
              2. `Array.from(document.querySelectorAll('a')).filter(a => !a.textContent.trim())` → inspect `href`.
observed:     One link shape with an empty accessible name and `href="mailto:"`. It comes from the four entries in the mirror's `admin/inquiries.jsonl` whose `email` is `""` (indices 41–44, types `rfq-incomplete` and `message-incomplete`): the `?? '—'` fallback only fires when the key is *absent*, and these carry an empty string, so both the href and the text collapse.
expected:     Rule 9 — link names meaningful out of context; a link with no name and no destination should be the `—` the code already intends.
consequence:  Small. The rows are incomplete submissions, so there is no lead to lose; clicking opens a blank compose window and a screen reader announces a nameless link.
evidence:     `_harness/out/audit9/P5b/admin-ui.json` → `.inquiries.links`; `_harness/out/audit9/site-B2/admin/inquiries.jsonl` entries 41-44
verified-by:  pending V
outcome:      pending C
fix-proof:    pending C

---

## Checked, no finding

- **Rule 1, spelling.** `which hunspell aspell` → neither present; no `/usr/share/hunspell`; `_harness/audit9-words.txt` does not exist in the checkout. Fell back to `npx --yes cspell@latest --no-progress --locale en-US` over the exported admin+email text (temporary, never added to `package.json`); clean stderr. 18 unknown words, all dispositioned: proper nouns / real terms — Bolingbrook, Datasheets, PVDF, Polyolefin, WEBP, webp, pdfs; HTML entity names appearing only in raw source and rendering correctly — ldquo, rdquo, rsquo, mdash, nbsp; code identifiers inside an HTML comment (`admin/edit.php:457-458`, out of scope per the brief) — beforeunload, keepalive; deliberate abbreviation in a column header — "Special reqs" (`admin/inquiries.php:191`), which matches the form's own field name; British spellings — colour/colours, recorded as A-9.B2-08(b). **No typo found.** Word list for a future run: `_harness/out/audit9/P5b/cspell-raw.txt`.
- **`help.php:803` "Click Clear to reset the filters."** Correct. No Clear control exists on an unfiltered `/admin/audit-log.php`, but it is step 4 of a list whose step 3 applies a filter; `admin/audit-log.php:159-160` renders `<a href="audit-log.php" class="reset">Clear</a>` exactly then. Measured: `GET /admin/audit-log.php?action=edit` → filter controls `["Filter","Clear"]`.
- **`help.php:595` "Click Upload PDF →".** Correct. The label is `$willOverwrite ? 'Replace PDF →' : 'Upload PDF →'` (`upload-pdf.php:235`); every product in the shipped catalog has a PDF (dashboard reads 42 With PDF / 0 Missing PDF), so the mirror always shows "Replace PDF →" — but the step is headed "Uploading a PDF for the first time", which is the branch that renders "Upload PDF →".
- **`help.php:428` the twelve approvals.** Byte-identical to `IPC_APPROVALS` (`admin/config.php:909-912`) in content and order.
- **`help.php:281` the login cool-off.** "After 5 incorrect attempts… starts at a few seconds… up to a maximum of 5 minutes… forgets the failed attempts entirely after 15 quiet minutes" matches `LOGIN_FREE_ATTEMPTS 5`, `LOGIN_COOLOFF_BASE 15`, `LOGIN_COOLOFF_MAX 300`, `LOGIN_THROTTLE_WINDOW 900` (`admin/config.php:1210,1239-1241`). (The FAQ restatement at `:879` does not — A-9.B2-06 #5.)
- **`help.php:711` the clearable Business Details fields.** "fax number, the social links, short name and slogan" matches `SITE_CLEARABLE` (`src/App.jsx:6471-6485`) exactly.
- **`help.php:721` the Page Content row controls** (`↑ ↓`, `✕`, `+ Add`), **`help.php:538-551`** (`+ Add column`, `Split into sub-columns`, `+ sub-column`, `+ Add row`, `×`), **`help.php:554-557`** (`Paste from Excel`, `First row is the column headings`, `Fill grid`), **`help.php:782`** (`Restore this version`), **`help.php:313,839`** (`Close it now`), **`help.php:277`** (`Sign In →`), **`help.php:406,437,454,466,570,593,616`** (`+ Add Product`, `Add Product`, `Edit`, `Save Changes`, `Photo`, `Manage PDF`, `View ↗`, `Delete`) — every one exists with that exact label. `+ sub-column` and `Fill grid` are conditional and were driven to appear (`rule8-sizechart-after-split.png`, `rule8-paste-excel-modal.png`).
- **`help.php:409-415` the Add-form field table.** Matches `/admin/add.php`'s labels exactly. Note for C, not raised as a finding: `/admin/edit.php` labels two of the same fields differently — "Part Type / Category *" and "Specifications Summary (shown in Product Index table)" — under a Help sentence that says "Every field from Adding a new product is here".
- **`help.php:324-325` the dashboard summary cards and product tables.** Four cards measured as Total Products / Categories / With PDF / Missing PDF; table headers measured as SKU / Product Name / Temp Rating / Data Sheet / Actions. Both as described.
- **`help.php:965-980` "What your server allows".** Every row reads live. "the Page Content form currently posts about 450" measured at 448 named fields on `/admin/content.php`. `BACKUP_KEEP` is 90 and all six `help.php` references render it, not a typed number.
- **`help.php:257-262` the Quick-reference destinations** — "Product Families / Categories", "Search Engine Text (SEO)", "Site Images" all exist as card titles on `/admin/content.php`.
- **Both emails, rendered live** (POSTed to `:8142`, captured through `fakemail.sh`). Notification and auto-reply, RFQ and message: en dashes in the hours line, `630.771.0700` in the `site-info.json` form, full company name and full address in both auto-replies, `Reply-To` set to the visitor on the notification and to sales on the auto-reply. "within one business day" is the same string in `public/contact.php`, `data/content.json` and `src/App.jsx` (6/2/4 occurrences, no variant). Rule 7's "full company name and phone number" is satisfied by the auto-replies; the two *notification* emails carry only "IPC" (subject, body heading, `From: IPC Website`) — recorded here rather than as a finding because their only recipient is the owner's own sales address.
- **Admin `img alt` and link names.** 13 pages: the nav logo is `alt="IPC"` on every page (the `alt=""` + `aria-label` pattern is settled for the *public* logo, GUARDRAILS §7.3, and is not re-opened here); `/admin/upload-image.php` uses `alt="IP33PO product photo"`; `/admin/edit.php`'s preview thumbnail is `alt=""` beside a visible SKU. Back-to-top on `help.php` carries `aria-label="Back to top"`. Audit-log filter inputs carry `aria-label="Filter by SKU"` / `"Filter by action"`. Only the `mailto:` link (A-9.B2-11) has no name.
- **Rule 5, mechanical.** 7 checks over all 1,498 records: 0 doubled words, 0 double spaces, 0 missing spaces at a concatenation boundary, 0 `" ."`/`" ,"` in prose. The 6 raw hits in `mech-hits.txt` are all intentional — two CSS class attributes, the SKU character list at `admin/config.php:1565` ("the characters - _ . / & + ,"), "ending in .pdf", and a JSON example. Sentences over 35 words are a public-surface check (P5a).
- **Rule 6, truth — cross-referenced against P4's register at 17:50, after it landed.** `_harness/out/audit9/P4/claims-register.md` row 10 covers the same-day *shipment* claim and names `copy.hero.headlineAccent`, `seo[0].desc`, `seo[5].desc`, `index.html:10,41` as the unqualified instances (A-9.P4-1). The auto-reply's sentence is not in that row and is a *response*-time claim, not a shipment one: "Our sales team will review your request and respond within one business day — often the same day for in-stock items" (`public/contact.php`, captured live). It carries the qualification P4 says the true form has ("for in-stock items"), and "within one business day" is byte-identical across `public/contact.php`, `data/content.json` and `src/App.jsx`. **No finding, and nothing duplicated from P4.** The register's other rows touch no admin or email string. Admin/email claims checkable against code were checked independently and are listed above (approvals, throttle, clearable fields, backup count, form-field count).
- **P4's out-of-brief note** that Page Content has no SEO row for `/datasheets` is a missing *control*, not wording, and belongs to `content.php`'s page row (E066, P7). Confirmed present-and-absent while reading `content.php`'s 31 sections for A-9.B2-15; not raised here.
- **Rule 10, legal text.** P5a's; no legal text on the P5b surfaces.

## Out of brief

- `admin/index.php:141` — the code comment "Three things fail SILENTLY" is stale against its own block, which now builds eight `$healthProblems` entries; it is the likely origin of A-9.B2-03's Help text. Comments are outside P5's scope.
- `data/content.json` and `src/App.jsx` — "Same Day", "Same-Day", "same day" and "same-day" all occur; P5a's surface.
- `plans/GUARDRAILS.md` §4.4 states the content form posts 439 variables; measured 448 on `/admin/content.php`.
- `admin/edit.php` labels "Part Type / Category *" where `admin/add.php` labels the same field "Part Type *", and "Specifications Summary (shown in Product Index table)" where add.php says "Specifications Summary"; `help.php` presents the two forms as sharing a field set. Field labels on edit.php belong to E061 (P7).
