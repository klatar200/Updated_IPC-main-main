/**
 * AUDIT-10 pass-3 — numeric sweep of every admin GET page at all four
 * viewports. Screenshots are leads; these are the measurements.
 *
 * Per page x viewport it measures:
 *   labels        every form control's label association via el.labels (the
 *                 same relationship a click on the label uses), plus every
 *                 <label for=...> whose target does not exist
 *   clipped       elements whose scrollWidth exceeds clientWidth while their
 *                 computed overflow hides the remainder — i.e. text cut off
 *   protruding    elements painting past the right edge of the viewport
 *   escaping      elements painting past the right edge of their own <main>
 *   tables        every table: own width vs its scroll container, and whether
 *                 that container can actually scroll
 *   smallTargets  interactive elements under the WCAG 2.5.8 24px floor
 *   overlaps      intersecting pairs among form controls and their labels
 *   headers       sticky/fixed elements and what they sit over
 *
 * Usage: node _harness/audit10-p3sweep.js [--json]
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const PASS = 'audit-pass-123';
const OUT = path.join(__dirname, 'out', 'audit10');

const VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'tablet-1024', width: 1024, height: 768 },
  { name: 'tablet-834', width: 834, height: 1112 },
  { name: 'mobile-390', width: 390, height: 844 },
];

const PAGES = [
  '/admin/index.php',
  '/admin/content.php',
  '/admin/settings.php',
  '/admin/add.php',
  '/admin/edit.php?sku=CC',
  '/admin/backups.php',
  '/admin/password.php',
  '/admin/inquiries.php',
  '/admin/audit-log.php',
  '/admin/help.php',
];

const MEASURE = () => {
  const vw = document.documentElement.clientWidth;
  const sig = (el) => {
    if (!el) return null;
    const id = el.id ? '#' + el.id : '';
    const nm = el.getAttribute && el.getAttribute('name') ? '[name=' + el.getAttribute('name') + ']' : '';
    const cls = el.className && typeof el.className === 'string' && el.className.trim()
      ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    return el.tagName.toLowerCase() + id + nm + cls;
  };
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
  };

  const controls = [...document.querySelectorAll('input, select, textarea')]
    .filter((el) => el.type !== 'hidden');

  const unlabelled = controls.filter((el) => {
    if (el.labels && el.labels.length) return false;
    if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) return false;
    if (el.type === 'submit' || el.type === 'button' || el.type === 'reset') return false;
    if (el.closest('label')) return false;
    return true;
  }).map((el) => ({ el: sig(el), type: el.type, name: el.name || null, visible: vis(el) }));

  const danglingLabels = [...document.querySelectorAll('label[for]')]
    .filter((l) => !document.getElementById(l.getAttribute('for')))
    .map((l) => ({ for: l.getAttribute('for'), text: l.textContent.trim().slice(0, 60) }));

  // Text that is cut off: the box hides the overflow AND there is overflow.
  const clipped = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!vis(el)) continue;
    const cs = getComputedStyle(el);
    const hidesX = /hidden|clip/.test(cs.overflowX);
    const over = el.scrollWidth - el.clientWidth;
    if (hidesX && over > 1 && el.clientWidth > 0 && !el.matches('input, textarea, select')) {
      clipped.push({ el: sig(el), overBy: over, clientWidth: el.clientWidth, text: (el.textContent || '').trim().slice(0, 70) });
    }
    if (clipped.length > 40) break;
  }

  const protruding = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1 || r.left < -1) {
      protruding.push({ el: sig(el), left: Math.round(r.left), right: Math.round(r.right) });
      if (protruding.length > 20) break;
    }
  }

  const main = document.querySelector('main') || document.body;
  const mr = main.getBoundingClientRect();
  const escaping = [];
  for (const el of main.querySelectorAll('*')) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (cs.position === 'fixed' || cs.position === 'sticky') continue;
    if (r.right > mr.right + 1) {
      escaping.push({ el: sig(el), right: Math.round(r.right), mainRight: Math.round(mr.right), overBy: Math.round(r.right - mr.right) });
      if (escaping.length > 20) break;
    }
  }

  const tables = [...document.querySelectorAll('table')].map((t) => {
    let sc = t.parentElement;
    let guard = 0;
    while (sc && guard++ < 6) {
      const cs = getComputedStyle(sc);
      if (/auto|scroll/.test(cs.overflowX)) break;
      sc = sc.parentElement;
    }
    const scCs = sc ? getComputedStyle(sc) : null;
    const scrollable = !!(scCs && /auto|scroll/.test(scCs.overflowX));
    return {
      el: sig(t),
      tableWidth: Math.round(t.getBoundingClientRect().width),
      tableScrollWidth: t.scrollWidth,
      container: scrollable ? sig(sc) : null,
      containerClientWidth: scrollable ? sc.clientWidth : null,
      containerScrollWidth: scrollable ? sc.scrollWidth : null,
      hiddenPx: scrollable ? Math.max(0, sc.scrollWidth - sc.clientWidth) : 0,
      scrollable,
      rows: t.querySelectorAll('tr').length,
    };
  });

  const smallTargets = [...document.querySelectorAll('a[href], button, input[type=submit], input[type=button], summary, [role=button]')]
    .filter(vis)
    .map((el) => {
      const r = el.getBoundingClientRect();
      return { el: sig(el), w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, text: (el.textContent || el.value || '').trim().slice(0, 40) };
    })
    .filter((x) => x.w < 24 || x.h < 24);

  // Overlap among controls and their labels (a real "label sits on the input").
  const boxes = [...controls, ...document.querySelectorAll('label')].filter(vis).map((el) => ({ el, r: el.getBoundingClientRect() }));
  const overlaps = [];
  for (let i = 0; i < boxes.length && overlaps.length < 12; i++) {
    for (let j = i + 1; j < boxes.length && overlaps.length < 12; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (ox > 2 && oy > 2) overlaps.push({ a: sig(a.el), b: sig(b.el), overlapX: Math.round(ox), overlapY: Math.round(oy) });
    }
  }

  const stuck = [...document.querySelectorAll('body *')].filter((el) => {
    const cs = getComputedStyle(el);
    return (cs.position === 'fixed' || cs.position === 'sticky') && vis(el);
  }).map((el) => {
    const r = el.getBoundingClientRect();
    return { el: sig(el), position: getComputedStyle(el).position, top: Math.round(r.top), height: Math.round(r.height), zIndex: getComputedStyle(el).zIndex };
  });

  // Anything that looks like a flash / banner region, and where it sits.
  const banners = [...document.querySelectorAll('[class*=flash], [class*=banner], [class*=alert], [class*=msg], [role=alert], [class*=notice], [class*=health]')]
    .filter(vis)
    .map((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return { el: sig(el), top: Math.round(r.top + window.scrollY), height: Math.round(r.height), color: cs.color, background: cs.backgroundColor, text: el.textContent.trim().slice(0, 90) };
    });

  return {
    vw,
    docScrollWidth: document.documentElement.scrollWidth,
    overflowX: Math.round(document.documentElement.scrollWidth - vw),
    controlCount: controls.length,
    unlabelled,
    danglingLabels,
    clipped,
    protruding,
    escaping,
    tables,
    smallTargets,
    overlaps,
    stuck,
    banners,
  };
};

(async () => {
  const browser = await launch();
  const out = [];
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    await page.goto(BASE + '/admin/', { waitUntil: 'domcontentloaded' });
    if (await page.$('input[type="password"]')) {
      await page.fill('input[type="password"]', PASS);
      await Promise.all([page.waitForNavigation(), page.click('button[type="submit"], input[type="submit"]')]);
    }
    for (const url of PAGES) {
      await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(250);
      const m = await page.evaluate(MEASURE);
      out.push({ url, viewport: vp.name, ...m });
      process.stdout.write('.');
    }
    // The signed-out login screen, in its own anonymous context.
    const anon = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const ap = await anon.newPage();
    await ap.goto(BASE + '/admin/', { waitUntil: 'networkidle' });
    out.push({ url: '/admin/ (signed out)', viewport: vp.name, ...(await ap.evaluate(MEASURE)) });
    await anon.close();
    await ctx.close();
    console.log(' ' + vp.name + ' done');
  }
  await browser.close();
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'p3sweep.json'), JSON.stringify(out, null, 1));

  const P = (label, rows) => {
    if (!rows.length) return;
    console.log(`\n=== ${label} ===`);
    for (const r of rows) console.log(r);
  };
  P('unlabelled controls', out.filter((r) => r.unlabelled.length)
    .map((r) => `${r.viewport} ${r.url} :: ${JSON.stringify(r.unlabelled)}`));
  P('dangling label[for]', out.filter((r) => r.danglingLabels.length)
    .map((r) => `${r.viewport} ${r.url} :: ${JSON.stringify(r.danglingLabels)}`));
  P('clipped text', out.filter((r) => r.clipped.length)
    .map((r) => `${r.viewport} ${r.url} :: ${JSON.stringify(r.clipped)}`));
  P('page overflowX', out.filter((r) => r.overflowX > 1)
    .map((r) => `${r.viewport} ${r.url} :: +${r.overflowX}px  ${JSON.stringify(r.protruding.slice(0, 5))}`));
  P('escaping <main>', out.filter((r) => r.escaping.length)
    .map((r) => `${r.viewport} ${r.url} :: ${JSON.stringify(r.escaping.slice(0, 5))}`));
  P('tables with hidden columns', out.filter((r) => r.tables.some((t) => t.hiddenPx > 0 || (!t.scrollable && t.tableScrollWidth > r.vw)))
    .map((r) => `${r.viewport} ${r.url} :: ${JSON.stringify(r.tables)}`));
  P('sub-24px targets', out.filter((r) => r.smallTargets.length)
    .map((r) => `${r.viewport} ${r.url} :: ${JSON.stringify(r.smallTargets)}`));
  P('overlapping controls/labels', out.filter((r) => r.overlaps.length)
    .map((r) => `${r.viewport} ${r.url} :: ${JSON.stringify(r.overlaps)}`));
  console.log('\nreport -> _harness/out/audit10/p3sweep.json');
})();
