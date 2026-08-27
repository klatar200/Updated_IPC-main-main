/**
 * Audit 7 — the render-side half of the catalog-shape defences.
 *
 * Written against the UNFIXED tree and watched to fail, per GUARDRAILS 4.4.
 *
 * ── What this measures, and why the earlier rounds did not ──────────────────
 *
 * A-5.12 ("a malformed-but-savable spec table crashes the product page") was
 * closed WRITE-SIDE ONLY: `add.php`, `edit.php` and `config.php` gained shape
 * validation, and `src/App.jsx` was not touched. `grep -rn 'A-5.12'` finds the
 * marker in three PHP files and in no JSX.
 *
 * That is the same reasoning the codebase itself rejected for `pdfUrl`. The L4
 * comment above `safeHref()` (src/App.jsx) states the settled principle:
 *
 *     "`pdfUrl` and `additionalPdfs[].url` are gated where they are WRITTEN …
 *      but not where they are rendered, which is the same argument A1 rejected
 *      for the footer link: data/ is a plain file, so an FTP edit or a backup
 *      restored from before those gates existed reaches the component with
 *      nothing in between."
 *
 * A write gate is not enough for `data/`, and for spec tables the consequence
 * is worse than a dead link: the product page throws into the ErrorBoundary.
 *
 * The reachable path needs no FTP at all. `BACKUP_KEEP` is 90 per prefix and
 * `admin/backups.php` restores any of them. Every backup written before
 * 2026-08-18 predates the A-5.12 gate, so restoring one re-introduces exactly
 * the shape the renderer cannot survive — through the admin UI, by the owner,
 * with a success message.
 *
 * ── The four shapes, and why each one ───────────────────────────────────────
 *
 *   T2-FLAT    specTable2.rows = ["8.0","9.0"]       — A-5.12's own repro.
 *                                                      `row.map` is not a
 *                                                      function on a string.
 *   T2-NULLROW specTable2.rows = [null]              — `row.map` on null.
 *   T1-NULLROW specTable1.rows = [null]              — `row.label` on null.
 *   T1-OBJVAL  specTable1.rows = [{label:{},value:1}] — an object as a React
 *                                                      child. React throws
 *                                                      "Objects are not valid
 *                                                      as a React child".
 *
 * Every one is savable-then-restorable state, and every one is a shape the
 * three PHP gates reject today — which is precisely why only a pre-gate
 * backup, or a hand edit, can produce it, and precisely why the renderer is
 * the only remaining line of defence.
 *
 * ── The control matters more than the finding ───────────────────────────────
 *
 * Each arm asserts a NEIGHBOURING product renders correctly on the same load.
 * Without it, "the page is broken" is indistinguishable from "the harness is
 * broken", and a suite that reports a red mirror as a code defect is worse
 * than no suite. The control product is never mutated.
 *
 * Also asserted, in the same pass because it is the same file and the same
 * class of exposure:
 *
 *   PDF-NULLROW  additionalPdfs = [null] — `extra.url` on null, at both of the
 *                two render sites (product detail and the datasheets page).
 *
 * ── Restore ────────────────────────────────────────────────────────────────
 *
 * The MIRROR's catalog is mutated; the repo's `data/` is never touched. The
 * mirror is restored from `_harness/pristine/` in a `finally` and the restore
 * is asserted byte-for-byte before any result is reported, the same discipline
 * `plan10-auditlog.js` uses.
 *
 * Needs the mirror on :8123 (started with -t _harness/site).
 *
 * Usage: node _harness/audit7.js
 */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const MIRROR_DATA = path.join(__dirname, 'site', 'data');
const PRISTINE = path.join(__dirname, 'pristine');
const CATALOG_MIRROR = path.join(MIRROR_DATA, 'products-all.json');
const CATALOG_PRISTINE = path.join(PRISTINE, 'products-all.json');

/** The product each arm corrupts, and the untouched one it is scored against. */
const SUBJECT = 'IP38FE';
const CONTROL = 'IP30HS';

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

const pristineCatalog = () => JSON.parse(fs.readFileSync(CATALOG_PRISTINE, 'utf8'));

function restoreMirror() {
  fs.copyFileSync(CATALOG_PRISTINE, CATALOG_MIRROR);
}

/**
 * Write a mutated catalog into the mirror.
 * `mutate` receives the product row for SUBJECT and edits it in place.
 */
function writeMutated(mutate) {
  const data = pristineCatalog();
  const rows = Array.isArray(data) ? data : data.products;
  const p = rows.find((x) => x && (x.id === SUBJECT || x.sku === SUBJECT));
  if (!p) throw new Error(`subject ${SUBJECT} not in the catalog`);
  mutate(p);
  fs.writeFileSync(CATALOG_MIRROR, JSON.stringify(data));
}

/**
 * Load a product page and report what the DOM says about it.
 *
 * `crashed` is read from the ErrorBoundary's own heading rather than from the
 * console, because a React error that is CAUGHT still logs to the console —
 * so a console sweep cannot tell a contained crash from a healthy page, and
 * cannot tell either from an uncaught one.
 */
async function inspect(page, id) {
  const errors = [];
  const onErr = (e) => errors.push(String(e.message || e));
  page.on('pageerror', onErr);
  await page.goto(`${BASE}/products?productId=${encodeURIComponent(id)}`, {
    waitUntil: 'networkidle',
  });
  const dom = await page.evaluate(() => {
    const h2s = [...document.querySelectorAll('h2')].map((n) => (n.textContent || '').trim());
    return {
      boundary: h2s.includes('Something went wrong'),
      h1: (document.querySelector('h1')?.textContent || '').trim(),
      specCells: document.querySelectorAll('table td, table th').length,
      bodyLen: (document.body.innerText || '').length,
      // The chrome renders outside the ErrorBoundary. If THIS is gone the whole
      // React root unmounted, which is a strictly worse outcome than a
      // contained crash and is worth telling apart.
      hasNavbar: !!document.querySelector('header, nav'),
      hasFooter: !!document.querySelector('footer'),
    };
  });
  page.off('pageerror', onErr);
  return { ...dom, pageErrors: errors };
}

/** One arm: mutate, load subject, load control, report. */
async function arm(page, tag, description, mutate) {
  writeMutated(mutate);
  const subject = await inspect(page, SUBJECT);
  const control = await inspect(page, CONTROL);

  // The finding: the corrupted product must NOT take the page down.
  note(
    !subject.boundary,
    `${tag} — ${SUBJECT} renders instead of the ErrorBoundary (${description})`,
    subject.boundary
      ? `"Something went wrong" is on the page; h1=${JSON.stringify(subject.h1)}; ` +
        `pageerror=${JSON.stringify(subject.pageErrors.slice(0, 1))}`
      : ''
  );
  note(
    subject.h1 !== '',
    `${tag} — ${SUBJECT} still has an <h1>`,
    subject.h1 === '' ? 'no h1 on the page — the product header never rendered' : ''
  );
  // The chrome must survive regardless — invariant 8's neighbourhood.
  note(
    subject.hasNavbar && subject.hasFooter,
    `${tag} — navbar and footer survive on ${SUBJECT}`,
    !subject.hasNavbar || !subject.hasFooter
      ? `navbar=${subject.hasNavbar} footer=${subject.hasFooter} — the React root unmounted`
      : ''
  );

  // The control: proves the arm measured the mutation and not the mirror.
  note(
    !control.boundary && control.h1 !== '' && control.specCells > 0,
    `${tag} — CONTROL ${CONTROL} is unaffected on the same catalog`,
    control.boundary
      ? 'the control crashed too — the mirror is broken, not the renderer'
      : control.h1 === ''
        ? 'the control lost its h1'
        : control.specCells === 0
          ? 'the control rendered no spec cells'
          : ''
  );

  restoreMirror();
}

(async () => {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    // Baseline: the untouched mirror renders the subject correctly. If this is
    // red nothing below means anything.
    const base = await inspect(page, SUBJECT);
    note(
      !base.boundary && base.h1 !== '' && base.specCells > 0,
      `BASELINE — ${SUBJECT} renders on the pristine catalog`,
      base.boundary ? 'the pristine mirror already crashes — fix the mirror first' : ''
    );

    await arm(
      page,
      'T2-FLAT',
      'specTable2.rows is a flat list of strings',
      (p) => {
        p.specTable2 = { ...(p.specTable2 || {}), rows: ['8.0', '9.0'] };
      }
    );

    await arm(page, 'T2-NULLROW', 'specTable2.rows contains null', (p) => {
      p.specTable2 = { ...(p.specTable2 || {}), rows: [null] };
    });

    await arm(page, 'T2-NULLCOL', 'specTable2.columnSpans contains null', (p) => {
      p.specTable2 = { ...(p.specTable2 || {}), columnSpans: [null], rows: [['a']] };
    });

    await arm(page, 'T1-NULLROW', 'specTable1.rows contains null', (p) => {
      p.specTable1 = { ...(p.specTable1 || {}), rows: [null] };
    });

    await arm(page, 'T1-OBJVAL', 'a spec row carries an object where text belongs', (p) => {
      p.specTable1 = {
        ...(p.specTable1 || {}),
        rows: [{ label: { a: 1 }, value: { b: 2 } }],
      };
    });

    await arm(page, 'PDF-NULLROW', 'additionalPdfs contains null', (p) => {
      p.additionalPdfs = [null];
    });

    // The datasheets page renders the SECOND additionalPdfs site, and it maps
    // over every product — so one bad row there is a whole-page outage rather
    // than one product's.
    writeMutated((p) => {
      p.additionalPdfs = [null];
    });
    const ds = await (async () => {
      const errors = [];
      const onErr = (e) => errors.push(String(e.message || e));
      page.on('pageerror', onErr);
      await page.goto(`${BASE}/datasheets`, { waitUntil: 'networkidle' });
      const dom = await page.evaluate(() => ({
        boundary: [...document.querySelectorAll('h2')].some(
          (n) => (n.textContent || '').trim() === 'Something went wrong'
        ),
        links: document.querySelectorAll('a[href$=".pdf"]').length,
      }));
      page.off('pageerror', onErr);
      return { ...dom, pageErrors: errors };
    })();
    note(
      !ds.boundary,
      'PDF-NULLROW — /datasheets renders instead of the ErrorBoundary',
      ds.boundary ? `pageerror=${JSON.stringify(ds.pageErrors.slice(0, 1))}` : ''
    );
    note(
      ds.links > 0,
      'PDF-NULLROW — /datasheets still lists the other products\' data sheets',
      ds.links === 0 ? 'zero PDF links on the page' : ''
    );
    restoreMirror();

    // ── A-7.9 — the two provider fetches carry no abort timeout ──────────────
    //
    // T2.1 ("an origin that accepts the connection and then hangs used to leave
    // the site on the loading skeleton forever") was fixed with a 12 s
    // AbortController in fetchProductsCached(). site-info.json and
    // content.json are the same three files, in the same folder, from the same
    // origin, fetched through useRefetchOnReturn() — which had no timeout.
    //
    // Measured rather than argued: route the file to a handler that never
    // responds, then ask the browser what happened to the request. With the
    // guard the request ABORTS inside the window; without it, it is still open.
    // The catalog request is watched in the same run as the control — it is
    // the fetch that already has the guard, so if IT does not abort the probe
    // is measuring something other than the timeout.
    {
      const hang = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const state = new Map();   // url → 'pending' | 'failed' | 'finished'
      const track = (u) => u.includes('/data/site-info.json') || u.includes('/data/products-all.json');
      hang.on('request', (r) => { if (track(r.url())) state.set(r.url(), 'pending'); });
      hang.on('requestfailed', (r) => { if (track(r.url())) state.set(r.url(), 'failed'); });
      hang.on('requestfinished', (r) => { if (track(r.url())) state.set(r.url(), 'finished'); });

      // Never fulfil, never abort: the connection is accepted and then hangs.
      await hang.route('**/data/site-info.json*', () => {});
      await hang.route('**/data/products-all.json*', () => {});

      await hang.goto(`${BASE}/`, { waitUntil: 'commit' }).catch(() => {});
      // The guard is 12 s (PRODUCTS_FETCH_TIMEOUT_MS). Give it a margin.
      await hang.waitForTimeout(15000);

      const verdict = (needle) => {
        for (const [u, st] of state) if (u.includes(needle)) return st;
        return 'never-requested';
      };
      const siteInfo = verdict('/data/site-info.json');
      const catalog = verdict('/data/products-all.json');

      note(
        catalog === 'failed',
        'A-7.9 CONTROL — the catalog fetch aborts on a hanging origin (its guard already exists)',
        catalog !== 'failed'
          ? `catalog request is "${catalog}" after 15 s — the probe is not measuring the timeout`
          : ''
      );
      note(
        siteInfo === 'failed',
        'A-7.9 — the site-info fetch aborts on a hanging origin',
        siteInfo !== 'failed'
          ? `site-info request is still "${siteInfo}" after 15 s — no timeout, so nothing ` +
            'ever settles it and each visibility change past the TTL opens another'
          : ''
      );
      await hang.close();
    }
  } finally {
    restoreMirror();
    await browser.close();
  }

  // Assert the restore before reporting anything — a suite that corrupts the
  // mirror and then reports a score is reporting on a tree nobody can trust.
  const restored =
    fs.readFileSync(CATALOG_MIRROR, 'utf8') === fs.readFileSync(CATALOG_PRISTINE, 'utf8');
  note(restored, 'RESTORE — the mirror catalog is byte-identical to pristine/', restored ? '' : 'MIRROR LEFT DIRTY');

  const pass = results.filter((r) => r.ok).length;
  console.log(`\naudit7 ${pass}/${results.length}`);
  process.exit(pass === results.length ? 0 : 1);
})().catch((e) => {
  restoreMirror();
  console.error(e);
  process.exit(2);
});
