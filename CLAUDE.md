# CLAUDE.md

Guidance for Claude Code when working in this repository.
**Constraints and invariants only.** Current state lives in
[WHATS_LEFT.md](WHATS_LEFT.md); the reasoning behind this release's changes is
in [DEPLOY_READINESS_v2.md](DEPLOY_READINESS_v2.md). Re-verified 2026-08-04.

## Commands

```bash
npm install
npm run dev       # Vite dev server on http://localhost:5173
npm run build     # → /dist  (FTP contents to public_html/ on Network Solutions)
npm run preview   # serve the built bundle locally
```

No test runner, linter, or formatter is configured — `package.json` defines only
`dev`, `build`, and `preview`. Verification is done by standing the site up:
`php -S` over a `public_html` mirror plus Playwright. `php -S` ignores
`.htaccess`, so the `admin/` and `data/` file-blocking rules are NOT exercised
locally — Apache is the real gate, don't report those as findings.

### Local dev serves the real `data/`

`vite.config.js` carries a dev-only middleware (`serveDataDir`, `apply: 'serve'`)
that maps `/data/*` onto the repo's top-level `data/` folder, with `..`
containment and a real 404 on a miss. So `npm run dev` exercises the same three
files and the same code paths as production — including `mergeSiteInfo` and
`mergeContent`, which hold invariants 3 and 4 and were previously never run
locally at all.

There is no `import.meta.env.DEV` branch left: all three URLs are `/data/…` in
both modes. The old `public/products-all.json` snapshot is gone — it was a fourth
copy of the catalog that drifted silently, and when it was deleted the DEV branch
pointed at nothing. The `npx serve .` workaround is obsolete.

Note that Vite's dev server answers an unknown path with `index.html` and a
**200**, so `res.ok` is not sufficient to detect a missing JSON file. All three
fetches go through `jsonOrThrow()`, which also asserts the `Content-Type`.

## Architecture

A hybrid static + PHP-admin app. Two halves, one contract: three JSON files and
two upload folders.

### Trees that ship to the server

| Local | Server | Built by | Re-deploy when… |
|---|---|---|---|
| `dist/*` (from `npm run build`) | `public_html/` | Vite | React source changes |
| `public/*` | `public_html/` | — | `.htaccess`, `.user.ini`, `contact.php`, images change |
| `admin/` | `public_html/admin/` | (PHP, copied) | admin code changes |
| `admin/config.local.php` | `public_html/admin/` | hand-deployed | password changes (gitignored) |
| `data/` | `public_html/data/` | — | **first deploy only** |
| `pdfs/` | `public_html/pdfs/` | — | **first deploy only** |
| `uploads/` | `public_html/uploads/` | — | **first deploy only** |

After first deploy, `data/`, `pdfs/` and `uploads/` are live customer state.
Re-uploading them destroys his edits and an FTP overwrite creates no backup.

### React side ([src/App.jsx](src/App.jsx))

- **One 8,500-line file is the entire app.** Routing shims, data fetch, every
  page, every component, every icon set. Search by name; there is no per-page
  split in use.
- **`src/components/`, `src/pages/` and `src/lib/` exist but nothing imports
  them.** They are an abandoned extraction. Editing them has zero effect on the
  bundle. `App.jsx` is the source of truth for runtime behaviour.
- **Routing shim at the top of `App.jsx`.** Ported from OverAI. The `"page"` key
  reads/writes the URL **pathname**; every other key is a search param. The
  setter takes an optional `{ replace: true }` — use it for any
  "read the param, then strip it" cleanup, or Back gets trapped.
- **Navigation uses real path segments.** `/products`, `/contact`, `/dashboard`.
  `public/.htaccess`'s rewrite is therefore **load-bearing**: without it every
  deep link and every refresh 404s. Do not describe it as a safety net.
- **Data fetch.** Three files, per-minute cache-buster, 12 s abort timeout,
  60 s in-memory TTL. `data/.htaccess` caches ~60 s.
- **Vite config** sets `base: './'`.

### Admin side (`admin/`)

PHP 7.4+, session auth, no DB. Every entry point includes
[admin/config.php](admin/config.php), which:

- Starts the session with hardened cookies (`HttpOnly`, `Secure` on HTTPS,
  `SameSite=Lax`, name `IPCADMIN`) **before** any output, and raises
  `session.gc_maxlifetime` to 8 hours.
- Defines `load_*()` / `save_*()` for all three JSON files. Every save routes
  through `backup_before_write()`.
- Provides `csrf_token()` / `csrf_check()`. Every mutating page calls
  `csrf_check()` after `require_auth()`.
- Provides `audit_log()`, the IP-keyed login throttle, `admin_password_write()`,
  and `upload_error_message()`.

### Full I/O surface of the admin

Read/write `data/products-all.json`, `data/site-info.json`, `data/content.json`;
read/write/delete files in `pdfs/` and `uploads/images/`; append to
`admin/admin-log.jsonl`; read `admin/inquiries.jsonl`; read/write
`admin/.login-throttle.json`; read/write `admin/config.local.php`; create/delete
`admin/ALLOW-PASSWORD-RESET`. Earlier revisions of this file claimed the surface
was one JSON file and one folder; it is not.

`public/contact.php` is a **second** dynamic piece: it ships into `dist/`, calls
`mail()`, and appends to `admin/inquiries.jsonl`.

## Invariants — each of these caused a real defect

Do not "simplify" any of them back. Each carries an inline comment naming the
incident.

1. **`admin_password_write()` uses `preg_replace_callback`, never
   `preg_replace`.** Every bcrypt hash contains `$2y$12$`; as a replacement
   string those are backreferences, and the shipped code wrote `y$…`. The
   password page was 0% functional.
2. **There is no shipped default admin password.** `config.php` defines an
   unsatisfiable sentinel. Never put a real hash there — the previous one was
   the PHP-manual example for the string `password`, and the one before that was
   printed in four committed docs.
3. **`mergeContent` treats an empty array as a deletion, not as "unset".**
   `Array.isArray(v) && v.length ? v : dv` re-seeded hardcoded defaults whenever
   the owner deleted every row of a section — including `privacySections`, i.e.
   stale legal text republishing itself after he removed it.
4. **`mergeSiteInfo` drops blank strings.** `settings.php` rebuilds
   `site-info.json` wholesale, so a missing field arrives as `""`. Spreading
   those over the defaults produced `© –2026` and `href="tel:"`.
5. **`backup_path()` allocates max-used + 1, and `backup_list()` sorts on the
   parsed (timestamp, sequence).** Neither a name sort nor `filemtime()` orders
   these correctly — `-01` sorts before `.json`, and mtime is second-granular.
6. **`content.php`'s `form_complete` hidden field must stay LAST in the form.**
   It is the `max_input_vars` truncation guard. Adding fields after it defeats
   the check.
7. **`ErrorBoundary` is keyed on `page`.** Without the key nothing resets
   `caught`, so one bad product bricked every page until a manual reload.
8. **`SiteInfoProvider`, `ContentProvider`, `Navbar` and `Footer` render above
   the catalog loading/error gate.** They used to sit behind it, so a JSON blip
   took the phone number off the Contact page.
9. **`.ipc-skeleton` and `.ipc-page-header` must be defined in `src/index.css`.**
   `GlobalStyles` mounts inside the tree that only renders *after* loading
   finishes, so defining the skeleton only there made it styleless in the exact
   situation it exists for. `.ipc-page-header` is deliberately in **both**
   (`index.css:49` and `App.jsx`'s `GlobalStyles`) — the two are complementary
   and nothing is broken. The earlier wording said "not in `GlobalStyles`",
   which was false as written. (AUDIT_v3_FINDINGS D17)
10. **`public/contact.php`'s `s()` does not HTML-escape.** Its destinations are a
    `text/plain` email and a JSONL line. `strip_tags()` ate `<1/4 inch and >`
    out of a real quote request, and the double-escape showed the owner
    `&amp;amp;`. Escaping belongs at the render boundary (`h()` in
    `inquiries.php`). Anything reaching a mail header goes through `hdr()`.
11. **An absent `Referer` is not a rejection** in `contact.php`. Privacy
    extensions and corporate proxies strip it; rejecting cost real leads.
12. **`require_auth()` renders a page on POST instead of redirecting.** A 302
    turns the POST into a GET and silently discards everything typed.

## Security posture (verified, keep it this way)

`require_auth()` on all admin pages before any output; `csrf_check()` on every
mutating POST (login excepted); uploads validated by extension **and** sniffed
MIME with non-user-controlled filenames; `basename()` + `realpath()` containment
on every read/write/delete; every dynamic echo through `h()`; optimistic-
concurrency signatures on `edit.php`, `settings.php` and `content.php`.

## Deploy

`npm run build`, then FTP the **contents** of `/dist` into `public_html/`. The
authoritative manifest, including the do-not-upload list, is
[DEPLOY_READINESS_v2.md](DEPLOY_READINESS_v2.md) §7. `admin/` must be writable by
the PHP user or the audit log, the inquiry log, the login throttle and password
changes all fail silently — the dashboard shows a banner when it isn't.

## Open work

[WHATS_LEFT.md](WHATS_LEFT.md) — what is still open, what was deliberately
deferred, and which decisions are settled. Check it before starting non-trivial
work.
