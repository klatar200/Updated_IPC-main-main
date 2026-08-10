/**
 * AUDIT-10 pass-1 product-sidebar visibility probe.
 *
 * The catalog rail (`ProductSidebar`, the lg+ branch) is a fixed-height scroll
 * box: `max-height: 80vh; overflow-y: auto`. B27 collapsed every family except
 * the one holding the selected product, and an effect opens the selected
 * family — but nothing ever scrolls the box to the selected ROW. When the
 * selected product sits below the fold of that 718px window the visitor gets a
 * catalog rail with no active state at all on the page they are standing on.
 *
 * Measured here, per product page, at both large viewports:
 *   box.clientHeight / scrollHeight / scrollTop
 *   the active row (matched on ?productId= in its href, not on text — the
 *   sidebar truncates names with an ellipsis so text matching under-reports)
 *   whether that row is fully visible, partly clipped, or entirely below the fold
 *   any row straddling the box's bottom edge (a line of text sliced in half)
 *
 * Two navigations per page; the probe reports whether both runs agree.
 *
 * Output: _harness/out/audit10/p1sidebar.json  (gitignored)
 * Usage:  node _harness/audit10-p1sidebar.js
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
function measureSidebar(wantId) {
  const R = (n) => Math.round(n * 10) / 10;
  const aside = document.querySelector('aside');
  if (!aside) return { error: 'no aside' };
  let box = null;
  for (const el of aside.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.getBoundingClientRect().height > 100) {
      box = el; break;
    }
  }
  if (!box) return { error: 'no scroll box' };
  const r = box.getBoundingClientRect();
  const links = [...box.querySelectorAll('a[href]')];
  let active = null;
  for (const a of links) {
    const href = a.getAttribute('href') || '';
    const q = href.includes('?') ? href.slice(href.indexOf('?') + 1) : '';
    const pid = new URLSearchParams(q).get('productId');
    if (pid === wantId) { active = a; break; }
  }
  const out = {
    clientH: R(box.clientHeight), scrollH: R(box.scrollHeight), scrollTop: R(box.scrollTop),
    hiddenPx: R(box.scrollHeight - box.clientHeight),
    maxH: getComputedStyle(box).maxHeight,
    linkCount: links.length,
    familyHeadings: box.querySelectorAll('[data-testid="family-heading"]').length,
    headingsBelowFold: [...box.querySelectorAll('[data-testid="family-heading"]')]
      .filter((h) => h.getBoundingClientRect().top >= r.bottom).length,
    rowsSlicedByBottomEdge: links.filter((a) => {
      const ar = a.getBoundingClientRect();
      return ar.top < r.bottom - 0.5 && ar.bottom > r.bottom + 0.5;
    }).map((a) => (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 44)),
    active: null,
  };
  if (active) {
    const ar = active.getBoundingClientRect();
    out.active = {
      text: (active.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 44),
      topInBox: R(ar.top - r.top),
      h: R(ar.height),
      fullyVisible: ar.top >= r.top - 0.5 && ar.bottom <= r.bottom + 0.5,
      anyPixelVisible: ar.bottom > r.top + 0.5 && ar.top < r.bottom - 0.5,
      pxBelowFold: R(Math.max(0, ar.bottom - r.bottom)),
    };
  }
  return out;
}
/* eslint-enable no-undef */

(async () => {
  const browser = await launch();
  const runs = [[], []];
  for (let pass = 0; pass < 2; pass++) {
    for (const vp of VIEWPORTS) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      for (const p of products) {
        const url = '/products?productId=' + encodeURIComponent(p.id);
        try {
          await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 });
          await page.waitForTimeout(350);
          runs[pass].push({ id: p.id, url, viewport: vp.name, ...(await page.evaluate(measureSidebar, p.id)) });
        } catch (e) {
          runs[pass].push({ id: p.id, url, viewport: vp.name, error: String(e).slice(0, 200) });
        }
      }
      await ctx.close();
      process.stdout.write(`pass${pass + 1}:${vp.name} `);
    }
  }
  await browser.close();
  const same = JSON.stringify(runs[0]) === JSON.stringify(runs[1]);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'p1sidebar.json'), JSON.stringify({ identicalAcrossRuns: same, run1: runs[0], run2: runs[1] }, null, 1));
  console.log('\nidentical across two navigations: ' + same);
  console.log('rows/run: ' + runs[0].length + ' -> _harness/out/audit10/p1sidebar.json');
})();
