# PLAN-13 — Admin dashboard: navigation, layout and readability

**Status:** proposed, not started. Written 2026-10-31 on `claude/site-data-path`.
**Binding:** [GUARDRAILS.md](GUARDRAILS.md). Nothing here relaxes it.
**Audience of the change:** Rick (GUARDRAILS §0) — non-technical, around 60,
uses the dashboard on a desktop and sometimes a phone. Every trade-off below is
settled in his favour: bigger, plainer, fewer places to look.

---

## 1. How this was measured

Every authenticated admin page (15) was opened on the local mirror
(`:8123`, `sync.sh`, the repo's current admin code — newer than the live one,
which has no homepage-layout picker) at **1440×900** and **390×844 (touch)**.
For each page: a top, a scrolled and a full-page screenshot, plus computed
metrics (page height, font sizes and families, text colours, labels, sticky
elements, save-button position, headings). Script:
`_harness/out/admin-ui-audit.js` (gitignored scratch); output in
`_harness/out/admin-ui/` (`metrics.json` + 90 PNGs).

| Page | Height 1440 | Height 390 | Fields | Text <12px | Font sizes | Save button |
|---|---|---|---|---|---|---|
| Page Content | **49,820 px** | **60,452 px** | 491 | 984 | 6 | sticky bar ✓ |
| Help | 34,488 | 77,831 | — | 155 | **15** (26 colours) | — |
| Audit Log | 22,458 | 33,714 | 2 | 1,006 | 5 | — |
| Inquiries | 5,499 | 9,566 | — | 547 | 8 | — |
| Products | 4,462 | 5,807 | 1 | 96 | 5 | — (253 buttons) |
| Business Details | 4,198 | 6,419 | 37 | 98 | 7 | **bottom only, y=4,127** |
| Edit Product | 3,882 | 6,604 | 114 | 124 | 8 | **bottom only, y=3,813** |
| Site Images & Logo | 3,920 | 5,114 | 16 | 20 | 5 | per card |
| Add Product | 2,127 | 3,400 | 25 | 26 | 7 | bottom only |
| Backups | 1,989 | 3,390 | — | 1 | 4 | per row |

The top bar is `position: static` on **14 of 15 pages**. Only Help has it sticky
(`help.php`'s own `header { position: sticky }` — the one property kept when the
six per-page header copies were deleted; `admin/config.php` above
`admin_head()`). That is the whole answer to "why isn't the navbar sticky": it
never was, except on Help.

---

## 2. Findings

### A. Navigation and orientation

| # | Finding | Evidence |
|---|---|---|
| A1 | The nav scrolls away on every page but Help. On Page Content that is 55 screens with no way back to the menu except scrolling up. | `metrics.json` `headerPosition: static`; `d-content-scrolled.png` |
| A2 | Eleven flat, equal-weight links: daily work (Products, Page Content, Inquiries) sits beside rarely used ones (Password, Audit Log) and an action (“+ Add Product”). No grouping. | `admin/nav.php:77-96` |
| A3 | **Site Images & Logo** and **Catalog & Brochure PDFs** have no menu entry; they are reachable only through links inside other pages. | `admin/nav.php` |
| A4 | The menu changes per page: Edit Product injects “Upload PDF” in front of the standard links (`$navExtra`). | `d-edit-top.png` |
| A5 | The current-page marker is a 2px `#005da3` underline on `#0d2d52` — **2.0:1**, under the 3:1 non-text minimum. Easy to lose. | `nav.php:53` |
| A6 | On a phone the menu is three wrapped rows (~150 px) of 13px links before any content, and still scrolls away. | `m-index-top.png` |
| A7 | The logo subtitle says “Product Manager”; the dashboard also runs the website text, leads and backups. | `nav.php:72` |
| A8 | Sub-pages (Edit, Upload PDF/Photo, Delete) have no breadcrumb; the way back is a lone “← Back” or the browser. | `d-edit-top.png` |
| A9 | There is no overview: signing in lands on the Products table. New leads, server problems, products missing a photo, and when the site was last changed are spread over four pages. | `index.php` |

### B. Page Content (the worst page)

| # | Finding | Evidence |
|---|---|---|
| B1 | 33 sections, 491 fields, 49,820 px, and **no section index, no search, no collapse**. Finding the FAQ means scrolling ~40 screens. | `metrics.json` |
| B2 | Sections follow the data file, not the website. All single-text groups render first, then all repeating lists (`content.php:1417-1490`), so one public page is scattered: Homepage hero is section 3 but its Proof Points and Trust Ticker are 27–28; About is 9, 21, 23 and 24; the three menus are 14, 25 and 26; Contact is 12, 16 and 31. | heading list in `metrics.json` |
| B3 | Every label is 11px grey UPPERCASE and carries its rule inside it — “ABOUT PAGE FACTS — STRUCTURE; ALSO THE HOMEPAGE BAND'S "PRIVATELY HELD, INDEPENDENT" (EMPTY REMOVES BOTH)”. 491 of 491 labels are uppercase. | `m-content-scrolled.png` |
| B4 | Section titles (12px uppercase blue) and field labels (11px uppercase grey) are almost the same style, so there is no visible hierarchy. | `d-content-scrolled.png` |
| B5 | Short one-line values (badge, headline lines) use full-width 1,180px inputs. | `d-content-scrolled.png` |
| B6 | The sticky save bar is good; it does not say whether anything has changed or where. | `.save-bar`, `content.php:1353` |

### C. Type and visual system

| # | Finding | Evidence |
|---|---|---|
| C1 | Body copy, labels, hints, table cells and badges are 10–13px. Text under 12px: 984 elements on Page Content, 1,006 on Audit Log, 547 on Inquiries. Too small for the owner this is built for. | `metrics.json` `under12px` |
| C2 | UPPERCASE micro-text everywhere — card titles, labels, table heads, stat captions, status badges — so everything competes at one weight. | screenshots |
| C3 | No type scale and no colour tokens: Help uses 15 font sizes and 26 text colours; colours are hard-coded hex in every page's `<style>`. | `metrics.json`; `admin_head()` |
| C4 | Heavy inline styles (Edit 57 elements, Products 50, Audit Log one per row) make a consistent restyle impossible from one place. | `inlineStyleEls` |
| C5 | Three monospace stacks (`'Courier New'`, `monospace`, `ui-monospace`). | `fontFamilies` |

### D. Long forms (Business Details, Add, Edit)

| # | Finding | Evidence |
|---|---|---|
| D1 | Save is only at the very bottom — 4,127 px down on Business Details, 3,813 px on Edit — while Page Content has a sticky save bar. Inconsistent, and the owner has to scroll to find it. | `saveButtons` |
| D2 | No section index on Business Details (8 sections) or Edit (7). | `headingList` |
| D3 | About-page text is split: paragraphs in Business Details, banner/timeline/team/certifications in Page Content. The homepage-layout picker sits inside “Branding & theme” under a 90-word paragraph. | `d-settings-top.png` |
| D4 | A product's PDF and photo are edited on separate pages reached from row buttons, and the Edit page tells you “the PDF file itself is uploaded on the Upload PDF page”. | `m-edit-scrolled.png` |

### E. Products list

| # | Finding | Evidence |
|---|---|---|
| E1 | Five equal buttons per row (Edit, Manage PDF, Photo, View, Delete) — 210 for 42 products. Delete sits beside View with the same size. | `d-index-top.png` |
| E2 | **On a phone every action button is off-screen to the right** inside the table, with no cue that it scrolls. Only SKU and name show. | `m-index-scrolled.png` |
| E3 | No photo column: the stat cards count missing PDFs, but the five products without a photo (IP12GA-IP1274, IP13SP, IP25PU, IP30UV, IP47HV) are invisible here. | `index.php` |
| E4 | 15 separate tables, one per category, each with its own dark header; no sort, no category jump; long temperature ratings make rows 100px tall. | `d-index-top.png` |

### F. Lists and logs

| # | Finding | Evidence |
|---|---|---|
| F1 | Inquiries: every lead as a flat card, no search, no filter (quote/message, failed email, date), no paging. The status chip says “SENT TO MAIL SERVER” in 10px caps. | `d-inquiries-top.png` |
| F2 | Audit Log: 500 rows on one page; the filter needs a separate **Filter** button press; no day grouping. | `d-audit-log-top.png` |
| F3 | Backups: a column of identical “Restore This Version” buttons with only a timestamp — nothing says what changed in each version, although the audit log knows. | `backups.php` |

### G. What already works — keep it

- Help's sticky header, left table of contents and back-to-top button: the
  pattern the rest of the dashboard should follow.
- Live previews on Business Details, Add and Edit.
- Page Content's sticky save bar, unsaved-changes guard (`unsaved.js`), the
  “Show me on the site ↗” links, and the “Not shown by your current homepage
  layout” notes.
- Plain-language error and warning boxes.

---

## 3. Target design

1. **App shell (every signed-in page) — a sticky top bar** (owner decision
   2026-10-31; a sidebar was the alternative).
   - The bar stays at the top while the page scrolls, on all 15 pages, and stays
     one compact row (about 56px) on desktop so it costs little screen height.
   - Six entries instead of eleven, grouped by job; the grouped ones open a
     drop-down:
     - **Products ▾** — All products · Add product
     - **Website ▾** — Business details · Page content · Site images & logo · Catalog & brochure PDFs
     - **Inquiries** (direct link, with the new-lead badge)
     - **Backups & history ▾** — Backups · Activity log
     - **Help**
     - **Account ▾** (right-hand side) — Password · View site ↗ · Sign out
   - Drop-downs are `<details>`/`<summary>`, so they open by click, tap or
     keyboard and still work with JavaScript off; a small script only closes an
     open one on Escape or an outside click.
   - The entry holding the current page is marked with a filled pill, not a
     thin underline (≥3:1), and the current item inside its drop-down is bold.
   - Phone (<768px): the bar shows the logo, the Inquiries badge and a
     **Menu** button; Menu opens the same groups as a full-width panel under
     the bar, every link at least 44px tall.
   - Long forms' own sticky elements (save bar, section index, live preview)
     sit below the bar, not under it: one shared `--admin-bar-h` token sets
     their `top`.
2. **Design tokens in `admin_head()`.** CSS custom properties for colour, a
   type scale (13 / 15 / 17 / 20 / 26), spacing and radius.
   - Body 15px.
   - Labels 14px semibold sentence case.
   - Hints 13px.
   - Section titles 18px.
   - One monospace stack.
3. **One page-header pattern.** Breadcrumb on sub-pages, then title, then a
   one-line description, with the primary action on the right.
4. **One long-form pattern** (Page Content, Business Details, Add, Edit):
   - a sticky section index beside the form (Help's TOC, reused);
   - collapsible sections;
   - a sticky save bar that says “Unsaved changes in: FAQ, Contact page”.
5. **Page Content regrouped by public page**, in site order:
   1. Homepage
   2. Product families
   3. Services
   4. Industries
   5. About
   6. Datasheets
   7. FAQ
   8. Contact
   9. Privacy
   10. Menus & footer
   11. Search engines
   12. Site-wide claims & images

   A filter box finds a field by its words. Labels drop the caps, and the rule
   (“Empty removes it”) moves into the hint line. **Still one form**: only the
   order and the folding change, so the save, the `orig_sig` concurrency check
   and the `form_complete` guard (invariant 6) behave exactly as now.
6. **Products.**
   - One row per product: thumbnail, SKU, name, temperature, PDF ✓ and photo ✓
     chips.
   - Actions: **Edit** plus a “More” menu (Manage PDF, Photo, View on site,
     Delete), with Delete set apart in red.
   - Category filter chips.
   - On a phone, rows become cards with the actions visible.
   - A “Missing photo” stat card.
7. **Inquiries and Activity log.**
   - Search and filters (type, email status, date).
   - 25 per page.
   - New leads highlighted.
   - Filters apply as you type, with no Filter button.
   - Rows grouped by day.
8. **Backups.** Each version shows the audit-log line(s) that produced it
   (“Business details updated”, “IP33PO edited”).
9. *(Optional)* **Overview page** as the landing screen:
   - new inquiries;
   - server problems;
   - products missing a photo or PDF;
   - the last 5 changes;
   - shortcuts.

---

## 4. Build phases

Each phase is its own branch and PR (GUARDRAILS §1). Each one starts by writing
the check that fails, then fixes, then runs the admin suites listed in §5.

| Phase | Scope | Done when |
|---|---|---|
| **0. Baseline + guard suite** | Run the admin suites (§5) and record pass counts. Add `_harness/admin-ux.js`, failing first: the nav is reachable after scrolling on every page; no text under 12px; current-page marker ≥3:1; save control visible without scrolling on every long form; at 390, every product action visible without horizontal scroll. | Suite exists and fails on today's code for the reasons in §2. |
| **1. Tokens + type** | `admin_head()` gains tokens and the type scale. Each page's `<style>` is reconciled to use them; inline styles that set type or colour move into classes. No layout change. | `admin-ux` “<12px” check passes; `adminwidth.js` green (invariant 15 order kept). |
| **2. App shell** | `nav.php` becomes the sticky top bar with the six grouped entries and `<details>` drop-downs (§3.1), plus the phone Menu panel. Site Images and Catalog PDFs join the Website menu; `$navExtra` goes (its link moves into the Edit page's header); breadcrumb partial; Help's own sticky rule folds into the shared one; Help's TOC and the live previews take `top: var(--admin-bar-h)`. | Nav reachable after scroll on all 15 pages at 1440 and 390; drop-downs open by keyboard and with JS off; bar one row at 1024 and wider; 44px menu links on phones (24px minimum, A12-L7-01-W5-4). |
| **3. Long-form pattern** | Shared sticky save bar + section index + collapse, applied to Business Details, Add and Edit (Page Content already has the bar). `unsaved.js` drives the “Unsaved changes in…” text. | Save visible at every scroll position; `plan2-*` green, and the unsaved-changes guard suites (`audit5-medium`, `lowsD-admin`, `sec3-sessionexpiry`) green. |
| **4. Page Content regroup** | Render order driven by a page map instead of “copy groups then lists”; filter box; label/hint split; section index. Field names unchanged. | `invariants.js` INV6, `plan2-formlast`, `plan2-trunc` (against `:8124`/`:8125`) green; a save round-trips byte-identical `content.json`. |
| **5. Products list** | Row redesign, “More” menu, photo chip + stat, category chips, phone cards. | 0 horizontal-scroll actions at 390; delete still goes through `delete.php` confirm. |
| **6. Inquiries / Activity log / Backups** | Search, filters, paging, day grouping, backup “what changed” line. | Filters work with JS off (server-side query string) and on. |
| **7. Phone + accessibility pass** | Whole admin at 390 and 768, keyboard focus order, focus rings, contrast. | `admin-ux` fully green; full admin suite list green. |
| **8. Overview page** *(optional)* | New `home.php` landing page; Products stays one click away. | Decided by the owner before starting. |

---

### Phase 0 — done 2026-10-31 (branch `claude/admin-ux`)

**Guard suite:** `_harness/admin-ux.js`, **5/83**, every red for a reason in §2:

| Check | Result | Notes |
|---|---|---|
| U1 bar on screen after scrolling | 2/21 | Only Help passes (its own sticky rule). |
| U2 no text under 12px | 0/15 | Page Content 492 elements; Audit Log 1,006; every page has the 10px “Product Manager”. |
| U3 current entry marked at ≥3:1 | 0/15 | Underline 2.04:1 on 9 pages; 6 pages mark nothing. |
| U4 save button always on screen | 2/8 | Page Content passes. Business Details, Add and Edit show it only at the bottom; on a phone Edit never shows it. |
| U5 phone Edit controls on screen | 1/6 | The one pass is the “found five controls” row. All five sit at x=670–715 of a 390px screen. |
| U6 Site Images and Catalog PDFs in the menu | 0/15 | |
| U7 at most six top-level entries | 0/1 | 11 entries. |
| U8 phone bar at most 80px | 0/1 | 148px. |

The five greens show the checks can pass.

**Baseline of the existing admin suites (same code as today):**
- **Earlier sweep:** taken from `_harness/out/sweep-site-data.log`, run earlier the
  same day. `git diff 818b775..HEAD -- src public admin _harness/*.js` is empty,
  so the code is identical.
  - Covered 54 of the 62 suites that reference `/admin/`, plus `invariants`.
  - **Green (30):** `adminwidth` 66/66, `invariants` 19/19, `plan2-formlast` 8/8,
    `plan2-trunc` 14/14, `homelayout` 121/121, `homelayouts` 115/115,
    `plan10-adminnav` 27/27, `plan10-auditlog`, `plan10-help`, `plan10-helpwidth`,
    `plan2-contrast`, `plan2-delete`, `plan2-sku`, `plan4-admin`, `plan5-keys`,
    `plan5-social`, `plan5b-pwthrottle`, `plan6-families`, `plan7-approvals`,
    `plan9-firstsave`, `claims`, `contentlinks`, `copyroundtrip`, `nodupbackups`,
    `lowsA1-sec`, `lowsD-admin`, `sec3-sessionexpiry`, `sec5b-datalock`,
    `plan10-admincrawl`, and the formlast self-test.
  - **Red (25):** each also red on `main`, checked earlier the same day, for
    environment reasons: `/tmp` paths, no Apache, no SMTP sink, the `:8130` fleet
    and Windows `rm` locks. They are `audit5-blockers`, `audit5-high` 24/33,
    `audit5-medium`, `audit6`, `audit7-lead` 16/23, `audit9-fixes` 37/40,
    `contactflow` 65/87, `plan10-adminrows` 13/15, `plan3-autoreply`,
    `plan5-throttle`, `adminaudit11` 35/37, `marketingpdfs`, `lowsA2-admin`,
    `leadpath12` 18/34, `lowsE-apache`, `lowsF-docs`, `sec2-imagebomb`,
    `adm3-deleterestore`, `sec1-photoclobber`, `sec4-sessionforge`,
    `n2-damageddata`, `docmap` 14/28, `siteimages` 17/25, `isoedit` and
    `prerender-apache`. **These numbers are the floor.** A later phase may not
    lower any of them.
- **Run now:** the 8 admin suites that sweep did not include.
  - **Clean (5):** `adminhttp`, `audit10-p7reverify`, `audit10cd-admin`,
    `audit9-adminflows`, `probeink`.
  - **Need their own fixture sites and ports, per their headers (3):**
    `audit9-crawl` (`:8147`), `audit9-logic-admin` (`_harness/out/audit9/site-A`),
    `audit9-logic-contact`.
  - Log: `_harness/out/admin-ux-baseline-extra.log`.
- **Watch in Phase 2:** `plan10-adminnav` (27 checks on the header at 390,
  including `$navExtra`) and `plan10-adminrows` (Delete reachability) assert
  today's header and table directly, so Phases 2 and 5 must update them in the
  same PR.

## 5. Constraints and what must stay green

- **Invariant 6** — `form_complete` stays the last field of Page Content's form.
  Reordering fieldsets is safe because POST is name-keyed; adding a field after
  the sentinel is not.
- **Invariant 12** — `require_auth()` keeps rendering on POST.
- **Invariant 15** — `admin_head()` is echoed before each page's own `<style>`;
  the six narrow pages (Password, Delete, Upload PDF, Upload Image, Site Images,
  Catalog PDFs) keep their own width unless the owner decides otherwise (§6).
  `_harness/adminwidth.js` enforces it.
- CSRF on every POST, `h()` on every echo, no new dependencies, no CDN, plain
  CSS/JS, PHP 7.4 compatible.
- Test coupling to expect: 39 harness suites reference `content.php`, 29
  `settings.php`, 7 the nav markup. Keep existing ids, names, `data-section`
  and `legend.card-title` hooks; where a selector must change, update the
  suite in the same PR and say so.
- Admin suites to run at every phase (minimum): `adminwidth`, `invariants`,
  `plan2-formlast`, `plan2-trunc`, `homelayout`, `audit9-fixes`, and every
  suite whose name starts `plan5`, `plan7` or `admin`. Full list:
  `grep -l "admin/" _harness/*.js`.

---

## 6. Decisions needed before Phase 2

| # | Question | Recommendation |
|---|---|---|
| 1 | Left sidebar, or a sticky top bar with grouped drop-downs? | **Decided 2026-10-31 (owner): sticky top bar** with grouped drop-downs (§3.1). |
| 2 | Build the Overview landing page (Phase 8)? | Yes, after Phases 1–7. |
| 3 | Page Content: one page with an index (safe), or one page per public page (separate saves)? | **One page with an index.** Separate saves change the concurrency check and backups. |
| 4 | Let Site Images & Logo use the full width as a 2-column grid of photo cards? | Yes. That means removing it from `adminwidth.js`'s narrow list, a deliberate change to invariant 15's list. |
