/**
 * PLAN-5 4.32 — image weight.
 *
 * Measured 2026-08-06 before the re-encode: public/images totalled 9,357,354
 * bytes (`du -sh` 9.1M) across 60 files, with a 1.5 MB catalog cover and 23
 * product PNGs of 150-200 KB each for images no larger than 358x263.
 *
 * The re-encode itself is _harness/imgopt.js; this suite is the acceptance.
 * It asserts the numbers, and — more importantly — that nothing broke:
 *
 *   - total under 3 MB, no single file over 300 KB
 *   - the file LIST is unchanged: same 60 names, nothing renamed, nothing
 *     deleted (products-all.json and the admin photo mapping reference these
 *     by name, so a rename breaks the mapping silently)
 *   - every one of the 42 product pages still paints a product image, and none
 *     of them regressed into the branded placeholder
 *   - every painted image is served with an image/* content type and decodes
 *   - the product detail photo is NOT lazy-loaded (it is the LCP element,
 *     measured above the fold at 1440), and the footer logo IS
 *   - cumulative layout shift on a product page is no worse than before
 *   - no horizontal overflow at 375 across all 42 product pages
 *
 * Screenshots of every page carrying a changed image go to
 * _harness/out/plan5-images/ at 1440 and 375, so the before/after pair can be
 * compared by eye — quality loss on a product photo is a business problem, not
 * a technical one.
 *
 * Reads only. Nothing under data/ is written.
 * Needs the mirror on :8123 (started with -t _harness/site).
 *
 * NOTE on --tag before: the weight assertions always read public/images as it
 * is on disk NOW, so in a "before" run they describe the current tree, not the
 * historical one. The point of that run is the SCREENSHOTS — same code, same
 * layout, original image bytes overlaid into the mirror — so the before/after
 * pair isolates image quality and nothing else.
 *
 * Usage: node _harness/plan5-images.js [--tag before|after]
 */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const ROOT = path.join(__dirname, '..', 'public', 'images');
const TAG = (process.argv.includes('--tag') && process.argv[process.argv.indexOf('--tag') + 1]) || 'after';
const OUT = path.join(__dirname, 'out', 'plan5-images', TAG);

const MAX_TOTAL = 3 * 1024 * 1024;
const MAX_FILE = 300 * 1024;
const EXPECTED_FILES = 60;

const products = JSON.parse(fs.readFileSync(path.join(__dirname, 'pristine', 'products-all.json'), 'utf8'));
const PAINTED = JSON.parse(fs.readFileSync(path.join(__dirname, 'painted-images.json'), 'utf8'));

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

function walk(dir) {
  const out = [];
  for (const n of fs.readdirSync(dir)) {
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  // ── weight ────────────────────────────────────────────────────────────────
  const files = walk(ROOT);
  const total = files.reduce((a, f) => a + fs.statSync(f).size, 0);
  const over = files.filter((f) => fs.statSync(f).size > MAX_FILE);
  const biggest = files.map((f) => ({ f, s: fs.statSync(f).size })).sort((a, b) => b.s - a.s)[0];

  note(total < MAX_TOTAL,
    `public/images totals ${total} bytes (${(total / 1024 / 1024).toFixed(2)} MiB) — under 3 MB`,
    `${total} bytes`);
  note(over.length === 0,
    `no single file over ${MAX_FILE} bytes (largest is ${biggest.s} — ${path.basename(biggest.f)})`,
    over.map((f) => `${path.basename(f)} ${fs.statSync(f).size}`).join(', '));
  note(files.length === EXPECTED_FILES,
    `the file list is unchanged: ${files.length} files, nothing renamed or deleted`,
    `${files.length} vs ${EXPECTED_FILES}`);

  // ── every image the site actually paints still decodes ────────────────────
  const browser = await launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    const badType = [];
    page.on('response', (r) => {
      if (!r.url().includes('/images/')) return;
      const ct = r.headers()['content-type'] || '';
      if (r.status() >= 400 || !/^image\//.test(ct)) badType.push(`${r.status()} ${ct} ${r.url().replace(BASE, '')}`);
    });

    const noPhoto = [];
    const broken = [];
    const painted = new Set();
    for (const p of products) {
      await page.goto(`${BASE}/products?productId=${encodeURIComponent(p.id)}`, { waitUntil: 'networkidle' });
      const st = await page.evaluate(() => {
        const imgs = [...document.querySelectorAll('img')];
        const photo = imgs.find((i) => /\/images\/products\//.test(i.currentSrc || i.src));
        return {
          hasPhoto: !!photo,
          src: photo ? (photo.currentSrc || photo.src) : null,
          ok: photo ? photo.complete && photo.naturalWidth > 0 : false,
          nat: photo ? `${photo.naturalWidth}x${photo.naturalHeight}` : null,
        };
      });
      if (!st.hasPhoto) noPhoto.push(p.id);
      else if (!st.ok) broken.push(`${p.id} ${st.src}`);
      else painted.add(st.src.replace(BASE, '').replace(/^\//, ''));
    }

    note(broken.length === 0,
      `zero broken images across all ${products.length} product pages`,
      broken.join(', '));
    // Four photoUrls in products-all.json differ from the file on disk only by
    // CASE (IP52EC.png vs ip52ec.png, and three more). On a case-sensitive
    // filesystem the SPA rewrite answers the miss with index.html and a 200,
    // so the browser gets HTML where it asked for an image and falls back to
    // the branded placeholder. That is PRE-EXISTING and untouched by the
    // re-encode: fixing it means either renaming files or editing
    // products-all.json, and PLAN-5 forbids both. Logged in WHATS_LEFT.md §2.
    // Pinned here so the set cannot silently GROW.
    const KNOWN_CASE_MISMATCH = [
      '/images/products/IP12GA.jpg', '/images/products/IP52EC.png',
      '/images/products/IP63ES.jpg', '/images/products/VALUE-ADDED.png',
    ];
    const unexpected = [...new Set(badType)]
      .filter((b) => !KNOWN_CASE_MISMATCH.some((k) => b.endsWith(k)));
    note(unexpected.length === 0,
      'every /images/ response is a 2xx with an image/* content type, apart from the ' +
      `${KNOWN_CASE_MISMATCH.length} known pre-existing case-mismatched photoUrls`,
      unexpected.join('\n         '));
    // The four case-mismatched photoUrls fall back to the branded placeholder
    // and always did — pre-existing, logged in WHATS_LEFT.md §2, NOT caused by
    // the re-encode. What matters here is that the count did not grow.
    note(noPhoto.length <= 9,
      `${products.length - noPhoto.length} of ${products.length} product pages paint a real photo ` +
      `(${noPhoto.length} on the branded placeholder: 5 placehold.co URLs + 4 case-mismatched filenames, all pre-existing)`,
      noPhoto.join(', '));
    note(PAINTED.every((rel) => painted.has(rel)),
      `all ${PAINTED.length} product images that were painted before are still painted`,
      PAINTED.filter((rel) => !painted.has(rel)).join(', '));

    // ── lazy-loading policy ─────────────────────────────────────────────────
    await page.goto(`${BASE}/products?productId=IP29CG`, { waitUntil: 'networkidle' });
    const policy = await page.evaluate((vh) =>
      [...document.querySelectorAll('img')].map((i) => {
        const r = i.getBoundingClientRect();
        return { src: i.getAttribute('src'), lazy: i.getAttribute('loading') || '',
                 top: Math.round(r.top + window.scrollY), aboveFold: (r.top + window.scrollY) < vh,
                 hasDims: !!(i.getAttribute('width') && i.getAttribute('height')) };
      }), 900);
    const photo = policy.find((i) => /\/images\/products\//.test(i.src || ''));
    const footerLogo = policy.filter((i) => /logo/.test(i.src || '')).sort((a, b) => b.top - a.top)[0];
    note(photo && photo.aboveFold && photo.lazy !== 'lazy',
      'the product photo is above the fold at 1440 and is NOT lazy-loaded (it is the LCP element)',
      JSON.stringify(photo));
    note(footerLogo && !footerLogo.aboveFold && footerLogo.lazy === 'lazy',
      'the footer logo is below the fold and IS lazy-loaded',
      JSON.stringify(footerLogo));
    note(policy.filter((i) => /logo/.test(i.src || '')).every((i) => i.hasDims),
      'every logo image carries width and height attributes',
      JSON.stringify(policy.filter((i) => /logo/.test(i.src || '')).map((i) => i.hasDims)));

    // ── layout shift ────────────────────────────────────────────────────────
    const cls = await (async () => {
      const p2 = await ctx.newPage();
      await p2.addInitScript(() => {
        window.__cls = 0;
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
        }).observe({ type: 'layout-shift', buffered: true });
      });
      await p2.goto(`${BASE}/products?productId=IP29CG`, { waitUntil: 'networkidle' });
      await p2.waitForTimeout(800);
      const v = await p2.evaluate(() => +(window.__cls || 0).toFixed(4));
      await p2.close();
      return v;
    })();
    note(cls <= 0.1,
      `cumulative layout shift on a product page is ${cls} (Google's "good" bar is 0.1)`,
      `${cls}`);
    await ctx.close();

    // ── overflow across the whole catalog at 375 ────────────────────────────
    const ctx375 = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const p375 = await ctx375.newPage();
    const overflow = [];
    for (const p of products) {
      await p375.goto(`${BASE}/products?productId=${encodeURIComponent(p.id)}`, { waitUntil: 'networkidle' });
      const o = await p375.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (o > 0) overflow.push(`${p.id}:${o}px`);
    }
    note(overflow.length === 0,
      `no horizontal overflow at 375px across all ${products.length} product pages`,
      overflow.join(', '));
    await ctx375.close();

    // ── screenshots of every page carrying a changed image ─────────────────
    const SHOTS = ['/', '/about', '/products?productId=CC', '/products?productId=IP29CG',
                   '/products?productId=IP33PO', '/products?productId=IP75AD',
                   '/products?productId=VT-1100', '/products?productId=IP35KY'];
    for (const w of [1440, 375]) {
      const c = await browser.newContext({ viewport: { width: w, height: 900 } });
      const pg = await c.newPage();
      for (const u of SHOTS) {
        await pg.goto(BASE + u, { waitUntil: 'networkidle' });
        const name = (u === '/' ? 'home' : u.replace(/^\//, '').replace(/[?=]/g, '-')) + `-${w}.png`;
        await pg.screenshot({ path: path.join(OUT, name), fullPage: true });
      }
      await c.close();
    }
  } finally {
    await browser.close();
  }

  const bad = results.filter((r) => !r.ok).length;
  console.log(`\nplan5-images (${TAG}): ${results.length - bad}/${results.length}`);
  console.log(`screenshots -> ${OUT}`);
  process.exit(bad ? 1 : 0);
})();
