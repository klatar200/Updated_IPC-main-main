# Audit 8 — the go-live audit

**Date:** 2026-08-27, for the 2026-08-29/30 launch.
**Base:** `1826a6d` — the head of `claude/pre-launch-stability-audit-hjay0d`,
i.e. `main` @ `ff62280` plus the merged audit-7 work.
**Brief:** confirm the project is ready to go live this weekend.

| Severity | Count |
|---|---|
| Blocker | 0 |
| High | 2 |
| Medium | 3 |
| Low | 3 |

**Five of the eight are fixed. Three are owner decisions that code must not
make** — a certification claim, and two sentences of published privacy policy.
They are named precisely, with the screen each is edited on, rather than left as
a line on a list.

---

## 0. The lens, and why it is a different one

Seven rounds have audited this code. It is 79/79 green and the obvious defects
are gone. Re-running the same lens an eighth time would mostly re-derive round
7's answers, so this round asked two questions nobody had asked:

1. **What actually happens on Saturday?** Not "is the code correct" but "is the
   *deploy* correct" — as an ordered procedure, with its failure modes, its
   irreversible steps and its rollback. Four of the eight findings came from
   reading the deploy instructions as a runbook rather than as reference.
2. **Is what the site *says* true?** Certification claims, retention promises,
   and what the privacy policy tells a visitor is collected — checked against
   what the code actually stores. Three more findings came from there, and they
   are the ones with commercial and legal weight rather than technical weight.

Neither lens touches React or PHP correctness, which is the point: that surface
has been audited seven times and is green.

---

## 1. The inherited state

Run **first**, before anything was read for findings.

```
php _harness/lint.php     php -l 19/0 · node --check 10/0 · JSON 17/10/42
                          all drift checks green
npm run build             0 errors, 375.66 kB JS / 23.59 kB CSS
invariants                17/17        invariants-selftest   15/15
full sweep (79 suites)    green except the two documented expected-reds
                          plan8-polish 16/17 · brandtext 36/47 (11 failing, ceiling 13)
                          plan8-contrast 34/35 is its documented PASSING state
audit7 30/30 · audit7-lead 23/23 · audit6 45/45
audit5-blockers 18/18 · audit5-high 30/30 · audit5-medium 20/20
```

Nothing below is a regression.

---

## 2. Findings

### A-8.5 — HIGH — the site advertises two *different withdrawn* revisions of its ISO certification, in six places, on two admin screens

This is the one that would embarrass the business on launch day, and it is not a
code defect.

`src/App.jsx`'s A2 comment settled the hardcoded defaults correctly and said the
rest out loud:

> The 2008 revision was withdrawn in September 2018 and the site claimed it in
> three places; site-info.json says only "ISO 9001", so the version was typed
> into the copy by hand. Writing ":2015" because it is the current standard
> would invent a certification claim for a supplier to aerospace, medical and
> automotive. **The live strings are owner-editable in Page Content** and are on
> the owner action list pending confirmation from the registrar.

That reasoning is right. Two things in it were **incomplete**, and both matter:

**It is not three places, it is six — and not one withdrawn revision, but two.**
Measured by `_harness/isoclaims.js` over the live data:

```
ISO 9001 claims in the live data: 14

  (no revision — the honest form)    8
  2000                               3     ← superseded November 2008
  2008                               3     ← withdrawn September 2018
```

**Three of the six are not in Page Content.** They are on the `VALUE-ADDED`
product, edited under *Products → Edit*:

| File | Path | Screen |
|---|---|---|
| `data/content.json` | `features.5.description` | Admin → Page Content |
| `data/content.json` | `certs.0.title` | Admin → Page Content |
| `data/content.json` | `heroTrust.0.text` | Admin → Page Content |
| `data/products-all.json` | `40.specTable1.rows.3.value` — *"Quality Standard: ISO9001:2000"* | Admin → **Products → Edit → VALUE-ADDED** |
| `data/products-all.json` | `40.specificationsSummary` | Admin → **Products → Edit → VALUE-ADDED** |
| `data/products-all.json` | `40.description.0` | Admin → **Products → Edit → VALUE-ADDED** |

Every prior audit's owner-action line reads *"resolve the four contradictory ISO
9001 claims"* and every prior description says "three places" and "Page
Content". **No audit before this one has named the `ISO9001:2000` strings at
all.** An owner following the action list to the letter fixes Page Content and
ships a live product page still claiming a revision withdrawn in 2008.

Why it is High rather than cosmetic: buyers in aerospace, medical, automotive
and defence supply chains check certification claims as part of supplier
qualification. A claim to a withdrawn revision is at best a disqualifier and at
worst reads as a false statement of conformity.

**Not fixed, deliberately.** Writing `:2015` would invent a certification. What
is shipped instead is `_harness/isoclaims.js`, which fails while any withdrawn
revision is present, names each string and the screen it is edited on, and goes
green the moment the owner resolves it. It also asserts `site-info.json` still
holds the bare, unversioned `ISO 9001` — that field reaches every page, so a
revision typed there would propagate everywhere at once.

### A-8.1 — HIGH — `README.md` documents the opposite of what ships, on a support-facing claim, and has done for two releases

`README.md:213-218` said:

> `SiteInfoProvider` and `ContentProvider` fetch once with `[]` deps and do not
> — business details and page content need a reload. *(measured, none of them
> did — AUDIT_v3 §3.1 / D11.)*

Both call `useRefetchOnReturn()` — `src/App.jsx:6628` and `:7164`. **A-5.14 added
that on 2026-08-18** precisely so they would re-check.

The paragraph has now described the opposite of the truth **twice**: it first
claimed all three expired after 60 s when none did (corrected by AUDIT_v3 §3.1),
was corrected to "only the catalog refreshes", and A-5.14 then made *that* false
without the correction being re-corrected.

It matters because the admin promises the owner *"the website will reflect the
changes within ~60 seconds"* on three separate screens, and this is the file a
developer opens when Rick reports it did not. It sends them to chase a bug that
was fixed a release ago — or to "fix" it a second time, on top of the existing
recheck.

**Fixed.** The paragraph now describes what ships, and carries its own history so
the next reader can see it has been wrong in both directions.

### A-8.2 — MEDIUM — "Subsequent deploys" reopens the exact trap A-6.2 closed

`README.md`'s deploy manifest gained a row and two paragraphs in audit 6 (A-6.2,
a **High**) making the point that `data/.htaccess`, `pdfs/.htaccess` and
`uploads/.htaccess` are repo code inside customer-state folders, that Vite never
copies them into `dist/`, and that they must be uploaded **file, never folder**.

Forty lines further down, the *Subsequent deploys* section — the one a developer
actually reads on deploy day, because it is titled for exactly that — said:

> Do not re-upload `data/`, `pdfs/`, `uploads/`, or `admin/` unless you intend to
> change the admin code itself.

with no exception. A reader who lands there follows a rule that drops the
`AddType application/json` line `jsonOrThrow()` requires and the
`X-Robots-Tag: noindex` half of the A-5.2 fix. Same trap, same file, different
paragraph.

**Fixed.**

### A-8.3 — MEDIUM — the upload order that removes the blank-page window is known to the code and was absent from the instructions

`public/.htaccess` already reasons about this window, in its own comment:

> a stale URL, or an FTP deploy that has uploaded the new `index.html` but not
> yet the new bundle. Answering it with `index.html` means a 200 and
> `Content-Type: text/html` where the browser expects JavaScript, which it then
> tries to execute: **a blank page and a console error, silently, for the length
> of the upload window.**

The `.htaccess` rule makes that failure *honest* (a 404 rather than HTML served
as JavaScript). It does not remove the window. **Uploading `assets/` before
`index.html` removes it entirely** — Vite content-hashes the bundle, so the new
file lands beside the old one with nothing pointing at it, the site keeps
serving the old pair throughout, and overwriting `index.html` is then a single
switch to a bundle already on disk.

`README.md` gave no order at all. Neither did any other document.

**Fixed**, in `README.md` and as step B2 of the new runbook.

### A-8.4 — MEDIUM — no rollback for a bad frontend deploy is documented anywhere

`data/` has a rollback: Admin → Backups, 90 versions per file, and the restore
is itself backed up. The **frontend** had none written down — and it is simpler
than the data one: because assets are content-hashed, the previous
`assets/index-<hash>.js` and `.css` are still on the server, so re-uploading the
**previous `index.html`** is the entire rollback.

Nothing said so, so the actual recovery on a bad Saturday deploy would have been
"rebuild from a git checkout and re-upload everything" — slower, and it requires
a working toolchain at the moment you least want to need one.

**Fixed**, in `README.md` and in the runbook.

### A-8.6 — MEDIUM — round 7 walked into a trap that nothing prevents recurring

A-7.1 added logging to `contact.php`'s two 422 exits, which created two new
inquiry types. `admin/inquiries.php`'s `$REJECTED` map is what tells a rejection
apart from a real lead; a type the map does not know is counted as a real
inquiry with `sent = false`, so it lands in `$failed` — the number Rick watches
to decide whether mail is broken. That is **NB10**, the defect `$REJECTED` was
created to fix.

The instance was caught by hand and fixed. **Nothing stopped the next person
repeating it** — and `lint.php` already had the precedent for preventing it:
`audit-action drift` does exactly this job for the `audit_log()` vocabulary,
and exists because that vocabulary drifted the same way (4.34, A-09, A-15).

**Fixed** — a new `inquiry-type drift` check, built to the same shape, asserting
both directions separately because they are not symmetric:

- a type written by `ipc_partial_entry()` but absent from `$REJECTED` → **NB10**,
  a failure;
- a `$REJECTED` key nothing writes → a dead row, reported separately;
- a **real lead type** (`rfq`, `message`) appearing in `$REJECTED` → those leads
  would be hidden behind the rejected filter, so it is asserted absent rather
  than ignored.

Proved it can fail before trusting it. Mutation 1, removing `rfq-incomplete`
from the map — the exact A-7.1 trap:

```
FAIL  inquiry-type drift
      logged by contact.php but missing from $REJECTED: ["rfq-incomplete"]
```

Mutation 2, listing a real lead type as a rejection:

```
FAIL  inquiry-type drift
      in $REJECTED but never written: ["rfq"]
      a REAL lead type is listed as a rejection: ["rfq"]
```

Both files restored byte-identical afterwards, and the restored tree is green.

### A-8.7 — LOW — the privacy policy does not disclose that every submission stores the visitor's IP address

`privacySections` → *Information We Collect* enumerates what the visitor
provides: name, company, email, phone, message. Every stored record also carries
**`ip`**, taken from `REMOTE_ADDR` (`public/contact.php:459, 479, 729, 802`).
Read out of a real stored record in the harness:

```
keys stored: ts, type, name, company, email, phone, part, material,
             quantity, reqDate, special, notes, ip, sent
ip value   : "127.0.0.1"
```

The other undisclosed keys are RFQ form fields, so "the information you provide"
covers them. The IP is the one that is **not** provided — it is collected
automatically, it is stored for rejected submissions as well as accepted ones,
and it is personal data under both GDPR (settled in *Breyer*, CJEU C-582/14) and
CCPA. The policy explicitly invokes both.

**Not fixed:** the text lives in `data/content.json`, which is live customer
state that GUARDRAILS forbids modifying, and it is legal wording. One sentence
in Admin → Page Content → Privacy resolves it.

### A-8.8 — LOW — the stated three-year retention ceiling is not implemented

*Data Retention* promises retention **"not to exceed three (3) years unless
required by applicable law."**

Nothing expires. `contact.php`'s own comment states it: *"Rotated files are never
deleted."* There is no `unlink` of any inquiry file anywhere in `admin/` — zero
occurrences. The log rotates at 16 MB and the rotated files accumulate forever.

**Not fixed**, same reason as A-8.7: either the sentence changes or a deletion
policy gets built, and both are the owner's call. Worth noting the cheap version
is a note in the runbook to prune rotated `inquiries-*.jsonl` annually.

### A-8.9 — LOW — two small copy/data inconsistencies

- **`foundingDate` says January, the About page says July.** The JSON-LD emits
  `${foundedYear}-01-01` (`src/App.jsx:7186`) while the About copy says
  *"incorporated on July 1, 1974"*. `site-info.json` carries only a year, so
  Jan 1 is a reasonable convention for a year-only value — recorded rather than
  changed, because fixing it properly means a new owner-editable field.
- **"Celebrating 50 years"** (`content.json` `milestones`, and the matching
  default) is 52 as of 2026. The footer's copyright is derived
  (`© {foundedYear}–{new Date().getFullYear()}`); this number is typed by hand
  and will keep aging. Owner-editable in Page Content; some businesses keep
  "50+" deliberately, so it is a decision rather than a defect.

---

## 3. Shipped

| ID | File | What changed |
|---|---|---|
| **A-8.1** | `README.md` | The refetch paragraph now describes what ships, and carries its own two-corrections history. |
| **A-8.2** | `README.md` | *Subsequent deploys* carries the three-`.htaccess` exception, not just the manifest table. |
| **A-8.3** | `README.md`, `GO-LIVE.md` | `assets/` before `index.html`, with the reason. |
| **A-8.4** | `README.md`, `GO-LIVE.md` | Re-upload the previous `index.html`; that one file is the whole frontend rollback. |
| **A-8.6** | `_harness/lint.php` | `inquiry-type drift`, proved to fail on both mutations. |
| **A-8.5** | `_harness/isoclaims.js` (new) | Fails while any withdrawn ISO revision is in the live data; names each string and its edit screen. **Red on purpose until the owner resolves it.** |
| — | `GO-LIVE.md` (new) | One ordered runbook: what to do this week, the upload sequence, ten minutes of verification, and what to do when something is wrong. |

### `isoclaims` is an expected red, and that is the point

It reports **2/4** today. That is not a regression and not a broken check — it
is the finding, in executable form, and it has a real pass state: it goes green
the moment the six strings are resolved. It is treated exactly as `brandtext`
is: a documented expected-red with its reason recorded here and in
`WHATS_LEFT.md`.

### Why `GO-LIVE.md` exists rather than another README section

The deploy knowledge was spread across `README.md`'s manifest,
`DEPLOY_READINESS_v2.md` §7 (frozen, and stale by a row), `audit-runs/audit7.md`
§5 and `WHATS_LEFT.md` §2j. Every piece was correct; none of them was *the
order*. On deploy day nobody reads four documents and reassembles a sequence.

It starts with a branch nobody had written down: **is this the first deploy or a
re-deploy?** Getting that wrong is destructive in both directions — re-uploading
`data/` onto a live site destroys the owner's edits with no backup, and skipping
it on a first deploy means no catalog. Step 0 settles it with one URL.

`README.md` stays authoritative on *what* to upload; the runbook is the
*sequence*, and it says so.

---

## 4. Checked, no finding

- **Placeholder and stale-marker sweep** over the live data and shipped source:
  no `lorem`, no `TODO`/`FIXME`, no `example.com`, no `yourdomain`, no
  `localhost`. Every "placeholder" hit is a legitimate form-field hint.
- **Origin consistency.** `SITE_ORIGIN`, `sitemap.php`'s `$ORIGIN`,
  `robots.txt`'s `Sitemap:` line, `index.html`'s `og:url` and the JSON-LD
  manufacturer URL all say `https://www.insulationproducts.com`. The code has
  made the apex-vs-`www` decision consistently; what remains is a *server*
  action — the 301 and the certificate — which is in the runbook, not a code
  finding.
- **The admin `.htaccess` blocks the A-7.4 marker.** `.inquiry-log-failed.json`
  matches the existing `.*\.json` deny rule, so it is not web-readable.
- **Cookies.** The privacy policy's cookie section is accurate and, if anything,
  conservative: the public site sets no cookies at all — `sitemap.php` starts no
  session by design, `contact.php` starts none, and only `/admin/` sets
  `IPCADMIN`.
- **Copyright year** is derived, not typed: `© {foundedYear}–{getFullYear()}`.

---

## 5. What is left before Saturday

The runbook is `GO-LIVE.md`. The three things that need a person other than the
developer, and therefore cannot be done on the day:

1. **Resolve the ISO 9001 revisions** — `node _harness/isoclaims.js` for the
   list. Needs the registrar.
2. **Rotate the admin password** — a working hash is in this public repo's
   history.
3. **Confirm `noreply@insulationproducts.com` exists**, and publish SPF (DKIM
   and DMARC if the host offers them). Without it the quote notifications land
   in spam, which is indistinguishable from a broken form.

Then the server-side decisions: the apex→`www` 301 with a certificate covering
both, an uptime monitor, and Search Console after launch.

And the two policy sentences from A-8.7 and A-8.8 — a five-minute edit in Admin
→ Page Content, whenever the owner has decided the wording.
