# Audit Run 1

**Date:** 2026-08-13
**Scope:** IPC website + /admin backend (project root)
**Checklist file:** audit-runs/endpoint-checklist.md
**Coverage:** 104/104 endpoints done

## Method / evidence base

- `npm install && npm run build` — clean build, 34 modules, 373.87 kB JS.
- `php -l` on all 19 PHP files — 0 failing.
- `php _harness/lint.php` — 9 drift checks pass. `node _harness/invariants.js` — 17/17 pass.
  Both re-run as the pre-existing baseline; **no finding below contradicts a shipped invariant.**
- Live mirror stood up: `sh _harness/sync.sh` + `php -S 127.0.0.1:8123 -t _harness/site … router.php`.
- Headless Chromium crawl of all 10 public routes + 2 not-found routes, and all 13
  admin pages signed in (console errors, failed requests, ≥400 responses, broken
  images, unlabelled controls, duplicate ids, horizontal overflow, JSON-LD parse).
- `contact.php` driven directly through 11 request shapes (405, 422, 429, 403,
  honeypot, array-typed field, over-cap body, absent referer).
- Admin write paths driven end to end against the mirror: add / duplicate-SKU /
  hostile-SKU / delete / rename-clash / settings save / content save / password
  change / CSRF-fail / unauthenticated GET+POST. Mirror restored to pristine after.

`php -S` ignores `.htaccess`, so the `admin/` and `data/` file-blocking rules were
read, not executed — per CLAUDE.md they are not reported as findings.

## Issues

| Title | Severity | Description | Location | Can Claude fix alone? |
|---|---|---|---|---|
| Owner-set Instagram/TikTok URLs are unvalidated and rendered as raw hrefs | High | Five of the seven social fields are checked for an `http(s)://` prefix and two are not; measured saving `javascript:alert(1)` and seeing it rendered as a live, clickable footer link on every page of the public site. | `admin/settings.php:120-125`, `src/App.jsx:12036-12064` (`FooterSocial`) | Yes |
| Public site has no HTTPS redirect and no security response headers | High | `admin/.htaccess` forces HTTPS and sets X-Frame-Options / nosniff / Referrer-Policy / HSTS / CSP; `public/.htaccess` sets none of them, so the lead form collecting name, email, phone and company posts in cleartext to anyone who arrives on `http://`. | `public/.htaccess` (whole file) | Yes |
| `/industries#industry-*` never scrolls on a direct load | Medium | All five industry anchors linked from the homepage land at scrollY 0 on a cold load or refresh — measured 3× each, with and without reduced motion, all five deterministically 0. `App`'s mount effect scrolls to top after `IndustriesPage`'s effect has asked for the anchor (child effects run before parent effects), cancelling it. In-app clicks work; shared and bookmarked links do not. | `src/App.jsx:12645-12647` vs `src/App.jsx:10950-10952` | Yes |
| `contact.php` does not enforce the two fields the form marks required | Medium | `quantity` (RFQ) and `subject` (message) carry `required` in the browser but the server checks only name/email(/message); measured both submissions accepted and mailed to sales with the field blank, so any non-browser POST produces a quote request with no quantity. | `public/contact.php:401-405`, `:453-457` vs `src/App.jsx:5410-5416`, `:5652-5663` | Yes |
| Product Index category filter has no accessible name | Medium | The "Filter by Category" `<label>` has no `htmlFor`, does not wrap the control, and the `<select>` has no `id` or `aria-label` — the only unlabelled control on the entire public site. | `src/App.jsx:9937-9951` | Yes |
| SKU is stored with no character validation | Medium | `add.php`/`edit.php` check only non-empty and uniqueness; measured storing `<script>x</script>` and `...` as live SKUs. `...` derives the upload filenames `.pdf` and `.png`, which `public/.htaccess`'s dotfile rule then denies, so the datasheet link breaks silently after a successful upload. | `admin/add.php:18-24`, `admin/edit.php:127-129` | Yes |
| Four `add.php` controls have no associated label | Medium | `badges`, `description`, `specTable1_rows` and `specTable2_json` have no `<label for>`, no wrapping label and no `aria-label`, while `edit.php` labels the same four fields correctly. | `admin/add.php` (Badges, Description, spec-table textareas) | Yes |
| `delete.php` renders without a viewport meta tag | Medium | Every other admin page sets `<meta name="viewport">`; the destructive delete-confirmation page does not, so it renders desktop-zoomed on a phone — the one page where misreading the target SKU costs data. | `admin/delete.php:79` | Yes |
| Sign-in, sign-out and failed sign-in are not audit-logged | Medium | `audit_log()` records all 11 content actions and no authentication event, so on an admin whose recovery path is an FTP-placed flag file there is no record of who signed in, when, or how many attempts failed. | `admin/auth.php`, `admin/config.php:995-1008` | Yes |
| Dashboard delete dialog claims the delete cannot be undone | Low | `delete.php:115` says "**This can be undone.** A backup of the whole catalog is…", and the confirm dialog that leads to it says the opposite; the dialog is the wrong half and the one the owner actually reads. | `admin/index.php:230` | Yes |
| `edit.php` double-escapes the SKU-clash error | Low | The message applies `h()` and the error list applies `h()` again on render; measured output `O&amp;#039;Brien`. Last remaining instance of the class fixed elsewhere in AUDIT_v3 NB18. | `admin/edit.php:141` | Yes |
| `audit-log.php` filter controls have no labels | Low | The SKU text input and the action `<select>` in the GET filter form have no `<label for>` and no `aria-label`. | `admin/audit-log.php:110-117` | Yes |
| `manifest.json` points at an icon that does not exist | Low | `/apple-touch-icon.png` is not in `public/` or `dist/`; the SPA catch-all answers it with `index.html` at **200 `text/html`**, so the manifest icon is not merely missing, it is a soft-200 serving HTML as a PNG. | `public/manifest.json:16-20` | Yes |
| `_harness/sync.sh` never copies `admin/logo.svg` | Low | It copies `admin/*.php` and `admin/*.js` only, so every admin page in the mirror renders a broken logo and a 404 favicon — every admin screenshot in the audit record is missing the brand mark and any header regression test measures the wrong header. | `_harness/sync.sh:31-32` | Yes |
| Audit-log action vocabulary is duplicated three ways with no drift check | Low | The filter `<option>` list, `action_color()` and the `audit_log()` call sites each carry the list independently; `lint.php` has drift checks for families, approvals, copy keys and photo slots but not this one. | `admin/audit-log.php:41-55`, `:115`, `_harness/lint.php` | Yes |
| A no-op "Save Content" rewrites `content.json` | Low | Saving with zero edits adds `productFamilies` and 11 previously-absent copy keys as `""`. Verified harmless at render — `mergeContent`'s blank-drop and `contact.php`'s promise guards both hold — but it consumes a backup slot and makes real diffs unreadable. | `admin/content.php` save path | No — arguably correct (the page offers the fields, so saving persists them); changing it is a product decision |
| Five products' photos are hosted by a third party | Low | `IP12GA-IP1274`, `IP13SP`, `IP25PU`, `IP30UV` and `IP47HV` carry `photoUrl` values pointing at `https://placehold.co/...`, so 12% of the catalog's photography depends on an outside service staying up and is a cross-origin request from every product page. | `data/products-all.json` | No — needs real product photography from the owner |

**Totals:** 17 issues — 2 High, 7 Medium, 8 Low. 15 fixable here, 2 need a human decision.

## Verified-clean (checked, no finding)

Recorded so a later run does not re-derive them: all 17 shipped invariants;
9/9 lint drift checks; 0 console errors and 0 ≥400 responses across 22 crawled
pages; 0 broken images and 0 duplicate ids site-wide; 0 horizontal overflow at
1440 and 375; canonical + `og:url` correct and distinct on all 10 routes;
`noindex` on both not-found shapes; sitemap XML well-formed and correctly
escaped even with a hostile SKU in the catalog; all 45 datasheet PDF links and
both marketing PDFs resolve 200; every product `pdfUrl` exists on disk;
`?part=` and `?industry=` prefills land in the right fields; FAQ accordion
`aria-expanded` toggles; dashboard `aria-sort`/`scope` correct; mobile drawer is
a labelled `aria-modal` dialog that takes focus; CSRF rejects with 403;
unauthenticated GET 302s and unauthenticated POST renders the 403 page;
password rules and current-password check both enforced; `form_complete` is the
last of 449 named controls in the rendered `content.php`; `confirm.js` cancel
does not navigate.
