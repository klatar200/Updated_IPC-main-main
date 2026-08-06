/**
 * Which elements are painted with the brand primary and what sets their color?
 * Diagnostic for the plan2-contrast.js failures.
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PW = 'audit-pass-123';
const MIRROR_SITE = path.join(__dirname, 'site/data/site-info.json');
const PRISTINE_SITE = path.join(__dirname, 'pristine/site-info.json');

const PRIMARY = '#1ABC9C';

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/admin/auth.php`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="password"]', PW);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('domcontentloaded');
  await page.goto(`${BASE}/admin/settings.php`, { waitUntil: 'domcontentloaded' });
  for (const [id, v] of [['theme_primary', PRIMARY], ['theme_dark', '#16A085'], ['theme_accent2', '#48C9B0']]) {
    await page.$eval(`#${id}`, (el, val) => { el.value = val; el.dispatchEvent(new Event('change', { bubbles: true })); }, v);
  }
  await Promise.all([page.waitForLoadState('domcontentloaded'), page.click('button:has-text("Save")')]);

  for (const vp of [{ w: 1440 }, { w: 375 }]) {
    const pctx = await browser.newContext({ viewport: { width: vp.w, height: 812 } });
    const pub = await pctx.newPage();
    await pub.goto(`${BASE}/products`, { waitUntil: 'networkidle' });
    const rows = await pub.evaluate((hex) => {
      const n = parseInt(hex.replace('#', ''), 16);
      const want = `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
      const out = [];
      for (const el of document.querySelectorAll('*')) {
        const cs = getComputedStyle(el);
        if (cs.backgroundColor !== want) continue;
        if (!el.innerText || !el.innerText.trim()) continue;
        out.push({
          tag: el.tagName,
          cls: el.className && el.className.toString().slice(0, 60),
          color: cs.color,
          inlineColor: el.style.color || '(none)',
          text: el.innerText.trim().replace(/\s+/g, ' ').slice(0, 40),
        });
      }
      return out;
    }, PRIMARY);
    console.log(`\n=== ${vp.w}px — ${rows.length} elements painted with ${PRIMARY} ===`);
    for (const r of rows) {
      console.log(`  <${r.tag}> color=${r.color} inline=${r.inlineColor}\n      class="${r.cls}"\n      "${r.text}"`);
    }
    await pctx.close();
  }

  await browser.close();
  fs.copyFileSync(PRISTINE_SITE, MIRROR_SITE);
  for (const f of fs.readdirSync(path.dirname(MIRROR_SITE))) {
    if (/^site-info\.backup\./.test(f)) fs.unlinkSync(path.join(path.dirname(MIRROR_SITE), f));
  }
  console.log('\nrestored site-info.json');
})();
