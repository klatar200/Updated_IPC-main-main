# P4 — data-truth          agent: B1   started/finished: 2026-09-14 15:02 / 2026-09-14 15:45 UTC   mirror: none (file-based)
findings:   Blocker 0 · High 1 · Medium 5 · Low 4
| ID | sev | class | where | one line |
|---|---|---|---|---|
| A-9.P4-1 | Medium | code + data-live | `index.html:10,41`; `content.json seo[0].desc`, `seo[5].desc`, `copy.hero.headlineAccent` | The hero headline and the two meta descriptions a buyer sees in search promise same-day shipment flatly; About and the FAQ say "**most** in-stock orders … same day **or next business day**". |
| A-9.P4-2 | High | decision | `content.json certs[2]`, `heroTrust[6]`, `copy.hero.badge` | "Made in USA" is rendered as a certification chip beside ISO 9001 and RoHS, has no backing field in `site-info.json`, and the catalog singles out exactly one of 42 products as domestically made. |
| A-9.P4-3 | Medium | decision | `data/products-all.json` — 7 products, 16 strings | The catalog claims certification categories that do not exist — "U/L Approved", "UL & CSA Approved", "FDA Approved" — and cites two food-contact regulations that were recodified decades ago (`C.F.R. 21 121.255`, `GFR 21.121.2555`). |
| A-9.P4-4 | Medium | data-live | `content.json stats[1]` | "42 Products Stocked · Datasheet published for every one" is typed by hand on Page Content, counts the VALUE-ADDED **services** record as a stocked product, and goes stale the moment Rick adds or deletes a product on a different screen. |
| A-9.P4-5 | Medium | code + data-live | `src/App.jsx:10006,10101-10116`; `products-all.json` `operatingTemp` × 42 | `/dashboard`'s Temp column sorts a free-text string in 30 different formats (7 of them empty); ascending puts the 500 °F part **first** and the 90 °C parts **last**, while the page's own meta description promises sorting "by temperature rating". |
| A-9.P4-6 | Low | code | `src/App.jsx:3193, 3232, 3673` | The About page writes the street address as "250 Gibraltar **Drive**" three times while `site-info.json` and every other rendering (footer, Contact, privacy, JSON-LD) say "250 Gibraltar **Dr**". |
| A-9.P4-7 | Low | code | `src/App.jsx:7184` | Organization JSON-LD hardcodes `logo: /favicon.svg` and ignores `site-info.json` `theme.logoUrl`, the field Business Details offers for exactly this. |
| A-9.P4-8 | Medium | decision | `products-all.json` — `IP12GA-IP1274`, `IP13SP`, `IP25PU`, `IP30UV`, `IP47HV` | Five of 42 product pages (12 % of the catalog) show the "image coming soon" panel instead of a photograph; `WHATS_LEFT.md` records only "untouched", which is not a decision. |
| A-9.P4-9 | Low | code + decision | `src/App.jsx` `StructuredData`, Product block | Product JSON-LD on all 42 product pages carries no `image` (37 have a local `photoUrl` sitting unused) and no `offers`, so none is eligible for a Product rich result. |
| A-9.P4-10 | Low | data-live | `products-all.json` — 5 products, `specTable2` column 0 | Inside one spec-table column the same fractional-inch size is written both with and without the inch mark (`3/4` beside `1"`), so a size column reads as two different units. |
ledger:     done E022, E027, E036, E051, E052, E095, E096, E097, E100, E101, E102 (parity read-only — the `content.php` half is P5b/A's surface; the `content.json` half is clean), E119, E149, E171   blocked none
suites cited: isoclaims 2/4 (FAIL — expected red, PLAN-11 §4.4) · imgcheck ok (no score line) · deadlinks "0 of 18 resolve to nothing" · plan5b-sitemap 9/9 · plan8-certs 5/5 · invariants 17/17 · copyroundtrip 15/15 — all from `_harness/out/audit9/sweep-before.txt`
instruments: none new. Investigative one-shots run and captured: `_harness/checkskus.js`, `_harness/isoclaims.js`. Query scripts for the shape/leaf/JSON-LD reports were scratch, their **outputs** are the artifacts.
artifacts:  `_harness/out/audit9/P4/claims-register.md` — the 25-row register (step 2)
            `_harness/out/audit9/P4/claims-raw.txt` — 423 seeded hits from `audit9-strings.json`, by claim
            `_harness/out/audit9/P4/shape-report.txt` — step 4 catalog shape (42 records, every assertion)
            `_harness/out/audit9/P4/leaves-report.txt` — step 5 leaves, `page` fields, `seo[]`, `privacySections`
            `_harness/out/audit9/P4/jsonld-report.txt` — step 7, 67 routes × 5 viewports
            `_harness/out/audit9/P4/isoclaims.txt` — the expected red, verbatim
            `_harness/out/audit9/P4/checkskus.txt` — investigative, see the self-correction below
            `_harness/out/audit9/P4/tempsort.txt` — A-9.P4-5's reproduction
            `_harness/out/audit9/P4/cert-spellings.txt` — 105 distinct certification-name spellings in the catalog
            `_harness/out/audit9/P4/spectable2.txt`, `spectable2-units.txt` — column census and A-9.P4-10
            `_harness/out/audit9/P4/faq-dump.txt` — the 19 FAQ pairs as prose
out of brief: `admin/content.php` Page Content has no SEO row for `/datasheets` — `SEO_DEFAULT` has 10 rows, `content.json seo[]` has 9, and the B25 fallback covers it in code, but Rick cannot add the tenth. (Routed to whoever owns the admin surface.)
out of brief: `WHATS_LEFT.md:71` item 4.22 — the admin CSP allows `placehold.co` previews, so the admin **is** the one surface that makes a live third-party request for the five placeholder photos; the public site never does (measured, A-9.P4-8).
out of brief: `data/content.json` has no returns / RMA / warranty answer anywhere in the 19 FAQ pairs or the seven privacy sections; nothing on the site states a returns position.
[UNVERIFIED]/[UNSOURCED]: register rows 10, 11, 13–22 are `[UNSOURCED]` — asserted in copy with no backing field in `site-info.json`. Rows 13–18 (UL, CSA, MIL-SPEC, AMS, FDA, RoHS) are `[UNSOURCED]` **at site level**: `site-info.json` `certifications.other` is `[]` while five certification chips render on the homepage. No `[UNVERIFIED]` — this pass is entirely file-based and nothing needed the network or a server.
self-corrections: 3, listed at the end of this file.
---

### A-9.P4-1 — MEDIUM — the homepage headline and the search snippet promise same-day shipment; the About page and the FAQ say "most in-stock orders, same day or next business day"

class:        code + data-live
pass:         P4        ledger: E052, E097, E149
surface:      `/` (hero), every page's `<meta name="description">`, the Google snippet for `/` and `/about`
where:        `index.html:10` and `index.html:41`; `data/content.json` `seo[0].desc`, `seo[5].desc`, `copy.hero.headlineAccent`; the qualified form at `data/site-info.json` `about.paragraphs[1]`, `data/content.json` `faq[9].answer`, `heroProofPoints[2].sub`, `heroTrust[9].text`  (measured on `2121597`/`d09412f` — `index.html` and `data/` are byte-identical across the two, `git diff --stat 2121597..HEAD`, 2026-09-14)
not in §11:   checked GUARDRAILS §7/§7.1/§7.2/§7.3, `audit5.md`, `audit7.md` §3–4, `audit8.md` §2–5, `UX_AUDIT_PREPROD` F1–F17, `WHATS_LEFT.md` §2–3 — `grep -n "same day\|Same-Day" audit-runs/*.md plans/GUARDRAILS.md` returns one unrelated hit (GUARDRAILS:62, `public/images/site/`). F13 is the *precedent* for a claim rendered two ways, not this claim.
reproduce:    ```
              node -e "const c=require('./data/content.json'),s=require('./data/site-info.json');
              console.log('HEADLINE   :',c.copy.hero.headlineAccent);
              console.log('seo[0].desc:',c.seo[0].desc.slice(-40));
              console.log('seo[5].desc:',c.seo[5].desc.slice(-30));
              console.log('ABOUT      :',s.about.paragraphs[1].match(/Most[^.]*\./)[0]);
              console.log('faq[9]     :',c.faq[9].answer.match(/Most[^.]*\./)[0]);"
              grep -n 'Ships same day' index.html
              ```
observed:     ```
              HEADLINE   : Same-Day Shipment.
              seo[0].desc: ... $50 minimum order. Ships same day. ISO 9001 registered.
              seo[5].desc: ... $50 minimum order, same-day shipment.
              ABOUT      : Most in-stock orders ship the same day or next business day.
              faq[9]     : Most in-stock items ship the same day or next business day.
              index.html:10:  ... Ships same day. ISO 9001 registered.
              index.html:41:  ... Ships same day. ISO 9001 registered.
              ```
              Register row 10, `_harness/out/audit9/P4/claims-register.md`; seeded hits in `claims-raw.txt` § `sameday` (16).
expected:     One claim, one strength. The qualified form is the true one — the site states it twice in prose and twice in a proof-point sub-line — so the four unqualified renderings should carry the same qualifier ("in-stock", "most", or "available"). Two of the four already do it correctly on the same page: `heroProofPoints[2]` is `stat:"Same Day"` with `sub:"On in-stock items"`, and `heroTrust[9]` is "Same-Day Shipment **Available**". P4 finding criterion: "a false/unsourced/two-ways claim".
consequence:  The meta description is what a buyer reads **before** clicking, and it is the one rendering with no qualifier anywhere near it. A purchasing person who orders on the strength of "Ships same day" and gets next-business-day has been misled on the main path. Nothing in `site-info.json` backs either form, so there is no stored fact to appeal to.
evidence:     `_harness/out/audit9/P4/claims-register.md` row 10; `_harness/out/audit9/P4/claims-raw.txt` § `sameday`
verified-by:  pending V
outcome:      escalated: `decision-needed: qualify the four unqualified same-day renderings | recommended: "Ships same day on in-stock items" in both meta descriptions and "Same-Day Shipment on in-stock items." in the hero | why: the site's own About and FAQ text is the qualified one, and the unqualified copy is what a buyer sees in search | trade-off: the qualifier lengthens the hero headline and costs ~20 characters of meta description | blocked: no — but it is public commercial copy, so PLAN-11 §7.3 puts it on the owner's side of the fix fence`
fix-proof:    n/a — not fixed by this pass

---

### A-9.P4-2 — HIGH — "Made in USA" is presented as a certification, is backed by nothing, and the catalog contradicts it

class:        decision
pass:         P4        ledger: E097, E143 (P5a's cert row cites this)
surface:      `/` (hero badge + trust strip), `/about` (certification row)
where:        `data/content.json` `certs[2]` = `{"iconKey":"flag","title":"Made in USA","sub":"Bolingbrook, IL facility"}`; `heroTrust[6].text` = "Made in USA Since 1974"; `copy.hero.badge` = "Bolingbrook, IL — Made in USA Since 1974" (and its default, `src/App.jsx:6760`). Contradicting record: `products-all.json` `[sku=IP75AD].badges[2]` = "Domestically Made" and its caption.  (measured 2026-09-14)
not in §11:   checked GUARDRAILS §7–§7.3, `audit8.md` §2/§3a/§4/§5 (A-8.5 covers the **ISO revision strings** and nothing else; `plan8-certs 5/5` asserts certification claims *render from site-info*, which is the mechanism this finding says is bypassed), `WHATS_LEFT.md` §2–3. `grep -rn "Made in USA" audit-runs/*.md plans/GUARDRAILS.md` → no hits. New.
reproduce:    ```
              node -e "const c=require('./data/content.json'),s=require('./data/site-info.json'),p=require('./data/products-all.json');
              console.log('certs[2]           :',JSON.stringify(c.certs[2]));
              console.log('heroTrust[6]       :',JSON.stringify(c.heroTrust[6]));
              console.log('copy.hero.badge    :',JSON.stringify(c.copy.hero.badge));
              console.log('site-info certs    :',JSON.stringify(s.certifications));
              console.log('products describing themselves as domestic:',
                p.filter(x=>/Domestic|Made in USA/i.test(JSON.stringify(x))).map(x=>x.sku));
              console.log('company self-description:',s.company.description);"
              ```
observed:     ```
              certs[2]           : {"iconKey":"flag","title":"Made in USA","sub":"Bolingbrook, IL facility"}
              heroTrust[6]       : {"text":"Made in USA Since 1974"}
              copy.hero.badge    : "Bolingbrook, IL — Made in USA Since 1974"
              site-info certs    : {"iso":"ISO 9001","other":[]}
              products describing themselves as domestic: [ 'IP75AD' ]
              company self-description: A major supplier of heat-shrinkable and extruded tubing, sleeving and
                                        adhesives for the electrical and electronic industry since 1974.
              ```
              `certs[2]` renders in the same six-chip row as `ISO 9001:2008`, `Full RoHS Compliant`, `UL · CSA · MIL-SPEC · AMS`, `PPAP & IMDS Support` and `Privately Held` (`certs[0..5]`, `leaves-report.txt`).
expected:     P4 step 3: *"A claim not in `site-info.json` `certifications` and not on the owner action list is class `decision`, escalated, never edited."* `certifications.other` is `[]`. Three further facts make this the one certification-row claim that cannot be left to drift: (a) the company describes itself everywhere else as a **stocking distributor** and "a major **supplier**" — `site-info.json company.description`, `copy.hero.subhead`, `seo[0]`, `seo[5]`, `manifest.json` — not a manufacturer; (b) exactly one of 42 catalog records (`IP75AD`) says its production is domestic, and it says so as a *differentiator*, which reads as a statement that the other 41 are not; (c) an unqualified "Made in USA" is a regulated origin claim (FTC Made in USA Labeling Rule, 16 CFR 323), and the qualified form the site actually supports — the *facility* is in Bolingbrook — is already written in the `sub` line.
consequence:  A purchasing or quality person qualifying IPC as a supplier reads "Made in USA" in the certification row and takes it as an origin attestation covering the product line. It is the one claim on the page that the business's own data contradicts, and it is the class of claim a customer's compliance team checks. Severity is High under §7.1 — "a claim the business cannot stand behind" — not Blocker, because the site is not live (STEP 0) and nothing is published yet.
evidence:     `_harness/out/audit9/P4/claims-register.md` row 22; `_harness/out/audit9/P4/claims-raw.txt` § `founded`/`over50`; `_harness/out/audit9/P4/leaves-report.txt`
verified-by:  pending V
outcome:      escalated: `decision-needed: what does "Made in USA" cover — the facility, the fabrication, or the product line | recommended: ask Rick, then either re-title certs[2] to "USA Facility / Bolingbrook, IL" and drop the hero-badge and heroTrust duplicates, or keep the claim and record the substantiation | why: it sits in the certification row, it is unsourced, and one of 42 products contradicts it | trade-off: "Made in USA" is a strong differentiator on a distributor's homepage and the softer wording loses some of it | blocked: yes — public copy with commercial and regulatory weight, PLAN-11 §7.3 forbids C editing it`
fix-proof:    n/a — never edited by this pass (P4 step 3)

---

### A-9.P4-3 — MEDIUM — the catalog claims three certification categories that do not exist, and cites two obsolete FDA regulations

class:        decision
pass:         P4        ledger: E095
surface:      product pages `IP42MW`, `IP44A2-IP45A3`, `IP47HV`, `VT-1100`, `IP15PV`, `IP37SH-IP36TH-IP39LH`, `IP17TW-IP18SW-IP19LW`; `/about` prose
where:        `data/products-all.json` badges, `specTable1.rows[].value` and `specificationsSummary` on the seven SKUs above; `data/site-info.json` `about.paragraphs[3]` ("RoHS-**certified**") and its default `src/App.jsx:6434`.  (measured 2026-09-14)
not in §11:   checked GUARDRAILS §7–§7.3, `audit8.md` A-8.5 (ISO **revision** strings only — `isoclaims.js` greps `ISO ?9001` and touches nothing else; its own output names six strings, none of them these), `audit7.md` §3–4, `WHATS_LEFT.md` §2–3. `grep -rn "U/L Approved\|UL Approved" audit-runs/*.md plans/GUARDRAILS.md` → no hits. New.
reproduce:    ```
              node -e "const p=require('./data/products-all.json');
              for (const re of [/U\/?L[ -]?Approved/i, /CSA[ -]?Approved/i, /FDA[ -]?Approved/i, /C\.?F\.?R|GFR/i])
                console.log(String(re), '->', p.filter(x=>re.test(JSON.stringify(x))).map(x=>x.sku).join(', '));"
              grep -o 'RoHS-certified' data/site-info.json src/App.jsx
              node -e "const p=require('./data/products-all.json');
              p.filter(x=>/C\.?F\.?R|GFR/i.test(JSON.stringify(x))).forEach(x=>
                console.log(x.sku, JSON.stringify(JSON.stringify(x).match(/[^\"]{0,10}(C\.?F\.?R|GFR)[^\"]{0,22}/gi))));"
              ```
observed:     ```
              /U\/?L[ -]?Approved/i  -> IP42MW, IP44A2-IP45A3, IP47HV        (10 string occurrences)
              /CSA[ -]?Approved/i    -> VT-1100                               ("UL & CSA Approved", ×2)
              /FDA[ -]?Approved/i    -> IP15PV, IP37SH-IP36TH-IP39LH          ("Food Grade Vinyl (FDA Approved)", "FDA Approved C.F.R. 21 121.255")
              RoHS-certified         -> data/site-info.json, src/App.jsx:6434
              IP37SH-IP36TH-IP39LH   -> ["FDA Approved C.F.R. 21 121.255"]
              IP17TW-IP18SW-IP19LW   -> ["FDA: GFR 21.121.2555"]
              ```
              Full spelling census — 105 distinct certification-name forms across the 42 records — in `_harness/out/audit9/P4/cert-spellings.txt`.
expected:     UL has **Listed**, **Recognized** and **Classified**; it has no "Approved" category, and the catalog uses the correct two elsewhere (`U/L Recognized` ×13, `UL Listed` ×2, `UL & CUL Listed`). CSA has **Certified** and **Listed**, and the catalog uses `CSA Certified` correctly on `CT`, `IP10EX` and `IP61ES-IP62EF`. FDA does not approve materials; it lists food-contact substances as compliant with 21 CFR — and the catalog writes that correctly on `IP38FE` ("FDA Title 21 #177.1550"). RoHS is a self-declared conformity, not a certification, and the site says "RoHS **compliant**" everywhere except this one prose sentence. `21 CFR 121` was recodified into parts 170–189 in 1977; `GFR` is not a regulation series. So in every case the site already contains the correct form — the defect is that the wrong one is used on some records.
consequence:  These pages exist to be read by the quality engineer who has to put IPC on an approved-vendor list. "U/L Approved" is the phrase that tells them the supplier does not know which UL programme its product is in, and a citation to a regulation withdrawn in 1977 is the phrase that makes them re-verify everything else. It is not a falsehood about the product — it is a falsehood about the certification's name and scope, on the exact surface that is supposed to establish rigour.
evidence:     `_harness/out/audit9/P4/cert-spellings.txt`; `_harness/out/audit9/P4/claims-register.md` rows 13–18; `_harness/out/audit9/P4/shape-report.txt` (badge census, 112 distinct)
verified-by:  pending V
outcome:      escalated: `decision-needed: correct the certification category names and the two FDA citations in the catalog | recommended: Rick confirms with each supplier's certificate, then edits the seven records on Products → Edit — U/L Approved → Listed or Recognized per the actual file, CSA Approved → CSA Certified, FDA Approved → compliant with 21 CFR <part>, GFR → CFR, RoHS-certified → RoHS compliant on Business Details | why: certification claims carry commercial weight (P4 step 3) and each of these names a programme that does not exist | trade-off: needs the certificates in hand; a wrong correction is worse than the wrong original | blocked: yes — P4 step 3 forbids editing a certification claim, and PLAN-11 §7.3 puts data/*.json outside what C may fix`
fix-proof:    n/a — never edited by this pass (P4 step 3)

---

### A-9.P4-4 — MEDIUM — "42 Products Stocked" is typed by hand on a different screen from the catalog, and counts a services page as a stocked product

class:        data-live
pass:         P4        ledger: E097, E136
surface:      `/` (stats bar)
where:        `data/content.json` `stats[1]` = `{"iconKey":"stock","value":"42","label":"Products Stocked","sub":"Datasheet published for every one"}`; the thing it counts is `data/products-all.json`, edited on Products → Add / Edit / Delete.  (measured 2026-09-14)
not in §11:   checked GUARDRAILS §7–§7.3, `audit7.md` §3–4 (catalog size is listed there as *measured*, not as a copy claim), `audit8.md` §2–5, `WHATS_LEFT.md` §2–3. `grep -rn "Products Stocked" audit-runs/*.md plans/GUARDRAILS.md` → no hits. New.
reproduce:    ```
              node -e "const c=require('./data/content.json'),p=require('./data/products-all.json');
              console.log('claim   :',JSON.stringify(c.stats[1]));
              console.log('records :',p.length);
              const v=p.find(x=>x.sku==='VALUE-ADDED');
              console.log('VALUE-ADDED:',JSON.stringify({name:v.name,partType:v.partType,operatingTemp:v.operatingTemp,badges:v.badges,pdfUrl:v.pdfUrl}));"
              ```
observed:     ```
              claim   : {"iconKey":"stock","value":"42","label":"Products Stocked","sub":"Datasheet published for every one"}
              records : 42
              VALUE-ADDED: {"name":"Value-Added Insulation Products","partType":"Accessory","operatingTemp":"",
                            "badges":["Spooling","Coiling","Cutting","Custom Lengths"],"pdfUrl":"/pdfs/Value-Added.pdf"}
              ```
              `VALUE-ADDED` is a **services** record: its four badges are the four fabrication services, it has no operating temperature, and its description opens "Insulation Products Corporation prides itself on superior Value-Added services." It is filed under `partType: "Accessory"`, so it appears in the catalog sidebar under Accessories, in the `/dashboard` table with `VALUE-ADDED` under **Part ID**, on `/datasheets`, and as a `<loc>` in `sitemap.php`'s product URLs (`plan5b-sitemap 9/9`, sweep line 52, asserts 42/42 product `<loc>`s).
expected:     Two separate things. (1) The number is a count of a file the owner edits on another screen and there is nothing tying them together — `admin/add.php` and `admin/delete.php` do not touch `content.json`. A count that must be maintained by hand in a second place is the shape of a claim that goes stale; the site already derives the 42 PDFs correctly on `/datasheets`, so the number is derivable. (2) "Products Stocked" over-counts by one today, because one record is a service, and "Datasheet published for every one" is true only because the services record also has a PDF.
consequence:  Rick's first act after go-live is likely to be adding a product — the admin's whole purpose. The homepage then says 42 while the catalog holds 43, and nothing tells him. A buyer comparing the stat against the catalog finds the discrepancy on the second page they visit. Medium, not Low: it is a number on the homepage that a purchasing person quotes, and the mechanism guarantees it drifts.
evidence:     `_harness/out/audit9/P4/shape-report.txt`; `_harness/out/audit9/P4/leaves-report.txt`; `_harness/out/audit9/P4/claims-register.md` row 23
verified-by:  pending V
outcome:      owner action: Page Content → Stats → row 2 — decide whether the services record counts, and re-check the number whenever a product is added or removed. The durable fix (derive `stats[1].value` from `products.length` when the owner leaves it blank) is a `code` change and is **not** taken by this pass — it is outside P4's brief and would change what an owner-typed stat means.
fix-proof:    n/a

---

### A-9.P4-5 — MEDIUM — the Product Index sorts its Temp column as text, so ascending puts the hottest part first

class:        code + data-live
pass:         P4        ledger: E095, E097
surface:      `/dashboard` (Product Index), Temp column header
where:        `src/App.jsx:10006` (`{ key: "operatingTemp", label: "Temp" }`) and `src/App.jsx:10101-10116` (the `.sort()` — `av.localeCompare(bv, undefined, {sensitivity:"base"})` on the raw string for every column); the data is `data/products-all.json` `operatingTemp` on all 42 records, edited on Products → Edit.  (measured 2026-09-14)
not in §11:   checked GUARDRAILS §7–§7.3, `PLAN-10` §12 and `_harness/AUDIT10-REPORT.md` (A10 findings on `/dashboard` are the **column-width** collapse, `PLAN-10` §"The defect" at `DASHBOARD_COLS`; nothing about the sort), `audit5.md`–`audit8.md`, `WHATS_LEFT.md` §2–3. `grep -rn "operatingTemp" audit-runs/ WHATS_LEFT.md` → the only hits are `plans/PLAN-10` quoting `DASHBOARD_COLS` for its widths. New.
reproduce:    ```
              node -e "const p=require('./data/products-all.json');
              [...p].sort((a,b)=>String(a.operatingTemp||'').localeCompare(String(b.operatingTemp||''),undefined,{sensitivity:'base'}))
                .forEach(r=>console.log(r.sku.padEnd(28), JSON.stringify(r.operatingTemp)));"
              ```
              (This is the module-level sort at `src/App.jsx:10101-10116` with `sortCol="operatingTemp"`, `sortDir="asc"`, reproduced on the data alone — no server needed. Full output: `_harness/out/audit9/P4/tempsort.txt`.)
observed:     Seven empty strings sort to the top, then:
              ```
              IP37SH-IP36TH-IP39LH   "-100°F to 500°F"     <- the HIGHEST ceiling in the catalog, first
              IP3L                   "-20°C to +100°C"
              IP10EX                 "-20°C to 105°C"
              ...
              IP52EC                 "-55°C to 225°C"
              VT-1100                "250°F – 1100°F"
              IP61ES-IP62EF          "Rated to 125°C"
              CCS                    "Temperature index 125°C"
              CC90 / IP63ES          "Up to 125°C"
              IP46MD / IP47HV        "Up to 90°C"          <- one of the LOWEST, last
              ```
              30 distinct formats over 42 records, listed in `_harness/out/audit9/P4/shape-report.txt` § operatingTemp: `°C`-only, `°F`-only, dual (`-275°F to 500°F (-70°C to 260°C)`), per-material lists (`IP13SP`, `IP71NS-IP72PS-IP73PP`, `IP64FS-IP65VC-IP66AC-IP67SC`), `Up to …`, `Rated to …`, `Temperature index …`, and 7 empty (`CC`, `CT`, `IP15PV`, `IP25PU`, `IP44A2-IP45A3`, `IP75AD`, `VALUE-ADDED`).
expected:     The column is sortable and the page's own meta description sells it: *"Search and **sort** all IPC products by part number, material, and **temperature rating**"* (`data/content.json` `seo[2].desc`, `SEO_DEFAULT[2]`). A temperature sort has to order by temperature. Either the column parses a numeric ceiling out of the string and sorts on that (with the raw string still displayed), or it is not offered as a sort key. P4 finding criterion: "a malformed record a reader mishandles".
consequence:  This is the page a buyer uses to find a part by rating — it is the only tabular view of the catalog. Sorting Temp ascending presents the 500 °F part as the coldest and the 90 °C parts as the hottest; there is no error, no signal, and the result looks ordered. A buyer who trusts it picks the wrong part. Medium rather than High: `/dashboard` is a secondary path (the catalog and the family filter are the primary ones) and the raw rating is visible in each row, so the workaround is to read instead of sort.
evidence:     `_harness/out/audit9/P4/tempsort.txt`; `_harness/out/audit9/P4/shape-report.txt` § operatingTemp; `data/content.json` `seo[2].desc`
verified-by:  pending V
outcome:      escalated: `decision-needed: parse the temperature ceiling for sorting, or remove Temp from the sortable columns | recommended: parse — every non-empty value contains at least one signed number with a °C/°F marker, so a max-in-°C key is derivable for 35 of 42 and the 7 empties sort last either way | why: the page advertises the sort and the sort is wrong in both directions | trade-off: a parser has to be right about "Up to", "Rated to", "Temperature index" and the per-material lists, and a wrong parser is worse than an honest text sort; normalising the 42 strings to one format instead is a data-live job and does not fix the °C/°F mix | blocked: no — but it is a code change in App.jsx outside this pass's fix fence`
fix-proof:    n/a

---

### A-9.P4-6 — LOW — the About page writes the street address as "Drive" while every other rendering says "Dr"

class:        code
pass:         P4        ledger: E096
surface:      `/about`
where:        `src/App.jsx:3193`, `:3232`, `:3673` — "250 Gibraltar Drive" (hardcoded, one in body prose, two in `alt` text). Against `data/site-info.json` `address.street` = `"250 Gibraltar Dr"`, rendered in the footer, on `/contact`, in `privacySections[6]`, and in Organization JSON-LD `address.streetAddress`.  (measured 2026-09-14)
not in §11:   checked GUARDRAILS §7–§7.3, all four prior `audit-runs/audit<n>.md`, `UX_AUDIT_PREPROD` F1–F17, `WHATS_LEFT.md` §2–3. `grep -rn "Gibraltar Drive" audit-runs/*.md plans/GUARDRAILS.md` → no hits. New.
reproduce:    ```
              grep -n "Gibraltar Drive" src/App.jsx
              node -e "console.log(require('./data/site-info.json').address.street)"
              node -e "const j=require('./_harness/out/audit9/I-crawl/about/1440x900.json');
                       console.log(j.jsonLd.map(b=>JSON.parse(b.raw)).find(o=>String(o['@type']).includes('Organization')).address.streetAddress)"
              ```
observed:     ```
              src/App.jsx:3193:  IPC has stocked, cut and shipped from 250 Gibraltar Drive for over fifty years — ...
              src/App.jsx:3232:  The IPC facility at 250 Gibraltar Drive, Bolingbrook, Illinois
              src/App.jsx:3673:  The IPC facility at 250 Gibraltar Drive, Bolingbrook, Illinois
              250 Gibraltar Dr
              250 Gibraltar Dr
              ```
              So `/about` renders both forms on the same page: "Drive" in the prose and the photo `alt`, "Dr" in the footer below it and in the JSON-LD the page emits.
expected:     One form. `site-info.json` is the source of the address — the owner edits it on Business Details — and three hardcoded strings bypass it. Either they read `site.address.street` or they match it. Appendix B's rule for the phone number ("the site-info form everywhere it is not dialled") is the same rule.
consequence:  Small. NAP (name/address/phone) consistency is a local-search signal and the `alt` text is what a screen-reader user hears; neither is damaged by "Drive", but a hardcoded address that ignores the owner's field means moving premises leaves three stale strings behind in a 12,900-line file. Low.
evidence:     `_harness/out/audit9/P4/claims-register.md` row 4; `_harness/out/audit9/P4/claims-raw.txt` § `address`; `_harness/out/audit9/P4/jsonld-report.txt`
verified-by:  pending V
outcome:      fix candidate for C — `code`, three strings, delta-only.
fix-proof:    n/a

---

### A-9.P4-7 — LOW — the Organization structured data hardcodes the logo and ignores the field Business Details offers for it

class:        code
pass:         P4        ledger: E022, E096
surface:      every route (the Organization JSON-LD block renders site-wide)
where:        `src/App.jsx:7184` — `logo: \`${SITE_ORIGIN}/favicon.svg\``. The owner-editable field is `data/site-info.json` `theme.logoUrl`, written by `admin/settings.php:111` and edited at `admin/settings.php:310`; it is read at three render sites (`src/App.jsx:623`, `:8905`, `:12525`) and by nothing else.  (measured 2026-09-14)
not in §11:   checked GUARDRAILS §7–§7.3 (§7.3 settles the logo **`alt=""` + `aria-label`** decision, C43 — a different thing), `audit5.md`–`audit8.md`, `WHATS_LEFT.md` §2–3. `grep -rn "theme.logoUrl\|favicon.svg" audit-runs/*.md plans/GUARDRAILS.md` → no hits. New.
reproduce:    ```
              grep -n 'logo: ' src/App.jsx
              grep -n 'logoUrl' admin/settings.php src/App.jsx
              node -e "const j=require('./_harness/out/audit9/I-crawl/home/1440x900.json');
                       console.log(j.jsonLd.map(b=>JSON.parse(b.raw)).find(o=>String(o['@type']).includes('Organization')).logo)"
              cmp public/favicon.svg public/logo.svg && echo BYTE-IDENTICAL
              ```
observed:     ```
              src/App.jsx:7184:      logo: `${SITE_ORIGIN}/favicon.svg`,
              admin/settings.php:310:  <input type="text" id="theme_logo" name="theme_logo" ... placeholder="/logo.svg or https://…" />
              src/App.jsx:623 / :8905 / :12525:  src={site.theme?.logoUrl || "/logo.svg"}
              https://www.insulationproducts.com/favicon.svg
              BYTE-IDENTICAL
              ```
expected:     `logo` should follow `theme.logoUrl` with `/logo.svg` as the fallback, the way the three render sites already do. The two files are byte-identical **today**, which is exactly why this is invisible: it becomes wrong the first time Rick puts a real logo in that field.
consequence:  Today: none — the URLs differ but the bytes do not. After the first logo change: the navbar, the product page and the footer show the new logo while the structured data goes on telling Google the old one, and Rick has no way to see that from the admin. This is the same "two derivations of one fact" shape `KNOWN_ROUTES` was written to avoid (`src/App.jsx:6948-6957`). Low.
evidence:     `_harness/out/audit9/P4/jsonld-report.txt`; `admin/settings.php:111,310`
verified-by:  pending V
outcome:      fix candidate for C — `code`, one line, delta-only.
fix-proof:    n/a

---

### A-9.P4-8 — MEDIUM — five of 42 product pages have no photograph, and that has never been decided

class:        decision
pass:         P4        ledger: E095, E101
surface:      `/products?productId=…` for `IP12GA-IP1274`, `IP13SP`, `IP25PU`, `IP30UV`, `IP47HV`; the same five cards on `/dashboard` and `/datasheets`
where:        `data/products-all.json` `photoUrl` on those five SKUs = `https://placehold.co/400x300/e8edf2/005da3?text=…`. Render guards: `src/App.jsx:8844`, `:9323`, `:7507`.  (measured 2026-09-14)
not in §11:   checked `audit1.md` (raised, Low, "needs real product photography"), `audit2.md` A-17, `audit3.md`, `audit4.md` (both "Unchanged"), `WHATS_LEFT.md:162` ("the five `placehold.co` URLs are untouched", 2026-08-06), ledger rows E095/E101 ("closed since — re-verify, do not re-report"). **This is not a re-report of A-17.** A-17 was closed as "unchanged / needs photography" — a status, not a decision — and PLAN-11's P4 brief step 4 names it explicitly as a `decision` to be escalated this round, which is what a status was never turned into. The *measurement* is also corrected below: the prior framing (`audit1.md`: "a cross-origin request from every product page") does not hold.
reproduce:    ```
              node -e "require('./data/products-all.json').filter(p=>/placehold\.co/.test(p.photoUrl||''))
                       .forEach(p=>console.log(p.sku, p.photoUrl))"
              grep -n 'placehold\.co' src/App.jsx
              node -e "const j=require('./_harness/out/audit9/I-crawl/product-IP13SP/1440x900.json');
                       console.log('requests to placehold.co:', j.requests.filter(r=>/placehold\.co/.test(r.url||r)).length);
                       console.log('failed requests:', j.failedRequests.length, ' >=400:', j.responsesAtLeast400.length);"
              ```
observed:     ```
              IP12GA-IP1274  https://placehold.co/400x300/e8edf2/005da3?text=IP12GA%20-%20IP1274
              IP13SP         https://placehold.co/400x300/e8edf2/005da3?text=IP13SP
              IP25PU         https://placehold.co/400x300/e8edf2/005da3?text=IP25PU
              IP30UV         https://placehold.co/400x300/e8edf2/005da3?text=IP30UV
              IP47HV         https://placehold.co/400x300/e8edf2/005da3?text=IP47HV
              src/App.jsx:7507:  matched.photoUrl && !String(matched.photoUrl).includes("placehold.co")   <- og:image
              src/App.jsx:8844:  product.photoUrl && !asText(product.photoUrl).includes("placehold.co")   <- product page
              src/App.jsx:9323:  p.photoUrl && !String(p.photoUrl).includes("placehold.co")               <- datasheet card
              requests to placehold.co: 0     failed requests: 0    >=400: 0
              ```
              The other 37 `photoUrl`s and all 42 `pdfUrl`s resolve byte-exact on disk (`imgcheck` ok, sweep line 19; 79 paths). The 80th path — `IP52EC.additionalPdfs[0].url` — is **not** in `imgcheck`'s scope (`_harness/imgcheck.js:111` reads `photoUrl` and `pdfUrl` only); verified separately here: 43/43 pdf references resolve, 0 orphans except `.htaccess` and `marketing/`.
expected:     Either a photograph, or a recorded decision that the "image coming soon" panel is acceptable for these five. What exists is neither: four audits recorded "unchanged".
consequence:  12 % of the catalog shows a grey panel where a spec-grade buyer expects to see the part, on the page the sitemap advertises and the RFQ button sits on. `og:image` falls back to the generic share card for those five, so they also share badly. No runtime cost and no third-party dependency on the public site — see the self-correction below.
evidence:     `_harness/out/audit9/P4/shape-report.txt` § photoUrl; `_harness/out/audit9/I-crawl/product-IP13SP/1440x900.json`
verified-by:  pending V
outcome:      escalated: `decision-needed: photograph the five products, or accept the placeholder panel and record it | recommended: ask Rick for five photographs; until they exist, leave the five photoUrl values exactly as they are — the render guard depends on the literal string "placehold.co" | why: four audits recorded this as "unchanged" and none of them recorded a decision | trade-off: five photographs is the owner's time; the placeholder is honest but weak on the surface that closes a sale | blocked: needs Rick. PLAN-11 §7.3 and the P4 brief both forbid replacing the values.`
fix-proof:    n/a — "Do not replace them" (P4 brief step 4)

---

### A-9.P4-9 — LOW — Product structured data omits `image` and `offers` on all 42 product pages

class:        code (the `image` half) + decision (the `offers` half)
pass:         P4        ledger: E022, E036
surface:      all 42 `/products?productId=…` routes
where:        `src/App.jsx` `StructuredData`, the Product block (the emitted object is in `_harness/out/audit9/I-crawl/product-*/1440x900.json`).  (measured 2026-09-14)
not in §11:   checked GUARDRAILS §7–§7.3, `audit7.md` §3–4 and `audit8.md` §2–5 (both cover `BreadcrumbList` and origin consistency; `WHATS_LEFT.md:59` item 4.2 covers the Product `description` **type**, which is the thing that *is* right), `WHATS_LEFT.md` §2–3. `grep -rn "offers\|aggregateRating" audit-runs/*.md` → four unrelated hits about `content.php` "offers those fields". New.
reproduce:    ```
              node -e "const fs=require('fs'),D='./_harness/out/audit9/I-crawl/';
              const idx=require(D+'index.json');
              const s=[...new Set(idx.pages.filter(p=>p.slug.startsWith('product-')).map(p=>p.slug))];
              const k={}; for(const x of s){const j=JSON.parse(fs.readFileSync(D+x+'/1440x900.json','utf8'));
                for(const b of j.jsonLd){const o=JSON.parse(b.raw); if(o['@type']==='Product') Object.keys(o).forEach(p=>k[p]=(k[p]||0)+1);}}
              console.log(s.length,'product routes:',JSON.stringify(k));"
              ```
observed:     ```
              42 product routes: {"@context":42,"@type":42,"name":42,"sku":42,"description":42,"brand":42,"manufacturer":42}
              ```
              No `image`, no `offers`, no `url`, no `mpn`. 37 of the 42 carry a real local `photoUrl` that resolves byte-exact (`imgcheck`, sweep line 19) and is already rendered on the page.
expected:     `image` is the cheapest recommended Product property here: the value exists, is validated, and the page already paints it; the five `placehold.co` records would be omitted by the same guard `src/App.jsx:8844` already applies. `offers` (or `review`/`aggregateRating`) is what makes a Product block eligible for a Product rich result at all — without one Search Console reports "Missing field offers" on all 42 and the markup earns nothing.
consequence:  The 42 product pages are the pages that should win a search for a part number. As emitted, the Product block is valid schema.org and ineligible for the rich result, and Search Console will list 42 warnings that look like a site-wide fault. `name`/`sku`/`description`/`brand`/`manufacturer` are all correct and `description` is a string (`WHATS_LEFT.md` 4.2, re-verified), so this is an omission, not a defect. Low.
evidence:     `_harness/out/audit9/P4/jsonld-report.txt`; `_harness/out/audit9/I-crawl/product-CC/1440x900.json`
verified-by:  pending V
outcome:      escalated: `decision-needed: add image, and decide whether IPC states availability without a price | recommended: add image (code, uses the existing guard); leave offers alone until Rick says what IPC is willing to publish | why: image is free and offers is the only thing standing between valid markup and an eligible rich result | trade-off: an offers block with no price is itself a warning, and publishing availability is a commercial commitment | blocked: the offers half needs Rick`
fix-proof:    n/a

---

### A-9.P4-10 — LOW — inside one spec-table column the same size is written with and without the inch mark

class:        data-live
pass:         P4        ledger: E036, E095
surface:      the right-hand spec table on `IP12GA-IP1274`, `IP17TW-IP18SW-IP19LW`, `IP37SH-IP36TH-IP39LH`, `IP38FE`, `IP42MW`
where:        `data/products-all.json` `specTable2.rows[][0]` on those five SKUs, edited on Products → Edit.  (measured 2026-09-14)
not in §11:   checked GUARDRAILS §7–§7.3, `audit7.md` A-7.8 (the spec-table **shape** gate — the shape is clean here, see below), `audit5.md` A-5.12, `WHATS_LEFT.md` 4.29, §2–3. New.
reproduce:    ```
              node -e "const p=require('./data/products-all.json');
              for (const s of ['IP42MW','IP38FE','IP12GA-IP1274'])
                console.log(s, JSON.stringify(p.find(x=>x.sku===s).specTable2.rows.map(r=>r[0])));"
              ```
observed:     ```
              IP42MW        ["1/8","3/16","1/4","3/8","1/2","3/4","1\""]
              IP38FE        ["1.3 to 1 Shrink","24",...,"3/8","7/16","1/2","5/8","3/4","7/8","1\"","1.67 to 1 Shrink","3/32","1/8","3/16","1/4","3/8","1/2","3/4","1\"","1-1/2"]
              IP12GA-IP1274 ["24","22",...,"5 (3/16\")","4","3","1/4\"","2","1","0","5/16\"","3/8\"",...,"2\""]
              ```
              Counted across the five: 41 cells with an inch mark, 112 without, in the **same column** of the same table. Full list: `_harness/out/audit9/P4/spectable2-units.txt`. (A column that legitimately runs from AWG gauge numbers into fractional inches — `IP12GA-IP1274`, `IP17TW-IP18SW-IP19LW`, `IP37SH-IP36TH-IP39LH`, `IP38FE` — is not the finding; the finding is that within the *fractional-inch run* only some entries are marked.)
expected:     One unit notation per column. `IP42MW` is the cleanest case: seven fractional inches, six bare and the seventh marked.
consequence:  A buyer reading `3/4` above `1"` has to decide whether the column changed units. It never does. Low — cosmetic, but it is on the spec table, which is the one place on the site where notation carries meaning.
evidence:     `_harness/out/audit9/P4/spectable2-units.txt`; `_harness/out/audit9/P4/spectable2.txt`
verified-by:  pending V — sample 3 of 5 (`IP42MW`, `IP38FE`, `IP12GA-IP1274` are the three shown above)
outcome:      owner action: Products → Edit → the five SKUs → spec table column 1. Batched with P5a's data-string batches.
fix-proof:    n/a

---

## Checked, no finding — with the measurement

**Step 1 — live/repo.** STEP 0 = **NOT LIVE** (`_harness/out/audit9/step0.md`). There is no live/repo diff to classify and no `data-live` split; the repo `data/*.json` are the audit's truth. Confirmed the three repo files are byte-identical to `_harness/pristine/` (`diff -q` × 3, all IDENTICAL), so the two investigative tools that read `pristine/` are reading the same bytes. The known owner-action candidates the brief named: the **A-8.7/A-8.8 privacy sections are present in the repo** (step 5 below) and the **four `photoUrl` case corrections are present** (`imgcheck` ok, 79 paths byte-exact, sweep line 19) — both as PR #53 / the 2026-08-06 precedent recorded. Both still need applying **live** through the admin after first deploy, which is the runbook's job (P8), not a P4 finding.

**Step 2 — register.** 25 rows, `_harness/out/audit9/P4/claims-register.md`. Every row carries a source or `[UNSOURCED]`. Rows with **no disagreement**: phone, fax, email, hours, founded date, "over 50 years", "25 million feet", "$50 minimum", JIT, "privately held", slogan, social profiles. `hours.text` / `opens` / `closes` / `days` agree with each other and with the Organization JSON-LD (all four checked programmatically, `jsonld-report.txt`, 0 problems). The phone appears in exactly one prose form, `630.771.0700`, everywhere it is not dialled — Appendix B's rule, satisfied.

**Step 3 — certifications.** `isoclaims 2/4`, the documented expected red (sweep line 22; full output `P4/isoclaims.txt`): three `ISO 9001:2008` in `content.json` and three `ISO9001:2000` on `VALUE-ADDED`. **This is A-8.5, still open and registrar-gated — cited, not re-reported, and `:2015` is not written anywhere by this pass.** `site-info.json certifications.iso` still holds the bare unversioned `"ISO 9001"` (the fourth assertion, green). `plan8-certs 5/5` (sweep line 61) confirms the certification claims that *do* come from site-info render from it. What is **new** and recorded above: `certifications.other` is `[]` while five certification chips render (A-9.P4-2 for the origin claim, A-9.P4-3 for the category names).

**Step 4 — products.** 42 records. `sku` non-empty 42/42, unique 42/42, sorted by SKU (the order `save_products()` writes). `id === sku` on **36 of 42**; the six that differ are the compound parts whose `id` carries the vendor's spacing (`"IP12GA - IP1274"` vs sku `"IP12GA-IP1274"`). Not a finding: `sitemap.php` emits the `id` form and `plan5b-sitemap 9/9` asserts all 42 `<loc>`s equal the canonical each page declares for itself, and `WHATS_LEFT.md:2530` records the encoding check that covers the spaces and ampersands. **Spec tables: 0 malformed in the A-7.8 sense** — 0 rows that would be silently dropped from either table, 0 `columnSpans`/row-width mismatches over the 39 tables that have rows, 0 products with no drawable rows. The 157 `specTable1` rows carrying `label: null` are the **intentional continuation-row shape**: `asText(null) === ""` and `src/App.jsx:8369` skips the label span, so they render as an unlabelled value line, which is what they are for. Nine rows render a blank *value* (`{"label":"Polyethylene","value":""}` and eight like it) — these are sub-headings written as label-only rows and they render as a bold line with nothing after it, which is the intent. `partType` ∈ the 11 `FAMILY_ORDER` families: **10 of the 11 used, 0 unknown** ("Elastomeric Heat Shrink" is unused; `ProductSidebar` builds its groups from the products, `src/App.jsx:7821-7838`, so an unused family renders nothing). `badges`: 3 or 4 per product, 42/42 arrays, **112 distinct strings — and `badges` is not the approvals field.** No record carries an `approvals` key at all, so `productApprovals()` (`src/App.jsx:2776`) derives all 42 from text against the 12-name whitelist, and `plan7-approvals` in the sweep is what holds PHP and JS to the same derivation. The brief's "`badges` ⊆ the 12 approvals" does not describe this data; the free-text badge strings are P5a's surface and are batched there. `pdfLabel`/`additionalPdfs`: on **exactly one** product (`IP52EC`, `pdfLabel:"Molded Cap"`, one extra `"Plugged Cap"`), both rendering (`src/App.jsx:8739`/`:8746` and `:9849`/`:9856`); the other 41 have neither key, `productExtraPdfs()` returns `[]`, and **no empty slot renders**. `pdfUrl` empty on 0 of 42; all 43 pdf references (42 + the one extra) resolve byte-exact on disk, 0 orphans beyond `.htaccess` and `marketing/` (the `pdfs-marketing` sandbox artifact GUARDRAILS §7 already settles). `public/images/products/`: 37 files, 37 referenced, **0 orphans, 0 missing**. `public/images/_unmatched/adhesiveLined.webp` (ledger E119) is referenced by nothing in `src/`, `data/` or `admin/` — which matches `WHATS_LEFT.md:176`'s measurement and its 2026-08-07 decision to keep it; not a finding, and GUARDRAILS §2 forbids deleting it. E171: the five photo-slot defaults resolve — `slotSrc()` (`src/App.jsx`) prefixes the leading `/`, and `Marker-Sample-2.jpg`, `staff.jpg` and `IPC-Building.jpg` are all present in `public/images/site/`.

**Step 5 — content and site-info.** `data/content.json`: **0 empty or null leaves** anywhere in the 17 top-level keys, so `COPY_CLEARABLE` is not exercised by the shipped data at all. `data/site-info.json`: two empty leaves, `certifications.other` (`[]`) and `catalogPdfUrl` (`""`), **neither in `SITE_CLEARABLE` and neither a defect** — both `SITE_DEFAULTS` values are identically empty (`src/App.jsx:6413`, `:6442`), so invariant 4's blank-drop is inert for them (it "only bites when the default is non-empty", the comment at `src/App.jsx:6477-6481` says so for the same reason). **All 26 `page`-type fields resolve to a known route** — `home`, `products`, `dashboard`, `industries`, `services`, `about`, `faq`, `contact`, `privacy`, every one in `KNOWN_ROUTES` (`src/App.jsx:6958`, derived from `SEO_DEFAULT`) and every one with a `case` in the renderer (`src/App.jsx:13061-13082`). `deadlinks`: **"0 of 18 resolve to nothing"** (sweep line 17) — and measured directly, all 18 industry references resolve on the *first* branch of the lookup chain (13 by `sku`, 5 by `id`), so none is relying on the `normalizeSku`/`skuSegmentMatch` fallbacks. `seo[]` is **exactly 9 rows**, every `page` a known route, no duplicates, no empty title or desc. `privacySections` carries **all seven** sections and both A-8.7 and A-8.8 texts: §1 *Information We Collect* discloses the automatically-recorded IP address including on rejected submissions, and §3 *Data Retention* says records "are not deleted automatically" rather than promising a three-year ceiling. Both are **byte-identical to `PRIVACY_SECTIONS` in `src/App.jsx`** (7/7 titles and 7/7 contents compared programmatically) — i.e. present in both copies, as `audit8.md` §3a records. Per §7.3 and P5a rule 10 the wording is not touched.

**Step 6.** Deleted in rev 2 — type tolerance of `content.json` / `site-info.json` is **P7 rows C7–C8**; cited, not measured here (PLAN-11 §3.3 single-owner table).

**Step 7 — structured data.** 67 routes × 5 viewports = 293 pages, `couldNotCrawl: 0`. **Every JSON-LD block on every route parses as valid JSON, and the blocks are byte-identical across all five viewports on all 67 routes.** Organization+LocalBusiness on all 67: `name`, `url`, `telephone` present; all five address fields present and equal to `site-info.json`; `openingHoursSpecification` `opens`/`closes`/`dayOfWeek` equal to `site-info.json` `hours`. `foundingDate` is the **bare year** — A-8.9's correction is in place (`src/App.jsx:7186-7193`), re-verified, not re-reported. Product on all 42 product routes: `name`, `sku` and `description` present, and `description` is a **string** on 42/42 (`WHATS_LEFT.md` 4.2, re-verified). `manufacturer.url` = `SITE_ORIGIN` on 42/42; `brand` carries `@type:"Brand"` and `name` and no `url` — **not a finding**, `brand.name` is the property Google's Product guidance asks for and the name matches the Organization's. BreadcrumbList: every `item` absolute on every route that emits one, and the trailing item equals the page's own canonical on all of them (C33's contract, re-verified — GUARDRAILS §7.2 already refutes the general form). FAQPage on `/faq`: **19 Question entries, and all 19 `name` and all 19 `acceptedAnswer.text` are byte-equal to `content.json` `faq[].question`/`.answer`; all 19 questions are present in the rendered accordion.** `manifest.json` carries its icon (the A-13 item the ledger flags as closed — re-verified, not re-reported), and `robots.txt`'s `/data/` note is intact (`audit5.md` A-5.2's reasoning); `sitemap.php` is covered by `plan5b-sitemap 9/9`.

## Self-corrections

1. **`checkskus.js` reports "unmatched: 5" and that is the tool, not the data.** It compares industry references against `sku` only (`_harness/checkskus.js:17,27`); the five it flags match on `id`. Measured: 13 match `sku`, 5 match `id`, 0 match neither. `deadlinks.js`, which runs `App.jsx`'s own lookup chain, is the one to cite, and it says "0 of 18 resolve to nothing". Recorded because a reader of `P4/checkskus.txt` alone would raise a false finding.
2. **My first spec-table check flagged 157 `specTable1` rows as malformed.** It required `label` to be a string. `label: null` is the deliberate continuation-row shape and `asText()` renders it correctly (`src/App.jsx:8369`). The check was rewritten to test what the component actually draws; the corrected count is 0 malformed. This is GUARDRAILS §4.4's point from the other side — a check that fails for the wrong reason.
3. **My first JSON-LD check reported "19 FAQ answers not in the rendered accordion".** The accordion is collapsed on first paint, so the answer text is not in the accessibility snapshot. The real check — JSON-LD text against `content.json` — is 19/19 exact. GUARDRAILS §7.1: the probe is not the page.

## Out of brief

- `admin/content.php` — Page Content has no SEO row for `/datasheets`: `SEO_DEFAULT` has 10 rows and `content.json seo[]` has 9, which the B25 fallback handles in code (`src/App.jsx:7363-7374`) but leaves Rick unable to write that page's title or description.
- `WHATS_LEFT.md:71` item 4.22 — the admin's CSP allows `placehold.co` previews, so the admin is the only surface that makes a live third-party request for the five placeholder photos; the public site makes none (measured in A-9.P4-8).
- `data/content.json` — no returns, RMA or warranty statement exists in the 19 FAQ pairs or the seven privacy sections.
