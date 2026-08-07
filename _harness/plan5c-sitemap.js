/**
 * `product detail URLs are in no sitemap` — 42 canonical URLs the sitemap never
 * declared.
 *
 * The item was deferred with a specific objection, and it was a good one: a
 * hand-written list of 42 product URLs in a static `public/sitemap.xml` goes
 * stale the moment Rick adds or deletes a product from the admin, and a sitemap
 * advertising a dead URL is worse than one omitting a live one. Generating it at
 * BUILD time has the same defect one step removed — the build runs on a laptop,
 * the catalog lives on the server, and they diverge the first time he saves.
 *
 * `sitemap.php` reads `data/products-all.json` on each request, so the two
 * cannot disagree. That is the claim, and this suite tests exactly it: the
 * decisive assertions add and remove a product IN THE MIRROR and check that the
 * sitemap changes to match, with no rebuild and no deploy step in between.
 *
 * Asserts:
 *   - /sitemap.xml is served, is XML, and parses
 *   - all 9 routes declared in SEO_DEFAULT are listed (the plan5b guarantee,
 *     re-asserted here because the file that provided it is now generated)
 *   - all 42 products in the catalog are listed, by id, with no extras
 *   - each product <loc> matches the canonical that page declares for itself —
 *     a sitemap whose URLs the pages disown is worse than no sitemap
 *   - ADDING a product to the live catalog adds its URL, with no rebuild
 *   - DELETING one removes its URL
 *   - a corrupt or missing catalog degrades to the 10 static routes instead of
 *     500ing or emitting an empty urlset, and the document stays clean XML with
 *     no PHP diagnostic printed ahead of the declaration
 *   - nothing listed is Disallow'd by robots.txt
 *   - <lastmod> is the catalog file's mtime and not the date of the request,
 *     checked by backdating the file — "today, every day" is a lie a crawler
 *     learns to ignore
 *
 * Writes ONLY `_harness/site/data/products-all.json`, restores it from
 * `_harness/pristine/` at the end, and proves the restore with a byte compare.
 * The repo's `data/` is never touched.
 *
 * Needs the mirror on :8123 (started with -t _harness/site).
 *
 * Usage: node _harness/plan5c-sitemap.js
 */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const APP = path.join(__dirname, '..', 'src', 'App.jsx');
const ROBOTS = path.join(__dirname, '..', 'public', 'robots.txt');
const PRISTINE = path.join(__dirname, 'pristine', 'products-all.json');
const MIRROR = path.join(__dirname, 'site', 'data', 'products-all.json');

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

const declaredRoutes = () => {
  const src = fs.readFileSync(APP, 'utf8');
  const block = src.slice(src.indexOf('const SEO_DEFAULT = ['));
  return [...block.slice(0, block.indexOf('\n];')).matchAll(/page:\s*"([^"]+)"/g)]
    .map((m) => (m[1] === 'home' ? '/' : `/${m[1]}`));
};

const disallowed = () =>
  fs.readFileSync(ROBOTS, 'utf8').split('\n')
    .filter((l) => /^\s*Disallow:/i.test(l))
    .map((l) => l.split(':').slice(1).join(':').trim())
    .filter(Boolean);

/** A document is only usable if it starts with the declaration and carries no
 *  PHP diagnostic. Applied to the DEGRADED responses too, not just the happy
 *  path — a mutation run deleting sitemap.php's `is_array()` guard emitted a
 *  `foreach() argument must be of type array|object` warning ahead of the XML
 *  declaration and this suite passed 16/17, because the integrity checks only
 *  ever ran on the first fetch. A corrupt catalog is exactly when you need to
 *  know the document is still a document. */
const intact = (s) => /^\s*<\?xml/.test(s.body)
  && /<\/urlset>\s*$/.test(s.body)
  && !/(Warning|Notice|Fatal error|Deprecated):/i.test(s.body);
const firstDiagnostic = (s) =>
  (s.body.match(/.{0,60}(Warning|Notice|Fatal error|Deprecated):.{0,90}/i) || [s.body.slice(0, 90)])[0];

/** Fetch the sitemap and pull it apart. Cache-busted: this file is dynamic. */
async function sitemap() {
  const res = await fetch(`${BASE}/sitemap.xml?t=${process.hrtime.bigint()}`);
  const body = await res.text();
  const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  return {
    status: res.status,
    type: res.headers.get('content-type') || '',
    body,
    locs,
    // The routes, and the product ids, as two separate sets.
    routes: locs.filter((l) => !l.includes('?')).map((l) => new URL(l).pathname.replace(/\/$/, '') || '/'),
    ids: locs.filter((l) => l.includes('productId='))
      .map((l) => decodeURIComponent(new URL(l).searchParams.get('productId'))),
    lastmods: [...body.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1].trim()),
  };
}

const writeMirror = (obj) => fs.writeFileSync(MIRROR, JSON.stringify(obj, null, 2));

(async () => {
  const pristine = fs.readFileSync(PRISTINE);
  const catalog = JSON.parse(pristine.toString());

  try {
    // ── it exists, it is XML, it parses ──────────────────────────────────
    const s = await sitemap();
    note(s.status === 200, `/sitemap.xml responds 200 (${s.status})`, `status ${s.status}`);
    note(/xml/i.test(s.type),
      `it is served as XML (${s.type || 'no content-type'})`,
      `content-type was "${s.type}"`);
    note(intact(s), 'the document is a complete urlset with no PHP diagnostic in it',
      firstDiagnostic(s));
    // No parser dependency: assert the two things that actually break a sitemap
    // — an unescaped & and a stray tag from a PHP notice printed mid-document.
    note(!/&(?!amp;|lt;|gt;|quot;|apos;|#)/.test(s.body),
      'every ampersand in the document is escaped',
      (s.body.match(/.{0,40}&(?!amp;|lt;|gt;|quot;|apos;|#).{0,40}/) || [''])[0]);
    note(!/(Warning|Notice|Fatal error|Deprecated):/i.test(s.body),
      'no PHP diagnostic leaked into the document',
      (s.body.match(/.{0,80}(Warning|Notice|Fatal error|Deprecated):.{0,80}/i) || [''])[0]);

    // ── the 10 routes, still ──────────────────────────────────────────────
    const declared = declaredRoutes();
    const missingRoutes = declared.filter((r) => !s.routes.includes(r));
    note(missingRoutes.length === 0,
      `all ${declared.length} routes declared in SEO_DEFAULT are listed`,
      `missing: ${JSON.stringify(missingRoutes)}`);

    // ── the 42 products ──────────────────────────────────────────────────
    const catIds = catalog.map((p) => p.id);
    const missing = catIds.filter((id) => !s.ids.includes(id));
    const extra = s.ids.filter((id) => !catIds.includes(id));
    note(missing.length === 0 && extra.length === 0,
      `all ${catIds.length} products in the catalog are listed, and nothing else`,
      `missing: ${JSON.stringify(missing.slice(0, 8))} extra: ${JSON.stringify(extra.slice(0, 8))}`);

    const blocked = disallowed();
    const conflicts = s.locs.filter((l) => {
      const p = new URL(l).pathname;
      return blocked.some((d) => p === d || p.startsWith(d));
    });
    note(conflicts.length === 0,
      `nothing listed is blocked by robots.txt (Disallow: ${JSON.stringify(blocked)})`,
      conflicts.slice(0, 5).join(', '));

    note(s.lastmods.length > 0,
      `${s.lastmods.length} <lastmod> dates present`,
      'no lastmod emitted');
    const badDates = s.lastmods.filter((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d));
    note(badDates.length === 0, 'every <lastmod> is a bare ISO date', badDates.slice(0, 3).join(', '));

    /**
     * <lastmod> must be the CATALOG's mtime, not today's date. The distinction
     * is invisible on a freshly synced mirror — both are today — so this backdates
     * the file and checks the document follows. The first version of this suite
     * only checked the ISO shape, and a mutation replacing the mtime with
     * `gmdate('Y-m-d')` passed it 16/16. Telling a crawler every page changed
     * today, every day, is the same defect the privacy page's date had.
     */
    const backdated = new Date('2025-03-04T00:00:00Z');
    fs.utimesSync(MIRROR, backdated, backdated);
    const dated = await sitemap();
    note(dated.lastmods.length > 0 && dated.lastmods.every((d) => d === '2025-03-04'),
      '<lastmod> is the catalog file\'s mtime, not the date the request was served',
      `expected every lastmod to be 2025-03-04, got ${JSON.stringify([...new Set(dated.lastmods)])}`);

    // ── the point of the whole item: it FOLLOWS the live catalog ─────────
    const added = JSON.parse(JSON.stringify(catalog));
    added.push({ ...catalog[0], id: 'HARNESS-NEW-SKU', sku: 'HARNESS-NEW-SKU', name: 'Harness Probe Product' });
    writeMirror(added);
    const afterAdd = await sitemap();
    note(afterAdd.ids.includes('HARNESS-NEW-SKU') && afterAdd.ids.length === catIds.length + 1,
      'a product added to the live catalog appears in the sitemap immediately — no rebuild, no re-upload',
      `${afterAdd.ids.length} ids, HARNESS-NEW-SKU ${afterAdd.ids.includes('HARNESS-NEW-SKU') ? 'present' : 'ABSENT'}`);

    const removed = catalog.slice(1);
    writeMirror(removed);
    const afterRemove = await sitemap();
    note(!afterRemove.ids.includes(catalog[0].id) && afterRemove.ids.length === catIds.length - 1,
      `a product deleted from the live catalog disappears from the sitemap (${catalog[0].id})`,
      `${afterRemove.ids.length} ids, ${catalog[0].id} ${afterRemove.ids.includes(catalog[0].id) ? 'STILL PRESENT' : 'gone'}`);

    // ── a broken catalog must not take the sitemap down with it ──────────
    fs.writeFileSync(MIRROR, '{ this is not json');
    const broken = await sitemap();
    // Scope, stated because a mutation run showed it: this asserts the OUTPUT
    // CONTRACT, not sitemap.php's `is_array($data)` guard. Deleting that guard
    // leaves `foreach (null)`, which PHP 8 treats as a warning rather than a
    // fatal, so with display_errors off the response is byte-identical and this
    // still passes. The guard stays because relying on that is fragile — one
    // future array_map() in the same place is a 500 — but no assertion here
    // proves it is present, and pretending otherwise would be worse than saying
    // so. What IS proved is that a corrupt catalog cannot take the sitemap down.
    note(broken.status === 200 && broken.routes.length === declared.length && broken.ids.length === 0
         && intact(broken),
      'an unparseable catalog degrades to the 10 static routes — not a 500, not an empty urlset, ' +
      'and the document is still clean XML',
      `status ${broken.status}, ${broken.routes.length} routes, ${broken.ids.length} products` +
      (intact(broken) ? '' : ` — document not intact: ${firstDiagnostic(broken)}`));

    fs.rmSync(MIRROR, { force: true });
    const absent = await sitemap();
    note(absent.status === 200 && absent.routes.length === declared.length && intact(absent),
      'a missing catalog file degrades the same way',
      `status ${absent.status}, ${absent.routes.length} routes` +
      (intact(absent) ? '' : ` — document not intact: ${firstDiagnostic(absent)}`));

    // ── restore, then check the pages agree with what was advertised ─────
    fs.writeFileSync(MIRROR, pristine);
    const final = await sitemap();

    const browser = await launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const disagree = [];
      // Every product URL, not a sample: the failure this guards against is one
      // id out of 42 being spelled differently, which a sample would miss.
      const productLocs = final.locs.filter((l) => l.includes('productId='));
      for (const loc of productLocs) {
        const u = new URL(loc);
        const res = await page.goto(BASE + u.pathname + u.search, { waitUntil: 'networkidle' });
        const info = await page.evaluate(() => ({
          canonical: (document.querySelector('link[rel="canonical"]') || {}).href || null,
          notFound: /Page Not Found|Catalog Unavailable|not found/i.test(document.body.innerText),
        }));
        if (res.status() !== 200 || info.notFound || info.canonical !== loc) {
          disagree.push(`${loc} -> http ${res.status()}${info.notFound ? ', NOT FOUND state' : ''}, canonical ${info.canonical}`);
        }
      }
      note(disagree.length === 0,
        `all ${productLocs.length} product URLs render, and each page's own canonical is the URL the sitemap advertised`,
        disagree.slice(0, 6).join('\n         '));
    } finally {
      await browser.close();
    }
  } finally {
    fs.writeFileSync(MIRROR, pristine);
  }

  // The mirror's catalog is deliberately rewritten above. Prove it came back.
  note(fs.readFileSync(MIRROR).equals(fs.readFileSync(PRISTINE)),
    'the mirror catalog is byte-identical to pristine/ again',
    'the mirror was left modified — check _harness/site/data/products-all.json');

  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nplan5c-sitemap: ${results.length - bad}/${results.length}`);
  process.exit(bad ? 1 : 0);
})();
