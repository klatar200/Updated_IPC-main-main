# `_harness/` — the verification harness

Local only. **Nothing here is deployed**; the do-not-upload list in
[DEPLOY_READINESS_v2.md](../DEPLOY_READINESS_v2.md) §7 governs what ships.

These suites are the **executable form of this release's acceptance criteria**.
`WHATS_LEFT.md` §4* cites them by name as the evidence behind every shipped
item. They were previously gitignored wholesale, so each session rebuilt them
from nothing; the code is tracked now, and only the generated directories are
ignored.

## Bootstrap

```sh
npm run build
sh _harness/sync.sh          # creates site/ and, on a fresh clone, pristine/
```

**Run everything from the repo root.** `php-mail.ini` sets a relative
`sendmail_path`, and several suites resolve `_harness/...` relative to the
current directory.

Then start the servers you need:

```sh
php -S 127.0.0.1:8123 -t _harness/site -c _harness/php-mail.ini    _harness/router.php &
php -S 127.0.0.1:8124 -t _harness/site -c _harness/php-trunc.ini   _harness/router.php &   # plan2-trunc only
php -S 127.0.0.1:8125 -t _harness/site -c _harness/php-nb2-off.ini _harness/router.php &   # plan2-trunc only
```

`sync.sh` also mirrors `pdfs/` (8 MB, copied only when newer). Without it every
`pdfUrl` 404s for a reason that has nothing to do with the site and
`plan7-datasheets.js` measures the harness instead of the page.

`-t _harness/site` is not optional: `router.php` returns `false` for a real file
so `php -S` serves it, and it serves it from the **docroot**, not from the
router's own directory.

`plan5-throttle.js` additionally needs a **fleet** of ten servers, because one
`php -S` answers one request at a time and neither of 4.14's faults — a lost
count in an unlocked read-modify-write, and a `sleep()` that several
connections serve concurrently — can appear without genuine parallelism.
`PHP_CLI_SERVER_WORKERS` was tried and is not enough: measured, 8 workers
served 8 concurrent `sleep(2)` requests in 6 s, about three at a time. Ten
independent servers over one docroot (and therefore one
`admin/.login-throttle.json`) served the same load in 2.1 s across 10 PIDs.

```sh
for p in 8130 8131 8132 8133 8134 8135 8136 8137 8138 8139; do
  php -S 127.0.0.1:$p -t _harness/site -c _harness/php-mail.ini \
      _harness/router.php >/dev/null 2>&1 &
done
```

The mirror's admin password is `audit-pass-123`, written by `setpw.php` into
`_harness/site/admin/config.local.php`. That file is gitignored and should be
deleted when you finish a session.

**If you deleted it and then run an admin suite, it will time out waiting for
`input[type="password"]`** — with no password configured, `auth.php` correctly
renders its "no password set" state instead of a login box, so the failure looks
like a broken selector and is not. Re-run `php _harness/setpw.php` (or
`sh _harness/sync.sh`, which calls it).

## What is generated, and why it is ignored

| Directory | Size | Rebuilt by |
|---|---|---|
| `site/` | ~21 MB | `sync.sh`. Also holds `admin/config.local.php` — a **working credential**, and this repo is public. |
| `pristine/` | ~284 KB | Seeded once from `data/` by `sync.sh`. A tracked copy would be a second source of truth for live customer state that can drift — the `public/products-all.json` incident. |
| `out/` | ~6 MB | Re-running any suite. |

## Standing regression — these must stay green

| File | What it holds |
|---|---|
| `lint.php` | `php -l` (18 files), `node --check` (9 admin JS), JSON parse, and the copy-key drift check |
| `invariants.js` | 17 checks over invariants **1–12** in `CLAUDE.md`. It does **not** cover 13–16, added 2026-08-13; those are behavioural rather than textual and are held by suites of their own — 13/14 (`.ipc-container`, and custom CSS losing to hoisted Tailwind utilities) by the rendered widths in `adminwidth.js` and the 4-column check, 15 (`admin_head()` ordering, narrow pages opting out) by `adminwidth.js`, 16 (a no-op save returns true) by `nodupbackups.js`. If you extend `invariants.js` to 13–16, extend `invariants-selftest.js` with it |
| `invariants-selftest.js` | mutates each invariant and proves `invariants.js` **fails** — a check that cannot fail is not a check |
| `copydrift.js` / `-selftest.js` | `content.php`'s `$COPY_GROUPS` vs `App.jsx`'s `COPY_DEFAULTS` (96 fields). Wired into `lint.php` |
| `contactflow.js` / `-selftest.js` | the contact form's **happy path**, end to end through the rendered page — the one journey the site exists for, and the one no other suite covered. `plan3-contact.js` drives the UI but only submits invalid forms; `plan3-autoreply.js` submits valid ones but POSTs with `fetch`, so the React form is never rendered; `plan10-rfqscroll.js` stops at where an invalid field lands. **A renamed `name=` attribute passed all three** — the browser suites never read the mail and the mail suite never rendered the browser. 85 checks over 12 scenarios: both forms submitted by typing into the real controls, every typed value matched **field by field** into the sales email and into `inquiries.jsonl`, the Reply-To/From block, the auto-reply's business details traced back to `site-info.json`, `?part=`/`?industry=` prefill reaching the email, the honeypot's invisibility *and* keyboard-unreachability, the 429 surfacing as a readable panel with the phone number in it, double-submit, Submit Another, Back, the posted-field-vs-`$_POST`-key drift check, truncation, the label associations on **both** tabs, and the lead arriving legibly in `admin/inquiries.php`. Run with `--only=<tag>` for one scenario. **It passed 71/71 the first time it was run**, which is the shape of a suite that asserts nothing — hence the selftest, which breaks one guarantee at a time in the mirror (6 in `contact.php`, 2 in the built bundle, both halves deliberately) and requires the named assertion to flip to FAIL. A mutation that stays green is reported as **MUTATION SURVIVED**. One did, on the first run: it replaced the honeypot log's *note string* and left the call standing |
| `copyroundtrip.js` | a copy field survives admin edit → JSON → rendered site |
| `contrastparity.js` / `.php` | the PHP and JS contrast implementations agree on 23 colors |
| `skuparity.js` / `.php` | the PHP and JS SKU matching agree on 32 needles |
| `deadlinks.js` | every Industries product reference resolves to a real product |
| `imgcheck.js` | every `photoUrl` / `pdfUrl` in `data/products-all.json` resolves to a real file with **byte-exact case** (79 paths). Matched against `readdirSync` listings, never `fs.existsSync` — that is case-INsensitive on Windows and a default macOS volume, so it would pass on the developer's machine for exactly the defect it exists to catch and still 404 on the Linux server. Needs no server. Written because a wrong asset path does not 404 here: `public/.htaccess`'s `!-f` catch-all answers with index.html and a **200**, so nothing in the stack can tell "missing" from "served" and a status-code check sees nothing wrong |
| `adminwidth.js` | all 13 admin pages after the shared-stylesheet extraction (39 checks). Nine content pages must sit at the 1280px/80vw crossover across five viewports; the four single-purpose pages (Password 520, both uploads 600, Delete's 440px card) must **not** grow and must not carry `.admin-wide`. Also asserts the shared `body` background still resolves on every page — an over-trimmed `<style>` still lays out, it just renders unstyled, which a width-only suite would pass |
| `contentlinks.js` | every "Show me on the site ↗" link on Page Content lands on the section it names (18 checks). Reads the links out of the **rendered admin page**, not the PHP source, then follows each into the real site and asserts the target exists and clears the sticky navbar. Sections without an anchor must still name a real page and carry a note saying why there is nothing to scroll to |
| `nodupbackups.js` | a save that changes nothing writes nothing (10 checks) — no backup, no touched bytes, and it still succeeds with a "No changes to save" notice rather than an error, with the optimistic-concurrency signature still round-tripping. Note the deliberate settle-first step: the **first** save against a pristine `site-info.json` is a real change, because `settings.php` rebuilds the file from a form carrying two fields the shipped file lacks. Taking the pre-settle state as the baseline made this suite report 2/9 against a working implementation |
| `backdrop.js` | the shared measurement core: gradient sampling **under the glyphs**, alpha compositing to the first opaque paint, WCAG luminance. A source string, not a function — Playwright serialises a function without its closure. Used by `brandtext.js`, `plan5c-eyebrow.js` and `plan5c-brandink.js`; it is one implementation on purpose, because `contrastparity.js` exists to catch two contrast implementations drifting apart |
| `brandtext.js` | every element painting its own text in a brand colour, scored against the background it really sits on — gradients sampled **under the text's own ink**, translucent layers composited, WCAG large-text honoured. Supersedes `fgsurfaces.js`'s reporting. **Currently 34/45 — 11 failing, held as a ratchet at ≤ 13.** This line read `35/51` until 2026-08-12 and was stale by six combinations: PLAN-10 items 11 + 12 moved brand colour onto surfaces that had been hardcoded, which changes the set of distinct (colour × background) pairs there are to score. `WHATS_LEFT.md` §9 already carried the current figure; **this table did not, and the gap cost a full A/B against the base commit to establish that a "regression" was the documented baseline.** Re-read §9 before treating a number here as a target. ⚠️ Two homepage `✓` rows wobble ±1 in the reported background between runs of the same code — the hero animates and a small ink extent is position-sensitive. Verdicts are unaffected; the count of distinct combinations can move by one |

## Per-plan acceptance

| File | Item |
|---|---|
| `plan2-sku.js` | 4.12 — Industries SKU validation warns and still saves |
| `plan2-delete.js` | 4.13 — confirm-on-delete, and the ✕/arrow gap |
| `plan2-contrast.js` | 4.23 — brand-color contrast across four palettes |
| `plan2-formlast.js` / `-selftest.js` | `form_complete` is last in the **rendered DOM** |
| `plan2-trunc.js` | the truncation guard fires on a real `max_input_vars=100` server |
| `plan3-contact.js` | 4.5 — inline form errors, focus, literal spec strings |
| `plan3-autoreply.js` | 4.15b — the auto-reply cap key, and that the sales notification always fires |
| `plan4-public.js` | 4.19 sort headers, 4.20 FAQ accessibility tree |
| `plan4-admin.js` | 4.31 labels + posted-variable count, 4.30 focus and naming |
| `plan5-keys.js` | 4.27 — duplicate React keys. Needs a **development-React** bundle, which it builds itself via `vite.devreact.js`; production strips the message, so a console sweep over the shipped bundle cannot fail. Restores the production bundle on the way out. |
| `plan5-spectable.js` | 4.29 — a spec table with no rows renders nothing, across all 42 product pages |
| `plan5-listeners.js` | 4.26 — the ref-callback listener leak, counted over CDP `DOMDebugger.getEventListeners` |
| `plan5-throttle.js` | 4.14 — the login throttle. **Needs the ten-server fleet on :8130–:8139** (below) |
| `plan5-social.js` | 4.11b — footer social icons (**seven** since PLAN-6 item 4), the "all cleared ⇒ no container" half of NB4, and the admin round-trip: Business Details offers the fields, saving writes them, and both reach the footer with no rebuild. Counts derive from `KEYS`, so an eighth platform does not need this file edited in six places |
| `plan5-images.js` | 4.32 — image weight, dimension attributes, lazy-loading, and every product photo still reaching the page |
| `plan5b-sidebar.js` | `sidebar-active-border` — the selected product's left indicator, measured as **computed style**, plus React's style-conflict warning on a development bundle |
| `plan5b-sitemap.js` | `sitemap/dashboard` — the served `/sitemap.xml` diffed against `SEO_DEFAULT`, checked against `robots.txt`, and every route `<loc>` rendered and matched to its own canonical. **Fetches over HTTP**, not off disk: the sitemap is generated now, and a rewrite that fails delivers the SPA shell with a 200, so it fails loudly on a non-XML content-type |
| `plan5b-pwthrottle.js` | `admin/password.php still sleeps` — the change-password form goes through `login_attempt_gate()`, does not sleep, and cannot be deepened by retrying |
| `plan5c-eyebrow.js` | `page-header-eyebrow-contrast` — every text-painting element in `.ipc-page-header`, on **two palettes**, scored under its own ink. The eyebrow is held at AA; the rest is a printed ratchet at 18 |
| `plan5c-brandink.js` | `brand-text-on-brand-surface` — bright accents used as text, classified by **measured background luminance** rather than by route, so darken-on-light and lighten-on-dark cannot be confused. Also asserts `--brand-accent` is still in use as a surface, which is what tells a call-site fix apart from a repalette |
| `plan6-families.js` | PLAN-6 item 1 — the product families. Adds, reorders and empties the list against the live site; drives the admin against a **pristine** `content.json` so the day-one state (no `productFamilies` key) is the one under test; asserts the rename warning names the product count and that no content save touches `products-all.json` |
| `plan5c-sitemap.js` | `product detail URLs are in no sitemap` — adds and deletes a product **in a live catalog** and requires the served document to track it, compares all 42 product `<loc>`s against the canonical each page declares, and checks the degraded responses are still clean XML |
| `plan10-header.js` | PLAN-10 item 1 / AUDIT-10 **A10-011** — the product-detail header strip gives the product's name a column of its own, on all 42 products at 390 / 834 / 1440. Asserts the title column is not starved, that no title ink paints over an action button, and that the h1 does not wrap pathologically. Every measurement is taken with the document forced to **Liberation Sans** (the C49 control), because the defect must survive the font to be real — it does. The "unchanged" half compares 834 and 1440 **per product** against `plan10-header-baseline.json`, captured from the unmodified tree: a global band is wrong here because the title column's width depends on whether the product has a PDF button |
| `plan10-dashboard.js` | PLAN-10 item 2 / AUDIT-10 **A10-001 + A10-002** (and the C-severity **A10-015**) — `/dashboard`'s Description track stops being the only elastic column under `table-layout: fixed`. 25 checks at 390 / 834 / 1024 / 1440, each overlap count taken under the shipped face **and** Liberation Sans (the C49 control). Asserts 0 painted-text overlap pairs, a Description track ≥ 220 px, no header overprint, ≤ 4 line boxes in the first description cell, a document under 7,000 px, the table scrolling **inside its card** while `documentElement` gains no horizontal scroll, and the three `?family=` views clean too. The "unchanged" half compares 1440's column widths and all 42 mobile cards **per item** against `plan10-dashboard-baseline.json`, captured from the unmodified tree. Note the `?family=` URLs are not the audit's three: `?family=` filters on `partType`, and the audit's `Heat Shrink Tubing` matches nothing, so its table held 0 rows and proved nothing |
| `plan10-rfqscroll.js` | PLAN-10 item 3 / AUDIT-10 **A10-012** — native constraint validation must not scroll the invalid field behind the 65 px sticky header. 24 checks: **both** `/contact` forms (the RFQ tab and the message tab, which the audit never measured) × 4 viewports × (the field is below the header, its label is too, and native validation is still what fires — `noValidate` false, `valueMissing` true, `validationMessage` intact). That last one is the mechanism check: item 3's fix is a `scroll-margin-top`, not a JS validation takeover. The message tab's label is found via the field's wrapper rather than `.labels`, because its four labels all carry `htmlFor="rfq-subject"` — a separate, unfixed defect logged in `WHATS_LEFT.md` §2 |
| `plan10-repalette.js` | PLAN-10 items 11 + 12 / AUDIT-10 **A10-045 + A10-046** — the owner's brand colours must reach the translucent accent tints and the four hardcoded navies. 33 checks over 8 page-states in **three arms**. `owner` is the real path: `/data/site-info.json` is intercepted and its `theme` rewritten, exactly as saving Business Details → Branding does, so ThemeInjector's derivation is exercised and not bypassed. `vars` is the audit's own `:root !important` drill, extended with the variables the two items create — necessary because `audit10-repalette.js`'s injection map predates them, and a custom property that is not injected cannot move. `default` asserts the shipped site does **not** change: every brand-painting element and every gradient byte-identical, **per element**, against `plan10-repalette-baseline.json` captured from the unmodified tree. Run `--save-baseline` on an unmodified tree to recapture. The named-surface probes locate the header hairline, the hero badge and the `/dashboard` chips **structurally** (class shape plus "has a tint at all"), never by the cyan value, or they would stop finding them the moment the fix worked and pass vacuously |
| `plan10-adminrows.js` | PLAN-10 item 5 / AUDIT-10 **A10-020** — the Delete button on `/admin/index.php` must be readable and reachable. 15 checks over 4 viewports × 42 rows: clipped px against the table's **content** box (not its border box — `overflow: hidden` clips at the padding edge), the Delete label's rendered width, and `elementFromPoint` at every button's centre. Geometry alone is not enough — a button can sit inside the content box and still be covered, and "Rick can click it" is what the finding is about. 834 and 390 are asserted **unchanged** (they always scrolled in-card; the defect was specific to 1440/1024) |
| `plan10-adminnav.js` | PLAN-10 item 6 / AUDIT-10 **A10-021** — the admin header must contain its own nav at 390. 25 checks over 4 viewports × 3 signed-in pages (nav.php is shared, and `$navExtra` means a header that fits on one page can overflow on another). Contrast is computed against the **painted** backdrop via `elementsFromPoint`, skipping only the link and its own descendants: ancestors stay eligible because hit-testing is geometric, so the header appears in the stack exactly when it really covers the point. That is the difference between a link on the bar (7.53:1) and one that has escaped below it (1.07:1) — an ancestor walk reports this finding as already fixed. Row counting clusters y-centres with an 8px tolerance, because same-row items differ in height. Also asserts the Sign Out form still carries its `csrf_token` |
| `plan10-helpwidth.js` | PLAN-10 item 7 / AUDIT-10 **A10-022** — `/admin/help.php` must fit a phone. 21 checks. Asserts page overflow 0 at 390, no table past the viewport without a **working** scroller (`scrollWidth > clientWidth`, not merely `overflow-x: auto`), and per-instance reachability for the 8 rows the finding names — distinguishing "painted in-viewport" from "inside a scroller", because a page can measure 0 overflow by clipping rather than by fitting. Explicitly asserts `overflow-x` is **not** `hidden` on body/html, which is the forbidden shortcut. 834/1024/1440 are asserted unchanged, including that no table starts needing to scroll |
| `plan10-auditlog.js` | PLAN-10 item 8 / AUDIT-10 **A10-027** — Page Content saves must name what changed. 13 checks. **Mutates real content**, so it restores `_harness/pristine/content.json` in a `finally` block and asserts the restore byte-for-byte before reporting. Drives the real form (loads the page, edits one field, clicks the control whose accessible name is *Save Content* — a hand-built POST would trip the truncation guard, and the first `button[type=submit]` on that page is not Save Content). Performs a **settling save** before any assertion: the stored `content.json` predates fields the form renders, so the first save legitimately materialises defaults and reports six changed sections — without the settling save the suite accuses a correct implementation |
| `plan10-help.js` | PLAN-10 items 9 + 10 / AUDIT-10 **A10-028 + A10-029** — the Help page must not teach a workflow the dashboard abandoned, or a spec shape that cannot be right. 29 checks over 4 viewports. **Reads the diagram through `svg.querySelectorAll('text')`, never `innerText`** — inline SVG text is not in `innerText`, and pass-7's first attempt at A10-028 reported that real finding as "does not reproduce" for exactly that reason. The Min/Max check is conditional on the **header**: a column smaller than its neighbour is only a defect when something claims the pair is a minimum and a maximum, so `Recovered < Expanded` (correct physics) must keep passing. Also asserts the three data rows byte-identical, that the sub-column feature keeps its explanation (16 spans in the catalog use it), and 0 PHP notices / console errors at every viewport |
| `plan10-shot.js` | not a suite — the visual-confirmation shooter for whichever PLAN-10 item is under work. `node _harness/plan10-shot.js <slug> <url> [viewport...]`, with `PLAN10_SHOT_TO=<selector>` to scroll a below-the-fold target into view and clip around it |

## Audit-5 acceptance

The three tiers of `audit-runs/audit5.md`. Each suite was written against the
UNFIXED tree and watched to fail before the fix went in.

| File | Item |
|---|---|
| `audit5-blockers.js` | A-5.1 the auto-reply mail relay, A-5.2 the robots.txt catalog block. 18 checks. Asserts in BOTH directions: the reply cannot carry composed prose or a link, and the sales notification and inquiry record still store the value exactly as typed. Locates the auto-reply by `^To: <addr>$` — a substring test also matches the sales mail's `Reply-To:`, which pointed every assertion at the wrong message |
| `audit5-high.js` | The seven High findings. 30 checks. The A-5.5 arm runs PHP under `ulimit -f` with `SIGXFSZ` ignored, so the write returns SHORT instead of killing the process — that is what makes it a real short-write test rather than a simulated one |
| `audit5-medium.js` | The nineteen Medium findings. 20 checks, spanning PHP helpers, the rendered admin and the public site |

## Suites named nowhere until 2026-08-18

`plans/GUARDRAILS.md` calls this file "the live suite list", and fourteen
assertive suites were missing from it — every `plan8-*` acceptance suite among
them. An executor judged against this list would have skipped them. They are
listed here now; the mechanical check is `git ls-files _harness` filtered to
files that both assert and set a failing exit status.

| File | Item |
|---|---|
| `plan8-certs.js` | PLAN-8 — certification claims render from site-info |
| `plan8-meta.js` | PLAN-8 — per-route title/description/canonical |
| `plan8-catalog.js` | PLAN-8 — catalog listing, filters and empty states |
| `plan8-lead.js` | PLAN-8 B26 — the lead path and where the first field sits |
| `plan8-motion.js` | PLAN-8 — reduced-motion compliance |
| `plan8-chrome.js` | PLAN-8 — navbar/footer chrome across viewports |
| `plan8-keyboard.js` | PLAN-8 — keyboard reachability and focus order |
| `plan8-mobile.js` | PLAN-8 — mobile layout and tap targets |
| `plan8-polish.js` | PLAN-8 — copy and layout polish. **Expected red at 16/17 on Linux**: `fc-match system-ui` resolves to DejaVu Sans, which is wider than Arial (GUARDRAILS §7.1) |
| `plan10-admincrawl.js` | PLAN-10 — crawls every admin page for PHP notices and console errors |
| `copydrift-selftest.js` | Proves `copydrift.js` can fail — a check that has never failed proves nothing |

## Investigative tools (one-shot, kept as evidence)

`inkaudit`, `whitesurfaces`, `fgsurfaces`, `findwhite`, `findtranslucent`,
`findwarn`, `classifywhite`, `probeink`, `checkskus`, `derived`, `navyshot`,
`accentaudit`, `accentshot`, `gradientshot` — measurement. `inkpatch`,
`inkfix`, `inkclass`, `fgpatch` — the codemods that did the brand-color
migrations. They are cited in `WHATS_LEFT.md` §4h/§4i and are how the numbers
there were produced. (Their `2`/`3` follow-up passes were deleted 2026-08-12;
the numbered variants were incremental re-runs of the same codemod, and the
first of each is the readable one.)

## `audit10-*.js` — kept for the findings that are still open

Thirty-five of these survive, and **the rule that selects them is not
chronology.** `_harness/AUDIT10-REPORT.md` still carries 39 severity-C and 9
severity-D findings that nothing has actioned, and each one names the probe that
measured it under **Probe:** and again in its **Reproduce** block. A probe the
report cites is the only executable form of a live finding's reproduce steps.

So: **an `audit10-*.js` file may be deleted only once no finding in that report
cites it.** Twenty-five were deleted on 2026-08-12 under exactly that test —
every one of them backed a severity-A or -B finding that PLAN-10 closed and
AUDIT-11 verified. Re-run the test before deleting any more:

```sh
for f in _harness/audit10-*.js; do
  grep -q "$(basename "$f")" _harness/AUDIT10-REPORT.md || echo "uncited: $f"
done
```

`audit10-p7reverify.js` is the one to keep regardless of that test. It is the
audit's own before/after instrument: it flipped from demonstrating the twelve B
defects to demonstrating their absence **without its code changing**, which is
what made PLAN-10's evidence proof rather than self-report.

Plan 5 added:

| File | What it measured |
|---|---|
| `imgsizes.js` | the box every image is actually PAINTED at, over all 9 routes and all 42 product pages at 1440 and 375 — the numbers that set the resize targets. Also lists the 27 files painted on no route. |
| `imgalpha.js` | whether the product PNGs USE their alpha. All 23 are fully opaque; only `site/staff-image.png` is not. |
| `imgopt.js` | the one-shot re-encoder itself. PSNR-scored at the OUTPUT resolution, with a quality floor per file class and "keep the original" as the fallback. `--dry` reports without writing. Needs `npm i --no-save sharp`. |
| `imgshotdiff.js` | PSNR between the before and after page screenshots — what a visitor would actually see, rather than what the encoder did to a file in isolation. |
| `probe-listeners.js` | the 4.26 leak, counted over CDP `DOMDebugger.getEventListeners`: 1 → 51 after 20 scroll cycles. |
| `painted-images.json` | the output of `imgsizes.js`, consumed by `imgopt.js` and `plan5-images.js`. |

`mockup-brandtext.js` (2026-08-07) renders the open brand-colour decisions
against the **real** pages so they can be judged by eye. Running it found that
`brandtext.js` scored a gradient across the **element's box** rather than the
text's ink extent — the page eyebrow's box is 1232 px wide and its text is
83 px, and that difference was the whole of `WHATS_LEFT.md` §2's claim that
"nothing passes AA there".

**That fix landed the same day** and lives in `backdrop.js`; the earlier warning
to re-measure gradient-backed failures by hand is obsolete. Two of the mockups
were acted on (white eyebrow, teal arrows) and `eyebrow-D-darker-gradient.png`
is still live evidence for the one decision this left open,
`page-header-sublines-on-gradient`.

## Two things that have bitten before

- **`sync.sh` after every build and every `admin/` edit.** Otherwise the suites
  test stale code and pass for the wrong reason.
- **Measure in the browser, not in the source.** A backward scan for a
  background both misses one declared after the `className` in the same element
  and attributes one from 12,000 characters away. Six real mis-classifications
  during the brand-color work were caught only by measuring.
