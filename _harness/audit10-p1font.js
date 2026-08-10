/**
 * AUDIT-10 pass-1 font control for the spec-table overflow claim.
 *
 * guardrails.json evidence_standards.font_caveat: this box resolves system-ui
 * to DejaVu Sans, which is materially wider than the Segoe/Helvetica metrics
 * the site actually ships against, and `plan8-polish`'s "no spec table scrolls
 * horizontally at 1440" red is a KNOWN artifact of exactly that. So no width
 * or overflow claim may become a finding until it has been re-measured under a
 * narrower, metric-standard face.
 *
 * Liberation Sans is installed here and is metric-compatible with Arial, i.e.
 * it is a fair stand-in for the real-world rendering. This probe measures each
 * product page's SpecTable2 scroller twice — once as shipped (DejaVu), once
 * with the whole document forced to Liberation Sans — and reports the overflow
 * under both. An overflow that survives the narrow face is structural; one that
 * disappears is the C49 artifact and is NOT a finding.
 *
 * Output: _harness/out/audit10/p1font.json  (gitignored)
 * Usage:  node _harness/audit10-p1font.js
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'audit10');
const products = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'pristine', 'products-all.json'), 'utf8')
);
const VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'tablet-1024', width: 1024, height: 768 },
];

/* eslint-disable no-undef */
function readScroller() {
  const R = (n) => Math.round(n * 10) / 10;
  const found = [];
  for (const el of document.querySelectorAll('div')) {
    const cs = getComputedStyle(el);
    if (cs.overflowX !== 'auto' && cs.overflowX !== 'scroll') continue;
    if (!el.querySelector('table')) continue;
    const r = el.getBoundingClientRect();
    const t = el.querySelector('table');
    found.push({
      boxW: R(r.width), scrollW: R(el.scrollWidth), cut: R(el.scrollWidth - el.clientWidth),
      tableW: R(t.getBoundingClientRect().width),
      cols: t.querySelector('tr') ? t.querySelector('tr').children.length : null,
      font: cs.fontFamily.slice(0, 40),
    });
  }
  return found;
}
/* eslint-enable no-undef */

const FORCE = `*, *::before, *::after { font-family: "Liberation Sans", sans-serif !important; }`;

(async () => {
  const browser = await launch();
  const rows = [];
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    for (const p of products) {
      const url = '/products?productId=' + encodeURIComponent(p.id);
      try {
        await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 });
        await page.waitForTimeout(350);
        const shipped = await page.evaluate(readScroller);
        await page.addStyleTag({ content: FORCE });
        await page.waitForTimeout(350);
        const narrow = await page.evaluate(readScroller);
        rows.push({ id: p.id, url, viewport: vp.name, shipped, narrow });
      } catch (e) {
        rows.push({ id: p.id, url, viewport: vp.name, error: String(e).slice(0, 200) });
      }
      process.stdout.write('.');
    }
    await ctx.close();
    console.log(' ' + vp.name + ' done');
  }
  await browser.close();
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'p1font.json'), JSON.stringify(rows, null, 1));
  console.log('rows: ' + rows.length + ' -> _harness/out/audit10/p1font.json');
})();
