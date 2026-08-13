# Audit Run 2

**Date:** 2026-08-13
**Scope:** IPC website + /admin backend (project root), after Run 1 execution
**Checklist file:** audit-runs/endpoint-checklist.md
**Coverage:** 109/109 endpoints done (104 from Run 1 + E105–E109 absorbed from
`audit-runs/missed-coverage.md`)

## What this run is

Phase 4A found **missed coverage** — Run 1's checklist named three harness files
and none of the ~180 regression suites. Those suites are the project's stated
acceptance criteria (`WHATS_LEFT.md` §4* cites them by name as the evidence
behind every shipped item), so not running them meant Run 1's fixes were
verified against my own probes and nothing else.

Running them immediately found two defects Run 1 had shipped. That is the
finding that justifies the loop.

This run therefore covers:
1. the five absorbed items (E105–E109),
2. a **full re-crawl** of all 10 public routes, both not-found shapes and all 13
   admin pages against the post-Run-1 code,
3. targeted execution of the harness suites that assert on surfaces Run 1
   changed.

## Re-audit of Run 1's surface (no new issues)

All 15 Run 1 fixes re-verified on the rebuilt mirror: 12/12 public routes with
0 console errors, 0 ≥400 responses, 0 broken images, 0 unlabelled controls, 0
duplicate ids, 0 horizontal overflow; 13/13 admin pages the same; invariants
17/17; `lint.php` 10/10 checks (up from 9 — A-15 added one). No Run 1 issue
recurred and no Run 1 fix regressed.

## Issues

| Title | Severity | Description | Location | Can Claude fix alone? |
|---|---|---|---|---|
| A Run 1 comment broke the "no browser dialog survives" check | High | `plan3-contact.js` asserts a literal `grep -c "alert(" src/App.jsx` returns 0 — that is how the 4.5 remediation proves no modal dialog is left in the app — and Sprint 1's `FooterSocial` comment quoted a `javascript:` URL followed by that function name, failing 2 assertions from a comment, exactly as the suite's own inline warning says it will. | `src/App.jsx` (`isSafeExternalUrl` docblock), `_harness/plan3-contact.js:151-160` | Yes — **fixed** |
| `plan3-contact.js` pinned the two 422 strings A-04 changed | Medium | The suite hardcodes what `contact.php` returns for an incomplete submission and asserts the app renders it verbatim; A-04 rewrote both strings by design, failing 6 assertions across 3 viewports. The assertion is correct and stays — only the expected values were stale. | `_harness/plan3-contact.js:44-47` | Yes — **fixed** |
| `sync.sh` silently serves a stale `public/` file | High | Its header says to run it after every edit under `admin/` or `public/`, but `public/*` reaches the mirror only via `dist/`, i.e. only after `npm run build`. A bare `sync.sh` after editing `contact.php` mirrors the previous file, and the two bundle hashes it prints are unchanged by such an edit, so nothing indicates it. Measured: Sprint 2's first verification pass reported the old behaviour as still live. | `_harness/sync.sh` | Yes — **fixed** |
| `.claude/launch.json` serves the repository root over HTTP | Medium | The `php-admin` configuration ran `php -S localhost:8080 -t .`, putting `admin/config.local.php` (the live password hash), `admin/admin-log.jsonl`, `admin/inquiries.jsonl`, `data/` and `_localsite/` on localhost with no `.htaccess` in force — PHP's built-in server ignores `.htaccess` entirely. It also hardcoded `C:\php\php.exe`, so it ran on exactly one machine, and it contradicted the docroot `_harness/README.md` documents. | `.claude/launch.json` | Yes — **fixed** |
| A `plan8-catalog` assertion has been failing on its own text extraction | Medium | "the open family is the one containing IP33PO" reads the toggle's `textContent`, which is only the chevron glyph — the family name is in the `aria-label`. So it compared against `"▼"` and could never pass, whatever the sidebar did. Proven pre-existing: 15/16 both with and without Run 1's `App.jsx` changes. A permanently-red assertion trains people to ignore the suite. The behaviour it claims to check was correct throughout (`openCount === 1`, `aria-label="Collapse Polyolefin Heat Shrink product list"`). | `_harness/plan8-catalog.js:145-157, 310-312` | Yes — **fixed** |

**Totals:** 5 issues — 2 High, 3 Medium. All 5 fixable here; all 5 fixed.

Two of the five (rows 1 and 2) were **introduced by Run 1** and caught only
because Phase 4A widened coverage. Three were pre-existing.

## Carried forward unchanged from Run 1

Still open, still correct, still needing a human:

| ID | Title | Why not fixable here |
|---|---|---|
| A-16 | A no-op "Save Content" rewrites `content.json` | The behaviour is defensible — `content.php` offers those fields, so persisting them on save is consistent. Suppressing empty values changes what a save means. Verified again in Run 2 to have no user-visible effect. |
| A-17 | Five products' photos are hosted by placehold.co | Needs real product photography from the owner. |

## Verified-clean in Run 2

`E108` `package-lock.json` — lockfileVersion 3, 183 packages, every root range
matches `package.json`. `E109` `plans/audit10/**` — all 20 JSON files parse;
planning artifacts, not runtime, not deployed. Harness suites run green:
`plan5b-sidebar` 9/9, `plan5b-sitemap` 9/9, `plan5c-sitemap` 17/17,
`plan8-crumbs` 22/22, `plan8-faq` 19/19, `plan8-keyboard` 8/8, `plan8-meta`
15/15, `plan9-meta` 18/18, `plan9-firstsave` 8/8, `plan5-social` 35/35,
`plan2-delete` 18/18, `plan2-sku` 14/14, `plan4-admin` 19/19, `plan4-public`
27/27, `plan9-notfound` 8/8, `plan2-formlast` 8/8, `plan6-families` 13/13,
`plan7-approvals` 11/11, and after the fixes `plan3-contact` 51/51 and
`plan8-catalog` 16/16.

Also re-verified as edge cases of the A-03 fix, because a hash guard on the
scroll-to-top effect could plausibly suppress it elsewhere: navigating away
from a hashed URL (`/industries#industry-marine` → `/about`) lands at scrollY 0;
using the skip link (which sets `#ipc-main`) and then navigating lands at
scrollY 0; an ordinary deep-scrolled in-app navigation lands at scrollY 0.
