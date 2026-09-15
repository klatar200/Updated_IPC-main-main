# Claims register — 2026-09-15

Every factual claim the site publishes, what evidence exists for it, and where
that evidence stops.

Commissioned after POST-9.1 ("42 Products Stocked" counts catalog pages, not
products): *"let's re-audit all of the claims made in the project… listed out
with the evidence for each claim. Even if the evidence is just what the last
live site at insulationproducts.com had."*

**The headline.** Of **83** claims, **81 predate this project** — they were on
the customer's own site before this repository's first commit, and the live
predecessor still serving `insulationproducts.com` today says them verbatim.
**Two** were introduced here, both in the homepage stats strip, and one of those
two is POST-9.1. So this is not a site full of invented claims. It is IPC's own
long-standing marketing, carried forward, and the useful question about almost
every row below is not *"who wrote this?"* but *"what document backs it, and does
Rick have it?"*

The one substantive new finding is **CLAIM-1**: the whole-line RoHS attestation,
published in eight places, is carried by **2 of 42 datasheets**.

---

## 1. What was measured, and what each measurement can and cannot prove

| Instrument | What it reads | What it proves | What it cannot |
|---|---|---|---|
| `_harness/claims-extract.js` | every string leaf of `data/*.json`, `index.html`, `public/contact.php`, `src/App.jsx` | that the register's denominator is the whole surface — 14,747 strings scanned, 428 candidates | nothing about truth |
| `_harness/claims-composite.js` | the claim-bearing blocks, one claim per entry | the 83 rows below, at the granularity a visitor reads them | — |
| `_harness/claims-provenance.js` | the live predecessor's bundle | whether IPC was already making the claim | whether it was ever true |
| `_harness/claims-catalog.js` | all 42 records of `data/products-all.json` | how much of the catalog's own copy backs a site-wide claim | that copy ≠ conformity |
| `_harness/claims-pdfs.js` | the text of all 42 files in `pdfs/` | how many **datasheets** carry the mark | that a datasheet's silence is not a denial |

**The provenance corpus** is `/site/assets/index-DGU_uWZM.js`, captured read-only
on 2026-09-15 from the live host. It is a predecessor of this app, not a build
of this repo (`live-triage-2026-09-15.md` §5), which is what makes it an
independent witness rather than a mirror. The matcher is deliberately generous —
it calls a claim inherited on a 24-character run — because a false "inherited"
costs nothing and a false "introduced" sends Keagan chasing a claim IPC has made
for years.

**The datasheet extractor is crude by design** (inflate the Flate streams, pull
the text operators) so this pass needs no dependency and no network. It
recovered text from **42 of 42** files, so no row below is an absence that might
be the tool's fault. It still cannot read a mark that lives only in an image.

### Verdict vocabulary

| Verdict | Means |
|---|---|
| **CONSISTENT** | an internal fact (phone, address, hours), identical in every place it is written |
| **DERIVED** | computed from the repo's data at render time rather than typed |
| **SUPPORTED** *(n/42)* | the datasheets carry it, and the wording matches what n of 42 supports |
| **THIN** *(n/42)* | published as a claim about the **whole line**; n of 42 datasheets carry it |
| **INHERITED-UNSOURCED** | on IPC's own site before this project; no document in this repo backs it; only IPC can |
| **INTRODUCED-UNSOURCED** | written here; nothing backs it |
| **CONTRADICTED** | the repo's own data argues the other way |

`INHERITED-UNSOURCED` is **not an accusation**. A stocking distributor's
inventory figure, minimum order and shipping window are business facts that live
in an ERP, not in a git repository. The label means "this audit cannot check it",
not "this is false".

---

## 2. The register

### 2.1 Homepage stats strip — `content.json stats[]`

| ID | Claim, as published | Where | Live site said it? | Evidence | Verdict |
|---|---|---|---|---|---|
| STAT-1 | **50+** Years in Business — *Founded July 1, 1974* | `content.json:37` | yes, verbatim | 2026 − 1974 = **52**; the date agrees in `site-info company.foundedYear`, `about.paragraphs[0]`, `milestones[0]`, `certs[5]` and the client-rendered JSON-LD `foundingDate`. Holds until 2034. | **SUPPORTED** |
| STAT-2 | **42** Products Stocked — *Datasheet published for every one* | `content.json:43` | **no — new here** | 42 catalog **records**, but **53** distinct part numbers, one record is a service page (`VALUE-ADDED`) and one is a duplicate pairing of two records that also stand alone (`IP12GA-IP1274`). The sub-claim holds exactly: **42/42** records carry a `pdfUrl`. | **INTRODUCED-UNSOURCED** → CLAIM-2 |
| STAT-3 | **$50** Minimum Order — *No large MOQ required* | `content.json:49` | yes, verbatim | agrees with `site-info stats.minimumOrder`, FAQ-9, the meta description and three hero strings | **INHERITED-UNSOURCED** |
| STAT-4 | **≤1 week** Custom Fabrication — *Cut · mark · spool · kit* | `content.json:55` | the **claim** yes, this **slot** no | the live site wrote it "≤ 1 week" (with the space) in its services copy and its `Custom Lead Time` row; what is new is promoting it into the stats strip, where it displaced *"≤1 Day Shipment Available"*. All six `services[].leadTime` values agree. | **INHERITED-UNSOURCED** (repackaged) |

### 2.2 Hero proof points and trust strip — `heroProofPoints[]`, `heroTrust[]`

All ten trust items and all four proof points appear **verbatim** in the live
predecessor's bundle, in the same order.

| ID | Claim | Evidence | Verdict |
|---|---|---|---|
| HERO-1, TRUST-8 | $50 Minimum Order | as STAT-3 | INHERITED-UNSOURCED |
| HERO-2, TRUST-9 | 25M+ Feet in Stock | `site-info stats.feetInStock` "25 million", `about.paragraphs[1]`, FAQ-10, `copy.hero.headlineLine1`, og:description. Nothing in the repo can count feet. | INHERITED-UNSOURCED |
| HERO-3, TRUST-10 | Same Day Shipment Available — *On in-stock items* | FAQ-10 and `about.paragraphs[1]` both say "same day **or next business day**"; `contact.php`'s auto-reply says "within one business day — often the same day". The live site's own stats strip said **"≤1 Day … On most stock items"**. Qualified consistently everywhere; no repo evidence either way. | INHERITED-UNSOURCED |
| HERO-4, TRUST-1, CERT-1 | ISO 9001 / **ISO 9001:2008** Registered | `site-info certifications.iso` = `"ISO 9001"` (unversioned); the `:2008` suffix is typed into `content.json` in 3 places and appears **5×** in the live predecessor too. **ISO 9001:2008 was withdrawn in September 2018.** 1 of 42 datasheets mentions ISO 9001 at all (`Value-Added.pdf`). | INHERITED-UNSOURCED — **already open as `audit8.md` A-8.5**, registrar-gated |
| TRUST-2, CERT-2 | **Full RoHS Compliant Product Line** | **2 of 42 datasheets** and 2 of 42 catalog records mention RoHS (`IP29CG`, `IP53MP`) | **THIN (2/42)** → **CLAIM-1** |
| TRUST-3, CERT-4 | UL · CSA · MIL-SPEC · AMS **Rated Products** | datasheets: UL **25/42**, CSA **10/42**, MIL-SPEC **11/42**, AMS **6/42**. The wording claims *products*, not the line, and 25 of 42 is a fair reading of it. | **SUPPORTED** |
| TRUST-4, CERT-5 | PPAP & IMDS Documentation Available | a services claim, not a product property; `PPAP` 13/13 and `IMDS` 11/11 consistent across the copy (audit 9 P5a); FAQ-14 states it as an offer. Nothing here can verify a documentation capability. | INHERITED-UNSOURCED |
| TRUST-5 | Custom Cut · Hot-Stamp Mark · Spool & Kit | matches all six `services[]` entries and `about.paragraphs[2]` | INHERITED-UNSOURCED (capability) |
| TRUST-6 | JIT Delivery Programs Available | FAQ-13, `services[3].leadTime` "≤ 1 week (JIT by agreement)", `about.paragraphs[2]` | INHERITED-UNSOURCED (capability) |
| TRUST-7, CERT-3 | **Made in USA Since 1974** | 1 of 42 datasheets and 1 of 42 records (`IP75AD`, badge "Domestically Made") — and that record states it as a *differentiator*. The company self-describes as a distributor everywhere else. | **CONTRADICTED** — **already open as `audit9.md` A-9.P4-2** (High, escalated). New here: the datasheet count, and that the claim is **inherited**, not introduced. |
| CERT-6 | Privately Held — *Independent since July 1, 1974* | agrees with `about.paragraphs[0]` | INHERITED-UNSOURCED |

### 2.3 Company facts — `site-info.json`

| ID | Claim | Evidence | Verdict |
|---|---|---|---|
| CO-1 | Founded 1974 (July 1) | as STAT-1 | SUPPORTED (internally) |
| CO-2 | 25 million feet in stock | as HERO-2 | INHERITED-UNSOURCED |
| CO-3 | $50 minimum order | as STAT-3 | INHERITED-UNSOURCED |
| CO-4 | Certification: **ISO 9001**, `other: []` | the field is unversioned and correct. **Five certification chips render on the homepage while `certifications.other` is empty** — the chips are typed into `content.json`, not backed by this field. That mechanism is what lets an unsourced chip sit beside a sourced one. | see A-9.P4-2; recorded in `audit9.md` §P4 register rows 13–18 |
| — | phone `630.771.0700`, fax `630.771.0701`, `sales@insulationproducts.com`, 250 Gibraltar Dr, Bolingbrook IL 60440, Mon–Fri 8am–5pm CT | every other copy **derives** from these: `contact.php` reads `site-info` with these exact values only as fallbacks, and the JSON-LD is rendered from `site-info` at runtime (`App.jsx:7305`) rather than being a second typed copy. The live predecessor carries the same values. | **CONSISTENT / DERIVED** |
| ABOUT-1..4 | the four About paragraphs | every checkable number in them (1974, 25 million, $50, one week or less, "over 50 years") is one of the rows above. **ABOUT-4** is the exception and is already a finding: it writes "RoHS-**certified**" where RoHS is a self-declaration, and "UL-recognized, CSA-listed … FDA-compliant" as a whole-line list — `audit9.md` A-9.P5a covers the mark wording. | INHERITED-UNSOURCED; ABOUT-4 also **THIN (2/42)** on RoHS |

### 2.4 Milestones — `milestones[]`

All six verbatim on the live site. MILE-1 (1974 incorporation) is the only one
any repo data touches, and it agrees everywhere. MILE-2/4/5 are undated
narrative ("1980s", "2000s", "2010s") and carry no checkable number. MILE-3
("1990s — achieved ISO 9001 registration") is the date half of the A-8.5
question and should be answered with it. MILE-6 says "Celebrating 50 years" in
**2024**, which is correct for a 1974 founding.
→ **INHERITED-UNSOURCED** ×6.

### 2.5 Services — `services[]`

Six entries, all verbatim on the live site, all with `leadTime` "≤ 1 week"
(SVC-4: "≤ 1 week (JIT by agreement)"), consistent with FAQ-8 ("One week or
less…") and `about.paragraphs[2]` ("a typical lead time of one week or less").
No repo data can measure a lead time. → **INHERITED-UNSOURCED** ×6, internally
consistent.

### 2.6 Industry certification lists — `industryDetail[].certs[]`

These render as a "Certifications" list on each industry page. Each is checked
against the catalog and the datasheets on its most distinctive token; where the
only available token is a common word ("Class", "Approved", "Compliant",
"Material", "Conduit", "21"), the count would be meaningless and is
**[NOT-MEASURED]** rather than guessed.

| ID | Claim | Catalog | Datasheets | Verdict |
|---|---|---|---|---|
| IND-1.1 | Automotive — UL 224 VW-1 | 10/42 | 8/42 | SUPPORTED |
| IND-1.2 | Automotive — MIL-SPEC | 5/42 | 5/42 | SUPPORTED |
| IND-1.3 | Automotive — RoHS | 2/42 | 2/42 | see CLAIM-1 |
| IND-1.4 | Automotive — Ford LP Approved Variants | `IP13SP` | — | [NOT-MEASURED] — no distinctive token; one record names Ford |
| IND-2.1 | Aerospace — MIL-I-23053 (multiple classes) | 10/42 | 3/42 | SUPPORTED |
| IND-2.2 | Aerospace — **AMS-3632C / AMS-3653B** | 2/42 — `AMS 3653B` on `IP17TW-IP18SW-IP19LW`, `AMS-3632C` on `IP55FL` | 1/42 — `AMS 3653B` only | **half SUPPORTED**: `AMS-3653B` is in a datasheet; **`AMS-3632C` is in none** → CLAIM-3 |
| IND-2.3 | Aerospace — M23053/8 QPL Available | 1/42 (`IP35KY`) | 1/42 | SUPPORTED, single-product |
| IND-3.1 | Medical — USP Class VI | 2/42 | 2/42 | SUPPORTED, and the catalog has exactly one Medical-Grade part type |
| IND-3.2 | Medical — ISO 10993-5 | 1/42 (`IP53MP`) | 1/42 | SUPPORTED, single-product |
| IND-3.3 | Medical — FDA Title 21 CFR | 5/42 | 5/42 | SUPPORTED |
| IND-3.4 | Medical — **USFDA Compliant** | — | — | spelling already open as `audit9.md` A-9.P5a-8 (`USFDA` ×2 against `FDA` everywhere else) |
| IND-4.1 | Industrial — UL Recognized | 25/42 (UL overall) | 25/42 | SUPPORTED |
| IND-4.2 | Industrial — MIL-I-3190 | 1/42 | 1/42 | SUPPORTED, single-product |
| IND-4.3 | Industrial — ASTM D-372 | 1/42 | 1/42 | SUPPORTED, single-product |
| IND-4.4 | Industrial — NEMA VS-1 | 1/42 | 1/42 | SUPPORTED, single-product |
| IND-5.1 | Marine — UL & CUL Listed (Conduit system) | **`CUL` is in exactly 1 of 42 records** (`CC`, badge "UL & CUL Listed"). The other three conduit parts carry UL alone — `CC90`/`CCS` badge "UL Listed", `CT` "UL File No. E129972". | 1/42 | **SUPPORTED, single-product** on the CUL half |
| IND-5.2 | Marine — UV Rated Material | 11/42 | 8/42 | SUPPORTED |

Four of the seventeen rest on a **single** product each. That is not a defect —
an industry page listing what IPC stocks for that industry is allowed to name a
mark one product carries — but it is worth Rick knowing, because an aerospace
buyer reading "MIL-I-23053 (multiple classes)" beside "M23053/8 QPL Available"
will read the second as broad as the first, and it is one SKU.

### 2.7 FAQ — 19 answers

All 19 appear on the live site (FAQ-19 differs only in punctuation). Every SKU
named in an FAQ answer exists in the catalog — 14 of 14 checked. The numeric and
attestation content of the answers reduces to rows already above: FAQ-3 is the
RoHS claim (CLAIM-1), FAQ-8 the ≤1-week lead time, FAQ-9 the $50 minimum, FAQ-10
the 25M+ feet and the shipping window, FAQ-13 JIT, FAQ-14 PPAP/IMDS, FAQ-11/12
the phone and fax. FAQ-17 ("certificates of conformance available on request")
is a capability claim with no repo evidence either way.
→ **INHERITED-UNSOURCED**, no new finding except **FAQ-3**, which is the most
unqualified form of the RoHS claim on the site: *"Yes — our entire product line
is RoHS compliant."*

### 2.8 The HTML shell — `index.html`

| ID | Claim | Verdict |
|---|---|---|
| META-description, META-og:description, META-og:title | "$50 minimum order. Ships same day. ISO 9001 registered." / "Spec-grade stocking distributor since 1974. … 25M+ feet in stock." | every clause is a row above; `&amp;` is the only difference from the live site's text |
| — | **the static JSON-LD block is gone from this repo's `index.html`** and is rendered from `site-info` at runtime instead (`App.jsx:7305`) | **an improvement, recorded so nobody "restores" it**: the live predecessor's shell carries a second, hand-typed copy of the company facts, which is how two sources of truth start. A-8.9 already governs its `foundingDate` format. |

### 2.9 Which of these can Rick change himself once the site is live?

Asked because it decides what is a decision and what is a deploy. **Almost all of
it.** Every row in §2.1–§2.7 is admin-editable, with no rebuild and no FTP:

| Claim group | Stored in | Admin screen |
|---|---|---|
| STAT-1..4 — the stats strip, incl. "42 Products Stocked" | `content.json stats[]` | Page Content → **Trust Bar Stats** |
| HERO-1..4 | `heroProofPoints[]` | Page Content → **Homepage — Hero Proof Points** |
| TRUST-1..10, incl. "Made in USA Since 1974", "Full RoHS Compliant Product Line" | `heroTrust[]` | Page Content → **Homepage — Hero Trust Ticker** |
| CERT-1..6 — the six certification chips, incl. "ISO 9001:2008" | `certs[]` | Page Content → **About — Certifications & Standards** |
| IND-1.1..5.2 — the 17 industry certification chips | `industryDetail[].certs` | Page Content → **Industries Page — Detail Sections** |
| FAQ-1..19 | `faq[]` | Page Content → **FAQ / Resources** |
| MILE-1..6, SVC-1..6 (incl. every `leadTime`), features, markets | `content.json` | Page Content |
| hero badge/headline/subhead, every page banner, the privacy **effective date**, the contact-form copy and the **auto-reply promise** | `content.json copy.*` | Page Content → the fixed-copy groups |
| per-page SEO title and meta description | `seo[]` | Page Content → **Search Engine Text (SEO)** |
| CO-1..4, ABOUT-1..4 — founded year, phone, fax, email, address, hours, "25 million", "$50", `certifications.iso`, the four About paragraphs | `site-info.json` | **Business Details** |
| product badges, spec summary, operating temp, description, approvals, datasheet button label | `products-all.json` | **Products → Edit** |
| the photograph and the datasheet **file** | `uploads/images/`, `pdfs/` | Products → Upload photo / Upload PDF |

**Four things Rick cannot change**, all of which need `npm run build` and an FTP
upload:

1. **`index.html`'s `description`, `og:title`, `og:description` and `og:image`.**
   `PageMeta` rewrites `description`, `og:title` and `og:description` at runtime
   from the admin-editable `seo[]` — so Google, which renders JavaScript, reads
   Rick's version. **LinkedIn, Slack, Teams and Facebook do not execute
   JavaScript when they unfurl a link** (`index.html`'s own comment at :20 says
   so), and they read the static shell. That shell is the one claim surface on
   the site the owner cannot correct.
2. **`src/App.jsx`'s hardcoded defaults.** They only surface where a data key is
   missing or blank, which is what invariants 3 and 4 govern — but when they do
   surface, they are unreachable from the admin.
3. **`public/contact.php`'s fallback strings** — used only when the matching
   `copy` key is empty. The auto-reply promise itself *is* editable
   (`autoReplyRfqPromise`).
4. **The datasheet PDFs' contents.** Rick can replace a file; he cannot edit what
   it says. So every `n/42` count in this register moves only by re-issuing a
   datasheet — which is the supply-chain half of CLAIM-1, not an admin task.

Two operational notes that belong with this, both already invariants: every save
is backed up first (`backup_before_write()`), and Page Content carries a
`max_input_vars` truncation guard (invariant 6) because the form is large enough
to be truncated silently by PHP.

And the one that makes all of the above matter: **after the first deploy,
`data/` is never uploaded again.** Everything in the table above becomes Rick's
live state, and an FTP overwrite of `data/products-all.json` would destroy it
with no backup. That is `CLAUDE.md` § *Trees that ship to the server* and
`GO-LIVE.md` branch A.

---

## 3. What is owed

Three items. Everything else in the register is either already open elsewhere
(A-8.5, A-9.P4-2, A-9.P5a-*) or is a business fact only IPC can source.

### CLAIM-1 — High — the whole-line RoHS attestation is carried by 2 of 42 datasheets

**Published in eight places**, all inherited from the live site:

| Where | Text |
|---|---|
| `content.json:606` | "Full RoHS Compliant Product Line" (trust strip) |
| `content.json:499` | "Full RoHS Compliant" / *Entire product line* (certification chip) |
| `content.json:386` | "Yes — our entire product line is RoHS compliant." (FAQ) |
| `content.json:6` | "All RoHS compliant." (features) |
| `content.json:376` | "All products are RoHS compliant." (FAQ-1) |
| `content.json:733` | "UL, CSA, MIL-SPEC, and RoHS compliant product line" (hero subhead) |
| `site-info.json:54` | "…and RoHS-**certified** materials" (About) |
| `content.json:124` | "RoHS" (Automotive certification list) |

**Measured:** `RoHS` appears in **2 of 42 datasheets** (`IP29CG`, `IP53MP`) and
in **2 of 42 catalog records** — the same two. `REACH`: 0 of 42.

**Why it is not simply "false".** RoHS is a self-declared conformity, not a
third-party certification, and a distributor can hold one blanket declaration
covering everything it sells without any individual datasheet mentioning it. The
finding is that **the site asserts it for the whole line eight times and the only
documents the site itself publishes back it twice** — so if a customer's
compliance team asks, the answer has to come from a file nobody here has seen.

**Severity High**, on the same footing as A-9.P4-2: a claim the business may well
be able to stand behind, published as though it is already substantiated, in the
category a buyer's quality department checks.

**decision-needed:** what substantiates "Full RoHS Compliant Product Line" ·
**recommended:** ask Rick for the blanket RoHS declaration or the supplier
declarations behind it, and leave the copy exactly as it is · **why:** the claim
is IPC's, it is years old, and it is probably true — what it lacks is a document
anyone can produce on request · **trade-off:** if no declaration exists, the fix
is a supply-chain exercise and the honest interim is to qualify the wording to
the products that carry it, which weakens the page · **blocked:** Rick — a
conformity claim about his own line, which PLAN-11 §7.3 puts on the owner's
side.

**Correction to the first version of this recommendation.** It said to "store
the reference in `site-info.certifications.other` so the chip renders from a
sourced field". **`certifications.other` renders nowhere** — see CLAIM-4. Doing
that would file the document somewhere Rick can see and change nothing on the
page. Once the declaration exists, the place to put its reference **today**, with
no code change, is the certification chip's own sub-line (`content.json
certs[1].sub`, "Entire product line"), which Page Content edits.

### CLAIM-2 — Medium — POST-9.1, with a better fix than the one I recommended

**New facts.** "42 Products Stocked" is one of only **two** claims on the site
this project introduced, and it **replaced** an inherited one: the live
predecessor's stats strip reads `50+ / **25M+ Feet in Stock** / $50 / ≤1 Day
Shipment Available`. Somebody swapped a stocking figure for a catalog count.

**Correction to POST-9.1, which is mine.** It records "52 orderable part
numbers". Re-run of its own snippet gives **53**:

```
CC CC90 CCS CT IP10EX IP1274 IP12GA IP13SP IP15PV IP17TW IP18SW IP19LW IP25PU
IP29CG IP30HS IP30UV IP32IP IP33PO IP33TW IP34SR IP35KY IP36TH IP37SH IP38FE
IP39LH IP3L IP41NE IP42MW IP43VT IP44A2 IP45A3 IP46MD IP47HV IP48MH IP49VP
IP52EC IP53MP IP55FL IP56DR IP61ES IP62EF IP63ES IP64FS IP65VC IP66AC IP67SC
IP69HT IP71NS IP72PS IP73PP IP75AD VALUE-ADDED VT-1100
```

42 records = 34 single + 8 combined covering 21 part numbers, less `IP12GA` and
`IP1274` which are counted both ways → **53**. Every number POST-9.1's "Owed"
section offers should be read as 53, not 52.

**Superseding POST-9.1's recommendation.** It recommended *52, relabelled "Part
Numbers Stocked", derived*. Better, and cheaper: **relabel the slot to what the
number actually is — "42 — Datasheets Published", sub "One for every catalog
page" — and derive both from the catalog.** It is exactly true (42/42 records
carry a `pdfUrl`, measured), it needs no business input at all, and it stops the
strip making an inventory claim the catalog cannot support. **Honest downside:**
"Datasheets Published" is a weaker selling point than "Products Stocked", and it
is the slot a visitor's eye lands on second. If Rick wants an inventory number
there, the other honest option is to put back what the old site had — "25M+ Feet
in Stock" — which costs nothing to substantiate because the page already claims
it twice, at the price of saying it a third time.

### CLAIM-3 — Low — half of "AMS-3632C / AMS-3653B" is in no datasheet

`content.json:158`, the Aerospace & Defense certification list.

| Mark | Catalog | Datasheets |
|---|---|---|
| `AMS 3653B` | `IP17TW-IP18SW-IP19LW` | `IP17TW-IP18SW-IP19LW.pdf` ✓ |
| **`AMS-3632C`** | `IP55FL` | **none** |

AMS generally is in 6 of 42 datasheets, so the marks IPC stocks to are real;
`AMS-3632C` is the one revision nothing published backs. (Note the two are
written differently — spaced and hyphenated — which is A-9.P5a-8's spelling
item over the same two strings.) Ordered **after** A-9.P4-3, which decides how
marks are named: the wording may change anyway and a fix done first would be
redone.

---

### CLAIM-4 — Low — `certifications.other` is editable in the admin and rendered nowhere

`admin/settings.php` exposes it as **Business Details → `cert_other`**, so Rick
can type a list of certifications into it, save, and see the save succeed.
`site.certifications` is read in exactly **one** place in `App.jsx` — line 3699,
`` `${site.certifications.iso} Registered` `` in the About quality row — and
`.other` is read in **none**. The six certification chips a visitor actually
reads are typed into `content.json certs[]`.

A-9.P4-2 records that mechanism as the reason an unsourced chip can sit beside a
sourced one. This is the other half of it, and it is separately checkable: a
field the admin offers, that accepts input, that has no effect. Rick has no way
to discover that except by filling it in and looking.

**Two honest fixes, and the cheap one is not the obvious one.** Rendering
`.other` as extra chips is a code change and a design question (where do they
go, what do they look like beside the six typed ones). Removing the field from
Business Details is a five-line change that ends the trap. **Recommended:
render it** — the field is the right idea and it is the thing CLAIM-1 and
A-8.5 both want to exist — but not before those two are settled, because what
they settle is what would go in it.

---

## 4. Self-corrections

1. **POST-9.1's "52 orderable part numbers" is 53.** Mine, logged 2026-09-15,
   corrected the same day. §CLAIM-2 carries the list.
2. **POST-9.1's recommendation is superseded** by CLAIM-2's, on evidence
   POST-9.1 did not have: that the stat is one of two introduced claims and that
   it displaced an inherited one.
3. **The first cut of `claims-extract.js` could not see the claim this pass
   exists for.** `stats[1]` is `{"42", "Products Stocked", "Datasheet published
   for every one"}` — leaf-wise, `"42"` is too short to match and `"Products
   Stocked"` carries neither a digit nor a certification word. `claims-composite.js`
   exists because of that, and the comment at its head says so.
4. **The first cut's line numbers were wrong on short values** —
   `stats[1].value` came out as line 0 and `industryDetail[0].certs[2]` as line
   6, because a 2-to-4-character value collides with every other occurrence in
   the file. Replaced with a forward-only cursor that advances on every leaf.
5. **An earlier token-matching pass reported "UL 224 VW-1" as 42/42**, because
   an unbounded `UL` matches inside *Liquid*, *Modulus* and *Insulating*. The
   counts in §2.6 are word-bounded, and the rows whose only token is a common
   word are marked [NOT-MEASURED] rather than counted.
6. **CLAIM-1's first recommendation pointed at a dead field.** It said to store
   the RoHS declaration's reference in `site-info.certifications.other` "so the
   chip renders from a sourced field". `.other` is read nowhere in `App.jsx` —
   that is now CLAIM-4. The recommendation was written from the field's name
   and the fact that the admin exposes it, without checking that anything
   consumes it.
7. **The first draft of §2.6 said "UL & CUL Listed" was carried by all four
   conduit accessories.** Measured: `CUL` is in **one** record (`CC`). `CC90`
   and `CCS` badge "UL Listed"; `CT` carries a UL file number and no CUL. And
   it said AMS-3632C **and** AMS-3653B were in no datasheet; `AMS 3653B` is in
   one. Both rows were written from a family-level count before the specific
   tokens were checked — the same shortcut this register exists to catch.

---

## 5. Limits

- **[NOT-MEASURED]** — whether IPC holds a RoHS declaration, an ISO 9001
  certificate and its revision, 25 million feet of stock, a $50 minimum, a
  same-day shipping record, a one-week fabrication lead time, PPAP/IMDS
  capability, JIT programs, or C-of-C availability. None of these lives in a
  repository. Every one is marked INHERITED-UNSOURCED above, and the register's
  value is that the list is now finite and named.
- **A datasheet's silence is not a denial.** Every `n/42` above is *support*,
  never *refutation*.
- **The extractor cannot read text stored as an image.** It recovered text from
  42 of 42 files, so nothing here is an absence that might be the tool's fault —
  but a mark printed only inside a scanned logo would still be invisible to it.
- **The provenance corpus is one snapshot** of one predecessor build
  (2026-09-04). A claim absent from it was not necessarily absent from every
  earlier version of IPC's site.
