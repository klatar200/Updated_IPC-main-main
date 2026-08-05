# IPC — Deployment Readiness Audit v2 (deep pass)

**AS-OF:** 2026-08-04 · **Commit:** `68d87e5`, working tree clean · **Supersedes:** `DEPLOY_READINESS.md` (v1)
**Verdict:** **Do not upload.** v1 found 4 blockers from static reading. This pass stood the whole thing up — Apache-equivalent server, real PHP, real Chromium — and drove it as both a visitor and the business owner. **14 blockers, 11 of them reproduced live.** Three are not "bugs" so much as the release not doing the thing it is being shipped to do: the owner cannot change his password, cannot delete content, and cannot trust the Save button.

---

## 0. Method — what "verified" means in this document

I built `public_html/` exactly as it would exist on the server (dist output + images + admin + data + pdfs + uploads), served it under PHP 8.4 with a router that reproduces the `.htaccess` SPA rewrite, and drove it with Chromium.

| Pass | Coverage |
|---|---|
| Static A | `src/App.jsx` read in full, in three ranges (1–2910, 2900–5700, 5700–8494) |
| Static B | All 15 admin PHP files read in full, twice, by independent auditors with different lenses (injection/auth, then data-integrity/owner-error) |
| Static C | All 7 admin JS files read in full; all 10 repo `.md` files fact-checked line-by-line against the code |
| Runtime A | 9 public pages × 2 viewports (1440×900, 375×812): console errors, network 4xx, overflow, headings, labels, broken images, JSON-LD |
| Runtime B | 8 targeted browser experiments (fetch failure, slow load, forced crash, history, keyboard, touch, sticky bar, form errors) |
| Runtime C | Admin end-to-end: login → walk all 9 pages → edit → save → 7-save backup rotation → delete content → password change → oversize upload → session expiry → two-tab conflict |
| Runtime D | 7 curl/PHP probes: password rotation, upload limits, contact sanitisation, header injection, referer gate |

Everything below marked **PROVEN** has a reproduction in this session. Everything marked **READ** is from source inspection only. I say which.

**Reproduction environment note:** the sandbox PHP had stock defaults (`post_max_size=8M`, `upload_max_filesize=2M`, `max_input_vars=1000`). These are PHP's shipped defaults and the most likely values on Network Solutions shared hosting, but they are not measured on the target — confirm with a `phpinfo()` before trusting the numbers in §3.7.

---

## 1. TIER 1 — The owner cannot actually run the site

This is the tier that matters, because autonomy is the entire premise of the release.

### T1.1 — The admin password in the repo is the one printed in four committed docs, and the handoff email has a different, wrong one. **PROVEN.**

```
admin/config.local.php  (ships, overrides everything)   cost=$2y$10$
  password_verify('ipc-admin-2025', …)  =>  *** TRUE ***
```

`ipc-admin-2025` appears in plaintext in `README.md:121`, `PRE_LAUNCH_FINDINGS.md:83`, `AUDIT.md:39` and `:42`, and `IMPLEMENTATION_PLAN.md:49`. The repo is `github.com/klatar200/Updated_IPC-main-main`.

So the rotation that four separate documents assert was completed **was never done** — `config.local.php` just re-encodes the published default at a *weaker* cost factor (10, while every other hash in the codebase uses 12). `PRE_LAUNCH_FINDINGS.md:83` is the clearest tell: *"the shipped default (`ipc-admin-2025`) must be overridden by deploying `admin/config.local.php` (already generated)"* — the generated override **is** the shipped default.

And `Email to Rick - Admin Dashboard Handoff.md:20` says:

> `- Password: ipc-admin-2026`

`password_verify('ipc-admin-2026', …)` is **false** against every hash in the tree. Rick follows the email, cannot log in, and calls you on day one.

Separately: `_localsite/admin/config.local.php` — a *different* hash, cost 12 — **is tracked in git** (committed in `169c0d7`). `_localsite/` mirrors the currently-deployed site, so that is most likely the live production password, sitting in the repository.

### T1.2 — The "change your password" page cannot change the password. **PROVEN end-to-end in the running admin.**

`admin/password.php:56-69` builds the new `define(...)` line and passes it as the **replacement** argument to `preg_replace`, where `$2` and `$12` are backreference syntax. Every bcrypt hash begins `$2y$12$`.

Driven in the browser with a valid current password and a valid new one, the page returns:

> ⚠ **"Verification of the written file failed — the previous password was restored. Nothing changed."**

Then verified by logging in fresh:

```
old password still works : YES
new password works       : NO
config.local.php hash    : unchanged
side effect              : a config.local.php.bak.20260804-190512 left on disk per attempt
```

This branch runs whenever `config.local.php` exists — i.e. always, in the documented production setup. The flagship self-service feature of this release is 0% functional.

**Fix:** `preg_replace_callback(..., fn() => $defineLine, ...)`, or `addcslashes($defineLine, '\\$')`.

### T1.3 — The documented lockout recovery locks him out permanently. **PROVEN.**

`admin/config.php:52` is the PHP-manual example hash for the string `password`, with the cost field hand-edited `10` → `12`. Changing the cost digit without recomputing the digest makes it unsatisfiable:

```
verify('password', shipped $2y$12$92IX…) = false      ← every input fails
verify('password', same digest as $2y$10$) = true     ← proves the origin
```

`password.php:15-16`, `:111`, `:177` and the on-screen warning all tell him: *"recovery means deleting `admin/config.local.php` on the server via FTP, which resets to the original password."* It does not. It leaves an admin no password can open.

Do **not** "fix" the `12` back to `10` — that makes the site's fallback password literally `password`.

### T1.4 — He cannot delete content. Deletions silently reappear, after a success message. **PROVEN end-to-end.**

Driven in the real admin: opened Page Content, clicked ✕ on all 8 Footer Quick Links, clicked Save.

```
admin says      : "✅ Content saved. The website will reflect the changes within ~60 seconds."
data/content.json: "footerLinks": []          ← saved correctly
public site shows: Product Catalog · About IPC · Product Index · Resources / FAQ ·
                   Industries · Contact · Services · Privacy Policy   ← all 8, still there
```

Root cause `src/App.jsx:4582`:
```js
out[k] = Array.isArray(v) && v.length ? v : dv;   // [] is treated as "unset" → seed defaults
```

An empty array means "he deleted everything", not "the key is missing". This applies to **every** repeatable section: FAQ entries, certifications, milestones, privacy sections, services, industries, footer links, nav items. The most consequential is `privacySections` — stale legal text silently republishing itself.

From his side this reads as "the dashboard is broken." He will delete, save, reload, delete again, save again — and each attempt burns a backup rotation (T1.6).

**Fix:** distinguish an absent key from an explicitly empty array.

### T1.5 — Advanced-mode spec-table edits are discarded, and the page says "saved successfully". **PROVEN.**

`spectable-editor.js:493` writes the Advanced textarea straight to the hidden field but never updates the closure variables `groups`/`rows`. `:518-519` binds `form.addEventListener("submit", serialize)`, and `serialize()` (`:247`) rebuilds the hidden field **from `groups`/`rows`** — the pre-Advanced state.

Driven live on IP33PO: opened Advanced, replaced the size-chart JSON with a marker, clicked Save.

```
flash message  : "saved successfully"
editPersisted  : false          ← the marker is not in products-all.json
specTable2     : reverted to the pre-edit content
```

Same class of loss on `add.php:35-36`, which `?:`-swallows malformed spec-table JSON — a bug `edit.php:91-120` explicitly fixed and never back-ported, with a code comment that names the exact harm: *"customers thought they had saved a change when they hadn't."*

Also: the "Advanced" control is `<span tabindex="-1">` (confirmed at runtime) — keyboard users cannot open or leave Advanced mode at all.

### T1.6 — The backup safety net is gone after five ordinary saves; a double-click destroys it outright. **PROVEN.**

`config.php:134-144` keeps the 5 most recent backups. But *every* product edit, PDF upload, photo upload/removal, add, delete, **and every restore** calls `save_products()` on the whole catalog. So the window is five *saves*, not five *mistakes*.

Driven live — one bad edit, then six ordinary ones:

```
backups on disk: 5
oldest surviving: "AUDIT ROTATION 0"   (already post-mistake)
original value "Heat Shrinkable Polyolefin Tubing" recoverable: NO
```

And `date('Ymd-His')` has one-second granularity with no collision guard, so two POSTs in the same second (a double-click on Save) make the second request's `@copy` overwrite the first request's backup with the **already-modified** catalog — leaving zero copies of the pre-edit state.

`help.php:191` promises: *"If something ever gets saved incorrectly, this history means it can be recovered."*

`backups.php:139-146` compounds it: the restore page shows only a timestamp and a byte count — no product count, no diff, no preview. Faced with five near-identical timestamps from one afternoon, he restores by guessing, and each guess is itself a save that rotates the window further.

### T1.7 — Business Details silently blanks any field the POST omits, and there is no conflict guard. **PROVEN.**

`settings.php:12-65` rebuilds `site-info.json` from `$_POST` wholesale. Two tabs open on Business Details, driven live:

```
Tab B saves phone 999.999.9999   → phone=999.999.9999, but fax='', foundedYear='', phoneDial=''
Tab A (stale) saves company name → phone back to 630.771.0700, Tab B's change GONE
conflict warning shown           : NONE
```

`edit.php:17-31` has a real optimistic-concurrency signature and it works correctly. `settings.php`, `content.php`, `add.php`, `delete.php`, and both upload handlers have no equivalent.

What blank fields then do to the public site — also driven live:

```
foundedYear = ''  → Privacy page footer: "© –2026 Insulation Products Corporation"
phoneDial   = ''  → EVERY click-to-call link on the homepage becomes href="tel:"  (4 dead links)
fax         = ''  → JSON-LD emits "faxNumber": ""  (invalid structured data)
```

Root cause `src/App.jsx:4297` — `mergeSiteInfo` spreads `""` over the defaults, while `mergeContent` at `:4594` correctly drops blanks. The two mergers disagree.

### T1.8 — Session expiry mid-edit throws away his work behind a raw error page. **PROVEN.**

Filled in Business Details, expired the session, clicked Save:

```
HTTP response body (unstyled, no nav, white page):
  "Invalid CSRF token. Please go back and try again."
any mention of unsaved work: none
```

The cookie is `'lifetime' => 0` with no keepalive, no autosave, no draft, no return-to-page. The long-form fields (About paragraphs, FAQ answers, product descriptions) are exactly the ones he'll take a phone call in the middle of. There is also **no `beforeunload` handler anywhere in `admin/`**, and `nav.php` puts 10 navigation links across the top of every editing page.

---

## 2. TIER 2 — Public-site defects a customer will hit

### T2.1 — A catalog hiccup takes down the entire website, including the phone number. **PROVEN + screenshot.**

`App.jsx:8410-8448` gates `SiteInfoProvider`, `ContentProvider`, `Navbar`, `Footer` and every page behind the products fetch. Blocked that one request and loaded `/contact`:

```
whole page      : "⚠️ Catalog Unavailable — Failed to load product catalog. Please try refreshing. [Retry]"
nav             : absent      footer  : absent      contact form : absent
phone on screen : NO          tel: links : 0        mailto: links : 0
```

Contact, About, Services, Industries, FAQ and Privacy consume no product data at all, yet all become unreachable. There is also **no timeout** on the fetch (`App.jsx:4183`) — an origin that accepts and hangs leaves the site on the loading skeleton forever. And `App.jsx:4190` does `data.products` without a null guard, so a truncated write (`null` body) throws rather than degrading.

For a distributor whose conversion is a phone call, a JSON blip becoming a total revenue outage is the wrong failure mode. Move the providers, Navbar and Footer above the gate and scope the error to the product pages.

### T2.2 — One bad page bricks the whole site until a manual reload. **PROVEN.**

`ErrorBoundary` (`App.jsx:138-171`) has no reset — no `key`, no `componentDidUpdate`, nothing sets `caught` back to false. Forced a throw on one product, then clicked **Home** in the navbar:

```
crashed on the bad product : yes
URL after clicking Home    : http://…/     ← navigation worked
still showing crash screen : YES
```

Every page of the site now shows "Something went wrong" until the visitor thinks to refresh. Fix is `<ErrorBoundary key={page}>`. Note also that `Navbar` and `Footer` sit *outside* the boundary, so a throw in either blanks `document.body` entirely — and both consume owner-edited `companyNav`/`footerLinks`.

### T2.3 — The Back button is trapped on the Product Index. **PROVEN.**

`App.jsx:5971-5979` reads `?family=` then calls `setFamilyParam(null)`, which **pushes** rather than replaces (`App.jsx:46`, `{replace:false}`). Every Back press re-enters the effect and pushes again:

```
load /dashboard?family=Heat Shrink Tubing  →  URL becomes /dashboard
Back  → /dashboard      Back → /dashboard      Back → /dashboard
```

Reached from the Products mega-menu, which is the primary catalog entry point. On mobile, where Back is the main navigation gesture, the visitor is stuck.

### T2.4 — Keyboard users cannot open the product menus at all. **PROVEN.**

`App.jsx:405-406` and `:661-662` bind `onMouseEnter` only — no `onClick`, no `onKeyDown`, no `aria-haspopup`, no `aria-expanded`. Measured header control count as each input method fires:

```
baseline                 6
real mouse hover        18   ✅
touch tap (iPad 1024px) 18   ✅
Enter                    6   ❌
Space                    6   ❌
ArrowDown                6   ❌
```

Touch is fine (synthetic mouseenter). Keyboard is completely locked out of the entire category list and the "Browse All / Product Index" links, and screen readers get no disclosure semantics.

*(v1 correction: I previously implied touch was also broken. It is not — only keyboard.)*

### T2.5 — The RFQ form deletes the part of the message that matters. **PROVEN with exact strings.**

`public/contact.php:118-120` — `htmlspecialchars(strip_tags(trim($val)))` — feeds a `text/plain` email, `inquiries.jsonl`, and then `inquiries.php`, which escapes it **again**. Submitted a realistic quote request:

```
visitor typed : Need tubing <1/4 inch and >2 inch ID, 1/2" wall, qty 500
                O'Brien & Sons
logged/emailed: Need tubing 2 inch ID, 1/2&quot; wall, qty 500
                O&#039;Brien &amp; Sons
admin renders : Brien &amp;amp; Sons        1/2&amp;quot; wall
```

`<1/4 inch and >` is silently eaten by `strip_tags`. This is a company that sells tubing sized in fractions of an inch — the size spec is exactly what gets deleted, the quote goes out wrong, and nothing records that anything was removed. The double-escaping then shows the owner literal `&amp;amp;` garbage in his Inquiries page.

**Fix:** drop `strip_tags` and `htmlspecialchars` from `s()`; strip only CR/LF; let `inquiries.php`'s existing `h()` do the single escape at render.

### T2.6 — Visitors with no `Referer` are rejected, and shown the word "Forbidden". **PROVEN.**

```
POST with Referer    → 200 (proceeds to mail)
POST without Referer → 403 {"ok":false,"error":"Forbidden"}
```

`contact.php:76-82` treats an absent header as a failure. Privacy extensions, `Referrer-Policy: no-referrer`, and corporate TLS proxies all strip it. `App.jsx:3338` then does `alert(json.error || cf.submitError)` — `"Forbidden"` is truthy, so the friendly fallback that contains the phone number is **never reached**. The visitor gets a browser modal saying `Forbidden`, and the lead is never logged either (the 403 exits before `ipc_log_inquiry`).

The check also provides no protection — it is a substring test, so `Referer: https://evil.example/?x=insulationproducts.com` passes.

### T2.7 — The first product a visitor sees has a broken image. **PROVEN + screenshot.**

`data/products-all.json` → `CC.photoUrl = "/images/CC.jpg"`. Every other product uses `/images/products/…`, and the file exists at `public/images/products/CC.jpg`. Runtime scan flagged it as the only broken image on the site.

It matters more than one bad path: `CC` is `products[0]`, which is what `/products` renders by default **and** what every failed SKU lookup falls through to. Clicking "Products" in the nav lands on a broken-image product page.

Compounding it, the SPA rewrite means a missing image returns **HTTP 200 + index.html**, not a 404 — so nothing in the stack can distinguish "missing" from "served". There is no `onError` fallback on the `<img>` (`App.jsx:5466`) even though a branded placeholder branch already exists two lines below.

### T2.8 — One Industries link sends an aerospace buyer to a conduit coupling. **PROVEN by resolving all 18.**

I loaded every `industryDetail[].products[].sku` in `content.json` through the real product page and read back what rendered:

```
17 of 18  → correct product
 1 of 18  → WRONG:
   Aerospace & Defense · "IP37SH - IP36TH - IP39LH" (PTFE/TFE Heat Shrink Tubing)
   renders → "Nonmetallic Liquid-tight Conduit Coupling"   (SKU CC)
```

The catalog SKU is `IP37SH-IP36TH-IP39LH`; `content.json` has spaces around the hyphens. Both `find`s fail and `App.jsx:5670` falls through to `products[0]`.

*(v1/subagent correction: an earlier pass predicted six wrong links. Resolving them live shows exactly one — the other spaced forms happen to match a product's `id` field. That coincidence is itself fragile.)*

The fallback is the real defect. `App.jsx:5663-5671` has **no not-found state**: an unknown `productId` silently shows a different product with the URL unchanged. And the fuzzy pass is dangerously loose — `?productId=CC90S` matches `CC` via `selectedId.includes(p.sku)`, because two-character SKUs `CC` and `CT` exist. For a distributor where the SKU *is* the product, silently substituting a different part is the worst available failure.

### T2.9 — On a phone, "Request a Quote" is cut off the screen. **PROVEN + screenshot.**

At 375 px on `IP52EC` (the one product with two datasheets), the fixed bottom bar measures:

```
Molded Cap        left  24  right 155
Plugged Cap       left 167  right 304
Request a Quote → left 316  right 483   ← viewport is 375 wide; CLIPPED, untappable
```

Because the bar is `position: fixed`, the overflow creates no scrollbar — the button is simply gone. The bar also covers the last 70 px of the footer (copyright, address) on every product page, because the 72 px `paddingBottom` is applied to `ProductPage` inside `<main>` while `<Footer>` is a sibling.

### T2.10 — The loading state is invisible. **PROVEN.**

Throttled the products fetch and measured the skeleton elements:

```
.ipc-skeleton elements : 53
background             : none
background-color       : rgba(0, 0, 0, 0)
animation              : none
<style> with ipc-skeleton injected : false
```

`.ipc-skeleton` is defined **only** inside `GlobalStyles` (`App.jsx:4110-4115`), which renders at `:8483` — *inside* the tree that mounts only after loading finishes. So the skeleton is only ever shown in the exact situation where its styles don't exist. On a slow connection the visitor sees a blank page. Move those rules into `src/index.css`.

---

## 3. TIER 3 — Deploy procedure

### T3.1 — Uploading `dist/` as documented destroys live data. **READ** (unchanged from v1)

`dist/` contains `dist/data/{products-all,site-info,content}.json` and a stale `dist/products-all.json`. `CLAUDE.md:35` warns never to re-upload `data/` — but `dist/data/` is what "upload the contents of dist" puts on top of `public_html/data/`. Delete `dist/data/` and `dist/products-all.json` (neither is build output — they were copied in by hand), and delete `public/products-all.json`, the stale 178 KB source of the latter.

Note `dist/` is also **committed to git** while `.gitignore` ignores only `dist-ssr/` — so a stale build artifact is tracked.

### T3.2 — `uploads/` appears in no deploy instruction. **READ**

`README.md:88-96` and the CLAUDE.md table both list four trees: `dist/`, `admin/`, `pdfs/`, `data/`. `uploads/` is listed nowhere. `upload-image.php:68-70` will `mkdir` it at runtime — creating `public_html/uploads/images/` **without** the `.htaccess` that blocks script execution there. The `mkdir` return is unchecked.

### T3.3 — Nothing says `admin/` must be writable. **READ**

Four things are written into it: `admin-log.jsonl` (`config.php:216`, unchecked), `inquiries.jsonl` (`contact.php:45`, `@`-suppressed), `.login-throttle.json` (`config.php:260`, `@`-suppressed), and `config.local.php`. On any host where the PHP user differs from the FTP user, the audit log stays permanently empty and **every inbound sales lead is silently dropped** — while `inquiries.php:73` promises "no lead is ever lost." `README.md:113-118` sets `admin/` to 755 with no writability note.

### T3.4 — Test data would ship into his dashboard. **READ**

`admin/inquiries.jsonl` contains `"E2E Test Visitor" … "This is a test submission"`; `admin/admin-log.jsonl` and `.login-throttle.json` hold local test state. Gitignored but present in the folder. His first look at Inquiries would show a fake lead.

### T3.5 — Oversize uploads produce two different misleading errors. **PROVEN.**

```
10 MB file (> post_max_size 8M)      → HTTP 403, bare white page:
                                       "Invalid CSRF token. Please go back and try again."
2.6 MB file (> upload_max_filesize 2M) → "Please select a PDF file to upload."
                                       …on a page that simultaneously says "20MB"
```

The first happens because a POST over `post_max_size` arrives with `$_POST` **and** `$_FILES` empty, so `csrf_check()` (called at `upload-pdf.php:20` and `upload-image.php:39`, before `$_FILES` is touched) fails first. The second happens because `upload-pdf.php:51-52` collapses `UPLOAD_ERR_INI_SIZE`, `_PARTIAL`, `_NO_TMP_DIR` and `_CANT_WRITE` into one message that describes none of them. `help.php:479` promises "20MB or smaller"; the 20 MB check at `upload-pdf.php:75` is unreachable for anything PHP already rejected. He re-selects the same file, gets the same message, loops, calls you.

**Fix:** ship a `.user.ini` / `php.ini` raising both limits, and branch on `$_FILES[...]['error']` with real messages. Confirm the host's actual values first.

### T3.6 — Uploading a file for one product can overwrite another product's file. **READ**

`config.php` defines `pdf_in_use()` and `image_in_use()` precisely for this, and the delete/remove paths call them. **The upload paths do not.** `upload-pdf.php:85-95` reuses an existing filename with no in-use check, and the warning it shows — *"⚠ This will replace the existing PDF for this product"* — is untrue when the file belongs to a different product. Also note `edit.php:144-174` renames PDFs on a SKU change but **not** photos, so photo filenames drift out of sync with SKUs and become collision bait.

### T3.7 — `content.php` posts 453 input variables. **PROVEN (count), READ (risk).**

Measured 453 against PHP's default `max_input_vars=1000`. Fine today — but PHP truncates `$_POST` **silently** at the limit, `content.php:386-439` rebuilds `$out` from whatever arrived, and the page still reports "✅ Content saved." Every FAQ entry adds 3 vars and every service adds 7. Add an `ini_set` and a submitted-row-count sanity check before it becomes a data-loss bug.

---

## 4. Everything else worth fixing

| # | Where | Finding | Evidence |
|---|---|---|---|
| 4.1 | `App.jsx:2977-2994` | FAQ JSON-LD `useEffect` has `[]` deps and runs before `content.json` loads → the owner's FAQ edits **never** reach Google's rich results | READ |
| 4.2 | `App.jsx:5272` | Product JSON-LD emits `description` as an **array** (all 42 products have array descriptions) — invalid schema.org, Google drops the node | PROVEN (runtime flagged `Product DESC_IS_ARRAY`) |
| 4.3 | site-wide | **No `rel="canonical"` anywhere**, and `og:url` is hardcoded to the homepage on every page | PROVEN (9/9 pages) |
| 4.4 | `/contact` | All 10 form fields are unlabelled — `<label>` with no `htmlFor`, `<input>` with no `id`. The only correctly-labelled input on the page is the honeypot | PROVEN |
| 4.5 | `App.jsx:3303-3341` | Every form error is a browser `alert()`; no inline error, no `aria-live`, no focus move. Success replaces the page with no announcement | READ |
| 4.6 | `App.jsx:5409` | "Request Quote" on a product page navigates to `/contact` **without the SKU**, so RFQs arrive as "General RFQ" instead of "— IP35KY —". `setSearchParams` already supports it | READ |
| 4.7 | `App.jsx:2533-2535` | About-page `tel:` hrefs hardcoded to `+16307710700/01` while the displayed number is live → change the phone in the admin and it shows the new number but dials the old one | READ |
| 4.8 | `App.jsx:8059`, `2196`, `3370` | Fax is a `tel:` link built from the display string (`tel:630.771.0701`) — a mobile visitor taps "fax" and dials a fax machine | PROVEN |
| 4.9 | `App.jsx:323-343`, `8020-8037` | Navbar and footer brand blocks hardcode the company name, tagline and "ESTABLISHED 1974 · ISO 9001" while `company.name`/`slogan`/`foundedYear`/`certifications.iso` are all editable and used elsewhere → two different company names in one footer after a rename | READ |
| 4.10 | `App.jsx:7830-7834` | Privacy "Last Updated" is `new Date()` — always today, regardless of whether the policy changed | PROVEN (`Last Updated: August 2026`) |
| 4.11 | 4 fields | Editable-but-dead: `catalogPdfUrl`, `certifications.other[]`, `services[].leadTime`, and all 5 `social.*` (JSON-LD `sameAs` only — no social icons exist, though `SITE_INFO_PLAN.md:98` promised them in the footer). The Services page shows a **hardcoded** "Standard Lead Time: ≤ 1 Week" next to the dead `leadTime` field | READ |
| 4.12 | `content.php:111` | Promises "the SKU must match a real product so the link works" — nothing validates it against `load_products()` | READ |
| 4.13 | `content.php:539` | The ✕ that deletes an entire content card has no `data-confirm`, while `confirm.js` guards every other destructive action. It sits 4 px from the ↑/↓ reorder buttons | READ |
| 4.14 | `auth.php:47-53`, `config.php:264-273` | Login throttle uses `sleep()` (parallel connections sleep concurrently) and does a read-modify-write with no lock across the read. `admin/README.md:251` claims "online brute-force is impractical" — not supported | READ |
| 4.15 | `contact.php:275-292` | Auto-reply mails attacker-chosen addresses with attacker-supplied body text, capped only per-IP → email-bomb from the company's domain | READ |
| 4.16 | `contact.php:286` + `settings.php:14` | `company_name` is only `trim()`ed and is interpolated into `From:` → CRLF header injection (verified producing a real `Bcc:`). Post-auth, but it silently BCCs every future auto-reply | READ |
| 4.17 | `contact.php:123` | `trim($_POST['form_type'])` throws `TypeError` on an array → unauthenticated **HTTP 500**, leaking the server path if `display_errors` is on | PROVEN |
| 4.18 | `contact.php:87-90` | A honeypot false positive returns `ok:true` → the visitor sees the full success page and the lead is discarded **with no log entry** | READ |
| 4.19 | `App.jsx:6492-6522` | Product Index sortable headers have no `tabindex`, no `scope`, no `aria-sort` — keyboard users cannot sort, screen readers get no column association on a 7×40 table | READ |
| 4.20 | `App.jsx:2809-2843` | Collapsed FAQ answers use `max-height:0` — still in the accessibility tree and find-in-page. A screen reader reads all ~18 answers continuously | READ |
| 4.21 | `App.jsx` (site-wide) | Navigation is `<button onClick>` throughout. Measured **3–7 `<a href>` vs 14–119 `<button>`** per page — no crawlable internal link graph, no middle-click/Cmd-click, no status-bar preview | PROVEN |
| 4.22 | `admin/.htaccess:36` | CSP `img-src 'self' data:` blocks the 5 `placehold.co` placeholders in admin previews — broken images, no explanation | READ |
| 4.23 | `App.jsx:4716-4740` | Owner-set brand colors are injected as CSS vars with **no contrast guard**, while every page-header `<h1>` and every primary button hardcodes `#ffffff`. Picking a light color makes every heading and CTA unreadable | READ |
| 4.24 | `App.jsx:4247`, `4359` | `SITE_INFO_URL`/`CONTENT_URL` have no `import.meta.env.DEV` branch (unlike `PRODUCTS_JSON_URL`), so `npm run dev` silently runs on defaults — the theming/content plumbing is never exercised locally | READ |
| 4.25 | `App.jsx:4174`/`4210` | `_productsCache` never time-invalidates, so a visitor who leaves the tab open never sees an edit — contradicting the "~60 s" promise in every doc | READ |
| 4.26 | `App.jsx:5630-5641` | Listeners added inside an inline `ref` callback, never removed — two more per re-render, and `ProductPage` re-renders on every scroll-threshold crossing | READ |
| 4.27 | owner-editable keys | Duplicate React keys reachable from the admin: `key={link.label}`, `key={f.title}`, `key={m.year}`, `key={item.page}`, `key={s.label}`, `key={item.question}`, `key={prod.sku}`. Two footer links both named "Contact" → dropped/mis-rendered rows | READ |
| 4.28 | `App.jsx:7639` | `svc.details.map()` unguarded, unlike every sibling (`(ind.useCases \|\| [])`) — throws on a hand-edited or partially-restored `content.json` | READ |
| 4.29 | `App.jsx:5107-5192` | `IP75AD`, `VALUE-ADDED`, `VT-1100` have `rows: []` and render an empty bordered ghost table with invalid `<thead><tr></tr></thead>` | READ |
| 4.30 | `spectable-editor.js` | Every structural change does `host.innerHTML=""`, dropping focus to `<body>`; all remove buttons share `aria-label="Remove row"`; no `aria-live`; inputs have `placeholder` but no accessible name | READ |
| 4.31 | `content.php` | 418 unlabelled form controls | PROVEN |
| 4.32 | `public/images/` | 9.3 MB of unoptimised images: `Front-Cover.jpg` 1.5 MB, `VALUE-ADDED.png` 683 KB, `Marker-Sample-2.jpg` 554 KB, `CC.jpg` 401 KB. `public/.htaccess` also sets `immutable, max-age=31536000` on `/images/` — an FTP'd photo fix won't reach returning visitors for a year | PROVEN |
| 4.33 | `delete.php` | Deleting a product cleans up its PDFs but never its uploaded photo (`image_in_use()` exists and is never called here). The confirmation text mentions only the PDF | READ |
| 4.34 | `audit-log.php:106` | Offers an `import` filter for a feature that does not exist anywhere in the codebase — always returns "No entries match" | READ |

---

## 5. Documentation is actively wrong in ways that will cause harm

Full line-by-line results are long; these are the ones that will bite.

| Document | Statement | Reality |
|---|---|---|
| `Email to Rick…md:20` | "Password: **ipc-admin-2026**" | Wrong. Nothing in the tree verifies it. Also references two attachments not in the repo, and `dashboard-preview.png` renders broken |
| `README.md:153-156` **and** `CLAUDE.md:60` | "Navigation uses query params on the root URL, so there are no deep paths to 404… the `.htaccess` rewrite is a safety net" | **False and dangerous.** `App.jsx:9-17` uses real path segments. `public/.htaccess:18-21` says the opposite: the rule "is essential for any direct navigation or refresh." Acting on the README would delete a load-bearing rule and break every deep link |
| `admin/README.md:124-126` | "The PDF file is **NOT** auto-deleted from `/pdfs/`" | It is (`delete.php:20-45`). The README's manual cleanup step would now delete a file a second product may still reference |
| `admin/README.md:175-186` | Spec Table 2 example uses `"sub": "Min / Max"` (a string) | React requires an array (`App.jsx:5115`), and the editor **truncates every row** when it sees a non-array `sub`. Verified: following the README's own example turns `["3/64","0.046","0.062"]` into `["3/64","0.046"]`. The documentation is the trigger |
| `admin/README.md:199-232` | Documents the `_hash.php` two-step FTP password rotation as the flow | Superseded by `admin/password.php` (which is in the nav — and broken, per T1.2). Never mentioned |
| `admin/README.md:261-266` | "Your password in `config.php` will be preserved as long as you don't overwrite that one file" | Backwards. Overwriting `config.php` is harmless; overwriting `config.local.php` is what destroys it |
| `CLAUDE.md:55` / `admin/README.md:23-25` | "The admin's I/O surface is exactly… No other shared state" | Wrong on five counts: `SITE_INFO_JSON`, `CONTENT_JSON`, `IMG_DIR`, `INQUIRIES_FILE`, `LOGIN_THROTTLE_FILE`, plus `password.php` writing `config.local.php` |
| `CLAUDE.md:59` | "the PHP admin is the only dynamic piece" | `public/contact.php` ships into `dist/`, calls `mail()`, writes `inquiries.jsonl` |
| `README.md:40` | `admin/` contains `import.php` | Does not exist. Neither does the import flow that `PRE_LAUNCH_FINDINGS.md` F1/F5 and its checklist step 4 ask you to make decisions about |
| `README.md:26` / `CLAUDE.md:39` | App.jsx "~3,700" / "~7,900" lines | 8,494 |
| `README.md:74` | bundle "~83 KB gzipped" | 89.9 KB |
| `Editing-Your-Site-Content.md:61,65` | "nothing is ever lost… reach out to your developer, who can restore" | `admin/backups.php` is a self-service restore page in his nav. Also omits Inquiries, Backups and Password from the menu list |
| `IMPLEMENTATION_PLAN.md:416` | "Phase 4 done when `wc -l src/App.jsx` < 200" | 8,494 — up from the 7,682 the plan was written against. But `src/pages/` and `src/components/` are fully populated exactly as specified and **nothing imports them**, so a reader will reasonably conclude Phase 4 landed |
| `PRE_LAUNCH_FINDINGS.md:6` | "No launch-blocking defects. Every core workflow behaves correctly" | Its verification table has no rows for Business Details, Page Content, Inquiries, Backups, password change, or image upload — 6 of the 11 admin pages. It will convince the next reader the admin is verified when half of it isn't |

**Recommend deleting before handoff:** `SITE_INFO_PLAN.md` (executed; its remaining schema is wrong — missing `about` and the entire `theme` block), `MOBILE_AUDIT.md` (every 🔴 is fixed — I re-verified all six — and the summary now misreports the site as broken), `PRE_LAUNCH_FINDINGS.md` (two findings concern a deleted feature; asserts a password rotation that didn't happen). Collapse `AUDIT.md` + `IMPLEMENTATION_PLAN.md` into one short "what's left" list.

---

## 6. Corrections to v1 and to my own intermediate findings

Per your standing rule that an audit names its own failures, not generic caveats:

1. **v1 under-scoped the password problem.** I reported "a live hash is committed" and "the two hashes differ." The actual situation is worse and I should have tested it: the shipping `config.local.php` is the bcrypt of `ipc-admin-2025`, the string printed in four committed docs. The rotation four documents claim was performed was never performed. I had the hash in v1 and did not run it against the documented default.
2. **v1 called the shipped `dist/` "current and correct."** It is current with `src/App.jsx` — that part holds (CSS byte-identical, JS differs only in minifier identifiers). But I did not flag that `dist/` is committed to git while `.gitignore` ignores only `dist-ssr/`, nor that it is missing `.htaccess`/`favicon`/`robots`/`sitemap`/`contact.php`/`images` relative to what `README.md:71` claims it contains.
3. **v1 was entirely static.** Nine of the fourteen blockers in this document are ones static reading did not surface — the backup-rotation exposure, the deletions-reappear behavior, the Advanced-mode discard, the Back-button trap, the invisible skeleton, the sticky-bar clipping, the session-expiry message, the two-tab lost update, and the upload error text. I should have stood the site up the first time.
4. **Intermediate finding retracted — "41 of 42 datasheet PDFs are missing."** A sub-audit reported this from an incomplete sandbox copy. All 42 exist on your machine. Same for "`logo.svg` does not exist" and "`pdfs/marketing/` does not exist" — both present. Staging artifacts, not defects.
5. **Intermediate finding corrected — "six Industries links resolve to the wrong product."** Resolving all 18 in a real browser shows exactly **one** (`IP37SH - IP36TH - IP39LH`). The other spaced SKUs match on a product's `id` field. The over-count came from reasoning about the matcher instead of running it.
6. **Intermediate finding corrected — "mega-menus are broken on touch."** Touch works (measured on a 1024 px tablet context). Only keyboard is locked out.
7. **Apache 2.2 `.htaccess` syntax — downgraded, not a risk.** `_localsite/` proves the identical `Order`/`Deny from all`/`LimitExcept` syntax is already live and working on this host. I flagged it in v1 without checking that.
8. **Not verified, stated as such:** the host's real `post_max_size`/`upload_max_filesize`/`max_input_vars` (§3.5, §3.7 use PHP defaults); whether the GitHub repo is public; whether `mail()` behaves the same on Network Solutions; and whether the owner has edited the catalog on the server since the last deploy (§8).

---

## 7. Upload manifest

`_localsite/` is the currently-deployed site, so this diff is exact.

**New admin files:** `backups.php`, `content.php`, `content-editor.js`, `inquiries.php`, `password.php`, `settings.php`, `settings-preview.js`, `upload-image.php`
**Changed admin files:** `config.php`, `edit.php`, `index.php`, `nav.php`, `help.php`, `.htaccess`
**New data files (first upload only, then owner-owned):** `data/site-info.json`, `data/content.json`
**New directory:** `uploads/` + `uploads/.htaccess` + `uploads/images/` — must be PHP-writable (755/775)

| Upload to `public_html/` | From | When |
|---|---|---|
| `index.html`, `assets/` | `dist/` | every frontend deploy |
| `.htaccess`, `contact.php`, `favicon.svg`, `logo.svg`, `manifest.json`, `robots.txt`, `sitemap.xml` | `public/` | when changed |
| `images/` | `public/images/` | when changed |
| `admin/` | `admin/` | this release |
| `admin/config.local.php` | — | **only after T1.1 is resolved** |
| `data/site-info.json`, `data/content.json` | `data/` | first time only |
| `uploads/.htaccess`, `uploads/images/` | `uploads/` | first time only |
| `pdfs/` | — | already live; do not re-upload |

**Do NOT upload:** `dist/data/`, `dist/products-all.json`, `data/products-all.json` (see §8), `data/*.backup.*.json`, `admin/admin-log.jsonl`, `admin/inquiries.jsonl`, `admin/.login-throttle.json`, `_localsite/`, `node_modules/`, `src/`, `*.zip` (17 MB), `_c.cjs`, `_check.cjs` (0 bytes), `dashboard-preview.png`, `.claude/`, `*.md`, `*.docx`, `package*.json`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js`, and the repo-root `index.html` (that's the Vite *source* shell).

---

## 8. Decisions I need from you

**D1 — What password ships, and how does Rick learn it?**
Recommended: generate a fresh hash at cost 12, deploy it as `config.local.php`, send it to Rick out-of-band (not in the emailed .md), and fix the four docs that print `ipc-admin-2025`.
Failure mode if we don't: he can't log in on day one, and anyone with repo access can.
Blocked: yes — this is a credential decision, not an engineering one.

**D2 — Does `data/products-all.json` from this repo get uploaded?**
Recommended: **no**. Download the server's copy first, diff it, merge only if the repo copy is genuinely ahead.
Why: the repo copy (239 KB) is larger than what's deployed (`_localsite/`, 178 KB) so it *looks* newer, but `data/` has been server-owned since the last deploy. Any product Rick edited since is destroyed with no undo — an FTP overwrite creates no backup.
Trade-off: if he's made no edits, you spent 10 minutes diffing for nothing. If he has, there is no recovery.
Blocked: yes — irreversible.

**D3 — Is `github.com/klatar200/Updated_IPC-main-main` public?**
If yes, `_localsite/admin/config.local.php` (committed in `169c0d7`) has exposed a live admin hash, and the git history needs treating as compromised regardless of what we do next.

---

## 9. Fix order

**Before Rick ever sees it — T1 (roughly a day):**

1. T1.1 password: fresh cost-12 hash, `git rm --cached _localsite/admin/config.local.php`, add `_localsite/` and `dist/` to `.gitignore`, purge `ipc-admin-2025` from all four docs, fix the handoff email.
2. T1.2 `preg_replace_callback` in `password.php` — one line.
3. T1.3 real fallback hash + correct the four recovery strings.
4. T1.4 `mergeContent` — distinguish absent from empty. This is what makes the whole Page Content feature trustworthy.
5. T1.5 `spectable-editor.js:493` update `groups`/`rows` on Advanced input; port `edit.php`'s JSON validation to `add.php`; repopulate `add.php`'s spec textareas from `$_POST`.
6. T1.6 raise the backup keep-count (20+), add a per-second collision suffix, show product counts on `backups.php`.
7. T1.7 add `edit.php`'s concurrency signature to `settings.php` and `content.php`; drop blank strings in `mergeSiteInfo`.
8. T1.8 `beforeunload` guard + a "your session expired, your changes are still in the form" path instead of the raw CSRF die.

**Before customers see it — T2 (roughly a day):**

9. T2.1 move providers/Navbar/Footer above the loading and error gates; add a fetch timeout; null-guard `data.products`.
10. T2.2 `<ErrorBoundary key={page}>`.
11. T2.3 `{replace:true}` on the `?family=` cleanup.
12. T2.5/T2.6 rewrite `contact.php`'s `s()`; allow a missing `Referer`; `is_string()` guards; CRLF-strip `company_name`.
13. T2.7 fix `CC.photoUrl`; add `onError` to the product `<img>`.
14. T2.8 fix the one `content.json` SKU; add a real "part not found" state; anchor the fuzzy matcher.
15. T2.9 `flex-wrap` + `min-width:0` on the sticky bar; pad the footer, not just `<main>`.
16. T2.10 move `.ipc-skeleton` and `.ipc-page-header` into `src/index.css`.
17. T2.4 add `onClick`/`onKeyDown`/`aria-expanded` to the mega-menu triggers.

**Deploy hygiene — T3 (an hour):**

18. `rm -r dist/data dist/products-all.json public/products-all.json`; add `uploads/` and the `admin/` writability note to the deploy docs; strip the test JSONL files; fix the false routing claim in `README.md:153` and `CLAUDE.md:60`; fix the `"sub"` example in `admin/README.md:175`.

Then rebuild (`npm run build`) — the current `dist/` is otherwise correct and needs no rebuild except for the `App.jsx` changes above.

§4 items are a follow-up sprint, not a launch gate — except **4.2** (invalid Product JSON-LD on all 42 products), **4.4** (10 unlabelled form fields on the only revenue page) and **4.11** (four admin fields that do nothing), which I'd fold into the T2 pass since you're in those files anyway.
