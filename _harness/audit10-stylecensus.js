/**
 * AUDIT-10 pass-5 step 5.1 — computed-style census.
 *
 * For every public page (10 routes + 3 dashboard family views + all 42
 * product pages) and every admin GET page (signed in, plus the signed-out
 * login) at desktop-1440 and mobile-390, walk all rendered elements and
 * collect the computed {color, backgroundColor, borderColor, fontFamily,
 * fontSize, fontWeight, lineHeight, borderRadius, boxShadow, letterSpacing}
 * for every element that paints text or a visible box.
 *
 * Aggregation is value -> {count, pages, example selectors, class
 * signatures}; rgb strings are the browser's own computed form so they are
 * already normalised. transparent backgrounds, zero-width borders,
 * borderRadius 0, boxShadow none and letterSpacing normal are dropped as
 * noise per the pass file.
 *
 * Extras the later steps need (all derived from the same walk, no second
 * measurement): fontSize|fontWeight pairs (5.4), fontSize|lineHeight pairs
 * (5.4 outliers), borderRadius + boxShadow keyed by class signature (5.5),
 * borderColor|ownBackground pairs (5.5), background-image strings and svg
 * fill/stroke (5.2 source mapping).
 *
 * Output: plans/audit10/state/stylecensus.json (tracked, committed).
 * Usage:  node _harness/audit10-stylecensus.js     (mirror on :8123)
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PASS = 'audit-pass-123';
const OUTFILE = path.join(__dirname, '..', 'plans', 'audit10', 'state', 'stylecensus.json');

const products = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'pristine', 'products-all.json'), 'utf8')
);

const VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'mobile-390', width: 390, height: 844 },
];

const PUBLIC_ROUTES = [
  '/', '/products', '/services', '/industries', '/about',
  '/contact', '/dashboard', '/datasheets', '/faq', '/privacy',
];
const FAMILY_VIEWS = ['Tape', 'Heat Shrink Tubing', 'Adhesive']
  .map((f) => '/dashboard?family=' + encodeURIComponent(f));
const ADMIN_PAGES = [
  '/admin/index.php', '/admin/content.php', '/admin/settings.php',
  '/admin/add.php', '/admin/edit.php?id=CC', '/admin/backups.php',
  '/admin/password.php', '/admin/inquiries.php', '/admin/audit-log.php',
  '/admin/help.php',
];

/** Browser-side walk. Returns { prop: { value: {n, sigs:{sig:n}, sel:[..]} } } */
const COLLECT = () => {
  const agg = {};
  const add = (prop, value, sig, sel) => {
    if (!value) return;
    const p = (agg[prop] = agg[prop] || {});
    const e = (p[value] = p[value] || { n: 0, sigs: {}, sel: [] });
    e.n++;
    if (Object.keys(e.sigs).length < 12 || e.sigs[sig] !== undefined)
      e.sigs[sig] = (e.sigs[sig] || 0) + 1;
    if (e.sel.length < 3 && !e.sel.includes(sel)) e.sel.push(sel);
  };
  const sig = (el) => {
    const cls = el.className && typeof el.className === 'string'
      ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
    return el.tagName.toLowerCase() + cls;
  };
  const selector = (el) => {
    const parts = [];
    let n = el;
    for (let d = 0; n && n !== document.body && d < 3; d++, n = n.parentElement) {
      parts.unshift(sig(n) + (n.id ? '#' + n.id : ''));
    }
    return parts.join('>');
  };
  const alpha = (c) => {
    const m = /rgba?\([\d.\s]+,[\d.\s]+,[\d.\s]+(?:,\s*([\d.]+))?\)/.exec(c || '');
    return m ? (m[1] === undefined ? 1 : +m[1]) : 0;
  };
  let scanned = 0;
  for (const el of document.querySelectorAll('body *')) {
    if (!el.getClientRects().length) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility !== 'visible') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 && r.height < 1) continue;
    scanned++;
    const s = sig(el), sl = selector(el);

    // SVG shape paints — separate namespace so icon fills don't pollute text ink.
    if (el.namespaceURI === 'http://www.w3.org/2000/svg') {
      if (el.tagName.toLowerCase() !== 'svg') {
        const f = cs.fill, st = cs.stroke;
        if (f && f !== 'none' && alpha(f) > 0) add('svgFill', f, s, sl);
        if (st && st !== 'none' && alpha(st) > 0 && parseFloat(cs.strokeWidth) > 0)
          add('svgStroke', st, s, sl);
      }
      continue;
    }

    // Own text?
    let hasText = false;
    for (const n of el.childNodes)
      if (n.nodeType === 3 && n.textContent.trim()) { hasText = true; break; }

    if (hasText && alpha(cs.color) > 0) {
      add('color', cs.color, s, sl);
      add('fontFamily', cs.fontFamily, s, sl);
      add('fontSize', cs.fontSize, s, sl);
      add('fontWeight', cs.fontWeight, s, sl);
      add('lineHeight', cs.fontSize + '|' + cs.lineHeight, s, sl);
      add('typePair', cs.fontSize + '|' + cs.fontWeight, s, sl);
      if (cs.letterSpacing !== 'normal') add('letterSpacing', cs.letterSpacing, s, sl);
    }

    // Visible box?
    const bgA = alpha(cs.backgroundColor);
    if (bgA > 0) add('backgroundColor', cs.backgroundColor, s, sl);
    if (cs.backgroundImage && cs.backgroundImage !== 'none')
      add('backgroundImage', cs.backgroundImage.slice(0, 300), s, sl);

    const sides = [
      ['Top', cs.borderTopWidth, cs.borderTopStyle, cs.borderTopColor],
      ['Right', cs.borderRightWidth, cs.borderRightStyle, cs.borderRightColor],
      ['Bottom', cs.borderBottomWidth, cs.borderBottomStyle, cs.borderBottomColor],
      ['Left', cs.borderLeftWidth, cs.borderLeftStyle, cs.borderLeftColor],
    ];
    const seen = new Set();
    let bordered = false;
    for (const [, w, st, c] of sides) {
      if (parseFloat(w) > 0 && st !== 'none' && alpha(c) > 0) {
        bordered = true;
        if (!seen.has(c)) {
          seen.add(c);
          add('borderColor', c, s, sl);
          add('borderCtx', c + '|on|' + (bgA > 0 ? cs.backgroundColor : 'transparent'), s, sl);
        }
      }
    }

    const paintsBox = bgA > 0 || bordered || cs.boxShadow !== 'none' ||
      (cs.backgroundImage && cs.backgroundImage !== 'none');
    if (paintsBox && cs.borderRadius && cs.borderRadius !== '0px')
      add('borderRadius', cs.borderRadius, s, sl);
    if (cs.boxShadow !== 'none') add('boxShadow', cs.boxShadow, s, sl);
  }
  return { agg, scanned, bodyFont: getComputedStyle(document.body).fontFamily };
};

function mergeInto(global, pageKey, { agg }) {
  for (const prop of Object.keys(agg)) {
    const g = (global[prop] = global[prop] || {});
    for (const [value, e] of Object.entries(agg[prop])) {
      const t = (g[value] = g[value] || { count: 0, pages: [], pageCount: 0, sigs: {}, selectors: [] });
      t.count += e.n;
      t.pageCount++;
      if (t.pages.length < 10 && !t.pages.includes(pageKey)) t.pages.push(pageKey);
      for (const [s, n] of Object.entries(e.sigs)) {
        if (Object.keys(t.sigs).length < 16 || t.sigs[s] !== undefined)
          t.sigs[s] = (t.sigs[s] || 0) + n;
      }
      for (const sel of e.sel)
        if (t.selectors.length < 3 && !t.selectors.includes(sel)) t.selectors.push(sel);
    }
  }
}

async function settleAndCollect(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 15));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(350);
  return page.evaluate(COLLECT);
}

(async () => {
  const browser = await launch();
  const global = {};
  const pageMeta = [];
  const publicUrls = [
    ...PUBLIC_ROUTES,
    ...FAMILY_VIEWS,
    ...products.map((p) => '/products?productId=' + encodeURIComponent(p.id)),
  ];

  for (const vp of VIEWPORTS) {
    // Public.
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    for (const url of publicUrls) {
      const key = vp.name + ' ' + url;
      try {
        await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 });
        const res = await settleAndCollect(page);
        mergeInto(global, key, res);
        pageMeta.push({ page: key, scanned: res.scanned, bodyFont: res.bodyFont });
      } catch (e) {
        pageMeta.push({ page: key, error: String(e).slice(0, 200) });
      }
      process.stdout.write('.');
    }
    await ctx.close();

    // Admin signed-out login, then signed-in pages.
    const actx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const apage = await actx.newPage();
    try {
      await apage.goto(BASE + '/admin/', { waitUntil: 'networkidle', timeout: 45000 });
      const res = await settleAndCollect(apage);
      mergeInto(global, vp.name + ' /admin/ (login)', res);
      pageMeta.push({ page: vp.name + ' /admin/ (login)', scanned: res.scanned, bodyFont: res.bodyFont });
      if (await apage.$('input[type="password"]')) {
        await apage.fill('input[type="password"]', PASS);
        await Promise.all([apage.waitForNavigation(), apage.click('button[type="submit"], input[type="submit"]')]);
      }
      for (const url of ADMIN_PAGES) {
        const key = vp.name + ' ' + url;
        try {
          await apage.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 });
          const res = await settleAndCollect(apage);
          mergeInto(global, key, res);
          pageMeta.push({ page: key, scanned: res.scanned, bodyFont: res.bodyFont });
        } catch (e) {
          pageMeta.push({ page: key, error: String(e).slice(0, 200) });
        }
        process.stdout.write('.');
      }
    } catch (e) {
      pageMeta.push({ page: vp.name + ' /admin/*', error: String(e).slice(0, 200) });
    }
    await actx.close();
    console.log(` ${vp.name} done`);
  }
  await browser.close();

  const counts = {};
  for (const prop of Object.keys(global)) counts[prop] = Object.keys(global[prop]).length;
  const out = {
    $schema_note: 'AUDIT-10 pass-5 computed-style census. value -> {count: total elements, pageCount: pages seen on, pages: first 10, sigs: class-signature histogram (first 16), selectors: up to 3 examples}. lineHeight and typePair values are "fontSize|x" composites. borderCtx is "borderColor|on|ownBackground".',
    generated: new Date().toISOString().slice(0, 10),
    base: BASE,
    viewports: VIEWPORTS.map((v) => v.name),
    pagesPlanned: (publicUrls.length + 1 + ADMIN_PAGES.length) * VIEWPORTS.length,
    pagesCaptured: pageMeta.filter((p) => !p.error).length,
    errors: pageMeta.filter((p) => p.error),
    distinctValueCounts: counts,
    census: global,
  };
  fs.writeFileSync(OUTFILE, JSON.stringify(out, null, 1));
  console.log('\npages captured: ' + out.pagesCaptured + '/' + out.pagesPlanned);
  console.log('distinct values: ' + JSON.stringify(counts));
  console.log('-> ' + OUTFILE);
})();
