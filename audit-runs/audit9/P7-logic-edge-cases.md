# P7 — logic-edge-cases          agent: A   started/finished: 2026-09-14 15:40 / 2026-09-14 18:10 UTC   mirror: :8140
findings:   Blocker 0 · High 1 · Medium 1 · Low 0

| ID | sev | class | where | one line |
| A-9.P7-1 | High | code | `admin/edit.php:171-186` | Renaming a SKU whose data sheet is **shared** with another product physically renames the file, and the other product's `pdfUrl` is left pointing at a file that no longer exists — the other product's Data Sheet link 404s, with a "saved successfully" message and nothing in the audit log to say it happened. |
| A-9.P7-2 | Medium | code | `src/App.jsx:4706` | A cold load of `/contact?sent=1` (reload, bookmark, restored tab, forwarded link) renders the full "Quote Request Received — Thank you! Your quote request has been received" panel for a request that was never sent. Appendix C row C4 and `UX_AUDIT_PREPROD_2026-08-12.md` F5 both expect this to be closed; PLAN-11 §11 records F1–F17 as "all fixed in PR #42". Measured: not fixed. |

ledger:     done E012, E013, E018, E019, E020, E025, E026, E040, E041, E056, E059, E061, E065, E066, E067, E070, E077, E078, E079, E081, E114, E174, E175   blocked none
suites cited: plan9-notfound 8/8 · plan8-crumbs 22/22 · plan8-catalog 16/16 · audit7 30/30 · invariants 17/17 · copydrift (no score line, green) · plan5-spectable 13/13 · plan3-contact 51/51 · contactflow 85/85 · contactflow-selftest 26/26 · audit5-blockers 18/18 · audit5-high 30/30 · audit5-medium 20/20 · audit7-lead 23/23 · plan3-autoreply 22/22 · plan4-admin 19/19 · plan2-trunc 13/13 · nodupbackups 10/10 · plan2-delete 18/18 · plan5b-pwthrottle 10/10 · plan5b-sitemap 9/9 · plan5c-sitemap 17/17
instruments (all new this round, all tracked, all BASE/SITE/ONLY/NEGCTL-driven, each with a negative control proven once):
  _harness/audit9-logic-public.js   — C1, C2, C3, C4, C31. 34 checks (C1 10, C2 8, C3 9, C4 3, C31 4). NEGCTL replaces the derived copyright year in the MIRROR'S bundle.
  _harness/audit9-logic-data.js     — C5, C6, C7, C8, C9. 70 checks (C5 50, C6 1, C7 7, C8 8, C9 3, plus the shared restore assertion). NEGCTL removes, one at a time, invariant 4's blank-drop, invariant 3's `[]`-is-a-deletion ternary, `jsonOrThrow`'s Content-Type assertion, and the `key={page}` on `ErrorBoundary` — from the MIRROR'S bundle. Restores the three data files and the bundle in a `finally` and asserts the restore byte-for-byte.
  _harness/audit9-logic-admin.js    — C19, C21, C22, C23, C26, C32. 37 checks (C21 3, C19 9, C22 5, C23 6, C26 5, C32 8, plus the restore assertion). HTTP + filesystem, no browser.
  _harness/audit9-logic-contact.js  — C13, C18. 18 rows: 17 scored (C13 16, C18 1) plus one non-scoring informational row on C18. NEGCTL removes `h()` from one render site in the MIRROR'S `inquiries.php`.
artifacts:
  _harness/out/audit9/P7/branch-row-map.md   — P7 step 2: every `if`/ternary in `jsonOrThrow`, `fetchProductsCached`, `useProducts`, `mergeSiteInfo`, `mergeContent` and `contact.php`'s decision chain → its Appendix C row; the three branches no row reached, and what running them showed
  _harness/out/audit9/P7/logic-public.json / logic-data.json / logic-admin.json / logic-contact.json — per-check results
  _harness/out/audit9/P7/public-run.txt · data-run.txt · contact-run.txt · c5-run.txt · c5-negctl.txt · c6-run.txt — console transcripts
  _harness/out/audit9/P7/c23-repro.sh + c23-post.js + c23-observed.txt — the A-9.P7-1 reproduction, standalone
  _harness/out/audit9/P7/c18-browser.js      — C18 through the rendered form (the visitor's path)
  _harness/out/audit9/P7/c6bc.js             — the two added coverage rows C6b and C6c
  _harness/out/audit9/P7/c33-eol.txt         — `git ls-files --eol '*.sh'`
  _harness/out/audit9/P7/mail.log            — the fakemail capture for this mirror (per-mirror, not the shared /tmp default)
  _harness/out/audit9/P7/pristine-*.json     — the restore reference the instruments diff against
out of brief:
  src/App.jsx:2851,10025 — `ApprovalFilter` is driven by `useState` inside `DashboardPage` and is never read from or written to the URL, so an approval filter cannot be linked to or shared. (Structure, P6's surface, not mine.)
  _harness/router.php:30 — `rawurldecode(null)` deprecation on a `//`-prefixed path; harness, and the only two lines in P2's E_ALL log. Recorded under P2 step 3.
[UNVERIFIED]/[UNSOURCED]:
  [NOT-MEASURED] `fetchProductsCached` branch F3 (`AbortController` undefined) — not reachable in Chromium; no browser in the support matrix lacks it.
  [NOT-MEASURED] `mergeContent` branch M6 (a top-level scalar `""` is kept, where `mergeSiteInfo` would drop it). The shipped `content.json` has no top-level scalar — all 18 keys are arrays or objects — so the asymmetry has no render site today. Recorded in the branch map as a coverage note, not raised.
self-corrections:
  1. C9's "the NEXT page renders" check first asserted `/Request a Quote|Send us a message/`. The **negative control caught it**: with `key={page}` removed from `ErrorBoundary` the check still passed, because "Request a Quote" is the NAVBAR CTA and is on the crash screen too. Re-written to assert the contact page's own "Get in Touch" heading plus the absence of "Something went wrong"; the control then failed as required. This is exactly the GUARDRAILS §7.2 probe-defect class.
  2. C13's header-injection check first scanned the whole captured message for `^Bcc:`. `s()` deliberately keeps CR/LF in BODY-bound values (invariant 10), so the payload appears in the body and read as an injection that is not one — PHP writes headers, separator, then body, and a body line can never become a header. Re-written to scan only the header block. The header block is clean: `To, Subject, From, Reply-To, MIME-Version, Content-Type`, one Subject line.
  3. The `hdr()` negative control **could not be made to fail**, and that is a result, not a gap: measured on PHP 8.4.19, `mail()` itself collapses CR/LF in `$subject` to spaces (`mail('x@e.com', "SUBJ\r\nBcc: evil@e.com", 'body', "From: a@b.c\r\n")` → `Subject: SUBJ  Bcc: evil@e.com`, one line). So the "Subject is one line" assertion is over-determined and `hdr()` is genuine belt-and-braces rather than the only line. The contact instrument's control was retargeted at the `h()` render boundary in `inquiries.php`, which does fail when removed.
  4. C18 first read as a finding: two parallel POSTs produced two leads and four mails. Reproduced through the visitor's path first (§10.1.2) — a real double-click on the rendered Submit button fires **one** POST, writes **one** row, sends **one** sales mail, because `submitting` disables the button (`App.jsx:4720,5534,5747`). Downgraded to an informational, non-scoring line in the instrument.
  5. C3's `?approval=` arm was written against a wrong premise. `?approval=` is not a route parameter anywhere in the app, so "an empty state with a way out" is the wrong expectation; the correct outcome for an unread query string is the full catalog. Re-written to assert that, with the mis-premised half moved to "Out of brief".
  6. C22's "exactly one new backup" and C23's PDF arms both failed first on instrument state, not on the code: `newOnes` was diffing against only the seeded stamp so earlier rows' backups counted as new, and the pdfs restore was a `cp -r` that left the renamed file behind, which then tripped `edit.php`'s (correct) no-clobber guard on the next arm. Both fixed; C26's first failure was the same class — the probe held a live admin session, and `auth.php` renders differently for one.

---

### A-9.P7-1 — HIGH — renaming a product's SKU silently breaks a DIFFERENT product's data sheet when the two share one PDF

class:        code
pass:         P7 (Appendix C row C23)     ledger: E061, E083
surface:      `admin/edit.php` (Edit Product → change the SKU), `pdfs/`, and the public product page of the *other* product
where:        `admin/edit.php:171-186` — the `$renameOne` closure   (measured on 2121597, 2026-09-14)
not in §11:   checked GUARDRAILS §7, §7.1, §7.2, §7.3; `audit-runs/audit5.md` Refuted + Checked-no-finding; `audit-runs/audit6.md`; `audit-runs/audit7.md` §3/§4; `audit-runs/audit8.md`; `WHATS_LEFT.md` §2/§3; `CLAUDE.md` invariants 1-16. `grep -n "pdf_rename_for_sku_change\|shared datasheet\|pdf_in_use" audit-runs/*.md plans/GUARDRAILS.md` → only `plan2-delete`'s row, which covers **deletion**. Deletion is exactly the case that IS guarded (`pdf_delete_if_unused()` calls `pdf_in_use()` first, `config.php:1838-1850`); rename is the same question asked at a different call site and it is not asked.
reproduce:    (runnable cold on a fresh mirror copy)
  1. `cp -r _harness/site _harness/out/audit9/site-V && php -S 127.0.0.1:8150 -t _harness/out/audit9/site-V -c _harness/php-mail.ini _harness/router.php &`
  2. Confirm the shared sheet: `node -e 'const j=require("./_harness/out/audit9/site-V/data/products-all.json");const c={};for(const p of j)if(p.pdfUrl)(c[p.pdfUrl]=c[p.pdfUrl]||[]).push(p.sku);console.log(Object.entries(c).filter(([,s])=>s.length>1))'`
     → `[ [ '/pdfs/IP12GA-IP1274.pdf', [ 'IP12GA', 'IP12GA-IP1274' ] ] ]`
  3. Sign in, open `admin/edit.php?sku=IP12GA`, change **only** the SKU field to `IP12GAX9`, Save.
     (Scripted equivalent: `SITE=_harness/out/audit9/site-V BASE=http://127.0.0.1:8150 ADMIN_PW=<mirror pw> sh _harness/out/audit9/P7/c23-repro.sh`, or `ONLY=C23 node _harness/audit9-logic-admin.js`.)
  4. `ls _harness/out/audit9/site-V/pdfs/IP12GA*` and read both products' `pdfUrl`.
observed:     (`_harness/out/audit9/P7/c23-observed.txt`)
```
--- before ---
pdfs/IP12GA-IP1274.pdf
IP12GA         -> /pdfs/IP12GA-IP1274.pdf
IP12GA-IP1274  -> /pdfs/IP12GA-IP1274.pdf
POST -> 302 index.php?msg=IP12GAX9+saved+successfully&type=success
--- after ---
pdfs/IP12GAX9-IP1274.pdf
IP12GAX9       -> /pdfs/IP12GAX9-IP1274.pdf   FILE EXISTS
IP12GA-IP1274  -> /pdfs/IP12GA-IP1274.pdf     FILE MISSING
--- audit log ---
{"action":"edit","sku":"IP12GAX9","detail":"Renamed from IP12GA. Product details updated | PDF renamed IP12GA-IP1274.pdf → IP12GAX9-IP1274.pdf"}
```
              The control in the same run is green: a product whose sheet is **unique** (`CC` → `CCX9`) renames correctly to `/pdfs/CCX9.pdf` with no file left behind. `audit9-logic-admin.js` reports **36/37**, the one red being this.
expected:     `$renameOne` should ask the same question `pdf_delete_if_unused()` asks before it touches the file — is any OTHER product still pointing at this basename (`pdf_in_use($products, $oldName)` over the list with this product's row already updated)? If yes, leave the file alone and keep the old URL, exactly as the closure already does when the target name is taken. `config.php:1806-1818`'s own comment states the rule: "so we never delete a data sheet that another product still points at". A rename is a delete-and-create from the other product's point of view.
consequence:  A buyer on the OTHER product's page clicks Data Sheet and gets a 404 — on a spec-grade catalog that is the artifact the visit exists for, and it is the last step before an RFQ. Rick gets "IP12GAX9 saved successfully", and the audit log line names only the rename, so nothing tells him another product lost its sheet; he would find out when a customer tells him. It is not self-healing: re-uploading a PDF for the broken product is the only repair, and the admin offers no "which products share this file" view. Today exactly one pair is affected (`IP12GA` / `IP12GA-IP1274`), and `config.php:1790-1799`'s comments show compound sheets (`IP17TW-IP18SW-IP19LW.pdf`) are an expected shape, so the pair count is a fact about today's catalog rather than a bound.
evidence:     `_harness/out/audit9/P7/c23-observed.txt`; `_harness/out/audit9/P7/logic-admin.json` (row C23); `_harness/audit9-logic-admin.js`. Suite coverage: none. `plan2-delete 18/18` covers the deletion path, which is guarded; no suite renames a SKU whose sheet is shared.
verified-by:  —
outcome:      —
fix-proof:    —

### A-9.P7-2 — MEDIUM — `/contact?sent=1` tells a visitor their quote request was received when nothing was sent

class:        code  (may be re-classified `decision` — see "expected")
pass:         P7 (Appendix C row C4)     ledger: E040, E041
surface:      `/contact`, both forms
where:        `src/App.jsx:4706-4707` — `const [sentParam] = useSearchParam("sent"); const submitted = sentParam === "1";`   (measured on 2121597, 2026-09-14)
not in §11:   checked GUARDRAILS §7/§7.1/§7.2/§7.3 and `PLAN-11 §11`. §11's row for `UX_AUDIT_PREPROD_2026-08-12.md` says "F1–F17 … All fixed in PR #42 / `WHATS_LEFT.md` §1c. **Re-verify by measurement in P6**; do not re-report the text." This is the re-verification Appendix C row C4 asks for, and the measurement contradicts the claim — §10.1.6 makes a refutation a result. The only `F5` in `WHATS_LEFT.md` (`:4615`) belongs to a different F-series (the no-op-backup set: "copy corrected in `backups.php` … and `help.php`"), not to UX_AUDIT F5. `WHATS_LEFT.md:2819` records `B17 | /contact?sent=1 — reloadable, Back returns to the form, no re-POST | plan8-lead` — i.e. "reloadable" was at some point accepted, which is why this needs a decision rather than a silent fix.
reproduce:
  1. `cp -r _harness/site _harness/out/audit9/site-V && php -S 127.0.0.1:8150 -t _harness/out/audit9/site-V -c _harness/php-mail.ini _harness/router.php &`
  2. Open `http://127.0.0.1:8150/contact?part=IP33PO&sent=1` cold — a new context, nothing submitted.
  3. Read the page text and the URL.   (Scripted: `ONLY=C4 BASE=http://127.0.0.1:8150 node _harness/audit9-logic-public.js`.)
observed:     URL unchanged at `/contact?part=IP33PO&sent=1`; body renders
              "REQUEST SENT / Quote Request Received / Thank you! Your quote request has been received. Our sales team will review the details and respond within one business day — often the same day for in-stock items. … Submit Another  Browse Products".
              No POST is made — `mail.log` and `admin/inquiries.jsonl` are both unchanged, so nothing was actually sent.
              `audit9-logic-public.js` 32/34, the two reds being this row's two checks.
expected:     Appendix C row C4: "`?sent=1` reload shows no false success (F5)". UX_AUDIT F5's own remedy is already written and the shim already supports it: hold `sent` in state set by the successful POST and strip the parameter with the existing `{ replace: true }` setter after render, so a cold arrival at `?sent=1` sees the form. Against that, `App.jsx:4700-4704` argues the opposite in a comment — "Reloading `?sent=1` re-renders 'thank you' … That is the standard answer and it sends no request" — so the code is deliberate. That disagreement between the record and the code is the substance of this finding; which way it resolves is C's call.
consequence:  The confirmation panel is the visitor's only evidence that an RFQ went through. The failure is not the happy path — a real submission does get a real confirmation — but the three cases around it: a browser-restored tab after a crash, a reload while the POST was still in flight and failed, and a forwarded link. In each the buyer is told a quote request was received when none was, waits a business day for a reply that is not coming, and IPC never sees the lead. Medium rather than High because a visitor who actually submitted is correctly informed and the lead path itself is intact; the tiebreak (§2 — protect the buyer looking for a spec-grade part) is what keeps it above Low.
evidence:     `_harness/out/audit9/P7/logic-public.json` (row C4); `_harness/out/audit9/P7/public-run.txt`; `_harness/audit9-logic-public.js`. `UX_AUDIT_PREPROD_2026-08-12.md:77` (Journey C12) and `:176-186` (F5). Suite coverage: none — `contactflow 85/85` submits real forms and asserts the confirmation that follows a real submission, which is the case that works.
verified-by:  —
outcome:      —
fix-proof:    —

---

## Appendix C — observed column (P7)

`new` rows were run this round; suite rows are satisfied by the Phase 0 sweep line and are cited, not re-run (PLAN-11 §3.5 rule 7).

| # | Evidence | Observed |
|---|---|---|
| C1 | `plan9-notfound 8/8`, new | **Pass** (10/10). `/Products` → 404 page, `robots: noindex`, 1018 chars. `/products/` → normalised to the catalog, 3817 chars. `/products/x` → 404 page + `noindex`. `//products` → the catalog renders; the only side effect is a `rawurldecode(null)` **deprecation from `_harness/router.php:30`**, which Apache never reaches (mod_rewrite handles `//products` before PHP). None blank. |
| C2 | `plan8-crumbs 22/22`, new | **Pass** (8/8). `?productId=` empty → the catalog, title "Product Catalog". Unknown → the T2.8 banner, title "Part not found — …", page fully rendered. UPPERCASE and trailing-space both resolve to the real product (case- and whitespace-tolerant lookup), title "Nonmetallic Liquid-tight Conduit Coupling — CC — …". Never blank. |
| C3 | `plan8-catalog 16/16`, new | **Pass** (9/9). Unknown `?family=` → "No products found / Nothing in not-a-family", a **Clear filters** control, and the phone number in the empty state. `?approval=` is **not a route parameter** (`ApprovalFilter` is `useState` inside `DashboardPage`), so an unknown one is inert and all 42 products render — the correct outcome for a query string the app does not read. Self-correction 5. |
| C4 | new | **FAIL → A-9.P7-2.** Back from a filtered catalog is not trapped (`/products?family=…` → Back → `/products`). `?sent=1` on a cold load renders the full success panel and the parameter is not stripped. |
| C5 | `audit7` (A-7.9), new | **Pass** (50/50). Each of the three files × {404, HTML-200, truncated, wrong `Content-Type`, 12 s stall}. Catalog failure → `CatalogError` every time, never blank, with `630.771.0700` on the page (invariant 8). `site-info.json` or `content.json` failing leaves `/products` fully rendered. `/contact` fully renders and keeps the phone number in all 15. `jsonOrThrow` rejects the HTML-200; the negative control showed the Content-Type assertion **alone** is what defends the `text/plain`-with-valid-JSON arm, since an HTML body also fails `res.json()`. |
| C6 | new (4.25 §4b) | **Pass** (1/1, plus the two added rows C6b and C6c). A product added to the mirror while the page stayed open appeared after the 60 s TTL plus a refocus — 42 → 43, same URL, no reload. Added rows: **C6b** two components in one load issue **one** request for `products-all.json`; **C6c** a refetch that 404s on refocus is swallowed and the 42 products stay on screen with no `CatalogError`. |
| C7 | `invariants 17/17`, new | **Pass** (7/7). Blank non-clearable scalar → default returns (invariant 4). Blank `contact.fax` and `company.slogan` → really cleared (`SITE_CLEARABLE`). Missing key → default. `contact` as a string → whole group defaults. `hours.days` as a string → array default kept, page renders. Whole file `[]` → `SITE_DEFAULTS`. Negative control: removing the blank-drop makes arm 1 fail. |
| C8 | `invariants`, `copydrift`, new | **Pass** (8/8). `privacySections: []` and `faq: []` both **stay deleted** (invariant 3). Missing section and a string-for-array both fall back to the default. Null rows inside a section array are filtered and the real row renders (L2). A blank non-clearable copy field falls back. A `copy` group the React side does not know is ignored, not fatal. Whole file `"x"` → `contentDefaults()`. Negative control: re-seeding `&& v.length` makes arm 1 fail. |
| C9 | new | **Pass** (3/3). An object where a string belongs on `/faq` shows "Something went wrong" **inside** `<main>`; navbar, footer and `630.771.0700` survive (invariant 8). Clicking through to `/contact` in the same tab renders "Get in Touch" with no reload (invariant 7). Negative control: removing the `key` from `ErrorBoundary` leaves the crash screen on `/contact` — see self-correction 1. |
| C10 | `plan5-spectable 13/13`, `audit7 30/30`, `plan5c-sitemap 17/17` | Satisfied by the sweep lines. |
| C11 | `plan3-contact 51/51`, `contactflow 85/85` | Satisfied by the sweep lines. |
| C12 | `audit7-lead 23/23` | Satisfied by the sweep line. |
| C13 | `audit5-blockers 18/18`, new | **Pass** (16/16 scored). Both forms, every field carrying `– ° ″ µ 🔥` + an RTL mark at once, plus CR/LF in the two header-bound fields. All 8 RFQ fields byte-faithful in the JSONL; `<1/4 inch and >2 inch ID` survives literally (invariant 10); one valid JSON object per line even with CR/LF in the body; header block is exactly `To, Subject, From, Reply-To, MIME-Version, Content-Type` with **one** Subject line and no `Bcc:`/`X-Injected:`; the injected text lands as literal subject text. `inquiries.php` renders the unicode and escapes `<`/`>` exactly once. See self-corrections 2 and 3. |
| C14 | `audit5-high 30/30`, `audit7-lead 23/23` | Satisfied by the sweep lines (cited in P3 step 8). |
| C15 | `audit5-high 30/30`, `plan3-autoreply 22/22` | Satisfied by the sweep lines. |
| C16 | `audit7-lead 23/23` | Satisfied by the sweep line, **and** re-run by hand on `:8140` with `sendmail_path=/bin/false`: `500 {"ok":false,"error":"The mail server could not send your message. Please call 630.771.0700 or email sales@insulationproducts.com directly."}`, JSONL `"sent":false`, no A-7.4 marker. |
| C17 | `audit7-lead 23/23` | Satisfied by the sweep line. |
| C18 | new | **Pass.** Through the rendered form (`c18-browser.js`): a real double-click fires **one** POST, writes **one** JSONL row, sends **one** sales mail, shows the success panel. Back-then-resubmit is accepted, which is correct — a deliberate second send must not be blocked. Informational, not scored: two *parallel scripted* POSTs are not deduplicated server-side (`contact.php` has no idempotency key). Self-correction 4. |
| C19 | `plan4-admin 19/19`, new | **Pass** (9/9). Two tabs on `settings.php`, `edit.php` and `content.php`, same `orig_sig`, tab A saved first: tab B gets "changed by another session … were NOT saved", tab B's **typed** values are re-rendered, and tab A's value is what is on disk. |
| C20 | `plan2-trunc 13/13` | Satisfied by the sweep line. |
| C21 | `nodupbackups 10/10`, plus the settling save | **Pass** (3/3). After the settling save the `nodupbackups` note requires, a genuinely unchanged save writes **no bytes**, writes **no backup**, and still succeeds with a "No changes" notice (invariant 16). |
| C22 | `audit7 30/30`, new | **Pass** (5/5). With 90 same-second `site-info.backup.20260101-120000[-NN].json` files seeded, a real save writes **exactly one** new backup, allocated max-used+1 within its own second (invariant 5). `backup_list()` is ordered on the parsed (timestamp, sequence) — newest first, verified against a re-sort. Restoring a malformed backup is refused with "The backup file is not valid JSON — restore aborted, nothing was changed." and the live file is untouched (read-side gate, A-7.8). |
| C23 | `plan2-delete 18/18`, new | **FAIL → A-9.P7-1.** Unique sheet: renamed correctly (`CC.pdf` → `CCX9.pdf`, nothing orphaned), audit-logged. Shared sheet: the file is renamed out from under the other product. Both renames are audit-logged. |
| C24 | `audit5-medium 20/20` | Satisfied by the sweep line (and P3 step 5's eight upload cases on `:8140`). |
| C25 | `plan5b-pwthrottle 10/10`, `invariants 17/17` | Satisfied by the sweep lines. |
| C26 | `audit5-high 30/30`, new | **Pass** (4/4). `ALLOW-PASSWORD-RESET` at **mtime −3599 s** → the "Set Admin Password" recovery form. At **−3601 s** → the ordinary Sign In form, **and the stale flag is explained**: "it is more than an hour old, so the password-reset screen is closed and your normal password works again. Please delete that file over FTP." With `config.local.php` removed: HTTP 200, no fatal, the login page with the recovery route offered (A-5.7). Tested with `touch -d`, not by freezing PHP's clock, as the brief requires. |
| C27 | `invariants 17/17`, `plan4-admin 19/19` | Satisfied by the sweep lines (and P3 step 1b: 14/14 pages answer a signed-out POST with a rendered page, never a 302). |
| C28 | `audit7-lead 23/23` | Satisfied by the sweep line (and P3 step 6: 185 → 185 session files over 5 unauthenticated `ping.php` GETs, control +1). |
| C29 | `audit5-high 30/30`, `audit7-lead 23/23` | Satisfied by the sweep lines. |
| C30 | `plan5b-sitemap 9/9`, `plan5c-sitemap 17/17`, `audit7 30/30` | Satisfied by the sweep lines. Re-exercised on `:8140` under E_ALL for P2 step 3: healthy → 52 `<loc>`; `null`, `"x"`, `{"products":[]}`, `[{"id":{}}]`, malformed JSON and a **missing file** → 10 static routes, always `200 application/xml`, zero error-log lines. |
| C31 | new | **Pass** (4/4). Playwright `clock` at `2026-12-31T23:59:59` → `© 1974–2026`; at `2027-01-01T00:00:01` → `© 1974–2027`. The privacy "Effective Date: January 1, 2025" is static at both. Negative control: hardcoding the year in the mirror bundle makes the 2027 arm fail. |
| C32 | new | **Pass** (8/8). `– ° ″ µ 🔥` + RTL through `settings.php` → `site-info.json` → the served `/data/site-info.json` → back into the form escaped once, not doubled. Same through `edit.php` → `products-all.json` and `content.php` → `content.json`. All three files carry **literal UTF-8** on disk (`JSON_UNESCAPED_UNICODE`), no `\uXXXX`. |
| C33 | new | **Pass** (2 files, 0 rows differ). `git ls-files --eol '*.sh'` → `_harness/fakemail.sh` and `_harness/sync.sh`, both `i/lf  w/lf  attr/text eol=lf` (PR #47's `.gitattributes`). Zero rows differ. |

No cell in the observed column is empty.

**Totals, computed from the result JSON, not typed:** `logic-public` 32/34 · `logic-data` **70/70** ·
`logic-admin` 36/37 · `logic-contact` 17/17 scored (+1 informational) · C33 2 files, 0 differing —
**157 of 160 checks pass; the 3 reds are the 2 findings above** (C4 two checks, C23 one check).
