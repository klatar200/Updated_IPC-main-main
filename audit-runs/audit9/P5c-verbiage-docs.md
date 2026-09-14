# P5c — verbiage: the owner-facing documents          agent: B2   started/finished: 2026-09-14 17:44 / 2026-09-14 17:52 UTC (P5b ran 15:25-17:44 across an API-rate-limit pause)   mirror: :8142 (re-copied from `_harness/site` between passes)
findings:   Blocker 0 · High 0 · Medium 2 · Low 3
| ID | sev | class | where | one line |
| A-9.B2-12 | Medium | doc | `admin/README.md:96-100,129-140` | The deploy section opens "This site is already live" and tells the operator never to upload `data/` or `pdfs/`; STEP 0 measured the site NOT live, so this deploy is the one time both must go up. |
| A-9.B2-13 | Medium | doc | `admin/README.md:155,166-169,220-259` | `admin/README.md` still teaches the raw-JSON spec-table workflow the dashboard replaced with a visual builder, and its worked example is the Min/Max sub-column shape AUDIT-10 removed from the Help page. |
| A-9.B2-14 | Low | doc | `admin/README.md` ×7 | Rule 8 batch — seven instructions in the owner README naming a control, a delay or a file set the admin does not have. |
| A-9.B2-15 | Low | doc | `Editing-Your-Site-Content.md:9,29-45,62` | Rule 8 batch — the guide's two inventories are short: five social links where the form has seven, and 22 of the 31 Page Content sections. |
| A-9.B2-16 | Low | doc | five docs | Rules 1-4 batch — British spelling in `PATCH_NOTES.md` and two words of `admin/README.md` against US spelling everywhere else, and `admin/README.md` calls the owner "the customer" where the admin reserves that word for the buyer. |
ledger:     done E110, E156, E157; E113 and E158 language-only (facts are P8's)   blocked none
suites cited: plan10-help 29/29 (`_harness/out/audit9/sweep-before.txt:30`) — cited in A-9.B2-13 as the suite that closed A10-028/A10-029 on `help.php` and reads no other file; plan10-adminnav 25/25 (`sweep-before.txt:25`)
instruments: none new (brief names none for P5c). Ad-hoc probe `_harness/out/audit9/P5c/shots-p5c.js`.
artifacts:  `_harness/out/audit9/P5c/docs-all.txt` — the five documents concatenated for the rule-1/3/5 scans
            `_harness/out/audit9/P5c/cspell-raw.txt` — 55 unknown words, every one dispositioned below; `cspell-stderr.txt` empty
            `_harness/out/audit9/P5c/rule8-real-nav-1440.png` — the eleven-item admin header
            `_harness/out/audit9/P5c/rule8-dashboard-row-buttons.png` — the six row controls (View PDF · Edit · Manage PDF · Photo · View ↗ · Delete); no control named "PDF"
            `_harness/out/audit9/P5c/rule8-settings-social-fields.png` — the seven social fields on Business Details
            `_harness/out/audit9/P5c/rule8-add-spec-builder.png` — the Add form's visual Specifications builder
            `_harness/out/audit9/P5c/shots-p5c.js` — also prints the 31 Page Content section titles and the seven social labels
            reused from P5b (same mirror, same measurements): `_harness/out/audit9/P5b/admin-ui.json`, `admin-rendered-text.json`
environment artifacts consumed: `_harness/router.php:28` resolves static-file existence against the sweep mirror (C, class `harness`, `A-9.P3-1`) — not re-reported, and no P5c finding rests on a file being present or absent over HTTP. STEP 0 (`_harness/out/audit9/step0.md`) is consumed by A-9.B2-12 and is C's measurement, not re-measured here.
out of brief: `admin/README.md:187-188` cites `upload-pdf.php:79` and `upload-image.php:102` for the size caps; measured at `upload-pdf.php:80` and `upload-image.php:118-119`. Doc line-number facts sit between P5c (instruction) and P8 (doc numbers) — routed to C rather than claimed.
            `admin/README.md:98-100` also bears on P8's GO-LIVE branch-B runbook; raised here because §3.3 assigns `admin/README.md` to P5c and says P8 does not open it.
            `Email to Rick…` gives the admin address as `https://insulationproducts.com/admin/` (apex, no `www`); STEP 0 records the build's canonical URLs as `https://www.…` and both hosts presenting an expired wildcard certificate. The certificate is C's server-class finding and is not duplicated.
[UNVERIFIED]/[UNSOURCED]: none new. A-9.B2-12 rests on `_harness/out/audit9/step0.md`, whose https:// lines are `[UNVERIFIED — TLS]`; the NOT-LIVE verdict itself is measured over plain HTTP (three 404s on `/data/*.json`) and is not TLS-dependent.
self-corrections: Two candidates withdrawn after checking — (a) `PATCH_NOTES.md:229` `/prodcuts` and `:924` `DESCRTIEMPON` were flagged by the spell run and are both deliberate: the first is a worked example of a mistyped URL, the second is a verbatim transcript of two overprinted table headers. Neither is a typo. (b) `Editing-Your-Site-Content.md:58-64`'s "four exceptions" reads like a miscount against its four bullets but is correct — it counts the four clearable *groups*, and matches `SITE_CLEARABLE` (`src/App.jsx:6471-6485`) and `help.php:711`.
---

### A-9.B2-12 — MEDIUM — The owner README's deploy section is written for a site that is already live; STEP 0 measured that it is not

class:        doc
pass:         P5c     ledger: E156
surface:      `admin/README.md` § "First-time deploy" and § "Subsequent deploys"
where:        `admin/README.md:96-100` (the block quote) and `:129-140` ("Do NOT re-upload `data/`, `pdfs/`, or `admin/` — those are live on the server and your local copies are stale"). Measured on 2121597, 2026-09-14.
not in §11:   checked GUARDRAILS §2 ("Re-upload `data/products-all.json` or `pdfs/` from the repo — Settled 2026-08-04") and §7.3, audit8 §2 (A-8.7/A-8.8 "live copy is an owner action"), `WHATS_LEFT.md` §3 ("`products-all.json` upload" — declined). Every one of those settles the **post-first-deploy** rule, which is the rule this document states. What is new is dated evidence that the premise has not happened yet: `_harness/out/audit9/step0.md`, measured by C on 2026-09-14, classifies this as "**first deploy** branch (B)" and records "`data/`, `pdfs/`, `uploads/` go up exactly once". PLAN-11 §10.2.7 allows a re-open on new dated evidence; this is it. `grep -n "This site is already live" audit-runs/*.md plans/GUARDRAILS.md WHATS_LEFT.md` → no hit.
reproduce:    1. `cat _harness/out/audit9/step0.md` → the verdict line and the branch classification.
              2. `sed -n '96,140p' admin/README.md`
              3. Compare against the root `README.md` deploy tables and `CLAUDE.md` § "Trees that ship to the server", both of which mark `data/`, `pdfs/` and `uploads/` "**first deploy only**".
observed:     `admin/README.md:98`: "> **This site is already live.** The steps below are the historical first-time setup, kept for reference. … note that **`data/` and `pdfs/` are now live customer state and must NOT be uploaded from the repo.**"
              `admin/README.md:138-140`: "**Do NOT re-upload `data/`, `pdfs/`, or `admin/`** — those are live on the server and your local copies are stale."
              `_harness/out/audit9/step0.md`: "RESULT: **NOT LIVE** … `curl -s http://www.insulationproducts.com/data/products-all.json` → **404** … Classification per GO-LIVE.md STEP 0: **first deploy** branch (B). `data/`, `pdfs/`, `uploads/` go up exactly once."
expected:     Rule 8 — an instruction is accurate about the state it describes. On branch B the first-deploy steps are not historical, they are the steps; and `data/`/`pdfs/` are not live customer state yet. The document is self-contradictory as well as wrong against the measurement: `:104-107` still instructs "FTP four trees into `public_html/`" including both folders.
consequence:  This is the deploy document that sits next to the code being FTP'd. An operator who reads the block quote and skips `data/` leaves the host with no `products-all.json`, `site-info.json` or `content.json` — the three files the React app fetches — and the public site opens on "Catalog Unavailable" (`src/App.jsx:12939`) with no phone number in the header (invariant 8's failure mode) on launch day. Medium rather than High because the root `README.md` and `GO-LIVE.md` both carry the correct branch-B manifest and the block quote points the reader at the root README, so a careful operator recovers.
evidence:     `_harness/out/audit9/step0.md`; `admin/README.md:96-140`; root `README.md` deploy tables; `CLAUDE.md` § "Trees that ship to the server"
verified-by:  pending V
outcome:      pending C — this is `doc` class and overlaps P8's branch-B runbook work; C to dedupe against P8 before fixing.
fix-proof:    pending C

### A-9.B2-13 — MEDIUM — The owner README still teaches the raw-JSON spec-table workflow the dashboard replaced, and its worked example is the Min/Max shape AUDIT-10 deleted from the Help page

class:        doc
pass:         P5c     ledger: E156
surface:      `admin/README.md` § "Customer workflows" and § "Spec-table JSON examples"
where:        `admin/README.md:155-157` (step 5 of "Adding a new product"), `:166-169` (step 3 of "Editing a product"), `:220-259` (the two JSON examples and the `sub` warning). Measured on 2121597, 2026-09-14.
not in §11:   checked GUARDRAILS §7–§7.3, `_harness/AUDIT10-REPORT.md`, `plans/PLAN-10-audit10-remediation.md` §12, `WHATS_LEFT.md` §2. A10-028 and A10-029 are **fixed and verified** — on `admin/help.php`. `_harness/plan10-help.js:33` hardcodes `BASE = 'http://127.0.0.1:8123'` and fetches only `/admin/help.php`; it reads no `.md` file, so it cannot see this copy. Re-raising the *same shape in a different file* is not re-reporting a closed finding; the closed one stays closed. `grep -n "Spec-table JSON examples" audit-runs/*.md plans/GUARDRAILS.md` → no hit.
reproduce:    1. Mirror + sign in; `GET /admin/add.php` → scroll to the "Specifications" and "Size chart" cards and list their controls.
              2. `sed -n '155,157p;166,169p;220,259p' admin/README.md`
              3. `GET /admin/help.php#specs` and `#sizechart` → compare what the Help page teaches.
observed:     The Add form's Specifications card renders "+ Add specification" with paired "Label (leave blank for a note)" / "Value" boxes and an "×" per row; the Size chart card renders "Column heading" boxes, "+ Add row", "+ Add column", "Split into sub-columns", "Paste from Excel" and an "Advanced" link. JSON is reachable only behind "Advanced" (labels "Rows JSON", "Full Table JSON"). Screenshot: `_harness/out/audit9/P5c/rule8-add-spec-builder.png`.
              `admin/README.md:155`: "Spec tables (Specifications + Size/Dimension) take **JSON** — see the examples below."
              `admin/README.md:166-169`: "**If a spec-table JSON is invalid**, the save will fail with a parse error message — fix the syntax and resubmit."
              `admin/README.md:235-250` gives the worked Size/Dimension example as
              `{ "label": "Expanded", "colspan": 2, "sub": ["Min", "Max"] }` over rows `["3/64","0.046","0.062"]`.
              `admin/help.php:489`: "Both the Add and Edit forms use the same easy, visual builder — no code required." `admin/help.php:560`: Advanced mode is "entirely optional and meant for technical users only".
              `_harness/plan10-help.js:196-206` asserts of the Help page: no `Min` / `Max` sub-header remains, no header cell carries a colspan, "the headers use the catalog's own vocabulary — Expanded Diameter and Recovered Diameter"; and `:230-234` that the sub-column explanation's worked example is no longer Min/Max. The README carries exactly what was removed.
expected:     Rule 8 — a document must not teach a workflow the dashboard abandoned, or a spec shape that cannot be right. That is `plan10-help.js`'s own opening sentence, and A10-029's finding was that no product in the catalog uses a Min|Max split at all (the comment at `admin/help.php:505-523` records the reasoning and names IP29CG, IP33PO, IP33TW, IP34SR as using Expanded/Recovered as sibling columns).
consequence:  Two costs. First, a non-technical owner handed this file is told the spec tables are JSON, sent to hand-edit brackets, and pointed at the one control (`Advanced`) that the Help page tells him to stay out of. Second, the worked example teaches the Min|Max shape, and the same document at `:253-259` records that following its *previous* JSON example caused a real data-loss bug ("The documentation was the trigger for a data-loss bug") — so this file has already demonstrated that its examples get copied.
evidence:     `_harness/out/audit9/P5c/rule8-add-spec-builder.png`; `_harness/out/audit9/P5b/admin-ui.json` → `.add.buttons`, `.add.placeholders`; sweep `plan10-help 29/29` (`sweep-before.txt:30`)
verified-by:  pending V
outcome:      pending C
fix-proof:    pending C

### A-9.B2-14 — LOW — Rule 8 batch: seven instructions in `admin/README.md` name a control, a delay or a file set the admin does not have

class:        doc
pass:         P5c     ledger: E156
surface:      `admin/README.md`
where:        seven instances; measured on 2121597, 2026-09-14
not in §11:   checked GUARDRAILS §7–§7.3, audit1 A-15, audit5–audit8, `WHATS_LEFT.md` §2, ledger E117 (`csrf-back.js` — "10th admin JS file; **map says 9**": that row is about `audit-runs/project-map.md`, a different document, and is P3's). Greps for "1-8 second", "chmod 666", "Customer Guide" → no hit.
reproduce:    Mirror + sign in; open each README line against the named admin screen at 1440.
observed:     1. `:216-218` "**The navigation bar** … so Products, + Add Product, Audit Log, Help, View Live Site, and Sign Out are always one click away" — the bar renders eleven items; Business Details, Page Content, Inquiries, Backups and Password are missing. Same stale list as `admin/help.php:322` (A-9.B2-01), in a second file. (`rule8-real-nav-1440.png`)
              2. `:185` "From the dashboard, click **PDF** on the row." — the row controls are View PDF · Edit · **Manage PDF** · Photo · View ↗ · Delete. There is no control named "PDF"; "View PDF" opens the file. `help.php:593` uses "Manage PDF" correctly. (`rule8-dashboard-row-buttons.png`)
              3. `:324` Troubleshooting: "(5 failures triggers a 1-8 second delay)" — `admin/config.php:1239-1241,1325` gives 15s doubling to a 300s ceiling, and **this same file** says so at `:337-338` ("a cool-off that doubles from 15s to a 300s ceiling"), with a parenthetical recording that the old text was corrected on 2026-08-18. The Troubleshooting row was not corrected with it.
              4. `:325` Troubleshooting: "`data/products-all.json` is not writable — **chmod 666**" — `admin/help.php:837` and `admin/index.php:168-169` both give the fix as the folder: "Set `data/` to 755 (or 775) over FTP". `data_writable()` is what the save actually tests. The same README's own permissions table at `:110-118` says "644 (or 666 if 644 doesn't write)". Three answers to one question, and the Troubleshooting row gives the most permissive one first.
              5. `:87` the server-layout diagram lists `*.js ← confirm / search / spectable / content / unsaved / help` — six. `ls admin/*.js` is ten: confirm, content-editor, contrast-guard, **csrf-back**, help, **product-preview**, search, **settings-preview**, spectable-editor, unsaved. The diagram is the manifest a reader uses for `:360-363` ("If you receive new admin files … FTP them into `public_html/admin/`"), so four files can be left behind.
              6. `:294` "A one-time **\"Set admin password\"** screen appears" — the screen's heading is "Set Admin Password" (`admin/auth.php:203`). `admin/help.php:311,889` and `admin/index.php:224` use the correct form; this and `admin/password.php:133` are the two outliers.
              7. `:209-211` "Click **Audit Log** in the dashboard nav. Every add, edit, delete, PDF upload, and PDF removal is recorded" — `IPC_AUDIT_ACTIONS` (`admin/config.php:1050-1055`) has fourteen: photo upload and removal, Business Details saves, Page Content saves, restores, password changes and the three sign-in events are all recorded too. Same omission class as A-9.B2-02.
expected:     Rule 8 — control exists, exact label, stated location; and internal consistency where the same document answers the same question twice (#3, #4).
consequence:  Each is a small wrong turn rather than a blocked task, which is what holds the batch at Low. #5 is the one with a lasting effect: an upgrade that follows the diagram ships an admin missing `csrf-back.js`, `contrast-guard.js` and the two preview scripts, and nothing on screen says so.
evidence:     `_harness/out/audit9/P5c/rule8-real-nav-1440.png`; `_harness/out/audit9/P5c/rule8-dashboard-row-buttons.png`; `_harness/out/audit9/P5b/admin-ui.json`; `ls admin/*.js`
verified-by:  pending V — sample any 3
outcome:      pending C
fix-proof:    pending C

### A-9.B2-15 — LOW — Rule 8 batch: `Editing-Your-Site-Content.md`'s two inventories are short — five social links where the form has seven, and 22 of 31 Page Content sections

class:        doc
pass:         P5c     ledger: E157
surface:      `Editing-Your-Site-Content.md`
where:        `:9` (the menu list), `:29-45` (the Page Content inventory), `:62` (the clearable social links). Measured on 2121597, 2026-09-14.
not in §11:   checked GUARDRAILS §7–§7.3, audit5–audit8, `WHATS_LEFT.md` §2 and §3. `grep -n "five social links" audit-runs/*.md plans/GUARDRAILS.md` → no hit.
reproduce:    1. Mirror + sign in.
              2. `GET /admin/settings.php` → labels matching `/facebook|linkedin|twitter|youtube|pinterest|instagram|tiktok/i`.
              3. `GET /admin/content.php` → `Array.from(document.querySelectorAll('.card-title')).map(e => e.textContent.trim())`.
              4. Compare against `Editing-Your-Site-Content.md:33-45` and `:62`.
observed:     a) **Social links.** Doc `:62`: "The five **social links** (Twitter/X, Facebook, LinkedIn, YouTube, Pinterest)". Measured on Business Details: **seven** — Facebook, LinkedIn, Twitter / X, YouTube, Pinterest, **Instagram**, **TikTok** (`admin/settings.php:450-456`). All seven are in `SITE_CLEARABLE` (`src/App.jsx:6471-6484`), so all seven behave the way the doc's paragraph promises; two of them are simply not listed. This is the one list in the document that is explicitly exhaustive ("The fields you genuinely **can** empty … are:"). (`rule8-settings-social-fields.png`)
              b) **Page Content sections.** Doc `:29`: "It has two kinds of sections, one after the other", followed by two enumerations. Measured: **31** card titles. The enumerations reach 22. Missing from the "Page Text" list: **Site Images** (which is the first section on the screen), **Datasheets page — banner**, **Navigation — Header Labels**, **Footer — Labels**, **Contact Page — Form**. Missing from the "Lists" list: **Industries Page — Detail Sections**, **Search Engine Text (SEO)**, **Contact Page — Sidebar Tips**, **Product Families / Categories**.
              c) `:9` renders the menu item as "**Add Product**"; the link reads "**+ Add Product**" (`admin/nav.php:69`) and Appendix B fixes that spelling. The nine items otherwise match the nav exactly — this document, not `help.php:322`, is the accurate one on the nav (see A-9.B2-01).
              d) `:29` "Open the **Page Content** tab" — it is a link in the header bar, not a tab; `help.php:722` says "Click **Page Content** in the header".
expected:     Rule 8 — an enumeration presented as the contents of a screen matches the screen.
consequence:  Low: `admin/help.php` documents Site Images (`:730`), Search Engine Text (SEO) (`:734`) and Product Families / Categories (`:726`) properly, and the Email to Rick points him at the Help page first, so nothing here is the only account of a feature. What the owner loses by reading only this file is that he can add a product category himself and that he controls the text Google shows.
evidence:     `_harness/out/audit9/P5c/rule8-settings-social-fields.png`; `_harness/out/audit9/P5c/shots-p5c.js` output (31 section titles, 7 social labels); `_harness/out/audit9/P5b/admin-ui.json` → `.content.cardTitles`, `.settings.labels`
verified-by:  pending V — sample any 3
outcome:      pending C
fix-proof:    pending C

### A-9.B2-16 — LOW — Rules 1-4 batch: British spelling against US spelling across the five documents, and one word that means two different people

class:        doc
pass:         P5c     ledger: E110, E113, E156, E157, E158
surface:      `admin/README.md`, `Editing-Your-Site-Content.md`, `Email to Rick - Admin Dashboard Handoff.md`, `GO-LIVE.md`, `PATCH_NOTES.md` — language only; the facts of the last two are P8's
where:        counts per document, computed over the raw files. Measured on 2121597, 2026-09-14.
not in §11:   checked GUARDRAILS §7–§7.3, Appendix B, audit5–audit8. No prior entry on doc spelling.
reproduce:    `node -e` over the five files counting each British/US pair; the per-file table is in the artifact. Spell run: `npx --yes cspell@latest --no-progress --locale en-US --unique --words-only _harness/out/audit9/P5c/docs-all.txt`.
observed:     a) **British vs US.** `PATCH_NOTES.md`: colour 26 / color 0 · behaviour 2 / behavior 0 · neighbour 1 · normalis- 2 · canonicalis- 1 · labelled 2 — but catalog**ue** 4 / catalog 35 and recogniz- 7 / recognis- 0, so the file is not internally consistent either. `admin/README.md`: "defence" (`:350`) and "amortise" (`:341`) against "color", "catalog" and US spelling everywhere else in the same file. `Editing-Your-Site-Content.md`, `Email to Rick…` and `GO-LIVE.md` are consistently US.
                 The tie-break is the product's own surface: the admin's visible labels are "Primary color", "Dark (headers & footer)", "Accent" (`admin/settings.php:298-303`) and the public site is a US manufacturer's. `PATCH_NOTES.md:67`'s heading "Brand colours and contrast" names a screen that says "color". (The mirror-image defect inside the admin — `settings.php` validating "hex colour" under labels that say "color" — is A-9.B2-08(b), fixed separately.)
              b) **One word, two readers.** `admin/README.md:1` is titled "IPC Admin Panel — **Customer Guide**" and `:142` heads "## **Customer** workflows", using "customer" to mean the site owner. Everywhere else in the product "customer" is the buyer: `admin/help.php:432` "the label/value list **customers** see", `:489` "shown on the left side of a product's detail page", `admin/upload-pdf.php`'s confirm "The product will revert to showing \"Request Data Sheet\" on the website". Rule 2 wants one form per concept; this one inverts the concept.
              c) **Rules 3 and 5 are clean.** All five documents use straight quotes throughout, no mixed ellipsis outside code blocks, and after stripping fenced and inline code the mechanical scan returns 0 doubled words, 0 double spaces, 0 `" ."`, 0 `" ,"` across all five. Headings are sentence case in all five.
              d) **Rule 1.** 55 unknown words from the spell run, all dispositioned: proper nouns and product names (Bolingbrook, Keagan, Polyolefin, Vite, esbuild, opcache, Segoe, Zilla, Tubi, CCPA, DMARC, WCAG); code identifiers and HTTP spellings quoted verbatim (Referer/referer — the real header spelling and invariant 11's subject, noindex, noopener, noreferrer, noscript, preg, realpath, filesize, keepalive, beforeunload, transitionend, spectable, isoclaims, vite); harness and route names (pdfs, datasheet/datasheets — the measured `/datasheets` route, sitewide, scroller, tappable, textareas, placehold, yourdomain, artboard, unstarred, unthemed, wordmark, writability, canonicalising, normalises); and the British forms in (a). **No misspelling found.** Two hits were checked and are deliberate: `PATCH_NOTES.md:229` `/prodcuts` is a worked example of a mistyped URL, and `:924` `DESCRTIEMPON` is a verbatim transcript of two overprinted column headers.
expected:     Rule 1 — one spelling standard; rule 2 — one controlled vocabulary per concept; rule 4 — one capitalisation style.
consequence:  None costs a task. (b) is the one worth fixing on sight: a document whose title tells the owner he is the customer, inside a product whose every other screen uses that word for the person buying tubing.
evidence:     `_harness/out/audit9/P5c/cspell-raw.txt`; `_harness/out/audit9/P5c/docs-all.txt`; per-file British/US table reproduced in this record
verified-by:  pending V — sample any 3
outcome:      pending C
fix-proof:    pending C

---

## Checked, no finding

- **The three-way nav check the brief asks for first.** `Editing-Your-Site-Content.md:9` lists nine menu items — Products, Add Product, Business Details, Page Content, Inquiries, Backups, Audit Log, Password, Help — and names View Live Site and Sign Out in the line below. `admin/nav.php:68-86` renders exactly those eleven. `admin/help.php:322` and `:333` name four. **The document is right; the Help page and `admin/README.md:216-218` are the two that are wrong** (A-9.B2-01, A-9.B2-14 #1). The only discrepancy in the document is the missing "+" on "+ Add Product" (A-9.B2-15 c).
- **`Email to Rick - Admin Dashboard Handoff.md` — every instruction checked against the mirror and holds.** "click **Help** in the top navigation" ✓ · "click **Password** in the top navigation" ✓ · "click **Sign In**" ✓ (the button reads "Sign In →") · "You'll land on the **Product Catalog** page" ✓ (that is the `h1`) · "click **Backups** in the top navigation and restore the version from just before" ✓ · "Quote requests … land under **Inquiries**" ✓ · "a red banner about server setup" ✓ · "hold Ctrl and press Shift+R" ✓ · the eight bullets describing what Help covers all map to real `help.php` sections, including "a troubleshooting section, a glossary, and a live readout of your server's limits" (`#faq`, `#glossary`, `#server-limits`). It carries no password, which is correct. Ledger note on E110 confirmed: still holds.
  One line is now less true than when it was written — "It's always there, it's **always current**, and it **matches exactly what's on your screen**" — because of A-9.B2-01/02/03/06. Recorded here rather than as a finding: the sentence is about `help.php`, and fixing `help.php` fixes it.
- **`Editing-Your-Site-Content.md` — the rest.** "Icons come from a menu … (services, certifications, industries, stats) have an **Icon dropdown** … Team cards use an emoji you can type in the 'Icon' field" ✓ (`admin/content.php` has six `'type' => 'icon'` fields on exactly those sections; About — Team & Capabilities uses the free-text label "Icon / emoji"). "the bullet-points box takes one item per line" ✓ ("One item per line" placeholder, 21 instances). "Wherever a button or link has a 'Links to' dropdown — the hero buttons, header-menu items, and footer links" ✓ ("Primary/Secondary button links to" on Homepage — Hero; "Links to" on Navigation — Company Menu and Navigation — Footer Quick Links; all `'type' => 'page'`, so the value is picked, not typed). "**+ Add** / **✕** / **↑ ↓**" ✓. "click **Save Content**" ✓. "Backups are kept for the 90 most recent saves of each file" ✓ (`BACKUP_KEEP` 90). "If you get signed out mid-edit … a button back to your unsaved work. Click it, sign in again in a new tab, come back, and click Save" ✓ — matches the three numbered steps and the "← Back to my unsaved page" button at `admin/config.php:430-437` (`:432` and `:436`) exactly. "a red **\"Server setup problem\"** banner" ✓ (`admin/index.php:245`). The four-exceptions rule matches `SITE_CLEARABLE` and `help.php:711`.
- **`admin/README.md` — the parts that hold.** The Full I/O surface table matches `CLAUDE.md` § "Full I/O surface of the admin" row for row. "Catalog Unavailable" ✓ verbatim (`src/App.jsx:12939`). "Another product already uses SKU X" ✓ (`admin/edit.php:155`). "PDF upload errors with 'Upload failed' — `pdfs/` is not writable — chmod 755 (or 775)" ✓ (`admin/upload-pdf.php:131`). "click **+ Add Product** (top right)" ✓. "click **Edit** on the row" / "click **Delete** on the row" / "click **View ↗**" / "**Save Changes**" / "**Remove PDF**" ✓. "Sign in and click **Password** in the top navigation" ✓. The `sub`-must-be-an-array warning and the `ALLOW-PASSWORD-RESET` recovery steps are accurate against `admin/auth.php` and `admin/config.php`.
- **`GO-LIVE.md` — language only.** Headings sentence case throughout; spelling US; no mechanical hits. Its admin references use the real labels: "Help → **What your server allows**" ✓ (`help.php:965` `h2`), "**Admin → Inquiries**" ✓, the red "**Server setup problem**" banner ✓. Facts, the STEP 0 branch and the C-section numbers are P8's (§3.3) and were not audited.
- **`PATCH_NOTES.md` — language only.** Headings sentence case; rules 3 and 5 clean; the only language finding is the British/US split in A-9.B2-16. Facts are P8's and were not audited.
- **Rule 6 (truth) and rule 10 (legal).** Rule 6: `_harness/out/audit9/P4/claims-register.md` was cross-referenced at 17:50. No register row touches any of the five documents — the register covers `content.json`, `products-all.json`, `site-info.json` and `index.html`. Nothing here duplicates a P4 record, and the doc claims checkable against code were checked and are listed above. Rule 10 is P5a's; the P5c documents carry no legal text.
- **Rule 9 (alt / link / label).** The five documents contain no images and no bare link text; every markdown link is a document-relative path with a meaningful name. The one link worth noting is in the Email (see Out of brief).

## Out of brief

- `admin/README.md:187-188` cites `upload-pdf.php:79` and `upload-image.php:102` for the hard size caps; measured at `upload-pdf.php:80` and `upload-image.php:118-119`.
- `admin/README.md:98-100` contradicts the branch-B runbook P8 is executing (A-9.B2-12); flagged for C's dedupe with P8 rather than assumed.
- `Email to Rick - Admin Dashboard Handoff.md:24` gives the admin address as `https://insulationproducts.com/admin/` (apex, no `www`), while STEP 0 records every canonical, `og:url` and sitemap URL in the build as `https://www.…` and both hosts presenting an expired wildcard certificate. The certificate is C's server-class finding.
- `admin/README.md:306-318` ("Hand-editing the hash") walks a `php -r "echo password_hash(…)"` command inside a document titled "Customer Guide". Audience, but it is labelled "rarely needed" and every other route is documented first; noted rather than raised.
