/**
 * PLAN-6 item 1 — the eleven product families were hardcoded in three places.
 *
 * `src/App.jsx` FAMILY_ORDER drove the catalogue sidebar's grouping and order,
 * the navbar category chips and the dashboard filter. `admin/add.php` and
 * `admin/edit.php` each carried their OWN copy as `$partTypes`, feeding the Part
 * Type dropdown. Measured before the change: all three identical, and nothing
 * whatsoever keeping them that way.
 *
 * That made it a latent defect as well as a missing feature, and the way it
 * would have failed is the nasty part: `edit.php` deliberately keeps an
 * unrecognised `partType` as a selected option so a save cannot silently reset
 * a category — correct on its own terms, and it means drift would have been
 * INVISIBLE in the admin while visible on the site.
 *
 * The list now lives once, in `content.json`, edited from Page Content.
 *
 * Two behaviours here are deliberate departures worth stating, because both
 * look like bugs to anyone reading quickly:
 *
 *   - AN EMPTY LIST FALLS BACK TO THE DEFAULTS. Invariant 3 says an empty array
 *     is a deletion, not "unset", and that is right for every other section —
 *     deleting all privacy rows must not republish stale legal text.
 *
 *     It is wrong here, though NOT for the reason the plan first claimed.
 *     Grouping is done on each product's own partType, so the headings render
 *     whatever the list says; "all 42 products under Other" does not happen and
 *     an assertion built on it passed with the fallback removed. What actually
 *     breaks is `openFamilies`, which initialises to
 *     `new Set(order.concat(["Other"]))` — an empty order leaves every
 *     accordion CLOSED. Measured: **41 reachable product links become 0**, and
 *     the curated order degrades to catalogue order. Both are asserted below.
 *   - RENAMING A FAMILY DOES NOT RENAME PRODUCTS. `partType` is stored per
 *     product. "Tape" -> "Tapes" orphans every taped product into "Other". The
 *     editor shows the product count per family and warns before saving; it
 *     does NOT bulk-write products-all.json, because a content save silently
 *     rewriting the catalogue is exactly the class of thing this codebase has
 *     spent five plans removing.
 *
 * Writes the MIRROR's content.json only, restores from pristine/ and proves
 * byte-identity. products-all.json is read and asserted UNCHANGED.
 *
 * Needs the mirror on :8123 (started with -t _harness/site).
 *
 * Usage: node _harness/plan6-families.js
 */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const APP = path.join(__dirname, '..', 'src', 'App.jsx');
const ADD_PHP = path.join(__dirname, '..', 'admin', 'add.php');
const EDIT_PHP = path.join(__dirname, '..', 'admin', 'edit.php');
const MIRROR = path.join(__dirname, 'site', 'data', 'content.json');
const PRISTINE = path.join(__dirname, 'pristine', 'content.json');
const PRODUCTS_MIRROR = path.join(__dirname, 'site', 'data', 'products-all.json');
const PRODUCTS_PRISTINE = path.join(__dirname, 'pristine', 'products-all.json');
const PW = 'audit-pass-123';

const DEFAULTS = [
  'Polyolefin Heat Shrink', 'PVDF Heat Shrink', 'Dual-Wall Heat Shrink',
  'Medical Grade Heat Shrink', 'Elastomeric Heat Shrink', 'Fiberglass Sleeving',
  'Expandable Sleeving', 'End Cap', 'Tape', 'Adhesive', 'Accessory',
];

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

/** Set content.json's productFamilies directly, leaving everything else alone. */
function writeFamilies(names) {
  const doc = JSON.parse(fs.readFileSync(PRISTINE, 'utf8'));
  doc.productFamilies = names.map((n) => ({ name: n }));
  fs.writeFileSync(MIRROR, JSON.stringify(doc, null, 2));
}

/**
 * What the catalogue sidebar actually paints: the family headings in order, and
 * how many product links are REACHABLE.
 *
 * The second number is the one that matters and it was nearly missed. An
 * earlier draft asserted only that headings existed, and passed with the
 * empty-list fallback removed — because grouping is done on each product's own
 * partType, so the headings render regardless. What breaks is elsewhere:
 * `openFamilies` initialises to `new Set(order.concat(["Other"]))`, so an empty
 * order leaves every accordion CLOSED. Measured: 41 reachable product links
 * become 0.
 */
const sidebarState = (page) =>
  page.evaluate(() => ({
    order: [...document.querySelectorAll('[data-testid="family-heading"]')]
      .filter((e) => e.getClientRects().length)
      .map((e) => e.textContent.trim()),
    reachable: [...document.querySelectorAll('aside a[href*="productId"]')]
      .filter((a) => a.getClientRects().length).length,
  }));

(async () => {
  const pristineContent = fs.readFileSync(PRISTINE);
  const pristineProducts = fs.readFileSync(PRODUCTS_PRISTINE);
  const catalog = JSON.parse(pristineProducts.toString());
  const browser = await launch();

  try {
    // ── 1. one literal, not three ────────────────────────────────────────
    const addSrc = fs.readFileSync(ADD_PHP, 'utf8');
    const editSrc = fs.readFileSync(EDIT_PHP, 'utf8');
    note(!/\$partTypes\s*=\s*\[/.test(addSrc) && !/\$partTypes\s*=\s*\[/.test(editSrc),
      'add.php and edit.php no longer carry their own copy of the family list',
      JSON.stringify({
        add: /\$partTypes\s*=\s*\[/.test(addSrc),
        edit: /\$partTypes\s*=\s*\[/.test(editSrc),
      }));

    /**
     * Two copies remain — a PHP default and a JS default — and that is the
     * right answer, not a compromise. One copy across two languages is not
     * achievable without a build step, and this codebase already settled this
     * shape of problem: $COPY_GROUPS and COPY_DEFAULTS are two copies kept
     * honest by copydrift.js FAILING when they disagree.
     *
     * So the assertion is not "one copy" — an earlier draft of this suite said
     * that and it was unachievable. It is "exactly two, they agree, and a third
     * cannot come back": lint.php now fails on both conditions.
     */
    const tree = ['src/App.jsx', 'admin/config.php', 'admin/add.php', 'admin/edit.php', 'admin/content.php']
      .map((f) => ({ f, n: (fs.readFileSync(path.join(__dirname, '..', f), 'utf8')
        // The EXACT quoted string: App.jsx also has a product label reading
        // "General Polyolefin Heat Shrink 2:1", which a loose match counted as
        // a third copy of the family list. It is not one.
        .match(/["']Polyolefin Heat Shrink["']/g) || []).length }));
    const total = tree.reduce((a, r) => a + r.n, 0);
    note(total === 2,
      `the eleven names appear exactly twice — one PHP default, one JS default (found ${total})`,
      JSON.stringify(tree));

    const lint = require('child_process').spawnSync('php',
      [path.join(__dirname, 'lint.php')], { encoding: 'utf8' });
    note(/family drift\s+11 families, PHP and JS identical/.test(lint.stdout) &&
         /family literals\s+none in add\.php or edit\.php/.test(lint.stdout),
      'lint.php fails the build if the two defaults diverge, or if a third literal returns',
      lint.stdout.split('\n').filter((l) => /family/.test(l)).join('\n         '));

    // ── 2. a family added in the admin reaches the public sidebar ────────
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const productUrl = `${BASE}/products?productId=${encodeURIComponent(catalog[0].id)}`;

    writeFamilies([...DEFAULTS, 'Harness New Family']);
    await page.goto(productUrl, { waitUntil: 'networkidle' });
    let st = await sidebarState(page);
    note(st.order.length > 0 && st.reachable > 0,
      `the sidebar paints its family headings and its products ` +
      `(${st.order.length} headings, ${st.reachable} reachable products)`,
      JSON.stringify(st));

    // Order is the assertion, not mere presence: the point of an ordered list
    // is that the owner chose the order.
    writeFamilies(['Tape', 'Accessory', ...DEFAULTS.filter((f) => f !== 'Tape' && f !== 'Accessory')]);
    await page.goto(productUrl, { waitUntil: 'networkidle' });
    st = await sidebarState(page);
    note(st.order[0] === 'Tape' && st.order[1] === 'Accessory',
      'reordering the rows reorders the public sidebar',
      JSON.stringify(st.order.slice(0, 4)));

    // ── 3. an EMPTY list falls back — the departure from invariant 3 ─────
    writeFamilies([]);
    await page.goto(productUrl, { waitUntil: 'networkidle' });
    st = await sidebarState(page);
    const inCatalog = DEFAULTS.filter((d) => catalog.some((p) => p.partType === d));
    // The ORDER is the falsifiable half — headings render either way.
    note(JSON.stringify(st.order) === JSON.stringify(inCatalog),
      'deleting EVERY row falls back to the built-in ORDER, not catalogue order',
      `wanted ${JSON.stringify(inCatalog)}\n         got    ${JSON.stringify(st.order)}`);
    // And the one that actually costs the visitor something: with no order,
    // every accordion initialises closed and the sidebar becomes unusable.
    note(st.reachable > 0,
      `deleting EVERY row leaves the products reachable (${st.reachable} links) — ` +
      'without the fallback every family renders collapsed and this is 0',
      `${st.reachable} reachable product links`);

    // ── 4. an unrecognised partType still renders under "Other" ──────────
    writeFamilies(DEFAULTS.filter((f) => f !== 'Tape'));
    await page.goto(productUrl, { waitUntil: 'networkidle' });
    st = await sidebarState(page);
    const fams = st.order;
    note(fams.includes('Tape') || fams.includes('Other'),
      'a product whose family was removed from the list still appears — under its ' +
      'own heading or under "Other", never dropped',
      JSON.stringify(fams));
    await ctx.close();

    // ── 5. the admin: counts, the rename warning, and no catalogue write ─
    //
    // Deliberately runs against a PRISTINE content.json — one with no
    // productFamilies key at all, which is what a deployed server has until the
    // first save. An unseeded editor showed ZERO rows there while the site
    // rendered eleven families, and invited the owner to retype a list he
    // already had. Measured; now seeded from what is in effect.
    fs.writeFileSync(MIRROR, pristineContent);
    const actx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const apage = await actx.newPage();
    await apage.goto(`${BASE}/admin/auth.php`, { waitUntil: 'domcontentloaded' });
    await apage.fill('input[type="password"]', PW);
    await apage.click('button[type="submit"]');
    await apage.waitForLoadState('domcontentloaded');
    await apage.goto(`${BASE}/admin/content.php`, { waitUntil: 'domcontentloaded' });

    const rows = await apage.evaluate(() =>
      [...document.querySelectorAll('[data-ipc-family-count]')].map((e) => ({
        name: (e.querySelector('input') || {}).value,
        count: Number(e.getAttribute('data-ipc-family-count')),
        text: e.textContent.replace(/\s+/g, ' ').trim().slice(0, 80),
      })));
    note(rows.length === DEFAULTS.length,
      `Page Content seeds all ${DEFAULTS.length} families from the list in effect, ` +
      `even with no productFamilies key stored (${rows.length} rows)`,
      JSON.stringify(rows.slice(0, 3)));

    const tapeCount = catalog.filter((p) => p.partType === 'Tape').length;
    const tapeRow = rows.find((r) => r.name === 'Tape');
    note(!!tapeRow && tapeRow.count === tapeCount,
      `the count is the real number of products using that family (Tape: ${tapeCount})`,
      JSON.stringify(tapeRow));

    // Renaming a family that products use must warn BEFORE the save commits.
    const dialogs = [];
    apage.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
    await apage.evaluate(() => {
      const row = [...document.querySelectorAll('[data-ipc-family-count]')]
        .find((e) => (e.querySelector('input') || {}).value === 'Tape');
      const input = row.querySelector('input');
      input.value = 'Tapes';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    // Submit the CONTENT form specifically. nav.php renders a Sign Out form
    // 850 lines earlier, and `form_complete` is a NAME, not an id — an earlier
    // draft used `#form_complete`, matched nothing, and swallowed the failure
    // in a .catch() so the assertion failed for the wrong reason.
    await apage.evaluate(() =>
      document.querySelector('[name="form_complete"]').closest('form').requestSubmit());
    await apage.waitForTimeout(800);
    note(dialogs.some((m) => /Tape/.test(m) && new RegExp(String(tapeCount)).test(m)),
      'renaming a family that products use warns before saving, naming the count',
      JSON.stringify(dialogs));

    note(fs.readFileSync(PRODUCTS_MIRROR).equals(pristineProducts),
      'no content save writes to products-all.json — the catalogue is never ' +
      'bulk-migrated behind the owner',
      'products-all.json changed');
    await actx.close();
  } finally {
    fs.writeFileSync(MIRROR, pristineContent);
    fs.writeFileSync(PRODUCTS_MIRROR, pristineProducts);
    await browser.close();
  }

  note(fs.readFileSync(MIRROR).equals(pristineContent) &&
       fs.readFileSync(PRODUCTS_MIRROR).equals(pristineProducts),
    'the mirror\'s content.json and products-all.json are byte-identical to pristine');

  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nplan6-families: ${results.length - bad}/${results.length}`);
  process.exit(bad ? 1 : 0);
})();
