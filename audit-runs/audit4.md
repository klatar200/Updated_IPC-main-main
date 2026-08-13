# Audit 4

Fourth audit → plan → execute cycle, on top of the merged PR #45.
Base: `812c45b` (main). Verified 2026-08-13.

**Coverage first.** Run 3's sweep found no missed files. Run 4 re-ran it and
found two, then went after the one class of thing Runs 1–3 had still never
executed: the five `_harness` assertion suites that no scorecard has ever
recorded a result for.

| Severity | Count |
|---|---|
| Blocker | 0 |
| High | 1 |
| Medium | 2 |
| Low | 2 |

---

## Coverage sweep

222 tracked files, minus screenshots, audit artifacts and `_harness/out/`.

**Files named in neither `project-map.md` nor `endpoint-checklist.md`: 2**

| File | Disposition |
|---|---|
| `Email to Rick - Admin Dashboard Handoff.md` | Read in full this run. Every factual claim checked against the shipped admin — nav labels, the landing page's `<h1>`, "every save keeps a backup", "restoring can itself be undone", "about a minute" — all hold. It deliberately does not contain the password, which is the correct handling. Added to the checklist as E110. **No finding.** |
| `uploads/images/.gitkeep` | Directory placeholder for a runtime upload folder. Added as E111. **No finding.** |

**Assertion suites never recorded as run: 5** — `plan10-adminrows`,
`plan10-header`, `plan10-helpwidth`, `plan10-repalette`, `plan10-rfqscroll`.
All five run this cycle. Four pass. One does not, and is D-02 below.

The other 60 never-named `_harness/*.js` files were classified mechanically:
they neither assert nor set a failing exit status. They are one-shot probes and
report generators from AUDIT-10 and the ink/colour work (`inkaudit`, `findwhite`,
`audit10-p*`, …). They are not acceptance criteria and are not treated as
coverage gaps. The classifier is recorded in `missed-coverage.md`.

---

## Issues

| ID | Title | Severity | Location | Can Claude fix alone? |
|---|---|---|---|---|
| D-01 | A-01's script-scheme guard covers only `social`; two more owner-editable URL fields reach `href` unfiltered | **High** | `src/App.jsx:12307`, `src/App.jsx:11731`; writers `admin/settings.php:114`, `admin/content.php:135` | Yes |
| D-02 | `plan10-repalette`'s `default` arm is permanently red — its baseline predates two merged releases | Medium | `_harness/plan10-repalette-baseline.json`, asserted at `_harness/plan10-repalette.js:505-528` | Yes |
| D-03 | `react-router-dom` carries three moderate advisories with no in-range patch | Medium | `package.json:11` | **No** |
| D-04 | `admin/add.php` reads a `photoUrl` POST field its own form never renders | Low | `admin/add.php:67` | Yes |
| D-05 | `admin/add.php` skips a heading level (h1 → h3) | Low | `admin/add.php` | Yes |

---

### D-01 — the A-01 fix stopped one field short of the class (High)

Run 1's A-01 had two halves: `settings.php` was made to save **every** key in
`$updated['social']` instead of a hand-written list of five, and `App.jsx` grew
`isSafeExternalUrl()` so a stored `javascript:` value could not become a live
`href`. The second half was applied to exactly one call site — `FooterSocial`.

Three other owner-editable strings are rendered straight into `href`. One is
already safe and two are not:

| Field | Written by | Rendered at | Validated? |
|---|---|---|---|
| `additionalPdfs[].url` | `admin/edit.php:73-94` | `App.jsx:8525`, `9603` | **Yes** — F6 requires `^(/\|https?://)\S+\.pdf$` and blocks the save |
| `catalogPdfUrl` | `admin/settings.php:114` (`sf()`, raw trim) | `App.jsx:12307`, the footer of **every page** | No |
| `services[].brochure.url` | `admin/content.php:135` (raw trim), 6 fields | `App.jsx:11731`, the Services cards | No |

**Measured, through the real admin forms, with a control.** Saving a
script-scheme value into `catalogPdfUrl` via Business Details produced, in the
footer of `/`:

```
catalogPdfUrl  -> LIVE SCRIPT-SCHEME HREF
brochure_url   -> LIVE SCRIPT-SCHEME HREF
social_facebook-> neutralised   (control: A-01 holds)
```

Neither form showed an error banner; both saved silently. The control is what
makes this a finding rather than a guess — the identical payload through the
field A-01 *did* cover is neutralised, so the difference is the missing guard
and nothing else.

Probe: `_harness/out/run4-urlsink.cjs`. It restores every value it changes and
runs against the mirror, which `sync.sh` rebuilds regardless.

**Severity.** High, not Blocker. Reaching it requires the admin session, so the
attacker is the owner or someone who already has his password — but it is the
exact hazard A-01 was raised for, it survives into `data/` where it is served to
every visitor, and the footer sink is on all ten public pages. It is also the
kind of thing that gets in by accident: a pasted URL with a stray prefix
produces a dead link with no error, which is how it would actually be noticed.

---

### D-02 — a stale baseline has made an arm permanently red (Medium)

`plan10-repalette` has three arms. `owner` and `vars` prove the palette
machinery works; `default` proves a repalette fix did not change how the shipped
site looks, by comparing every brand-painting element against
`plan10-repalette-baseline.json`.

That baseline is stamped `"captured": "2026-08-10"` and its own note says it was
taken *"before PLAN-10 phase C"*. PLAN-10 phase C merged. So did the UX audit
(PR #42, 17 fixes). The site legitimately changed underneath a file whose entire
purpose is to be unchanged.

Result today: **28/33**, five failures, all of them element-count mismatches:

| State | Baseline | Now |
|---|---|---|
| `home` | 155 | 150 |
| `products` | 86 | 89 |
| `products_IP38FE` | 74 | 77 |
| `home_megadropdown` | 168 | 163 |
| `home_mobile_drawer` | 158 | 153 |
| `dashboard`, `contact`, `industries` | — | byte-identical |

**Pre-existing.** Rebuilt with `src/App.jsx` restored to `3fa1c60` — the commit
before this audit branch — and re-ran: **28/33, the same five**. Nothing in
Runs 1–3 caused it.

**The delta is explainable, which is what makes a re-baseline honest.** Per-class
counts (`_harness/out/run4-repalette-delta.cjs`):

- The three `home` states share one delta exactly (`-1 svg` with its `-2 rect`
  / `-2 line` children, `-1` hover-tint div, `-1` `sm:opacity-0` div, `+1 A`,
  `+1` bold label) — one shared home component, changed once.
- `products` and the product detail page share the other (`+1` badge span,
  `+1` button/`div` control, `+1` bold span).
- Every gradient on every state is still byte-identical, and both live arms pass
  in full.

So the palette itself has not moved; the DOM around it has. The `default` arm is
a completed migration's guard that now fails on the migration having been
followed by ordinary work — and while it is red, a genuine repalette regression
in `dashboard`, `contact` or `industries` would land in a suite that is already
failing and be read as more of the same.

---

### D-03 — router advisories with no in-range fix (Medium, human decision)

`npm audit --omit=dev` reports three moderate advisories against the production
dependency `react-router-dom@6.30.3`:

- open redirect via backslash in `<Link>`/`useNavigate` (CVE-2025-68470 bypass)
- arbitrary constructor injection via `deserializeErrors()` in SSR hydration
- same-origin redirect with a `//` path reinterpreted as protocol-relative

The advisory range is `6.0.0 – 7.17.0`. There is no patched v6: the fix is
`>= 7.18`, a **major** upgrade of the routing library underneath a 12,800-line
single-file SPA whose routing is a hand-written shim over `useSearchParams` /
`useNavigate` / `useLocation`.

**Reachability, measured:**

- No SSR anywhere in the project, so `deserializeErrors()` is not reached at all.
- `navigate()` is called from exactly one place (`App.jsx:92`), with
  `pageToPath(pageVal)`, which returns `/` or `` `/${pageVal}` ``. A `pageVal`
  of `/evil.com` would produce `//evil.com` — the protocol-relative case. But
  every `setParams({ page: … })` call site in the file passes a **literal** page
  key; `grep` for a dynamic one returns only the two destructuring lines. No
  attacker-controlled string reaches `navigate()`.

So the advisories are real and currently unreachable. The choice — carry the
advisory or take a major router upgrade and re-verify the whole suite — is a
risk call the owner makes, not one to take unilaterally inside an audit whose
guardrail is the smallest correct fix. **Not fixed. Recorded.**

---

### D-04 — a dead read that reads like a feature (Low)

`admin/add.php:67` builds a new product with `'photoUrl' => post_str('photoUrl')`.
`add.php`'s form has no `photoUrl` control — comparing the two forms, `edit.php`
has `additionalPdfs`, `orig_sig`, `pdfLabel` and `photoUrl`; `add.php` has none
of them. So the expression is always `''`, which is what the skeleton at
`add.php:9` already sets.

No user-visible effect, and the workflow is not broken: photos are assigned
per-SKU on the Upload Image page (`admin/upload-image.php:11`), and every render
site guards an empty value (`App.jsx:7339`, `8620`, `9066`) by falling through to
the branded placeholder. The defect is that the line reads as though adding a
photo at creation time were supported.

---

### D-05 — heading level skipped (Low)

`admin/add.php` goes `h1` → `h3` with no `h2`. Found by a sweep of all 11 public
routes and 9 admin pages for duplicate `id`s, heading order, missing `alt`,
landmark counts and label association (`_harness/out/run4-a11y.cjs`).

That sweep is otherwise clean: **one** problem group across 20 pages. No
duplicate `id` anywhere, no `img` without `alt`, exactly one `main` and one
`footer` per public page, and no control without a label, `aria-label`,
`aria-labelledby` or `title` — including the 452-control `content.php` and the
34-heading `help.php`.

---

## Checked this run, no finding

Recorded so a later run does not re-derive them.

| Area | Result |
|---|---|
| Catalog data integrity | 42 products; no duplicate or empty SKU; all 42 `pdfUrl` resolve on disk; 42 PDFs on disk, none orphaned; 37 local image refs all resolve; no remote image refs beyond the five known `placehold.co` placeholders (A-17) |
| `sitemap.php` | 52 URLs = 10 routes + 42 products, no duplicates, well-formed XML, `application/xml` |
| Admin auth boundary | `require_auth()` before output in all 15 page entry points; unauthenticated GET to each returns 302; `ping.php` answers `{"ok":false}` without leaking; `config.php` is include-only and emits nothing |
| CSRF | Present on all 11 mutating entry points; absent only on the four read-only pages and login, as designed |
| Mail headers | Every value reaching a header in `contact.php` goes through `hdr()` — both `Subject` lines, both `Reply-To`, and the auto-reply `From` display name |
| Other `href`/`src` sinks | `tel:`/`mailto:` interpolate into a fixed scheme; `item.href` (`App.jsx:5776`) is built from those same templates; `logoUrl` and the photo slots are `src`, not `href`. `additionalPdfs` is validated. No `dangerouslySetInnerHTML` anywhere |
| Accessibility sweep | 20 pages; 1 finding (D-05) |
| Handoff email vs shipped admin | Every claim holds; nav labels, landing `<h1>` and the backup/restore promises all match |
| `plan10-adminrows`, `plan10-header`, `plan10-helpwidth`, `plan10-rfqscroll` | 15/15, 8/8, 21/21, 24/24 — first execution of any of them |

---

## Carried, still needing a human

| ID | From | Status |
|---|---|---|
| A-16 | Run 1 | Unchanged. No user-visible effect; whether a no-op save should write previously-absent empty fields is the owner's call |
| A-17 | Run 1 | Unchanged. Five products still on `placehold.co`; needs photography |
| C-06 | Run 3 | Unchanged. Three 5-column spec tables scroll at 1440; every honest fix costs more than the defect |
| D-03 | this run | New. Major router upgrade vs. carrying three unreachable advisories |
