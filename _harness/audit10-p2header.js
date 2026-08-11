/**
 * AUDIT-10 pass-2 — the product-detail header strip at 834 and 390.
 *
 * Eleven of the twelve screenshot reviewers independently reported the same
 * thing at mobile-390: the "Download PDF" / "Request Quote" buttons painted on
 * top of the "PRODUCT DETAIL" eyebrow and the first line of the <h1>, with the
 * title squeezed into a ~110-190px column. This measures it instead of looking
 * at it.
 *
 * The strip is  div.px-8.py-5.flex.items-start.justify-between.gap-4
 *   left   div.min-w-0.flex-1     eyebrow + <h1> + SKU
 *   right  div.flex.flex-wrap...  the action buttons  (no flex-shrink-0)
 *
 * Measured per product per viewport, under the shipped face and under
 * Liberation Sans (metric-compatible with Arial — the C49 control):
 *   - the two children's used widths and whether their boxes intersect
 *   - the painted text rects of the eyebrow / h1 / sku vs the buttons' rects,
 *     i.e. real ink-on-ink overlap, not box overlap
 *   - how many lines the h1 takes and its narrowest line
 *
 * Usage: node _harness/audit10-p2header.js [--shot]   (needs :8123)
 * Output: _harness/out/audit10/p2header.json
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');

const BASE = 'http://127.0.0.1:8123';
const OUT = path.join(__dirname, 'out', 'audit10');
const ISSUES = path.join(OUT, 'issues');
const LIB = 'Liberation Sans';
const products = JSON.parse(fs.readFileSync(path.join(__dirname, 'pristine', 'products-all.json'), 'utf8'));
const VPS = [{ n: 'mobile-390', w: 390, h: 844 }, { n: 'tablet-834', w: 834, h: 1112 }, { n: 'desktop-1440', w: 1440, h: 900 }];

const measure = () => {
  const h1 = document.querySelector('h1.text-xl.font-extrabold.text-white');
  if (!h1) return { found: false };
  const left = h1.parentElement;                       // div.min-w-0.flex-1
  const strip = left.parentElement;                    // the flex row
  const right = [...strip.children].find((c) => c !== left);
  const rectsOf = (el) => {
    if (!el) return [];
    const r = document.createRange(); r.selectNodeContents(el);
    return [...r.getClientRects()].filter((x) => x.width > 0.5 && x.height > 0.5);
  };
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { left: +r.left.toFixed(1), right: +r.right.toFixed(1), top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; };

  const eyebrow = left.querySelector('div');
  const sku = [...left.children].find((c) => c !== eyebrow && c !== h1);
  const buttons = right ? [...right.querySelectorAll('a, button')] : [];

  // ink-on-ink: every painted text rect of the left column against every
  // button's border box
  const inkHits = [];
  for (const [name, el] of [['eyebrow', eyebrow], ['h1', h1], ['sku', sku]]) {
    for (const tr of rectsOf(el)) {
      for (const b of buttons) {
        const br = b.getBoundingClientRect();
        const ox = Math.min(tr.right, br.right) - Math.max(tr.left, br.left);
        const oy = Math.min(tr.bottom, br.bottom) - Math.max(tr.top, br.top);
        if (ox > 0.5 && oy > 0.5) {
          inkHits.push({
            what: name, overlapW: +ox.toFixed(1), overlapH: +oy.toFixed(1),
            textRect: { l: +tr.left.toFixed(1), r: +tr.right.toFixed(1), t: +tr.top.toFixed(1) },
            button: (b.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 22),
            buttonRect: { l: +br.left.toFixed(1), r: +br.right.toFixed(1), t: +br.top.toFixed(1), b: +br.bottom.toFixed(1) },
            buttonZ: getComputedStyle(b).zIndex,
          });
        }
      }
    }
  }
  const h1Rects = rectsOf(h1);
  const lb = box(left), rb = box(right);
  return {
    found: true,
    name: (h1.textContent || '').trim(),
    strip: box(strip),
    stripStyle: (() => { const cs = getComputedStyle(strip); return { display: cs.display, alignItems: cs.alignItems, gap: cs.gap, flexWrap: cs.flexWrap, paddingLeft: cs.paddingLeft, paddingRight: cs.paddingRight }; })(),
    left: lb, right: rb,
    leftStyle: (() => { const cs = getComputedStyle(left); return { minWidth: cs.minWidth, flex: cs.flex, overflow: cs.overflow }; })(),
    rightStyle: right ? (() => { const cs = getComputedStyle(right); return { flexShrink: cs.flexShrink, flexWrap: cs.flexWrap, minWidth: cs.minWidth, width: cs.width }; })() : null,
    boxesIntersect: lb && rb ? +Math.max(0, lb.right - rb.left).toFixed(1) : null,
    h1: {
      box: box(h1),
      lines: h1Rects.length,
      lineWidths: h1Rects.map((r) => +r.width.toFixed(1)),
      widestLine: h1Rects.length ? +Math.max(...h1Rects.map((r) => r.width)).toFixed(1) : 0,
      paintedRight: h1Rects.length ? +Math.max(...h1Rects.map((r) => r.right)).toFixed(1) : null,
      overflowsOwnBox: h1Rects.length && lb ? +Math.max(0, Math.max(...h1Rects.map((r) => r.right)) - lb.right).toFixed(1) : 0,
      wordBreak: getComputedStyle(h1).wordBreak, overflowWrap: getComputedStyle(h1).overflowWrap,
    },
    eyebrow: eyebrow ? { text: (eyebrow.textContent || '').trim().slice(0, 20), box: box(eyebrow), painted: rectsOf(eyebrow).map((r) => ({ l: +r.left.toFixed(1), r: +r.right.toFixed(1) })) } : null,
    sku: sku ? { text: (sku.textContent || '').trim().slice(0, 30), box: box(sku), lines: rectsOf(sku).length } : null,
    buttons: buttons.map((b) => { const r = b.getBoundingClientRect(); return { text: (b.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 22), ...box(b), z: getComputedStyle(b).zIndex, position: getComputedStyle(b).position }; }),
    inkHits,
    // what a screen reader / a copy-paste sees is fine; what a camera sees:
    inkOverlapCount: inkHits.length,
  };
};

(async () => {
  const wantShot = process.argv.includes('--shot');
  fs.mkdirSync(ISSUES, { recursive: true });
  const browser = await launch();
  const rows = [];
  for (const font of [null, LIB]) {
    for (const vp of VPS) {
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, ...(vp.n === 'desktop-1440' ? {} : { hasTouch: true, isMobile: true }) });
      if (font) {
        await ctx.addInitScript((f) => {
          const apply = () => { const s = document.createElement('style'); s.id = '__p2font'; s.textContent = `*,*::before,*::after{font-family:"${f}"!important}`; document.head.appendChild(s); };
          if (document.readyState !== 'loading') apply(); else document.addEventListener('DOMContentLoaded', apply);
        }, font);
      }
      const page = await ctx.newPage();
      for (const p of products) {
        const url = '/products?productId=' + encodeURIComponent(p.id);
        await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 });
        await page.waitForTimeout(300);
        if (font) {
          const ok = await page.evaluate(() => !!document.getElementById('__p2font'));
          if (!ok) await page.addStyleTag({ content: `*,*::before,*::after{font-family:"Liberation Sans"!important}` });
          await page.waitForTimeout(200);
        }
        const m = await page.evaluate(measure);
        rows.push({ id: p.id, url, viewport: vp.n, font: font || 'shipped', ...m });
        process.stdout.write(m.inkOverlapCount ? '!' : '.');
      }
      await ctx.close();
      console.log(` ${vp.n} ${font || 'shipped'} done`);
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'p2header.json'), JSON.stringify(rows, null, 1));

  for (const font of ['shipped', LIB]) {
    for (const vp of VPS) {
      const sub = rows.filter((r) => r.font === font && r.viewport === vp.n && r.found);
      const bad = sub.filter((r) => r.inkOverlapCount > 0);
      const s = sub[0];
      console.log(`\n[${vp.n}/${font}] strip inner ${s ? s.strip.w : '?'}px; left col ${s ? s.left.w : '?'}px, buttons col ${s ? s.right.w : '?'}px; boxes intersect by ${s ? s.boxesIntersect : '?'}px`);
      console.log(`   pages with painted text UNDER a button: ${bad.length}/${sub.length}`);
      for (const r of bad.slice(0, 6)) {
        const worst = r.inkHits.reduce((a, b) => (b.overlapW > a.overlapW ? b : a));
        console.log(`     ${r.id}: ${r.inkHits.length} ink hits; worst ${worst.what} x "${worst.button}" ${worst.overlapW}x${worst.overlapH}px`);
      }
      const wraps = sub.map((r) => r.h1.lines);
      console.log(`   h1 lines: min ${Math.min(...wraps)} max ${Math.max(...wraps)}; widest h1 line across the set ${Math.max(...sub.map((r) => r.h1.widestLine)).toFixed(1)}px`);
      const skuWrap = sub.filter((r) => r.sku && r.sku.lines > 1);
      console.log(`   SKU wrapping to >1 line: ${skuWrap.length}/${sub.length}${skuWrap.length ? ' e.g. ' + skuWrap.slice(0, 4).map((r) => `${r.sku.text}(${r.sku.lines})`).join(', ') : ''}`);
    }
  }

  if (wantShot) {
    const b2 = await launch();
    for (const [vpn, w, h] of [['mobile-390', 390, 844], ['tablet-834', 834, 1112]]) {
      const worst = rows.filter((r) => r.font === 'shipped' && r.viewport === vpn && r.found)
        .sort((a, b) => b.inkOverlapCount - a.inkOverlapCount)[0];
      if (!worst) continue;
      const ctx = await b2.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
      const page = await ctx.newPage();
      await page.goto(BASE + worst.url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      const el = page.locator('h1.text-xl.font-extrabold.text-white').first();
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      const strip = page.locator('h1.text-xl.font-extrabold.text-white').locator('xpath=../..').first();
      await strip.screenshot({ path: path.join(ISSUES, `HEADER__${vpn}__${worst.id.replace(/[^A-Za-z0-9-]/g, '_')}-buttons-over-title.png`) }).catch(async () => {
        await page.screenshot({ path: path.join(ISSUES, `HEADER__${vpn}__${worst.id.replace(/[^A-Za-z0-9-]/g, '_')}-buttons-over-title.png`) });
      });
      await ctx.close();
      console.log(`shot: ${vpn} ${worst.id}`);
    }
    await b2.close();
  }
  console.log(`\n-> ${path.join(OUT, 'p2header.json')}`);
})();
