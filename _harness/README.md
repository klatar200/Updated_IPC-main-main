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

The mirror's admin password is `audit-pass-123`, written by `setpw.php` into
`_harness/site/admin/config.local.php`. That file is gitignored and should be
deleted when you finish a session.

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

## Investigative tools (one-shot, kept as evidence)

`inkaudit`, `whitesurfaces`, `fgsurfaces`, `findwhite`, `findtranslucent`,
`findwarn`, `classifywhite`, `probeink`, `checkskus`, `derived`, `navyshot`,
`accentaudit`, `accentshot`, `gradientshot` — measurement. `inkpatch{,2,3}`,
`inkfix{,2}`, `inkclass`, `fgpatch{,2}` — the codemods that did the brand-color
migrations. They are cited in `WHATS_LEFT.md` §4h/§4i and are how the numbers
there were produced.

## Two things that have bitten before

- **`sync.sh` after every build and every `admin/` edit.** Otherwise the suites
  test stale code and pass for the wrong reason.
- **Measure in the browser, not in the source.** A backward scan for a
  background both misses one declared after the `className` in the same element
  and attributes one from 12,000 characters away. Six real mis-classifications
  during the brand-color work were caught only by measuring.
