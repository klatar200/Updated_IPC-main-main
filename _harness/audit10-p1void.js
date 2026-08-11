/**
 * AUDIT-10 pass-1 framed-emptiness probe — the C44/C37 class, measured.
 *
 * The product-detail card stacks two `md:grid-cols-2` rows whose cells default
 * to align-items:stretch:
 *
 *   row 1  [ photo + caption | approvals + features + description ]
 *          left cell carries `md:border-r`, so a short photo column next to a
 *          long description paints a BORDERED EMPTY COLUMN.
 *
 *   row 2  [ SpecTable1 panel | SpecTable2 panel ]
 *          both panels are `h-full` with their own 1px border, so the shorter
 *          one paints a BORDERED EMPTY BOX under its last row.
 *
 * This measures the painted void in each: box height minus the bottom of the
 * last thing drawn inside it, minus that box's own bottom padding.
 *
 * Everything is measured on TWO separate navigations in two separate browser
 * contexts, and the probe prints whether the two runs agree — guardrails.json
 * `twice_means_twice`.
 *
 * Output: _harness/out/audit10/p1void.json  (gitignored)
 * Usage:  node _harness/audit10-p1void.js
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
function measureVoids() {
  const R = (n) => Math.round(n * 10) / 10;
  const inner = (box) => {
    // bottom-most painted descendant inside `box`
    const br = box.getBoundingClientRect();
    let bottom = br.top;
    for (const k of box.querySelectorAll('*')) {
      const kr = k.getBoundingClientRect();
      if (kr.height > 0 && kr.bottom > bottom) bottom = kr.bottom;
    }
    const cs = getComputedStyle(box);
    const padB = parseFloat(cs.paddingBottom) || 0;
    const borderB = parseFloat(cs.borderBottomWidth) || 0;
    return {
      boxW: R(br.width), boxH: R(br.height),
      contentH: R(bottom - br.top),
      voidPx: R(br.bottom - borderB - padB - bottom),
      border: cs.borderTopWidth + ' ' + cs.borderTopStyle + ' ' + cs.borderTopColor,
      bg: cs.backgroundColor,
    };
  };

  const photoBox = document.querySelector('[data-ipc-photo-box]');
  const card = photoBox ? photoBox.closest('.rounded-2xl') : null;
  const out = { photoCell: null, spec1: null, spec2: null, cardW: null };
  if (!card) return out;
  out.cardW = R(card.getBoundingClientRect().width);

  // row 1, left cell — the padded div that holds the photo box
  const photoCell = photoBox.closest('div.p-5, div[class*="p-5"]');
  if (photoCell) {
    const cs = getComputedStyle(photoCell);
    out.photoCell = {
      ...inner(photoCell),
      borderRight: cs.borderRightWidth + ' ' + cs.borderRightColor,
      display: getComputedStyle(photoCell.parentElement).display,
      cols: getComputedStyle(photoCell.parentElement).gridTemplateColumns,
    };
  }

  // row 2 — the two h-full bordered panels. spec1 holds a .divide-y row list,
  // spec2 holds a <table>.
  for (const el of card.querySelectorAll('div.rounded-xl.h-full, div.rounded-xl')) {
    const cs = getComputedStyle(el);
    if (!/^1px/.test(cs.borderTopWidth) && parseFloat(cs.borderTopWidth) === 0) continue;
    if (cs.height === 'auto') continue;
    if (el.querySelector('table')) {
      if (!out.spec2) out.spec2 = { ...inner(el), kind: 'SpecTable2', hFull: el.className.includes('h-full') };
    } else if (el.querySelector('.divide-y')) {
      if (!out.spec1) out.spec1 = { ...inner(el), kind: 'SpecTable1', hFull: el.className.includes('h-full') };
    }
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
          runs[pass].push({ id: p.id, url, viewport: vp.name, ...(await page.evaluate(measureVoids)) });
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
  fs.writeFileSync(path.join(OUT, 'p1void.json'), JSON.stringify({ identicalAcrossRuns: same, run1: runs[0], run2: runs[1] }, null, 1));
  console.log('\nidentical across two navigations: ' + same);
  console.log('rows/run: ' + runs[0].length + ' -> _harness/out/audit10/p1void.json');
})();
