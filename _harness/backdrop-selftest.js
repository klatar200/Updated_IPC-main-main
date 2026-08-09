/**
 * PLAN-7 item 1c — proof that the raster blind spot is closed, and that it was
 * real.
 *
 * `_harness/backdrop.js` is the shared contrast core behind `brandtext.js`,
 * `plan5c-eyebrow.js` and `plan5c-brandink.js`. Its layer walk did
 * `if (!g) continue;` for any layer `parseLinear` could not read — every
 * `url()`, `radial-gradient`, `conic-gradient` and `image-set()`. It then
 * composited the layers it DID understand over whatever sat BELOW the
 * unreadable one and returned a confident number for a background no visitor
 * ever sees.
 *
 * A check that has never failed proves nothing (GUARDRAILS §4.4), so this file
 * does not merely assert the new flag exists. It builds the exact situation the
 * bug needs and shows the two answers DISAGREE:
 *
 *   a white headline over a photograph that is mostly black but has a white
 *   blowout in one corner, sitting on a black parent.
 *
 *   - gradient maths sees no readable layer, skips it, and reports the BLACK
 *     parent: white on black, ~21:1, a comfortable pass.
 *   - the real worst pixel under the ink is the white blowout: ~1:1, illegible.
 *
 * If those two ever agree, the pixel read is not reaching the photo and the
 * whole primitive is theatre.
 *
 * Self-contained: the "photograph" is a generated data URI, so this needs no
 * fixture, no network and no site route.
 *
 * Usage: node _harness/backdrop-selftest.js
 */

const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');
const { SOURCE, ratio, worstPixel, skippedLayers } = require('./backdrop');

const OUT = path.join(__dirname, 'out', 'plan7');

const results = [];
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : '\n       → ' + detail}`);
};

/**
 * A 40x40 PNG: black everywhere except a white 8x8 square in the top-left.
 * Built in the browser with a canvas so this file carries no binary blob and
 * no encoder dependency.
 */
const MAKE_PHOTO = `(() => {
  const c = document.createElement('canvas');
  c.width = 40; c.height = 40;
  const x = c.getContext('2d');
  x.fillStyle = '#000000'; x.fillRect(0, 0, 40, 40);
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 8, 8);   // the blowout
  return c.toDataURL('image/png');
})()`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 800, height: 600 } });
  const page = await ctx.newPage();

  await page.setContent(`<!doctype html><html><body style="margin:0">
    <div id="host" style="background:#000000; padding:0">
      <p id="ink" style="margin:0; color:#ffffff; font:700 20px/1.2 sans-serif; width:200px">HEADLINE</p>
    </div>
  </body></html>`);
  await page.evaluate(SOURCE);

  // ── control: no raster layer anywhere ───────────────────────────────────
  const cleanSkips = await skippedLayers(page);
  note(cleanSkips.length === 0,
    'control: a page with no raster background records no skipped layer',
    JSON.stringify(cleanSkips.slice(0, 2)));

  const inkEl = await page.$('#ink');
  const cleanBack = await page.evaluate((el) => window.__ipcBackdrop(el), inkEl);
  note(ratio([255, 255, 255], cleanBack[0]) > 20,
    'control: white on the black parent scores ~21:1 by gradient maths',
    `${ratio([255, 255, 255], cleanBack[0]).toFixed(2)}:1 on rgb(${cleanBack[0].join(',')})`);

  // ── now put a photograph behind the text ────────────────────────────────
  const photo = await page.evaluate(MAKE_PHOTO);
  await page.evaluate((uri) => {
    const h = document.getElementById('host');
    // Exactly the shape item 2 was about to ship: an image layer under a
    // scrim, on an element whose own background is opaque.
    h.style.backgroundImage = `linear-gradient(135deg, rgba(20,20,20,0.0) 0%, rgba(20,20,20,0.0) 100%), url("${uri}")`;
    h.style.backgroundSize = 'cover';
    h.style.backgroundRepeat = 'no-repeat';
  }, photo);
  await page.waitForTimeout(120);

  // The old behaviour, demonstrated: gradient maths still reports a pass.
  // This call is also what POPULATES the skip list — the flag records what the
  // walk hit, so it has to run before the list is read.
  const back = await page.evaluate((el) => window.__ipcBackdrop(el), inkEl);

  // 1a — the skip is loud.
  const skips = await skippedLayers(page);
  const sawUrl = skips.some((s) => /url\(/.test(s.layer));
  note(sawUrl,
    '1a: a url() background layer is RECORDED as skipped, not silently dropped',
    `skips=${JSON.stringify(skips.slice(0, 2))}`);

  const gradientSays = Math.min(
    ratio([255, 255, 255], back[0]),
    ratio([255, 255, 255], back[1])
  );
  note(gradientSays > 10,
    '1c: gradient maths still reports a comfortable PASS over the photo — this is the bug',
    `${gradientSays.toFixed(2)}:1 against rgb(${back[0].join(',')}) — the parent, not the photo`);

  // 1b — the pixel read finds the blowout the gradient walk cannot see.
  const worst = await worstPixel(page, inkEl, 'light');
  note(!!worst && worst.px !== null, '1b: worstPixel() returned a pixel', JSON.stringify(worst));

  const pixelSays = worst ? ratio([255, 255, 255], worst.px) : null;
  note(pixelSays !== null && pixelSays < 2,
    '1b: the worst pixel actually under the ink is the white blowout — white on it FAILS',
    `${pixelSays === null ? 'n/a' : pixelSays.toFixed(2)}:1 against rgb(${worst && worst.px ? worst.px.join(',') : '?'})`);

  // The whole point: the two answers must disagree.
  note(pixelSays !== null && gradientSays - pixelSays > 8,
    '1c: the two methods DISAGREE by a wide margin — the pixel read is reaching the photo',
    `gradient ${gradientSays.toFixed(2)}:1 vs pixel ${pixelSays === null ? 'n/a' : pixelSays.toFixed(2)}:1`);

  // Mean-versus-worst: the reason worst is the right statistic. The photo is
  // 96% black, so a mean would pass comfortably.
  const meanSays = await page.evaluate(async ([uri]) => {
    const img = new Image();
    await new Promise((r) => { img.onload = r; img.src = uri; });
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let s = [0, 0, 0], n = 0;
    for (let i = 0; i < d.length; i += 4) { s[0] += d[i]; s[1] += d[i + 1]; s[2] += d[i + 2]; n++; }
    return s.map((v) => Math.round(v / n));
  }, [photo]);
  note(ratio([255, 255, 255], meanSays) > 10,
    '1b: the MEAN of the same photo would have passed — which is why worst is the statistic',
    `mean rgb(${meanSays.join(',')}) = ${ratio([255, 255, 255], meanSays).toFixed(2)}:1`);

  // ── the live site must record no skips at all ───────────────────────────
  // Today nothing on the site has a raster background. When item 2 ships one,
  // this flips and the suites that consume backdrop.js have to move to
  // worstPixel() for those elements. Asserted so the transition is noticed.
  const site = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const sp = await site.newPage();
  const liveSkips = [];
  for (const route of ['/', '/about', '/services', '/industries']) {
    await sp.goto('http://127.0.0.1:8123' + route, { waitUntil: 'networkidle' });
    await sp.evaluate(SOURCE);
    await sp.evaluate(() => {
      for (const el of document.querySelectorAll('h1,h2,h3,p,span,a,div')) {
        if (!el.getClientRects().length) continue;
        const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (own) window.__ipcBackdrop(el);
      }
    });
    const s = await skippedLayers(sp);
    if (s.length) liveSkips.push({ route, count: s.length, first: s[0] });
  }
  note(liveSkips.length === 0,
    'the live site currently paints no raster background behind text (4 routes swept)',
    JSON.stringify(liveSkips.slice(0, 2)));
  await site.close();

  await ctx.close();
  await browser.close();

  const pass = results.filter((r) => r.ok).length;
  console.log(`\nbackdrop-selftest ${pass}/${results.length}`);
  fs.writeFileSync(path.join(OUT, 'backdrop-selftest.json'), JSON.stringify(results, null, 2));
  process.exit(pass === results.length ? 0 : 1);
})();
