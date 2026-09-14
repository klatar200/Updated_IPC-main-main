# P5a — verbiage-public          agent: B1   started/finished: 2026-09-14 16:52 / 2026-09-14 17:50 UTC   mirror: none (file-based; crawl JSON consumed from I-crawl)
findings:   Blocker 0 · High 1 · Medium 2 · Low 8
| ID | sev | class | where | one line |
|---|---|---|---|---|
| A-9.P5a-1 | High | server | `content.json privacySections[5].content`; `src/App.jsx` `PRIVACY_SECTIONS` | The privacy policy states "Our website is served over HTTPS" and HTTPS does not work — STEP 0 measured an **expired** wildcard certificate for `*.hostingplatform.com` on both apex and www. |
| A-9.P5a-2 | Medium | data-live + code | `content.json faq[14].answer` | The FAQ tells a buyer to click a "Data Sheet" button in the product header and to find a catalog PDF on the Products page and in the footer; the header button says "Download PDF", and no catalog-PDF link renders anywhere. |
| A-9.P5a-3 | Medium | decision | `content.json copy.privacyHeader.effectiveDate` | The privacy policy's Effective Date is January 1, 2025 and the policy was substantively rewritten on 2026-08-28 (A-8.7/A-8.8), so it states an effective date 20 months before its current text. |
| A-9.P5a-4 | Low | data-live | `products-all.json` — 6 strings on 5 products | Rule 1 — six misspellings in the catalog: `agressive`, `apperance`, `availble`, `transparant` ×2, `Semrigid`. |
| A-9.P5a-5 | Low | data-live + code + doc | 18 of 42 product pages; `products-all.json`, `site-info.json`, `content.json` | Rule 4 — one mark, two spellings on the same page: 18 product pages render `U/L Approved` (spec table) and `UL Approved` (approval chip) together. Plus MIL-SPEC/MIL-Spec/Mil-Spec, RoHS/ROHS, `AMS 3587`/`AMS-3587`, USFDA/FDA. |
| A-9.P5a-6 | Low | code + data-live | `/products?productId=…`, all 42 | Rule 2/9 — one product page carries **five** link names for **two** destinations: "Request a Quote", "Request Quote", "Request a Quote →" all reach /contact, and "Download PDF" and "Data Sheet" both reach the same PDF. |
| A-9.P5a-7 | Low | code + data-live | `App.jsx:6807,6809,6839,6936-6938,8790,8806,10157`; `content.json stats[1].sub`, `faq[14]`, `seo[1]`, `seo[2]` | Rule 2 — "data sheet" has three public forms (`datasheet` / `data sheets` / `Data Sheet`) and "part identifier" has four (`Part Number`, `SKU`, `Part ID`, `part number`), on a site whose route is `/datasheets`. |
| A-9.P5a-8 | Low | data-live | `products-all.json` `badges[]` — 112 distinct strings over 42 products | Rule 2/3/4 — nine products carry the UL/CSA certification badge and spell it **seven** different ways (four joiners, two spellings of UL, three of MIL-SPEC); six more badge concepts are each written two ways. |
| A-9.P5a-9 | Low | code + data-live | `App.jsx:3046`, `IP42MW.description[2]`, `VT-1100`, `privacySections[0]`, 2 badges + 16 more | Rule 3 — typography mixed on the public surface: curly quotes in one string against straight quotes in eleven, `...` against `…`, a spaced en dash against an unspaced one inside one product, both Oxford-comma styles inside single sentences, and a trailing period on 2 of 158 badges and 29 of 317 spec values. |
| A-9.P5a-10 | Low | code | `/dashboard` | Rule 9 — 84 links on one page are all named "View Product →" with no `aria-label`; the name carries no product. |
| A-9.P5a-11 | Low | data-live + code | `content.json privacySections[0..2]`, `faq[10]`, `faq[18]`, `copy.contactForm.*`; `src/App.jsx:4500, 6851, 6887, 12102-12112` | Rule 2 — "enquiry" and "inquiry" are each used 10 times, and the privacy policy's Data Retention section uses **both in one sentence**: "Inquiry records … to answer your enquiry". |
ledger:     done E028, E029, E030, E031, E045, E046, E123–E134 (the twelve `copy.*` groups), E135–E148, E150, E151   blocked none
suites cited: none new — P5a is offline over the string inventory and the crawl JSON. Cited from `_harness/out/audit9/sweep-before.txt` for context only: `copydrift` / `copyroundtrip 15/15` (the `COPY_DEFAULTS` ↔ `content.php` contract holds, so a default and its data twin are the same string, which is why every `public-defaults` hit below has a `public-data` twin).
instruments: none new. Temporary tool: `npx --yes cspell@latest` (rule 1) — **not** added to `package.json`; nothing external received project data (cspell runs locally against local dictionaries).
artifacts:  `_harness/out/audit9/P5a/export.tsv` — the 4,411 P5a records as `surface⇥locator⇥text` (public-jsx 100, public-defaults 180, public-data 4,059, meta 72)
            `_harness/out/audit9/P5a/export.txt` — the same text, one string per line, as fed to cspell
            `_harness/out/audit9/P5a/rules2-5.txt` — every rule 2/3/4/5 count and hit list
            `_harness/out/audit9/P5a/rules7-9.txt` — rule 7 and rule 9 over the 67 crawled routes
            `_harness/out/audit9/P5a/badge-variants.txt` — the badge normalisation, A-9.P5a-8's computation
            `_harness/out/audit9/P5a/spell.md` — which checker ran, its 72 unknown words, and the disposition of every one
out of brief: `src/App.jsx:5292` and `:5590` — the two honeypot fields carry a visible `<label>Website</label>`; whether that reaches a screen reader is P9's surface, not verbiage.
out of brief: the public site has no terms-of-use, warranty or returns statement anywhere — 0 hits for `warrant|disclaim|liabilit|terms of (use|service)|governing law` across all 4,411 P5a strings (the 3 grep hits are product prose about reliability). Its absence is a business decision, not a verbiage defect.
[UNVERIFIED]/[UNSOURCED]: A-9.P5a-1's premise is C's STEP 0 measurement, which is itself `[UNVERIFIED — TLS]` for everything behind `https://` — the certificate expiry is verified (`Verify return code: 10`), what is behind it is not. No other `[UNVERIFIED]` — every other measurement here is offline over files this pass read directly.
self-corrections: 6, listed at the end of this file.
---

### A-9.P5a-1 — HIGH — the privacy policy promises HTTPS and HTTPS does not work

class:        server
pass:         P5a (rule 10)        ledger: E148
surface:      `/privacy` — *Data Security*, the last sentence
where:        `data/content.json` `privacySections[5].content`; the identical default at `src/App.jsx` `PRIVACY_SECTIONS` (verified byte-equal in P4 step 5).  (measured 2026-09-14)
not in §11:   checked GUARDRAILS §7–§7.3, `audit8.md` §2/§3a/§4/§5 (A-8.7 and A-8.8 are §1 *Information We Collect* and §3 *Data Retention*; §6 *Data Security* was not examined), `audit5.md`, `WHATS_LEFT.md` §2–3. C's STEP 0 records the **certificate** as a `server` observation; this record is the **policy sentence that depends on it**, a different `where:` and a different consequence — the certificate is a host problem, a privacy policy asserting a security control it does not have is a compliance problem. Cited, not duplicated.
reproduce:    ```
              node -e "console.log(require('./data/content.json').privacySections[5].content)"
              sed -n '/RESULT/,/Classification/p' _harness/out/audit9/step0.md
              ```
observed:     ```
              We take reasonable technical and organizational measures to protect the personal information you
              share with us against unauthorized access, loss, or misuse. Our website is served over HTTPS.
              ```
              against STEP 0 (`_harness/out/audit9/step0.md`, measured by C 2026-09-14 14:54–14:57 UTC):
              ```
              curl -sI https://www.insulationproducts.com/…  TLS FAILS: server presents CN=*.hostingplatform.com
                 (issuer Sectigo DV R36), EXPIRED, and not issued for this hostname.
                 openssl s_client … Verify return code: 10 (certificate has expired)
              curl -sI https://insulationproducts.com/  (apex)  same certificate, same failure
              curl -sI http://www.insulationproducts.com/  302 Found -> http://www.insulationproducts.com/site/
                 (NOT a 301 to https), and it already carries strict-transport-security: max-age=31536000
              ```
expected:     A privacy policy's security section states controls that are in place. This one names exactly one technical control and it is the one that is broken. It is also the only sentence in the seven sections that the reader can verify for themselves, in the address bar, in one second. The HSTS header makes it worse in the specific direction that matters: a browser that has once seen `max-age=31536000` over HTTPS will refuse the expired certificate outright rather than warn, so a returning visitor gets a hard failure, not a policy inaccuracy.
consequence:  Today: none — the site is not live (STEP 0), so nothing false is published. On deploy: the contact form — the site's entire lead path, and the thing the policy is about — either cannot be reached over HTTPS at all or is reached with a certificate error, while the policy the visitor is asked to accept says the connection is protected. Under §7.1 that is "a legal falsehood on a live page", i.e. **Blocker**, the moment the site is live with the certificate unfixed. It is recorded as High rather than Blocker because the site is not live and the fix is a host action that must happen before deploy regardless.
evidence:     `_harness/out/audit9/step0.md`; `data/content.json` `privacySections[5]`
verified-by:  pending V
outcome:      owner action (server): the host must issue a certificate for `insulationproducts.com` and `www.insulationproducts.com` **before** the first deploy, and the plain-HTTP 302 to `/site/` must become a 301 to `https://www.…`. This is the same host action C's STEP 0 already names; the addition here is that **the privacy policy is a dependency of it** — go-live with the certificate unfixed publishes a false statement in a legal document, so this sentence belongs on the runbook's pre-deploy gate, not its post-deploy checklist. The alternative (softening the sentence) is `decision` — legal text, PLAN-11 §7.3 — and is the wrong one: the control should exist.
fix-proof:    n/a — `server`, not fixed by this pass

---

### A-9.P5a-2 — MEDIUM — the FAQ sends the buyer to a button that is not there and to a catalog PDF that does not exist

class:        data-live + code
pass:         P5a (rules 2, 8-on-public, 9)        ledger: E141, E151
surface:      `/faq` → *Where can I download product data sheets?*; the controls it names are on `/products?productId=…` and in the footer
where:        `data/content.json` `faq[14].answer` (Page Content → FAQ). The controls: `src/App.jsx:8739` (product header, label `Download PDF`), `src/App.jsx:9849` (sticky bar, label `Data Sheet`), `src/App.jsx:12607` (footer catalog link, rendered only when `isSafeLinkUrl(site.catalogPdfUrl)`), `data/site-info.json` `catalogPdfUrl` = `""`.  (measured 2026-09-14)
not in §11:   checked GUARDRAILS §7–§7.3, `audit7.md` §3–4, `audit8.md` §2–5, `UX_AUDIT_PREPROD` F1–F17, `WHATS_LEFT.md` §2–3. `WHATS_LEFT.md` NB18 (quoted verbatim in the code comment at `src/App.jsx:12601-12606`) recorded the *footer* half and chose to wire the field rather than change the sentence — "Either the field or the sentence had to go; the field is the one Rick can fill in." The field is still empty at go-live, and the **Products-page half and the button-name half were never examined**. New in substance, with the empty field as the new dated evidence.
reproduce:    ```
              node -e "console.log(require('./data/content.json').faq[14].answer)"
              node -e "console.log('catalogPdfUrl =', JSON.stringify(require('./data/site-info.json').catalogPdfUrl))"
              node -e "const j=require('./_harness/out/audit9/I-crawl/product-IP35KY/1440x900.json');
                       j.links.filter(l=>/pdf|data ?sheet/i.test((l.text||'')+(l.href||''))).forEach(l=>console.log(JSON.stringify(l.text),'->',l.href))"
              node -e "const j=require('./_harness/out/audit9/I-crawl/products/1440x900.json');
                       console.log('catalog-PDF links on /products:',
                         j.links.filter(l=>/catalog|\.pdf/i.test((l.text||'')+(l.href||''))).map(l=>l.text+' -> '+l.href), 'of', j.links.length, 'links')"
              grep -n 'Download PDF' src/App.jsx; grep -n '"Data Sheet"\|Data Sheet$' src/App.jsx
              ```
observed:     ```
              faq[14].answer:
                "Individual product data sheets are available on each product's detail page — click the
                 'Data Sheet' button in the product header. A link to the full IPC product catalog PDF is
                 available on the Products page header and in the site footer."

              catalogPdfUrl = ""

              product page IP35KY:
                "Download PDF (opens in a new tab)" -> /pdfs/IP35KY.pdf     <- src/App.jsx:8739, the HEADER
                "Data Sheet (opens in a new tab)"   -> /pdfs/IP35KY.pdf     <- src/App.jsx:9849, the STICKY BAR

              catalog-PDF links on /products: [ 'Product Catalog -> /products' ]  of 104 links
              ```
              `src/App.jsx:9849` is inside the sticky RFQ bar — `position: "fixed"`, `transform: showStickyBar ? "translateY(0)" : "translateY(110%)"` — so the only control a visitor sees when the product page first paints is the one labelled **Download PDF**. The footer block at `src/App.jsx:12607` is `isSafeLinkUrl(site.catalogPdfUrl) ? (…) : null`, and `catalogPdfUrl` is `""`, so nothing renders there either.
expected:     Three separate things, all in one 46-word answer. (1) The control named in the header is labelled `Download PDF`, not `Data Sheet`. (2) There is no catalog-PDF link on the Products page header at all — the only "Product Catalog" link on `/products` points back at `/products`. (3) The footer link exists in code but is gated on a field that ships empty. An instruction that names a control has to name the control that is there (P5 rule 8, applied to a public FAQ answer rather than to `help.php`).
consequence:  This is the FAQ entry a buyer opens precisely because they could not find the datasheet. It tells them to look for a label that is not in the place it says, and then sends them twice to a PDF that does not exist. The datasheet button *is* findable (it is the obvious yellow control in the header), so there is a workaround — Medium, not High. The catalog-PDF half has no workaround: there is nothing to find.
evidence:     `_harness/out/audit9/I-crawl/product-IP35KY/1440x900.json`; `_harness/out/audit9/I-crawl/products/1440x900.json`; `_harness/out/audit9/P5a/rules2-5.txt` § data sheet
verified-by:  pending V
outcome:      owner action + fix candidate. `faq[14].answer` is Page Content → FAQ and is Rick's to edit; the sentence should name `Download PDF` and should not promise a catalog PDF until `catalogPdfUrl` is filled in on Business Details. Alternatively C makes the two product-page labels agree (that half is `code`, and A-9.P5a-6 covers the same two strings), which resolves (1) without a data edit. (2) and (3) need either the catalog PDF or the sentence.
fix-proof:    n/a

---

### A-9.P5a-3 — MEDIUM — the privacy policy's effective date is 20 months older than the policy

class:        decision
pass:         P5a (rule 10)        ledger: E148
surface:      `/privacy`, the line under the page title
where:        `data/content.json` `copy.privacyHeader.effectiveDate` = `"January 1, 2025"`, rendered at `src/App.jsx:12162` as `Effective Date: {c.effectiveDate}`; default at `src/App.jsx:6827`.  (measured 2026-09-14)
not in §11:   checked GUARDRAILS §7–§7.3, `audit8.md` §2–5, `WHATS_LEFT.md` §2–3. `WHATS_LEFT.md:65` item **4.10** is the closest: it fixed "Privacy page reports today's date every day" and its 2026-08-05 amendment records the rendered string as `Effective Date: January 1, 2025` — correct **at that date**. The new dated evidence (§10.2 rule 7) is `audit8.md` §3a: the policy's §1 and §3 were substantively rewritten on **2026-08-28**, three weeks after 4.10 was amended, and the date did not move. 4.10 is about the date being *derived*; this is about the date being *wrong*.
reproduce:    ```
              node -e "console.log(require('./data/content.json').copy.privacyHeader.effectiveDate)"
              grep -n 'effectiveDate' src/App.jsx
              grep -n 'FIXED 2026-08-28' audit-runs/audit8.md
              ```
observed:     ```
              January 1, 2025
              src/App.jsx:6827:    effectiveDate: "January 1, 2025",
              src/App.jsx:12162:            Effective Date: {c.effectiveDate}
              audit-runs/audit8.md:  **FIXED 2026-08-28**, at the owner's instruction, in both copies — see §3a.   (A-8.7)
              audit-runs/audit8.md:  **FIXED 2026-08-28**, at the owner's instruction — the sentence now describes … (A-8.8)
              ```
              The two 2026-08-28 edits are not editorial: A-8.7 added the disclosure that every submission's IP address is recorded, including on rejected submissions, and A-8.8 replaced a promised three-year retention ceiling with "They are not deleted automatically." Both are material changes to what the policy tells a data subject.
expected:     An effective date is the date the current text took effect. This one predates the current text by 20 months, and it predates the site's own first deploy — the site is not live yet (STEP 0), so no version of this policy has ever been in effect on January 1, 2025. Under GDPR Art. 12 and CCPA §1798.130, a policy's date is how a data subject knows which version they were shown; a stale one is the part of the document a regulator or a customer's compliance team checks first because it is the only machine-checkable claim in it.
consequence:  A purchasing or compliance person diffing IPC's policy against the one they have on file sees a date that says nothing changed since January 2025, while the substance of the collection and retention sections did change. The information in the policy is correct (P4 step 5 verified both A-8.7 and A-8.8 texts are present); the metadata about it is not.
evidence:     `data/content.json` `copy.privacyHeader.effectiveDate`; `audit-runs/audit8.md` §3a; `_harness/out/audit9/P4/leaves-report.txt`
verified-by:  pending V
outcome:      escalated: `decision-needed: what date does the current privacy policy take effect | recommended: the go-live date, set on Page Content → Privacy → Effective Date at the same time as the first deploy | why: the text was materially rewritten on 2026-08-28 and no version has ever been in effect on the printed date | trade-off: a date in the future is wrong too, so it has to be set at deploy rather than now, which means it is a runbook step and not a code change | blocked: legal text — PLAN-11 §7.3 and P5 rule 10 both put the wording and the date on the owner's side`
fix-proof:    n/a — never edited by this pass (rule 10)

---

### A-9.P5a-4 — LOW — six misspellings in the catalog

class:        data-live
pass:         P5a (rule 1)        ledger: E095 (P4's), E151
surface:      product pages `IP69HT`, `IP63ES`, `IP44A2-IP45A3`, `IP35KY`, `IP55FL`
where:        `data/products-all.json`, all editable on Products → Edit.  (measured 2026-09-14)
not in §11:   checked GUARDRAILS §7–§7.3 and all four prior `audit-runs/audit<n>.md` — no spelling pass has ever been run over `data/`; `grep -rn "agressive\|apperance\|availble\|transparant\|Semrigid" audit-runs/ plans/` → no hits. New.
reproduce:    ```
              node -e "const fs=require('fs');const a=require('./_harness/out/audit9/I-strings/audit9-strings.json');
              fs.writeFileSync('/tmp/p5a.txt', a.filter(r=>['public-jsx','public-defaults','public-data','meta'].includes(r.surface))
                .map(r=>String(r.text).replace(/\s+/g,' ')).join('\n'))"
              npx --yes cspell@latest --no-progress --no-summary --unique --wordsOnly /tmp/p5a.txt
              grep -inE 'agressive|apperance|availble|transparant|Semrigid' _harness/out/audit9/P5a/export.tsv
              ```
observed:     `which hunspell aspell` → **neither is installed**, so the brief's fallback ran: **cspell (latest, via `npx --yes`, not added to `package.json`)**. 72 unknown words over 4,411 strings; every one dispositioned in `_harness/out/audit9/P5a/spell.md`. Six are typos:
              ```
              IP69HT.caption                     "…thick agressive adhesive…"            -> aggressive
              IP63ES.description[0]              "…apperance…"                            -> appearance
              IP44A2-IP45A3.description[3]       "The tubing is availble in…"             -> available
              IP35KY.specTable1.rows[7].value    "Clear (transparant) and Black"          -> transparent
              IP55FL.specTable1.rows[7].value    "Clear (transparant) and Black"          -> transparent
              IP35KY.badges[0]                   "Semrigid"                               -> Semi-Rigid (the form the other two products use)
              ```
              The remaining 66 are industry vocabulary and proper nouns and are **not** findings: `Polyolefin`, `PVDF`, `Kynar`, `PTFE`, `Nomex`, `Viton`, `Fluoroelastomer`, `Layflat`, `Gasketing`, `Methacrylates`, `Threadlockers`, `Cleanroom`, `Roundit`, `Subform`, `Bolingbrook`, `PPAP`, `IMDS`, `NEMA`, `ASTM`, `CCPA`, `Googlebot`, `webp`, `noindex`, `durometer`, `weatherometer`, … — the word list the brief asks for, had one existed.
expected:     Five of the six are on the spec surface (a caption, a description, two spec-table values and a chip). `Semrigid` is the one that is not merely a typo: it is a **badge**, so it renders as a chip next to `IP34SR`'s and `IP3L`'s correctly-spelled `Semi-Rigid`.
consequence:  Low. A buyer qualifying a spec-grade supplier reads "transparant" in a spec-table value and "Semrigid" on a product chip. It does not mislead; it erodes the thing the whole catalog is trying to establish.
evidence:     `_harness/out/audit9/P5a/spell.md`; `_harness/out/audit9/P5a/export.tsv`
verified-by:  pending V — sample 3 of 6 (V's pick; `Semrigid`, `availble` and either `transparant` are the cheapest)
outcome:      owner action: Products → Edit → the five SKUs. `data/*.json` is outside what C may fix (PLAN-11 §7.3, GUARDRAILS §2).
fix-proof:    n/a

---

### A-9.P5a-5 — LOW — one certification mark, two spellings, on the same page, on 18 of 42 product pages

class:        data-live + code + doc
pass:         P5a (rule 4)        ledger: E095, E143, E151
surface:      18 product pages; `/about`; the `certs` and `heroTrust` rows on `/`
where:        `data/products-all.json` spec rows and badges (`U/L …`, Products → Edit) against `src/App.jsx:2763-2775` `APPROVALS`, whose derived chip names are `UL Recognized` / `UL Listed` / `UL Approved` / `cUL`. Mirrored in `admin/config.php` `IPC_APPROVALS` (`lint.php` holds the two in sync — `approval drift  12 approvals, PHP and JS identical`, `_harness/out/audit9/lint-before.txt:6`).  (measured 2026-09-14)
not in §11:   checked GUARDRAILS §7–§7.3, `audit8.md` A-8.5 (ISO **revision** strings), `audit7.md` §3–4, `WHATS_LEFT.md` §2–3. A-9.P4-3 in this audit covers the **category names that do not exist** (`U/L Approved` as a UL programme); this record covers only the **spelling of the mark** and does not repeat it.
reproduce:    ```
              node -e "const fs=require('fs'),D='./_harness/out/audit9/I-crawl/';
              const idx=require(D+'index.json');
              const s=[...new Set(idx.pages.filter(p=>p.slug.startsWith('product-')).map(p=>p.slug))];
              const both=s.filter(x=>{const a=JSON.parse(fs.readFileSync(D+x+'/1440x900.json','utf8')).ariaSnapshot||'';
                return /U\/L\b/.test(a) && /\bUL[ -]/.test(a);});
              console.log(both.length+' of '+s.length+':', both.map(x=>x.replace('product-','')).join(', '));"
              ```
observed:     ```
              18 of 42: IP10EX, IP13SP, IP17TW-IP18SW-IP19LW, IP30HS, IP32IP, IP33PO, IP33TW, IP34SR, IP35KY,
                        IP37SH-IP36TH-IP39LH, IP3L, IP42MW, IP44A2-IP45A3, IP47HV, IP55FL, IP61ES-IP62EF,
                        IP63ES, IP64FS-IP65VC-IP66AC-IP67SC
              IP42MW rendered UL forms: ["UL Approved", "U/L Approved"]
              ```
              Counts over the whole P5a surface (`_harness/out/audit9/P5a/rules2-5.txt` § RULE 4): `U/L` **65** · `UL` **23**; `MIL-SPEC` **13** · `MIL-Spec` **3** · `Mil-Spec` **2**; `RoHS` **14** · `ROHS` **1** (`IP29CG.specTable1.rows[0].value`); `AMS 3585/3631/3634/3636/3638/3651/3653/3654/3655` spaced but `AMS-3587`, `AMS-3632C`, `AMS-3653` hyphenated; `USFDA` **2** against `FDA` everywhere else. `CSA` **38/38** one form, `PPAP` **13/13**, `IMDS` **11/11**, `PVC` **32/32**, `VW-1` **26/26** — those five are clean.
expected:     Appendix B: "certification — one spelling/case each; hyphenation consistent." The mechanism is what makes this unavoidable rather than merely untidy: the chip row is **derived from the product's own text** by `APPROVALS`, and it normalises to `UL …` while the text it derived from says `U/L …`. So a product page cannot avoid showing both unless the data uses the same form the whitelist does. `UL` is the registered form of the mark.
consequence:  Low (§7.1: verbiage). Two spellings of the same certification a few hundred pixels apart on the page a quality engineer is reading to decide whether IPC's paperwork is trustworthy.
evidence:     `_harness/out/audit9/P5a/rules2-5.txt` § RULE 4; `_harness/out/audit9/P4/cert-spellings.txt` (105 distinct forms in the catalog)
verified-by:  pending V — sample 3 of 18 (`IP42MW`, `IP35KY`, `IP3L`)
outcome:      owner action: normalise `U/L` → `UL`, `Mil-Spec`/`MIL-Spec`/`MIL-Spec.` → `MIL-SPEC`, `ROHS` → `RoHS`, `AMS-nnnn` → `AMS nnnn`, `USFDA` → `FDA` on Products → Edit. **Batched with A-9.P4-3** — the same strings on the same screen, and A-9.P4-3's correction has to be made first because it changes which mark the string names; a spelling pass done first would have to be redone. Not C's to fix (`data/*.json`).
fix-proof:    n/a

---

### A-9.P5a-6 — LOW — a product page offers five differently-named links to two destinations

class:        code + data-live
pass:         P5a (rules 2, 9)        ledger: E046, E134, E151
surface:      all 42 `/products?productId=…`
where:        `src/App.jsx` — navbar CTA "Request a Quote" → `/contact`; product header `Request Quote` → `/contact?part=…`; sticky bar `Request a Quote →` → `/contact?part=…`; product header `Download PDF` (`:8739`) and sticky bar `Data Sheet` (`:9849`) both → the same `/pdfs/<SKU>.pdf`.  (measured 2026-09-14)
not in §11:   checked GUARDRAILS §7–§7.3 — §7.2 refutes *"The RFQ link loses product context"* (a selector artifact; the detail-page button does carry `?part=`, which this record confirms rather than contradicts). `audit7.md`, `audit8.md`, `UX_AUDIT_PREPROD` F1–F17, `WHATS_LEFT.md` §2–3: no hits for the link **naming**. New.
reproduce:    ```
              node -e "const j=require('./_harness/out/audit9/I-crawl/product-IP35KY/1440x900.json');
              j.links.map((l,i)=>({i,t:(l.text||'').trim(),h:l.href}))
               .filter(x=>/Download PDF|Data Sheet|Request/.test(x.t))
               .forEach(x=>console.log(String(x.i).padStart(3), JSON.stringify(x.t), '->', x.h));"
              ```
observed:     ```
                3 "Request a Quote"                  -> /contact
               53 "Download PDF (opens in a new tab)" -> /pdfs/IP35KY.pdf
               54 "Request Quote"                     -> /contact?part=IP35KY
               55 "Data Sheet (opens in a new tab)"   -> /pdfs/IP35KY.pdf
               56 "Request a Quote →"                 -> /contact?part=IP35KY
              ```
              Site-wide (`_harness/out/audit9/P5a/rules7-9.txt`): `"Request a Quote →"` reaches 48 destinations, `"Request Quote"` 42, `"Download PDF (opens in a new tab)"` 40 and `"Data Sheet (opens in a new tab)"` 40 — the last two being the same 40 files under two names.
expected:     Appendix B: "quote — buttons one form"; "data sheet — one public prose form". Rule 9: a link name should be meaningful out of context, and two names for one destination on one page is the inverse failure — the reader cannot tell whether they are different things. The `(opens in a new tab)` suffix is a deliberate `sr-only` span and is correct; it is the visible half that differs.
consequence:  Low. A buyer on a product page sees three quote controls with three names and two PDF controls with two names, and has to work out that there are only two things. It is also why `faq[14]` is wrong (A-9.P5a-2): with two labels for the datasheet, the FAQ picked the one that is not in the header.
evidence:     `_harness/out/audit9/I-crawl/product-IP35KY/1440x900.json`; `_harness/out/audit9/P5a/rules7-9.txt`
verified-by:  pending V — sample 3 of 42 (any three product routes; the crawl JSON has all 42)
outcome:      fix candidate for C — `code`: make the two PDF labels one form (`Data Sheet`, which matches the `/datasheets` route and `faq[14]`) and the two in-page quote labels one form. The navbar CTA legitimately differs in destination (`/contact` with no part) and should keep a distinguishable name. The `pdfLabel` override (`IP52EC` → "Molded Cap") must survive — it is the one product with two PDFs and needs two names.
fix-proof:    n/a

---

### A-9.P5a-7 — LOW — "data sheet" has three public forms and "part identifier" has four

class:        code + data-live
pass:         P5a (rule 2)        ledger: E123–E134, E141, E149, E151
surface:      `/datasheets`, `/products`, `/dashboard`, `/contact`, `/faq`, and the meta descriptions of three routes
where:        **data sheet** — one word: `COPY_DEFAULTS.datasheetsHeader.title`/`.intro` (`App.jsx:6807`, `:6809`), `COPY_DEFAULTS.nav.datasheets` (`:6839`), `SEO_DEFAULT[3]` (`:6938`), `content.json stats[1].sub`, `App.jsx:3043`, `:3046`, `:3004`. Two words: `SEO_DEFAULT[1]`/`[2]` (`:6936`, `:6937`), `content.json seo[1].desc`/`seo[2].desc`, `faq[2].answer`, `faq[14].question`/`.answer`, `App.jsx:10157`. Two words title-case: `App.jsx:8790`, `:8806`, `:9849`, `faq[14].answer`.
              **part identifier** — `Part Number / SKU` (`COPY_DEFAULTS.contactForm.partLabel`, the `/contact` field label), `Part ID` (`DASHBOARD_COLS`, `src/App.jsx:10003`, the `/dashboard` column header), `part number` (19 occurrences in prose), `SKU` (4).  (measured 2026-09-14)
not in §11:   checked GUARDRAILS §7–§7.3, all four prior audits, `UX_AUDIT_PREPROD` F1–F17, `WHATS_LEFT.md` §2–3. New — Appendix B names both pairs as seeds and says the route is to be "measured, not assumed".
reproduce:    ```
              grep -nE 'data ?sheet|datasheet' -i _harness/out/audit9/P5a/export.tsv | cut -c1-150
              node -e "const j=require('./_harness/out/audit9/I-crawl/dashboard/1440x900.json');
                       console.log([...new Set((j.ariaSnapshot||'').match(/columnheader \"[^\"]*\"/g))].join(' '))"
              node -e "const j=require('./_harness/out/audit9/I-crawl/contact/1440x900.json');
                       console.log((j.ariaSnapshot||'').split('\n').filter(l=>/textbox/.test(l)).map(s=>s.trim()).join('\n'))"
              ```
observed:     ```
              one word   (datasheet/Datasheets): 13 strings, including the ROUTE (/datasheets), the nav label,
                                                 the page H1, that page's own meta description, and stats[1].sub
              two words  (data sheets):          7 strings, including seo[1].desc and seo[2].desc — the meta
                                                 descriptions of /products and /dashboard
              two words, title case (Data Sheet): 4 strings, including the sticky-bar control on all 42 product pages

              /dashboard columnheaders: "Product Name" "Part ID" "Part Type" "Description" "Temp" "Specifications" "Action"
              /contact  textbox "Part Number / SKU":
              ```
expected:     Appendix B, both rows. The measured majority for the concept is the **one-word** form and the route settles it: the URL is `/datasheets`, the nav says `Datasheets`, the page title says `Datasheets`. The two-word form survives in exactly the places a buyer meets first — the Google snippet for `/products` and `/dashboard` — and the title-case form is the control label on every product page. For the part identifier the site itself is the strongest evidence that one form is needed: `/contact`'s label hedges with a slash (`Part Number / SKU`) because there was no single answer.
consequence:  Low. Nothing is wrong, nothing is unfindable; the site reads as though written by three people, on the surface that is selling precision.
evidence:     `_harness/out/audit9/P5a/rules2-5.txt` § RULE 2 (the full locator list, 20 rows)
verified-by:  pending V — sample 3 of 24 (V's pick; `seo[1].desc`, `App.jsx:6938` and `faq[14].question` show all three forms)
outcome:      fix candidate for C for the hardcoded half (`code`: `SEO_DEFAULT[1]`/`[2]`, `App.jsx:10157`, `:8790`, `:8806`, `:9849`); the `content.json` half (`seo[1]`, `seo[2]`, `faq[2]`, `faq[14]`, `stats[1].sub`) is `data-live` and is Rick's on Page Content. Note the ordering dependency with A-9.P5a-2: `faq[14]` has to be rewritten anyway.
fix-proof:    n/a

---

### A-9.P5a-8 — LOW — six badge concepts are each written two ways

class:        data-live
pass:         P5a (rules 2, 4)        ledger: E095, E151
surface:      the chip row on the product pages named below, and the same chips on `/products` cards
where:        `data/products-all.json` `badges[]`, Products → Edit. 112 distinct badge strings over 42 products (3 or 4 each).  (measured 2026-09-14)
not in §11:   checked GUARDRAILS §7–§7.3, prior audits, `WHATS_LEFT.md` §2–3 — `badges` has never been audited as prose; `audit4.md`'s catalog-integrity line counts SKUs, PDFs and images and does not look at badge text. New.
reproduce:    ```
              node -e "const p=require('./data/products-all.json'); const b={};
              p.forEach(x=>(x.badges||[]).forEach(v=>{(b[v]=b[v]||[]).push(x.sku)}));
              const n=s=>s.toLowerCase().replace(/[^a-z0-9]/g,''); const g={};
              Object.keys(b).forEach(k=>{(g[n(k)]=g[n(k)]||[]).push(k)});
              Object.values(g).filter(v=>v.length>1)
                .forEach(v=>console.log(v.map(x=>JSON.stringify(x)+' ['+b[x].join(',')+']').join('   vs   ')));"
              node -e "require('./data/products-all.json').forEach(p=>(p.badges||[]).forEach(b=>{
                if(/U\/?L/.test(b) && /CSA|MIL/i.test(b)) console.log(p.sku, JSON.stringify(b)); }))"
              ```
observed:     ```
              "Low Temperature Flexibility" [IP1274]   vs   "Low-Temperature Flexibility" [IP25PU]
              "U/L CSA MIL-Spec." [IP30HS]             vs   "U/L CSA MIL-Spec" [IP34SR]
              "Semi-Rigid" [IP34SR,IP3L]               vs   "Semi-rigid" [IP42MW]
              "Environmental Protection" [IP46MD]      vs   "Environmental protection" [IP47HV]
              ```
              plus two the normaliser cannot see because the words are reordered or abbreviated, taken from the same census:
              ```
              "125°C Rated" [IP61ES-IP62EF]            vs   "Rated 125°C" [IP63ES]
              "Low Shrink Temperature" [IP29CG,IP30HS,IP30UV,IP49VP]  vs  "Low Shrink Temp" [IP3L]
              ```
              and `Semrigid` [IP35KY], which is A-9.P5a-4's typo and the third member of the `Semi-Rigid` family.

              **The worst case is the UL/CSA certification badge: nine products carry it and no two spell it the same way.**
              ```
              IP10EX          "U/L CSA Certified"
              IP30HS          "U/L CSA MIL-Spec."      <- trailing period
              IP32IP          "U/L CSA and MIL-SPEC"   <- "and" joiner, MIL-SPEC caps
              IP33PO          "U/L, MIL-Spec."         <- comma joiner, trailing period
              IP33TW          "U/L and CSA"            <- "and" joiner
              IP34SR          "U/L CSA MIL-Spec"       <- space joiner, no period
              IP35KY          "U/L CSA"
              IP61ES-IP62EF   "U/L CSA"
              VT-1100         "UL & CSA Approved"      <- "&" joiner, UL not U/L
              ```
              Seven distinct renderings of one list of marks, across four joiners (space, comma, "and", "&"),
              two spellings of UL and three of MIL-SPEC. Across all 158 badges the joiner split is 3 × `&`
              against 6 × "and".

              Full computation, including the 45 near-duplicate pairs that are **not** findings because they are genuinely different concepts (`Flexible` vs `Highly Flexible`, `Flame Retardant` vs `Highly Flame Retardant`): `_harness/out/audit9/P5a/badge-variants.txt`.
expected:     One form per concept. The badge is a marketing chip, not a spec, so the bar is consistency rather than accuracy — but `IP46MD` and `IP47HV` are adjacent products in the same family, and their chip rows differ only in the case of one letter.
consequence:  Low (§7.1: verbiage). Visible to someone comparing two products, which is what `/products` and `/dashboard` are for — and the UL/CSA badge is the one a purchasing person compares deliberately, because it is the chip that says what the part is approved to.
evidence:     `_harness/out/audit9/P5a/badge-variants.txt`; `_harness/out/audit9/P4/shape-report.txt` § badges
verified-by:  pending V — sample 3 of 6 (`Semi-Rigid`/`Semi-rigid`, `Environmental Protection`/`Environmental protection`, `125°C Rated`/`Rated 125°C`)
outcome:      owner action: Products → Edit. Batched with A-9.P5a-4 and A-9.P5a-5 — same screen, same records, and `Semrigid` belongs to all three.
fix-proof:    n/a

---

### A-9.P5a-9 — LOW — the public surface mixes both typographic conventions in four places

class:        code + data-live
pass:         P5a (rule 3)        ledger: E123–E134, E141, E148, E151
surface:      `/products` (empty-filter message), `IP42MW`, `VT-1100`, `/privacy`, and 16 further records
where + observed:  (measured 2026-09-14; full lists in `_harness/out/audit9/P5a/rules2-5.txt` § RULE 3)
              ```
              (a) QUOTE MARKS — curly in exactly one string, straight in eleven
                  curly:    App.jsx:3046   Nothing matches “{q}”. …
                  straight: COPY_DEFAULTS.privacyHeader.intro / content.json copy.privacyHeader.intro
                              Insulation Products Corporation ("IPC", "we", "us", or "our") …
                            content.json faq[18].answer      … with "Supplier enquiry" in the subject line …
                            CC90 / CCS  specTable1 + description   "O" ring & steel locknut
                            IP29CG      specTable1.rows[4]         Colors are vivid - Clear is "crystal" clear
                  (1,670 further straight-quote characters are inch marks and are correct.)
                  APOSTROPHES are clean: 53 straight, 0 curly in source. The one `&rsquo;` at App.jsx:7258
                  is a JSX text child, so Babel decodes it — see the self-correction below.
              (b) ELLIPSIS — … in 38 strings, ... in one
                  IP42MW.description[2]   … mechanical applications...wherever a highly reliable …
              (c) EN DASH — spaced in one string and unspaced in another, on ONE product
                  VT-1100.operatingTemp / specTable1.rows[5]   "250°F – 1100°F"    (spaced)
                  VT-1100.specificationsSummary                "250°F–1100°F"      (unspaced)
                  The other 13 en dashes are ranges and are all unspaced and correct
                  (Mon–Fri, 8am–5pm CT; © {a}–{b}).
              (d) OXFORD COMMA — 90 records without, 63 with, and 17 records carry BOTH.
                  The clearest is a single sentence in the legal text:
                  privacySections[0].content —
                    "… your name, company name, email address, phone number (optional), AND the details of
                     your enquiry — including any part numbers, quantities, materials, required dates AND
                     special requirements you enter on a quote request."
              (e) DEGREE / PERCENT / INCH SPACING — 0 violations. No "125 °C", no "5 %", no "1 \"".
              (f) TRAILING PERIODS on things that are not sentences
                  badges:              2 of 158 end in a period
                                         IP30HS  "U/L CSA MIL-Spec."
                                         IP33PO  "U/L, MIL-Spec."
                                       the other 156 do not. (IP30HS's is also A-9.P5a-8's pair with
                                       IP34SR's "U/L CSA MIL-Spec".)
                  specTable1 values:   29 of 317 end in a sentence period ("550 volts per mil.",
                                       "continuous operation from -55°C to 105°C."), 277 do not,
                                       and 11 more end in an abbreviation period ("Nom. I.D.", "Std. Pkg.")
                                       which is correct and is not counted against them.
                  Column labels (126) and every COPY_DEFAULTS button/label string: clean.
              ```
not in §11:   checked GUARDRAILS §7–§7.3, prior audits, `UX_AUDIT_PREPROD` F1–F17 (F13 is the *precedent* for one claim rendered two ways — that is P4's A-9.P4-1, not typography), `WHATS_LEFT.md` §2–3. New.
reproduce:    `node /dev/stdin < the RULE 3 block of _harness/out/audit9/P5a/rules2-5.txt`'s generator — or directly:
              ```
              grep -n '“\|”' _harness/out/audit9/P5a/export.tsv
              grep -n '\.\.\.' _harness/out/audit9/P5a/export.tsv
              node -e "const p=require('./data/products-all.json'),v=p.find(x=>x.sku==='VT-1100');
                       console.log(JSON.stringify(v.operatingTemp), JSON.stringify(v.specificationsSummary.match(/250[^·]*/)[0]))"
              node -e "console.log(require('./data/content.json').privacySections[0].content.split('. ')[0])"
              ```
expected:     One convention per surface (rule 3). (a)–(c) and (f) have a clear majority and a small minority each. (d) does not have a clear majority — 90/63 — so the finding is not "the site chose wrong" but "the site did not choose", and the evidence is the 17 records that use both styles in one record, one of them in one sentence of the privacy policy.
consequence:  Low throughout. (d) inside the legal text is the one worth doing deliberately, because a list of categories of personal data is exactly where an ambiguous final conjunction changes the reading — but the wording of `privacySections` is **escalated, not edited** (rule 10), so it goes to the owner with the rest.
evidence:     `_harness/out/audit9/P5a/rules2-5.txt` § RULE 3
verified-by:  pending V — sample 3 of 4 sub-rules (a, b, c are one string each and reproduce in one command)
outcome:      fix candidate for C for the hardcoded half only (`App.jsx:3046`'s curly quotes). Everything else is `data-live` (Products → Edit for (b) and (c), Page Content for (a)'s `privacyHeader.intro` and (d)), and the `privacySections` half is `decision` under rule 10.
fix-proof:    n/a

---

### A-9.P5a-10 — LOW — 84 links on the Product Index are all called "View Product"

class:        code
pass:         P5a (rule 9)        ledger: E046
surface:      `/dashboard`
where:        `src/App.jsx` — the Product Index row action and its mobile card twin (the page renders both; the crawl sees 84 links for 42 products).  (measured 2026-09-14)
not in §11:   checked GUARDRAILS §7–§7.3 (§7.2's six refuted probe defects are about focus order, `cssPath()` uniqueness and tab caps, not link naming), `PLAN-10` §12 and `_harness/AUDIT10-REPORT.md` (the `/dashboard` findings there are column widths and card title wrapping), `audit5.md`–`audit8.md`, `WHATS_LEFT.md` §2–3. New.
reproduce:    ```
              node -e "const j=require('./_harness/out/audit9/I-crawl/dashboard/1440x900.json');
              const v=j.links.filter(l=>/View Product/.test(l.text||''));
              console.log('links named View Product:', v.length);
              console.log('carrying an aria-label:', v.filter(l=>l.ariaLabel||l['aria-label']).length);
              console.log('distinct destinations:', new Set(v.map(l=>l.href)).size);
              console.log('sample:', JSON.stringify(v[0]));"
              ```
observed:     ```
              links named View Product: 84
              carrying an aria-label: 0
              distinct destinations: 42
              sample: {"text":"View Product →","href":"/products?productId=CC","ariaLabel":null}
              ```
expected:     Rule 9: "Link names meaningful out of context." The row supplies the context visually and WCAG 2.4.4 (Link Purpose *in Context*, Level A) is satisfied by the table row — this is **not** an accessibility failure and is not being reported as one; P9 owns that judgement. It is a verbiage finding: a screen-reader user listing the links on the page, or anyone reading the link list out of the table, gets "View Product" 84 times. `aria-label={`View ${p.name}`}` on the existing element costs nothing and the product name is already in scope at both call sites.
consequence:  Low. The page works; its link list does not.
evidence:     `_harness/out/audit9/P5a/rules7-9.txt` § "one link NAME used for several different destinations"
verified-by:  pending V
outcome:      fix candidate for C — `code`, an `aria-label` at two call sites, delta-only, no visible change.
fix-proof:    n/a

---

### A-9.P5a-11 — LOW — "enquiry" and "inquiry" are used equally often, and one sentence of the privacy policy uses both

class:        data-live + code
pass:         P5a (rule 2; the privacy half is rule 10)        ledger: E134, E141, E148, E151
surface:      `/privacy` §1, §2, §3; `/faq` answers 10 and 18; the Contact form's Message tab
where:        `data/content.json` `privacySections[0].content`, `[1].content`, `[2].content`, `faq[10].answer`, `faq[18].answer`, `copy.contactForm.msgTabSub`, `copy.contactForm.urgentPrefix`; the byte-identical defaults at `src/App.jsx:12102`, `:12107`, `:12112`, `:6851`, `:6887`, plus the hardcoded `src/App.jsx:4500` and `COPY_DEFAULTS.contactForm.privacyNote` (`:6913`).  (measured 2026-09-14)
not in §11:   checked GUARDRAILS §7–§7.3, all four prior audits, `UX_AUDIT_PREPROD` F1–F17, `WHATS_LEFT.md` §2–3. `grep -rn "enquir" audit-runs/*.md plans/GUARDRAILS.md` → no hits. Appendix B does not seed this pair; P5 rule 2 says the seed is extended, and this is the extension.
reproduce:    ```
              node -e "const fs=require('fs');
              const rows=fs.readFileSync('_harness/out/audit9/P5a/export.tsv','utf8').trim().split('\n')
                .map(l=>{const[s,loc,...t]=l.split('\t');return{loc,text:t.join('\t')};});
              for (const re of [/\benquir\w*/gi,/\binquir\w*/gi]) {
                const hits=[]; rows.forEach(r=>(r.text.match(re)||[]).forEach(m=>hits.push(r.loc+' :: '+m)));
                console.log(String(re)+'  '+hits.length); hits.forEach(h=>console.log('   '+h)); }"
              node -e "console.log(require('./data/content.json').privacySections[2].content.split('. ')[0])"
              ```
observed:     ```
              enquir* : 10     privacySections[0], [2]×2, faq[18]×3, COPY_DEFAULTS.contactForm.privacyNote,
                               PRIVACY_SECTIONS App.jsx:12102, :12112×2
              inquir* : 10     privacySections[1], [2], faq[10], copy.contactForm.msgTabSub,
                               copy.contactForm.urgentPrefix, App.jsx:4500, :6851, :6887, :12107, :12112

              privacySections[0]  "… and the details of your ENQUIRY — including any part numbers …"
              privacySections[1]  "… used solely to respond to your INQUIRY or quote request."
              privacySections[2]  "INQUIRY records — the details you submit … are kept for as long as they are
                                   needed to answer your ENQUIRY and for our ongoing business record-keeping."
              ```
              Ten and ten is not a majority, so rule 2's "the majority public form is canonical" has nothing to select. What settles it is the third line: the two spellings are **12 words apart in a single sentence** of the document a data subject is asked to rely on, and the two adjacent sections disagree with each other and with it.
expected:     One form. IPC is an Illinois corporation writing for a US market and the site is otherwise consistently American (`catalog` 16/16, never `catalogue`; `color` throughout the catalog, never `colour`), so "inquiry" is the form the rest of the site already implies — and it is the one the admin side uses (`admin/inquiries.jsonl`, the Inquiries screen, which P5b covers). My first pass recorded this as a deliberate split by register; it is not, and the privacy policy is the proof.
consequence:  Low. Nobody is misled. It is visible in the one document where a reader is paying attention to exact wording, and the file name the owner sees in his admin ("Inquiries") already picks a side.
evidence:     `_harness/out/audit9/P5a/rules2-5.txt` § RULE 2 (enquiry/inquiry); `data/content.json` `privacySections[0..2]`
verified-by:  pending V — sample 3 of 20 (`privacySections[2]` alone shows both; then `privacySections[0]` and `[1]`)
outcome:      split. The **hardcoded** occurrences (`src/App.jsx:4500`, `:6851`, `:6887`, `:6913`, and the `PRIVACY_SECTIONS` defaults) are `code` and a fix candidate for C. The `content.json` occurrences are `data-live` (Page Content). The three inside `privacySections` are **`decision`** — rule 10 forbids this pass from rewording legal text, and changing "enquiry" to "inquiry" inside a privacy policy is a wording change however mechanical it looks. The two halves must move together or the document ends up mixed in a new way.
fix-proof:    n/a

---

## Checked, no finding — with the measurement

**Surface coverage.** 4,411 records: `public-jsx` 100, `public-defaults` 180, `public-data` 4,059, `meta` 72 (`_harness/out/audit9/P5a/export.tsv`). Plus 53 **public** routes × 5 viewports from `I-crawl` for rules 7 and 9 (the 14 `admin-*` routes in the crawl were filtered out — they are P5b's surface and its findings are not taken here; the rule-7 and rule-9 hits on them, including `alt="IPC"` on `admin/logo.svg` × 14 and one `mailto:` link with no accessible name on `/admin-inquiries`, are recorded here only so P5b knows they exist).

**The inventory's two known gaps, as the TIMING NOTE instructs.** (1) The `public-jsx` scanner is line-shaped and misses same-line JSX children. I ran `grep -nE '>[A-Z][a-z][^<>{}]{2,}</' src/App.jsx` for completeness: **12 strings**, all checked — `Something went wrong` (`:342`), `Filter datasheets` (`:3004`), `Request Sent` (`:4943`), `Phone ` (`:5013`), `Fax ` (`:5016`), `Email ` (`:5019`), `Website` (`:5292`, `:5590`), `Error 404` (`:7250`), `Click **View Product** for full data sheets…` (`:10158`), `Loading the product catalog…` (`:12726`), `Skip to main content` (`:13104`). Two feed findings already recorded (`:10158`'s "data sheets" → A-9.P5a-7; `View Product` → A-9.P5a-10); one is out of brief (`:5292`/`:5590`); the other nine are clean. (2) The scanner does not walk hardcoded data arrays outside the four named default objects. `CONTACT_TIPS` (`src/App.jsx:6977-6983`) is the one such array on the public surface; its five strings were read and are clean, and they are byte-identical to `content.json contactTips[]`, which the inventory does carry.

**Rule 1 — spelling.** `which hunspell aspell` → neither installed; the brief's fallback ran (`npx --yes cspell@latest`, temporary, **not** added to `package.json`, offline against local dictionaries — PLAN-11 §10.3 rule 7). 72 unknown words over 4,411 strings; 6 typos (A-9.P5a-4), 66 dispositioned as industry vocabulary or proper nouns in `_harness/out/audit9/P5a/spell.md`. **Zero misspellings in `public-jsx`, `public-defaults` or `meta`** — every typo is in the owner's catalog data.

**Rule 2 — vocabulary, the pairs that are clean.** `company`: 44 × "Insulation Products Corporation", 58 × "IPC", and no "Insulation Products Corp." anywhere; the first-mention rule holds where it matters — `privacySections[6]` and `copy.privacyHeader.intro` both open with the full legal name, and `about.paragraphs[0]` and `milestones[0]` do too. `contact channel`: 19 × "email", **0** × "e-mail" or "E-mail" — one form. `catalog`: 16 × "catalog", 0 × "catalogue". `certification` marks `CSA`, `PPAP`, `IMDS`, `PVC`, `VW-1`: one form each, 38/13/11/32/26. `lead time`: "one week or less" 9 × and "≤ 1 week" 8 × are the prose and the data-cell forms of one fact and agree with P4's register; the only wobble is `stats[3].value` `"≤1 week"` without the space against `services[0..5].leadTime` `"≤ 1 week"` with it — one character, folded into A-9.P5a-9's typography batch rather than raised separately. `enquiry`/`inquiry`: **10 each, and it is not a register split** — I first recorded it as one and it is not (self-correction 5). Raised as A-9.P5a-11.

**Rule 3 — the conventions that are clean.** No space before `°`, `%` or `"` anywhere (0/0/0). Apostrophes: 53 straight, 0 curly. Em dash 86, en dash 14, and every en dash except VT-1100's is an unspaced range. Trailing periods: **not clean** — see A-9.P5a-9(f); I first reported this as 0 and it is not (self-correction 4). `&` vs "and": **clean in `content.json`** — `&` in every short label (`Adhesives & Accessories`, `Cookies & Tracking`, `Marking & Kitting`, `PPAP & IMDS Support`, `Aerospace & Defense`, `Spooling & Coiling`, `Kitting & Bagging`, `Slit & Perforation`, `FAQ & Resources`) and "and" in prose, 38 and 42 hits with no overlap; **not clean in `products-all.json` `badges`**, where 3 use `&` and 6 use "and" — see A-9.P5a-8, which I extended after measuring this (self-correction 6).

**Rule 4 — the terms that are clean.** `CSA` 38/38, `PPAP` 13/13, `IMDS` 11/11, `PVC` 32/32, `VW-1` 26/26, one form each. `ISO 9001` is A-8.5's, cited and not re-reported.

**Rule 5 — mechanical grammar. Clean on every count except sentence length:** 0 doubled words, 0 double spaces, 0 `" ."`/`" ,"`, 0 missing spaces at a `.`/`,` boundary, 0 `{a}{b}` concatenation gaps in JSX (F17's precedent — checked and not reproduced). **13 sentences run over 35 words** (`_harness/out/audit9/P5a/rules2-5.txt` § RULE 5): the longest are `privacySections[0]` and `faq[0]` at **51 words** each, then `faq[5]` 38, `about.paragraphs[0]` 37, `IP30UV.description[1]` 40. Recorded as a measurement rather than a finding: two of the five longest are legal text (rule 10 — escalated, never edited), and the rest are spec prose where the length is a list of materials. Named here so C can see the set; if it becomes a batch it is `data-live`.

**Rule 6 — truth.** Cross-referenced against P4's 25-row register (`_harness/out/audit9/P4/claims-register.md`). Every string the register marks false, unsourced or two-ways is **P4's finding and is not duplicated here**: the unqualified same-day shipment copy (A-9.P4-1), "Made in USA" (A-9.P4-2), the certification category names (A-9.P4-3), "42 Products Stocked" (A-9.P4-4), "250 Gibraltar Drive" (A-9.P4-6). A-9.P5a-5 touches the same catalog strings as A-9.P4-3 and deliberately reports only their **spelling**; the record says so and names the ordering dependency.

**Rule 7 — audience. Clean on the P5a surface.** Scanned every rendered string on all 53 public routes for `JSON|cache|caching|deploy|FTP|prod|localhost|API|endpoint|server-side|backend|null|undefined|console|HTTP`. **Zero hits on any public route.** The only hits in the whole crawl are `/admin-help` and `/admin-password` (P5b's surface: "the site briefly caches data for speed", "set data/ to 755 (or 775) over FTP", "it mentions invalid data/JSON", and an FTP glossary row — all of which read as deliberate and are P5b's to judge). `/unknown-route` renders the eyebrow "Error 404", which is not developer vocabulary — it is the term the public knows the page by — and is not raised.

**Rule 8 — instructional accuracy.** P5b owns `help.php` and P5c the docs. The one **public** imperative that names a control is `faq[14]`, and it is wrong: A-9.P5a-2. The others were checked and are right: `App.jsx:10157` says *Click **View Product** for full data sheets* and a control named exactly "View Product →" exists on that page (84 of them, A-9.P5a-10); `faq[10]` says *use the Contact form on this website* and it exists; `faq[18]` says *use the "Send a Message" tab on our Contact page* and the crawl shows `button "✉️ Send a Message General inquiries & questions"` on `/contact`; `COPY_DEFAULTS.contactForm.requiredLegend` says *Fields marked * are required* and exactly the three `*`-marked fields (`Full Name *`, `Email *`, `Quantity Required *`) are the three the crawl reports as `required`.

**Rule 9 — alt, link and label text, the parts that are clean.** **Alt text on the public surface is right.** 42 distinct alt values over 53 public routes: **0 images with no `alt` attribute**, 0 filename-shaped, 0 bare-SKU, 0 generic ("image"/"photo"/"logo"). Every product photo carries the product's descriptive name (`"Polyvinylidene Fluoride Heat Shrink Tubing (Kynar)"`, `"Nonmetallic Liquid-tight Conduit Coupling"`, `"90° Conduit Connectors"`), and the two site photographs describe their subject (`"The Insulation Products Corporation team outside the Bolingbrook facility"`). The only `alt=""` on the public surface is `logo.svg`, which is GUARDRAILS §7.3's settled C43 decision (`alt=""` + `aria-label` on the link) — re-verified, not re-reported. `Marker-Sample-2.jpg` carries two different descriptions on two pages ("Custom hot-stamp printed…" and "Custom-printed…"); both describe the subject correctly for their context and this is not raised. **Labels name the data**: all 10 `/contact` fields have real `<label>` elements and correct accessible names (`Full Name *`, `Email *`, `Phone`, `Company`, `Part Number / SKU`, `Material / Type`, `Quantity Required *`, `Required Delivery Date`, `Special Requirements`, `Additional Notes`), and the RFQ/Message tab buttons carry their own descriptions. **Error messages name the fix**: `networkError` and `submitError` both give the phone number, and `networkError` gives the email as well — neither names a field, which is correct for a submission-level failure. `Part Number / SKU` hedging two vocabularies in one label is noted under A-9.P5a-7 and is arguably the right call for a buyer who knows only one of the two words.

**Rule 10 — legal text, the parts that hold.** The seven `privacySections` are internally consistent with each other and with the code, checked by A-8.7's method: §1's disclosure of the automatically-recorded IP address matches `public/contact.php`'s `REMOTE_ADDR` write on both accepted and rejected submissions; §3's "They are not deleted automatically" matches the absence of any `unlink` of an inquiry file anywhere in `admin/`; §4's cookie text is accurate and conservative — `audit8.md` §4 measured that the public site sets no cookies at all, cited and not re-measured; §5's rights-and-contact route matches `site-info.json` `contact.email`/`contact.phone`; §7's address, phone and email are byte-equal to `site-info.json` (P4 register rows 1, 3, 4). The **FAQ's shipping, lead-time and minimum-order answers agree with each other and with P4's register**: `faq[7]` "One week or less", `faq[8]` "$50", `faq[9]` "over 25 million feet … same day or next business day" — the F13 check, and the only disagreement is the unqualified marketing copy elsewhere, which is A-9.P4-1. §6 *Data Security* is A-9.P5a-1. **There is no disclaimer, warranty, terms-of-use or returns statement anywhere on the public site** — 0 hits across all 4,411 strings; recorded as an out-of-brief observation, since an absent document is a business decision, not a verbiage defect.

**The owner's own voice.** Per the brief, prose in `data/*.json` that is simply how Rick writes is **not a finding** and carries no severity. Listed for Keagan to forward or drop, none of them misspelled or false: `IP53MP.description[0]` "sets the standard for high-performance, safety and reliability"; `site-info.about.paragraphs[3]` "The customer is always number one — that commitment has defined IPC since day one"; `IP75AD.caption` "Domestic production means you get fresher and therefore faster performance"; `copy.aboutHeader.intro` "quick, accurate, and courteous service, always"; `IP17TW-IP18SW-IP19LW.description[2]` "PTFE tubing is the material to specify when the reliability and dependability of an application…".

## Self-corrections

1. **`&rsquo;` at `src/App.jsx:7258` is not a leaked entity.** The string inventory is source-shaped, so cspell saw `doesn&rsquo;t` and reported `rsquo` as an unknown word. It is a JSX **text child**, which Babel decodes, and the crawl confirms the rendered 404 reads `That address doesn’t exist on this site.` with a real `’` and no literal `&rsquo;` anywhere in the page. Not a finding. It is, however, the site's only curly apostrophe against 53 straight ones — noted under A-9.P5a-9(a) as a measurement, not raised, because one decoded entity in one sentence is not a mixed convention a reader can perceive.
2. **`formControls[].label` is `undefined` for every control on every route**, including buttons. That is a field the crawler did not populate, not a page with no labels: the accessibility snapshot for `/contact` shows `textbox "Full Name *"`, `textbox "Email *"` and eight more, i.e. real `<label>` elements with correct accessible names. GUARDRAILS §7.1 — the probe is not the page. Rule 9's label check was re-run against `ariaSnapshot` and is clean.
3. **I first recorded "0 label-, button- or list-item strings end in a period" and that was wrong.** My label-ish filter required ≤ 8 words, which excluded the spec-table values, and I read the section heading rather than its 37-row body. Measured properly: **2 of 158 badges** and **29 of 317 `specTable1` values** end in a sentence period. Corrected in place above and folded into A-9.P5a-9 as sub-rule (f). The "0 violations" claims for degree/percent/inch spacing were re-checked at the same time and do hold.
4. **I recorded the `enquiry`/`inquiry` 10–10 split as deliberate — "enquiry in the visitor-facing text, inquiry in the operational copy" — and it is not.** I checked the counts and not the locators. `privacySections[2]` uses both in one sentence and `privacySections[0]` and `[1]` disagree with each other. Raised as A-9.P5a-11.
5. **I recorded "`&` vs 'and' — one rule, applied" and it holds only for `content.json`.** I checked the two hit lists for overlap and did not separate the surfaces. `content.json` is clean (38 `&`, 42 "and", no concept using both); `products-all.json` `badges` is not (3 `&`, 6 "and", and the UL/CSA badge using four joiners across nine products). A-9.P5a-8 was extended with the measurement rather than a new record being opened, since it is the same field on the same screen.
6. **My first rule-2 Oxford-comma count (90 without / 63 with) is approximate and I am not reporting it as a finding on its own.** The regex cannot tell a three-item list from a compound predicate (`"view specs and data sheets, and request a quote"` is counted as both). What A-9.P5a-9(d) reports is the narrower, hand-verified fact: 17 records contain both patterns, and one sentence of `privacySections[0]` demonstrably uses both.

## Out of brief

- `src/App.jsx:5292` and `:5590` — the two honeypot fields (`name="website"`) carry a visible `<label>Website</label>`; whether that is hidden from assistive technology is P9's call, not verbiage.
- The public site carries no terms-of-use, warranty, liability or returns statement: 0 matches for `warrant|disclaim|liabilit|as-is|terms of (use|service)|governing law` across all 4,411 P5a strings.
- 14 `admin-*` routes in the crawl were excluded as P5b's surface; they carry `alt="IPC"` on `admin/logo.svg` on all 14 and one `mailto:` link with no accessible name on `/admin-inquiries`, which P5b may want.
