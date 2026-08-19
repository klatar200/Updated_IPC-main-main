# Audit 5

Fifth audit cycle, run as **three complete rounds** over the whole repository.
Base: `98c8450` (main, after PR #48). Verified 2026-08-18.

Rounds 1 and 2 were independent full passes through different lenses — six
subsystem auditors, then a security/failure-mode/go-live re-read. Round 3
re-derived every finding against the code and, wherever the claim was
observable, **measured it**: in a real browser, or against a live PHP server,
rather than trusting the source-read that produced it. That discipline changed
outcomes — one finding's mechanism was wrong (the outcome held), two were
retracted by the round that raised them, and several severities moved in both
directions.

| Severity | Count | Status |
|---|---|---|
| **Blocker** | **2** | **Fixed** 2026-08-18 (`WHATS_LEFT.md` §1q) |
| High | 7 | **Fixed** 2026-08-18 (§1r) |
| Medium | 19 | **Fixed** 2026-08-18 (§1s) |
| Low | 22 | **Fixed** 2026-08-18 (§1t) — 4 of them already closed by the tiers above |

## Nothing previously verified has regressed

Before looking for anything new, the existing gates were stood up and run in
full:

```
php _harness/lint.php      every check green (19 php -l, 9 node --check, JSON,
                           copy-key/family/approval/photo/audit-action drift,
                           doc drift, section drift 49, href guard drift)
node _harness/invariants.js                                          17/17
npm run build              0 errors, 374.65 kB JS / 23.59 kB CSS
_harness/run.js  × 68 suites, all 13 servers up            66/68 exited clean
```

The two reds are the two documented expected-reds and nothing else:
`plan8-polish` 16/17 (the Linux DejaVu font artifact, GUARDRAILS §7.1) and
`brandtext` 36/47 — **11 failing against a ceiling of 13**, judged by the
failing count as that section instructs. `plan8-contrast` 34/35 is its
documented passing state (`EXEMPT_BRAND_SURFACE`). `plan10-repalette` is
**33/33**: the D-02 stale baseline from audit 4 was re-based in PR #46 and that
item is closed.

All **16 CLAUDE.md invariants were re-verified in code**, individually, with
file:line evidence. Every one holds.

So none of what follows is regression. It is the set of things the suites were
never written to look at.

---

# Blockers

## A-5.1 — The contact form is an unauthenticated, content-controlled mail relay under IPC's own identity

> **FIXED 2026-08-18** — `reply_slot()` in `public/contact.php`; evidence and
> residual risk in `WHATS_LEFT.md` §1q. Left here as written, because the
> finding is the record of what was true at audit time.

`public/contact.php:197-207` (`s()`), `:609-625` (auto-reply body), `:639-646` (send)

`s()` deliberately does not HTML-escape — that is invariant 10 and it is
correct. But its control-character class is
`[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]`, which **excludes `\x0A` and `\x0D`**, so
newlines survive. `hdr()` collapses CRLF, but it is applied to headers only,
never to the body slots. Five attacker-controlled fields — `name`,
`partNumber`, `material`, `quantity`, `requiredDate` — are interpolated
verbatim into the auto-reply body, and that reply is mailed to `$replyTo`,
which is **the `email` field the attacker supplied**.

**Executed against a live server.** One anonymous POST — no auth, no CSRF, no
Referer — produced this delivered message:

```
To: purchasing@victim-corp.example
Subject: We received your quote request — Insulation Products Corporation
From: Insulation Products Corporation <noreply@insulationproducts.com>
Reply-To: sales@insulationproducts.com

Hello Valued Customer,

ACTION REQUIRED: invoice #48812 is 30 days overdue.,
...
Part Number:   Do not reply to this address.
Material Type: Billing line: +1-555-0100
Quantity:      Pay online now: https://evil.example/ipc-pay-invoice
Required By:   Regards,
IPC Accounts Receivable
```

Five slots × `IPC_MAX_LINE` is roughly **1,000 characters of attacker-authored,
freely line-broken prose**, sent from IPC's domain with IPC's SPF/DKIM
alignment — mail that passes every authenticity check the recipient's MTA
performs.

The 4.15/4.15b hardening capped **volume**, never **content**, and audit 4's
"Mail headers" row checked headers only. Current caps are 5 per 10 min per IP
and 3 per 24 h per normalised mailbox, so a single IP reaches roughly **720
distinct victims per day**, three messages each — and A-5.9 below describes a
plausible state in which the per-IP cap is not enforced at all.

**Impact:** phishing conducted under the client's corporate identity, domain
and IP blacklisting, and — on Network Solutions shared hosting — account
suspension for outbound abuse.

**Fix (small, and it does not touch invariant 10):** the body slots are the
problem, not the escaping policy. Either run the five RFQ summary fields
through a single-line variant (`hdr()` already exists and does exactly this),
or drop the visitor-supplied summary from the auto-reply and keep it in the
sales notification, which goes only to IPC. Send the confirmation without
echoing 1,000 characters of stranger-supplied text to a stranger-supplied
address.

## A-5.2 — `robots.txt` makes the entire product catalog un-indexable

> **FIXED 2026-08-18** — `public/robots.txt` + `X-Robots-Tag` in
> `data/.htaccess`; see `WHATS_LEFT.md` §1q.

`public/robots.txt:6`

`Disallow: /data/` blocks the three JSON files the SPA builds every page from
(`src/App.jsx:5841`, `:6366`, `:6549`). The site renders 100% client-side, and
Google's Web Rendering Service honours robots.txt for subresource fetches, so
the catalog never loads for the crawler. Under REP the longest matching rule
wins: `Disallow: /data/` (6 chars) beats `Allow: /` (1 char).

Measured for this audit:

- There is **no fallback catalog in the bundle** — `IP30HS` appears 0 times in
  `dist/assets/*.js`, so `/data/products-all.json` is the only source.
- `needsCatalog` covers `products`, `dashboard` and `datasheets`
  (`src/App.jsx:12806`), and all 42 product detail pages are
  `/products?productId=…`. Every one renders `CatalogError` to a crawler that
  obeys the block.
- `sitemap.php` reads the catalog **server-side**, so it is unaffected — it
  actively advertises the 52 URLs that will render as errors.

`site-info.json` and `content.json` fall back to hardcoded defaults, so brand
pages still index. It is specifically the catalog — the reason a parts buyer
would ever find this site — that goes dark.

**Fix:** delete the line. Those files are already served to every visitor's
browser, so nothing is being protected. To keep raw JSON out of results while
allowing the render fetch, use `Header set X-Robots-Tag "noindex"` for `*.json`
in `data/.htaccess` instead. `Disallow: /uploads/` (line 7) should go too — it
keeps every admin-uploaded product photo out of Google Images.

---

# High

## A-5.3 — The RFQ form loses the lead entirely when JavaScript does not run

`src/App.jsx:5257-5261` · `public/contact.php:398, 487-496`

The RFQ form carries `method="post" action="/contact.php"` precisely so the
no-JS path degrades to a real submission; the C40 comment at `App.jsx:5240-5255`
states "these field names already match it". They do not. The `form_type`
discriminator is appended **only** in the fetch handlers — `grep -n form_type
src/App.jsx` returns exactly `:4822` and `:4870`, both `body.append`, and no
hidden input exists in either form. A native submit therefore arrives with no
`form_type`; `contact.php:398` defaults it to `'message'`; the message branch
rejects it for missing `subject`/`message` — fields the RFQ form does not
contain — at `:492-496`, which `exit`s before `mail()` **and** before
`ipc_log_inquiry()`.

**Measured against a live server, with a control.** A complete, valid RFQ posted
exactly as the rendered form posts it:

```
HTTP 422   {"ok":false,"error":"Please add a subject and a message."}
inquiries.jsonl delta: 0
```

The byte-identical payload with `form_type=rfq` added:

```
HTTP 200   {"ok":true}
inquiries.jsonl delta: +1        ...,"quantity":"500 ft",...,"sent":true}
```

One missing hidden field is the whole difference between a captured lead and a
silently discarded one. RFQ is the **default** tab (`App.jsx:4672`), so it is
the first form a no-JS visitor meets, and the JSONL safety net — whose purpose
is that no lead is ever lost — never sees it.

**Fix:** one `<input type="hidden" name="form_type" value="rfq" />` per form.
PHP takes the last duplicate key, so the JS `append` stays compatible.

## A-5.4 — Bot sign-in noise erases the owner's change history from the Audit Log in under two days

`admin/audit-log.php:15-18, 30-36` · `admin/auth.php:158-161`

The page slices to the last 500 lines **first** (`array_slice($lines,
-$MAX_LINES)`) and applies the SKU/action filter **after**, to the already-sliced
set. And `admin-log.jsonl` has no rotation anywhere in the tree — `grep -rn
"admin-log" admin/*.php` returns only the writer (`config.php:891`) and the
reader. `inquiries.jsonl` rotates at 16 MB; this file does not.

The throttle correctly refuses attempts during a cool-off without logging them,
but each cool-off expiry permits one attempt that reaches `password_verify()`,
fails, and **is** logged. At `LOGIN_COOLOFF_MAX = 300` (`config.php:963`) that
is 288 lines/day per attacking IP, so a single scanner floods the entire
500-line window in **1.7 days** — and `/admin/` is a guessable path.

The owner opens Audit Log to find when he changed a description, sees 500 rows
of *Sign-in failed*, filters by `edit`, and gets **"No entries match"** — his
edits are in the file, just outside the slice. The feature is dead with no
indication the data still exists.

The `file()` full-read at `:13` shares the root cause: at owner-only traffic it
is decades from mattering, but under this bot traffic it becomes a months-scale
memory fatal — the same failure already fixed once for `inquiries.php`.

## A-5.5 — A failed write destroys the live catalog, and the corrupt result reads as "0 products" with no error

`admin/config.php:668, 693, 857` (writes) · `:473-479` (load) · `admin/add.php:16, 87-88`

All three saves are a single `file_put_contents(..., LOCK_EX)` with no
temp-file + `rename()`. Writer-vs-writer is genuinely safe (measured — see
Refuted), but the write is not atomic against *failure*, and every loader maps
"corrupt" onto the same value as "missing": `if (!is_array($data)) return [];`.

Both halves reproduced:

- Under `ulimit -f 100`, a 300 kB `file_put_contents` left **102,400 of 300,000
  bytes** on disk — the truncate happens at open, and the payload never lands.
- The verbatim `load_products()` body against that truncated prefix returns
  **0 products**, with `json_last_error_msg: Control character error`.

The live site immediately shows Catalog Unavailable. The dashboard reads
**"0 products across 0 categories"** with **no health banner** — `data_writable()`
is still true, so `index.php:152` never fires. If the owner's next move is Add
Product, `add.php:16` loads `[]`, appends one row, and writes a **one-product
catalog**, reported as *added successfully*, consuming a backup slot whose
content is the corrupt state. `content.php` and `settings.php` can blank their
files the same way from a blank form.

A related severity note on the same line: `file_put_contents()` returns the byte
count, so a short write on a quota-limited host is `!== false` and reports
success. The adjacent `json_encode() === false` case carries an explicit comment
about exactly this hazard; the short-write case is one step further on and is
uncovered.

**Fix:** write to `$path.'.tmp'` and `rename()` into place (atomic within a
filesystem), and compare the return against `strlen($json)`. That one change
also closes A-5.19.

## A-5.6 — `mail()` returning true is not delivery, and nothing ever tells the owner a lead arrived

`public/contact.php:537-542` · `admin/index.php:146-187` · `admin/nav.php:64-81`

`$sent = @mail(...)` records only that the local MTA accepted the message. The
common shared-hosting outcome — accepted, then SPF/DKIM-rejected, greylisted or
spam-foldered at the recipient — is stored as `sent: true` and rendered with a
green **Emailed** badge.

The JSONL safety net is well built and complete (every rejection path logs
before exiting), but it is a **pull** surface with no signal: `nav.php` is a
static link bar with no unread count, and the health panel checks four
conditions, none of which is "N inquiries arrived that you have not read".

The trigger is ordinary: `From:` is hardcoded `noreply@insulationproducts.com`
(`:531`) while `$to` is owner-editable, so pointing sales at a Gmail address —
or a domain SPF record that omits the host's relay — is enough. Quote requests
then sit on disk marked *Emailed*, nobody is notified, and the owner concludes
it has been a quiet month.

## A-5.7 — An unauthenticated request can fatal the login page, printing the server path and part of the password hash

`admin/auth.php:123, 136` · `admin/config.php:404, 415` · `admin/backups.php:49`

`$_POST['password']` is read raw and handed to `password_verify()`, typed
`string`. Executed on PHP 8.4:

```
POST /admin/auth.php    password[]=x
Uncaught TypeError: password_verify(): Argument #1 ($password) must be of type string, array given
  in /…/admin/auth.php:136
#0 /…/admin/auth.php(136): password_verify(Object(SensitiveParameterValue), '$2y$12$dFqr1XAM...')
```

Unauthenticated, and the trace discloses the absolute server path **and the
first 16 characters of the live bcrypt hash** — cost factor plus part of the
salt. The same shape exists in `csrf_check()` (`csrf_token[]=x` fatals all 11
mutating admin pages through one shared line) and on the GET side for `?sku[]=`
at `edit.php:5`, `delete.php:5`, `upload-image.php:11`, `upload-pdf.php:5` and
`audit-log.php:29`. `post_str()` exists for exactly this and is applied
inconsistently.

**Why this is conditional, and why it still matters.** With `display_errors=Off`
the same request returns a blank `HTTP 500` and leaks nothing — measured on the
production-shaped ini. Production gets that from `public/.user.ini:43`. But that
file is a **dotfile**, which FTP clients hide by default, and
`DEPLOY_READINESS_v2 §7`'s upload row **omits it** (A-5.31). `.user.ini` is also
honoured only under CGI/FastCGI — under mod_php it is ignored entirely and
`display_errors` follows the host's `php.ini`.

**Fix:** cast these five inputs so the pages fail closed regardless of ini
state, and verify `display_errors` is actually Off on the live server rather
than assuming the file landed.

## A-5.8 — An unwritable `admin/` silently disables both brute-force controls at once, and the banner mentions neither

`admin/config.php:1010-1027, 1072-1085, 890-901` · `admin/index.php:147-151`

On the documented host condition where the PHP user differs from the FTP user,
`login_throttle_mutate()` opens the throttle file and returns `null` on failure.
`login_attempt_gate()` then returns its initialised `$wait = 0`, so `auth.php`
goes **straight to `password_verify()` on every request, with no cool-off,
permanently**. In the same failure `audit_log()` no-ops, so the guessing run is
also **unrecorded**. Two supposedly independent controls share one failure mode.

The health banner enumerates the consequences of an unwritable `admin/` —
discarded leads, no activity log, password page cannot save — and omits the
throttle entirely. It is also visible only *after* signing in.

## A-5.9 — Both contact-form abuse controls live in the shared temp dir, are `@`-suppressed, and fail open silently

`public/contact.php:278, 303-305, 317-323, 569-585`

The per-IP rate limit and the per-recipient auto-reply cap both persist to
`sys_get_temp_dir()` under computable names, and every write is fire-and-forget
(`@file_put_contents(...)` with the return ignored). If that write ever fails —
temp dir not writable under this host's `open_basedir`/`TMPDIR`, quota reached,
or a hostile co-tenant pre-creating the file in a shared world-writable `/tmp` —
the next request reads an absent file, `count($state['hits'])` is 0, and **there
is no rate limit and no auto-reply cap at all**, which turns A-5.1 into an
unbounded relay.

Two further consequences of the same design: a co-tenant who writes a full
`hits` array into `ipc_rl_<md5(victim_ip)>.json` can **429 a chosen real
customer** at will; and neither file is ever cleaned up — `grep -n unlink
public/contact.php` returns **zero matches** — so one file accumulates per
distinct visitor IP and per distinct auto-reply recipient, forever, in the same
directory as PHP's session files. On shared hosting that is an inode-quota
attack, and inode exhaustion is precisely the entry condition for A-5.5.

Nothing surfaces any of it: `admin_writable()`/`data_writable()` check `admin/`
and `data/`; there is **no health check for the temp dir**.

## A-5.10 — Client-only rendering with no prerender: only Google sees the catalog at all

`index.html:70-83` · `src/App.jsx:7159-7357`

Even with A-5.2 fixed, nothing but a full JS-rendering engine ever sees product
content or per-URL social cards. The static shell's `og:title`/`og:image`/
`og:url` are homepage-generic and per-route overrides run in `useEffect`; the
`noscript` block carries company NAP only.

Bing/DuckDuckGo indexing of product pages is unreliable; AI answer engines
(GPTBot, ClaudeBot, PerplexityBot — none execute JS) cannot read the catalog at
all; and a product URL pasted into a procurement email or Slack unfurls as the
generic homepage card. **Fix (real work, not a launch blocker):** prerender the
52 sitemap routes to static HTML at build. Highest-leverage SEO work after
A-5.2.

---

# Medium

| ID | Finding | Location |
|---|---|---|
| A-5.11 | **The visual spec editors seed a phantom row, so every product added without touching them ships two junk blocks.** Browser-measured: on an untouched Add form, after editor init, `specTable1_rows` holds `[{"label":null,"value":""}]` and `specTable2_json` holds `rows:[[""]]` — while the *server* seeds both empty (`add.php:38`, `:116`). The 4.29 render guard is `if (!rows.length) return null`, and length 1 passes it, so the public page draws a dark "SPECIFICATIONS:" bar over one blank row plus a one-column "Order Size" table. Deleting the last row re-seeds it (`spectable-editor.js:204`), so a spec table can never be emptied from the visual editor at all. `plan5-spectable` writes `rows: []` straight into the mirror JSON and never goes through the form, which is why this was never caught. | `admin/spectable-editor.js:120, 204, 280, 485`; `src/App.jsx:8150, 8203` |
| A-5.12 | **A malformed-but-savable spec table crashes the product page.** `edit.php` validates only `is_array(json_decode(...))`, never the shape, while the renderer assumes rows-of-arrays. Verified in a browser with a control: injecting `rows:["8.0","9.0"]` for IP38FE renders the ErrorBoundary ("Something went wrong", no `h1`) while IP30HS renders fine on the same load. | `src/App.jsx:8193-8195, 8260-8277`; `admin/edit.php:118-128` |
| A-5.13 | **`isSafeLinkUrl` and `link_url_problem()` are bypassable with a backslash.** Verified: `/\evil.com/x.pdf` has `startsWith("//") === false` and `startsWith("/") === true`, so both gates call it local — and `new URL(v, "https://www.insulationproducts.com/products").href` resolves to **`https://evil.com/x.pdf`**. The interior-tab variant `/\t/evil.com/x.pdf` resolves the same way. The sink is the footer catalog-PDF link on all ten public pages. | `src/App.jsx:12141-12153`; `admin/config.php:1308-1317` |
| A-5.14 | **`site-info.json` and `content.json` are fetched once per page load and never re-checked.** The `visibilitychange`/`focus` recheck that fixed the inert TTL was added to `useProducts` only — verified, `visibilitychange` occurs exactly once in `App.jsx` (`:6349`) and both providers end `}, []);`. Meanwhile `settings.php:221`, `content.php:1065` and `help.php:238` all promise "within ~60 seconds". Any already-open tab — the owner's own verification tab, or a buyer's background tab — never sees a corrected phone number or any copy edit. | `src/App.jsx:6523-6541, 7009-7027` |
| A-5.15 | **Thirty backup slots are consumed by ten new products.** One new product is *three* `save_products()` calls (add, then photo upload, then PDF upload), and `BACKUP_KEEP = 30` is count-based per prefix, so a single sitting adding ten parts rotates the entire window. The ordering and pruning mechanism is correct — the retention *policy* is what is wrong, and `help.php:620` documents the count as if it were generous. | `admin/config.php:494, 537-576` |
| A-5.16 | **Nothing resizes an uploaded photo.** No image processing exists anywhere in the tree; the only bound is the 8 MB cap, and `help.php:577` gives a floor ("at least 800 pixels wide") with no ceiling. A 4 MB phone photo becomes the eager-loaded LCP image on the product detail page. | `admin/upload-image.php:102, 120`; `src/App.jsx:8633-8641` |
| A-5.17 | **No timezone is set anywhere**, so PHP defaults to UTC for an Illinois business, and every admin timestamp is printed bare with no zone. A customer calls at 3pm about the RFQ the Inquiries page stamps 21:00; on the Backups page the owner picks the wrong version, and each wrong guess is itself a save that consumes a slot (A-5.15). `.user.ini` sets five directives but not `date.timezone`. | `admin/config.php:892`; `public/contact.php:487, 522`; `admin/backups.php:103-105` |
| A-5.18 | **"Site Images" are text path fields pointing inside the deploy tree.** Product photos were deliberately moved to `uploads/` so redeploys cannot clobber them (`config.php:22-24`); the five marketing photos got the opposite treatment and default to `images/site/…`, which ships with every build. `help.php:263` sends the owner to a screen with no uploader. A later `npm run build` + re-upload silently reverts his photos. | `admin/content.php:328-334` |
| A-5.19 | **Readers take no lock, so a visitor fetch landing inside a save gets a partial 200.** Apache serves `data/*.json` with no `flock`, so the truncate→write window is readable: 200, correct content-type (so `jsonOrThrow` passes), truncated body, `res.json()` throws → Catalog Unavailable. `data/.htaccess`'s `max-age=60` makes the broken response cacheable, and Retry re-reads the same `?v=<minute>` URL. Same temp+`rename()` fix as A-5.5. | `admin/config.php:668`; `data/.htaccess` |
| A-5.20 | **`edit.php` is the only editing page without the unsaved-changes guard** — and it loses two mechanisms, not one: the `beforeunload` prompt *and* the 5-minute `ping.php` session keepalive. It is the page holding long descriptions and hand-edited spec JSON, i.e. the one editing surface that can still reach `csrf_fail_page('expired')` at Save. Never wired (`git log -S`), no documented exemption. | `admin/edit.php:449-450` |
| A-5.21 | **Structural edits never mark the form dirty.** `unsaved.js` arms only on `input`/`change`; the reorder ↑/↓, row-remove and add-row handlers mutate the DOM from `click` and dispatch neither. Reordering the FAQ and then clicking a nav link loses the work silently — and the ✕ confirm even promises the row "is deleted for good when you click Save Content". | `admin/unsaved.js:26-35`; `admin/content-editor.js:97-109` |
| A-5.22 | **A cancelled submit permanently disarms the unsaved guard.** The `submit` listener sets `submitting = true` even when a sibling listener calls `preventDefault()` (the invalid-JSON block, the family-rename confirm) and never resets it. After the Advanced-mode block says "nothing was saved", the guard is off for the rest of the page's life. `forms()` also matches nav.php's Sign Out form, so signing out with unsaved edits is silent. | `admin/unsaved.js:29, 37-42` |
| A-5.23 | **Product→product navigation never resets scroll.** Browser-measured: scrolled to y=2509 on IP38FE, clicked a related-product control, URL became `?productId=IP55FL`, scroll landed at **1549**. The scroll effect keys on `[page]`, which does not change. The related cards are also plain `<button onClick>`, violating the 4.21 crawlable-link rule, so Ctrl-click and "Copy Link Address" do nothing. | `src/App.jsx:8850-8888, 12773-12776` |
| A-5.24 | **`audit_log()` invalid-UTF-8 loss is an anti-forensics primitive, reachable pre-auth.** `json_encode()` returns `false` on invalid UTF-8 and `false . "\n"` is a bare newline, which `audit-log.php` then skips as empty — verified: `json_encode(["ua"=>"\xFF evil"])` is `false` and the write is exactly 1 byte, while the function still returns `true`. `'ua'` is `substr($_SERVER['HTTP_USER_AGENT'], 0, 120)`, attacker-controlled on the login form, so `curl -A $'\xFF'` produces **no `sign-in-failed` rows for a brute-force run and no `sign-in` row for the successful compromise**. The identical mechanism in `ipc_log_inquiry()` discards the lead record while still incrementing the "Total received" counter. Fix once, both places: `JSON_INVALID_UTF8_SUBSTITUTE`. | `admin/config.php:890-901`; `public/contact.php:114-118` |
| A-5.25 | **Unauthenticated permanent disk growth through the inquiry log.** Every submission — accepted, honeypot, rate-limited or blocked — appends an entry of up to ~16 KB; at the 5/10min cap that is ~11.5 MB/day/IP of growth that nothing reclaims (rotated files are deliberately never deleted). Same-second rotations also silently clobber each other via `@rename` to a second-granular name. | `public/contact.php:105-121` |
| A-5.26 | **Unauthenticated session-file exhaustion.** `ping.php` skips `require_auth()` but still starts a session, and `session.use_strict_mode` is never set, so PHP creates a session file for any client-supplied ID — each living up to the 8-hour `gc_maxlifetime`. If the session store shares `/tmp` with A-5.9's limiter files, filling it also disables the contact-form rate limit. Fixation itself is closed (`regenerate_session_id()` on both success paths). | `admin/ping.php:10-16`; `admin/config.php:420-446` |
| A-5.27 | **Theme colors are the one owner-writable sink `settings.php` does not validate**, reaching `root.style.setProperty()` on every public page. `ipc_parse_hex_color()` exists and is already used for the contrast note on the same values. Confirmed not a script sink — the realistic abuse is `url(https://attacker/…)` beaconing or defacement, saved with no error. | `admin/settings.php:106-111`; `src/App.jsx:7505` |
| A-5.28 | **A stray `?productId=` hijacks the head of any non-product route.** Browser-measured: `/contact?productId=zzz-not-a-part` renders the real Contact page (`h1: "Get in Touch"`) while its head carries `title: "Part not found"`, **`robots: noindex`**, and **no canonical** — the conversion page de-indexing itself on a mangled inbound link. | `src/App.jsx:7177-7185, 7321-7324` |
| A-5.29 | **`load_products()` has no inner type guard** — `return $data['products']` with a declared `: array` return, so a hand-edited `{"products": "..."}` is a `TypeError` 500 on every admin page with no "the file is corrupt" message anywhere. `backups.php:27` does guard the same shape. | `admin/config.php:479` |

# Low

Grouped; each was verified in code, and none is launch-gating.

**Correctness and robustness.** Wrong-type product fields crash inconsistently — a string `description` kills the product page and a string `badges` kills the whole `/dashboard` index, while siblings guard the same fields (`App.jsx:8796, 2795`). A `null` array row throws in Navbar/Footer, which render **outside** the ErrorBoundary (confirmed: `:12866`/`:12889` vs the boundary at `:12880-12888`), so React 18 unmounts the root and the whole site goes blank — invariant 8 puts them above the *loading gate*, which is a different thing. An empty-but-loaded catalog makes `/dashboard` claim "Loading catalog…" forever (`:10280, 10519, 10537`), where `/products` says honestly that the catalog is empty. `product.pdfUrl` and `additionalPdfs[].url` reach `href` with no render-side guard (write-gated only, so a restored pre-F6 backup or an FTP edit bypasses them). `PageMeta`'s `setMeta` early-returns on empty values, so soft-404s keep the previous route's description (`:7263-7275`).

**Admin.** `audit-log.php` loads the whole log with `file()` before slicing (A-5.4's sibling). GET array params fatal on PHP 8 across five pages. `settings-preview.js:54` renders 5 of the 7 social channels — `instagram` and `tiktok` are missing, so the live preview contradicts the page it previews. `help.php:571-582` describes a "Choose Image → preview → Upload" flow that does not exist and recommends the one photo-removal path that orphans files while claiming it deletes them. The health panel checks `admin/`, `data/` and `uploads/images` but not `pdfs/`. `admin_password_write()` reports "the previous password was restored. Nothing changed." on a path where the backup copy failed and the restore was skipped. Its replace regex matches single-quoted `define` only, so a hand-deployed double-quoted `config.local.php` yields "Password changed" while the old password keeps working. Readers take no `LOCK_SH` and `backup_path()`'s glob→copy is a TOCTOU.

**Hosting and rules.** `pdfs/.htaccess:5` blocks `\.php$` only — not case-insensitive, and not the `x.php.pdf` double-extension form that mod_mime does treat as PHP; `uploads/.htaccess` has the correct broad rule to copy. `uploads/.htaccess:14` promises deny-by-default in its comment and implements allow-by-default. The runtime-generated `uploads/.htaccess` writes `php_flag engine off`, a **mod_php-only** directive that returns 500 for the whole directory under the CGI/FastCGI this project targets (`upload-image.php:75-83`) — it only fires when the folder is created at runtime, and the shipped file is strictly better. HSTS is gated `env=HTTPS`, which never fires behind the TLS-terminating proxy the adjacent `X-Forwarded-Proto` redirect exists for. Missing files under `/assets/` fall into the SPA catch-all and return `index.html` as `text/html`, so the FTP deploy window serves HTML-as-JS. `data/.htaccess` never sets `AddType application/json .json` while `jsonOrThrow` *requires* that content-type. `X-Mailer: PHP/` . `PHP_VERSION` discloses the exact PHP version to any address via the auto-reply. The auto-reply's `From:` display name is unquoted, so a company name containing a comma produces a malformed address list.

**Repo and docs.** Rotated inquiry logs are **not** gitignored — `git check-ignore` confirms `admin/inquiries.jsonl` is ignored and `admin/inquiries-2026-01-01-000000.jsonl` is not — so a bulk `git add` could commit customer PII to a public repo. `README.md:75-79` documents a dev loop that was deleted (the `import.meta.env.DEV` branch and the `npx serve .` workaround); `README.md:23` still documents `base: './'`, the exact configuration PLAN-8 A5 measured as a white screen on every ≥2-segment URL. `_harness/README.md` is named by GUARDRAILS as "the live suite list" but omits 24 tracked suites. `DEPLOY_READINESS_v2 §7`'s upload row omits `public/.user.ini` — the file A-5.7 depends on. `admin/README.md` still documents the pre-4.14 `sleep()` throttle. CLAUDE.md's invariant 9 cites `index.css:49`; the rule is at `:341`. `README.md:35` says 8,500+ lines; `wc -l src/App.jsx` is 12,897.

---

# Refuted, corrected, and re-scoped

Recorded so a later run does not re-derive them.

| Claim | Outcome |
|---|---|
| A save can tear against a concurrent save | **Refuted, measured.** `file_put_contents(..., LOCK_EX)` defers the truncate until *after* the lock is acquired: with a second process holding `LOCK_EX`, the file stayed at its original 217 bytes for the full 2.5 s block, then went to 300,000 in one step. Writer-vs-writer is safe. Only the *reader* side is exposed (A-5.19). |
| A disk-full write reports success | **Refuted, measured.** Against `/dev/full`, `file_put_contents()` returns `bool(false)`, so `!== false` is a correct success test for that case. The real exposure is the `ulimit`/quota **short write** (A-5.5), which is a different mechanism. |
| The Add form's phantom spec row comes from `add.php` storing a server seed | **Corrected.** `add.php` has no `specTable1_json` field at all (it is `specTable1_rows`), and the server seeds both tables *empty*. The phantom rows are injected client-side by `spectable-editor.js`. The outcome is unchanged, which is why A-5.11 stands. |
| The `react-router` advisories have no in-range fix (audit 4's D-03) | **Re-scoped.** `npm audit fix` now resolves semver-compatibly to `react-router-dom@6.30.4` + `@remix-run/router@1.23.3`, closing the protocol-relative advisory (GHSA-2j2x-hqr9-3h42) with no major upgrade. Two remain fixed only in 7.18+, and a **fourth** advisory has appeared since audit 4 — GHSA-jjmj-jmhj-qwj2 (CVE-2026-53668, open redirect → XSS) — which affects 6.30.2 through 6.30.4, i.e. both the shipped version and the bumped one. All of them require an app-level open redirect; re-verified independently that every `setSearchParams({page: …})` call site passes a literal and no attacker string reaches `navigate()`. Recommendation: take the free `npm audit fix` bump; the v7 migration remains the owner's call. |
| `ALLOW-PASSWORD-RESET` can be created or extended from the web | **Refuted.** The flag is only ever `@unlink()`ed (`config.php:181`, `index.php:12`), never created, and `filemtime` is not attacker-influenceable. The 1-hour window is real, documented, deliberate and bannered. |
| Login throttle is defeatable by parallelism or `X-Forwarded-For` | **Refuted.** The gate bumps and decides inside one `flock` on a `c+` handle, and `login_throttle_client_ip()` uses `REMOTE_ADDR` unless `TRUST_PROXY_FORWARDED` is defined, gated by `FILTER_VALIDATE_IP`. |
| Path traversal in any of the six file operations | **Refuted.** `backups.php` pairs `basename()` with a strict filename whitelist; every other read/write/delete pairs `basename()` with `realpath()` prefix containment; `edit.php`'s rename derives both names through `pdf_filename_for_sku()`, which cannot emit a separator. |
| Mail-header injection | **Refuted, re-derived from scratch.** Every header value goes through `hdr()`; `$to` is `FILTER_VALIDATE_EMAIL`-gated. A quoted local part with a comma is still one RFC-5322 address and cannot smuggle a recipient. A-5.1 is a **body** finding, not a header one. |
| Page weight / image payload is a problem | **Not a finding.** `public/images/` totals 2.8 MB across 61 files, largest single file 0.2 MB. (The *upload* path is unbounded — that is A-5.16.) |

# Checked, no finding

Auth boundary (`require_auth()` first in all 15 entry points; only `auth.php`
and `ping.php` exempt, both deliberately, neither leaking). CSRF tokens
(`random_bytes(32)`, `hash_equals`, present on all 11 mutating entry points).
Session hardening and fixation. Upload validation (extension **and** sniffed
MIME, `getimagesize`+`finfo` cross-check, SVG excluded, filenames always
derived). Stored-XSS sinks traced end to end — no `dangerouslySetInnerHTML`
anywhere; remaining unguarded sinks are `src`-only, which executes nothing.
`inquiries.php` renders every field through `h()` with `ENT_QUOTES`.
`sitemap.php` (`rawurlencode` + `ENT_XML1`, degrades to 10 routes and a 200 on a
corrupt catalog). File exposure over HTTP — every path the admin can create was
enumerated and matched against the `.htaccess` rules; all covered. `inquiries.php`
is genuinely O(1)-memory (2 MB tail seek + streamed count) and is the one growth
path in the tree solved properly. Backup ordering and pruning mechanism.
Optimistic concurrency across tabs. Orphan cleanup in `delete.php` and the
upload pages. SPA browser-API floor (only `flatMap` and `ResizeObserver`;
Vite's safari14 target is satisfied). `CatalogError` UX and invariant 8.
`SITE_ORIGIN` is a real production domain and agrees across `App.jsx:5855`,
`sitemap.php:74`, `robots.txt:10` and `index.html:19/36`; the built bundle
contains no localhost, staging or example host. Deploy cache-busting is correct
(`index.html` `no-cache` + content-hashed immutable assets). Data integrity:
42 products, no duplicate or empty SKU, 42/42 `pdfUrl` and 37/37 local photo
paths resolve case-exact.

# Owner actions for launch

Code fixes are one thing; these are not code, and the site should not go live
without them.

**Already tracked, still open** (`WHATS_LEFT.md` §2j) — both are genuinely
launch-gating despite being filed under "not launch blockers":

1. **Rotate the live admin password.** A working `$2y$12$` hash was published in
   this repository's git history and the repo is public. Removing the file did
   not un-publish the blob. Until the password is changed on the server, anyone
   who has read this repo can sign in.
2. **Resolve the ISO 9001 contradiction (A10-037).** The site renders four
   different claims — `ISO 9001:2008`, unversioned `ISO 9001`, and
   `ISO9001:2000` — two of which name revisions withdrawn in 2008 and 2015. The
   strings live in owner-owned data; this is four admin saves once the owner
   says which revision IPC actually holds.

**Newly identified this audit:**

3. **Remove `Disallow: /data/`** before launch (A-5.2). Nothing else on this
   list matters if the catalog cannot be indexed.
4. **Publish SPF, DKIM and DMARC** for `insulationproducts.com` covering the
   host's outbound relay, and confirm the `noreply@` mailbox exists on the
   account. The auto-reply goes from the company domain to external inboxes;
   without these it lands in spam and erodes domain reputation — and A-5.1 makes
   the reputation exposure materially worse until it is fixed.
5. **Set up Google Search Console**, submit the sitemap, and watch coverage.
   This is also the only way to confirm #3 actually worked, and the only way the
   owner would ever learn the catalog had been deindexed.
6. **Add a free uptime monitor** and a periodic contact-form self-test. Today
   there is no analytics, no error tracking and no uptime signal anywhere, so a
   silent failure of the form or the site is invisible (note: the privacy policy
   states "We do not use Google Analytics", so it must be edited if analytics is
   ever added).
7. **Decide the canonical host** and enforce it — there is no apex→www redirect,
   and HSTS is sent only from www — then confirm the TLS certificate covers both.
8. **Verify `display_errors` is Off on the live server** after deploying, rather
   than assuming `public/.user.ini` landed (A-5.7). It is a dotfile, FTP clients
   hide dotfiles, the deploy manifest omits it, and it does nothing at all under
   mod_php.
9. **First-deploy discipline:** upload `data/`, `pdfs/` and `uploads/` exactly
   once. After that they are live customer state and an FTP overwrite creates no
   backup.

---

## Method

Round 1: six parallel auditors over the admin core library, the admin page
entry points, both halves of `src/App.jsx`, the `public/` tree plus the data and
deploy contract, and a dedicated invariant/documentation verifier. Round 2:
three fresh passes — adversarial security, production failure modes, and
go-live/SEO operability — each told what round 1 had already found so it would
spend its effort on new ground. Round 3: every surviving finding re-derived
against the code, and the observable ones measured — a real Chromium driving the
admin and the public site, and `curl` against a live PHP server with the
harness's capturing sendmail.

Evidence for the measured claims is quoted inline above. The regression suite,
the two repo gates and the sixteen invariants were run first, so that everything
here could be stated as new rather than as regression.
