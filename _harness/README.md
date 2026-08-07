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
| `invariants.js` | 17 checks over the 12 invariants in `CLAUDE.md` |
| `invariants-selftest.js` | mutates each invariant and proves `invariants.js` **fails** — a check that cannot fail is not a check |
| `copydrift.js` / `-selftest.js` | `content.php`'s `$COPY_GROUPS` vs `App.jsx`'s `COPY_DEFAULTS` (96 fields). Wired into `lint.php` |
| `copyroundtrip.js` | a copy field survives admin edit → JSON → rendered site |
| `contrastparity.js` / `.php` | the PHP and JS contrast implementations agree on 23 colors |
| `skuparity.js` / `.php` | the PHP and JS SKU matching agree on 32 needles |
| `deadlinks.js` | every Industries product reference resolves to a real product |
| `backdrop.js` | the shared measurement core: gradient sampling **under the glyphs**, alpha compositing to the first opaque paint, WCAG luminance. A source string, not a function — Playwright serialises a function without its closure. Used by `brandtext.js`, `plan5c-eyebrow.js` and `plan5c-brandink.js`; it is one implementation on purpose, because `contrastparity.js` exists to catch two contrast implementations drifting apart |
| `brandtext.js` | every element painting its own text in a brand colour, scored against the background it really sits on — gradients sampled **under the text's own ink**, translucent layers composited, WCAG large-text honoured. Supersedes `fgsurfaces.js`'s reporting. **Currently 35/51.** ⚠️ Two homepage `✓` rows wobble ±1 in the reported background between runs of the same code — the hero animates and a small ink extent is position-sensitive. Verdicts are unaffected; the count of distinct combinations can move by one |

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
| `plan5-social.js` | 4.11b — footer social icons, and the "all five cleared ⇒ no container" half of NB4 |
| `plan5-images.js` | 4.32 — image weight, dimension attributes, lazy-loading, and every product photo still reaching the page |
| `plan5b-sidebar.js` | `sidebar-active-border` — the selected product's left indicator, measured as **computed style**, plus React's style-conflict warning on a development bundle |
| `plan5b-sitemap.js` | `sitemap/dashboard` — the served `/sitemap.xml` diffed against `SEO_DEFAULT`, checked against `robots.txt`, and every route `<loc>` rendered and matched to its own canonical. **Fetches over HTTP**, not off disk: the sitemap is generated now, and a rewrite that fails delivers the SPA shell with a 200, so it fails loudly on a non-XML content-type |
| `plan5b-pwthrottle.js` | `admin/password.php still sleeps` — the change-password form goes through `login_attempt_gate()`, does not sleep, and cannot be deepened by retrying |
| `plan5c-eyebrow.js` | `page-header-eyebrow-contrast` — every text-painting element in `.ipc-page-header`, on **two palettes**, scored under its own ink. The eyebrow is held at AA; the rest is a printed ratchet at 18 |
| `plan5c-brandink.js` | `brand-text-on-brand-surface` — bright accents used as text, classified by **measured background luminance** rather than by route, so darken-on-light and lighten-on-dark cannot be confused. Also asserts `--brand-accent` is still in use as a surface, which is what tells a call-site fix apart from a repalette |
| `plan5c-sitemap.js` | `product detail URLs are in no sitemap` — adds and deletes a product **in a live catalog** and requires the served document to track it, compares all 42 product `<loc>`s against the canonical each page declares, and checks the degraded responses are still clean XML |

## Investigative tools (one-shot, kept as evidence)

`inkaudit`, `whitesurfaces`, `fgsurfaces`, `findwhite`, `findtranslucent`,
`findwarn`, `classifywhite`, `probeink`, `checkskus`, `derived`, `navyshot`,
`accentaudit`, `accentshot`, `gradientshot` — measurement. `inkpatch{,2,3}`,
`inkfix{,2}`, `inkclass`, `fgpatch{,2}` — the codemods that did the brand-color
migrations. They are cited in `WHATS_LEFT.md` §4h/§4i and are how the numbers
there were produced.

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
