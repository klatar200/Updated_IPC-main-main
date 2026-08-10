/**
 * AUDIT-10 pass-2 — stacking order at tablet-834 and mobile-390.
 *
 * Two questions the rubric asks:
 *   1. do multi-column sections stack in a sensible READING order once they
 *      collapse to one column? (DOM order vs painted order — an `order:`,
 *      `flex-direction: column-reverse` or `grid-row` that reverses a pair is
 *      invisible at desktop and wrong on a phone)
 *   2. are any labels orphaned from their content — a <label>, <dt> or an
 *      eyebrow/heading whose value ends up in a different visual row than the
 *      thing it names?
 *
 * Also records, per page, whether each top-level section is genuinely single
 * column at these widths (a desktop grid "crushed into 834px" is the tablet-834
 * failure class the pass file names).
 *
 * Usage: node _harness/audit10-p2stack.js   (needs :8123)
 * Output: _harness/out/audit10/p2stack.json
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
  { name: 'tablet-834', width: 834, height: 1112 },
  { name: 'mobile-390', width: 390, height: 844 },
];
const URLS = [
  '/', '/products', '/services', '/industries', '/about',
  '/contact', '/dashboard', '/datasheets', '/faq', '/privacy',
  '/products?productId=' + encodeURIComponent(products[0].id),
  '/products?productId=IP38FE',
  '/products?productId=IP75AD',
];

const measure = () => {
  const sig = (el) => {
    const cls = typeof el.className === 'string' && el.className.trim()
      ? '.' + el.className.trim().split(/\s+/).slice(0, 4).join('.') : '';
    return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + cls;
  };
  const txt = (el) => (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 45);

  // ── DOM order vs painted order inside every flex/grid container ──────────
  const reorders = [];
  const multiCol = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (!/flex|grid/.test(cs.display)) continue;
    const kids = [...el.children].filter((c) => {
      const r = c.getBoundingClientRect();
      const k = getComputedStyle(c);
      return r.width > 2 && r.height > 2 && k.display !== 'none' && k.position !== 'absolute' && k.position !== 'fixed';
    });
    if (kids.length < 2) continue;
    const rects = kids.map((c, i) => {
      const r = c.getBoundingClientRect();
      return { i, top: r.top + window.scrollY, left: r.left, right: r.right, text: txt(c), order: getComputedStyle(c).order };
    });
    // painted reading order: top first, then left
    const painted = [...rects].sort((a, b) => (Math.abs(a.top - b.top) > 4 ? a.top - b.top : a.left - b.left));
    const swapped = painted.map((p) => p.i).some((v, idx) => v !== idx);
    if (swapped) {
      reorders.push({
        container: sig(el), display: cs.display, flexDirection: cs.flexDirection,
        domOrder: rects.map((r) => r.text),
        paintedOrder: painted.map((r) => r.text),
        orders: rects.map((r) => r.order),
      });
    }
    // is this container still laying children side by side at this width?
    const rows = new Map();
    for (const r of rects) {
      const key = Math.round(r.top / 8);
      rows.set(key, (rows.get(key) || 0) + 1);
    }
    const maxPerRow = Math.max(...rows.values());
    if (maxPerRow > 1) {
      const narrowest = Math.min(...rects.map((r) => r.right - r.left));
      multiCol.push({
        container: sig(el), display: cs.display, cols: maxPerRow,
        gridTemplateColumns: cs.gridTemplateColumns,
        narrowestChildPx: +narrowest.toFixed(1),
        kids: rects.length,
        sample: rects.slice(0, 3).map((r) => r.text),
      });
    }
  }

  // ── orphaned labels: a label/dt whose control or value is on another row ──
  const orphans = [];
  for (const el of document.querySelectorAll('label, dt, th[scope="row"]')) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    let partner = null;
    if (el.tagName === 'LABEL') {
      partner = el.control || (el.htmlFor ? document.getElementById(el.htmlFor) : el.querySelector('input,select,textarea'));
    } else if (el.tagName === 'DT') {
      partner = el.nextElementSibling && el.nextElementSibling.tagName === 'DD' ? el.nextElementSibling : null;
    } else {
      partner = el.nextElementSibling;
    }
    if (!partner) continue;
    const pr = partner.getBoundingClientRect();
    if (pr.width < 2 || pr.height < 2) continue;
    const gap = pr.top - r.bottom;
    if (gap > 40 || pr.top < r.top - 4) {
      orphans.push({ label: txt(el), partner: partner.tagName.toLowerCase(), gap: +gap.toFixed(1) });
    }
  }

  return {
    reorders, multiCol, orphans,
    vw: document.documentElement.clientWidth,
  };
};

(async () => {
  const browser = await launch();
  const rows = [];
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    for (const url of URLS) {
      await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 });
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 15)); }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(300);
      rows.push({ url, viewport: vp.name, ...(await page.evaluate(measure)) });
      process.stdout.write('.');
    }
    await ctx.close();
    console.log(` ${vp.name} done`);
  }
  await browser.close();
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'p2stack.json'), JSON.stringify(rows, null, 1));

  console.log('\n== DOM-vs-painted reorders ==');
  let n = 0;
  for (const r of rows) for (const x of r.reorders) {
    n++;
    console.log(`  ${r.viewport} ${r.url} :: ${x.container} (${x.display}/${x.flexDirection}) orders=${JSON.stringify(x.orders)}`);
    console.log(`     dom:     ${JSON.stringify(x.domOrder)}`);
    console.log(`     painted: ${JSON.stringify(x.paintedOrder)}`);
  }
  if (!n) console.log('  none');

  console.log('\n== containers still multi-column, narrowest child < 200px ==');
  let m = 0;
  for (const r of rows) for (const x of r.multiCol) {
    if (x.narrowestChildPx >= 200) continue;
    m++;
    console.log(`  ${r.viewport} ${r.url} :: ${x.container} cols=${x.cols} narrowest=${x.narrowestChildPx}px tpl=${x.gridTemplateColumns} sample=${JSON.stringify(x.sample)}`);
  }
  if (!m) console.log('  none');

  console.log('\n== orphaned labels ==');
  let o = 0;
  for (const r of rows) for (const x of r.orphans) { o++; console.log(`  ${r.viewport} ${r.url} :: "${x.label}" -> ${x.partner} gap=${x.gap}px`); }
  if (!o) console.log('  none');
  console.log(`-> ${path.join(OUT, 'p2stack.json')}`);
})();
