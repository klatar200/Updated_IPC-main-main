# Live-host triage — 2026-09-15

What is actually running at `insulationproducts.com` today, measured. Written
because audit 9's STEP 0 (`audit9.md` §1.5) answered *"is **this project**
live?"* — correctly, **no** — and in doing so never asked *"is **anything**
live, and what is it?"* The answer to the second question is yes, it is broken
for real visitors, and it occupies the directory the first deploy has to land
in.

**Method.** Read-only `GET`/`HEAD` over plain HTTP from the audit container,
2026-09-15 18:21–18:44 UTC. No `POST`, no `contact.php`, no `/admin/` sign-in
(PLAN-11 §10.3 rule 1). HTTPS is unusable from here — the host presents an
expired `CN=*.hostingplatform.com` certificate (audit 9 §1.5, `A-9.P5a-1`) and
`curl` will not verify it — so every line below is `http://`. Every request
made is listed in §9. Captured bytes: `_harness/out/claims/live/` (not
committed).

---

## 1. Verdict

There is a live website. It is **not a build of this repository** — it is a
predecessor of it, uploaded on **2026-09-04 16:03–16:05 UTC** into
`public_html/site/`, with its catalog JSON edited at **18:08** the same day.
The whole domain funnels into it: `http://www.insulationproducts.com/` answers
`302 → /site/`.

In that live site, **every product photograph and every datasheet is a 404**
(37 photos + 42 PDFs + 1 secondary PDF = 80 broken links across 42 of 42
products), and **every URL except the homepage is a 404** — including all seven
non-home URLs the site's own `sitemap.xml` hands to Google.

Nothing on the server is content the repository does not already have,
byte-for-byte (§6). A clean deploy therefore destroys nothing — but it will not
be *seen* until the `302` is removed (§8).

---

## 2. What is live

| URL (`http://www.insulationproducts.com`) | Status | Size | Last-Modified |
|---|---|---|---|
| `/` | **302 → `/site/`** | 263b | — |
| `/site/` | 200 `text/html` | 4,148b | 2026-09-04 16:03:24 |
| `/site/assets/index-DGU_uWZM.js` | 200 | 308,239b | 2026-09-04 16:04:51 |
| `/site/assets/index-C3LNs3wI.css` | 200 | 19,553b | — |
| `/site/favicon.svg` | 200 | 2,721b | — |
| `/site/manifest.json` | 200 | 509b | — |
| `/site/data/products-all.json` | 200 | 240,352b, 42 records | **2026-09-04 18:08:23** |
| `/site/data/site-info.json` | **404** | — | — |
| `/site/data/content.json` | **404** | — | — |
| `/site/sitemap.xml` | 200 `application/xml` | 1,236b | 2026-09-04 16:03:24 |
| `/site/images/products/IP12GA.jpg` | 200 `image/jpeg` | 8,541b | 2026-09-04 16:03:44 |
| `/site/pdfs/VALUE-ADDED.pdf` | 200 `application/pdf` | 529,271b | — |
| `/site/products` | **404** (host's stock error page) | 693b | — |
| `/site/contact` | **404** | 693b | — |
| `/products` | **404** | 693b | — |
| `/data/products-all.json` | **404** | 693b | — |
| `/site/admin/` | 302 — **not followed** (§10.3 rule 1) | — | — |

The two missing `data/*.json` are not a live defect: the live bundle never
fetches them (§5). They are listed because their absence is what makes the
deployed tree datable.

---

## 3. The defects, as a visitor meets them

### L-1 — Blocker — every product photograph is broken

37 of 42 products carry a real photo; all 37 `photoUrl` values on the server
have the literal string `site` prepended, without a slash:

```
CC.photoUrl    = "sitesitesitesitesite/images/products/CC.jpg"
CC90.photoUrl  = "site/images/products/CC90.jpg"
IP12GA.photoUrl = "site/images/products/IP12GA.jpg"
```

Resolved against the page's base of `/site/`, `site/images/…` is
`/site/site/images/…`. Measured:

| URL | Result |
|---|---|
| `/site/site/images/products/CC90.jpg` | **404** |
| `/site/images/products/CC90.jpg` | 200, 16,034b |

The remaining 5 of 42 are `https://placehold.co/…` grey placeholders
(`IP12GA-IP1274`, `IP13SP`, `IP25PU`, `IP30UV`, `IP47HV` — the same five
`A-9.P4-8` names). Those still render, because they are served by a third
party. **So the catalog shows five grey placeholders and thirty-seven broken
images, and the only pictures on the page are the placeholders.**

### L-2 — Blocker — every datasheet is broken

42 of 42 `pdfUrl` values and the one `additionalPdfs[0].url` carry the same
prefix. Measured:

| URL | Result |
|---|---|
| `/site/sitesite/pdfs/CC90.pdf` | **404** |
| `/site/pdfs/CC90.pdf` | 200, 55,923b |

"Request a datasheet" is the site's second conversion path after the quote
form. All 42 are dead.

### L-3 — Blocker — every page except the homepage 404s on load

The live app pushes **root-absolute** paths (`Pl(e) = !e||e==="home" ? "/" :
"/"+e`, minified bundle). So in-session clicking works, but the URL becomes
`https://www.insulationproducts.com/products` — and:

- `/products` → **404** (host's stock error page, not the app)
- `/site/products` → **404** — the SPA rewrite is not in force under `/site/`
  either

Consequences, all measured rather than inferred from the 404s above:

- **refresh, bookmark, back-into-a-tab, paste-a-link → 404.**
- `/site/sitemap.xml` lists 8 URLs, all root-absolute:
  `/`, `/products`, `/dashboard`, `/industries`, `/services`, `/about`, `/faq`,
  `/contact`. **Seven of the eight 404; the eighth 302s.** That file is what a
  crawler is being handed.

### L-4 — Medium — filename case on the server is not the repo's

Server: `IP12GA.jpg`, `IP52EC.png`, `IP63ES.jpg`, `VALUE-ADDED.png`,
`VALUE-ADDED.pdf`. Repo: `ip12ga.jpg`, `ip52ec.png`, `ip63es.jpg`,
`value-added.png`, `Value-Added.pdf`. The files are byte-identical (§6); only
the names differ. Recorded because Apache is case-sensitive and a partial
upload — new `data/` over old `images/`, or the reverse — breaks these five and
nothing else, which is the hardest kind of breakage to notice. A whole-tree
deploy from the repo is internally consistent and is not exposed to this.

---

## 4. How the paths were corrupted — a find-and-replace, run twice on one of them

The repeat counts are not random. Measured across all 42 records:

| Field | ×1 | ×2 | ×3 | ×5 |
|---|---|---|---|---|
| `photoUrl` | **36** | — | — | 1 (`CC`) |
| `pdfUrl` | — | **41** | 1 (`CC`) | — |
| `additionalPdfs[0].url` | — | **1** | — | — |

Uniform, per field. That is the signature of a textual replace over the whole
file — `"/images/" → "site/images/"` run **once**, `"/pdfs/" → "site/pdfs/"`
run **twice** — plus `CC` fiddled with by hand four more times on the photo and
once more on the PDF, which is what the first product in the list looks like
after someone tests a change on it.

Each run compounds because the replacement contains the needle:
`site/pdfs/x.pdf` still contains `/pdfs/`, so replacing again yields
`sitesite/pdfs/x.pdf` — which is exactly what is on the server, rather than
`site/site/pdfs/`.

**The intended edit was almost certainly `/site/images/` and `/site/pdfs/` —
with the leading slash.** That single missing character is the whole of L-1 and
L-2. It is a hand edit of a JSON file on the server, not anything the admin's
Products → Edit screen can produce, and not a defect in this repository's code.

`data/products-all.json` at the audit base (`2121597`) vs the live copy: **80
leaf differences, every one of them this prefix** (75 prefix-only; 5 also
differ by filename case, §L-4). There are **no other differences** — no owner
edit to a name, a spec, a badge or a description exists on the server that the
repo does not have. (Against `main` today the count is 110: the same 80, plus
the 30 string corrections audit 9 made on 2026-09-15.)

---

## 5. The live tree is not a build of this repository

| Evidence | Live bundle | This repo |
|---|---|---|
| catalog fetch URL | `"/site/data/products-all.json"`, hardcoded | `/data/products-all.json`; the string `/site/data/` appears **nowhere in this repo's history** (`git log --all -S`) |
| `site-info.json` / `content.json` fetch | **absent** | present since the first commit |
| `SiteInfoProvider` | 0 occurrences | 6, in the first commit (2026-08-09) |
| `ErrorBoundary` | 0 occurrences | 5, in the first commit |
| `.ipc-container` | 0 occurrences | invariant 13 |
| asset URLs in `index.html` | `./assets/…` (`base: './'`) | `/assets/…` — `base: '/'` since PLAN-8 A5 |
| `og:image` | a `TODO` comment, no tag | present since audit-8 A4 |
| sitemap | a **static** `sitemap.xml` | deliberately none — `sitemap.php` + rewrite |
| bundle name | `index-DGU_uWZM.js` | the only `dist/` ever tracked was `index-DReuYoLm.js` (removed in `3ce7350`, "the committed bundle was a pre-PLAN-8 deploy trap") |

So the deployed app predates this repository's first commit in every feature
that can be checked, while its files were uploaded on 2026-09-04. It is the
generation of the site this project was built to replace — the one whose
`DEPLOY_READINESS_v2.md` §7 still lists a `sitemap.xml`.

**Audit 9's STEP 0 verdict stands.** This project is not live; the runbook is
on branch **B, first deploy**; `data/`, `pdfs/` and `uploads/` in the repo are
not yet live customer state, so the file edits audit 9 made to
`data/products-all.json` were legitimate and remain so. What STEP 0 missed is
that `public_html/site/` is **occupied**, and that the root redirects into it.

---

## 6. Nothing on the server is content the repo lacks

The five SKU-cased files are the repo's own files under a different name:

```
5222183b50a2ffcb39b58268438a191b  live /site/images/products/IP12GA.jpg
5222183b50a2ffcb39b58268438a191b  repo public/images/products/ip12ga.jpg
0e251b737ab5b530852cd95f789e5855  live /site/pdfs/VALUE-ADDED.pdf
0e251b737ab5b530852cd95f789e5855  repo pdfs/Value-Added.pdf
```

Byte-identical. Combined with §4 — the catalog differs only by the corruption —
**the live tree holds no owner-authored content.** `/site/admin/` was not
signed into (§10.3), so `inquiries.jsonl` on that server is
**[NOT-MEASURED]**: if the predecessor's contact form has been collecting quote
requests, that log is the one thing on the host worth retrieving before
anything is replaced. That is an owner action and it is listed in §8.

---

## 7. What this corrects

Self-corrections, mine, from the first pass over this evidence on 2026-09-15
before the measurements in §5 and §6 existed:

1. **"The runbook branch is A (re-deploy), not B" — wrong, retracted.** The
   live site is not this project. Branch **B** is correct. §5.
2. **"My justification for editing `data/products-all.json` as a file is void"
   — wrong, retracted.** It rests on this project's `data/` never having been
   deployed, which §5 confirms. The 30 audit-9 string edits stand.
3. **"`A-9.P5a-1`'s *gates deploy* framing is wrong because deploy already
   happened" — wrong, retracted.** This project's deploy has not happened, and
   the expired certificate still gates it.
4. **"79 corrupted fields" — 80.** The first count dropped one field whose
   filename case also changed.

And one against audit 9 itself, which is not a retraction but an addition:
**`audit9.md` §1.5 recorded the `302 → /site/` and drew no conclusion from
it.** It is in the verbatim record as a deviation from the runbook's expected
`301 → https`. Following it was one request and it was not made. The cost was
that every record reasoning from "the site is not live" was right about this
project and blind to the predecessor still serving customers.

---

## 8. Remediation

### The decision Keagan owns, and it blocks the order below

> **DECIDED 2026-09-15 (Keagan): the web root.** The recommendation below was
> taken. `/site/` is closed. Step 2 of the order is therefore live, not
> conditional, and no code change follows.

**Should the site be at the web root, or stay under `/site/`?**

- **Recommended: the web root.** Everything in this project says root —
  `SITE_ORIGIN`, `sitemap.php`'s `$ORIGIN`, `robots.txt`, `index.html`'s
  `og:url`, `base: '/'`, and the pathname routing shim. So does the *live*
  site's own `og:url` and its JSON-LD `url`, and so does its `sitemap.xml`,
  which lists root URLs: whoever deployed it in 2026-09-04 also intended root
  and the subfolder is an accident of how it was uploaded. Cost: the `302` at
  the root has to be removed, which is a host/control-panel action, and
  whatever created it has to be found first.
- Under `/site/`: needs `base` changed, a router basename, `SITE_ORIGIN` and
  `$ORIGIN` changed, and every canonical/OG/sitemap URL re-derived — a code
  change to ship a worse URL. **Honest downside of the recommendation:** if the
  `302` turns out to be set somewhere Keagan cannot reach in the Network
  Solutions panel, this route stalls at a support ticket, and `/site/` would
  have been shippable today.

**Failure mode of the recommendation:** deploy into `public_html/` with the
`302` still in place and the new site is live, correct, and invisible —
every visitor is still bounced into `/site/` and the old broken one. The
redirect must come out in the same session as the deploy, not after it.

### Order, once that is answered

1. **[owner, before anything] Retrieve `/site/admin/inquiries.jsonl`** from the
   server, or confirm the predecessor's contact form was never wired to one.
   It is the only file on the host that could hold data the repo cannot
   reproduce (§6), and it is `[NOT-MEASURED]` from here.
2. **[owner] Find and remove the `/` → `/site/` 302** (control panel, or a
   root `.htaccess` above `public_html/`). Confirm `http://…/` no longer
   redirects *before* uploading.
3. **[owner] The certificate.** `A-9.P5a-1` / `GO-LIVE.md` §A already gate the
   deploy on this and it is unchanged: the host must issue for both
   `insulationproducts.com` and `www.`, and plain HTTP must end at
   `301 → https://www.…`.
4. **[owner] Deploy per `GO-LIVE.md`, branch B**, into `public_html/`. The
   `.htaccess` rewrite is load-bearing — L-3 is what a deploy without it looks
   like.
5. **[owner] Delete `public_html/site/`** once step 4 is verified, not before.
   Leaving it costs nothing but leaves a second, broken copy of the catalog
   reachable and indexable.

**Nothing here is a code change.** No fix in this repository addresses L-1, L-2
or L-3: all three are properties of a deployment this repository did not
produce, and all three cease to exist the moment branch B lands.

---

## 9. Every request made

`http://www.insulationproducts.com` + each of:

```
/                                       /site/
/site/data/products-all.json            /site/data/site-info.json
/site/data/content.json                 /site/admin/            (headers only, not followed)
/site/sitemap.xml                       /site/favicon.svg
/site/manifest.json                     /site/assets/index-DGU_uWZM.js
/site/assets/index-C3LNs3wI.css         /site/products
/site/contact                           /products
/data/products-all.json                 /site/images/products/CC90.jpg
/site/site/images/products/CC90.jpg     /site/pdfs/CC90.pdf
/site/sitesite/pdfs/CC90.pdf            /site/images/products/ip12ga.jpg
/site/images/products/IP12GA.jpg        /site/pdfs/Value-Added.pdf
/site/pdfs/VALUE-ADDED.pdf
```

All `GET` or `HEAD`. No form submitted, no credential sent, no page under
`/site/admin/` opened.
