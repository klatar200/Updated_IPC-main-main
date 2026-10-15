# What's left — IPC website

**Snapshot as of 2026-10-07, `main` at `25f806b` (PR #77).** Engineering
work is done. Everything still open waits on **Rick** (content and facts),
**deploy day** (the host), or **an explicit decision**. Nothing is half-built.

- The full append-only history moved, verbatim, to
  [`audit-runs/WHATS_LEFT-history.md`](audit-runs/WHATS_LEFT-history.md).
  That is 7,800 lines and 90 sections of what was shipped, decided and
  measured, and why. (This said 76 sections until 2026-10-13; recount with
  `grep -c '^## ' audit-runs/WHATS_LEFT-history.md`.)
- Every `WHATS_LEFT §…` reference in code comments, the harness and the docs
  written before 2026-10-07 (§1ar, §1at, §2b …) points into that file.
- 2026-10-13: AUDIT-12 ran (read-only). Its findings are open in "Open — AUDIT-12 findings" below; until they are owned, "engineering work is done" above no longer holds.
- New entries go **here**, in the sections below. Record a decision as a dated
  bullet. When an item closes, move it to "Done since 2026-10-07" with its PR.

---

## Open — waits on Rick (content and facts, all editable in the dashboard)

Each of these is a fact only IPC can confirm. The site renders whatever is
in the box, and nothing here is a code change. History: §2r, §1ao and §1aq.

| Item | Where Rick edits it | What to check |
|---|---|---|
| ISO 9001 revision year | Business Details → Certifications → ISO | Use the year printed on the current certificate. Leaving the box blank removes the claim from the footer, the About fact box and the homepage band **only** (the decided §1aq scope, as Business Details says). Every other wording that says ISO 9001 — Page Content (Products & Services Cards, Company Timeline, Team & Capabilities, Certifications & Standards, Hero Proof Points, Hero Trust Ticker, SEO rows), the About story, and the VALUE-ADDED product (Products → Edit) — stays until edited; Business Details lists every one of them after a save, the product included (AUDIT-12 decision 37). `node _harness/isoclaims.js` counts the claims (it names places only for a withdrawn revision). |
| "RoHS compliant — entire line" (CLAIM-1) | Page Content → About — Certifications & Standards (2nd row), Homepage — Hero Trust Ticker, FAQ / Resources (the RoHS question), Products & Services Cards; Business Details → About Page (4th paragraph) | Is it true for every SKU? (Not in Company Claims, which holds other claims.) |
| AMS claims (CLAIM-3) | Page Content → Homepage — Hero Trust Ticker, About — Certifications & Standards, Industries Grid, Industries Page — Detail Sections, FAQ / Resources; Business Details → About Page | Which AMS specs IPC actually holds |
| FAQ #15, "Where can I download product data sheets?" (A-9.P5a-2) | Page Content → FAQ | Two errors in one answer: it says to click the "Data Sheet" button, which reads **"Datasheet"** (A10-043); and it promises a catalog PDF "on the Products page header and in the site footer" — there is no Products-page-header link at all, and the footer link appears only once a catalog PDF is set (Catalog & Brochure PDFs). The sentence has to change either way (GO-LIVE §A) |
| Certification marks, then spellings (A-9.P4-3, then A-9.P5a-5) | Products → Edit (nearly all: e.g. `U/L` ×65 in the catalog); Page Content for one `USFDA` | First settle A-9.P4-3: the catalog cites categories no body issues (`U/L Approved`, `UL Approved`, `CSA Approved`, `FDA Approved`, `GFR 21`). Then spell UL, CSA, MIL-SPEC, AMS, RoHS as on the certificates — in that order, or the spelling pass is done twice (GO-LIVE §A) |
| Two badge pairs (A-9.P5a-8 remainder) | Products → Edit | `Low Temperature Flexibility` vs `Low-Temperature Flexibility`, `125°C Rated` vs `Rated 125°C` — one product each, no majority; pick one (GO-LIVE §A) |
| Five products without a photograph (A-9.P4-8) | Products → Edit → Photo | `IP12GA-IP1274`, `IP13SP`, `IP25PU`, `IP30UV`, `IP47HV` show the branded "image coming soon" panel. Photograph them, or confirm the panel is what they should show |
| Commercial promises (claims register: inherited, unsourced) | Business Details (Minimum Order, Feet In Stock) / Page Content | 25M+ feet in stock, $50 minimum, same- or next-business-day shipping, custom work in a week or less, JIT programs, PPAP and IMDS packages, certificates of conformance — came from IPC's old site and nothing in this repo backs them. Still true? |
| Claims to confirm, reword or remove (AUDIT-12 decision 5: A12-L8-01-W5-3, A12-L8-W4-G1-1, A12-L8-W5-G5-1, A12-L8-W4-G1-2, A12-L8-W4-G5-2, A12-L8-01-10, A12-L8-04-4, A12-L8-W4-G5-1) | Page Content (Industries Grid / Detail Sections, Services, Hero, FAQ) | "Ford LP Approved Variants" (only Ford reference is `Ford Spec. LP390` on IP13SP); "M23053/8 QPL Available" and QPL "in stock" (IP35KY's sheet never says QPL); "entire line RoHS compliant" (2 of 42 products say RoHS); "Class C" for the 130°C vinyl-coated fiberglass sleeving (130°C is Class B); cable ties stocked (not among the 42 products); "Clean room environment" vs "clean environment"; services ship "in one week or less" vs the Hot-Stamp brochure's "one to two weeks"; CT called "Liquid-Tight … UL & CUL Listed" on Industries vs "Non-Metallic Electrical Conduit Tubing" on its own page. |
| Catalog edits to glance at, and data-sheet questions (AUDIT-12 decisions 2, 3, 4; open: A12-L8-01-4, A12-L8-06-1) | Products → Edit | 35 product records were changed to match their own data sheets on 2026-10-14 (specs, approval marks, families; IP33TW and IP33PO were the two High errors); the per-field list with the sheet line for each is in the commits `0b1b9cb`, `391d572`, `c0918a5`, `016ad21`. Still open, because the sheet is unclear: which IP1274 sheet is current (decision 3); IP33PO's 5" and 6" sizes (not on its sheet); IP30HS 5/16" recovered diameter; IP17TW's low limit (-70°C text vs -275°F spec); IP49VP tensile "+/- 5%"; IP69HT elongation "600 P.S.I."; IP3L cold brittleness 20°C (probably -20°C); CT "except where noted"; IP52EC operating temperature (now blank); IP55FL AMS-3632C (CLAIM-3); Slit Guard UL-94 V2 on the polypropylene version; IP10EX badge "U/L CSA Certified". |
| Minimum order (AUDIT-12 decision 14) | Business Details → Minimum Order; Page Content | Empty the box to say "no minimum". Four Page Content rows state the figure in their own words (Trust Bar Stats, a Hero Proof Point, the Trust Ticker, an FAQ) — edit those if it changes. |
| Privacy policy effective date | Page Content → Privacy | The date the policy takes effect |
| Privacy policy, Data Retention wording (AUDIT-12 decision 44, [A12-L14-W5-G4-1](audit-runs/audit12.md#a12-l14-w5-g4-1)) | Page Content → Privacy (3rd section) | The policy used to promise "we will remove it" with no way to do so. It now states the real procedure: the visitor emails IPC, and the record is removed by hand from the enquiry log (by the developer; Inquiries cannot delete) and from the sales inbox, with an email to confirm. **Rick approves this wording** or rewrites it; if the change counts as a policy revision, the effective date above moves with it. |
| Five site photos | Site Images & Logo | Replace the shipped placeholders where wanted |
| Social links | Business Details → Social | Only accounts IPC actually runs |
| Search-engine brand / manufacturer | Page Content → Company Claims → Search engines | IPC is a distributor. Correct or empty these if a product is not IPC-made. |

The handoff email (`Email to Rick - Admin Dashboard Handoff.md`) carries this
list in owner language. (2026-10-13: the rows for certification marks, badge
pairs, the five photo-less products and the commercial promises, and the
corrected screens for RoHS / AMS / "42", were added here from AUDIT-12 and are
not yet in the email.)

## Open — deploy day / the host ([GO-LIVE.md](GO-LIVE.md) §A–§C)

| Item | Note |
|---|---|
| Admin password | Set on the server through the `ALLOW-PASSWORD-RESET` flow (B4). Never upload a local `config.local.php`. This is also the rotation for the hash that is in git history (decided §1an). |
| TLS certificate, apex → `www` 301 | `SITE_ORIGIN`, `sitemap.php`, `index.php` and `robots.txt` all say `https://www.insulationproducts.com` |
| Remove the `/` → `/site/` redirect; afterwards delete `public_html/site/` | B2 step 0 and step 10. Check `/site/` for owner edits first. |
| PHP ≥ 7.4, `mod_rewrite`, `mod_access_compat` | §A; GO-LIVE C1 has the curl checks |
| **Upload `index.php` before `.htaccess`** | The new `.htaccess` sends every page to `index.php` (A-5.10) |
| `noreply@` mailbox; SPF / DKIM / DMARC; then `IPC_ENVELOPE_FROM` | In that order. Setting the envelope sender before SPF is right breaks every notification (DEP-2). |
| TRACE off | A host setting; `.htaccess` cannot do it |
| Proxy in front of PHP? then `IPC_TRUST_PROXY_FORWARDED` | GO-LIVE C4 compares Admin → Inquiries' Visitor IP with your own. Only if it shows the proxy, turn the switch on in `contact.php`; otherwise the quote form's rate limit is shared by every buyer (AUDIT-12 decision 43). Ships off. |
| `admin/`, `data/`, `pdfs/`, `uploads/` writable by PHP | README "Permissions". Done before `index.html` goes up (GO-LIVE B2 step 9, AUDIT-12 decision 41). The dashboard shows a banner when they are not. |

## Open — deferred by decision (not to be built without a new decision)

| Item | Decision | Held by |
|---|---|---|
| Page-header sub-lines on the gradient (20 — 18 until /datasheets was counted, AUDIT-12), plus the homepage closing quote band and the Services lead-time banner (AUDIT-12 decision 21: A12-L7-01-1, A12-L7-02-3, same gradient, held by `plan8-contrast` `UNOWNED_GRADIENT_MAX = 8`) | Keagan 2026-10-05: keep the header as it is for now; 2026-10-14: the band and banner join this deferral and are decided together with it. No text colour reaches AA on the `#119EC8` end of the gradient. (The spec-table headings were held here too until AUDIT-12 decision 20, 2026-10-14: each sits on ONE solid colour, and on solid `#119EC8` the dark ink is 5.92:1 — the "2.72:1" was the dark ink on the `#005da3` end (A12-L14-W1-G4-1). They now take the ink derived for their own surface, `--brand-accent-2-ink`; `plan8-contrast` `EXEMPT_BRAND_SURFACE` is ratcheted to 0.) The proposal on file is to darken that end to `#0e80a2` and make the sub-lines full ink (§1as). A before/after was rendered for the decision but never committed, so no image is on file (2026-10-13; this said "the image is in §1as"). The nearest regenerable picture is `node _harness/mockup-brandtext.js`'s `eyebrow-D-darker-gradient.png` (needs :8123), which darkens to `#0b4c66`, not to the proposed `#0e80a2`. | `plan5c-eyebrow` ratchet 20 |
| Pale-palette hero (13 surface-limited elements) | Applies only if the owner picks a very pale palette; it is 0 on navy | `smalltext1as` ratchet 13 |
| PLAN-7 slot 5 — catalog cover in the footer | Optional design addition, not a defect. Unblocked because a catalog PDF can now be uploaded (G1). | — |
| Real HTTP 404 for unknown routes | Not proposed. Unknown routes answer 200 + `noindex` by design (A5); changing that is a separate decision. | `prerender`, `prerender-apache` |
| Product `offers` (stock availability) in the search-engine data (A-9.P4-9, its `offers` half) | Added 2026-10-13 from AUDIT-12; undecided since audit 9 (`audit-runs/audit9.md` §5.2). Does IPC publish availability without a price? Recommended there: not until Rick says so — an `offers` block with no price is itself a Search Console warning, and publishing availability is a commercial commitment. | — |

## Open — cannot be verified in this environment

| Item | Why |
|---|---|
| `plan8-polish` C49 (16/17 on Linux) | Font metrics: DejaVu is ~21% wider than the Windows/macOS stack. Passes there. |
| `plan3-autoreply` on Windows | Needs a Windows host with an SMTP sink |
| `index.php` under PHP-FPM / CGI | Only mod_php is installed here; nothing in it is handler-specific |
| The `.htaccess` files and `public/.user.ini` under PHP-FPM / CGI | Added 2026-10-13 (AUDIT-12). Every real-Apache suite (`lowsE-apache`, `dep3-scriptblock`, `prerender-apache`) runs mod_php; `.user.ini` is read only under CGI/FastCGI/FPM (README "Verify after deploying"), so its limits and the handler-dependent `.htaccess` behaviour are measured on the host only, by GO-LIVE C1/C3 |
| How long each link unfurler caches a share card | Help says only "for a while" |

---

## Open — AUDIT-12 findings

From [audit-runs/audit12.md](audit-runs/audit12.md) (AUDIT_HEAD `f9d3089`, 2026-10-13): 529 confirmed. 503 were addressed on 2026-10-13/14 (PR #79). Each fix commit names the IDs it closes; the one exception is A12-L8-08-2 ("about 1 seconds"), which is fixed in `admin/config.php` but not named in a commit message. All 10 escalations are answered. The two Highs are in Settled: the old `/site/admin/` stays, and "Made in USA" is correct. The owner decisions below answer the other eight. Still open, 26: 10 wait on Rick (the claims and catalog rows in "waits on Rick"). 2 are the deferred gradient (decision 21). The other 14 are wording errors inside the frozen PLAN-10, PLAN-11 and PLAN-12 plan files, left as written because those plans are history, not instructions.

| ID | Severity | Class | Finding |
|---|---|---|---|
| [A12-L7-01-1](audit-runs/audit12.md#a12-l7-01-1) | Medium | decision | On the homepage's closing quote band, the 'Call … fax … or submit a quote request' line and the 'Browse Products →' button are too faint to read for a low-vision buyer (2.90:1 and 3.44:1 against the 4.5:1 minimum) |
| [A12-L8-01-4](audit-runs/audit12.md#a12-l8-01-4) | Medium | decision | Part IP1274 has two different spec sets on two catalog pages (low temperature, dielectric strength, colours), and the IP12GA page describes IP1274 and quotes a tensile figure its datasheet does not carry |
| [A12-L8-01-W5-3](audit-runs/audit12.md#a12-l8-01-w5-3) | Medium | data-live | The Industries page tells automotive buyers IPC carries 'Ford LP Approved Variants'. Nothing the site publishes shows a Ford approval: the only Ford reference is one line on the spiral-wrap datasheet (IP13SP), 'Ford Spec. LP390', and spiral wrap is not one of the automotive products listed |
| [A12-L8-04-4](audit-runs/audit12.md#a12-l8-04-4) | Medium | data-live | The Services page says every service ships in one week or less, but the Identification Markers brochure on the Hot-Stamp Marking card says orders "are normally shipped in one to two weeks" |
| [A12-L8-W4-G1-1](audit-runs/audit12.md#a12-l8-w4-g1-1) | Medium | data-live | The Industries page tells aerospace buyers 'M23053/8 QPL Available' and that QPL products are 'in stock'. The only M23053/8 part (Kynar, IP35KY) never mentions QPL on its datasheet. The one sheet that offers QPL tubing (IP34SR, M23053/6) says 'available upon request', and its product page leaves that line out. |
| [A12-L8-W4-G1-2](audit-runs/audit12.md#a12-l8-w4-g1-2) | Medium | data-live | The homepage and FAQ call the 130°C vinyl-coated fiberglass sleeving 'Class C', the insulation class above 180°C (130°C is Class B). The datasheet and product page give no class letter. |
| [A12-L8-W4-G5-1](audit-runs/audit12.md#a12-l8-w4-g5-1) | Medium | data-live | The Industries page sells marine buyers the CT conduit tubing as 'Nonmetallic Liquid-Tight Conduit Tubing' under 'UL & CUL Listed (Conduit system)'. CT's own page, its datasheet and the Datasheets list call it 'Non-Metallic Electrical Conduit Tubing', never liquid-tight, UL Recognized (not Listed) and CSA (not cUL). Only the CC/CCS/CC90 fittings are liquid-tight or Listed, and the FAQ lists CT among the 'liquid-tight conduit fittings'. |
| [A12-L8-W5-G5-1](audit-runs/audit12.md#a12-l8-w5-g5-1) | Medium | data-live | The homepage, About and FAQ say IPC's entire product line is RoHS compliant, but a buyer who filters the Product Index by RoHS is shown 2 of 42 products, and 40 product pages (IP33PO among them) say nothing about RoHS |
| [A12-L12-14-1](audit-runs/audit12.md#a12-l12-14-1) | Medium | doc | The audit plan's mutation step says a change under public/ only needs a re-sync, but a re-sync never copies public/ into the test site, so following it tests the unchanged file (step M had to throw those runs away) |
| [A12-L12-W4-G1-2](audit-runs/audit12.md#a12-l12-w4-g1-2) | Medium | doc | The audit-9 plan's check for password hashes committed to the public repo cannot find anything: as written, git stops with an error and prints nothing, which reads as the 'empty' pass the plan asks for, and audit 9 recorded the check done while a bcrypt hash was in the repo |
| [A12-L7-02-3](audit-runs/audit12.md#a12-l7-02-3) | Low | decision | The Services lead-time banner fails AA contrast (headline 3.90:1 on a phone, note line 2.66:1 / 3.23:1) and is held by no suite, while the record says the item that named it is closed |
| [A12-L8-01-10](audit-runs/audit12.md#a12-l8-01-10) | Low | data-live | The Services page says cutting is done in a 'Clean room environment'; the homepage and FAQ say only 'a clean environment' |
| [A12-L8-06-1](audit-runs/audit12.md#a12-l8-06-1) | Low | data-live | Two product pages give a spec in an impossible unit: Very Flexible Polyolefin (IP49VP) lists 'Tensile Strength: +/- 5%' and the heat-shrink tape (IP69HT) lists 'Tape Elongation: 600 P.S.I.' |
| [A12-L8-W4-G5-2](audit-runs/audit12.md#a12-l8-w4-g5-2) | Low | data-live | The homepage and FAQ say IPC carries cable ties (and the Hot-Stamp brochure says it keeps a 'large stock of tubing and cable ties'), while the homepage says '42 Products Stocked: Datasheet published for every one' and the Datasheets page says 'Every product IPC stocks has a published datasheet'. No cable tie is in the catalog, and a buyer who searches 'cable tie' is shown only Spiral Wrap, a product that says it is quicker than cable ties. |
| [A12-L12-01-4](audit-runs/audit12.md#a12-l12-01-4) | Low | doc | PLAN-10's header still says 'Status: ready to execute' although it was executed and verified closed in August |
| [A12-L12-01-7](audit-runs/audit12.md#a12-l12-01-7) | Low | doc | The audit plan's mutation step cannot be finished as written: after a src/ mutation, its restore step leaves the rebuilt bundle behind as an untracked file, and its last step, git worktree remove, then refuses to run |
| [A12-L12-10-2](audit-runs/audit12.md#a12-l12-10-2) | Low | doc | PLAN-10's finish-line check (`git diff --stat ... _localsite/`) no longer runs: git stops with a fatal error because that folder was deleted |
| [A12-L12-10-3](audit-runs/audit12.md#a12-l12-10-3) | Low | doc | PLAN-10 names IP38FE as a product whose size chart uses split sub-columns, but IP38FE's chart has four plain columns and never had sub-columns |
| [A12-L12-11-1](audit-runs/audit12.md#a12-l12-11-1) | Low | doc | The audit plan says its severity scale is copied unchanged from the last audit's, but the High definition was widened and every row was reworded |
| [A12-L12-12-1](audit-runs/audit12.md#a12-l12-12-1) | Low | doc | The audit-9 plan misquotes two of its own sources: it says AUDIT-11 found five non-reproducing numbers (the report says four) and cites sync.sh lines 47–48 for a folder-creation step that is on line 53 |
| [A12-L12-13-1](audit-runs/audit12.md#a12-l12-13-1) | Low | doc | The audit plan sends the reader to a section 12.7 for the proposed fix plan and for where fix-sketches go, but the plan has no section 12.7; the fix plan is section 7 of the report skeleton |
| [A12-L12-13-2](audit-runs/audit12.md#a12-l12-13-2) | Low | doc | The audit plan lists the ledger script's --check as a harmless 'fast gate', but running it rewrites the ledger from scratch and silently deletes every gap row the audit has added |
| [A12-L12-13-3](audit-runs/audit12.md#a12-l12-13-3) | Low | doc | The kept audit-9 plan's measured citations are wrong: two of the three suites it says need extra servers need none, and the sync.sh line it says was re-measured as 47–48 is line 53 |
| [A12-L12-14-3](audit-runs/audit12.md#a12-l12-14-3) | Low | doc | The audit plan promises each gap-hunt round uses a different method, but the script has only two or three methods per lens and cycles them, so rounds 3–5 repeat earlier methods — and every lens in waves 1–3 ran all five rounds |
| [A12-L12-14-6](audit-runs/audit12.md#a12-l12-14-6) | Low | doc | The audit plan tells the owner-journey agents to find the dashboard's messages by grepping "flash(", which matches nothing — the admin uses flash_redirect( and $flash[ in 30+ places |
| [A12-L12-15-2](audit-runs/audit12.md#a12-l12-15-2) | Low | doc | The audit plan says cross-wave duplicate findings are found from the --tally output by matching where and consequence, but --tally prints neither, so duplicates are counted twice in the numbers the report must paste from it |

### AUDIT-12 owner decisions — Keagan 2026-10-14: "Go with all of your recommended"

The 51 questions from the AUDIT-12 fix pass, each answered with its recommendation. Items that hand a fact to Rick (3, 5, and the approval in 44) stay open in "waits on Rick" until he answers. Item 21 keeps the gradient change deferred: the quote band and the Services banner join the existing header-gradient deferral.

| # | Question | Decision |
|---|---|---|
| 1 | Two fix batches were stopped mid-run (site pages/accessibility in App.jsx — 65 findings; test-suite fixes — 64 findings). Their partial work is set aside, not merged. Recommended: relaunch both. — Downside: another ~1–2 h of agent time and usage-limit exposure. | relaunch both. |
| 2 | Make each product page match its own datasheet where the datasheet is unambiguous (wrong specs, wrong units, typos copied from sheets, missing colours, wrong filters/categories): A12-L8-05-1 (IP33TW shows IP33PO specs, High), A12-L8-05-3 (IP33PO 600 vs 1300 V/mil + stray USP Class VI, High), A12-L8-05-2 (IP30HS walls), A12-L8-05-4 (PTFE "UL Recognized"/AMS 3585, Melt Wall AMS 3634), A12-L8-05-5, A12-L8-06-1, A12-L8-07-1, A12-L8-01-2 (IP10EX green), A12-L8-01-3 (-275°F ≠ -70°C), A12-L8-01-7 (USP I–VI is "meets", not an approval), A12-L8-01-8 (IPC65VC → IP65VC + typos), A12-L8-01-9, A12-L8-03-2, A12-L8-03-3 (IP55FL CSA), A12-L8-01-W5-1, A12-L8-01-W5-2, A12-L8-01-5 (MIL-SPEC filter), A12-L8-09-3, A12-L10-02-1 + A12-L10-W3-G5-1 + A12-L8-06-2 (products filed under the wrong family). Recommended: yes, I make the edits to match the datasheets and list every change for Rick to glance at. — Downside: if a datasheet itself is out of date, the page inherits its error. | yes, I make the edits to match the datasheets and list every change for Rick to glance at. |
| 3 | IP1274 has two different spec sets (A12-L8-01-4) — which sheet is current? Recommended: Rick names it; until then leave as is. | Rick names it; until then leave as is. |
| 4 | IP52EC end caps (A12-L8-03-1): the page shows the plugged-cap specs but its first Datasheet button is the molded cap. Recommended: make "Plugged Cap" the primary sheet (matches the page). — Downside: none if the page specs are right. | make "Plugged Cap" the primary sheet (matches the page). |
| 5 | Claims only Rick can confirm — keep, reword or remove each: "Ford LP Approved Variants" (A12-L8-01-W5-3), "M23053/8 QPL Available / in stock" (A12-L8-W4-G1-1), "entire line RoHS compliant" vs 2 of 42 products marked RoHS (A12-L8-W5-G5-1), "Class C" for 130°C sleeving — 130°C is Class B (A12-L8-W4-G1-2), cable ties stocked but not in the 42 products (A12-L8-W4-G5-2), "Clean room environment" vs "clean environment" (A12-L8-01-10), "ships in one week or less" vs brochure "one to two weeks" (A12-L8-04-4), CT conduit called "Liquid-Tight … UL & CUL Listed" on Industries (A12-L8-W4-G5-1). Recommended: send this list to Rick; I change each one his way. | send this list to Rick; I change each one his way. |
| 6 | "The same team, the same building, since 1974" homepage heading was written during this project, not by IPC (A12-L8-W4-G3-1). Recommended: replace with a neutral caption ("Bolingbrook, Illinois — our team and our building") unless Rick confirms it. | replace with a neutral caption ("Bolingbrook, Illinois — our team and our building") unless Rick confirms it. |
| 7 | Share card picture still says "ISO 9001 registered" baked into the image, so it stays even if Rick stops claiming ISO. Recommended: keep (ISO is currently claimed); redraw only if that changes. | keep (ISO is currently claimed); redraw only if that changes. |
| 8 | Half-finished FAQ rows (question with no answer) | hide them on the public FAQ (A12-L6-01-W5-2). |
| 9 | A claim Rick deleted reappears for a buyer whose page-content download fails (A12-L9-W5-G3-1) | the site never re-shows a claim the server page already left out. |
| 10 | A failed/slow catalog download replaces a product page the server already sent with "Catalog Unavailable" (A12-L5-W5-G3-1) and swaps the Google head (A12-L10-W5-G3-1) | keep the server-sent product page and head when the download fails. |
| 11 | The old phone number flashes until business details load, and stays if they fail (A12-L11-W3-G2-1) | server embeds the current details into the page. |
| 12 | Homepage still says "privately held, independent" after Rick clears that claim (A12-L14-W1-G3-1) | follow the claim box. |
| 13 | "AMS ####" shown as a MIL-SPEC mark (A12-L15-02-3) | show AMS as an ordinary feature, not a MIL-SPEC mark. |
| 14 | No way to say "no minimum order" (A12-L8-W5-G1-3) | make Minimum Order clearable; empty removes the sentence. |
| 15 | Changing City rewrites company history ("incorporated in …") (A12-L8-W5-G4-1) | history sentences and the timeline are never rewritten. |
| 16 | Without JavaScript, /contact promises an online form that isn't there (A12-L6-09-3) | add "the form needs JavaScript — call or email us". |
| 17 | Printed product pages carry no supplier name (A12-L6-W5-G4-2) | print the footer's name/phone/email. |
| 18 | Quote form: the buyer waits for the auto-reply email to send before seeing "received", and the form never times out (A12-L11-W3-G4-1) | answer the buyer first, send the auto-reply after; 30 s timeout that shows the phone number. |
| 19 | A dropped connection after sending makes a duplicate lead and a false error (A12-L4-W5-G3-1) | de-duplicate resubmits; error text says "it may already have arrived". |
| 20 | Pale-blue spec-table headings on 36 product pages — the deferral rests on a mis-measurement; dark text reaches 5.92:1 (A12-L14-W1-G4-1) | reopen and use the dark text the site's own picker already chooses. |
| 21 | Homepage quote band and Services lead-time banner fail contrast on the brand gradient (A12-L7-01-1, A12-L7-02-3) | add them to the existing deferred "header gradient" decision (darken `#119EC8` → `#0e80a2`) and decide all three together. |
| 22 | Product photos look soft on big screens — 32 of 37 are upscaled (A12-L11-W3-R1-7-3) and the About building photo (A12-L11-02-1) | cap each photo box at the photo's real size now; Rick supplies bigger photos later. |
| 23 | Uploaded PNG photos stay ~1.4 MB (A12-L11-W5-G1-2) | convert opaque PNGs to JPEG on upload. |
| 24 | Share-card size declared 400×300 for product photos that are other sizes (A12-L15-10-1) | measure the real size on the server. |
| 25 | `/index.html` still serves the old fixed page (A12-L10-W3-G3-1) | 301 to `/`. |
| 26 | After `/site/` is removed on deploy day, `/site` and `/site/` show "Page not found" (A12-L10-W5-G2-1) | 301 them to `/`, leaving `/site/admin/` alone (your decision to keep it running). |
| 27 | The photo "no program code" check refuses ~7% of genuine photos and still misses one form of code (A12-L11-W5-G1-1, A12-L3-02-1) | re-encode JPG/PNG/WEBP on upload (removes embedded code), scan only GIFs. |
| 28 | On hosts that lock the PHP cache, a new password says "changed" but doesn't take effect (A12-L2-W5-G4-1) | read the password file fresh when the cache can't be cleared. |
| 29 | Disk nearly full: a restore claims it can be undone when the safety backup failed (A12-L4-01-W5-1) | refuse the restore and say the disk is full. |
| 30 | Disk nearly full: ordinary saves when the backup fails (A12-L4-05-2) | save, and say plainly "this change can't be undone from Backups". |
| 31 | One wording for every "could not save" message across 9 pages (A12-L8-02-1) | one shared sentence, with a different one where the cause isn't permissions. |
| 32 | Page Content rows added/removed/moved are lost when he's signed out mid-edit (A12-L9-01-W5-1) | keep them in the browser and restore after sign-in. |
| 33 | Activity Log on phones (A12-L9-01-4) | narrow the time column so the details fit. |
| 34 | Duplicate SEO rows for one page — the second is silently ignored (A12-L10-W5-G4-1) | Page Content refuses a second row for the same page. |
| 35 | Misspelled picture names in the Site Images picker ("coulplings1.png") (A12-L8-09-5) | show friendly names; don't rename the files. |
| 36 | "ISO 9001:2015 Certified" typed in the ISO box (A12-L8-08-4) | Business Details warns that only "ISO 9001" or "ISO 9001:YYYY" is understood. |
| 37 | The VALUE-ADDED product's own text keeps "ISO 9001" after the ISO box is emptied (A12-L14-W5-G1-1) | list it in the dashboard's "still mentions ISO" list so Rick edits it. |
| 38 | Missing `admin/.htaccess` would expose the inquiry log (A12-L3-W5-G2-1) | dashboard banner (as for uploads). |
| 39 | Catalog & Brochure PDFs: an uploaded PDF is public immediately and can't be taken back from the dashboard (A12-L3-W5-G4-1) | add "Take off the website" (moves it to trash, like Remove PDF). |
| 40 | Wrong-type text in Page Content (only possible by FTP hand-edit) shows "Something went wrong" (A12-L5-01-W5-3) | fall back to the default (same rule as Business Details). |
| 41 | Leads in the gap between "site public" and "admin/ writable" are emailed but never logged (A12-L2-W5-G2-1) | move GO-LIVE B3 ahead of B2 step 9. |
| 42 | Write the inquiry log row before sending mail, so a host timeout can't lose a lead (A12-L4-W2-G4-1) | yes. |
| 43 | Is the host behind a proxy/CDN? If so the "5 per 10 minutes" limit applies to everyone at once (A12-L2-W5-G3-1) | add an off-by-default switch plus a GO-LIVE check of the visitor address; turn it on only if the check shows the proxy. |
| 44 | The privacy policy promises deleting a person's data on request, which nobody can do yet (A12-L14-W5-G4-1) | change the Data Retention wording to the real procedure (email us; we remove it by hand). Rick approves the wording. |
| 45 | 35 old AUDIT-10 probe scripts can never be retired under their current rule (A12-L13-01-W5-1) | retire them (keep `audit10-p7reverify.js`). |
| 46 | On phones, the catalog search box sits 1,690–1,985 px down, under the 42-product pill grid (A12-L6-02-1) | hide that pill grid on the phone catalog landing only (the family chips and the product cards stay). |
| 47 | The quote form's date hint "e.g. ASAP, end of month, or a specific date" is cut off on phones (A12-L6-13-2) | shorten it to "e.g. ASAP or a specific date" (Page Content box plus the built-in default). |
| 48 | All six homepage "Products & Services" cards open the same /products page (A12-L6-W3-G5-1) | add a link box to each card in Page Content (defaults: service cards → /services, ISO → /about, product cards → their family). |
| 49 | A pale Primary colour makes the phone product-page name unreadable, 2.1:1 (A12-L7-W3-G3-4) | Business Details warns about the palette instead of calling it "Readable". |
| 50 | /datasheets now lists 43 data sheets (IP52EC's Plugged Cap has its own card), while the homepage claims "42 — Datasheets Published" (CLAIM-2, already on Rick's list) | let the number follow the catalog, as CLAIM-2 already proposes. |
| 51 | With a pale Branding > Dark colour (e.g. #d0dcea), the phone menu's open sub-links fall to 2.96:1 (they are 7.15:1 on the shipped navy). The tightened `lowsC2-palettes` suite now shows this and stays red until it is fixed | work out that link colour against the menu background, the same way the menu's own text colour is already worked out. |

## Settled — do not reopen without new evidence

Recorded so a later session does not re-propose them. Each entry's reasoning
is in the history file at the § given.

| Topic | Settled as | § |
|---|---|---|
| Git history rewrite for the old exposed password hash | No. The repo stays public; the password set at deploy is the rotation. | 3, 1an |
| Per-page split of `src/App.jsx` | No. The abandoned `src/components|pages|lib` were deleted. | 3, 1o |
| Paid tooling | None ($0 budget) | 3 |
| Product URLs | `/products?productId=` (Option B); no `/products/:id` | PLAN-8 §0 |
| Prerender architecture | `public/index.php` front controller, porting `PageMeta`; `prerender.js` is the drift guard | 1ar |
| Small text in brand colours | Derived text-safe shades (`textSafeOnEach`), never hardcoded | 1as |
| Page header colours | Kept as shipped (above) | 1as |
| AUDIT-10 C/D | 31 fixed; 13 declined (A10-010, 015, 019, 025, 026, 036, 044, 047, 048, 052, 053, 054, 062) with reasons | 1at |
| FAQ chips at 390 | An edge fade, not wrapping (wrapping grew the sticky bar to 181 px) | 1at |
| `product-index-rows-over-120px` (3 of 42) | Declined | 2b |
| Product-page footer layout shift | Accepted (CLS 0.007–0.024, under 0.1) | 2b |
| Unknown routes | 200 + `noindex`, no canonical | A5, 1ar |
| `--brand-accent-text` `#0d7594`; `brand-gradient-mixed-ends` unchanged | Decided 2026-08-06 | 3 |
| "Made in USA Since 1974" (homepage, About) | Correct — Keagan 2026-10-13: no change. Closes AUDIT-12 A12-L8-01-1. | AUDIT-12 |
| Old site admin at `/site/admin/` | Keagan 2026-10-13: keep it running and skip its password change for now. AUDIT-12 A12-L3-W5-G2-2 stays open as a risk, not a task. | AUDIT-12 |

Corrections to the table above (rows left as written; dated here):

- **2026-10-13 (AUDIT-12 A12-L14-03-1):** "Product-page footer layout shift"
  — its record is history §2d, and the "Accepted" decision is in §1aq; §2b,
  as cited, does not mention it. Re-measured at AUDIT-12: CLS 0.022–0.024 on
  `IP12GA` / `IP33PO`, still under 0.1, so the decision stands.
- **2026-10-13 (AUDIT-12 A12-L14-W1-G2-1):** the `brand-gradient-mixed-ends`
  half of the last row is **superseded**: both strips it covered were changed —
  the Industries strip on 2026-09-28 (history §1ai) and the product-page header
  on 2026-09-29 (§1al) — and now derive their ink from the gradient, because the
  hard-coded navy the 2026-08-06 reason rested on was removed. On the shipped
  palette the ink is still white; on a pale palette it turns dark (`r3-shades`
  holds it). `--brand-accent-text` `#0d7594` stands as decided.

---

## What has been done — context

Between 2026-08-04 and 2026-10-06 the release went through audits 1–9,
AUDIT-10, AUDIT-11, the 2026-09-27 go-live audit and the 2026-10-05 admin
audit, with a remediation plan for each. Each line below is one stream of work. The
detail, the measurements and the self-corrections are in the history file at
the § given.

| When | What | § / PR |
|---|---|---|
| 2026-08-04 → 08-06 | Release baseline. Session 3 rebuilt the harness; Plans 0–5 covered the dev loop on real `data/`, SEO / canonicals / a crawlable link graph, owner safety, lead capture, accessibility, and image weight (9.1 MB → 2.7 MB). | 1, 1b, 4–4k |
| 2026-08-07 | Plan 5c (brand ink decisions) and PLAN-6 (social links, families made owner-editable) | 4l–4n |
| 2026-08-08 → 08-09 | PLAN-8 UI/UX remediation: tiers A/B, WCAG, severity C; PLAN-7 imagery; PLAN-9 | 1c–1j |
| 2026-08-11 → 08-13 | Help documents the whole dashboard. Doc-drift and section-number checks. Stale branches and files audited. Photos, page width, admin width. | 1k–1p |
| 2026-08-18 → 09-15 | Audits 5–9, every finding shipped or decided. The ISO claim was given one home and the shipping claim removed. | 1q–1aa |
| 2026-09-27 → 09-29 | Go-live readiness audit: DEP-3, SEC-2..5, ADM-3/7/9b, DEP-2, Lows A–F, C2 palettes, owner-docs map, Site Images & Logo page | 1ab–1am |
| 2026-10-02 | Go-live decisions (data fixes, 52 MP, data-file lock); hardcoded claims made editable (#71, #73) | 1an, 1ao |
| 2026-10-05 | Admin dashboard audit: every finding fixed, plus the Catalog & Brochure PDFs page (#74). ISO fully editable, a WHATS_LEFT truth pass and a documentation verification (#75). A-5.10: every route's head and a no-JS body served by `public/index.php` (#75). | 1ap–1ar |
| 2026-10-05 | Brand colours: derived text-safe shades for small text (#76) | 1as |
| 2026-10-06 | AUDIT-10 C/D: triage of 48 findings and 31 fixes, including the A10-059 sidebar-scroll regression (#77) | 1at |

**State of verification at the snapshot:**
- 123 sweep suites, tracked in `_harness/sweep-list.txt` since 2026-10-07 (121 until AUDIT-12 added two).
  (This line said 117. That was a miscount of a session note that put several
  names on one line; the last full sweep ran 120, i.e. 61 + 59.
  `isowaterfall` had never been in it and was added, 19/19.) The last full
  sweep was 61/61 + 58/59; the one red is `plan8-polish` C49, the font-metric
  item above.
- `lint.php` is green. `npm run build` reproduces the committed `dist/`.
- Real-Apache suites cover the `.htaccess` behaviour: `lowsE-apache`,
  `dep3-scriptblock` and `prerender-apache`.

---

## Done since 2026-10-07

*(Move items here as they close, newest first, with the PR.)*

| When | What | PR |
|---|---|---|
| 2026-10-14 | AUDIT-12 (`audit-runs/audit12.md`, 529 findings at `f9d3089`): fix pass of 438 findings in 10 batches, then the owner's 51 decisions ("all recommended") implemented in 5 batches plus the retirement of 34 AUDIT-10 probes. Full sweep 122/123 (the one red is `plan8-polish` C49); invariants 19/19, selftest 23/23. Open from it: the items above marked AUDIT-12. | #79 |
| 2026-10-07 | WHATS_LEFT reduced to what is open, with the history moved verbatim to `audit-runs/WHATS_LEFT-history.md`. The docs truth pass after #75–#77. `_harness/sweep-list.txt` tracked (121 suites). PLAN-12 written, with its four tested instruments. | this branch (`claude/zen-gates-p801fz`) |
