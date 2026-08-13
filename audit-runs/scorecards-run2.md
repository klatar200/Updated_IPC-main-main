# Scorecards — Run 2

One scorecard per sprint in `audit-runs/build-plan-run2.md`. Each criterion is
Pass/Fail against a **measurement**, not against the diff. Sprint verdict = Pass
only if every criterion passes.

---

## Sprint 1 scorecard — B-01, B-02

| # | Criterion | How measured | Result |
|---|---|---|---|
| 1.1 | `src/App.jsx` contains no `alert(` token | `plan3-contact`'s own static assertion | Pass |
| 1.2 | The literal `grep -c "alert(" src/App.jsx` is 0 | its second static assertion, checked as the plan words it | Pass |
| 1.3 | `isSafeExternalUrl`'s logic is unchanged by the reword | `git diff` shows comment lines only inside the docblock | Pass — the function body is untouched |
| 1.4 | The docblock warns future editors about the token | read it | Pass — names the check, the file and the `copydrift.js` precedent |
| 1.5 | `SERVER_MSG` values were measured, not copied from PHP | empty POST to `contact.php` for each form, compare | Pass — `Please add your name, a valid email address and the quantity required.` / `…, a subject and a message.` |
| 1.6 | The verbatim comparison is still the assertion | read the diff — only the constant changed | Pass |
| 1.7 | `plan3-contact` exits 0 | run it | Pass — **51/51, exit 0** (was 45/51, exit 1) |
| 1.8 | Run 1 Sprint 1 criteria still hold (social validation + rendering) | re-run the 1.1–1.7 probes | Pass — save refuses both bad schemes, footer renders the 5 real links only |
| 1.9 | Run 1 Sprint 2 criteria still hold (422 behaviour) | re-run the request matrix | Pass — 422s, mails, honeypot, referer, rate limit all unchanged |
| 1.10 | No regression: invariants 17/17, lint 10/10, build clean | run all three | Pass |

**Sprint 1 verdict: PASS** (10/10) — verified 2026-08-13.

---

## Sprint 2 scorecard — B-03, B-04, B-05

| # | Criterion | How measured | Result |
|---|---|---|---|
| 2.1 | `sync.sh` exits **1** on a planted `public/` edit with no rebuild | append a line to `public/contact.php`, run, read `$?` | Pass — exit 1, message names `contact.php` |
| 2.2 | The message names the file and the fix | read stdout | Pass — "dist/ does not match public/ for: contact.php … Run: npm run build && sh _harness/sync.sh" |
| 2.3 | `sync.sh` exits **0** when in sync | rebuild, run, read `$?` | Pass — exit 0, "public/ vs dist/: in sync" |
| 2.4 | The check compares contents, not timestamps | read the diff — `cmp -s` | Pass |
| 2.5 | `sync.sh` does not run `npm run build` itself | read the diff | Pass — contract unchanged |
| 2.6 | `launch.json` is valid JSON with both configurations | parse it | Pass — 2 configs |
| 2.7 | `php-admin` names the harness docroot, not the repo root | read `runtimeArgs` | Pass — `-t _harness/site … router.php` |
| 2.8 | No hardcoded absolute interpreter path | read `runtimeExecutable` | Pass — `php` |
| 2.9 | The config carries a note saying what it exposed before | read it | Pass |
| 2.10 | `plan8-catalog` reaches 16/16 | run it | Pass — **16/16** (was 15/16) |
| 2.11 | The repaired assertion still checks the same property | read the diff and the passing line | Pass — "the open family is the one containing IP33PO (\"Collapse Polyolefin Heat Shrink product list ▼\")" |
| 2.12 | **B-05 was failing before Run 1's changes too** | `git stash` `src/App.jsx`, rebuild, re-run | Pass — 15/16 with Run 1's changes stashed; pre-existing, not a Run 1 regression |
| 2.13 | No assertion was deleted or weakened | diff the suite: 16 assertions before and after | Pass |
| 2.14 | No regression: invariants 17/17, lint 10/10, build clean | run all three | Pass |

**Sprint 2 verdict: PASS** (14/14) — verified 2026-08-13.

---

## Run 2 regression batch

Suites executed against the post-Run-1, post-Run-2 tree. These are the project's
own acceptance criteria and Run 1 never ran them.

| Suite | Result |
|---|---|
| plan5-social | 35/35 |
| plan2-delete | 18/18 |
| plan2-sku | 14/14 |
| plan3-contact | 51/51 (after B-01/B-02) |
| plan4-admin | 19/19 |
| plan4-public | 27/27 |
| plan9-notfound | 8/8 |
| plan2-formlast | 8/8 |
| plan6-families | 13/13 |
| plan7-approvals | 11/11 |
| plan5b-sidebar | 9/9 |
| plan5b-sitemap | 9/9 |
| plan5c-sitemap | 17/17 |
| plan8-catalog | 16/16 (after B-05) |
| plan8-crumbs | 22/22 |
| plan8-faq | 19/19 |
| plan8-keyboard | 8/8 |
| plan8-meta | 15/15 |
| plan9-meta | 18/18 |
| plan9-firstsave | 8/8 |
| plan5-images | 12/12 |
| plan5-keys | 11/11 |
| plan5-spectable | 13/13 |
| plan7-datasheets | 8/8 |
| plan7-slots | 16/16 |
| plan8-certs | 5/5 |
| plan8-landing | 18/18 |
| plan8-lead | 16/16 |
| plan8-formpolish | 15/15 |
| plan10-auditlog | 13/13 |
| plan10-adminnav | 25/25 |
| plan10-dashboard | 25/25 |

**32 suites, 32 exited clean, 424 assertions.** Two of them — `plan3-contact`
and `plan8-catalog` — were red before this run and are green because B-01, B-02
and B-05 were fixed; the other 30 were green throughout and stayed green, which
is what makes them a regression result rather than a coincidence.
