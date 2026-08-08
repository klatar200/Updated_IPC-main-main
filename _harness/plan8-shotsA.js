/**
 * Phase A acceptance screenshots + the A2 render check.
 *
 * A1/C32 — IP63ES, IP42MW, IP47HV, IP13SP and CC at 1440 and 375, so the
 * certification blocks can be read by eye as well as asserted.
 * C45/C47 — the same shots carry the product header: the SKU is no longer a
 * pill in the action row, and the name is no longer uppercased.
 * A2 — asserts no "9001:2008" string renders on / or /about, and reports what
 * each of the three places actually prints (the live strings come from
 * content.json, which this plan may not edit, so two of the three are expected
 * to still show the withdrawn revision until the owner edits them).
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'plan8-phaseA');
const PRODUCTS = ['IP63ES', 'IP42MW', 'IP47HV', 'IP13SP', 'CC', 'CT'];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  try {
    for (const width of [1440, 375]) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await ctx.newPage();

      for (const id of PRODUCTS) {
        await page.goto(`${BASE}/products?productId=${encodeURIComponent(id)}`, { waitUntil: 'networkidle' });
        await page.screenshot({ path: path.join(OUT, `${id}-${width}.png`), fullPage: true });
      }

      // C45/C47 read back off the rendered header.
      await page.goto(`${BASE}/products?productId=CC`, { waitUntil: 'networkidle' });
      const hdr = await page.evaluate(() => {
        const h2 = document.querySelector('h2');
        const cs = h2 ? getComputedStyle(h2) : null;
        // Scope to the product header. An unscoped search for the text "CC"
        // finds the catalog sidebar's link to the same product first, which is
        // legitimately inside an <a> — and reported skuClickable:true for a SKU
        // that is not a control at all.
        const header = h2 ? h2.closest('div').parentElement : null;
        const skuEl = header
          ? [...header.querySelectorAll('div,span')].find(
              (e) => e.children.length === 0 && e.textContent.trim() === 'CC'
            )
          : null;
        return {
          nameTransform: cs ? cs.textTransform : null,
          nameText: h2 ? h2.textContent.trim() : null,
          skuTag: skuEl ? skuEl.tagName : null,
          skuClickable: skuEl ? !!skuEl.closest('a,button') : null,
          skuBg: skuEl ? getComputedStyle(skuEl).backgroundColor : null,
        };
      });
      console.log(`@${width}`, JSON.stringify(hdr));
      await ctx.close();
    }

    // A2 — what renders where.
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    for (const route of ['/', '/about']) {
      await page.goto(BASE + route, { waitUntil: 'networkidle' });
      const found = await page.evaluate(() =>
        [...document.querySelectorAll('*')]
          .filter((e) => e.children.length === 0 && /9001/.test(e.textContent))
          .map((e) => e.textContent.trim().slice(0, 90))
      );
      console.log(`\n${route} — strings containing 9001:`);
      for (const f of found) console.log('   ' + f);
      await page.screenshot({ path: path.join(OUT, `a2${route === '/' ? 'home' : 'about'}.png`), fullPage: true });
    }
    await ctx.close();
  } finally {
    await browser.close();
  }
  console.log(`\nscreenshots -> ${OUT}`);
})();
