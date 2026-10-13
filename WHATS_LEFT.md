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
- New entries go **here**, in the sections below. Record a decision as a dated
  bullet. When an item closes, move it to "Done since 2026-10-07" with its PR.

---

## Open — waits on Rick (content and facts, all editable in the dashboard)

Each of these is a fact only IPC can confirm. The site renders whatever is
in the box, and nothing here is a code change. History: §2r, §1ao and §1aq.

| Item | Where Rick edits it | What to check |
|---|---|---|
| ISO 9001 revision year | Business Details → Certifications → ISO | Use the year printed on the current certificate. Leaving the box blank removes the claim from the footer, the About fact box and the homepage band **only** (the decided §1aq scope, as Business Details says). Every other wording that says ISO 9001 — Page Content (Products & Services Cards, Company Timeline, Team & Capabilities, Certifications & Standards, Hero Proof Points, Hero Trust Ticker, SEO rows), the About story, and the VALUE-ADDED product (Products → Edit) — stays until edited; Business Details lists the Page Content and About ones after a save, not the product. `node _harness/isoclaims.js` counts the claims (it names places only for a withdrawn revision). |
| "RoHS compliant — entire line" (CLAIM-1) | Page Content → About — Certifications & Standards (2nd row), Homepage — Hero Trust Ticker, FAQ / Resources (the RoHS question), Products & Services Cards; Business Details → About Page (4th paragraph) | Is it true for every SKU? (Not in Company Claims, which holds other claims.) |
| "42 Products Stocked" (CLAIM-2) | Page Content → Trust Bar Stats (2nd stat) | Should it follow the catalog count, or be a fixed claim? The recommendation on record is "42 — Datasheets Published" (GO-LIVE §A) |
| AMS claims (CLAIM-3) | Page Content → Homepage — Hero Trust Ticker, About — Certifications & Standards, Industries Grid, Industries Page — Detail Sections, FAQ / Resources; Business Details → About Page | Which AMS specs IPC actually holds |
| FAQ #15, "Where can I download product data sheets?" (A-9.P5a-2) | Page Content → FAQ | Two errors in one answer: it says to click the "Data Sheet" button, which reads **"Datasheet"** (A10-043); and it promises a catalog PDF "on the Products page header and in the site footer" — there is no Products-page-header link at all, and the footer link appears only once a catalog PDF is set (Catalog & Brochure PDFs). The sentence has to change either way (GO-LIVE §A) |
| Certification marks, then spellings (A-9.P4-3, then A-9.P5a-5) | Products → Edit (nearly all: e.g. `U/L` ×65 in the catalog); Page Content for one `USFDA` | First settle A-9.P4-3: the catalog cites categories no body issues (`U/L Approved`, `UL Approved`, `CSA Approved`, `FDA Approved`, `GFR 21`). Then spell UL, CSA, MIL-SPEC, AMS, RoHS as on the certificates — in that order, or the spelling pass is done twice (GO-LIVE §A) |
| Two badge pairs (A-9.P5a-8 remainder) | Products → Edit | `Low Temperature Flexibility` vs `Low-Temperature Flexibility`, `125°C Rated` vs `Rated 125°C` — one product each, no majority; pick one (GO-LIVE §A) |
| Five products without a photograph (A-9.P4-8) | Products → Edit → Photo | `IP12GA-IP1274`, `IP13SP`, `IP25PU`, `IP30UV`, `IP47HV` show the branded "image coming soon" panel. Photograph them, or confirm the panel is what they should show |
| Commercial promises (claims register: inherited, unsourced) | Business Details (Minimum Order, Feet In Stock) / Page Content | 25M+ feet in stock, $50 minimum, same- or next-business-day shipping, custom work in a week or less, JIT programs, PPAP and IMDS packages, certificates of conformance — came from IPC's old site and nothing in this repo backs them. Still true? |
| Privacy policy effective date | Page Content → Privacy | The date the policy takes effect |
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
| `admin/`, `data/`, `pdfs/`, `uploads/` writable by PHP | README "Permissions". The dashboard shows a banner when they are not. |

## Open — ready to run

| Item | Note |
|---|---|
| AUDIT-12, the full-project audit | [`plans/PLAN-12-full-project-audit.md`](plans/PLAN-12-full-project-audit.md). For a new session using the Workflow tool; the kickoff prompt is its §14. Read-only: it reports and fixes nothing. Its findings will land in a new section here. |

## Open — deferred by decision (not to be built without a new decision)

| Item | Decision | Held by |
|---|---|---|
| Page-header sub-lines on the gradient (18) and the spec-table sub-header (1) | Keagan 2026-10-05: keep the header as it is for now. No text colour reaches AA on the `#119EC8` end. The proposal on file is to darken that end to `#0e80a2` and make the sub-lines full ink (§1as). A before/after was rendered for the decision but never committed, so no image is on file (2026-10-13; this said "the image is in §1as"). The nearest regenerable picture is `node _harness/mockup-brandtext.js`'s `eyebrow-D-darker-gradient.png` (needs :8123), which darkens to `#0b4c66`, not to the proposed `#0e80a2`. | `plan5c-eyebrow` ratchet 18; `plan8-contrast` `EXEMPT_BRAND_SURFACE = 1` |
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
- 121 sweep suites, tracked in `_harness/sweep-list.txt` since 2026-10-07.
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
| 2026-10-07 | WHATS_LEFT reduced to what is open, with the history moved verbatim to `audit-runs/WHATS_LEFT-history.md`. The docs truth pass after #75–#77. `_harness/sweep-list.txt` tracked (121 suites). PLAN-12 written, with its four tested instruments. | this branch (`claude/zen-gates-p801fz`) |
